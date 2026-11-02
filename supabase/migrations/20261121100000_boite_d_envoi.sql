-- Story 4.4 : boîte d'envoi (envoi), anomalies (anomalie), tâches admin (taches_admin), planification de l'email « Kit ouvert »,
-- déclenchement planifié de /api/cron/envois par pg_cron et pg_net (AD-9, AD-10, AD-21).
-- Aucune donnée personnelle dans envoi : seulement des identifiants. Le contenu est relu en base au moment du rendu.

create type public.envoi_modele as enum ('commande_payee', 'kit_ouvert');
create type public.envoi_statut as enum ('a_envoyer', 'envoye', 'echec', 'abandonne', 'ignore');
create type public.anomalie_type as enum ('envoi_echec_definitif');

-- envoi.donnees : un objet dont toutes les valeurs sont des identifiants (uuid sous forme de texte).
create function public.donnees_envoi_valides(p_donnees jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_donnees) = 'object'
    and not exists (
      select 1 from jsonb_each(p_donnees) e
      where jsonb_typeof(e.value) <> 'string' or (e.value #>> '{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
$$;

create table public.envoi (
  id uuid primary key default gen_random_uuid(),
  modele public.envoi_modele not null,
  compte_id uuid not null references auth.users (id) on delete cascade,
  langue text not null check (langue in ('fr', 'en')),
  donnees jsonb not null default '{}'::jsonb check (public.donnees_envoi_valides(donnees)),
  cle text not null unique check (length(cle) between 3 and 200),
  statut public.envoi_statut not null default 'a_envoyer',
  tentatives smallint not null default 0 check (tentatives >= 0),
  prochain_essai timestamptz not null default now(),
  id_prestataire text,
  envoye_le timestamptz,
  derniere_erreur text check (length(derniere_erreur) <= 200),
  cree_le timestamptz not null default now(),
  constraint envoi_envoye_a_un_identifiant check ((statut = 'envoye') = (id_prestataire is not null and envoye_le is not null))
);
create index envoi_a_traiter on public.envoi (prochain_essai) where statut in ('a_envoyer', 'echec');
alter table public.envoi enable row level security;
revoke all on public.envoi from public, anon, authenticated;

create table public.anomalie (
  id uuid primary key default gen_random_uuid(),
  type public.anomalie_type not null,
  gravite text not null default 'attention' check (gravite in ('info', 'attention', 'critique')),
  cible_type text not null check (length(cible_type) between 1 and 50),
  cible_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  resolue_par uuid references auth.users (id) on delete set null,
  resolue_le timestamptz,
  cree_le timestamptz not null default now()
);
-- Une seule anomalie ouverte par type et par cible.
create unique index anomalie_ouverte_unique on public.anomalie (type, cible_type, cible_id) where resolue_le is null;
alter table public.anomalie enable row level security;
revoke all on public.anomalie from public, anon, authenticated;

-- Source unique des tâches de l'Admin (AD-21) : les anomalies ouvertes. Lue par le serveur seulement.
create view public.taches_admin with (security_invoker = true) as
  select a.id, a.type::text as type, a.gravite, a.cible_type, a.cible_id, a.details, a.cree_le
  from public.anomalie a
  where a.resolue_le is null;
revoke all on public.taches_admin from public, anon, authenticated;

-- Planifie un email. Interne : appelée par d'autres fonctions de la base, jamais par un rôle client.
-- La langue est figée depuis profil.langue (« fr » sans profil). Rejouable : la même clé ne crée qu'un envoi.
create function public.envois_planifier(p_modele public.envoi_modele, p_compte uuid, p_donnees jsonb, p_cle text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.envoi (modele, compte_id, langue, donnees, cle)
  values (p_modele, p_compte, coalesce((select langue from public.profil where id = p_compte), 'fr'), p_donnees, p_cle)
  on conflict (cle) do nothing
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.envois_planifier(public.envoi_modele, uuid, jsonb, text) from public, anon, authenticated;

-- Réserve un lot borné d'envois à traiter (SKIP LOCKED : deux appels simultanés ne prennent jamais le même envoi).
-- Chaque envoi réservé est « loué » 10 minutes : sans réponse du worker, il redevient disponible ensuite.
create function public.envois_reserver_lot(p_limite integer)
returns table (id uuid, modele text, compte_id uuid, langue text, donnees jsonb, tentatives integer)
language sql
security definer
set search_path = ''
as $$
  with lot as (
    select e.id from public.envoi e
    where e.statut in ('a_envoyer', 'echec') and e.prochain_essai <= now()
    order by e.prochain_essai, e.cree_le
    limit greatest(1, least(coalesce(p_limite, 10), 50))
    for update skip locked
  )
  update public.envoi e
  set tentatives = e.tentatives + 1, prochain_essai = now() + interval '10 minutes'
  from lot
  where e.id = lot.id
  returning e.id, e.modele::text, e.compte_id, e.langue, e.donnees, e.tentatives::integer
$$;

-- N'accepte l'identifiant de Resend que pour un envoi encore à traiter : un envoi déjà envoyé ne l'est jamais deux fois.
create function public.envois_marquer_envoye(p_id uuid, p_id_prestataire text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if p_id_prestataire is null or length(btrim(p_id_prestataire)) = 0 then
    raise exception 'KS_IDENTIFIANT_PRESTATAIRE_MANQUANT' using errcode = 'P0001';
  end if;
  update public.envoi
  set statut = 'envoye', id_prestataire = p_id_prestataire, envoye_le = now(), derniere_erreur = null
  where id = p_id and statut in ('a_envoyer', 'echec');
  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

-- Échec : nouvel essai plus tard (10 minutes par essai déjà fait) jusqu'à 5 essais, puis « abandonne » et une anomalie.
create function public.envois_marquer_echec(p_id uuid, p_erreur text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_envoi record;
  v_statut public.envoi_statut;
begin
  select id, tentatives, modele into v_envoi from public.envoi where id = p_id and statut in ('a_envoyer', 'echec') for update;
  if not found then
    return null;
  end if;
  if v_envoi.tentatives >= 5 then
    v_statut := 'abandonne';
    insert into public.anomalie (type, gravite, cible_type, cible_id, details)
    values ('envoi_echec_definitif', 'attention', 'envoi', v_envoi.id, jsonb_build_object('modele', v_envoi.modele::text, 'tentatives', v_envoi.tentatives))
    on conflict do nothing;
  else
    v_statut := 'echec';
  end if;
  update public.envoi
  set statut = v_statut,
      derniere_erreur = left(coalesce(p_erreur, 'erreur'), 200),
      prochain_essai = now() + (v_envoi.tentatives * interval '10 minutes')
  where id = v_envoi.id;
  return v_statut::text;
end;
$$;

-- Envoi sans objet (Compte sans email, commande disparue) : « ignore », avec la raison.
create function public.envois_ignorer(p_id uuid, p_raison text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  update public.envoi set statut = 'ignore', derniere_erreur = left(coalesce(p_raison, 'ignore'), 200)
  where id = p_id and statut in ('a_envoyer', 'echec');
  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

revoke all on function public.envois_reserver_lot(integer) from public, anon, authenticated;
revoke all on function public.envois_marquer_envoye(uuid, text) from public, anon, authenticated;
revoke all on function public.envois_marquer_echec(uuid, text) from public, anon, authenticated;
revoke all on function public.envois_ignorer(uuid, text) from public, anon, authenticated;
grant execute on function public.envois_reserver_lot(integer) to service_role;
grant execute on function public.envois_marquer_envoye(uuid, text) to service_role;
grant execute on function public.envois_marquer_echec(uuid, text) to service_role;
grant execute on function public.envois_ignorer(uuid, text) to service_role;
grant select on public.taches_admin to service_role;
grant select on public.anomalie to service_role;
grant select on public.envoi to service_role;

-- Déclenchement : pg_cron appelle chaque minute envois_declencher(), qui appelle la route par pg_net avec le CRON_SECRET lu dans Vault.
-- Tant que les secrets Vault « site_url » et « cron_secret » n'existent pas (aucun domaine : Q-D1), la fonction ne fait rien.
-- Le secret n'est jamais écrit dans cron.job : il est lu dans Vault à chaque appel.
create function public.envois_declencher()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'site_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    raise notice 'envois_declencher : secrets Vault site_url / cron_secret absents, rien envoyé';
    return false;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/envois',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  return true;
exception when others then
  raise notice 'envois_declencher : appel impossible (%)', sqlstate;
  return false;
end;
$$;
revoke all on function public.envois_declencher() from public, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  else
    raise notice 'pg_net indisponible : les emails ne partiront pas tant qu''il n''est pas activé';
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('envoyer-emails', '* * * * *', 'select public.envois_declencher()');
  else
    raise notice 'pg_cron indisponible : tâche envoyer-emails non planifiée';
  end if;
exception when others then
  raise notice 'planification envoyer-emails impossible (%)', sqlstate;
end
$$;

-- offrir_commande, réécrite depuis sa dernière version appliquée (20261112100000) : elle planifie l'email « Kit ouvert ».
create or replace function public.offrir_commande(p_auteur jsonb, p_produit uuid, p_acceptations jsonb, p_cle_idempotence text)
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
  perform pg_advisory_xact_lock(hashtextextended(v_compte::text || ':cle:' || p_cle_idempotence, 0));
  perform pg_advisory_xact_lock(hashtextextended(v_compte::text || ':' || coalesce(p_produit::text, ''), 0));

  -- Rejeu : la même clé renvoie la même Commande, sans nouvel effet.
  select id, numero into v_commande from public.commande where compte_id = v_compte and cle_idempotence = p_cle_idempotence;
  if found then
    if not exists (select 1 from public.ligne_commande where commande_id = v_commande.id and produit_id = p_produit) then
      raise exception 'KS_CLE_IDEMPOTENCE_INVALIDE' using errcode = 'P0001';
    end if;
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

  insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents) values (v_id, p_produit, 1, 0);

  update public.commande set statut = 'livree', mis_a_jour_le = now() where id = v_id and statut = 'offerte';

  perform public.bibliotheque_ouvrir_acces(v_compte, p_produit, v_id);

  -- Story 4.4 : l'email « Kit ouvert » est planifié dans la même transaction (jamais sur le rejeu, qui retourne plus haut).
  perform public.envois_planifier('kit_ouvert', v_compte, jsonb_build_object('commande_id', v_id, 'produit_id', p_produit), 'kit_ouvert:' || v_id::text);

  select numero into v_commande from public.commande where id = v_id;
  return jsonb_build_object('commande_id', v_id, 'numero', v_commande.numero, 'rejeu', false);
end;
$$;
