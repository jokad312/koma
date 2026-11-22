-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : demander_annulation. Cas limite : règle de l'option B (décision de Jonathan du 2026-11-15, spec 9.15, décision 10) : une Commande
-- payée sans Cosplay est annulable si elle contient au moins une ligne physique fabriquée sur commande (origine = 'fabrication'), quelle que soit
-- sa famille. Ici : un seul Accessoire, fabriqué sur commande ; seule cette règle rend la Commande annulable.
-- Ce fichier ne contient QU'UN appel de demander_annulation (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(3);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-a1b160000001', 'test-a1bis-16@example.invalid', '{}');
insert into public.produit (id, famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('00000000-0000-4000-8000-a1b160000011', 'accessoire', 'test-a1bis-16-acc', 'TEST_Accessoire', 'TEST_Accessoire', 1000, 3, now() - interval '1 minute');
insert into public.variante (id, produit_id, taille, stock, fabrication_sur_commande) values
  ('00000000-0000-4000-8000-a1b160000021', '00000000-0000-4000-8000-a1b160000011', 'M', 0, true);
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, forfait_cents, paye_le) values
  ('00000000-0000-4000-8000-a1b160000031', 'KS-2026-9116001', '00000000-0000-0000-0000-a1b160000001', 'produits', 'payee', 1000, 1000, 0, now());
insert into public.ligne_commande (id, commande_id, produit_id, variante_id, origine, nombre, prix_cents, delai_fabrication_jours) values
  ('00000000-0000-4000-8000-a1b160000041', '00000000-0000-4000-8000-a1b160000031', '00000000-0000-4000-8000-a1b160000011', '00000000-0000-4000-8000-a1b160000021', 'fabrication', 1, 1000, 3);

create temp table r as select public.demander_annulation('00000000-0000-0000-0000-a1b160000001', 'KS-2026-9116001') as id;

select is(
  (select id from r),
  (select id from public.demande_client where commande_id = '00000000-0000-4000-8000-a1b160000031' and type = 'annulation_commande' and statut = 'ouverte'),
  'premier appel de la session, un seul Accessoire fabriqué sur commande (option B) : aucune erreur, demande ouverte rendue'
);
select is((select count(*)::int from public.demande_client where commande_id = '00000000-0000-4000-8000-a1b160000031'), 1, 'une seule demande');
select is((select statut from public.commande where id = '00000000-0000-4000-8000-a1b160000031'), 'payee', 'la demande n''annule rien : la Commande reste payée');

select * from finish();
rollback;
