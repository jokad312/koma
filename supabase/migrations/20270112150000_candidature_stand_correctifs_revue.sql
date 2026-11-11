-- Story 7.11, correctifs de revue (sous-agents, 2026-11-11) :
-- 1. Un refus de l'Admin est définitif pour ce Compte et cet Événement (KS_CANDIDATURE_REFUSEE) ; un Stand payé dont tous les Pass sont annulés ou
--    remboursés ne bloque plus une nouvelle candidature.
-- 2. L'échéance d'une candidature et d'une Commande de Stand ne dépasse jamais la fermeture de la vente (ou le début de l'Événement) ; la Commande
--    garde au moins le délai de paiement ordinaire (un client de bonne foi n'est pas piégé par une candidature presque échue).
-- 3. commande_stand_calculer vérifie que le Type est toujours un Stand.
-- 4. refuser_candidature_stand : mêmes verrous qu'annuler_pass (pas d'interblocage) ; ferme les demandes d'annulation ouvertes sur le Stand.
-- 5. candidature_stand_possible : pré-contrôle en lecture avant l'envoi des photos.
-- Les migrations précédentes ne sont pas modifiées : ces fonctions sont recréées (create or replace), droits inchangés.

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

  -- Un refus de l'Admin est définitif pour ce Compte et cet Événement.
  if exists (select 1 from public.candidature_stand k where k.compte_id = v_compte and k.evenement_id = p_evenement and k.statut = 'refusee') then
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

create or replace function public.commande_stand_calculer(p_compte uuid, p_candidature uuid, p_code text, p_strict boolean)
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
  select id, nom_fr, nom_en, prix_cents, est_stand into v_type from public.type_pass where id = k.type_pass_id;
  if not v_type.est_stand then
    raise exception 'KS_TYPE_PASS_INTROUVABLE' using errcode = 'P0001';
  end if;
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

create or replace function public.creer_commande_stand(
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
  v_delai_txt text;
  e record;
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

  -- Fenêtre de paiement : au moins le délai de paiement ordinaire (une candidature presque échue ne piège pas un client de bonne foi), sans jamais
  -- dépasser la fermeture de la vente (ou le début de l'Événement).
  select valeur into v_delai_txt from public.reglage where cle = 'delai_paiement';
  if v_delai_txt is null or v_delai_txt !~ '^[0-9]{1,4}$' then
    raise exception 'KS_REGLAGE_MANQUANT' using errcode = 'P0001';
  end if;
  select vente_ferme_le, debut_le into e from public.evenement where id = v_evenement;
  v_expire := least(greatest((v_calcul ->> 'expire_le')::timestamptz, now() + (v_delai_txt::integer * interval '1 minute')), coalesce(e.vente_ferme_le, e.debut_le));
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

create or replace function public.refuser_candidature_stand(p_auteur jsonb, p_candidature uuid, p_motif text)
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
    -- Même ordre de verrous qu'annuler_pass (Pass d'abord, puis Commande) : pas d'interblocage entre deux Admin.
    perform 1 from public.pass where commande_id = k.commande_id order by id for update;
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
      -- Une demande d'annulation de ces Pass encore ouverte n'a plus d'objet : elle est refusée.
      update public.demande_client set statut = 'refusee', traitee_le = now()
        where type = 'annulation_pass' and statut = 'ouverte' and pass_id in (select id from public.pass where ligne_commande_id = v_l.id);
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

-- Pré-contrôle en lecture avant l'envoi des trois photos : rend NULL si le Compte peut candidater maintenant, sinon le code de l'obstacle.
-- Même logique que deposer_candidature_stand (qui revérifie tout au dépôt) ; évite d'envoyer 3 photos pour rien.
create function public.candidature_stand_possible(p_compte uuid, p_evenement uuid, p_type uuid)
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
  if exists (select 1 from public.candidature_stand k where k.compte_id = p_compte and k.evenement_id = p_evenement and k.statut = 'refusee') then
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
revoke all on function public.candidature_stand_possible(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.candidature_stand_possible(uuid, uuid, uuid) to service_role;
