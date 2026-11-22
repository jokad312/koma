-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : demarrer_tentative. Cas limite : Compte complet, Commande introuvable (refus KS_COMMANDE_INTROUVABLE, v_commande jamais rempli).
-- Ce fichier ne contient QU'UN appel de demarrer_tentative (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(2);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-a1b030000001', 'test-a1bis-03@example.invalid', '{}');
-- Compte complet : âge déclaré, écrit directement (compte_complet lit profil.age_declare).
update public.profil set age_declare = 25, age_declare_le = now() where id = '00000000-0000-0000-0000-a1b030000001';

select throws_ok(
  $$select public.demarrer_tentative('00000000-0000-0000-0000-a1b030000001', 'KS-2026-9103001', 'pawapay', 'carte', null, null, 'TEST-A1BIS-03-REF', null)$$,
  'P0001', 'KS_COMMANDE_INTROUVABLE',
  'premier appel de la session, Commande inconnue : refusée'
);
select is((select count(*)::int from public.tentative_paiement where reference_interne = 'TEST-A1BIS-03-REF'), 0, 'aucune Tentative créée');

select * from finish();
rollback;
