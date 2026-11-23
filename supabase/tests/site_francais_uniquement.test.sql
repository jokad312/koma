-- Spec B (2026-11-22) : site en français uniquement, anglais désactivé mais conservé (migration 20270126100000).
-- Publication sans aucun texte anglais : produit physique, Vêtement avec couleur sans nom anglais, Kit, événement ; photo de la galerie
-- validée sans texte alternatif anglais (copie du français). Données TEST_ créées dans la transaction, puis annulées.
-- Exécuté par la CI (Docker) ; en local, `npm run test:sql` explique l'absence de Docker et sort sans erreur.
begin;
select plan(11);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000009b1', 'test-fr-admin@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000009b2', 'test-fr-client@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000009b1', 'admin');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000009b2', 25);
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000009b1","role":"admin"}'::jsonb $$;

-- 1. Produit physique sans titre, description ni couleur en anglais : rien ne manque, la publication passe.
insert into public.produit (famille, slug, titre_fr, description_fr, prix_cents) values
  ('cosplay', 'fr-cosplay', 'TEST_Cosplay', 'TEST_description', 2500),
  ('vetement', 'fr-polo', 'TEST_Polo', 'TEST_description', 2000);
insert into public.variante (produit_id, taille, stock) select id, 'M', 1 from public.produit where slug = 'fr-cosplay';
insert into public.variante (produit_id, taille, stock, couleur_fr) select id, 'M', 1, 'TEST_Noir' from public.produit where slug = 'fr-polo';
insert into public.produit_photo (produit_id, fichier, alt_fr, alt_en, position)
  select id, id::text || '/a.jpg', 'TEST_alt', 'TEST_alt', 1 from public.produit where slug in ('fr-cosplay', 'fr-polo');
select is(public.manques_publication((select id from public.produit where slug = 'fr-cosplay')), '{}'::text[], 'cosplay sans anglais : rien ne manque');
select is(public.manques_publication((select id from public.produit where slug = 'fr-polo')), '{}'::text[], 'Vêtement dont la couleur n''a pas de nom anglais : rien ne manque');
select lives_ok($$select public.publier_produit(pg_temp.adm(), (select id from public.produit where slug = 'fr-cosplay'))$$, 'publication d''un produit sans anglais');
select is((select titre_en from public.produit where slug = 'fr-cosplay'), null, 'aucun texte anglais n''est inventé');

-- 2. Kit vide : les manques ne citent plus aucun champ anglais.
insert into public.produit (famille, slug, titre_fr) values ('kit', 'fr-kit', 'TEST_Kit');
select ok(
  not (public.manques_publication((select id from public.produit where slug = 'fr-kit')) && array['titre_en', 'description_en', 'materiel_en', 'couleurs']),
  'Kit : aucun manque anglais'
);

-- 3. Événement complet en français seulement : rien ne manque.
select lives_ok(
  $$select public.enregistrer_evenement(pg_temp.adm(), null::uuid,
    '{"titre_fr":"TEST_Festival","slug":"fr-festival","description_fr":"d","lieu_type":"salle","lieu_fr":"l","debut_le":"2027-03-14T10:00:00+02:00","images":[{"fichier":"evenements/x.jpg","alt_fr":"a"}]}'::jsonb,
    '[{"nom_fr":"Std","prix_cents":1500,"inclus_fr":"i","est_stand":false}]'::jsonb)$$,
  'événement enregistré sans anglais'
);
select is((select public.manques_publication_evenement(id) from public.evenement where slug = 'fr-festival'), '{}'::text[], 'événement sans anglais : rien ne manque');
select lives_ok($$select public.publier_evenement(pg_temp.adm(), (select id from public.evenement where slug = 'fr-festival'))$$, 'publication d''un événement sans anglais');

-- 4. Galerie : validation sans texte alternatif anglais, le français est copié (contrainte photo_publiee_alt satisfaite).
create temp table ph as select public.deposer_photo_galerie('{"type":"compte","id":"00000000-0000-0000-0000-0000000009b2","role":null}'::jsonb,
  'photos-clients/00000000-0000-4000-8000-0000000009b1.jpg', null, null, 'TEST_v1') as a;
select lives_ok(
  $$select public.valider_photo(pg_temp.adm(), (select a from ph), 'galerie/00000000-0000-4000-8000-0000000009b1.jpg', 'TEST_Cosplay', null)$$,
  'photo validée sans texte alternatif anglais'
);
select is((select alt_fr || '|' || alt_en from public.photo_galerie where id = (select a from ph)), 'TEST_Cosplay|TEST_Cosplay', 'le texte anglais reçoit la copie du français');
select throws_ok(
  $$select public.valider_photo(pg_temp.adm(), (select a from ph), 'galerie/00000000-0000-4000-8000-0000000009b1.jpg', null, 'TEST_alt')$$,
  'P0001', 'KS_ALT_INVALIDE', 'le français reste obligatoire'
);

select * from finish();
rollback;
