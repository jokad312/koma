-- Story 9.16 g) : archivage des articles (archiver_article, restaurer_article, garde de publication). Exécutables par service_role seulement,
-- droit Admin revérifié en base (comme la publication), journal d'audit. Données TEST_ annulées à la fin.
begin;
select plan(33);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'test-artarch-admin@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'test-artarch-assistant@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f3', 'test-artarch-client@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f4', 'test-artarch-benevole@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 'assistant');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f4', 'benevole');
create function pg_temp.c(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;

-- Données TEST_ : un article publié (complet), un brouillon incomplet (sans texte).
insert into public.article (id, auteur_id, titre_fr, texte_fr, slug, images, publie_le) values
  ('00000000-0000-4000-8000-0000000006a1', '00000000-0000-0000-0000-0000000000f1', 'TEST_ Article publié', 'TEST_ texte', 'test-artarch-publie',
   '[{"fichier":"articles/test.jpg","alt_fr":"TEST_ alt","alt_en":"TEST_ alt"}]'::jsonb, now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000006a2', '00000000-0000-0000-0000-0000000000f1', 'TEST_ Brouillon', null, 'test-artarch-brouillon', '[]'::jsonb, null);

-- Droits : service_role seulement ; SECURITY DEFINER, search_path fixé.
select ok(
  (select bool_and(has_function_privilege('service_role', f, 'execute') and not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute'))
   from unnest(array['public.archiver_article(jsonb, uuid)', 'public.restaurer_article(jsonb, uuid)', 'public.publier_article(jsonb, uuid)']) f),
  'archiver, restaurer et publier : service_role seulement'
);
select ok(
  (select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where oid in ('public.archiver_article(jsonb, uuid)'::regprocedure, 'public.restaurer_article(jsonb, uuid)'::regprocedure, 'public.publier_article(jsonb, uuid)'::regprocedure)),
  'SECURITY DEFINER, search_path fixé'
);
select ok(not has_column_privilege('anon', 'public.article', 'archive_le', 'select') and not has_column_privilege('authenticated', 'public.article', 'archive_le', 'select'),
  'archive_le n''est pas lisible par anon ni authenticated');
set local role anon;
select throws_ok($$select public.archiver_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1"}'::jsonb, '00000000-0000-4000-8000-0000000006a1')$$, '42501', null, 'anon ne peut pas archiver');
reset role;
set local role authenticated;
select throws_ok($$select public.restaurer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1"}'::jsonb, '00000000-0000-4000-8000-0000000006a1')$$, '42501', null, 'authenticated ne peut pas restaurer');
reset role;
select throws_ok($$select public.archiver_article(pg_temp.c('f3'), '00000000-0000-4000-8000-0000000006a1')$$, 'P0001', 'KS_DROIT_REFUSE', 'un client ne peut pas archiver');
select throws_ok($$select public.archiver_article(pg_temp.c('f4'), '00000000-0000-4000-8000-0000000006a1')$$, 'P0001', 'KS_DROIT_REFUSE', 'un bénévole ne peut pas archiver');
select throws_ok($$select public.restaurer_article(pg_temp.c('f3'), '00000000-0000-4000-8000-0000000006a1')$$, 'P0001', 'KS_DROIT_REFUSE', 'un client ne peut pas restaurer');
select throws_ok($$select public.archiver_article(pg_temp.c('f2'), '00000000-0000-4000-8000-0000000006a1')$$, 'P0001', 'KS_DROIT_REFUSE', 'l''Assistant ne peut pas archiver (réservé à l''Admin, comme la publication)');
select throws_ok($$select public.restaurer_article(pg_temp.c('f2'), '00000000-0000-4000-8000-0000000006a1')$$, 'P0001', 'KS_DROIT_REFUSE', 'l''Assistant ne peut pas restaurer');
select throws_ok($$select public.archiver_article(null, '00000000-0000-4000-8000-0000000006a1')$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'auteur manquant refusé');
select throws_ok($$select public.archiver_article(pg_temp.c('f1'), '00000000-0000-4000-8000-0000000006ff')$$, 'P0001', 'KS_ARTICLE_INTROUVABLE', 'article inconnu : introuvable');
select throws_ok($$select public.restaurer_article(pg_temp.c('f1'), '00000000-0000-4000-8000-0000000006ff')$$, 'P0001', 'KS_ARTICLE_INTROUVABLE', 'restaurer un article inconnu : introuvable');

-- Publié : lisible par anon (blog public) avant l'archivage.
set local role anon;
select is((select count(*)::int from public.article where id = '00000000-0000-4000-8000-0000000006a1'), 1, 'anon lit l''article publié avant l''archivage');
reset role;

-- L'Admin archive un article publié : dépublié, archivé, une ligne au journal avec son nom ; images et texte intacts.
create temp table journal_avant as select coalesce(max(id), 0) as id from public.journal_audit;
select lives_ok($$select public.archiver_article(pg_temp.c('f1'), '00000000-0000-4000-8000-0000000006a1')$$, 'l''Admin archive un article publié');
select ok((select publie_le is null and archive_le is not null from public.article where id = '00000000-0000-4000-8000-0000000006a1'), 'archivé : dépublié et marqué archivé');
select ok((select texte_fr = 'TEST_ texte' and jsonb_array_length(images) = 1 from public.article where id = '00000000-0000-4000-8000-0000000006a1'), 'texte et images intacts');
select is(
  (select count(*)::int from public.journal_audit j where j.id > (select id from journal_avant) and j.cible_table = 'article'
     and j.auteur ->> 'id' = '00000000-0000-0000-0000-0000000000f1' and j.apres ->> 'archive_le' is not null and j.apres ? 'publie_le' and j.apres ->> 'publie_le' is null
     and j.avant ->> 'publie_le' is not null),
  1,
  'une ligne au journal d''audit, auteur = l''Admin : archive_le posé, publie_le remis à nul'
);
select is(
  (select count(*)::int from public.journal_audit j where j.id > (select id from journal_avant) and j.cible_table <> 'article'),
  0,
  'aucune autre table écrite'
);
set local role anon;
select is((select count(*)::int from public.article where id = '00000000-0000-4000-8000-0000000006a1'), 0, 'anon ne lit plus l''article archivé (blog public)');
reset role;
create temp table journal_doublon as select coalesce(max(id), 0) as id from public.journal_audit;
select lives_ok($$select public.archiver_article(pg_temp.c('f1'), '00000000-0000-4000-8000-0000000006a1')$$, 'archiver deux fois : sans effet, sans erreur');
select is((select count(*)::int from public.journal_audit j where j.id > (select id from journal_doublon)), 0, 'archiver un archivé : aucune ligne au journal');

-- Garde : un article archivé n'est jamais publié (fonction ou écriture directe).
select throws_ok($$select public.publier_article(pg_temp.c('f1'), '00000000-0000-4000-8000-0000000006a1')$$, 'P0001', 'KS_ARTICLE_ARCHIVE', 'publier un archivé : refusé');
select throws_ok($$update public.article set publie_le = now() where id = '00000000-0000-4000-8000-0000000006a1'$$, 'P0001', 'KS_ARTICLE_ARCHIVE', 'écriture directe : refusée aussi');
select ok((select publie_le is null from public.article where id = '00000000-0000-4000-8000-0000000006a1'), 'toujours dépublié');
select public.archiver_article(pg_temp.c('f1'), '00000000-0000-4000-8000-0000000006a2');
select throws_ok($$select public.publier_article(pg_temp.c('f1'), '00000000-0000-4000-8000-0000000006a2')$$, 'P0001', 'KS_ARTICLE_ARCHIVE', 'archivé ET incomplet : KS_ARTICLE_ARCHIVE, pas KS_PUBLICATION_INCOMPLETE');

-- Restaurer : retour en brouillon ; publiable de nouveau.
create temp table journal_restauration as select coalesce(max(id), 0) as id from public.journal_audit;
select lives_ok($$select public.restaurer_article(pg_temp.c('f1'), '00000000-0000-4000-8000-0000000006a1')$$, 'l''Admin restaure');
select is(
  (select count(*)::int from public.journal_audit j where j.id > (select id from journal_restauration) and j.cible_table = 'article'
     and j.cible_id = '00000000-0000-4000-8000-0000000006a1' and j.auteur ->> 'id' = '00000000-0000-0000-0000-0000000000f1'
     and j.avant ->> 'archive_le' is not null and j.apres ? 'archive_le' and j.apres ->> 'archive_le' is null),
  1,
  'restaurer : une ligne au journal, auteur = l''Admin, archive_le remis à nul'
);
select ok((select publie_le is null and archive_le is null from public.article where id = '00000000-0000-4000-8000-0000000006a1'), 'restauré : brouillon, plus archivé');
select public.restaurer_article(pg_temp.c('f1'), '00000000-0000-4000-8000-0000000006a2');
create temp table journal_non_archive as select coalesce(max(id), 0) as id from public.journal_audit;
select lives_ok($$select public.restaurer_article(pg_temp.c('f1'), '00000000-0000-4000-8000-0000000006a2')$$, 'restaurer un article non archivé : sans effet');
select is((select count(*)::int from public.journal_audit j where j.id > (select id from journal_non_archive)), 0, 'restaurer un non-archivé : aucune ligne au journal');
select lives_ok($$select public.publier_article(pg_temp.c('f1'), '00000000-0000-4000-8000-0000000006a1')$$, 'restauré puis publié');
select ok((select publie_le is not null from public.article where id = '00000000-0000-4000-8000-0000000006a1'), 'publié de nouveau');

select * from finish();
rollback;
