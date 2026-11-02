-- Story 3.6 : bibliothèque et téléchargement. fichier_filigrane (RLS, aucun droit), fonctions de lecture (service seulement, accès vérifié),
-- fichier à remettre (email, numéro de la Commande d'origine, copie filigranée), enregistrement d'une copie (première gagne, version actuelle).
-- Données créées dans la transaction, puis annulées.
begin;
select plan(23);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'test-bf1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', 'test-bf2@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b1', 25);

create function pg_temp.c1() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":null}'::jsonb $$;

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'bf-kit', 'Kit bibliothèque', 'Library kit', 0, 'debutant', now() - interval '1 minute'),
  ('kit', 'bf-autre', 'Autre kit', 'Other kit', 0, 'debutant', now() - interval '1 minute');
create temp table bf as
  select (select id from public.produit where slug = 'bf-kit') as kit, (select id from public.produit where slug = 'bf-autre') as autre;
grant select on bf to public;
insert into public.produit_photo (produit_id, fichier, alt_fr, alt_en, position) values
  ((select kit from bf), (select kit from bf)::text || '/a.jpg', 'Alt FR', 'Alt EN', 1);
insert into public.fichier_kit (id, produit_id, nom_fr, nom_en, format, taille_octets, ordre) values
  ('00000000-0000-4000-8000-0000000000c1', (select kit from bf), 'Patron', 'Pattern', 'pdf_a4', 1000, 1),
  ('00000000-0000-4000-8000-0000000000c2', (select autre from bf), 'Autre patron', 'Other pattern', 'pdf_a4', 1000, 1);
insert into public.fichier_kit_prive (fichier_id, chemin_stockage) values
  ('00000000-0000-4000-8000-0000000000c1', 'bf/c1.pdf'),
  ('00000000-0000-4000-8000-0000000000c2', 'bf/c2.pdf');
-- b1 obtient bf-kit (Commande offerte) ; b2 n'a rien.
select public.offrir_commande(pg_temp.c1(), (select kit from bf), '[{"objet":"licence_kit","version":"test-v1"}]'::jsonb, 'cle-test-bf-0001');

-- Table : RLS, aucun droit, aucune politique.
select ok((select relrowsecurity from pg_class where oid = 'public.fichier_filigrane'::regclass), 'fichier_filigrane : RLS active');
select is(
  (select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and table_name = 'fichier_filigrane' and lower(grantee) in ('anon', 'authenticated', 'public')),
  0,
  'fichier_filigrane : aucun droit pour anon, authenticated ni public'
);
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'fichier_filigrane'), 0, 'fichier_filigrane : aucune politique');

-- Fonctions : service seulement, security definer, search_path vide.
select is(
  (select array_agg(f order by f) from unnest(array[
    'public.bibliotheque_lister(uuid)', 'public.bibliotheque_kit(uuid, text)',
    'public.bibliotheque_fichier_a_servir(uuid, uuid)', 'public.bibliotheque_enregistrer_filigrane(uuid, uuid, integer, text)'
  ]) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or not has_function_privilege('service_role', f, 'execute')),
  null,
  'les quatre fonctions de la bibliothèque : service seulement'
);
select ok(
  (select count(*) = 4 and bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where pronamespace = 'public'::regnamespace and proname in ('bibliotheque_lister', 'bibliotheque_kit', 'bibliotheque_fichier_a_servir', 'bibliotheque_enregistrer_filigrane')),
  'security definer, search_path vide'
);

-- Liste.
select is((select count(*)::int from public.bibliotheque_lister('00000000-0000-0000-0000-0000000000b1')), 1, 'b1 : un Kit dans sa bibliothèque');
select is((select slug from public.bibliotheque_lister('00000000-0000-0000-0000-0000000000b1')), 'bf-kit', 'b1 : le bon Kit');
select is((select photo from public.bibliotheque_lister('00000000-0000-0000-0000-0000000000b1')), (select kit from bf)::text || '/a.jpg', 'b1 : la première photo sert de vignette');
select is((select count(*)::int from public.bibliotheque_lister('00000000-0000-0000-0000-0000000000b2')), 0, 'b2 : bibliothèque vide');

-- Détail d'un Kit.
select is((public.bibliotheque_kit('00000000-0000-0000-0000-0000000000b1', 'bf-kit')->>'slug'), 'bf-kit', 'b1 ouvre son Kit');
select is(jsonb_array_length(public.bibliotheque_kit('00000000-0000-0000-0000-0000000000b1', 'bf-kit')->'fichiers'), 1, 'b1 : un fichier dans son Kit');
select ok(public.bibliotheque_kit('00000000-0000-0000-0000-0000000000b1', 'bf-kit')::text not like '%chemin%', 'le détail ne contient aucun chemin de stockage');
select is(public.bibliotheque_kit('00000000-0000-0000-0000-0000000000b2', 'bf-kit'), null, 'b2 n''a pas accès au Kit : rien');
select is(public.bibliotheque_kit('00000000-0000-0000-0000-0000000000b1', 'bf-autre'), null, 'b1 n''a pas accès à l''autre Kit : rien');

-- Fichier à remettre.
select is((public.bibliotheque_fichier_a_servir('00000000-0000-0000-0000-0000000000b1', '00000000-0000-4000-8000-0000000000c1')->>'chemin_stockage'), 'bf/c1.pdf', 'b1 : chemin du fichier de son Kit');
select is((public.bibliotheque_fichier_a_servir('00000000-0000-0000-0000-0000000000b1', '00000000-0000-4000-8000-0000000000c1')->>'email'), 'test-bf1@example.invalid', 'b1 : son email pour le filigrane');
select matches((public.bibliotheque_fichier_a_servir('00000000-0000-0000-0000-0000000000b1', '00000000-0000-4000-8000-0000000000c1')->>'numero_commande'), '^KS-[0-9]{4}-[0-9]{6,}$', 'b1 : numéro de la Commande d''origine');
select is(public.bibliotheque_fichier_a_servir('00000000-0000-0000-0000-0000000000b2', '00000000-0000-4000-8000-0000000000c1'), null, 'b2 sans accès : rien');
select is(public.bibliotheque_fichier_a_servir('00000000-0000-0000-0000-0000000000b1', '00000000-0000-4000-8000-0000000000c2'), null, 'b1 : fichier d''un Kit qu''il n''a pas : rien');

-- Copie filigranée : refus sans accès, première enregistrée gagne, nouvelle version = nouvelle copie.
select is(public.bibliotheque_enregistrer_filigrane('00000000-0000-0000-0000-0000000000b2', '00000000-0000-4000-8000-0000000000c1', 1, 'filigranes/x.pdf'), null, 'b2 sans accès : copie refusée');
select is(public.bibliotheque_enregistrer_filigrane('00000000-0000-0000-0000-0000000000b1', '00000000-0000-4000-8000-0000000000c1', 1, 'filigranes/b1/c1-v1.pdf'), 'filigranes/b1/c1-v1.pdf', 'b1 : copie enregistrée');
select is(public.bibliotheque_enregistrer_filigrane('00000000-0000-0000-0000-0000000000b1', '00000000-0000-4000-8000-0000000000c1', 1, 'filigranes/b1/autre.pdf'), 'filigranes/b1/c1-v1.pdf', 'b1 : la première copie est conservée');
update public.fichier_kit set version = 2 where id = '00000000-0000-4000-8000-0000000000c1';
select is((public.bibliotheque_fichier_a_servir('00000000-0000-0000-0000-0000000000b1', '00000000-0000-4000-8000-0000000000c1')->>'chemin_filigrane'), null, 'fichier remplacé : plus de copie pour la nouvelle version');

select * from finish();
rollback;
