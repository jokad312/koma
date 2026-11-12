-- Story 4.4 : boîte d'envoi (envoi), anomalies (anomalie), tâches admin (taches_admin), envois_planifier, envois_reserver_lot,
-- envois_marquer_envoye, envois_marquer_echec (5 essais puis abandon et anomalie), envois_ignorer, email « Kit ouvert » planifié par offrir_commande.
-- Données créées dans la transaction, puis annulées.
begin;
select plan(43);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-en1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-en2@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e1', 25);
update public.profil set langue = 'en' where id = '00000000-0000-0000-0000-0000000000e1';

-- Tables, vue, RLS, droits.
select has_table('public', 'envoi', 'la table envoi existe');
select has_table('public', 'anomalie', 'la table anomalie existe');
select has_view('public', 'taches_admin', 'la vue taches_admin existe');
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.envoi'::regclass, 'public.anomalie'::regclass)), 'RLS active sur envoi et anomalie');
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('envoi', 'anomalie', 'taches_admin') and lower(grantee) in ('anon', 'authenticated', 'public')),
  0,
  'aucun droit client sur envoi, anomalie ni taches_admin'
);
select is(
  (select count(*)::int from unnest(array[
    'public.envois_reserver_lot(integer)', 'public.envois_marquer_envoye(uuid, text)', 'public.envois_marquer_echec(uuid, text)', 'public.envois_ignorer(uuid, text)'
  ]) f where not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute')),
  4,
  'les quatre fonctions du worker : service seulement'
);
select ok(
  not has_function_privilege('anon', 'public.envois_planifier(public.envoi_modele, uuid, jsonb, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.envois_planifier(public.envoi_modele, uuid, jsonb, text)', 'execute')
  and not has_function_privilege('service_role', 'public.envois_planifier(public.envoi_modele, uuid, jsonb, text)', 'execute')
  and not has_function_privilege('anon', 'public.envois_declencher()', 'execute')
  and not has_function_privilege('service_role', 'public.envois_declencher()', 'execute'),
  'envois_planifier et envois_declencher sont internes : aucun rôle'
);
select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid = 'public.envoi_modele'::regtype),
  array['commande_payee', 'kit_ouvert', 'commande_en_fabrication', 'commande_expediee', 'commande_livree', 'commande_annulee', 'commande_remboursee',
        'relance', 'panier_abandonne', 'rappel_kit', 'nouveau_produit', 'alerte_evenement', 'pass_emis', 'pass_annule', 'pass_rembourse', 'galerie_evenement', 'candidature_validee', 'candidature_refusee'],
  'envoi.modele : énumération fermée (modèles liés à un achat, puis Emails commerciaux de la story 9.4)'
);
select is(
  (select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid = 'public.anomalie_type'::regtype),
  -- Les quatre anomalies du paiement sont ajoutées par la story 4.5 (montants, notifications, transitions, Kit déjà possédé).
  array['envoi_echec_definitif', 'montant_insuffisant', 'notification_invalide', 'transition_refusee', 'kit_deja_possede', 'montant_indetermine', 'stock_insuffisant', 'scans_non_synchronises', 'scan_conflit', 'pass_offert_impossible'],
  'anomalie.type : envoi_echec_definitif puis les quatre anomalies du paiement'
);

-- Planification : langue figée, rejouable, données = identifiants seulement.
create temp table pl as
  select public.envois_planifier('commande_payee', '00000000-0000-0000-0000-0000000000e1', '{"commande_id":"00000000-0000-0000-0000-0000000000c1"}'::jsonb, 'test:en:1') as en,
         public.envois_planifier('commande_payee', '00000000-0000-0000-0000-0000000000e2', '{"commande_id":"00000000-0000-0000-0000-0000000000c2"}'::jsonb, 'test:fr:1') as fr;
select isnt((select en from pl), null, 'envois_planifier renvoie l''identifiant de l''envoi');
select is((select langue from public.envoi where id = (select en from pl)), 'en', 'langue figée depuis profil.langue (en)');
select is((select langue from public.envoi where id = (select fr from pl)), 'fr', 'langue figée depuis profil.langue (fr par défaut)');
update public.profil set langue = 'fr' where id = '00000000-0000-0000-0000-0000000000e1';
select is((select langue from public.envoi where id = (select en from pl)), 'en', 'changer la langue du profil ne change pas un envoi déjà planifié');
select is(public.envois_planifier('commande_payee', '00000000-0000-0000-0000-0000000000e1', '{}'::jsonb, 'test:en:1'), null, 'même clé : aucun second envoi');
select is((select count(*)::int from public.envoi where cle = 'test:en:1'), 1, 'un seul envoi par clé');
select throws_ok($$select public.envois_planifier('commande_payee', '00000000-0000-0000-0000-0000000000e1', '{"email":"x@example.invalid"}'::jsonb, 'test:donnees:1')$$, '23514', null, 'envoi.donnees refuse une adresse email');
select throws_ok($$select public.envois_planifier('commande_payee', '00000000-0000-0000-0000-0000000000e1', '{"montant":1200}'::jsonb, 'test:donnees:2')$$, '23514', null, 'envoi.donnees refuse un nombre');
select throws_ok($$select public.envois_planifier('commande_payee', '00000000-0000-0000-0000-0000000000e1', '["00000000-0000-0000-0000-0000000000c1"]'::jsonb, 'test:donnees:3')$$, '23514', null, 'envoi.donnees refuse un tableau');
select throws_ok($$select public.envois_planifier('newsletter', '00000000-0000-0000-0000-0000000000e1', '{}'::jsonb, 'test:modele:1')$$, '22P02', null, 'un modèle inconnu est refusé');

-- Réservation d'un lot : louée, jamais rendue deux fois.
select is((select count(*)::int from public.envois_reserver_lot(10)), 2, 'le lot contient les deux envois à traiter');
select is((select tentatives from public.envoi where id = (select en from pl)), 1::smallint, 'une tentative est comptée à la réservation');
select is((select count(*)::int from public.envois_reserver_lot(10)), 0, 'un envoi réservé n''est pas rendu une seconde fois');

-- Envoyé : seulement avec l'identifiant du prestataire, une seule fois.
select throws_ok($$select public.envois_marquer_envoye((select en from pl), '')$$, 'P0001', 'KS_IDENTIFIANT_PRESTATAIRE_MANQUANT', 'sans identifiant du prestataire : refusé');
select is(public.envois_marquer_envoye((select en from pl), 'TEST_resend_1'), true, 'marqué envoyé avec l''identifiant du prestataire');
select is((select statut::text || ':' || id_prestataire from public.envoi where id = (select en from pl)), 'envoye:TEST_resend_1', 'statut envoye et identifiant enregistré');
select is(public.envois_marquer_envoye((select en from pl), 'TEST_resend_2'), false, 'un envoi déjà envoyé ne l''est pas deux fois');
select is(public.envois_ignorer((select fr from pl), 'TEST_compte_sans_email'), true, 'un envoi sans objet passe à ignore');
update public.envoi set prochain_essai = now() - interval '1 hour';
select is((select count(*)::int from public.envois_reserver_lot(10)), 0, 'ni un envoi envoyé ni un envoi ignoré ne reviennent');

-- Échec : nouvel essai plus tard, puis abandon et anomalie au cinquième essai.
create temp table pl2 as
  select public.envois_planifier('kit_ouvert', '00000000-0000-0000-0000-0000000000e2', '{"commande_id":"00000000-0000-0000-0000-0000000000c3"}'::jsonb, 'test:echec:1') as a,
         public.envois_planifier('kit_ouvert', '00000000-0000-0000-0000-0000000000e2', '{"commande_id":"00000000-0000-0000-0000-0000000000c4"}'::jsonb, 'test:echec:2') as b;
select is((select count(*)::int from public.envois_reserver_lot(10)), 2, 'deux nouveaux envois réservés');
select is(public.envois_marquer_echec((select a from pl2), 'TEST_panne'), 'echec', 'premier échec : à réessayer');
select ok((select prochain_essai > now() from public.envoi where id = (select a from pl2)), 'le nouvel essai est dans le futur');
create function pg_temp.epuiser(p_id uuid) returns text language plpgsql as $$
declare
  v_statut text;
begin
  for i in 1..5 loop
    update public.envoi set prochain_essai = now() - interval '1 second' where id = p_id and statut in ('a_envoyer', 'echec');
    perform id from public.envois_reserver_lot(50);
    v_statut := public.envois_marquer_echec(p_id, 'TEST_panne');
    exit when v_statut = 'abandonne';
  end loop;
  return v_statut;
end;
$$;
select is(pg_temp.epuiser((select b from pl2)), 'abandonne', 'cinq essais échoués : abandonne');
select is((select tentatives from public.envoi where id = (select b from pl2)), 5::smallint, 'cinq tentatives au plus');
select is((select count(*)::int from public.anomalie where type = 'envoi_echec_definitif' and cible_type = 'envoi' and cible_id = (select b from pl2)), 1, 'une anomalie envoi_echec_definitif est créée');
select is((select count(*)::int from public.taches_admin where type = 'envoi_echec_definitif' and cible_id = (select b from pl2)), 1, 'l''anomalie est visible dans taches_admin');
select is(public.envois_marquer_envoye((select b from pl2), 'TEST_resend_3'), false, 'un envoi abandonné n''est jamais envoyé');
select is(public.envois_marquer_echec((select b from pl2), 'TEST_panne'), null, 'un envoi abandonné ne produit pas une seconde anomalie');

-- Bail expiré : un envoi qui a déjà 5 essais sans réponse du worker est abandonné à la réservation suivante, avec son anomalie.
create temp table pl3 as
  select public.envois_planifier('kit_ouvert', '00000000-0000-0000-0000-0000000000e2', '{"commande_id":"00000000-0000-0000-0000-0000000000c5"}'::jsonb, 'test:bail:1') as c;
update public.envoi set tentatives = 5, prochain_essai = now() - interval '1 second' where id = (select c from pl3);
select is((select count(*)::int from public.envois_reserver_lot(10) r where r.id = (select c from pl3)), 0, 'un envoi à 5 essais n''est plus réservé');
select is(
  (select e.statut::text || ':' || (select count(*) from public.anomalie a where a.cible_id = e.id and a.type = 'envoi_echec_definitif') from public.envoi e where e.id = (select c from pl3)),
  'abandonne:1',
  'bail expiré après 5 essais : abandonne et une anomalie'
);

-- Email « Kit ouvert » planifié par offrir_commande, une seule fois.
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'env-gratuit', 'Gratuit', 'Free', 0, 'debutant', now() - interval '1 minute');
create function pg_temp.c1() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":null}'::jsonb $$;
create function pg_temp.lic() returns jsonb language sql as $$ select '[{"objet":"licence_kit","version":"test-v1"}]'::jsonb $$;
create temp table kit as select (public.offrir_commande(pg_temp.c1(), (select id from public.produit where slug = 'env-gratuit'), pg_temp.lic(), 'cle-envoi-0001') ->> 'commande_id')::uuid as commande;
select is((select count(*)::int from public.envoi where modele = 'kit_ouvert' and cle = 'kit_ouvert:' || (select commande from kit)::text), 1, 'le Kit gratuit planifie l''email kit_ouvert');
select is((select donnees ->> 'produit_id' from public.envoi where cle = 'kit_ouvert:' || (select commande from kit)::text), (select id::text from public.produit where slug = 'env-gratuit'), 'les données de l''email sont des identifiants');
select public.offrir_commande(pg_temp.c1(), (select id from public.produit where slug = 'env-gratuit'), pg_temp.lic(), 'cle-envoi-0001');
select is((select count(*)::int from public.envoi where modele = 'kit_ouvert' and cle = 'kit_ouvert:' || (select commande from kit)::text), 1, 'le rejeu ne planifie pas un second email');

-- Déclenchement : sans secrets Vault, rien n'est envoyé et rien ne casse.
select is(public.envois_declencher(), false, 'envois_declencher sans secrets Vault : ne fait rien');

select * from finish();
rollback;
