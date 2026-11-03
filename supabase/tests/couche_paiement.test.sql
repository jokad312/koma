-- Story 4.5 : couche de paiement. Tables prestataire, tentative_paiement, notification_recue, trop_percu (RLS, droits, contraintes), valeurs d'anomalie,
-- administration des Prestataires (droit, journal, Ordre de priorité), Familles d'une Commande lues pour son Compte.
-- Données créées dans la transaction, puis annulées.
begin;
select plan(39);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-cp1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-cp2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-cp3@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a3', 25);
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a2', 'assistant');

create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb $$;
create function pg_temp.ass() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a2","role":"admin"}'::jsonb $$;
create function pg_temp.cli() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a3","role":null}'::jsonb $$;

-- Une Commande (offerte, pour avoir une ligne) d'un Kit.
select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le)
  values ('kit', 'cp-kit', 'Kit paiement', 'Payment kit', 0, 'debutant', now() - interval '1 minute');
select public.offrir_commande(pg_temp.cli(), (select id from public.produit where slug = 'cp-kit'), '[{"objet":"licence_kit","version":"test-v1"}]'::jsonb, 'cle-test-cp-0001');
create temp table cp as select (select id from public.commande limit 1) as commande;
grant select on cp to public;

-- Tables : RLS active, aucun droit pour anon, authenticated et public.
select is(
  (select count(*)::int from pg_class where oid in ('public.prestataire'::regclass, 'public.tentative_paiement'::regclass, 'public.notification_recue'::regclass, 'public.trop_percu'::regclass) and relrowsecurity),
  4,
  'RLS active sur les quatre tables du paiement'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('prestataire', 'tentative_paiement', 'notification_recue', 'trop_percu') and lower(grantee) in ('anon', 'authenticated', 'public')),
  0,
  'aucun droit pour anon, authenticated ni public sur ces tables'
);
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('prestataire', 'tentative_paiement', 'notification_recue', 'trop_percu')), 0, 'aucune politique : tout passe par le serveur');

-- Prestataires : trois, tous désactivés au départ, ordre des Agrégateurs, Polar sans ordre.
select is((select count(*)::int from public.prestataire), 4, 'quatre Prestataires');
select is((select count(*)::int from public.prestataire where actif), 0, 'tous désactivés au départ');
select is((select array_agg(code order by ordre) from public.prestataire where type = 'agregateur'), array['pawapay', 'maishapay'], 'Ordre de priorité initial des Agrégateurs');
select is((select ordre from public.prestataire where code = 'polar'), null, 'Polar n''a pas d''Ordre de priorité');
select is((select array_agg(code order by code) from public.prestataire where carte), array['maishapay', 'polar'], 'seuls MaishaPay et Polar proposent la carte');
select is((select array_agg(code order by code) from public.prestataire where mobile_money), array['maishapay', 'pawapay'], 'seuls les Agrégateurs proposent le mobile money');
select throws_ok($$insert into public.prestataire (code, nom, type, mobile_money, carte, ordre) values ('geniuspay', 'X', 'agregateur', true, false, 9)$$, '23514', null, 'GeniusPay est abandonné : code refusé');
select throws_ok($$update public.prestataire set ordre = 1 where code = 'maishapay'$$, '23505', null, 'deux Agrégateurs ne partagent pas un rang');

-- Anomalies.
select is(
  (select array_agg(e.enumlabel::text order by e.enumlabel) from pg_enum e where e.enumtypid = 'public.anomalie_type'::regtype and e.enumlabel in ('montant_insuffisant', 'notification_invalide', 'transition_refusee', 'kit_deja_possede')),
  array['kit_deja_possede', 'montant_insuffisant', 'notification_invalide', 'transition_refusee'],
  'les quatre anomalies du paiement existent'
);

-- Tentatives : unicités et cohérence.
insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents)
  values ((select commande from cp), 'maishapay', 'carte', 'TEST-REF-INTERNE-0001', 1500);
select is((select statut from public.tentative_paiement where reference_interne = 'TEST-REF-INTERNE-0001'), 'en_cours', 'une Tentative démarre en cours');
select throws_ok(
  $$insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents) values ((select commande from cp), 'polar', 'carte', 'TEST-REF-INTERNE-0002', 1500)$$,
  '23505', null, 'deux Tentatives en cours pour une Commande : refusé'
);
select throws_ok(
  $$insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents, statut, cause) values ((select commande from cp), 'polar', 'carte', 'TEST-REF-INTERNE-0001', 1500, 'echouee', 'client')$$,
  '23505', null, 'une référence interne ne sert qu''une fois'
);
select throws_ok(
  $$insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents) values ((select commande from cp), 'maishapay', 'carte', 'TEST-REF-INTERNE-0003', 0)$$,
  '23514', null, 'montant attendu nul : refusé'
);
select throws_ok(
  $$insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents, statut) values ((select commande from cp), 'maishapay', 'carte', 'TEST-REF-INTERNE-0004', 1500, 'echouee')$$,
  '23514', null, 'une Tentative échouée porte sa cause'
);
select throws_ok(
  $$insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents, cause) values ((select commande from cp), 'maishapay', 'carte', 'TEST-REF-INTERNE-0005', 1500, 'client')$$,
  '23514', null, 'une cause sans échec : refusée'
);
update public.tentative_paiement set statut = 'echouee', cause = 'prestataire', reference_transaction = 'TEST-TX-0001' where reference_interne = 'TEST-REF-INTERNE-0001';
select lives_ok(
  $$insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents) values ((select commande from cp), 'polar', 'carte', 'TEST-REF-INTERNE-0006', 1500)$$,
  'après l''échec, une nouvelle Tentative en cours est permise'
);
select throws_ok(
  $$insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents, reference_transaction, statut, cause) values ((select commande from cp), 'maishapay', 'carte', 'TEST-REF-INTERNE-0007', 1500, 'TEST-TX-0001', 'echouee', 'client')$$,
  '23505', null, 'une référence de transaction ne sert qu''une fois par Prestataire'
);
select lives_ok(
  $$insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents, reference_transaction, statut, cause) values ((select commande from cp), 'polar', 'carte', 'TEST-REF-INTERNE-0008', 1500, 'TEST-TX-0001', 'echouee', 'client')$$,
  'la même référence est permise chez un autre Prestataire'
);

-- Notifications : une seule fois par Prestataire.
insert into public.notification_recue (prestataire, id_notification, signature_valide) values ('maishapay', 'TEST-NOTIF-1', true);
select throws_ok($$insert into public.notification_recue (prestataire, id_notification, signature_valide) values ('maishapay', 'TEST-NOTIF-1', true)$$, '23505', null, 'une notification rejouée est refusée');
select lives_ok($$insert into public.notification_recue (prestataire, id_notification, signature_valide) values ('polar', 'TEST-NOTIF-1', true)$$, 'le même identifiant chez un autre Prestataire est permis');

-- Trop-perçus.
insert into public.trop_percu (commande_id, tentative_id, motif, montant_attendu_cents, montant_recu, devise_recue)
  values ((select commande from cp), (select id from public.tentative_paiement where reference_interne = 'TEST-REF-INTERNE-0001'), 'montant_superieur', 1500, 1700, 'USD');
select is((select statut from public.trop_percu), 'a_rembourser', 'un Trop-perçu naît à rembourser');
select throws_ok(
  $$insert into public.trop_percu (commande_id, tentative_id, motif, montant_attendu_cents, montant_recu, devise_recue) values ((select commande from cp), (select id from public.tentative_paiement where reference_interne = 'TEST-REF-INTERNE-0001'), 'deja_payee', 1500, 1500, 'USD')$$,
  '23505', null, 'un seul Trop-perçu par Tentative'
);

-- Fonctions : droits.
select is(
  (select array_agg(f order by f) from unnest(array[
    'public.definir_prestataire_actif(jsonb, text, boolean)', 'public.deplacer_prestataire(jsonb, text, text)', 'public.familles_commande(uuid, uuid)'
  ]) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or not has_function_privilege('service_role', f, 'execute')),
  null,
  'les trois fonctions : service seulement'
);
select ok(
  (select count(*) = 3 and bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where pronamespace = 'public'::regnamespace and proname in ('definir_prestataire_actif', 'deplacer_prestataire', 'familles_commande')),
  'security definer, search_path vide'
);

-- Activer, désactiver : Admin seulement, journalisé.
select throws_ok($$select public.definir_prestataire_actif(pg_temp.ass(), 'maishapay', true)$$, 'P0001', 'KS_DROIT_REFUSE', 'un Assistant n''active pas un Prestataire');
select throws_ok($$select public.definir_prestataire_actif(pg_temp.adm(), 'geniuspay', true)$$, 'P0001', 'KS_PRESTATAIRE_INTROUVABLE', 'Prestataire inconnu : refusé');
select lives_ok($$select public.definir_prestataire_actif(pg_temp.adm(), 'maishapay', true)$$, 'l''Admin active un Prestataire');
select is((select actif from public.prestataire where code = 'maishapay'), true, 'MaishaPay est actif');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'prestataire' and action = 'update' and cible_id = 'maishapay' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000a1',
  'le journal porte l''auteur de l''activation'
);

-- Ordre de priorité.
select throws_ok($$select public.deplacer_prestataire(pg_temp.ass(), 'maishapay', 'monter')$$, 'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne déplace pas un Prestataire');
select lives_ok($$select public.deplacer_prestataire(pg_temp.adm(), 'maishapay', 'monter')$$, 'l''Admin monte MaishaPay');
select is((select array_agg(code order by ordre) from public.prestataire where type = 'agregateur'), array['maishapay', 'pawapay'], 'MaishaPay et PawaPay ont échangé leur rang');
select public.deplacer_prestataire(pg_temp.adm(), 'maishapay', 'monter');
select is((select array_agg(code order by ordre) from public.prestataire where type = 'agregateur'), array['maishapay', 'pawapay'], 'monter le premier : sans effet');
select throws_ok($$select public.deplacer_prestataire(pg_temp.adm(), 'polar', 'monter')$$, 'P0001', 'KS_PRESTATAIRE_SANS_ORDRE', 'Polar n''a pas d''Ordre de priorité');

-- Familles d'une Commande, lues pour son Compte.
select is(public.familles_commande((select commande from cp), '00000000-0000-0000-0000-0000000000a3'), array['kit'], 'le propriétaire lit les Familles de sa Commande');
select is(public.familles_commande((select commande from cp), '00000000-0000-0000-0000-0000000000a2'), null, 'un autre Compte : rien');

select * from finish();
rollback;
