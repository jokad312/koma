-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : confirmer_paiement. Cas limite : rejeu d'une Tentative déjà réussie (sortie anticipée « deja_traite », v_c jamais rempli).
-- Ce fichier ne contient QU'UN appel de confirmer_paiement (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(5);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-a1b020000001', 'test-a1bis-02@example.invalid', '{}');
insert into public.produit (id, famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('00000000-0000-4000-8000-a1b020000011', 'kit', 'test-a1bis-02-kit', 'TEST_Kit', 'TEST_Kit', 990, 'debutant', now() - interval '1 minute');
-- Commande déjà payée par la Tentative réussie.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, expire_le, prestataire, reference_transaction, paye_le) values
  ('00000000-0000-4000-8000-a1b020000031', 'KS-2026-9102001', '00000000-0000-0000-0000-a1b020000001', 'produits', 'payee', 990, 990, null, 'pawapay', 'TEST-A1BIS-02-TX', now() - interval '1 hour');
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents) values
  ('00000000-0000-4000-8000-a1b020000031', '00000000-0000-4000-8000-a1b020000011', 1, 990);
insert into public.tentative_paiement (id, commande_id, prestataire, moyen, reference_interne, reference_transaction, montant_attendu_cents, montant_recu, devise_recue, statut) values
  ('00000000-0000-4000-8000-a1b020000051', '00000000-0000-4000-8000-a1b020000031', 'pawapay', 'carte', 'TEST-A1BIS-02-REF', 'TEST-A1BIS-02-TX', 990, 990, 'USD', 'reussie');

select is(
  public.confirmer_paiement('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-4000-8000-a1b020000051', 'egal', 990, 'USD', null) ->> 'resultat',
  'deja_traite',
  'premier appel de la session, Tentative déjà réussie : déjà traité, aucune erreur'
);
select is(
  (select statut || '|' || montant_recu::text || '|' || devise_recue from public.tentative_paiement where id = '00000000-0000-4000-8000-a1b020000051'),
  'reussie|990.0000|USD',
  'la Tentative ne change pas'
);
select is((select statut from public.commande where id = '00000000-0000-4000-8000-a1b020000031'), 'payee', 'la Commande reste payée');
select is(
  (select count(*)::int from public.trop_percu where commande_id = '00000000-0000-4000-8000-a1b020000031')
  + (select count(*)::int from public.anomalie where cible_id in ('00000000-0000-4000-8000-a1b020000051', '00000000-0000-4000-8000-a1b020000031')),
  0,
  'ni trop-perçu ni anomalie'
);
select is((select count(*)::int from public.envoi where donnees ->> 'commande_id' = '00000000-0000-4000-8000-a1b020000031'), 0, 'aucun email planifié');

select * from finish();
rollback;
