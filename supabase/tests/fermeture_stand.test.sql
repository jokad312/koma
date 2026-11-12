-- Fermeture sur place d'un Stand payé le jour de l'Événement, SANS remboursement (CGV §10, décision du 2026-11-12) : refus avant le début de l'Événement,
-- Pass annulés (même scannés), aucune ligne de remboursement, aucun email, une seule fermeture, fonction fermée aux clients. Données TEST_ annulées à la fin.
-- Exécuté par la CI (Docker) ; en local, `npm run test:sql` explique l'absence de Docker et sort sans erreur.
begin;
select plan(15);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-cs1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-cs2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e3', 'test-cs3@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e4', 'test-cs4@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e9', 'test-cs9@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e1', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e2', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e3', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e4', 25);
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e9', 'admin');

create function pg_temp.cl(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000e9","role":"admin"}'::jsonb $$;
create function pg_temp.sans() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000e4","role":"admin"}'::jsonb $$;
create function pg_temp.acc() returns jsonb language sql as $$ select '[{"objet":"pass_photos_video","version":"TEST_v1"}]'::jsonb $$;
create function pg_temp.kid(p_n integer) returns uuid language sql as $$ select ('00000000-0000-4000-8000-00000000b0' || lpad(to_hex(p_n), 2, '0'))::uuid $$;
-- Trois chemins de photos valides pour la candidature n de l'Événement p_ev.
create function pg_temp.photos(p_ev uuid, p_n integer) returns text[] language sql as $$
  select array[p_ev::text || '/' || pg_temp.kid(p_n)::text || '/1.jpg', p_ev::text || '/' || pg_temp.kid(p_n)::text || '/2.png', p_ev::text || '/' || pg_temp.kid(p_n)::text || '/3.webp']
$$;
create function pg_temp.dep(p_cpt text, p_n integer, p_ev uuid, p_type uuid) returns jsonb language sql as $$
  select public.deposer_candidature_stand(pg_temp.cl(p_cpt), pg_temp.kid(p_n), p_ev, p_type, 'TEST_ Bijoux et accessoires faits main, trois gammes.', '@test_exposant', pg_temp.photos(p_ev, p_n), 'TEST_v1')
$$;

insert into public.reglage (cle, valeur) values ('frais_annulation_pass', '20') on conflict (cle) do update set valeur = '20';
insert into public.reglage (cle, valeur) values ('delai_paiement', '30') on conflict (cle) do update set valeur = '30';

insert into public.evenement (id, auteur_id, titre_fr, slug, publie_le, debut_le, capacite) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-0000000000e9', 'TEST_Festival', 'test-cs-ev1', now() - interval '2 days', now() + interval '30 days', 10),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-0000000000e9', 'TEST_Brouillon', 'test-cs-ev2', null, now() + interval '30 days', null),
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-0000-0000-0000000000e9', 'TEST_Fini', 'test-cs-ev3', now() - interval '200 days', now() - interval '100 days', null);
insert into public.type_pass (id, evenement_id, nom_fr, nom_en, prix_cents, quota, est_stand) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', 'TEST_Stand', 'TEST_Stand EN', 4000, 3, true),
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000a1', 'TEST_Standard', 'TEST_Standard EN', 1500, null, false),
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000a2', 'TEST_Stand B', 'TEST_Stand B', 4000, null, true),
  ('00000000-0000-4000-8000-0000000000c4', '00000000-0000-4000-8000-0000000000a3', 'TEST_Stand fini', 'TEST_Stand fini', 4000, null, true);

select is((select count(*)::int from unnest(array['public.fermer_stand_sur_place(jsonb, uuid, text)']) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')), 0, 'fermer_stand_sur_place n''est exécutable ni par anon ni par authenticated');
select is((select count(*)::int from unnest(array['public.fermer_stand_sur_place(jsonb, uuid, text)']) f where has_function_privilege('service_role', f, 'execute')), 1, 'le serveur exécute fermer_stand_sur_place');

select lives_ok($$select pg_temp.dep('e1', 1, '00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000c1')$$, 'candidature acceptée');
select throws_ok($$select public.fermer_stand_sur_place(pg_temp.adm(), pg_temp.kid(1), 'Contrefaçon')$$, 'P0001', 'KS_STAND_NON_PAYE', 'un Stand non payé ne se ferme pas sur place');
create temp table s1 as select public.creer_commande_stand(pg_temp.cl('e1'), pg_temp.kid(1), pg_temp.acc(), 4000, 'test-cle-fs-0001', 'Alice Test', 'Aide Test', false) as r;
set local session_replication_role = replica;
update public.commande set statut = 'payee', paye_le = now() where id = (select (r ->> 'commande_id')::uuid from s1);
reset session_replication_role;
select is(public.evenements_emettre_pass((select (r ->> 'commande_id')::uuid from s1)), 2, 'deux Pass émis');

select throws_ok($$select public.fermer_stand_sur_place(pg_temp.adm(), pg_temp.kid(1), 'Contrefaçon')$$, 'P0001', 'KS_EVENEMENT_PAS_COMMENCE', 'avant le début de l''Événement : refus, il faut « Refuser »');
set local session_replication_role = replica;
update public.evenement set debut_le = now() - interval '1 hour' where id = '00000000-0000-4000-8000-0000000000a1';
-- Le titulaire est déjà entré : son Pass est scanné.
update public.pass set statut = 'scanne', scanne_le = now() where commande_id = (select (r ->> 'commande_id')::uuid from s1) and rang = 1;
reset session_replication_role;

select throws_ok($$select public.fermer_stand_sur_place(pg_temp.sans(), pg_temp.kid(1), 'Contrefaçon')$$, 'P0001', null, 'sans le droit d''Admin, la fermeture est impossible');
select throws_ok($$select public.fermer_stand_sur_place(pg_temp.adm(), pg_temp.kid(1), repeat('x', 501))$$, 'P0001', 'KS_MOTIF_INVALIDE', 'un motif trop long est refusé');
select lives_ok($$select public.fermer_stand_sur_place(pg_temp.adm(), pg_temp.kid(1), 'Copies de figurines')$$, 'le jour de l''Événement, l''Admin ferme le Stand');
select is((select string_agg(statut, ',' order by rang) from public.pass where commande_id = (select (r ->> 'commande_id')::uuid from s1)), 'annule,annule', 'les deux Pass sont annulés, même celui déjà scanné');
select is((select count(*)::int from public.remboursement where cible_type = 'pass' and cible_id in (select id from public.pass where commande_id = (select (r ->> 'commande_id')::uuid from s1))), 0, 'aucun remboursement n''est ouvert');
select is((select (fermee_le is not null)::text || '/' || statut || '/' || motif_fermeture from public.candidature_stand where id = pg_temp.kid(1)), 'true/validee/Copies de figurines', 'la candidature garde « validee » avec sa date et son motif de fermeture');
select is((select count(*)::int from public.envoi where cle = 'candidature_refusee:' || pg_temp.kid(1)::text), 0, 'aucun email de refus n''est planifié (seul l''email d''acceptation du dépôt existe)');
select throws_ok($$select public.fermer_stand_sur_place(pg_temp.adm(), pg_temp.kid(1), null)$$, 'P0001', 'KS_STAND_DEJA_FERME', 'un Stand ne se ferme qu''une fois');
select throws_ok($$select public.refuser_candidature_stand(pg_temp.adm(), pg_temp.kid(1), null)$$, 'P0001', 'KS_ANNULATION_IMPOSSIBLE', 'un Stand fermé ne se refuse plus (pas de remboursement par la porte de côté)');

select * from finish();
rollback;
