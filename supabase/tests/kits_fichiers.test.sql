-- Story 3.1 : Kits et fichiers (famille kit, prix 0, lien un pour un, famille immuable, droits, journal, version, publication refusée,
-- RLS des fichiers, aucune lecture des tables _prive, bucket privé). Les données de ce test sont créées dans la transaction, puis annulées.
begin;
select plan(163);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-kit1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-kit2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-kit3@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a2', 'assistant');

create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb $$;
create function pg_temp.ass() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a2","role":"admin"}'::jsonb $$;

-- Bucket privé : jamais public, limite de 50 Mo, aucune politique de storage.objects pour les rôles publics.
select is((select public from storage.buckets where id = 'kits-private'), false, 'kits-private est un bucket privé');
select is((select file_size_limit from storage.buckets where id = 'kits-private'), 52428800::bigint, 'kits-private est limité à 50 Mo (52 428 800 octets)');
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and (roles && array['anon', 'authenticated', 'public']::name[])),
  0,
  'aucune politique de storage.objects pour anon, authenticated ou public'
);
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and (coalesce(qual, '') like '%kits-private%' or coalesce(with_check, '') like '%kits-private%')),
  0,
  'aucune politique de storage.objects ne mentionne kits-private'
);

-- Tables : RLS active ; fichier_kit lisible (policy), fichier_kit_prive fermée à anon et authenticated.
select is((select relrowsecurity from pg_class where oid = 'public.fichier_kit'::regclass), true, 'RLS active sur fichier_kit');
select is((select relrowsecurity from pg_class where oid = 'public.fichier_kit_prive'::regclass), true, 'RLS active sur fichier_kit_prive');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'fichier_kit_prive'), 0, 'aucune politique sur fichier_kit_prive');
select ok(
  not has_table_privilege('anon', 'public.fichier_kit_prive', 'select, insert, update, delete')
  and not has_table_privilege('authenticated', 'public.fichier_kit_prive', 'select, insert, update, delete')
  and not has_any_column_privilege('anon', 'public.fichier_kit_prive', 'select, insert, update')
  and not has_any_column_privilege('authenticated', 'public.fichier_kit_prive', 'select, insert, update'),
  'anon et authenticated n''ont aucun droit sur fichier_kit_prive'
);
select ok(
  has_table_privilege('anon', 'public.fichier_kit', 'select') and has_table_privilege('authenticated', 'public.fichier_kit', 'select'),
  'anon et authenticated lisent fichier_kit'
);
select ok(
  not has_table_privilege('anon', 'public.fichier_kit', 'insert, update, delete')
  and not has_table_privilege('authenticated', 'public.fichier_kit', 'insert, update, delete'),
  'anon et authenticated n''écrivent pas dans fichier_kit'
);
select is(
  (select array_agg(a.attname::text order by a.attname) from pg_attribute a
   where a.attrelid = 'public.fichier_kit'::regclass and a.attnum > 0 and not a.attisdropped and a.attname ~* '(prive|chemin|note_admin)'),
  null,
  'fichier_kit n''a aucune colonne prive, chemin ou note_admin'
);
select is((select count(*)::int from public.fichier_kit), 0, 'aucun fichier par défaut');

-- Fonctions : service seulement.
select ok(
  not has_function_privilege('anon', 'public.enregistrer_kit(jsonb, uuid, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.enregistrer_kit(jsonb, uuid, jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.enregistrer_kit(jsonb, uuid, jsonb)', 'execute'),
  'enregistrer_kit : service seulement'
);
select ok(
  not has_function_privilege('anon', 'public.ajouter_fichier_kit(jsonb, uuid, text, text, text, bigint, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.ajouter_fichier_kit(jsonb, uuid, text, text, text, bigint, text)', 'execute')
  and has_function_privilege('service_role', 'public.ajouter_fichier_kit(jsonb, uuid, text, text, text, bigint, text)', 'execute'),
  'ajouter_fichier_kit : service seulement'
);
select ok(
  not has_function_privilege('anon', 'public.remplacer_fichier_kit(jsonb, uuid, bigint, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.remplacer_fichier_kit(jsonb, uuid, bigint, text)', 'execute')
  and has_function_privilege('service_role', 'public.remplacer_fichier_kit(jsonb, uuid, bigint, text)', 'execute'),
  'remplacer_fichier_kit : service seulement'
);
select ok(
  not has_function_privilege('anon', 'public.supprimer_fichier_kit(jsonb, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.supprimer_fichier_kit(jsonb, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.supprimer_fichier_kit(jsonb, uuid)', 'execute'),
  'supprimer_fichier_kit : service seulement'
);
select ok(
  not has_function_privilege('anon', 'public.extension_fichier_kit(text)', 'execute')
  and not has_function_privilege('authenticated', 'public.verifier_produit_kit()', 'execute')
  and not has_function_privilege('anon', 'public.manques_publication(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.manques_publication(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.manques_publication(uuid)', 'execute'),
  'les fonctions internes restent fermées aux rôles publics'
);

-- Produits de départ : un cosplay et un accessoire (cibles possibles d'un lien).
select public.enregistrer_produit(pg_temp.adm(), null::uuid, '{"famille":"cosplay","slug":"kit-cos","titre_fr":"Cosplay"}'::jsonb, '[]'::jsonb);
select public.enregistrer_produit(pg_temp.adm(), null::uuid, '{"famille":"accessoire","slug":"kit-acc","titre_fr":"Accessoire"}'::jsonb, '[]'::jsonb);
select public.enregistrer_produit(pg_temp.adm(), null::uuid, '{"famille":"cosplay","slug":"kit-cos2","titre_fr":"Cosplay 2"}'::jsonb, '[]'::jsonb);
create temp table ks_ids as
  select (select id from public.produit where slug = 'kit-cos') as cos,
         (select id from public.produit where slug = 'kit-acc') as acc,
         (select id from public.produit where slug = 'kit-cos2') as cos2;
grant select on ks_ids to public;

-- Créer un Kit à 0 USD.
select lives_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-gratuit","titre_fr":"Kit gratuit","prix_cents":0,"niveau":"debutant"}'::jsonb)$$,
  'l''admin crée un Kit à 0 USD'
);
select is((select famille from public.produit where slug = 'kit-gratuit'), 'kit', 'la famille est kit');
select is((select prix_cents from public.produit where slug = 'kit-gratuit'), 0, 'le prix 0 est enregistré');
select is((select publie_le is null from public.produit where slug = 'kit-gratuit'), true, 'le Kit est un brouillon');
select is((select niveau from public.produit where slug = 'kit-gratuit'), 'debutant', 'le niveau est enregistré');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'produit' and action = 'insert' and apres ->> 'slug' = 'kit-gratuit'),
  '00000000-0000-0000-0000-0000000000a1',
  'le journal du Kit porte l''auteur'
);
create temp table ks_kits as select id as k from public.produit where slug = 'kit-gratuit';
grant select on ks_kits to public;

-- Un Kit sans prix, sans niveau et sans texte est un brouillon valide.
select lives_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-vide","titre_fr":"Vide"}'::jsonb)$$,
  'un Kit minimal est accepté'
);
select is((select prix_cents is null and niveau is null and materiel_fr is null from public.produit where slug = 'kit-vide'), true, 'prix, niveau et matériel absents');

-- Prix.
select throws_ok(
  $$select public.enregistrer_produit(pg_temp.adm(), null::uuid, '{"famille":"cosplay","slug":"zero-cos","titre_fr":"Z","prix_cents":0}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_PRIX_INVALIDE', 'prix 0 refusé pour un cosplay'
);
select throws_ok(
  $$select public.enregistrer_produit(pg_temp.adm(), null::uuid, '{"famille":"accessoire","slug":"zero-acc","titre_fr":"Z","prix_cents":0}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_PRIX_INVALIDE', 'prix 0 refusé pour un accessoire'
);
select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
select throws_ok(
  $$insert into public.produit (famille, slug, titre_fr, prix_cents) values ('cosplay', 'zero-direct', 'Z', 0)$$,
  '23514', null, 'prix 0 refusé en base pour un cosplay, même par écriture directe'
);
select lives_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-borne","titre_fr":"Borne","prix_cents":1000000}'::jsonb)$$,
  'prix 1 000 000 accepté pour un Kit'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-trop","titre_fr":"Trop","prix_cents":1000001}'::jsonb)$$,
  'P0001', 'KS_PRIX_INVALIDE', 'prix 1 000 001 refusé'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-neg","titre_fr":"Neg","prix_cents":-1}'::jsonb)$$,
  'P0001', 'KS_PRIX_INVALIDE', 'prix négatif refusé'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-dec","titre_fr":"Dec","prix_cents":"12.5"}'::jsonb)$$,
  'P0001', 'KS_PRIX_INVALIDE', 'prix décimal refusé'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-txt","titre_fr":"Txt","prix_cents":"abc"}'::jsonb)$$,
  'P0001', 'KS_PRIX_INVALIDE', 'prix non numérique refusé'
);

-- Droits : un Assistant n'écrit rien.
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.ass(), null::uuid, '{"famille":"kit","slug":"kit-ass","titre_fr":"Ass"}'::jsonb)$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne crée pas de Kit'
);
select throws_ok(
  $$select public.enregistrer_kit(null::jsonb, null::uuid, '{"famille":"kit","slug":"kit-sans","titre_fr":"Sans"}'::jsonb)$$,
  'P0001', null, 'sans auteur, la création est refusée'
);
select is((select count(*)::int from public.produit where slug in ('kit-ass', 'kit-sans')), 0, 'les refus ne créent rien');

-- Validations d'enregistrer_kit.
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"cosplay","slug":"kit-fam","titre_fr":"Fam"}'::jsonb)$$,
  'P0001', 'KS_FAMILLE_INVALIDE', 'enregistrer_kit refuse une autre famille'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"slug":"kit-fam","titre_fr":"Fam"}'::jsonb)$$,
  'P0001', 'KS_FAMILLE_INVALIDE', 'enregistrer_kit exige la famille kit'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-t","titre_fr":"   "}'::jsonb)$$,
  'P0001', 'KS_TITRE_INVALIDE', 'titre vide refusé'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, jsonb_build_object('famille', 'kit', 'slug', 'kit-t', 'titre_fr', repeat('x', 121)))$$,
  'P0001', 'KS_TITRE_INVALIDE', 'titre de 121 caractères refusé'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"Mauvaise Adresse","titre_fr":"S"}'::jsonb)$$,
  'P0001', 'KS_SLUG_INVALIDE', 'adresse invalide refusée'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-gratuit","titre_fr":"Pris"}'::jsonb)$$,
  'P0001', 'KS_SLUG_PRIS', 'adresse déjà prise refusée'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-pris-cos","titre_fr":"Pris"}'::jsonb || '{"slug":"kit-cos"}'::jsonb)$$,
  'P0001', 'KS_SLUG_PRIS', 'adresse d''un cosplay déjà prise refusée'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-n","titre_fr":"N","niveau":"expert"}'::jsonb)$$,
  'P0001', 'KS_NIVEAU_INVALIDE', 'niveau inconnu refusé'
);
select lives_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-n-int","titre_fr":"N","niveau":"intermediaire"}'::jsonb)$$,
  'niveau intermédiaire accepté'
);
select lives_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-n-av","titre_fr":"N","niveau":"avance"}'::jsonb)$$,
  'niveau avancé accepté'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, jsonb_build_object('famille', 'kit', 'slug', 'kit-m', 'titre_fr', 'M', 'materiel_fr', repeat('x', 5001)))$$,
  'P0001', 'KS_TEXTE_INVALIDE', 'matériel de 5001 caractères refusé'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, jsonb_build_object('famille', 'kit', 'slug', 'kit-m', 'titre_fr', 'M', 'description_en', repeat('x', 5001)))$$,
  'P0001', 'KS_TEXTE_INVALIDE', 'description de 5001 caractères refusée'
);
select lives_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, jsonb_build_object('famille', 'kit', 'slug', 'kit-m5000', 'titre_fr', 'M', 'materiel_fr', repeat('x', 5000), 'materiel_en', '  Foam  ', 'description_fr', 'Desc'))$$,
  'matériel de 5000 caractères accepté'
);
select is((select materiel_en from public.produit where slug = 'kit-m5000'), 'Foam', 'le matériel est rogné');
select is((select char_length(materiel_fr) from public.produit where slug = 'kit-m5000'), 5000, 'le matériel français de 5000 caractères est conservé');
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-u","titre_fr":"U","univers_id":"00000000-0000-0000-0000-00000000ffff"}'::jsonb)$$,
  'P0001', 'KS_UNIVERS_INTROUVABLE', 'univers inconnu refusé'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), '00000000-0000-0000-0000-00000000ffff', '{"famille":"kit","slug":"kit-inconnu","titre_fr":"I"}'::jsonb)$$,
  'P0001', 'KS_PRODUIT_INTROUVABLE', 'Kit inconnu refusé'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), (select cos from ks_ids), '{"famille":"kit","slug":"kit-cos","titre_fr":"Cosplay"}'::jsonb)$$,
  'P0001', 'KS_FAMILLE_INVALIDE', 'enregistrer_kit ne modifie pas un cosplay'
);

-- Modification d'un Kit : même ligne, publie_le jamais posé.
select lives_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), (select k from ks_kits), '{"famille":"kit","slug":"kit-gratuit","titre_fr":"Kit gratuit modifié","titre_en":"Free kit","description_fr":"D","description_en":"D","materiel_fr":"Mousse","materiel_en":"Foam","prix_cents":0,"niveau":"avance"}'::jsonb)$$,
  'l''admin modifie un Kit'
);
select is((select titre_fr || '/' || niveau || '/' || materiel_fr from public.produit where id = (select k from ks_kits)), 'Kit gratuit modifié/avance/Mousse', 'les champs sont mis à jour');
select is((select count(*)::int from public.produit where slug = 'kit-gratuit'), 1, 'la modification ne crée pas de doublon');
select is((select publie_le is null from public.produit where id = (select k from ks_kits)), true, 'enregistrer_kit ne publie jamais');
select is(
  (select avant ->> 'niveau' from public.journal_audit where cible_table = 'produit' and action = 'update' and cible_id = (select k::text from ks_kits) order by id desc limit 1),
  'debutant',
  'le journal de la modification garde l''ancien niveau'
);

-- enregistrer_produit ne touche jamais un Kit, et n'accepte pas la famille kit.
select throws_ok(
  $$select public.enregistrer_produit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-par-produit","titre_fr":"X"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_FAMILLE_INVALIDE', 'enregistrer_produit refuse la famille kit'
);
select throws_ok(
  $$select public.enregistrer_produit(pg_temp.adm(), (select k from ks_kits), '{"famille":"cosplay","slug":"kit-gratuit","titre_fr":"Détourné"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_FAMILLE_INVALIDE', 'enregistrer_produit ne transforme pas un Kit en cosplay'
);
select throws_ok(
  $$select public.enregistrer_produit(pg_temp.adm(), (select k from ks_kits), '{"famille":"accessoire","slug":"kit-gratuit","titre_fr":"Détourné"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_FAMILLE_INVALIDE', 'enregistrer_produit ne transforme pas un Kit en accessoire'
);
select is((select titre_fr from public.produit where id = (select k from ks_kits)), 'Kit gratuit modifié', 'le Kit est resté intact');

-- La famille ne change jamais vers ou depuis kit (écriture directe comprise).
select throws_ok(
  $$update public.produit set famille = 'kit' where id = (select cos from ks_ids)$$,
  'P0001', 'KS_FAMILLE_INVALIDE', 'un cosplay ne devient pas un Kit'
);
select throws_ok(
  $$update public.produit set famille = 'accessoire' where id = (select k from ks_kits)$$,
  'P0001', 'KS_FAMILLE_INVALIDE', 'un Kit ne devient pas un accessoire'
);
select lives_ok(
  $$update public.produit set famille = 'accessoire' where id = (select cos2 from ks_ids)$$,
  'cosplay vers accessoire reste possible (règle des brouillons inchangée)'
);
select lives_ok(
  $$update public.produit set famille = 'cosplay' where id = (select cos2 from ks_ids)$$,
  'accessoire vers cosplay reste possible'
);

-- Lien un pour un.
select lives_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), (select k from ks_kits), jsonb_build_object('famille', 'kit', 'slug', 'kit-gratuit', 'titre_fr', 'Kit gratuit modifié', 'prix_cents', 0, 'produit_lie_id', (select cos from ks_ids)))$$,
  'le Kit se lie à un cosplay'
);
select is((select produit_lie_id from public.produit where id = (select k from ks_kits)), (select cos from ks_ids), 'produit_lie_id est posé');
select lives_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), (select k from ks_kits), jsonb_build_object('famille', 'kit', 'slug', 'kit-gratuit', 'titre_fr', 'Kit gratuit modifié', 'prix_cents', 0, 'produit_lie_id', (select cos from ks_ids)))$$,
  'réenregistrer le même lien est permis'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, jsonb_build_object('famille', 'kit', 'slug', 'kit-second', 'titre_fr', 'Second', 'produit_lie_id', (select cos from ks_ids)))$$,
  'P0001', 'KS_KIT_LIE_INVALIDE', 'un second Kit sur le même cosplay est refusé'
);
select is((select count(*)::int from public.produit where slug = 'kit-second'), 0, 'le second Kit n''est pas créé');
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, jsonb_build_object('famille', 'kit', 'slug', 'kit-sur-kit', 'titre_fr', 'Sur kit', 'produit_lie_id', (select k from ks_kits)))$$,
  'P0001', 'KS_KIT_LIE_INVALIDE', 'un lien vers un Kit est refusé'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-lie-inconnu","titre_fr":"L","produit_lie_id":"00000000-0000-0000-0000-00000000ffff"}'::jsonb)$$,
  'P0001', 'KS_KIT_LIE_INVALIDE', 'un lien vers un produit inconnu est refusé'
);
select throws_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"kit-lie-mauvais","titre_fr":"L","produit_lie_id":"pas-un-uuid"}'::jsonb)$$,
  'P0001', 'KS_KIT_LIE_INVALIDE', 'un lien mal formé est refusé'
);
select lives_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, jsonb_build_object('famille', 'kit', 'slug', 'kit-acc-lie', 'titre_fr', 'Sur accessoire', 'produit_lie_id', (select acc from ks_ids)))$$,
  'un Kit se lie à un accessoire'
);
-- Écriture directe : la contrainte d'unicité et le déclencheur tiennent sans passer par la fonction.
select throws_ok(
  $$insert into public.produit (famille, slug, titre_fr, produit_lie_id) values ('kit', 'kit-direct-double', 'D', (select cos from ks_ids))$$,
  '23505', null, 'deux Kits sur le même cosplay sont refusés par la contrainte d''unicité'
);
select throws_ok(
  $$insert into public.produit (famille, slug, titre_fr, produit_lie_id) values ('kit', 'kit-direct-kit', 'D', (select k from ks_kits))$$,
  'P0001', 'KS_KIT_LIE_INVALIDE', 'un lien vers un Kit est refusé même en écriture directe'
);
select throws_ok(
  $$update public.produit set produit_lie_id = (select acc from ks_ids) where id = (select cos2 from ks_ids)$$,
  '23514', null, 'un cosplay ne porte pas de lien'
);
select throws_ok(
  $$update public.produit set niveau = 'debutant' where id = (select cos from ks_ids)$$,
  '23514', null, 'un cosplay ne porte pas de niveau'
);
select throws_ok(
  $$update public.produit set produit_lie_id = id where id = (select k from ks_kits)$$,
  'P0001', 'KS_KIT_LIE_INVALIDE', 'un Kit ne se lie pas à lui-même'
);
-- Délier.
select lives_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), (select k from ks_kits), '{"famille":"kit","slug":"kit-gratuit","titre_fr":"Kit gratuit modifié","prix_cents":0}'::jsonb)$$,
  'le Kit se délie'
);
select is((select produit_lie_id is null from public.produit where id = (select k from ks_kits)), true, 'le lien est effacé');
select lives_ok(
  $$select public.enregistrer_kit(pg_temp.adm(), null::uuid, jsonb_build_object('famille', 'kit', 'slug', 'kit-second', 'titre_fr', 'Second', 'produit_lie_id', (select cos from ks_ids)))$$,
  'le cosplay délié reçoit un autre Kit'
);

-- Publication refusée : un Kit, même complet, n'est pas publiable dans cette story.
select is(public.manques_publication((select k from ks_kits)), array['kit'], 'manques_publication d''un Kit : non publiable');
select is(public.manques_publication('00000000-0000-0000-0000-00000000ffff'), null, 'manques_publication d''un produit inconnu : null');
select is(public.manques_publication((select cos from ks_ids)), array['prix', 'photo', 'titre_en', 'description_fr', 'description_en', 'variante'], 'manques_publication d''un cosplay est inchangée');
insert into public.produit_photo (produit_id, fichier, alt_fr, alt_en, position) values ((select k from ks_kits), (select k from ks_kits)::text || '/a.jpg', 'Alt', 'Alt', 1);
select throws_ok(
  $$select public.publier_produit(pg_temp.adm(), (select k from ks_kits))$$,
  'P0001', 'KS_PUBLICATION_INCOMPLETE', 'publier un Kit est refusé, même avec prix, photo et textes'
);
select is((select publie_le is null from public.produit where id = (select k from ks_kits)), true, 'le refus ne publie rien');

-- Fichiers : ajout.
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.ass(), (select k from ks_kits), 'Patron', 'Pattern', 'pdf_a4', 3000000, (select k from ks_kits)::text || '/11111111-1111-4111-8111-111111111111.pdf')$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant n''ajoute pas de fichier'
);
select lives_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), '  Patron A4  ', 'Pattern A4', 'pdf_a4', 3000000, (select k from ks_kits)::text || '/11111111-1111-4111-8111-111111111111.pdf')$$,
  'l''admin ajoute un PDF A4'
);
select is((select version from public.fichier_kit where nom_en = 'Pattern A4'), 1, 'la version démarre à 1');
select is((select ordre from public.fichier_kit where nom_en = 'Pattern A4'), 1, 'le premier fichier est en position 1');
select is((select nom_fr from public.fichier_kit where nom_en = 'Pattern A4'), 'Patron A4', 'le nom est rogné');
select is((select taille_octets from public.fichier_kit where nom_en = 'Pattern A4'), 3000000::bigint, 'la taille est enregistrée');
select is(
  (select k.chemin_stockage from public.fichier_kit_prive k join public.fichier_kit f on f.id = k.fichier_id where f.nom_en = 'Pattern A4'),
  (select k from ks_kits)::text || '/11111111-1111-4111-8111-111111111111.pdf',
  'le chemin est dans la table privée'
);
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'fichier_kit' and action = 'insert' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000a1',
  'le journal du fichier porte l''auteur'
);
select lives_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'Patron Letter', 'Pattern Letter', 'pdf_letter', 3100000, (select k from ks_kits)::text || '/22222222-2222-4222-8222-222222222222.pdf')$$,
  'l''admin ajoute un PDF US Letter'
);
select lives_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'Motif', 'Motif', 'svg', 52428800, (select k from ks_kits)::text || '/33333333-3333-4333-8333-333333333333.svg')$$,
  'un SVG de 50 Mo exactement est accepté'
);
select lives_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'Pièce', 'Part', 'stl', 1000, (select k from ks_kits)::text || '/44444444-4444-4444-8444-444444444444.stl')$$,
  'l''admin ajoute un STL'
);
select lives_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'Notes', 'Notes', 'transcription', 1048576, (select k from ks_kits)::text || '/55555555-5555-4555-8555-555555555555.txt')$$,
  'une transcription de 1 Mo exactement est acceptée'
);
select is((select array_agg(ordre order by ordre) from public.fichier_kit where produit_id = (select k from ks_kits)), array[1, 2, 3, 4, 5], 'les rangs croissent à l''ajout');
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'Malware', 'Malware', 'exe', 1000, (select k from ks_kits)::text || '/66666666-6666-4666-8666-666666666666.exe')$$,
  'P0001', 'KS_FORMAT_INVALIDE', 'un format inconnu est refusé'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'Zip', 'Zip', null, 1000, (select k from ks_kits)::text || '/66666666-6666-4666-8666-666666666666.zip')$$,
  'P0001', 'KS_FORMAT_INVALIDE', 'un format absent est refusé'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), '   ', 'x', 'svg', 1000, (select k from ks_kits)::text || '/66666666-6666-4666-8666-666666666666.svg')$$,
  'P0001', 'KS_NOM_INVALIDE', 'un nom français vide est refusé'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'x', repeat('y', 121), 'svg', 1000, (select k from ks_kits)::text || '/66666666-6666-4666-8666-666666666666.svg')$$,
  'P0001', 'KS_NOM_INVALIDE', 'un nom anglais de 121 caractères est refusé'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'x', 'x', 'svg', 0, (select k from ks_kits)::text || '/66666666-6666-4666-8666-666666666666.svg')$$,
  'P0001', 'KS_TAILLE_FICHIER_INVALIDE', 'une taille nulle est refusée'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'x', 'x', 'svg', 52428801, (select k from ks_kits)::text || '/66666666-6666-4666-8666-666666666666.svg')$$,
  'P0001', 'KS_TAILLE_FICHIER_INVALIDE', 'plus de 50 Mo est refusé'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'x', 'x', 'transcription', 1048577, (select k from ks_kits)::text || '/66666666-6666-4666-8666-666666666666.txt')$$,
  'P0001', 'KS_TAILLE_FICHIER_INVALIDE', 'une transcription de plus de 1 Mo est refusée'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'x', 'x', 'svg', null, (select k from ks_kits)::text || '/66666666-6666-4666-8666-666666666666.svg')$$,
  'P0001', 'KS_TAILLE_FICHIER_INVALIDE', 'une taille absente est refusée'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'x', 'x', 'svg', 1000, (select cos from ks_ids)::text || '/66666666-6666-4666-8666-666666666666.svg')$$,
  'P0001', 'KS_CHEMIN_INVALIDE', 'un chemin d''un autre produit est refusé'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'x', 'x', 'svg', 1000, (select k from ks_kits)::text || '/66666666-6666-4666-8666-666666666666.pdf')$$,
  'P0001', 'KS_CHEMIN_INVALIDE', 'une extension qui ne correspond pas au format est refusée'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'x', 'x', 'pdf_a4', 1000, (select k from ks_kits)::text || '/66666666-6666-4666-8666-666666666666.PDF')$$,
  'P0001', 'KS_CHEMIN_INVALIDE', 'une extension en majuscules est refusée'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'x', 'x', 'svg', 1000, (select k from ks_kits)::text || '/AAAAAAAA-6666-4666-8666-666666666666.svg')$$,
  'P0001', 'KS_CHEMIN_INVALIDE', 'un identifiant en majuscules est refusé'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'x', 'x', 'svg', 1000, (select k from ks_kits)::text || '/../66666666-6666-4666-8666-666666666666.svg')$$,
  'P0001', 'KS_CHEMIN_INVALIDE', 'un chemin avec remontée de dossier est refusé'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'x', 'x', 'svg', 1000, null)$$,
  'P0001', 'KS_CHEMIN_INVALIDE', 'un chemin absent est refusé'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'x', 'x', 'pdf_a4', 1000, (select k from ks_kits)::text || '/11111111-1111-4111-8111-111111111111.pdf')$$,
  'P0001', 'KS_CHEMIN_INVALIDE', 'un chemin déjà enregistré est refusé'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select cos from ks_ids), 'x', 'x', 'svg', 1000, (select cos from ks_ids)::text || '/66666666-6666-4666-8666-666666666666.svg')$$,
  'P0001', 'KS_FAMILLE_INVALIDE', 'un cosplay n''a pas de fichiers de kit'
);
select throws_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), '00000000-0000-0000-0000-00000000ffff', 'x', 'x', 'svg', 1000, '00000000-0000-0000-0000-00000000ffff/66666666-6666-4666-8666-666666666666.svg')$$,
  'P0001', 'KS_PRODUIT_INTROUVABLE', 'un produit inconnu est refusé'
);
select is((select count(*)::int from public.fichier_kit where produit_id = (select k from ks_kits)), 5, 'les refus n''ajoutent aucun fichier');
select is((select count(*)::int from public.fichier_kit_prive), 5, 'les refus n''ajoutent aucun chemin');

-- Remplacement : version + 1, ancien chemin renvoyé, journal avant / après.
create temp table ks_f as select id as pdf from public.fichier_kit where nom_en = 'Pattern A4';
grant select on ks_f to public;
select throws_ok(
  $$select public.remplacer_fichier_kit(pg_temp.ass(), (select pdf from ks_f), 4000000, (select k from ks_kits)::text || '/77777777-7777-4777-8777-777777777777.pdf')$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne remplace pas de fichier'
);
select is(
  (select public.remplacer_fichier_kit(pg_temp.adm(), (select pdf from ks_f), 4000000, (select k from ks_kits)::text || '/77777777-7777-4777-8777-777777777777.pdf')),
  (select k from ks_kits)::text || '/11111111-1111-4111-8111-111111111111.pdf',
  'le remplacement renvoie l''ancien chemin à effacer'
);
select is((select version from public.fichier_kit where id = (select pdf from ks_f)), 2, 'la version passe à 2');
select is((select taille_octets from public.fichier_kit where id = (select pdf from ks_f)), 4000000::bigint, 'la taille est mise à jour');
select is((select ordre from public.fichier_kit where id = (select pdf from ks_f)), 1, 'le rang ne change pas');
select is(
  (select chemin_stockage from public.fichier_kit_prive where fichier_id = (select pdf from ks_f)),
  (select k from ks_kits)::text || '/77777777-7777-4777-8777-777777777777.pdf',
  'le nouveau chemin est enregistré'
);
select is(
  (select avant ->> 'version' || '>' || (apres ->> 'version') from public.journal_audit where cible_table = 'fichier_kit' and action = 'update' and cible_id = (select pdf::text from ks_f) order by id desc limit 1),
  '1>2',
  'le journal garde la version avant et après'
);
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'fichier_kit' and action = 'update' and cible_id = (select pdf::text from ks_f) order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000a1',
  'le journal du remplacement porte l''auteur'
);
select lives_ok(
  $$select public.remplacer_fichier_kit(pg_temp.adm(), (select pdf from ks_f), 4100000, (select k from ks_kits)::text || '/88888888-8888-4888-8888-888888888888.pdf')$$,
  'un second remplacement est permis'
);
select is((select version from public.fichier_kit where id = (select pdf from ks_f)), 3, 'la version passe à 3');
select throws_ok(
  $$select public.remplacer_fichier_kit(pg_temp.adm(), (select pdf from ks_f), 4100000, (select k from ks_kits)::text || '/88888888-8888-4888-8888-888888888888.pdf')$$,
  'P0001', 'KS_CHEMIN_INVALIDE', 'remplacer par le même chemin est refusé'
);
select throws_ok(
  $$select public.remplacer_fichier_kit(pg_temp.adm(), (select pdf from ks_f), 4100000, (select k from ks_kits)::text || '/99999999-9999-4999-8999-999999999999.svg')$$,
  'P0001', 'KS_CHEMIN_INVALIDE', 'remplacer par une autre extension est refusé'
);
select throws_ok(
  $$select public.remplacer_fichier_kit(pg_temp.adm(), (select pdf from ks_f), 4100000, (select cos from ks_ids)::text || '/99999999-9999-4999-8999-999999999999.pdf')$$,
  'P0001', 'KS_CHEMIN_INVALIDE', 'remplacer par le chemin d''un autre produit est refusé'
);
select throws_ok(
  $$select public.remplacer_fichier_kit(pg_temp.adm(), (select pdf from ks_f), 52428801, (select k from ks_kits)::text || '/99999999-9999-4999-8999-999999999999.pdf')$$,
  'P0001', 'KS_TAILLE_FICHIER_INVALIDE', 'remplacer par plus de 50 Mo est refusé'
);
select throws_ok(
  $$select public.remplacer_fichier_kit(pg_temp.adm(), '00000000-0000-0000-0000-00000000ffff', 1000, (select k from ks_kits)::text || '/99999999-9999-4999-8999-999999999999.pdf')$$,
  'P0001', 'KS_FICHIER_INTROUVABLE', 'remplacer un fichier inconnu est refusé'
);
select is((select version from public.fichier_kit where id = (select pdf from ks_f)), 3, 'les refus ne changent pas la version');

-- Suppression : lignes effacées, chemin renvoyé.
create temp table ks_f2 as select id as stl from public.fichier_kit where nom_en = 'Part';
grant select on ks_f2 to public;
select throws_ok(
  $$select public.supprimer_fichier_kit(pg_temp.ass(), (select stl from ks_f2))$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne supprime pas de fichier'
);
select is(
  (select public.supprimer_fichier_kit(pg_temp.adm(), (select stl from ks_f2))),
  (select k from ks_kits)::text || '/44444444-4444-4444-8444-444444444444.stl',
  'la suppression renvoie le chemin à effacer'
);
select is((select count(*)::int from public.fichier_kit where id = (select stl from ks_f2)), 0, 'la ligne publiable est effacée');
select is((select count(*)::int from public.fichier_kit_prive where fichier_id = (select stl from ks_f2)), 0, 'la ligne privée est effacée');
select is(
  (select action from public.journal_audit where cible_table = 'fichier_kit' and cible_id = (select stl::text from ks_f2) order by id desc limit 1),
  'delete',
  'la suppression est journalisée'
);
select throws_ok(
  $$select public.supprimer_fichier_kit(pg_temp.adm(), (select stl from ks_f2))$$,
  'P0001', 'KS_FICHIER_INTROUVABLE', 'supprimer deux fois est refusé'
);
select lives_ok(
  $$select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_kits), 'Pièce 2', 'Part 2', 'stl', 2000, (select k from ks_kits)::text || '/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.stl')$$,
  'un nouvel ajout est permis après une suppression'
);
select is((select ordre from public.fichier_kit where nom_en = 'Part 2'), 6, 'le rang reste croissant après une suppression');

-- RLS : un brouillon de Kit est invisible, ses chemins ne sont lisibles par personne.
set local role anon;
select is((select count(*)::int from public.fichier_kit), 0, 'anon ne voit aucun fichier d''un Kit en brouillon');
select throws_ok($$select count(*) from public.fichier_kit_prive$$, '42501', null, 'anon ne lit pas fichier_kit_prive');
select throws_ok($$select chemin_stockage from public.fichier_kit_prive$$, '42501', null, 'anon ne lit pas les chemins');
select throws_ok($$insert into public.fichier_kit_prive (fichier_id, chemin_stockage) values (gen_random_uuid(), 'x')$$, '42501', null, 'anon n''écrit pas dans fichier_kit_prive');
select throws_ok($$insert into public.fichier_kit (produit_id, nom_fr, nom_en, format, taille_octets, ordre) values ((select k from ks_kits), 'a', 'b', 'svg', 1, 99)$$, '42501', null, 'anon n''écrit pas dans fichier_kit');
select throws_ok($$delete from public.fichier_kit$$, '42501', null, 'anon n''efface pas de fichier');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select is((select count(*)::int from public.fichier_kit), 0, 'un Compte connecté ne voit aucun fichier d''un Kit en brouillon');
select throws_ok($$select count(*) from public.fichier_kit_prive$$, '42501', null, 'un Compte connecté ne lit pas fichier_kit_prive');
select throws_ok($$update public.fichier_kit set version = 9$$, '42501', null, 'un Compte connecté n''écrit pas dans fichier_kit');
reset role;

-- Un Kit publié (posé directement : la publication d'un Kit est la story 3.2) montre ses fichiers publiables, jamais ses chemins.
select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
update public.produit set publie_le = now() - interval '1 minute' where id = (select k from ks_kits);
set local role anon;
select is((select count(*)::int from public.fichier_kit), 5, 'anon voit les fichiers d''un Kit publié');
select is(
  (select array_agg(format order by ordre) from public.fichier_kit),
  array['pdf_a4', 'pdf_letter', 'svg', 'transcription', 'stl'],
  'anon lit les formats dans l''ordre'
);
select throws_ok($$select count(*) from public.fichier_kit_prive$$, '42501', null, 'anon ne lit toujours pas fichier_kit_prive');
reset role;
update public.produit set publie_le = now() + interval '1 day' where id = (select k from ks_kits);
set local role anon;
select is((select count(*)::int from public.fichier_kit), 0, 'un Kit publié dans le futur n''expose pas ses fichiers');
reset role;
update public.produit set publie_le = null where id = (select k from ks_kits);

-- Aucune colonne de chemin lisible par anon (même garde que garde_colonnes_privees).
select is(
  (select coalesce(array_agg(c.relname || '.' || a.attname order by c.relname, a.attname), '{}')
   from pg_attribute a join pg_class c on c.oid = a.attrelid
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p', 'f') and a.attnum > 0 and not a.attisdropped
     and a.attname ~* '(prive|chemin|note_admin)' and has_column_privilege('anon', c.oid, a.attnum, 'select')),
  '{}'::text[],
  'aucune colonne prive, chemin ou note_admin n''est lisible par anon'
);

-- Suppression d'un Kit : ses fichiers le suivent ; supprimer le cosplay lié délie le Kit.
select is((select produit_lie_id from public.produit where slug = 'kit-second'), (select cos from ks_ids), 'le Kit second est lié au cosplay');
delete from public.produit where id = (select cos from ks_ids);
select is((select produit_lie_id is null from public.produit where slug = 'kit-second'), true, 'supprimer le cosplay délie son Kit');
delete from public.produit where id = (select k from ks_kits);
select is((select count(*)::int from public.fichier_kit where produit_id = (select k from ks_kits)), 0, 'les fichiers suivent leur Kit');
select is((select count(*)::int from public.fichier_kit_prive), 0, 'les chemins suivent leurs fichiers');

select * from finish();
rollback;
