-- Story 7.6 : scan en ligne. scanner_pass passe un Pass « valide » à « scanne » (jeton du Code QR ou code court équivalents), refuse avec une raison
-- (inconnu, deja_scanne avec l'heure du premier scan, annule, rembourse, autre_evenement, commande_non_payee), réserve le scan à l'Admin, reste fermée aux clients
-- et journalise chaque scan sans jeton, sans code court et sans nom. Données TEST_ annulées à la fin.
-- Concurrence : un test SQL ne peut ouvrir qu'une session ; la garantie de deux scans simultanés repose sur le verrou « for update » de la ligne du Pass
-- (le second relit la ligne après le premier et trouve « scanne »). Une assertion vérifie que la fonction pose bien ce verrou.
-- Exécuté par la CI (Docker) ; en local, `npm run test:sql` explique l'absence de Docker et sort sans erreur.
begin;
select plan(44);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'test-sc1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'test-sc2@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000d1', 'admin');
create function pg_temp.admin() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":"admin"}'::jsonb $$;
create function pg_temp.simple() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000d2","role":null}'::jsonb $$;
create function pg_temp.faux_admin() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000d2","role":"admin"}'::jsonb $$;
create function pg_temp.scan_jeton(p_ev uuid, p_jeton text) returns jsonb language sql as $$ select public.scanner_pass(pg_temp.admin(), p_ev, p_jeton, null) $$;
create function pg_temp.scan_code(p_ev uuid, p_code text) returns jsonb language sql as $$ select public.scanner_pass(pg_temp.admin(), p_ev, null, p_code) $$;

insert into public.evenement (id, auteur_id, titre_fr, titre_en, slug, publie_le, debut_le) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', 'TEST_Festival', 'TEST_Festival EN', 'test-sc-ev1', now() - interval '2 days', now() + interval '1 day'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-0000000000d1', 'TEST_Autre', null, 'test-sc-ev2', now() - interval '2 days', now() + interval '1 day');
insert into public.type_pass (id, evenement_id, nom_fr, nom_en, prix_cents) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'TEST_VIP', 'TEST_VIP EN', 3000),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a2', 'TEST_Simple', 'TEST_Simple', 1500);

-- Une Commande de Pass par Pass (c1 porte deux Pass ; c2 est offerte).
insert into public.commande (id, numero, compte_id, type, statut, offerte, sous_total_cents, total_cents, paye_le) values
  ('00000000-0000-4000-8000-0000000000c1', 'KS-2026-830001', '00000000-0000-0000-0000-0000000000d2', 'pass', 'payee', false, 6000, 6000, now()),
  ('00000000-0000-4000-8000-0000000000c2', 'KS-2026-830002', '00000000-0000-0000-0000-0000000000d2', 'pass', 'offerte', true, 0, 0, null),
  ('00000000-0000-4000-8000-0000000000c3', 'KS-2026-830003', '00000000-0000-0000-0000-0000000000d2', 'pass', 'payee', false, 3000, 3000, now()),
  ('00000000-0000-4000-8000-0000000000c4', 'KS-2026-830004', '00000000-0000-0000-0000-0000000000d2', 'pass', 'payee', false, 3000, 3000, now()),
  ('00000000-0000-4000-8000-0000000000c5', 'KS-2026-830005', '00000000-0000-0000-0000-0000000000d2', 'pass', 'payee', false, 3000, 3000, now()),
  ('00000000-0000-4000-8000-0000000000c6', 'KS-2026-830006', '00000000-0000-0000-0000-0000000000d2', 'pass', 'payee', false, 1500, 1500, now()),
  ('00000000-0000-4000-8000-0000000000c7', 'KS-2026-830007', '00000000-0000-0000-0000-0000000000d2', 'pass', 'payee', false, 3000, 3000, now()),
  ('00000000-0000-4000-8000-0000000000c8', 'KS-2026-830008', '00000000-0000-0000-0000-0000000000d2', 'pass', 'payee', false, 3000, 3000, now());
insert into public.ligne_commande (id, commande_id, produit_id, nombre, prix_cents, type_pass_id, titulaires, pass_nom_fr, pass_nom_en, est_stand)
select ('00000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid, ('00000000-0000-4000-8000-0000000000c' || n)::uuid, null, 1, 3000,
  case when n = 6 then '00000000-0000-4000-8000-0000000000b2'::uuid else '00000000-0000-4000-8000-0000000000b1'::uuid end, '["x"]'::jsonb, 'TEST_VIP', 'TEST_VIP', false
from generate_series(1, 8) n;

-- Pass (jeton de 48 caractères hexadécimaux, code court de l'alphabet à 32 caractères). f01, f02 : c1 ; f03 : offerte ; f04 annulé ; f05 remboursé ;
-- f06 valide mais dont la Commande changera de statut ; f07 : autre Événement ; f08 : refusé à un non-admin ; f09 : scanné par le serveur.
insert into public.pass (id, evenement_id, type_pass_id, commande_id, ligne_commande_id, rang, nom_titulaire, statut, jeton, code_court) values
  ('00000000-0000-4000-8000-000000000f01', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000101', 1, 'Alice Test', 'valide', repeat('1a', 24), 'AAAAAAA2'),
  ('00000000-0000-4000-8000-000000000f02', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-000000000101', 2, 'Bob Test', 'valide', repeat('2b', 24), 'KMNP2345'),
  ('00000000-0000-4000-8000-000000000f03', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-000000000102', 1, 'Cleo Offerte', 'valide', repeat('3c', 24), 'BBBBBBB3'),
  ('00000000-0000-4000-8000-000000000f04', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-000000000103', 1, 'Dan Annule', 'annule', repeat('4d', 24), 'CCCCCCC4'),
  ('00000000-0000-4000-8000-000000000f05', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-000000000104', 1, 'Eve Remboursee', 'rembourse', repeat('5e', 24), 'DDDDDDD5'),
  ('00000000-0000-4000-8000-000000000f06', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c5', '00000000-0000-4000-8000-000000000105', 1, 'Fay Commande', 'valide', repeat('6f', 24), 'EEEEEEE6'),
  ('00000000-0000-4000-8000-000000000f07', '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000c6', '00000000-0000-4000-8000-000000000106', 1, 'Gus Ailleurs', 'valide', repeat('70', 24), 'FFFFFFF7'),
  ('00000000-0000-4000-8000-000000000f08', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c7', '00000000-0000-4000-8000-000000000107', 1, 'Hal Interdit', 'valide', repeat('81', 24), 'GGGGGGG8'),
  ('00000000-0000-4000-8000-000000000f09', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c8', '00000000-0000-4000-8000-000000000108', 1, 'Ida Serveur', 'valide', repeat('92', 24), 'HHHHHHH9');

-- Droits de la fonction.
select ok(
  has_function_privilege('service_role', 'public.scanner_pass(jsonb, uuid, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.scanner_pass(jsonb, uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.scanner_pass(jsonb, uuid, text, text)', 'execute'),
  'scanner_pass est réservée au serveur'
);
select is(
  (select count(*)::int from unnest(array['public.scan_exiger_acces(jsonb, uuid)']) f
    where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or has_function_privilege('service_role', f, 'execute')),
  0, 'le contrôle d''accès au scan est interne (fermé à tous les rôles)'
);
select ok(position('for update' in lower(pg_get_functiondef('public.scanner_pass(jsonb, uuid, text, text)'::regprocedure))) > 0, 'le Pass est verrouillé (for update) avant d''être relu et modifié');

-- Scan valide par le jeton du Code QR.
create temp table r1 as select pg_temp.scan_jeton('00000000-0000-4000-8000-0000000000a1', repeat('1a', 24)) as r;
select is((select r ->> 'resultat' from r1), 'valide', 'Pass valide scanné par son jeton : VALIDE');
select is((select r ->> 'nom' from r1), 'Alice Test', 'le nom du titulaire est rendu');
select is((select (r ->> 'evenement_fr') || '|' || (r ->> 'type_pass_fr') || '|' || (r ->> 'type_pass_en') from r1), 'TEST_Festival|TEST_VIP|TEST_VIP EN', 'l''Événement et le Type de pass sont rendus');
select ok(
  (select statut = 'scanne' and scanne_le is not null and scanne_par = '00000000-0000-0000-0000-0000000000d1' from public.pass where id = '00000000-0000-4000-8000-000000000f01'),
  'le Pass est « scanne », avec l''heure et l''auteur du scan'
);

-- Double scan.
create temp table r2 as select pg_temp.scan_jeton('00000000-0000-4000-8000-0000000000a1', repeat('1a', 24)) as r;
select is((select r ->> 'raison' from r2), 'deja_scanne', 'second scan du même Pass : REFUSÉ, déjà scanné');
select is((select (r ->> 'scanne_le')::timestamptz from r2), (select scanne_le from public.pass where id = '00000000-0000-4000-8000-000000000f01'), 'le refus rend l''heure du premier scan');
select ok((select scanne_le <= now() and scanne_le = (select (r ->> 'scanne_le')::timestamptz from r2) from public.pass where id = '00000000-0000-4000-8000-000000000f01'), 'l''heure du premier scan n''est pas modifiée par le second');
select is(pg_temp.scan_code('00000000-0000-4000-8000-0000000000a1', 'aaaa-aaa2') ->> 'raison', 'deja_scanne', 'le code court du même Pass donne le même refus (code court équivalent au jeton)');

-- Code court : normalisé (majuscules, sans espaces ni tirets).
select is(pg_temp.scan_code('00000000-0000-4000-8000-0000000000a1', ' kmnp-23 45 ') ->> 'resultat', 'valide', 'code court saisi en minuscules, avec espaces et tiret : VALIDE');
select is(pg_temp.scan_jeton('00000000-0000-4000-8000-0000000000a1', repeat('2b', 24)) ->> 'raison', 'deja_scanne', 'le jeton du Pass scanné par code court est refusé ensuite');
select is(pg_temp.scan_jeton('00000000-0000-4000-8000-0000000000a1', upper(repeat('3c', 24))) ->> 'resultat', 'valide', 'jeton en majuscules accepté (Pass d''une Commande offerte)');

-- Raisons de refus.
select is(pg_temp.scan_jeton('00000000-0000-4000-8000-0000000000a1', repeat('4d', 24)) ->> 'raison', 'annule', 'Pass annulé : REFUSÉ');
select is(pg_temp.scan_code('00000000-0000-4000-8000-0000000000a1', 'DDDDDDD5') ->> 'raison', 'rembourse', 'Pass remboursé : REFUSÉ');
select is(pg_temp.scan_jeton('00000000-0000-4000-8000-0000000000a1', repeat('70', 24)) ->> 'raison', 'autre_evenement', 'Pass d''un autre Événement : REFUSÉ');
select is((select statut from public.pass where id = '00000000-0000-4000-8000-000000000f07'), 'valide', 'le Pass refusé pour un autre Événement reste valide');
update public.commande set statut = 'remboursee' where id = '00000000-0000-4000-8000-0000000000c5';
select is(pg_temp.scan_jeton('00000000-0000-4000-8000-0000000000a1', repeat('6f', 24)) ->> 'raison', 'commande_non_payee', 'Commande remboursée : REFUSÉ même si le Pass est encore « valide »');
update public.commande set statut = 'annulee' where id = '00000000-0000-4000-8000-0000000000c5';
select is(pg_temp.scan_jeton('00000000-0000-4000-8000-0000000000a1', repeat('6f', 24)) ->> 'raison', 'commande_non_payee', 'Commande annulée : REFUSÉ');
update public.commande set statut = 'expiree' where id = '00000000-0000-4000-8000-0000000000c5';
select is(pg_temp.scan_jeton('00000000-0000-4000-8000-0000000000a1', repeat('6f', 24)) ->> 'raison', 'commande_non_payee', 'Commande expirée : REFUSÉ');
update public.commande set statut = 'en_attente' where id = '00000000-0000-4000-8000-0000000000c5';
select is(pg_temp.scan_jeton('00000000-0000-4000-8000-0000000000a1', repeat('6f', 24)) ->> 'raison', 'commande_non_payee', 'Commande non payée : REFUSÉ');
select is((select statut from public.pass where id = '00000000-0000-4000-8000-000000000f06'), 'valide', 'un Pass refusé reste « valide » (rien n''est modifié)');
update public.commande set statut = 'payee' where id = '00000000-0000-4000-8000-0000000000c5';
select is(pg_temp.scan_jeton('00000000-0000-4000-8000-0000000000a1', repeat('6f', 24)) ->> 'resultat', 'valide', 'Commande de nouveau payée : le même Pass est VALIDE (le refus venait de la Commande)');

-- Inconnus : aucune différence entre un code absent et un code mal formé.
select is(pg_temp.scan_jeton('00000000-0000-4000-8000-0000000000a1', repeat('ee', 24)) ->> 'raison', 'inconnu', 'jeton bien formé mais absent : inconnu');
select is(pg_temp.scan_jeton('00000000-0000-4000-8000-0000000000a1', 'pas-un-jeton') ->> 'raison', 'inconnu', 'jeton mal formé : inconnu');
select is(pg_temp.scan_code('00000000-0000-4000-8000-0000000000a1', 'ZZZZZZZ9') ->> 'raison', 'inconnu', 'code court bien formé mais absent : inconnu');
select is(pg_temp.scan_code('00000000-0000-4000-8000-0000000000a1', 'AB01') ->> 'raison', 'inconnu', 'code court mal formé : inconnu');
select throws_ok($$select public.scanner_pass(pg_temp.admin(), '00000000-0000-4000-8000-0000000000a1', null, null)$$, 'P0001', 'KS_SCAN_ARGUMENT', 'ni jeton ni code : refusé');
select throws_ok($$select public.scanner_pass(pg_temp.admin(), '00000000-0000-4000-8000-0000000000a1', repeat('1a', 24), 'AAAAAAA2')$$, 'P0001', 'KS_SCAN_ARGUMENT', 'jeton et code ensemble : refusé');

-- Droit de scanner : Admin seulement (point d'extension de la story 7.7).
select throws_ok($$select public.scanner_pass(pg_temp.simple(), '00000000-0000-4000-8000-0000000000a1', repeat('81', 24), null)$$, 'P0001', 'KS_DROIT_REFUSE', 'un Compte sans rôle ne scanne pas');
select throws_ok($$select public.scanner_pass(pg_temp.faux_admin(), '00000000-0000-4000-8000-0000000000a1', repeat('81', 24), null)$$, 'P0001', 'KS_DROIT_REFUSE', 'le rôle écrit dans l''auteur n''est jamais cru');
select throws_ok($$select public.scanner_pass('{"type":"visiteur"}'::jsonb, '00000000-0000-4000-8000-0000000000a1', repeat('81', 24), null)$$, 'P0001', 'KS_DROIT_REFUSE', 'un visiteur ne scanne pas');
select throws_ok($$select public.scanner_pass(null, '00000000-0000-4000-8000-0000000000a1', repeat('81', 24), null)$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'sans auteur : refusé');
select is((select statut from public.pass where id = '00000000-0000-4000-8000-000000000f08'), 'valide', 'les scans refusés au non-admin n''ont rien modifié');

-- Fonction fermée aux clients ; le serveur seul l'appelle (auteurs écrits en clair : le schéma temporaire n'est pas lisible par ces rôles).
set local role anon;
select throws_ok($$select public.scanner_pass('{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":"admin"}'::jsonb, '00000000-0000-4000-8000-0000000000a1', repeat('81', 24), null)$$, '42501', null, 'anon ne peut pas appeler scanner_pass');
reset role;
set local role authenticated;
select throws_ok($$select public.scanner_pass('{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":"admin"}'::jsonb, '00000000-0000-4000-8000-0000000000a1', repeat('81', 24), null)$$, '42501', null, 'authenticated ne peut pas appeler scanner_pass');
reset role;
set local role service_role;
select is(public.scanner_pass('{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":"admin"}'::jsonb, '00000000-0000-4000-8000-0000000000a1', repeat('92', 24), null) ->> 'resultat', 'valide', 'le serveur (service_role) appelle scanner_pass avec un auteur Admin');
reset role;

-- Journal : une ligne par scan, sans secret ni nom.
select ok(exists (select 1 from public.journal_audit where action = 'scan' and cible_table = 'pass' and cible_id = '00000000-0000-4000-8000-000000000f01' and apres ->> 'resultat' = 'valide'), 'le scan accepté est journalisé');
select ok(exists (select 1 from public.journal_audit where action = 'scan' and cible_id = '00000000-0000-4000-8000-000000000f01' and apres ->> 'raison' = 'deja_scanne'), 'le scan refusé est journalisé avec sa raison');
select ok(exists (select 1 from public.journal_audit where action = 'scan' and cible_id = 'inconnu' and apres ->> 'raison' = 'inconnu'), 'un code inconnu est journalisé sans identifiant de Pass');
select is(
  (select count(*)::int from public.journal_audit j cross join public.pass p
    where (j.cible_table = 'pass' or j.action = 'scan')
      and (j::text like '%' || p.jeton || '%' or j::text like '%' || p.code_court || '%' or j::text like '%' || p.nom_titulaire || '%')),
  0, 'le journal ne contient ni jeton, ni code court, ni nom de titulaire'
);
select is(
  (select count(*)::int from public.journal_audit j where j.cible_table = 'pass' and (j::text like '%' || repeat('ee', 24) || '%' or j::text like '%ZZZZZZZ9%' or j::text like '%pas-un-jeton%' or j::text like '%AB01%')),
  0, 'la saisie d''un code inconnu n''est pas journalisée'
);
select is((select count(*)::int from public.journal_audit where action = 'scan' and auteur ->> 'id' = '00000000-0000-0000-0000-0000000000d2'), 0, 'un scan refusé pour manque de droit n''écrit aucune ligne de journal');

select * from finish();
rollback;
