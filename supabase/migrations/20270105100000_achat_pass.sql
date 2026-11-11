-- Story 7.4 : achat de Pass (FR-33, AD-7, AD-8, AD-12, AD-34, AD-37).
-- 1. ligne_commande porte soit un produit (comme avant), soit un Type de pass : nom du Type, prix, Stand et noms des titulaires FIGES (AD-8).
--    (Le CHECK de l'AD-7 « un de variante_id ou type_pass_id » ne convient pas tel quel : une ligne de Kit n'a ni variante ni Type de pass.
--    La règle écrite ici est donc « exactement un de produit_id ou type_pass_id », et une ligne de Pass n'a ni variante ni origine.)
-- 2. places_evenement_utilisees / places_type_pass_utilisees : lues à chaque requête, jamais cachées (AD-17).
-- 3. etat_vente_evenement : ce que la page publique montre à la place du bouton (Complet, Vente fermée).
-- 4. commande_pass_calculer / recapitulatif_commande_pass / creer_commande_pass : tout est lu en base (règle 3). Une Commande de Pass ne naît
--    jamais d'un Panier. creer_commande n'est pas modifiée : fonction sœur, appelée par la même couche (service) et la même table commande.
-- Aucun événement, aucun Type de pass ni aucun prix n'est créé par la migration (règle 14).

alter table public.ligne_commande
  alter column produit_id drop not null,
  add column type_pass_id uuid references public.type_pass (id) on delete restrict,
  -- Noms des titulaires figés à l'achat : tableau de textes, longueur = nombre de Pass (2 par unité pour un Stand).
  add column titulaires jsonb,
  add column pass_nom_fr text check (pass_nom_fr is null or char_length(pass_nom_fr) between 1 and 80),
  add column pass_nom_en text check (pass_nom_en is null or char_length(pass_nom_en) between 1 and 80),
  add column est_stand boolean;

alter table public.ligne_commande add constraint ligne_commande_produit_ou_pass check (
  (
    produit_id is not null and type_pass_id is null and titulaires is null and pass_nom_fr is null and pass_nom_en is null and est_stand is null
  ) or (
    produit_id is null and type_pass_id is not null and variante_id is null and origine is null
    and titulaires is not null and jsonb_typeof(titulaires) = 'array'
    and jsonb_array_length(titulaires) = nombre * (case when est_stand then 2 else 1 end)
    and pass_nom_fr is not null and est_stand is not null
  )
);
create index ligne_commande_type_pass_idx on public.ligne_commande (type_pass_id) where type_pass_id is not null;

-- Places (personnes) occupées dans un Événement par les Commandes de Pass encore en vie : en attente ou échouée tant que l'échéance n'est pas
-- passée (même règle que les réservations : une Commande échue n'est plus honorable), ou payée. Un Stand compte pour 2.
-- Annulée, expirée, remboursée : ne compte plus. Les tables de Pass viendront à la story 7.5 avec la même définition.
create function public.places_evenement_utilisees(p_evenement uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(l.nombre * (case when l.est_stand then 2 else 1 end)), 0)::integer
  from public.ligne_commande l
  join public.type_pass t on t.id = l.type_pass_id
  join public.commande c on c.id = l.commande_id
  where t.evenement_id = p_evenement
    and c.type = 'pass'
    and (c.statut = 'payee' or (c.statut in ('en_attente', 'echouee') and c.expire_le is not null and c.expire_le > now()))
$$;

-- Unités vendues d'un Type de pass (pour un Stand : des Stands, pas des personnes), mêmes statuts.
create function public.places_type_pass_utilisees(p_type uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(l.nombre), 0)::integer
  from public.ligne_commande l
  join public.commande c on c.id = l.commande_id
  where l.type_pass_id = p_type
    and c.type = 'pass'
    and (c.statut = 'payee' or (c.statut in ('en_attente', 'echouee') and c.expire_le is not null and c.expire_le > now()))
$$;

-- État de la vente d'un Événement publié, relu à chaque requête : 'a_venir', 'fermee', 'complet', 'aucun' (rien d'achetable) ou 'ouverte',
-- et pour chaque Type s'il est complet (quota ou Capacité). Null : Événement inconnu ou non publié. Aucun compteur de places n'est rendu.
create function public.etat_vente_evenement(p_evenement uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e record;
  v_ouvre timestamptz;
  v_ferme timestamptz;
  v_utilisees integer;
  v_restantes integer;
  v_etat text;
  v_types jsonb := '[]'::jsonb;
  v_t record;
  v_complet boolean;
  v_achetables integer := 0;
  v_achetables_complets integer := 0;
begin
  select id, capacite, publie_le, debut_le, vente_ouvre_le, vente_ferme_le into e
  from public.evenement where id = p_evenement and publie_le is not null and publie_le <= now();
  if not found then
    return null;
  end if;
  v_ouvre := coalesce(e.vente_ouvre_le, e.publie_le);
  v_ferme := coalesce(e.vente_ferme_le, e.debut_le);
  v_utilisees := public.places_evenement_utilisees(e.id);
  v_restantes := case when e.capacite is null then null else greatest(e.capacite - v_utilisees, 0) end;

  for v_t in select id, quota, est_stand, prix_cents from public.type_pass where evenement_id = e.id order by ordre, cree_le loop
    v_complet := (v_t.quota is not null and public.places_type_pass_utilisees(v_t.id) >= v_t.quota)
      or (v_restantes is not null and v_restantes < (case when v_t.est_stand then 2 else 1 end));
    v_types := v_types || jsonb_build_object('id', v_t.id, 'complet', v_complet);
    if not v_t.est_stand and v_t.prix_cents > 0 then
      v_achetables := v_achetables + 1;
      if v_complet then v_achetables_complets := v_achetables_complets + 1; end if;
    end if;
  end loop;

  if now() < v_ouvre then
    v_etat := 'a_venir';
  elsif v_ferme is not null and now() >= v_ferme then
    v_etat := 'fermee';
  elsif v_achetables = 0 then
    v_etat := 'aucun';
  elsif v_achetables_complets = v_achetables then
    v_etat := 'complet';
  else
    v_etat := 'ouverte';
  end if;
  return jsonb_build_object('etat', v_etat, 'types', v_types);
end;
$$;

-- Calcule une Commande de Pass sans rien écrire : lit tout en base (Types, prix, quotas, Capacité, dates de vente, Code promo) et refuse
-- ce qui ne peut pas être vendu. p_lignes = [{ type_pass_id, nombre?, titulaires: [noms] }], un seul élément par Type. Les noms sont nettoyés ici.
-- p_strict faux (Récapitulatif) : un Code promo refusé est rendu dans « code » au lieu d'une erreur, comme commande_calculer.
create function public.commande_pass_calculer(p_compte uuid, p_evenement uuid, p_lignes jsonb, p_code text, p_strict boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e record;
  v_ouvre timestamptz;
  v_ferme timestamptz;
  v_ligne jsonb;
  v_lignes jsonb := '[]'::jsonb;
  v_vus uuid[] := '{}';
  v_id uuid;
  v_type record;
  v_noms jsonb;
  v_nom_brut jsonb;
  v_nom text;
  v_propres jsonb;
  v_nombre integer;
  v_personnes integer := 0;
  v_sous_total bigint := 0;
  v_eval jsonb;
  v_code jsonb := null;
  v_pct numeric;
  v_reduction bigint := 0;
  v_reste bigint;
  v_part bigint;
  v_rang integer;
  v_json jsonb;
  v_nouvelles jsonb := '[]'::jsonb;
begin
  select id, capacite, publie_le, debut_le, vente_ouvre_le, vente_ferme_le into e from public.evenement where id = p_evenement;
  if not found or e.publie_le is null or e.publie_le > now() then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Dates de vente : ouverture à la publication et fermeture au début de l'Événement quand elles ne sont pas réglées.
  v_ouvre := coalesce(e.vente_ouvre_le, e.publie_le);
  v_ferme := coalesce(e.vente_ferme_le, e.debut_le);
  if now() < v_ouvre or (v_ferme is not null and now() >= v_ferme) then
    raise exception 'KS_VENTE_FERMEE' using errcode = 'P0001';
  end if;

  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) not between 1 and 20 then
    raise exception 'KS_PASS_INVALIDE' using errcode = 'P0001';
  end if;

  for v_ligne in select value from jsonb_array_elements(p_lignes) loop
    if jsonb_typeof(v_ligne) <> 'object' then
      raise exception 'KS_PASS_INVALIDE' using errcode = 'P0001';
    end if;
    begin
      v_id := (v_ligne ->> 'type_pass_id')::uuid;
    exception when others then
      raise exception 'KS_PASS_INVALIDE' using errcode = 'P0001';
    end;
    if v_id is null or v_id = any (v_vus) then
      raise exception 'KS_PASS_INVALIDE' using errcode = 'P0001';
    end if;
    v_vus := v_vus || v_id;
    select id, nom_fr, nom_en, prix_cents, quota, est_stand into v_type from public.type_pass where id = v_id and evenement_id = p_evenement;
    if not found then
      raise exception 'KS_TYPE_PASS_INTROUVABLE' using errcode = 'P0001';
    end if;
    -- Un Stand ne s'obtient que sur Candidature validée (AD-37, story 7.11) : tant qu'elle n'existe pas, tout Stand est refusé.
    if v_type.est_stand then
      raise exception 'KS_STAND_SUR_CANDIDATURE' using errcode = 'P0001';
    end if;
    -- Aucun paiement ne porte sur 0 USD : un Pass gratuit ne se vend pas ici.
    if v_type.prix_cents <= 0 then
      raise exception 'KS_PASS_GRATUIT' using errcode = 'P0001';
    end if;

    v_noms := v_ligne -> 'titulaires';
    if v_noms is null or jsonb_typeof(v_noms) <> 'array' then
      raise exception 'KS_PASS_INVALIDE' using errcode = 'P0001';
    end if;
    v_nombre := jsonb_array_length(v_noms);
    if v_nombre not between 1 and 20 then
      raise exception 'KS_PASS_INVALIDE' using errcode = 'P0001';
    end if;
    if v_ligne ? 'nombre' and (coalesce(v_ligne ->> 'nombre', '') !~ '^[0-9]{1,2}$' or (v_ligne ->> 'nombre')::integer <> v_nombre) then
      raise exception 'KS_PASS_INVALIDE' using errcode = 'P0001';
    end if;
    -- Chaque titulaire : un nom propre (espaces réduits, 2 à 80 caractères, ni chevrons ni caractère de contrôle).
    v_propres := '[]'::jsonb;
    for v_nom_brut in select value from jsonb_array_elements(v_noms) loop
      if jsonb_typeof(v_nom_brut) <> 'string' then
        raise exception 'KS_TITULAIRE_INVALIDE' using errcode = 'P0001';
      end if;
      v_nom := btrim(regexp_replace(v_nom_brut #>> '{}', '\s+', ' ', 'g'));
      if char_length(v_nom) not between 2 and 80 or v_nom ~ '[<>[:cntrl:]]' then
        raise exception 'KS_TITULAIRE_INVALIDE' using errcode = 'P0001';
      end if;
      v_propres := v_propres || to_jsonb(v_nom);
    end loop;

    v_personnes := v_personnes + v_nombre;
    if v_personnes > 20 then
      raise exception 'KS_PASS_INVALIDE' using errcode = 'P0001';
    end if;
    -- Quota du Type : vérifié comme la Capacité.
    if v_type.quota is not null and public.places_type_pass_utilisees(v_type.id) + v_nombre > v_type.quota then
      raise exception 'KS_COMPLET' using errcode = 'P0001';
    end if;

    v_sous_total := v_sous_total + v_type.prix_cents::bigint * v_nombre;
    v_lignes := v_lignes || jsonb_build_object(
      'type_pass_id', v_type.id, 'nom_fr', v_type.nom_fr, 'nom_en', v_type.nom_en, 'est_stand', v_type.est_stand,
      'prix_cents', v_type.prix_cents, 'nombre', v_nombre, 'titulaires', v_propres, 'reduction_cents', 0
    );
  end loop;

  -- Capacité de l'Événement (personnes), lue à l'instant : les Commandes de Pass en vie comptent (AD-12).
  if e.capacite is not null and public.places_evenement_utilisees(e.id) + v_personnes > e.capacite then
    raise exception 'KS_COMPLET' using errcode = 'P0001';
  end if;

  -- Code promo (FR-47, AD-8) : même mécanisme que pour les produits ; la réduction est répartie par ligne (arrondie au centime inférieur,
  -- reste sur la dernière ligne). Il n'y a jamais de Forfait de livraison pour un Pass.
  if p_code is not null and btrim(p_code) <> '' then
    v_eval := public.code_promo_evaluer(p_compte, p_code, null);
    if (v_eval ->> 'valide')::boolean then
      v_pct := (v_eval ->> 'reduction_pct')::numeric;
      v_reduction := floor(v_sous_total * v_pct / 100)::bigint;
      if v_reduction > 0 and v_sous_total - v_reduction <= 0 then
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

    v_rang := 0;
    v_reste := v_reduction;
    for v_json in select e2 from jsonb_array_elements(v_lignes) with ordinality as t(e2, n) order by n loop
      v_rang := v_rang + 1;
      if v_reduction = 0 then
        v_part := 0;
      elsif v_rang = jsonb_array_length(v_lignes) then
        v_part := v_reste;
      else
        v_part := (v_reduction * (v_json ->> 'prix_cents')::bigint * (v_json ->> 'nombre')::bigint) / v_sous_total;
      end if;
      v_reste := v_reste - v_part;
      v_nouvelles := v_nouvelles || (v_json || jsonb_build_object('reduction_cents', v_part));
    end loop;
    v_lignes := v_nouvelles;
  end if;

  return jsonb_build_object(
    'evenement_id', e.id, 'lignes', v_lignes, 'personnes', v_personnes,
    'sous_total_cents', v_sous_total, 'reduction_cents', v_reduction, 'total_cents', v_sous_total - v_reduction, 'code', v_code
  );
end;
$$;

-- Récapitulatif de Pass (UX-DR32) : prix, noms, total relus en base. Aucune écriture.
create function public.recapitulatif_commande_pass(p_compte uuid, p_evenement uuid, p_lignes jsonb, p_code text default null)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.commande_pass_calculer(p_compte, p_evenement, p_lignes, p_code, false)
$$;

-- Crée la Commande de Pass en attente (FR-33, AD-7, AD-34). Même échéance (Délai de paiement), même clé d'idempotence, même règle « une seule
-- Commande à payer par Compte » que creer_commande. La ligne de l'Événement est verrouillée avant de compter les places : deux achats simultanés
-- ne se partagent pas la dernière place. Le Panier n'est ni lu ni modifié.
create function public.creer_commande_pass(
  p_auteur jsonb, p_evenement uuid, p_lignes jsonb, p_acceptations jsonb, p_total_attendu_cents integer, p_cle_idempotence text,
  p_code text default null, p_origine text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_calcul jsonb;
  v_existante record;
  v_ligne jsonb;
  v_id uuid;
  v_numero text;
  v_delai_txt text;
  v_expire timestamptz;
  v_version text;
  v_acceptees jsonb;
  v_code record;
  v_a_code boolean := false;
  v_origine text;
begin
  v_compte := public.exiger_client(p_auteur);

  if p_cle_idempotence is null or length(p_cle_idempotence) not between 8 and 100 then
    raise exception 'KS_CLE_IDEMPOTENCE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_origine is not null and p_origine !~ '^[a-z0-9_-]{1,40}$' then
    raise exception 'KS_ORIGINE_INVALIDE' using errcode = 'P0001';
  end if;

  -- Même verrou que creer_commande : deux envois simultanés du même Compte (Pass ou produits) s'attendent.
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

  -- Verrou de l'Événement : les achats d'un même Événement se suivent (quota et Capacité comptés sans course).
  perform 1 from public.evenement where id = p_evenement and publie_le is not null and publie_le <= now() for update;
  if not found then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;

  v_calcul := public.commande_pass_calculer(v_compte, p_evenement, p_lignes, p_code, true);

  -- Acceptation exigée par le contenu (AD-34) : la mention sur la publication des photos et vidéos de l'Événement.
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

  select valeur into v_delai_txt from public.reglage where cle = 'delai_paiement';
  if v_delai_txt is null or v_delai_txt !~ '^[0-9]{1,4}$' then
    raise exception 'KS_REGLAGE_MANQUANT' using errcode = 'P0001';
  end if;
  v_expire := now() + (v_delai_txt::integer * interval '1 minute');

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

  for v_ligne in select * from jsonb_array_elements(v_calcul -> 'lignes') loop
    insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents, reduction_cents, type_pass_id, titulaires, pass_nom_fr, pass_nom_en, est_stand)
    values (
      v_id, null, (v_ligne ->> 'nombre')::smallint, (v_ligne ->> 'prix_cents')::integer, coalesce((v_ligne ->> 'reduction_cents')::integer, 0),
      (v_ligne ->> 'type_pass_id')::uuid, v_ligne -> 'titulaires', v_ligne ->> 'nom_fr', nullif(v_ligne ->> 'nom_en', ''),
      (v_ligne ->> 'est_stand')::boolean
    );
  end loop;

  return jsonb_build_object('commande_id', v_id, 'numero', v_numero, 'expire_le', v_expire, 'rejeu', false);
end;
$$;

-- Droits : serveur seulement (service_role). Les fonctions de calcul interne ne sont pas appelables par le client.
revoke all on function public.places_evenement_utilisees(uuid) from public, anon, authenticated;
revoke all on function public.places_type_pass_utilisees(uuid) from public, anon, authenticated;
revoke all on function public.etat_vente_evenement(uuid) from public, anon, authenticated;
revoke all on function public.commande_pass_calculer(uuid, uuid, jsonb, text, boolean) from public, anon, authenticated, service_role;
revoke all on function public.recapitulatif_commande_pass(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.creer_commande_pass(jsonb, uuid, jsonb, jsonb, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.places_evenement_utilisees(uuid) to service_role;
grant execute on function public.places_type_pass_utilisees(uuid) to service_role;
grant execute on function public.etat_vente_evenement(uuid) to service_role;
grant execute on function public.recapitulatif_commande_pass(uuid, uuid, jsonb, text) to service_role;
grant execute on function public.creer_commande_pass(jsonb, uuid, jsonb, jsonb, integer, text, text, text) to service_role;
