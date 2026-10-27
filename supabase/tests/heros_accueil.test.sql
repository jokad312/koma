-- Story 2.6 : héros de l'accueil (droits, lecture publique, vedette publiée, vidéo à valider, photo de repli, journal).
begin;
select plan(27);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'test-heros1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', 'test-heros2@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b2', 'assistant');

-- Droits d'exécution : service seulement.
select ok(
  has_function_privilege('service_role', 'public.choisir_vedette_heros(jsonb, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.choisir_vedette_heros(jsonb, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.choisir_vedette_heros(jsonb, uuid)', 'execute'),
  'choisir_vedette_heros : service seulement'
);
select ok(
  has_function_privilege('service_role', 'public.enregistrer_video_heros(jsonb, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.enregistrer_video_heros(jsonb, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.enregistrer_video_heros(jsonb, uuid)', 'execute'),
  'enregistrer_video_heros : service seulement'
);
select ok(
  has_function_privilege('service_role', 'public.valider_video_heros(jsonb, uuid, text)', 'execute')
  and not has_function_privilege('anon', 'public.valider_video_heros(jsonb, uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.valider_video_heros(jsonb, uuid, text)', 'execute'),
  'valider_video_heros : service seulement'
);
select ok(
  has_function_privilege('service_role', 'public.enregistrer_repli_heros(jsonb, text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.enregistrer_repli_heros(jsonb, text, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.enregistrer_repli_heros(jsonb, text, text, text)', 'execute'),
  'enregistrer_repli_heros : service seulement'
);

-- Table : lecture publique, aucune écriture directe.
select ok(has_table_privilege('anon', 'public.heros_accueil', 'select'), 'anon lit heros_accueil');
select ok(
  not has_table_privilege('anon', 'public.heros_accueil', 'insert')
  and not has_table_privilege('anon', 'public.heros_accueil', 'update')
  and not has_table_privilege('anon', 'public.heros_accueil', 'delete')
  and not has_table_privilege('authenticated', 'public.heros_accueil', 'insert')
  and not has_table_privilege('authenticated', 'public.heros_accueil', 'update')
  and not has_table_privilege('authenticated', 'public.heros_accueil', 'delete'),
  'aucune écriture directe pour anon ni authenticated'
);
select is((select count(*)::int from public.heros_accueil), 1, 'une seule ligne (singleton)');
select throws_ok($$insert into public.heros_accueil (id) values (false)$$, '23514', null, 'le singleton refuse une autre ligne');

-- Un cosplay publié, un cosplay brouillon, un accessoire publié.
select public.enregistrer_produit(
  '{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, null::uuid,
  '{"famille":"cosplay","slug":"heros-pub","titre_fr":"P","titre_en":"P en","description_fr":"D","description_en":"D en","prix_cents":4990,"delai_fabrication_jours":10}'::jsonb,
  '[{"taille":"M","stock":1}]'::jsonb);
select public.enregistrer_produit(
  '{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, null::uuid,
  '{"famille":"cosplay","slug":"heros-brouillon","titre_fr":"B","titre_en":"B en","description_fr":"D","description_en":"D en","prix_cents":4990,"delai_fabrication_jours":10}'::jsonb,
  '[{"taille":"M","stock":1}]'::jsonb);
select public.enregistrer_produit(
  '{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, null::uuid,
  '{"famille":"accessoire","slug":"heros-acc","titre_fr":"A","titre_en":"A en","description_fr":"D","description_en":"D en","prix_cents":1990,"delai_fabrication_jours":5}'::jsonb,
  '[{"taille":"M","stock":2}]'::jsonb);
create temp table ks_ids as
  select (select id from public.produit where slug = 'heros-pub') as pub,
         (select id from public.produit where slug = 'heros-brouillon') as brouillon,
         (select id from public.produit where slug = 'heros-acc') as acc;
grant select on ks_ids to public;
select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb,
  (select pub from ks_ids), (select pub from ks_ids)::text || '/bbbbbbb1-1111-4111-8111-111111111111.jpg', 'Un', 'One');
select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb,
  (select acc from ks_ids), (select acc from ks_ids)::text || '/bbbbbbb2-1111-4111-8111-111111111111.jpg', 'Un', 'One');
select public.publier_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, (select pub from ks_ids));
select public.publier_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, (select acc from ks_ids));

-- Vedette.
select throws_ok(
  $$select public.choisir_vedette_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b2","role":"assistant"}'::jsonb, (select pub from ks_ids))$$,
  'P0001', 'KS_DROIT_REFUSE', 'un assistant ne choisit pas la vedette');
select throws_ok(
  $$select public.choisir_vedette_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, (select brouillon from ks_ids))$$,
  'P0001', 'KS_VEDETTE_INVALIDE', 'un brouillon ne peut pas être la vedette');
select throws_ok(
  $$select public.choisir_vedette_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, (select acc from ks_ids))$$,
  'P0001', 'KS_VEDETTE_INVALIDE', 'un accessoire ne peut pas être la vedette');
select throws_ok(
  $$select public.choisir_vedette_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, '00000000-0000-0000-0000-00000000dead')$$,
  'P0001', 'KS_VEDETTE_INVALIDE', 'un produit inconnu ne peut pas être la vedette');
select lives_ok(
  $$select public.choisir_vedette_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, (select pub from ks_ids))$$,
  'un cosplay publié devient la vedette');
select is((select produit_id from public.heros_accueil), (select pub from ks_ids), 'la vedette est enregistrée');

-- Vidéo : l'identifiant d'abord, le fichier MP4 seulement après validation.
select is(
  public.enregistrer_video_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, '11111111-2222-4333-8444-555555555555'),
  null::uuid, 'première vidéo : pas d''ancienne vidéo à effacer');
select is((select video_fichier from public.heros_accueil), null, 'le fichier reste nul tant que la vidéo n''est pas validée');
select throws_ok(
  $$select public.valider_video_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, '99999999-2222-4333-8444-555555555555', 'play_720p.mp4')$$,
  'P0001', 'KS_VIDEO_INTROUVABLE', 'valider une autre vidéo que celle enregistrée est refusé');
select throws_ok(
  $$select public.valider_video_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, '11111111-2222-4333-8444-555555555555', '../x.mp4')$$,
  'P0001', 'KS_FICHIER_INVALIDE', 'un nom de fichier hors forme est refusé');
select lives_ok(
  $$select public.valider_video_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, '11111111-2222-4333-8444-555555555555', 'play_720p.mp4')$$,
  'la vidéo enregistrée est validée');
select is(
  public.enregistrer_video_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, '99999999-2222-4333-8444-555555555555'),
  '11111111-2222-4333-8444-555555555555'::uuid, 'remplacer la vidéo renvoie l''ancienne (à effacer chez Bunny)');
select is((select video_fichier from public.heros_accueil), null, 'une nouvelle vidéo repasse à « à valider »');

-- Photo de repli.
select throws_ok(
  $$select public.enregistrer_repli_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, null, 'Un', 'One')$$,
  'P0001', 'KS_PHOTO_INTROUVABLE', 'corriger les textes sans photo est refusé');
select throws_ok(
  $$select public.enregistrer_repli_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, 'heros/cccccccc-1111-4111-8111-111111111111.jpg', '', 'One')$$,
  'P0001', 'KS_ALT_INVALIDE', 'le texte alternatif est obligatoire');
select throws_ok(
  $$select public.enregistrer_repli_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, 'autre/x.jpg', 'Un', 'One')$$,
  'P0001', 'KS_FICHIER_INVALIDE', 'un objet hors du dossier heros est refusé');
select is(
  public.enregistrer_repli_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, 'heros/cccccccc-1111-4111-8111-111111111111.jpg', ' Un ', 'One'),
  null, 'première photo de repli : rien à effacer');
select is(
  public.enregistrer_repli_heros('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb, 'heros/dddddddd-1111-4111-8111-111111111111.png', 'Deux', 'Two'),
  'heros/cccccccc-1111-4111-8111-111111111111.jpg', 'remplacer la photo renvoie l''ancien objet');

-- Journal : chaque modification est tracée.
select ok((select count(*) from public.journal_audit where cible_table = 'heros_accueil') >= 5, 'les modifications du héros sont journalisées');

select * from finish();
rollback;
