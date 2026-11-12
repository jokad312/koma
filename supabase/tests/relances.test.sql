-- Story 9.5 : Relances après achat. Dernier paiement de moins de 90 jours (une Commande offerte n'ouvre pas de fenêtre), consentement « relances »,
-- un seul sujet dans l'ordre Kit commencé, Événement dans les 30 jours, nouveauté de l'univers ; rythme réglable ; rejeu sans doublon ; réglage invalide : rien.
-- Données TEST_ annulées à la fin.
begin;
select plan(17);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-rl1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-rl2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-rl3@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a4', 'test-rl4@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a5', 'test-rl5@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, u, 25) from unnest(array[
  '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3',
  '00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a5']::uuid[]) u;
create function pg_temp.c(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;
create function pg_temp.id(p text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || p)::uuid $$;
create function pg_temp.nb(p_compte text) returns int language sql as $$ select count(*)::int from public.envoi where modele::text = 'relance' and compte_id = pg_temp.id(p_compte) $$;
create function pg_temp.sujet(p_compte text) returns text language sql as $$
  select (select k from jsonb_object_keys(donnees) k limit 1) from public.envoi where modele::text = 'relance' and compte_id = pg_temp.id(p_compte) order by cree_le desc limit 1
$$;
-- Consentement « relances » : tous sauf a2.
select public.donner_consentements(pg_temp.c(p), array['relances'], 'TEST_v1', 'preferences') from unnest(array['a1', 'a3', 'a4', 'a5']) p;
-- Aucun Événement réel ne doit fausser le test (annulé à la fin).
update public.evenement set publie_le = null where publie_le is not null;

insert into public.univers (nom_fr, nom_en) values ('TEST_Univers', 'TEST_Universe');
create temp table u as select id from public.univers where nom_fr = 'TEST_Univers';
grant select on u to public;
update public.profil set univers_prefere = (select id from u) where id = pg_temp.id('a1');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le, univers_id) values
  ('kit', 'rl-kit', 'TEST_Kit', null, 990, 'debutant', now() - interval '60 days', null),
  ('kit', 'rl-nouveau', 'TEST_Nouveau', null, 990, 'debutant', now() - interval '2 days', (select id from u));
insert into public.video_kit (produit_id, duree_secondes) select id, 600 from public.produit where slug = 'rl-kit';

-- Achats : a1, a2, a5 il y a 5 jours ; a3 il y a 100 jours ; a4 seulement une Commande offerte (sans paye_le).
insert into public.commande (numero, compte_id, type, statut, sous_total_cents, total_cents, paye_le) values
  ('KS-2026-890001', pg_temp.id('a1'), 'produits', 'payee', 990, 990, now() - interval '5 days'),
  ('KS-2026-890002', pg_temp.id('a2'), 'produits', 'payee', 990, 990, now() - interval '5 days'),
  ('KS-2026-890003', pg_temp.id('a3'), 'produits', 'payee', 990, 990, now() - interval '100 days'),
  ('KS-2026-890005', pg_temp.id('a5'), 'produits', 'payee', 990, 990, now() - interval '5 days');
insert into public.commande (numero, compte_id, type, statut, offerte, sous_total_cents, total_cents) values ('KS-2026-890004', pg_temp.id('a4'), 'produits', 'offerte', true, 0, 0);
-- a5 a commencé son Kit sans le terminer.
insert into public.acces_kit (compte_id, produit_id, commande_origine, cree_le) values
  (pg_temp.id('a5'), (select id from public.produit where slug = 'rl-kit'), (select id from public.commande where numero = 'KS-2026-890005'), now() - interval '5 days');
insert into public.progression_video (compte_id, produit_id, position_secondes, max_position_secondes) values (pg_temp.id('a5'), (select id from public.produit where slug = 'rl-kit'), 100, 150);

-- 1-3. Droits et réglage de départ.
select is((select count(*)::int from unnest(array['public.planifier_relances()']) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')), 0, 'planifier_relances n''est exécutable ni par anon ni par authenticated');
select is((select count(*)::int from unnest(array['public.planifier_relances()']) f where has_function_privilege('service_role', f, 'execute')), 1, 'le serveur exécute planifier_relances');
select ok((select valeur ~ '^[0-9]{1,2}$' from public.reglage where cle = 'relances_rythme_jours'), 'le rythme des Relances est réglé (3 jours au départ)');
update public.reglage set valeur = '3' where cle = 'relances_rythme_jours';

-- 4-9. Première passe : a1 reçoit la nouveauté (aucun Kit commencé, aucun Événement), a5 son Kit ; a2 (sans consentement), a3 (paiement trop ancien) et a4 (Commande offerte) rien.
select public.planifier_relances();
select is(pg_temp.sujet('a1'), 'produit_id', 'a1 : la nouveauté de son univers (aucun Kit commencé, aucun Événement)');
select is(pg_temp.sujet('a5'), 'kit_id', 'a5 : son Kit commencé et pas terminé');
select is(pg_temp.nb('a2'), 0, 'sans consentement « relances » : aucune Relance');
select is(pg_temp.nb('a3'), 0, 'dernier paiement de plus de 90 jours : aucune Relance');
select is(pg_temp.nb('a4'), 0, 'une Commande offerte n''ouvre pas de fenêtre : aucune Relance');
select is(pg_temp.nb('a1') + pg_temp.nb('a5'), 2, 'une seule Relance par Compte');

-- 10. Rejeu immédiat : aucune Relance de plus (rythme et clé d'envoi).
select public.planifier_relances();
select is(pg_temp.nb('a1') + pg_temp.nb('a5'), 2, 'rejouer la tâche n''envoie pas deux fois la même Relance');

-- 11-13. Après le rythme et avec un Événement dans les 30 jours : a1 passe à l'Événement, a5 garde son Kit (ordre des sujets).
set local session_replication_role = replica;
update public.envoi set cree_le = now() - interval '10 days', cle = cle || ':ancienne' where modele::text = 'relance';
reset session_replication_role;
insert into public.evenement (id, auteur_id, titre_fr, slug, publie_le, debut_le, capacite) values
  ('00000000-0000-4000-8000-0000000000c1', pg_temp.id('a1'), 'TEST_Festival', 'test-rl-ev1', now() - interval '2 days', now() + interval '10 days', null);
select public.planifier_relances();
select is(pg_temp.nb('a1'), 2, 'a1 : une nouvelle Relance après le rythme');
select is(pg_temp.sujet('a1'), 'evenement_id', 'a1 : l''Événement des 30 prochains jours passe avant la nouveauté');
select is(pg_temp.sujet('a5'), 'kit_id', 'a5 : le Kit commencé passe avant l''Événement');

-- 14-15. Sans sujet : aucune Relance (a1 a déjà tout reçu dans le rythme ; on retire l'Événement et la nouveauté après un nouveau rythme).
set local session_replication_role = replica;
update public.envoi set cree_le = now() - interval '10 days', cle = cle || ':ancienne2' where modele::text = 'relance';
update public.evenement set debut_le = now() + interval '60 days' where id = '00000000-0000-4000-8000-0000000000c1';
update public.produit set publie_le = now() - interval '40 days' where slug = 'rl-nouveau';
delete from public.progression_video where compte_id = pg_temp.id('a5');
reset session_replication_role;
select public.planifier_relances();
select is(pg_temp.nb('a1'), 2, 'aucun sujet (Événement à 60 jours, nouveauté vieille de 40 jours) : aucune Relance pour a1');
select is(pg_temp.nb('a5'), 2, 'aucun sujet (Kit plus commencé) : aucune Relance pour a5');

-- 16-17. Réglage du rythme absent ou invalide : rien n'est planifié.
set local session_replication_role = replica;
update public.envoi set cree_le = now() - interval '10 days', cle = cle || ':ancienne3' where modele::text = 'relance';
update public.evenement set debut_le = now() + interval '5 days' where id = '00000000-0000-4000-8000-0000000000c1';
update public.reglage set valeur = null where cle = 'relances_rythme_jours';
reset session_replication_role;
select is(public.planifier_relances(), 0, 'rythme effacé : aucune Relance planifiée (jamais de valeur de repli)');
select is(pg_temp.nb('a1'), 2, 'rythme effacé : a1 ne reçoit rien');

select * from finish();
rollback;
