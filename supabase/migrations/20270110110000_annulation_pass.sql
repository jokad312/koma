-- Story 7.9 : annulation et remboursement d'un Pass (FR-38, AD-8, AD-23, AD-31).
-- 1. Les frais d'annulation des Pass sont figés avec la Commande de Pass (AD-8) : colonne commande.frais_annulation_pass, posée par un déclencheur
--    à l'insertion (creer_commande n'est pas modifiée). Une Commande de Pass passée sans réglage garde NULL : le réglage du jour s'applique alors.
-- 2. demande_client porte le Pass concerné (pass_id) pour le type « annulation_pass ».
-- 3. Fonctions : demander_annulation_pass (client), pass_annulables (lecture du Compte), annuler_pass (Admin), traiter_demande et
--    confirmer_remboursement étendues. Le Stand s'annule par paire (les deux titulaires d'une unité) ; la paire partage un seul remboursement,
--    rattaché au Pass de la demande. Aucun remboursement automatique chez un Prestataire (Q-4) : Jonathan rend l'argent puis confirme avec preuve.

alter table public.commande add column frais_annulation_pass smallint check (frais_annulation_pass is null or frais_annulation_pass between 0 and 100);

-- Pourcentage de frais lu dans les réglages : entier de 0 à 100, sinon NULL (réglage absent ou mal formé).
create function public.evenements_frais_reglage()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select case when r.valeur ~ '^[0-9]{1,3}$' and r.valeur::integer <= 100 then r.valeur::smallint end
  from public.reglage r where r.cle = 'frais_annulation_pass'
$$;
revoke all on function public.evenements_frais_reglage() from public, anon, authenticated, service_role;

create function public.commande_figer_frais_pass()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.type = 'pass' and new.frais_annulation_pass is null then
    new.frais_annulation_pass := public.evenements_frais_reglage();
  end if;
  return new;
end;
$$;
revoke all on function public.commande_figer_frais_pass() from public, anon, authenticated, service_role;
create trigger commande_figer_frais_pass before insert on public.commande for each row execute function public.commande_figer_frais_pass();

-- Frais applicables à une Commande de Pass : ceux figés à l'achat, sinon le réglage du jour ; NULL si aucun des deux (règle 15).
create function public.evenements_frais_commande(p_commande uuid)
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(c.frais_annulation_pass, public.evenements_frais_reglage()) from public.commande c where c.id = p_commande
$$;
revoke all on function public.evenements_frais_commande(uuid) from public, anon, authenticated, service_role;

alter table public.demande_client add column pass_id uuid references public.pass (id) on delete restrict;
alter table public.demande_client add constraint demande_pass_coherente check ((type = 'annulation_pass') = (pass_id is not null));
create index demande_client_pass_idx on public.demande_client (pass_id) where pass_id is not null;
create unique index demande_annulation_pass_unique on public.demande_client (pass_id) where type = 'annulation_pass' and statut in ('ouverte', 'acceptee');

-- Unité d'annulation d'un Pass : lui seul, ou la paire de titulaires d'un Stand (rangs 1-2, 3-4, ...).
create function public.evenements_unite_pass(p_pass uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p2.id
  from public.pass p
  join public.ligne_commande l on l.id = p.ligne_commande_id
  join public.pass p2 on p2.ligne_commande_id = p.ligne_commande_id and (not coalesce(l.est_stand, false) or (p2.rang + 1) / 2 = (p.rang + 1) / 2)
  where p.id = p_pass
$$;
revoke all on function public.evenements_unite_pass(uuid) from public, anon, authenticated, service_role;

-- Motif de refus d'une demande d'annulation, calculé en base avec now() (AD-23) ; NULL si le Pass peut être annulé.
-- Valide, Commande payée (jamais offerte : un Pass gratuit ne se rembourse pas), Événement daté qui commence dans plus de 48 heures,
-- tous les Pass de l'unité valides, aucune demande ouverte ou acceptée sur l'unité, frais connus.
create function public.evenements_motif_refus_annulation(p_pass uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_p public.pass;
  v_c public.commande;
  v_debut timestamptz;
begin
  select * into v_p from public.pass where id = p_pass;
  if not found then
    return 'KS_PASS_INTROUVABLE';
  end if;
  select * into v_c from public.commande where id = v_p.commande_id;
  select e.debut_le into v_debut from public.evenement e where e.id = v_p.evenement_id;
  if v_p.statut <> 'valide' or v_c.type <> 'pass' or v_c.statut <> 'payee' or v_c.offerte
     or v_debut is null or v_debut - now() <= interval '48 hours'
     or exists (select 1 from public.pass u where u.id in (select public.evenements_unite_pass(p_pass)) and u.statut <> 'valide') then
    return 'KS_ANNULATION_IMPOSSIBLE';
  end if;
  if exists (select 1 from public.demande_client d where d.type = 'annulation_pass' and d.statut in ('ouverte', 'acceptee') and d.pass_id in (select public.evenements_unite_pass(p_pass))) then
    return 'KS_DEMANDE_EN_COURS';
  end if;
  if public.evenements_frais_commande(v_c.id) is null then
    return 'KS_REGLAGE_MANQUANT';
  end if;
  return null;
end;
$$;
revoke all on function public.evenements_motif_refus_annulation(uuid) from public, anon, authenticated, service_role;

-- Pass d'un Compte dont la demande d'annulation est permise maintenant (affichage du bouton « Demander l'annulation »). Le Compte est celui de la session.
create function public.pass_annulables(p_compte uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(p.id), '{}'::uuid[])
  from public.pass p
  join public.commande c on c.id = p.commande_id
  where c.compte_id = p_compte and c.type = 'pass' and p.statut = 'valide' and public.evenements_motif_refus_annulation(p.id) is null
$$;
revoke all on function public.pass_annulables(uuid) from public, anon, authenticated;
grant execute on function public.pass_annulables(uuid) to service_role;

-- Le client demande l'annulation d'un de ses Pass (appelée par le serveur après vérification de la session).
create function public.demander_annulation_pass(p_compte uuid, p_pass uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.pass;
  v_motif text;
  v_id uuid;
begin
  select p.* into v_p from public.pass p join public.commande c on c.id = p.commande_id where p.id = p_pass and c.compte_id = p_compte for update of p;
  if not found then
    raise exception 'KS_PASS_INTROUVABLE' using errcode = 'P0001';
  end if;
  v_motif := public.evenements_motif_refus_annulation(v_p.id);
  if v_motif is not null then
    raise exception '%', v_motif using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', jsonb_build_object('type', 'compte', 'id', p_compte)::text, true);
  insert into public.demande_client (commande_id, type, pass_id) values (v_p.commande_id, 'annulation_pass', v_p.id) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.demander_annulation_pass(uuid, uuid) from public, anon, authenticated;
grant execute on function public.demander_annulation_pass(uuid, uuid) to service_role;

-- Accepte la demande d'annulation d'un Pass (Admin). Le Pass (et son second titulaire pour un Stand) passe « annule » : refusé au Scan dès cet instant.
-- Montant figé : (prix figé x nombre - réduction) de la ligne / nombre de Pass de la ligne x (1 - frais figés), arrondi au centime inférieur (AD-31).
-- Les places se libèrent d'elles-mêmes : les compteurs ne comptent pas les Pass annulés. Retourne le montant à rendre, en centimes.
create function public.annuler_pass(p_auteur jsonb, p_pass uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.pass;
  v_c public.commande;
  v_l public.ligne_commande;
  v_frais smallint;
  v_k integer;
  v_npass bigint;
  v_montant bigint;
  v_demande uuid;
begin
  perform public.exiger_admin(p_auteur);
  select * into v_p from public.pass where id = p_pass;
  if not found then
    raise exception 'KS_PASS_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Verrou de toute l'unité, dans l'ordre des identifiants.
  perform 1 from public.pass where id in (select public.evenements_unite_pass(p_pass)) order by id for update;
  select * into v_p from public.pass where id = p_pass;
  select * into v_c from public.commande where id = v_p.commande_id for update;
  select * into v_l from public.ligne_commande where id = v_p.ligne_commande_id;
  select d.id into v_demande from public.demande_client d where d.pass_id = p_pass and d.type = 'annulation_pass' and d.statut = 'ouverte' for update;
  if v_demande is null then
    raise exception 'KS_DEMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_c.type <> 'pass' or v_c.statut <> 'payee' or v_c.offerte
     or exists (select 1 from public.pass u where u.id in (select public.evenements_unite_pass(p_pass)) and u.statut <> 'valide') then
    raise exception 'KS_ANNULATION_IMPOSSIBLE' using errcode = 'P0001';
  end if;
  v_frais := public.evenements_frais_commande(v_c.id);
  if v_frais is null then
    raise exception 'KS_REGLAGE_MANQUANT' using errcode = 'P0001';
  end if;
  select count(*)::integer into v_k from public.evenements_unite_pass(p_pass);
  v_npass := v_l.nombre::bigint * case when coalesce(v_l.est_stand, false) then 2 else 1 end;
  v_montant := ((v_l.prix_cents::bigint * v_l.nombre - v_l.reduction_cents) * v_k * (100 - v_frais)) / (100 * v_npass);
  if v_montant <= 0 then
    raise exception 'KS_REMBOURSEMENT_NUL' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.pass set statut = 'annule' where id in (select public.evenements_unite_pass(p_pass));
  update public.demande_client set statut = 'acceptee', traitee_le = now() where id = v_demande;
  insert into public.remboursement (cible_type, cible_id, montant_cents, devise) values ('pass', p_pass, v_montant::integer, v_c.devise);
  perform public.envois_planifier('pass_annule', v_c.compte_id, jsonb_build_object('commande_id', v_c.id, 'pass_id', p_pass), 'pass_annule:' || p_pass::text);
  return v_montant::integer;
end;
$$;
revoke all on function public.annuler_pass(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.annuler_pass(jsonb, uuid) to service_role;

-- traiter_demande : prend aussi en charge « annulation_pass » (accepter appelle annuler_pass). Les réclamations passent par traiter_reclamation.
create or replace function public.traiter_demande(p_auteur jsonb, p_demande uuid, p_decision text)
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
  if v_d.type not in ('annulation_commande', 'annulation_pass') then
    raise exception 'KS_TYPE_NON_PRIS_EN_CHARGE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  if p_decision = 'accepter' then
    if v_d.type = 'annulation_pass' then
      perform public.annuler_pass(p_auteur, v_d.pass_id);
    else
      perform public.annuler_commande(p_auteur, v_d.commande_id);
      update public.demande_client set statut = 'acceptee', traitee_le = now() where id = v_d.id;
    end if;
  else
    update public.demande_client set statut = 'refusee', traitee_le = now() where id = v_d.id;
  end if;
end;
$$;
revoke all on function public.traiter_demande(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.traiter_demande(jsonb, uuid, text) to service_role;

-- confirmer_remboursement : même fonction qu'en 20261216100000, avec la cible « pass » (le Pass de la demande ; la paire d'un Stand passe « rembourse » ensemble).
create or replace function public.confirmer_remboursement(p_auteur jsonb, p_cible_type text, p_cible_id uuid, p_preuve text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preuve text := btrim(coalesce(p_preuve, ''));
  v_c public.commande;
  v_t public.trop_percu;
  v_p public.pass;
  v_cents bigint;
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
    if exists (select 1 from public.remboursement where cible_type = 'commande' and cible_id = v_c.id and valide_le is null and montant_cents <= 0) then
      raise exception 'KS_REMBOURSEMENT_NUL' using errcode = 'P0001';
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
  elsif p_cible_type = 'pass' then
    select * into v_p from public.pass where id = p_cible_id;
    if not found then
      raise exception 'KS_PASS_INTROUVABLE' using errcode = 'P0001';
    end if;
    perform 1 from public.pass where id in (select public.evenements_unite_pass(p_cible_id)) order by id for update;
    select * into v_p from public.pass where id = p_cible_id;
    select * into v_c from public.commande where id = v_p.commande_id;
    if v_p.statut <> 'annule' then
      raise exception 'KS_REMBOURSEMENT_IMPOSSIBLE' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.remboursement where cible_type = 'pass' and cible_id = v_p.id and valide_le is null and montant_cents <= 0) then
      raise exception 'KS_REMBOURSEMENT_NUL' using errcode = 'P0001';
    end if;
    update public.remboursement set preuve_reference = v_preuve, valide_par = p_auteur, valide_le = now()
      where cible_type = 'pass' and cible_id = v_p.id and valide_le is null;
    if not found then
      raise exception 'KS_REMBOURSEMENT_IMPOSSIBLE' using errcode = 'P0001';
    end if;
    update public.pass set statut = 'rembourse' where id in (select public.evenements_unite_pass(v_p.id)) and statut = 'annule';
    update public.demande_client set statut = 'close', traitee_le = coalesce(traitee_le, now())
      where pass_id = v_p.id and type = 'annulation_pass' and statut = 'acceptee';
    perform public.envois_planifier('pass_rembourse', v_c.compte_id, jsonb_build_object('commande_id', v_c.id, 'pass_id', v_p.id), 'pass_rembourse:' || v_p.id::text);
  elsif p_cible_type = 'trop_percu' then
    select * into v_t from public.trop_percu where id = p_cible_id for update;
    if not found then
      raise exception 'KS_TROP_PERCU_INTROUVABLE' using errcode = 'P0001';
    end if;
    if v_t.statut <> 'a_rembourser' then
      raise exception 'KS_REMBOURSEMENT_IMPOSSIBLE' using errcode = 'P0001';
    end if;
    -- Montant rendu : le montant recu, tel que le Prestataire l'a renvoye, en centimes de sa devise.
    v_cents := round(v_t.montant_recu * 100)::bigint;
    if v_cents <= 0 then
      raise exception 'KS_REMBOURSEMENT_NUL' using errcode = 'P0001';
    end if;
    insert into public.remboursement (cible_type, cible_id, montant_cents, devise, preuve_reference, valide_par, valide_le)
      values ('trop_percu', v_t.id, v_cents, v_t.devise_recue, v_preuve, p_auteur, now());
    update public.trop_percu set statut = 'rembourse', clos_le = now() where id = v_t.id;
  else
    raise exception 'KS_REMBOURSEMENT_IMPOSSIBLE' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.confirmer_remboursement(jsonb, text, uuid, text) from public, anon, authenticated;
grant execute on function public.confirmer_remboursement(jsonb, text, uuid, text) to service_role;
