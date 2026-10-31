-- Story 3.5, CI : le garde de stock (stock_non_expose) interdit toute colonne « quantite » lisible par un client.
-- La colonne de ligne_commande devient « nombre » (nombre d'exemplaires commandés) ; offrir_commande suit.

alter table public.ligne_commande rename column quantite to nombre;
alter table public.ligne_commande rename constraint ligne_commande_quantite_check to ligne_commande_nombre_check;

create or replace function public.offrir_commande(p_auteur jsonb, p_produit uuid, p_acceptations jsonb, p_cle_idempotence text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_produit record;
  v_version text;
  v_commande record;
  v_id uuid;
begin
  v_compte := public.exiger_client(p_auteur);

  if p_cle_idempotence is null or length(p_cle_idempotence) not between 8 and 100 then
    raise exception 'KS_CLE_IDEMPOTENCE_INVALIDE' using errcode = 'P0001';
  end if;

  -- Deux envois simultanés du même Compte pour le même Kit s'attendent : le second voit le résultat du premier.
  perform pg_advisory_xact_lock(hashtextextended(v_compte::text || ':cle:' || p_cle_idempotence, 0));
  perform pg_advisory_xact_lock(hashtextextended(v_compte::text || ':' || coalesce(p_produit::text, ''), 0));

  -- Rejeu : la même clé renvoie la même Commande, sans nouvel effet.
  select id, numero into v_commande from public.commande where compte_id = v_compte and cle_idempotence = p_cle_idempotence;
  if found then
    if not exists (select 1 from public.ligne_commande where commande_id = v_commande.id and produit_id = p_produit) then
      raise exception 'KS_CLE_IDEMPOTENCE_INVALIDE' using errcode = 'P0001';
    end if;
    return jsonb_build_object('commande_id', v_commande.id, 'numero', v_commande.numero, 'rejeu', true);
  end if;

  select id, famille, prix_cents, publie_le into v_produit from public.produit where id = p_produit;
  if not found or v_produit.famille <> 'kit' or v_produit.publie_le is null or v_produit.publie_le > now() then
    raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Seul le Kit à 0 USD s'obtient sans paiement (FR-58).
  if v_produit.prix_cents is distinct from 0 then
    raise exception 'KS_KIT_NON_GRATUIT' using errcode = 'P0001';
  end if;

  if p_acceptations is null or jsonb_typeof(p_acceptations) <> 'array' then
    raise exception 'KS_ACCEPTATION_MANQUANTE' using errcode = 'P0001';
  end if;
  select e ->> 'version' into v_version
  from jsonb_array_elements(p_acceptations) as e
  where jsonb_typeof(e) = 'object' and e ->> 'objet' = 'licence_kit' and length(coalesce(e ->> 'version', '')) between 1 and 50
  limit 1;
  if v_version is null then
    raise exception 'KS_ACCEPTATION_MANQUANTE' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.acces_kit where compte_id = v_compte and produit_id = p_produit) then
    raise exception 'KS_KIT_DEJA_POSSEDE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);

  insert into public.commande (compte_id, type, statut, offerte, sous_total_cents, total_cents, acceptations, cle_idempotence)
  values (
    v_compte, 'produits', 'offerte', true, 0, 0,
    jsonb_build_array(jsonb_build_object('objet', 'licence_kit', 'version', v_version, 'accepte_le', now())),
    p_cle_idempotence
  )
  returning id into v_id;

  insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents) values (v_id, p_produit, 1, 0);

  update public.commande set statut = 'livree', mis_a_jour_le = now() where id = v_id and statut = 'offerte';

  perform public.bibliotheque_ouvrir_acces(v_compte, p_produit, v_id);

  select numero into v_commande from public.commande where id = v_id;
  return jsonb_build_object('commande_id', v_id, 'numero', v_commande.numero, 'rejeu', false);
end;
$$;
