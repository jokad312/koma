-- Story 4.8 : confirmer_paiement, seule porte vers « payee » (AD-4). Rejeu sans effet ; montant égal → payée (livrée si 100 % numérique, stock, Kits,
-- emails, Panier vidé) ; inférieur → anomalie ; supérieur, Commande déjà payée, expirée ou aux réservations libérées → trop-perçu ; Kit déjà possédé ;
-- deux Tentatives réussies → la seconde est un trop-perçu. Notifications, lot de réconciliation, abandon. Données TEST_ créées dans la transaction, puis annulées.
begin;
select plan(62);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'test-cp1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', 'test-cp2@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b1', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b2', 25);
create function pg_temp.sys() returns jsonb language sql as $$ select '{"type":"systeme","nom":"test"}'::jsonb $$;

insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'cp-kit', 'K1', 'K1', 990, 'debutant', now() - interval '1 minute'),
  ('kit', 'cp-kit2', 'K2', 'K2', 500, 'debutant', now() - interval '1 minute');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'cp-cos', 'C', 'C', 5000, 14, now() - interval '1 minute');
create temp table pr as select
  (select id from public.produit where slug = 'cp-kit') as kit,
  (select id from public.produit where slug = 'cp-kit2') as kit2,
  (select id from public.produit where slug = 'cp-cos') as cos;
grant select on pr to public;
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values ((select cos from pr), 'M', 5, false);

-- Commandes (a1 sauf mention) : c1 kit seul ; c2 cosplay en stock + kit2 ; c3 montant inférieur ; c4 supérieur ; c5 expirée ; c6 déjà payée ;
-- c7 Kit déjà possédé ; c8 échouée (succès tardif) ; c9 en attente mais échéance passée ; c10 deux Tentatives ; c11 à payer, Tentative échouée.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, expire_le) values
  ('00000000-0000-4000-8000-0000000000c1', 'KS-2026-810001', '00000000-0000-0000-0000-0000000000b1', 'produits', 'en_attente', 990, 990, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000c2', 'KS-2026-810002', '00000000-0000-0000-0000-0000000000b1', 'produits', 'en_attente', 10500, 10500, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000c3', 'KS-2026-810003', '00000000-0000-0000-0000-0000000000b2', 'produits', 'en_attente', 500, 500, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000c4', 'KS-2026-810004', '00000000-0000-0000-0000-0000000000b2', 'produits', 'en_attente', 500, 500, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000c5', 'KS-2026-810005', '00000000-0000-0000-0000-0000000000b2', 'produits', 'expiree', 500, 500, now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000c6', 'KS-2026-810006', '00000000-0000-0000-0000-0000000000b2', 'produits', 'payee', 500, 500, null),
  ('00000000-0000-4000-8000-0000000000c7', 'KS-2026-810007', '00000000-0000-0000-0000-0000000000b1', 'produits', 'en_attente', 990, 990, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000c8', 'KS-2026-810008', '00000000-0000-0000-0000-0000000000b2', 'produits', 'echouee', 500, 500, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000c9', 'KS-2026-810009', '00000000-0000-0000-0000-0000000000b2', 'produits', 'en_attente', 500, 500, now() - interval '1 minute'),
  ('00000000-0000-4000-8000-0000000000ca', 'KS-2026-810010', '00000000-0000-0000-0000-0000000000b2', 'produits', 'en_attente', 500, 500, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000cb', 'KS-2026-810011', '00000000-0000-0000-0000-0000000000b2', 'produits', 'en_attente', 500, 500, now() + interval '1 hour');
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents) values
  ('00000000-0000-4000-8000-0000000000c1', (select kit from pr), 1, 990),
  ('00000000-0000-4000-8000-0000000000c2', (select kit2 from pr), 1, 500),
  ('00000000-0000-4000-8000-0000000000c3', (select kit2 from pr), 1, 500),
  ('00000000-0000-4000-8000-0000000000c4', (select kit2 from pr), 1, 500),
  ('00000000-0000-4000-8000-0000000000c5', (select kit2 from pr), 1, 500),
  ('00000000-0000-4000-8000-0000000000c6', (select kit2 from pr), 1, 500),
  ('00000000-0000-4000-8000-0000000000c7', (select kit from pr), 1, 990),
  ('00000000-0000-4000-8000-0000000000c8', (select kit2 from pr), 1, 500),
  ('00000000-0000-4000-8000-0000000000c9', (select kit2 from pr), 1, 500),
  ('00000000-0000-4000-8000-0000000000ca', (select kit2 from pr), 1, 500),
  ('00000000-0000-4000-8000-0000000000cb', (select kit2 from pr), 1, 500);
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents, variante_id, origine)
  values ('00000000-0000-4000-8000-0000000000c2', (select cos from pr), 2, 5000, (select id from public.variante where produit_id = (select cos from pr) and taille = 'M'), 'stock');
insert into public.reservation (commande_id, ligne_id, variante_id, nombre, origine, expire_le)
  select commande_id, id, variante_id, nombre, origine, now() + interval '1 hour' from public.ligne_commande where variante_id is not null;
-- Panier du Compte b1 avec un Kit : il doit être vidé par un paiement validé.
insert into public.panier (id, compte_id) values ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-0000000000b1');
insert into public.ligne_panier (panier_id, produit_id, nombre) values ('00000000-0000-4000-8000-0000000000d1', (select kit2 from pr), 1), ('00000000-0000-4000-8000-0000000000d1', (select kit from pr), 1);
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values ((select cos from pr), 'S', 1, false);
-- Article ajouté au Panier après la création des Commandes : il doit rester.
insert into public.ligne_panier (panier_id, produit_id, variante_id, nombre) values ('00000000-0000-4000-8000-0000000000d1', (select cos from pr), (select id from public.variante where produit_id = (select cos from pr) and taille = 'S'), 1);

-- Tentatives en cours (une par Commande), plus quelques cas particuliers.
insert into public.tentative_paiement (id, commande_id, prestataire, moyen, reference_interne, reference_transaction, montant_attendu_cents) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000c1', 'pawapay', 'carte', 'TEST-CP-REF-0001', 'TEST-CP-TX-0001', 990),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000c2', 'pawapay', 'carte', 'TEST-CP-REF-0002', 'TEST-CP-TX-0002', 10500),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000c3', 'pawapay', 'carte', 'TEST-CP-REF-0003', 'TEST-CP-TX-0003', 500),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000c4', 'pawapay', 'carte', 'TEST-CP-REF-0004', 'TEST-CP-TX-0004', 500),
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-0000000000c5', 'pawapay', 'carte', 'TEST-CP-REF-0005', 'TEST-CP-TX-0005', 500),
  ('00000000-0000-4000-8000-0000000000e6', '00000000-0000-4000-8000-0000000000c6', 'pawapay', 'carte', 'TEST-CP-REF-0006', 'TEST-CP-TX-0006', 500),
  ('00000000-0000-4000-8000-0000000000e7', '00000000-0000-4000-8000-0000000000c7', 'pawapay', 'carte', 'TEST-CP-REF-0007', 'TEST-CP-TX-0007', 990),
  ('00000000-0000-4000-8000-0000000000e8', '00000000-0000-4000-8000-0000000000c8', 'pawapay', 'carte', 'TEST-CP-REF-0008', 'TEST-CP-TX-0008', 500),
  ('00000000-0000-4000-8000-0000000000e9', '00000000-0000-4000-8000-0000000000c9', 'pawapay', 'carte', 'TEST-CP-REF-0009', 'TEST-CP-TX-0009', 500),
  ('00000000-0000-4000-8000-0000000000ea', '00000000-0000-4000-8000-0000000000ca', 'pawapay', 'carte', 'TEST-CP-REF-0010', 'TEST-CP-TX-0010', 500);
-- c10 : seconde Tentative sur un autre Prestataire (abandonnée, donc sans conflit avec l'unicité de la Tentative en cours).
insert into public.tentative_paiement (id, commande_id, prestataire, moyen, reference_interne, reference_transaction, montant_attendu_cents, statut) values
  ('00000000-0000-4000-8000-0000000000eb', '00000000-0000-4000-8000-0000000000ca', 'maishapay', 'carte', 'TEST-CP-REF-0011', 'TEST-CP-TX-0011', 500, 'abandonnee');
-- c11 : Tentative échouée.
insert into public.tentative_paiement (id, commande_id, prestataire, moyen, reference_interne, montant_attendu_cents, statut, cause) values
  ('00000000-0000-4000-8000-0000000000ec', '00000000-0000-4000-8000-0000000000cb', 'pawapay', 'carte', 'TEST-CP-REF-0012', 500, 'echouee', 'prestataire');
-- a1 possède déjà le Kit de c7 après le paiement de c1 (même produit).

-- Droits : service seulement ; la fonction de déclenchement n'est appelable par aucun rôle.
select is(
  (select array_agg(f order by f) from unnest(array[
    'public.confirmer_paiement(jsonb, uuid, text, numeric, text, text)', 'public.enregistrer_notification(text, text, uuid, boolean)', 'public.tentative_par_reference_interne(text)',
    'public.tentatives_a_reconcilier(integer, integer)', 'public.toucher_tentative(uuid)', 'public.abandonner_tentatives_perimees()', 'public.signaler_montant_indetermine(uuid, numeric, text)'
  ]) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or not has_function_privilege('service_role', f, 'execute')),
  null,
  'les fonctions du socle : service seulement'
);
select ok(not has_function_privilege('service_role', 'public.reconcilier_declencher()', 'execute'), 'reconcilier_declencher : aucun rôle');

-- Refus avant tout effet.
select throws_ok($$select public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e1', 'peut-etre', 990, 'USD')$$, 'P0001', 'KS_COMPARAISON_INVALIDE', 'comparaison inconnue : refusée');
select throws_ok($$select public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e1', 'egal', -1, 'USD', null)$$, 'P0001', 'KS_MONTANT_INVALIDE', 'montant négatif : refusé');
select throws_ok($$select public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e1', 'egal', 990, 'usd', null)$$, 'P0001', 'KS_MONTANT_INVALIDE', 'devise mal formée : refusée');
select throws_ok($$select public.confirmer_paiement('{"type":"visiteur"}'::jsonb, '00000000-0000-4000-8000-0000000000e1', 'egal', 990, 'USD', null)$$, 'P0001', 'KS_AUTEUR_INVALIDE', 'un visiteur ne confirme rien');
select throws_ok($$select public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000ff', 'egal', 990, 'USD', null)$$, 'P0001', 'KS_TENTATIVE_INTROUVABLE', 'Tentative inconnue : refusée');
select is((select statut from public.commande where numero = 'KS-2026-810001'), 'en_attente', 'les refus ne changent rien');

select throws_ok($$select public.confirmer_paiement('{}'::jsonb, '00000000-0000-4000-8000-0000000000e1', 'egal', 990, 'USD', null)$$, 'P0001', 'KS_AUTEUR_INVALIDE', 'auteur vide : refusé');
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e1', 'egal', 990, 'USD', 'TEST-AUTRE-REF') ->> 'resultat', 'reference_incoherente', 'référence différente de celle de la Tentative : rien n''est validé');
select is((select statut from public.commande where numero = 'KS-2026-810001'), 'en_attente', 'la Commande reste en attente');

-- c1 : Kit seul, montant égal → payée puis livrée dans la même transaction.
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e1', 'egal', 990, 'USD', null) ->> 'resultat', 'payee', 'Kit seul, montant égal : payée');
select is((select statut || '|' || prestataire || '|' || reference_transaction from public.commande where numero = 'KS-2026-810001'), 'livree|pawapay|TEST-CP-TX-0001', 'Commande 100 % numérique : livrée, Prestataire et référence enregistrés');
select ok((select paye_le is not null from public.commande where numero = 'KS-2026-810001'), 'paye_le posé');
select is((select statut || '|' || montant_recu::text || '|' || devise_recue from public.tentative_paiement where id = '00000000-0000-4000-8000-0000000000e1'), 'reussie|990.0000|USD', 'Tentative réussie avec le montant et la devise reçus');
select is((select count(*)::int from public.acces_kit where compte_id = '00000000-0000-0000-0000-0000000000b1' and produit_id = (select kit from pr)), 1, 'accès au Kit ouvert');
select is((select count(*)::int from public.envoi where modele = 'kit_ouvert' and donnees ->> 'commande_id' = '00000000-0000-4000-8000-0000000000c1'), 1, 'un seul email « Kit ouvert »');
select is((select count(*)::int from public.envoi where modele = 'commande_payee' and donnees ->> 'commande_id' = '00000000-0000-4000-8000-0000000000c1'), 0, 'pas d''email « Commande payée » pour un Kit seul');
-- Rejeu.
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e1', 'egal', 990, 'USD', null) ->> 'resultat', 'deja_traite', 'rejeu : déjà traité');
select is((select count(*)::int from public.envoi where donnees ->> 'commande_id' = '00000000-0000-4000-8000-0000000000c1') + (select count(*)::int from public.trop_percu), 1, 'le rejeu ne crée ni email ni trop-perçu');

-- c2 : pièce physique en stock + Kit.
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e2', 'egal', 10500, 'USD', null) ->> 'resultat', 'payee', 'Panier mixte : payée');
select is((select statut from public.commande where numero = 'KS-2026-810002'), 'payee', 'Commande avec pièce physique : reste payée (l''admin la fera avancer)');
select is((select stock from public.variante where produit_id = (select cos from pr) and taille = 'M'), 3, 'stock décompté des lignes d''origine « stock »');
select is((select count(*)::int from public.reservation where commande_id = '00000000-0000-4000-8000-0000000000c2' and liberee_le is null), 0, 'réservations libérées');
select is((select count(*)::int from public.envoi where modele = 'commande_payee' and donnees ->> 'commande_id' = '00000000-0000-4000-8000-0000000000c2'), 1, 'un email « Commande payée »');
select is((select count(*)::int from public.acces_kit where produit_id = (select kit2 from pr) and compte_id = '00000000-0000-0000-0000-0000000000b1'), 1, 'le Kit du Panier mixte s''ouvre aussitôt');
select is((select array_agg(produit_id) from public.ligne_panier where panier_id = '00000000-0000-4000-8000-0000000000d1'), array[(select cos from pr)], 'seules les lignes de la Commande payée quittent le Panier');

-- c3 : montant inférieur → aucune validation, anomalie critique avec le montant reçu.
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e3', 'inferieur', 100, 'USD', null) ->> 'resultat', 'montant_insuffisant', 'montant inférieur : signalé');
select is((select statut from public.commande where numero = 'KS-2026-810003'), 'en_attente', 'montant inférieur : la Commande ne passe pas en payée');
select is((select (details ->> 'montant_recu')::numeric from public.anomalie where type = 'montant_insuffisant' and cible_id = '00000000-0000-4000-8000-0000000000e3'), 100::numeric, 'l''anomalie porte le montant reçu');

-- c4 : montant supérieur → trop-perçu, Commande inchangée.
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e4', 'superieur', 900, 'USD', null) ->> 'motif', 'montant_superieur', 'montant supérieur : trop-perçu');
select is((select statut from public.commande where numero = 'KS-2026-810004'), 'en_attente', 'montant supérieur : la Commande n''est pas payée');

-- c5, c6, c9 : Commande expirée, déjà payée, réservations libérées → trop-perçu même à montant égal.
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e5', 'egal', 500, 'USD', null) ->> 'motif', 'expiree', 'Commande expirée : trop-perçu');
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e6', 'egal', 500, 'USD', null) ->> 'motif', 'deja_payee', 'Commande déjà payée : trop-perçu');
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e9', 'egal', 500, 'USD', null) ->> 'motif', 'reservations_liberees', 'échéance passée avant le nettoyage : trop-perçu');
select is((select statut from public.commande where numero = 'KS-2026-810005'), 'expiree', 'une Commande expirée reste expirée');

-- c7 : Kit déjà possédé → paiement validé, anomalie, pas de second email « Kit ouvert ».
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e7', 'egal', 990, 'USD', null) ->> 'resultat', 'payee', 'Kit déjà possédé : le paiement est validé');
select is((select count(*)::int from public.anomalie where type = 'kit_deja_possede' and cible_id = '00000000-0000-4000-8000-0000000000c7'), 1, 'anomalie « Kit déjà possédé »');
select is((select count(*)::int from public.envoi where modele = 'kit_ouvert' and donnees ->> 'commande_id' = '00000000-0000-4000-8000-0000000000c7'), 0, 'aucun email « Kit ouvert » pour un Kit déjà possédé');

-- c8 : Commande échouée, succès tardif avec réservations actives → payée.
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e8', 'egal', 500, 'USD', null) ->> 'resultat', 'payee', 'succès tardif d''une Commande échouée : payée');

-- c10 : deux Tentatives réussies sur deux Prestataires → la seconde est un trop-perçu.
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000ea', 'egal', 500, 'USD', null) ->> 'resultat', 'payee', 'première Tentative réussie : payée');
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000eb', 'egal', 500, 'USD', null) ->> 'motif', 'deja_payee', 'seconde Tentative réussie sur un autre Prestataire : trop-perçu');
select is((select prestataire from public.commande where numero = 'KS-2026-810010'), 'pawapay', 'la Commande garde le premier Prestataire');

-- Référence de transaction (règle 2) : exigée, posée si la Tentative n'en avait pas, refusée si elle diffère.
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000ec', 'egal', 500, 'USD', null) ->> 'resultat', 'reference_incoherente', 'ni référence reçue ni référence connue : rien n''est validé');
select is((select statut from public.commande where numero = 'KS-2026-810011'), 'en_attente', 'la Commande reste en attente');
select is((select count(*)::int from public.anomalie where type = 'notification_invalide' and cible_id = '00000000-0000-4000-8000-0000000000ec'), 1, 'anomalie « notification invalide » ouverte');
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000e3', 'egal', 500, 'USD', 'AUTRE-REF') ->> 'resultat', 'deja_traite', 'Tentative déjà réussie : le rejeu ne change rien, même avec une autre référence');
-- Succès vérifié sur une Tentative échouée (succès tardif) : il n'est plus ignoré ; la référence reçue est posée sur la Tentative et la Commande.
select is(public.confirmer_paiement(pg_temp.sys(), '00000000-0000-4000-8000-0000000000ec', 'egal', 500, 'USD', 'TEST-CP-TX-0012') ->> 'resultat', 'payee', 'succès tardif d''une Tentative échouée : payée');
select is((select reference_transaction from public.commande where numero = 'KS-2026-810011'), 'TEST-CP-TX-0012', 'la référence du Prestataire est enregistrée sur la Commande');

-- Notifications et recherche par référence.
select is(public.enregistrer_notification('pawapay', 'TEST-CP-NOTIF-1', '00000000-0000-4000-8000-0000000000e1', true), true, 'première notification : enregistrée');
select is(public.enregistrer_notification('pawapay', 'TEST-CP-NOTIF-1', '00000000-0000-4000-8000-0000000000e1', true), false, 'notification rejouée : reconnue');
select is((public.tentative_par_reference_interne('TEST-CP-REF-0001') ->> 'id'), '00000000-0000-4000-8000-0000000000e1', 'Tentative retrouvée par sa référence interne');
select is(public.tentative_par_reference_interne('TEST-CP-REF-INCONNUE'), null, 'référence inconnue : rien');

-- Réconciliation : lot borné, délai minimal depuis la dernière vérification, 72 h au plus ; abandon des Tentatives dont la Commande est expirée.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, expire_le) values
  ('00000000-0000-4000-8000-0000000000cc', 'KS-2026-810012', '00000000-0000-0000-0000-0000000000b2', 'produits', 'en_attente', 500, 500, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000cd', 'KS-2026-810013', '00000000-0000-0000-0000-0000000000b2', 'produits', 'en_attente', 500, 500, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000ce', 'KS-2026-810014', '00000000-0000-0000-0000-0000000000b2', 'produits', 'en_attente', 500, 500, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000cf', 'KS-2026-810015', '00000000-0000-0000-0000-0000000000b2', 'produits', 'expiree', 500, 500, now() - interval '1 hour');
insert into public.tentative_paiement (id, commande_id, prestataire, moyen, reference_interne, montant_attendu_cents, statut, cree_le, modifie_le) values
  ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-4000-8000-0000000000cc', 'pawapay', 'carte', 'TEST-CP-REF-1001', 500, 'en_cours', now() - interval '20 minutes', now() - interval '10 minutes'),
  ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000cd', 'pawapay', 'carte', 'TEST-CP-REF-1002', 500, 'en_cours', now(), now()),
  ('00000000-0000-4000-8000-0000000000f3', '00000000-0000-4000-8000-0000000000ce', 'pawapay', 'carte', 'TEST-CP-REF-1003', 500, 'abandonnee', now() - interval '80 hours', now() - interval '80 hours'),
  ('00000000-0000-4000-8000-0000000000f4', '00000000-0000-4000-8000-0000000000cf', 'pawapay', 'carte', 'TEST-CP-REF-1004', 500, 'en_cours', now() - interval '20 minutes', now() - interval '10 minutes');
select is(
  (select array_agg(reference_interne order by reference_interne) from public.tentatives_a_reconcilier(50, 60) where reference_interne like 'TEST-CP-REF-10%'),
  array['TEST-CP-REF-1001', 'TEST-CP-REF-1004'],
  'le lot ne contient que les Tentatives vérifiables : pas la récente, pas celle de plus de 72 h'
);
select is(public.abandonner_tentatives_perimees(), 1, 'une Tentative en cours dont la Commande est expirée est abandonnée');
select is((select statut from public.tentative_paiement where reference_interne = 'TEST-CP-REF-1004'), 'abandonnee', 'elle passe « abandonnee »');
select is((select statut from public.tentative_paiement where reference_interne = 'TEST-CP-REF-1001'), 'en_cours', 'les autres Tentatives en cours ne bougent pas');
select lives_ok($$select public.toucher_tentative('00000000-0000-4000-8000-0000000000f1')$$, 'une Tentative vérifiée est « touchée »');
select is(
  (select count(*)::int from public.tentatives_a_reconcilier(50, 60) where reference_interne = 'TEST-CP-REF-1001'),
  0,
  'elle n''est pas réinterrogée avant le délai'
);

-- Montant impossible à comparer : l''admin le voit, rien n''est validé.
select lives_ok($$select public.signaler_montant_indetermine('00000000-0000-4000-8000-0000000000f1', 5, 'USD')$$, 'comparaison impossible : signalée');
select is((select count(*)::int from public.anomalie where type = 'montant_indetermine' and cible_id = '00000000-0000-4000-8000-0000000000f1'), 1, 'anomalie « montant indéterminé » ouverte');
select is((select statut from public.commande where numero = 'KS-2026-810012'), 'en_attente', 'la Commande reste en attente');

select * from finish();
rollback;
