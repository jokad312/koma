-- Story 9.14 : réglage session_inactivite_heures (1 à 24 heures, entier) dans enregistrer_reglage. Données TEST_ annulées à la fin.
begin;
select plan(9);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-rsi1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-rsi2@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e1', 'admin');
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb $$;
create function pg_temp.sans() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000e2","role":"admin"}'::jsonb $$;

select lives_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'session_inactivite_heures', '1')$$, '1 heure est acceptée');
select lives_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'session_inactivite_heures', '24')$$, '24 heures sont acceptées');
select is((select valeur from public.reglage where cle = 'session_inactivite_heures'), '24', 'la valeur est enregistrée');
select throws_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'session_inactivite_heures', '0')$$, 'P0001', 'KS_REGLAGE_INVALIDE', '0 heure est refusé');
select throws_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'session_inactivite_heures', '25')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'plus de 24 heures est refusé');
select throws_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'session_inactivite_heures', '4,5')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'un nombre non entier est refusé');
select throws_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'session_inactivite_heures', 'abc')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'un texte est refusé');
select throws_ok($$select public.enregistrer_reglage(pg_temp.sans(), 'session_inactivite_heures', '4')$$, 'P0001', null, 'sans le droit d''Admin, le réglage est refusé');
select lives_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'session_inactivite_heures', '')$$, 'un texte vide efface le réglage (4 h appliquées par le serveur)');

select * from finish();
rollback;
