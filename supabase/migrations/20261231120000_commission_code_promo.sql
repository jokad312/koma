-- Story 9.3 : ventes et commissions par Code promo (FR-48, AD-27). La vue est la seule source du calcul :
-- - seules les Commandes ayant un paye_le comptent (une Commande offerte n'en a pas) ;
-- - montant = somme (prix x nombre - reduction_cents) des lignes non annulées : hors livraison, hors lignes annulées ;
-- - commission = montant x taux de commission FIGÉ avec la Commande (commande_code_promo), arrondie au centime inférieur par Commande ;
-- - une Commande dont toutes les lignes sont annulées (remboursée en entier) n'est ni une vente ni un montant.
-- Aucun paiement de commission n'est fait par le site. Lecture par le serveur seulement.

create view public.commission_code_promo with (security_invoker = true) as
  with par_commande as (
    select
      ccp.code_promo_id,
      ccp.commission_pct,
      coalesce(sum(l.prix_cents::bigint * l.nombre - l.reduction_cents) filter (where not l.annulee), 0)::bigint as montant_cents
    from public.commande_code_promo ccp
    join public.commande c on c.id = ccp.commande_id and c.paye_le is not null
    join public.ligne_commande l on l.commande_id = c.id
    group by ccp.commande_id, ccp.code_promo_id, ccp.commission_pct
  )
  select
    cp.id as code_promo_id,
    count(pc.code_promo_id) filter (where pc.montant_cents > 0)::integer as ventes,
    coalesce(sum(pc.montant_cents) filter (where pc.montant_cents > 0), 0)::bigint as montant_cents,
    coalesce(sum(floor(pc.montant_cents * pc.commission_pct / 100)) filter (where pc.montant_cents > 0), 0)::bigint as commission_cents
  from public.code_promo cp
  left join par_commande pc on pc.code_promo_id = cp.id
  group by cp.id;

revoke all on public.commission_code_promo from public, anon, authenticated;
grant select on public.commission_code_promo to service_role;
