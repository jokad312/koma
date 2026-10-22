-- Story 2.1 : question « univers » des questions d'accueil (colonne profil.univers_prefere, fonction recréée à cinq paramètres).
begin;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'test-qu1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'test-qu2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f3', 'test-qu3@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f1', 20);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 20);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f3', 20);

-- Un univers de test (le système en est l'auteur).
select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into public.univers (id, nom_fr, nom_en) values ('00000000-0000-0000-0000-0000000000a1', 'Univers de test', 'Test universe');

-- L'ancienne signature à quatre paramètres n'existe plus ; un appel à quatre arguments passe par la valeur par défaut.
select is(
  (select count(*)::int from pg_proc where proname = 'enregistrer_questions_accueil' and pronamespace = 'public'::regnamespace),
  1,
  'une seule signature de enregistrer_questions_accueil'
);

-- Univers inconnu : refusé, rien n'est enregistré, les questions ne sont pas marquées comme vues.
select throws_ok(
  $$select public.enregistrer_questions_accueil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000f1', 'ami', 'porter', '00000000-0000-0000-0000-00000000ffff')$$,
  'P0001', 'KS_REPONSE_INVALIDE', 'univers inconnu refusé'
);
select is(public.questions_accueil_vues('00000000-0000-0000-0000-0000000000f1'), false, 'un refus ne marque pas les questions comme vues');
select is((select origine from public.profil where id = '00000000-0000-0000-0000-0000000000f1'), null, 'rien n''est enregistré après un refus');

-- Réponse valide avec univers.
select lives_ok(
  $$select public.enregistrer_questions_accueil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000f1', 'ami', 'fabriquer', '00000000-0000-0000-0000-0000000000a1')$$,
  'réponses avec univers enregistrées'
);
select is((select univers_prefere from public.profil where id = '00000000-0000-0000-0000-0000000000f1'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'univers préféré enregistré');

-- Sans univers (appel à quatre arguments, comme avant) : la préférence reste vide.
select lives_ok(
  $$select public.enregistrer_questions_accueil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f2","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 'tiktok', null)$$,
  'appel à quatre arguments accepté'
);
select is((select univers_prefere from public.profil where id = '00000000-0000-0000-0000-0000000000f2'), null, 'aucun univers : préférence vide');

-- Questions déjà vues : jamais rouvertes, l'univers déjà enregistré reste inchangé.
select throws_ok(
  $$select public.enregistrer_questions_accueil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000f1', null, null, null)$$,
  'P0001', 'KS_QUESTIONS_DEJA_VUES', 'questions déjà vues : refusé'
);
select is((select univers_prefere from public.profil where id = '00000000-0000-0000-0000-0000000000f1'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'univers préféré inchangé');

-- Questions déjà vues : un univers inconnu ne change pas le résultat (KS_QUESTIONS_DEJA_VUES, jamais KS_REPONSE_INVALIDE).
select throws_ok(
  $$select public.enregistrer_questions_accueil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000f1', null, null, '00000000-0000-0000-0000-00000000ffff')$$,
  'P0001', 'KS_QUESTIONS_DEJA_VUES', 'questions déjà vues avec un univers inconnu : toujours « déjà vues »'
);

-- Droits : réservé au service_role.
select ok(
  not has_function_privilege('anon', 'public.enregistrer_questions_accueil(jsonb, uuid, text, text, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.enregistrer_questions_accueil(jsonb, uuid, text, text, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.enregistrer_questions_accueil(jsonb, uuid, text, text, uuid)', 'execute'),
  'enregistrer_questions_accueil est réservée au service_role'
);

select * from finish();
rollback;
