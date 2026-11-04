-- Story 9.1 : Code promo. Table code_promo (RLS, droits, aucune ligne par défaut, aucun compteur), création, unicité sans
-- distinction de casse, validations, modification (code immuable), journal. Données créées dans la transaction, puis annulées.
begin;
select plan(36);

-- Aucune ligne n'est créée par la migration.
select is((select count(*)::int from public.code_promo), 0, 'aucun Code promo par défaut');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-cp1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-cp2@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e2', 'assistant');
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb $$;
create function pg_temp.ass() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000e2","role":"admin"}'::jsonb $$;

-- Table et fonctions.
select ok((select relrowsecurity from pg_class where oid = 'public.code_promo'::regclass), 'code_promo : RLS active');
select is(
  (select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and table_name = 'code_promo' and lower(grantee) in ('anon', 'authenticated', 'public')),
  0,
  'code_promo : aucun droit pour anon, authenticated ni public'
);
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'code_promo'), 0, 'code_promo : aucune politique');
select is(
  (select count(*)::int from information_schema.columns where table_schema = 'public' and table_name = 'code_promo' and column_name ~ 'utilisation|compteur|count'),
  0,
  'code_promo : aucune colonne compteur (AD-29)'
);
select is(
  (select array_agg(f order by f) from unnest(array[
    'public.creer_code_promo(jsonb, text, text, numeric, numeric, integer, boolean)',
    'public.modifier_code_promo(jsonb, uuid, text, numeric, numeric, integer, boolean)'
  ]) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or not has_function_privilege('service_role', f, 'execute')),
  null,
  'les deux fonctions : service seulement'
);
select ok(
  (select count(*) = 2 and bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where pronamespace = 'public'::regnamespace and proname in ('creer_code_promo', 'modifier_code_promo')),
  'security definer, search_path vide'
);

-- Création : droit, validations.
select throws_ok(
  $$select public.creer_code_promo(pg_temp.ass(), 'SOLDES10', 'TEST_Affilié', 20, 5, 50, true)$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne crée pas de Code promo'
);
select throws_ok(
  $$select public.creer_code_promo(pg_temp.adm(), 'ab', 'TEST_Affilié', 20, 5, 50, true)$$,
  'P0001', 'KS_CODE_INVALIDE', 'code trop court : refusé'
);
select throws_ok(
  $$select public.creer_code_promo(pg_temp.adm(), 'SOLDES 10', 'TEST_Affilié', 20, 5, 50, true)$$,
  'P0001', 'KS_CODE_INVALIDE', 'code avec un espace : refusé'
);
select throws_ok(
  $$select public.creer_code_promo(pg_temp.adm(), 'SOLDES10', '', 20, 5, 50, true)$$,
  'P0001', 'KS_AFFILIE_INVALIDE', 'Affilié vide : refusé'
);
select throws_ok(
  $$select public.creer_code_promo(pg_temp.adm(), 'SOLDES10', repeat('a', 121), 20, 5, 50, true)$$,
  'P0001', 'KS_AFFILIE_INVALIDE', 'Affilié trop long : refusé'
);
select throws_ok(
  $$select public.creer_code_promo(pg_temp.adm(), 'SOLDES10', 'TEST_Affilié', 0, 5, 50, true)$$,
  'P0001', 'KS_REDUCTION_INVALIDE', 'réduction nulle : refusée'
);
select throws_ok(
  $$select public.creer_code_promo(pg_temp.adm(), 'SOLDES10', 'TEST_Affilié', 101, 5, 50, true)$$,
  'P0001', 'KS_REDUCTION_INVALIDE', 'réduction au-delà de 100 : refusée'
);
select throws_ok(
  $$select public.creer_code_promo(pg_temp.adm(), 'SOLDES10', 'TEST_Affilié', 12.345, 5, 50, true)$$,
  'P0001', 'KS_REDUCTION_INVALIDE', 'réduction à plus de deux décimales : refusée'
);
select throws_ok(
  $$select public.creer_code_promo(pg_temp.adm(), 'SOLDES10', 'TEST_Affilié', 20, -1, 50, true)$$,
  'P0001', 'KS_COMMISSION_INVALIDE', 'commission négative : refusée'
);
select throws_ok(
  $$select public.creer_code_promo(pg_temp.adm(), 'SOLDES10', 'TEST_Affilié', 20, 101, 50, true)$$,
  'P0001', 'KS_COMMISSION_INVALIDE', 'commission au-delà de 100 : refusée'
);
select throws_ok(
  $$select public.creer_code_promo(pg_temp.adm(), 'SOLDES10', 'TEST_Affilié', 20, 5, 0, true)$$,
  'P0001', 'KS_PLAFOND_INVALIDE', 'plafond nul : refusé'
);
select throws_ok(
  $$select public.creer_code_promo(pg_temp.adm(), 'SOLDES10', 'TEST_Affilié', 20, 5, 100001, true)$$,
  'P0001', 'KS_PLAFOND_INVALIDE', 'plafond trop haut : refusé'
);
select is((select count(*)::int from public.code_promo), 0, 'les refus n''écrivent rien');

-- Création valide : code normalisé, plafond par défaut à 50, journalisé.
select lives_ok(
  $$select public.creer_code_promo(pg_temp.adm(), ' soldes10 ', ' TEST_Affilié ', 20, 5, null, null)$$,
  'l''Admin crée un Code promo'
);
select is(
  (select code || '|' || affilie || '|' || reduction_pct || '|' || commission_pct || '|' || plafond || '|' || actif from public.code_promo),
  'SOLDES10|TEST_Affilié|20.00|5.00|50|true',
  'code en majuscules, Affilié nettoyé, plafond à 50, actif'
);
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'code_promo' and action = 'insert' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000e1',
  'le journal de la création porte l''auteur'
);
select throws_ok(
  $$select public.creer_code_promo(pg_temp.adm(), 'soldes10', 'TEST_Autre', 10, 2, 10, true)$$,
  'P0001', 'KS_CODE_EXISTANT', 'même code en minuscules : refusé'
);
select throws_ok(
  $$select public.creer_code_promo(pg_temp.adm(), 'SOLDES10', 'TEST_Autre', 10, 2, 10, true)$$,
  'P0001', 'KS_CODE_EXISTANT', 'même code : refusé'
);
select throws_ok(
  $$insert into public.code_promo (code, affilie, reduction_pct, commission_pct) values ('minuscules', 'TEST_x', 10, 2)$$,
  '23514', null, 'code en minuscules refusé par la table'
);

-- Modification : le code ne change jamais.
select throws_ok(
  $$select public.modifier_code_promo(pg_temp.ass(), (select id from public.code_promo), 'TEST_nouveau', 15, 3, 80, false)$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne modifie pas un Code promo'
);
select throws_ok(
  $$select public.modifier_code_promo(pg_temp.adm(), (select id from public.code_promo), '', 15, 3, 80, false)$$,
  'P0001', 'KS_AFFILIE_INVALIDE', 'Affilié vide à la modification : refusé'
);
select throws_ok(
  $$select public.modifier_code_promo(pg_temp.adm(), (select id from public.code_promo), 'TEST_nouveau', 101, 3, 80, false)$$,
  'P0001', 'KS_REDUCTION_INVALIDE', 'réduction invalide à la modification : refusée'
);
select throws_ok(
  $$select public.modifier_code_promo(pg_temp.adm(), (select id from public.code_promo), 'TEST_nouveau', 15, 101, 80, false)$$,
  'P0001', 'KS_COMMISSION_INVALIDE', 'commission invalide à la modification : refusée'
);
select throws_ok(
  $$select public.modifier_code_promo(pg_temp.adm(), (select id from public.code_promo), 'TEST_nouveau', 15, 3, null, false)$$,
  'P0001', 'KS_PLAFOND_INVALIDE', 'plafond absent à la modification : refusé'
);
select throws_ok(
  $$select public.modifier_code_promo(pg_temp.adm(), '00000000-0000-4000-8000-0000000000ff', 'TEST_nouveau', 15, 3, 80, false)$$,
  'P0001', 'KS_CODE_PROMO_INTROUVABLE', 'code inconnu : refusé'
);
select lives_ok(
  $$select public.modifier_code_promo(pg_temp.adm(), (select id from public.code_promo), ' TEST_nouveau ', 15, 3, 80, false)$$,
  'l''Admin modifie un Code promo'
);
select is(
  (select code || '|' || affilie || '|' || reduction_pct || '|' || commission_pct || '|' || plafond || '|' || actif from public.code_promo),
  'SOLDES10|TEST_nouveau|15.00|3.00|80|false',
  'le code est inchangé, les autres valeurs sont mises à jour'
);
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'code_promo' and action = 'update' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000e1',
  'le journal de la modification porte l''auteur'
);
select is((select count(*)::int from public.code_promo), 1, 'la modification ne crée aucune ligne');

select * from finish();
rollback;
