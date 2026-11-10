-- Story 9.7 : mesure d'audience maison. Table et vues fermées à anon et authenticated, écriture par la seule fonction
-- serveur (service_role), aucune donnée personnelle, dérogation « /compte » limitée à sa liste fermée.
begin;
select plan(30);

-- Droits : aucune lecture ni écriture directe pour anon et authenticated, fonction réservée au service_role.
select ok(
  not has_table_privilege('anon', 'public.evenement_mesure', 'select')
  and not has_table_privilege('anon', 'public.evenement_mesure', 'insert')
  and not has_table_privilege('anon', 'public.evenement_mesure', 'update')
  and not has_table_privilege('anon', 'public.evenement_mesure', 'delete'),
  'anon n''a aucun droit sur evenement_mesure'
);
select ok(
  not has_table_privilege('authenticated', 'public.evenement_mesure', 'select')
  and not has_table_privilege('authenticated', 'public.evenement_mesure', 'insert'),
  'authenticated n''a aucun droit sur evenement_mesure'
);
select ok(
  has_function_privilege('service_role', 'public.enregistrer_evenement_mesure(jsonb, text, text, text, text, text, text, uuid, integer)', 'execute')
  and not has_function_privilege('anon', 'public.enregistrer_evenement_mesure(jsonb, text, text, text, text, text, text, uuid, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.enregistrer_evenement_mesure(jsonb, text, text, text, text, text, text, uuid, integer)', 'execute'),
  'enregistrer_evenement_mesure est réservée au service_role'
);

set local role anon;
select throws_ok($$select * from public.evenement_mesure$$, '42501', null, 'anon ne lit pas la table de mesure');
select throws_ok(
  $$insert into public.evenement_mesure (action, page, langue, appareil, session_id) values ('vue_fiche', '/x', 'fr', 'mobile', '00000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'anon ne peut pas écrire directement'
);
reset role;

set local role authenticated;
select throws_ok($$select * from public.evenement_mesure$$, '42501', null, 'authenticated ne lit pas la table de mesure');
reset role;

-- Écriture valide : une ligne, rien de plus que les colonnes prévues.
select lives_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'vue_fiche', '/cosplays/nezuko', null, null, 'fr', 'mobile', '00000000-0000-4000-8000-000000000001'::uuid)$$,
  'un événement valide est enregistré'
);
select is((select count(*) from public.evenement_mesure), 1::bigint, 'une seule ligne écrite');
select is((select page from public.evenement_mesure), '/cosplays/nezuko', 'le chemin est celui reçu, sans préfixe');
select is((select origine from public.evenement_mesure), null::text, 'aucune origine : null, jamais une adresse');

select lives_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'chargement_heros', '/', 'whatsapp', 'tiktok.com', 'fr', 'ordinateur', '00000000-0000-4000-8000-000000000002'::uuid, 1200)$$,
  'la durée du héros est acceptée'
);
select is((select duree_ms from public.evenement_mesure where action = 'chargement_heros'), 1200, 'la durée est enregistrée');

select throws_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'achat', '/x', null, null, 'fr', 'mobile', '00000000-0000-4000-8000-000000000001'::uuid)$$,
  'P0001', 'KS_MESURE_ACTION_INVALIDE', 'une action inconnue est refusée'
);
select throws_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'vue_fiche', '/cosplays/nezuko?c=secret', null, null, 'fr', 'mobile', '00000000-0000-4000-8000-000000000001'::uuid)$$,
  'P0001', 'KS_MESURE_INVALIDE', 'une chaîne de requête dans la page est refusée'
);
select throws_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'photo_envoyee', '/compte/photos', null, null, 'fr', 'mobile', '00000000-0000-4000-8000-000000000001'::uuid)$$,
  'P0001', 'KS_MESURE_INVALIDE', 'un sous-chemin de /compte est refusé'
);
select lives_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'photo_envoyee', '/compte', null, null, 'fr', 'mobile', '00000000-0000-4000-8000-000000000001'::uuid)$$,
  'une action privée avec la page /compte est acceptée'
);
select throws_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'vue_fiche', '/compte', null, null, 'fr', 'mobile', '00000000-0000-4000-8000-000000000001'::uuid)$$,
  'P0001', 'KS_MESURE_INVALIDE', 'une action publique avec la page /compte est refusée'
);
select throws_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'realisation_envoyee', '/compte/realisation', null, null, 'fr', 'mobile', '00000000-0000-4000-8000-000000000001'::uuid)$$,
  'P0001', 'KS_MESURE_INVALIDE', 'le sous-chemin reste refusé pour une autre action privée'
);
select throws_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'vue_fiche', '/x', null, null, 'fr', 'mobile', '00000000-0000-4000-8000-000000000001'::uuid, 900)$$,
  'P0001', 'KS_MESURE_INVALIDE', 'une durée hors chargement_heros est refusée'
);
select throws_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'chargement_heros', '/', null, null, 'fr', 'mobile', '00000000-0000-4000-8000-000000000001'::uuid, 70000)$$,
  'P0001', 'KS_MESURE_INVALIDE', 'une durée au-delà de 60 000 ms est refusée'
);
select throws_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"compte","id":"00000000-0000-4000-8000-0000000000aa"}'::jsonb, 'vue_fiche', '/x', null, null, 'fr', 'mobile', '00000000-0000-4000-8000-000000000001'::uuid)$$,
  'P0001', 'KS_AUTEUR_INVALIDE', 'un Compte ne peut pas être l''auteur d''un événement de mesure'
);
select throws_ok(
  $$select public.enregistrer_evenement_mesure(null, 'vue_fiche', '/x', null, null, 'fr', 'mobile', '00000000-0000-4000-8000-000000000001'::uuid)$$,
  'P0001', 'KS_AUTEUR_MANQUANT', 'un auteur est obligatoire'
);
select throws_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'vue_fiche', '/x', 'Promo 2026', null, 'fr', 'mobile', '00000000-0000-4000-8000-000000000001'::uuid)$$,
  'P0001', 'KS_MESURE_INVALIDE', 'une origine non normalisée est refusée'
);
select throws_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'vue_fiche', '/x', null, 'https://tiktok.com', 'fr', 'mobile', '00000000-0000-4000-8000-000000000001'::uuid)$$,
  'P0001', 'KS_MESURE_INVALIDE', 'un référent avec chemin est refusé'
);
select throws_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'vue_fiche', '/x', null, null, 'de', 'mobile', '00000000-0000-4000-8000-000000000001'::uuid)$$,
  'P0001', 'KS_MESURE_INVALIDE', 'une langue inconnue est refusée'
);
select throws_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'vue_fiche', '/x', null, null, 'fr', 'montre', '00000000-0000-4000-8000-000000000001'::uuid)$$,
  'P0001', 'KS_MESURE_INVALIDE', 'un appareil inconnu est refusé'
);
select throws_ok(
  $$select public.enregistrer_evenement_mesure('{"type":"visiteur"}'::jsonb, 'vue_fiche', '/x', null, null, 'fr', 'mobile', null)$$,
  'P0001', 'KS_MESURE_INVALIDE', 'une session absente est refusée'
);

-- Vues : agrégats lisibles par le serveur seulement.
set local role anon;
select throws_ok($$select * from public.vue_visites_jour$$, '42501', null, 'anon ne lit pas les visites agrégées');
select throws_ok($$select * from public.vue_entonnoir_jour$$, '42501', null, 'anon ne lit pas l''entonnoir');
reset role;

select ok(
  has_table_privilege('service_role', 'public.vue_ventes_code_promo', 'select')
  and has_table_privilege('service_role', 'public.vue_deuxiemes_achats', 'select')
  and has_table_privilege('service_role', 'public.vue_desinscriptions_jour', 'select')
  and has_table_privilege('service_role', 'public.vue_origines_jour', 'select')
  and has_table_privilege('service_role', 'public.vue_paiements_jour', 'select')
  and has_table_privilege('service_role', 'public.vue_ventes_origine', 'select')
  and not has_table_privilege('authenticated', 'public.vue_visites_jour', 'select'),
  'les vues sont réservées au service_role'
);

select * from finish();
rollback;
