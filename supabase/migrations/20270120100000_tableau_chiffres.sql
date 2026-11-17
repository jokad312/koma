-- Story 9.16 c) (décisions de Jonathan du 2026-11-17, Q9 et SM-4) : cartes de chiffres du tableau de bord et « Événements et Pass vendus ».
-- Lecture seule, réservée à l'Admin : exiger_admin revérifie le droit en base ; exécutable par service_role seulement (jamais anon ni authenticated).
-- Que des agrégats : aucun Compte, email, téléphone, adresse ni nom de titulaire. Mêmes règles d'argent que SM-1 (tableau_paiements) : Commandes
-- payées (paye_le posé), hors annulées et remboursées, montants en centimes USD, forfait de livraison compris.
--   produits_publies : produits dont publie_le est posé, toutes Familles ;
--   commandes_payees, revenu_cents : depuis le début ;
--   tentatives_reussies, tentatives_terminees : taux de paiements réussis = réussies / (réussies + échouées + abandonnées), calculé par la page
--     (aucune tentative terminée : pas de taux) ; en_cours n'est pas terminée ;
--   evenements_a_venir : Événements publiés dont la fin (ou, sans fin, le début) est dans le futur ;
--   pass_7, pass_30 : Pass valides ou scannés dont la Commande est payée (hors annulée et remboursée), payée depuis minuit à Goma il y a 6 ou 29 jours.

create function public.tableau_chiffres(p_auteur jsonb)
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
      (select count(*)::integer from public.produit p where p.publie_le is not null),
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
