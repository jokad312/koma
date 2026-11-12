-- Story 8.5 : opération « 10 Pass gratuits ». Attribution réservée à l'Admin, Réalisation validée et Kit payé exigés, Type Standard seulement,
-- rang 1 à 10 unique par Événement, un seul Pass offert par Compte et par Événement, Événement complet : anomalie sans Commande, fonctions fermées aux clients.
-- Données TEST_ annulées à la fin.
begin;
select plan(24);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'test-po1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'test-po2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f9', 'test-po-admin@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f1', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 25);
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f9', 'admin');
create function pg_temp.c(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f9","role":"admin"}'::jsonb $$;
create function pg_temp.obj(n int) returns text language sql as $$ select 'photos-clients/00000000-0000-4000-8000-' || lpad(n::text, 12, '0') || '.jpg' $$;
create function pg_temp.pub(n int) returns text language sql as $$ select 'galerie/00000000-0000-4000-8000-' || lpad(n::text, 12, '0') || '.jpg' $$;

-- Un Kit payé par f1 et par f2.
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values ('kit', 'po-kit-paye', 'TEST_Kit payé', 'TEST_Paid kit', 990, 'debutant', now());
insert into public.commande (numero, compte_id, type, statut, sous_total_cents, total_cents, paye_le) values
  ('KS-2026-880001', '00000000-0000-0000-0000-0000000000f1', 'produits', 'payee', 990, 990, now() - interval '2 days'),
  ('KS-2026-880002', '00000000-0000-0000-0000-0000000000f2', 'produits', 'payee', 990, 990, now() - interval '2 days');
insert into public.acces_kit (compte_id, produit_id, commande_origine) values
  ('00000000-0000-0000-0000-0000000000f1', (select id from public.produit where slug = 'po-kit-paye'), (select id from public.commande where numero = 'KS-2026-880001')),
  ('00000000-0000-0000-0000-0000000000f2', (select id from public.produit where slug = 'po-kit-paye'), (select id from public.commande where numero = 'KS-2026-880002'));
create temp table k as select (select id from public.produit where slug = 'po-kit-paye') as kit;
grant select on k to public;

-- Réalisations : f1 en a deux (la 1 validée, la 2 en attente puis validée), f2 deux (la 3 et la 4 validées).
create temp table r as select
  public.deposer_realisation(pg_temp.c('f1'), pg_temp.obj(1), 'TEST_Un', null, 'TEST_v1', (select kit from k)) as p1,
  public.deposer_realisation(pg_temp.c('f1'), pg_temp.obj(2), 'TEST_Deux', null, 'TEST_v1', (select kit from k)) as p2,
  public.deposer_realisation(pg_temp.c('f2'), pg_temp.obj(3), null, null, 'TEST_v1', (select kit from k)) as p3,
  public.deposer_realisation(pg_temp.c('f2'), pg_temp.obj(4), null, null, 'TEST_v1', (select kit from k)) as p4;
grant select on r to public;
create function pg_temp.re(p uuid) returns uuid language sql as $$ select id from public.realisation where photo_id = p $$;
select public.valider_photo(pg_temp.c('f9'), (select p1 from r), pg_temp.pub(1), 'TEST_alt fr', 'TEST_alt en');
select public.valider_photo(pg_temp.c('f9'), (select p3 from r), pg_temp.pub(3), 'TEST_alt fr', 'TEST_alt en');
select public.valider_photo(pg_temp.c('f9'), (select p4 from r), pg_temp.pub(4), 'TEST_alt fr', 'TEST_alt en');

insert into public.evenement (id, auteur_id, titre_fr, slug, publie_le, debut_le, capacite) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-0000000000f9', 'TEST_Festival A', 'test-po-ev1', now() - interval '2 days', now() + interval '30 days', null),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-0000-0000-0000000000f9', 'TEST_Festival B', 'test-po-ev2', now() - interval '2 days', now() + interval '30 days', 1);
insert into public.type_pass (id, evenement_id, nom_fr, nom_en, prix_cents, quota, est_stand) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1', 'TEST_Standard A', 'TEST_Standard A EN', 1500, null, false),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000d1', 'TEST_Stand A', 'TEST_Stand A EN', 4000, null, true),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000d2', 'TEST_Standard B', 'TEST_Standard B EN', 1500, null, false);

-- 1-2. Fonctions fermées aux clients ; le serveur seul les exécute.
select is(
  (select count(*)::int from unnest(array['public.attribuer_pass_offert(jsonb, uuid, uuid, text)', 'public.pass_offerts_options(jsonb)', 'public.realisation_pour_offre(jsonb, uuid)', 'public.operations_pass_offerts_terminees()']) f
    where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')),
  0, 'aucune fonction de l''opération n''est exécutable par anon ni par authenticated');
select is(
  (select count(*)::int from unnest(array['public.attribuer_pass_offert(jsonb, uuid, uuid, text)', 'public.pass_offerts_options(jsonb)', 'public.realisation_pour_offre(jsonb, uuid)', 'public.operations_pass_offerts_terminees()']) f
    where has_function_privilege('service_role', f, 'execute')),
  4, 'le serveur exécute les quatre fonctions');
select ok((select relrowsecurity from pg_class where oid = 'public.pass_offert'::regclass) and not has_table_privilege('authenticated', 'public.pass_offert', 'select'), 'pass_offert : RLS, aucune lecture client');

-- 4-9. Refus.
select throws_ok($$select public.attribuer_pass_offert(pg_temp.c('f1'), pg_temp.re((select p1 from r)), '00000000-0000-4000-8000-0000000000e1', 'Alice Test')$$, 'P0001', null, 'sans le droit d''Admin : refusé');
select throws_ok($$select public.attribuer_pass_offert(pg_temp.adm(), pg_temp.re((select p2 from r)), '00000000-0000-4000-8000-0000000000e1', 'Alice Test')$$, 'P0001', 'KS_REALISATION_NON_VALIDEE', 'Réalisation en attente : refusée');
select throws_ok($$select public.attribuer_pass_offert(pg_temp.adm(), pg_temp.re((select p1 from r)), '00000000-0000-4000-8000-0000000000e2', 'Alice Test')$$, 'P0001', 'KS_TYPE_PASS_INTROUVABLE', 'un Type Stand ne s''offre pas');
select throws_ok($$select public.attribuer_pass_offert(pg_temp.adm(), pg_temp.re((select p1 from r)), '00000000-0000-4000-8000-0000000000e1', 'A')$$, 'P0001', 'KS_TITULAIRE_INVALIDE', 'nom de titulaire trop court : refusé');
select throws_ok($$select public.attribuer_pass_offert(pg_temp.adm(), gen_random_uuid(), '00000000-0000-4000-8000-0000000000e1', 'Alice Test')$$, 'P0001', 'KS_REALISATION_INTROUVABLE', 'Réalisation inconnue : refusée');
select is((select count(*)::int from public.pass_offert), 0, 'aucune attribution après les refus');

-- 10-14. Attribution : rang 1, Commande offerte, Pass émis, email planifié.
create temp table a1 as select public.attribuer_pass_offert(pg_temp.adm(), pg_temp.re((select p1 from r)), '00000000-0000-4000-8000-0000000000e1', '  Alice   Test ') as r;
select is((select r ->> 'rang' from a1), '1', 'premier Pass offert : rang 1');
select is((select c.statut::text || '/' || c.offerte::text || '/' || c.total_cents::text from public.commande c where c.id = (select (r ->> 'commande_id')::uuid from a1)), 'offerte/true/0', 'Commande de Pass offerte à 0 USD');
select is((select p.statut || '/' || p.nom_titulaire from public.pass p where p.commande_id = (select (r ->> 'commande_id')::uuid from a1)), 'valide/Alice Test', 'un Pass valide au nom du titulaire, espaces réduits');
select is((select count(*)::int from public.envoi where cle = 'pass_emis:' || (select r ->> 'commande_id' from a1)), 1, 'l''email pass_emis est planifié');
select throws_ok($$select public.attribuer_pass_offert(pg_temp.adm(), pg_temp.re((select p1 from r)), '00000000-0000-4000-8000-0000000000e1', 'Alice Test')$$, 'P0001', 'KS_REALISATION_DEJA_UTILISEE', 'une Réalisation ne donne qu''un Pass');

-- 15. Un seul Pass offert par Compte et par Événement (la 2e Réalisation de f1, validée à son tour).
select public.valider_photo(pg_temp.c('f9'), (select p2 from r), pg_temp.pub(2), 'TEST_alt fr', 'TEST_alt en');
select throws_ok($$select public.attribuer_pass_offert(pg_temp.adm(), pg_temp.re((select p2 from r)), '00000000-0000-4000-8000-0000000000e1', 'Alice Test')$$, 'P0001', 'KS_DEJA_OFFERT', 'un seul Pass offert par Compte et par Événement');

-- 16-17. Dix Pass offerts : l'opération est terminée ; un rang libéré (le 2) est réutilisé par le Compte suivant. Les neuf lignes de remplissage copient la première
-- (les contraintes d'unicité de la Réalisation, de la Commande et du Compte sont levées le temps du test, annulé à la fin).
alter table public.pass_offert drop constraint pass_offert_realisation_id_key, drop constraint pass_offert_commande_id_key, drop constraint pass_offert_compte_unique;
insert into public.pass_offert (evenement_id, rang, compte_id, realisation_id, commande_id)
  select o.evenement_id, g, o.compte_id, o.realisation_id, o.commande_id from public.pass_offert o, generate_series(2, 10) g where o.evenement_id = '00000000-0000-4000-8000-0000000000d1' and o.rang = 1;
select throws_ok($$select public.attribuer_pass_offert(pg_temp.adm(), pg_temp.re((select p3 from r)), '00000000-0000-4000-8000-0000000000e1', 'Bob Test')$$, 'P0001', 'KS_OPERATION_TERMINEE', 'dix Pass offerts : opération terminée');
delete from public.pass_offert where evenement_id = '00000000-0000-4000-8000-0000000000d1' and rang = 2;
select is((public.attribuer_pass_offert(pg_temp.adm(), pg_temp.re((select p3 from r)), '00000000-0000-4000-8000-0000000000e1', 'Bob Test') ->> 'rang'), '2', 'le Compte suivant reçoit le premier rang libre (2)');

-- 18-20. Événement complet (capacité 1) : le premier Pass est offert, le second est refusé avec une anomalie et sans Commande.
select is((public.attribuer_pass_offert(pg_temp.adm(), pg_temp.re((select p2 from r)), '00000000-0000-4000-8000-0000000000e3', 'Alice Test') ->> 'attribue'), 'true', 'Événement B (capacité 1) : première attribution réussie');
select is((select count(*)::int from public.commande where cle_idempotence = 'pass-offert:' || pg_temp.re((select p3 from r))::text and type = 'pass'), 1, 'une Commande offerte par Réalisation attribuée (Événement A)');
create temp table a2 as select public.attribuer_pass_offert(pg_temp.adm(), pg_temp.re((select p4 from r)), '00000000-0000-4000-8000-0000000000e3', 'Bob Test') as r;
select is((select r ->> 'erreur' from a2), 'KS_COMPLET', 'Événement complet : KS_COMPLET');
select is((select count(*)::int from public.anomalie where type = 'pass_offert_impossible' and cible_id = pg_temp.re((select p4 from r)) and resolue_le is null), 1, 'une anomalie pass_offert_impossible est créée');

-- 22-24. Lectures de l'Admin.
select ok((select not exists (select 1 from jsonb_array_elements(public.pass_offerts_options(pg_temp.adm()) -> 'evenements') e where e ->> 'id' in ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000d2'))), 'options : l''Événement A (10 Pass offerts) et B (complet) ne sont plus proposés');
select throws_ok($$select public.pass_offerts_options(pg_temp.c('f1'))$$, 'P0001', null, 'options : réservées à l''Admin');
select ok((select exists (select 1 from jsonb_array_elements(public.operations_pass_offerts_terminees()) e where e ->> 'slug' = 'test-po-ev1') and not exists (select 1 from jsonb_array_elements(public.operations_pass_offerts_terminees()) e where e ->> 'slug' = 'test-po-ev2')), 'opérations terminées : l''Événement A (10 Pass offerts), pas B');

select * from finish();
rollback;
