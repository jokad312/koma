-- Story 4.3, issue C (décision de Jonathan, 2026-11-02) : places_fabrication_utilisees() n'est plus exécutable par anon ni authenticated.
-- Elle lit les réservations et les Commandes, qu'un client ne doit pas pouvoir lire : le nombre de pièces sur commande n'est pas public.
-- Les pages publiques n'obtiennent que l'état « Plafond atteint ou non » par capacite_fabrication_atteinte() (security definer, booléen seul).
revoke all on function public.places_fabrication_utilisees() from public, anon, authenticated;
grant execute on function public.places_fabrication_utilisees() to service_role;
