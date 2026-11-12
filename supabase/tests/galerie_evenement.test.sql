-- Story 7.10 : Galerie d'événement (FR-39). Lien valable (https, Google Drive ou Google Photos seulement), enregistrement réservé à l'Admin et journalisé,
-- email planifié une seule fois par acheteur de Pass d'un Événement terminé dont le lien est saisi (jamais un Pass annulé, une Commande annulée,
-- un Événement futur, sans lien ou non publié), fonctions fermées aux clients. Données TEST_ annulées à la fin.
-- Exécuté par la CI (Docker) ; en local, `npm run test:sql` explique l'absence de Docker et sort sans erreur.
begin;
select plan(37);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'test-ga1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000c2', 'test-ga2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000c3', 'test-ga3@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000c4', 'test-ga4@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000c5', 'test-ga5@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000c6', 'test-ga6@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000c7', 'test-ga7@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c1', 'admin');
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000c1","role":"admin"}'::jsonb $$;
create function pg_temp.sansdroit() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000c2","role":"admin"}'::jsonb $$;
create function pg_temp.ev(p_n integer) returns uuid language sql as $$ select ('00000000-0000-4000-8000-0000000000a' || p_n::text)::uuid $$;

-- Événements : 1 terminé et publié (lien saisi plus bas), 2 futur, 3 terminé sans lien, 4 terminé mais non publié.
insert into public.evenement (id, auteur_id, titre_fr, titre_en, slug, publie_le, debut_le, fin_le) values
  (pg_temp.ev(1), '00000000-0000-0000-0000-0000000000c1', 'TEST_Passe', 'TEST_Past EN', 'test-ga-ev1', now() - interval '10 days', now() - interval '3 days', now() - interval '2 days'),
  (pg_temp.ev(2), '00000000-0000-0000-0000-0000000000c1', 'TEST_Futur', null, 'test-ga-ev2', now() - interval '10 days', now() + interval '3 days', null),
  (pg_temp.ev(3), '00000000-0000-0000-0000-0000000000c1', 'TEST_SansLien', null, 'test-ga-ev3', now() - interval '10 days', now() - interval '3 days', null),
  (pg_temp.ev(4), '00000000-0000-0000-0000-0000000000c1', 'TEST_NonPublie', null, 'test-ga-ev4', null, now() - interval '3 days', null);
insert into public.type_pass (id, evenement_id, nom_fr, nom_en, prix_cents) values
  ('00000000-0000-4000-8000-0000000000b1', pg_temp.ev(1), 'TEST_VIP', 'TEST_VIP', 3000),
  ('00000000-0000-4000-8000-0000000000b2', pg_temp.ev(2), 'TEST_VIP2', 'TEST_VIP2', 3000),
  ('00000000-0000-4000-8000-0000000000b3', pg_temp.ev(3), 'TEST_VIP3', 'TEST_VIP3', 3000),
  ('00000000-0000-4000-8000-0000000000b4', pg_temp.ev(4), 'TEST_VIP4', 'TEST_VIP4', 3000);

-- Acheteurs de l'Événement 1 : c3 (deux Pass valides, une seule Commande), c4 (Pass scanné), c5 (Pass annulé seulement), c6 (Commande annulée), c7 (Commande offerte).
-- Les Événements 2, 3 et 4 ont chacun un acheteur c3.
create function pg_temp.cmd(p_n integer) returns uuid language sql as $$ select ('00000000-0000-4000-8000-00000000c0' || lpad(to_hex(p_n), 2, '0'))::uuid $$;
create temp table jeu as
select * from (values
  (1, 'c3', 1, 'payee',   false, 'valide'),
  (2, 'c4', 1, 'payee',   false, 'scanne'),
  (3, 'c5', 1, 'payee',   false, 'annule'),
  (4, 'c6', 1, 'annulee', false, 'valide'),
  (5, 'c7', 1, 'offerte', true,  'valide'),
  (6, 'c3', 2, 'payee',   false, 'valide'),
  (7, 'c3', 3, 'payee',   false, 'valide'),
  (8, 'c3', 4, 'payee',   false, 'valide')
) as j(n, compte, ev, statut_cmd, offerte, statut_pass);
insert into public.commande (id, numero, compte_id, type, statut, offerte, sous_total_cents, total_cents, paye_le)
select pg_temp.cmd(n), 'KS-2026-82' || lpad(n::text, 4, '0'), ('00000000-0000-0000-0000-0000000000' || compte)::uuid, 'pass', statut_cmd, offerte, case when offerte then 0 else 3000 end, case when offerte then 0 else 3000 end, case when offerte then null else now() end
from jeu;
insert into public.ligne_commande (id, commande_id, produit_id, nombre, prix_cents, type_pass_id, titulaires, pass_nom_fr, pass_nom_en, est_stand)
select ('00000000-0000-4000-8000-00000000d0' || lpad(to_hex(n), 2, '0'))::uuid, pg_temp.cmd(n), null, case when n = 1 then 2 else 1 end, 3000,
  ('00000000-0000-4000-8000-0000000000b' || ev::text)::uuid, case when n = 1 then '["x","y"]' else '["x"]' end::jsonb, 'TEST_VIP', 'TEST_VIP', false
from jeu;
insert into public.pass (id, evenement_id, type_pass_id, commande_id, ligne_commande_id, rang, nom_titulaire, statut, jeton, code_court, scanne_le)
select ('00000000-0000-4000-8000-00000000f1' || lpad(to_hex(n * 2 + r), 2, '0'))::uuid, pg_temp.ev(ev), ('00000000-0000-4000-8000-0000000000b' || ev::text)::uuid, pg_temp.cmd(n),
  ('00000000-0000-4000-8000-00000000d0' || lpad(to_hex(n), 2, '0'))::uuid, r, 'TEST_Nom' || n || r, statut_pass, lpad(to_hex(n * 2 + r), 2, '0') || repeat('ab', 23),
  'GGGGGG' || chr(64 + n) || chr(64 + r), case when statut_pass = 'scanne' then now() - interval '3 days' end
from jeu, generate_series(1, 2) r where r = 1 or n = 1;

-- 1-5. Lien valable.
select ok(public.galerie_url_valide('https://drive.google.com/drive/folders/TEST_abc'), 'Google Drive accepté');
select ok(public.galerie_url_valide('https://photos.app.goo.gl/TEST_abc'), 'lien court Google Photos accepté');
select ok(public.galerie_url_valide('https://photos.google.com/share/TEST_abc?key=x'), 'Google Photos accepté');
select ok(not public.galerie_url_valide('http://drive.google.com/drive/folders/TEST_abc'), 'http refusé');
select ok(not public.galerie_url_valide('https://evil.example.invalid/drive.google.com/x') and not public.galerie_url_valide('https://drive.google.com.evil.example.invalid/x') and not public.galerie_url_valide('https://drive.google.com/a b'), 'autre site, faux sous-domaine et espace refusés');

-- 6-8. Droits d'exécution : serveur seulement ; fonctions internes fermées.
select is(
  (select count(*)::int from unnest(array['public.enregistrer_galerie_evenement(jsonb, uuid, text)', 'public.planifier_galeries_evenements()', 'public.galerie_evenement_pour_envoi(uuid, uuid)']) f
    where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')),
  0, 'aucune fonction de la Galerie n''est exécutable par anon ni authenticated'
);
select is(
  (select count(*)::int from unnest(array['public.enregistrer_galerie_evenement(jsonb, uuid, text)', 'public.planifier_galeries_evenements()', 'public.galerie_evenement_pour_envoi(uuid, uuid)']) f where has_function_privilege('service_role', f, 'execute')),
  3, 'le serveur exécute les trois fonctions de la Galerie'
);
select is(
  (select count(*)::int from unnest(array['public.galerie_url_valide(text)', 'public.galerie_evenement_declencher()']) f
    where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or has_function_privilege('service_role', f, 'execute')),
  0, 'les fonctions internes sont fermées à tous les rôles'
);

-- 9-10. Colonne publique : le lien est lisible comme les autres colonnes de présentation, sous la règle des Événements publiés.
select ok(has_column_privilege('anon', 'public.evenement', 'galerie_url', 'select'), 'le lien est lisible par le public (Événements publiés seulement, RLS)');
select ok(not has_column_privilege('anon', 'public.evenement', 'galerie_url', 'update'), 'le public ne peut pas écrire le lien');

-- 11-17. Enregistrement : Admin seulement, lien validé, journalisé, effaçable.
select throws_ok($$ select public.enregistrer_galerie_evenement(pg_temp.sansdroit(), pg_temp.ev(1), 'https://drive.google.com/drive/folders/TEST_abc') $$, 'KS_DROIT_REFUSE', 'un Compte sans droit n''enregistre pas le lien');
select throws_ok($$ select public.enregistrer_galerie_evenement(pg_temp.adm(), pg_temp.ev(1), 'http://drive.google.com/x') $$, 'KS_LIEN_INVALIDE', 'lien invalide refusé');
select throws_ok($$ select public.enregistrer_galerie_evenement(pg_temp.adm(), gen_random_uuid(), 'https://drive.google.com/drive/folders/TEST_abc') $$, 'KS_EVENEMENT_INTROUVABLE', 'Événement inconnu');
select is((select galerie_url from public.evenement where id = pg_temp.ev(1)), null, 'rien n''a été enregistré par les refus');
select lives_ok($$ select public.enregistrer_galerie_evenement(pg_temp.adm(), pg_temp.ev(1), '  https://drive.google.com/drive/folders/TEST_abc  ') $$, 'l''Admin enregistre le lien');
select is((select galerie_url from public.evenement where id = pg_temp.ev(1)), 'https://drive.google.com/drive/folders/TEST_abc', 'le lien est enregistré, sans espaces');
select ok(exists (select 1 from public.journal_audit where cible_table = 'evenement' and cible_id = pg_temp.ev(1)::text and action = 'update' and auteur ->> 'id' = '00000000-0000-0000-0000-0000000000c1'), 'le changement est journalisé avec son auteur');

-- Liens des autres Événements : 2 (futur), 4 (non publié) ; le 3 reste sans lien.
select public.enregistrer_galerie_evenement(pg_temp.adm(), pg_temp.ev(2), 'https://photos.app.goo.gl/TEST_futur');
select public.enregistrer_galerie_evenement(pg_temp.adm(), pg_temp.ev(4), 'https://photos.app.goo.gl/TEST_nonpublie');

-- 18-24. Planification : acheteurs c3, c4 et c7 de l'Événement 1 seulement, une fois.
select is(public.planifier_galeries_evenements(), 3, 'trois acheteurs (Pass valide, Pass scanné, Commande offerte) ; ni annulé, ni Commande annulée, ni Événement futur, sans lien ou non publié');
select is((select count(*)::int from public.envoi where modele = 'galerie_evenement'), 3, 'trois emails dans la boîte d''envoi');
select is((select array_agg(compte_id::text order by compte_id::text) from public.envoi where modele = 'galerie_evenement'),
  array['00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-0000000000c7'], 'les bons acheteurs');
select is((select count(*)::int from public.envoi where modele = 'galerie_evenement' and donnees = jsonb_build_object('evenement_id', pg_temp.ev(1))), 3, 'l''envoi ne porte que l''identifiant de l''Événement (jamais le lien ni une adresse)');
select is(public.planifier_galeries_evenements(), 0, 'rejouer la tâche ne planifie rien de plus');
select public.enregistrer_galerie_evenement(pg_temp.adm(), pg_temp.ev(1), 'https://drive.google.com/drive/folders/TEST_autre');
select is(public.planifier_galeries_evenements(), 0, 'un lien modifié ne renvoie pas l''email');
select is((select count(*)::int from public.envoi where modele = 'galerie_evenement'), 3, 'toujours trois emails');

-- 25-30. Données du rendu.
select is((public.galerie_evenement_pour_envoi(pg_temp.ev(1), '00000000-0000-0000-0000-0000000000c3') ->> 'acheteur')::boolean, true, 'c3 est acheteur de l''Événement 1');
select is((public.galerie_evenement_pour_envoi(pg_temp.ev(1), '00000000-0000-0000-0000-0000000000c5') ->> 'acheteur')::boolean, false, 'c5 (Pass annulé) n''est plus acheteur');
select is((public.galerie_evenement_pour_envoi(pg_temp.ev(1), '00000000-0000-0000-0000-0000000000c6') ->> 'acheteur')::boolean, false, 'c6 (Commande annulée) n''est pas acheteur');
select is(public.galerie_evenement_pour_envoi(pg_temp.ev(1), '00000000-0000-0000-0000-0000000000c3') ->> 'galerie_url', 'https://drive.google.com/drive/folders/TEST_autre', 'le lien est relu en base au moment du rendu');
select is((public.galerie_evenement_pour_envoi(pg_temp.ev(2), '00000000-0000-0000-0000-0000000000c3') ->> 'termine')::boolean, false, 'Événement futur : pas terminé');
select is(public.galerie_evenement_pour_envoi(gen_random_uuid(), '00000000-0000-0000-0000-0000000000c3'), null, 'Événement inconnu : rien');

-- 31-34. Effacer le lien, et Événement qui se termine ensuite.
select lives_ok($$ select public.enregistrer_galerie_evenement(pg_temp.adm(), pg_temp.ev(1), '   ') $$, 'un texte vide efface le lien');
select is((select galerie_url from public.evenement where id = pg_temp.ev(1)), null, 'lien effacé');
update public.evenement set debut_le = now() - interval '1 day', fin_le = now() - interval '1 hour' where id = pg_temp.ev(2);
select is(public.planifier_galeries_evenements(), 1, 'l''Événement 2, devenu terminé avec son lien, prévient son acheteur');
select is((select count(*)::int from public.envoi where modele = 'galerie_evenement'), 4, 'quatre emails au total');

-- Un envoi « ignoré » (lien effacé au moment du rendu) repart quand le lien est de nouveau valide : la clé d'envoi n'est pas consommée pour rien.
select ok(public.envois_ignorer((select id from public.envoi where modele = 'galerie_evenement' and donnees = jsonb_build_object('evenement_id', pg_temp.ev(2)) limit 1), 'TEST lien absent'), 'un envoi de l''Événement 2 est ignoré');
select is(public.planifier_galeries_evenements(), 0, 'rien de nouveau à planifier, mais l''envoi ignoré est remis à envoyer');
select is((select count(*)::int from public.envoi where modele = 'galerie_evenement' and statut = 'ignore'), 0, 'plus aucun envoi de Galerie ignoré tant que le lien est valide');

select * from finish();
rollback;
