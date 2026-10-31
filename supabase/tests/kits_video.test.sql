-- Story 3.2 : vidéo, chapitres, sous-titres et publication d'un Kit (types MIME de kits-private, RLS, aucune lecture des tables _prive,
-- droits, famille, durée, chapitres, sous-titres, manques, garde différée, journal). Données créées dans la transaction, puis annulées.
begin;
select plan(99);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'test-video1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'test-video2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d3', 'test-video3@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000d1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000d2', 'assistant');

create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":"admin"}'::jsonb $$;
create function pg_temp.ass() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000d2","role":"admin"}'::jsonb $$;
create function pg_temp.simple() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000d3","role":"admin"}'::jsonb $$;

-- Types MIME de kits-private : exactement PDF, SVG, STL, texte et WebVTT (plus d'application/octet-stream).
select is(
  (select array(select unnest(allowed_mime_types) order by 1) from storage.buckets where id = 'kits-private'),
  array['application/pdf', 'image/svg+xml', 'model/stl', 'text/plain', 'text/vtt'],
  'kits-private accepte exactement PDF, SVG, STL, text/plain et text/vtt'
);

-- Tables : RLS active partout ; tables _prive sans politique ni droit pour anon et authenticated.
select is(
  (select count(*)::int from pg_class
   where oid in ('public.video_kit'::regclass, 'public.video_kit_prive'::regclass, 'public.chapitre_kit'::regclass,
                 'public.sous_titre_kit'::regclass, 'public.sous_titre_kit_prive'::regclass)
     and relrowsecurity),
  5,
  'RLS active sur les cinq tables'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('video_kit_prive', 'sous_titre_kit_prive')),
  0,
  'aucune politique sur video_kit_prive ni sous_titre_kit_prive'
);
select ok(
  not has_table_privilege('anon', 'public.video_kit_prive', 'select, insert, update, delete')
  and not has_table_privilege('authenticated', 'public.video_kit_prive', 'select, insert, update, delete')
  and not has_any_column_privilege('anon', 'public.video_kit_prive', 'select, insert, update')
  and not has_any_column_privilege('authenticated', 'public.video_kit_prive', 'select, insert, update')
  and not has_table_privilege('anon', 'public.sous_titre_kit_prive', 'select, insert, update, delete')
  and not has_table_privilege('authenticated', 'public.sous_titre_kit_prive', 'select, insert, update, delete')
  and not has_any_column_privilege('anon', 'public.sous_titre_kit_prive', 'select, insert, update')
  and not has_any_column_privilege('authenticated', 'public.sous_titre_kit_prive', 'select, insert, update'),
  'anon et authenticated n''ont aucun droit sur les tables _prive'
);
select ok(
  has_table_privilege('anon', 'public.video_kit', 'select') and has_table_privilege('anon', 'public.chapitre_kit', 'select')
  and has_table_privilege('anon', 'public.sous_titre_kit', 'select')
  and not has_table_privilege('anon', 'public.video_kit', 'insert, update, delete')
  and not has_table_privilege('authenticated', 'public.chapitre_kit', 'insert, update, delete')
  and not has_table_privilege('authenticated', 'public.sous_titre_kit', 'insert, update, delete'),
  'video_kit, chapitre_kit et sous_titre_kit : lecture seule pour anon et authenticated'
);
select has_column('public', 'video_kit_prive', 'bunny_video_id_prive', 'l''identifiant Bunny privé est dans video_kit_prive (nom contenant prive)');
select is(
  (select coalesce(array_agg(f order by f), '{}')
   from unnest(array[
     'public.enregistrer_video_kit(jsonb, uuid, uuid, integer)', 'public.supprimer_video_kit(jsonb, uuid)',
     'public.enregistrer_extrait_kit(jsonb, uuid, uuid)', 'public.ajouter_chapitre_kit(jsonb, uuid, text, text, integer)',
     'public.modifier_chapitre_kit(jsonb, uuid, text, text, integer)', 'public.deplacer_chapitre_kit(jsonb, uuid, text)',
     'public.supprimer_chapitre_kit(jsonb, uuid)', 'public.enregistrer_sous_titre_kit(jsonb, uuid, text, integer, text)',
     'public.supprimer_sous_titre_kit(jsonb, uuid, text)', 'public.manques_publication(uuid)'
   ]) f
   where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')
      or not has_function_privilege('service_role', f, 'execute')),
  '{}'::text[],
  'les fonctions d''écriture : service seulement'
);
select ok(
  not has_function_privilege('anon', 'public.verrouiller_kit(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.verrouiller_kit(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.verifier_chapitre_kit(uuid, text, text, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.verifier_chapitre_kit(uuid, text, text, integer)', 'execute'),
  'les fonctions internes restent fermées aux rôles publics'
);
select is(
  (select coalesce(array_agg(c.relname || '.' || a.attname order by c.relname, a.attname), '{}')
   from pg_attribute a join pg_class c on c.oid = a.attrelid
   where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'm', 'p', 'f') and a.attnum > 0 and not a.attisdropped
     and a.attname ~* '(prive|chemin|note_admin)' and has_column_privilege('anon', c.oid, a.attnum, 'select')),
  '{}'::text[],
  'aucune colonne prive, chemin ou note_admin n''est lisible par anon'
);

-- Produits de départ : K complet sauf vidéo et sous-titres, K2 minimal, C un cosplay.
select public.enregistrer_kit(pg_temp.adm(), null::uuid,
  '{"famille":"kit","slug":"video-k","titre_fr":"Kit","titre_en":"Kit en","description_fr":"D","description_en":"D en","materiel_fr":"Mousse","materiel_en":"Foam","prix_cents":990,"niveau":"debutant"}'::jsonb);
select public.enregistrer_kit(pg_temp.adm(), null::uuid, '{"famille":"kit","slug":"video-k2","titre_fr":"Vide"}'::jsonb);
select public.enregistrer_produit(pg_temp.adm(), null::uuid, '{"famille":"cosplay","slug":"video-c","titre_fr":"Cosplay"}'::jsonb, '[]'::jsonb);
create temp table ks_k as
  select (select id from public.produit where slug = 'video-k') as k,
         (select id from public.produit where slug = 'video-k2') as k2,
         (select id from public.produit where slug = 'video-c') as c;
grant select on ks_k to public;
select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into public.produit_photo (produit_id, fichier, alt_fr, alt_en, position) values ((select k from ks_k), (select k from ks_k)::text || '/a.jpg', 'Alt', 'Alt', 1);
select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_k), 'Patron', 'Pattern', 'pdf_a4', 1000, (select k from ks_k)::text || '/11111111-1111-4111-8111-111111111111.pdf');

-- Manques d'un Kit.
select is(
  public.manques_publication((select k2 from ks_k)),
  array['prix', 'photo', 'titre_en', 'description_fr', 'description_en', 'materiel_fr', 'materiel_en', 'niveau', 'fichier', 'video', 'sous_titres_fr'],
  'manques d''un Kit vide, dans l''ordre d''affichage'
);
select is(public.manques_publication((select k from ks_k)), array['video', 'sous_titres_fr'], 'Kit sans vidéo ni sous-titres FR : video, sous_titres_fr');
select throws_ok(
  $$select public.publier_produit(pg_temp.adm(), (select k from ks_k))$$,
  'P0001', 'KS_PUBLICATION_INCOMPLETE', 'publier un Kit incomplet est refusé'
);
select is((select publie_le is null from public.produit where id = (select k from ks_k)), true, 'le refus ne publie rien');
select is(
  public.manques_publication((select c from ks_k)),
  array['prix', 'photo', 'titre_en', 'description_fr', 'description_en', 'variante'],
  'manques d''un cosplay inchangés'
);

-- Vidéo complète : droits, famille, durée.
select throws_ok(
  $$select public.enregistrer_video_kit(pg_temp.ass(), (select k from ks_k), 'aaaaaaaa-0000-4000-8000-000000000001', 600)$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant n''enregistre pas de vidéo'
);
select throws_ok(
  $$select public.enregistrer_video_kit(pg_temp.simple(), (select k from ks_k), 'aaaaaaaa-0000-4000-8000-000000000001', 600)$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Compte simple n''enregistre pas de vidéo'
);
select throws_ok(
  $$select public.enregistrer_video_kit(pg_temp.adm(), (select c from ks_k), 'aaaaaaaa-0000-4000-8000-000000000001', 600)$$,
  'P0001', 'KS_FAMILLE_INVALIDE', 'une vidéo de Kit sur un cosplay est refusée'
);
select throws_ok(
  $$select public.enregistrer_video_kit(pg_temp.adm(), '00000000-0000-0000-0000-00000000ffff', 'aaaaaaaa-0000-4000-8000-000000000001', 600)$$,
  'P0001', 'KS_PRODUIT_INTROUVABLE', 'produit inconnu : refusé'
);
select throws_ok(
  $$select public.enregistrer_video_kit(pg_temp.adm(), (select k from ks_k), 'aaaaaaaa-0000-4000-8000-000000000001', 0)$$,
  'P0001', 'KS_DUREE_INVALIDE', 'une durée nulle est refusée'
);
select throws_ok(
  $$select public.ajouter_chapitre_kit(pg_temp.adm(), (select k from ks_k), 'Intro', 'Intro', 0)$$,
  'P0001', 'KS_VIDEO_ABSENTE', 'un chapitre sans vidéo est refusé'
);
select throws_ok(
  $$select public.enregistrer_extrait_kit(pg_temp.adm(), (select k from ks_k), 'bbbbbbbb-0000-4000-8000-000000000001')$$,
  'P0001', 'KS_VIDEO_ABSENTE', 'un extrait sans vidéo complète est refusé'
);
select is(
  public.enregistrer_video_kit(pg_temp.adm(), (select k from ks_k), 'aaaaaaaa-0000-4000-8000-000000000001', 600),
  null::uuid,
  'première vidéo : aucune vidéo à effacer'
);
select is((select duree_secondes from public.video_kit where produit_id = (select k from ks_k)), 600, 'la durée lue chez Bunny est enregistrée');
select is(
  (select bunny_video_id_prive from public.video_kit_prive where produit_id = (select k from ks_k)),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  'l''identifiant privé est dans video_kit_prive'
);
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'video_kit' and action = 'insert' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000d1',
  'le journal de la vidéo porte l''auteur'
);
select is(
  public.enregistrer_video_kit(pg_temp.adm(), (select k from ks_k), 'aaaaaaaa-0000-4000-8000-000000000001', 600),
  null::uuid,
  'la même vidéo enregistrée deux fois : sans effet'
);
select throws_ok(
  $$select public.enregistrer_video_kit(pg_temp.adm(), (select k2 from ks_k), 'aaaaaaaa-0000-4000-8000-000000000001', 600)$$,
  'P0001', 'KS_VIDEO_INVALIDE', 'une vidéo déjà liée à un autre Kit est refusée'
);

-- Chapitres.
select throws_ok(
  $$select public.ajouter_chapitre_kit(pg_temp.adm(), (select k from ks_k), 'Fin', 'End', 720)$$,
  'P0001', 'KS_CHAPITRE_INVALIDE', 'un chapitre à 12:00 pour une vidéo de 10:00 est refusé'
);
select throws_ok(
  $$select public.ajouter_chapitre_kit(pg_temp.adm(), (select k from ks_k), 'Fin', 'End', 600)$$,
  'P0001', 'KS_CHAPITRE_INVALIDE', 'un chapitre à la fin exacte de la vidéo est refusé'
);
select throws_ok(
  $$select public.ajouter_chapitre_kit(pg_temp.adm(), (select k from ks_k), 'Fin', 'End', -1)$$,
  'P0001', 'KS_CHAPITRE_INVALIDE', 'un début négatif est refusé'
);
select throws_ok(
  $$select public.ajouter_chapitre_kit(pg_temp.adm(), (select k from ks_k), '   ', 'End', 10)$$,
  'P0001', 'KS_TITRE_INVALIDE', 'un titre français vide est refusé'
);
select throws_ok(
  $$select public.ajouter_chapitre_kit(pg_temp.adm(), (select k from ks_k), 'Fin', repeat('x', 121), 10)$$,
  'P0001', 'KS_TITRE_INVALIDE', 'un titre anglais de 121 caractères est refusé'
);
select throws_ok(
  $$select public.ajouter_chapitre_kit(pg_temp.ass(), (select k from ks_k), 'Fin', 'End', 10)$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant n''ajoute pas de chapitre'
);
select lives_ok($$select public.ajouter_chapitre_kit(pg_temp.adm(), (select k from ks_k), ' Intro ', 'Intro', 0)$$, 'chapitre à 0:00 ajouté');
select lives_ok($$select public.ajouter_chapitre_kit(pg_temp.adm(), (select k from ks_k), 'Coupe', 'Cutting', 120)$$, 'chapitre à 2:00 ajouté');
select lives_ok($$select public.ajouter_chapitre_kit(pg_temp.adm(), (select k from ks_k), 'Finitions', 'Finishing', 599)$$, 'chapitre à 9:59 ajouté');
select is(
  (select array_agg(titre_fr || ':' || ordre order by ordre) from public.chapitre_kit where produit_id = (select k from ks_k)),
  array['Intro:1', 'Coupe:2', 'Finitions:3'],
  'les chapitres sont ajoutés en dernière position, titres rognés'
);
select throws_ok(
  $$select public.ajouter_chapitre_kit(pg_temp.adm(), (select k from ks_k), 'Double', 'Double', 120)$$,
  'P0001', 'KS_CHAPITRE_DEBUT_PRIS', 'deux chapitres ne commencent pas au même instant'
);
select lives_ok(
  $$select public.deplacer_chapitre_kit(pg_temp.adm(), (select id from public.chapitre_kit where titre_fr = 'Finitions'), 'haut')$$,
  'Monter un chapitre'
);
select is(
  (select array_agg(titre_fr order by ordre) from public.chapitre_kit where produit_id = (select k from ks_k)),
  array['Intro', 'Finitions', 'Coupe'],
  'l''ordre est libre : Finitions monte avant Coupe'
);
select lives_ok(
  $$select public.deplacer_chapitre_kit(pg_temp.adm(), (select id from public.chapitre_kit where titre_fr = 'Intro'), 'haut')$$,
  'Monter le premier chapitre : sans effet'
);
select is(
  (select array_agg(titre_fr || ':' || ordre order by ordre) from public.chapitre_kit where produit_id = (select k from ks_k)),
  array['Intro:1', 'Finitions:2', 'Coupe:3'],
  'l''ordre est inchangé en bout de liste'
);
select throws_ok(
  $$select public.deplacer_chapitre_kit(pg_temp.adm(), (select id from public.chapitre_kit where titre_fr = 'Intro'), 'gauche')$$,
  'P0001', 'KS_SENS_INVALIDE', 'un sens inconnu est refusé'
);
select lives_ok(
  $$select public.modifier_chapitre_kit(pg_temp.adm(), (select id from public.chapitre_kit where titre_fr = 'Coupe'), ' Coupe du tissu ', 'Fabric cutting', 300)$$,
  'modifier un chapitre'
);
select is(
  (select titre_fr || '/' || titre_en || '/' || debut_secondes || '/' || ordre from public.chapitre_kit where titre_en = 'Fabric cutting'),
  'Coupe du tissu/Fabric cutting/300/3',
  'titres rognés et instant modifiés, rang inchangé'
);
select throws_ok(
  $$select public.modifier_chapitre_kit(pg_temp.adm(), (select id from public.chapitre_kit where titre_en = 'Fabric cutting'), 'Coupe', 'Cutting', 0)$$,
  'P0001', 'KS_CHAPITRE_DEBUT_PRIS', 'modifier vers l''instant d''un autre chapitre est refusé'
);
select throws_ok(
  $$select public.modifier_chapitre_kit(pg_temp.adm(), '00000000-0000-0000-0000-00000000ffff', 'Coupe', 'Cutting', 10)$$,
  'P0001', 'KS_CHAPITRE_INTROUVABLE', 'modifier un chapitre inconnu est refusé'
);
select throws_ok(
  $$select public.enregistrer_video_kit(pg_temp.adm(), (select k from ks_k), 'aaaaaaaa-0000-4000-8000-000000000002', 200)$$,
  'P0001', 'KS_CHAPITRES_HORS_DUREE', 'une vidéo plus courte que les chapitres existants est refusée'
);
select is(
  (select bunny_video_id_prive from public.video_kit_prive where produit_id = (select k from ks_k)),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  'le refus ne change pas la vidéo'
);
select lives_ok(
  $$select public.supprimer_chapitre_kit(pg_temp.adm(), (select id from public.chapitre_kit where titre_fr = 'Intro'))$$,
  'supprimer un chapitre'
);
select is(
  (select array_agg(titre_fr || ':' || ordre order by ordre) from public.chapitre_kit where produit_id = (select k from ks_k)),
  array['Finitions:1', 'Coupe du tissu:2'],
  'les rangs sont renumérotés après une suppression'
);
select is(
  (select count(*)::int from public.journal_audit where cible_table = 'chapitre_kit' and action = 'delete'),
  1,
  'la suppression du chapitre est journalisée'
);

-- 50 chapitres au plus (sur K2, avec sa propre vidéo).
select public.enregistrer_video_kit(pg_temp.adm(), (select k2 from ks_k), 'aaaaaaaa-0000-4000-8000-000000000003', 100);
create function pg_temp.cinquante_chapitres() returns void language plpgsql as $$
begin
  for i in 0..49 loop
    perform public.ajouter_chapitre_kit(pg_temp.adm(), (select k2 from ks_k), 'C' || i, 'C' || i, i);
  end loop;
end $$;
select lives_ok($$select pg_temp.cinquante_chapitres()$$, '50 chapitres sont acceptés');
select is((select max(ordre) from public.chapitre_kit where produit_id = (select k2 from ks_k)), 50, 'le 50e chapitre est au rang 50');
select throws_ok(
  $$select public.ajouter_chapitre_kit(pg_temp.adm(), (select k2 from ks_k), 'C50', 'C50', 50)$$,
  'P0001', 'KS_CHAPITRES_LIMITE', 'le 51e chapitre est refusé'
);

-- Remplacer la vidéo : l'ancienne est renvoyée pour être effacée chez Bunny après la base.
select is(
  public.enregistrer_video_kit(pg_temp.adm(), (select k from ks_k), 'aaaaaaaa-0000-4000-8000-000000000002', 900),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid,
  'remplacer renvoie l''ancienne vidéo'
);
select is(
  (select v.duree_secondes || '/' || vp.bunny_video_id_prive from public.video_kit v join public.video_kit_prive vp using (produit_id) where v.produit_id = (select k from ks_k)),
  '900/aaaaaaaa-0000-4000-8000-000000000002',
  'la nouvelle vidéo et sa durée sont enregistrées'
);

-- Extrait public (facultatif).
select is(public.enregistrer_extrait_kit(pg_temp.adm(), (select k from ks_k), 'bbbbbbbb-0000-4000-8000-000000000001'), null::uuid, 'premier extrait : rien à effacer');
select is((select extrait_bunny_id from public.video_kit where produit_id = (select k from ks_k)), 'bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'l''extrait est enregistré');
select is(
  public.enregistrer_extrait_kit(pg_temp.adm(), (select k from ks_k), 'bbbbbbbb-0000-4000-8000-000000000002'),
  'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
  'remplacer l''extrait renvoie l''ancien'
);
select throws_ok(
  $$select public.enregistrer_extrait_kit(pg_temp.ass(), (select k from ks_k), null)$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne touche pas à l''extrait'
);

-- Sous-titres.
select throws_ok(
  $$select public.enregistrer_sous_titre_kit(pg_temp.adm(), (select k from ks_k), 'de', 100, (select k from ks_k)::text || '/sous-titres/22222222-2222-4222-8222-222222222222.vtt')$$,
  'P0001', 'KS_LANGUE_INVALIDE', 'une autre langue que fr ou en est refusée'
);
select throws_ok(
  $$select public.enregistrer_sous_titre_kit(pg_temp.adm(), (select k from ks_k), 'fr', 1048577, (select k from ks_k)::text || '/sous-titres/22222222-2222-4222-8222-222222222222.vtt')$$,
  'P0001', 'KS_TAILLE_FICHIER_INVALIDE', 'des sous-titres de plus de 1 Mo sont refusés'
);
select throws_ok(
  $$select public.enregistrer_sous_titre_kit(pg_temp.adm(), (select k from ks_k), 'fr', 100, (select k2 from ks_k)::text || '/sous-titres/22222222-2222-4222-8222-222222222222.vtt')$$,
  'P0001', 'KS_CHEMIN_INVALIDE', 'un chemin d''un autre Kit est refusé'
);
select throws_ok(
  $$select public.enregistrer_sous_titre_kit(pg_temp.adm(), (select k from ks_k), 'fr', 100, (select k from ks_k)::text || '/sous-titres/22222222-2222-4222-8222-222222222222.txt')$$,
  'P0001', 'KS_CHEMIN_INVALIDE', 'un chemin sans extension .vtt est refusé'
);
select throws_ok(
  $$select public.enregistrer_sous_titre_kit(pg_temp.adm(), (select c from ks_k), 'fr', 100, (select c from ks_k)::text || '/sous-titres/22222222-2222-4222-8222-222222222222.vtt')$$,
  'P0001', 'KS_FAMILLE_INVALIDE', 'des sous-titres sur un cosplay sont refusés'
);
select throws_ok(
  $$select public.enregistrer_sous_titre_kit(pg_temp.ass(), (select k from ks_k), 'fr', 100, (select k from ks_k)::text || '/sous-titres/22222222-2222-4222-8222-222222222222.vtt')$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant n''enregistre pas de sous-titres'
);
select is(
  public.enregistrer_sous_titre_kit(pg_temp.adm(), (select k from ks_k), 'fr', 100, (select k from ks_k)::text || '/sous-titres/22222222-2222-4222-8222-222222222222.vtt'),
  null::text,
  'premiers sous-titres français : aucun ancien chemin'
);
select is((select version from public.sous_titre_kit where produit_id = (select k from ks_k) and langue = 'fr'), 1, 'la version démarre à 1');
select is(
  (select sp.chemin_stockage from public.sous_titre_kit s join public.sous_titre_kit_prive sp on sp.sous_titre_id = s.id where s.produit_id = (select k from ks_k)),
  (select k from ks_k)::text || '/sous-titres/22222222-2222-4222-8222-222222222222.vtt',
  'le chemin est dans la table privée'
);
select is(
  public.enregistrer_sous_titre_kit(pg_temp.adm(), (select k from ks_k), 'fr', 200, (select k from ks_k)::text || '/sous-titres/33333333-3333-4333-8333-333333333333.vtt'),
  (select k from ks_k)::text || '/sous-titres/22222222-2222-4222-8222-222222222222.vtt',
  'remplacer renvoie l''ancien chemin'
);
select is(
  (select version || '/' || taille_octets from public.sous_titre_kit where produit_id = (select k from ks_k) and langue = 'fr'),
  '2/200',
  'remplacer augmente la version et met la taille à jour'
);
select throws_ok(
  $$select public.enregistrer_sous_titre_kit(pg_temp.adm(), (select k from ks_k), 'fr', 200, (select k from ks_k)::text || '/sous-titres/33333333-3333-4333-8333-333333333333.vtt')$$,
  'P0001', 'KS_CHEMIN_INVALIDE', 'remplacer par le chemin courant est refusé'
);

-- Story 3.3 : l'extrait (parlé par défaut) demande ses sous-titres français, déposés ici.
select is(public.manques_publication((select k from ks_k)), array['sous_titres_extrait_fr'], 'extrait parlé sans sous-titres français : manque (story 3.3)');
select lives_ok($$select public.enregistrer_sous_titres_extrait_kit(pg_temp.adm(), (select k from ks_k), 'fr')$$, 'sous-titres français de l''extrait enregistrés');

-- Publication : sans sous-titres anglais ni extrait obligatoire, le Kit complet est publiable.
select is(public.manques_publication((select k from ks_k)), '{}'::text[], 'Kit complet : rien ne manque (anglais facultatif)');
select lives_ok($$select public.publier_produit(pg_temp.adm(), (select k from ks_k))$$, 'le Kit complet est publié');
select is((select publie_le is not null from public.produit where id = (select k from ks_k)), true, 'publie_le est posé');

-- Un Kit publié reste complet (garde différée).
create function pg_temp.essai_dernier_fichier() returns void language plpgsql as $$
begin
  perform public.supprimer_fichier_kit(pg_temp.adm(), (select id from public.fichier_kit where produit_id = (select k from ks_k)));
  set constraints all immediate;
end $$;
create function pg_temp.essai_video() returns void language plpgsql as $$
begin
  perform public.supprimer_video_kit(pg_temp.adm(), (select k from ks_k));
  set constraints all immediate;
end $$;
create function pg_temp.essai_sous_titres_fr() returns void language plpgsql as $$
begin
  perform public.supprimer_sous_titre_kit(pg_temp.adm(), (select k from ks_k), 'fr');
  set constraints all immediate;
end $$;
select throws_ok($$select pg_temp.essai_dernier_fichier()$$, 'P0001', 'KS_PUBLICATION_INCOMPLETE', 'un Kit publié ne perd pas son dernier fichier');
select throws_ok($$select pg_temp.essai_video()$$, 'P0001', 'KS_PUBLICATION_INCOMPLETE', 'un Kit publié ne perd pas sa vidéo');
select throws_ok($$select pg_temp.essai_sous_titres_fr()$$, 'P0001', 'KS_PUBLICATION_INCOMPLETE', 'un Kit publié ne perd pas ses sous-titres français');
select lives_ok(
  $$select public.enregistrer_sous_titre_kit(pg_temp.adm(), (select k from ks_k), 'en', 100, (select k from ks_k)::text || '/sous-titres/44444444-4444-4444-8444-444444444444.vtt')$$,
  'sous-titres anglais ajoutés'
);
select is(
  public.supprimer_sous_titre_kit(pg_temp.adm(), (select k from ks_k), 'en'),
  (select k from ks_k)::text || '/sous-titres/44444444-4444-4444-8444-444444444444.vtt',
  'les sous-titres anglais d''un Kit publié se suppriment ; le chemin est renvoyé'
);
select throws_ok(
  $$select public.supprimer_sous_titre_kit(pg_temp.adm(), (select k from ks_k), 'en')$$,
  'P0001', 'KS_SOUS_TITRES_INTROUVABLES', 'supprimer deux fois est refusé'
);

-- Lecture publique : données publiables d'un Kit publié seulement ; jamais les tables _prive.
set local role anon;
select is((select count(*)::int from public.video_kit), 1, 'anon voit la vidéo du Kit publié, pas celle du brouillon');
select throws_ok($$select count(*) from public.video_kit_prive$$, '42501', null, 'anon ne lit pas video_kit_prive');
select throws_ok($$select chemin_stockage from public.sous_titre_kit_prive$$, '42501', null, 'anon ne lit pas sous_titre_kit_prive');
select is((select count(*)::int from public.chapitre_kit), 2, 'anon voit les chapitres du Kit publié seulement');
select is((select array_agg(langue) from public.sous_titre_kit), array['fr'], 'anon voit les langues de sous-titres du Kit publié');
select throws_ok($$insert into public.chapitre_kit (produit_id, titre_fr, titre_en, debut_secondes, ordre) values ((select k from ks_k), 'a', 'b', 5, 9)$$, '42501', null, 'anon n''écrit pas de chapitre');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d3","role":"authenticated"}';
select throws_ok($$select bunny_video_id_prive from public.video_kit_prive$$, '42501', null, 'un Compte connecté ne lit pas video_kit_prive');
select throws_ok($$update public.video_kit set duree_secondes = 1$$, '42501', null, 'un Compte connecté n''écrit pas dans video_kit');
reset role;

-- « Publié et passé » : un Kit publié dans le futur n'expose ni sa vidéo, ni ses chapitres, ni ses sous-titres.
select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
update public.produit set publie_le = now() + interval '1 day' where id = (select k from ks_k);
set local role anon;
select is((select count(*)::int from public.video_kit), 0, 'un Kit publié dans le futur n''expose pas sa vidéo');
select is((select count(*)::int from public.chapitre_kit), 0, 'un Kit publié dans le futur n''expose pas ses chapitres');
select is((select count(*)::int from public.sous_titre_kit), 0, 'un Kit publié dans le futur n''expose pas ses sous-titres');
reset role;

-- Retirer la vidéo d'un brouillon : identifiants renvoyés pour Bunny, ligne privée effacée, chapitres conservés ; supprimer le Kit emporte tout.
select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
select is(
  public.supprimer_video_kit(pg_temp.adm(), (select k2 from ks_k)),
  '{"prive": "aaaaaaaa-0000-4000-8000-000000000003", "extrait": null}'::jsonb,
  'retirer la vidéo renvoie les identifiants à effacer chez Bunny'
);
select is(
  (select count(*)::int from public.video_kit_prive where produit_id = (select k2 from ks_k)),
  0,
  'la ligne privée suit la vidéo'
);
select is((select count(*)::int from public.chapitre_kit where produit_id = (select k2 from ks_k)), 50, 'les chapitres restent après le retrait de la vidéo');
delete from public.produit where id = (select k2 from ks_k);
select is((select count(*)::int from public.chapitre_kit where produit_id = (select k2 from ks_k)), 0, 'les chapitres suivent leur Kit');

select * from finish();
rollback;
