-- Story 8.1 : photo_galerie, accord de publication par photo, Compte mineur refusé, retrait à la demande, désinscription sans effet
-- sur l'accord de publication. Données TEST_ annulées à la fin.
begin;
select plan(26);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'test-ph1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'test-ph2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f3', 'test-ph3@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f4', 'test-ph4@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f1', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 16);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f4', 30);
create function pg_temp.c(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;
create function pg_temp.obj(n int) returns text language sql as $$ select 'photos-clients/00000000-0000-4000-8000-' || lpad(n::text, 12, '0') || '.jpg' $$;

-- Droits.
select ok((select relrowsecurity from pg_class where oid = 'public.photo_galerie'::regclass), 'RLS active sur photo_galerie');
select ok(not has_table_privilege('anon', 'public.photo_galerie', 'select') and not has_table_privilege('authenticated', 'public.photo_galerie', 'select'), 'aucune lecture client');
select is(
  (select count(*)::int from unnest(array['public.deposer_photo_galerie(jsonb, text, text, text, text)', 'public.lister_mes_photos(uuid)', 'public.retirer_photo(jsonb, uuid)']) f
   where not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute')),
  3, 'fonctions de la photo : service seulement'
);

-- Dépôt : photo en attente, accord de publication propre à la photo, avec version et date.
create temp table ph as select public.deposer_photo_galerie(pg_temp.c('f1'), pg_temp.obj(1), '  TEST_Pseudo ', '', 'TEST_v1') as p1;
grant select on ph to public;
select is((select statut from public.photo_galerie where id = (select p1 from ph)), 'en_attente', 'photo en attente de validation');
select is((select coalesce(nom_affiche, '-') || '/' || coalesce(ville, '-') from public.photo_galerie where id = (select p1 from ph)), 'TEST_Pseudo/-', 'pseudo nettoyé, ville vide = non affichée');
select is((select objet || '/' || version || '/' || source from public.consentement where cible_id = (select p1 from ph)), 'publication_photo/TEST_v1/photo', 'accord de publication enregistré pour cette photo');
select lives_ok($$select public.deposer_photo_galerie(pg_temp.c('f1'), pg_temp.obj(2), null, 'TEST_Goma', 'TEST_v1')$$, 'une seconde photo a son propre accord');
select is((select count(*)::int from public.consentement where compte_id = '00000000-0000-0000-0000-0000000000f1' and objet = 'publication_photo'), 2, 'deux accords actifs, un par photo');
select throws_ok($$insert into public.consentement (compte_id, objet, version, source, cible_id) values ('00000000-0000-0000-0000-0000000000f1', 'publication_photo', 'TEST_v1', 'photo', (select p1 from ph))$$, '23505', null, 'un seul accord par photo');
select throws_ok($$insert into public.consentement (compte_id, objet, version, source) values ('00000000-0000-0000-0000-0000000000f1', 'publication_photo', 'TEST_v1', 'photo')$$, '23514', null, 'un accord de publication sans photo est refusé');

-- Refus.
select throws_ok($$select public.deposer_photo_galerie(pg_temp.c('f2'), pg_temp.obj(3), null, null, 'TEST_v1')$$, 'P0001', 'KS_PHOTO_MINEUR', 'Compte mineur : envoi refusé');
select throws_ok($$select public.deposer_photo_galerie(pg_temp.c('f3'), pg_temp.obj(4), null, null, 'TEST_v1')$$, 'P0001', 'KS_COMPTE_INCOMPLET', 'Compte sans âge déclaré : refusé');
select throws_ok($$select public.deposer_photo_galerie(pg_temp.c('f1'), pg_temp.obj(5), null, null, null)$$, 'P0001', 'KS_ACCORD_MANQUANT', 'sans accord : refusé');
select throws_ok($$select public.deposer_photo_galerie(pg_temp.c('f1'), pg_temp.obj(6), repeat('x', 41), null, 'TEST_v1')$$, 'P0001', 'KS_AFFICHAGE_INVALIDE', 'pseudo trop long : refusé');
select throws_ok($$select public.deposer_photo_galerie(pg_temp.c('f1'), 'envois-photos/00000000-0000-4000-8000-000000000007.jpg', null, null, 'TEST_v1')$$, '23514', null, 'seul un objet de photos-clients/ est accepté');
select is((select count(*)::int from public.photo_galerie where compte_id in ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3')), 0, 'aucune photo enregistrée après un refus');

-- Liste du Compte.
select is(jsonb_array_length(public.lister_mes_photos('00000000-0000-0000-0000-0000000000f1')), 2, 'les deux photos du Compte');
select is(jsonb_array_length(public.lister_mes_photos('00000000-0000-0000-0000-0000000000f4')), 0, 'un autre Compte ne voit rien');

-- Retrait.
select throws_ok($$select public.retirer_photo(pg_temp.c('f4'), (select p1 from ph))$$, 'P0001', 'KS_PHOTO_INTROUVABLE', 'la photo d''un autre Compte ne se retire pas');
select is(public.retirer_photo(pg_temp.c('f1'), (select p1 from ph)) ->> 'resultat', 'retiree', 'photo en attente : retirée aussitôt');
select ok((select statut = 'retiree' and retiree_le is not null from public.photo_galerie where id = (select p1 from ph)), 'statut retirée, avec sa date');
select ok((select retire_le is not null from public.consentement where cible_id = (select p1 from ph)), 'accord retiré avec la photo');
select is(public.retirer_photo(pg_temp.c('f1'), (select p1 from ph)) ->> 'resultat', 'deja_retiree', 'second retrait : déjà retirée');
-- Photo publiée (la publication arrive avec la story 8.2) : la demande est enregistrée, l'admin la retire.
update public.photo_galerie set statut = 'publiee', fichier_public = 'galerie/00000000-0000-4000-8000-000000000002.jpg', publiee_le = now(), alt_fr = 'TEST_alt fr', alt_en = 'TEST_alt en' where objet = pg_temp.obj(2);
select is(public.retirer_photo(pg_temp.c('f1'), (select id from public.photo_galerie where objet = pg_temp.obj(2))) ->> 'resultat', 'demande', 'photo publiée : retrait demandé');
select ok((select statut = 'publiee' and retrait_demande_le is not null from public.photo_galerie where objet = pg_temp.obj(2)), 'la demande est datée, la photo attend l''admin');

-- Une désinscription des emails ne retire jamais l'accord de publication.
select public.desinscrire('00000000-0000-0000-0000-0000000000f1');
select ok((select retire_le is null from public.consentement where cible_id = (select id from public.photo_galerie where objet = pg_temp.obj(2))), 'désinscription des emails : accord de publication intact');

select * from finish();
rollback;
