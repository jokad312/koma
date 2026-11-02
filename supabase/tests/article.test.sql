-- Story 8.6 : Article (module blog) — RLS, droits, validations, adresse unique, publication, journal.
-- Exécuté par la CI (Docker) ; en local, `npm run test:sql` explique l'absence de Docker et sort sans erreur.
begin;
select plan(54);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-art1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-art2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-art3@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a2', 'assistant');

-- Aucune donnée par défaut : la migration ne crée aucun article.
select is((select count(*)::int from public.article), 0, 'aucun article par défaut');

-- Table : RLS active, lecture seule pour anon et authenticated.
select is((select relrowsecurity from pg_class where oid = 'public.article'::regclass), true, 'RLS active sur article');
select ok(
  has_table_privilege('anon', 'public.article', 'select') and has_table_privilege('authenticated', 'public.article', 'select'),
  'anon et authenticated lisent article'
);
select ok(
  not has_table_privilege('anon', 'public.article', 'insert, update, delete')
  and not has_table_privilege('authenticated', 'public.article', 'insert, update, delete'),
  'anon et authenticated n''écrivent pas dans article'
);

-- Fonctions d'écriture : service_role seulement.
select ok(
  has_function_privilege('service_role', 'public.enregistrer_article(jsonb,uuid,jsonb,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.enregistrer_article(jsonb,uuid,jsonb,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.enregistrer_article(jsonb,uuid,jsonb,jsonb)', 'execute'),
  'enregistrer_article est réservée au service'
);
select ok(
  has_function_privilege('service_role', 'public.publier_article(jsonb,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.publier_article(jsonb,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.publier_article(jsonb,uuid)', 'execute'),
  'publier_article est réservée au service'
);
select ok(
  has_function_privilege('service_role', 'public.depublier_article(jsonb,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.depublier_article(jsonb,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.depublier_article(jsonb,uuid)', 'execute'),
  'depublier_article est réservée au service'
);
select is(
  (select count(*)::int from pg_indexes where schemaname = 'public' and indexname = 'article_slug_unique'),
  1,
  'l''adresse d''un article est unique'
);

-- Droits : un Assistant et un auteur non Compte sont refusés.
select throws_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a2","role":"assistant"}'::jsonb,
    null::uuid, '{"titre_fr":"Refusé","slug":"refuse"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant n''écrit pas d''article'
);
select throws_ok(
  $$select public.enregistrer_article('{"type":"systeme","nom":"test"}'::jsonb,
    null::uuid, '{"titre_fr":"Refusé","slug":"refuse"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_DROIT_REFUSE', 'un auteur qui n''est pas un Compte est refusé'
);

-- Création d'un brouillon complet.
select lives_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    null::uuid,
    '{"titre_fr":"Premier","texte_fr":"Texte","titre_en":"First","texte_en":"Text","slug":"premier"}'::jsonb,
    '[]'::jsonb)$$,
  'l''admin crée un article'
);
select is((select count(*)::int from public.article), 1, 'un article est enregistré');
select is(
  (select titre_fr || '|' || texte_fr || '|' || titre_en || '|' || texte_en from public.article where slug = 'premier'),
  'Premier|Texte|First|Text',
  'les champs saisis sont enregistrés'
);
select is((select publie_le is null from public.article where slug = 'premier'), true, 'une création reste un brouillon');
select is((select auteur_id from public.article where slug = 'premier'), '00000000-0000-0000-0000-0000000000a1'::uuid, 'l''auteur est enregistré');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'article' and action = 'insert' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000a1',
  'le journal de la création porte l''auteur'
);

-- Validations d'écriture.
select throws_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    null::uuid, '{"titre_fr":"   ","slug":"titre-vide"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_TITRE_INVALIDE', 'titre vide refusé'
);
select throws_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    null::uuid, jsonb_build_object('titre_fr', repeat('x', 121), 'slug', 'titre-long'), '[]'::jsonb)$$,
  'P0001', 'KS_TITRE_INVALIDE', 'titre de 121 caractères refusé'
);
select throws_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    null::uuid, jsonb_build_object('titre_fr', 'Texte long', 'slug', 'texte-long', 'texte_fr', repeat('x', 5001)), '[]'::jsonb)$$,
  'P0001', 'KS_TEXTE_INVALIDE', 'texte de 5001 caractères refusé'
);
select throws_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    null::uuid, '{"titre_fr":"Sans adresse","slug":"  "}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_SLUG_INVALIDE', 'adresse vide refusée'
);
select throws_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    null::uuid, '{"titre_fr":"Adresse invalide","slug":"Pas Bon"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_SLUG_INVALIDE', 'adresse hors forme refusée'
);
select throws_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    null::uuid, '{"titre_fr":"Doublon","slug":"premier"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_SLUG_PRIS', 'adresse déjà prise refusée'
);
select throws_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    null::uuid, '{"titre_fr":"Produit absent","slug":"produit-absent","lien_produit_id":"00000000-0000-0000-0000-00000000ffff"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_PRODUIT_INEXISTANT', 'lien vers un Produit inconnu refusé'
);
select throws_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    null::uuid, '{"titre_fr":"Images invalides","slug":"images-invalides"}'::jsonb, '{}'::jsonb)$$,
  'P0001', 'KS_ARTICLE_INVALIDE', 'liste d''images qui n''est pas un tableau refusée'
);
select throws_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    null::uuid, '{"titre_fr":"Image sans fichier","slug":"image-sans-fichier"}'::jsonb, '[{"alt_fr":"a","alt_en":"b"}]'::jsonb)$$,
  'P0001', 'KS_ARTICLE_INVALIDE', 'image sans fichier refusée'
);
select throws_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    '00000000-0000-0000-0000-00000000ffff'::uuid, '{"titre_fr":"Introuvable","slug":"introuvable"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_ARTICLE_INTROUVABLE', 'modifier un article inconnu est refusé'
);
select is((select count(*)::int from public.article), 1, 'les refus n''ajoutent aucun article');

-- Modification d'un brouillon : les champs non ressaisis sont effacés, pas conservés par hasard.
select lives_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.article where slug = 'premier'),
    '{"titre_fr":"Premier modifié","texte_fr":"Texte long","slug":"premier"}'::jsonb, '[]'::jsonb)$$,
  'l''admin modifie son brouillon'
);
select is((select titre_fr from public.article where slug = 'premier'), 'Premier modifié', 'le titre est modifié');
select is(
  (select titre_en is null and texte_en is null from public.article where slug = 'premier'),
  true,
  'une version anglaise vide est effacée'
);
select set_config('ks.auteur', '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}', true);
update public.article set modifie_le = '2000-01-01' where slug = 'premier';
select is((select modifie_le > '2001-01-01'::timestamptz from public.article where slug = 'premier'), true, 'modifie_le est tenu à jour par la base');

-- Publication incomplète : sans texte français, puis avec une image sans texte alternatif.
select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
  null::uuid, '{"titre_fr":"Brouillon incomplet","slug":"incomplet"}'::jsonb, '[]'::jsonb);
select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
  null::uuid, '{"titre_fr":"Avec image","texte_fr":"Texte","slug":"avec-image"}'::jsonb,
  '[{"fichier":"articles/11111111-1111-4111-8111-111111111111.jpg","alt_fr":"","alt_en":"Front"}]'::jsonb);
select throws_ok(
  $$select public.publier_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.article where slug = 'incomplet'))$$,
  'P0001', 'KS_PUBLICATION_INCOMPLETE', 'publier sans texte français est refusé'
);
select throws_ok(
  $$select public.publier_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.article where slug = 'avec-image'))$$,
  'P0001', 'KS_PUBLICATION_INCOMPLETE', 'publier avec une image sans texte alternatif est refusé'
);
select is((select count(*)::int from public.article where publie_le is not null), 0, 'les refus ne publient rien');

-- Publication complète.
select throws_ok(
  $$select public.publier_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a2","role":"assistant"}'::jsonb,
    (select id from public.article where slug = 'premier'))$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne publie pas'
);
select lives_ok(
  $$select public.publier_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.article where slug = 'premier'))$$,
  'l''admin publie un article complet'
);
select is((select publie_le is not null from public.article where slug = 'premier'), true, 'publie_le est posé');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'article' and action = 'update' and apres ? 'publie_le' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000a1',
  'le journal de la publication porte l''auteur'
);
create temp table ks_article_publie as select publie_le from public.article where slug = 'premier';
grant select on ks_article_publie to public;
select lives_ok(
  $$select public.publier_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.article where slug = 'premier'))$$,
  'publier un article déjà publié est sans effet'
);
select is((select publie_le from public.article where slug = 'premier'), (select publie_le from ks_article_publie), 'publie_le n''a pas bougé');
select throws_ok(
  $$select public.publier_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    '00000000-0000-0000-0000-00000000ffff'::uuid)$$,
  'P0001', 'KS_ARTICLE_INTROUVABLE', 'publier un article inconnu est refusé'
);

-- RLS : le public ne voit que les articles publiés, et n'écrit jamais.
set local role anon;
select is((select count(*)::int from public.article), 1, 'anon voit l''article publié');
select is((select count(*)::int from public.article where slug = 'incomplet'), 0, 'anon ne voit pas un brouillon');
select throws_ok(
  $$insert into public.article (auteur_id, titre_fr, slug) values ('00000000-0000-0000-0000-00000000ffff', 'Anon', 'anon')$$,
  '42501', null, 'anon n''écrit pas dans article'
);
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select is((select count(*)::int from public.article), 1, 'un Compte connecté voit l''article publié');
select is((select count(*)::int from public.article where slug = 'incomplet'), 0, 'un Compte connecté ne voit pas un brouillon');
select throws_ok(
  $$update public.article set titre_fr = 'Compte'$$,
  '42501', null, 'un Compte connecté n''écrit pas dans article'
);
reset role;

-- Dépublication.
select throws_ok(
  $$select public.depublier_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a2","role":"assistant"}'::jsonb,
    (select id from public.article where slug = 'premier'))$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne dépublie pas'
);
select lives_ok(
  $$select public.depublier_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.article where slug = 'premier'))$$,
  'l''admin dépublie'
);
select is((select publie_le is null from public.article where slug = 'premier'), true, 'publie_le est effacé');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'article' and action = 'update' and avant ? 'publie_le' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000a1',
  'le journal de la dépublication porte l''auteur'
);
set local role anon;
select is((select count(*)::int from public.article), 0, 'dépublié : anon ne voit plus rien');
reset role;

-- Adresse : refusée si elle appartient à un autre article, libre sinon.
select throws_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.article where slug = 'incomplet'),
    '{"titre_fr":"Brouillon incomplet","slug":"premier"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_SLUG_PRIS', 'modifier vers une adresse déjà prise est refusé'
);
select lives_ok(
  $$select public.enregistrer_article('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.article where slug = 'incomplet'),
    '{"titre_fr":"Brouillon incomplet","slug":"incomplet-2"}'::jsonb, '[]'::jsonb)$$,
  'un brouillon change d''adresse librement'
);

select * from finish();
rollback;
