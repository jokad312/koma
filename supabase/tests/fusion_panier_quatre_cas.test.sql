-- Bug A1 (2026-11-22) : fusion du Panier à la connexion, les 4 cas (avec ou sans Panier invité, avec ou sans Panier du Compte).
-- Le PREMIER appel de fusionner_panier de ce fichier est le cas « sans Panier invité » : c'est lui qui échouait (55000) dans une session neuve,
-- comme à chaque connexion réelle. Ne pas le déplacer : un appel précédent dans la même session masquait le défaut (fusion_panier.test.sql:96).
-- Aussi lançable sur koma-dev : `npm run test:sql:linked -- supabase/tests/fusion_panier_quatre_cas.test.sql` (tout est annulé).
begin;
select plan(14);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-fq1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-fq2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-fq3@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a4', 'test-fq4@example.invalid', '{}');
create function pg_temp.vis() returns jsonb language sql as $$ select '{"type":"visiteur"}'::jsonb $$;
create function pg_temp.c(p uuid) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', p, 'role', null) $$;

insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'fq-cos', 'C', 'C', 5000, 14, now() - interval '1 minute');
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande)
  values ((select id from public.produit where slug = 'fq-cos'), 'M', 50, false);

-- 1. Sans Panier invité, Compte sans Panier : aucune erreur, aucun Panier (premier appel de la session).
select is(public.fusionner_panier(pg_temp.c('00000000-0000-0000-0000-0000000000a1'), '00000000-0000-0000-0000-0000000000a1', null) ->> 'panier_id', null,
  '1. sans Panier invité, Compte sans Panier : aucune erreur, aucun Panier');

-- 2. Sans Panier invité, Compte avec Panier : le Panier du Compte est renvoyé, intact.
create temp table pc2 as select public.creer_panier(pg_temp.vis()) as id;
grant select on pc2 to public;
select public.ajouter_au_panier(pg_temp.vis(), (select id from pc2), null, (select id from public.produit where slug = 'fq-cos'), 'M', 2);
update public.panier set compte_id = '00000000-0000-0000-0000-0000000000a2' where id = (select id from pc2);
select is((public.fusionner_panier(pg_temp.c('00000000-0000-0000-0000-0000000000a2'), '00000000-0000-0000-0000-0000000000a2', null) ->> 'panier_id')::uuid,
  (select id from pc2), '2. sans Panier invité, Compte avec Panier : son Panier est renvoyé');
select is((select sum(nombre)::int from public.ligne_panier where panier_id = (select id from pc2)), 2, '2. ses articles sont intacts');

-- 3. Panier invité, Compte sans Panier : le Panier invité est rattaché au Compte, avec ses articles.
create temp table pi3 as select public.creer_panier(pg_temp.vis()) as id;
grant select on pi3 to public;
select public.ajouter_au_panier(pg_temp.vis(), (select id from pi3), null, (select id from public.produit where slug = 'fq-cos'), 'M', 1);
select is((public.fusionner_panier(pg_temp.c('00000000-0000-0000-0000-0000000000a3'), '00000000-0000-0000-0000-0000000000a3', (select id from pi3)) ->> 'panier_id')::uuid,
  (select id from pi3), '3. Panier invité, Compte sans Panier : le Panier invité est retenu');
select is((select compte_id from public.panier where id = (select id from pi3)), '00000000-0000-0000-0000-0000000000a3'::uuid, '3. il est rattaché au Compte');
select is((select sum(nombre)::int from public.ligne_panier where panier_id = (select id from pi3)), 1, '3. l''article est conservé');

-- 4. Panier invité, Compte avec Panier : les articles sont réunis dans le Panier du Compte, le Panier invité disparaît.
create temp table pc4 as select public.creer_panier(pg_temp.vis()) as id;
create temp table pi4 as select public.creer_panier(pg_temp.vis()) as id;
grant select on pc4, pi4 to public;
select public.ajouter_au_panier(pg_temp.vis(), (select id from pc4), null, (select id from public.produit where slug = 'fq-cos'), 'M', 2);
update public.panier set compte_id = '00000000-0000-0000-0000-0000000000a4' where id = (select id from pc4);
select public.ajouter_au_panier(pg_temp.vis(), (select id from pi4), null, (select id from public.produit where slug = 'fq-cos'), 'M', 3);
select is((public.fusionner_panier(pg_temp.c('00000000-0000-0000-0000-0000000000a4'), '00000000-0000-0000-0000-0000000000a4', (select id from pi4)) ->> 'panier_id')::uuid,
  (select id from pc4), '4. Panier invité, Compte avec Panier : le Panier du Compte est retenu');
select is((select sum(nombre)::int from public.ligne_panier where panier_id = (select id from pc4)), 5, '4. les quantités sont additionnées (2 + 3)');
select is((select count(*)::int from public.panier where id = (select id from pi4)), 0, '4. le Panier invité est supprimé');

-- Panier « invité » qui appartient à un AUTRE Compte (appareil partagé) : ignoré, jamais pris ni vidé.
select is((public.fusionner_panier(pg_temp.c('00000000-0000-0000-0000-0000000000a2'), '00000000-0000-0000-0000-0000000000a2', (select id from pc4)) ->> 'panier_id')::uuid,
  (select id from pc2), 'Panier d''un autre Compte : ignoré, le Panier du Compte est renvoyé');
select is((select compte_id from public.panier where id = (select id from pc4)), '00000000-0000-0000-0000-0000000000a4'::uuid, 'le Panier de l''autre Compte reste à lui');

-- Rejeu et Panier inconnu : sans erreur.
select is((public.fusionner_panier(pg_temp.c('00000000-0000-0000-0000-0000000000a4'), '00000000-0000-0000-0000-0000000000a4', (select id from pi4)) ->> 'panier_id')::uuid,
  (select id from pc4), 'rejeu avec un Panier invité déjà fusionné : le Panier du Compte est renvoyé');
select is(public.fusionner_panier(pg_temp.c('00000000-0000-0000-0000-0000000000a1'), '00000000-0000-0000-0000-0000000000a1', gen_random_uuid()) ->> 'panier_id', null,
  'Panier invité inconnu, Compte sans Panier : aucun Panier');
select is((select count(*)::int from public.panier where compte_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'aucun Panier créé pour rien');

select * from finish();
rollback;
