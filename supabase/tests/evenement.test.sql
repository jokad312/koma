-- Story 7.1 : Événement et Type de pass (module evenements) — RLS, droits, validations, publication, journal, réglage des frais d'annulation.
-- Exécuté par la CI (Docker) ; en local, `npm run test:sql` explique l'absence de Docker et sort sans erreur.
begin;
select plan(28);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-evt1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-evt2@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e2', 'assistant');

-- Aucune donnée par défaut : la migration ne crée ni événement ni Type de pass (règle 14).
select is((select count(*)::int from public.evenement) + (select count(*)::int from public.type_pass), 0, 'aucun événement ni Type de pass par défaut');

select is((select relrowsecurity from pg_class where oid = 'public.evenement'::regclass), true, 'RLS active sur evenement');
select is((select relrowsecurity from pg_class where oid = 'public.type_pass'::regclass), true, 'RLS active sur type_pass');
select ok(
  not has_table_privilege('anon', 'public.evenement', 'insert, update, delete')
  and not has_table_privilege('authenticated', 'public.evenement', 'insert, update, delete')
  and not has_table_privilege('anon', 'public.type_pass', 'insert, update, delete')
  and not has_table_privilege('authenticated', 'public.type_pass', 'insert, update, delete'),
  'anon et authenticated n''écrivent ni dans evenement ni dans type_pass'
);
select ok(not has_column_privilege('anon', 'public.evenement', 'auteur_id', 'select'), 'anon ne lit pas auteur_id');

select ok(
  has_function_privilege('service_role', 'public.enregistrer_evenement(jsonb,uuid,jsonb,jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.enregistrer_evenement(jsonb,uuid,jsonb,jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.enregistrer_evenement(jsonb,uuid,jsonb,jsonb)', 'execute'),
  'enregistrer_evenement est réservée au service'
);
select ok(
  has_function_privilege('service_role', 'public.publier_evenement(jsonb,uuid)', 'execute')
  and not has_function_privilege('anon', 'public.publier_evenement(jsonb,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.publier_evenement(jsonb,uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.manques_publication_evenement(uuid)', 'execute'),
  'publier_evenement et manques_publication_evenement ne sont pas appelables par les clients'
);
select is((select count(*)::int from pg_indexes where schemaname = 'public' and indexname = 'evenement_slug_unique'), 1, 'l''adresse d''un événement est unique');

-- Droits : un Assistant est refusé par la base (comme pour les Articles).
select throws_ok(
  $$select public.enregistrer_evenement('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e2","role":"assistant"}'::jsonb,
    null::uuid, '{"titre_fr":"Refusé","slug":"refuse"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant n''écrit pas d''événement'
);

-- Création d'un brouillon avec deux Types de pass dont un Stand.
select lives_ok(
  $$select public.enregistrer_evenement('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb,
    null::uuid,
    '{"titre_fr":"TEST","slug":"test-evt","debut_le":"2027-03-14T10:00:00+02:00"}'::jsonb,
    '[{"nom_fr":"Std","prix_cents":1500,"quota":5,"est_stand":false},{"nom_fr":"Stand","prix_cents":12000,"quota":2,"est_stand":true}]'::jsonb)$$,
  'l''admin crée un événement et ses Types de pass'
);
select is((select count(*)::int from public.type_pass t join public.evenement e on e.id = t.evenement_id where e.slug = 'test-evt'), 2, 'les deux Types de pass sont enregistrés');
select is(
  (select count(*)::int from public.type_pass t join public.evenement e on e.id = t.evenement_id where e.slug = 'test-evt' and t.est_stand and t.quota = 2),
  1,
  'le Stand porte son quota (nombre de Stands)'
);
select is(
  (select array_to_string(public.manques_publication_evenement(id), ',') from public.evenement where slug = 'test-evt'),
  'titre_en,description_fr,description_en,lieu,photo,types_incomplets',
  'la liste des manques est celle de la base'
);
select throws_ok(
  $$select public.publier_evenement('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, (select id from public.evenement where slug = 'test-evt'))$$,
  'P0001', 'KS_PUBLICATION_INCOMPLETE:titre_en,description_fr,description_en,lieu,photo,types_incomplets',
  'publication refusée avec la liste des manques'
);

-- Validations.
select throws_ok(
  $$select public.enregistrer_evenement('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb,
    null::uuid, '{"titre_fr":"X","slug":"test-evt"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_SLUG_PRIS', 'une adresse déjà prise est refusée'
);
select throws_ok(
  $$select public.enregistrer_evenement('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb,
    (select id from public.evenement where slug = 'test-evt'),
    '{"titre_fr":"X","slug":"test-evt","debut_le":"2027-03-14T10:00:00+02:00","fin_le":"2027-03-13T10:00:00+02:00"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_DATE_INVALIDE', 'une fin avant le début est refusée'
);
select throws_ok(
  $$select public.enregistrer_evenement('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb,
    (select id from public.evenement where slug = 'test-evt'),
    '{"titre_fr":"X","slug":"test-evt"}'::jsonb, '[{"id":"00000000-0000-0000-0000-000000000099","nom_fr":"a","prix_cents":1}]'::jsonb)$$,
  'P0001', 'KS_TYPE_PASS_INTROUVABLE', 'un Type de pass qui n''appartient pas à l''événement est refusé'
);

-- Modification complète : un seul Type gardé, les autres retirés.
select lives_ok(
  $$select public.enregistrer_evenement('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb,
    (select id from public.evenement where slug = 'test-evt'),
    '{"titre_fr":"TEST","titre_en":"TEST EN","slug":"test-evt","description_fr":"d","description_en":"d","lieu_type":"plein_air","lieu_fr":"l","lieu_en":"l","debut_le":"2027-03-14T10:00:00+02:00","images":[{"fichier":"evenements/x.jpg","alt_fr":"a","alt_en":"a"}]}'::jsonb,
    '[{"nom_fr":"Std","nom_en":"Std","prix_cents":1500,"inclus_fr":"i","inclus_en":"i"}]'::jsonb)$$,
  'l''admin complète l''événement'
);
select is((select count(*)::int from public.type_pass t join public.evenement e on e.id = t.evenement_id where e.slug = 'test-evt'), 1, 'les Types retirés du formulaire sont supprimés');
select is((select array_length(public.manques_publication_evenement(id), 1) from public.evenement where slug = 'test-evt'), null, 'plus rien ne manque');

-- Publication, lecture publique, dépublication.
select lives_ok(
  $$select public.publier_evenement('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, (select id from public.evenement where slug = 'test-evt'))$$,
  'publication d''un événement complet'
);
-- Un événement publié doit rester complet : retirer tous les Types de pass est refusé.
select throws_ok(
  $$select public.enregistrer_evenement('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb,
    (select id from public.evenement where slug = 'test-evt'),
    '{"titre_fr":"TEST","titre_en":"TEST EN","slug":"test-evt","description_fr":"d","description_en":"d","lieu_type":"plein_air","lieu_fr":"l","lieu_en":"l","debut_le":"2027-03-14T10:00:00+02:00","images":[{"fichier":"evenements/x.jpg","alt_fr":"a","alt_en":"a"}]}'::jsonb,
    '[]'::jsonb)$$,
  'P0001', 'KS_PUBLICATION_INCOMPLETE:type_pass', 'un événement publié ne peut pas perdre son dernier Type payant'
);
set local role anon;
select is((select count(*)::int from public.evenement), 1, 'anon voit l''événement publié');
select is((select count(*)::int from public.type_pass), 1, 'anon voit ses Types de pass');
reset role;
select lives_ok(
  $$select public.depublier_evenement('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, (select id from public.evenement where slug = 'test-evt'))$$,
  'dépublication'
);
set local role anon;
select is((select count(*)::int from public.evenement) + (select count(*)::int from public.type_pass), 0, 'anon ne voit plus ni l''événement ni ses Types de pass');
reset role;

-- Réglage des frais d'annulation des Pass : 0 à 100.
select lives_ok(
  $$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, 'frais_annulation_pass', '25')$$,
  'frais d''annulation enregistrés'
);
select throws_ok(
  $$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, 'frais_annulation_pass', '101')$$,
  'P0001', 'KS_REGLAGE_INVALIDE', 'frais d''annulation au-dessus de 100 refusés'
);

select * from finish();
rollback;
