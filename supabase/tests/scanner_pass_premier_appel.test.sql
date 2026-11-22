-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : scanner_pass. Cas limite : premier scan d'un Pass valide (Commande payée), par son jeton, par un Admin, sans Verrou hors ligne.
-- Ce fichier ne contient QU'UN appel de scanner_pass (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(4);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-a1b100000001', 'test-a1bis-10-client@example.invalid', '{}'),
  ('00000000-0000-0000-0000-a1b100000002', 'test-a1bis-10-admin@example.invalid', '{}');
-- Rôle admin écrit directement (scan_exiger_acces lit role_utilisateur).
insert into public.role_utilisateur (compte, role) values ('00000000-0000-0000-0000-a1b100000002', 'admin');

insert into public.evenement (id, auteur_id, titre_fr, titre_en, slug, publie_le, debut_le) values
  ('00000000-0000-4000-8000-a1b100000071', '00000000-0000-0000-0000-a1b100000002', 'TEST_Festival', 'TEST_Festival EN', 'test-a1bis-10-ev', now() - interval '2 days', now() + interval '1 day');
insert into public.type_pass (id, evenement_id, nom_fr, nom_en, prix_cents) values
  ('00000000-0000-4000-8000-a1b100000081', '00000000-0000-4000-8000-a1b100000071', 'TEST_VIP', 'TEST_VIP EN', 3000);
insert into public.commande (id, numero, compte_id, type, statut, offerte, sous_total_cents, total_cents, paye_le) values
  ('00000000-0000-4000-8000-a1b100000031', 'KS-2026-9110001', '00000000-0000-0000-0000-a1b100000001', 'pass', 'payee', false, 3000, 3000, now());
insert into public.ligne_commande (id, commande_id, produit_id, nombre, prix_cents, type_pass_id, titulaires, pass_nom_fr, pass_nom_en, est_stand) values
  ('00000000-0000-4000-8000-a1b100000041', '00000000-0000-4000-8000-a1b100000031', null, 1, 3000, '00000000-0000-4000-8000-a1b100000081', '["Alice Test"]', 'TEST_VIP', 'TEST_VIP EN', false);
insert into public.pass (id, evenement_id, type_pass_id, commande_id, ligne_commande_id, rang, nom_titulaire, statut, jeton, code_court) values
  ('00000000-0000-4000-8000-a1b100000091', '00000000-0000-4000-8000-a1b100000071', '00000000-0000-4000-8000-a1b100000081', '00000000-0000-4000-8000-a1b100000031',
   '00000000-0000-4000-8000-a1b100000041', 1, 'Alice Test', 'valide', repeat('a1b10', 9) || 'a1b', 'ZXWVTS32');

create temp table r as select public.scanner_pass(
  '{"type":"compte","id":"00000000-0000-0000-0000-a1b100000002","role":"admin"}'::jsonb, '00000000-0000-4000-8000-a1b100000071', repeat('a1b10', 9) || 'a1b', null
) as r;

select is((select r ->> 'resultat' from r), 'valide', 'premier appel de la session, premier scan d''un Pass valide : VALIDE');
select is(
  (select (r ->> 'nom') || '|' || (r ->> 'evenement_fr') || '|' || (r ->> 'type_pass_fr') from r),
  'Alice Test|TEST_Festival|TEST_VIP',
  'le titulaire, l''Événement et le Type de pass sont rendus'
);
select ok(
  (select statut = 'scanne' and scanne_le is not null and scanne_par = '00000000-0000-0000-0000-a1b100000002' from public.pass where id = '00000000-0000-4000-8000-a1b100000091'),
  'le Pass est « scanne », avec l''heure et l''auteur du scan'
);
select is(
  (select count(*)::int from public.journal_audit where action = 'scan' and cible_table = 'pass' and cible_id = '00000000-0000-4000-8000-a1b100000091' and apres ->> 'resultat' = 'valide'),
  1,
  'le scan est journalisé une fois'
);

select * from finish();
rollback;
