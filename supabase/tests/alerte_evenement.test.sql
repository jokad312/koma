-- Story 7.3 : « Me prévenir » (Alerte événement) : RLS, droits, inscription par email / Compte / WhatsApp, consentement versionné,
-- planification à l'ouverture de la vente, désinscription, boîte d'envoi sans Compte, comptage et export WhatsApp journalisé.
-- Données TEST_ annulées à la fin. Exécuté par la CI (Docker) ; en local, `npm run test:sql` explique l'absence de Docker et sort sans erreur.
begin;
select plan(53);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-al1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-al2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-al3@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 'admin');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a2', 25);

create function pg_temp.admin() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb $$;
create function pg_temp.cl(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;
create function pg_temp.visiteur() returns jsonb language sql as $$ select '{"type":"visiteur"}'::jsonb $$;
create function pg_temp.evt(p_slug text, p_publie boolean, p_ouvre interval) returns uuid language sql as $$
  insert into public.evenement (auteur_id, titre_fr, slug, publie_le, vente_ouvre_le, debut_le)
  values ('00000000-0000-0000-0000-0000000000a1', 'TEST', p_slug, case when p_publie then now() - interval '1 day' end, case when p_ouvre is not null then now() + p_ouvre end, now() + interval '30 days')
  returning id
$$;

create temp table ev as select
  pg_temp.evt('test-al-1', true, interval '1 hour') as futur,
  pg_temp.evt('test-al-2', true, null) as ouvert,
  pg_temp.evt('test-al-3', false, interval '1 hour') as brouillon,
  pg_temp.evt('test-al-4', true, interval '1 hour') as reinscrit,
  pg_temp.evt('test-al-5', true, interval '1 hour') as ferme;

-- Droits : table fermée aux clients, fonctions réservées au serveur.
select is((select relrowsecurity from pg_class where oid = 'public.alerte_evenement'::regclass), true, 'RLS active sur alerte_evenement');
select ok(
  not has_table_privilege('anon', 'public.alerte_evenement', 'select, insert, update, delete')
  and not has_table_privilege('authenticated', 'public.alerte_evenement', 'select, insert, update, delete'),
  'aucune lecture ni écriture pour anon et authenticated'
);
select is(
  (select count(*)::int from unnest(array[
    'public.inscrire_alerte_evenement(jsonb, uuid, text, text, text, text)', 'public.desinscrire_alerte(uuid)', 'public.planifier_alertes_evenements()',
    'public.alerte_evenement_pour_envoi(uuid)', 'public.compter_alertes_evenement(jsonb, uuid)', 'public.exporter_alertes_whatsapp(jsonb, uuid)'
  ]) f where not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute')),
  6, 'fonctions des alertes : service seulement'
);
select ok(not has_function_privilege('service_role', 'public.alertes_evenements_declencher()', 'execute'), 'le déclencheur pg_cron est interne');

-- Inscription par email : même réponse que l'inscrit existe déjà ou non, une seule ligne, adresse en minuscules, consentement versionné.
select is(public.inscrire_alerte_evenement(pg_temp.visiteur(), (select futur from ev), 'email', ' Foo@Example.invalid ', 'fr', 'TEST_v1'), true, 'inscription par email');
select is(public.inscrire_alerte_evenement(pg_temp.visiteur(), (select futur from ev), 'email', 'foo@example.invalid', 'fr', 'TEST_v1'), true, 'déjà inscrit : même réponse');
select is((select count(*)::int from public.alerte_evenement where canal = 'email' and evenement_id = (select futur from ev)), 1, 'une seule ligne pour cet email');
select is((select email || '/' || consentement_version from public.alerte_evenement where canal = 'email' and evenement_id = (select futur from ev)), 'foo@example.invalid/TEST_v1', 'adresse en minuscules, version du consentement gardée');
select throws_ok($$select public.inscrire_alerte_evenement('{"type":"visiteur"}'::jsonb, (select futur from ev), 'email', 'pas-un-email', 'fr', 'TEST_v1')$$, 'P0001', 'KS_EMAIL_INVALIDE', 'email invalide refusé');

-- Inscription par WhatsApp : numéro international, espaces retirés.
select is(public.inscrire_alerte_evenement(pg_temp.visiteur(), (select futur from ev), 'whatsapp', '+243 810 000 000', 'fr', 'TEST_v1'), true, 'inscription par WhatsApp');
select is((select whatsapp from public.alerte_evenement where canal = 'whatsapp' and evenement_id = (select futur from ev)), '+243810000000', 'numéro enregistré sans espaces');
select throws_ok($$select public.inscrire_alerte_evenement('{"type":"visiteur"}'::jsonb, (select futur from ev), 'whatsapp', '0810000000', 'fr', 'TEST_v1')$$, 'P0001', 'KS_WHATSAPP_INVALIDE', 'numéro sans format international refusé');

-- Inscription par Compte : le consentement alertes_festival de la story 9.4 est donné.
select throws_ok($$select public.inscrire_alerte_evenement('{"type":"visiteur"}'::jsonb, (select futur from ev), 'compte', null, 'fr', 'TEST_v1')$$, 'P0001', 'KS_AUTEUR_INVALIDE', 'le canal Compte exige un Compte connecté');
select throws_ok($$select public.inscrire_alerte_evenement(pg_temp.cl('a3'), (select futur from ev), 'compte', null, 'fr', 'TEST_v1')$$, 'P0001', 'KS_COMPTE_INCOMPLET', 'Compte sans âge déclaré refusé');
select is(public.inscrire_alerte_evenement(pg_temp.cl('a2'), (select futur from ev), 'compte', null, 'fr', 'TEST_v1'), true, 'inscription avec le Compte');
select is(
  (select version || '/' || source from public.consentement where compte_id = '00000000-0000-0000-0000-0000000000a2' and objet = 'alertes_festival' and retire_le is null),
  'TEST_v1/alerte_evenement', 'consentement alertes_festival donné avec sa version et sa source'
);

-- Refus : vente déjà ouverte, événement non publié ou inconnu, canal inconnu.
select throws_ok($$select public.inscrire_alerte_evenement('{"type":"visiteur"}'::jsonb, (select ouvert from ev), 'email', 'bar@example.invalid', 'fr', 'TEST_v1')$$, 'P0001', 'KS_VENTE_OUVERTE', 'vente ouverte à la publication : pas d''alerte');
select throws_ok($$select public.inscrire_alerte_evenement('{"type":"visiteur"}'::jsonb, (select brouillon from ev), 'email', 'bar@example.invalid', 'fr', 'TEST_v1')$$, 'P0001', 'KS_ALERTE_INDISPONIBLE', 'événement non publié refusé');
select throws_ok($$select public.inscrire_alerte_evenement('{"type":"visiteur"}'::jsonb, '00000000-0000-0000-0000-00000000dead', 'email', 'bar@example.invalid', 'fr', 'TEST_v1')$$, 'P0001', 'KS_ALERTE_INDISPONIBLE', 'événement inconnu refusé');
select throws_ok($$select public.inscrire_alerte_evenement('{"type":"visiteur"}'::jsonb, (select futur from ev), 'sms', 'x', 'fr', 'TEST_v1')$$, 'P0001', 'KS_ALERTE_INVALIDE', 'canal inconnu refusé');

-- Journal : les inscriptions sont journalisées, adresse et numéro masqués.
select ok((select count(*) from public.journal_audit where cible_table = 'alerte_evenement') > 0, 'les inscriptions sont journalisées');
select is((select count(*)::int from public.journal_audit where cible_table = 'alerte_evenement' and (apres::text like '%foo@example.invalid%' or apres::text like '%810000000%')), 0, 'adresse et numéro masqués dans le journal');

-- Planification : rien avant l'ouverture de la vente ; ensuite un email par inscrit email ou Compte, jamais deux fois, jamais pour WhatsApp.
select is(public.planifier_alertes_evenements(), 0, 'avant l''ouverture de la vente : aucun email planifié');
update public.evenement set vente_ouvre_le = now() - interval '1 minute' where id = (select futur from ev);
select is(public.planifier_alertes_evenements(), 2, 'à l''ouverture : un email pour l''inscrit par email et un pour le Compte');
select is(public.planifier_alertes_evenements(), 0, 'un second passage ne replanifie rien');
select is((select count(*)::int from public.envoi where modele = 'alerte_evenement'), 2, 'deux envois dans la boîte d''envoi');
select is((select count(*)::int from public.envoi where modele = 'alerte_evenement' and compte_id is null and donnees ? 'alerte_id' and donnees ? 'evenement_id'), 1, 'l''envoi sans Compte ne porte que des identifiants');
select is((select count(*)::int from public.alerte_evenement where canal = 'whatsapp' and envoye_le is not null), 0, 'aucun message pour les inscrits WhatsApp');

-- Boîte d'envoi : l'envoi sans Compte est autorisé tant que l'inscrit n'est pas désinscrit.
create temp table al as select
  (select id from public.alerte_evenement where canal = 'email') as email_id,
  (select id from public.envoi where modele = 'alerte_evenement' and compte_id is null) as envoi_email,
  (select id from public.envoi where modele = 'alerte_evenement' and compte_id is not null) as envoi_compte;
select is(public.email_commercial_autorise((select envoi_email from al)) ->> 'autorise', 'true', 'inscrit par email : autorisé');
select is(public.email_commercial_autorise((select envoi_compte from al)) ->> 'autorise', 'true', 'inscrit par Compte : autorisé (consentement alertes_festival)');

-- Désinscription : effet immédiat, idempotente (rien de nouveau au journal), refus pour une inscription qui n'est pas par email.
select is(public.desinscrire_alerte((select email_id from al)), true, 'désinscription par le lien de l''email');
select is(public.email_commercial_autorise((select envoi_email from al)) ->> 'motif', 'desinscription', 'inscrit désinscrit : envoi refusé');
create temp table jr as select count(*) as n from public.journal_audit where cible_table = 'alerte_evenement';
select is(public.desinscrire_alerte((select email_id from al)), true, 'désinscription rejouée : même réponse');
select is((select count(*) from public.journal_audit where cible_table = 'alerte_evenement'), (select n from jr), 'rejouer le lien n''ajoute aucune entrée de journal');
select is(public.desinscrire_alerte((select id from public.alerte_evenement where canal = 'compte')), false, 'le lien par email ne désinscrit pas une inscription par Compte');
select is(public.desinscrire(('00000000-0000-0000-0000-0000000000a2')::uuid), true, 'désinscription du Compte par la story 9.4');
select is(public.email_commercial_autorise((select envoi_compte from al)) ->> 'motif', 'desinscription', 'Compte désinscrit : envoi refusé');

-- Réinscription après désinscription : nouvelle preuve de consentement ; désinscrit avant l'ouverture : jamais planifié.
select is(public.inscrire_alerte_evenement(pg_temp.visiteur(), (select reinscrit from ev), 'email', 'baz@example.invalid', 'en', 'TEST_v1'), true, 'inscription sur un autre événement');
select public.desinscrire_alerte((select id from public.alerte_evenement where email = 'baz@example.invalid'));
select is(public.inscrire_alerte_evenement(pg_temp.visiteur(), (select reinscrit from ev), 'email', 'baz@example.invalid', 'en', 'TEST_v2'), true, 'adresse désinscrite : même réponse, sans fuite');
select is((select (desinscrit_le is null)::text || '/' || consentement_version from public.alerte_evenement where email = 'baz@example.invalid'), 'false/TEST_v1', 'réinscription anonyme : l''adresse désinscrite n''est jamais réactivée');
select public.desinscrire_alerte((select id from public.alerte_evenement where email = 'baz@example.invalid'));
update public.evenement set vente_ouvre_le = now() - interval '1 minute' where id = (select reinscrit from ev);
select is(public.planifier_alertes_evenements(), 0, 'désinscrit avant l''ouverture : aucun email planifié');

-- Vente déjà fermée : aucun email.
select public.inscrire_alerte_evenement(pg_temp.visiteur(), (select ferme from ev), 'email', 'qux@example.invalid', 'fr', 'TEST_v1');
update public.evenement set vente_ouvre_le = now() - interval '2 hours', vente_ferme_le = now() - interval '1 hour' where id = (select ferme from ev);
select is(public.planifier_alertes_evenements(), 0, 'vente déjà fermée : aucun email planifié');

-- Admin : comptage par canal et export WhatsApp journalisé, réservés à l'admin.
select is(public.compter_alertes_evenement(pg_temp.admin(), (select futur from ev)), '{"email": 0, "compte": 0, "whatsapp": 1, "desinscrits": 2}'::jsonb, 'nombre d''inscrits actifs par canal');
select throws_ok($$select public.compter_alertes_evenement(pg_temp.cl('a2'), (select futur from ev))$$, 'P0001', 'KS_DROIT_REFUSE', 'le comptage est refusé à un non-admin');
select is(public.exporter_alertes_whatsapp(pg_temp.admin(), (select futur from ev)), array['+243810000000'], 'export des numéros WhatsApp');
select is(
  (select apres ->> 'nombre' from public.journal_audit where action = 'export' and cible_table = 'alerte_evenement' and cible_id = (select futur::text from ev)),
  '1', 'l''export est journalisé (nombre, jamais les numéros)'
);
select throws_ok($$select public.exporter_alertes_whatsapp(pg_temp.cl('a2'), (select futur from ev))$$, 'P0001', 'KS_DROIT_REFUSE', 'l''export est refusé à un non-admin');

-- Boîte d'envoi : sans Compte, seul le modèle alerte_evenement est permis.
select throws_ok(
  $$insert into public.envoi (modele, compte_id, langue, cle) values ('commande_payee', null, 'fr', 'TEST-al-sans-compte')$$,
  '23514', null, 'un envoi sans Compte n''existe que pour alerte_evenement'
);

-- Correctifs de la revue : réponse identique pour une adresse désinscrite, Compte qui se réinscrit, écart de 2 jours, doublon Compte + email, événement commencé.
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000a4', 'test-al4@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a4', 25);
create temp table ev2 as select
  pg_temp.evt('test-al-6', true, interval '1 hour') as compte,
  pg_temp.evt('test-al-7', true, interval '1 hour') as doublon,
  pg_temp.evt('test-al-8', true, interval '1 hour') as commence;

select public.inscrire_alerte_evenement(pg_temp.cl('a4'), (select compte from ev2), 'compte', null, 'fr', 'TEST_v1');
select public.desinscrire(('00000000-0000-0000-0000-0000000000a4')::uuid);
select public.inscrire_alerte_evenement(pg_temp.cl('a4'), (select compte from ev2), 'compte', null, 'fr', 'TEST_v2');
select is(
  (select version from public.consentement where compte_id = '00000000-0000-0000-0000-0000000000a4' and objet = 'alertes_festival' and retire_le is null),
  'TEST_v2', 'un Compte connecté peut se réinscrire après désinscription (nouveau consentement)'
);

insert into public.envoi (modele, compte_id, langue, cle, statut, id_prestataire, envoye_le)
values ('relance', '00000000-0000-0000-0000-0000000000a4', 'fr', 'TEST-al-relance', 'envoye', 'TEST_id', now() - interval '1 day');
insert into public.envoi (modele, compte_id, langue, cle, donnees)
values ('alerte_evenement', '00000000-0000-0000-0000-0000000000a4', 'fr', 'TEST-al-alerte-a4', '{}');
select is(
  public.email_commercial_autorise((select id from public.envoi where cle = 'TEST-al-alerte-a4')) ->> 'autorise', 'true',
  'l''alerte n''est pas soumise à l''écart de 2 jours'
);

select public.inscrire_alerte_evenement(pg_temp.cl('a4'), (select doublon from ev2), 'compte', null, 'fr', 'TEST_v1');
select public.inscrire_alerte_evenement(pg_temp.visiteur(), (select doublon from ev2), 'email', 'Test-AL4@Example.invalid', 'fr', 'TEST_v1');
update public.evenement set vente_ouvre_le = now() - interval '1 minute' where id = (select doublon from ev2);
select is(public.planifier_alertes_evenements(), 1, 'même adresse par Compte et par email : un seul email');
select is((select count(*)::int from public.alerte_evenement where evenement_id = (select doublon from ev2) and envoye_le is not null), 2, 'les deux lignes sont marquées traitées');

update public.evenement set debut_le = now() - interval '1 day' where id = (select commence from ev2);
select throws_ok($$select public.inscrire_alerte_evenement('{"type":"visiteur"}'::jsonb, (select commence from ev2), 'email', 'bar@example.invalid', 'fr', 'TEST_v1')$$, 'P0001', 'KS_ALERTE_INDISPONIBLE', 'événement déjà commencé : refusé');

select * from finish();
rollback;
