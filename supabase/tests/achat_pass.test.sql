-- Story 7.4 : achat de Pass. Commande de type pass créée en base (jamais depuis le Panier), prix, quota, Capacité, dates de vente et Code promo relus
-- en base, Stand refusé sans candidature, noms des titulaires nettoyés et figés, places comptées par statut de Commande, état de la vente,
-- garde de retrait d'un Type de pass déjà commandé. Données TEST_ annulées à la fin.
-- Exécuté par la CI (Docker) ; en local, `npm run test:sql` explique l'absence de Docker et sort sans erreur.
begin;
select plan(60);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-ap1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-ap2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-ap3@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a4', 'test-ap4@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a5', 'test-ap5@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a9', 'test-ap9@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a2', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a4', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a5', 25);
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a9', 'admin');

create function pg_temp.cl(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a9","role":"admin"}'::jsonb $$;
create function pg_temp.vis() returns jsonb language sql as $$ select '{"type":"visiteur"}'::jsonb $$;
create function pg_temp.acc() returns jsonb language sql as $$ select '[{"objet":"pass_photos_video","version":"TEST_v1"}]'::jsonb $$;
-- Une ligne par Type : noms séparés par « | ».
create function pg_temp.l(p_type uuid, p_noms text) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('type_pass_id', p_type, 'titulaires', to_jsonb(string_to_array(p_noms, '|'))))
$$;
create function pg_temp.evt(p_slug text, p_publie boolean, p_ouvre interval, p_ferme interval, p_debut interval, p_capacite integer) returns uuid language sql as $$
  insert into public.evenement (auteur_id, titre_fr, slug, publie_le, vente_ouvre_le, vente_ferme_le, debut_le, capacite)
  values ('00000000-0000-0000-0000-0000000000a9', 'TEST', p_slug, case when p_publie then now() - interval '2 days' end,
          case when p_ouvre is not null then now() + p_ouvre end, case when p_ferme is not null then now() + p_ferme end, now() + p_debut, p_capacite)
  returning id
$$;
create function pg_temp.typ(p_evt uuid, p_nom text, p_prix integer, p_quota integer, p_stand boolean) returns uuid language sql as $$
  insert into public.type_pass (evenement_id, nom_fr, nom_en, prix_cents, quota, est_stand) values (p_evt, p_nom, p_nom, p_prix, p_quota, p_stand) returning id
$$;

insert into public.reglage (cle, valeur) values ('delai_paiement', '30') on conflict (cle) do update set valeur = excluded.valeur;

create temp table ev as select
  pg_temp.evt('test-ap-ok', true, null, null, interval '30 days', 10) as ok,
  pg_temp.evt('test-ap-ferme', true, interval '-1 day', interval '-1 hour', interval '30 days', null) as ferme,
  pg_temp.evt('test-ap-futur', true, interval '1 day', null, interval '30 days', null) as futur,
  pg_temp.evt('test-ap-brouillon', false, null, null, interval '30 days', null) as brouillon,
  pg_temp.evt('test-ap-passe', true, null, null, interval '-1 day', null) as passe,
  pg_temp.evt('test-ap-stand', true, null, null, interval '30 days', null) as stand;
create temp table ty as select
  pg_temp.typ((select ok from ev), 'TEST_Simple', 1500, 3, false) as simple,
  pg_temp.typ((select ok from ev), 'TEST_VIP', 3000, null, false) as vip,
  pg_temp.typ((select ok from ev), 'TEST_Stand', 5000, 2, true) as stand,
  pg_temp.typ((select ok from ev), 'TEST_Gratuit', 0, null, false) as gratuit,
  pg_temp.typ((select ferme from ev), 'TEST_Ferme', 1000, null, false) as ferme,
  pg_temp.typ((select futur from ev), 'TEST_Futur', 1000, null, false) as futur,
  pg_temp.typ((select brouillon from ev), 'TEST_Brouillon A', 1000, null, false) as brouillon_a,
  pg_temp.typ((select brouillon from ev), 'TEST_Brouillon B', 1000, null, false) as brouillon_b,
  pg_temp.typ((select passe from ev), 'TEST_Passe', 1000, null, false) as passe,
  pg_temp.typ((select stand from ev), 'TEST_Seul Stand', 1000, null, true) as seul_stand;

-- Structure et droits.
select has_column('public', 'ligne_commande', 'type_pass_id', 'ligne_commande porte le Type de pass');
select has_column('public', 'ligne_commande', 'titulaires', 'ligne_commande porte les noms figés des titulaires');
select is(
  (select count(*)::int from unnest(array[
    'public.places_evenement_utilisees(uuid)', 'public.places_type_pass_utilisees(uuid)', 'public.etat_vente_evenement(uuid)',
    'public.recapitulatif_commande_pass(uuid, uuid, jsonb, text)', 'public.creer_commande_pass(jsonb, uuid, jsonb, jsonb, integer, text, text, text)'
  ]) f where not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute')),
  5, 'fonctions de l''achat de Pass : service seulement'
);
select ok(
  not has_function_privilege('service_role', 'public.commande_pass_calculer(uuid, uuid, jsonb, text, boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.commande_pass_calculer(uuid, uuid, jsonb, text, boolean)', 'execute'),
  'le calcul interne n''est appelable par aucun client'
);

-- État de la vente avant tout achat.
select is(public.etat_vente_evenement((select ok from ev)) ->> 'etat', 'ouverte', 'vente ouverte à la publication sans date réglée');
select is(public.etat_vente_evenement((select ferme from ev)) ->> 'etat', 'fermee', 'fermeture passée : vente fermée');
select is(public.etat_vente_evenement((select futur from ev)) ->> 'etat', 'a_venir', 'ouverture future : vente à venir');
select is(public.etat_vente_evenement((select brouillon from ev)), null, 'Événement non publié : aucun état');
select is(public.etat_vente_evenement((select passe from ev)) ->> 'etat', 'fermee', 'fermeture par défaut au début de l''Événement');
select is(public.etat_vente_evenement((select stand from ev)) ->> 'etat', 'aucun', 'seulement un Stand : rien d''achetable');

-- Achat de deux Pass : Commande de type pass, ligne figée, mention enregistrée avec sa version.
create temp table c1 as select public.creer_commande_pass(pg_temp.cl('a1'), (select ok from ev), pg_temp.l((select simple from ty), '  Alice   Test |Bob Test'), pg_temp.acc(), 3000, 'test-cle-ap-0001') as r;
grant select on c1 to public;
select is((select r ->> 'rejeu' from c1), 'false', 'Commande de Pass créée');
select is(
  (select type || '/' || statut || '/' || total_cents || '/' || sous_total_cents || '/' || forfait_cents || '/' || (expire_le > now())::text from public.commande where numero = (select r ->> 'numero' from c1)),
  'pass/en_attente/3000/3000/0/true', 'type pass, en attente, total relu en base, sans Forfait, échéance posée'
);
select is(
  (select titulaires::text || '/' || nombre || '/' || prix_cents || '/' || pass_nom_fr || '/' || est_stand::text || '/' || (produit_id is null)::text || '/' || (variante_id is null)::text
   from public.ligne_commande where commande_id = (select (r ->> 'commande_id')::uuid from c1)),
  '["Alice Test", "Bob Test"]/2/1500/TEST_Simple/false/true/true', 'ligne : noms nettoyés et figés, prix et nom du Type figés, ni produit ni variante'
);
select is((select acceptations -> 0 ->> 'objet' || '/' || (acceptations -> 0 ->> 'version') from public.commande where id = (select (r ->> 'commande_id')::uuid from c1)), 'pass_photos_video/TEST_v1', 'mention photos et vidéos enregistrée avec sa version');
select is((select count(*)::int from public.reservation where commande_id = (select (r ->> 'commande_id')::uuid from c1)), 0, 'aucune réservation de stock pour un Pass');
select is(public.places_evenement_utilisees((select ok from ev)) || '/' || public.places_type_pass_utilisees((select simple from ty)), '2/2', 'places de l''Événement et du Type comptées (Commande en attente)');
select is((select r ->> 'rejeu' from (select public.creer_commande_pass(pg_temp.cl('a1'), (select ok from ev), pg_temp.l((select simple from ty), 'Autre Nom|Autre Nom 2'), pg_temp.acc(), 3000, 'test-cle-ap-0001') as r) x), 'true', 'même clé : même Commande rejouée');
select throws_ok(
  $$select public.creer_commande_pass('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":null}'::jsonb, (select ok from ev), pg_temp.l((select vip from ty), 'Cara Test'), pg_temp.acc(), 3000, 'test-cle-ap-0002')$$,
  'P0001', 'KS_COMMANDE_EN_ATTENTE', 'une seule Commande à payer par Compte'
);
update public.type_pass set prix_cents = 1600 where id = (select simple from ty);
select is((select prix_cents from public.ligne_commande where commande_id = (select (r ->> 'commande_id')::uuid from c1)), 1500, 'le prix de la ligne reste figé quand le Type change');
update public.type_pass set prix_cents = 1500 where id = (select simple from ty);

-- Refus.
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select ok from ev), pg_temp.l((select vip from ty), 'Dana Test'), pg_temp.acc(), 1, 'test-cle-ap-0003')$$, 'P0001', 'KS_TOTAL_CHANGE', 'total vu différent du total relu : refusé');
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select ok from ev), pg_temp.l((select vip from ty), 'Dana Test'), '[]'::jsonb, 3000, 'test-cle-ap-0003')$$, 'P0001', 'KS_ACCEPTATION_MANQUANTE', 'sans la mention photos et vidéos : refusé');
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select ok from ev), pg_temp.l((select vip from ty), 'Dana Test'), '[{"objet":"cgv","version":"v1"}]'::jsonb, 3000, 'test-cle-ap-0003')$$, 'P0001', 'KS_ACCEPTATION_MANQUANTE', 'une autre case ne remplace pas la mention');
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select ok from ev), pg_temp.l((select stand from ty), 'Dana Test|Eli Test'), pg_temp.acc(), 5000, 'test-cle-ap-0003')$$, 'P0001', 'KS_STAND_SUR_CANDIDATURE', 'un Stand est refusé sans candidature');
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select ok from ev), pg_temp.l((select gratuit from ty), 'Dana Test'), pg_temp.acc(), 0, 'test-cle-ap-0003')$$, 'P0001', 'KS_PASS_GRATUIT', 'un Pass à 0 USD ne se vend pas ici');
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select ok from ev), pg_temp.l((select ferme from ty), 'Dana Test'), pg_temp.acc(), 1000, 'test-cle-ap-0003')$$, 'P0001', 'KS_TYPE_PASS_INTROUVABLE', 'le Type d''un autre Événement est refusé');
select throws_ok(
  $$select public.creer_commande_pass(pg_temp.cl('a2'), (select ok from ev),
    (select pg_temp.l((select vip from ty), 'Dana Test') || pg_temp.l((select vip from ty), 'Eli Test')), pg_temp.acc(), 6000, 'test-cle-ap-0003')$$,
  'P0001', 'KS_PASS_INVALIDE', 'deux lignes du même Type refusées'
);
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select ok from ev), pg_temp.l((select vip from ty), 'Dana <b>Test'), pg_temp.acc(), 3000, 'test-cle-ap-0003')$$, 'P0001', 'KS_TITULAIRE_INVALIDE', 'nom avec chevrons refusé');
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select ok from ev), pg_temp.l((select vip from ty), 'D'), pg_temp.acc(), 3000, 'test-cle-ap-0003')$$, 'P0001', 'KS_TITULAIRE_INVALIDE', 'nom trop court refusé');
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select brouillon from ev), pg_temp.l((select brouillon_a from ty), 'Dana Test'), pg_temp.acc(), 1000, 'test-cle-ap-0003')$$, 'P0001', 'KS_EVENEMENT_INTROUVABLE', 'Événement non publié refusé');
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select ferme from ev), pg_temp.l((select ferme from ty), 'Dana Test'), pg_temp.acc(), 1000, 'test-cle-ap-0003')$$, 'P0001', 'KS_VENTE_FERMEE', 'vente fermée refusée');
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select futur from ev), pg_temp.l((select futur from ty), 'Dana Test'), pg_temp.acc(), 1000, 'test-cle-ap-0003')$$, 'P0001', 'KS_VENTE_FERMEE', 'vente pas encore ouverte refusée');
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select passe from ev), pg_temp.l((select passe from ty), 'Dana Test'), pg_temp.acc(), 1000, 'test-cle-ap-0003')$$, 'P0001', 'KS_VENTE_FERMEE', 'Événement commencé : vente fermée par défaut');
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a3'), (select ok from ev), pg_temp.l((select vip from ty), 'Dana Test'), pg_temp.acc(), 3000, 'test-cle-ap-0003')$$, 'P0001', 'KS_COMPTE_INCOMPLET', 'Compte sans âge déclaré refusé');
select throws_ok($$select public.creer_commande_pass('{"type":"visiteur"}'::jsonb, (select ok from ev), pg_temp.l((select vip from ty), 'Dana Test'), pg_temp.acc(), 3000, 'test-cle-ap-0003')$$, 'P0001', 'KS_AUTEUR_INVALIDE', 'visiteur refusé');
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select ok from ev), pg_temp.l((select vip from ty), 'Dana Test'), pg_temp.acc(), 3000, 'court')$$, 'P0001', 'KS_CLE_IDEMPOTENCE_INVALIDE', 'clé d''idempotence trop courte refusée');

-- Quota du Type (3, dont 2 déjà pris) : 2 de plus refusés, 1 de plus accepté.
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select ok from ev), pg_temp.l((select simple from ty), 'Dana Test|Eli Test'), pg_temp.acc(), 3000, 'test-cle-ap-0004')$$, 'P0001', 'KS_COMPLET', 'quota du Type dépassé : Complet');
select lives_ok($$select public.creer_commande_pass(pg_temp.cl('a2'), (select ok from ev), pg_temp.l((select simple from ty), 'Dana Test'), pg_temp.acc(), 1500, 'test-cle-ap-0005')$$, 'dernier Pass du quota accepté');
select is((public.etat_vente_evenement((select ok from ev)) -> 'types') @> jsonb_build_array(jsonb_build_object('id', (select simple from ty), 'complet', true)), true, 'le Type au quota atteint est complet');
select is(public.etat_vente_evenement((select ok from ev)) ->> 'etat', 'ouverte', 'un autre Type reste achetable : vente ouverte');

-- Capacité (10) : 3 places prises ; 7 de plus remplissent exactement, une de plus est refusée.
select lives_ok($$select public.creer_commande_pass(pg_temp.cl('a4'), (select ok from ev), pg_temp.l((select vip from ty), 'N1 Test|N2 Test|N3 Test|N4 Test|N5 Test|N6 Test|N7 Test'), pg_temp.acc(), 21000, 'test-cle-ap-0006')$$, 'Capacité remplie exactement');
select is(public.places_evenement_utilisees((select ok from ev)), 10, '10 places utilisées sur 10');
select is(public.etat_vente_evenement((select ok from ev)) ->> 'etat', 'complet', 'Capacité atteinte : Complet');
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a5'), (select ok from ev), pg_temp.l((select vip from ty), 'Dana Test'), pg_temp.acc(), 3000, 'test-cle-ap-0007')$$, 'P0001', 'KS_COMPLET', 'Capacité atteinte : achat refusé');

-- Statuts : expirée ou annulée libère les places, payée les garde, une échéance dépassée ne compte plus.
update public.commande set statut = 'expiree' where compte_id = '00000000-0000-0000-0000-0000000000a4';
select is(public.places_evenement_utilisees((select ok from ev)), 3, 'Commande expirée : 7 places libérées');
update public.commande set statut = 'payee', paye_le = now() where compte_id = '00000000-0000-0000-0000-0000000000a2';
-- Story 7.5 : une Commande payée est comptée par ses Pass émis (confirmer_paiement les émet) ; l'émission est rejouée ici comme le fait le paiement.
select public.evenements_emettre_pass(id) from public.commande where compte_id = '00000000-0000-0000-0000-0000000000a2' and statut = 'payee';
select is(public.places_evenement_utilisees((select ok from ev)), 3, 'Commande payée : ses Pass émis comptent encore');
update public.commande set expire_le = now() - interval '1 minute' where compte_id = '00000000-0000-0000-0000-0000000000a1';
select is(public.places_evenement_utilisees((select ok from ev)), 1, 'en attente avec échéance dépassée : ne compte plus');
update public.commande set statut = 'annulee' where compte_id = '00000000-0000-0000-0000-0000000000a2';
select is(public.places_evenement_utilisees((select ok from ev)), 0, 'Commande annulée : ne compte plus');
update public.commande set statut = 'payee', paye_le = now() where compte_id = '00000000-0000-0000-0000-0000000000a2';

-- Code promo (FR-47) : réduction relue en base, figée avec le taux de commission ; Récapitulatif sans écriture.
select public.creer_code_promo(pg_temp.adm(), 'PASS10', 'TEST_Affilie', 10, 5, 50, true);
select is(
  public.recapitulatif_commande_pass('00000000-0000-0000-0000-0000000000a5', (select ok from ev), pg_temp.l((select vip from ty), 'Eva Test'), 'pass10') ->> 'total_cents',
  '2700', 'Récapitulatif avec Code promo : total relu en base'
);
select is(
  public.recapitulatif_commande_pass('00000000-0000-0000-0000-0000000000a5', (select ok from ev), pg_temp.l((select vip from ty), 'Eva Test'), 'INCONNU') -> 'code' ->> 'erreur',
  'code_inconnu', 'Récapitulatif : un Code refusé est rendu sans erreur, total inchangé'
);
select throws_ok($$select public.creer_commande_pass(pg_temp.cl('a5'), (select ok from ev), pg_temp.l((select vip from ty), 'Eva Test'), pg_temp.acc(), 3000, 'test-cle-ap-0008', 'INCONNU')$$, 'P0001', 'KS_CODE_INCONNU', 'Code promo inconnu refusé à la création');
create temp table c5 as select public.creer_commande_pass(pg_temp.cl('a5'), (select ok from ev), pg_temp.l((select vip from ty), 'Eva Test'), pg_temp.acc(), 2700, 'test-cle-ap-0009', 'pass10') as r;
grant select on c5 to public;
select is(
  (select c.total_cents || '/' || c.sous_total_cents || '/' || c.origine || '/' || l.reduction_cents || '/' || p.commission_pct::text || '/' || p.reduction_cents
   from public.commande c join public.ligne_commande l on l.commande_id = c.id join public.commande_code_promo p on p.commande_id = c.id
   where c.id = (select (r ->> 'commande_id')::uuid from c5)),
  '2700/3000/code_pass10/300/5.00/300', 'réduction figée sur la ligne, taux de commission figé, origine = code'
);

-- Contraintes de la ligne (AD-7) et suppression d'un Type commandé.
select throws_ok(
  $$insert into public.ligne_commande (commande_id, nombre, prix_cents) values ((select (r ->> 'commande_id')::uuid from c1), 1, 100)$$,
  '23514', null, 'une ligne sans produit ni Type de pass est refusée'
);
select throws_ok(
  $$insert into public.ligne_commande (commande_id, nombre, prix_cents, type_pass_id, titulaires, pass_nom_fr, est_stand)
    values ((select (r ->> 'commande_id')::uuid from c1), 2, 100, (select vip from ty), '["Seul Nom"]'::jsonb, 'TEST', false)$$,
  '23514', null, 'noms des titulaires en nombre différent du nombre de Pass : refusé'
);
select throws_ok($$delete from public.type_pass where id = (select simple from ty)$$, '23503', null, 'un Type commandé ne se supprime pas (clé étrangère)');

-- enregistrer_evenement : retrait d'un Type commandé refusé, retrait d'un Type jamais commandé accepté.
select throws_ok(
  $$select public.enregistrer_evenement(pg_temp.adm(), (select ok from ev), '{"titre_fr":"TEST","slug":"test-ap-ok"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_TYPE_PASS_VENDU', 'retirer un Type déjà commandé est refusé'
);
select throws_ok(
  $$select public.enregistrer_evenement(pg_temp.adm(), (select ok from ev), '{"titre_fr":"TEST","slug":"test-ap-ok"}'::jsonb,
    jsonb_build_array(jsonb_build_object('id', (select simple from ty), 'nom_fr', 'TEST_Simple', 'prix_cents', 1500)))$$,
  'P0001', 'KS_TYPE_PASS_VENDU', 'le refus vaut aussi quand un autre Type commandé reste (le VIP est commandé)'
);
select lives_ok(
  $$select public.enregistrer_evenement(pg_temp.adm(), (select brouillon from ev), '{"titre_fr":"TEST","slug":"test-ap-brouillon"}'::jsonb,
    jsonb_build_array(jsonb_build_object('id', (select brouillon_a from ty), 'nom_fr', 'TEST_Brouillon A', 'prix_cents', 1000)))$$,
  'retirer un Type jamais commandé reste possible'
);
select is((select count(*)::int from public.type_pass where evenement_id = (select brouillon from ev)), 1, 'le Type non commandé a bien été retiré');
update public.evenement set publie_le = null where id = (select ok from ev);
select lives_ok(
  $$select public.enregistrer_evenement(pg_temp.adm(), (select ok from ev), '{"titre_fr":"TEST","slug":"test-ap-ok"}'::jsonb,
    jsonb_build_array(
      jsonb_build_object('id', (select simple from ty), 'nom_fr', 'TEST_Simple renommé', 'prix_cents', 1500),
      jsonb_build_object('id', (select vip from ty), 'nom_fr', 'TEST_VIP', 'prix_cents', 3000)))$$,
  'renommer ou modifier des Types commandés reste possible'
);

-- Le Panier n'est jamais lu : aucune table de panier ne change.
select is((select count(*)::int from public.panier where compte_id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a5')), 0, 'aucun Panier créé par l''achat de Pass');

select * from finish();
rollback;
