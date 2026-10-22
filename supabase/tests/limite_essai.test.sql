begin;
select plan(11);

-- Fenêtre d'une heure, 2 essais permis : le 3e est refusé, une autre clé a son propre compteur.
select is(public.consommer_essai('test:a', 3600, 2), true, 'premier essai permis');
select is(public.consommer_essai('test:a', 3600, 2), true, 'deuxième essai permis');
select is(public.consommer_essai('test:a', 3600, 2), false, 'troisième essai refusé');
select is(public.consommer_essai('test:a', 3600, 2), false, 'les essais suivants restent refusés');
select is((select compteur from public.limite_essai where cle = 'test:a'), 4, 'chaque essai est compté, même refusé');
select is(public.consommer_essai('test:b', 3600, 2), true, 'une autre clé a son propre compteur');

-- Arguments invalides.
select throws_ok($$select public.consommer_essai('', 3600, 2)$$, 'P0001', 'KS_LIMITE_INVALIDE', 'clé vide refusée');
select throws_ok($$select public.consommer_essai('test:c', 0, 2)$$, 'P0001', 'KS_LIMITE_INVALIDE', 'fenêtre nulle refusée');
select throws_ok($$select public.consommer_essai('test:c', 3600, 0)$$, 'P0001', 'KS_LIMITE_INVALIDE', 'maximum nul refusé');

-- La table est fermée à anon et à authenticated ; la fonction est réservée au service_role.
set local role anon;
select throws_ok($$select * from public.limite_essai$$, '42501', null, 'anon ne lit pas les compteurs');
reset role;
select ok(
  not has_function_privilege('anon', 'public.consommer_essai(text, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.consommer_essai(text, integer, integer)', 'execute')
  and has_function_privilege('service_role', 'public.consommer_essai(text, integer, integer)', 'execute'),
  'consommer_essai est réservée au service_role'
);

select * from finish();
rollback;
