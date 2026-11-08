-- Story 9.4 : consentements aux Emails commerciaux, Préférences et désinscription (FR-45, AD-9, AD-34, E-38).
-- - consentement : un objet par usage (relances, nouveautes, alertes_festival), avec la version du texte accepté et sa date ;
--   retirer un consentement pose retire_le (jamais de suppression : la preuve reste).
-- - desinscription : chaque désinscription par le lien signé, avec sa date ; elle retire tous les consentements actifs.
-- - email_commercial_autorise : seule règle de la boîte d'envoi pour un Email commercial (AD-9) ; un email lié à un achat n'y passe jamais.
-- - reglage emails_commerciaux_mineurs : désactivé au départ (décision du 2026-10-21) ; aucun Email commercial pour un Compte mineur.
-- Tables lisibles par le serveur seulement (RLS, aucun droit client).

create table public.consentement (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references auth.users (id) on delete cascade,
  objet text not null check (objet in ('relances', 'nouveautes', 'alertes_festival')),
  version text not null check (char_length(version) between 1 and 50),
  source text not null check (source in ('creation_compte', 'commande', 'preferences')),
  donne_le timestamptz not null default now(),
  retire_le timestamptz,
  constraint consentement_retrait_apres_don check (retire_le is null or retire_le >= donne_le)
);
-- Au plus un consentement actif par Compte et par objet.
create unique index consentement_actif_unique on public.consentement (compte_id, objet) where retire_le is null;
alter table public.consentement enable row level security;
revoke all on public.consentement from public, anon, authenticated;
create trigger consentement_journaliser
  after insert or update or delete on public.consentement
  for each row execute function public.journaliser('id');

create table public.desinscription (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references auth.users (id) on delete cascade,
  cree_le timestamptz not null default now()
);
create index desinscription_compte_idx on public.desinscription (compte_id, cree_le desc);
alter table public.desinscription enable row level security;
revoke all on public.desinscription from public, anon, authenticated;
create trigger desinscription_journaliser
  after insert or update or delete on public.desinscription
  for each row execute function public.journaliser('id');

select set_config('ks.auteur', '{"type":"migration","nom":"consentements_et_desinscription"}', true);
insert into public.reglage (cle, valeur) values ('emails_commerciaux_mineurs', 'false') on conflict (cle) do nothing;

-- Donne un ou plusieurs consentements (case de la création de Compte ou de l'étape de commande). Un consentement déjà actif est gardé tel quel.
create function public.donner_consentements(p_auteur jsonb, p_objets text[], p_version text, p_source text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_objet text;
  v_nouveaux integer := 0;
begin
  v_compte := public.exiger_client(p_auteur);
  if p_objets is null or cardinality(p_objets) = 0 or exists (select 1 from unnest(p_objets) o where o is null or o not in ('relances', 'nouveautes', 'alertes_festival')) then
    raise exception 'KS_CONSENTEMENT_INVALIDE' using errcode = 'P0001';
  end if;
  if p_version is null or char_length(p_version) not between 1 and 50 or p_source is null or p_source not in ('creation_compte', 'commande', 'preferences') then
    raise exception 'KS_CONSENTEMENT_INVALIDE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  -- Deux envois simultanés du même Compte s'attendent (l'index unique refuserait le second).
  perform pg_advisory_xact_lock(hashtextextended('consentement:' || v_compte::text, 0));
  foreach v_objet in array p_objets loop
    if not exists (select 1 from public.consentement where compte_id = v_compte and objet = v_objet and retire_le is null) then
      insert into public.consentement (compte_id, objet, version, source) values (v_compte, v_objet, p_version, p_source);
      v_nouveaux := v_nouveaux + 1;
    end if;
  end loop;
  return v_nouveaux;
end;
$$;

-- Interrupteur de « Préférences » : renvoie l'état réel après l'écriture.
create function public.regler_preference(p_auteur jsonb, p_objet text, p_actif boolean, p_version text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
begin
  v_compte := public.exiger_client(p_auteur);
  if p_objet is null or p_objet not in ('relances', 'nouveautes', 'alertes_festival') or p_actif is null then
    raise exception 'KS_CONSENTEMENT_INVALIDE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  perform pg_advisory_xact_lock(hashtextextended('consentement:' || v_compte::text, 0));
  if p_actif then
    if p_version is null or char_length(p_version) not between 1 and 50 then
      raise exception 'KS_CONSENTEMENT_INVALIDE' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.consentement where compte_id = v_compte and objet = p_objet and retire_le is null) then
      insert into public.consentement (compte_id, objet, version, source) values (v_compte, p_objet, p_version, 'preferences');
    end if;
  else
    update public.consentement set retire_le = now() where compte_id = v_compte and objet = p_objet and retire_le is null;
  end if;
  return exists (select 1 from public.consentement where compte_id = v_compte and objet = p_objet and retire_le is null);
end;
$$;

-- Vrai si les Emails commerciaux sont exclus pour ce Compte : Compte mineur et réglage emails_commerciaux_mineurs différent de 'true'.
create function public.emails_commerciaux_bloques_mineur(p_compte uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.est_mineur(p_compte)
    and coalesce((select valeur from public.reglage where cle = 'emails_commerciaux_mineurs'), 'false') <> 'true'
$$;

-- État des trois interrupteurs, lu par la page Préférences du Compte connecté.
create function public.lire_preferences(p_compte uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'relances', exists (select 1 from public.consentement where compte_id = p_compte and objet = 'relances' and retire_le is null),
    'nouveautes', exists (select 1 from public.consentement where compte_id = p_compte and objet = 'nouveautes' and retire_le is null),
    'alertes_festival', exists (select 1 from public.consentement where compte_id = p_compte and objet = 'alertes_festival' and retire_le is null),
    'mineur_bloque', public.emails_commerciaux_bloques_mineur(p_compte)
  )
$$;

-- Désinscription par le lien signé (la signature est vérifiée par le serveur avant l'appel) : effet immédiat, sans connexion.
-- Renvoie faux si le Compte n'existe plus.
create function public.desinscrire(p_compte uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_compte is null or not exists (select 1 from auth.users where id = p_compte) then
    return false;
  end if;
  perform set_config('ks.auteur', jsonb_build_object('type', 'systeme', 'nom', 'lien_desinscription', 'compte', p_compte)::text, true);
  perform pg_advisory_xact_lock(hashtextextended('consentement:' || p_compte::text, 0));
  insert into public.desinscription (compte_id) values (p_compte);
  update public.consentement set retire_le = now() where compte_id = p_compte and retire_le is null;
  return true;
end;
$$;

-- Règle de la boîte d'envoi pour un Email commercial (AD-9). Un modèle lié à un achat est toujours autorisé ici.
-- Motifs : sans_consentement, desinscription, compte_mineur, ecart_2_jours (un autre Email commercial parti il y a moins de 2 jours).
create function public.email_commercial_autorise(p_envoi uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_e record;
  v_objet text;
  v_dernier_don timestamptz;
  c_commerciaux constant text[] := array['relance', 'panier_abandonne', 'rappel_kit', 'nouveau_produit', 'alerte_evenement'];
begin
  select id, modele::text as modele, compte_id into v_e from public.envoi where id = p_envoi;
  if not found then
    raise exception 'KS_ENVOI_INTROUVABLE' using errcode = 'P0001';
  end if;
  if not (v_e.modele = any (c_commerciaux)) then
    return jsonb_build_object('autorise', true, 'commercial', false);
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

revoke all on function public.donner_consentements(jsonb, text[], text, text) from public, anon, authenticated;
revoke all on function public.regler_preference(jsonb, text, boolean, text) from public, anon, authenticated;
revoke all on function public.emails_commerciaux_bloques_mineur(uuid) from public, anon, authenticated;
revoke all on function public.lire_preferences(uuid) from public, anon, authenticated;
revoke all on function public.desinscrire(uuid) from public, anon, authenticated;
revoke all on function public.email_commercial_autorise(uuid) from public, anon, authenticated;
grant execute on function public.donner_consentements(jsonb, text[], text, text) to service_role;
grant execute on function public.regler_preference(jsonb, text, boolean, text) to service_role;
grant execute on function public.lire_preferences(uuid) to service_role;
grant execute on function public.desinscrire(uuid) to service_role;
grant execute on function public.email_commercial_autorise(uuid) to service_role;
