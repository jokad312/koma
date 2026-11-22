-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : annuler_commande. Cas limite : cas nominal le plus simple que le code autorise : Commande payée, un seul Cosplay pris en stock
-- (stock_retire connu), sans Kit, sans Forfait, sans réduction, sans demande du client. Montant rendu = 1 x 5000.
-- Ce fichier ne contient QU'UN appel de annuler_commande (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(7);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-a1b080000001', 'test-a1bis-08-client@example.invalid', '{}'),
  ('00000000-0000-0000-0000-a1b080000002', 'test-a1bis-08-admin@example.invalid', '{}');
-- Rôle admin écrit directement (exiger_admin lit role_utilisateur).
insert into public.role_utilisateur (compte, role) values ('00000000-0000-0000-0000-a1b080000002', 'admin');

insert into public.produit (id, famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('00000000-0000-4000-8000-a1b080000011', 'cosplay', 'test-a1bis-08-cos', 'TEST_Cosplay', 'TEST_Cosplay', 5000, 14, now() - interval '1 minute');
insert into public.variante (id, produit_id, taille, stock, fabrication_sur_commande) values
  ('00000000-0000-4000-8000-a1b080000021', '00000000-0000-4000-8000-a1b080000011', 'M', 3, false);
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, forfait_cents, paye_le) values
  ('00000000-0000-4000-8000-a1b080000031', 'KS-2026-9108001', '00000000-0000-0000-0000-a1b080000001', 'produits', 'payee', 5000, 5000, 0, now());
insert into public.ligne_commande (id, commande_id, produit_id, variante_id, origine, nombre, prix_cents, reduction_cents, stock_retire) values
  ('00000000-0000-4000-8000-a1b080000041', '00000000-0000-4000-8000-a1b080000031', '00000000-0000-4000-8000-a1b080000011', '00000000-0000-4000-8000-a1b080000021', 'stock', 1, 5000, 0, 1);

select is(
  public.annuler_commande('{"type":"compte","id":"00000000-0000-0000-0000-a1b080000002","role":"admin"}'::jsonb, '00000000-0000-4000-8000-a1b080000031'),
  5000,
  'premier appel de la session : aucune erreur, montant à rendre 5000'
);
select is(
  (select statut || '|' || stock_a_verifier::text from public.commande where id = '00000000-0000-4000-8000-a1b080000031'),
  'annulee|false',
  'Commande annulée, stock connu (rien à vérifier)'
);
select is((select stock from public.variante where id = '00000000-0000-4000-8000-a1b080000021'), 4, 'stock rendu (3 + 1)');
select ok((select annulee from public.ligne_commande where id = '00000000-0000-4000-8000-a1b080000041'), 'la ligne physique est annulée');
select is(
  (select montant_cents::text || '|' || devise || '|' || (valide_le is null)::text from public.remboursement where cible_type = 'commande' and cible_id = '00000000-0000-4000-8000-a1b080000031'),
  '5000|USD|true',
  'un remboursement à confirmer de 5000 USD'
);
select is((select count(*)::int from public.envoi where cle = 'commande_annulee:00000000-0000-4000-8000-a1b080000031'), 1, 'email d''annulation planifié');
select is((select count(*)::int from public.demande_client where commande_id = '00000000-0000-4000-8000-a1b080000031'), 0, 'aucune demande créée');

select * from finish();
rollback;
