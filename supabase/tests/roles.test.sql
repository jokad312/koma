begin;
select plan(27);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'test-r1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000c2', 'test-r2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000c3', 'test-r3@example.invalid', '{}');

-- Premier admin : auteur système (commande npm run admin:attribuer).
select lives_ok($$select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c1', 'admin')$$, 'le système attribue le rôle admin');
select ok(public.a_le_role('00000000-0000-0000-0000-0000000000c1', 'admin'), 'a_le_role confirme admin');
select ok(not public.a_le_role('00000000-0000-0000-0000-0000000000c1', 'assistant'), 'un rôle non attribué est faux');
select is(
  (select auteur ->> 'type' from public.journal_audit where cible_table = 'role_utilisateur' and cible_id = '00000000-0000-0000-0000-0000000000c1'),
  'systeme',
  'l''attribution est journalisée avec l''auteur système'
);

-- Un admin attribue un rôle ; un non-admin ne le peut pas, quoi que dise son auteur.
select lives_ok($$select public.attribuer_role('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c1","role":"admin"}'::jsonb, '00000000-0000-0000-0000-0000000000c2', 'assistant')$$, 'un admin attribue un rôle');
select ok(public.a_le_role('00000000-0000-0000-0000-0000000000c2', 'assistant'), 'l''Assistant a son rôle');
select throws_ok($$select public.attribuer_role('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c2","role":"assistant"}'::jsonb, '00000000-0000-0000-0000-0000000000c3', 'admin')$$, 'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne peut pas attribuer de rôle');
select throws_ok($$select public.attribuer_role('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c3","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000c3', 'admin')$$, 'P0001', 'KS_DROIT_REFUSE', 'un Compte sans rôle ne peut pas attribuer de rôle');
select throws_ok($$select public.attribuer_role('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c3","role":"admin"}'::jsonb, '00000000-0000-0000-0000-0000000000c3', 'admin')$$, 'P0001', 'KS_DROIT_REFUSE', 'le rôle écrit dans l''auteur n''est jamais cru');
select throws_ok($$select public.attribuer_role(null, '00000000-0000-0000-0000-0000000000c3', 'admin')$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'sans auteur refusé');

-- Valeurs invalides.
select throws_ok($$select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c3', 'roi')$$, 'P0001', 'KS_ROLE_INVALIDE', 'un rôle inconnu est refusé');
select throws_ok($$select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000ff', 'admin')$$, 'P0001', 'KS_COMPTE_INTROUVABLE', 'un Compte inconnu est refusé');

-- Idempotence.
select lives_ok($$select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c1', 'admin')$$, 'attribuer deux fois ne casse rien');
select is((select count(*)::int from public.role_utilisateur where compte = '00000000-0000-0000-0000-0000000000c1' and role = 'admin'), 1, 'un seul rôle admin par Compte');

-- Validité dans le temps et événement.
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c3', 'benevole', null, now() - interval '2 days', now() - interval '1 day');
select ok(not public.a_le_role('00000000-0000-0000-0000-0000000000c3', 'benevole'), 'un rôle expiré est faux');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c3', 'benevole', '00000000-0000-0000-0000-0000000000e1');
select ok(public.a_le_role('00000000-0000-0000-0000-0000000000c3', 'benevole', '00000000-0000-0000-0000-0000000000e1'), 'le rôle vaut pour son événement');
select ok(not public.a_le_role('00000000-0000-0000-0000-0000000000c3', 'benevole', '00000000-0000-0000-0000-0000000000e2'), 'et pas pour un autre');

-- Rôle déjà présent mais expiré : une nouvelle attribution met à jour les dates (sans doublon).
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c2', 'assistant', null, now() - interval '2 days', now() - interval '1 day');
select ok(not public.a_le_role('00000000-0000-0000-0000-0000000000c2', 'assistant'), 'un rôle mis à expirer est faux');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c2', 'assistant');
select ok(public.a_le_role('00000000-0000-0000-0000-0000000000c2', 'assistant'), 'réattribuer un rôle expiré le rétablit');
select is((select count(*)::int from public.role_utilisateur where compte = '00000000-0000-0000-0000-0000000000c2' and role = 'assistant'), 1, 'sans doublon');

-- Écriture directe sans auteur : refusée par le trigger.
set local ks.auteur = '';
select throws_ok($$delete from public.role_utilisateur where compte = '00000000-0000-0000-0000-0000000000c2'$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'une écriture directe sans auteur est refusée');

-- Droits : anon et authenticated n'écrivent ni ne lisent la table ; seul a_le_role leur est ouvert.
set local role authenticated;
select throws_ok($$select * from public.role_utilisateur$$, '42501', null, 'authenticated ne lit pas la table des rôles');
select throws_ok($$insert into public.role_utilisateur (compte, role) values ('00000000-0000-0000-0000-0000000000c3', 'admin')$$, '42501', null, 'authenticated ne peut pas s''attribuer un rôle');
select ok(public.a_le_role('00000000-0000-0000-0000-0000000000c1', 'admin'), 'authenticated peut appeler a_le_role');
reset role;
select ok(
  not has_function_privilege('anon', 'public.attribuer_role(jsonb, uuid, text, uuid, timestamptz, timestamptz)', 'execute')
  and not has_function_privilege('authenticated', 'public.attribuer_role(jsonb, uuid, text, uuid, timestamptz, timestamptz)', 'execute')
  and has_function_privilege('service_role', 'public.attribuer_role(jsonb, uuid, text, uuid, timestamptz, timestamptz)', 'execute'),
  'attribuer_role est réservée au service_role'
);

-- Supprimer un Compte supprime ses rôles (journalisé au nom du système) sans être bloqué.
select lives_ok($$delete from auth.users where id = '00000000-0000-0000-0000-0000000000c2'$$, 'supprimer un Compte avec un rôle fonctionne');
select is(
  (select auteur ->> 'nom' from public.journal_audit where cible_table = 'role_utilisateur' and action = 'delete' and cible_id = '00000000-0000-0000-0000-0000000000c2'),
  'suppression_compte',
  'la suppression en cascade est journalisée'
);

select * from finish();
rollback;
