-- Story 9.4 : consentements, Préférences, désinscription et règle des Emails commerciaux de la boîte d'envoi (AD-9, AD-34).
-- Données TEST_ annulées à la fin.
begin;
select plan(33);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-cs1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-cs2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e3', 'test-cs3@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e1', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e2', 15);
create function pg_temp.c(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;
create function pg_temp.envoi(p_compte text, p_modele text, p_cle text) returns uuid language sql as $$
  insert into public.envoi (modele, compte_id, langue, cle) values (p_modele::public.envoi_modele, ('00000000-0000-0000-0000-0000000000' || p_compte)::uuid, 'fr', p_cle) returning id
$$;

-- Droits : tables et fonctions réservées au serveur.
select ok((select relrowsecurity from pg_class where oid = 'public.consentement'::regclass) and (select relrowsecurity from pg_class where oid = 'public.desinscription'::regclass), 'RLS active sur consentement et desinscription');
select ok(not has_table_privilege('anon', 'public.consentement', 'select') and not has_table_privilege('authenticated', 'public.consentement', 'select')
  and not has_table_privilege('anon', 'public.desinscription', 'select') and not has_table_privilege('authenticated', 'public.desinscription', 'select'), 'aucune lecture client');
select is(
  (select count(*)::int from unnest(array[
    'public.donner_consentements(jsonb, text[], text, text)', 'public.regler_preference(jsonb, text, boolean, text)', 'public.lire_preferences(uuid)',
    'public.desinscrire(uuid)', 'public.email_commercial_autorise(uuid)'
  ]) f where not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute')),
  5, 'fonctions du consentement : service seulement'
);
select ok(not has_function_privilege('service_role', 'public.emails_commerciaux_bloques_mineur(uuid)', 'execute'), 'emails_commerciaux_bloques_mineur est interne');
select is((select valeur from public.reglage where cle = 'emails_commerciaux_mineurs'), 'false', 'emails_commerciaux_mineurs désactivé au départ');

-- Case de la création de Compte : relances + nouveautés, version et source gardées ; un second envoi ne double rien.
select is(public.donner_consentements(pg_temp.c('e1'), array['relances', 'nouveautes'], 'TEST_v1', 'creation_compte'), 2, 'deux consentements donnés');
select is(public.donner_consentements(pg_temp.c('e1'), array['relances', 'nouveautes'], 'TEST_v1', 'commande'), 0, 'déjà actifs : rien de nouveau');
select is((select version || '/' || source from public.consentement where compte_id = '00000000-0000-0000-0000-0000000000e1' and objet = 'relances'), 'TEST_v1/creation_compte', 'version et source enregistrées');
select is(public.lire_preferences('00000000-0000-0000-0000-0000000000e1'), '{"relances": true, "nouveautes": true, "alertes_festival": false, "mineur_bloque": false}'::jsonb, 'préférences relues');
select throws_ok($$select public.donner_consentements(pg_temp.c('e1'), array['tout'], 'TEST_v1', 'commande')$$, 'P0001', 'KS_CONSENTEMENT_INVALIDE', 'objet inconnu refusé');
select throws_ok($$select public.donner_consentements(pg_temp.c('e3'), array['relances'], 'TEST_v1', 'commande')$$, 'P0001', 'KS_COMPTE_INCOMPLET', 'Compte sans âge déclaré refusé');

-- Interrupteurs.
select is(public.regler_preference(pg_temp.c('e1'), 'alertes_festival', true, 'TEST_v1'), true, 'Alertes Festival activées');
select is(public.regler_preference(pg_temp.c('e1'), 'nouveautes', false, 'TEST_v1'), false, 'Nouveautés désactivées');
select ok((select retire_le is not null from public.consentement where compte_id = '00000000-0000-0000-0000-0000000000e1' and objet = 'nouveautes'), 'le retrait garde la preuve (retire_le), sans suppression');

-- Boîte d'envoi : un email lié à un achat n'est jamais soumis à la règle.
select pg_temp.envoi('e1', 'commande_payee', 'TEST-cs-achat');
select is(public.email_commercial_autorise((select id from public.envoi where cle = 'TEST-cs-achat')), '{"autorise": true, "commercial": false}'::jsonb, 'email lié à un achat : toujours autorisé');
select pg_temp.envoi('e1', 'relance', 'TEST-cs-r1');
select is(public.email_commercial_autorise((select id from public.envoi where cle = 'TEST-cs-r1')) ->> 'autorise', 'true', 'relance avec consentement : autorisée');
select pg_temp.envoi('e1', 'nouveau_produit', 'TEST-cs-n1');
select is(public.email_commercial_autorise((select id from public.envoi where cle = 'TEST-cs-n1')) ->> 'motif', 'sans_consentement', 'nouveauté sans consentement actif : sans_consentement');
select pg_temp.envoi('e1', 'alerte_evenement', 'TEST-cs-a1');
select is(public.email_commercial_autorise((select id from public.envoi where cle = 'TEST-cs-a1')) ->> 'autorise', 'true', 'alerte Festival : consentement alertes_festival');

-- Écart de 2 jours, tous types confondus.
update public.envoi set statut = 'envoye', id_prestataire = 'TEST_id', envoye_le = now() - interval '1 day' where cle = 'TEST-cs-a1';
select pg_temp.envoi('e1', 'rappel_kit', 'TEST-cs-r2');
select is(public.email_commercial_autorise((select id from public.envoi where cle = 'TEST-cs-r2')) ->> 'motif', 'ecart_2_jours', 'un autre Email commercial parti il y a 1 jour : écarté');
update public.envoi set envoye_le = now() - interval '3 days' where cle = 'TEST-cs-a1';
select is(public.email_commercial_autorise((select id from public.envoi where cle = 'TEST-cs-r2')) ->> 'autorise', 'true', 'parti il y a 3 jours : autorisé');
update public.envoi set statut = 'envoye', id_prestataire = 'TEST_id2', envoye_le = now() - interval '1 day' where cle = 'TEST-cs-achat';
select is(public.email_commercial_autorise((select id from public.envoi where cle = 'TEST-cs-r2')) ->> 'autorise', 'true', 'un email lié à un achat ne compte pas dans l''écart');

-- Compte mineur : jamais d'Email commercial tant que le réglage est désactivé, même avec la case cochée.
select is(public.donner_consentements(pg_temp.c('e2'), array['relances'], 'TEST_v1', 'creation_compte'), 1, 'un Compte mineur peut cocher la case');
select is(public.lire_preferences('00000000-0000-0000-0000-0000000000e2') ->> 'mineur_bloque', 'true', 'Préférences : le mineur voit que ces emails ne lui sont pas envoyés');
select pg_temp.envoi('e2', 'relance', 'TEST-cs-m1');
select is(public.email_commercial_autorise((select id from public.envoi where cle = 'TEST-cs-m1')) ->> 'motif', 'compte_mineur', 'Compte mineur : écarté');
update public.reglage set valeur = 'true' where cle = 'emails_commerciaux_mineurs';
select is(public.email_commercial_autorise((select id from public.envoi where cle = 'TEST-cs-m1')) ->> 'autorise', 'true', 'réglage ouvert : autorisé');
update public.reglage set valeur = 'false' where cle = 'emails_commerciaux_mineurs';

-- Désinscription par le lien : tous les consentements retirés, motif « desinscription » ; un nouveau consentement donné après reprend.
select is(public.desinscrire('00000000-0000-0000-0000-0000000000e1'), true, 'désinscription enregistrée');
select is(public.lire_preferences('00000000-0000-0000-0000-0000000000e1') - 'mineur_bloque', '{"relances": false, "nouveautes": false, "alertes_festival": false}'::jsonb, 'tous les consentements retirés');
select is(public.email_commercial_autorise((select id from public.envoi where cle = 'TEST-cs-r2')) ->> 'motif', 'desinscription', 'après désinscription : motif desinscription');
select is(public.desinscrire('00000000-0000-0000-0000-0000000000ff'), false, 'Compte inexistant : rien n''est fait');
select is(public.desinscrire('00000000-0000-0000-0000-0000000000e1'), true, 'lien rouvert : effet déjà acquis');
select is((select count(*)::int from public.desinscription where compte_id = '00000000-0000-0000-0000-0000000000e1'), 1, 'lien rouvert : aucune ligne de plus');
select is(public.regler_preference(pg_temp.c('e1'), 'relances', true, 'TEST_v2'), true, 'réactivation dans Préférences après la désinscription');
select is(public.email_commercial_autorise((select id from public.envoi where cle = 'TEST-cs-r2')) ->> 'autorise', 'true', 'consentement redonné : la relance est de nouveau autorisée');

select * from finish();
rollback;
