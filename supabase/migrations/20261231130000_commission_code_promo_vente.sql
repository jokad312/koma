-- Story 9.3, correctif de la revue : une vente est une Commande payée avec au moins une ligne non annulée, même si son montant
-- hors livraison vaut 0 (code à 100 % avec livraison payée). Une Commande dont toutes les lignes sont annulées n'est pas une vente.
-- Mêmes colonnes, même calcul de montant et de commission ; droits conservés (create or replace view).

create or replace view public.commission_code_promo with (security_invoker = true) as
  with par_commande as (
    select
      ccp.code_promo_id,
      ccp.commission_pct,
      bool_or(not l.annulee) as vivante,
      coalesce(sum(l.prix_cents::bigint * l.nombre - l.reduction_cents) filter (where not l.annulee), 0)::bigint as montant_cents
    from public.commande_code_promo ccp
    join public.commande c on c.id = ccp.commande_id and c.paye_le is not null
    join public.ligne_commande l on l.commande_id = c.id
    group by ccp.commande_id, ccp.code_promo_id, ccp.commission_pct
  )
  select
    cp.id as code_promo_id,
    count(pc.code_promo_id) filter (where pc.vivante)::integer as ventes,
    coalesce(sum(pc.montant_cents) filter (where pc.vivante), 0)::bigint as montant_cents,
    coalesce(sum(floor(pc.montant_cents * pc.commission_pct / 100)) filter (where pc.vivante), 0)::bigint as commission_cents
  from public.code_promo cp
  left join par_commande pc on pc.code_promo_id = cp.id
  group by cp.id;
