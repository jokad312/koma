-- Story 9.16 h) : extrait facultatif d'un article (extrait_fr, extrait_en), 300 caractères au plus, enregistré par enregistrer_article.
-- Lisible par le public seulement sur un article publié (RLS inchangée). Données TEST_ annulées à la fin.
begin;
select plan(21);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-artext-admin@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-artext-assistant@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e2', 'assistant');
create function pg_temp.c(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;

-- Colonnes : nulles par défaut, lisibles par anon et authenticated (comme le titre et le texte) ; archive_le et auteur_id restent fermés.
select ok(
  (select bool_and(is_nullable = 'YES' and column_default is null) from information_schema.columns
   where table_schema = 'public' and table_name = 'article' and column_name in ('extrait_fr', 'extrait_en'))
  and (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'article' and column_name in ('extrait_fr', 'extrait_en')) = 2,
  'extrait_fr et extrait_en existent, nulles par défaut'
);
select ok(
  has_column_privilege('anon', 'public.article', 'extrait_fr', 'select') and has_column_privilege('anon', 'public.article', 'extrait_en', 'select')
  and has_column_privilege('authenticated', 'public.article', 'extrait_fr', 'select'),
  'extraits lisibles par anon et authenticated'
);
select ok(
  not has_column_privilege('anon', 'public.article', 'archive_le', 'select') and not has_column_privilege('anon', 'public.article', 'auteur_id', 'select'),
  'archive_le et auteur_id restent illisibles par anon'
);
select ok(
  not has_table_privilege('anon', 'public.article', 'update') and not has_table_privilege('authenticated', 'public.article', 'insert'),
  'aucune écriture directe pour anon ni authenticated'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.enregistrer_article(jsonb, uuid, jsonb, jsonb)'::regprocedure)
  and has_function_privilege('service_role', 'public.enregistrer_article(jsonb, uuid, jsonb, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.enregistrer_article(jsonb, uuid, jsonb, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.enregistrer_article(jsonb, uuid, jsonb, jsonb)', 'execute'),
  'enregistrer_article : SECURITY DEFINER, search_path fixé, service_role seulement'
);

-- Création avec extraits : espaces retirés.
create temp table cree as
  select public.enregistrer_article(pg_temp.c('e1'), null,
    jsonb_build_object('titre_fr', 'TEST_ Article extrait', 'texte_fr', 'TEST_ texte', 'extrait_fr', '  TEST_ résumé  ', 'extrait_en', 'TEST_ summary', 'slug', 'test-artext-un'),
    '[]'::jsonb) as id;
select is((select extrait_fr from public.article where id = (select id from cree)), 'TEST_ résumé', 'extrait FR enregistré, espaces retirés');
select is((select extrait_en from public.article where id = (select id from cree)), 'TEST_ summary', 'extrait EN enregistré');

-- Exactement 300 caractères : accepté ; 301 : refusé (KS_EXTRAIT_INVALIDE), FR comme EN.
select lives_ok(
  format($$select public.enregistrer_article(pg_temp.c('e1'), %L, jsonb_build_object('titre_fr', 'TEST_ Article extrait', 'texte_fr', 'TEST_ texte', 'extrait_fr', %L, 'slug', 'test-artext-un'), '[]'::jsonb)$$,
    (select id from cree), repeat('é', 300)),
  '300 caractères acceptés'
);
select is((select char_length(extrait_fr) from public.article where id = (select id from cree)), 300, '300 caractères enregistrés');
select throws_ok(
  format($$select public.enregistrer_article(pg_temp.c('e1'), %L, jsonb_build_object('titre_fr', 'TEST_ Article extrait', 'texte_fr', 'TEST_ texte', 'extrait_fr', %L, 'slug', 'test-artext-un'), '[]'::jsonb)$$,
    (select id from cree), repeat('a', 301)),
  'P0001', 'KS_EXTRAIT_INVALIDE', 'extrait FR de 301 caractères refusé'
);
select throws_ok(
  format($$select public.enregistrer_article(pg_temp.c('e1'), null, jsonb_build_object('titre_fr', 'TEST_ Autre', 'texte_fr', 'TEST_ texte', 'extrait_en', %L, 'slug', 'test-artext-deux'), '[]'::jsonb)$$,
    repeat('a', 301)),
  'P0001', 'KS_EXTRAIT_INVALIDE', 'extrait EN de 301 caractères refusé à la création'
);

-- Anglais en modification : 300 acceptés, 301 refusés.
select lives_ok(
  format($$select public.enregistrer_article(pg_temp.c('e1'), %L, jsonb_build_object('titre_fr', 'TEST_ Article extrait', 'texte_fr', 'TEST_ texte', 'extrait_en', %L, 'slug', 'test-artext-un'), '[]'::jsonb)$$,
    (select id from cree), repeat('é', 300)),
  'extrait EN de 300 caractères accepté en modification'
);
select is((select char_length(extrait_en) from public.article where id = (select id from cree)), 300, 'extrait EN de 300 caractères enregistré');
select throws_ok(
  format($$select public.enregistrer_article(pg_temp.c('e1'), %L, jsonb_build_object('titre_fr', 'TEST_ Article extrait', 'texte_fr', 'TEST_ texte', 'extrait_en', %L, 'slug', 'test-artext-un'), '[]'::jsonb)$$,
    (select id from cree), repeat('b', 301)),
  'P0001', 'KS_EXTRAIT_INVALIDE', 'extrait EN de 301 caractères refusé en modification'
);

-- Vide ou absent : nul (la carte reprend alors le début du texte).
select lives_ok(
  format($$select public.enregistrer_article(pg_temp.c('e1'), %L, jsonb_build_object('titre_fr', 'TEST_ Article extrait', 'texte_fr', 'TEST_ texte', 'extrait_fr', '   ', 'slug', 'test-artext-un'), '[]'::jsonb)$$,
    (select id from cree)),
  'extrait vide accepté'
);
select ok((select extrait_fr is null and extrait_en is null from public.article where id = (select id from cree)), 'extrait vide ou absent : nul');

-- Contrainte en base, quel que soit le chemin d'écriture.
select throws_ok(
  format($$update public.article set extrait_fr = %L where id = %L$$, repeat('a', 301), (select id from cree)),
  '23514', null, 'contrainte : plus de 300 caractères refusés en écriture directe'
);

select throws_ok(
  format($$update public.article set extrait_fr = '' where id = %L$$, (select id from cree)),
  '23514', null, 'contrainte : extrait vide refusé en écriture directe (vide = nul)'
);

-- Droit inchangé : l'Assistant ne peut pas enregistrer.
select throws_ok(
  $$select public.enregistrer_article(pg_temp.c('e2'), null, jsonb_build_object('titre_fr', 'TEST_ Assistant', 'extrait_fr', 'TEST_', 'slug', 'test-artext-trois'), '[]'::jsonb)$$,
  'P0001', 'KS_DROIT_REFUSE', 'l''Assistant ne peut pas enregistrer (inchangé)'
);

-- Lecture publique : l'extrait d'un brouillon reste invisible (RLS inchangée).
update public.article set extrait_fr = 'TEST_ résumé' where id = (select id from cree);
set local role anon;
select is((select count(*)::int from public.article where slug = 'test-artext-un'), 0, 'brouillon : anon ne lit pas l''extrait');
reset role;

-- Publié : anon lit l'extrait (blog public).
update public.article set publie_le = now() - interval '1 minute' where id = (select id from cree);
set local role anon;
select is((select extrait_fr from public.article where slug = 'test-artext-un'), 'TEST_ résumé', 'publié : anon lit l''extrait');
reset role;

select * from finish();
rollback;
