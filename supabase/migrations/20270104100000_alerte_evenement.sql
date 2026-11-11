-- Story 7.3 : « Me prévenir » (Alerte événement, FR-32, AD-9, AD-10, AD-22, AD-34).
-- Décision de Jonathan (2026-11-11) : l'inscription est PAR ÉVÉNEMENT et l'email part à l'OUVERTURE DE LA VENTE de cet événement
-- (moment vente_ouvre_le ; sans date d'ouverture la vente s'ouvre à la publication et « Me prévenir » n'a pas lieu d'être).
-- Aucune annonce générique « nouvel événement » (règle 14).
--
-- - alerte_evenement : un inscrit par événement et par canal (email, compte, whatsapp), avec son consentement versionné (AD-34),
--   sa désinscription et le moment où son email a été mis dans la boîte d'envoi (jamais deux fois). RLS sans aucune politique et
--   sans aucun droit pour anon ni authenticated : tout passe par des fonctions réservées au serveur (service_role).
-- - Un inscrit par Compte : le consentement « alertes_festival » de la story 9.4 est donné (source « alerte_evenement »).
-- - Un inscrit par email sans Compte : son consentement est dans sa ligne ; sa désinscription se fait par un lien signé propre.
-- - envoi.compte_id devient facultatif pour le seul modèle alerte_evenement (un inscrit par email n'a pas de Compte) ;
--   email_commercial_autorise sait vérifier ce cas.
-- - Les inscrits par WhatsApp ne reçoivent rien du site : l'admin exporte leurs numéros (export journalisé).
-- Le modèle d'email alerte_evenement existe déjà dans l'énumération (migration 20261231150000, story 9.4).

create table public.alerte_evenement (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenement (id) on delete cascade,
  canal text not null check (canal in ('email', 'compte', 'whatsapp')),
  -- Adresse en minuscules (canal email), Compte (canal compte), numéro international « + » et 8 à 15 chiffres (canal whatsapp).
  email text check (email is null or (char_length(email) between 3 and 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  compte_id uuid references auth.users (id) on delete cascade,
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+[0-9]{8,15}$'),
  langue text not null check (langue in ('fr', 'en')),
  consentement_version text not null check (char_length(consentement_version) between 1 and 50),
  consentement_le timestamptz not null default now(),
  desinscrit_le timestamptz,
  -- Moment où l'email a été mis dans la boîte d'envoi (jamais deux fois). Reste vide pour WhatsApp : le site n'envoie rien.
  envoye_le timestamptz,
  cree_le timestamptz not null default now(),
  constraint alerte_evenement_canal_coherent check (
    (canal = 'email' and email is not null and compte_id is null and whatsapp is null)
    or (canal = 'compte' and compte_id is not null and email is null and whatsapp is null)
    or (canal = 'whatsapp' and whatsapp is not null and email is null and compte_id is null)
  ),
  constraint alerte_evenement_desinscription_apres_consentement check (desinscrit_le is null or desinscrit_le >= consentement_le)
);
create unique index alerte_evenement_email_unique on public.alerte_evenement (evenement_id, email) where canal = 'email';
create unique index alerte_evenement_compte_unique on public.alerte_evenement (evenement_id, compte_id) where canal = 'compte';
create unique index alerte_evenement_whatsapp_unique on public.alerte_evenement (evenement_id, whatsapp) where canal = 'whatsapp';
create index alerte_evenement_a_planifier on public.alerte_evenement (evenement_id) where envoye_le is null and desinscrit_le is null;
create index alerte_evenement_email_idx on public.alerte_evenement (email) where canal = 'email';
create index alerte_evenement_compte_idx on public.alerte_evenement (compte_id) where canal = 'compte';

alter table public.alerte_evenement enable row level security;
revoke all on public.alerte_evenement from public, anon, authenticated;
create trigger alerte_evenement_journaliser
  after insert or update or delete on public.alerte_evenement
  for each row execute function public.journaliser('id');

-- Le consentement d'un Compte à « Me prévenir » a sa propre source (la preuve garde d'où il vient).
alter table public.consentement drop constraint if exists consentement_source_check;
alter table public.consentement add constraint consentement_source_check
  check (source in ('creation_compte', 'commande', 'preferences', 'alerte_evenement'));

-- Un inscrit par email n'a pas de Compte : envoi.compte_id est facultatif pour ce seul modèle.
alter table public.envoi alter column compte_id drop not null;
alter table public.envoi add constraint envoi_compte_ou_alerte check (compte_id is not null or modele = 'alerte_evenement');

-- Inscription. Auteur : le Compte connecté (canal compte) ou un visiteur (canaux email et whatsapp). La limite d'essais (AD-22) est
-- appliquée par le serveur avant cet appel. Même réponse (vrai) que l'inscrit existe déjà ou non : rien n'est révélé.
-- Refus : KS_ALERTE_INDISPONIBLE (événement inconnu ou non publié), KS_VENTE_OUVERTE (la vente est déjà ouverte ou s'ouvre à la
-- publication), KS_EMAIL_INVALIDE, KS_WHATSAPP_INVALIDE, KS_ALERTE_INVALIDE, KS_AUTEUR_INVALIDE.
create function public.inscrire_alerte_evenement(p_auteur jsonb, p_evenement uuid, p_canal text, p_valeur text, p_langue text, p_version text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_compte uuid;
  v_valeur text;
  v_ev record;
  v_a public.alerte_evenement%rowtype;
  v_consentement_donne boolean := false;
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  v_type := p_auteur ->> 'type';
  if p_canal is null or p_canal not in ('email', 'compte', 'whatsapp') or p_evenement is null
     or p_langue is null or p_langue not in ('fr', 'en')
     or p_version is null or char_length(p_version) not between 1 and 50 then
    raise exception 'KS_ALERTE_INVALIDE' using errcode = 'P0001';
  end if;
  if (p_canal = 'compte' and v_type is distinct from 'compte') or (p_canal <> 'compte' and v_type is distinct from 'visiteur') then
    raise exception 'KS_AUTEUR_INVALIDE' using errcode = 'P0001';
  end if;

  if p_canal = 'compte' then
    v_compte := public.exiger_client(p_auteur);
  elsif p_canal = 'email' then
    v_valeur := lower(btrim(coalesce(p_valeur, '')));
    if char_length(v_valeur) not between 3 and 254 or v_valeur !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'KS_EMAIL_INVALIDE' using errcode = 'P0001';
    end if;
  else
    v_valeur := regexp_replace(coalesce(p_valeur, ''), '\s', '', 'g');
    if v_valeur !~ '^\+[0-9]{8,15}$' then
      raise exception 'KS_WHATSAPP_INVALIDE' using errcode = 'P0001';
    end if;
  end if;

  select e.id, e.publie_le, e.vente_ouvre_le into v_ev from public.evenement e where e.id = p_evenement;
  if not found or v_ev.publie_le is null or v_ev.publie_le > now() then
    raise exception 'KS_ALERTE_INDISPONIBLE' using errcode = 'P0001';
  end if;
  -- La vente s'ouvre à vente_ouvre_le, ou à la publication si cette date n'est pas réglée : dans les deux cas, déjà ouverte = pas d'alerte.
  if coalesce(v_ev.vente_ouvre_le, v_ev.publie_le) <= now() then
    raise exception 'KS_VENTE_OUVERTE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  -- Deux inscriptions simultanées du même inscrit pour le même événement s'attendent.
  perform pg_advisory_xact_lock(hashtextextended('alerte:' || p_evenement::text || ':' || p_canal || ':' || coalesce(v_valeur, v_compte::text), 0));

  if p_canal = 'compte' then
    perform pg_advisory_xact_lock(hashtextextended('consentement:' || v_compte::text, 0));
    if not exists (select 1 from public.consentement where compte_id = v_compte and objet = 'alertes_festival' and retire_le is null) then
      insert into public.consentement (compte_id, objet, version, source) values (v_compte, 'alertes_festival', p_version, 'alerte_evenement');
      v_consentement_donne := true;
    end if;
  end if;

  select * into v_a from public.alerte_evenement
  where evenement_id = p_evenement and canal = p_canal
    and ((p_canal = 'email' and email = v_valeur) or (p_canal = 'whatsapp' and whatsapp = v_valeur) or (p_canal = 'compte' and compte_id = v_compte))
  for update;
  if found then
    -- Déjà inscrit et actif : rien ne change. Désinscrit (ou consentement redonné) : nouvelle preuve de consentement.
    if v_a.desinscrit_le is not null or v_consentement_donne then
      update public.alerte_evenement
      set desinscrit_le = null, consentement_version = p_version, consentement_le = now(), langue = p_langue
      where id = v_a.id;
    end if;
  else
    insert into public.alerte_evenement (evenement_id, canal, email, compte_id, whatsapp, langue, consentement_version)
    values (
      p_evenement, p_canal,
      case when p_canal = 'email' then v_valeur end,
      v_compte,
      case when p_canal = 'whatsapp' then v_valeur end,
      p_langue, p_version
    );
  end if;
  return true;
end;
$$;

-- Désinscription d'un inscrit par email (lien signé, vérifié par le serveur avant l'appel) : effet immédiat sur tous ses événements.
-- Idempotente : rouvrir le lien n'ajoute ni modification ni entrée de journal. Faux si l'inscription n'existe pas (ou n'est pas par email).
create function public.desinscrire_alerte(p_alerte uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select a.email into v_email from public.alerte_evenement a where a.id = p_alerte and a.canal = 'email';
  if not found then
    return false;
  end if;
  perform set_config('ks.auteur', jsonb_build_object('type', 'systeme', 'nom', 'lien_desinscription_alerte')::text, true);
  update public.alerte_evenement set desinscrit_le = now() where canal = 'email' and email = v_email and desinscrit_le is null;
  return true;
end;
$$;

-- Pose dans la boîte d'envoi un email par inscrit (email ou Compte) pour chaque événement dont la vente est ouverte : publié,
-- vente ouverte (vente_ouvre_le, ou la publication sans date), pas fermée, pas commencé ; inscrit non désinscrit et jamais notifié.
-- Seuls des identifiants vont dans envoi.donnees ; le rendu relit la base. La boîte d'envoi revérifie le consentement au moment d'envoyer.
-- Lot borné : le reste part au passage suivant.
create function public.planifier_alertes_evenements()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
  v_r record;
begin
  perform set_config('ks.auteur', '{"type":"cron","nom":"planifier_alertes_evenements"}', true);
  for v_r in
    select a.id, a.canal, a.compte_id, a.evenement_id, a.langue
    from public.alerte_evenement a
    join public.evenement e on e.id = a.evenement_id
    where a.canal in ('email', 'compte')
      and a.envoye_le is null
      and a.desinscrit_le is null
      and e.publie_le is not null and e.publie_le <= now()
      and coalesce(e.vente_ouvre_le, e.publie_le) <= now()
      and (e.vente_ferme_le is null or e.vente_ferme_le > now())
      and (e.debut_le is null or e.debut_le > now())
      and (a.canal <> 'compte' or exists (
        select 1 from public.consentement c where c.compte_id = a.compte_id and c.objet = 'alertes_festival' and c.retire_le is null
      ))
    order by a.cree_le, a.id
    limit 500
    for update of a skip locked
  loop
    if v_r.canal = 'compte' then
      perform public.envois_planifier('alerte_evenement', v_r.compte_id, jsonb_build_object('alerte_id', v_r.id, 'evenement_id', v_r.evenement_id), 'alerte_evenement:' || v_r.id::text);
    else
      insert into public.envoi (modele, compte_id, langue, donnees, cle)
      values ('alerte_evenement', null, v_r.langue, jsonb_build_object('alerte_id', v_r.id, 'evenement_id', v_r.evenement_id), 'alerte_evenement:' || v_r.id::text)
      on conflict (cle) do nothing;
    end if;
    update public.alerte_evenement set envoye_le = now() where id = v_r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Ce que le rendu de l'email lit pour un envoi d'alerte : canal, adresse (canal email), Compte, événement, état de la désinscription.
create function public.alerte_evenement_pour_envoi(p_alerte uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'canal', a.canal,
    'email', a.email,
    'compte_id', a.compte_id,
    'evenement_id', a.evenement_id,
    'desinscrit', a.desinscrit_le is not null
  )
  from public.alerte_evenement a
  where a.id = p_alerte
$$;

-- Nombre d'inscrits actifs par canal pour un événement (page admin). Un inscrit par Compte qui a retiré son consentement compte en « desinscrits ».
create function public.compter_alertes_evenement(p_auteur jsonb, p_evenement uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_admin(p_auteur);
  if not exists (select 1 from public.evenement where id = p_evenement) then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;
  return (
    with etat as (
      select
        a.canal,
        (a.desinscrit_le is null and (a.canal <> 'compte' or exists (
          select 1 from public.consentement c where c.compte_id = a.compte_id and c.objet = 'alertes_festival' and c.retire_le is null
        ))) as actif
      from public.alerte_evenement a
      where a.evenement_id = p_evenement
    )
    select jsonb_build_object(
      'email', count(*) filter (where canal = 'email' and actif),
      'compte', count(*) filter (where canal = 'compte' and actif),
      'whatsapp', count(*) filter (where canal = 'whatsapp' and actif),
      'desinscrits', count(*) filter (where not actif)
    ) from etat
  );
end;
$$;

-- Numéros WhatsApp des inscrits actifs d'un événement, pour l'export CSV de l'admin. L'export est journalisé dans la même
-- transaction (journal_audit : qui, quand, combien, jamais les numéros) : pas de liste rendue sans trace.
create function public.exporter_alertes_whatsapp(p_auteur jsonb, p_evenement uuid)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_numeros text[];
begin
  perform public.exiger_admin(p_auteur);
  if not exists (select 1 from public.evenement where id = p_evenement) then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;
  select coalesce(array_agg(a.whatsapp order by a.consentement_le, a.id), '{}') into v_numeros
  from public.alerte_evenement a
  where a.evenement_id = p_evenement and a.canal = 'whatsapp' and a.desinscrit_le is null;
  insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
  values (p_auteur, 'export', 'alerte_evenement', p_evenement::text, jsonb_build_object('canal', 'whatsapp', 'nombre', cardinality(v_numeros)));
  return v_numeros;
end;
$$;

-- email_commercial_autorise, réécrite depuis sa dernière version (20261231140000) : un envoi sans Compte (alerte_evenement d'un inscrit
-- par email) est autorisé si l'inscription existe, n'est pas désinscrite et porte un consentement. Le reste est inchangé.
create or replace function public.email_commercial_autorise(p_envoi uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_e record;
  v_a public.alerte_evenement%rowtype;
  v_objet text;
  v_dernier_don timestamptz;
  c_commerciaux constant text[] := array['relance', 'panier_abandonne', 'rappel_kit', 'nouveau_produit', 'alerte_evenement'];
begin
  select id, modele::text as modele, compte_id, donnees into v_e from public.envoi where id = p_envoi;
  if not found then
    raise exception 'KS_ENVOI_INTROUVABLE' using errcode = 'P0001';
  end if;
  if not (v_e.modele = any (c_commerciaux)) then
    return jsonb_build_object('autorise', true, 'commercial', false);
  end if;

  if v_e.compte_id is null then
    select * into v_a from public.alerte_evenement where id = nullif(v_e.donnees ->> 'alerte_id', '')::uuid;
    if not found or v_a.canal <> 'email' then
      return jsonb_build_object('autorise', false, 'commercial', true, 'motif', 'sans_consentement');
    end if;
    if v_a.desinscrit_le is not null then
      return jsonb_build_object('autorise', false, 'commercial', true, 'motif', 'desinscription');
    end if;
    return jsonb_build_object('autorise', true, 'commercial', true);
  end if;

  v_objet := case v_e.modele when 'nouveau_produit' then 'nouveautes' when 'alerte_evenement' then 'alertes_festival' else 'relances' end;

  if not exists (select 1 from public.consentement where compte_id = v_e.compte_id and objet = v_objet and retire_le is null) then
    select max(donne_le) into v_dernier_don from public.consentement where compte_id = v_e.compte_id and objet = v_objet;
    if exists (select 1 from public.desinscription where compte_id = v_e.compte_id and cree_le >= coalesce(v_dernier_don, '-infinity'::timestamptz)) then
      return jsonb_build_object('autorise', false, 'commercial', true, 'motif', 'desinscription');
    end if;
    return jsonb_build_object('autorise', false, 'commercial', true, 'motif', 'sans_consentement');
  end if;
  if public.emails_commerciaux_bloques_mineur(v_e.compte_id) then
    return jsonb_build_object('autorise', false, 'commercial', true, 'motif', 'compte_mineur');
  end if;
  if exists (
    select 1 from public.envoi e
    where e.compte_id = v_e.compte_id and e.id <> v_e.id and e.statut = 'envoye'
      and e.modele::text = any (c_commerciaux) and e.envoye_le > now() - interval '2 days'
  ) then
    return jsonb_build_object('autorise', false, 'commercial', true, 'motif', 'ecart_2_jours');
  end if;
  return jsonb_build_object('autorise', true, 'commercial', true);
end;
$$;

revoke all on function public.inscrire_alerte_evenement(jsonb, uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.desinscrire_alerte(uuid) from public, anon, authenticated;
revoke all on function public.planifier_alertes_evenements() from public, anon, authenticated;
revoke all on function public.alerte_evenement_pour_envoi(uuid) from public, anon, authenticated;
revoke all on function public.compter_alertes_evenement(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.exporter_alertes_whatsapp(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.inscrire_alerte_evenement(jsonb, uuid, text, text, text, text) to service_role;
grant execute on function public.desinscrire_alerte(uuid) to service_role;
grant execute on function public.planifier_alertes_evenements() to service_role;
grant execute on function public.alerte_evenement_pour_envoi(uuid) to service_role;
grant execute on function public.compter_alertes_evenement(jsonb, uuid) to service_role;
grant execute on function public.exporter_alertes_whatsapp(jsonb, uuid) to service_role;

-- Déclenchement de /api/cron/alertes-evenements chaque minute, comme les envois (secrets Vault site_url et cron_secret ; sans eux, rien n'est envoyé).
create function public.alertes_evenements_declencher()
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
    raise notice 'alertes_evenements_declencher : secrets Vault site_url / cron_secret absents, rien envoyé';
    return false;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/alertes-evenements',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  return true;
exception when others then
  raise notice 'alertes_evenements_declencher : appel impossible (%)', sqlstate;
  return false;
end;
$$;
revoke all on function public.alertes_evenements_declencher() from public, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('alertes-evenements', '* * * * *', 'select public.alertes_evenements_declencher()');
  else
    raise notice 'pg_cron indisponible : tâche alertes-evenements non planifiée';
  end if;
exception when others then
  raise notice 'planification alertes-evenements impossible (%)', sqlstate;
end
$$;
