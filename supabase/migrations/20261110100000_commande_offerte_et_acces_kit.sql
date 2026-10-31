-- Story 3.5 : Obtenir le Kit gratuit.
-- Tables commande, ligne_commande (module commande) et acces_kit (module bibliotheque) ; numéro lisible KS-AAAA-NNNNNN ;
-- fonctions offrir_commande (Commande offerte à 0 USD, sans Prestataire, qui passe livree dans la même transaction) et
-- bibliotheque_ouvrir_acces (seule écriture de acces_kit, AD-11). Aucune écriture par anon ni authenticated (AD-2).
-- Les colonnes propres au paiement (panier, tentatives, expiration) arriveront par de nouvelles migrations (epic 4).

create sequence public.commande_numero_seq as bigint minvalue 1 start 1;
revoke all on sequence public.commande_numero_seq from public, anon, authenticated;

create table public.commande (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique default ('KS-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.commande_numero_seq')::text, 6, '0')),
  compte_id uuid not null references auth.users (id) on delete restrict,
  type text not null check (type in ('produits', 'pass')),
  statut text not null check (statut in ('en_attente', 'payee', 'en_fabrication', 'expediee', 'livree', 'echouee', 'expiree', 'annulee', 'remboursee', 'offerte')),
  -- Vrai pour une Commande offerte (Kit gratuit) : jamais payée, sans Prestataire ni référence (AD-4, FR-58).
  offerte boolean not null default false,
  sous_total_cents integer not null check (sous_total_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  devise text not null default 'USD' check (devise = 'USD'),
  -- [{objet, version, accepte_le}] : acceptations exigées par le contenu de la Commande, avec la version du texte (AD-34).
  acceptations jsonb not null default '[]'::jsonb check (jsonb_typeof(acceptations) = 'array'),
  cle_idempotence text check (cle_idempotence is null or length(cle_idempotence) between 8 and 100),
  prestataire text,
  reference_transaction text,
  paye_le timestamptz,
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now(),
  constraint commande_numero_format check (numero ~ '^KS-[0-9]{4}-[0-9]{6,}$'),
  constraint commande_offerte_coherente check (
    (statut <> 'offerte' or offerte)
    and (not offerte or (
      statut in ('offerte', 'livree')
      and total_cents = 0
      and paye_le is null
      and prestataire is null
      and reference_transaction is null
    ))
  ),
  constraint commande_idempotence_unique unique (compte_id, cle_idempotence)
);

create index commande_compte_idx on public.commande (compte_id, cree_le desc);

create table public.ligne_commande (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.commande (id) on delete restrict,
  produit_id uuid not null references public.produit (id) on delete restrict,
  quantite smallint not null default 1 check (quantite > 0),
  -- Prix figé à la commande (AD-8).
  prix_cents integer not null check (prix_cents >= 0),
  reduction_cents integer not null default 0 check (reduction_cents >= 0),
  cree_le timestamptz not null default now()
);

create index ligne_commande_commande_idx on public.ligne_commande (commande_id);

create table public.acces_kit (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references auth.users (id) on delete restrict,
  produit_id uuid not null references public.produit (id) on delete restrict,
  commande_origine uuid not null references public.commande (id) on delete restrict,
  cree_le timestamptz not null default now(),
  constraint acces_kit_unique unique (compte_id, produit_id)
);

alter table public.commande enable row level security;
alter table public.ligne_commande enable row level security;
alter table public.acces_kit enable row level security;

revoke all on public.commande, public.ligne_commande, public.acces_kit from public, anon, authenticated;
grant select on public.commande, public.ligne_commande, public.acces_kit to authenticated;

-- Un client lit seulement ses Commandes et ses accès ; aucune politique d'écriture (AD-2).
create policy commande_lecture_propre on public.commande
  for select to authenticated
  using (compte_id = (select auth.uid()));

create policy ligne_commande_lecture_propre on public.ligne_commande
  for select to authenticated
  using (exists (select 1 from public.commande c where c.id = commande_id and c.compte_id = (select auth.uid())));

create policy acces_kit_lecture_propre on public.acces_kit
  for select to authenticated
  using (compte_id = (select auth.uid()));

create trigger commande_journaliser
  after insert or update or delete on public.commande
  for each row execute function public.journaliser('id');
create trigger ligne_commande_journaliser
  after insert or update or delete on public.ligne_commande
  for each row execute function public.journaliser('id');
create trigger acces_kit_journaliser
  after insert or update or delete on public.acces_kit
  for each row execute function public.journaliser('id');

-- Auteur d'un acte de client : objet de type « compte », identifiant valide, Compte complet (âge déclaré, AD-24).
-- Le rôle écrit dans l'auteur n'est jamais cru. Renvoie l'identifiant du Compte. Interne : appelée par d'autres fonctions.
create function public.exiger_client(p_auteur jsonb)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  if p_auteur ->> 'type' is distinct from 'compte' or coalesce(p_auteur ->> 'id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    raise exception 'KS_AUTEUR_INVALIDE' using errcode = 'P0001';
  end if;
  v_compte := (p_auteur ->> 'id')::uuid;
  if not public.compte_complet(v_compte) then
    raise exception 'KS_COMPTE_INCOMPLET' using errcode = 'P0001';
  end if;
  return v_compte;
end;
$$;

-- Ouvre l'accès d'un Compte à un Kit. Seule écriture de acces_kit ; jamais supprimée par une annulation (AD-11).
-- Renvoie vrai si l'accès vient d'être créé, faux s'il existait déjà. Interne : appelée par offrir_commande (et plus tard confirmer_paiement).
create function public.bibliotheque_ouvrir_acces(p_compte uuid, p_produit uuid, p_commande uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cree integer;
begin
  if not exists (select 1 from public.produit where id = p_produit and famille = 'kit') then
    raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
  end if;
  insert into public.acces_kit (compte_id, produit_id, commande_origine)
  values (p_compte, p_produit, p_commande)
  on conflict (compte_id, produit_id) do nothing;
  get diagnostics v_cree = row_count;
  return v_cree = 1;
end;
$$;

-- Obtient le Kit gratuit : Commande « offerte » à 0 USD, sans Prestataire, qui passe « livree » dans la même transaction
-- (deux lignes de journal : création, puis passage à livree), puis ouverture de l'accès (AD-3, AD-11).
-- p_acceptations : tableau [{objet, version}] ; la Licence de kit (objet « licence_kit ») est exigée, sans renonciation au droit de rétractation (AD-34).
-- p_cle_idempotence : générée par le formulaire ; une même clé renvoie la même Commande.
create function public.offrir_commande(p_auteur jsonb, p_produit uuid, p_acceptations jsonb, p_cle_idempotence text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_produit record;
  v_version text;
  v_commande record;
  v_id uuid;
begin
  v_compte := public.exiger_client(p_auteur);

  if p_cle_idempotence is null or length(p_cle_idempotence) not between 8 and 100 then
    raise exception 'KS_CLE_IDEMPOTENCE_INVALIDE' using errcode = 'P0001';
  end if;

  -- Deux envois simultanés du même Compte pour le même Kit s'attendent : le second voit le résultat du premier.
  perform pg_advisory_xact_lock(hashtextextended(v_compte::text || ':' || coalesce(p_produit::text, ''), 0));

  -- Rejeu : la même clé renvoie la même Commande, sans nouvel effet.
  select id, numero into v_commande from public.commande where compte_id = v_compte and cle_idempotence = p_cle_idempotence;
  if found then
    return jsonb_build_object('commande_id', v_commande.id, 'numero', v_commande.numero, 'rejeu', true);
  end if;

  select id, famille, prix_cents, publie_le into v_produit from public.produit where id = p_produit;
  if not found or v_produit.famille <> 'kit' or v_produit.publie_le is null or v_produit.publie_le > now() then
    raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Seul le Kit à 0 USD s'obtient sans paiement (FR-58).
  if v_produit.prix_cents is distinct from 0 then
    raise exception 'KS_KIT_NON_GRATUIT' using errcode = 'P0001';
  end if;

  if p_acceptations is null or jsonb_typeof(p_acceptations) <> 'array' then
    raise exception 'KS_ACCEPTATION_MANQUANTE' using errcode = 'P0001';
  end if;
  select e ->> 'version' into v_version
  from jsonb_array_elements(p_acceptations) as e
  where jsonb_typeof(e) = 'object' and e ->> 'objet' = 'licence_kit' and length(coalesce(e ->> 'version', '')) between 1 and 50
  limit 1;
  if v_version is null then
    raise exception 'KS_ACCEPTATION_MANQUANTE' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.acces_kit where compte_id = v_compte and produit_id = p_produit) then
    raise exception 'KS_KIT_DEJA_POSSEDE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);

  insert into public.commande (compte_id, type, statut, offerte, sous_total_cents, total_cents, acceptations, cle_idempotence)
  values (
    v_compte, 'produits', 'offerte', true, 0, 0,
    jsonb_build_array(jsonb_build_object('objet', 'licence_kit', 'version', v_version, 'accepte_le', now())),
    p_cle_idempotence
  )
  returning id into v_id;

  insert into public.ligne_commande (commande_id, produit_id, quantite, prix_cents) values (v_id, p_produit, 1, 0);

  update public.commande set statut = 'livree', mis_a_jour_le = now() where id = v_id and statut = 'offerte';

  perform public.bibliotheque_ouvrir_acces(v_compte, p_produit, v_id);

  select numero into v_commande from public.commande where id = v_id;
  return jsonb_build_object('commande_id', v_id, 'numero', v_commande.numero, 'rejeu', false);
end;
$$;

-- Droits : offrir_commande est appelée par le serveur seul (service_role). Les deux fonctions internes ne sont appelables
-- par aucun rôle : seules les fonctions SECURITY DEFINER de la base les exécutent (AD-1).
revoke all on function public.exiger_client(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.bibliotheque_ouvrir_acces(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.offrir_commande(jsonb, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.offrir_commande(jsonb, uuid, jsonb, text) to service_role;

-- Lecture, par le serveur, de la possession d'un Kit (affichage du bouton de la fiche). Le client service passe par cette fonction
-- pour ne pas lire la table directement.
create function public.possede_kit(p_compte uuid, p_produit uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.acces_kit where compte_id = p_compte and produit_id = p_produit);
$$;
revoke all on function public.possede_kit(uuid, uuid) from public, anon, authenticated;
grant execute on function public.possede_kit(uuid, uuid) to service_role;
