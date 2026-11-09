-- Story 8.4 : Réalisations. Kit payé exigé (un Kit gratuit ne compte pas), preuve d'achat, rang fixé à la validation, journal, file du personnel.
-- Données TEST_ annulées à la fin.
begin;
select plan(18);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'test-re1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', 'test-re2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b3', 'test-re-admin@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b1', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b2', 25);
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b3', 'admin');
create function pg_temp.c(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;
create function pg_temp.obj(n int) returns text language sql as $$ select 'photos-clients/00000000-0000-4000-8000-' || lpad(n::text, 12, '0') || '.jpg' $$;
create function pg_temp.pub(n int) returns text language sql as $$ select 'galerie/00000000-0000-4000-8000-' || lpad(n::text, 12, '0') || '.jpg' $$;

-- Deux Kits : l'un payé par b1 (Commande avec paye_le), l'autre obtenu gratuitement (Commande offerte, sans paye_le).
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 're-kit-paye', 'TEST_Kit payé', 'TEST_Paid kit', 990, 'debutant', now()),
  ('kit', 're-kit-gratuit', 'TEST_Kit gratuit', null, 0, 'debutant', now());
insert into public.commande (numero, compte_id, type, statut, sous_total_cents, total_cents, paye_le) values
  ('KS-2026-870001', '00000000-0000-0000-0000-0000000000b1', 'produits', 'payee', 990, 990, now() - interval '2 days');
insert into public.commande (numero, compte_id, type, statut, offerte, sous_total_cents, total_cents) values
  ('KS-2026-870002', '00000000-0000-0000-0000-0000000000b1', 'produits', 'offerte', true, 0, 0);
insert into public.acces_kit (compte_id, produit_id, commande_origine) values
  ('00000000-0000-0000-0000-0000000000b1', (select id from public.produit where slug = 're-kit-paye'), (select id from public.commande where numero = 'KS-2026-870001')),
  ('00000000-0000-0000-0000-0000000000b1', (select id from public.produit where slug = 're-kit-gratuit'), (select id from public.commande where numero = 'KS-2026-870002'));
create temp table k as select (select id from public.produit where slug = 're-kit-paye') as paye, (select id from public.produit where slug = 're-kit-gratuit') as gratuit;
grant select on k to public;

-- Droits.
select ok((select relrowsecurity from pg_class where oid = 'public.realisation'::regclass) and not has_table_privilege('authenticated', 'public.realisation', 'select'), 'realisation : RLS, aucune lecture client');
select ok(not has_function_privilege('anon', 'public.deposer_realisation(jsonb, text, text, text, text, uuid)', 'execute') and not has_function_privilege('authenticated', 'public.kits_payes(uuid)', 'execute'), 'fonctions des Réalisations : service seulement');

-- Kits déclarables : seulement le Kit payé.
select is(jsonb_array_length(public.kits_payes('00000000-0000-0000-0000-0000000000b1')), 1, 'un seul Kit déclarable : le Kit gratuit ne compte pas');
select is(public.kits_payes('00000000-0000-0000-0000-0000000000b1') -> 0 ->> 'titre_fr', 'TEST_Kit payé', 'le Kit payé');
select is(jsonb_array_length(public.kits_payes('00000000-0000-0000-0000-0000000000b2')), 0, 'un Compte sans achat n''a aucun Kit déclarable');

-- Envoi.
select throws_ok($$select public.deposer_realisation(pg_temp.c('b1'), pg_temp.obj(1), null, null, 'TEST_v1', (select gratuit from k))$$, 'P0001', 'KS_KIT_NON_PAYE', 'Kit gratuit : refusé');
select throws_ok($$select public.deposer_realisation(pg_temp.c('b2'), pg_temp.obj(1), null, null, 'TEST_v1', (select paye from k))$$, 'P0001', 'KS_KIT_NON_PAYE', 'Kit payé par un autre Compte : refusé');
select is((select count(*)::int from public.photo_galerie where objet = pg_temp.obj(1)), 0, 'aucune photo enregistrée après un refus');
create temp table r as select public.deposer_realisation(pg_temp.c('b1'), pg_temp.obj(2), 'TEST_Pseudo', null, 'TEST_v1', (select paye from k)) as photo;
grant select on r to public;
select ok((select re.commande_preuve = (select id from public.commande where numero = 'KS-2026-870001') and re.validee_le is null and re.rang is null
  from public.realisation re where re.photo_id = (select photo from r)), 'Réalisation en attente, avec sa preuve d''achat');
select ok(exists (select 1 from public.consentement where cible_id = (select photo from r) and objet = 'publication_photo'), 'accord de publication enregistré comme pour une photo');

-- File du personnel et compteurs.
select is((select e -> 'realisation' ->> 'commande' from jsonb_array_elements(public.lister_photos_admin(pg_temp.c('b3'))) e where e ->> 'id' = (select photo from r)::text), 'KS-2026-870001', 'la file montre la preuve d''achat');
select is(public.compter_photos_a_traiter(), '{"a_valider": 0, "realisations": 1, "retraits": 0}'::jsonb, 'tâche : la Réalisation comptée à part, pas dans « Photos à valider »');
select is(public.lister_mes_photos('00000000-0000-0000-0000-0000000000b1') -> 0 ->> 'kit_fr', 'TEST_Kit payé', '« Mes photos » : la Réalisation porte le titre de son Kit');

-- Validation : datée, rang fixé, journalisée.
select public.valider_photo(pg_temp.c('b3'), (select photo from r), pg_temp.pub(2));
select ok((select validee_le is not null and rang = 1 from public.realisation where photo_id = (select photo from r)), 'validée : date et rang 1');
select ok(exists (select 1 from public.journal_audit where cible_table = 'realisation' and apres ? 'rang'), 'validation de la Réalisation journalisée');

-- Deuxième Réalisation validée : rang 2. Photo simple validée : aucune Réalisation ne change. Réalisation refusée : ni date ni rang.
create temp table r2 as select
  public.deposer_realisation(pg_temp.c('b1'), pg_temp.obj(3), null, null, 'TEST_v1', (select paye from k)) as deux,
  public.deposer_realisation(pg_temp.c('b1'), pg_temp.obj(4), null, null, 'TEST_v1', (select paye from k)) as refusee,
  public.deposer_photo_galerie(pg_temp.c('b1'), pg_temp.obj(5), null, null, 'TEST_v1') as simple;
grant select on r2 to public;
select public.valider_photo(pg_temp.c('b3'), (select simple from r2), pg_temp.pub(5));
select is((select count(*)::int from public.realisation where rang is not null), 1, 'photo simple validée : aucun rang attribué');
select public.valider_photo(pg_temp.c('b3'), (select deux from r2), pg_temp.pub(3));
select is((select rang from public.realisation where photo_id = (select deux from r2)), 2, 'deuxième Réalisation validée : rang 2');
select public.refuser_photo(pg_temp.c('b3'), (select refusee from r2));
select ok((select validee_le is null and rang is null from public.realisation where photo_id = (select refusee from r2)), 'Réalisation refusée : ni date ni rang');

select * from finish();
rollback;
