-- Story 2.5 : disponibilité de chaque taille d'une fiche produit (AD-3, AD-17, AD-26).
-- Lecture pure : aucune table, aucune donnée. Les migrations précédentes ne sont pas modifiées.

-- Renvoie, pour chaque taille d'un produit publié, son état de disponibilité et son délai de fabrication effectif.
-- SECURITY INVOKER : la RLS ne laisse voir que les produits publiés et passés, et le même prédicat est écrit explicitement
-- (un rôle qui contourne la RLS ne voit pas non plus un brouillon). Produit inconnu ou non publié : aucune ligne.
--   etat : en_stock (stock_disponible > 0), sinon sur_commande (fabrication sur commande et capacité non atteinte),
--          sinon complet (fabrication possible mais capacité atteinte), sinon indisponible.
--   delai_jours : celui de la variante, sinon celui du produit (nul si aucun n'est fixé) ; à n'afficher que pour sur_commande.
-- Jamais de quantité. L'état s'appuie sur stock_disponible et capacite_fabrication_atteinte, que l'epic 4 remplace sans toucher à cette fonction.
-- Ordre : XS, S, M, L, XL, XXL, puis sur_mesure.
create function public.disponibilite_variantes(p_produit uuid)
returns table (
  taille text,
  etat text,
  delai_jours integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with capacite as (
    select coalesce(public.capacite_fabrication_atteinte(), false) as atteinte
  )
  select
    v.taille,
    case
      when coalesce(public.stock_disponible(v.id), 0) > 0 then 'en_stock'
      when v.fabrication_sur_commande and not c.atteinte then 'sur_commande'
      when v.fabrication_sur_commande then 'complet'
      else 'indisponible'
    end as etat,
    coalesce(v.delai_fabrication_jours, p.delai_fabrication_jours) as delai_jours
  from public.produit p
  join public.variante v on v.produit_id = p.id
  cross join capacite c
  where p.id = p_produit
    and p.publie_le is not null and p.publie_le <= now()
  order by array_position(array['XS', 'S', 'M', 'L', 'XL', 'XXL', 'sur_mesure'], v.taille)
$$;

revoke all on function public.disponibilite_variantes(uuid) from public;
grant execute on function public.disponibilite_variantes(uuid) to anon, authenticated, service_role;
