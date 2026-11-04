-- Epic 6, correctifs de la revue croisee : droits sur toutes les fonctions 6.x, RLS, avancer_statut (journal, interdits, demande ouverte refusee d'office,
-- suivi refuse pour un retrait), annuler_commande (assistant refuse, fabrication sans restitution, anomalie de stock, demande close),
-- confirmer_remboursement d'un Trop-percu, catalogue_decrementer_stock (reservations), reclamation (une seule par ligne, 48 h, description).
-- Donnees TEST_ annulees a la fin.
begin;
select plan(85);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'test-ep1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', 'test-ep2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b3', 'test-ep3@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b2', 'assistant');
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb $$;
create function pg_temp.ass() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000b2","role":"admin"}'::jsonb $$;

insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'ep-cos', 'C', 'C', 5000, 14, now() - interval '1 minute'),
  ('cosplay', 'ep-cos2', 'C2', 'C2', 5000, 14, now() - interval '1 minute'),
  ('accessoire', 'ep-acc', 'A', 'A', 1000, 3, now() - interval '1 minute'),
  ('accessoire', 'ep-acc2', 'A2', 'A2', 1000, 3, now() - interval '1 minute');
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values
  ((select id from public.produit where slug = 'ep-cos'), 'M', 4, false),
  ((select id from public.produit where slug = 'ep-cos2'), 'M', 5, false),
  ((select id from public.produit where slug = 'ep-acc'), 'S', 3, false),
  ((select id from public.produit where slug = 'ep-acc2'), 'S', 5, false);

-- g1 : fabrication, demande d'annulation ouverte ; g2 : fabrication, annulation directe ; g3 : retrait, piece en stock ; g4 : piece en stock (cosplay) ;
-- g5 : cosplay en stock x2 avec anomalie de stock ; g8 : en attente avec reservation ; g9/g10/g11 : livrees (reclamations, limite 48 h) ;
-- g12 : fabrication avec demande ouverte, annulation directe ; g7 : Trop-percus.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, forfait_cents, paye_le, livree_le, expire_le, zone, mode_remise) values
  ('00000000-0000-4000-8000-0000000000f1', 'KS-2026-870001', '00000000-0000-0000-0000-0000000000b3', 'produits', 'payee', 5000, 5000, 0, now(), null, null, null, null),
  ('00000000-0000-4000-8000-0000000000f2', 'KS-2026-870002', '00000000-0000-0000-0000-0000000000b3', 'produits', 'payee', 5000, 5000, 0, now(), null, null, null, null),
  ('00000000-0000-4000-8000-0000000000f3', 'KS-2026-870003', '00000000-0000-0000-0000-0000000000b3', 'produits', 'payee', 1000, 1000, 0, now(), null, null, 'goma', 'retrait'),
  ('00000000-0000-4000-8000-0000000000f4', 'KS-2026-870004', '00000000-0000-0000-0000-0000000000b3', 'produits', 'payee', 5000, 5000, 0, now(), null, null, null, null),
  ('00000000-0000-4000-8000-0000000000f5', 'KS-2026-870005', '00000000-0000-0000-0000-0000000000b3', 'produits', 'payee', 10000, 10000, 0, now(), null, null, null, null),
  ('00000000-0000-4000-8000-0000000000f7', 'KS-2026-870007', '00000000-0000-0000-0000-0000000000b3', 'produits', 'payee', 1000, 1000, 0, now(), null, null, null, null),
  ('00000000-0000-4000-8000-0000000000f8', 'KS-2026-870008', '00000000-0000-0000-0000-0000000000b3', 'produits', 'en_attente', 2000, 2000, 0, null, null, now() + interval '1 hour', null, null),
  ('00000000-0000-4000-8000-0000000000f9', 'KS-2026-870009', '00000000-0000-0000-0000-0000000000b3', 'produits', 'livree', 2000, 2000, 0, now() - interval '2 days', now() - interval '1 hour', null, null, null),
  ('00000000-0000-4000-8000-0000000000fa', 'KS-2026-870010', '00000000-0000-0000-0000-0000000000b3', 'produits', 'livree', 1000, 1000, 0, now() - interval '3 days', now() - interval '47 hours 59 minutes', null, null, null),
  ('00000000-0000-4000-8000-0000000000fb', 'KS-2026-870011', '00000000-0000-0000-0000-0000000000b3', 'produits', 'livree', 1000, 1000, 0, now() - interval '3 days', now() - interval '48 hours 1 minute', null, null, null),
  ('00000000-0000-4000-8000-0000000000fc', 'KS-2026-870012', '00000000-0000-0000-0000-0000000000b3', 'produits', 'payee', 5000, 5000, 0, now(), null, null, null, null);
insert into public.ligne_commande (id, commande_id, produit_id, variante_id, origine, nombre, prix_cents) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000f1', (select id from public.produit where slug = 'ep-cos'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-cos')), 'fabrication', 1, 5000),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000f2', (select id from public.produit where slug = 'ep-cos'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-cos')), 'fabrication', 1, 5000),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000f3', (select id from public.produit where slug = 'ep-acc'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc')), 'stock', 1, 1000),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000f4', (select id from public.produit where slug = 'ep-cos'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-cos')), 'stock', 1, 5000),
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-0000000000f5', (select id from public.produit where slug = 'ep-cos2'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-cos2')), 'stock', 2, 5000),
  ('00000000-0000-4000-8000-0000000000e7', '00000000-0000-4000-8000-0000000000f7', (select id from public.produit where slug = 'ep-acc'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc')), 'stock', 1, 1000),
  ('00000000-0000-4000-8000-0000000000e8', '00000000-0000-4000-8000-0000000000f8', (select id from public.produit where slug = 'ep-acc'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc')), 'stock', 2, 1000),
  ('00000000-0000-4000-8000-0000000000e9', '00000000-0000-4000-8000-0000000000f9', (select id from public.produit where slug = 'ep-acc2'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc2')), 'stock', 1, 1000),
  ('00000000-0000-4000-8000-0000000000ea', '00000000-0000-4000-8000-0000000000f9', (select id from public.produit where slug = 'ep-acc2'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc2')), 'stock', 1, 1000),
  ('00000000-0000-4000-8000-0000000000eb', '00000000-0000-4000-8000-0000000000fa', (select id from public.produit where slug = 'ep-acc2'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc2')), 'stock', 1, 1000),
  ('00000000-0000-4000-8000-0000000000ec', '00000000-0000-4000-8000-0000000000fb', (select id from public.produit where slug = 'ep-acc2'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc2')), 'stock', 1, 1000),
  ('00000000-0000-4000-8000-0000000000ed', '00000000-0000-4000-8000-0000000000fc', (select id from public.produit where slug = 'ep-cos'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-cos')), 'fabrication', 1, 5000);
insert into public.reservation (commande_id, ligne_id, variante_id, nombre, origine, expire_le) values
  ('00000000-0000-4000-8000-0000000000f8', '00000000-0000-4000-8000-0000000000e8', (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc')), 2, 'stock', now() + interval '1 hour');
insert into public.anomalie (type, gravite, cible_type, cible_id, details) values
  ('stock_insuffisant', 'critique', 'commande', '00000000-0000-4000-8000-0000000000f5', '{"pieces_manquantes": 1}');
insert into public.tentative_paiement (id, commande_id, prestataire, moyen, reference_interne, montant_attendu_cents, statut) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-0000000000f7', 'pawapay', 'carte', 'TEST-EP-REF-0001', 1000, 'abandonnee'),
  ('00000000-0000-4000-8000-0000000000d2', '00000000-0000-4000-8000-0000000000f7', 'pawapay', 'carte', 'TEST-EP-REF-0002', 1000, 'abandonnee'),
  ('00000000-0000-4000-8000-0000000000d3', '00000000-0000-4000-8000-0000000000f7', 'pawapay', 'carte', 'TEST-EP-REF-0003', 1000, 'abandonnee');
insert into public.trop_percu (id, commande_id, tentative_id, motif, montant_attendu_cents, montant_recu, devise_recue) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000f7', '00000000-0000-4000-8000-0000000000d1', 'montant_superieur', 1000, 25000000.5, 'CDF'),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000f7', '00000000-0000-4000-8000-0000000000d2', 'montant_superieur', 1000, 12.5, 'USD'),
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000f7', '00000000-0000-4000-8000-0000000000d3', 'montant_superieur', 1000, 0, 'USD');

-- Quantite retiree connue pour g5 (1 piece sur 2 : le stock avait ete plafonne a zero au paiement).
update public.ligne_commande set stock_retire = 1 where id = '00000000-0000-4000-8000-0000000000e5';

-- g13 : cosplay en stock dont la quantite retiree est inconnue (ancienne donnee) ; g14 : paiement reel d'une ligne de 2 pieces pour un stock de 1 (compte b2) ;
-- g15 et g16 : livrees, lignes de 3 pieces (quantite du remplacement).
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'ep-cos3', 'C3', 'C3', 5000, 14, now() - interval '1 minute');
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values
  ((select id from public.produit where slug = 'ep-cos3'), 'M', 1, false);
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, forfait_cents, paye_le, livree_le, expire_le) values
  ('00000000-0000-4000-8000-0000000000fd', 'KS-2026-870013', '00000000-0000-0000-0000-0000000000b3', 'produits', 'payee', 5000, 5000, 0, now(), null, null),
  ('00000000-0000-4000-8000-0000000000fe', 'KS-2026-870014', '00000000-0000-0000-0000-0000000000b2', 'produits', 'en_attente', 10000, 10000, 0, null, null, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000a5', 'KS-2026-870015', '00000000-0000-0000-0000-0000000000b3', 'produits', 'livree', 3000, 3000, 0, now() - interval '2 days', now() - interval '1 hour', null),
  ('00000000-0000-4000-8000-0000000000a6', 'KS-2026-870016', '00000000-0000-0000-0000-0000000000b3', 'produits', 'livree', 3000, 3000, 0, now() - interval '2 days', now() - interval '1 hour', null);
insert into public.ligne_commande (id, commande_id, produit_id, variante_id, origine, nombre, prix_cents) values
  ('00000000-0000-4000-8000-0000000000ee', '00000000-0000-4000-8000-0000000000fd', (select id from public.produit where slug = 'ep-cos'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-cos')), 'stock', 1, 5000),
  ('00000000-0000-4000-8000-0000000000ef', '00000000-0000-4000-8000-0000000000fe', (select id from public.produit where slug = 'ep-cos3'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-cos3')), 'stock', 2, 5000),
  ('00000000-0000-4000-8000-0000000000f6', '00000000-0000-4000-8000-0000000000a5', (select id from public.produit where slug = 'ep-acc2'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc2')), 'stock', 3, 1000),
  ('00000000-0000-4000-8000-0000000000f0', '00000000-0000-4000-8000-0000000000a6', (select id from public.produit where slug = 'ep-acc2'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc2')), 'stock', 3, 1000);
insert into public.tentative_paiement (id, commande_id, prestataire, moyen, reference_interne, reference_transaction, montant_attendu_cents) values
  ('00000000-0000-4000-8000-0000000000d4', '00000000-0000-4000-8000-0000000000fe', 'pawapay', 'carte', 'TEST-EP-REF-0004', 'TEST-EP-TX-0004', 10000);

-- Droits : aucune des fonctions 6.x n'est appelable par anon ou authenticated ; service_role seulement.
select is(
  (select array_agg(f order by f) from unnest(array[
    'public.avancer_statut(jsonb, text, text, text)', 'public.confirmer_mesures_recues(jsonb, uuid)', 'public.demander_annulation(uuid, text)',
    'public.annuler_commande(jsonb, uuid)', 'public.traiter_demande(jsonb, uuid, text)', 'public.confirmer_remboursement(jsonb, text, uuid, text)',
    'public.catalogue_decrementer_stock(uuid, integer)', 'public.lignes_reclamables(uuid, text)', 'public.signaler_probleme(uuid, text, uuid, text)',
    'public.traiter_reclamation(jsonb, uuid, text, boolean, integer)', 'public.marquer_stock_verifie(jsonb, uuid)'
  ]) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or not has_function_privilege('service_role', f, 'execute')),
  null,
  'les onze fonctions 6.x : service seulement'
);

-- RLS : un client authentifie ne lit ni demande_client ni remboursement (aucun droit, donc refus).
set local role authenticated;
select throws_ok($$ select count(*) from public.demande_client $$, '42501', null, 'authenticated ne lit pas demande_client');
select throws_ok($$ select count(*) from public.remboursement $$, '42501', null, 'authenticated ne lit pas remboursement');
reset role;

-- avancer_statut : introuvable, journal, interdits.
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-879999', 'en_fabrication') $$, 'KS_COMMANDE_INTROUVABLE', 'Commande inconnue');
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-870004', 'en_fabrication') $$, 'KS_TRANSITION_INTERDITE', 'Commande entierement en stock : pas de fabrication');
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-870004', 'annulee') $$, 'KS_TRANSITION_INTERDITE', 'vers annulee : interdit');
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-870004', 'remboursee') $$, 'KS_TRANSITION_INTERDITE', 'vers remboursee : interdit');
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-870003', 'expediee', 'SUIVI-1') $$, 'KS_SUIVI_INVALIDE', 'pas de numero de suivi pour un retrait');
select lives_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-870003', 'expediee') $$, 'retrait : prete a retirer sans suivi');
select lives_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-870004', 'expediee', 'SUIVI-2') $$, 'piece en stock : expediee directe');
select ok(
  exists (select 1 from public.journal_audit where cible_table = 'commande' and cible_id = '00000000-0000-4000-8000-0000000000f4' and action = 'update' and auteur ->> 'id' = '00000000-0000-0000-0000-0000000000b1'),
  'changement de statut journalise avec son auteur'
);
select is((select count(*)::int from public.envoi where cle = 'commande_expediee:00000000-0000-4000-8000-0000000000f4'), 1, 'email d expedition planifie');

-- Demande d'annulation ouverte puis fabrication : refusee d'office.
select lives_ok($$ select public.demander_annulation('00000000-0000-0000-0000-0000000000b3', 'KS-2026-870001') $$, 'demande d annulation ouverte');
select lives_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-870001', 'en_fabrication') $$, 'la Commande part en fabrication');
select is((select statut from public.demande_client where commande_id = '00000000-0000-4000-8000-0000000000f1'), 'refusee', 'la demande ouverte est refusee d office');
select throws_ok($$ select public.traiter_demande(pg_temp.adm(), (select id from public.demande_client where commande_id = '00000000-0000-4000-8000-0000000000f1'), 'accepter') $$, 'KS_DEMANDE_DEJA_TRAITEE', 'plus rien a traiter');
select throws_ok($$ select public.annuler_commande(pg_temp.adm(), '00000000-0000-4000-8000-0000000000f1') $$, 'KS_ANNULATION_IMPOSSIBLE', 'une Commande en fabrication ne s annule plus');
select lives_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-870001', 'expediee') $$, 'en_fabrication -> expediee');
select is((select count(*)::int from public.envoi where cle = 'commande_expediee:00000000-0000-4000-8000-0000000000f1'), 1, 'email d expedition planifie apres la fabrication');

-- annuler_commande : assistant refuse, fabrication sans restitution, montant, anomalie de stock, demande ouverte close.
select throws_ok($$ select public.annuler_commande(pg_temp.ass(), '00000000-0000-4000-8000-0000000000f2') $$, 'KS_DROIT_REFUSE', 'un assistant n annule pas');
select lives_ok($$ select public.annuler_commande(pg_temp.adm(), '00000000-0000-4000-8000-0000000000f2') $$, 'annulation directe par l admin');
select is((select stock from public.variante where produit_id = (select id from public.produit where slug = 'ep-cos')), 4, 'piece fabriquee : aucun stock rendu');
select is((select montant_cents from public.remboursement where cible_type = 'commande' and cible_id = '00000000-0000-4000-8000-0000000000f2'), 5000::bigint, 'montant a rendre = total paye');
select ok(
  exists (select 1 from public.journal_audit where cible_table = 'commande' and cible_id = '00000000-0000-4000-8000-0000000000f2' and action = 'update' and auteur ->> 'id' = '00000000-0000-0000-0000-0000000000b1'),
  'annulation journalisee avec son auteur'
);
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-870002', 'livree') $$, 'KS_TRANSITION_INTERDITE', 'une Commande annulee n avance plus');
select lives_ok($$ select public.demander_annulation('00000000-0000-0000-0000-0000000000b3', 'KS-2026-870012') $$, 'autre demande ouverte');
select lives_ok($$ select public.annuler_commande(pg_temp.adm(), '00000000-0000-4000-8000-0000000000fc') $$, 'annulation directe avec une demande ouverte');
select is((select statut from public.demande_client where commande_id = '00000000-0000-4000-8000-0000000000fc'), 'acceptee', 'la demande ouverte est close avec l annulation');
select lives_ok($$ select public.annuler_commande(pg_temp.adm(), '00000000-0000-4000-8000-0000000000f5') $$, 'annulation avec anomalie de stock');
select is((select stock from public.variante where produit_id = (select id from public.produit where slug = 'ep-cos2')), 6, 'stock rendu = 2 pieces - 1 piece manquante (5 + 1)');

-- confirmer_remboursement d'un Trop-percu.
select throws_ok($$ select public.confirmer_remboursement(pg_temp.adm(), 'trop_percu', '00000000-0000-4000-8000-0000000000c1', ' ') $$, 'KS_PREUVE_REQUISE', 'Trop-percu sans preuve : refuse');
select throws_ok($$ select public.confirmer_remboursement(pg_temp.ass(), 'trop_percu', '00000000-0000-4000-8000-0000000000c1', 'VIR-TEST-9') $$, 'KS_DROIT_REFUSE', 'un assistant ne rembourse pas un Trop-percu');
select throws_ok($$ select public.confirmer_remboursement(pg_temp.adm(), 'trop_percu', '00000000-0000-4000-8000-0000000000ff', 'VIR-TEST-9') $$, 'KS_TROP_PERCU_INTROUVABLE', 'Trop-percu inconnu');
select lives_ok($$ select public.confirmer_remboursement(pg_temp.adm(), 'trop_percu', '00000000-0000-4000-8000-0000000000c1', 'VIR-TEST-9') $$, 'Trop-percu rembourse avec preuve (25 000 000,50 CDF)');
select is((select montant_cents from public.remboursement where cible_type = 'trop_percu' and cible_id = '00000000-0000-4000-8000-0000000000c1'), 2500000050::bigint, 'montant en centimes sur plus de 32 bits, sans depassement');
select is((select devise from public.remboursement where cible_type = 'trop_percu' and cible_id = '00000000-0000-4000-8000-0000000000c1'), 'CDF', 'devise recue conservee');
select is((select statut from public.trop_percu where id = '00000000-0000-4000-8000-0000000000c1'), 'rembourse', 'Trop-percu clos');
select throws_ok($$ select public.confirmer_remboursement(pg_temp.adm(), 'trop_percu', '00000000-0000-4000-8000-0000000000c1', 'VIR-TEST-9') $$, 'KS_REMBOURSEMENT_IMPOSSIBLE', 'pas de second remboursement');
select throws_ok($$ select public.confirmer_remboursement(pg_temp.adm(), 'trop_percu', '00000000-0000-4000-8000-0000000000c3', 'VIR-TEST-9') $$, 'KS_REMBOURSEMENT_NUL', 'montant nul : refuse');

-- catalogue_decrementer_stock : quantite invalide, reservation active deduite, insuffisant.
select throws_ok($$ select public.catalogue_decrementer_stock((select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc')), 0) $$, 'KS_STOCK_INVALIDE', 'quantite nulle');
select throws_ok($$ select public.catalogue_decrementer_stock((select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc')), 4) $$, 'KS_STOCK_INSUFFISANT', 'plus que le stock');
select throws_ok($$ select public.catalogue_decrementer_stock((select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc')), 2) $$, 'KS_STOCK_INSUFFISANT', 'stock 3 dont 2 reserves : 2 pieces refusees');
select lives_ok($$ select public.catalogue_decrementer_stock((select id from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc')), 1) $$, 'une piece libre : acceptee');

-- Reclamations : une seule par ligne, 48 h, description, etapes.
select is((select array_agg(ligne_id order by ligne_id) from public.lignes_reclamables('00000000-0000-0000-0000-0000000000b3', 'KS-2026-870009')),
  array['00000000-0000-4000-8000-0000000000e9'::uuid, '00000000-0000-4000-8000-0000000000ea'::uuid], 'deux lignes reclamables');
select is((select count(*)::int from public.lignes_reclamables('00000000-0000-0000-0000-0000000000b3', 'KS-2026-870010')), 1, '47 h 59 : encore reclamable');
select is((select count(*)::int from public.lignes_reclamables('00000000-0000-0000-0000-0000000000b3', 'KS-2026-870011')), 0, '48 h 01 : plus reclamable');
select throws_ok(format($$ select public.signaler_probleme('00000000-0000-0000-0000-0000000000b3', 'KS-2026-870009', '00000000-0000-4000-8000-0000000000e9', %L) $$, repeat('x', 2001)), 'KS_DESCRIPTION_REQUISE', 'description de 2001 caracteres refusee');
select lives_ok($$ select public.signaler_probleme('00000000-0000-0000-0000-0000000000b3', 'KS-2026-870009', '00000000-0000-4000-8000-0000000000e9', 'Premier probleme') $$, 'reclamation sur la premiere ligne');
select lives_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000e9'), 'refuser') $$, 'reclamation refusee');
select throws_ok($$ select public.signaler_probleme('00000000-0000-0000-0000-0000000000b3', 'KS-2026-870009', '00000000-0000-4000-8000-0000000000e9', 'Encore') $$, 'KS_RECLAMATION_IMPOSSIBLE', 'ligne refusee : plus reclamable');
select lives_ok($$ select public.signaler_probleme('00000000-0000-0000-0000-0000000000b3', 'KS-2026-870009', '00000000-0000-4000-8000-0000000000ea', 'Second probleme') $$, 'reclamation sur la seconde ligne');
select throws_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000ea'), 'bidule') $$, 'KS_ETAPE_INVALIDE', 'etape inconnue');
select throws_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000ea'), 'accepter', true) $$, 'KS_DEPUIS_STOCK_INVALIDE', 'prise en stock seulement pour le remplacement remis');
select throws_ok($$ select public.traiter_demande(pg_temp.adm(), (select id from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000ea'), 'accepter') $$, 'KS_TYPE_NON_PRIS_EN_CHARGE', 'traiter_demande ne traite pas une reclamation');
select throws_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where commande_id = '00000000-0000-4000-8000-0000000000f1'), 'accepter') $$, 'KS_TYPE_NON_PRIS_EN_CHARGE', 'traiter_reclamation ne traite pas une annulation');
select is((select count(*)::int from public.envoi where donnees ->> 'commande_id' = '00000000-0000-4000-8000-0000000000f9'), 0, 'aucun email de reclamation planifie');

-- Stock a l'annulation : quantite retiree inconnue = rien de rendu et tache « Verifier le stock » ; marquer_stock_verifie : admin seulement, une fois.
select lives_ok($$ select public.annuler_commande(pg_temp.adm(), '00000000-0000-4000-8000-0000000000fd') $$, 'annulation d une Commande dont la quantite retiree est inconnue');
select is((select stock from public.variante where produit_id = (select id from public.produit where slug = 'ep-cos')), 4, 'quantite inconnue : aucun stock rendu automatiquement');
select ok((select stock_a_verifier from public.commande where numero = 'KS-2026-870013'), 'la Commande est marquee « stock a verifier »');
select is((select stock_a_verifier from public.commande where numero = 'KS-2026-870002'), false, 'une quantite connue (ou aucune ligne en stock) : pas de tache');
select throws_ok($$ select public.marquer_stock_verifie(pg_temp.ass(), '00000000-0000-4000-8000-0000000000fd') $$, 'KS_DROIT_REFUSE', 'un assistant ne ferme pas la tache');
select lives_ok($$ select public.marquer_stock_verifie(pg_temp.adm(), '00000000-0000-4000-8000-0000000000fd') $$, 'l admin ferme la tache');
select is((select stock_a_verifier from public.commande where numero = 'KS-2026-870013'), false, 'la tache est fermee');
select throws_ok($$ select public.marquer_stock_verifie(pg_temp.adm(), '00000000-0000-4000-8000-0000000000fd') $$, 'KS_STOCK_DEJA_VERIFIE', 'une seule fermeture');

-- Paiement reel : la quantite reellement retiree est enregistree (1 piece sur 2), puis l'annulation rend exactement 1 piece, jamais 2.
select is((public.confirmer_paiement('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-4000-8000-0000000000d4', 'egal', 100.00, 'USD', 'TEST-EP-TX-0004') ->> 'resultat'), 'payee', 'paiement confirme');
select is((select stock_retire from public.ligne_commande where id = '00000000-0000-4000-8000-0000000000ef'), 1, 'quantite reellement retiree enregistree (1 sur 2)');
select is((select stock from public.variante where produit_id = (select id from public.produit where slug = 'ep-cos3')), 0, 'stock plafonne a zero');
select lives_ok($$ select public.annuler_commande(pg_temp.adm(), '00000000-0000-4000-8000-0000000000fe') $$, 'annulation apres ce paiement');
select is((select stock from public.variante where produit_id = (select id from public.produit where slug = 'ep-cos3')), 1, 'stock rendu : exactement la quantite retiree (0 + 1)');

-- Remplacement : quantite de 1 a la quantite de la ligne, seule cette quantite est decomptee.
select lives_ok($$ select public.signaler_probleme('00000000-0000-0000-0000-0000000000b3', 'KS-2026-870015', '00000000-0000-4000-8000-0000000000f6', 'Trois pieces abimees') $$, 'reclamation sur une ligne de 3 pieces');
select throws_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000f6'), 'accepter', false, 1) $$, 'KS_QUANTITE_INVALIDE', 'quantite refusee hors du remplacement remis');
select lives_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000f6'), 'accepter') $$, 'acceptee');
select lives_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000f6'), 'article_rendu') $$, 'article rendu');
select throws_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000f6'), 'remplacement_remis', true, 0) $$, 'KS_QUANTITE_INVALIDE', 'quantite nulle refusee');
select throws_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000f6'), 'remplacement_remis', true, 4) $$, 'KS_QUANTITE_INVALIDE', 'plus que la quantite de la ligne : refuse');
select is((select stock from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc2')), 5, 'les refus ne decomptent rien');
select lives_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000f6'), 'remplacement_remis', true, 2) $$, 'remplacement de 2 pieces sur 3, pris en stock');
select is((select stock from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc2')), 3, 'seules les 2 pieces remplacees sont decomptees');
select is((select quantite_remplacee from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000f6'), 2, 'quantite remplacee enregistree');
select lives_ok($$ select public.signaler_probleme('00000000-0000-0000-0000-0000000000b3', 'KS-2026-870016', '00000000-0000-4000-8000-0000000000f0', 'Tout est a refaire') $$, 'seconde reclamation sur une ligne de 3 pieces');
select lives_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000f0'), 'accepter') $$, 'acceptee');
select lives_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000f0'), 'article_rendu') $$, 'article rendu');
select lives_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000f0'), 'remplacement_remis') $$, 'remplacement sans quantite : ligne entiere');
select is((select quantite_remplacee from public.demande_client where ligne_id = '00000000-0000-4000-8000-0000000000f0'), 3, 'ligne entiere par defaut (3)');
select is((select stock from public.variante where produit_id = (select id from public.produit where slug = 'ep-acc2')), 3, 'sans prise en stock : le stock ne bouge pas');

select * from finish();
rollback;
