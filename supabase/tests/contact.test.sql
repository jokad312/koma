begin;
select plan(25);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-c1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-c2@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e2', 'assistant');

-- Envoi valide : ligne « nouveau », champs rognés, insertion non journalisée.
select lives_ok($$select public.enregistrer_message_contact('{"type":"visiteur"}'::jsonb, '  Awa  ', 'awa@example.invalid', 'Bonjour, ceci est un message de test.', 'fr')$$, 'un message valide est enregistré');
select is((select statut from public.message_contact where nom = 'Awa'), 'nouveau', 'le message est « nouveau »');
select is((select langue from public.message_contact where nom = 'Awa'), 'fr', 'la langue est enregistrée');
select is((select count(*)::int from public.journal_audit where cible_table = 'message_contact'), 0, 'l''insertion n''est pas journalisée');

-- Valeurs et auteurs refusés.
select throws_ok($$select public.enregistrer_message_contact('{"type":"visiteur"}'::jsonb, '   ', 'a@example.invalid', 'Un message assez long.', 'fr')$$, 'P0001', 'KS_MESSAGE_INVALIDE', 'un nom vide est refusé');
select throws_ok($$select public.enregistrer_message_contact('{"type":"visiteur"}'::jsonb, repeat('x', 81), 'a@example.invalid', 'Un message assez long.', 'fr')$$, 'P0001', 'KS_MESSAGE_INVALIDE', 'un nom de plus de 80 caractères est refusé');
select throws_ok($$select public.enregistrer_message_contact('{"type":"visiteur"}'::jsonb, 'Awa', 'pas-un-email', 'Un message assez long.', 'fr')$$, 'P0001', 'KS_MESSAGE_INVALIDE', 'un email faux est refusé');
select throws_ok($$select public.enregistrer_message_contact('{"type":"visiteur"}'::jsonb, 'Awa', 'a@example.invalid', 'Court', 'fr')$$, 'P0001', 'KS_MESSAGE_INVALIDE', 'un message de moins de 10 caractères est refusé');
select throws_ok($$select public.enregistrer_message_contact('{"type":"visiteur"}'::jsonb, 'Awa', 'a@example.invalid', repeat('x', 2001), 'fr')$$, 'P0001', 'KS_MESSAGE_INVALIDE', 'un message de plus de 2000 caractères est refusé');
select throws_ok($$select public.enregistrer_message_contact('{"type":"visiteur"}'::jsonb, 'Awa', 'a@example.invalid', 'Un message assez long.', 'de')$$, 'P0001', 'KS_MESSAGE_INVALIDE', 'une langue inconnue est refusée');
select throws_ok($$select public.enregistrer_message_contact(null, 'Awa', 'a@example.invalid', 'Un message assez long.', 'fr')$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'sans auteur refusé');
select throws_ok($$select public.enregistrer_message_contact('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1"}'::jsonb, 'Awa', 'a@example.invalid', 'Un message assez long.', 'fr')$$, 'P0001', 'KS_AUTEUR_INVALIDE', 'seul un visiteur écrit un message de contact');
select is((select count(*)::int from public.message_contact), 1, 'les refus n''enregistrent rien');

-- Marquer traité : droit admin, journal avec l'auteur, deuxième appel refusé.
select throws_ok($$select public.marquer_message_traite('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e2","role":"admin"}'::jsonb, (select id from public.message_contact where nom = 'Awa'))$$, 'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne traite pas les messages');
select throws_ok($$select public.marquer_message_traite(null, (select id from public.message_contact where nom = 'Awa'))$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'sans auteur refusé');
select is((select statut from public.message_contact where nom = 'Awa'), 'nouveau', 'les refus ne changent rien');
select lives_ok($$select public.marquer_message_traite('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, (select id from public.message_contact where nom = 'Awa'))$$, 'l''admin marque le message traité');
select is((select statut from public.message_contact where nom = 'Awa'), 'traite', 'le message est « traite »');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'message_contact' and action = 'update' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000e1',
  'le journal porte l''auteur'
);
select throws_ok($$select public.marquer_message_traite('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, (select id from public.message_contact where nom = 'Awa'))$$, 'P0001', 'KS_MESSAGE_INTROUVABLE', 'un message déjà traité est refusé');

-- Écriture directe sans auteur : refusée par le trigger.
set local ks.auteur = '';
select throws_ok($$update public.message_contact set statut = 'nouveau'$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'une écriture directe sans auteur est refusée');

-- RLS fermée : ni lecture ni écriture pour anon et authenticated.
set local role anon;
select throws_ok($$select * from public.message_contact$$, '42501', null, 'anon ne lit pas les messages');
select throws_ok($$insert into public.message_contact (nom, email, message, langue) values ('x', 'x@example.invalid', 'Un message assez long.', 'fr')$$, '42501', null, 'anon n''écrit pas dans message_contact');
reset role;
set local role authenticated;
select throws_ok($$select * from public.message_contact$$, '42501', null, 'un Compte connecté ne lit pas les messages');
reset role;

select ok(
  not has_function_privilege('anon', 'public.enregistrer_message_contact(jsonb, text, text, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.enregistrer_message_contact(jsonb, text, text, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.marquer_message_traite(jsonb, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.marquer_message_traite(jsonb, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.enregistrer_message_contact(jsonb, text, text, text, text)', 'execute')
  and has_function_privilege('service_role', 'public.marquer_message_traite(jsonb, uuid)', 'execute'),
  'les fonctions de contact sont réservées au service_role'
);

select * from finish();
rollback;
