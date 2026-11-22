-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : abandonner_tentatives_perimees (appelée par la tâche de réconciliation). Cas limite : aucune Tentative TEST_ périmée.
-- La fonction porte sur toute la table : le résultat attendu est le nombre de Tentatives en cours sur une Commande expirée ou annulée, compté juste
-- avant l'appel dans la même transaction ; sur la base locale de la CI il vaut 0. Une Tentative TEST_ en cours sur une Commande en attente doit rester en cours.
-- Ce fichier ne contient QU'UN appel de abandonner_tentatives_perimees (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(2);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-a1b130000001', 'test-a1bis-13@example.invalid', '{}');
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, expire_le) values
  ('00000000-0000-4000-8000-a1b130000031', 'KS-2026-9113001', '00000000-0000-0000-0000-a1b130000001', 'produits', 'en_attente', 990, 990, now() + interval '1 hour');
insert into public.tentative_paiement (id, commande_id, prestataire, moyen, reference_interne, montant_attendu_cents) values
  ('00000000-0000-4000-8000-a1b130000051', '00000000-0000-4000-8000-a1b130000031', 'pawapay', 'mobile_money', 'TEST-A1BIS-13-REF', 990);

create temp table avant as
  select count(*)::int as n from public.tentative_paiement t join public.commande c on c.id = t.commande_id
  where t.statut = 'en_cours' and c.statut in ('expiree', 'annulee');
create temp table r as select public.abandonner_tentatives_perimees() as n;

select is((select n from r), (select n from avant), 'premier appel de la session, aucune Tentative TEST_ périmée : aucune erreur');
select is((select statut from public.tentative_paiement where id = '00000000-0000-4000-8000-a1b130000051'), 'en_cours', 'la Tentative d''une Commande en attente reste en cours');

select * from finish();
rollback;
