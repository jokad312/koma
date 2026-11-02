-- Story 4.6 : état réel de la Commande pour la page de retour (etat_paiement_commande). Les états sont posés par des données TEST_ dans la
-- transaction, jamais par un faux paiement dans le code du site (règle 13) : Commande en attente, Tentative en cours, payée avec Kit,
-- échec confirmé, Trop-perçu. Un autre Compte ne lit rien ; les références du Prestataire et les montants reçus ne sortent pas.
begin;
select plan(19);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'test-ep1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'test-ep2@example.invalid', '{}');

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le)
  values ('kit', 'ep-kit', 'Kit état', 'State kit', 990, 'debutant', now() - interval '1 minute');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, publie_le)
  values ('cosplay', 'ep-cosplay', 'Cosplay état', 'State cosplay', 5000, now() - interval '1 minute');

-- Cinq Commandes du Compte f1.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, expire_le) values
  ('00000000-0000-4000-8000-000000000e01', 'KS-2026-900001', '00000000-0000-0000-0000-0000000000f1', 'produits', 'en_attente', 990, 990, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-000000000e02', 'KS-2026-900002', '00000000-0000-0000-0000-0000000000f1', 'produits', 'payee', 990, 990, null),
  ('00000000-0000-4000-8000-000000000e03', 'KS-2026-900003', '00000000-0000-0000-0000-0000000000f1', 'produits', 'echouee', 5000, 5000, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-000000000e04', 'KS-2026-900004', '00000000-0000-0000-0000-0000000000f1', 'produits', 'expiree', 5000, 5000, now() - interval '1 hour'),
  ('00000000-0000-4000-8000-000000000e05', 'KS-2026-900005', '00000000-0000-0000-0000-0000000000f1', 'produits', 'en_attente', 5000, 5000, now() - interval '5 minutes');
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents) values
  ('00000000-0000-4000-8000-000000000e01', (select id from public.produit where slug = 'ep-kit'), 1, 990),
  ('00000000-0000-4000-8000-000000000e02', (select id from public.produit where slug = 'ep-kit'), 1, 990),
  ('00000000-0000-4000-8000-000000000e03', (select id from public.produit where slug = 'ep-cosplay'), 1, 5000);

select is((public.etat_paiement_commande('KS-2026-900001', '00000000-0000-0000-0000-0000000000f1') ->> 'statut'), 'en_attente', 'Commande en attente : statut lu');
select is((public.etat_paiement_commande('KS-2026-900001', '00000000-0000-0000-0000-0000000000f1') -> 'tentative_en_cours'), 'null'::jsonb, 'sans Tentative : aucune Tentative en cours');
select is((public.etat_paiement_commande('KS-2026-900001', '00000000-0000-0000-0000-0000000000f1') ->> 'kit')::boolean, true, 'un Kit dans la Commande est signalé');
select is((public.etat_paiement_commande('KS-2026-900003', '00000000-0000-0000-0000-0000000000f1') ->> 'kit')::boolean, false, 'pas de Kit dans une Commande de cosplay');

-- Tentative en cours : retrouvée avec son moyen et son ancienneté.
insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents, cree_le)
  values ('00000000-0000-4000-8000-000000000e01', 'kpay', 'carte', 'TEST-EP-REF-0001', 990, now() - interval '90 seconds');
select is((public.etat_paiement_commande('KS-2026-900001', '00000000-0000-0000-0000-0000000000f1') -> 'tentative_en_cours' ->> 'moyen'), 'carte', 'Tentative en cours retrouvée');
select ok((public.etat_paiement_commande('KS-2026-900001', '00000000-0000-0000-0000-0000000000f1') -> 'tentative_en_cours' ->> 'age_secondes')::int between 89 and 120, 'ancienneté de la Tentative en secondes');
select ok(public.etat_paiement_commande('KS-2026-900001', '00000000-0000-0000-0000-0000000000f1')::text !~ 'TEST-EP-REF|kpay|reference', 'aucune référence ni Prestataire dans l''état');

-- Commande payée.
select is((public.etat_paiement_commande('KS-2026-900002', '00000000-0000-0000-0000-0000000000f1') ->> 'statut'), 'payee', 'Commande payée : statut lu en base');

-- Échec confirmé : la cause de la dernière Tentative échouée.
insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents, statut, cause, montant_recu, devise_recue)
  values ('00000000-0000-4000-8000-000000000e03', 'kpay', 'carte', 'TEST-EP-REF-0003', 5000, 'echouee', 'client', 4321, 'CDF');
select is((public.etat_paiement_commande('KS-2026-900003', '00000000-0000-0000-0000-0000000000f1') ->> 'derniere_cause_echec'), 'client', 'cause de l''échec lue');
select ok(public.etat_paiement_commande('KS-2026-900003', '00000000-0000-0000-0000-0000000000f1')::text !~ '4321|CDF', 'le montant reçu ne sort pas');
select is((public.etat_paiement_commande('KS-2026-900003', '00000000-0000-0000-0000-0000000000f1') -> 'trop_percu'), 'null'::jsonb, 'sans Trop-perçu : null');

-- Trop-perçu : motif résumé pour le client.
insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents, statut, montant_recu, devise_recue)
  values ('00000000-0000-4000-8000-000000000e04', 'polar', 'carte', 'TEST-EP-REF-0004', 5000, 'reussie', 5000, 'USD');
insert into public.trop_percu (commande_id, tentative_id, motif, montant_attendu_cents, montant_recu, devise_recue)
  values ('00000000-0000-4000-8000-000000000e04', (select id from public.tentative_paiement where reference_interne = 'TEST-EP-REF-0004'), 'expiree', 5000, 5000, 'USD');
select is((public.etat_paiement_commande('KS-2026-900004', '00000000-0000-0000-0000-0000000000f1') ->> 'trop_percu'), 'expiree', 'Trop-perçu d''une Commande expirée');
select is((public.etat_paiement_commande('KS-2026-900004', '00000000-0000-0000-0000-0000000000f1') ->> 'statut'), 'expiree', 'la Commande garde son statut (FR-19)');
update public.trop_percu set motif = 'reservations_liberees' where commande_id = '00000000-0000-4000-8000-000000000e04';
select is((public.etat_paiement_commande('KS-2026-900004', '00000000-0000-0000-0000-0000000000f1') ->> 'trop_percu'), 'impossible', 'tout autre motif devient « impossible à honorer »');
update public.trop_percu set motif = 'deja_payee' where commande_id = '00000000-0000-4000-8000-000000000e04';
select is((public.etat_paiement_commande('KS-2026-900004', '00000000-0000-0000-0000-0000000000f1') ->> 'trop_percu'), 'deja_payee', 'Trop-perçu d''une Commande déjà payée');

-- Échéance passée : l'échéance est transmise, le serveur TypeScript décide de l'affichage « expirée ».
select ok((public.etat_paiement_commande('KS-2026-900005', '00000000-0000-0000-0000-0000000000f1') ->> 'expire_le')::timestamptz < now(), 'échéance passée transmise');

-- Propriétaire seulement.
select is(public.etat_paiement_commande('KS-2026-900001', '00000000-0000-0000-0000-0000000000f2'), null, 'un autre Compte ne lit rien');
select is(public.etat_paiement_commande('KS-2026-999999', '00000000-0000-0000-0000-0000000000f1'), null, 'numéro inconnu : rien');
select ok(
  not has_function_privilege('anon', 'public.etat_paiement_commande(text, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.etat_paiement_commande(text, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.etat_paiement_commande(text, uuid)', 'execute'),
  'fonction réservée au service'
);

select * from finish();
rollback;
