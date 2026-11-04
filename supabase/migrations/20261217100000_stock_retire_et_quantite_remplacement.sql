-- Epic 6, decisions de Jonathan (2026-11-04) apres la revue croisee :
-- 1. Stock a l'annulation : la quantite reellement retiree du stock au paiement est enregistree par ligne (ligne_commande.stock_retire) ; l'annulation rend
--    exactement cette quantite, jamais plus. Quantite inconnue (anciennes donnees) : rien n'est rendu automatiquement, la Commande est marquee
--    « stock a verifier » (tache admin « Verifier le stock », liee a la Commande, fermee par marquer_stock_verifie).
-- 2. Remplacement : l'admin choisit la quantite remplacee (1 a la quantite de la ligne, ligne entiere par defaut) ; seule cette quantite est decomptee.
-- Les migrations deja appliquees ne sont pas modifiees.

alter table public.ligne_commande
  add column stock_retire integer check (stock_retire is null or stock_retire >= 0),
  add constraint ligne_commande_stock_retire_borne check (stock_retire is null or stock_retire <= nombre);
comment on column public.ligne_commande.stock_retire is 'Pieces reellement retirees du stock au paiement (ligne d origine stock). Nul : inconnu (paiement anterieur a cette colonne) ou ligne sans stock.';
alter table public.commande add column stock_a_verifier boolean not null default false;
alter table public.demande_client add column quantite_remplacee integer check (quantite_remplacee is null or quantite_remplacee >= 1);

-- confirmer_paiement : meme corps que 20261209100000, mais le stock est retire ligne par ligne et la quantite retiree est enregistree.
create or replace function public.confirmer_paiement(
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
  v_manque integer := 0;
  v_l record;
  v_dispo integer;
  v_retire integer;
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
  -- Quantite reellement retiree du stock, ligne par ligne (ligne_commande.stock_retire) : l'annulation rendra exactement cette quantite.
  for v_l in
    select l.id, l.variante_id, l.nombre from public.ligne_commande l where l.commande_id = v_c.id and l.origine = 'stock' order by l.variante_id, l.id
  loop
    select v.stock into v_dispo from public.variante v where v.id = v_l.variante_id;
    v_retire := least(v_l.nombre, greatest(coalesce(v_dispo, 0), 0));
    update public.variante set stock = stock - v_retire where id = v_l.variante_id;
    update public.ligne_commande set stock_retire = v_retire where id = v_l.id;
    v_manque := v_manque + (v_l.nombre - v_retire);
  end loop;
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


-- annuler_commande : stock rendu = somme des quantites reellement retirees (stock_retire) ; une ligne d'origine stock dont la quantite est inconnue ne rend
-- rien et marque la Commande « stock a verifier ».
create or replace function public.annuler_commande(p_auteur jsonb, p_commande uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.commande;
  v_montant integer;
  v_inconnu integer;
begin
  perform public.exiger_admin(p_auteur);
  select * into v_c from public.commande where id = p_commande for update;
  if not found then
    raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_c.statut <> 'payee' or v_c.offerte
     or not exists (select 1 from public.ligne_commande l join public.produit p on p.id = l.produit_id where l.commande_id = v_c.id and p.famille = 'cosplay') then
    raise exception 'KS_ANNULATION_IMPOSSIBLE' using errcode = 'P0001';
  end if;
  select coalesce(sum(l.prix_cents * l.nombre - l.reduction_cents), 0)::integer + v_c.forfait_cents into v_montant
    from public.ligne_commande l where l.commande_id = v_c.id and l.variante_id is not null;
  v_montant := least(greatest(v_montant, 0), v_c.total_cents);
  if v_montant <= 0 then
    raise exception 'KS_REMBOURSEMENT_NUL' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);

  perform 1 from public.variante
    where id in (select variante_id from public.ligne_commande where commande_id = v_c.id and variante_id is not null and origine = 'stock')
    order by id for update;
  select count(*)::integer into v_inconnu
    from public.ligne_commande l where l.commande_id = v_c.id and l.variante_id is not null and l.origine = 'stock' and l.stock_retire is null;
  update public.variante v set stock = v.stock + s.total
    from (select l.variante_id, sum(l.stock_retire)::integer as total from public.ligne_commande l
          where l.commande_id = v_c.id and l.variante_id is not null and l.origine = 'stock' and l.stock_retire is not null group by l.variante_id) s
    where v.id = s.variante_id;

  update public.ligne_commande set annulee = true where commande_id = v_c.id and variante_id is not null;
  update public.commande set statut = 'annulee', stock_a_verifier = (v_inconnu > 0), mis_a_jour_le = now() where id = v_c.id;
  update public.demande_client set statut = 'acceptee', traitee_le = now()
    where commande_id = v_c.id and type = 'annulation_commande' and statut = 'ouverte';
  insert into public.remboursement (cible_type, cible_id, montant_cents, devise) values ('commande', v_c.id, v_montant, v_c.devise);
  perform public.envois_planifier('commande_annulee', v_c.compte_id, jsonb_build_object('commande_id', v_c.id), 'commande_annulee:' || v_c.id::text);
  return v_montant;
end;
$$;
revoke all on function public.annuler_commande(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.annuler_commande(jsonb, uuid) to service_role;

-- Tache « Verifier le stock » : fermee par l'admin une fois le stock verifie a la main.
create function public.marquer_stock_verifie(p_auteur jsonb, p_commande uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.commande;
begin
  perform public.exiger_admin(p_auteur);
  select * into v_c from public.commande where id = p_commande for update;
  if not found then
    raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if not v_c.stock_a_verifier then
    raise exception 'KS_STOCK_DEJA_VERIFIE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.commande set stock_a_verifier = false, mis_a_jour_le = now() where id = v_c.id;
end;
$$;
revoke all on function public.marquer_stock_verifie(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.marquer_stock_verifie(jsonb, uuid) to service_role;

-- traiter_reclamation : quantite remplacee (entier de 1 a la quantite de la ligne ; ligne entiere par defaut), enregistree et seule decomptee du stock.
drop function public.traiter_reclamation(jsonb, uuid, text, boolean);
create function public.traiter_reclamation(p_auteur jsonb, p_demande uuid, p_etape text, p_depuis_stock boolean default false, p_quantite integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.demande_client;
  v_l public.ligne_commande;
  v_vers text;
  v_qte integer;
begin
  perform public.exiger_admin(p_auteur);
  if p_etape is null or p_etape not in ('accepter', 'refuser', 'article_rendu', 'remplacement_remis') then
    raise exception 'KS_ETAPE_INVALIDE' using errcode = 'P0001';
  end if;
  if coalesce(p_depuis_stock, false) and p_etape <> 'remplacement_remis' then
    raise exception 'KS_DEPUIS_STOCK_INVALIDE' using errcode = 'P0001';
  end if;
  if p_quantite is not null and (p_etape <> 'remplacement_remis' or p_quantite < 1) then
    raise exception 'KS_QUANTITE_INVALIDE' using errcode = 'P0001';
  end if;
  select * into v_d from public.demande_client where id = p_demande for update;
  if not found then
    raise exception 'KS_DEMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_d.type <> 'reclamation' then
    raise exception 'KS_TYPE_NON_PRIS_EN_CHARGE' using errcode = 'P0001';
  end if;
  v_vers := case
    when p_etape = 'accepter' and v_d.statut = 'ouverte' then 'acceptee'
    when p_etape = 'refuser' and v_d.statut = 'ouverte' then 'refusee'
    when p_etape = 'article_rendu' and v_d.statut = 'acceptee' then 'article_rendu'
    when p_etape = 'remplacement_remis' and v_d.statut = 'article_rendu' then 'remplacement_remis'
    else null end;
  if v_vers is null then
    raise exception 'KS_DEMANDE_DEJA_TRAITEE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  if v_vers = 'remplacement_remis' then
    select * into v_l from public.ligne_commande where id = v_d.ligne_id for update;
    if not found then
      raise exception 'KS_LIGNE_INTROUVABLE' using errcode = 'P0001';
    end if;
    v_qte := coalesce(p_quantite, v_l.nombre);
    if v_qte < 1 or v_qte > v_l.nombre then
      raise exception 'KS_QUANTITE_INVALIDE' using errcode = 'P0001';
    end if;
    if coalesce(p_depuis_stock, false) then
      if v_l.variante_id is null then
        raise exception 'KS_LIGNE_INTROUVABLE' using errcode = 'P0001';
      end if;
      perform public.catalogue_decrementer_stock(v_l.variante_id, v_qte);
    end if;
  end if;
  update public.demande_client
    set statut = v_vers, traitee_le = coalesce(traitee_le, now()), quantite_remplacee = case when v_vers = 'remplacement_remis' then v_qte else quantite_remplacee end
    where id = v_d.id;
end;
$$;
revoke all on function public.traiter_reclamation(jsonb, uuid, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.traiter_reclamation(jsonb, uuid, text, boolean, integer) to service_role;
