-- Story 7.8 : Scan hors ligne. Verrou hors ligne (un seul actif par Événement), liste réduite aux Pass « valide » de l'Événement (empreintes, jamais de secret
-- en clair), droits (Admin, bénévole de son Événement dans sa fenêtre, rien pour les autres), scanner_pass refuse un autre appareil tant que le Verrou est tenu,
-- synchronisation idempotente avec conflits sans écrasement, libération, libération forcée (anomalie), expiration, journal sans secret, fonctions fermées
-- aux clients. Données TEST_ annulées à la fin.
-- Une seule transaction : now() est constant (début de transaction) ; les fenêtres sont donc posées par rapport à lui.
-- Exécuté par la CI (Docker) ; en local, `npm run test:sql` explique l'absence de Docker et sort sans erreur.
begin;
select plan(102);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-hl1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-hl2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e3', 'test-hl3@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e4', 'test-hl4@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e5', 'test-hl5@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e1', 'admin');

-- Auteurs : e1 Admin, e2 bénévole de l'Événement 1 (fenêtre ouverte), e3 bénévole de l'Événement 2 seulement, e4 bénévole de l'Événement 1 hors fenêtre,
-- e5 Compte sans droit. Le rôle écrit dans l'auteur n'est jamais cru.
create function pg_temp.aut(p_compte text, p_appareil text default null) returns jsonb language sql as $$
  select jsonb_build_object('type', 'compte', 'id', p_compte, 'role', null) || case when p_appareil is null then '{}'::jsonb else jsonb_build_object('appareil', p_appareil) end
$$;
create function pg_temp.admin(p_appareil text default null) returns jsonb language sql as $$ select pg_temp.aut('00000000-0000-0000-0000-0000000000e1', p_appareil) $$;
create function pg_temp.benevole(p_appareil text default null) returns jsonb language sql as $$ select pg_temp.aut('00000000-0000-0000-0000-0000000000e2', p_appareil) $$;
create function pg_temp.empreinte(p_jeton text) returns text language sql as $$ select encode(extensions.digest(p_jeton, 'sha256'), 'hex') $$;
create function pg_temp.hmac_code(p_code text, p_cle text) returns text language sql as $$ select encode(extensions.hmac(convert_to(p_code, 'UTF8'), decode(p_cle, 'hex'), 'sha256'), 'hex') $$;
create function pg_temp.sid(p_n integer) returns uuid language sql as $$ select ('00000000-0000-4000-8000-0000000005' || lpad(p_n::text, 2, '0'))::uuid $$;
create function pg_temp.scan(p_n integer, p_nature text, p_emp text, p_t timestamptz) returns jsonb language sql as $$
  select jsonb_build_object('id', pg_temp.sid(p_n), 'nature', p_nature, 'empreinte', p_emp, 'scanne_le', to_char(p_t at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
$$;

insert into public.evenement (id, auteur_id, titre_fr, titre_en, slug, publie_le, debut_le) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', 'TEST_Festival', 'TEST_Festival EN', 'test-hl-ev1', now() - interval '2 days', now() + interval '1 day'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-0000000000e1', 'TEST_Autre', null, 'test-hl-ev2', now() - interval '2 days', now() + interval '1 day');
insert into public.type_pass (id, evenement_id, nom_fr, nom_en, prix_cents) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'TEST_VIP', 'TEST_VIP EN', 3000),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a2', 'TEST_Simple', 'TEST_Simple', 1500);
insert into public.acces_benevole (compte_id, evenement_id, valable_du, valable_jusqu_au, cree_par) values
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-4000-8000-0000000000a1', now() - interval '1 hour', now() + interval '1 day', '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-4000-8000-0000000000a2', now() - interval '1 hour', now() + interval '1 day', '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-4000-8000-0000000000a1', now() - interval '2 days', now() - interval '1 day', '00000000-0000-0000-0000-0000000000e1');

-- Jeu de Pass : un par Commande. n, nom, statut du Pass, jeton (48 hexadécimaux), code court, Événement (1 ou 2), statut de la Commande.
create temp table jeu as
select * from (values
  (1,  'Alice Test',  'valide',    repeat('1a', 24), 'AAAAAAA2', 1, 'payee'),
  (2,  'Bob Test',    'valide',    repeat('2b', 24), 'KMNP2345', 1, 'payee'),
  (3,  'Cleo Offerte','valide',    repeat('3c', 24), 'BBBBBBB3', 1, 'offerte'),
  (4,  'Dan Annule',  'annule',    repeat('4d', 24), 'CCCCCCC4', 1, 'payee'),
  (5,  'Eve Remb',    'rembourse', repeat('5e', 24), 'DDDDDDD5', 1, 'payee'),
  (6,  'Fay Commande','valide',    repeat('6f', 24), 'EEEEEEE6', 1, 'annulee'),
  (7,  'Gus Ailleurs','valide',    repeat('70', 24), 'FFFFFFF7', 2, 'payee'),
  (8,  'Hal Scanne',  'scanne',    repeat('81', 24), 'GGGGGGG8', 1, 'payee'),
  (9,  'Ida Annulee', 'valide',    repeat('92', 24), 'HHHHHHH9', 1, 'payee'),
  (10, 'Jo Ailleurs', 'valide',    repeat('a3', 24), 'JJJJJJJ2', 1, 'payee'),
  (11, 'Kim EnLigne', 'valide',    repeat('b4', 24), 'KKKKKKK3', 1, 'payee'),
  (12, 'Lou Ordre',   'valide',    repeat('c5', 24), 'LLLLLLL4', 1, 'payee'),
  (13, 'Max Futur',   'valide',    repeat('d6', 24), 'MMMMMMM5', 1, 'payee'),
  (14, 'Ned Passe',   'valide',    repeat('e7', 24), 'NNNNNNN6', 1, 'payee'),
  (15, 'Oda Force',   'valide',    repeat('f8', 24), 'PPPPPPP7', 1, 'payee')
) as j(n, nom, statut, jeton, code, ev, cmd);

insert into public.commande (id, numero, compte_id, type, statut, offerte, sous_total_cents, total_cents, paye_le)
select ('00000000-0000-4000-8000-00000000c0' || lpad(to_hex(n), 2, '0'))::uuid, 'KS-2026-84' || lpad(n::text, 4, '0'), '00000000-0000-0000-0000-0000000000e5', 'pass', cmd,
  cmd = 'offerte', case when cmd = 'offerte' then 0 else 3000 end, case when cmd = 'offerte' then 0 else 3000 end, case when cmd = 'offerte' then null else now() end
from jeu;
insert into public.ligne_commande (id, commande_id, produit_id, nombre, prix_cents, type_pass_id, titulaires, pass_nom_fr, pass_nom_en, est_stand)
select ('00000000-0000-4000-8000-00000000d0' || lpad(to_hex(n), 2, '0'))::uuid, ('00000000-0000-4000-8000-00000000c0' || lpad(to_hex(n), 2, '0'))::uuid, null, 1, 3000,
  case when ev = 2 then '00000000-0000-4000-8000-0000000000b2'::uuid else '00000000-0000-4000-8000-0000000000b1'::uuid end, '["x"]'::jsonb, 'TEST_VIP', 'TEST_VIP', false
from jeu;
insert into public.pass (id, evenement_id, type_pass_id, commande_id, ligne_commande_id, rang, nom_titulaire, statut, jeton, code_court, scanne_le)
select ('00000000-0000-4000-8000-00000000f0' || lpad(to_hex(n), 2, '0'))::uuid,
  case when ev = 2 then '00000000-0000-4000-8000-0000000000a2'::uuid else '00000000-0000-4000-8000-0000000000a1'::uuid end,
  case when ev = 2 then '00000000-0000-4000-8000-0000000000b2'::uuid else '00000000-0000-4000-8000-0000000000b1'::uuid end,
  ('00000000-0000-4000-8000-00000000c0' || lpad(to_hex(n), 2, '0'))::uuid, ('00000000-0000-4000-8000-00000000d0' || lpad(to_hex(n), 2, '0'))::uuid,
  1, nom, statut, jeton, code, case when statut = 'scanne' then now() - interval '1 hour' end
from jeu;
create function pg_temp.pass_id(p_n integer) returns uuid language sql as $$ select ('00000000-0000-4000-8000-00000000f0' || lpad(to_hex(p_n), 2, '0'))::uuid $$;
create function pg_temp.jeton(p_n integer) returns text language sql as $$ select jeton from jeu where n = p_n $$;
create function pg_temp.code(p_n integer) returns text language sql as $$ select code from jeu where n = p_n $$;

-- 1-3. Droits d'exécution : serveur seulement ; les fonctions internes sont fermées à tous les rôles.
select is(
  (select count(*)::int from unnest(array[
    'public.prendre_verrou(jsonb, uuid, text)', 'public.telecharger_liste_hors_ligne(jsonb, uuid, text)', 'public.synchroniser_scans(jsonb, uuid, text, jsonb)',
    'public.liberer_verrou(jsonb, uuid, text)', 'public.forcer_liberation_verrou(jsonb, uuid)', 'public.lire_etat_verrou(jsonb, uuid, text)',
    'public.lire_verrou_evenement(jsonb, uuid)']) f
    where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')),
  0, 'aucune fonction du Verrou n''est exécutable par anon ni authenticated'
);
select is(
  (select count(*)::int from unnest(array[
    'public.prendre_verrou(jsonb, uuid, text)', 'public.telecharger_liste_hors_ligne(jsonb, uuid, text)', 'public.synchroniser_scans(jsonb, uuid, text, jsonb)',
    'public.liberer_verrou(jsonb, uuid, text)', 'public.forcer_liberation_verrou(jsonb, uuid)', 'public.lire_etat_verrou(jsonb, uuid, text)',
    'public.lire_verrou_evenement(jsonb, uuid)']) f where has_function_privilege('service_role', f, 'execute')),
  7, 'le serveur (service_role) exécute les sept fonctions du Verrou'
);
select is(
  (select count(*)::int from unnest(array[
    'public.scan_exiger_verrou(jsonb, uuid)', 'public.scan_verrou_expirer(uuid)', 'public.scan_compte_depuis_auteur(jsonb)', 'public.scan_horodatage(text)']) f
    where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or has_function_privilege('service_role', f, 'execute')),
  0, 'les fonctions internes du Verrou sont fermées à tous les rôles'
);

-- 4-5. Les tables sont fermées (RLS active, aucun droit pour les clients).
select ok(
  (select relrowsecurity from pg_class where oid = 'public.verrou_hors_ligne'::regclass) and (select relrowsecurity from pg_class where oid = 'public.scan_hors_ligne'::regclass),
  'RLS activée sur verrou_hors_ligne et scan_hors_ligne'
);
select is(
  (select count(*)::int from unnest(array['public.verrou_hors_ligne', 'public.scan_hors_ligne']) t, unnest(array['select', 'insert', 'update', 'delete']) p
    where has_table_privilege('anon', t, p) or has_table_privilege('authenticated', t, p)),
  0, 'aucun accès direct aux tables du Verrou pour anon ni authenticated'
);

-- 6-10. Droits de prise : refus par défaut.
select throws_ok(
  $$ select public.prendre_verrou(pg_temp.aut('00000000-0000-0000-0000-0000000000e5', repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32)) $$,
  'P0001', 'KS_DROIT_REFUSE', 'un Compte sans droit ne prend pas le Verrou'
);
select throws_ok(
  $$ select public.prendre_verrou(pg_temp.aut('00000000-0000-0000-0000-0000000000e3', repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32)) $$,
  'P0001', 'KS_DROIT_REFUSE', 'le bénévole d''un autre Événement ne prend pas le Verrou'
);
select throws_ok(
  $$ select public.prendre_verrou(pg_temp.aut('00000000-0000-0000-0000-0000000000e4', repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32)) $$,
  'P0001', 'KS_DROIT_REFUSE', 'le bénévole hors de sa fenêtre ne prend pas le Verrou'
);
select throws_ok(
  $$ select public.prendre_verrou('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e5","role":"admin"}'::jsonb, '00000000-0000-4000-8000-0000000000a1', repeat('a', 32)) $$,
  'P0001', 'KS_DROIT_REFUSE', 'un faux rôle admin écrit dans l''auteur n''ouvre aucun droit'
);
select throws_ok(
  $$ select public.prendre_verrou(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000a1', 'pas-un-appareil') $$,
  'P0001', 'KS_APPAREIL_INVALIDE', 'un identifiant d''appareil mal formé est refusé'
);

-- 11-14. Prise par le bénévole : fenêtre = fin de son accès ; idempotente pour le même appareil.
create temp table v1 as select public.prendre_verrou(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32)) as r;
-- Le Verrou est daté six heures plus tôt : dans une transaction, now() ne bouge pas, et l'heure d'un scan est bornée par la prise du Verrou.
update public.verrou_hors_ligne set pris_le = now() - interval '6 hours' where id = (select (r ->> 'verrou_id')::uuid from v1);
select is((select r ->> 'statut' from v1), 'pris', 'le bénévole prend le Verrou de son Événement');
select is(
  (select expire_le from public.verrou_hors_ligne where id = (select (r ->> 'verrou_id')::uuid from v1)),
  (select valable_jusqu_au from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000e2'),
  'le Verrou du bénévole expire à la fin de son accès'
);
select is((select public.prendre_verrou(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32)) ->> 'statut'), 'deja', 'reprendre le Verrou avec le même appareil est idempotent');
select is((select count(*)::int from public.verrou_hors_ligne where evenement_id = '00000000-0000-4000-8000-0000000000a1' and statut = 'actif'), 1, 'un seul Verrou actif pour l''Événement');

-- 15-17. Un seul Verrou actif : l'autre appareil, l'Admin, et l'index unique partiel.
select throws_ok(
  $$ select public.prendre_verrou(pg_temp.benevole(repeat('b', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('b', 32)) $$,
  'P0001', 'KS_VERROU_PRIS', 'un autre appareil du même Compte ne prend pas un Verrou tenu'
);
select throws_ok(
  $$ select public.prendre_verrou(pg_temp.admin(repeat('c', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('c', 32)) $$,
  'P0001', 'KS_VERROU_PRIS', 'l''Admin ne prend pas non plus un Verrou tenu par un autre appareil'
);
select throws_ok(
  $$ insert into public.verrou_hors_ligne (evenement_id, compte_id, appareil, cle_code_court, expire_le)
     values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-0000000000e1', repeat('e', 32), repeat('0', 64), now() + interval '1 day') $$,
  '23505', null, 'l''index unique partiel interdit un second Verrou actif pour l''Événement'
);

-- 18-20. Le Verrou verrouille le scan : seul l'appareil qui le tient scanne (en ligne), le reste est refusé par scanner_pass.
select throws_ok(
  $$ select public.scanner_pass(pg_temp.admin(repeat('c', 32)), '00000000-0000-4000-8000-0000000000a1', pg_temp.jeton(2), null) $$,
  'P0001', 'KS_SCAN_VERROUILLE', 'un autre appareil ne scanne pas tant que le Verrou est tenu'
);
select throws_ok(
  $$ select public.scanner_pass(pg_temp.admin(), '00000000-0000-4000-8000-0000000000a1', pg_temp.jeton(2), null) $$,
  'P0001', 'KS_SCAN_VERROUILLE', 'un scan sans identifiant d''appareil est refusé tant que le Verrou est tenu'
);
select is((select statut from public.pass where id = pg_temp.pass_id(2)), 'valide', 'le Pass refusé pour cause de Verrou n''a pas bougé');

-- 21-23. État du Verrou vu par chaque appareil.
select is((select public.lire_etat_verrou(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32)) ->> 'etat'), 'moi', 'l''appareil qui tient le Verrou le sait');
select is((select public.lire_etat_verrou(pg_temp.admin(repeat('c', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('c', 32)) ->> 'etat'), 'autre', 'les autres appareils voient « Scan réservé à l''appareil hors ligne »');
select is((select public.lire_etat_verrou(pg_temp.admin(repeat('c', 32)), '00000000-0000-4000-8000-0000000000a2', repeat('c', 32)) ->> 'etat'), 'libre', 'un autre Événement n''est pas verrouillé');

-- 24-25. Le holder scanne en ligne (même Verrou) ; ce Pass sera absent de la liste (déjà scanné).
select is(
  (select public.scanner_pass(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', pg_temp.jeton(11), null) ->> 'resultat'),
  'valide', 'l''appareil qui tient le Verrou scanne en ligne'
);
select is(
  (select count(*)::int from public.journal_audit where action = 'scan' and (auteur::text like '%' || repeat('a', 32) || '%' or auteur::text like '%appareil%')),
  0, 'l''identifiant d''appareil n''est jamais écrit au journal des scans'
);

-- 26-28. Téléchargement de la liste : seulement le détenteur du Verrou.
select throws_ok(
  $$ select public.telecharger_liste_hors_ligne(pg_temp.benevole(repeat('b', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('b', 32)) $$,
  'P0001', 'KS_VERROU_ABSENT', 'un autre appareil du même Compte ne télécharge pas la liste'
);
select throws_ok(
  $$ select public.telecharger_liste_hors_ligne(pg_temp.admin(repeat('c', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('c', 32)) $$,
  'P0001', 'KS_VERROU_ABSENT', 'l''Admin sur un autre appareil ne télécharge pas la liste'
);
create temp table l1 as select public.telecharger_liste_hors_ligne(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32)) as r;
select is((select jsonb_array_length(r -> 'pass') from l1), 9, 'la liste contient exactement les neuf Pass valides, payés ou offerts, de l''Événement');

-- 29-35. Contenu de la liste.
select is(
  (select jsonb_agg(p ->> 'j' order by p ->> 'j') from l1, jsonb_array_elements(r -> 'pass') p
    where (p ->> 'j') in (select pg_temp.empreinte(jeton) from jeu where n in (4, 5, 6, 7, 8, 11))),
  null, 'la liste exclut les Pass annulé, remboursé, de Commande non payée, d''un autre Événement, déjà scanné ou scanné en ligne'
);
select is(
  (select count(*)::int from l1, jsonb_array_elements(r -> 'pass') p where (p ->> 'j') in (select pg_temp.empreinte(jeton) from jeu where n in (1, 2, 3, 9, 10, 12, 13, 14, 15))),
  9, 'la liste contient les neuf Pass valides et payés ou offerts de l''Événement'
);
select is(
  (select count(*)::int from l1, jsonb_array_elements(r -> 'pass') p, jeu where jeu.n in (1, 2, 3, 9, 10, 12, 13, 14, 15) and (p::text like '%' || jeu.jeton || '%' or p::text like '%' || jeu.code || '%')),
  0, 'la liste ne contient ni jeton ni code court en clair'
);
select is(
  (select count(*)::int from l1, jeu where (r::text like '%' || jeu.jeton || '%' or r::text like '%' || jeu.code || '%')),
  0, 'rien d''autre dans la réponse ne contient un jeton ou un code court en clair'
);
select is(
  (select count(*)::int from l1 where r::text like '%@%' or r::text like '%00000000-0000-0000-0000-0000000000e%' or r::text like '%KS-2026-84%'),
  0, 'la liste ne contient ni email, ni Compte, ni numéro de Commande'
);
select is(
  (select p ->> 'j' from l1, jsonb_array_elements(r -> 'pass') p where p ->> 'n' = 'Alice Test'),
  pg_temp.empreinte(pg_temp.jeton(1)), 'l''empreinte du jeton est le SHA-256 du jeton'
);
select is(
  (select p ->> 'c' from l1, jsonb_array_elements(r -> 'pass') p where p ->> 'n' = 'Alice Test'),
  pg_temp.hmac_code(pg_temp.code(1), (select r ->> 'cle_code_court' from l1)), 'l''empreinte du code court est un HMAC-SHA-256 avec la clé du Verrou'
);
select isnt(
  (select p ->> 'c' from l1, jsonb_array_elements(r -> 'pass') p where p ->> 'n' = 'Alice Test'),
  pg_temp.empreinte(pg_temp.code(1)), 'l''empreinte du code court n''est pas un SHA-256 simple (non cassable sans la clé)'
);
select is(
  (select (r -> 'types' -> ((p ->> 't')::int) ->> 'fr') || '|' || (p ->> 'n') from l1, jsonb_array_elements(r -> 'pass') p where p ->> 'n' = 'Bob Test'),
  'TEST_VIP|Bob Test', 'chaque entrée porte le nom du titulaire et le Type de pass'
);
select is((select r ->> 'evenement_fr' from l1), 'TEST_Festival', 'la liste porte le titre de l''Événement pour l''affichage hors ligne');
select is(
  (select count(*)::int from public.journal_audit where action = 'liste_hors_ligne_telechargee' and (apres ->> 'nombre')::int = 9),
  1, 'le téléchargement est journalisé avec le nombre de Pass'
);

-- Après le téléchargement : Ida (f09) est annulée, Jo (f0a) est scannée ailleurs.
update public.pass set statut = 'annule' where id = pg_temp.pass_id(9);
update public.pass set statut = 'scanne', scanne_le = now() - interval '30 minutes' where id = pg_temp.pass_id(10);

-- 38-40. Synchronisation : droits et bornes.
select throws_ok(
  $$ select public.synchroniser_scans(pg_temp.benevole(repeat('b', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('b', 32), '[]'::jsonb) $$,
  'P0001', 'KS_VERROU_ABSENT', 'un appareil sans Verrou ne synchronise pas'
);
select throws_ok(
  $$ select public.synchroniser_scans(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32),
       (select jsonb_agg(pg_temp.scan(n, 'jeton', repeat('0', 64), now())) from generate_series(1, 201) n)) $$,
  'P0001', 'KS_LOT_TROP_GRAND', 'un lot de plus de 200 scans est refusé'
);
select throws_ok(
  $$ select public.synchroniser_scans(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32), '{"a":1}'::jsonb) $$,
  'P0001', 'KS_LOT_INVALIDE', 'un lot qui n''est pas une liste est refusé'
);

-- 41-52. Synchronisation d'un lot : appliqués, conflits, inconnu, invalide.
create temp table s1 as
select public.synchroniser_scans(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32), jsonb_build_array(
  pg_temp.scan(1, 'jeton', pg_temp.empreinte(pg_temp.jeton(1)), now() - interval '20 minutes'),
  pg_temp.scan(2, 'code', pg_temp.hmac_code(pg_temp.code(2), (select r ->> 'cle_code_court' from l1)), now() - interval '10 minutes'),
  pg_temp.scan(3, 'jeton', pg_temp.empreinte(pg_temp.jeton(9)), now() - interval '9 minutes'),
  pg_temp.scan(4, 'jeton', pg_temp.empreinte(pg_temp.jeton(10)), now() - interval '8 minutes'),
  pg_temp.scan(5, 'jeton', pg_temp.empreinte(repeat('99', 24)), now() - interval '7 minutes'),
  jsonb_build_object('id', pg_temp.sid(6), 'nature', 'jeton', 'empreinte', 'pas-une-empreinte', 'scanne_le', 'hier'),
  pg_temp.scan(7, 'jeton', pg_temp.empreinte(pg_temp.jeton(7)), now() - interval '6 minutes')
)) as r;
select is((select (r ->> 'appliques')::int from s1), 2, 'deux scans appliqués (jeton et code court)');
select is((select (r ->> 'conflits')::int from s1), 2, 'deux conflits (Pass annulé, Pass scanné ailleurs)');
select is((select (r ->> 'inconnus')::int from s1), 2, 'deux inconnus (empreinte absente, Pass d''un autre Événement)');
select is((select (r ->> 'invalides')::int from s1), 1, 'un scan mal formé est invalide');
select is((select statut from public.pass where id = pg_temp.pass_id(1)), 'scanne', 'le Pass scanné par jeton hors ligne est passé à « scanne »');
select is((select statut from public.pass where id = pg_temp.pass_id(2)), 'scanne', 'le Pass scanné par code court hors ligne est passé à « scanne »');
select ok(
  (select scanne_le between now() - interval '21 minutes' and now() - interval '19 minutes' and scanne_par = '00000000-0000-0000-0000-0000000000e2' from public.pass where id = pg_temp.pass_id(1)),
  'le Pass garde l''heure du scan sur l''appareil et l''auteur du scan'
);
select is((select scanne_le from public.pass where id = pg_temp.pass_id(10)), now() - interval '30 minutes', 'le premier scan d''un Pass déjà scanné ailleurs n''est jamais écrasé');
select is((select statut from public.pass where id = pg_temp.pass_id(9)), 'annule', 'un Pass annulé entre-temps reste annulé');
select is(
  (select details ->> 'motif' from public.anomalie where type = 'scan_conflit' and cible_id = pg_temp.pass_id(10) and resolue_le is null),
  'deja_scanne', 'un conflit « déjà scanné » crée une anomalie lisible'
);
select is(
  (select details ->> 'motif' from public.anomalie where type = 'scan_conflit' and cible_id = pg_temp.pass_id(9) and resolue_le is null),
  'annule', 'un conflit « annulé » crée une anomalie lisible'
);
select is((select count(*)::int from public.taches_admin where type = 'scan_conflit'), 2, 'les conflits apparaissent dans les tâches admin');

-- 53-56. Idempotence : rejouer le même lot n'applique rien de plus et ne duplique ni anomalie ni mémoire.
create temp table s2 as
select public.synchroniser_scans(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32), jsonb_build_array(
  pg_temp.scan(1, 'jeton', pg_temp.empreinte(pg_temp.jeton(1)), now() - interval '20 minutes'),
  pg_temp.scan(2, 'code', pg_temp.hmac_code(pg_temp.code(2), (select r ->> 'cle_code_court' from l1)), now() - interval '10 minutes'),
  pg_temp.scan(3, 'jeton', pg_temp.empreinte(pg_temp.jeton(9)), now() - interval '9 minutes'),
  pg_temp.scan(4, 'jeton', pg_temp.empreinte(pg_temp.jeton(10)), now() - interval '8 minutes'),
  pg_temp.scan(5, 'jeton', pg_temp.empreinte(repeat('99', 24)), now() - interval '7 minutes'),
  pg_temp.scan(7, 'jeton', pg_temp.empreinte(pg_temp.jeton(7)), now() - interval '6 minutes')
)) as r;
select is((select (r ->> 'appliques')::int + (r ->> 'conflits')::int + (r ->> 'inconnus')::int from s2), 0, 'rejouer le lot n''applique, ne signale et ne refuse rien de nouveau');
select is((select (r ->> 'deja_traites')::int from s2), 6, 'les six scans déjà traités sont reconnus');
select is((select count(*)::int from public.scan_hors_ligne where verrou_id = (select (r ->> 'verrou_id')::uuid from v1)), 6, 'chaque scan n''est mémorisé qu''une fois');
select is((select count(*)::int from public.anomalie where type = 'scan_conflit'), 2, 'aucune anomalie en double');

-- 57-58. Ordre : l'heure du scan sur l'appareil décide, pas l'ordre du lot.
create temp table s3 as
select public.synchroniser_scans(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32), jsonb_build_array(
  pg_temp.scan(8, 'jeton', pg_temp.empreinte(pg_temp.jeton(12)), now() - interval '2 minutes'),
  pg_temp.scan(9, 'code', pg_temp.hmac_code(pg_temp.code(12), (select r ->> 'cle_code_court' from l1)), now() - interval '4 minutes')
)) as r;
select is((select s ->> 'resultat' from s3, jsonb_array_elements(r -> 'resultats') s where (s ->> 'id')::uuid = pg_temp.sid(9)), 'applique', 'le scan le plus ancien d''un même Pass est appliqué');
select is((select s ->> 'resultat' from s3, jsonb_array_elements(r -> 'resultats') s where (s ->> 'id')::uuid = pg_temp.sid(8)), 'doublon', 'le scan plus récent du même Pass, déjà appliqué par ce Verrou, est un doublon sans anomalie');

-- Doublon : le Pass f0b a été scanné EN LIGNE par ce même appareil pendant le Verrou. Le renvoyer à la synchronisation n'est pas un conflit : aucune anomalie.
create temp table s4 as
select public.synchroniser_scans(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32), jsonb_build_array(
  pg_temp.scan(12, 'jeton', pg_temp.empreinte(pg_temp.jeton(11)), now() - interval '1 minute')
)) as r;
select is((select s ->> 'resultat' from s4, jsonb_array_elements(r -> 'resultats') s), 'doublon', 'un Pass scanné en ligne par le même appareil pendant le Verrou est un doublon, pas un conflit');
select is((select count(*)::int from public.anomalie where type = 'scan_conflit' and cible_id = pg_temp.pass_id(11)), 0, 'un doublon ne crée aucune anomalie trompeuse');
select is((select (r ->> 'deja_traites')::int from s4), 1, 'le doublon est compté comme déjà traité');

-- 59-60. Horloge de l'appareil : jamais dans le futur, jamais avant la prise du Verrou.
select public.synchroniser_scans(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32), jsonb_build_array(
  pg_temp.scan(10, 'jeton', pg_temp.empreinte(pg_temp.jeton(13)), now() + interval '10 days'),
  pg_temp.scan(11, 'jeton', pg_temp.empreinte(pg_temp.jeton(14)), now() - interval '5 days')
));
select ok((select scanne_le <= now() from public.pass where id = pg_temp.pass_id(13)), 'une horloge en avance ne place pas un scan dans le futur');
select ok((select p.scanne_le >= v.pris_le from public.pass p, public.verrou_hors_ligne v where p.id = pg_temp.pass_id(14) and v.id = (select (r ->> 'verrou_id')::uuid from v1)), 'un scan daté avant la prise du Verrou est ramené à cette prise');

-- 61-62. Journal sans secret.
select is(
  (select count(*)::int from public.journal_audit j, jeu, l1
    where j.action in ('verrou_pris', 'liste_hors_ligne_telechargee', 'scans_synchronises', 'scan', 'update')
      and (j::text like '%' || jeu.jeton || '%' or j::text like '%' || jeu.code || '%' or j::text like '%' || jeu.nom || '%' or j::text like '%' || (l1.r ->> 'cle_code_court') || '%')),
  0, 'le journal ne contient ni jeton, ni code court, ni nom, ni clé'
);
select is(
  (select count(*)::int from public.journal_audit j where j::text like '%' || repeat('a', 32) || '%' or j::text like '%' || repeat('c', 32) || '%'),
  0, 'le journal ne contient aucun identifiant d''appareil'
);

-- 63-67. Libération par le détenteur.
select throws_ok(
  $$ select public.liberer_verrou(pg_temp.benevole(repeat('b', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('b', 32)) $$,
  'P0001', 'KS_VERROU_ABSENT', 'un appareil qui n''a jamais tenu le Verrou ne le libère pas'
);
select is((select public.liberer_verrou(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32)) ->> 'statut'), 'libere', 'le détenteur libère le Verrou');
select is((select statut from public.verrou_hors_ligne where id = (select (r ->> 'verrou_id')::uuid from v1)), 'libere', 'le Verrou est « libere »');
select is((select public.liberer_verrou(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32)) ->> 'statut'), 'deja', 'libérer deux fois est sans effet');
select throws_ok(
  $$ select public.synchroniser_scans(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('a', 32), '[]'::jsonb) $$,
  'P0001', 'KS_VERROU_ABSENT', 'après la libération, l''appareil ne synchronise plus'
);

-- 68-74. Libération forcée : l'Admin prend le Verrou sur un autre appareil, qui est « perdu ».
select is((select public.prendre_verrou(pg_temp.admin(repeat('c', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('c', 32)) ->> 'statut'), 'pris', 'après la libération, un autre appareil prend le Verrou');
select throws_ok(
  $$ select public.forcer_liberation_verrou(pg_temp.benevole(repeat('a', 32)), '00000000-0000-4000-8000-0000000000a1') $$,
  'P0001', 'KS_DROIT_REFUSE', 'seul l''Admin force la libération'
);
create temp table f1 as select public.forcer_liberation_verrou(pg_temp.admin(), '00000000-0000-4000-8000-0000000000a1') as r;
select is((select r ->> 'statut' from f1), 'force', 'l''Admin force la libération du Verrou');
select is(
  (select count(*)::int from public.anomalie a join public.verrou_hors_ligne v on v.id = a.cible_id
    where a.type = 'scans_non_synchronises' and a.cible_type = 'verrou' and v.statut = 'force' and v.evenement_id = '00000000-0000-4000-8000-0000000000a1' and a.resolue_le is null),
  1, 'la libération forcée crée une anomalie « scans_non_synchronises »'
);
select is((select count(*)::int from public.taches_admin where type = 'scans_non_synchronises'), 1, 'l''anomalie apparaît dans les tâches admin');
select is((select public.forcer_liberation_verrou(pg_temp.admin(), '00000000-0000-4000-8000-0000000000a1') ->> 'statut'), 'aucun', 'forcer sans Verrou actif ne fait rien');
-- Verrou forcé : la synchronisation reste acceptée, en mode « conflits seulement » (jamais d'écrasement).
insert into pg_temp.jeu values
  (16, 'Pat Force', 'valide', repeat('a9', 24), 'QQQQQQQ8', 1, 'payee'),
  (17, 'Quin Apres', 'valide', repeat('ba', 24), 'RRRRRRR9', 1, 'payee'),
  (18, 'Rob Ailleurs', 'valide', repeat('cb', 24), 'SSSSSSS2', 1, 'payee');
insert into public.commande (id, numero, compte_id, type, statut, offerte, sous_total_cents, total_cents, paye_le)
select ('00000000-0000-4000-8000-00000000c0' || lpad(to_hex(n), 2, '0'))::uuid, 'KS-2026-84' || lpad(n::text, 4, '0'), '00000000-0000-0000-0000-0000000000e5', 'pass', cmd, false, 3000, 3000, now() from jeu where n >= 16;
insert into public.ligne_commande (id, commande_id, produit_id, nombre, prix_cents, type_pass_id, titulaires, pass_nom_fr, pass_nom_en, est_stand)
select ('00000000-0000-4000-8000-00000000d0' || lpad(to_hex(n), 2, '0'))::uuid, ('00000000-0000-4000-8000-00000000c0' || lpad(to_hex(n), 2, '0'))::uuid, null, 1, 3000,
  '00000000-0000-4000-8000-0000000000b1'::uuid, '["x"]'::jsonb, 'TEST_VIP', 'TEST_VIP', false from jeu where n >= 16;
insert into public.pass (id, evenement_id, type_pass_id, commande_id, ligne_commande_id, rang, nom_titulaire, statut, jeton, code_court)
select ('00000000-0000-4000-8000-00000000f0' || lpad(to_hex(n), 2, '0'))::uuid, '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1',
  ('00000000-0000-4000-8000-00000000c0' || lpad(to_hex(n), 2, '0'))::uuid, ('00000000-0000-4000-8000-00000000d0' || lpad(to_hex(n), 2, '0'))::uuid, 1, nom, 'valide', jeton, code from jeu where n >= 16;
update public.pass set statut = 'scanne', scanne_le = now() - interval '5 minutes' where id = pg_temp.pass_id(18);
create temp table s5 as
select public.synchroniser_scans(pg_temp.admin(repeat('c', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('c', 32), jsonb_build_array(
  pg_temp.scan(13, 'jeton', pg_temp.empreinte(pg_temp.jeton(16)), now() - interval '1 hour'),
  pg_temp.scan(14, 'jeton', pg_temp.empreinte(pg_temp.jeton(17)), now() + interval '1 hour'),
  pg_temp.scan(15, 'jeton', pg_temp.empreinte(pg_temp.jeton(18)), now() - interval '30 minutes')
)) as r;
select is((select (r ->> 'appliques')::int || '/' || (r ->> 'conflits')::int from s5), '1/2', 'Verrou forcé : un scan appliqué, deux conflits');
select is((select statut from public.pass where id = pg_temp.pass_id(16)), 'scanne', 'Verrou forcé : un Pass valide et non scanné, scanné avant la libération, est appliqué');
select is((select statut from public.pass where id = pg_temp.pass_id(17)), 'valide', 'Verrou forcé : un scan daté après la libération n''est pas appliqué');
select is((select details ->> 'motif' from public.anomalie where type = 'scan_conflit' and cible_id = pg_temp.pass_id(17)), 'apres_liberation', 'Verrou forcé : conflit « apres_liberation » signalé');
select is((select scanne_le from public.pass where id = pg_temp.pass_id(18)), now() - interval '5 minutes', 'Verrou forcé : un Pass scanné ailleurs n''est jamais écrasé');
select is((select public.liberer_verrou(pg_temp.admin(repeat('c', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('c', 32)) ->> 'statut'), 'force', 'l''appareil libéré de force apprend que le Verrou a été forcé');
select throws_ok(
  $$ select public.synchroniser_scans(pg_temp.admin(repeat('c', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('7', 32), '[]'::jsonb) $$,
  'P0001', 'KS_VERROU_ABSENT', 'un autre appareil du même Compte ne synchronise pas un Verrou qui n''est pas le sien'
);
select is(
  (select public.scanner_pass(pg_temp.admin(), '00000000-0000-4000-8000-0000000000a1', pg_temp.jeton(15), null) ->> 'resultat'),
  'valide', 'après la libération forcée, le scan reste ouvert à tous les appareils'
);
select is(
  (select count(*)::int from public.journal_audit where action = 'verrou_force' and apres::text not like '%' || repeat('c', 32) || '%'),
  1, 'la libération forcée est journalisée sans identifiant d''appareil'
);

-- 75-77. Expiration : un Verrou échu ne bloque plus personne, passe à « expire » à la prochaine prise, et son appareil peut encore synchroniser.
insert into public.verrou_hors_ligne (evenement_id, compte_id, appareil, cle_code_court, pris_le, expire_le)
values ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-0000000000e1', repeat('d', 32), repeat('1', 64), now() - interval '2 hours', now() - interval '1 hour');
select is(
  (select public.scanner_pass(pg_temp.admin(repeat('9', 32)), '00000000-0000-4000-8000-0000000000a2', pg_temp.jeton(7), null) ->> 'resultat'),
  'valide', 'un Verrou échu ne bloque pas le scan');
select is((select public.prendre_verrou(pg_temp.admin(repeat('9', 32)), '00000000-0000-4000-8000-0000000000a2', repeat('9', 32)) ->> 'statut'), 'pris', 'un Verrou échu laisse la place à une nouvelle prise');
select is((select statut from public.verrou_hors_ligne where appareil = repeat('d', 32)), 'expire', 'le Verrou échu est passé à « expire »');
select is((select public.synchroniser_scans(pg_temp.admin(repeat('d', 32)), '00000000-0000-4000-8000-0000000000a2', repeat('d', 32), '[]'::jsonb) ->> 'appliques'), '0', 'l''appareil d''un Verrou expiré peut encore synchroniser');

-- 79-82. Liste d'un autre Événement et lecture admin.
create temp table l2 as select public.telecharger_liste_hors_ligne(pg_temp.admin(repeat('9', 32)), '00000000-0000-4000-8000-0000000000a2', repeat('9', 32)) as r;
select is(
  (select jsonb_array_length(r -> 'pass') from l2), 0, 'la liste d''un autre Événement ne reprend aucun Pass du premier (le seul Pass de l''Événement 2 vient d''être scanné)');
select is((select count(*)::int from public.verrou_hors_ligne where evenement_id = '00000000-0000-4000-8000-0000000000a2' and statut = 'actif'), 1, 'les Verrous de deux Événements sont indépendants');
select is((select email from public.lire_verrou_evenement(pg_temp.admin(), '00000000-0000-4000-8000-0000000000a2')), 'test-hl1@example.invalid', 'l''Admin voit quel Compte tient le Verrou');
select throws_ok(
  $$ select * from public.lire_verrou_evenement(pg_temp.benevole(), '00000000-0000-4000-8000-0000000000a2') $$,
  'P0001', 'KS_DROIT_REFUSE', 'seul l''Admin lit le Verrou d''un Événement'
);


-- Accès bénévole retiré : le Verrou actif du Compte passe à « force » (anomalie, liste téléchargée), le Scan des autres se rouvre, l'appareil peut synchroniser.
create temp table pv as select public.prendre_verrou(pg_temp.benevole(repeat('e', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('e', 32)) as r;
create temp table l3 as select public.telecharger_liste_hors_ligne(pg_temp.benevole(repeat('e', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('e', 32)) as r;
select is(
  (select public.retirer_acces_benevole(pg_temp.admin(), '00000000-0000-4000-8000-0000000000a1', (select id from public.acces_benevole where compte_id = '00000000-0000-0000-0000-0000000000e2'))::text),
  'true', 'l''Admin retire l''accès du bénévole');
select is((select statut from public.verrou_hors_ligne where appareil = repeat('e', 32)), 'force', 'retirer l''accès passe son Verrou à « force »');
select is((select count(*)::int from public.anomalie where type = 'scans_non_synchronises' and details ->> 'motif' = 'acces_retire'), 1, 'retirer l''accès signale les scans possiblement non synchronisés');
select is((select public.synchroniser_scans(pg_temp.benevole(repeat('e', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('e', 32), '[]'::jsonb) ->> 'appliques'), '0', 'après le retrait, l''appareil peut encore synchroniser (conflits seulement)');
select is((select public.lire_etat_verrou(pg_temp.admin(repeat('c', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('c', 32)) ->> 'etat'), 'libre', 'après le retrait, le Scan des autres appareils est rouvert');

-- Fenêtre raccourcie : un accès recréé, un Verrou, puis la date de l'Événement recule : le Verrou est forcé.
insert into public.acces_benevole (compte_id, evenement_id, valable_du, valable_jusqu_au, cree_par)
values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-4000-8000-0000000000a1', now() - interval '1 hour', now() + interval '1 day', '00000000-0000-0000-0000-0000000000e1');
create temp table pv2 as select public.prendre_verrou(pg_temp.benevole(repeat('f', 32)), '00000000-0000-4000-8000-0000000000a1', repeat('f', 32)) as r;
update public.evenement set debut_le = now() - interval '5 days', fin_le = null where id = '00000000-0000-4000-8000-0000000000a1';
select is((select statut from public.verrou_hors_ligne where appareil = repeat('f', 32)), 'force', 'une fenêtre d''accès devenue passée force le Verrou du bénévole');
select is((select provolatile::text from pg_proc where oid = 'public.scan_horodatage(text)'::regprocedure), 's', 'scan_horodatage est « stable »');

select * from finish();
rollback;
