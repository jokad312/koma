begin;
select plan(20);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'test-a1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'test-a2@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000d1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000d2', 'assistant');

-- Numéro WhatsApp : espaces retirés, journal masqué, auteur enregistré.
select lives_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":"admin"}'::jsonb, 'numero_whatsapp', '+243 970 000 000')$$, 'l''admin enregistre le numéro');
select is((select valeur from public.reglage where cle = 'numero_whatsapp'), '+243970000000', 'les espaces sont retirés');
select is(
  (select apres ->> 'valeur' from public.journal_audit where cible_table = 'reglage' and cible_id = 'numero_whatsapp' order by id desc limit 1),
  '***',
  'le journal masque le numéro'
);
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'reglage' and cible_id = 'numero_whatsapp' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000d1',
  'le journal porte l''auteur'
);

-- Modification du nom : avant et après journalisés.
select lives_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":"admin"}'::jsonb, 'nom_site', '  Nom de test  ')$$, 'l''admin change le nom du site');
select is((select valeur from public.reglage where cle = 'nom_site'), 'Nom de test', 'le nom est rogné');
select is(
  (select avant ->> 'valeur' from public.journal_audit where cible_table = 'reglage' and cible_id = 'nom_site' and action = 'update' order by id desc limit 1),
  'KOMA SHOP',
  'le journal garde l''ancienne valeur'
);

-- Numéro vide : effacé.
select lives_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":"admin"}'::jsonb, 'numero_whatsapp', '   ')$$, 'un numéro vide est accepté');
select is((select valeur from public.reglage where cle = 'numero_whatsapp'), null, 'le numéro est effacé');

-- Valeurs et clés refusées.
select throws_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":"admin"}'::jsonb, 'numero_whatsapp', 'abc')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'un numéro invalide est refusé');
select throws_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":"admin"}'::jsonb, 'nom_site', '   ')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'un nom vide est refusé');
select throws_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":"admin"}'::jsonb, 'nom_site', repeat('x', 61))$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'un nom de plus de 60 caractères est refusé');
select throws_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":"admin"}'::jsonb, 'autre', 'x')$$, 'P0001', 'KS_REGLAGE_INCONNU', 'une clé inconnue est refusée');

-- Droits.
select throws_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000d2","role":"admin"}'::jsonb, 'nom_site', 'Pirate')$$, 'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne règle pas le site');
select throws_ok($$select public.enregistrer_reglage(null, 'nom_site', 'Pirate')$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'sans auteur refusé');
select is((select valeur from public.reglage where cle = 'nom_site'), 'Nom de test', 'les refus ne changent rien');

-- Écriture directe sans auteur : refusée par le trigger.
set local ks.auteur = '';
select throws_ok($$update public.reglage set valeur = 'Y' where cle = 'nom_site'$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'une écriture directe sans auteur est refusée');

-- Lecture publique : le numéro (affiché sur le site depuis la 1.8), jamais un autre réglage ; fonction réservée au service_role.
select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":"admin"}'::jsonb, 'numero_whatsapp', '+243970000000');
insert into public.reglage (cle, valeur) values ('autre_cle', 'x');
set local role anon;
select is((select count(*)::int from public.reglage where cle = 'numero_whatsapp'), 1, 'anon lit le numéro WhatsApp (affiché publiquement)');
select is((select count(*)::int from public.reglage where cle = 'autre_cle'), 0, 'anon ne lit aucun autre réglage');
reset role;
select ok(
  not has_function_privilege('anon', 'public.enregistrer_reglage(jsonb, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.enregistrer_reglage(jsonb, text, text)', 'execute')
  and has_function_privilege('service_role', 'public.enregistrer_reglage(jsonb, text, text)', 'execute'),
  'enregistrer_reglage est réservée au service_role'
);

select * from finish();
rollback;
