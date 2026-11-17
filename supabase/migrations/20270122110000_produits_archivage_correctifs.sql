-- Story 9.16 e), correctif de revue : TÉLÉCHARGEMENTS (Q20) compte les ACHETEURS du Kit. Un accès obtenu par une Commande offerte (Kit gratuit)
-- n'est plus compté : seuls les accès dont la Commande d'origine (acces_kit.commande_origine) a été payée (paye_le posé, non offerte).
-- Le reste de produits_admin_compteurs est inchangé (20270122100000), mêmes droits : Admin revérifié en base, service_role seulement.

create or replace function public.produits_admin_compteurs(p_auteur jsonb)
returns table (produit_id uuid, acces integer, vendus integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.exiger_admin(p_auteur);
  return query
    select
      p.id,
      (select count(*)::integer
         from public.acces_kit a
         join public.commande c on c.id = a.commande_origine
        where a.produit_id = p.id
          and c.paye_le is not null
          and not c.offerte),
      (select coalesce(sum(l.nombre), 0)::integer
         from public.ligne_commande l
         join public.commande c on c.id = l.commande_id
        where l.produit_id = p.id
          and not l.annulee
          and c.paye_le is not null
          and c.statut not in ('annulee', 'remboursee'))
    from public.produit p;
end;
$$;

revoke all on function public.produits_admin_compteurs(jsonb) from public, anon, authenticated;
grant execute on function public.produits_admin_compteurs(jsonb) to service_role;
