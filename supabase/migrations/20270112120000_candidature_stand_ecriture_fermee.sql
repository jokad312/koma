-- Story 7.11, correctif (trouvé par le test pgTAP) : le serveur n'écrit pas directement dans candidature_stand (comme pour pass) ; seules les fonctions
-- security definer écrivent. Les privilèges par défaut de Supabase donnaient l'écriture à service_role sur la table nouvellement créée.
revoke insert, update, delete, truncate on public.candidature_stand from service_role;
