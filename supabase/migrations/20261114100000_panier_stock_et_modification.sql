-- Story 4.1, correctifs de revue : la quantité d'une ligne ne dépasse jamais le stock d'une taille qui n'est pas fabriquée sur commande
-- (règle 3), et modifier_ligne_panier refuse une ligne dont le produit n'est plus disponible. Corps repris de 20261113100000 ; droits inchangés.

create or replace function public.ajouter_au_panier(p_auteur jsonb, p_panier uuid, p_compte uuid, p_produit uuid, p_taille text, p_nombre integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produit record;
  v_variante record;
  v_ligne record;
  v_etat text;
  v_total integer;
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;

  perform 1 from public.panier where id = p_panier for update;
  if not found then
    raise exception 'KS_PANIER_INTROUVABLE' using errcode = 'P0001';
  end if;

  select famille, prix_cents, publie_le into v_produit from public.produit where id = p_produit;
  if not found or v_produit.publie_le is null or v_produit.publie_le > now() or v_produit.prix_cents is null then
    raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Le Kit gratuit, seul Produit à 0 USD, ne s'obtient que par offrir_commande (AD-15).
  if v_produit.prix_cents = 0 then
    raise exception 'KS_PRODUIT_GRATUIT' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);

  if v_produit.famille = 'kit' then
    if p_taille is not null then
      raise exception 'KS_VARIANTE_INVALIDE' using errcode = 'P0001';
    end if;
    if p_compte is not null and exists (select 1 from public.acces_kit where compte_id = p_compte and produit_id = p_produit) then
      raise exception 'KS_KIT_DEJA_POSSEDE' using errcode = 'P0001';
    end if;
    insert into public.ligne_panier (panier_id, produit_id, variante_id, nombre) values (p_panier, p_produit, null, 1)
    on conflict do nothing;
    select id, nombre into v_ligne from public.ligne_panier where panier_id = p_panier and produit_id = p_produit and variante_id is null;
  else
    if p_nombre is null or p_nombre not between 1 and 10 then
      raise exception 'KS_QUANTITE_INVALIDE' using errcode = 'P0001';
    end if;
    select id, stock, fabrication_sur_commande into v_variante from public.variante where produit_id = p_produit and taille = p_taille;
    if not found then
      raise exception 'KS_VARIANTE_INTROUVABLE' using errcode = 'P0001';
    end if;
    v_etat := public.etat_disponibilite(public.stock_disponible(v_variante.id), v_variante.fabrication_sur_commande, coalesce(public.capacite_fabrication_atteinte(), false));
    if v_etat in ('complet', 'epuise') then
      raise exception 'KS_INDISPONIBLE' using errcode = 'P0001';
    end if;
    select id, nombre into v_ligne from public.ligne_panier where panier_id = p_panier and produit_id = p_produit and variante_id = v_variante.id;
    v_total := coalesce(v_ligne.nombre, 0) + p_nombre;
    if v_total > 10 then
      raise exception 'KS_QUANTITE_INVALIDE' using errcode = 'P0001';
    end if;
    -- Une taille qui n'est pas fabriquée sur commande ne se commande pas au-delà de son stock.
    if not v_variante.fabrication_sur_commande and public.stock_disponible(v_variante.id) < v_total then
      raise exception 'KS_INDISPONIBLE' using errcode = 'P0001';
    end if;
    if v_ligne.id is not null then
      update public.ligne_panier set nombre = v_total where id = v_ligne.id;
      v_ligne.nombre := v_total;
    else
      insert into public.ligne_panier (panier_id, produit_id, variante_id, nombre) values (p_panier, p_produit, v_variante.id, p_nombre)
      returning id, nombre into v_ligne;
    end if;
  end if;

  update public.panier set mis_a_jour_le = now() where id = p_panier;
  return jsonb_build_object('ligne_id', v_ligne.id, 'nombre', v_ligne.nombre);
end;
$$;

create or replace function public.modifier_ligne_panier(p_auteur jsonb, p_panier uuid, p_ligne uuid, p_nombre integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ligne record;
  v_variante record;
  v_etat text;
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  perform 1 from public.panier where id = p_panier for update;
  if not found then
    raise exception 'KS_PANIER_INTROUVABLE' using errcode = 'P0001';
  end if;
  select l.id, l.variante_id, p.publie_le, p.prix_cents into v_ligne
  from public.ligne_panier l join public.produit p on p.id = l.produit_id
  where l.id = p_ligne and l.panier_id = p_panier;
  if not found then
    raise exception 'KS_LIGNE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_ligne.variante_id is null then
    raise exception 'KS_LIGNE_UNIQUE' using errcode = 'P0001';
  end if;
  if p_nombre is null or p_nombre not between 1 and 10 then
    raise exception 'KS_QUANTITE_INVALIDE' using errcode = 'P0001';
  end if;
  select stock, fabrication_sur_commande into v_variante from public.variante where id = v_ligne.variante_id;
  v_etat := public.etat_disponibilite(public.stock_disponible(v_ligne.variante_id), v_variante.fabrication_sur_commande, coalesce(public.capacite_fabrication_atteinte(), false));
  if v_ligne.publie_le is null or v_ligne.publie_le > now() or v_ligne.prix_cents is null or v_etat in ('complet', 'epuise') then
    raise exception 'KS_INDISPONIBLE' using errcode = 'P0001';
  end if;
  if not v_variante.fabrication_sur_commande and public.stock_disponible(v_ligne.variante_id) < p_nombre then
    raise exception 'KS_INDISPONIBLE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.ligne_panier set nombre = p_nombre where id = p_ligne;
  update public.panier set mis_a_jour_le = now() where id = p_panier;
end;
$$;
