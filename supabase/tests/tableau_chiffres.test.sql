-- Story 9.16 c) : cartes de chiffres du tableau de bord et « Événements et Pass vendus » (tableau_chiffres). Exécutable par service_role
-- seulement, droit Admin revérifié en base, que des agrégats. Les comptes sont mesurés en écart avec l'état de la base avant les données
-- TEST_ (la base de la CI peut déjà contenir des lignes). Données TEST_ annulées à la fin.
begin;
select plan(14);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-tc-admin@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-tc-assistant@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e3', 'test-tc-client@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e2', 'assistant');
create function pg_temp.c(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;

-- État avant les données TEST_.
create temp table avant as select * from public.tableau_chiffres(pg_temp.c('e1'));
create function pg_temp.ecart(p_colonne text) returns bigint language plpgsql as $$
declare v_apres bigint; v_avant bigint;
begin
  execute format('select %I::bigint from public.tableau_chiffres(pg_temp.c(''e1''))', p_colonne) into v_apres;
  execute format('select %I::bigint from avant', p_colonne) into v_avant;
  return v_apres - v_avant;
end;
$$;

-- Droits : service_role seulement, jamais anon ni authenticated ; SECURITY DEFINER, search_path fixé ; Admin seulement.
select ok(
  has_function_privilege('service_role', 'public.tableau_chiffres(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.tableau_chiffres(jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.tableau_chiffres(jsonb)', 'execute'),
  'tableau_chiffres : service_role seulement'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.tableau_chiffres(jsonb)'::regprocedure),
  'SECURITY DEFINER, search_path fixé'
);
set local role anon;
select throws_ok($$select * from public.tableau_chiffres('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1"}'::jsonb)$$, '42501', null, 'anon ne peut pas l''exécuter');
reset role;
set local role authenticated;
select throws_ok($$select * from public.tableau_chiffres('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1"}'::jsonb)$$, '42501', null, 'authenticated ne peut pas l''exécuter');
reset role;
select throws_ok($$select * from public.tableau_chiffres(pg_temp.c('e2'))$$, 'P0001', 'KS_DROIT_REFUSE', 'l''Assistant est refusé');
select throws_ok($$select * from public.tableau_chiffres(pg_temp.c('e3'))$$, 'P0001', 'KS_DROIT_REFUSE', 'un client est refusé');

-- Que des agrégats : aucune colonne de Compte, de client ou de titulaire.
select is(
  (select proargnames from pg_proc where oid = 'public.tableau_chiffres(jsonb)'::regprocedure),
  array['p_auteur', 'produits_publies', 'commandes_payees', 'revenu_cents', 'tentatives_reussies', 'tentatives_terminees', 'evenements_a_venir', 'pass_7', 'pass_30']::text[],
  'que des compteurs et un montant'
);

-- Produits : deux publiés (cosplay, kit), un brouillon, un à publication programmée (publie_le dans le futur : pas encore publié).
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'tc-cos', 'TEST_Cosplay', 'TEST_Cosplay', 5000, 14, now() - interval '1 day'),
  ('cosplay', 'tc-brouillon', 'TEST_Brouillon', 'TEST_Brouillon', 5000, 14, null),
  ('cosplay', 'tc-programme', 'TEST_Programme', 'TEST_Programme', 5000, 14, now() + interval '1 day');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'tc-kit', 'TEST_Kit', 'TEST_Kit', 1000, 'debutant', now() - interval '1 day');

-- Événements : E1 (début à venir, sans fin) et E2 (commencé, fin à venir) comptent ; E3 passé, E4 brouillon, E5 publication programmée,
-- E6 sans date : non comptés.
insert into public.evenement (id, auteur_id, titre_fr, slug, publie_le, debut_le, fin_le) values
  ('00000000-0000-4000-8000-0000000003a1', '00000000-0000-0000-0000-0000000000e1', 'TEST_E1', 'tc-e1', now() - interval '2 days', now() + interval '3 days', null),
  ('00000000-0000-4000-8000-0000000003a2', '00000000-0000-0000-0000-0000000000e1', 'TEST_E2', 'tc-e2', now() - interval '2 days', now() - interval '1 hour', now() + interval '5 hours'),
  ('00000000-0000-4000-8000-0000000003a3', '00000000-0000-0000-0000-0000000000e1', 'TEST_E3', 'tc-e3', now() - interval '9 days', now() - interval '3 days', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000003a4', '00000000-0000-0000-0000-0000000000e1', 'TEST_E4', 'tc-e4', null, now() + interval '3 days', null),
  ('00000000-0000-4000-8000-0000000003a5', '00000000-0000-0000-0000-0000000000e1', 'TEST_E5', 'tc-e5', now() + interval '1 day', now() + interval '3 days', null),
  ('00000000-0000-4000-8000-0000000003a6', '00000000-0000-0000-0000-0000000000e1', 'TEST_E6', 'tc-e6', now() - interval '2 days', null, null);
insert into public.type_pass (id, evenement_id, nom_fr, nom_en, prix_cents) values
  ('00000000-0000-4000-8000-0000000003b1', '00000000-0000-4000-8000-0000000003a1', 'TEST_VIP', 'TEST_VIP', 3000);

-- Commandes : K1 payée (livraison 500 comprise), K2 annulée, K3 remboursée, K4 en attente ; Pass : Q1 payée aujourd'hui, Q2 payée il y a 10 jours,
-- Q3 payée aujourd'hui (Pass annulé), Q4 remboursée, Q5 payée il y a 40 jours. Bornes : Q6 payée à minuit à Goma il y a 6 jours (comptée en 7 j),
-- Q7 une minute avant (30 j seulement), Q8 à minuit il y a 29 jours (comptée en 30 j), Q9 une minute avant (non comptée).
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, forfait_cents, total_cents, paye_le, prestataire, zone, mode_remise) values
  ('00000000-0000-4000-8000-0000000003c1', 'KS-2026-880001', '00000000-0000-0000-0000-0000000000e3', 'produits', 'payee', 5000, 500, 5500, now() - interval '5 minutes', 'maishapay', 'goma', 'livraison'),
  ('00000000-0000-4000-8000-0000000003c2', 'KS-2026-880002', '00000000-0000-0000-0000-0000000000e3', 'produits', 'annulee', 1000, 0, 1000, now() - interval '15 minutes', 'maishapay', null, null),
  ('00000000-0000-4000-8000-0000000003c3', 'KS-2026-880003', '00000000-0000-0000-0000-0000000000e3', 'produits', 'remboursee', 2000, 0, 2000, now() - interval '20 minutes', 'maishapay', null, null),
  ('00000000-0000-4000-8000-0000000003c4', 'KS-2026-880004', '00000000-0000-0000-0000-0000000000e3', 'produits', 'en_attente', 1000, 0, 1000, null, null, null, null);
insert into public.commande (id, numero, compte_id, type, statut, offerte, sous_total_cents, total_cents, paye_le) values
  ('00000000-0000-4000-8000-0000000003d1', 'KS-2026-880011', '00000000-0000-0000-0000-0000000000e3', 'pass', 'payee', false, 3000, 3000, now() - interval '1 minute'),
  ('00000000-0000-4000-8000-0000000003d2', 'KS-2026-880012', '00000000-0000-0000-0000-0000000000e3', 'pass', 'payee', false, 3000, 3000, now() - interval '10 days'),
  ('00000000-0000-4000-8000-0000000003d3', 'KS-2026-880013', '00000000-0000-0000-0000-0000000000e3', 'pass', 'payee', false, 3000, 3000, now() - interval '2 minutes'),
  ('00000000-0000-4000-8000-0000000003d4', 'KS-2026-880014', '00000000-0000-0000-0000-0000000000e3', 'pass', 'remboursee', false, 3000, 3000, now() - interval '3 minutes'),
  ('00000000-0000-4000-8000-0000000003d5', 'KS-2026-880015', '00000000-0000-0000-0000-0000000000e3', 'pass', 'payee', false, 3000, 3000, now() - interval '40 days'),
  ('00000000-0000-4000-8000-0000000003d6', 'KS-2026-880016', '00000000-0000-0000-0000-0000000000e3', 'pass', 'payee', false, 3000, 3000, public.minuit_goma(6)),
  ('00000000-0000-4000-8000-0000000003d7', 'KS-2026-880017', '00000000-0000-0000-0000-0000000000e3', 'pass', 'payee', false, 3000, 3000, public.minuit_goma(6) - interval '1 minute'),
  ('00000000-0000-4000-8000-0000000003d8', 'KS-2026-880018', '00000000-0000-0000-0000-0000000000e3', 'pass', 'payee', false, 3000, 3000, public.minuit_goma(29)),
  ('00000000-0000-4000-8000-0000000003d9', 'KS-2026-880019', '00000000-0000-0000-0000-0000000000e3', 'pass', 'payee', false, 3000, 3000, public.minuit_goma(29) - interval '1 minute');
insert into public.ligne_commande (id, commande_id, produit_id, nombre, prix_cents, type_pass_id, titulaires, pass_nom_fr, pass_nom_en, est_stand)
select ('00000000-0000-4000-8000-0000000003e' || n)::uuid, ('00000000-0000-4000-8000-0000000003d' || n)::uuid, null, 1, 3000,
  '00000000-0000-4000-8000-0000000003b1'::uuid, '["x"]'::jsonb, 'TEST_VIP', 'TEST_VIP', false
from generate_series(1, 9) n;
insert into public.pass (evenement_id, type_pass_id, commande_id, ligne_commande_id, rang, nom_titulaire, statut, jeton, code_court, scanne_le) values
  ('00000000-0000-4000-8000-0000000003a1', '00000000-0000-4000-8000-0000000003b1', '00000000-0000-4000-8000-0000000003d1', '00000000-0000-4000-8000-0000000003e1', 1, 'TEST Un', 'valide', repeat('a1', 24), 'QQQQQQQ2', null),
  ('00000000-0000-4000-8000-0000000003a1', '00000000-0000-4000-8000-0000000003b1', '00000000-0000-4000-8000-0000000003d2', '00000000-0000-4000-8000-0000000003e2', 1, 'TEST Deux', 'scanne', repeat('a2', 24), 'QQQQQQQ3', now()),
  ('00000000-0000-4000-8000-0000000003a1', '00000000-0000-4000-8000-0000000003b1', '00000000-0000-4000-8000-0000000003d3', '00000000-0000-4000-8000-0000000003e3', 1, 'TEST Trois', 'annule', repeat('a3', 24), 'QQQQQQQ4', null),
  ('00000000-0000-4000-8000-0000000003a1', '00000000-0000-4000-8000-0000000003b1', '00000000-0000-4000-8000-0000000003d4', '00000000-0000-4000-8000-0000000003e4', 1, 'TEST Quatre', 'valide', repeat('a4', 24), 'QQQQQQQ5', null),
  ('00000000-0000-4000-8000-0000000003a1', '00000000-0000-4000-8000-0000000003b1', '00000000-0000-4000-8000-0000000003d5', '00000000-0000-4000-8000-0000000003e5', 1, 'TEST Cinq', 'valide', repeat('a5', 24), 'QQQQQQQ6', null),
  ('00000000-0000-4000-8000-0000000003a1', '00000000-0000-4000-8000-0000000003b1', '00000000-0000-4000-8000-0000000003d6', '00000000-0000-4000-8000-0000000003e6', 1, 'TEST Six', 'valide', repeat('a6', 24), 'QQQQQQQ7', null),
  ('00000000-0000-4000-8000-0000000003a1', '00000000-0000-4000-8000-0000000003b1', '00000000-0000-4000-8000-0000000003d7', '00000000-0000-4000-8000-0000000003e7', 1, 'TEST Sept', 'valide', repeat('a7', 24), 'QQQQQQQ8', null),
  ('00000000-0000-4000-8000-0000000003a1', '00000000-0000-4000-8000-0000000003b1', '00000000-0000-4000-8000-0000000003d8', '00000000-0000-4000-8000-0000000003e8', 1, 'TEST Huit', 'valide', repeat('a8', 24), 'QQQQQQQ9', null),
  ('00000000-0000-4000-8000-0000000003a1', '00000000-0000-4000-8000-0000000003b1', '00000000-0000-4000-8000-0000000003d9', '00000000-0000-4000-8000-0000000003e9', 1, 'TEST Neuf', 'valide', repeat('a9', 24), 'QQQQQQRA', null);

-- Tentatives : deux réussies, un échec, une abandonnée (terminées : 4) et une en cours (non terminée).
insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents, statut, cause) values
  ('00000000-0000-4000-8000-0000000003c1', 'maishapay', 'carte', 'TEST-TC-0001', 5500, 'reussie', null),
  ('00000000-0000-4000-8000-0000000003d1', 'pawapay', 'mobile_money', 'TEST-TC-0002', 3000, 'reussie', null),
  ('00000000-0000-4000-8000-0000000003c4', 'maishapay', 'carte', 'TEST-TC-0003', 1000, 'echouee', 'client'),
  ('00000000-0000-4000-8000-0000000003c2', 'maishapay', 'carte', 'TEST-TC-0004', 1000, 'abandonnee', null),
  ('00000000-0000-4000-8000-0000000003c4', 'pawapay', 'mobile_money', 'TEST-TC-0005', 1000, 'en_cours', null);

select is(pg_temp.ecart('produits_publies'), 2::bigint, 'produits publiés : toutes Familles, brouillon et publication programmée exclus');
select is(pg_temp.ecart('commandes_payees'), 9::bigint, 'commandes payées : produits et Pass, annulées, remboursées et en attente exclues');
select is(pg_temp.ecart('revenu_cents'), 29500::bigint, 'revenu : total payé, livraison comprise');
select is(pg_temp.ecart('tentatives_reussies') || '|' || pg_temp.ecart('tentatives_terminees'), '2|4', 'paiements : 2 réussies sur 4 terminées (en cours exclue)');
select is(pg_temp.ecart('evenements_a_venir'), 2::bigint, 'événements publiés à venir : fin ou début dans le futur');
select is(pg_temp.ecart('pass_7'), 2::bigint, 'Pass vendus sur 7 jours : payé aujourd''hui et payé à minuit il y a 6 jours (une minute avant, annulé, remboursé, ancien exclus)');
select is(pg_temp.ecart('pass_30'), 5::bigint, 'Pass vendus sur 30 jours : scanné il y a 10 jours, bornes 6 jours, minuit il y a 29 jours (une minute avant exclu)');

select * from finish();
rollback;
