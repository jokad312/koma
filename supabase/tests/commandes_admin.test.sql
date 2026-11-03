-- Story 6.2 : exiger_personnel (admin ou assistant, role relu en base) et corriger_adresse_commande (journalisee, livraison seulement).
-- Donnees TEST_ creees dans la transaction, puis annulees.
begin;
select plan(11);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'test-ca1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'test-ca2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d3', 'test-ca3@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000d1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000d2', 'assistant');
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":"admin"}'::jsonb $$;
create function pg_temp.ass() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000d2","role":"assistant"}'::jsonb $$;
-- Un client qui se dit « admin » dans l'objet recu : le role vient de la base.
create function pg_temp.faux() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000d3","role":"admin"}'::jsonb $$;

insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, zone, mode_remise, telephone, adresse) values
  ('00000000-0000-4000-8000-0000000000e1', 'KS-2026-820001', '00000000-0000-0000-0000-0000000000d3', 'produits', 'payee', 500, 700, 'bukavu', 'livraison', '+243990000000', 'Ancienne adresse TEST'),
  ('00000000-0000-4000-8000-0000000000e2', 'KS-2026-820002', '00000000-0000-0000-0000-0000000000d3', 'produits', 'payee', 500, 500, 'goma', 'retrait', '+243990000000', null);

select lives_ok($$ select public.exiger_personnel(pg_temp.adm()) $$, 'admin accepte');
select lives_ok($$ select public.exiger_personnel(pg_temp.ass()) $$, 'assistant accepte');
select throws_ok($$ select public.exiger_personnel(pg_temp.faux()) $$, 'KS_DROIT_REFUSE', 'role non porte par la base : refuse');
select throws_ok($$ select public.exiger_personnel(null) $$, 'KS_AUTEUR_MANQUANT', 'auteur absent : refuse');

select lives_ok($$ select public.corriger_adresse_commande(pg_temp.ass(), 'KS-2026-820001', '  Nouvelle adresse TEST  ') $$, 'assistant corrige une adresse de livraison');
select is((select adresse from public.commande where numero = 'KS-2026-820001'), 'Nouvelle adresse TEST', 'adresse nettoyee et enregistree');
select ok(
  exists (select 1 from public.journal_audit where cible_table = 'commande' and cible_id = '00000000-0000-4000-8000-0000000000e1' and action = 'update' and auteur ->> 'id' = '00000000-0000-0000-0000-0000000000d2'),
  'correction journalisee avec son auteur'
);
select throws_ok($$ select public.corriger_adresse_commande(pg_temp.ass(), 'KS-2026-820002', 'x') $$, 'KS_PAS_DE_LIVRAISON', 'retrait : pas d adresse');
select throws_ok($$ select public.corriger_adresse_commande(pg_temp.ass(), 'KS-2026-820001', '   ') $$, 'KS_ADRESSE_INVALIDE', 'adresse vide refusee');
select throws_ok($$ select public.corriger_adresse_commande(pg_temp.ass(), 'KS-2099-999999', 'x') $$, 'KS_COMMANDE_INTROUVABLE', 'commande inconnue');
select throws_ok($$ select public.corriger_adresse_commande(pg_temp.faux(), 'KS-2026-820001', 'x') $$, 'KS_DROIT_REFUSE', 'sans role en base : refuse');

select * from finish();
rollback;
