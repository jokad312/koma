-- Story 7.11 : réglage delai_stand_heures (1 à 168 heures) dans enregistrer_reglage. Données TEST_ annulées à la fin.
begin;
select plan(8);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'test-rs1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'test-rs2@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f1', 'admin');
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb $$;
create function pg_temp.sans() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f2","role":"admin"}'::jsonb $$;

select lives_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'delai_stand_heures', '72')$$, 'l''Admin règle le délai de paiement d''un Stand');
select is((select valeur from public.reglage where cle = 'delai_stand_heures'), '72', 'la valeur est enregistrée');
select throws_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'delai_stand_heures', '0')$$, 'P0001', 'KS_REGLAGE_INVALIDE', '0 heure est refusé');
select throws_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'delai_stand_heures', '169')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'plus de 168 heures est refusé');
select throws_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'delai_stand_heures', '4,5')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'un nombre non entier est refusé');
select throws_ok($$select public.enregistrer_reglage(pg_temp.sans(), 'delai_stand_heures', '48')$$, 'P0001', null, 'sans le droit d''Admin, le réglage est refusé');
select lives_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'delai_stand_heures', '')$$, 'un texte vide efface le réglage');
select is((select valeur from public.reglage where cle = 'delai_stand_heures'), null, 'le réglage effacé est vide (règle 15 : aucune candidature acceptée sans délai)');

select * from finish();
rollback;
