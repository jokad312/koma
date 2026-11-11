-- Story 7.9 : annulation et remboursement d'un Pass (FR-38, AD-8, AD-23, AD-31). Frais figés avec la Commande, délai de 48 h calculé en base,
-- demande du client, acceptation (Pass « annule », montant figé arrondi au centime inférieur, Stand par paire), refus, remboursement avec preuve,
-- emails planifiés une seule fois, fonctions fermées aux clients. Données TEST_ annulées à la fin.
-- Exécuté par la CI (Docker) ; en local, `npm run test:sql` explique l'absence de Docker et sort sans erreur.
begin;
select plan(55);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'test-ap1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', 'test-ap2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b3', 'test-ap3@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b4', 'test-ap4@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b1', 'admin');
-- b1 Admin, b2 Compte sans droit (jamais cru sur sa parole), b3 acheteur, b4 autre Compte.
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":"admin"}'::jsonb $$;
create function pg_temp.sansdroit() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000b2","role":"admin"}'::jsonb $$;
create function pg_temp.pid(p_n integer) returns uuid language sql as $$ select ('00000000-0000-4000-8000-00000000f1' || lpad(to_hex(p_n), 2, '0'))::uuid $$;

insert into public.evenement (id, auteur_id, titre_fr, titre_en, slug, publie_le, debut_le) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'TEST_Festival', 'TEST_Festival EN', 'test-ap-ev1', now() - interval '2 days', now() + interval '5 days'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-0000000000b1', 'TEST_Bientot', null, 'test-ap-ev2', now() - interval '2 days', now() + interval '30 hours');
insert into public.type_pass (id, evenement_id, nom_fr, nom_en, prix_cents, est_stand) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', 'TEST_VIP', 'TEST_VIP EN', 3000, false),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000a1', 'TEST_Stand', 'TEST_Stand EN', 4000, true),
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000a2', 'TEST_Court', 'TEST_Court', 3000, false);

-- Réglage des frais : 20 %. Les Commandes c1 à c4 et c8 le figent ; le réglage passe ensuite à 33 (c6), puis disparaît (c7).
insert into public.reglage (cle, valeur) values ('frais_annulation_pass', '20') on conflict (cle) do update set valeur = '20';

-- Commandes (acheteur b3) : c1 = 2 VIP (3000 chacun, réduction 600 sur la ligne) ; c2 = 1 Stand (4000, deux titulaires) ; c3 offerte ;
-- c4 Événement dans moins de 48 h ; c5 = 1 VIP payé par b3 mais lu par b4 (refus d'un autre Compte) ; c8 = 1 VIP qui sera scanné avant l'acceptation.
create function pg_temp.cmd(p_n integer) returns uuid language sql as $$ select ('00000000-0000-4000-8000-00000000c0' || lpad(to_hex(p_n), 2, '0'))::uuid $$;
create function pg_temp.lig(p_n integer) returns uuid language sql as $$ select ('00000000-0000-4000-8000-00000000d0' || lpad(to_hex(p_n), 2, '0'))::uuid $$;
create function pg_temp.nouvelle_commande(p_n integer, p_statut text, p_offerte boolean, p_total integer) returns void language sql as $$
  insert into public.commande (id, numero, compte_id, type, statut, offerte, sous_total_cents, total_cents, paye_le)
  values (pg_temp.cmd(p_n), 'KS-2026-83' || lpad(p_n::text, 4, '0'), '00000000-0000-0000-0000-0000000000b3', 'pass', p_statut, p_offerte, p_total, p_total, case when p_offerte then null else now() end)
$$;
select pg_temp.nouvelle_commande(1, 'payee', false, 5400);
select pg_temp.nouvelle_commande(2, 'payee', false, 4000);
select pg_temp.nouvelle_commande(3, 'offerte', true, 0);
select pg_temp.nouvelle_commande(4, 'payee', false, 3000);
select pg_temp.nouvelle_commande(5, 'payee', false, 3000);
select pg_temp.nouvelle_commande(8, 'payee', false, 3000);

-- 1. Frais figés avec la Commande de Pass (AD-8) : 20 au moment de l'achat.
select is((select frais_annulation_pass from public.commande where id = pg_temp.cmd(1)), 20::smallint, 'les frais du réglage sont figés avec la Commande de Pass');
update public.reglage set valeur = '33' where cle = 'frais_annulation_pass';
select pg_temp.nouvelle_commande(6, 'payee', false, 1001);
select is((select frais_annulation_pass from public.commande where id = pg_temp.cmd(6)), 33::smallint, 'une Commande passée après le changement de réglage fige la nouvelle valeur');
select is((select frais_annulation_pass from public.commande where id = pg_temp.cmd(1)), 20::smallint, 'changer le réglage ne touche pas une Commande déjà passée');
select is((select frais_annulation_pass from public.commande where id = pg_temp.cmd(1)) is null, false, 'jamais de frais inventés pour une Commande de Pass');

insert into public.ligne_commande (id, commande_id, produit_id, nombre, prix_cents, reduction_cents, type_pass_id, titulaires, pass_nom_fr, pass_nom_en, est_stand) values
  (pg_temp.lig(1), pg_temp.cmd(1), null, 2, 3000, 600, '00000000-0000-4000-8000-0000000000c1', '["a","b"]', 'TEST_VIP', 'TEST_VIP', false),
  (pg_temp.lig(2), pg_temp.cmd(2), null, 1, 4000, 0, '00000000-0000-4000-8000-0000000000c2', '["a","b"]', 'TEST_Stand', 'TEST_Stand', true),
  (pg_temp.lig(3), pg_temp.cmd(3), null, 1, 3000, 0, '00000000-0000-4000-8000-0000000000c1', '["a"]', 'TEST_VIP', 'TEST_VIP', false),
  (pg_temp.lig(4), pg_temp.cmd(4), null, 1, 3000, 0, '00000000-0000-4000-8000-0000000000c3', '["a"]', 'TEST_Court', 'TEST_Court', false),
  (pg_temp.lig(5), pg_temp.cmd(5), null, 1, 3000, 0, '00000000-0000-4000-8000-0000000000c1', '["a"]', 'TEST_VIP', 'TEST_VIP', false),
  (pg_temp.lig(6), pg_temp.cmd(6), null, 1, 1001, 0, '00000000-0000-4000-8000-0000000000c1', '["a"]', 'TEST_VIP', 'TEST_VIP', false),
  (pg_temp.lig(8), pg_temp.cmd(8), null, 1, 3000, 0, '00000000-0000-4000-8000-0000000000c1', '["a"]', 'TEST_VIP', 'TEST_VIP', false);
-- Pass : 1-2 (c1), 3-4 (Stand, c2), 5 (offert), 6 (Événement proche), 7 (c5), 8 (c6), 9 (c8).
insert into public.pass (id, evenement_id, type_pass_id, commande_id, ligne_commande_id, rang, nom_titulaire, statut, jeton, code_court)
select pg_temp.pid(n), ev, tp, pg_temp.cmd(cm), pg_temp.lig(cm), rang, 'TEST_' || nom, 'valide', lpad(to_hex(n), 2, '0') || repeat('ab', 23), code
from (values
  (1, '00000000-0000-4000-8000-0000000000a1'::uuid, '00000000-0000-4000-8000-0000000000c1'::uuid, 1, 1, 'Un',     'AAAAAAA2'),
  (2, '00000000-0000-4000-8000-0000000000a1'::uuid, '00000000-0000-4000-8000-0000000000c1'::uuid, 1, 2, 'Deux',   'AAAAAAA3'),
  (3, '00000000-0000-4000-8000-0000000000a1'::uuid, '00000000-0000-4000-8000-0000000000c2'::uuid, 2, 1, 'Trois',  'AAAAAAA4'),
  (4, '00000000-0000-4000-8000-0000000000a1'::uuid, '00000000-0000-4000-8000-0000000000c2'::uuid, 2, 2, 'Quatre', 'AAAAAAA5'),
  (5, '00000000-0000-4000-8000-0000000000a1'::uuid, '00000000-0000-4000-8000-0000000000c1'::uuid, 3, 1, 'Cinq',   'AAAAAAA6'),
  (6, '00000000-0000-4000-8000-0000000000a2'::uuid, '00000000-0000-4000-8000-0000000000c3'::uuid, 4, 1, 'Six',    'AAAAAAA7'),
  (7, '00000000-0000-4000-8000-0000000000a1'::uuid, '00000000-0000-4000-8000-0000000000c1'::uuid, 5, 1, 'Sept',   'AAAAAAA8'),
  (8, '00000000-0000-4000-8000-0000000000a1'::uuid, '00000000-0000-4000-8000-0000000000c1'::uuid, 6, 1, 'Huit',   'AAAAAAA9'),
  (9, '00000000-0000-4000-8000-0000000000a1'::uuid, '00000000-0000-4000-8000-0000000000c1'::uuid, 8, 1, 'Neuf',   'BBBBBBB2')
) as j(n, ev, tp, cm, rang, nom, code);

-- 5-6. Fonctions fermées : serveur seulement ; internes fermées à tous.
select is(
  (select count(*)::int from unnest(array['public.demander_annulation_pass(uuid, uuid)', 'public.pass_annulables(uuid)', 'public.annuler_pass(jsonb, uuid)']) f
    where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')),
  0, 'aucune fonction d''annulation de Pass n''est exécutable par anon ni authenticated'
);
select is(
  (select count(*)::int from unnest(array['public.demander_annulation_pass(uuid, uuid)', 'public.pass_annulables(uuid)', 'public.annuler_pass(jsonb, uuid)']) f where has_function_privilege('service_role', f, 'execute')),
  3, 'le serveur exécute les trois fonctions d''annulation de Pass'
);
select is(
  (select count(*)::int from unnest(array['public.evenements_unite_pass(uuid)', 'public.evenements_motif_refus_annulation(uuid)', 'public.evenements_frais_commande(uuid)', 'public.evenements_frais_reglage()', 'public.commande_figer_frais_pass()']) f
    where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or has_function_privilege('service_role', f, 'execute')),
  0, 'les fonctions internes sont fermées à tous les rôles'
);

-- 7. Pass annulables du Compte b3 : 1, 2 (c1), 3, 4 (Stand), 7, 8, 9 ; ni l'offert (5) ni celui d'un Événement dans moins de 48 h (6).
select is(
  (select array_agg(n order by n) from generate_series(1, 9) n where pg_temp.pid(n) = any (public.pass_annulables('00000000-0000-0000-0000-0000000000b3'))),
  array[1, 2, 3, 4, 7, 8, 9], 'seuls les Pass payés, valides et à plus de 48 h sont annulables (ni offert, ni Événement proche)'
);
select is(public.pass_annulables('00000000-0000-0000-0000-0000000000b4'), '{}'::uuid[], 'un autre Compte n''a aucun Pass annulable');

-- 9-12. Refus de la demande.
select throws_ok($$ select public.demander_annulation_pass('00000000-0000-0000-0000-0000000000b4', pg_temp.pid(1)) $$, 'KS_PASS_INTROUVABLE', 'le Pass d''un autre Compte est introuvable');
select throws_ok($$ select public.demander_annulation_pass('00000000-0000-0000-0000-0000000000b3', pg_temp.pid(5)) $$, 'KS_ANNULATION_IMPOSSIBLE', 'un Pass offert ne se rembourse pas');
select throws_ok($$ select public.demander_annulation_pass('00000000-0000-0000-0000-0000000000b3', pg_temp.pid(6)) $$, 'KS_ANNULATION_IMPOSSIBLE', 'à moins de 48 heures : impossible (calcul en base)');
select throws_ok($$ select public.demander_annulation_pass('00000000-0000-0000-0000-0000000000b3', gen_random_uuid()) $$, 'KS_PASS_INTROUVABLE', 'Pass inconnu');

-- 13-16. Demande du client.
create temp table dem as select public.demander_annulation_pass('00000000-0000-0000-0000-0000000000b3', pg_temp.pid(1)) as id;
select is((select statut || '/' || type from public.demande_client where id = (select id from dem)), 'ouverte/annulation_pass', 'la demande est ouverte, de type annulation_pass');
select is((select pass_id from public.demande_client where id = (select id from dem)), pg_temp.pid(1), 'la demande porte le Pass concerné');
select throws_ok($$ select public.demander_annulation_pass('00000000-0000-0000-0000-0000000000b3', pg_temp.pid(1)) $$, 'KS_DEMANDE_EN_COURS', 'une seule demande ouverte par Pass');
select is(
  (select array_agg(n order by n) from generate_series(1, 2) n where pg_temp.pid(n) = any (public.pass_annulables('00000000-0000-0000-0000-0000000000b3'))),
  array[2], 'le Pass dont la demande est ouverte n''est plus proposé ; son voisin (autre titulaire) l''est encore'
);

-- 17-19. Droits : seul l'Admin traite ; la décision doit être valable.
select throws_ok($$ select public.traiter_demande(pg_temp.sansdroit(), (select id from dem), 'accepter') $$, 'KS_DROIT_REFUSE', 'un Compte sans droit ne traite pas la demande');
select throws_ok($$ select public.annuler_pass(pg_temp.sansdroit(), pg_temp.pid(1)) $$, 'KS_DROIT_REFUSE', 'annuler_pass exige l''Admin');
select throws_ok($$ select public.traiter_demande(pg_temp.adm(), (select id from dem), 'peut-etre') $$, 'KS_DECISION_INVALIDE', 'décision invalide');

-- 20-22. Refus par l'Admin : le Pass reste valide, aucun remboursement, une nouvelle demande est possible.
select lives_ok($$ select public.traiter_demande(pg_temp.adm(), (select id from dem), 'refuser') $$, 'l''Admin refuse la demande');
select is((select statut from public.pass where id = pg_temp.pid(1)), 'valide', 'refus : le Pass reste valide');
select is((select count(*)::int from public.remboursement where cible_type = 'pass' and cible_id = pg_temp.pid(1)), 0, 'refus : aucun remboursement');
select throws_ok($$ select public.traiter_demande(pg_temp.adm(), (select id from dem), 'accepter') $$, 'KS_DEMANDE_DEJA_TRAITEE', 'une demande refusée ne se rouvre pas');

-- 23-30. Acceptation : Pass « annule », montant figé = (3000 x 2 - 600) / 2 x (1 - 20 %) = 2160.
create temp table dem2 as select public.demander_annulation_pass('00000000-0000-0000-0000-0000000000b3', pg_temp.pid(1)) as id;
select lives_ok($$ select public.traiter_demande(pg_temp.adm(), (select id from dem2), 'accepter') $$, 'l''Admin accepte la nouvelle demande');
select is((select statut from public.pass where id = pg_temp.pid(1)), 'annule', 'le Pass est annulé (refusé au Scan dès cet instant)');
select is((select statut from public.pass where id = pg_temp.pid(2)), 'valide', 'l''autre Pass de la ligne n''est pas touché');
select is((select montant_cents::int from public.remboursement where cible_type = 'pass' and cible_id = pg_temp.pid(1)), 2160, 'montant à rendre : (prix - réduction) de la ligne / 2 x (1 - frais)');
select is((select devise from public.remboursement where cible_type = 'pass' and cible_id = pg_temp.pid(1)), 'USD', 'le remboursement garde la devise de la Commande');
select is((select statut from public.demande_client where id = (select id from dem2)), 'acceptee', 'la demande est acceptée');
select is((select count(*)::int from public.envoi where modele = 'pass_annule' and cle = 'pass_annule:' || pg_temp.pid(1)::text), 1, 'l''email pass_annule est planifié une seule fois');
select is(
  (select donnees from public.envoi where cle = 'pass_annule:' || pg_temp.pid(1)::text),
  jsonb_build_object('commande_id', pg_temp.cmd(1), 'pass_id', pg_temp.pid(1)), 'l''envoi ne porte que des identifiants'
);

-- 31-33. Stand : la demande sur le second titulaire annule les deux ; un seul remboursement de 4000 x 80 % = 3200, rattaché au Pass de la demande.
create temp table dem3 as select public.demander_annulation_pass('00000000-0000-0000-0000-0000000000b3', pg_temp.pid(4)) as id;
select throws_ok($$ select public.demander_annulation_pass('00000000-0000-0000-0000-0000000000b3', pg_temp.pid(3)) $$, 'KS_DEMANDE_EN_COURS', 'Stand : l''autre titulaire est couvert par la demande en cours');
select lives_ok($$ select public.traiter_demande(pg_temp.adm(), (select id from dem3), 'accepter') $$, 'Stand : l''Admin accepte');
select is((select array_agg(statut order by rang) from public.pass where ligne_commande_id = pg_temp.lig(2)), array['annule', 'annule'], 'Stand : les deux Pass s''annulent ensemble');
select is((select array_agg(montant_cents::int) from public.remboursement where cible_type = 'pass' and cible_id in (pg_temp.pid(3), pg_temp.pid(4))), array[3200], 'Stand : un seul remboursement, de 3200');

-- 34. Arrondi au centime inférieur : 1001 x (1 - 33 %) = 670,67 -> 670.
select public.demander_annulation_pass('00000000-0000-0000-0000-0000000000b3', pg_temp.pid(8));
select public.traiter_demande(pg_temp.adm(), (select id from public.demande_client where pass_id = pg_temp.pid(8)), 'accepter');
select is((select montant_cents::int from public.remboursement where cible_type = 'pass' and cible_id = pg_temp.pid(8)), 670, 'arrondi au centime inférieur, frais figés à 33');

-- 35. Un Pass scanné entre la demande et l'acceptation ne s'annule plus.
select public.demander_annulation_pass('00000000-0000-0000-0000-0000000000b3', pg_temp.pid(9));
update public.pass set statut = 'scanne', scanne_le = now() where id = pg_temp.pid(9);
select throws_ok($$ select public.traiter_demande(pg_temp.adm(), (select id from public.demande_client where pass_id = pg_temp.pid(9)), 'accepter') $$, 'KS_ANNULATION_IMPOSSIBLE', 'un Pass déjà scanné ne s''annule plus');

-- 36-37. Les places se libèrent : le compteur d'un Type ne compte plus les Pass annulés.
select is((select count(*)::int from public.pass p where p.type_pass_id = '00000000-0000-4000-8000-0000000000c2' and p.statut not in ('annule', 'rembourse')), 0, 'le Stand annulé ne compte plus dans le quota de son Type');

-- 38-47. Remboursement : preuve obligatoire, Pass « rembourse », email unique, Stand par paire.
select throws_ok($$ select public.confirmer_remboursement(pg_temp.adm(), 'pass', pg_temp.pid(1), '') $$, 'KS_PREUVE_REQUISE', 'sans preuve : refusé');
select throws_ok($$ select public.confirmer_remboursement(pg_temp.adm(), 'pass', pg_temp.pid(1), 'ab') $$, 'KS_PREUVE_REQUISE', 'preuve trop courte : refusé');
select is((select statut from public.pass where id = pg_temp.pid(1)), 'annule', 'sans preuve, rien ne change');
select throws_ok($$ select public.confirmer_remboursement(pg_temp.sansdroit(), 'pass', pg_temp.pid(1), 'VIR-TEST-1') $$, 'KS_DROIT_REFUSE', 'seul l''Admin confirme un remboursement');
select throws_ok($$ select public.confirmer_remboursement(pg_temp.adm(), 'pass', pg_temp.pid(2), 'VIR-TEST-2') $$, 'KS_REMBOURSEMENT_IMPOSSIBLE', 'un Pass non annulé ne se rembourse pas');
select lives_ok($$ select public.confirmer_remboursement(pg_temp.adm(), 'pass', pg_temp.pid(1), 'VIR-TEST-1') $$, 'remboursement confirmé avec preuve');
select is((select statut from public.pass where id = pg_temp.pid(1)), 'rembourse', 'le Pass passe « rembourse »');
select is((select statut from public.demande_client where id = (select id from dem2)), 'close', 'la demande est close');
select is((select count(*)::int from public.envoi where cle = 'pass_rembourse:' || pg_temp.pid(1)::text), 1, 'l''email pass_rembourse est planifié');
select throws_ok($$ select public.confirmer_remboursement(pg_temp.adm(), 'pass', pg_temp.pid(1), 'VIR-TEST-1') $$, 'KS_REMBOURSEMENT_IMPOSSIBLE', 'pas de second remboursement');

select lives_ok($$ select public.confirmer_remboursement(pg_temp.adm(), 'pass', pg_temp.pid(4), 'VIR-TEST-4') $$, 'Stand : remboursement confirmé');
select is((select array_agg(statut order by rang) from public.pass where ligne_commande_id = pg_temp.lig(2)), array['rembourse', 'rembourse'], 'Stand : les deux Pass passent « rembourse » ensemble');
select is((select count(*)::int from public.envoi where modele = 'pass_rembourse'), 2, 'un email pass_rembourse par remboursement (Pass 1, Stand)');
select is((select statut from public.pass where id = pg_temp.pid(2)), 'valide', 'le voisin non annulé reste valide');

-- Réglage absent : une Commande passée sans frais n'a pas de frais figés, et sans réglage la demande est refusée (règle 15).
delete from public.reglage where cle = 'frais_annulation_pass';
select pg_temp.nouvelle_commande(7, 'payee', false, 3000);
insert into public.ligne_commande (id, commande_id, produit_id, nombre, prix_cents, type_pass_id, titulaires, pass_nom_fr, pass_nom_en, est_stand)
  values (pg_temp.lig(7), pg_temp.cmd(7), null, 1, 3000, '00000000-0000-4000-8000-0000000000c1', '["a"]', 'TEST_VIP', 'TEST_VIP', false);
insert into public.pass (id, evenement_id, type_pass_id, commande_id, ligne_commande_id, rang, nom_titulaire, statut, jeton, code_court)
  values (pg_temp.pid(10), '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1', pg_temp.cmd(7), pg_temp.lig(7), 1, 'TEST_Dix', 'valide', repeat('cd', 24), 'CCCCCCC2');
select is((select frais_annulation_pass from public.commande where id = pg_temp.cmd(7)), null::smallint, 'sans réglage, aucun frais n''est inventé');
select throws_ok($$ select public.demander_annulation_pass('00000000-0000-0000-0000-0000000000b3', pg_temp.pid(10)) $$, 'KS_REGLAGE_MANQUANT', 'sans frais connus, la demande est refusée');

select * from finish();
rollback;
