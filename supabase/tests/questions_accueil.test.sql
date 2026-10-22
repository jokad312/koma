begin;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'test-q1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000c2', 'test-q2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000c3', 'test-q3@example.invalid', '{}');

select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c1', 20);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c3', 30);

select is(public.questions_accueil_vues('00000000-0000-0000-0000-0000000000c1'), false, 'questions non vues au départ');

-- Âge non déclaré : refusé.
select throws_ok($$select public.enregistrer_questions_accueil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c2","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000c2', 'tiktok', null)$$, 'P0001', 'KS_AGE_NON_DECLARE', 'sans âge déclaré : refusé');

-- Sans auteur, et jamais le profil d'un autre.
select throws_ok($$select public.enregistrer_questions_accueil(null, '00000000-0000-0000-0000-0000000000c1', null, null)$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'sans auteur refusé');
select throws_ok($$select public.enregistrer_questions_accueil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000c3', 'tiktok', null)$$, 'P0001', 'KS_DROIT_REFUSE', 'modifier le profil d''un autre est refusé');
select is((select questions_accueil_le from public.profil where id = '00000000-0000-0000-0000-0000000000c3'), null, 'le profil d''un autre reste inchangé');

-- Réponses hors liste : rien d'enregistré.
select throws_ok($$select public.enregistrer_questions_accueil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000c1', 'xx', null)$$, 'P0001', 'KS_REPONSE_INVALIDE', 'origine inconnue refusée');
select throws_ok($$select public.enregistrer_questions_accueil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000c1', null, 'les deux')$$, 'P0001', 'KS_REPONSE_INVALIDE', 'préférence inconnue refusée');
select is(public.questions_accueil_vues('00000000-0000-0000-0000-0000000000c1'), false, 'un refus ne marque pas les questions comme vues');

-- Réponses valides.
select lives_ok($$select public.enregistrer_questions_accueil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000c1', 'ami', 'fabriquer')$$, 'réponses enregistrées');
select is((select origine from public.profil where id = '00000000-0000-0000-0000-0000000000c1'), 'ami', 'origine enregistrée');
select is((select preference_creation from public.profil where id = '00000000-0000-0000-0000-0000000000c1'), 'fabriquer', 'préférence enregistrée');

-- Une seule fois : la seconde écriture est refusée et ne change rien.
select throws_ok($$select public.enregistrer_questions_accueil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000c1', 'tiktok', 'porter')$$, 'P0001', 'KS_QUESTIONS_DEJA_VUES', 'seconde écriture refusée');
select is((select origine from public.profil where id = '00000000-0000-0000-0000-0000000000c1'), 'ami', 'réponses d''origine conservées');

-- « Passer » : aucune réponse, mais vues.
select lives_ok($$select public.enregistrer_questions_accueil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c3","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000c3', null, null)$$, 'passer est accepté');
select is(public.questions_accueil_vues('00000000-0000-0000-0000-0000000000c3'), true, 'passer marque les questions comme vues');

-- Droits : réservé au service_role.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select throws_ok($$select public.enregistrer_questions_accueil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c2","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000c2', null, null)$$, '42501', null, 'non exécutable par authenticated');
reset role;

select * from finish();
rollback;
