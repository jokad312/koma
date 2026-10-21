begin;
select plan(30);

-- Comptes de test (auth.users) : le déclencheur crée les profils.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-a@example.invalid', '{"langue":"en"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-b@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-c@example.invalid', '{"langue":"xx"}');

select is((select langue from public.profil where id = '00000000-0000-0000-0000-0000000000a1'), 'en', 'la langue de la route est enregistrée');
select is((select langue from public.profil where id = '00000000-0000-0000-0000-0000000000a2'), 'fr', 'langue absente : fr');
select is((select langue from public.profil where id = '00000000-0000-0000-0000-0000000000a3'), 'fr', 'langue invalide : fr');

-- Compte incomplet tant que l'âge n'est pas déclaré.
select is(public.compte_complet('00000000-0000-0000-0000-0000000000a1'), false, 'sans âge : Compte incomplet');
select is(public.est_mineur('00000000-0000-0000-0000-0000000000a1'), false, 'âge non déclaré : pas mineur');

-- Refus sous 13 ans, sans auteur, hors bornes.
select throws_ok($$select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 12)$$, 'P0001', 'KS_AGE_MINIMUM', 'moins de 13 ans refusé');
select throws_ok($$select public.declarer_age(null, '00000000-0000-0000-0000-0000000000a1', 20)$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'sans auteur refusé');
select throws_ok($$select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 121)$$, 'P0001', 'KS_AGE_INVALIDE', 'plus de 120 ans refusé');
select is(public.compte_complet('00000000-0000-0000-0000-0000000000a1'), false, 'après refus : toujours incomplet');
select is((select count(*)::int from public.journal_audit where action = 'age_declare' and cible_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'un refus n''écrit rien dans le journal');

-- 13 ans : mineur, complet.
select lives_ok($$select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 13)$$, '13 ans accepté');
select is(public.est_mineur('00000000-0000-0000-0000-0000000000a1'), true, '13 ans : mineur');

-- Journal d'audit : une ligne « age_declare » pour la déclaration réussie, avec l'auteur, le Compte et l'âge.
select is((select count(*)::int from public.journal_audit where action = 'age_declare' and cible_id = '00000000-0000-0000-0000-0000000000a1'), 1, 'la déclaration est journalisée une seule fois');
select is((select apres from public.journal_audit where action = 'age_declare' and cible_id = '00000000-0000-0000-0000-0000000000a1'), '{"age_declare":13}'::jsonb, 'le journal garde l''âge déclaré');
select is((select auteur from public.journal_audit where action = 'age_declare' and cible_id = '00000000-0000-0000-0000-0000000000a1'), '{"type":"test"}'::jsonb, 'le journal garde l''auteur');
select is((select cible_table from public.journal_audit where action = 'age_declare' and cible_id = '00000000-0000-0000-0000-0000000000a1'), 'profil', 'le journal nomme la table cible');
select is(public.compte_complet('00000000-0000-0000-0000-0000000000a1'), true, 'avec âge : Compte complet');
select throws_ok($$select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 30)$$, 'P0001', 'KS_AGE_DEJA_DECLARE', 'une seconde déclaration est refusée');
select is((select count(*)::int from public.journal_audit where action = 'age_declare' and cible_id = '00000000-0000-0000-0000-0000000000a1'), 1, 'la seconde déclaration refusée n''ajoute aucune ligne');

-- 17 et 18 ans.
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a2', 17);
select is(public.est_mineur('00000000-0000-0000-0000-0000000000a2'), true, '17 ans : mineur');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a3', 18);
select is(public.est_mineur('00000000-0000-0000-0000-0000000000a3'), false, '18 ans : pas mineur');

-- Vieillissement : 17 ans déclarés il y a 2 ans = 19 ans aujourd'hui.
update public.profil set age_declare_le = now() - interval '2 years' where id = '00000000-0000-0000-0000-0000000000a2';
select is(public.est_mineur('00000000-0000-0000-0000-0000000000a2'), false, '17 ans déclarés il y a 2 ans : majeur');

-- RLS : un Compte lit sa propre ligne, jamais celle d'un autre, et n'écrit jamais directement.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is((select count(*)::int from public.profil), 1, 'un Compte ne lit que son profil');
select is((select count(*)::int from public.profil where id = '00000000-0000-0000-0000-0000000000a2'), 0, 'le profil d''un autre est invisible');
select throws_ok($$update public.profil set age_declare = 40 where id = '00000000-0000-0000-0000-0000000000a1'$$, '42501', null, 'écriture directe impossible');
select throws_ok($$select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 30)$$, '42501', null, 'declarer_age non exécutable par authenticated');
reset role;

set local role anon;
select throws_ok($$select * from public.profil$$, '42501', null, 'anon ne lit pas profil');
reset role;

-- Un adulte déclaré qui redéclare 5 : refus par KS_AGE_DEJA_DECLARE, rien n'est modifié.
select throws_ok($$select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a3', 5)$$, 'P0001', 'KS_AGE_DEJA_DECLARE', 'un adulte déclaré qui redéclare 5 : KS_AGE_DEJA_DECLARE');
select is((select age_declare::int from public.profil where id = '00000000-0000-0000-0000-0000000000a3'), 18, 'l''âge déclaré est inchangé');

-- Supprimer le Compte supprime le profil (cascade).
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a2';
select is((select count(*)::int from public.profil where id = '00000000-0000-0000-0000-0000000000a2'), 0, 'supprimer le Compte supprime le profil');

select * from finish();
rollback;
