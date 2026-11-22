-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : confirmer_remboursement. Cas limite : cas nominal le plus simple, cible « commande » : Commande annulée avec son remboursement
-- à confirmer et sa demande d'annulation acceptée (v_t et v_p, records des autres cibles, jamais remplis).
-- Ce fichier ne contient QU'UN appel de confirmer_remboursement (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(5);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-a1b090000001', 'test-a1bis-09-client@example.invalid', '{}'),
  ('00000000-0000-0000-0000-a1b090000002', 'test-a1bis-09-admin@example.invalid', '{}');
-- Rôle admin écrit directement (exiger_admin lit role_utilisateur).
insert into public.role_utilisateur (compte, role) values ('00000000-0000-0000-0000-a1b090000002', 'admin');

insert into public.produit (id, famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('00000000-0000-4000-8000-a1b090000011', 'cosplay', 'test-a1bis-09-cos', 'TEST_Cosplay', 'TEST_Cosplay', 5000, 14, now() - interval '1 minute');
insert into public.variante (id, produit_id, taille, stock, fabrication_sur_commande) values
  ('00000000-0000-4000-8000-a1b090000021', '00000000-0000-4000-8000-a1b090000011', 'M', 3, false);
-- État laissé par annuler_commande : Commande annulée, ligne annulée, remboursement non validé, demande acceptée.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, forfait_cents, paye_le) values
  ('00000000-0000-4000-8000-a1b090000031', 'KS-2026-9109001', '00000000-0000-0000-0000-a1b090000001', 'produits', 'annulee', 5000, 5000, 0, now() - interval '1 day');
insert into public.ligne_commande (id, commande_id, produit_id, variante_id, origine, nombre, prix_cents, reduction_cents, stock_retire, annulee) values
  ('00000000-0000-4000-8000-a1b090000041', '00000000-0000-4000-8000-a1b090000031', '00000000-0000-4000-8000-a1b090000011', '00000000-0000-4000-8000-a1b090000021', 'stock', 1, 5000, 0, 1, true);
insert into public.remboursement (cible_type, cible_id, montant_cents, devise) values ('commande', '00000000-0000-4000-8000-a1b090000031', 5000, 'USD');
insert into public.demande_client (commande_id, type, statut, traitee_le) values ('00000000-0000-4000-8000-a1b090000031', 'annulation_commande', 'acceptee', now() - interval '1 hour');

select lives_ok(
  $$select public.confirmer_remboursement('{"type":"compte","id":"00000000-0000-0000-0000-a1b090000002","role":"admin"}'::jsonb, 'commande', '00000000-0000-4000-8000-a1b090000031', 'TEST-PREUVE-A1BIS-09')$$,
  'premier appel de la session, remboursement d''une Commande annulée : aucune erreur'
);
select is((select statut from public.commande where id = '00000000-0000-4000-8000-a1b090000031'), 'remboursee', 'Commande remboursée');
select ok(
  (select preuve_reference = 'TEST-PREUVE-A1BIS-09' and valide_le is not null and valide_par ->> 'id' = '00000000-0000-0000-0000-a1b090000002'
   from public.remboursement where cible_type = 'commande' and cible_id = '00000000-0000-4000-8000-a1b090000031'),
  'remboursement validé : preuve, date et auteur enregistrés'
);
select is((select statut from public.demande_client where commande_id = '00000000-0000-4000-8000-a1b090000031'), 'close', 'demande d''annulation close');
select is((select count(*)::int from public.envoi where cle = 'commande_remboursee:00000000-0000-4000-8000-a1b090000031'), 1, 'email de remboursement planifié');

select * from finish();
rollback;
