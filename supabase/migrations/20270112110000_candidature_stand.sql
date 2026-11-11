-- Story 7.11 : Candidature Stand (FR-33b, AD-37, AD-7, AD-9, AD-12). Décision de Jonathan du 2026-11-11 : la candidature est ACCEPTÉE AUTOMATIQUEMENT.
-- 1. Bucket privé candidatures-stand-private (3 photos par candidature, jamais d'adresse publique) ; réglage delai_stand_heures (48 au départ).
-- 2. Table candidature_stand : statuts stockés « validee » | « refusee » ; « payée » se déduit de la Commande liée (confirmer_paiement n'est pas modifiée).
-- 3. Un Stand ne s'achète que par creer_commande_stand (candidature du Compte connecté, acceptée, non expirée). creer_commande_pass (7.4) refuse toujours
--    un Stand (KS_STAND_SUR_CANDIDATURE) : aucun autre chemin.
-- 4. Les places : une candidature acceptée non expirée sans Commande occupe 1 place de Type et 2 places d'Événement (compteurs recréés) ; dès que la
--    Commande existe, c'est elle qui compte (jamais deux fois).
-- 5. L'aide d'un Stand se nomme plus tard (« Mes Pass »), jusqu'au début de l'Événement : ligne_commande.aide_a_saisir, pass.nom_a_saisir,
--    nommer_aide_pass. Le nom d'un Pass reste figé hors de ce seul cas.
-- 6. Refus par l'Admin après coup : refuser_candidature_stand (avant paiement : lien annulé ; après paiement : Stand et 2 Pass annulés, remboursement
--    ouvert, confirmé ensuite avec preuve par confirmer_remboursement de la 7.9).
-- 7. Purge à 90 jours : candidatures_stand_a_purger / marquer_candidature_stand_purgee (photos et Instagram effacés).
-- Aucune donnée d'exemple (règle 14). Le journal d'audit n'écrit ni description, ni Instagram, ni chemin de photo.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('candidatures-stand-private', 'candidatures-stand-private', false, 15728640, array['image/jpeg', 'image/png', 'image/webp']);

-- Délai de paiement d'un Stand accepté, en heures (1 à 168). Réglage de l'admin ; pas de valeur écrite en dur dans le code (règle 15 si absent).
select set_config('ks.auteur', '{"type":"migration","nom":"candidature_stand"}', true);
insert into public.reglage (cle, valeur) values ('delai_stand_heures', '48') on conflict (cle) do nothing;

create table public.candidature_stand (
  id uuid primary key,
  evenement_id uuid not null references public.evenement (id) on delete restrict,
  type_pass_id uuid not null references public.type_pass (id) on delete restrict,
  compte_id uuid not null,
  description text not null check (char_length(description) between 20 and 1000),
  -- Lien ou @pseudo ; effacé à la purge.
  instagram text check (instagram is null or char_length(instagram) between 2 and 200),
  -- Trois objets exactement du bucket privé ; vidé à la purge.
  photos text[] not null default '{}',
  engagement_version text not null check (char_length(engagement_version) between 1 and 50),
  engagement_accepte_le timestamptz not null default now(),
  statut text not null default 'validee' check (statut in ('validee', 'refusee')),
  expire_le timestamptz not null,
  motif_refus text check (motif_refus is null or char_length(motif_refus) <= 500),
  refuse_le timestamptz,
  commande_id uuid references public.commande (id) on delete restrict,
  photos_purgees_le timestamptz,
  cree_le timestamptz not null default now(),
  constraint candidature_refus_coherent check ((statut = 'refusee') = (refuse_le is not null)),
  constraint candidature_donnees check (
    (photos_purgees_le is null and cardinality(photos) = 3 and instagram is not null)
    or (photos_purgees_le is not null and cardinality(photos) = 0 and instagram is null)
  )
);
create index candidature_stand_evenement_idx on public.candidature_stand (evenement_id, statut);
create index candidature_stand_compte_idx on public.candidature_stand (compte_id, evenement_id);
create index candidature_stand_commande_idx on public.candidature_stand (commande_id) where commande_id is not null;

alter table public.candidature_stand enable row level security;
revoke all on public.candidature_stand from public, anon, authenticated;
-- Aucune politique : aucun client n'y lit. Le serveur lit (service_role) ; il n'écrit que par les fonctions ci-dessous.
grant select on public.candidature_stand to service_role;

-- Journal d'audit sans description, sans lien Instagram, sans chemin de photo.
create function public.candidature_stand_journaliser()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auteur jsonb;
begin
  begin
    v_auteur := nullif(current_setting('ks.auteur', true), '')::jsonb;
  exception when others then
    v_auteur := null;
  end;
  if v_auteur is null then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  insert into public.journal_audit (auteur, action, cible_table, cible_id, avant, apres)
  values (
    v_auteur, lower(tg_op), tg_table_name, new.id::text,
    case when tg_op = 'UPDATE' then jsonb_build_object('statut', old.statut, 'commande_id', old.commande_id) end,
    jsonb_build_object('statut', new.statut, 'evenement_id', new.evenement_id, 'type_pass_id', new.type_pass_id, 'commande_id', new.commande_id, 'expire_le', new.expire_le)
  );
  return new;
end;
$$;
revoke all on function public.candidature_stand_journaliser() from public, anon, authenticated, service_role;
create trigger candidature_stand_journaliser after insert or update on public.candidature_stand for each row execute function public.candidature_stand_journaliser();

-- Ce qui identifie la candidature ne change jamais.
create function public.candidature_stand_figer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.evenement_id is distinct from old.evenement_id or new.type_pass_id is distinct from old.type_pass_id
     or new.compte_id is distinct from old.compte_id or new.description is distinct from old.description
     or new.engagement_version is distinct from old.engagement_version or new.engagement_accepte_le is distinct from old.engagement_accepte_le
     or new.expire_le is distinct from old.expire_le or new.cree_le is distinct from old.cree_le then
    raise exception 'KS_CANDIDATURE_FIGEE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.candidature_stand_figer() from public, anon, authenticated, service_role;
create trigger candidature_stand_figer before update on public.candidature_stand for each row execute function public.candidature_stand_figer();

-- Aide d'un Stand : nom à saisir plus tard.
alter table public.ligne_commande add column aide_a_saisir boolean not null default false;
alter table public.pass add column nom_a_saisir boolean not null default false;

-- pass_figer : même fonction qu'en 20270106110000, sauf le nom d'un Pass dont le nom reste à saisir (une seule fois, jamais l'inverse).
create or replace function public.pass_figer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.evenement_id is distinct from old.evenement_id or new.type_pass_id is distinct from old.type_pass_id
     or new.commande_id is distinct from old.commande_id or new.ligne_commande_id is distinct from old.ligne_commande_id
     or new.rang is distinct from old.rang
     or new.jeton is distinct from old.jeton or new.code_court is distinct from old.code_court or new.cree_le is distinct from old.cree_le then
    raise exception 'KS_PASS_FIGE' using errcode = 'P0001';
  end if;
  if new.nom_titulaire is distinct from old.nom_titulaire and not (old.nom_a_saisir and not new.nom_a_saisir) then
    raise exception 'KS_PASS_FIGE' using errcode = 'P0001';
  end if;
  if new.nom_a_saisir and not old.nom_a_saisir then
    raise exception 'KS_PASS_FIGE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Émission : même fonction qu'en 20270106110000 ; le Pass de rang 2 d'un Stand dont l'aide reste à nommer est marqué nom_a_saisir.
create or replace function public.evenements_emettre_pass(p_commande uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.commande;
  v_l record;
  v_nom jsonb;
  v_rang integer;
  v_cree integer := 0;
  v_ins integer;
begin
  select * into v_c from public.commande where id = p_commande for update;
  if not found then
    raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_c.type <> 'pass' or v_c.statut not in ('payee', 'offerte') then
    raise exception 'KS_EMISSION_IMPOSSIBLE' using errcode = 'P0001';
  end if;

  for v_l in
    select l.id, l.type_pass_id, l.titulaires, l.aide_a_saisir, t.evenement_id
    from public.ligne_commande l join public.type_pass t on t.id = l.type_pass_id
    where l.commande_id = v_c.id
    order by l.cree_le, l.id
  loop
    v_rang := 0;
    for v_nom in select value from jsonb_array_elements(v_l.titulaires) loop
      v_rang := v_rang + 1;
      insert into public.pass (evenement_id, type_pass_id, commande_id, ligne_commande_id, rang, nom_titulaire, nom_a_saisir, jeton, code_court)
      values (v_l.evenement_id, v_l.type_pass_id, v_c.id, v_l.id, v_rang, v_nom #>> '{}', (v_l.aide_a_saisir and v_rang = 2), public.pass_jeton_generer(), public.pass_code_court_generer())
      on conflict (ligne_commande_id, rang) do nothing;
      get diagnostics v_ins = row_count;
      v_cree := v_cree + v_ins;
    end loop;
  end loop;

  if exists (select 1 from public.pass where commande_id = v_c.id) then
    perform public.envois_planifier('pass_emis', v_c.compte_id, jsonb_build_object('commande_id', v_c.id), 'pass_emis:' || v_c.id::text);
  end if;
  return v_cree;
end;
$$;
revoke all on function public.evenements_emettre_pass(uuid) from public, anon, authenticated, service_role;

-- Places : dernière version (20270106120000) + les candidatures acceptées, non expirées, sans Commande (1 Stand = 1 place de Type, 2 d'Événement).
create or replace function public.places_evenement_utilisees(p_evenement uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((
      select sum(l.nombre * (case when l.est_stand then 2 else 1 end))
      from public.ligne_commande l
      join public.type_pass t on t.id = l.type_pass_id
      join public.commande c on c.id = l.commande_id
      where t.evenement_id = p_evenement
        and c.type = 'pass'
        and c.statut in ('en_attente', 'echouee') and c.expire_le is not null and c.expire_le > now()
    ), 0)
    + (select count(*) from public.pass p join public.commande c on c.id = p.commande_id
       where p.evenement_id = p_evenement and p.statut not in ('annule', 'rembourse') and c.statut in ('payee', 'offerte'))
    + 2 * (select count(*) from public.candidature_stand k
           where k.evenement_id = p_evenement and k.statut = 'validee' and k.commande_id is null and k.expire_le > now())
  )::integer
$$;

create or replace function public.places_type_pass_utilisees(p_type uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((
      select sum(l.nombre)
      from public.ligne_commande l
      join public.commande c on c.id = l.commande_id
      where l.type_pass_id = p_type
        and c.type = 'pass'
        and c.statut in ('en_attente', 'echouee') and c.expire_le is not null and c.expire_le > now()
    ), 0)
    + coalesce((
      select ceil(count(*)::numeric / (case when (select t.est_stand from public.type_pass t where t.id = p_type) then 2 else 1 end))
      from public.pass p join public.commande c on c.id = p.commande_id
      where p.type_pass_id = p_type and p.statut not in ('annule', 'rembourse') and c.statut in ('payee', 'offerte')
    ), 0)
    + (select count(*) from public.candidature_stand k
       where k.type_pass_id = p_type and k.statut = 'validee' and k.commande_id is null and k.expire_le > now())
  )::integer
$$;

-- Candidature (Compte connecté) : dépose et accepte dans la même transaction. L'identifiant est choisi par le serveur (il sert de dossier aux photos).
-- Événement verrouillé : deux candidatures simultanées pour la dernière place ne passent pas toutes les deux.
create function public.deposer_candidature_stand(
  p_auteur jsonb, p_id uuid, p_evenement uuid, p_type uuid, p_description text, p_instagram text, p_photos text[], p_engagement_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  e record;
  v_type record;
  v_description text := btrim(coalesce(p_description, ''));
  v_instagram text := btrim(coalesce(p_instagram, ''));
  v_heures text;
  v_expire timestamptz;
  v_photo text;
  v_prefixe text;
  v_vues text[] := '{}';
  v_restantes integer;
begin
  v_compte := public.exiger_client(p_auteur);
  if p_id is null or p_evenement is null or p_type is null then
    raise exception 'KS_CANDIDATURE_INVALIDE' using errcode = 'P0001';
  end if;
  if char_length(v_description) not between 20 and 1000 or v_description ~ '[<>]' or v_description ~ '[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' then
    raise exception 'KS_CANDIDATURE_DESCRIPTION' using errcode = 'P0001';
  end if;
  if v_instagram !~ '^@?[A-Za-z0-9._]{1,30}$' and v_instagram !~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._]{1,30}/?(\?[^[:space:]]{0,100})?$' then
    raise exception 'KS_CANDIDATURE_INSTAGRAM' using errcode = 'P0001';
  end if;
  if p_engagement_version is null or char_length(p_engagement_version) not between 1 and 50 then
    raise exception 'KS_ACCEPTATION_MANQUANTE' using errcode = 'P0001';
  end if;
  -- Trois photos exactement, rangées sous <événement>/<candidature>/ dans le bucket privé, jamais deux fois la même.
  if p_photos is null or cardinality(p_photos) <> 3 then
    raise exception 'KS_CANDIDATURE_PHOTOS' using errcode = 'P0001';
  end if;
  v_prefixe := p_evenement::text || '/' || p_id::text || '/';
  foreach v_photo in array p_photos loop
    if v_photo is null or left(v_photo, char_length(v_prefixe)) <> v_prefixe or substr(v_photo, char_length(v_prefixe) + 1) !~ '^[1-3]\.(jpg|png|webp)$' or v_photo = any (v_vues) then
      raise exception 'KS_CANDIDATURE_PHOTOS' using errcode = 'P0001';
    end if;
    v_vues := v_vues || v_photo;
  end loop;

  -- Verrou de l'Événement (même ordre que creer_commande_pass : Événement d'abord).
  select id, capacite, publie_le, debut_le, vente_ouvre_le, vente_ferme_le into e
  from public.evenement where id = p_evenement and publie_le is not null and publie_le <= now() for update;
  if not found then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if now() < coalesce(e.vente_ouvre_le, e.publie_le) or (coalesce(e.vente_ferme_le, e.debut_le) is not null and now() >= coalesce(e.vente_ferme_le, e.debut_le)) then
    raise exception 'KS_VENTE_FERMEE' using errcode = 'P0001';
  end if;
  select id, prix_cents, quota, est_stand into v_type from public.type_pass where id = p_type and evenement_id = p_evenement;
  if not found or not v_type.est_stand then
    raise exception 'KS_TYPE_PASS_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_type.prix_cents <= 0 then
    raise exception 'KS_PASS_GRATUIT' using errcode = 'P0001';
  end if;

  -- Une seule candidature active par Compte et par Événement : acceptée non expirée, ou dont la Commande est payée.
  if exists (
    select 1 from public.candidature_stand k left join public.commande c on c.id = k.commande_id
    where k.compte_id = v_compte and k.evenement_id = p_evenement and k.statut = 'validee'
      and (k.expire_le > now() or c.statut in ('payee', 'offerte'))
  ) then
    raise exception 'KS_CANDIDATURE_EXISTANTE' using errcode = 'P0001';
  end if;

  -- Il reste un Stand : quota du Type et Capacité de l'Événement (un Stand = 2 personnes).
  if v_type.quota is not null and public.places_type_pass_utilisees(v_type.id) + 1 > v_type.quota then
    raise exception 'KS_COMPLET' using errcode = 'P0001';
  end if;
  if e.capacite is not null then
    v_restantes := e.capacite - public.places_evenement_utilisees(e.id);
    if v_restantes < 2 then
      raise exception 'KS_COMPLET' using errcode = 'P0001';
    end if;
  end if;

  select valeur into v_heures from public.reglage where cle = 'delai_stand_heures';
  if v_heures is null or v_heures !~ '^[0-9]{1,3}$' or v_heures::integer not between 1 and 168 then
    raise exception 'KS_REGLAGE_MANQUANT' using errcode = 'P0001';
  end if;
  v_expire := now() + (v_heures::integer * interval '1 hour');

  perform set_config('ks.auteur', p_auteur::text, true);
  insert into public.candidature_stand (id, evenement_id, type_pass_id, compte_id, description, instagram, photos, engagement_version, expire_le)
  values (p_id, p_evenement, p_type, v_compte, v_description, v_instagram, p_photos, p_engagement_version, v_expire);

  -- Email « candidature_validee » (lien et heure limite relus en base au rendu), une seule fois par candidature.
  perform public.envois_planifier('candidature_validee', v_compte, jsonb_build_object('candidature_id', p_id), 'candidature_validee:' || p_id::text);
  return jsonb_build_object('candidature_id', p_id, 'expire_le', v_expire);
end;
$$;
revoke all on function public.deposer_candidature_stand(jsonb, uuid, uuid, uuid, text, text, text[], text) from public, anon, authenticated;
grant execute on function public.deposer_candidature_stand(jsonb, uuid, uuid, uuid, text, text, text[], text) to service_role;

-- Calcul d'une Commande de Stand, sans écriture : tout est relu en base (règle 3). Candidature du Compte, acceptée, non expirée, sans Commande en vie.
-- p_strict faux (Récapitulatif) : un Code promo refusé est rendu dans « code » au lieu d'une erreur.
create function public.commande_stand_calculer(p_compte uuid, p_candidature uuid, p_code text, p_strict boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k public.candidature_stand;
  e record;
  v_type record;
  v_c public.commande;
  v_eval jsonb;
  v_code jsonb := null;
  v_reduction bigint := 0;
begin
  select * into k from public.candidature_stand where id = p_candidature and compte_id = p_compte;
  if not found then
    raise exception 'KS_CANDIDATURE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if k.statut <> 'validee' then
    raise exception 'KS_CANDIDATURE_REFUSEE' using errcode = 'P0001';
  end if;
  if k.expire_le <= now() then
    raise exception 'KS_CANDIDATURE_EXPIREE' using errcode = 'P0001';
  end if;
  if k.commande_id is not null then
    select * into v_c from public.commande where id = k.commande_id;
    if v_c.statut in ('payee', 'offerte') or (v_c.statut in ('en_attente', 'echouee') and v_c.expire_le is not null and v_c.expire_le > now()) then
      raise exception 'KS_CANDIDATURE_DEJA_COMMANDEE' using errcode = 'P0001';
    end if;
  end if;
  select id, publie_le, debut_le, vente_ouvre_le, vente_ferme_le into e from public.evenement where id = k.evenement_id;
  if e.publie_le is null or e.publie_le > now()
     or now() < coalesce(e.vente_ouvre_le, e.publie_le) or (coalesce(e.vente_ferme_le, e.debut_le) is not null and now() >= coalesce(e.vente_ferme_le, e.debut_le)) then
    raise exception 'KS_VENTE_FERMEE' using errcode = 'P0001';
  end if;
  select id, nom_fr, nom_en, prix_cents into v_type from public.type_pass where id = k.type_pass_id;
  if v_type.prix_cents <= 0 then
    raise exception 'KS_PASS_GRATUIT' using errcode = 'P0001';
  end if;

  if p_code is not null and btrim(p_code) <> '' then
    v_eval := public.code_promo_evaluer(p_compte, p_code, null);
    if (v_eval ->> 'valide')::boolean then
      v_reduction := floor(v_type.prix_cents::bigint * (v_eval ->> 'reduction_pct')::numeric / 100)::bigint;
      if v_reduction > 0 and v_type.prix_cents - v_reduction <= 0 then
        v_eval := jsonb_build_object('valide', false, 'erreur', 'code_total_nul');
        v_reduction := 0;
      end if;
    end if;
    if not (v_eval ->> 'valide')::boolean then
      if p_strict then
        raise exception '%', 'KS_' || upper(v_eval ->> 'erreur') using errcode = 'P0001';
      end if;
      v_reduction := 0;
    end if;
    v_code := v_eval;
  end if;

  return jsonb_build_object(
    'candidature_id', k.id, 'evenement_id', k.evenement_id, 'expire_le', k.expire_le,
    'type_pass_id', v_type.id, 'nom_fr', v_type.nom_fr, 'nom_en', v_type.nom_en, 'prix_cents', v_type.prix_cents,
    'reduction_cents', v_reduction, 'sous_total_cents', v_type.prix_cents, 'total_cents', v_type.prix_cents - v_reduction, 'code', v_code
  );
end;
$$;
revoke all on function public.commande_stand_calculer(uuid, uuid, text, boolean) from public, anon, authenticated, service_role;

create function public.recapitulatif_commande_stand(p_compte uuid, p_candidature uuid, p_code text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.commande_stand_calculer(p_compte, p_candidature, p_code, false)
$$;
revoke all on function public.recapitulatif_commande_stand(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.recapitulatif_commande_stand(uuid, uuid, text) to service_role;

-- Nom propre : espaces réduits, 2 à 80 caractères, ni chevrons ni caractère de contrôle (mêmes règles que les titulaires de la 7.4).
create function public.nom_titulaire_propre(p_nom text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_nom text := btrim(regexp_replace(coalesce(p_nom, ''), '\s+', ' ', 'g'));
begin
  if char_length(v_nom) not between 2 and 80 or v_nom ~ '[<>[:cntrl:]]' then
    raise exception 'KS_TITULAIRE_INVALIDE' using errcode = 'P0001';
  end if;
  return v_nom;
end;
$$;
revoke all on function public.nom_titulaire_propre(text) from public, anon, authenticated, service_role;

-- Crée la Commande de Pass d'un Stand (2 Pass : le titulaire et l'aide) à partir d'une candidature acceptée. Échéance = celle de la candidature.
-- p_aide_a_saisir vrai : le nom de l'aide est provisoire, à remplacer depuis « Mes Pass ». Mêmes verrous, idempotence et acceptation que creer_commande_pass.
create function public.creer_commande_stand(
  p_auteur jsonb, p_candidature uuid, p_acceptations jsonb, p_total_attendu_cents integer, p_cle_idempotence text,
  p_nom_titulaire text, p_nom_aide text, p_aide_a_saisir boolean, p_code text default null, p_origine text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_evenement uuid;
  v_calcul jsonb;
  v_existante record;
  v_id uuid;
  v_numero text;
  v_version text;
  v_acceptees jsonb;
  v_code record;
  v_a_code boolean := false;
  v_origine text;
  v_expire timestamptz;
  v_ligne uuid;
begin
  v_compte := public.exiger_client(p_auteur);
  if p_cle_idempotence is null or length(p_cle_idempotence) not between 8 and 100 then
    raise exception 'KS_CLE_IDEMPOTENCE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_origine is not null and p_origine !~ '^[a-z0-9_-]{1,40}$' then
    raise exception 'KS_ORIGINE_INVALIDE' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('commande:' || v_compte::text, 0));

  select id, numero, expire_le into v_existante from public.commande where compte_id = v_compte and cle_idempotence = p_cle_idempotence;
  if found then
    return jsonb_build_object('commande_id', v_existante.id, 'numero', v_existante.numero, 'expire_le', v_existante.expire_le, 'rejeu', true);
  end if;
  if exists (select 1 from public.commande where compte_id = v_compte and statut in ('en_attente', 'echouee') and expire_le > now()) then
    raise exception 'KS_COMMANDE_EN_ATTENTE' using errcode = 'P0001';
  end if;

  if p_code is not null and btrim(p_code) <> '' then
    perform 1 from public.code_promo where code = upper(btrim(p_code)) for update;
  end if;

  select evenement_id into v_evenement from public.candidature_stand where id = p_candidature and compte_id = v_compte;
  if v_evenement is null then
    raise exception 'KS_CANDIDATURE_INTROUVABLE' using errcode = 'P0001';
  end if;
  perform 1 from public.evenement where id = v_evenement for update;
  perform 1 from public.candidature_stand where id = p_candidature for update;

  v_calcul := public.commande_stand_calculer(v_compte, p_candidature, p_code, true);

  if p_acceptations is null or jsonb_typeof(p_acceptations) <> 'array' then
    raise exception 'KS_ACCEPTATION_MANQUANTE' using errcode = 'P0001';
  end if;
  select e ->> 'version' into v_version
  from jsonb_array_elements(p_acceptations) as e
  where jsonb_typeof(e) = 'object' and e ->> 'objet' = 'pass_photos_video' and length(coalesce(e ->> 'version', '')) between 1 and 50
  limit 1;
  if v_version is null then
    raise exception 'KS_ACCEPTATION_MANQUANTE' using errcode = 'P0001';
  end if;
  v_acceptees := jsonb_build_array(jsonb_build_object('objet', 'pass_photos_video', 'version', v_version, 'accepte_le', now()));

  if p_total_attendu_cents is distinct from (v_calcul ->> 'total_cents')::integer then
    raise exception 'KS_TOTAL_CHANGE' using errcode = 'P0001';
  end if;

  v_expire := (v_calcul ->> 'expire_le')::timestamptz;
  perform set_config('ks.auteur', p_auteur::text, true);

  v_origine := p_origine;
  if (v_calcul -> 'code') is not null and jsonb_typeof(v_calcul -> 'code') = 'object' then
    select id, code, reduction_pct, commission_pct into v_code from public.code_promo where id = (v_calcul -> 'code' ->> 'id')::uuid;
    v_a_code := true;
    v_origine := 'code_' || lower(v_code.code);
  end if;

  insert into public.commande (
    compte_id, type, statut, sous_total_cents, forfait_cents, total_cents, acceptations, cle_idempotence, origine, expire_le
  ) values (
    v_compte, 'pass', 'en_attente', (v_calcul ->> 'sous_total_cents')::integer, 0, (v_calcul ->> 'total_cents')::integer,
    v_acceptees, p_cle_idempotence, v_origine, v_expire
  ) returning id, numero into v_id, v_numero;

  if v_a_code then
    insert into public.commande_code_promo (commande_id, code_promo_id, code, reduction_pct, commission_pct, reduction_cents)
    values (v_id, v_code.id, v_code.code, v_code.reduction_pct, v_code.commission_pct, (v_calcul ->> 'reduction_cents')::integer);
  end if;

  insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents, reduction_cents, type_pass_id, titulaires, pass_nom_fr, pass_nom_en, est_stand, aide_a_saisir)
  values (
    v_id, null, 1, (v_calcul ->> 'prix_cents')::integer, (v_calcul ->> 'reduction_cents')::integer,
    (v_calcul ->> 'type_pass_id')::uuid,
    jsonb_build_array(public.nom_titulaire_propre(p_nom_titulaire), public.nom_titulaire_propre(p_nom_aide)),
    v_calcul ->> 'nom_fr', nullif(v_calcul ->> 'nom_en', ''), true, coalesce(p_aide_a_saisir, false)
  ) returning id into v_ligne;

  update public.candidature_stand set commande_id = v_id where id = p_candidature;
  return jsonb_build_object('commande_id', v_id, 'numero', v_numero, 'expire_le', v_expire, 'rejeu', false);
end;
$$;
revoke all on function public.creer_commande_stand(jsonb, uuid, jsonb, integer, text, text, text, boolean, text, text) from public, anon, authenticated;
grant execute on function public.creer_commande_stand(jsonb, uuid, jsonb, integer, text, text, text, boolean, text, text) to service_role;

-- L'exposant nomme son aide depuis « Mes Pass », une seule fois, jusqu'au début de l'Événement. Compte de la session ; Pass d'une de SES Commandes.
create function public.nommer_aide_pass(p_auteur jsonb, p_pass uuid, p_nom text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_nom text;
  v_p public.pass;
  v_debut timestamptz;
begin
  v_compte := public.exiger_client(p_auteur);
  v_nom := public.nom_titulaire_propre(p_nom);
  select p.* into v_p from public.pass p join public.commande c on c.id = p.commande_id
    where p.id = p_pass and c.compte_id = v_compte for update of p;
  if not found then
    raise exception 'KS_PASS_INTROUVABLE' using errcode = 'P0001';
  end if;
  if not v_p.nom_a_saisir or v_p.statut <> 'valide' then
    raise exception 'KS_NOM_DEJA_SAISI' using errcode = 'P0001';
  end if;
  select debut_le into v_debut from public.evenement where id = v_p.evenement_id;
  if v_debut is not null and v_debut <= now() then
    raise exception 'KS_EVENEMENT_COMMENCE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.pass set nom_titulaire = v_nom, nom_a_saisir = false where id = p_pass;
end;
$$;
revoke all on function public.nommer_aide_pass(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.nommer_aide_pass(jsonb, uuid, text) to service_role;

-- Refus par l'Admin après coup (contrefaçon, contenu inapproprié). Avant paiement : la candidature passe « refusee », le lien et la Commande en attente
-- sont annulés (échéance ramenée à maintenant : un paiement tardif devient un Trop-perçu, règle 2) et la place est libérée. Après paiement : les
-- deux Pass du Stand passent « annule » (refusé au Scan), le montant est calculé comme à la 7.9 (frais figés) et une ligne de remboursement est
-- ouverte ; Jonathan le confirme ensuite avec une preuve (confirmer_remboursement). Un Pass déjà scanné bloque le refus après paiement.
-- Retourne le montant à rendre, en centimes (0 si rien n'est à rendre).
create function public.refuser_candidature_stand(p_auteur jsonb, p_candidature uuid, p_motif text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.candidature_stand;
  v_c public.commande;
  v_l public.ligne_commande;
  v_pass uuid;
  v_frais smallint;
  v_montant bigint := 0;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
begin
  perform public.exiger_admin(p_auteur);
  if v_motif is not null and char_length(v_motif) > 500 then
    raise exception 'KS_MOTIF_INVALIDE' using errcode = 'P0001';
  end if;
  select * into k from public.candidature_stand where id = p_candidature for update;
  if not found then
    raise exception 'KS_CANDIDATURE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if k.statut = 'refusee' then
    raise exception 'KS_CANDIDATURE_REFUSEE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);

  if k.commande_id is not null then
    select * into v_c from public.commande where id = k.commande_id for update;
    if v_c.statut in ('payee', 'offerte') then
      select * into v_l from public.ligne_commande where commande_id = v_c.id and type_pass_id = k.type_pass_id and est_stand limit 1;
      select p.id into v_pass from public.pass p where p.ligne_commande_id = v_l.id and p.rang = 1;
      if v_pass is null then
        raise exception 'KS_PASS_INTROUVABLE' using errcode = 'P0001';
      end if;
      perform 1 from public.pass where ligne_commande_id = v_l.id order by id for update;
      if exists (select 1 from public.pass u where u.ligne_commande_id = v_l.id and u.statut <> 'valide') then
        raise exception 'KS_ANNULATION_IMPOSSIBLE' using errcode = 'P0001';
      end if;
      if not v_c.offerte then
        v_frais := public.evenements_frais_commande(v_c.id);
        if v_frais is null then
          raise exception 'KS_REGLAGE_MANQUANT' using errcode = 'P0001';
        end if;
        v_montant := ((v_l.prix_cents::bigint * v_l.nombre - v_l.reduction_cents) * (100 - v_frais)) / 100;
      end if;
      update public.pass set statut = 'annule' where ligne_commande_id = v_l.id;
      if v_montant > 0 then
        insert into public.remboursement (cible_type, cible_id, montant_cents, devise) values ('pass', v_pass, v_montant::integer, v_c.devise);
      end if;
    elsif v_c.statut in ('en_attente', 'echouee') and v_c.expire_le is not null and v_c.expire_le > now() then
      update public.commande set expire_le = now() where id = v_c.id;
    end if;
  end if;

  update public.candidature_stand set statut = 'refusee', refuse_le = now(), motif_refus = v_motif where id = k.id;
  perform public.envois_planifier('candidature_refusee', k.compte_id, jsonb_build_object('candidature_id', k.id), 'candidature_refusee:' || k.id::text);
  return v_montant::integer;
end;
$$;
revoke all on function public.refuser_candidature_stand(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.refuser_candidature_stand(jsonb, uuid, text) to service_role;

-- Purge à 90 jours : photos et lien Instagram. À purger : Événement terminé depuis 90 jours (fin, ou début sans fin), ou, pour une candidature jamais
-- payée, refusée ou expirée depuis 90 jours. Lot borné ; le serveur efface les objets puis appelle marquer_candidature_stand_purgee.
create function public.candidatures_stand_a_purger(p_limite integer default 50)
returns table (candidature_id uuid, photos text[])
language sql
stable
security definer
set search_path = ''
as $$
  select k.id, k.photos
  from public.candidature_stand k
  join public.evenement e on e.id = k.evenement_id
  left join public.commande c on c.id = k.commande_id
  where k.photos_purgees_le is null
    and (
      coalesce(e.fin_le, e.debut_le) + interval '90 days' < now()
      or (
        coalesce(c.statut::text, '') not in ('payee', 'offerte')
        and (
          (k.statut = 'refusee' and k.refuse_le + interval '90 days' < now())
          or (k.statut = 'validee' and k.expire_le + interval '90 days' < now())
        )
      )
    )
  order by k.cree_le
  limit greatest(1, least(coalesce(p_limite, 50), 200))
$$;
revoke all on function public.candidatures_stand_a_purger(integer) from public, anon, authenticated;
grant execute on function public.candidatures_stand_a_purger(integer) to service_role;

create function public.marquer_candidature_stand_purgee(p_candidature uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('ks.auteur', '{"type":"cron","nom":"purger_candidatures_stand"}', true);
  update public.candidature_stand set photos = '{}', instagram = null, photos_purgees_le = now() where id = p_candidature and photos_purgees_le is null;
end;
$$;
revoke all on function public.marquer_candidature_stand_purgee(uuid) from public, anon, authenticated;
grant execute on function public.marquer_candidature_stand_purgee(uuid) to service_role;

-- Droits des compteurs recréés (identiques à 20270105100000).
revoke all on function public.places_evenement_utilisees(uuid) from public, anon, authenticated;
revoke all on function public.places_type_pass_utilisees(uuid) from public, anon, authenticated;
grant execute on function public.places_evenement_utilisees(uuid) to service_role;
grant execute on function public.places_type_pass_utilisees(uuid) to service_role;
