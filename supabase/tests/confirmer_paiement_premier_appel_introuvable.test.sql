-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : confirmer_paiement. Cas limite : Tentative introuvable (refus KS_TENTATIVE_INTROUVABLE, avant toute écriture).
-- Ce fichier ne contient QU'UN appel de confirmer_paiement (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(2);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);

select throws_ok(
  $$select public.confirmer_paiement('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-4000-8000-a1b010000051', 'egal', 990, 'USD', 'TEST-A1BIS-01-TX')$$,
  'P0001', 'KS_TENTATIVE_INTROUVABLE',
  'premier appel de la session, Tentative inconnue : refusée'
);
select is(
  (select count(*)::int from public.anomalie where cible_id = '00000000-0000-4000-8000-a1b010000051'),
  0,
  'aucune anomalie écrite pour la Tentative inconnue'
);

select * from finish();
rollback;
