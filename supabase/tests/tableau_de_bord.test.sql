-- Story 9.8, partie 1 : agrégats du tableau de bord. Exécutables par service_role seulement (jamais anon ni authenticated), droit
-- Admin revérifié en base, aucune donnée de client, Commandes annulées et remboursées exclues, forfait de livraison compté, jour à
-- Goma, échecs séparés par cause. Données TEST_ annulées à la fin.
begin;
select plan(20);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'test-tb-admin@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'test-tb-assistant@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f3', 'test-tb-client@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 'assistant');
create function pg_temp.c(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;

insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'tb-cos', 'TEST_Cosplay', 'TEST_Cosplay', 5000, 14, now() - interval '1 day');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'tb-kit', 'TEST_Kit', 'TEST_Kit', 1000, 'debutant', now() - interval '1 day');
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values
  ((select id from public.produit where slug = 'tb-cos'), 'sur_mesure', 0, true);
create function pg_temp.cos() returns uuid language sql as $$ select id from public.produit where slug = 'tb-cos' $$;
create function pg_temp.kit() returns uuid language sql as $$ select id from public.produit where slug = 'tb-kit' $$;
create function pg_temp.sm() returns uuid language sql as $$ select id from public.variante where produit_id = pg_temp.cos() and taille = 'sur_mesure' $$;

-- C1 payée il y a 50 h (cosplay sur mesure + kit), C2 payée (kit), C3 remboursée et C6 annulée (exclues), C4 en attente (exclue),
-- C5 payée (cosplay sur mesure livré à Goma, forfait 500, mesures pas encore reçues), C7 payée en janvier 2026 à 22 h 30 UTC (kit).
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, forfait_cents, total_cents, paye_le, prestataire, zone, mode_remise) values
  ('00000000-0000-4000-8000-0000000000c1', 'KS-2026-890001', '00000000-0000-0000-0000-0000000000f3', 'produits', 'payee', 6000, 0, 6000, now() - interval '50 hours', 'maishapay', null, null),
  ('00000000-0000-4000-8000-0000000000c2', 'KS-2026-890002', '00000000-0000-0000-0000-0000000000f3', 'produits', 'payee', 1000, 0, 1000, now() - interval '10 minutes', 'pawapay', null, null),
  ('00000000-0000-4000-8000-0000000000c3', 'KS-2026-890003', '00000000-0000-0000-0000-0000000000f3', 'produits', 'remboursee', 5000, 0, 5000, now() - interval '20 minutes', 'maishapay', null, null),
  ('00000000-0000-4000-8000-0000000000c4', 'KS-2026-890004', '00000000-0000-0000-0000-0000000000f3', 'produits', 'en_attente', 1000, 0, 1000, null, null, null, null),
  ('00000000-0000-4000-8000-0000000000c5', 'KS-2026-890005', '00000000-0000-0000-0000-0000000000f3', 'produits', 'payee', 5000, 500, 5500, now() - interval '5 minutes', 'maishapay', 'goma', 'livraison'),
  ('00000000-0000-4000-8000-0000000000c6', 'KS-2026-890006', '00000000-0000-0000-0000-0000000000f3', 'produits', 'annulee', 1000, 0, 1000, now() - interval '15 minutes', 'maishapay', null, null),
  ('00000000-0000-4000-8000-0000000000c7', 'KS-2026-890007', '00000000-0000-0000-0000-0000000000f3', 'produits', 'payee', 1000, 0, 1000, '2026-01-10 22:30:00+00', 'pawapay', null, null);
insert into public.ligne_commande (commande_id, produit_id, variante_id, origine, nombre, prix_cents, mesures_recues_le) values
  ('00000000-0000-4000-8000-0000000000c1', pg_temp.cos(), pg_temp.sm(), 'fabrication', 1, 5000, now() - interval '2 hours'),
  ('00000000-0000-4000-8000-0000000000c3', pg_temp.cos(), pg_temp.sm(), 'fabrication', 1, 5000, null),
  ('00000000-0000-4000-8000-0000000000c5', pg_temp.cos(), pg_temp.sm(), 'fabrication', 1, 5000, null);
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents) values
  ('00000000-0000-4000-8000-0000000000c1', pg_temp.kit(), 1, 1000),
  ('00000000-0000-4000-8000-0000000000c2', pg_temp.kit(), 1, 1000),
  ('00000000-0000-4000-8000-0000000000c4', pg_temp.kit(), 1, 1000),
  ('00000000-0000-4000-8000-0000000000c6', pg_temp.kit(), 1, 1000),
  ('00000000-0000-4000-8000-0000000000c7', pg_temp.kit(), 1, 1000);

-- Tentatives. MaishaPay carte : une réussie, un échec du client, un échec du Prestataire, une abandonnée.
-- PawaPay mobile money : deux réussies (dont celle de C4, débit confirmé mais trop-perçu : la Commande reste non payée).
insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents, statut, cause) values
  ('00000000-0000-4000-8000-0000000000c1', 'maishapay', 'carte', 'TEST-TB-0001', 6000, 'reussie', null),
  ('00000000-0000-4000-8000-0000000000c4', 'maishapay', 'carte', 'TEST-TB-0002', 1000, 'echouee', 'client'),
  ('00000000-0000-4000-8000-0000000000c6', 'maishapay', 'carte', 'TEST-TB-0003', 1000, 'echouee', 'prestataire'),
  ('00000000-0000-4000-8000-0000000000c3', 'maishapay', 'carte', 'TEST-TB-0004', 5000, 'abandonnee', null),
  ('00000000-0000-4000-8000-0000000000c2', 'pawapay', 'mobile_money', 'TEST-TB-0005', 1000, 'reussie', null),
  ('00000000-0000-4000-8000-0000000000c4', 'pawapay', 'mobile_money', 'TEST-TB-0006', 1000, 'reussie', null);
insert into public.trop_percu (commande_id, tentative_id, motif, montant_attendu_cents, montant_recu, devise_recue)
  values ('00000000-0000-4000-8000-0000000000c4', (select id from public.tentative_paiement where reference_interne = 'TEST-TB-0006'), 'montant_superieur', 1000, 1500, 'USD');

-- Droits : service_role seulement, jamais anon ni authenticated ; droit Admin revérifié en base.
select is(
  (select count(*)::int from unnest(array[
    'public.tableau_commandes_payees(jsonb, timestamptz)', 'public.tableau_paiements(jsonb, timestamptz)', 'public.tableau_echecs_paiement(jsonb, timestamptz)',
    'public.tableau_delai_mesures(jsonb, timestamptz)', 'public.tableau_trop_percus(jsonb)'
  ]) f where not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute')),
  5, 'les 5 fonctions du tableau de bord : service_role seulement'
);
select is(
  (select count(*)::int from pg_proc where proname like 'tableau\_%' and pronamespace = 'public'::regnamespace and prosecdef and proconfig @> array['search_path=""']),
  5, 'SECURITY DEFINER, search_path fixé'
);
set local role anon;
select throws_ok($$select * from public.tableau_paiements('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1"}'::jsonb, null)$$, '42501', null, 'anon ne peut rien exécuter');
reset role;
set local role authenticated;
select throws_ok($$select * from public.tableau_commandes_payees('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1"}'::jsonb, null)$$, '42501', null, 'authenticated ne peut rien exécuter');
reset role;
select throws_ok($$select * from public.tableau_commandes_payees(pg_temp.c('f2'), null)$$, 'P0001', 'KS_DROIT_REFUSE', 'l''Assistant n''a pas le droit chiffre_affaires.voir');
select throws_ok($$select * from public.tableau_trop_percus(pg_temp.c('f3'))$$, 'P0001', 'KS_DROIT_REFUSE', 'un client est refusé');

-- Nouvelles Commandes payées : numéro, montant, Prestataire, Familles ; rien d'autre (aucun Compte, email, téléphone, adresse).
select is(
  (select proargnames from pg_proc where oid = 'public.tableau_commandes_payees(jsonb, timestamptz)'::regprocedure),
  array['p_auteur', 'p_depuis', 'numero', 'total_cents', 'prestataire', 'familles']::text[],
  'commandes payées : numéro, montant, Prestataire, Familles uniquement'
);
select results_eq(
  $$select numero from public.tableau_commandes_payees(pg_temp.c('f1'), now() - interval '1 hour')$$,
  array['KS-2026-890005', 'KS-2026-890002'],
  'depuis une heure : payées seulement, la plus récente d''abord (remboursée, annulée, en attente exclues)'
);
select is(
  (select total_cents || '|' || prestataire || '|' || array_to_string(familles, ',') from public.tableau_commandes_payees(pg_temp.c('f1'), now() - interval '3 days') where numero = 'KS-2026-890001'),
  '6000|maishapay|cosplay,kit', 'Commande mixte : ses deux Familles'
);

-- Paiements par jour, Prestataire et Famille.
select is((select sum(montant_cents)::int from public.tableau_paiements(pg_temp.c('f1'), now() - interval '3 days') where famille = 'cosplay'), 10000, 'cosplay : C1 + C5, remboursée exclue');
select is((select sum(montant_cents)::int || '|' || sum(commandes)::int from public.tableau_paiements(pg_temp.c('f1'), now() - interval '3 days') where famille = 'kit'), '2000|2', 'kit : deux Commandes, annulée exclue');
select is((select sum(montant_cents)::int from public.tableau_paiements(pg_temp.c('f1'), now() - interval '3 days') where famille = 'livraison'), 500, 'forfait de livraison compté à part');
select is(
  (select sum(montant_cents)::int from public.tableau_paiements(pg_temp.c('f1'), now() - interval '3 days')),
  (select sum(total_cents)::int from public.tableau_commandes_payees(pg_temp.c('f1'), now() - interval '3 days')),
  'la somme des paiements égale la somme des totaux payés'
);
select is(
  (select string_agg(jour::text, ',') from public.tableau_paiements(pg_temp.c('f1'), '2026-01-01 00:00:00+00') where jour < '2026-02-01'),
  '2026-01-11', 'payée à 22 h 30 UTC le 10 janvier : comptée le 11 à Goma'
);
select is((select sum(montant_cents)::int from public.tableau_paiements(pg_temp.c('f1'), null) where famille = 'kit'), 2000, 'sans date : 30 jours pleins (janvier exclu)');

-- Taux d'échec par Agrégateur, échecs séparés par cause.
select is(
  (select tentatives || '|' || reussies || '|' || echouees_client || '|' || echouees_prestataire || '|' || abandonnees || '|' || en_cours
   from public.tableau_echecs_paiement(pg_temp.c('f1'), now() - interval '1 day') where prestataire = 'maishapay' and moyen = 'carte'),
  '4|1|1|1|1|0', 'MaishaPay carte : réussie, échec du client, échec du Prestataire, abandonnée'
);
select is((select reussies from public.tableau_echecs_paiement(pg_temp.c('f1'), now() - interval '1 day') where prestataire = 'pawapay'), 2, 'PawaPay : deux débits confirmés');

-- Délai de réception des mesures : C1 reçue 48 h après le paiement, C5 en attente, C3 remboursée exclue.
select is(
  (select lignes_recues || '|' || lignes_en_attente || '|' || delai_moyen_heures from public.tableau_delai_mesures(pg_temp.c('f1'), now() - interval '3 days')),
  '1|1|48.0', 'mesures : une reçue en 48 h, une en attente'
);

-- Trop-perçus à rembourser, par motif.
select is((select motif || '|' || a_rembourser from public.tableau_trop_percus(pg_temp.c('f1'))), 'montant_superieur|1', 'un trop-perçu à rembourser');
select is(
  (select proargnames from pg_proc where oid = 'public.tableau_trop_percus(jsonb)'::regprocedure),
  array['p_auteur', 'motif', 'a_rembourser', 'plus_ancien_le']::text[],
  'trop-perçus : aucun montant reçu ni Commande'
);

select * from finish();
rollback;
