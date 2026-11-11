-- Story 7.5 : émission des Pass. confirmer_paiement émet un Pass par titulaire d'une Commande de Pass payée (un Stand en donne deux), dans la même
-- transaction, une seule fois (rejeu, seconde Tentative, appel direct), puis planifie l'email « pass_emis » une seule fois. Montant insuffisant, trop-perçu,
-- Commande déjà payée, expirée ou échue : aucun Pass, aucun email. Commandes de produits inchangées. Jeton et code court aléatoires, uniques, au bon format.
-- RLS : l'acheteur lit SES Pass, jamais ceux d'un autre Compte ; anon, authenticated et service_role n'écrivent pas. Journal d'audit sans secret.
-- Données TEST_ créées dans la transaction, puis annulées.
-- Exécuté par la CI (Docker) ; en local, `npm run test:sql` explique l'absence de Docker et sort sans erreur.
begin;
select plan(75);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'test-ep1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'test-ep2@example.invalid', '{}');
create function pg_temp.sys() returns jsonb language sql as $$ select '{"type":"systeme","nom":"test"}'::jsonb $$;

-- Événements et Types de pass. ev1 : capacité 10 ; ev2 : autre Événement.
insert into public.evenement (id, auteur_id, titre_fr, slug, publie_le, debut_le, capacite) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-0000000000f1', 'TEST_Festival', 'test-ep-ev1', now() - interval '2 days', now() + interval '30 days', 10),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-0000000000f1', 'TEST_Autre', 'test-ep-ev2', now() - interval '2 days', now() + interval '30 days', null);
insert into public.type_pass (id, evenement_id, nom_fr, nom_en, prix_cents, est_stand) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'TEST_Simple', 'TEST_Simple', 1500, false),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a1', 'TEST_Stand', 'TEST_Stand', 5000, true),
  ('00000000-0000-4000-8000-0000000000b3', '00000000-0000-4000-8000-0000000000a1', 'TEST_VIP', 'TEST_VIP', 3000, false),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000a2', 'TEST_Simple 2', 'TEST_Simple 2', 1500, false);

-- Commandes (f1 sauf mention) : p1 deux Pass Simple ; p2 un Stand (deux Pass) et un VIP ; p3 montant inférieur ; p4 montant supérieur ; p5 déjà payée ;
-- p6 expirée ; p7 en attente mais échue ; p8 Commande de Kit ; p9 Commande de Cosplay en stock. p3 à p9 : Compte f2.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, expire_le) values
  ('00000000-0000-4000-8000-0000000000c1', 'KS-2026-820001', '00000000-0000-0000-0000-0000000000f1', 'pass', 'en_attente', 3000, 3000, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000c2', 'KS-2026-820002', '00000000-0000-0000-0000-0000000000f1', 'pass', 'en_attente', 8000, 8000, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000c3', 'KS-2026-820003', '00000000-0000-0000-0000-0000000000f2', 'pass', 'en_attente', 1500, 1500, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000c4', 'KS-2026-820004', '00000000-0000-0000-0000-0000000000f2', 'pass', 'en_attente', 1500, 1500, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000c5', 'KS-2026-820005', '00000000-0000-0000-0000-0000000000f2', 'pass', 'payee', 1500, 1500, null),
  ('00000000-0000-4000-8000-0000000000c6', 'KS-2026-820006', '00000000-0000-0000-0000-0000000000f2', 'pass', 'expiree', 1500, 1500, now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000c7', 'KS-2026-820007', '00000000-0000-0000-0000-0000000000f2', 'pass', 'en_attente', 1500, 1500, now() - interval '1 minute'),
  ('00000000-0000-4000-8000-0000000000c8', 'KS-2026-820008', '00000000-0000-0000-0000-0000000000f2', 'produits', 'en_attente', 990, 990, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000c9', 'KS-2026-820009', '00000000-0000-0000-0000-0000000000f2', 'produits', 'en_attente', 5000, 5000, now() + interval '1 hour');
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents, type_pass_id, titulaires, pass_nom_fr, pass_nom_en, est_stand) values
  ('00000000-0000-4000-8000-0000000000c1', null, 2, 1500, '00000000-0000-4000-8000-0000000000b1', '["Alice Test", "Bob Test"]', 'TEST_Simple', 'TEST_Simple', false),
  ('00000000-0000-4000-8000-0000000000c2', null, 1, 5000, '00000000-0000-4000-8000-0000000000b2', '["Stand Chef", "Stand Aide"]', 'TEST_Stand', 'TEST_Stand', true),
  ('00000000-0000-4000-8000-0000000000c2', null, 1, 3000, '00000000-0000-4000-8000-0000000000b3', '["Vera Test"]', 'TEST_VIP', 'TEST_VIP', false),
  ('00000000-0000-4000-8000-0000000000c3', null, 1, 1500, '00000000-0000-4000-8000-0000000000b4', '["Cara Test"]', 'TEST_Simple 2', 'TEST_Simple 2', false),
  ('00000000-0000-4000-8000-0000000000c4', null, 1, 1500, '00000000-0000-4000-8000-0000000000b4', '["Dana Test"]', 'TEST_Simple 2', 'TEST_Simple 2', false),
  ('00000000-0000-4000-8000-0000000000c5', null, 1, 1500, '00000000-0000-4000-8000-0000000000b4', '["Eli Test"]', 'TEST_Simple 2', 'TEST_Simple 2', false),
  ('00000000-0000-4000-8000-0000000000c6', null, 1, 1500, '00000000-0000-4000-8000-0000000000b4', '["Fay Test"]', 'TEST_Simple 2', 'TEST_Simple 2', false),
  ('00000000-0000-4000-8000-0000000000c7', null, 1, 1500, '00000000-0000-4000-8000-0000000000b4', '["Gus Test"]', 'TEST_Simple 2', 'TEST_Simple 2', false);

insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'ep-kit', 'K1', 'K1', 990, 'debutant', now() - interval '1 minute');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'ep-cos', 'C', 'C', 5000, 14, now() - interval '1 minute');
create temp table pr as select (select id from public.produit where slug = 'ep-kit') as kit, (select id from public.produit where slug = 'ep-cos') as cos;
grant select on pr to public;
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values ((select cos from pr), 'M', 5, false);
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents) values ('00000000-0000-4000-8000-0000000000c8', (select kit from pr), 1, 990);
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents, variante_id, origine)
  values ('00000000-0000-4000-8000-0000000000c9', (select cos from pr), 1, 5000, (select id from public.variante where produit_id = (select cos from pr) and taille = 'M'), 'stock');

-- Tentatives : une par Commande ; p1 en a une seconde (pour le paiement en double).
insert into public.tentative_paiement (id, commande_id, prestataire, moyen, reference_interne, reference_transaction, montant_attendu_cents) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000c1', 'maishapay', 'carte', 'TEST-EP-REF-0001', 'TEST-EP-TX-0001', 3000),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000c2', 'maishapay', 'carte', 'TEST-EP-REF-0002', 'TEST-EP-TX-0002', 8000),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000c3', 'maishapay', 'carte', 'TEST-EP-REF-0003', 'TEST-EP-TX-0003', 1500),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000c4', 'maishapay', 'carte', 'TEST-EP-REF-0004', 'TEST-EP-TX-0004', 1500),
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-0000000000c5', 'maishapay', 'carte', 'TEST-EP-REF-0005', 'TEST-EP-TX-0005', 1500),
  ('00000000-0000-4000-8000-0000000000e6', '00000000-0000-4000-8000-0000000000c6', 'maishapay', 'carte', 'TEST-EP-REF-0006', 'TEST-EP-TX-0006', 1500),
  ('00000000-0000-4000-8000-0000000000e7', '00000000-0000-4000-8000-0000000000c7', 'maishapay', 'carte', 'TEST-EP-REF-0007', 'TEST-EP-TX-0007', 1500),
  ('00000000-0000-4000-8000-0000000000e8', '00000000-0000-4000-8000-0000000000c8', 'maishapay', 'carte', 'TEST-EP-REF-0008', 'TEST-EP-TX-0008', 990),
  ('00000000-0000-4000-8000-0000000000e9', '00000000-0000-4000-8000-0000000000c9', 'maishapay', 'carte', 'TEST-EP-REF-0009', 'TEST-EP-TX-0009', 5000);
insert into public.tentative_paiement (id, commande_id, prestataire, moyen, reference_interne, reference_transaction, montant_attendu_cents, statut) values
  ('00000000-0000-4000-8000-0000000000ea', '00000000-0000-4000-8000-0000000000c1', 'pawapay', 'carte', 'TEST-EP-REF-0010', 'TEST-EP-TX-0010', 3000, 'abandonnee');

-- Structure et droits.
select has_table('public', 'pass', 'la table pass existe');
select ok((select relrowsecurity from pg_class where oid = 'public.pass'::regclass), 'RLS activée sur pass');
select ok(
  not has_table_privilege('anon', 'public.pass', 'select') and not has_table_privilege('authenticated', 'public.pass', 'insert')
  and not has_table_privilege('authenticated', 'public.pass', 'update') and not has_table_privilege('authenticated', 'public.pass', 'delete'),
  'anon ne lit pas ; authenticated ne peut ni insérer, ni modifier, ni supprimer'
);
select ok(
  has_table_privilege('service_role', 'public.pass', 'select') and not has_table_privilege('service_role', 'public.pass', 'insert')
  and not has_table_privilege('service_role', 'public.pass', 'update') and not has_table_privilege('service_role', 'public.pass', 'delete'),
  'le serveur lit la table mais n''y écrit que par les fonctions'
);
select is(
  (select count(*)::int from unnest(array[
    'public.evenements_emettre_pass(uuid)', 'public.pass_jeton_generer()', 'public.pass_code_court_generer()', 'public.pass_journaliser()', 'public.pass_figer()'
  ]) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or has_function_privilege('service_role', f, 'execute')),
  0, 'les fonctions d''émission sont fermées à tous les rôles client et serveur'
);
select ok(
  has_function_privilege('service_role', 'public.confirmer_paiement(jsonb, uuid, text, numeric, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.confirmer_paiement(jsonb, uuid, text, numeric, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.confirmer_paiement(jsonb, uuid, text, numeric, text, text)', 'execute'),
  'confirmer_paiement reste réservée au serveur'
);
select ok(
  not has_function_privilege('anon', 'public.places_evenement_utilisees(uuid)', 'execute') and has_function_privilege('service_role', 'public.places_evenement_utilisees(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.places_type_pass_utilisees(uuid)', 'execute') and has_function_privilege('service_role', 'public.places_type_pass_utilisees(uuid)', 'execute'),
  'les fonctions de places gardent leurs droits (serveur seulement)'
);

-- Avant le paiement : rien n'est émis, les places viennent des lignes (p1 = 2, p2 = 3).
select is((select count(*)::int from public.pass), 0, 'aucun Pass avant le paiement');
select is(public.places_evenement_utilisees('00000000-0000-4000-8000-0000000000a1'), 5, 'places comptées par les lignes des Commandes en attente (2 + 3)');
select throws_ok($$select public.evenements_emettre_pass('00000000-0000-4000-8000-0000000000c1')$$, 'P0001', 'KS_EMISSION_IMPOSSIBLE', 'émission refusée pour une Commande non payée');
select throws_ok($$select public.evenements_emettre_pass('00000000-0000-4000-8000-0000000000c8')$$, 'P0001', 'KS_EMISSION_IMPOSSIBLE', 'émission refusée pour une Commande de produits');
select throws_ok($$select public.evenements_emettre_pass('00000000-0000-4000-8000-0000000000ff')$$, 'P0001', 'KS_COMMANDE_INTROUVABLE', 'émission refusée pour une Commande inconnue');

-- p1 : montant égal, Commande honorable.
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e1', 'egal', 3000, 'USD', null) ->> 'resultat', 'payee', 'Commande de Pass, montant égal : payée');
select is(
  (select count(*)::int from public.pass where commande_id = '00000000-0000-4000-8000-0000000000c1'), 2, 'deux Pass émis pour deux titulaires'
);
select is(
  (select statut from public.commande where id = '00000000-0000-4000-8000-0000000000c1'), 'payee', 'la Commande de Pass reste « payee » (ni fabrication ni livraison)'
);
select is(
  (select string_agg(nom_titulaire || ':' || rang::text, ',' order by rang) from public.pass where commande_id = '00000000-0000-4000-8000-0000000000c1'),
  'Alice Test:1,Bob Test:2', 'noms figés repris de la ligne, dans l''ordre'
);
select is(
  (select count(*)::int from public.pass where commande_id = '00000000-0000-4000-8000-0000000000c1' and statut = 'valide' and scanne_le is null and scanne_par is null
     and evenement_id = '00000000-0000-4000-8000-0000000000a1' and type_pass_id = '00000000-0000-4000-8000-0000000000b1'),
  2, 'tous les Pass sont valides, non scannés, rattachés à l''Événement et au Type'
);
select is(
  (select r ->> 'pass_emis' from (select public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e1', 'egal', 3000, 'USD', null) as r) x),
  null, 'rejeu de la notification : « deja_traite », rien n''est émis'
);
select is((select count(*)::int from public.pass where commande_id = '00000000-0000-4000-8000-0000000000c1'), 2, 'le rejeu n''ajoute aucun Pass');
select is(public.evenements_emettre_pass('00000000-0000-4000-8000-0000000000c1'), 0, 'appel direct répété : zéro Pass créé');
select is((select count(*)::int from public.pass where commande_id = '00000000-0000-4000-8000-0000000000c1'), 2, 'l''appel direct n''ajoute aucun Pass');

-- Seconde Tentative réussie sur la même Commande : trop-perçu, aucun Pass de plus.
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000ea', 'egal', 3000, 'USD', null) ->> 'motif', 'deja_payee', 'paiement sur une Commande déjà payée : trop-perçu');
select is((select count(*)::int from public.pass where commande_id = '00000000-0000-4000-8000-0000000000c1'), 2, 'le trop-perçu n''émet aucun Pass');

-- Email : planifié une seule fois, identifiants seulement.
select is((select count(*)::int from public.envoi where modele = 'pass_emis' and cle = 'pass_emis:00000000-0000-4000-8000-0000000000c1'), 1, 'un seul email pass_emis planifié');
select is(
  (select donnees::text || '/' || compte_id::text || '/' || statut::text from public.envoi where modele = 'pass_emis' and cle = 'pass_emis:00000000-0000-4000-8000-0000000000c1'),
  '{"commande_id": "00000000-0000-4000-8000-0000000000c1"}/00000000-0000-0000-0000-0000000000f1/a_envoyer', 'l''email ne porte que l''identifiant de la Commande, pour l''acheteur'
);

-- p2 : Stand = 2 Pass, VIP = 1.
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e2', 'egal', 8000, 'USD', null) ->> 'pass_emis', '3', 'Stand + VIP : trois Pass émis');
select is(
  (select string_agg(t.nom_fr || ':' || p.nom_titulaire || ':' || p.rang::text, ',' order by t.nom_fr, p.rang) from public.pass p join public.type_pass t on t.id = p.type_pass_id where p.commande_id = '00000000-0000-4000-8000-0000000000c2'),
  'TEST_Stand:Stand Chef:1,TEST_Stand:Stand Aide:2,TEST_VIP:Vera Test:1', 'un Stand produit deux Pass nominatifs, le VIP un seul'
);
select is((select count(*)::int from public.envoi where modele = 'pass_emis'), 2, 'un email par Commande de Pass payée');

-- Places : une Commande payée est comptée par ses Pass, jamais deux fois (2 + 3).
select is(public.places_evenement_utilisees('00000000-0000-4000-8000-0000000000a1'), 5, 'places : 5 Pass émis, aucun double comptage avec les lignes');
select is(public.places_type_pass_utilisees('00000000-0000-4000-8000-0000000000b1'), 2, 'unités du Type Simple');
select is(public.places_type_pass_utilisees('00000000-0000-4000-8000-0000000000b2'), 1, 'unités du Type Stand : un Stand, pas deux personnes');

-- Cas sans émission.
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e3', 'inferieur', 100, 'USD', null) ->> 'resultat', 'montant_insuffisant', 'montant inférieur : pas payée');
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e4', 'superieur', 2000, 'USD', null) ->> 'motif', 'montant_superieur', 'montant supérieur : trop-perçu');
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e5', 'egal', 1500, 'USD', null) ->> 'motif', 'deja_payee', 'Commande déjà payée : trop-perçu');
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e6', 'egal', 1500, 'USD', null) ->> 'motif', 'expiree', 'Commande expirée : trop-perçu');
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e7', 'egal', 1500, 'USD', null) ->> 'motif', 'reservations_liberees', 'Commande échue : trop-perçu');
select is((select count(*)::int from public.pass where commande_id in (
  '00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-0000000000c5', '00000000-0000-4000-8000-0000000000c6', '00000000-0000-4000-8000-0000000000c7')),
  0, 'montant insuffisant, trop-perçus, payée, expirée, échue : aucun Pass');
select is((select statut from public.commande where id = '00000000-0000-4000-8000-0000000000c3'), 'en_attente', 'montant insuffisant : la Commande reste en attente');
select is((select count(*)::int from public.envoi where modele = 'pass_emis' and cle <> all (array['pass_emis:00000000-0000-4000-8000-0000000000c1', 'pass_emis:00000000-0000-4000-8000-0000000000c2'])), 0, 'aucun email pass_emis pour ces cas');

-- Commandes de produits inchangées : Kit (payée puis livrée, accès, email Kit ouvert) et Cosplay (payée, stock, email Commande payée).
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e8', 'egal', 990, 'USD', null) ->> 'resultat', 'payee', 'Kit : payée');
select is((select statut from public.commande where id = '00000000-0000-4000-8000-0000000000c8'), 'livree', 'Kit : livrée aussitôt (inchangé)');
select is((select count(*)::int from public.envoi where cle = 'kit_ouvert:00000000-0000-4000-8000-0000000000c8:' || (select kit::text from pr)), 1, 'Kit : email « Kit ouvert » planifié (inchangé)');
select is(jsonb_exists(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e9', 'egal', 5000, 'USD', null), 'pass_emis'), false, 'Cosplay : le résultat ne porte pas de clé pass_emis');
select is((select statut from public.commande where id = '00000000-0000-4000-8000-0000000000c9'), 'payee', 'Cosplay : payée');
select is((select stock from public.variante where produit_id = (select cos from pr) and taille = 'M'), 4, 'Cosplay : stock décompté (inchangé)');
select is((select count(*)::int from public.envoi where cle = 'commande_payee:00000000-0000-4000-8000-0000000000c9'), 1, 'Cosplay : email « Commande payée » planifié (inchangé)');
select is((select count(*)::int from public.pass where commande_id in ('00000000-0000-4000-8000-0000000000c8', '00000000-0000-4000-8000-0000000000c9')), 0, 'aucune Commande de produits n''émet de Pass');

-- Jeton et code court : format, unicité, indépendance.
select is((select count(*)::int from public.pass where jeton ~ '^[0-9a-f]{48}$' and code_court ~ '^[A-HJ-NP-Z2-9]{8}$' and code_court !~ '[IO01]'), 5, 'jeton de 48 caractères hexadécimaux, code court de 8 caractères sans I, O, 0, 1');
select is((select count(distinct jeton)::int from public.pass) || '/' || (select count(distinct code_court)::int from public.pass), '5/5', 'jetons et codes courts tous différents');
select is((select count(*)::int from public.pass where position(replace(id::text, '-', '') in jeton) > 0 or position(upper(code_court) in upper(jeton)) > 0 or position(substr(replace(id::text, '-', ''), 1, 12) in jeton) > 0), 0, 'le jeton ne contient ni l''identifiant du Pass ni son code court');
select is((select count(distinct substr(jeton, 1, 8))::int from public.pass), 5, 'aucun préfixe commun entre les jetons : pas de suite prévisible');
select is((select count(distinct public.pass_jeton_generer())::int from generate_series(1, 300)), 300, 'générateur de jeton : 300 tirages, 300 valeurs différentes');
select is((select count(distinct public.pass_code_court_generer())::int from generate_series(1, 300)), 300, 'générateur de code court : 300 tirages, 300 valeurs différentes');
select is((select count(*)::int from (select public.pass_code_court_generer() as c from generate_series(1, 300)) x where c ~ '^[A-HJ-NP-Z2-9]{8}$'), 300, 'générateur de code court : toujours 8 caractères du bon alphabet');
select throws_ok(
  $$insert into public.pass (evenement_id, type_pass_id, commande_id, ligne_commande_id, rang, nom_titulaire, jeton, code_court)
    select evenement_id, type_pass_id, commande_id, ligne_commande_id, 9, 'Doublon Test', jeton, 'ZZZZZZZZ' from public.pass limit 1$$,
  '23505', null, 'un jeton déjà utilisé est refusé (unicité)'
);
select throws_ok(
  $$insert into public.pass (evenement_id, type_pass_id, commande_id, ligne_commande_id, rang, nom_titulaire, jeton, code_court)
    select evenement_id, type_pass_id, commande_id, ligne_commande_id, rang, 'Doublon Test', repeat('a', 48), 'ZZZZZZZZ' from public.pass where nom_titulaire = 'Alice Test'$$,
  '23505', null, 'un même rang de la même ligne est refusé (unicité ligne et rang)'
);

-- Un Pass ne change pas d'identité.
select throws_ok($$update public.pass set nom_titulaire = 'Autre Nom' where commande_id = '00000000-0000-4000-8000-0000000000c1' and rang = 1$$, 'P0001', 'KS_PASS_FIGE', 'le nom du titulaire est figé');
select throws_ok($$update public.pass set jeton = repeat('b', 48) where commande_id = '00000000-0000-4000-8000-0000000000c1' and rang = 1$$, 'P0001', 'KS_PASS_FIGE', 'le jeton est figé');
select throws_ok($$update public.pass set statut = 'scanne' where commande_id = '00000000-0000-4000-8000-0000000000c1' and rang = 1$$, '23514', null, 'un Pass « scanné » exige sa date de scan');

-- Journal d'audit : présent, sans jeton, code court ni nom.
select is((select count(*)::int from public.journal_audit where cible_table = 'pass' and action = 'insert'), 5, 'cinq émissions journalisées');
select is(
  (select count(*)::int from public.journal_audit j join public.pass p on p.id::text = j.cible_id
   where j.cible_table = 'pass' and (j.apres::text like '%' || p.jeton || '%' or j.apres::text like '%' || p.code_court || '%' or j.apres::text like '%' || p.nom_titulaire || '%' or j.avant::text like '%' || p.nom_titulaire || '%')),
  0, 'le journal ne contient ni jeton, ni code court, ni nom de titulaire'
);

-- Un Pass annulé libère sa place (la story 7.9 posera ce statut ; la règle de comptage est posée ici).
update public.pass set statut = 'annule' where commande_id = '00000000-0000-4000-8000-0000000000c1' and rang = 2;
select is(public.places_evenement_utilisees('00000000-0000-4000-8000-0000000000a1'), 4, 'un Pass annulé ne compte plus dans la Capacité');
select is(public.places_type_pass_utilisees('00000000-0000-4000-8000-0000000000b1'), 1, 'ni dans le quota de son Type');
update public.pass set statut = 'valide' where commande_id = '00000000-0000-4000-8000-0000000000c1' and rang = 2;

-- Correctif de revue : les Pass d'une Commande annulée ou remboursée ne comptent plus, même si leur propre statut est encore « valide ».
update public.commande set statut = 'annulee' where id = '00000000-0000-4000-8000-0000000000c1';
select is(public.places_evenement_utilisees('00000000-0000-4000-8000-0000000000a1'), 3, 'Commande de Pass payée puis annulée : ses 2 places sont libérées (Capacité)');
select is(public.places_type_pass_utilisees('00000000-0000-4000-8000-0000000000b1'), 0, 'Commande annulée : le quota du Type est libéré');
update public.commande set statut = 'remboursee' where id = '00000000-0000-4000-8000-0000000000c1';
select is(public.places_evenement_utilisees('00000000-0000-4000-8000-0000000000a1'), 3, 'Commande remboursée : places libérées (Capacité)');
select is(public.places_type_pass_utilisees('00000000-0000-4000-8000-0000000000b1'), 0, 'Commande remboursée : quota du Type libéré');
update public.commande set statut = 'payee' where id = '00000000-0000-4000-8000-0000000000c1';

-- RLS : l'acheteur lit SES Pass, jamais ceux d'un autre Compte ; aucune écriture client.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select is((select count(*)::int from public.pass), 5, 'l''acheteur lit ses 5 Pass');
select is((select count(*)::int from public.pass where commande_id = '00000000-0000-4000-8000-0000000000c3'), 0, 'et rien d''autre');
select throws_ok($$update public.pass set statut = 'annule'$$, '42501', null, 'authenticated ne modifie aucun Pass');
select throws_ok($$delete from public.pass$$, '42501', null, 'authenticated ne supprime aucun Pass');
select throws_ok(
  $$insert into public.pass (evenement_id, type_pass_id, commande_id, ligne_commande_id, rang, nom_titulaire, jeton, code_court)
    values ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000c1', gen_random_uuid(), 7, 'Intrus Test', repeat('c', 48), 'YYYYYYYY')$$,
  '42501', null, 'authenticated ne crée aucun Pass'
);
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated"}';
select is((select count(*)::int from public.pass), 0, 'un autre Compte ne lit aucun Pass d''autrui');
reset role;
set local role anon;
select throws_ok($$select count(*) from public.pass$$, '42501', null, 'anon ne lit aucun Pass');
reset role;
set local role service_role;
select throws_ok($$update public.pass set statut = 'annule'$$, '42501', null, 'le serveur n''écrit pas directement dans la table');
reset role;

select * from finish();
rollback;
