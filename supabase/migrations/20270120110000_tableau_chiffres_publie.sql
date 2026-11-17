-- Story 9.16 c), correctif de revue : « Produits publiés » ne compte pas un produit à publication programmée (publie_le dans le futur).
-- Même définition de « publié » que partout ailleurs (publie_le posé et passé). Le reste de tableau_chiffres est inchangé (20270120100000).

create or replace function public.tableau_chiffres(p_auteur jsonb)
returns table (
  produits_publies integer, commandes_payees integer, revenu_cents bigint, tentatives_reussies integer, tentatives_terminees integer,
  evenements_a_venir integer, pass_7 integer, pass_30 integer
)
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
      (select count(*)::integer from public.produit p where p.publie_le is not null and p.publie_le <= now()),
      (select count(*)::integer from public.commande c where c.paye_le is not null and c.statut not in ('annulee', 'remboursee')),
      (select coalesce(sum(c.total_cents::bigint), 0)::bigint from public.commande c where c.paye_le is not null and c.statut not in ('annulee', 'remboursee')),
      (select count(*)::integer from public.tentative_paiement t where t.statut = 'reussie'),
      (select count(*)::integer from public.tentative_paiement t where t.statut in ('reussie', 'echouee', 'abandonnee')),
      (select count(*)::integer from public.evenement e
        where e.publie_le is not null and e.publie_le <= now() and coalesce(e.fin_le, e.debut_le) > now()),
      (select count(*)::integer from public.pass s join public.commande c on c.id = s.commande_id
        where s.statut in ('valide', 'scanne') and c.paye_le is not null and c.statut not in ('annulee', 'remboursee')
          and c.paye_le >= public.minuit_goma(6)),
      (select count(*)::integer from public.pass s join public.commande c on c.id = s.commande_id
        where s.statut in ('valide', 'scanne') and c.paye_le is not null and c.statut not in ('annulee', 'remboursee')
          and c.paye_le >= public.minuit_goma(29));
end;
$$;

revoke all on function public.tableau_chiffres(jsonb) from public, anon, authenticated;
grant execute on function public.tableau_chiffres(jsonb) to service_role;
