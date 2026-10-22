begin;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'test-k1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'test-k2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f3', 'test-k3@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f1', 'admin');
-- f2 : âge déclaré ; f3 : âge non déclaré.
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 20);

-- Correction normale.
select is(
  public.corriger_age('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 25, 'Erreur de saisie signalée par le client'),
  false,
  'la correction à 25 ans ne demande aucune suppression'
);
select is((select age_declare::int from public.profil where id = '00000000-0000-0000-0000-0000000000f2'), 25, 'l''âge est changé');
select is(
  (select avant ->> 'age_declare' from public.journal_audit where action = 'age_corrige' and cible_id = '00000000-0000-0000-0000-0000000000f2' order by id desc limit 1),
  '20',
  'le journal garde l''âge avant'
);
select is(
  (select apres ->> 'age_declare' from public.journal_audit where action = 'age_corrige' and cible_id = '00000000-0000-0000-0000-0000000000f2' order by id desc limit 1),
  '25',
  'le journal garde l''âge après'
);
select is(
  (select apres ->> 'raison' from public.journal_audit where action = 'age_corrige' and cible_id = '00000000-0000-0000-0000-0000000000f2' order by id desc limit 1),
  'Erreur de saisie signalée par le client',
  'le journal garde la raison'
);
select is(
  (select auteur ->> 'id' from public.journal_audit where action = 'age_corrige' and cible_id = '00000000-0000-0000-0000-0000000000f2' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000f1',
  'le journal garde l''auteur'
);

-- Refus.
select throws_ok($$select public.corriger_age('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 30, 'ab')$$, 'P0001', 'KS_RAISON_MANQUANTE', 'une raison trop courte est refusée');
select throws_ok($$select public.corriger_age('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 30, null)$$, 'P0001', 'KS_RAISON_MANQUANTE', 'sans raison refusé');
select throws_ok($$select public.corriger_age('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f2","role":"admin"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 30, 'Je me corrige moi-même')$$, 'P0001', 'KS_DROIT_REFUSE', 'un non-admin est refusé');
select throws_ok($$select public.corriger_age('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, '00000000-0000-0000-0000-0000000000f3', 30, 'Âge jamais déclaré')$$, 'P0001', 'KS_AGE_NON_DECLARE', 'un âge non déclaré ne se corrige pas');
select throws_ok($$select public.corriger_age('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 121, 'Âge impossible')$$, 'P0001', 'KS_AGE_INVALIDE', 'un âge au-delà de 120 est refusé');
select throws_ok($$select public.corriger_age('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, '00000000-0000-0000-0000-0000000000ff', 30, 'Profil inconnu')$$, 'P0001', 'KS_PROFIL_INTROUVABLE', 'un profil inconnu est refusé');

-- Sous 13 ans : journalisé, âge inchangé, le service supprime le Compte.
select is(
  public.corriger_age('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 12, 'Le client a donné son vrai âge'),
  true,
  'sous 13 ans la fonction demande la suppression'
);
select is((select age_declare::int from public.profil where id = '00000000-0000-0000-0000-0000000000f2'), 25, 'sous 13 ans l''âge n''est pas changé par la fonction');
select is(
  (select apres ->> 'age_declare' from public.journal_audit where action = 'age_corrige' and cible_id = '00000000-0000-0000-0000-0000000000f2' order by id desc limit 1),
  '12',
  'la correction sous 13 ans est journalisée'
);

select ok(
  not has_function_privilege('anon', 'public.corriger_age(jsonb, uuid, integer, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.corriger_age(jsonb, uuid, integer, text)', 'execute')
  and has_function_privilege('service_role', 'public.corriger_age(jsonb, uuid, integer, text)', 'execute'),
  'corriger_age est réservée au service_role'
);

select * from finish();
rollback;
