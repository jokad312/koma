-- Story 7.11, correctif de la migration 20270112150000 (trouvé par le test pgTAP) : dans creer_commande_stand, la variable « e » entrait en conflit avec l'alias
-- « e » de jsonb_array_elements ; elle devient v_ev. Aucune autre modification.
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
  v_ev record;
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
  select vente_ferme_le, debut_le into v_ev from public.evenement where id = v_evenement;
  v_expire := least(greatest((v_calcul ->> 'expire_le')::timestamptz, now() + (v_delai_txt::integer * interval '1 minute')), coalesce(v_ev.vente_ferme_le, v_ev.debut_le));
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
