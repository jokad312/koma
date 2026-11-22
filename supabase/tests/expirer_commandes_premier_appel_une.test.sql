-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : expirer_commandes_echues (tâche pg_cron, toujours appelée en session neuve). Cas limite : une seule Commande TEST_ à expirer,
-- avec une réservation à libérer. La fonction porte sur toute la table : le résultat attendu est 1 + le nombre d'autres Commandes échues comptées
-- juste avant l'appel, dans la même transaction (now() y est figé) ; sur la base locale de la CI ce nombre vaut 0.
-- Ce fichier ne contient QU'UN appel de expirer_commandes_echues (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(3);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-a1b120000001', 'test-a1bis-12@example.invalid', '{}');
insert into public.produit (id, famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('00000000-0000-4000-8000-a1b120000011', 'cosplay', 'test-a1bis-12-cos', 'TEST_Cosplay', 'TEST_Cosplay', 5000, 14, now() - interval '1 minute');
insert into public.variante (id, produit_id, taille, stock, fabrication_sur_commande) values
  ('00000000-0000-4000-8000-a1b120000021', '00000000-0000-4000-8000-a1b120000011', 'M', 3, false);

create temp table avant as
  select count(*)::int as n from public.commande where statut in ('en_attente', 'echouee') and expire_le is not null and expire_le <= now();

-- Commande en attente dont l'échéance est passée, avec sa réservation encore active.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, expire_le) values
  ('00000000-0000-4000-8000-a1b120000031', 'KS-2026-9112001', '00000000-0000-0000-0000-a1b120000001', 'produits', 'en_attente', 5000, 5000, now() - interval '1 minute');
insert into public.ligne_commande (id, commande_id, produit_id, variante_id, origine, nombre, prix_cents) values
  ('00000000-0000-4000-8000-a1b120000041', '00000000-0000-4000-8000-a1b120000031', '00000000-0000-4000-8000-a1b120000011', '00000000-0000-4000-8000-a1b120000021', 'stock', 1, 5000);
insert into public.reservation (commande_id, ligne_id, variante_id, nombre, origine, expire_le) values
  ('00000000-0000-4000-8000-a1b120000031', '00000000-0000-4000-8000-a1b120000041', '00000000-0000-4000-8000-a1b120000021', 1, 'stock', now() - interval '1 minute');

create temp table r as select public.expirer_commandes_echues() as n;

select is((select n from r), (select n + 1 from avant), 'premier appel de la session, une Commande TEST_ échue : aucune erreur, comptée');
select is((select statut from public.commande where id = '00000000-0000-4000-8000-a1b120000031'), 'expiree', 'la Commande échue est expirée');
select ok((select liberee_le is not null from public.reservation where ligne_id = '00000000-0000-4000-8000-a1b120000041'), 'sa réservation est libérée');

select * from finish();
rollback;
