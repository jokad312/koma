-- Story 7.7 : accès bénévole. L'Admin donne à un Compte (trouvé par son email) l'accès au Scan d'UN Événement, pour le jour de cet Événement (minuit à minuit,
-- Africa/Lubumbashi). Le bénévole ne reçoit aucun rôle : seul scan_exiger_acces (appelée par scanner_pass) lit l'accès. La validité est calculée à chaque
-- contrôle (avant, pendant, après, bornes), un accès échu est refusé même si la tâche supprimer_acces_benevoles_echus n'a pas tourné, puis la tâche
-- le supprime. Un bénévole ne peut appeler aucune fonction réservée à l'Admin. Le journal ne contient jamais l'email. Données TEST_ annulées à la fin.
-- Exécuté par la CI (Docker) ; en local, `npm run test:sql` explique l'absence de Docker et sort sans erreur.
begin;
select plan(96);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-bn-admin@example.invalid', now(), '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-bn-assistant@example.invalid', now(), '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-bn-benevole@example.invalid', now(), '{}'),
  ('00000000-0000-0000-0000-0000000000a4', 'test-bn-simple@example.invalid', now(), '{}'),
  ('00000000-0000-0000-0000-0000000000a5', 'test-bn-autre@example.invalid', now(), '{}'),
  ('00000000-0000-0000-0000-0000000000a6', 'test-bn-nonconfirme@example.invalid', null, '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a2', 'assistant');
create function pg_temp.admin() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb $$;
create function pg_temp.assistant() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a2","role":"assistant"}'::jsonb $$;
create function pg_temp.benevole() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a3","role":"benevole"}'::jsonb $$;
-- a4 n'a rien, mais prétend être admin dans l'objet : le rôle écrit dans p_auteur n'est jamais cru.
create function pg_temp.faux_admin() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a4","role":"admin"}'::jsonb $$;
create function pg_temp.autre() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a5","role":"benevole"}'::jsonb $$;

-- Événements (jamais publiés : sans effet sur le reste). ev1 : 10 mars 2027 à 14 h (Goma) ; ev2 : 20 mars ; ev3 : trois jours ; ev4 : passé ; ev5 : sans date ;
-- ev6 : commence maintenant (son jour contient l'instant présent).
insert into public.evenement (id, auteur_id, titre_fr, slug, debut_le, fin_le) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'TEST_Un', 'test-bn-ev1', '2027-03-10 14:00:00+02', null),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-0000-0000-0000000000a1', 'TEST_Deux', 'test-bn-ev2', '2027-03-20 10:00:00+02', null),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-0000-0000-0000000000a1', 'TEST_Trois', 'test-bn-ev3', '2027-04-01 09:00:00+02', '2027-04-03 18:00:00+02'),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-0000-0000-0000000000a1', 'TEST_Passe', 'test-bn-ev4', now() - interval '10 days', null),
  ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-0000-0000-0000000000a1', 'TEST_SansDate', 'test-bn-ev5', null, null),
  ('00000000-0000-4000-8000-0000000000b6', '00000000-0000-0000-0000-0000000000a1', 'TEST_Aujourdhui', 'test-bn-ev6', now(), null);

-- Structure et droits.
select has_table('public', 'acces_benevole', 'la table acces_benevole existe');
select ok((select relrowsecurity from pg_class where oid = 'public.acces_benevole'::regclass), 'RLS activée sur acces_benevole');
select ok(
  not has_table_privilege('anon', 'public.acces_benevole', 'select') and not has_table_privilege('authenticated', 'public.acces_benevole', 'select')
  and not has_table_privilege('authenticated', 'public.acces_benevole', 'insert') and not has_table_privilege('authenticated', 'public.acces_benevole', 'update')
  and not has_table_privilege('authenticated', 'public.acces_benevole', 'delete') and not has_table_privilege('anon', 'public.acces_benevole', 'insert'),
  'anon et authenticated ne peuvent ni lire ni écrire acces_benevole'
);
select is((select count(*)::int from pg_policies where tablename = 'acces_benevole'), 0, 'aucune politique : rien n''est ouvert aux clients');
select ok(
  not has_function_privilege('anon', 'public.attribuer_acces_benevole(jsonb, uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.attribuer_acces_benevole(jsonb, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.retirer_acces_benevole(jsonb, uuid, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.retirer_acces_benevole(jsonb, uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.lister_acces_benevoles(jsonb, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.lister_acces_benevoles(jsonb, uuid)', 'execute'),
  'attribuer, retirer et lister sont fermées à anon et authenticated'
);
select ok(
  not has_function_privilege('anon', 'public.acces_scan_valide(uuid, uuid)', 'execute') and not has_function_privilege('authenticated', 'public.acces_scan_valide(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.lire_acces_benevole_compte(uuid)', 'execute') and not has_function_privilege('authenticated', 'public.lire_acces_benevole_compte(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.supprimer_acces_benevoles_echus()', 'execute') and not has_function_privilege('authenticated', 'public.supprimer_acces_benevoles_echus()', 'execute'),
  'le contrôle de validité, la lecture par Compte et la tâche de suppression sont fermés à anon et authenticated'
);
select ok(
  not has_function_privilege('anon', 'public.scan_exiger_acces(jsonb, uuid)', 'execute') and not has_function_privilege('authenticated', 'public.scan_exiger_acces(jsonb, uuid)', 'execute')
  and not has_function_privilege('service_role', 'public.scan_exiger_acces(jsonb, uuid)', 'execute'),
  'scan_exiger_acces reste interne (même service_role ne l''appelle pas)'
);
select ok(
  has_function_privilege('service_role', 'public.attribuer_acces_benevole(jsonb, uuid, text)', 'execute')
  and has_function_privilege('service_role', 'public.retirer_acces_benevole(jsonb, uuid, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.lister_acces_benevoles(jsonb, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.supprimer_acces_benevoles_echus()', 'execute'),
  'seul service_role exécute les fonctions d''écriture'
);

-- Attribution par l'Admin : fenêtre du minuit de Goma au minuit suivant.
select is((public.attribuer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b1', 'test-bn-benevole@example.invalid')) ->> 'statut', 'attribue', 'l''Admin donne l''accès');
select is(
  (select valable_du from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1'),
  '2027-03-09 22:00:00+00'::timestamptz, 'la fenêtre commence à minuit à Goma (22 h UTC la veille)'
);
select is(
  (select valable_jusqu_au from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1'),
  '2027-03-10 22:00:00+00'::timestamptz, 'la fenêtre finit à minuit à Goma (fin du jour de l''Événement)'
);
select is(
  (select cree_par from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'l''accès garde l''Admin qui l''a donné'
);
select is((public.attribuer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b1', 'test-bn-benevole@example.invalid')) ->> 'statut', 'deja', 'idempotente : une seconde attribution ne change rien');
select is((public.attribuer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b1', '  TEST-BN-Benevole@Example.INVALID ')) ->> 'statut', 'deja', 'l''email est cherché sans tenir compte de la casse ni des espaces');
select is((select count(*)::int from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000a3'), 1, 'une seule ligne par Compte et par Événement');
select is((select count(*)::int from public.journal_audit where action = 'acces_benevole_attribue'), 1, 'l''attribution est journalisée une seule fois (pas de journal pour le rejeu)');

-- Événement sur plusieurs jours : du début du premier jour à la fin du dernier.
select is((public.attribuer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b3', 'test-bn-benevole@example.invalid')) ->> 'statut', 'attribue', 'accès sur un Événement de trois jours');
select ok(
  (select valable_du = '2027-03-31 22:00:00+00'::timestamptz and valable_jusqu_au = '2027-04-03 22:00:00+00'::timestamptz
     from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b3'),
  'la fenêtre couvre du premier au dernier jour'
);

-- Aucun Compte pour cet email : l'état est rendu, rien n'est créé.
select is((public.attribuer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b1', 'test-bn-inconnu@example.invalid')) ->> 'statut', 'sans_compte', 'email sans Compte : état « sans compte »');
select is((select count(*)::int from auth.users where email = 'test-bn-inconnu@example.invalid'), 0, 'aucun Compte n''est créé pour cet email');
select is((select count(*)::int from public.acces_benevole), 2, 'aucun accès n''est créé pour un email sans Compte');

-- Refus : seul l'Admin attribue.
select throws_ok($$select public.attribuer_acces_benevole(pg_temp.assistant(), '00000000-0000-4000-8000-0000000000b2', 'test-bn-benevole@example.invalid')$$, 'P0001', 'KS_DROIT_REFUSE', 'l''Assistant ne peut pas attribuer');
select throws_ok($$select public.attribuer_acces_benevole(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000b2', 'test-bn-benevole@example.invalid')$$, 'P0001', 'KS_DROIT_REFUSE', 'un bénévole ne peut pas attribuer');
select throws_ok($$select public.attribuer_acces_benevole(pg_temp.faux_admin(), '00000000-0000-4000-8000-0000000000b2', 'test-bn-benevole@example.invalid')$$, 'P0001', 'KS_DROIT_REFUSE', 'un faux rôle admin écrit dans l''auteur est refusé');
select throws_ok($$select public.attribuer_acces_benevole('{"type":"visiteur"}'::jsonb, '00000000-0000-4000-8000-0000000000b2', 'test-bn-benevole@example.invalid')$$, 'P0001', 'KS_DROIT_REFUSE', 'un visiteur ne peut pas attribuer');
select throws_ok($$select public.attribuer_acces_benevole('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-4000-8000-0000000000b2', 'test-bn-benevole@example.invalid')$$, 'P0001', 'KS_DROIT_REFUSE', 'même un auteur « système » ne peut pas attribuer : Admin Compte seulement');
select throws_ok($$select public.attribuer_acces_benevole(null, '00000000-0000-4000-8000-0000000000b2', 'test-bn-benevole@example.invalid')$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'sans auteur : refusé');
select is((select count(*)::int from public.acces_benevole where evenement_id = '00000000-0000-4000-8000-0000000000b2'), 0, 'aucun accès n''a été créé par les appels refusés');

-- Validation.
select throws_ok($$select public.attribuer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b2', 'pas-un-email')$$, 'P0001', 'KS_EMAIL_INVALIDE', 'email mal formé refusé');
select throws_ok($$select public.attribuer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000ff', 'test-bn-benevole@example.invalid')$$, 'P0001', 'KS_EVENEMENT_INTROUVABLE', 'Événement inconnu refusé');
select throws_ok($$select public.attribuer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b5', 'test-bn-benevole@example.invalid')$$, 'P0001', 'KS_EVENEMENT_SANS_DATE', 'Événement sans date refusé');
select throws_ok($$select public.attribuer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b4', 'test-bn-benevole@example.invalid')$$, 'P0001', 'KS_EVENEMENT_PASSE', 'Événement dont le jour est passé refusé');

-- Le jour de l'Événement : l'accès donné par la fonction couvre l'instant présent.
select is((public.attribuer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b6', 'test-bn-autre@example.invalid')) ->> 'statut', 'attribue', 'accès pour un Événement qui a lieu aujourd''hui');
select lives_ok($$select public.scan_exiger_acces(pg_temp.autre(), '00000000-0000-4000-8000-0000000000b6')$$, 'pendant le jour de l''Événement : le bénévole passe');
select is(public.acces_scan_valide('00000000-0000-0000-0000-0000000000a5', '00000000-0000-4000-8000-0000000000b6'), true, 'acces_scan_valide : vrai pendant le jour');
-- scanner_pass : le bénévole passe le contrôle (code inconnu = refus métier, pas un refus de droit).
select is(
  public.scanner_pass(pg_temp.autre(), '00000000-0000-4000-8000-0000000000b6', null, 'ZZZZZZZ9') ->> 'raison', 'inconnu',
  'scanner_pass accepte le bénévole de cet Événement (il atteint la recherche du Pass)'
);

-- Fenêtre : avant, bornes, après (sur l'accès de a3 à ev1, dates posées à la main).
update public.acces_benevole set valable_du = now() + interval '1 second', valable_jusqu_au = now() + interval '1 day'
  where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.scan_exiger_acces(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000b1')$$, 'P0001', 'KS_DROIT_REFUSE', 'avant la fenêtre : refusé');
update public.acces_benevole set valable_du = now(), valable_jusqu_au = now() + interval '1 day'
  where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1';
select lives_ok($$select public.scan_exiger_acces(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000b1')$$, 'à la borne de début (minuit) : accepté');
update public.acces_benevole set valable_du = now() - interval '1 day', valable_jusqu_au = now() + interval '1 second'
  where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1';
select lives_ok($$select public.scan_exiger_acces(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000b1')$$, 'une seconde avant la borne de fin : accepté');
update public.acces_benevole set valable_du = now() - interval '1 day', valable_jusqu_au = now()
  where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.scan_exiger_acces(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000b1')$$, 'P0001', 'KS_DROIT_REFUSE', 'à la borne de fin (minuit suivant) : refusé');
update public.acces_benevole set valable_du = now() - interval '2 days', valable_jusqu_au = now() - interval '1 second'
  where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.scan_exiger_acces(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000b1')$$, 'P0001', 'KS_DROIT_REFUSE', 'après la fenêtre, tâche non passée : refusé quand même');
select throws_ok(
  $$select public.scanner_pass(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000b1', null, 'ZZZZZZZ9')$$, 'P0001', 'KS_DROIT_REFUSE',
  'scanner_pass refuse un bénévole dont l''accès est échu, même non supprimé'
);
select is(public.acces_scan_valide('00000000-0000-0000-0000-0000000000a3', '00000000-0000-4000-8000-0000000000b1'), false, 'acces_scan_valide : faux après la fenêtre');
select is(
  (select valide from public.lire_acces_benevole_compte('00000000-0000-0000-0000-0000000000a3') where evenement_id = '00000000-0000-4000-8000-0000000000b1'),
  false, 'la lecture par Compte annonce l''accès comme non valide'
);

-- Accès limité à son Événement : a3 est valable sur ev1 mais pas ailleurs.
update public.acces_benevole set valable_du = now() - interval '1 hour', valable_jusqu_au = now() + interval '1 hour'
  where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1';
select lives_ok($$select public.scan_exiger_acces(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000b1')$$, 'le bénévole passe pour son Événement');
select throws_ok($$select public.scan_exiger_acces(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000b2')$$, 'P0001', 'KS_DROIT_REFUSE', 'refusé pour un autre Événement');
select throws_ok($$select public.scan_exiger_acces(pg_temp.benevole(), null)$$, 'P0001', 'KS_DROIT_REFUSE', 'refusé sans Événement');
select throws_ok($$select public.scanner_pass(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000b2', null, 'ZZZZZZZ9')$$, 'P0001', 'KS_DROIT_REFUSE', 'scanner_pass refuse le bénévole sur un autre Événement');
select throws_ok($$select public.scan_exiger_acces(pg_temp.autre(), '00000000-0000-4000-8000-0000000000b1')$$, 'P0001', 'KS_DROIT_REFUSE', 'l''accès d''un autre bénévole ne vaut pas pour ce Compte');

-- Aucun rôle n'est créé, et un rôle « bénévole » de la table de rôles ne donne aucun accès au Scan.
select is((select count(*)::int from public.role_utilisateur where compte = '00000000-0000-0000-0000-0000000000a3'), 0, 'l''accès ne crée aucune ligne dans la table des rôles');
select is(public.a_le_role('00000000-0000-0000-0000-0000000000a3', 'benevole', '00000000-0000-4000-8000-0000000000b1'), false, 'a_le_role ne reconnaît pas l''accès par Événement');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a4', 'benevole');
select throws_ok($$select public.scan_exiger_acces(pg_temp.faux_admin(), '00000000-0000-4000-8000-0000000000b1')$$, 'P0001', 'KS_DROIT_REFUSE', 'un rôle « benevole » global, sans accès par Événement, ne scanne pas');
select throws_ok($$select public.scan_exiger_acces(pg_temp.assistant(), '00000000-0000-4000-8000-0000000000b1')$$, 'P0001', 'KS_DROIT_REFUSE', 'l''Assistant ne scanne pas');
select lives_ok($$select public.scan_exiger_acces(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b2')$$, 'l''Admin scanne pour tout Événement');
select throws_ok($$select public.scan_exiger_acces(null, '00000000-0000-4000-8000-0000000000b1')$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'sans auteur : refusé');

-- Un bénévole ne peut appeler AUCUNE fonction réservée à l'Admin.
select throws_ok($$select public.attribuer_role(pg_temp.autre(), '00000000-0000-0000-0000-0000000000a5', 'admin')$$, 'P0001', 'KS_DROIT_REFUSE', 'un bénévole ne peut pas se donner le rôle admin');
select throws_ok($$select public.enregistrer_reglage(pg_temp.autre(), 'nom_site', 'TEST_Pirate')$$, 'P0001', 'KS_DROIT_REFUSE', 'un bénévole ne peut pas écrire un réglage');
select throws_ok($$select public.corriger_age(pg_temp.autre(), '00000000-0000-0000-0000-0000000000a4', 30, 'TEST raison')$$, 'P0001', 'KS_DROIT_REFUSE', 'un bénévole ne peut pas corriger un âge');
select throws_ok($$select public.attribuer_acces_benevole(pg_temp.autre(), '00000000-0000-4000-8000-0000000000b6', 'test-bn-simple@example.invalid')$$, 'P0001', 'KS_DROIT_REFUSE', 'un bénévole ne peut pas donner l''accès à un autre');
select throws_ok($$select public.retirer_acces_benevole(pg_temp.autre(), '00000000-0000-4000-8000-0000000000b6', gen_random_uuid())$$, 'P0001', 'KS_DROIT_REFUSE', 'un bénévole ne peut pas retirer un accès');
select throws_ok($$select * from public.lister_acces_benevoles(pg_temp.autre(), '00000000-0000-4000-8000-0000000000b6')$$, 'P0001', 'KS_DROIT_REFUSE', 'un bénévole ne peut pas lister les accès (ni voir des emails)');
select throws_ok($$select public.compter_alertes_evenement(pg_temp.autre(), '00000000-0000-4000-8000-0000000000b6')$$, 'P0001', 'KS_DROIT_REFUSE', 'un bénévole ne lit pas les alertes d''un Événement');
select throws_ok($$select public.exporter_alertes_whatsapp(pg_temp.autre(), '00000000-0000-4000-8000-0000000000b6')$$, 'P0001', 'KS_DROIT_REFUSE', 'un bénévole n''exporte pas les numéros WhatsApp');
select throws_ok($$select public.exiger_admin(pg_temp.autre())$$, 'P0001', 'KS_DROIT_REFUSE', 'exiger_admin refuse un bénévole, même avec un accès valable');
select is(public.a_le_role('00000000-0000-0000-0000-0000000000a5', 'admin'), false, 'le bénévole n''a pas le rôle admin');
select is(public.a_le_role('00000000-0000-0000-0000-0000000000a5', 'assistant'), false, 'le bénévole n''a pas le rôle assistant');

-- Lecture : l'Admin voit les accès de CET Événement avec l'email ; les autres Événements ne s'y mêlent pas.
select is((select count(*)::int from public.lister_acces_benevoles(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b1')), 1, 'la liste ne montre que les accès de cet Événement');
select is((select email from public.lister_acces_benevoles(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b1')), 'test-bn-benevole@example.invalid', 'l''Admin voit l''email du bénévole');
select throws_ok($$select * from public.lister_acces_benevoles(pg_temp.assistant(), '00000000-0000-4000-8000-0000000000b1')$$, 'P0001', 'KS_DROIT_REFUSE', 'l''Assistant ne liste pas les accès');
select is((select count(*)::int from public.lire_acces_benevole_compte('00000000-0000-0000-0000-0000000000a5')), 1, 'la lecture par Compte ne rend que les accès de ce Compte');

-- Date de l'Événement modifiée : le déclencheur recalcule la fenêtre (même règle que l'attribution), sans email dans le journal.
update public.evenement set debut_le = '2027-03-11 09:00:00+02' where id = '00000000-0000-4000-8000-0000000000b1';
select is(
  (select valable_du from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1'),
  '2027-03-10 22:00:00+00'::timestamptz, 'changement de date : la fenêtre suit le nouveau jour'
);
select is((public.attribuer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b1', 'test-bn-benevole@example.invalid')) ->> 'statut', 'deja', 'la fenêtre est déjà à jour : la réattribution ne change rien');
select ok(exists (select 1 from public.journal_audit where action = 'acces_benevole_fenetre_recalculee'), 'le recalcul de la fenêtre est journalisé');
update public.evenement set fin_le = '2027-03-12 10:00:00+02' where id = '00000000-0000-4000-8000-0000000000b1';
select is(
  (select valable_jusqu_au from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1'),
  '2027-03-12 22:00:00+00'::timestamptz, 'une fin ajoutée prolonge la fenêtre jusqu''à la fin du dernier jour'
);
update public.evenement set debut_le = null, fin_le = null where id = '00000000-0000-4000-8000-0000000000b1';
select ok(
  (select valable_jusqu_au = valable_du from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1'),
  'sans date d''Événement, la fenêtre devient vide (jamais élargie)'
);
select throws_ok($$select public.scan_exiger_acces(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000b1')$$, 'P0001', 'KS_DROIT_REFUSE', 'sans date d''Événement, l''accès est invalide');
update public.evenement set debut_le = '2027-03-11 09:00:00+02', fin_le = null where id = '00000000-0000-4000-8000-0000000000b1';
select ok(
  (select valable_du = '2027-03-10 22:00:00+00'::timestamptz and valable_jusqu_au = '2027-03-11 22:00:00+00'::timestamptz
     from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1'),
  'la date rétablie rétablit la fenêtre (sans fin : jusqu''à minuit le jour du début)'
);

-- Email non confirmé : traité comme « sans compte » (un tiers pourrait avoir créé ce Compte).
select is((public.attribuer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b2', 'test-bn-nonconfirme@example.invalid')) ->> 'statut', 'sans_compte', 'email non confirmé : état « sans compte »');
select is((select count(*)::int from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000a6'), 0, 'aucun accès pour un Compte à email non confirmé');

-- Retrait.
select is(public.retirer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b2', (select id from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1')), false, 'retirer avec un autre Événement ne retire rien');
select throws_ok($$select public.retirer_acces_benevole(pg_temp.assistant(), '00000000-0000-4000-8000-0000000000b3', gen_random_uuid())$$, 'P0001', 'KS_DROIT_REFUSE', 'l''Assistant ne retire pas');
select is(public.retirer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000b3', (select id from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b3')), true, 'l''Admin retire un accès');
select is((select count(*)::int from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b3'), 0, 'l''accès retiré n''existe plus');
select throws_ok($$select public.scan_exiger_acces(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000b3')$$, 'P0001', 'KS_DROIT_REFUSE', 'un accès retiré ne donne plus rien');

-- Tâche de suppression : seuls les accès échus partent ; les accès valables restent. Le contrôle refusait déjà l'accès échu avant son passage.
update public.acces_benevole set valable_du = now() - interval '2 days', valable_jusqu_au = now() - interval '1 second'
  where compte_id = '00000000-0000-0000-0000-0000000000a3' and evenement_id = '00000000-0000-4000-8000-0000000000b1';
select throws_ok($$select public.scan_exiger_acces(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000b1')$$, 'P0001', 'KS_DROIT_REFUSE', 'échu et pas encore supprimé : déjà refusé');
select is(public.supprimer_acces_benevoles_echus(), 1, 'la tâche supprime l''accès échu et lui seul');
select is((select count(*)::int from public.acces_benevole), 1, 'l''accès encore valable reste');
select lives_ok($$select public.scan_exiger_acces(pg_temp.autre(), '00000000-0000-4000-8000-0000000000b6')$$, 'le bénévole encore valable passe toujours après la tâche');
select is(public.supprimer_acces_benevoles_echus(), 0, 'la tâche rejouée ne supprime rien de plus');
select ok(exists (select 1 from public.journal_audit where action = 'acces_benevole_echu_supprime' and auteur ->> 'nom' = 'supprimer_acces_benevoles_echus'), 'la suppression par la tâche est journalisée au nom du système');
select throws_ok($$select public.scan_exiger_acces(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000b1')$$, 'P0001', 'KS_DROIT_REFUSE', 'après la tâche, le bénévole n''a plus accès');

-- Journal : jamais l'email.
select ok(exists (select 1 from public.journal_audit where action = 'acces_benevole_attribue' and auteur ->> 'id' = '00000000-0000-0000-0000-0000000000a1'), 'l''attribution est journalisée avec son auteur');
select ok(exists (select 1 from public.journal_audit where action = 'acces_benevole_retire'), 'le retrait est journalisé');
select is(
  (select count(*)::int from public.journal_audit where (action like 'acces_benevole%' or cible_table = 'acces_benevole') and (journal_audit::text ilike '%example.invalid%' or journal_audit::text like '%@%')),
  0, 'le journal ne contient jamais l''email du bénévole'
);

-- Suppression d'un Compte ou d'un Événement : l'accès disparaît sans bloquer la suppression.
select lives_ok($$delete from auth.users where id = '00000000-0000-0000-0000-0000000000a5'$$, 'supprimer le Compte d''un bénévole n''est pas bloqué');
select is((select count(*)::int from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000a5'), 0, 'son accès disparaît avec son Compte');

select * from finish();
rollback;
