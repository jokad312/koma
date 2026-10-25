-- Story 2.2 : photos et publication (buckets, RLS, droits, bornes, ordre, déclencheurs, journal).
begin;
select plan(80);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'test-pub1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'test-pub2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f3', 'test-pub3@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 'assistant');

-- Buckets : un privé, un public, mêmes limites ; aucune politique d'écriture ni de lecture pour anon et authenticated.
select is((select public from storage.buckets where id = 'galerie-attente'), false, 'galerie-attente est privé');
select is((select public from storage.buckets where id = 'produits-public'), true, 'produits-public est public');
select is(
  (select array_agg(id order by id) from storage.buckets where id in ('galerie-attente', 'produits-public') and file_size_limit = 15728640),
  array['galerie-attente', 'produits-public'],
  'les deux buckets sont limités à 15 Mo'
);
select is(
  (select count(*)::int from storage.buckets
   where id in ('galerie-attente', 'produits-public') and allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp'] and cardinality(allowed_mime_types) = 3),
  2,
  'les deux buckets n''acceptent que JPEG, PNG et WebP'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and (roles && array['anon', 'authenticated', 'public']::name[])),
  0,
  'aucune politique de storage.objects pour anon, authenticated ou public'
);

-- Table : RLS active, lecture seule pour anon et authenticated.
select is((select relrowsecurity from pg_class where oid = 'public.produit_photo'::regclass), true, 'RLS active sur produit_photo');
select ok(has_table_privilege('anon', 'public.produit_photo', 'select') and has_table_privilege('authenticated', 'public.produit_photo', 'select'), 'anon et authenticated lisent produit_photo');
select ok(
  not has_table_privilege('anon', 'public.produit_photo', 'insert, update, delete')
  and not has_table_privilege('authenticated', 'public.produit_photo', 'insert, update, delete'),
  'anon et authenticated n''écrivent pas dans produit_photo'
);
select is((select count(*)::int from public.produit_photo), 0, 'aucune photo par défaut');

-- Produits de départ : P est complet sauf photo ; V est un brouillon vide.
select public.enregistrer_produit(
  '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, null::uuid,
  '{"famille":"cosplay","slug":"photos-p","titre_fr":"P","titre_en":"P en","description_fr":"Description","description_en":"Description en","prix_cents":4990,"delai_fabrication_jours":10}'::jsonb,
  '[{"taille":"M","stock":1}]'::jsonb);
select public.enregistrer_produit(
  '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, null::uuid,
  '{"famille":"accessoire","slug":"photos-v","titre_fr":"V"}'::jsonb, '[]'::jsonb);
select public.enregistrer_produit(
  '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, null::uuid,
  '{"famille":"accessoire","slug":"photos-q","titre_fr":"Q"}'::jsonb, '[]'::jsonb);
create temp table ks_ids as
  select (select id from public.produit where slug = 'photos-p') as p,
         (select id from public.produit where slug = 'photos-v') as v,
         (select id from public.produit where slug = 'photos-q') as q;
grant select on ks_ids to public;

-- manques_publication.
select is(public.manques_publication((select p from ks_ids)), array['photo'], 'P : seule la photo manque');
select is(
  public.manques_publication((select v from ks_ids)),
  array['prix', 'photo', 'titre_en', 'description_fr', 'description_en', 'variante'],
  'V : tout manque, dans l''ordre'
);
select is(public.manques_publication('00000000-0000-0000-0000-00000000ffff'), null, 'produit inconnu : null');
select ok(
  has_function_privilege('service_role', 'public.manques_publication(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.manques_publication(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.manques_publication(uuid)', 'execute'),
  'manques_publication est interne (service seulement)'
);

-- Publier incomplet : refusé, rien n'est publié.
select throws_ok(
  $$select public.publier_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, (select p from ks_ids))$$,
  'P0001', 'KS_PUBLICATION_INCOMPLETE', 'publier sans photo est refusé'
);
select throws_ok(
  $$select public.publier_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, (select v from ks_ids))$$,
  'P0001', 'KS_PUBLICATION_INCOMPLETE', 'publier un brouillon vide est refusé'
);
select is((select publie_le is null from public.produit where id = (select p from ks_ids)), true, 'le refus ne publie rien');

-- Ajout de photos.
select lives_ok(
  $$select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select p from ks_ids), (select p from ks_ids)::text || '/11111111-1111-4111-8111-111111111111.jpg', '  Face  ', 'Front')$$,
  'l''admin ajoute une photo'
);
select is((select alt_fr from public.produit_photo where fichier like '%11111111-1111%'), 'Face', 'le texte alternatif est rogné');
select is((select position from public.produit_photo where fichier like '%11111111-1111%'), 1, 'première photo en position 1');
select lives_ok(
  $$select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select p from ks_ids), (select p from ks_ids)::text || '/22222222-2222-4222-8222-222222222222.png', 'Dos', 'Back')$$,
  'l''admin ajoute une deuxième photo'
);
select lives_ok(
  $$select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select p from ks_ids), (select p from ks_ids)::text || '/33333333-3333-4333-8333-333333333333.webp', 'Profil', 'Side')$$,
  'l''admin ajoute une troisième photo'
);
select is((select position from public.produit_photo where fichier like '%33333333-3333%'), 3, 'dernière position');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'produit_photo' and action = 'insert' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000f1',
  'le journal de la photo porte l''auteur'
);

-- Refus d'ajout.
select throws_ok(
  $$select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f2","role":"admin"}'::jsonb,
    (select p from ks_ids), (select p from ks_ids)::text || '/44444444-4444-4444-8444-444444444444.jpg', 'a', 'b')$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant n''ajoute pas de photo'
);
select throws_ok(
  $$select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    '00000000-0000-0000-0000-00000000ffff', '00000000-0000-0000-0000-00000000ffff/44444444-4444-4444-8444-444444444444.jpg', 'a', 'b')$$,
  'P0001', 'KS_PRODUIT_INTROUVABLE', 'produit inconnu refusé'
);
select throws_ok(
  $$select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select p from ks_ids), 'ailleurs/44444444-4444-4444-8444-444444444444.jpg', 'a', 'b')$$,
  'P0001', 'KS_FICHIER_INVALIDE', 'fichier hors du dossier du produit refusé'
);
select throws_ok(
  $$select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select p from ks_ids), (select p from ks_ids)::text || '/44444444-4444-4444-8444-444444444444.gif', 'a', 'b')$$,
  'P0001', 'KS_FICHIER_INVALIDE', 'extension gif refusée'
);
select throws_ok(
  $$select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select p from ks_ids), (select p from ks_ids)::text || '/11111111-1111-4111-8111-111111111111.jpg', 'a', 'b')$$,
  'P0001', 'KS_FICHIER_INVALIDE', 'fichier déjà enregistré refusé'
);
select throws_ok(
  $$select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select p from ks_ids), (select p from ks_ids)::text || '/44444444-4444-4444-8444-444444444444.jpg', '   ', 'b')$$,
  'P0001', 'KS_ALT_INVALIDE', 'texte alternatif français vide refusé'
);
select throws_ok(
  $$select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select p from ks_ids), (select p from ks_ids)::text || '/44444444-4444-4444-8444-444444444444.jpg', 'a', null)$$,
  'P0001', 'KS_ALT_INVALIDE', 'texte alternatif anglais absent refusé'
);
select throws_ok(
  $$select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select p from ks_ids), (select p from ks_ids)::text || '/44444444-4444-4444-8444-444444444444.jpg', repeat('x', 201), 'b')$$,
  'P0001', 'KS_ALT_INVALIDE', 'texte alternatif de 201 caractères refusé'
);
select is((select count(*)::int from public.produit_photo where produit_id = (select p from ks_ids)), 3, 'les refus n''ajoutent aucune photo');

-- Limite : 10 photos au plus.
select lives_ok(
  $$select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select q from ks_ids), (select q from ks_ids)::text || '/' || gen_random_uuid()::text || '.jpg', 'Photo ' || n, 'Photo ' || n)
    from generate_series(1, 10) n$$,
  'dix photos sont acceptées'
);
select throws_ok(
  $$select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select q from ks_ids), (select q from ks_ids)::text || '/' || gen_random_uuid()::text || '.jpg', 'Onzième', 'Eleventh')$$,
  'P0001', 'KS_PHOTOS_LIMITE', 'la onzième photo est refusée'
);
select is((select count(*)::int from public.produit_photo where produit_id = (select q from ks_ids)), 10, 'dix photos au plus par produit');
select is((select array_agg(position order by position) from public.produit_photo where produit_id = (select q from ks_ids)), array[1,2,3,4,5,6,7,8,9,10], 'positions 1 à 10');

-- Ordre : monter, descendre, bouts de liste.
select lives_ok(
  $$select public.deplacer_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%33333333-3333%'), 'haut')$$,
  'monter la troisième photo'
);
select is(
  (select array_agg(substr(fichier, 38, 4) order by position) from public.produit_photo where produit_id = (select p from ks_ids)),
  array['1111', '3333', '2222'],
  'l''ordre est échangé'
);
select is((select array_agg(position order by position) from public.produit_photo where produit_id = (select p from ks_ids)), array[1,2,3], 'positions contiguës après échange');
select lives_ok(
  $$select public.deplacer_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%11111111-1111%'), 'haut')$$,
  'monter la première photo : sans effet, sans erreur'
);
select is(
  (select array_agg(substr(fichier, 38, 4) order by position) from public.produit_photo where produit_id = (select p from ks_ids)),
  array['1111', '3333', '2222'],
  'la première photo reste première'
);
select lives_ok(
  $$select public.deplacer_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%22222222-2222%'), 'bas')$$,
  'descendre la dernière photo : sans effet, sans erreur'
);
select lives_ok(
  $$select public.deplacer_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%11111111-1111%'), 'bas')$$,
  'descendre la première photo'
);
select is(
  (select array_agg(substr(fichier, 38, 4) order by position) from public.produit_photo where produit_id = (select p from ks_ids)),
  array['3333', '1111', '2222'],
  'descendre échange avec la suivante'
);
select throws_ok(
  $$select public.deplacer_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%11111111-1111%'), 'milieu')$$,
  'P0001', 'KS_SENS_INVALIDE', 'sens invalide refusé'
);
select throws_ok(
  $$select public.deplacer_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    '00000000-0000-0000-0000-00000000ffff', 'haut')$$,
  'P0001', 'KS_PHOTO_INTROUVABLE', 'photo inconnue refusée'
);
select throws_ok(
  $$select public.deplacer_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f2","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%11111111-1111%'), 'haut')$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne déplace pas de photo'
);

-- RLS : brouillon invisible, publié visible.
set local role anon;
select is((select count(*)::int from public.produit_photo), 0, 'anon ne voit aucune photo de brouillon');
select throws_ok($$insert into public.produit_photo (produit_id, fichier, alt_fr, alt_en, position) values ('00000000-0000-0000-0000-00000000ffff', 'x', 'a', 'b', 1)$$, '42501', null, 'anon n''écrit pas dans produit_photo');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated"}';
select is((select count(*)::int from public.produit_photo), 0, 'un Compte connecté ne voit aucune photo de brouillon');
select throws_ok($$delete from public.produit_photo$$, '42501', null, 'un Compte connecté n''écrit pas dans produit_photo');
reset role;

-- Publication.
select throws_ok(
  $$select public.publier_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f2","role":"admin"}'::jsonb, (select p from ks_ids))$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne publie pas'
);
select lives_ok(
  $$select public.publier_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, (select p from ks_ids))$$,
  'l''admin publie un produit complet'
);
select is((select publie_le is not null from public.produit where id = (select p from ks_ids)), true, 'publie_le est posé');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'produit' and action = 'update' and apres ? 'publie_le' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000f1',
  'le journal de la publication porte l''auteur'
);
create temp table ks_publie as select publie_le from public.produit where id = (select p from ks_ids);
grant select on ks_publie to public;
select lives_ok(
  $$select public.publier_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, (select p from ks_ids))$$,
  'publier un produit déjà publié est sans effet'
);
select is((select publie_le from public.produit where id = (select p from ks_ids)), (select publie_le from ks_publie), 'publie_le n''a pas bougé');
select throws_ok(
  $$select public.publier_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, '00000000-0000-0000-0000-00000000ffff')$$,
  'P0001', 'KS_PRODUIT_INTROUVABLE', 'publier un produit inconnu est refusé'
);

set local role anon;
select is((select count(*)::int from public.produit_photo), 3, 'anon voit les photos du produit publié');
select is((select count(*)::int from public.produit_photo where produit_id = (select q from ks_ids)), 0, 'anon ne voit pas les photos d''un brouillon');
reset role;

-- Un produit publié ne devient pas incomplet (contrôle différé, forcé ici par SET CONSTRAINTS).
create function pg_temp.essai_prix_efface() returns void language plpgsql as $$
begin
  perform public.enregistrer_produit(
    '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, (select p from ks_ids),
    '{"famille":"cosplay","slug":"photos-p","titre_fr":"P","titre_en":"P en","description_fr":"Description","description_en":"Description en","delai_fabrication_jours":10}'::jsonb,
    '[{"taille":"M","stock":1}]'::jsonb);
  set constraints all immediate;
end $$;
create function pg_temp.essai_sans_variante() returns void language plpgsql as $$
begin
  perform public.enregistrer_produit(
    '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, (select p from ks_ids),
    '{"famille":"cosplay","slug":"photos-p","titre_fr":"P","titre_en":"P en","description_fr":"Description","description_en":"Description en","prix_cents":4990,"delai_fabrication_jours":10}'::jsonb,
    '[]'::jsonb);
  set constraints all immediate;
end $$;
create function pg_temp.essai_titre_modifie() returns void language plpgsql as $$
begin
  perform public.enregistrer_produit(
    '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, (select p from ks_ids),
    '{"famille":"cosplay","slug":"photos-p","titre_fr":"P modifié","titre_en":"P en","description_fr":"Description","description_en":"Description en","prix_cents":5990,"delai_fabrication_jours":10}'::jsonb,
    '[{"taille":"M","stock":3},{"taille":"L","stock":1}]'::jsonb);
  set constraints all immediate;
end $$;
create function pg_temp.essai_slug_modifie() returns void language plpgsql as $$
begin
  perform public.enregistrer_produit(
    '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, (select p from ks_ids),
    '{"famille":"cosplay","slug":"photos-p-nouveau","titre_fr":"P","titre_en":"P en","description_fr":"Description","description_en":"Description en","prix_cents":4990,"delai_fabrication_jours":10}'::jsonb,
    '[{"taille":"M","stock":1}]'::jsonb);
end $$;
create function pg_temp.essai_famille_modifiee() returns void language plpgsql as $$
begin
  perform public.enregistrer_produit(
    '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, (select p from ks_ids),
    '{"famille":"accessoire","slug":"photos-p","titre_fr":"P","titre_en":"P en","description_fr":"Description","description_en":"Description en","prix_cents":4990,"delai_fabrication_jours":10}'::jsonb,
    '[{"taille":"M","stock":1}]'::jsonb);
end $$;
select throws_ok($$select pg_temp.essai_prix_efface()$$, 'P0001', 'KS_PUBLICATION_INCOMPLETE', 'effacer le prix d''un produit publié est refusé');
select throws_ok($$select pg_temp.essai_sans_variante()$$, 'P0001', 'KS_PUBLICATION_INCOMPLETE', 'supprimer la dernière variante d''un produit publié est refusé');
select lives_ok($$select pg_temp.essai_titre_modifie()$$, 'modifier un produit publié sans le rendre incomplet est permis');
select throws_ok($$select pg_temp.essai_slug_modifie()$$, 'P0001', 'KS_PRODUIT_PUBLIE_VERROUILLE', 'changer l''adresse d''un produit publié est refusé');
select throws_ok($$select pg_temp.essai_famille_modifiee()$$, 'P0001', 'KS_PRODUIT_PUBLIE_VERROUILLE', 'changer la famille d''un produit publié est refusé');

-- Dépublication.
select throws_ok(
  $$select public.depublier_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f2","role":"admin"}'::jsonb, (select p from ks_ids))$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne dépublie pas'
);
select lives_ok(
  $$select public.depublier_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, (select p from ks_ids))$$,
  'l''admin dépublie'
);
select is((select publie_le is null from public.produit where id = (select p from ks_ids)), true, 'publie_le est effacé');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'produit' and action = 'update' and avant ? 'publie_le' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000f1',
  'le journal de la dépublication porte l''auteur'
);
set local role anon;
select is((select count(*)::int from public.produit_photo), 0, 'dépublié : les photos sont introuvables côté public');
reset role;

-- Un brouillon change d'adresse librement ; modifie_le suit les modifications.
select lives_ok($$select pg_temp.essai_slug_modifie()$$, 'un brouillon change d''adresse');
select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
update public.produit set modifie_le = '2000-01-01' where id = (select p from ks_ids);
select is((select modifie_le > '2001-01-01'::timestamptz from public.produit where id = (select p from ks_ids)), true, 'modifie_le est tenu à jour par la base');

-- Bornes de enregistrer_produit.
select lives_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"accessoire","slug":"borne-haute","titre_fr":"Borne","prix_cents":1000000,"delai_fabrication_jours":365}'::jsonb, '[]'::jsonb)$$,
  'prix 1 000 000 et délai 365 acceptés'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"accessoire","slug":"borne-prix","titre_fr":"Borne","prix_cents":1000001}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_PRIX_INVALIDE', 'prix 1 000 001 refusé'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"accessoire","slug":"borne-delai","titre_fr":"Borne","delai_fabrication_jours":0}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_DELAI_INVALIDE', 'délai 0 refusé'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"accessoire","slug":"borne-delai","titre_fr":"Borne","delai_fabrication_jours":366}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_DELAI_INVALIDE', 'délai 366 refusé'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"accessoire","slug":"borne-titre","titre_fr":"   "}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_TITRE_INVALIDE', 'titre vide refusé'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, null::uuid,
    jsonb_build_object('famille', 'accessoire', 'slug', 'borne-titre', 'titre_fr', repeat('x', 121)), '[]'::jsonb)$$,
  'P0001', 'KS_TITRE_INVALIDE', 'titre de 121 caractères refusé'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, null::uuid,
    jsonb_build_object('famille', 'accessoire', 'slug', 'borne-desc', 'titre_fr', 'Borne', 'description_fr', repeat('x', 5001)), '[]'::jsonb)$$,
  'P0001', 'KS_TEXTE_INVALIDE', 'description de 5001 caractères refusée'
);

-- Suppression d'un produit : ses photos disparaissent avec lui (clé étrangère en cascade).
delete from public.produit where id = (select q from ks_ids);
select is((select count(*)::int from public.produit_photo where produit_id = (select q from ks_ids)), 0, 'les photos suivent leur produit');

select * from finish();
rollback;
