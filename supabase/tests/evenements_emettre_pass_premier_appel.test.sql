-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : evenements_emettre_pass, appelée par confirmer_paiement (seul chemin de production pour une Commande de Pass payée).
-- Cas limite : premier paiement confirmé de la session, Commande de Pass à deux titulaires, montant égal.
-- Ce fichier ne contient QU'UN appel de confirmer_paiement, et aucun appel direct de evenements_emettre_pass (chaque fichier de test a sa propre session).
-- Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(6);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-a1b170000001', 'test-a1bis-17@example.invalid', '{}');
insert into public.evenement (id, auteur_id, titre_fr, slug, publie_le, debut_le, capacite) values
  ('00000000-0000-4000-8000-a1b170000071', '00000000-0000-0000-0000-a1b170000001', 'TEST_Festival', 'test-a1bis-17-ev', now() - interval '2 days', now() + interval '30 days', null);
insert into public.type_pass (id, evenement_id, nom_fr, nom_en, prix_cents, est_stand) values
  ('00000000-0000-4000-8000-a1b170000081', '00000000-0000-4000-8000-a1b170000071', 'TEST_Simple', 'TEST_Simple', 1500, false);
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, expire_le) values
  ('00000000-0000-4000-8000-a1b170000031', 'KS-2026-9117001', '00000000-0000-0000-0000-a1b170000001', 'pass', 'en_attente', 3000, 3000, now() + interval '1 hour');
insert into public.ligne_commande (id, commande_id, produit_id, nombre, prix_cents, type_pass_id, titulaires, pass_nom_fr, pass_nom_en, est_stand) values
  ('00000000-0000-4000-8000-a1b170000041', '00000000-0000-4000-8000-a1b170000031', null, 2, 1500, '00000000-0000-4000-8000-a1b170000081', '["Alice Test", "Bob Test"]', 'TEST_Simple', 'TEST_Simple', false);
insert into public.tentative_paiement (id, commande_id, prestataire, moyen, reference_interne, reference_transaction, montant_attendu_cents) values
  ('00000000-0000-4000-8000-a1b170000051', '00000000-0000-4000-8000-a1b170000031', 'maishapay', 'carte', 'TEST-A1BIS-17-REF', 'TEST-A1BIS-17-TX', 3000);

create temp table r as select public.confirmer_paiement(
  '{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-4000-8000-a1b170000051', 'egal', 3000, 'USD', null
) as r;

select is((select r ->> 'resultat' from r), 'payee', 'premier appel de la session, Commande de Pass, montant égal : payée, aucune erreur');
select is((select (r ->> 'pass_emis')::int from r), 2, 'deux Pass émis, un par titulaire');
select is((select statut from public.commande where id = '00000000-0000-4000-8000-a1b170000031'), 'payee', 'la Commande de Pass est payée');
select is(
  (select array_agg(nom_titulaire || ':' || rang::text || ':' || statut order by rang) from public.pass where commande_id = '00000000-0000-4000-8000-a1b170000031'),
  array['Alice Test:1:valide', 'Bob Test:2:valide'],
  'les Pass portent les noms figés, dans l''ordre, valides'
);
select ok(
  (select bool_and(jeton ~ '^[0-9a-f]{48}$' and code_court ~ '^[A-HJ-NP-Z2-9]{8}$' and evenement_id = '00000000-0000-4000-8000-a1b170000071')
   from public.pass where commande_id = '00000000-0000-4000-8000-a1b170000031'),
  'jeton et code court au bon format, Événement de la ligne'
);
select is((select count(*)::int from public.envoi where cle = 'pass_emis:00000000-0000-4000-8000-a1b170000031'), 1, 'un seul email « pass_emis » planifié');

select * from finish();
rollback;
