-- Story 5.1 : Couverture des Agrégateurs. Table couverture (RLS, droits, aucune ligne par défaut), ajout (source obligatoire, pays, opérateur,
-- Agrégateur seulement, doublon), confirmation, retrait, journal. Données créées dans la transaction, puis annulées.
begin;
select plan(31);

-- Aucune ligne n'est créée par la migration : aucun pays ni opérateur écrit en dur (règle 9, Q-1).
select is((select count(*)::int from public.couverture), 0, 'aucune Couverture par défaut');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'test-cv1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', 'test-cv2@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b2', 'assistant');
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb $$;
create function pg_temp.ass() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000b2","role":"admin"}'::jsonb $$;

-- Table et fonctions.
select ok((select relrowsecurity from pg_class where oid = 'public.couverture'::regclass), 'couverture : RLS active');
select is(
  (select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and table_name = 'couverture' and lower(grantee) in ('anon', 'authenticated', 'public')),
  0,
  'couverture : aucun droit pour anon, authenticated ni public'
);
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'couverture'), 0, 'couverture : aucune politique');
select is(
  (select array_agg(f order by f) from unnest(array[
    'public.ajouter_couverture(jsonb, text, text, text, text)', 'public.confirmer_couverture(jsonb, uuid)', 'public.retirer_couverture(jsonb, uuid)'
  ]) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or not has_function_privilege('service_role', f, 'execute')),
  null,
  'les trois fonctions : service seulement'
);
select ok(
  (select count(*) = 3 and bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where pronamespace = 'public'::regnamespace and proname in ('ajouter_couverture', 'confirmer_couverture', 'retirer_couverture')),
  'security definer, search_path vide'
);

-- Ajout : droit, source obligatoire, validations.
select throws_ok($$select public.ajouter_couverture(pg_temp.ass(), 'pawapay', 'TZ', 'TEST_op', 'TEST source')$$, 'P0001', 'KS_DROIT_REFUSE', 'un Assistant n''ajoute pas de couple');
select throws_ok($$select public.ajouter_couverture(pg_temp.adm(), 'pawapay', 'TZ', 'TEST_op', '')$$, 'P0001', 'KS_SOURCE_MANQUANTE', 'sans source : refusé');
select throws_ok($$select public.ajouter_couverture(pg_temp.adm(), 'pawapay', 'TZ', 'TEST_op', null)$$, 'P0001', 'KS_SOURCE_MANQUANTE', 'source absente : refusée');
select throws_ok($$select public.ajouter_couverture(pg_temp.adm(), 'pawapay', 'TZ', 'TEST_op', '   ')$$, 'P0001', 'KS_SOURCE_MANQUANTE', 'source faite d''espaces : refusée');
select throws_ok($$select public.ajouter_couverture(pg_temp.adm(), 'pawapay', 'TZA', 'TEST_op', 'TEST source')$$, 'P0001', 'KS_PAYS_INVALIDE', 'pays à trois lettres : refusé');
select throws_ok($$select public.ajouter_couverture(pg_temp.adm(), 'pawapay', '', 'TEST_op', 'TEST source')$$, 'P0001', 'KS_PAYS_INVALIDE', 'pays vide : refusé');
select throws_ok($$select public.ajouter_couverture(pg_temp.adm(), 'pawapay', 'TZ', '', 'TEST source')$$, 'P0001', 'KS_OPERATEUR_INVALIDE', 'opérateur vide : refusé');
select throws_ok($$select public.ajouter_couverture(pg_temp.adm(), 'pawapay', 'TZ', repeat('a', 41), 'TEST source')$$, 'P0001', 'KS_OPERATEUR_INVALIDE', 'opérateur trop long : refusé');
select throws_ok($$select public.ajouter_couverture(pg_temp.adm(), 'polar', 'TZ', 'TEST_op', 'TEST source')$$, 'P0001', 'KS_AGREGATEUR_INVALIDE', 'Polar n''a pas de Couverture');
select throws_ok($$select public.ajouter_couverture(pg_temp.adm(), 'geniuspay', 'TZ', 'TEST_op', 'TEST source')$$, 'P0001', 'KS_AGREGATEUR_INVALIDE', 'Prestataire inconnu : refusé');
select is((select count(*)::int from public.couverture), 0, 'les refus n''écrivent rien');

-- Ajout valide : « à vérifier », pays en majuscules, journalisé.
select lives_ok($$select public.ajouter_couverture(pg_temp.adm(), 'pawapay', ' tz ', ' TEST_op ', ' TEST source ')$$, 'l''Admin ajoute un couple');
select is((select pays || '|' || operateur || '|' || source || '|' || etat from public.couverture), 'TZ|TEST_op|TEST source|a_verifier', 'couple nettoyé, à vérifier');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'couverture' and action = 'insert' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000b1',
  'le journal de l''ajout porte l''auteur'
);
select throws_ok($$select public.ajouter_couverture(pg_temp.adm(), 'pawapay', 'TZ', 'TEST_op', 'autre source')$$, 'P0001', 'KS_COUPLE_EXISTANT', 'même couple pour le même Agrégateur : refusé');
select throws_ok($$select public.ajouter_couverture(pg_temp.adm(), 'pawapay', 'TZ', 'test_OP', 'autre source')$$, 'P0001', 'KS_COUPLE_EXISTANT', 'même opérateur en casse différente : refusé');
select lives_ok($$select public.ajouter_couverture(pg_temp.adm(), 'kpay', 'TZ', 'TEST_op', 'TEST source K-Pay')$$, 'le même couple chez un autre Agrégateur est permis');
select throws_ok($$insert into public.couverture (prestataire, pays, operateur, source) values ('pawapay', 'tz', 'TEST_x', 'TEST source')$$, '23514', null, 'pays en minuscules refusé par la table');

-- Confirmation et retrait.
select throws_ok($$select public.confirmer_couverture(pg_temp.ass(), (select id from public.couverture where prestataire = 'pawapay'))$$, 'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne confirme pas');
select lives_ok($$select public.confirmer_couverture(pg_temp.adm(), (select id from public.couverture where prestataire = 'pawapay'))$$, 'l''Admin confirme');
select is((select etat from public.couverture where prestataire = 'pawapay'), 'confirme', 'le couple est confirmé');
select throws_ok($$select public.confirmer_couverture(pg_temp.adm(), '00000000-0000-4000-8000-0000000000ff')$$, 'P0001', 'KS_COUVERTURE_INTROUVABLE', 'couple inconnu : refusé');
select lives_ok($$select public.retirer_couverture(pg_temp.adm(), (select id from public.couverture where prestataire = 'pawapay'))$$, 'l''Admin retire un couple');
select is((select count(*)::int from public.couverture), 1, 'le couple retiré a disparu, l''autre reste');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'couverture' and action = 'delete' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000b1',
  'le journal du retrait porte l''auteur'
);

select * from finish();
rollback;
