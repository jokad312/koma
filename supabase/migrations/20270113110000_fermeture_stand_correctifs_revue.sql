-- Correctifs de la revue de la fermeture sur place (20270113100000) :
-- 1. une fermeture sur place est définitive pour ce Compte et cet Événement, comme un refus (pas de nouvelle candidature si la vente est encore ouverte) ;
-- 2. le journal d'audit de candidature_stand garde la date de fermeture (avant et après).

-- Journal d'audit sans description, sans lien Instagram, sans chemin de photo.
create or replace function public.candidature_stand_journaliser()
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
    case when tg_op = 'UPDATE' then jsonb_build_object('statut', old.statut, 'commande_id', old.commande_id, 'fermee_le', old.fermee_le) end,
    jsonb_build_object('statut', new.statut, 'evenement_id', new.evenement_id, 'type_pass_id', new.type_pass_id, 'commande_id', new.commande_id, 'expire_le', new.expire_le, 'fermee_le', new.fermee_le)
  );
  return new;
end;
$$;
revoke all on function public.candidature_stand_journaliser() from public, anon, authenticated, service_role;

create or replace function public.deposer_candidature_stand(
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

  -- Un refus ou une fermeture sur place de l'Admin est définitif pour ce Compte et cet Événement.
  if exists (select 1 from public.candidature_stand k where k.compte_id = v_compte and k.evenement_id = p_evenement and (k.statut = 'refusee' or k.fermee_le is not null)) then
    raise exception 'KS_CANDIDATURE_REFUSEE' using errcode = 'P0001';
  end if;
  -- Une seule candidature active par Compte et par Événement : acceptée non expirée, ou dont la Commande est payée avec au moins un Pass vivant.
  if exists (
    select 1 from public.candidature_stand k left join public.commande c on c.id = k.commande_id
    where k.compte_id = v_compte and k.evenement_id = p_evenement and k.statut = 'validee'
      and (k.expire_le > now()
           or (c.statut in ('payee', 'offerte') and exists (select 1 from public.pass p where p.commande_id = c.id and p.statut in ('valide', 'scanne'))))
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
  -- L'échéance ne dépasse jamais la fermeture de la vente (ou, à défaut, le début de l'Événement).
  v_expire := least(now() + (v_heures::integer * interval '1 hour'), coalesce(e.vente_ferme_le, e.debut_le));

  perform set_config('ks.auteur', p_auteur::text, true);
  insert into public.candidature_stand (id, evenement_id, type_pass_id, compte_id, description, instagram, photos, engagement_version, expire_le)
  values (p_id, p_evenement, p_type, v_compte, v_description, v_instagram, p_photos, p_engagement_version, v_expire);

  -- Email « candidature_validee » (lien et heure limite relus en base au rendu), une seule fois par candidature.
  perform public.envois_planifier('candidature_validee', v_compte, jsonb_build_object('candidature_id', p_id), 'candidature_validee:' || p_id::text);
  return jsonb_build_object('candidature_id', p_id, 'expire_le', v_expire);
end;
$$;

create or replace function public.candidature_stand_possible(p_compte uuid, p_evenement uuid, p_type uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e record;
  v_type record;
begin
  select id, capacite, publie_le, debut_le, vente_ouvre_le, vente_ferme_le into e
  from public.evenement where id = p_evenement and publie_le is not null and publie_le <= now();
  if not found then
    return 'KS_EVENEMENT_INTROUVABLE';
  end if;
  if now() < coalesce(e.vente_ouvre_le, e.publie_le) or (coalesce(e.vente_ferme_le, e.debut_le) is not null and now() >= coalesce(e.vente_ferme_le, e.debut_le)) then
    return 'KS_VENTE_FERMEE';
  end if;
  select id, prix_cents, quota, est_stand into v_type from public.type_pass where id = p_type and evenement_id = p_evenement;
  if not found or not v_type.est_stand then
    return 'KS_TYPE_PASS_INTROUVABLE';
  end if;
  if v_type.prix_cents <= 0 then
    return 'KS_PASS_GRATUIT';
  end if;
  if exists (select 1 from public.candidature_stand k where k.compte_id = p_compte and k.evenement_id = p_evenement and (k.statut = 'refusee' or k.fermee_le is not null)) then
    return 'KS_CANDIDATURE_REFUSEE';
  end if;
  if exists (
    select 1 from public.candidature_stand k left join public.commande c on c.id = k.commande_id
    where k.compte_id = p_compte and k.evenement_id = p_evenement and k.statut = 'validee'
      and (k.expire_le > now()
           or (c.statut in ('payee', 'offerte') and exists (select 1 from public.pass p where p.commande_id = c.id and p.statut in ('valide', 'scanne'))))
  ) then
    return 'KS_CANDIDATURE_EXISTANTE';
  end if;
  if (v_type.quota is not null and public.places_type_pass_utilisees(v_type.id) + 1 > v_type.quota)
     or (e.capacite is not null and e.capacite - public.places_evenement_utilisees(e.id) < 2) then
    return 'KS_COMPLET';
  end if;
  return null;
end;
$$;
