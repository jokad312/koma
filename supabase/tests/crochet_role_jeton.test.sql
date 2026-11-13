-- Story 9.12 : crochet « Custom Access Token » qui ajoute koma_role (admin | assistant) au jeton. Lu en base, admin avant assistant,
-- revendication venue d'ailleurs retirée, jamais d'erreur ; seul supabase_auth_admin l'exécute. Données TEST_ annulées à la fin.
begin;
select plan(9);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'test-crochet-admin@example.invalid'),
  ('00000000-0000-0000-0000-0000000000c2', 'test-crochet-assistant@example.invalid'),
  ('00000000-0000-0000-0000-0000000000c3', 'test-crochet-client@example.invalid'),
  ('00000000-0000-0000-0000-0000000000c4', 'test-crochet-double@example.invalid');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c2', 'assistant');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c4', 'assistant');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c4', 'admin');

create function pg_temp.role_de(p text, p_claims jsonb default '{"sub":"x","role":"authenticated"}') returns text language sql as $$
  select public.crochet_role_jeton(jsonb_build_object('user_id', p, 'claims', p_claims)) -> 'claims' ->> 'koma_role'
$$;

select is(pg_temp.role_de('00000000-0000-0000-0000-0000000000c1'), 'admin', 'admin : koma_role = admin');
select is(pg_temp.role_de('00000000-0000-0000-0000-0000000000c2'), 'assistant', 'assistant : koma_role = assistant');
select is(pg_temp.role_de('00000000-0000-0000-0000-0000000000c4'), 'admin', 'admin et assistant : admin passe avant');
select is(pg_temp.role_de('00000000-0000-0000-0000-0000000000c3'), null, 'client : aucune revendication');
select is(pg_temp.role_de('00000000-0000-0000-0000-0000000000c3', '{"sub":"x","koma_role":"admin"}'), null, 'une revendication koma_role reçue est retirée');
select is(pg_temp.role_de('pas-un-uuid'), null, 'identifiant illisible : jeton sans rôle, sans erreur');
select is(
  public.crochet_role_jeton('{"user_id":"00000000-0000-0000-0000-0000000000c1","claims":{"sub":"x","role":"authenticated","email":"e"}}'::jsonb) -> 'claims' ->> 'email',
  'e', 'les autres revendications sont gardées'
);
select is((select count(*)::int from unnest(array['anon', 'authenticated', 'service_role']) r where has_function_privilege(r, 'public.crochet_role_jeton(jsonb)', 'execute')), 0, 'ni anon, ni authenticated, ni service_role');
select ok(has_function_privilege('supabase_auth_admin', 'public.crochet_role_jeton(jsonb)', 'execute'), 'supabase_auth_admin exécute le crochet');

select * from finish();
rollback;
