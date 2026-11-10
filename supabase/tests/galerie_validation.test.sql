-- Story 8.2 : validation, refus, retrait par le personnel, dépôt WhatsApp (majorité et accord obligatoires, Compte mineur refusé),
-- compteurs des tâches, droits (Admin et Assistant seulement). Données TEST_ annulées à la fin.
begin;
select plan(33);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-gv-client@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-gv-mineur@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-gv-admin@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a4', 'test-gv-assistant@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a2', 15);
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a3', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a4', 'assistant');
create function pg_temp.c(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;
create function pg_temp.obj(n int) returns text language sql as $$ select 'photos-clients/00000000-0000-4000-8000-' || lpad(n::text, 12, '0') || '.jpg' $$;
create function pg_temp.pub(n int) returns text language sql as $$ select 'galerie/00000000-0000-4000-8000-' || lpad(n::text, 12, '0') || '.jpg' $$;

-- Droits.
select is(
  (select count(*)::int from unnest(array[
    'public.trouver_compte_par_email(jsonb, text)', 'public.lister_photos_admin(jsonb)', 'public.compter_photos_a_traiter()', 'public.valider_photo(jsonb, uuid, text, text, text)',
    'public.refuser_photo(jsonb, uuid)', 'public.retirer_photo_admin(jsonb, uuid)', 'public.deposer_photo_whatsapp(jsonb, text, uuid, text, text, date, boolean, text, text)'
  ]) f where not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute')),
  7, 'fonctions de la galerie : service seulement'
);
select ok(exists (select 1 from storage.buckets where id = 'accords-whatsapp' and not public), 'bucket accords-whatsapp privé');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and (qual like '%accords-whatsapp%' or with_check like '%accords-whatsapp%')), 0, 'aucune politique sur accords-whatsapp');
select throws_ok($$select public.lister_photos_admin(pg_temp.c('a1'))$$, 'P0001', 'KS_DROIT_REFUSE', 'un client ne lit pas la file');
select lives_ok($$select public.lister_photos_admin(pg_temp.c('a4'))$$, 'l''Assistant lit la file (galerie.valider)');

-- Deux photos envoyées par le client.
create temp table ph as select
  public.deposer_photo_galerie(pg_temp.c('a1'), pg_temp.obj(1), 'TEST_Pseudo', null, 'TEST_v1') as p1,
  public.deposer_photo_galerie(pg_temp.c('a1'), pg_temp.obj(2), null, null, 'TEST_v1') as p2;
grant select on ph to public;
select is(public.compter_photos_a_traiter(), '{"a_valider": 2, "realisations": 0, "retraits": 0}'::jsonb, 'tâche : deux photos à valider');
select is(jsonb_array_length(public.lister_photos_admin(pg_temp.c('a3'))), 2, 'la file liste les deux photos');

-- Validation.
select throws_ok($$select public.valider_photo(pg_temp.c('a1'), (select p1 from ph), pg_temp.pub(1), 'TEST_alt fr', 'TEST_alt en')$$, 'P0001', 'KS_DROIT_REFUSE', 'un client ne valide pas');
select lives_ok($$select public.valider_photo(pg_temp.c('a4'), (select p1 from ph), pg_temp.pub(1), 'TEST_alt fr', 'TEST_alt en')$$, 'l''Assistant valide');
select ok((select statut = 'publiee' and fichier_public = pg_temp.pub(1) and publiee_le is not null and decide_par ->> 'id' = '00000000-0000-0000-0000-0000000000a4' from public.photo_galerie where id = (select p1 from ph)), 'publiée, avec sa copie publique et son auteur');
select ok(exists (select 1 from public.journal_audit where cible_table = 'photo_galerie' and cible_id = (select p1 from ph)::text and auteur ->> 'id' = '00000000-0000-0000-0000-0000000000a4'), 'validation journalisée');
select throws_ok($$select public.valider_photo(pg_temp.c('a3'), (select p1 from ph), pg_temp.pub(9), 'TEST_alt fr', 'TEST_alt en')$$, 'P0001', 'KS_PHOTO_DEJA_TRAITEE', 'une photo déjà publiée ne se valide pas deux fois');

-- Refus.
select is(public.refuser_photo(pg_temp.c('a3'), (select p2 from ph)), pg_temp.obj(2), 'refus : renvoie l''original à effacer');
select ok((select statut = 'refusee' and refusee_le is not null and fichier_public is null from public.photo_galerie where id = (select p2 from ph)), 'refusée, jamais publiée');
select ok((select retire_le is not null from public.consentement where cible_id = (select p2 from ph)), 'accord retiré au refus');
select is(public.retirer_photo(pg_temp.c('a1'), (select p2 from ph)) ->> 'resultat', 'deja_retiree', 'le client ne peut plus demander de retrait d''une photo refusée');

-- Retrait demandé par le client puis retrait par le personnel.
select is(public.retirer_photo(pg_temp.c('a1'), (select p1 from ph)) ->> 'resultat', 'demande', 'le client demande le retrait de sa photo publiée');
select is(public.compter_photos_a_traiter(), '{"a_valider": 0, "realisations": 0, "retraits": 1}'::jsonb, 'tâche : un retrait demandé');
select is(public.retirer_photo_admin(pg_temp.c('a3'), (select p1 from ph)) ->> 'fichier_public', pg_temp.pub(1), 'retrait : renvoie la copie publique à effacer');
select ok((select statut = 'retiree' and fichier_public is null and retiree_le is not null from public.photo_galerie where id = (select p1 from ph)), 'retirée du mur aussitôt');
select throws_ok($$select public.retirer_photo_admin(pg_temp.c('a3'), (select p1 from ph))$$, 'P0001', 'KS_PHOTO_NON_PUBLIEE', 'une photo retirée ne se retire pas deux fois');

-- Dépôt WhatsApp.
select is(public.trouver_compte_par_email(pg_temp.c('a3'), ' TEST-GV-CLIENT@example.invalid '), '00000000-0000-0000-0000-0000000000a1'::uuid, 'Compte retrouvé par son email, sans distinction de casse');
select throws_ok($$select public.deposer_photo_whatsapp(pg_temp.c('a3'), pg_temp.obj(3), null, 'TEST_Ami', null, current_date, false, null, 'TEST_v1')$$, 'P0001', 'KS_MAJORITE_NON_CONFIRMEE', 'majorité non confirmée : refusé');
select throws_ok($$select public.deposer_photo_whatsapp(pg_temp.c('a3'), pg_temp.obj(3), null, 'TEST_Ami', null, current_date + 1, true, null, 'TEST_v1')$$, 'P0001', 'KS_ACCORD_MANQUANT', 'accord daté dans le futur : refusé');
select throws_ok($$select public.deposer_photo_whatsapp(pg_temp.c('a3'), pg_temp.obj(3), '00000000-0000-0000-0000-0000000000a2', null, null, current_date, true, null, 'TEST_v1')$$, 'P0001', 'KS_PHOTO_MINEUR', 'Compte rattaché mineur : refusé');
select throws_ok($$select public.deposer_photo_whatsapp(pg_temp.c('a3'), pg_temp.obj(3), null, null, null, current_date, true, null, 'TEST_v1')$$, 'P0001', 'KS_AFFICHAGE_INVALIDE', 'sans Compte, le pseudo est obligatoire');
create temp table wa as select public.deposer_photo_whatsapp(pg_temp.c('a4'), pg_temp.obj(4), null, 'TEST_Ami', 'TEST_Goma', current_date - 2, true, '00000000-0000-4000-8000-0000000000cc.jpg', 'TEST_v1') as id;
grant select on wa to public;
select ok((select source = 'whatsapp' and statut = 'en_attente' and compte_id is null and accord_whatsapp_le = current_date - 2 and majeur_confirme_le is not null and capture_accord is not null
  from public.photo_galerie where id = (select id from wa)), 'photo WhatsApp sans Compte : en attente, accord daté, majorité confirmée, capture');
select ok((select compte_id is null and source = 'whatsapp' and donne_le::date = current_date - 2 from public.consentement where cible_id = (select id from wa)), 'accord de publication WhatsApp enregistré à sa date');
select throws_ok($$insert into public.consentement (objet, version, source) values ('relances', 'TEST_v1', 'preferences')$$, '23514', null, 'un consentement aux emails exige un Compte');

-- Un Compte qui déclare moins de 18 ans pendant que sa photo attend : jamais publiée.
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000a5', 'test-gv-tardif@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a5', 30);
create temp table tard as select public.deposer_photo_galerie(pg_temp.c('a5'), pg_temp.obj(5), null, null, 'TEST_v1') as id;
grant select on tard to public;
update public.profil set age_declare = 15 where id = '00000000-0000-0000-0000-0000000000a5';
select throws_ok($$select public.valider_photo(pg_temp.c('a3'), (select id from tard), pg_temp.pub(5), 'TEST_alt fr', 'TEST_alt en')$$, 'P0001', 'KS_PHOTO_MINEUR', 'Compte devenu mineur : validation refusée');
select is((select statut from public.photo_galerie where id = (select id from tard)), 'en_attente', 'la photo reste en attente, jamais publiée');
select throws_ok($$select public.trouver_compte_par_email(pg_temp.c('a1'), 'test-gv-client@example.invalid')$$, 'P0001', 'KS_DROIT_REFUSE', 'un client ne cherche pas de Compte par email');
select throws_ok($$select public.deposer_photo_whatsapp(pg_temp.c('a3'), pg_temp.obj(6), null, 'TEST_Ami', null, current_date - 400, true, null, 'TEST_v1')$$, 'P0001', 'KS_ACCORD_MANQUANT', 'accord de plus d''un an : refusé');

select * from finish();
rollback;
