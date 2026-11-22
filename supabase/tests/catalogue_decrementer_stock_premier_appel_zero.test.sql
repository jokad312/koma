-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : catalogue_decrementer_stock. Cas limite : variante épuisée (stock 0, aucune réservation), on en retire 1 : refus KS_STOCK_INSUFFISANT.
-- Ce fichier ne contient QU'UN appel de catalogue_decrementer_stock (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(2);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into public.produit (id, famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('00000000-0000-4000-8000-a1b150000011', 'accessoire', 'test-a1bis-15-acc', 'TEST_Accessoire', 'TEST_Accessoire', 1000, 3, now() - interval '1 minute');
insert into public.variante (id, produit_id, taille, stock, fabrication_sur_commande) values
  ('00000000-0000-4000-8000-a1b150000021', '00000000-0000-4000-8000-a1b150000011', 'M', 0, false);

select throws_ok(
  $$select public.catalogue_decrementer_stock('00000000-0000-4000-8000-a1b150000021', 1)$$,
  'P0001', 'KS_STOCK_INSUFFISANT',
  'premier appel de la session, stock à 0 : refusé'
);
select is((select stock from public.variante where id = '00000000-0000-4000-8000-a1b150000021'), 0, 'le stock reste à 0');

select * from finish();
rollback;
