-- Stories 5.2 et 5.3 : cycle d'une Tentative de paiement. demarrer_tentative (Compte complet, propriétaire, Commande payable, Prestataire actif,
-- moyen proposé, couple confirmé), une seule Tentative en cours, référence déjà utilisée refusée, echouer_tentative (Commande repayable),
-- état enrichi (numéro masqué, Agrégateurs exclus). Données TEST_ créées dans la transaction, puis annulées ; aucun paiement n'est simulé.
begin;
select plan(24);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-tp1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-tp2@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 25);
-- a2 : âge non déclaré (Compte incomplet).

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le)
  values ('kit', 'tp-kit', 'Kit tentative', 'Attempt kit', 1500, 'debutant', now() - interval '1 minute');

-- Quatre Commandes de a1 : à payer, à payer (seconde), expirée, payée ; une Commande de a2.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, expire_le) values
  ('00000000-0000-4000-8000-000000000a01', 'KS-2026-800001', '00000000-0000-0000-0000-0000000000a1', 'produits', 'en_attente', 1500, 1500, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-000000000a02', 'KS-2026-800002', '00000000-0000-0000-0000-0000000000a1', 'produits', 'en_attente', 1500, 1500, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-000000000a03', 'KS-2026-800003', '00000000-0000-0000-0000-0000000000a1', 'produits', 'en_attente', 1500, 1500, now() - interval '1 minute'),
  ('00000000-0000-4000-8000-000000000a04', 'KS-2026-800004', '00000000-0000-0000-0000-0000000000a1', 'produits', 'payee', 1500, 1500, null),
  ('00000000-0000-4000-8000-000000000a05', 'KS-2026-800005', '00000000-0000-0000-0000-0000000000a2', 'produits', 'en_attente', 1500, 1500, now() + interval '1 hour'),
  ('00000000-0000-4000-8000-000000000a06', 'KS-2026-800006', '00000000-0000-0000-0000-0000000000a1', 'produits', 'en_attente', 1500, 1500, now() + interval '1 hour');

-- Fonctions : service seulement.
select is(
  (select array_agg(f order by f) from unnest(array[
    'public.demarrer_tentative(uuid, text, text, text, text, text, text, text)', 'public.enregistrer_initiation(uuid, text)', 'public.echouer_tentative(uuid, text)'
  ]) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or not has_function_privilege('service_role', f, 'execute')),
  null,
  'les trois fonctions : service seulement'
);

-- Refus avant tout démarrage.
select throws_ok($$select public.demarrer_tentative('00000000-0000-0000-0000-0000000000a2', 'KS-2026-800005', 'pawapay', 'carte', null, null, 'TEST-TP-REF-0000', null)$$, 'P0001', 'KS_COMPTE_INCOMPLET', 'Compte sans âge déclaré : refusé');
select throws_ok($$select public.demarrer_tentative('00000000-0000-0000-0000-0000000000a1', 'KS-2026-800005', 'pawapay', 'carte', null, null, 'TEST-TP-REF-0001', null)$$, 'P0001', 'KS_COMMANDE_INTROUVABLE', 'Commande d''un autre Compte : introuvable');
select throws_ok($$select public.demarrer_tentative('00000000-0000-0000-0000-0000000000a1', 'KS-2026-800001', 'pawapay', 'mobile_money', 'TZ', 'TEST_op', 'TEST-TP-REF-0002', '+255••••••678')$$, 'P0001', 'KS_PRESTATAIRE_INACTIF', 'Prestataire désactivé : refusé');

-- Activation de PawaPay et MaishaPay (test), puis une Couverture confirmée de PawaPay et un couple à vérifier de MaishaPay.
update public.prestataire set actif = true where code in ('pawapay', 'maishapay');
insert into public.couverture (prestataire, pays, operateur, source, etat) values
  ('pawapay', 'TZ', 'TEST_op', 'TEST source', 'confirme'),
  ('maishapay', 'TZ', 'TEST_autre', 'TEST source', 'a_verifier');

select throws_ok($$select public.demarrer_tentative('00000000-0000-0000-0000-0000000000a1', 'KS-2026-800001', 'pawapay', 'carte', null, null, 'TEST-TP-REF-0003', null)$$, 'P0001', 'KS_MOYEN_INVALIDE', 'PawaPay ne propose pas la carte');
select throws_ok($$select public.demarrer_tentative('00000000-0000-0000-0000-0000000000a1', 'KS-2026-800001', 'pawapay', 'mobile_money', 'TZ', 'TEST_inconnu', 'TEST-TP-REF-0004', '+255••••••678')$$, 'P0001', 'KS_COUVERTURE_ABSENTE', 'couple non couvert : refusé');
select throws_ok($$select public.demarrer_tentative('00000000-0000-0000-0000-0000000000a1', 'KS-2026-800001', 'maishapay', 'mobile_money', 'TZ', 'TEST_autre', 'TEST-TP-REF-0005', '+255••••••678')$$, 'P0001', 'KS_COUVERTURE_ABSENTE', 'couple seulement « à vérifier » : refusé');
select throws_ok($$select public.demarrer_tentative('00000000-0000-0000-0000-0000000000a1', 'KS-2026-800003', 'pawapay', 'mobile_money', 'TZ', 'TEST_op', 'TEST-TP-REF-0006', '+255••••••678')$$, 'P0001', 'KS_COMMANDE_NON_PAYABLE', 'Commande expirée : non payable');
select throws_ok($$select public.demarrer_tentative('00000000-0000-0000-0000-0000000000a1', 'KS-2026-800004', 'pawapay', 'mobile_money', 'TZ', 'TEST_op', 'TEST-TP-REF-0007', '+255••••••678')$$, 'P0001', 'KS_COMMANDE_NON_PAYABLE', 'Commande déjà payée : non payable');
select is((select count(*)::int from public.tentative_paiement), 0, 'les refus ne créent aucune Tentative');

-- Démarrage valide.
select is(
  (public.demarrer_tentative('00000000-0000-0000-0000-0000000000a1', 'KS-2026-800001', 'pawapay', 'mobile_money', 'TZ', 'test_OP', 'TEST-TP-REF-0010', '+255••••••678') ->> 'montant_attendu_cents')::int,
  1500,
  'le montant attendu est celui de la Commande, lu en base'
);
select is(
  (select statut || '|' || moyen || '|' || pays || '|' || operateur || '|' || telephone_masque from public.tentative_paiement where reference_interne = 'TEST-TP-REF-0010'),
  'en_cours|mobile_money|TZ|test_OP|+255••••••678',
  'Tentative en cours, numéro masqué'
);
select throws_ok($$select public.demarrer_tentative('00000000-0000-0000-0000-0000000000a1', 'KS-2026-800001', 'pawapay', 'mobile_money', 'TZ', 'TEST_op', 'TEST-TP-REF-0011', '+255••••••678')$$, 'P0001', 'KS_TENTATIVE_EN_COURS', 'une seule Tentative en cours par Commande');

-- État enrichi pendant l'attente : Prestataire et numéro masqué, jamais de référence.
select is(
  (public.etat_paiement_commande('KS-2026-800001', '00000000-0000-0000-0000-0000000000a1') -> 'tentative_en_cours' ->> 'telephone_masque'),
  '+255••••••678',
  'l''état porte le numéro masqué'
);
select ok(public.etat_paiement_commande('KS-2026-800001', '00000000-0000-0000-0000-0000000000a1')::text !~ 'TEST-TP-REF|TEST-TX', 'aucune référence dans l''état');

-- Référence de transaction : posée, jamais deux fois chez le même Prestataire.
select lives_ok($$select public.enregistrer_initiation((select id from public.tentative_paiement where reference_interne = 'TEST-TP-REF-0010'), 'TEST-TX-0001')$$, 'la référence du Prestataire est enregistrée');
select public.demarrer_tentative('00000000-0000-0000-0000-0000000000a1', 'KS-2026-800002', 'pawapay', 'mobile_money', 'TZ', 'TEST_op', 'TEST-TP-REF-0012', '+255••••••678');
select throws_ok(
  $$select public.enregistrer_initiation((select id from public.tentative_paiement where reference_interne = 'TEST-TP-REF-0012'), 'TEST-TX-0001')$$,
  'P0001', 'KS_REFERENCE_DEJA_UTILISEE', 'une référence déjà utilisée est refusée'
);

-- Échec vérifié : la Commande devient repayable ; sans effet si la Tentative n'est plus en cours.
select throws_ok($$select public.echouer_tentative((select id from public.tentative_paiement where reference_interne = 'TEST-TP-REF-0010'), 'autre')$$, 'P0001', 'KS_CAUSE_INVALIDE', 'cause inconnue : refusée');
select is(public.echouer_tentative((select id from public.tentative_paiement where reference_interne = 'TEST-TP-REF-0010'), 'prestataire'), true, 'échec côté Prestataire enregistré');
select is((select statut from public.commande where numero = 'KS-2026-800001'), 'echouee', 'la Commande en attente passe « echouee » (repayable)');
select is(public.echouer_tentative((select id from public.tentative_paiement where reference_interne = 'TEST-TP-REF-0010'), 'client'), false, 'une Tentative déjà échouée n''est pas modifiée');
select is(
  (public.etat_paiement_commande('KS-2026-800001', '00000000-0000-0000-0000-0000000000a1') -> 'exclus')::text,
  '["pawapay"]',
  'PawaPay est exclu pour cette Commande après son échec côté Prestataire'
);

-- Commande échouée : une nouvelle Tentative est permise.
select lives_ok(
  $$select public.demarrer_tentative('00000000-0000-0000-0000-0000000000a1', 'KS-2026-800001', 'pawapay', 'mobile_money', 'TZ', 'TEST_op', 'TEST-TP-REF-0013', '+255••••••678')$$,
  'Commande échouée : nouvelle Tentative permise'
);
-- Le numéro n'est jamais conservé en clair : un numéro sans masque est refusé par la table (23514).
select throws_ok(
  $$select public.demarrer_tentative('00000000-0000-0000-0000-0000000000a1', 'KS-2026-800006', 'pawapay', 'mobile_money', 'TZ', 'TEST_op', 'TEST-TP-REF-0014', '+255712345678')$$,
  '23514', null, 'un numéro en clair est refusé'
);

select * from finish();
rollback;
