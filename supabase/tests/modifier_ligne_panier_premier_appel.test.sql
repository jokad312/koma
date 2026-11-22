-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : modifier_ligne_panier. Cas limite : ligne sans variante (Kit) : refus KS_LIGNE_UNIQUE (v_variante jamais rempli).
-- Ce fichier ne contient QU'UN appel de modifier_ligne_panier (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(2);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into public.produit (id, famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('00000000-0000-4000-8000-a1b050000011', 'kit', 'test-a1bis-05-kit', 'TEST_Kit', 'TEST_Kit', 990, 'debutant', now() - interval '1 minute');
-- Panier de visiteur (sans Compte) avec une ligne de Kit.
insert into public.panier (id, compte_id) values ('00000000-0000-4000-8000-a1b050000061', null);
insert into public.ligne_panier (id, panier_id, produit_id, variante_id, nombre) values
  ('00000000-0000-4000-8000-a1b050000062', '00000000-0000-4000-8000-a1b050000061', '00000000-0000-4000-8000-a1b050000011', null, 1);

select throws_ok(
  $$select public.modifier_ligne_panier('{"type":"visiteur"}'::jsonb, '00000000-0000-4000-8000-a1b050000061', '00000000-0000-4000-8000-a1b050000062', 2)$$,
  'P0001', 'KS_LIGNE_UNIQUE',
  'premier appel de la session, ligne sans variante : refusée'
);
select is((select nombre::int from public.ligne_panier where id = '00000000-0000-4000-8000-a1b050000062'), 1, 'la ligne ne change pas');

select * from finish();
rollback;
