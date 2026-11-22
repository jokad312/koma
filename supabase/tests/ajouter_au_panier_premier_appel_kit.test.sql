-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : ajouter_au_panier. Cas limite : Kit, donc sans variante (v_variante jamais rempli).
-- Ce fichier ne contient QU'UN appel de ajouter_au_panier (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(3);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-a1b040000001', 'test-a1bis-04@example.invalid', '{}');
insert into public.produit (id, famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('00000000-0000-4000-8000-a1b040000011', 'kit', 'test-a1bis-04-kit', 'TEST_Kit', 'TEST_Kit', 990, 'debutant', now() - interval '1 minute');
insert into public.panier (id, compte_id) values ('00000000-0000-4000-8000-a1b040000061', '00000000-0000-0000-0000-a1b040000001');

create temp table r as select public.ajouter_au_panier(
  '{"type":"compte","id":"00000000-0000-0000-0000-a1b040000001","role":null}'::jsonb,
  '00000000-0000-4000-8000-a1b040000061', '00000000-0000-0000-0000-a1b040000001', '00000000-0000-4000-8000-a1b040000011', null, 1
) as r;

select is((select (r ->> 'nombre')::int from r), 1, 'premier appel de la session, Kit sans variante : aucune erreur, nombre 1');
select is(
  (select count(*)::int from public.ligne_panier
   where panier_id = '00000000-0000-4000-8000-a1b040000061' and produit_id = '00000000-0000-4000-8000-a1b040000011' and variante_id is null and nombre = 1),
  1,
  'une ligne de Panier créée, sans variante, nombre 1'
);
select is(
  (select (r ->> 'ligne_id')::uuid from r),
  (select id from public.ligne_panier where panier_id = '00000000-0000-4000-8000-a1b040000061'),
  'l''identifiant rendu est celui de la ligne créée'
);

select * from finish();
rollback;
