-- Story 9.2 : appliquer un Code promo (FR-46, FR-47, AD-8, AD-27, AD-29).
-- 1. commande_code_promo : le code, le taux de réduction et le taux de commission FIGÉS avec la Commande (service seulement : le taux de commission de
--    l'Affilié n'est jamais lisible par le client). Une modification du code (9.1) ne change jamais une Commande passée.
-- 2. utilisations_code_promo (AD-29) : calculées depuis les Commandes, jamais comptées sur code_promo. Une Commande qui expire ou est annulée libère son utilisation.
--    Un plafond abaissé sous le nombre d'utilisations déjà faites ne touche pas les Commandes existantes : il refuse seulement les nouvelles.
-- 3. a_deja_achete (AD-29) : une autre Commande du Compte avec paye_le non nul (une Commande offerte n'en a pas).
-- 4. code_promo_evaluer : active, sous le plafond, premier achat, un seul code par achat. commande_calculer, recapitulatif_commande et creer_commande
--    (réécrites depuis leur dernière version, AD-1) reçoivent le code ; confirmer_paiement ne le revérifie pas.

create table public.commande_code_promo (
  commande_id uuid primary key references public.commande (id) on delete restrict,
  code_promo_id uuid not null references public.code_promo (id) on delete restrict,
  code text not null,
  reduction_pct numeric(5,2) not null check (reduction_pct > 0 and reduction_pct <= 100),
  commission_pct numeric(5,2) not null check (commission_pct >= 0 and commission_pct <= 100),
  reduction_cents integer not null check (reduction_cents >= 0),
  cree_le timestamptz not null default now()
);
create index commande_code_promo_code_idx on public.commande_code_promo (code_promo_id);
alter table public.commande_code_promo enable row level security;
revoke all on public.commande_code_promo from public, anon, authenticated;
grant select, insert on public.commande_code_promo to service_role;

create function public.utilisations_code_promo(p_code uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.commande_code_promo ccp
  join public.commande c on c.id = ccp.commande_id
  where ccp.code_promo_id = p_code
    and (c.statut in ('en_attente', 'echouee') or (c.paye_le is not null and c.statut not in ('annulee', 'remboursee')))
$$;

create function public.a_deja_achete(p_compte uuid, p_sauf_commande uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.commande c
    where c.compte_id = p_compte and c.paye_le is not null and c.id is distinct from p_sauf_commande
  )
$$;

-- Évalue un code pour un Compte. Ordre des refus = ordre des messages de la story : inconnu, inactif, plafond, premier achat, un seul code par achat.
create function public.code_promo_evaluer(p_compte uuid, p_code text, p_sauf_commande uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_norm text := upper(btrim(coalesce(p_code, '')));
  v_c record;
begin
  if v_norm !~ '^[A-Z0-9_-]{3,24}$' then
    return jsonb_build_object('valide', false, 'erreur', 'code_inconnu');
  end if;
  select id, code, reduction_pct, plafond, actif into v_c from public.code_promo where code = v_norm;
  if not found then
    return jsonb_build_object('valide', false, 'erreur', 'code_inconnu');
  end if;
  if not v_c.actif then
    return jsonb_build_object('valide', false, 'erreur', 'code_inactif');
  end if;
  if public.utilisations_code_promo(v_c.id) >= v_c.plafond then
    return jsonb_build_object('valide', false, 'erreur', 'code_plafond');
  end if;
  if public.a_deja_achete(p_compte, p_sauf_commande) then
    return jsonb_build_object('valide', false, 'erreur', 'code_premier_achat');
  end if;
  if exists (
    select 1 from public.commande c join public.commande_code_promo ccp on ccp.commande_id = c.id
    where c.compte_id = p_compte and c.statut = 'en_attente' and c.id is distinct from p_sauf_commande
  ) then
    return jsonb_build_object('valide', false, 'erreur', 'code_un_seul');
  end if;
  return jsonb_build_object('valide', true, 'id', v_c.id, 'code', v_c.code, 'reduction_pct', v_c.reduction_pct);
end;
$$;

drop function public.creer_commande(jsonb, uuid, text, text, text, text, jsonb, text, integer, text, text);
drop function public.recapitulatif_commande(uuid, uuid, text, text);
drop function public.commande_calculer(uuid, uuid, text, text, boolean);

create function public.commande_calculer(p_compte uuid, p_panier uuid, p_zone text, p_mode text, p_strict boolean, p_code text default null, p_sauf_commande uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ligne record;
  v_lignes jsonb := '[]'::jsonb;
  v_prises jsonb := '{}'::jsonb;
  v_prises_n integer;
  v_fab_prises integer := 0;
  v_plafond integer;
  v_stock integer;
  v_etat text;
  v_origine text;
  v_delai integer;
  v_sous_total bigint := 0;
  v_forfait integer := 0;
  v_physique boolean := false;
  v_kit boolean := false;
  v_sur_mesure boolean := false;
  v_indisponible boolean := false;
  v_remise_manquante boolean := false;
  v_reglage text;
  v_empreinte text;
  v_eval jsonb;
  v_code jsonb := null;
  v_pct numeric;
  v_reduction bigint := 0;
  v_reste bigint;
  v_part bigint;
  v_eligibles integer;
  v_rang integer;
  v_json jsonb;
  v_nouvelles jsonb := '[]'::jsonb;
begin
  select (valeur)::integer into v_plafond from public.reglage where cle = 'plafond_fabrication' and valeur ~ '^[0-9]{1,5}$';

  for v_ligne in
    select lp.id as ligne_id, lp.produit_id, lp.variante_id, lp.nombre::integer as nombre,
           p.famille, p.slug, p.titre_fr, p.titre_en, p.prix_cents, p.publie_le, p.delai_fabrication_jours as delai_produit,
           v.taille, v.fabrication_sur_commande as fabrication, v.delai_fabrication_jours as delai_variante
    from public.ligne_panier lp
    join public.produit p on p.id = lp.produit_id
    left join public.variante v on v.id = lp.variante_id
    where lp.panier_id = p_panier
    order by lp.cree_le, lp.id
  loop
    v_origine := null;
    v_delai := null;
    v_etat := 'disponible';

    if v_ligne.publie_le is null or v_ligne.publie_le > now() or v_ligne.prix_cents is null then
      v_etat := 'epuise';
    elsif v_ligne.prix_cents = 0 then
      raise exception 'KS_PRODUIT_GRATUIT' using errcode = 'P0001';
    elsif v_ligne.famille = 'kit' then
      v_kit := true;
      if exists (select 1 from public.acces_kit where compte_id = p_compte and produit_id = v_ligne.produit_id)
         or exists (
           select 1 from public.ligne_commande lc join public.commande c on c.id = lc.commande_id
           where c.compte_id = p_compte and c.statut in ('en_attente', 'echouee') and c.expire_le > now() and lc.produit_id = v_ligne.produit_id
         ) then
        raise exception 'KS_KIT_DEJA_POSSEDE' using errcode = 'P0001';
      end if;
    else
      v_physique := true;
      if v_ligne.taille = 'sur_mesure' then
        v_sur_mesure := true;
      end if;
      v_prises_n := coalesce((v_prises ->> v_ligne.variante_id::text)::integer, 0);
      v_stock := coalesce(public.stock_disponible(v_ligne.variante_id), 0) - v_prises_n;
      if v_stock >= v_ligne.nombre then
        v_origine := 'stock';
        v_prises := v_prises || jsonb_build_object(v_ligne.variante_id::text, v_prises_n + v_ligne.nombre);
      elsif v_ligne.fabrication and (v_plafond is null or public.places_fabrication_utilisees() + v_fab_prises + v_ligne.nombre <= v_plafond) then
        v_origine := 'fabrication';
        v_fab_prises := v_fab_prises + v_ligne.nombre;
        v_delai := coalesce(v_ligne.delai_variante, v_ligne.delai_produit);
        v_etat := 'sur_commande';
      else
        v_etat := 'epuise';
      end if;
    end if;

    if v_etat = 'epuise' then
      if p_strict then
        raise exception 'KS_INDISPONIBLE' using errcode = 'P0001';
      end if;
      v_indisponible := true;
    else
      v_sous_total := v_sous_total + v_ligne.prix_cents::bigint * v_ligne.nombre;
    end if;

    v_lignes := v_lignes || jsonb_build_object(
      'ligne_id', v_ligne.ligne_id, 'produit_id', v_ligne.produit_id, 'variante_id', v_ligne.variante_id,
      'famille', v_ligne.famille, 'slug', v_ligne.slug, 'titre_fr', v_ligne.titre_fr, 'titre_en', v_ligne.titre_en,
      'taille', v_ligne.taille, 'nombre', v_ligne.nombre, 'prix_cents', v_ligne.prix_cents,
      'etat', v_etat, 'origine', v_origine, 'delai_fabrication_jours', v_delai
    );
  end loop;

  if jsonb_array_length(v_lignes) = 0 then
    raise exception 'KS_PANIER_VIDE' using errcode = 'P0001';
  end if;

  -- Remise : seulement pour un Panier qui contient un produit physique. Retrait gratuit à Goma ; Bukavu : livraison obligatoire.
  if v_physique then
    if p_zone is null or p_mode is null then
      if p_strict then
        raise exception 'KS_REMISE_MANQUANTE' using errcode = 'P0001';
      end if;
      v_remise_manquante := true;
    elsif p_zone not in ('goma', 'bukavu') or p_mode not in ('retrait', 'livraison') or (p_zone = 'bukavu' and p_mode = 'retrait') then
      raise exception 'KS_REMISE_INVALIDE' using errcode = 'P0001';
    elsif p_mode = 'retrait' then
      v_forfait := 0;
      if p_strict and (
        coalesce((select btrim(valeur) from public.reglage where cle = 'retrait_goma_fr'), '') = ''
        or coalesce((select btrim(valeur) from public.reglage where cle = 'retrait_goma_en'), '') = ''
      ) then
        raise exception 'KS_REGLAGE_MANQUANT' using errcode = 'P0001';
      end if;
    else
      select valeur into v_reglage from public.reglage where cle = 'forfait_livraison_' || p_zone || '_cents';
      if v_reglage is null or v_reglage !~ '^[0-9]{1,6}$' then
        raise exception 'KS_REGLAGE_MANQUANT' using errcode = 'P0001';
      end if;
      v_forfait := v_reglage::integer;
    end if;
  elsif p_zone is not null or p_mode is not null then
    raise exception 'KS_REMISE_INVALIDE' using errcode = 'P0001';
  end if;

  -- Code promo (FR-46, FR-47, AD-8, AD-29) : la réduction porte sur tous les Produits, jamais sur le Forfait de livraison ; elle est calculée ici,
  -- depuis la base, puis répartie par ligne (réduction totale x prix de la ligne / sous-total, arrondie au centime inférieur, reste sur la dernière ligne).
  if p_code is not null and btrim(p_code) <> '' then
    v_eval := public.code_promo_evaluer(p_compte, p_code, p_sauf_commande);
    if (v_eval ->> 'valide')::boolean then
      v_pct := (v_eval ->> 'reduction_pct')::numeric;
      v_reduction := floor(v_sous_total * v_pct / 100)::bigint;
      -- Aucun paiement ne porte sur 0 USD : un code qui rendrait la Commande gratuite est refusé.
      if v_reduction > 0 and v_sous_total - v_reduction + v_forfait <= 0 then
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

    select count(*) into v_eligibles from jsonb_array_elements(v_lignes) as e where e ->> 'etat' <> 'epuise';
    v_rang := 0;
    v_reste := v_reduction;
    for v_json in select e from jsonb_array_elements(v_lignes) with ordinality as t(e, n) order by n loop
      if v_json ->> 'etat' = 'epuise' then
        v_nouvelles := v_nouvelles || (v_json || jsonb_build_object('reduction_cents', 0));
      else
        v_rang := v_rang + 1;
        if v_reduction = 0 then
          v_part := 0;
        elsif v_rang = v_eligibles then
          v_part := v_reste;
        else
          v_part := (v_reduction * (v_json ->> 'prix_cents')::bigint * (v_json ->> 'nombre')::bigint) / v_sous_total;
        end if;
        v_reste := v_reste - v_part;
        v_nouvelles := v_nouvelles || (v_json || jsonb_build_object('reduction_cents', v_part));
      end if;
    end loop;
    v_lignes := v_nouvelles;
  end if;

  -- Empreinte des lignes (ligne, nombre, origine, délai annoncé) : le client la renvoie à la création, qui la refuse si elle a changé
  -- (par exemple la dernière pièce en stock prise entre-temps : la ligne passe en fabrication au même prix, avec un délai que le client n'a pas vu).
  select md5(coalesce(string_agg((e ->> 'ligne_id') || ':' || (e ->> 'nombre') || ':' || coalesce(e ->> 'origine', '-') || ':' || coalesce(e ->> 'delai_fabrication_jours', '0'), ',' order by e ->> 'ligne_id'), ''))
    into v_empreinte from jsonb_array_elements(v_lignes) as e;

  return jsonb_build_object(
    'lignes', v_lignes, 'physique', v_physique, 'kit', v_kit, 'sur_mesure', v_sur_mesure,
    'sous_total_cents', v_sous_total, 'forfait_cents', v_forfait, 'reduction_cents', v_reduction, 'total_cents', v_sous_total - v_reduction + v_forfait,
    'code', v_code,
    'indisponible', v_indisponible, 'remise_manquante', v_remise_manquante, 'empreinte', v_empreinte
  );
end;
$$;

-- Récapitulatif du Panier, avec le code saisi s'il y en a un : un code refusé est rendu dans « code » (valide = false), jamais en erreur. Aucune écriture.
create function public.recapitulatif_commande(p_compte uuid, p_panier uuid, p_zone text, p_mode text, p_code text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.panier where id = p_panier and compte_id = p_compte) then
    raise exception 'KS_PANIER_INTROUVABLE' using errcode = 'P0001';
  end if;
  return public.commande_calculer(p_compte, p_panier, p_zone, p_mode, false, p_code, null);
end;
$$;

create function public.creer_commande(
  p_auteur jsonb, p_panier uuid, p_zone text, p_mode text, p_telephone text, p_adresse text,
  p_acceptations jsonb, p_origine text, p_total_attendu_cents integer, p_empreinte text, p_cle_idempotence text, p_code text default null
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
  v_ligne_id uuid;
  v_numero text;
  v_delai_txt text;
  v_expire timestamptz;
  v_telephone text;
  v_adresse text;
  v_requis text[] := array['cgv'];
  v_objet text;
  v_version text;
  v_acceptees jsonb := '[]'::jsonb;
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

  -- Deux envois simultanés du même Compte s'attendent : le second voit la Commande du premier.
  perform pg_advisory_xact_lock(hashtextextended('commande:' || v_compte::text, 0));

  select id, numero, expire_le into v_existante from public.commande where compte_id = v_compte and cle_idempotence = p_cle_idempotence;
  if found then
    return jsonb_build_object('commande_id', v_existante.id, 'numero', v_existante.numero, 'expire_le', v_existante.expire_le, 'rejeu', true);
  end if;

  -- Une seule Commande en attente (ou échouée, encore payable) par Compte : pas de stock ni de Plafond monopolisés par des Commandes jamais payées.
  if exists (select 1 from public.commande where compte_id = v_compte and statut in ('en_attente', 'echouee') and expire_le > now()) then
    raise exception 'KS_COMMANDE_EN_ATTENTE' using errcode = 'P0001';
  end if;

  -- Code promo : la ligne du code est verrouillée avant de compter ses utilisations, pour que deux Commandes simultanées ne passent pas ensemble sous le même plafond.
  if p_code is not null and btrim(p_code) <> '' then
    perform 1 from public.code_promo where code = upper(btrim(p_code)) for update;
  end if;

  perform 1 from public.panier where id = p_panier and compte_id = v_compte for update;
  if not found then
    raise exception 'KS_PANIER_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Les variantes du Panier sont verrouillées dans un ordre fixe : deux Commandes ne se partagent pas la dernière pièce.
  perform 1 from public.variante where id in (select variante_id from public.ligne_panier where panier_id = p_panier and variante_id is not null) order by id for update;

  -- Le Plafond de fabrication se compte pour toute la boutique : deux Commandes simultanées ne se partagent pas la dernière place.
  perform pg_advisory_xact_lock(hashtextextended('plafond_fabrication', 0));

  v_calcul := public.commande_calculer(v_compte, p_panier, p_zone, p_mode, true, p_code, null);

  -- Téléphone et adresse : seulement pour un Panier avec produit physique.
  if (v_calcul ->> 'physique')::boolean then
    v_telephone := regexp_replace(coalesce(p_telephone, ''), '\s', '', 'g');
    if v_telephone !~ '^\+?[0-9]{8,15}$' then
      raise exception 'KS_TELEPHONE_INVALIDE' using errcode = 'P0001';
    end if;
    if p_mode = 'livraison' then
      v_adresse := btrim(coalesce(p_adresse, ''));
      if char_length(v_adresse) < 1 or char_length(v_adresse) > 500 then
        raise exception 'KS_ADRESSE_MANQUANTE' using errcode = 'P0001';
      end if;
    end if;
  end if;

  -- Acceptations exigées par le contenu (AD-34).
  if (v_calcul ->> 'kit')::boolean then v_requis := v_requis || 'kit_acces_immediat'::text; end if;
  if (v_calcul ->> 'sur_mesure')::boolean then v_requis := v_requis || 'sur_mesure'::text; end if;
  if p_acceptations is null or jsonb_typeof(p_acceptations) <> 'array' then
    raise exception 'KS_ACCEPTATION_MANQUANTE' using errcode = 'P0001';
  end if;
  foreach v_objet in array v_requis loop
    select e ->> 'version' into v_version
    from jsonb_array_elements(p_acceptations) as e
    where jsonb_typeof(e) = 'object' and e ->> 'objet' = v_objet and length(coalesce(e ->> 'version', '')) between 1 and 50
    limit 1;
    if v_version is null then
      raise exception 'KS_ACCEPTATION_MANQUANTE' using errcode = 'P0001';
    end if;
    v_acceptees := v_acceptees || jsonb_build_object('objet', v_objet, 'version', v_version, 'accepte_le', now());
  end loop;

  -- Le total relu en base doit être celui que le client a vu.
  if p_total_attendu_cents is distinct from (v_calcul ->> 'total_cents')::integer then
    raise exception 'KS_TOTAL_CHANGE' using errcode = 'P0001';
  end if;
  if p_empreinte is distinct from (v_calcul ->> 'empreinte') then
    raise exception 'KS_RECAP_CHANGE' using errcode = 'P0001';
  end if;

  select valeur into v_delai_txt from public.reglage where cle = 'delai_paiement';
  if v_delai_txt is null or v_delai_txt !~ '^[0-9]{1,4}$' then
    raise exception 'KS_REGLAGE_MANQUANT' using errcode = 'P0001';
  end if;
  v_expire := now() + (v_delai_txt::integer * interval '1 minute');

  perform set_config('ks.auteur', p_auteur::text, true);

  -- Le taux de réduction et le taux de commission du code sont lus ici et figés avec la Commande : une modification ultérieure du code ne les change jamais (AD-8).
  v_origine := p_origine;
  if (v_calcul -> 'code') is not null and jsonb_typeof(v_calcul -> 'code') = 'object' then
    select id, code, reduction_pct, commission_pct into v_code from public.code_promo where id = (v_calcul -> 'code' ->> 'id')::uuid;
    v_a_code := true;
    -- L'origine de la vente enregistre le Code promo (AD-19) : le code l'emporte sur l'origine transmise par le formulaire.
    v_origine := 'code_' || lower(v_code.code);
  end if;

  insert into public.commande (
    compte_id, type, statut, sous_total_cents, forfait_cents, total_cents, acceptations, cle_idempotence,
    origine, expire_le, zone, mode_remise, telephone, adresse
  ) values (
    v_compte, 'produits', 'en_attente', (v_calcul ->> 'sous_total_cents')::integer, (v_calcul ->> 'forfait_cents')::integer,
    (v_calcul ->> 'total_cents')::integer, v_acceptees, p_cle_idempotence,
    v_origine, v_expire, case when (v_calcul ->> 'physique')::boolean then p_zone end,
    case when (v_calcul ->> 'physique')::boolean then p_mode end, v_telephone, v_adresse
  ) returning id, numero into v_id, v_numero;

  if v_a_code then
    insert into public.commande_code_promo (commande_id, code_promo_id, code, reduction_pct, commission_pct, reduction_cents)
    values (v_id, v_code.id, v_code.code, v_code.reduction_pct, v_code.commission_pct, (v_calcul ->> 'reduction_cents')::integer);
  end if;

  for v_ligne in select * from jsonb_array_elements(v_calcul -> 'lignes') loop
    insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents, reduction_cents, variante_id, origine, delai_fabrication_jours)
    values (
      v_id, (v_ligne ->> 'produit_id')::uuid, (v_ligne ->> 'nombre')::smallint, (v_ligne ->> 'prix_cents')::integer,
      coalesce((v_ligne ->> 'reduction_cents')::integer, 0),
      nullif(v_ligne ->> 'variante_id', '')::uuid, v_ligne ->> 'origine', nullif(v_ligne ->> 'delai_fabrication_jours', '')::integer
    ) returning id into v_ligne_id;
    if v_ligne ->> 'variante_id' is not null then
      insert into public.reservation (commande_id, ligne_id, variante_id, nombre, origine, expire_le)
      values (v_id, v_ligne_id, (v_ligne ->> 'variante_id')::uuid, (v_ligne ->> 'nombre')::smallint, v_ligne ->> 'origine', v_expire);
    end if;
  end loop;

  return jsonb_build_object('commande_id', v_id, 'numero', v_numero, 'expire_le', v_expire, 'rejeu', false);
end;
$$;

revoke all on function public.utilisations_code_promo(uuid) from public, anon, authenticated;
revoke all on function public.a_deja_achete(uuid, uuid) from public, anon, authenticated;
revoke all on function public.code_promo_evaluer(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.commande_calculer(uuid, uuid, text, text, boolean, text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.recapitulatif_commande(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.creer_commande(jsonb, uuid, text, text, text, text, jsonb, text, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.utilisations_code_promo(uuid) to service_role;
grant execute on function public.a_deja_achete(uuid, uuid) to service_role;
grant execute on function public.recapitulatif_commande(uuid, uuid, text, text, text) to service_role;
grant execute on function public.creer_commande(jsonb, uuid, text, text, text, text, jsonb, text, integer, text, text, text) to service_role;
