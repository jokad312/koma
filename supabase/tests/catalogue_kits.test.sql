-- Story 3.3 : catalogue Kits (lister_catalogue avec p_niveau, famille kit, famille inconnue refusée) et sous-titres de l'extrait public
-- (colonnes, droits, fonctions, manques_publication, garde différée, extrait remplacé). Données créées dans la transaction, puis annulées.
begin;
select plan(50);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-ck1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-ck2@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e2', 'assistant');

create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb $$;
create function pg_temp.ass() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000e2","role":"admin"}'::jsonb $$;

-- Colonnes et droits.
select has_column('public', 'video_kit', 'extrait_sans_parole', 'video_kit.extrait_sans_parole existe');
select has_column('public', 'video_kit', 'extrait_sous_titres', 'video_kit.extrait_sous_titres existe');
select has_column('public', 'video_kit', 'extrait_le', 'video_kit.extrait_le existe');
select is(
  (select column_default from information_schema.columns where table_schema = 'public' and table_name = 'video_kit' and column_name = 'extrait_sans_parole'),
  'false',
  'extrait_sans_parole est décochée par défaut'
);
select is(
  (select coalesce(array_agg(f order by f), '{}')
   from unnest(array[
     'public.enregistrer_sous_titres_extrait_kit(jsonb, uuid, text)', 'public.supprimer_sous_titres_extrait_kit(jsonb, uuid, text)',
     'public.definir_extrait_sans_parole(jsonb, uuid, boolean)', 'public.manques_publication(uuid)'
   ]) f
   where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')
      or not has_function_privilege('service_role', f, 'execute')),
  '{}'::text[],
  'les fonctions des sous-titres d''extrait : service seulement'
);
select ok(
  not has_function_privilege('anon', 'public.video_kit_extrait_change()', 'execute')
  and not has_function_privilege('authenticated', 'public.video_kit_extrait_change()', 'execute'),
  'la fonction du déclencheur reste fermée aux rôles publics'
);
select ok(
  has_function_privilege('anon', 'public.lister_catalogue(text, text, uuid, integer, integer, text, text, timestamptz, integer, uuid, integer, text)', 'execute')
  and has_function_privilege('authenticated', 'public.lister_catalogue(text, text, uuid, integer, integer, text, text, timestamptz, integer, uuid, integer, text)', 'execute'),
  'anon et authenticated exécutent la nouvelle lister_catalogue'
);
select is(
  (select count(*)::int from pg_proc where proname = 'lister_catalogue' and pronamespace = 'public'::regnamespace),
  1,
  'une seule lister_catalogue (l''ancienne signature est supprimée)'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where proname = 'lister_catalogue' and pronamespace = 'public'::regnamespace),
  'lister_catalogue reste security definer, search_path vide'
);

-- Sous-titres de l'extrait : un Kit complet (photo, fichier, vidéo, sous-titres FR de la vidéo complète).
select public.enregistrer_kit(pg_temp.adm(), null::uuid,
  '{"famille":"kit","slug":"ck-extrait","titre_fr":"Kit","titre_en":"Kit en","description_fr":"D","description_en":"D en","materiel_fr":"Mousse","materiel_en":"Foam","prix_cents":990,"niveau":"debutant"}'::jsonb);
create temp table ks_ck as select (select id from public.produit where slug = 'ck-extrait') as k;
grant select on ks_ck to public;
select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into public.produit_photo (produit_id, fichier, alt_fr, alt_en, position) values ((select k from ks_ck), (select k from ks_ck)::text || '/a.jpg', 'Alt', 'Alt', 1);
select public.ajouter_fichier_kit(pg_temp.adm(), (select k from ks_ck), 'Patron', 'Pattern', 'pdf_a4', 1000, (select k from ks_ck)::text || '/11111111-1111-4111-8111-111111111111.pdf');

select throws_ok(
  $$select public.definir_extrait_sans_parole(pg_temp.adm(), (select k from ks_ck), true)$$,
  'P0001', 'KS_VIDEO_ABSENTE', 'la case sans parole demande une vidéo'
);
select public.enregistrer_video_kit(pg_temp.adm(), (select k from ks_ck), 'cccccccc-0000-4000-8000-000000000001', 600);
select public.enregistrer_sous_titre_kit(pg_temp.adm(), (select k from ks_ck), 'fr', 100, (select k from ks_ck)::text || '/sous-titres/22222222-2222-4222-8222-222222222222.vtt');
select is(public.manques_publication((select k from ks_ck)), '{}'::text[], 'sans extrait : aucun sous-titre d''extrait exigé');
select throws_ok(
  $$select public.enregistrer_sous_titres_extrait_kit(pg_temp.adm(), (select k from ks_ck), 'fr')$$,
  'P0001', 'KS_EXTRAIT_ABSENT', 'des sous-titres d''extrait sans extrait sont refusés'
);

select public.enregistrer_extrait_kit(pg_temp.adm(), (select k from ks_ck), 'dddddddd-0000-4000-8000-000000000001');
select ok((select extrait_le is not null and extrait_sous_titres = '{}' from public.video_kit where produit_id = (select k from ks_ck)), 'extrait_le est posé à l''enregistrement de l''extrait');
select is(public.manques_publication((select k from ks_ck)), array['sous_titres_extrait_fr'], 'extrait parlé sans FR : manque sous_titres_extrait_fr');
select throws_ok(
  $$select public.publier_produit(pg_temp.adm(), (select k from ks_ck))$$,
  'P0001', 'KS_PUBLICATION_INCOMPLETE', 'publier un Kit dont l''extrait parlé n''a pas de FR est refusé'
);
select lives_ok($$select public.definir_extrait_sans_parole(pg_temp.adm(), (select k from ks_ck), true)$$, 'case « Extrait sans parole » cochée');
select is(public.manques_publication((select k from ks_ck)), '{}'::text[], 'extrait sans parole : publiable sans sous-titres d''extrait');
select lives_ok($$select public.definir_extrait_sans_parole(pg_temp.adm(), (select k from ks_ck), false)$$, 'case décochée');

select throws_ok(
  $$select public.enregistrer_sous_titres_extrait_kit(pg_temp.ass(), (select k from ks_ck), 'fr')$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant n''enregistre pas de sous-titres d''extrait'
);
select throws_ok(
  $$select public.enregistrer_sous_titres_extrait_kit(pg_temp.adm(), (select k from ks_ck), 'de')$$,
  'P0001', 'KS_LANGUE_INVALIDE', 'une autre langue que fr ou en est refusée'
);
select public.enregistrer_sous_titres_extrait_kit(pg_temp.adm(), (select k from ks_ck), 'en');
select public.enregistrer_sous_titres_extrait_kit(pg_temp.adm(), (select k from ks_ck), 'fr');
select public.enregistrer_sous_titres_extrait_kit(pg_temp.adm(), (select k from ks_ck), 'fr');
select is((select extrait_sous_titres from public.video_kit where produit_id = (select k from ks_ck)), array['fr', 'en'], 'langues enregistrées une seule fois, fr puis en');
select is(public.manques_publication((select k from ks_ck)), '{}'::text[], 'extrait parlé avec FR : rien ne manque');
select lives_ok($$select public.publier_produit(pg_temp.adm(), (select k from ks_ck))$$, 'le Kit est publié');

select lives_ok($$select public.supprimer_sous_titres_extrait_kit(pg_temp.adm(), (select k from ks_ck), 'en')$$, 'les sous-titres EN de l''extrait se suppriment');
select throws_ok(
  $$select public.supprimer_sous_titres_extrait_kit(pg_temp.adm(), (select k from ks_ck), 'en')$$,
  'P0001', 'KS_SOUS_TITRES_INTROUVABLES', 'supprimer deux fois est refusé'
);

-- Lecture publique des colonnes de l'extrait (Kit publié).
set local role anon;
select is(
  (select extrait_sous_titres from public.video_kit where produit_id = (select k from ks_ck)),
  array['fr'],
  'anon lit les langues de sous-titres de l''extrait'
);
reset role;

-- Garde différée (amendement de la revue 1) : sous_titres_extrait_fr n'est pas compté sur un Kit publié. Chaque essai force la garde.
create function pg_temp.essai_sans_fr() returns void language plpgsql as $$
begin
  perform public.supprimer_sous_titres_extrait_kit(pg_temp.adm(), (select k from ks_ck), 'fr');
  set constraints all immediate;
end $$;
create function pg_temp.essai_extrait(p_extrait uuid) returns void language plpgsql as $$
begin
  perform public.enregistrer_extrait_kit(pg_temp.adm(), (select k from ks_ck), p_extrait);
  set constraints all immediate;
end $$;
select lives_ok($$select pg_temp.essai_sans_fr()$$, 'Kit publié : retirer le FR de l''extrait parlé est permis (la fiche cache alors l''extrait)');
select lives_ok($$select pg_temp.essai_extrait(null)$$, 'Kit publié : retirer l''extrait est permis');
select ok((select extrait_le is null and extrait_sous_titres = '{}' from public.video_kit where produit_id = (select k from ks_ck)), 'retirer l''extrait efface extrait_le');
select lives_ok($$select pg_temp.essai_extrait('dddddddd-0000-4000-8000-000000000002')$$, 'Kit publié : ajouter un extrait parlé sans FR est permis');
select lives_ok($$select public.definir_extrait_sans_parole(pg_temp.adm(), (select k from ks_ck), true)$$, 'extrait marqué sans parole');
select public.enregistrer_sous_titres_extrait_kit(pg_temp.adm(), (select k from ks_ck), 'fr');
select lives_ok($$select pg_temp.essai_extrait('dddddddd-0000-4000-8000-000000000003')$$, 'Kit publié : remplacer l''extrait est permis');
select ok(
  (select extrait_sous_titres = '{}' and not extrait_sans_parole and extrait_le is not null from public.video_kit where produit_id = (select k from ks_ck)),
  'remplacer l''extrait vide ses sous-titres et remet « sans parole » à faux'
);
select ok((select publie_le is not null from public.produit where id = (select k from ks_ck)), 'le Kit reste publié');
select is(public.manques_publication((select k from ks_ck)), array['sous_titres_extrait_fr'], 'le manque reste signalé (publier_produit l''exige)');
-- Les essais ci-dessus ont forcé « set constraints all immediate » pour le reste de la transaction : on revient au mode différé.
set constraints all deferred;

-- Le Kit dépublié, la publication reste refusée tant que l'extrait parlé n'a pas de FR.
select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
update public.produit set publie_le = null where id = (select k from ks_ck);
select throws_ok(
  $$select public.publier_produit(pg_temp.adm(), (select k from ks_ck))$$,
  'P0001', 'KS_PUBLICATION_INCOMPLETE', 'republier avec un extrait parlé sans FR reste refusé'
);
select public.enregistrer_extrait_kit(pg_temp.adm(), (select k from ks_ck), null);

-- Catalogue Kits (après les essais de garde différée : les Kits insérés ici, incomplets, ne sont jamais contrôlés avant l'annulation).
-- Catalogue Kits : 13 Kits publiés (5 débutant, 4 intermédiaire, 4 avancé), un brouillon, un sans photo.
select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le)
select 'kit', 'ck-kit-' || lpad(n::text, 2, '0'), 'Kit ' || n, 'Kit en ' || n, 500 + n * 100,
  case when n <= 5 then 'debutant' when n <= 9 then 'intermediaire' else 'avance' end,
  now() - (n || ' minutes')::interval
from generate_series(1, 13) as n;
insert into public.produit (famille, slug, titre_fr, prix_cents, niveau, publie_le) values
  ('kit', 'ck-brouillon', 'Brouillon', 900, 'debutant', null),
  ('kit', 'ck-sans-photo', 'Sans photo', 900, 'debutant', now() - interval '1 minute');
insert into public.produit_photo (produit_id, fichier, alt_fr, alt_en, position)
select p.id, p.id::text || '/a.jpg', 'Alt ' || p.slug, 'Alt en ' || p.slug, 1 from public.produit p where p.slug like 'ck-%' and p.slug not in ('ck-sans-photo', 'ck-extrait');

select throws_ok(
  $$select * from public.lister_catalogue('inconnue', 'fr')$$,
  'P0001', 'KS_FAMILLE_INVALIDE', 'une famille inconnue est refusée'
);
select throws_ok(
  $$select * from public.lister_catalogue(null, 'fr')$$,
  'P0001', 'KS_FAMILLE_INVALIDE', 'une famille nulle est refusée'
);
select is(
  (select count(*)::int from public.lister_catalogue('kit', 'fr', null, null, null, null, 'nouveautes', null, null, null, 13) where slug like 'ck-%'),
  13,
  'les 13 Kits publiés avec photo sont listés (13 lus pour une page de 12)'
);
select is(
  (select count(*)::int from public.lister_catalogue('kit', 'fr', null, null, null, null, 'nouveautes', null, null, null, 300) where slug in ('ck-brouillon', 'ck-sans-photo')),
  0,
  'ni brouillon ni Kit sans photo'
);
select is(
  (select array_agg(distinct disponibilite) from public.lister_catalogue('kit', 'fr', null, null, null, null, 'nouveautes', null, null, null, 300) where slug like 'ck-%'),
  array['disponible'],
  'un Kit est toujours « disponible » (aucune variante)'
);
select is(
  (select count(*)::int from public.lister_catalogue('kit', 'fr', null, null, null, 'en_stock', 'nouveautes', null, null, null, 300) where slug like 'ck-%'),
  13,
  'le filtre de disponibilité est sans effet sur les Kits'
);
select is(
  (select count(*)::int from public.lister_catalogue('kit', 'fr', null, null, null, null, 'nouveautes', null, null, null, 300, 'debutant') where slug like 'ck-%'),
  5,
  'filtre niveau débutant : 5 Kits'
);
select is(
  (select array_agg(distinct niveau) from public.lister_catalogue('kit', 'fr', null, null, null, null, 'nouveautes', null, null, null, 300, 'avance') where slug like 'ck-%'),
  array['avance'],
  'filtre niveau avancé : seulement des Kits avancés'
);
select is(
  (select niveau from public.lister_catalogue('kit', 'en', null, null, null, null, 'nouveautes', null, null, null, 300) where slug = 'ck-kit-07'),
  'intermediaire',
  'la colonne niveau est renvoyée'
);
select is(
  (select titre from public.lister_catalogue('kit', 'en', null, null, null, null, 'nouveautes', null, null, null, 300) where slug = 'ck-kit-07'),
  'Kit en 7',
  'titre dans la langue demandée'
);
select is(
  (select count(*)::int from public.lister_catalogue('kit', 'fr', null, 900, 1200, null, 'nouveautes', null, null, null, 300, 'debutant') where slug like 'ck-%'),
  2,
  'niveau et tranche de prix se combinent'
);
select is(
  (select array_agg(slug order by ord) from (
     select slug, row_number() over () as ord
     from public.lister_catalogue('kit', 'fr', null, null, null, null, 'prix_desc', null, null, null, 3) where slug like 'ck-%') x),
  array['ck-kit-13', 'ck-kit-12', 'ck-kit-11'],
  'tri par prix décroissant'
);
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 300) where slug like 'ck-%'),
  0,
  'les Kits ne sont pas listés parmi les cosplays'
);
set local role anon;
select is(
  (select count(*)::int from public.lister_catalogue('kit', 'fr', null, null, null, null, 'nouveautes', null, null, null, 300, 'intermediaire') where slug like 'ck-%'),
  4,
  'anon : filtre niveau intermédiaire, 4 Kits'
);
reset role;

select * from finish();
rollback;
