-- Story 6.6 : annulation d'une Commande de Cosplay et remboursement (AD-27, AD-31). Aucun remboursement n'est lance automatiquement chez un Prestataire
-- (Q-4) : Jonathan rend l'argent a la main puis confirme avec une preuve. Les tables ne sont lisibles que par le serveur (RLS, aucun droit client).

alter type public.envoi_modele add value if not exists 'commande_annulee';
alter type public.envoi_modele add value if not exists 'commande_remboursee';

alter table public.ligne_commande add column annulee boolean not null default false;

-- Demande d'un client (module commande). Les statuts « article_rendu » et « remplacement_remis » des reclamations arrivent avec la story 6.7.
create table public.demande_client (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.commande (id) on delete restrict,
  type text not null check (type in ('annulation_commande', 'annulation_pass', 'reclamation')),
  statut text not null default 'ouverte' check (statut in ('ouverte', 'acceptee', 'refusee', 'close')),
  cree_le timestamptz not null default now(),
  traitee_le timestamptz,
  constraint demande_traitee_coherente check ((statut = 'ouverte') = (traitee_le is null) or statut = 'close')
);
create index demande_client_commande_idx on public.demande_client (commande_id);
-- Au plus une demande d'annulation ouverte ou acceptee (non close) par Commande.
create unique index demande_annulation_unique on public.demande_client (commande_id) where type = 'annulation_commande' and statut in ('ouverte', 'acceptee');
alter table public.demande_client enable row level security;
revoke all on public.demande_client from public, anon, authenticated;
create trigger demande_client_journaliser
  after insert or update or delete on public.demande_client
  for each row execute function public.journaliser('id');

-- Remboursement (module paiement) : montant fige par la fonction qui accepte la demande ; la preuve est exigee pour le confirmer.
create table public.remboursement (
  id uuid primary key default gen_random_uuid(),
  cible_type text not null check (cible_type in ('commande', 'pass', 'trop_percu')),
  cible_id uuid not null,
  montant_cents integer not null check (montant_cents >= 0),
  devise text not null check (devise ~ '^[A-Z]{3}$'),
  preuve_reference text check (preuve_reference is null or char_length(preuve_reference) between 3 and 200),
  valide_par jsonb,
  valide_le timestamptz,
  cree_le timestamptz not null default now(),
  constraint remboursement_valide_coherent check ((valide_le is null) = (preuve_reference is null) and (valide_le is null) = (valide_par is null)),
  constraint remboursement_cible_unique unique (cible_type, cible_id)
);
alter table public.remboursement enable row level security;
revoke all on public.remboursement from public, anon, authenticated;
create trigger remboursement_journaliser
  after insert or update or delete on public.remboursement
  for each row execute function public.journaliser('id');

-- Le client demande l'annulation (appelee par le serveur apres verification de la session ; le Compte est celui de la session, jamais une saisie).
-- Permise pour une Commande payee qui contient un Cosplay et n'est pas en fabrication.
create function public.demander_annulation(p_compte uuid, p_numero text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.commande;
  v_id uuid;
begin
  select * into v_c from public.commande where numero = p_numero and compte_id = p_compte for update;
  if not found then
    raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_c.statut <> 'payee' or v_c.offerte
     or not exists (select 1 from public.ligne_commande l join public.produit p on p.id = l.produit_id where l.commande_id = v_c.id and p.famille = 'cosplay') then
    raise exception 'KS_ANNULATION_IMPOSSIBLE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.demande_client d where d.commande_id = v_c.id and d.type = 'annulation_commande' and d.statut in ('ouverte', 'acceptee')) then
    raise exception 'KS_DEMANDE_EN_COURS' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', jsonb_build_object('type', 'compte', 'id', p_compte)::text, true);
  insert into public.demande_client (commande_id, type) values (v_c.id, 'annulation_commande') returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.demander_annulation(uuid, text) from public, anon, authenticated;
grant execute on function public.demander_annulation(uuid, text) to service_role;

-- Annule la Commande entiere (AD-27) : lignes physiques annulees, stock rendu, Commande « annulee », montant a rendre fige dans un remboursement :
-- somme (prix fige x nombre - reduction) des lignes physiques + Forfait de livraison. Les Kits restent dans la Bibliotheque (acces_kit conserve).
-- Les places du Plafond se libèrent d'elles-memes : elles ne comptent que les Commandes payee ou en fabrication.
create function public.annuler_commande(p_auteur jsonb, p_commande uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.commande;
  v_montant integer;
begin
  perform public.exiger_admin(p_auteur);
  select * into v_c from public.commande where id = p_commande for update;
  if not found then
    raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_c.statut <> 'payee' or v_c.offerte
     or not exists (select 1 from public.ligne_commande l join public.produit p on p.id = l.produit_id where l.commande_id = v_c.id and p.famille = 'cosplay') then
    raise exception 'KS_ANNULATION_IMPOSSIBLE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  select coalesce(sum(l.prix_cents * l.nombre - l.reduction_cents), 0)::integer + v_c.forfait_cents into v_montant
    from public.ligne_commande l where l.commande_id = v_c.id and l.variante_id is not null;
  -- Stock rendu pour les pieces prises en stock (ordre des verrous par variante, comme a la confirmation du paiement).
  update public.variante v set stock = v.stock + s.total
    from (select l.variante_id, sum(l.nombre)::integer as total from public.ligne_commande l
          where l.commande_id = v_c.id and l.variante_id is not null and l.origine = 'stock' group by l.variante_id) s
    where v.id = s.variante_id;
  update public.ligne_commande set annulee = true where commande_id = v_c.id and variante_id is not null;
  update public.commande set statut = 'annulee', mis_a_jour_le = now() where id = v_c.id;
  insert into public.remboursement (cible_type, cible_id, montant_cents, devise) values ('commande', v_c.id, greatest(v_montant, 0), v_c.devise);
  perform public.envois_planifier('commande_annulee', v_c.compte_id, jsonb_build_object('commande_id', v_c.id), 'commande_annulee:' || v_c.id::text);
  return greatest(v_montant, 0);
end;
$$;
revoke all on function public.annuler_commande(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.annuler_commande(jsonb, uuid) to service_role;

-- Traite une demande (admin) : « accepter » ou « refuser ». Pour une annulation de Commande, accepter appelle annuler_commande ; refuser laisse la Commande intacte.
create function public.traiter_demande(p_auteur jsonb, p_demande uuid, p_decision text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.demande_client;
begin
  perform public.exiger_admin(p_auteur);
  if p_decision is null or p_decision not in ('accepter', 'refuser') then
    raise exception 'KS_DECISION_INVALIDE' using errcode = 'P0001';
  end if;
  select * into v_d from public.demande_client where id = p_demande for update;
  if not found then
    raise exception 'KS_DEMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_d.statut <> 'ouverte' then
    raise exception 'KS_DEMANDE_DEJA_TRAITEE' using errcode = 'P0001';
  end if;
  if v_d.type <> 'annulation_commande' then
    raise exception 'KS_TYPE_NON_PRIS_EN_CHARGE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  if p_decision = 'accepter' then
    perform public.annuler_commande(p_auteur, v_d.commande_id);
    update public.demande_client set statut = 'acceptee', traitee_le = now() where id = v_d.id;
  else
    update public.demande_client set statut = 'refusee', traitee_le = now() where id = v_d.id;
  end if;
end;
$$;
revoke all on function public.traiter_demande(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.traiter_demande(jsonb, uuid, text) to service_role;

-- Seule fonction qui passe « annulee » a « remboursee » ou clot un Trop-percu rembourse (AD-31). La preuve est exigee (reference du Prestataire ou du virement
-- manuel). Admin seulement (droit « remboursement.valider »). Aucun remboursement n'est lance chez un Prestataire par cette fonction.
create function public.confirmer_remboursement(p_auteur jsonb, p_cible_type text, p_cible_id uuid, p_preuve text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preuve text := btrim(coalesce(p_preuve, ''));
  v_c public.commande;
  v_t public.trop_percu;
begin
  perform public.exiger_admin(p_auteur);
  if char_length(v_preuve) not between 3 and 200 then
    raise exception 'KS_PREUVE_REQUISE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  if p_cible_type = 'commande' then
    select * into v_c from public.commande where id = p_cible_id for update;
    if not found then
      raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
    end if;
    if v_c.statut <> 'annulee' then
      raise exception 'KS_REMBOURSEMENT_IMPOSSIBLE' using errcode = 'P0001';
    end if;
    update public.remboursement set preuve_reference = v_preuve, valide_par = p_auteur, valide_le = now()
      where cible_type = 'commande' and cible_id = v_c.id and valide_le is null;
    if not found then
      raise exception 'KS_REMBOURSEMENT_IMPOSSIBLE' using errcode = 'P0001';
    end if;
    update public.commande set statut = 'remboursee', mis_a_jour_le = now() where id = v_c.id;
    update public.demande_client set statut = 'close', traitee_le = coalesce(traitee_le, now())
      where commande_id = v_c.id and type = 'annulation_commande' and statut = 'acceptee';
    perform public.envois_planifier('commande_remboursee', v_c.compte_id, jsonb_build_object('commande_id', v_c.id), 'commande_remboursee:' || v_c.id::text);
  elsif p_cible_type = 'trop_percu' then
    select * into v_t from public.trop_percu where id = p_cible_id for update;
    if not found then
      raise exception 'KS_TROP_PERCU_INTROUVABLE' using errcode = 'P0001';
    end if;
    if v_t.statut <> 'a_rembourser' then
      raise exception 'KS_REMBOURSEMENT_IMPOSSIBLE' using errcode = 'P0001';
    end if;
    -- Montant rendu : le montant reçu, tel que le Prestataire l'a renvoye, dans sa devise.
    insert into public.remboursement (cible_type, cible_id, montant_cents, devise, preuve_reference, valide_par, valide_le)
      values ('trop_percu', v_t.id, round(v_t.montant_recu * 100)::integer, v_t.devise_recue, v_preuve, p_auteur, now());
    update public.trop_percu set statut = 'rembourse', clos_le = now() where id = v_t.id;
  else
    raise exception 'KS_REMBOURSEMENT_IMPOSSIBLE' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.confirmer_remboursement(jsonb, text, uuid, text) from public, anon, authenticated;
grant execute on function public.confirmer_remboursement(jsonb, text, uuid, text) to service_role;
