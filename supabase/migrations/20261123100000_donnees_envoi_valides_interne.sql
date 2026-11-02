-- Story 4.4, CI : donnees_envoi_valides n'est appelée que par la contrainte de envoi (exécutée avec les droits du propriétaire de la table).
-- Aucun rôle client ne l'exécute (garde des fonctions ouvertes, AD-3).
revoke all on function public.donnees_envoi_valides(jsonb) from public, anon, authenticated, service_role;
