-- Préparation de la story 8.3 : lecture publique du mur (lister_mur_public). anon ne voit que les photos et Réalisations publiées et non
-- retirées, aucune colonne personnelle, limite plafonnée à 24, Kit non publié : pas de lien. Texte alternatif exigé à la validation.
-- Copie publiée dans un bucket public, original dans un bucket privé sans politique. Données TEST_ annulées à la fin.
begin;
select plan(32);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'test-mur-client@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'test-mur-admin@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d3', 'test-mur-tardif@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000d1', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000d3', 30);
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000d2', 'admin');
create function pg_temp.c(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;
create function pg_temp.obj(n int) returns text language sql as $$ select 'photos-clients/00000000-0000-4000-8000-' || lpad(n::text, 12, '0') || '.jpg' $$;
create function pg_temp.pub(n int) returns text language sql as $$ select 'galerie/00000000-0000-4000-8000-' || lpad(n::text, 12, '0') || '.jpg' $$;
create function pg_temp.valider(id uuid, n int) returns void language sql as $$ select public.valider_photo(pg_temp.c('d2'), id, pg_temp.pub(n), 'TEST_Cosplay fr', 'TEST_Cosplay en') $$;

-- Deux Kits payés par d1 : l'un publié, l'autre jamais publié.
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'mur-kit-publie', 'TEST_Kit publié', 'TEST_Published kit', 990, 'debutant', now()),
  ('kit', 'mur-kit-brouillon', 'TEST_Kit brouillon', null, 990, 'debutant', null);
insert into public.commande (numero, compte_id, type, statut, sous_total_cents, total_cents, paye_le) values
  ('KS-2026-880001', '00000000-0000-0000-0000-0000000000d1', 'produits', 'payee', 1980, 1980, now() - interval '2 days');
insert into public.acces_kit (compte_id, produit_id, commande_origine)
  select '00000000-0000-0000-0000-0000000000d1', p.id, (select id from public.commande where numero = 'KS-2026-880001')
  from public.produit p where p.slug in ('mur-kit-publie', 'mur-kit-brouillon');

-- Droits.
select ok(has_function_privilege('anon', 'public.lister_mur_public(timestamptz, uuid, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.lister_mur_public(timestamptz, uuid, integer)', 'execute'), 'mur public : lisible par anon et authenticated');
select ok((select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.lister_mur_public(timestamptz, uuid, integer)'::regprocedure), 'SECURITY DEFINER, search_path fixé');
select ok(not has_function_privilege('anon', 'public.valider_photo(jsonb, uuid, text, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.valider_photo(jsonb, uuid, text, text, text)', 'execute'), 'valider_photo : service seulement');
-- Colonnes renvoyées : liste fermée, aucune colonne personnelle (email, nom, Compte, âge, Commande, ville, original).
select is(
  (select proargnames from pg_proc where oid = 'public.lister_mur_public(timestamptz, uuid, integer)'::regprocedure),
  array['p_curseur_date', 'p_curseur_id', 'p_limite', 'id', 'fichier', 'alt_fr', 'alt_en', 'pseudo', 'valide_le', 'type', 'fait_avec_kit', 'kit_slug', 'kit_titre_fr', 'kit_titre_en', 'curseur_date']::text[],
  'colonnes du mur : liste fermée, rien de personnel'
);

-- Stockage : la copie publiée est dans un bucket public, l'original dans un bucket privé sans politique.
select ok(exists (select 1 from storage.buckets where id = 'produits-public' and public), 'copie publiée : bucket public produits-public');
select ok(exists (select 1 from storage.buckets where id = 'galerie-attente' and not public), 'original : bucket privé galerie-attente');
select is((select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and (coalesce(qual, '') like '%galerie-attente%' or coalesce(with_check, '') like '%galerie-attente%')), 0, 'aucune politique n''ouvre galerie-attente');

-- Photos : A publiée (pseudo), B en attente, C refusée, D retirée, E retrait demandé, F Compte devenu mineur, G WhatsApp sans Compte,
-- R1 Réalisation (Kit publié), R2 Réalisation (Kit non publié), H accord retiré après validation.
create temp table ph as select
  public.deposer_photo_galerie(pg_temp.c('d1'), pg_temp.obj(1), 'TEST_Pseudo', 'TEST_Goma', 'TEST_v1') as a,
  public.deposer_photo_galerie(pg_temp.c('d1'), pg_temp.obj(2), null, null, 'TEST_v1') as b,
  public.deposer_photo_galerie(pg_temp.c('d1'), pg_temp.obj(3), null, null, 'TEST_v1') as c,
  public.deposer_photo_galerie(pg_temp.c('d1'), pg_temp.obj(4), null, null, 'TEST_v1') as d,
  public.deposer_photo_galerie(pg_temp.c('d1'), pg_temp.obj(5), null, null, 'TEST_v1') as e,
  public.deposer_photo_galerie(pg_temp.c('d3'), pg_temp.obj(6), null, null, 'TEST_v1') as f,
  public.deposer_photo_whatsapp(pg_temp.c('d2'), pg_temp.obj(7), null, 'TEST_Ami', null, current_date, true, null, 'TEST_v1') as g,
  public.deposer_realisation(pg_temp.c('d1'), pg_temp.obj(8), null, null, 'TEST_v1', (select id from public.produit where slug = 'mur-kit-publie')) as r1,
  public.deposer_realisation(pg_temp.c('d1'), pg_temp.obj(9), null, null, 'TEST_v1', (select id from public.produit where slug = 'mur-kit-brouillon')) as r2,
  public.deposer_photo_galerie(pg_temp.c('d1'), pg_temp.obj(10), null, null, 'TEST_v1') as h;
grant select on ph to public;

-- Texte alternatif exigé à la validation.
select throws_ok($$select public.valider_photo(pg_temp.c('d2'), (select a from ph), pg_temp.pub(1), '  ', 'TEST_alt')$$, 'P0001', 'KS_ALT_INVALIDE', 'alt français vide : validation refusée');
select throws_ok($$select public.valider_photo(pg_temp.c('d2'), (select a from ph), pg_temp.pub(1), 'TEST_alt', null)$$, 'P0001', 'KS_ALT_INVALIDE', 'alt anglais absent : validation refusée');
select throws_ok($$select public.valider_photo(pg_temp.c('d2'), (select a from ph), pg_temp.pub(1), repeat('x', 201), 'TEST_alt')$$, 'P0001', 'KS_ALT_INVALIDE', 'alt de plus de 200 caractères : refusé');
select throws_ok($$select public.valider_photo(pg_temp.c('d2'), (select a from ph), pg_temp.pub(1), 'TEST' || chr(8203) || 'alt', 'TEST_alt')$$, 'P0001', 'KS_ALT_INVALIDE', 'alt avec un caractère invisible (espace sans chasse) : refusé');
select throws_ok($$select public.valider_photo(pg_temp.c('d2'), (select a from ph), pg_temp.pub(1), chr(160) || chr(12288), 'TEST_alt')$$, 'P0001', 'KS_ALT_INVALIDE', 'alt fait seulement d''espaces Unicode : refusé');
select throws_ok($$update public.photo_galerie set statut = 'publiee', fichier_public = pg_temp.pub(1), publiee_le = now() where id = (select a from ph)$$, '23514', null, 'aucune photo publiée sans texte alternatif');

select pg_temp.valider(a, 1), pg_temp.valider(d, 4), pg_temp.valider(e, 5), pg_temp.valider(f, 6), pg_temp.valider(g, 7), pg_temp.valider(r1, 8), pg_temp.valider(r2, 9), pg_temp.valider(h, 10) from ph;
select public.refuser_photo(pg_temp.c('d2'), (select c from ph));
select public.retirer_photo_admin(pg_temp.c('d2'), (select d from ph));
select public.retirer_photo(pg_temp.c('d1'), (select e from ph));
update public.profil set age_declare = 15 where id = '00000000-0000-0000-0000-0000000000d3';
update public.consentement set retire_le = now() where cible_id = (select h from ph) and objet = 'publication_photo';

-- Lecture par anon.
set local role anon;
select throws_ok($$select 1 from public.photo_galerie$$, '42501', null, 'anon ne lit jamais photo_galerie directement');
select set_eq($$select id from public.lister_mur_public()$$, $$select unnest(array[a, g, r1, r2]) from ph$$, 'anon voit seulement les photos publiées et non retirées (A, G, R1, R2)');
select is((select pseudo || '|' || fichier || '|' || alt_fr || '|' || alt_en || '|' || type || '|' || fait_avec_kit::text from public.lister_mur_public() where id = (select a from ph)),
  'TEST_Pseudo|' || pg_temp.pub(1) || '|TEST_Cosplay fr|TEST_Cosplay en|photo|false', 'photo : pseudo, copie publiée, textes alternatifs, type photo');
select ok((select pseudo is null from public.lister_mur_public() where id = (select r2 from ph)), 'sans pseudo choisi : pseudo null');
select is((select type || '|' || fait_avec_kit::text || '|' || kit_slug || '|' || kit_titre_fr || '|' || kit_titre_en from public.lister_mur_public() where id = (select r1 from ph)),
  'realisation|true|mur-kit-publie|TEST_Kit publié|TEST_Published kit', 'Réalisation, Kit publié : « Fait avec un kit KOMA » et lien vers le Kit');
select ok((select type = 'realisation' and fait_avec_kit and kit_slug is null and kit_titre_fr is null and kit_titre_en is null from public.lister_mur_public() where id = (select r2 from ph)),
  'Réalisation, Kit non publié : « Fait avec un kit KOMA » sans lien ni titre');
select is((select pseudo from public.lister_mur_public() where id = (select g from ph)), 'TEST_Ami', 'photo WhatsApp sans Compte : son pseudo');
select is((select count(*)::int from public.lister_mur_public() where fichier !~ '^galerie/' or fichier ~ '^photos-clients/'), 0, 'seulement la copie publiée, jamais l''original');
select ok((select valide_le is not null and curseur_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[.][0-9]{6}Z$' and curseur_date::timestamptz = valide_le
  from public.lister_mur_public() where id = (select a from ph)), 'date de validation ; curseur ISO 8601 UTC, microsecondes, relu sans perte');
select ok((select count(*) = 0 from public.lister_mur_public() m where m.id in (select f from ph)), 'Compte devenu mineur : quitte le mur');
select ok((select count(*) = 0 from public.lister_mur_public() m where m.id in (select h from ph)), 'accord de publication retiré : quitte le mur');
reset role;
update public.produit set publie_le = now() + interval '1 day' where slug = 'mur-kit-publie';
select ok((select fait_avec_kit and kit_slug is null and kit_titre_fr is null from public.lister_mur_public() where id = (select r1 from ph)), 'Kit dont la publication est future : pas encore de lien');

-- Limite plafonnée à 24, pagination par curseur sans doublon. 26 photos de plus (30 au total), validées à une minute d'écart :
-- la pagination est éprouvée sur la date de validation, pas seulement sur l'identifiant.
do $$
declare v uuid;
begin
  for i in 100..125 loop
    v := public.deposer_photo_galerie(pg_temp.c('d1'), pg_temp.obj(i), null, null, 'TEST_v1');
    perform pg_temp.valider(v, i);
    update public.photo_galerie set publiee_le = now() - (i - 99) * interval '1 minute' where id = v;
  end loop;
end $$;
create temp table p1 as select * from public.lister_mur_public();
grant select on p1 to public;
create temp table anciennes as select g.id from public.photo_galerie g where g.objet in (select pg_temp.obj(n) from generate_series(120, 125) n);
grant select on anciennes to public;
set local role anon;
select is((select count(*)::int from public.lister_mur_public(null, null, 1000)), 24, 'limite plafonnée à 24');
select is((select count(*)::int from public.lister_mur_public()), 24, 'limite par défaut : 24');
select is((select count(*)::int from public.lister_mur_public(null, null, 0)), 1, 'limite 0 : ramenée à 1');
select is((select count(*)::int from public.lister_mur_public(null, null, 5)), 5, 'limite 5 respectée');
select is(
  (select count(*)::int from public.lister_mur_public(
    (select curseur_date::timestamptz from p1 order by valide_le, id limit 1), (select id from p1 order by valide_le, id limit 1), 24) m
   where m.id not in (select id from p1)),
  6, 'page suivante : les 6 photos restantes, aucune déjà vue'
);
select is((select count(*)::int from public.lister_mur_public((select curseur_date::timestamptz from p1 order by valide_le, id limit 1), (select id from p1 order by valide_le, id limit 1), 24)), 6, 'page suivante : rien de plus');
select set_eq(
  $$select id from public.lister_mur_public((select curseur_date::timestamptz from p1 order by valide_le, id limit 1), (select id from p1 order by valide_le, id limit 1), 24)$$,
  $$select id from anciennes$$,
  'tri par date de validation décroissante : la page suivante contient les 6 photos les plus anciennes'
);
reset role;

select * from finish();
rollback;
