-- Story 4.3 (2/2) : Récapitulatif et création de la Commande en attente (AD-8, AD-15, AD-26, AD-34).
-- Prix, stock, Forfait de livraison, délais et Plafond sont relus en base (règle 3). Le Panier n'est pas vidé (il l'est par confirmer_paiement).

-- Calcul commun au Récapitulatif (p_strict faux : les lignes indisponibles sont signalées) et à la création (p_strict vrai : elles sont refusées).
-- Interne : appelée par recapitulatif_commande et creer_commande, aucun rôle ne l'exécute.
create function public.commande_calculer(p_compte uuid, p_panier uuid, p_zone text, p_mode text, p_strict boolean)
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
           where c.compte_id = p_compte and c.statut = 'en_attente' and c.expire_le > now() and lc.produit_id = v_ligne.produit_id
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

  return jsonb_build_object(
    'lignes', v_lignes, 'physique', v_physique, 'kit', v_kit, 'sur_mesure', v_sur_mesure,
    'sous_total_cents', v_sous_total, 'forfait_cents', v_forfait, 'total_cents', v_sous_total + v_forfait,
    'indisponible', v_indisponible, 'remise_manquante', v_remise_manquante
  );
end;
$$;

-- Récapitulatif du Panier d'un Compte, calculé par le serveur à chaque affichage (FR-14, UX-DR32). Aucune écriture.
create function public.recapitulatif_commande(p_compte uuid, p_panier uuid, p_zone text, p_mode text)
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
  return public.commande_calculer(p_compte, p_panier, p_zone, p_mode, false);
end;
$$;

-- Crée la Commande « en_attente » : relit et fige prix, sous-total, Forfait, total, délai annoncé, origine de chaque ligne physique et échéance ;
-- crée une réservation par ligne physique ; enregistre les acceptations avec la version des textes et l'heure (AD-34).
-- p_total_attendu_cents : total affiché au client ; s'il diffère du total relu en base, KS_TOTAL_CHANGE et rien n'est créé.
-- p_acceptations : tableau [{objet, version}] ; « cgv » toujours, « kit_acces_immediat » avec un Kit, « sur_mesure » avec une ligne sur mesure.
create function public.creer_commande(
  p_auteur jsonb, p_panier uuid, p_zone text, p_mode text, p_telephone text, p_adresse text,
  p_acceptations jsonb, p_origine text, p_total_attendu_cents integer, p_cle_idempotence text
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

  perform 1 from public.panier where id = p_panier and compte_id = v_compte for update;
  if not found then
    raise exception 'KS_PANIER_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Les variantes du Panier sont verrouillées dans un ordre fixe : deux Commandes ne se partagent pas la dernière pièce.
  perform 1 from public.variante where id in (select variante_id from public.ligne_panier where panier_id = p_panier and variante_id is not null) order by id for update;

  v_calcul := public.commande_calculer(v_compte, p_panier, p_zone, p_mode, true);

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

  select valeur into v_delai_txt from public.reglage where cle = 'delai_paiement';
  if v_delai_txt is null or v_delai_txt !~ '^[0-9]{1,4}$' then
    raise exception 'KS_REGLAGE_MANQUANT' using errcode = 'P0001';
  end if;
  v_expire := now() + (v_delai_txt::integer * interval '1 minute');

  perform set_config('ks.auteur', p_auteur::text, true);

  insert into public.commande (
    compte_id, type, statut, sous_total_cents, forfait_cents, total_cents, acceptations, cle_idempotence,
    origine, expire_le, zone, mode_remise, telephone, adresse
  ) values (
    v_compte, 'produits', 'en_attente', (v_calcul ->> 'sous_total_cents')::integer, (v_calcul ->> 'forfait_cents')::integer,
    (v_calcul ->> 'total_cents')::integer, v_acceptees, p_cle_idempotence,
    p_origine, v_expire, case when (v_calcul ->> 'physique')::boolean then p_zone end,
    case when (v_calcul ->> 'physique')::boolean then p_mode end, v_telephone, v_adresse
  ) returning id, numero into v_id, v_numero;

  for v_ligne in select * from jsonb_array_elements(v_calcul -> 'lignes') loop
    insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents, variante_id, origine, delai_fabrication_jours)
    values (
      v_id, (v_ligne ->> 'produit_id')::uuid, (v_ligne ->> 'nombre')::smallint, (v_ligne ->> 'prix_cents')::integer,
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

revoke all on function public.commande_calculer(uuid, uuid, text, text, boolean) from public, anon, authenticated, service_role;
revoke all on function public.recapitulatif_commande(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.creer_commande(jsonb, uuid, text, text, text, text, jsonb, text, integer, text) from public, anon, authenticated;
grant execute on function public.recapitulatif_commande(uuid, uuid, text, text) to service_role;
grant execute on function public.creer_commande(jsonb, uuid, text, text, text, text, jsonb, text, integer, text) to service_role;
