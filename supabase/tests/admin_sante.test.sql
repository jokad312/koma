begin;
select plan(3);

select is(public.admin_sante(), 1, 'admin_sante répond 1');
select ok(has_function_privilege('service_role', 'public.admin_sante()', 'execute'), 'service_role peut appeler admin_sante');
select ok(
  not has_function_privilege('anon', 'public.admin_sante()', 'execute')
  and not has_function_privilege('authenticated', 'public.admin_sante()', 'execute'),
  'anon et authenticated ne peuvent pas appeler admin_sante'
);

select * from finish();
rollback;
