-- Vérification de connexion à la base pour /api/sante (story 1.1).
create function public.admin_sante()
returns integer
language sql
security definer
set search_path = ''
as $$ select 1 $$;

revoke all on function public.admin_sante() from public, anon, authenticated;
grant execute on function public.admin_sante() to service_role;
