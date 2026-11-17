-- Story 9.16 e) : archivage des produits (archiver_produit, restaurer_produit, garde de publication) et compteurs des cartes
-- (produits_admin_compteurs). Exécutables par service_role seulement, droit Admin revérifié en base, journal d'audit. Données TEST_ annulées à la fin.
begin;
select plan(34);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-arch-admin@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-arch-assistant@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e3', 'test-arch-client1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e4', 'test-arch-client2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e5', 'test-arch-client3@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e2', 'assistant');
create function pg_temp.c(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;
create function pg_temp.compteur(p uuid) returns integer[] language sql as $$
  select array[x.acces, x.vendus] from public.produits_admin_compteurs(pg_temp.c('e1')) x where x.produit_id = p $$;

-- Données TEST_ : un cosplay publié (complet : photo, variante), un Kit publié sans contrôle de complétude, un accessoire brouillon.
alter table public.produit disable trigger produit_publie_complet;
insert into public.produit (id, famille, slug, titre_fr, titre_en, description_fr, description_en, prix_cents, niveau) values
  ('00000000-0000-4000-8000-0000000005a1', 'cosplay', 'test-arch-cosplay', 'TEST_ Cosplay', 'TEST_ Cosplay', 'TEST_ d', 'TEST_ d', 5000, null),
  ('00000000-0000-4000-8000-0000000005a2', 'kit', 'test-arch-kit', 'TEST_ Kit', 'TEST_ Kit', 'TEST_ d', 'TEST_ d', 1000, 'debutant'),
  ('00000000-0000-4000-8000-0000000005a3', 'accessoire', 'test-arch-acc', 'TEST_ Accessoire', 'TEST_ Accessory', 'TEST_ d', 'TEST_ d', 2000, null),
  ('00000000-0000-4000-8000-0000000005a4', 'accessoire', 'test-arch-incomplet', 'TEST_ Incomplet', 'TEST_ Incomplete', null, null, null, null);
insert into public.produit_photo (produit_id, fichier, position, alt_fr, alt_en) values
  ('00000000-0000-4000-8000-0000000005a1', 'test-arch/cosplay.jpg', 1, 'TEST_ photo', 'TEST_ photo'),
  ('00000000-0000-4000-8000-0000000005a3', 'test-arch/acc.jpg', 1, 'TEST_ photo', 'TEST_ photo');
insert into public.variante (produit_id, taille, stock) values
  ('00000000-0000-4000-8000-0000000005a1', 'M', 3),
  ('00000000-0000-4000-8000-0000000005a3', 'M', 1);
update public.produit set publie_le = now() - interval '1 hour' where id in ('00000000-0000-4000-8000-0000000005a1', '00000000-0000-4000-8000-0000000005a2');
alter table public.produit enable trigger produit_publie_complet;

-- Droits : service_role seulement ; SECURITY DEFINER, search_path fixé.
select ok(
  (select bool_and(has_function_privilege('service_role', f, 'execute') and not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute'))
   from unnest(array['public.archiver_produit(jsonb, uuid)', 'public.restaurer_produit(jsonb, uuid)', 'public.produits_admin_compteurs(jsonb)', 'public.publier_produit(jsonb, uuid)']) f),
  'archiver, restaurer, compteurs et publier : service_role seulement'
);
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where oid in ('public.archiver_produit(jsonb, uuid)'::regprocedure, 'public.restaurer_produit(jsonb, uuid)'::regprocedure, 'public.produits_admin_compteurs(jsonb)'::regprocedure)),
  'SECURITY DEFINER, search_path fixé'
);
set local role anon;
select throws_ok($$select public.archiver_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1"}'::jsonb, '00000000-0000-4000-8000-0000000005a1')$$, '42501', null, 'anon ne peut pas archiver');
reset role;
set local role authenticated;
select throws_ok($$select public.restaurer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1"}'::jsonb, '00000000-0000-4000-8000-0000000005a1')$$, '42501', null, 'authenticated ne peut pas restaurer');
select throws_ok($$select * from public.produits_admin_compteurs('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1"}'::jsonb)$$, '42501', null, 'authenticated ne lit pas les compteurs');
reset role;
select throws_ok($$select public.archiver_produit(pg_temp.c('e2'), '00000000-0000-4000-8000-0000000005a1')$$, 'P0001', 'KS_DROIT_REFUSE', 'l''Assistant ne peut pas archiver');
select throws_ok($$select public.archiver_produit(pg_temp.c('e3'), '00000000-0000-4000-8000-0000000005a1')$$, 'P0001', 'KS_DROIT_REFUSE', 'un client ne peut pas archiver');
select throws_ok($$select public.restaurer_produit(pg_temp.c('e2'), '00000000-0000-4000-8000-0000000005a1')$$, 'P0001', 'KS_DROIT_REFUSE', 'l''Assistant ne peut pas restaurer');
select throws_ok($$select * from public.produits_admin_compteurs(pg_temp.c('e2'))$$, 'P0001', 'KS_DROIT_REFUSE', 'l''Assistant ne lit pas les compteurs');
select throws_ok($$select public.archiver_produit(null, '00000000-0000-4000-8000-0000000005a1')$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'auteur manquant refusé');
select throws_ok($$select public.archiver_produit(pg_temp.c('e1'), '00000000-0000-4000-8000-0000000005ff')$$, 'P0001', 'KS_PRODUIT_INTROUVABLE', 'produit inconnu : introuvable');

-- Compteurs : Kit acheté par 2 Comptes → 2 accès ; cosplay vendu 3 fois dans des Commandes payées, hors lignes annulées et Commandes
-- annulées, remboursées ou non payées.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, forfait_cents, total_cents, paye_le, prestataire, zone, mode_remise) values
  ('00000000-0000-4000-8000-0000000005c1', 'KS-2026-883001', '00000000-0000-0000-0000-0000000000e3', 'produits', 'payee', 11000, 0, 11000, now(), 'pawapay', 'goma', 'retrait'),
  ('00000000-0000-4000-8000-0000000005c2', 'KS-2026-883002', '00000000-0000-0000-0000-0000000000e4', 'produits', 'livree', 5000, 0, 5000, now(), 'maishapay', 'goma', 'retrait'),
  ('00000000-0000-4000-8000-0000000005c3', 'KS-2026-883003', '00000000-0000-0000-0000-0000000000e4', 'produits', 'remboursee', 5000, 0, 5000, now(), 'maishapay', 'goma', 'retrait'),
  ('00000000-0000-4000-8000-0000000005c4', 'KS-2026-883004', '00000000-0000-0000-0000-0000000000e4', 'produits', 'annulee', 5000, 0, 5000, now(), 'maishapay', 'goma', 'retrait'),
  ('00000000-0000-4000-8000-0000000005c5', 'KS-2026-883005', '00000000-0000-0000-0000-0000000000e4', 'produits', 'en_attente', 5000, 0, 5000, null, null, 'goma', 'retrait');
-- Commande offerte (Kit gratuit) : l'accès qu'elle ouvre n'est pas un achat.
insert into public.commande (id, numero, compte_id, type, statut, offerte, sous_total_cents, total_cents) values
  ('00000000-0000-4000-8000-0000000005c6', 'KS-2026-883006', '00000000-0000-0000-0000-0000000000e5', 'produits', 'offerte', true, 0, 0);
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents, annulee) values
  ('00000000-0000-4000-8000-0000000005c1', '00000000-0000-4000-8000-0000000005a1', 2, 5000, false),
  ('00000000-0000-4000-8000-0000000005c1', '00000000-0000-4000-8000-0000000005a2', 1, 1000, false),
  ('00000000-0000-4000-8000-0000000005c2', '00000000-0000-4000-8000-0000000005a1', 1, 5000, false),
  ('00000000-0000-4000-8000-0000000005c2', '00000000-0000-4000-8000-0000000005a1', 4, 5000, true),
  ('00000000-0000-4000-8000-0000000005c3', '00000000-0000-4000-8000-0000000005a1', 1, 5000, false),
  ('00000000-0000-4000-8000-0000000005c4', '00000000-0000-4000-8000-0000000005a1', 1, 5000, false),
  ('00000000-0000-4000-8000-0000000005c5', '00000000-0000-4000-8000-0000000005a1', 1, 5000, false);
insert into public.acces_kit (compte_id, produit_id, commande_origine) values
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-4000-8000-0000000005a2', '00000000-0000-4000-8000-0000000005c1'),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-4000-8000-0000000005a2', '00000000-0000-4000-8000-0000000005c2'),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-4000-8000-0000000005a2', '00000000-0000-4000-8000-0000000005c6');

select is(pg_temp.compteur('00000000-0000-4000-8000-0000000005a2'), array[2, 1], 'Kit acheté par 2 Comptes (un 3e accès offert n''est pas compté) : 2');
select is(pg_temp.compteur('00000000-0000-4000-8000-0000000005a1'), array[0, 3], 'cosplay : VENDUS 3 (payées seulement, hors lignes annulées, annulées et remboursées)');
select is(pg_temp.compteur('00000000-0000-4000-8000-0000000005a3'), array[0, 0], 'produit sans vente : zéro, jamais absent');

-- Archiver un produit publié : dépublié, archivé, une ligne au journal avec l'auteur ; rien d'autre n'est touché.
create temp table journal_avant as select coalesce(max(id), 0) as id from public.journal_audit;
select lives_ok($$select public.archiver_produit(pg_temp.c('e1'), '00000000-0000-4000-8000-0000000005a1')$$, 'l''Admin archive un produit publié');
select ok((select publie_le is null and archive_le is not null from public.produit where id = '00000000-0000-4000-8000-0000000005a1'), 'archivé : dépublié et marqué archivé');
select is(
  (select count(*)::int from public.journal_audit j where j.id > (select id from journal_avant) and j.cible_table = 'produit'
     and j.auteur ->> 'id' = '00000000-0000-0000-0000-0000000000e1' and j.apres ? 'archive_le' and j.apres ? 'publie_le'),
  1,
  'une ligne au journal d''audit, auteur = l''Admin'
);
select is(
  (select count(*)::int from public.journal_audit j where j.id > (select id from journal_avant) and j.cible_table <> 'produit'),
  0,
  'aucune autre table écrite (commandes, accès, photos, variantes)'
);
select is(
  (select count(*)::int from public.produit p where p.id = '00000000-0000-4000-8000-0000000005a1' and p.publie_le is not null and p.publie_le <= now()),
  0,
  'invisible pour la boutique (publie_le nul)'
);
set local role anon;
select is((select count(*)::int from public.produit where id = '00000000-0000-4000-8000-0000000005a1'), 0, 'anon ne lit plus le produit archivé');
reset role;
select is(pg_temp.compteur('00000000-0000-4000-8000-0000000005a1'), array[0, 3], 'les ventes restent comptées après l''archivage');
create temp table journal_doublon as select coalesce(max(id), 0) as id from public.journal_audit;
select lives_ok($$select public.archiver_produit(pg_temp.c('e1'), '00000000-0000-4000-8000-0000000005a1')$$, 'archiver deux fois : sans effet, sans erreur');
select is((select count(*)::int from public.journal_audit j where j.id > (select id from journal_doublon)), 0, 'archiver un archivé : aucune ligne au journal');

-- Garde : un produit archivé n'est jamais publié (fonction ou écriture directe).
select throws_ok($$select public.publier_produit(pg_temp.c('e1'), '00000000-0000-4000-8000-0000000005a1')$$, 'P0001', 'KS_PRODUIT_ARCHIVE', 'publier un archivé : refusé');
select throws_ok($$update public.produit set publie_le = now() where id = '00000000-0000-4000-8000-0000000005a1'$$, 'P0001', 'KS_PRODUIT_ARCHIVE', 'écriture directe : refusée aussi');
select ok((select publie_le is null from public.produit where id = '00000000-0000-4000-8000-0000000005a1'), 'toujours dépublié');
select public.archiver_produit(pg_temp.c('e1'), '00000000-0000-4000-8000-0000000005a4');
select throws_ok($$select public.publier_produit(pg_temp.c('e1'), '00000000-0000-4000-8000-0000000005a4')$$, 'P0001', 'KS_PRODUIT_ARCHIVE', 'archivé ET incomplet : KS_PRODUIT_ARCHIVE, pas KS_PUBLICATION_INCOMPLETE');

-- Restaurer : retour en brouillon ; publiable de nouveau.
create temp table journal_restauration as select coalesce(max(id), 0) as id from public.journal_audit;
select lives_ok($$select public.restaurer_produit(pg_temp.c('e1'), '00000000-0000-4000-8000-0000000005a1')$$, 'l''Admin restaure');
select is(
  (select count(*)::int from public.journal_audit j where j.id > (select id from journal_restauration) and j.cible_table = 'produit'
     and j.cible_id = '00000000-0000-4000-8000-0000000005a1' and j.auteur ->> 'id' = '00000000-0000-0000-0000-0000000000e1' and j.avant ? 'archive_le'),
  1,
  'restaurer : une ligne au journal, auteur = l''Admin'
);
select ok((select publie_le is null and archive_le is null from public.produit where id = '00000000-0000-4000-8000-0000000005a1'), 'restauré : brouillon, plus archivé');
create temp table journal_non_archive as select coalesce(max(id), 0) as id from public.journal_audit;
select lives_ok($$select public.restaurer_produit(pg_temp.c('e1'), '00000000-0000-4000-8000-0000000005a3')$$, 'restaurer un produit non archivé : sans effet');
select is((select count(*)::int from public.journal_audit j where j.id > (select id from journal_non_archive)), 0, 'restaurer un non-archivé : aucune ligne au journal');
select lives_ok($$select public.publier_produit(pg_temp.c('e1'), '00000000-0000-4000-8000-0000000005a1')$$, 'restauré puis publié');
select ok((select publie_le is not null from public.produit where id = '00000000-0000-4000-8000-0000000005a1'), 'publié de nouveau');

select * from finish();
rollback;
