-- Story 7.11 : Candidature Stand, validation automatique (FR-33b, AD-37). Dépôt et acceptation immédiate, une candidature active par Compte et par Événement,
-- quota et Capacité sans double comptage, Commande de Stand (seul chemin, Compte du candidat), aide à nommer plus tard, refus par l'Admin avant et après
-- paiement (remboursement ouvert, confirmé avec preuve), purge à 90 jours, fonctions fermées aux clients. Données TEST_ annulées à la fin.
-- Exécuté par la CI (Docker) ; en local, `npm run test:sql` explique l'absence de Docker et sort sans erreur.
begin;
select plan(71);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-cs1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-cs2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e3', 'test-cs3@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e4', 'test-cs4@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e9', 'test-cs9@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e1', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e2', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e3', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e4', 25);
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e9', 'admin');

create function pg_temp.cl(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000e9","role":"admin"}'::jsonb $$;
create function pg_temp.sans() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000e4","role":"admin"}'::jsonb $$;
create function pg_temp.acc() returns jsonb language sql as $$ select '[{"objet":"pass_photos_video","version":"TEST_v1"}]'::jsonb $$;
create function pg_temp.kid(p_n integer) returns uuid language sql as $$ select ('00000000-0000-4000-8000-00000000b0' || lpad(to_hex(p_n), 2, '0'))::uuid $$;
-- Trois chemins de photos valides pour la candidature n de l'Événement p_ev.
create function pg_temp.photos(p_ev uuid, p_n integer) returns text[] language sql as $$
  select array[p_ev::text || '/' || pg_temp.kid(p_n)::text || '/1.jpg', p_ev::text || '/' || pg_temp.kid(p_n)::text || '/2.png', p_ev::text || '/' || pg_temp.kid(p_n)::text || '/3.webp']
$$;
create function pg_temp.dep(p_cpt text, p_n integer, p_ev uuid, p_type uuid) returns jsonb language sql as $$
  select public.deposer_candidature_stand(pg_temp.cl(p_cpt), pg_temp.kid(p_n), p_ev, p_type, 'TEST_ Bijoux et accessoires faits main, trois gammes.', '@test_exposant', pg_temp.photos(p_ev, p_n), 'TEST_v1')
$$;

insert into public.reglage (cle, valeur) values ('frais_annulation_pass', '20') on conflict (cle) do update set valeur = '20';
insert into public.reglage (cle, valeur) values ('delai_paiement', '30') on conflict (cle) do update set valeur = '30';

insert into public.evenement (id, auteur_id, titre_fr, slug, publie_le, debut_le, capacite) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-0000000000e9', 'TEST_Festival', 'test-cs-ev1', now() - interval '2 days', now() + interval '30 days', 10),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-0000000000e9', 'TEST_Brouillon', 'test-cs-ev2', null, now() + interval '30 days', null),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-0000-0000-0000000000e9', 'TEST_Fini', 'test-cs-ev3', now() - interval '200 days', now() - interval '100 days', null);
insert into public.type_pass (id, evenement_id, nom_fr, nom_en, prix_cents, quota, est_stand) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', 'TEST_Stand', 'TEST_Stand EN', 4000, 3, true),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000a1', 'TEST_Standard', 'TEST_Standard EN', 1500, null, false),
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000a2', 'TEST_Stand B', 'TEST_Stand B', 4000, null, true),
  ('00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-0000000000a3', 'TEST_Stand fini', 'TEST_Stand fini', 4000, null, true);

-- 1-3. Fonctions fermées aux clients ; le serveur seul exécute les fonctions publiques ; les internes sont fermées à tous.
select is(
  (select count(*)::int from unnest(array[
    'public.deposer_candidature_stand(jsonb, uuid, uuid, uuid, text, text, text[], text)',
    'public.creer_commande_stand(jsonb, uuid, jsonb, integer, text, text, text, boolean, text, text)',
    'public.recapitulatif_commande_stand(uuid, uuid, text)', 'public.nommer_aide_pass(jsonb, uuid, text)',
    'public.refuser_candidature_stand(jsonb, uuid, text)', 'public.candidatures_stand_a_purger(integer)', 'public.marquer_candidature_stand_purgee(uuid)']) f
    where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')),
  0, 'aucune fonction de la candidature Stand n''est exécutable par anon ni authenticated'
);
select is(
  (select count(*)::int from unnest(array[
    'public.deposer_candidature_stand(jsonb, uuid, uuid, uuid, text, text, text[], text)',
    'public.creer_commande_stand(jsonb, uuid, jsonb, integer, text, text, text, boolean, text, text)',
    'public.recapitulatif_commande_stand(uuid, uuid, text)', 'public.nommer_aide_pass(jsonb, uuid, text)',
    'public.refuser_candidature_stand(jsonb, uuid, text)', 'public.candidatures_stand_a_purger(integer)', 'public.marquer_candidature_stand_purgee(uuid)']) f
    where has_function_privilege('service_role', f, 'execute')),
  7, 'le serveur exécute les sept fonctions de la candidature Stand'
);
select is(
  (select count(*)::int from unnest(array['public.commande_stand_calculer(uuid, uuid, text, boolean)', 'public.nom_titulaire_propre(text)', 'public.candidature_stand_journaliser()', 'public.candidature_stand_figer()']) f
    where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or has_function_privilege('service_role', f, 'execute')),
  0, 'les fonctions internes sont fermées à tous les rôles'
);
-- 4-5. Table : aucun accès client, aucune écriture directe même pour le serveur ; bucket privé.
select is((select count(*)::int from (values ('anon'), ('authenticated')) r(n) where has_table_privilege(r.n, 'public.candidature_stand', 'select')), 0, 'la table candidature_stand est illisible pour anon et authenticated');
select is((select has_table_privilege('service_role', 'public.candidature_stand', 'insert') or has_table_privilege('service_role', 'public.candidature_stand', 'update')), false, 'le serveur n''écrit pas directement dans la table');
select is((select public from storage.buckets where id = 'candidatures-stand-private'), false, 'le bucket des photos de candidature est privé');

-- 6-12. Dépôt accepté immédiatement.
create temp table d1 as select pg_temp.dep('e1', 1, '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1') as r;
select is((select statut from public.candidature_stand where id = pg_temp.kid(1)), 'validee', 'la candidature est acceptée immédiatement');
select ok((select expire_le between now() + interval '47 hours 59 minutes' and now() + interval '48 hours 1 minute' from public.candidature_stand where id = pg_temp.kid(1)), 'la place est réservée 48 h (réglage delai_stand_heures)');
select is((select r ->> 'candidature_id' from d1), pg_temp.kid(1)::text, 'la réponse donne l''identifiant de la candidature');
select is((select count(*)::int from public.envoi where modele = 'candidature_validee' and cle = 'candidature_validee:' || pg_temp.kid(1)::text), 1, 'l''email candidature_validee est planifié une seule fois');
select is((select donnees::text from public.envoi where cle = 'candidature_validee:' || pg_temp.kid(1)::text), jsonb_build_object('candidature_id', pg_temp.kid(1))::text, 'l''email ne porte qu''un identifiant (ni description, ni Instagram, ni photo)');
select is(public.places_type_pass_utilisees('00000000-0000-4000-8000-0000000000c1'), 1, 'une candidature acceptée occupe une place de Type');
select is(public.places_evenement_utilisees('00000000-0000-4000-8000-0000000000a1'), 2, 'une candidature acceptée occupe deux places d''Événement (exposant et aide)');

-- 13-21. Refus de dépôt.
select throws_ok($$select pg_temp.dep('e1', 2, '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1')$$, 'P0001', 'KS_CANDIDATURE_EXISTANTE', 'une seule candidature active par Compte et par Événement');
select throws_ok($$select public.deposer_candidature_stand(pg_temp.cl('e2'), pg_temp.kid(3), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', 'trop court', '@test_exposant', pg_temp.photos('00000000-0000-4000-8000-0000000000a1', 3), 'TEST_v1')$$, 'P0001', 'KS_CANDIDATURE_DESCRIPTION', 'description de moins de 20 caractères refusée');
select throws_ok($$select public.deposer_candidature_stand(pg_temp.cl('e2'), pg_temp.kid(3), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', 'TEST_ Bijoux et accessoires faits main.', 'pas un pseudo !', pg_temp.photos('00000000-0000-4000-8000-0000000000a1', 3), 'TEST_v1')$$, 'P0001', 'KS_CANDIDATURE_INSTAGRAM', 'forme d''Instagram invalide refusée');
select lives_ok($$select public.deposer_candidature_stand(pg_temp.cl('e3'), pg_temp.kid(4), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', 'TEST_ Bijoux et accessoires faits main.', 'https://instagram.com/test.exposant', pg_temp.photos('00000000-0000-4000-8000-0000000000a1', 4), 'TEST_v1')$$, 'un lien Instagram valide est accepté');
select throws_ok($$select public.deposer_candidature_stand(pg_temp.cl('e2'), pg_temp.kid(3), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', 'TEST_ Bijoux et accessoires faits main.', '@test_exposant', array['x/1.jpg','x/2.jpg','x/3.jpg'], 'TEST_v1')$$, 'P0001', 'KS_CANDIDATURE_PHOTOS', 'des photos hors du dossier de la candidature sont refusées');
select throws_ok($$select public.deposer_candidature_stand(pg_temp.cl('e2'), pg_temp.kid(3), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', 'TEST_ Bijoux et accessoires faits main.', '@test_exposant', (pg_temp.photos('00000000-0000-4000-8000-0000000000a1', 3))[1:2], 'TEST_v1')$$, 'P0001', 'KS_CANDIDATURE_PHOTOS', 'deux photos seulement : refusé');
select throws_ok($$select public.deposer_candidature_stand(pg_temp.cl('e2'), pg_temp.kid(3), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c2', 'TEST_ Bijoux et accessoires faits main.', '@test_exposant', pg_temp.photos('00000000-0000-4000-8000-0000000000a1', 3), 'TEST_v1')$$, 'P0001', 'KS_TYPE_PASS_INTROUVABLE', 'un Type qui n''est pas un Stand ne se candidate pas');
select throws_ok($$select public.deposer_candidature_stand(pg_temp.cl('e2'), pg_temp.kid(3), '00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000c3', 'TEST_ Bijoux et accessoires faits main.', '@test_exposant', pg_temp.photos('00000000-0000-4000-8000-0000000000a2', 3), 'TEST_v1')$$, 'P0001', 'KS_EVENEMENT_INTROUVABLE', 'un Événement non publié est introuvable');
select throws_ok($$select public.deposer_candidature_stand(pg_temp.cl('e2'), pg_temp.kid(3), '00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000c4', 'TEST_ Bijoux et accessoires faits main.', '@test_exposant', pg_temp.photos('00000000-0000-4000-8000-0000000000a3', 3), 'TEST_v1')$$, 'P0001', 'KS_VENTE_FERMEE', 'un Événement commencé : vente fermée');

-- 22-24. Quota du Type (3 Stands) : e1 (déjà), e3 (déjà), un troisième puis « complet ».
select lives_ok($$select public.deposer_candidature_stand(pg_temp.cl('e2'), pg_temp.kid(5), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', 'TEST_ Bijoux et accessoires faits main.', '@test_exposant', pg_temp.photos('00000000-0000-4000-8000-0000000000a1', 5), 'TEST_v1')$$, 'la dernière place du quota est prise');
select is(public.places_type_pass_utilisees('00000000-0000-4000-8000-0000000000c1'), 3, 'trois places de Type occupées');
select throws_ok($$select public.deposer_candidature_stand(pg_temp.cl('e4'), pg_temp.kid(6), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', 'TEST_ Bijoux et accessoires faits main.', '@test_exposant', pg_temp.photos('00000000-0000-4000-8000-0000000000a1', 6), 'TEST_v1')$$, 'P0001', 'KS_COMPLET', 'plus de Stand : « Complet », rien n''est créé');
select is((select count(*)::int from public.candidature_stand where id = pg_temp.kid(6)), 0, 'une candidature refusée pour « Complet » n''existe pas');

-- 25. Expiration : la place est libérée par simple calcul (échéance reculée sans toucher au reste : triggers de journal et de gel suspendus le temps du test).
set local session_replication_role = replica;
update public.candidature_stand set expire_le = now() - interval '1 minute' where id = pg_temp.kid(5);
reset session_replication_role;
select is(public.places_type_pass_utilisees('00000000-0000-4000-8000-0000000000c1'), 2, 'une candidature expirée libère sa place sans tâche');
select lives_ok($$select pg_temp.dep('e2', 7, '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1')$$, 'après expiration, le Compte peut candidater de nouveau');

-- 27-37. Commande de Stand : seul chemin, Compte du candidat.
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('e1'), '00000000-0000-4000-8000-0000000000a1', jsonb_build_array(jsonb_build_object('type_pass_id', '00000000-0000-4000-8000-0000000000c1', 'titulaires', jsonb_build_array('A Test', 'B Test'))), pg_temp.acc(), 8000, 'test-cle-cs-0001')$$, 'P0001', 'KS_STAND_SUR_CANDIDATURE', 'le chemin des Pass libres refuse toujours un Stand');
select throws_ok($$select public.creer_commande_stand(pg_temp.cl('e3'), pg_temp.kid(1), pg_temp.acc(), 4000, 'test-cle-cs-0002', 'Autre Test', 'Aide Test', false)$$, 'P0001', 'KS_CANDIDATURE_INTROUVABLE', 'un autre Compte ne peut pas payer la candidature');
select throws_ok($$select public.creer_commande_stand(pg_temp.cl('e1'), pg_temp.kid(1), '[]'::jsonb, 4000, 'test-cle-cs-0003', 'Alice Test', 'Aide Test', false)$$, 'P0001', 'KS_ACCEPTATION_MANQUANTE', 'sans la mention photos et vidéos : refusé');
select throws_ok($$select public.creer_commande_stand(pg_temp.cl('e1'), pg_temp.kid(1), pg_temp.acc(), 1, 'test-cle-cs-0004', 'Alice Test', 'Aide Test', false)$$, 'P0001', 'KS_TOTAL_CHANGE', 'total vu différent du total relu : refusé');
select throws_ok($$select public.creer_commande_stand(pg_temp.cl('e1'), pg_temp.kid(1), pg_temp.acc(), 4000, 'test-cle-cs-0005', 'A', 'Aide Test', false)$$, 'P0001', 'KS_TITULAIRE_INVALIDE', 'un nom trop court est refusé');
create temp table s1 as select public.creer_commande_stand(pg_temp.cl('e1'), pg_temp.kid(1), pg_temp.acc(), 4000, 'test-cle-cs-0006', '  Alice   Test ', 'Aide provisoire', true) as r;
select is((select type::text || '/' || statut::text from public.commande where id = (select (r ->> 'commande_id')::uuid from s1)), 'pass/en_attente', 'Commande de Pass en attente créée pour le Stand');
select is((select expire_le from public.commande where id = (select (r ->> 'commande_id')::uuid from s1)), (select expire_le from public.candidature_stand where id = pg_temp.kid(1)), 'la Commande reprend l''échéance de la candidature');
select is((select titulaires::text || '/' || est_stand::text || '/' || aide_a_saisir::text from public.ligne_commande where commande_id = (select (r ->> 'commande_id')::uuid from s1)), '["Alice Test", "Aide provisoire"]/true/true', 'ligne de Stand : deux titulaires, nom de l''aide à saisir');
select is((select commande_id from public.candidature_stand where id = pg_temp.kid(1)), (select (r ->> 'commande_id')::uuid from s1), 'la candidature garde sa Commande');
select is(public.places_type_pass_utilisees('00000000-0000-4000-8000-0000000000c1'), 3, 'une candidature qui a sa Commande n''est pas comptée deux fois (Type)');
select is(public.places_evenement_utilisees('00000000-0000-4000-8000-0000000000a1'), 6, 'une candidature qui a sa Commande n''est pas comptée deux fois (Événement)');
select is((select r ->> 'rejeu' from (select public.creer_commande_stand(pg_temp.cl('e1'), pg_temp.kid(1), pg_temp.acc(), 4000, 'test-cle-cs-0006', 'Autre Nom', 'Autre Aide', false) as r) x), 'true', 'même clé : même Commande rejouée');
select throws_ok($$select public.creer_commande_stand(pg_temp.cl('e1'), pg_temp.kid(1), pg_temp.acc(), 4000, 'test-cle-cs-0007', 'Alice Test', 'Aide Test', false)$$, 'P0001', 'KS_COMMANDE_EN_ATTENTE', 'une seule Commande à payer par Compte');

-- 38-45. Paiement simulé en base (test seulement), émission, nom de l'aide.
set local session_replication_role = replica;
update public.commande set statut = 'payee', paye_le = now() where id = (select (r ->> 'commande_id')::uuid from s1);
reset session_replication_role;
select is(public.evenements_emettre_pass((select (r ->> 'commande_id')::uuid from s1)), 2, 'deux Pass émis pour le Stand');
select is((select string_agg(rang::text || ':' || nom_a_saisir::text, ',' order by rang) from public.pass where commande_id = (select (r ->> 'commande_id')::uuid from s1)), '1:false,2:true', 'seul le Pass de l''aide a son nom à saisir');
select throws_ok($$select public.nommer_aide_pass(pg_temp.cl('e3'), (select id from public.pass where nom_a_saisir limit 1), 'Intrus Test')$$, 'P0001', 'KS_PASS_INTROUVABLE', 'un autre Compte ne nomme pas l''aide');
select throws_ok($$select public.nommer_aide_pass(pg_temp.cl('e1'), (select id from public.pass where rang = 1 and commande_id = (select (r ->> 'commande_id')::uuid from s1)), 'Titulaire Test')$$, 'P0001', 'KS_NOM_DEJA_SAISI', 'le nom du titulaire ne se change pas');
select lives_ok($$select public.nommer_aide_pass(pg_temp.cl('e1'), (select id from public.pass where nom_a_saisir limit 1), '  Bob   Aide ')$$, 'l''exposant nomme son aide');
select is((select nom_titulaire from public.pass where commande_id = (select (r ->> 'commande_id')::uuid from s1) and rang = 2), 'Bob Aide', 'le nom de l''aide est enregistré, espaces réduits');
select throws_ok($$select public.nommer_aide_pass(pg_temp.cl('e1'), (select id from public.pass where commande_id = (select (r ->> 'commande_id')::uuid from s1) and rang = 2), 'Autre Aide')$$, 'P0001', 'KS_NOM_DEJA_SAISI', 'le nom de l''aide ne se saisit qu''une fois');
select throws_ok($$update public.pass set nom_titulaire = 'Pirate Test' where commande_id = (select (r ->> 'commande_id')::uuid from s1) and rang = 1$$, 'P0001', 'KS_PASS_FIGE', 'le nom d''un Pass reste figé hors de cette saisie');

-- 46-52. Refus par l'Admin après paiement : Stand et 2 Pass annulés, remboursement ouvert (frais figés de 20 %), confirmé avec preuve.
select throws_ok($$select public.refuser_candidature_stand(pg_temp.sans(), pg_temp.kid(1), 'Contrefaçon')$$, 'P0001', null, 'sans le droit d''Admin, le refus est impossible');
select is(public.refuser_candidature_stand(pg_temp.adm(), pg_temp.kid(1), 'Contrefaçon constatée'), 3200, 'refus après paiement : 4000 moins 20 % de frais à rendre');
select is((select string_agg(statut, ',' order by rang) from public.pass where commande_id = (select (r ->> 'commande_id')::uuid from s1)), 'annule,annule', 'les deux Pass du Stand sont annulés');
select is((select statut || '/' || motif_refus from public.candidature_stand where id = pg_temp.kid(1)), 'refusee/Contrefaçon constatée', 'la candidature est refusée avec son motif');
select is((select montant_cents::int from public.remboursement where cible_type = 'pass' and cible_id = (select id from public.pass where commande_id = (select (r ->> 'commande_id')::uuid from s1) and rang = 1)), 3200, 'un remboursement est ouvert pour le Pass de rang 1');
select is((select count(*)::int from public.envoi where cle = 'candidature_refusee:' || pg_temp.kid(1)::text), 1, 'l''email candidature_refusee est planifié une seule fois');
select throws_ok($$select public.refuser_candidature_stand(pg_temp.adm(), pg_temp.kid(1), null)$$, 'P0001', 'KS_CANDIDATURE_REFUSEE', 'une candidature déjà refusée ne se refuse pas deux fois');
select public.confirmer_remboursement(pg_temp.adm(), 'pass', (select id from public.pass where commande_id = (select (r ->> 'commande_id')::uuid from s1) and rang = 1), 'TEST_preuve-001');
select is((select string_agg(statut, ',' order by rang) from public.pass where commande_id = (select (r ->> 'commande_id')::uuid from s1)), 'rembourse,rembourse', 'la confirmation avec preuve passe les deux Pass à « rembourse »');

-- 54-58. Refus avant paiement : lien annulé, place libérée, paiement tardif impossible.
create temp table s2 as select public.creer_commande_stand(pg_temp.cl('e2'), pg_temp.kid(7), pg_temp.acc(), 4000, 'test-cle-cs-0008', 'Cara Test', 'Aide Test', false) as r;
select is(public.places_type_pass_utilisees('00000000-0000-4000-8000-0000000000c1'), 2, 'avant le refus : le Stand de e2 occupe sa place (avec celui de e3)');
select is(public.refuser_candidature_stand(pg_temp.adm(), pg_temp.kid(7), null), 0, 'refus avant paiement : rien à rembourser');
select ok((select expire_le <= now() from public.commande where id = (select (r ->> 'commande_id')::uuid from s2)), 'la Commande en attente est annulée (échéance ramenée à maintenant)');
select is(public.places_type_pass_utilisees('00000000-0000-4000-8000-0000000000c1'), 1, 'la place est libérée');
select throws_ok($$select public.recapitulatif_commande_stand('00000000-0000-0000-0000-0000000000e2', pg_temp.kid(7))$$, 'P0001', 'KS_CANDIDATURE_REFUSEE', 'une candidature refusée ne se paie plus');

-- Correctifs de revue (migration 20270112150000).
select throws_ok($$select pg_temp.dep('e1', 8, '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1')$$, 'P0001', 'KS_CANDIDATURE_REFUSEE', 'un refus de l''Admin est définitif pour ce Compte et cet Événement');
select is(public.candidature_stand_possible('00000000-0000-0000-0000-0000000000e1', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1'), 'KS_CANDIDATURE_REFUSEE', 'le pré-contrôle annonce le refus avant l''envoi des photos');
select is(public.candidature_stand_possible('00000000-0000-0000-0000-0000000000e4', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c2'), 'KS_TYPE_PASS_INTROUVABLE', 'le pré-contrôle refuse un Type qui n''est pas un Stand');
select is(public.candidature_stand_possible('00000000-0000-0000-0000-0000000000e4', '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1'), null, 'le pré-contrôle laisse passer un Compte qui peut candidater');
select is((select count(*)::int from unnest(array['public.candidature_stand_possible(uuid, uuid, uuid)']) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')), 0, 'le pré-contrôle est fermé aux clients');
set local session_replication_role = replica;
update public.candidature_stand set expire_le = now() + interval '1 minute' where id = pg_temp.kid(4);
reset session_replication_role;
create temp table s3 as select public.creer_commande_stand(pg_temp.cl('e3'), pg_temp.kid(4), pg_temp.acc(), 4000, 'test-cle-cs-0009', 'Dora Test', 'Aide Test', true) as r;
select ok((select expire_le >= now() + interval '29 minutes' and expire_le <= (select debut_le from public.evenement where id = '00000000-0000-4000-8000-0000000000a1') from public.commande where id = (select (r ->> 'commande_id')::uuid from s3)), 'la Commande garde au moins le délai de paiement ordinaire, sans dépasser le début de l''Événement');

-- 59-61. Purge à 90 jours : refusée depuis plus de 90 jours, jamais payée.
set local session_replication_role = replica;
update public.candidature_stand set refuse_le = now() - interval '91 days' where id = pg_temp.kid(7);
reset session_replication_role;
select ok(pg_temp.kid(7) in (select candidature_id from public.candidatures_stand_a_purger(50)), 'une candidature refusée depuis plus de 90 jours est à purger');
select ok(pg_temp.kid(1) not in (select candidature_id from public.candidatures_stand_a_purger(50)), 'un Stand payé n''est pas purgé avant la fin de l''Événement + 90 jours');
select public.marquer_candidature_stand_purgee(pg_temp.kid(7));
select is((select cardinality(photos)::text || '/' || coalesce(instagram, 'null') from public.candidature_stand where id = pg_temp.kid(7)), '0/null', 'photos et lien Instagram sont effacés');

select * from finish();
rollback;
