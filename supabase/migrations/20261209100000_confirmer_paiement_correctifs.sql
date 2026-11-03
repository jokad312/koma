-- Story 4.8 (correctifs de revue, après 20261207100000 qui n'est pas modifiée). confirmer_paiement est réécrite :
--  - la référence de transaction du Prestataire est exigée, posée si la Tentative n'en avait pas, et refusée si elle diffère de celle déjà connue
--    (règle 2 : chaque Commande enregistre la référence ; anomalie « notification_invalide » sinon) ;
--  - un succès vérifié sur une Tentative « echouee » n'est plus ignoré en silence : il suit le même chemin qu'une Tentative abandonnée ;
--  - le décompte de stock ne peut plus faire échouer le paiement (verrou ordonné des variantes, plancher à zéro, anomalie « stock_insuffisant ») ;
--  - le Panier n'est vidé que des lignes de la Commande payée (pas des articles ajoutés depuis) ;
--  - l'auteur vide est refusé ; une Commande de type « pass » n'est jamais livrée par ce chemin.
alter type public.anomalie_type add value if not exists 'stock_insuffisant';

drop function public.confirmer_paiement(jsonb, uuid, text, numeric, text);

create function public.confirmer_paiement(
  p_auteur jsonb, p_tentative uuid, p_comparaison text, p_montant_recu numeric, p_devise_recue text, p_reference_transaction text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t record;
  v_c record;
  v_motif text;
  v_physique boolean;
  v_ligne record;
  v_nouveaux integer := 0;
  v_manque integer;
begin
  if p_comparaison is null or p_comparaison not in ('egal', 'inferieur', 'superieur') then
    raise exception 'KS_COMPARAISON_INVALIDE' using errcode = 'P0001';
  end if;
  if p_montant_recu is null or p_montant_recu < 0 or p_devise_recue is null or p_devise_recue !~ '^[A-Z]{3}$' then
    raise exception 'KS_MONTANT_INVALIDE' using errcode = 'P0001';
  end if;
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' or coalesce(p_auteur ->> 'type', '') not in ('systeme', 'cron') then
    raise exception 'KS_AUTEUR_INVALIDE' using errcode = 'P0001';
  end if;
  if p_reference_transaction is not null and char_length(p_reference_transaction) not between 1 and 120 then
    raise exception 'KS_REFERENCE_INVALIDE' using errcode = 'P0001';
  end if;

  select * into v_t from public.tentative_paiement where id = p_tentative for update;
  if not found then
    raise exception 'KS_TENTATIVE_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Rejeu : une Tentative déjà réussie n'a plus aucun effet.
  if v_t.statut = 'reussie' then
    return jsonb_build_object('resultat', 'deja_traite');
  end if;

  select * into v_c from public.commande where id = v_t.commande_id for update;
  perform set_config('ks.auteur', p_auteur::text, true);

  -- Référence du Prestataire : celle de la notification doit être celle de la Tentative ; sans aucune référence, rien n'est validé.
  if p_reference_transaction is not null and v_t.reference_transaction is not null and p_reference_transaction <> v_t.reference_transaction then
    insert into public.anomalie (type, gravite, cible_type, cible_id, details)
    values ('notification_invalide', 'critique', 'tentative', v_t.id, jsonb_build_object('motif', 'reference_differente', 'commande_id', v_c.id))
    on conflict do nothing;
    return jsonb_build_object('resultat', 'reference_incoherente');
  end if;
  if coalesce(p_reference_transaction, v_t.reference_transaction) is null then
    insert into public.anomalie (type, gravite, cible_type, cible_id, details)
    values ('notification_invalide', 'critique', 'tentative', v_t.id, jsonb_build_object('motif', 'reference_absente', 'commande_id', v_c.id))
    on conflict do nothing;
    return jsonb_build_object('resultat', 'reference_incoherente');
  end if;
  if v_t.reference_transaction is null then
    begin
      update public.tentative_paiement set reference_transaction = p_reference_transaction where id = v_t.id;
    exception when unique_violation then
      insert into public.anomalie (type, gravite, cible_type, cible_id, details)
      values ('notification_invalide', 'critique', 'tentative', v_t.id, jsonb_build_object('motif', 'reference_deja_utilisee', 'commande_id', v_c.id))
      on conflict do nothing;
      return jsonb_build_object('resultat', 'reference_incoherente');
    end;
    v_t.reference_transaction := p_reference_transaction;
  end if;

  update public.tentative_paiement
    set statut = 'reussie', cause = null, montant_recu = p_montant_recu, devise_recue = p_devise_recue, modifie_le = now()
  where id = v_t.id;

  -- Commande qui ne peut plus être honorée (déjà payée, expirée, annulée, réservations libérées) : trop-perçu, quel que soit le montant.
  if v_c.statut not in ('en_attente', 'echouee') or v_c.expire_le is null or v_c.expire_le <= now() then
    v_motif := case
      when v_c.statut in ('payee', 'en_fabrication', 'expediee', 'livree') then 'deja_payee'
      when v_c.statut = 'expiree' then 'expiree'
      when v_c.statut in ('annulee', 'remboursee') then 'annulee'
      else 'reservations_liberees'
    end;
    insert into public.trop_percu (commande_id, tentative_id, motif, montant_attendu_cents, montant_recu, devise_recue)
    values (v_c.id, v_t.id, v_motif, v_t.montant_attendu_cents, p_montant_recu, p_devise_recue)
    on conflict (tentative_id) do nothing;
    return jsonb_build_object('resultat', 'trop_percu', 'motif', v_motif);
  end if;

  if p_comparaison = 'inferieur' then
    insert into public.anomalie (type, gravite, cible_type, cible_id, details)
    values ('montant_insuffisant', 'critique', 'tentative', v_t.id,
      jsonb_build_object('montant_attendu_cents', v_t.montant_attendu_cents, 'montant_recu', p_montant_recu, 'devise_recue', p_devise_recue, 'commande_id', v_c.id))
    on conflict do nothing;
    return jsonb_build_object('resultat', 'montant_insuffisant');
  end if;

  if p_comparaison = 'superieur' then
    insert into public.trop_percu (commande_id, tentative_id, motif, montant_attendu_cents, montant_recu, devise_recue)
    values (v_c.id, v_t.id, 'montant_superieur', v_t.montant_attendu_cents, p_montant_recu, p_devise_recue)
    on conflict (tentative_id) do nothing;
    return jsonb_build_object('resultat', 'trop_percu', 'motif', 'montant_superieur');
  end if;

  -- Montant égal, Commande honorable (réservations actives) : stock, Plafond et Code promo ne sont pas revérifiés (AD-26, AD-29).
  select exists (
    select 1 from public.ligne_commande l join public.produit p on p.id = l.produit_id where l.commande_id = v_c.id and p.famille <> 'kit'
  ) into v_physique;

  update public.commande
    set statut = 'payee', prestataire = v_t.prestataire, reference_transaction = v_t.reference_transaction, paye_le = now(), mis_a_jour_le = now()
  where id = v_c.id;

  -- Stock des lignes d'origine « stock » : variantes verrouillées dans un ordre fixe, plancher à zéro (un stock baissé à la main depuis la
  -- réservation ne doit jamais empêcher d'enregistrer un paiement déjà encaissé : anomalie à la place).
  perform 1 from public.variante
  where id in (select variante_id from public.ligne_commande where commande_id = v_c.id and origine = 'stock')
  order by id for update;
  select coalesce(sum(greatest(s.total - v.stock, 0)), 0)::integer into v_manque
  from (
    select variante_id, sum(nombre)::integer as total from public.ligne_commande where commande_id = v_c.id and origine = 'stock' group by variante_id
  ) s join public.variante v on v.id = s.variante_id;
  update public.variante v
    set stock = greatest(v.stock - s.total, 0)
  from (
    select variante_id, sum(nombre)::integer as total from public.ligne_commande where commande_id = v_c.id and origine = 'stock' group by variante_id
  ) s
  where v.id = s.variante_id;
  if v_manque > 0 then
    insert into public.anomalie (type, gravite, cible_type, cible_id, details)
    values ('stock_insuffisant', 'critique', 'commande', v_c.id, jsonb_build_object('pieces_manquantes', v_manque))
    on conflict do nothing;
  end if;

  update public.reservation set liberee_le = now() where commande_id = v_c.id and liberee_le is null;

  -- Kits : accès ouvert aussitôt (AD-11). Un Kit déjà possédé ne bloque pas le paiement : anomalie.
  for v_ligne in
    select l.produit_id from public.ligne_commande l join public.produit p on p.id = l.produit_id
    where l.commande_id = v_c.id and p.famille = 'kit'
  loop
    if public.bibliotheque_ouvrir_acces(v_c.compte_id, v_ligne.produit_id, v_c.id) then
      v_nouveaux := v_nouveaux + 1;
      perform public.envois_planifier('kit_ouvert', v_c.compte_id, jsonb_build_object('commande_id', v_c.id, 'produit_id', v_ligne.produit_id),
        'kit_ouvert:' || v_c.id::text || ':' || v_ligne.produit_id::text);
    else
      insert into public.anomalie (type, gravite, cible_type, cible_id, details)
      values ('kit_deja_possede', 'attention', 'commande', v_c.id, jsonb_build_object('produit_id', v_ligne.produit_id))
      on conflict do nothing;
    end if;
  end loop;

  if v_physique then
    perform public.envois_planifier('commande_payee', v_c.compte_id, jsonb_build_object('commande_id', v_c.id), 'commande_payee:' || v_c.id::text);
  elsif v_c.type = 'produits' then
    -- Commande 100 % numérique : payee puis livree dans la même transaction (deux lignes de journal). Une Commande de Pass reste payee
    -- (l'émission des Pass vient avec l'epic 7).
    update public.commande set statut = 'livree', mis_a_jour_le = now() where id = v_c.id and statut = 'payee';
  end if;

  -- Le Panier n'est vidé que des lignes de cette Commande : un article ajouté pendant l'attente du paiement reste.
  delete from public.ligne_panier lp
  using public.panier p
  where lp.panier_id = p.id and p.compte_id = v_c.compte_id
    and exists (
      select 1 from public.ligne_commande l
      where l.commande_id = v_c.id and l.produit_id = lp.produit_id and l.variante_id is not distinct from lp.variante_id
    );

  return jsonb_build_object('resultat', 'payee', 'kits_ouverts', v_nouveaux);
end;
$$;

revoke all on function public.confirmer_paiement(jsonb, uuid, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.confirmer_paiement(jsonb, uuid, text, numeric, text, text) to service_role;
