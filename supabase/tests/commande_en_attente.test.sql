-- Story 4.3 : Récapitulatif et Commande en attente. recapitulatif_commande, creer_commande (acceptations, téléphone, remise, total vu, idempotence,
-- Kit déjà présent, indisponibilité), réservations qui comptent dans stock_disponible et places_fabrication_utilisees, expirer_commandes_echues,
-- réglage delai_paiement. Données créées dans la transaction, puis annulées.
begin;
select plan(54);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-cm1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-cm2@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a2', 25);
create function pg_temp.vis() returns jsonb language sql as $$ select '{"type":"visiteur"}'::jsonb $$;
create function pg_temp.c1() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":null}'::jsonb $$;
create function pg_temp.c2() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a2","role":null}'::jsonb $$;
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb $$;
create function pg_temp.acc() returns jsonb language sql as $$ select '[{"objet":"cgv","version":"v1"},{"objet":"kit_acces_immediat","version":"v1"}]'::jsonb $$;

insert into public.reglage (cle, valeur) values
  ('forfait_livraison_goma_cents', '500'), ('forfait_livraison_bukavu_cents', '1200'), ('retrait_goma_fr', 'Lieu'), ('retrait_goma_en', 'Place'), ('plafond_fabrication', '3')
  on conflict (cle) do update set valeur = excluded.valeur;
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'cm-cos', 'C', 'C', 5000, 14, now() - interval '1 minute');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'cm-kit', 'K', 'K', 990, 'debutant', now() - interval '1 minute');
create temp table cm as
  select (select id from public.produit where slug = 'cm-cos') as cos, (select id from public.produit where slug = 'cm-kit') as kit;
grant select on cm to public;
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values
  ((select cos from cm), 'M', 2, false), ((select cos from cm), 'L', 0, true), ((select cos from cm), 'S', 0, false);
create temp table vm as select id from public.variante where taille = 'M' and produit_id = (select cos from cm);
create temp table pp as select public.creer_panier(pg_temp.vis()) as id;
grant select on vm, pp to public;
select public.fusionner_panier(pg_temp.c1(), '00000000-0000-0000-0000-0000000000a1', (select id from pp));
select public.ajouter_au_panier(pg_temp.c1(), (select id from pp), '00000000-0000-0000-0000-0000000000a1', (select cos from cm), 'M', 2);
select public.ajouter_au_panier(pg_temp.c1(), (select id from pp), '00000000-0000-0000-0000-0000000000a1', (select cos from cm), 'L', 2);
select public.ajouter_au_panier(pg_temp.c1(), (select id from pp), '00000000-0000-0000-0000-0000000000a1', (select kit from cm), null, 1);

-- Tables, droits, fonctions.
select ok((select relrowsecurity from pg_class where oid = 'public.reservation'::regclass), 'RLS active sur reservation');
select is((select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and table_name = 'reservation' and lower(grantee) in ('anon', 'authenticated', 'public')), 0, 'aucun droit client sur reservation');
select is(
  (select count(*)::int from unnest(array[
    'public.recapitulatif_commande(uuid, uuid, text, text, text)', 'public.creer_commande(jsonb, uuid, text, text, text, text, jsonb, text, integer, text, text, text)', 'public.expirer_commandes_echues()'
  ]) f where not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute')),
  3,
  'recapitulatif_commande, creer_commande et expirer_commandes_echues : service seulement'
);
select ok(not has_function_privilege('service_role', 'public.commande_calculer(uuid, uuid, text, text, boolean, text, uuid)', 'execute'), 'commande_calculer est interne : aucun rôle');
select ok(
  not has_function_privilege('anon', 'public.stock_disponible(uuid)', 'execute') and not has_function_privilege('authenticated', 'public.stock_disponible(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.places_fabrication_utilisees()', 'execute')
  and not has_function_privilege('authenticated', 'public.places_fabrication_utilisees()', 'execute'),
  'stock_disponible et places_fabrication_utilisees sont fermées au public'
);

-- Réglage delai_paiement : valeur de départ, saisie par l'Admin, bornes.
select is((select valeur from public.reglage where cle = 'delai_paiement'), '30', 'delai_paiement : 30 minutes au départ (Q-B4)');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 'admin');
select lives_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'delai_paiement', '45')$$, 'l''Admin règle delai_paiement');
select is((select valeur from public.reglage where cle = 'delai_paiement'), '45', 'la valeur est enregistrée');
select throws_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'delai_paiement', '0')$$, 'P0001', 'KS_REGLAGE_INVALIDE', '0 minute : refusé');
select throws_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'delai_paiement', '1441')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'plus de 1440 minutes : refusé');
select throws_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'delai_paiement', 'abc')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'texte : refusé');
select lives_ok($$select public.enregistrer_reglage(pg_temp.adm(), 'delai_paiement', '30')$$, 'retour à 30 minutes');

create temp table emp as select public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp), 'goma', 'retrait') ->> 'empreinte' as v;
grant select on emp to public;
select is(length((select v from emp)), 32, 'le Récapitulatif porte une empreinte des lignes');

-- Récapitulatif.
select is((public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp), 'goma', 'retrait') ->> 'total_cents')::int, 20990, 'retrait à Goma : 2 × 50 + 2 × 50 + 9,90, sans Forfait');
select is((public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp), 'goma', 'livraison') ->> 'forfait_cents')::int, 500, 'livraison à Goma : Forfait de Goma');
select is((public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp), 'bukavu', 'livraison') ->> 'forfait_cents')::int, 1200, 'livraison à Bukavu : Forfait de Bukavu');
select is((public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp), null, null) ->> 'remise_manquante')::boolean, true, 'sans Zone ni Mode : remise à choisir');
select throws_ok($$select public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp), 'bukavu', 'retrait')$$, 'P0001', 'KS_REMISE_INVALIDE', 'retrait à Bukavu : refusé');
select throws_ok($$select public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a2', (select id from pp), 'goma', 'retrait')$$, 'P0001', 'KS_PANIER_INTROUVABLE', 'le Panier d''un autre Compte est introuvable');

-- Refus de création.
select throws_ok($$select public.creer_commande(pg_temp.c1(), (select id from pp), 'goma', 'retrait', '+243990000000', null, '[{"objet":"cgv","version":"v1"}]'::jsonb, null, 20990, (select v from emp), 'cle-cm-0001')$$, 'P0001', 'KS_ACCEPTATION_MANQUANTE', 'Kit sans la case « accès immédiat » : refusé');
select throws_ok($$select public.creer_commande(pg_temp.c1(), (select id from pp), 'goma', 'retrait', '+243990000000', null, '[{"objet":"kit_acces_immediat","version":"v1"}]'::jsonb, null, 20990, (select v from emp), 'cle-cm-0001')$$, 'P0001', 'KS_ACCEPTATION_MANQUANTE', 'sans les CGV : refusé');
select throws_ok($$select public.creer_commande(pg_temp.c1(), (select id from pp), 'goma', 'retrait', '+243990000000', null, pg_temp.acc(), null, 1, (select v from emp), 'cle-cm-0001')$$, 'P0001', 'KS_TOTAL_CHANGE', 'total différent de celui vu : refusé');
select throws_ok($$select public.creer_commande(pg_temp.c1(), (select id from pp), 'goma', 'retrait', '+243990000000', null, pg_temp.acc(), null, 20990, 'mauvaise-empreinte', 'cle-cm-0001')$$, 'P0001', 'KS_RECAP_CHANGE', 'empreinte des lignes différente (délai ou disponibilité changés) : refusé');
select throws_ok($$select public.creer_commande(pg_temp.c1(), (select id from pp), 'goma', 'retrait', 'abc', null, pg_temp.acc(), null, 20990, (select v from emp), 'cle-cm-0001')$$, 'P0001', 'KS_TELEPHONE_INVALIDE', 'téléphone invalide : refusé');
select throws_ok($$select public.creer_commande(pg_temp.c1(), (select id from pp), 'bukavu', 'livraison', '+243990000000', '', pg_temp.acc(), null, 21190, (select v from emp), 'cle-cm-0001')$$, 'P0001', 'KS_ADRESSE_MANQUANTE', 'livraison sans adresse : refusé');
select throws_ok($$select public.creer_commande(pg_temp.c1(), (select id from pp), null, null, '+243990000000', null, pg_temp.acc(), null, 20990, (select v from emp), 'cle-cm-0001')$$, 'P0001', 'KS_REMISE_MANQUANTE', 'produit physique sans remise : refusé');
select throws_ok($$select public.creer_commande(pg_temp.c1(), (select id from pp), 'goma', 'retrait', '+243990000000', null, pg_temp.acc(), 'Mauvaise Origine!', 20990, (select v from emp), 'cle-cm-0001')$$, 'P0001', 'KS_ORIGINE_INVALIDE', 'origine de vente invalide : refusée');
select throws_ok($$select public.creer_commande(pg_temp.c2(), (select id from pp), 'goma', 'retrait', '+243990000000', null, pg_temp.acc(), null, 20990, (select v from emp), 'cle-cm-0001')$$, 'P0001', 'KS_PANIER_INTROUVABLE', 'le Panier d''un autre Compte : refusé');
select is((select count(*)::int from public.commande where statut = 'en_attente'), 0, 'aucun refus ne crée de Commande');

-- Création.
create temp table cr as select public.creer_commande(pg_temp.c1(), (select id from pp), 'goma', 'retrait', '+243 990 000 000', null, pg_temp.acc(), 'tiktok', 20990, (select v from emp), 'cle-cm-0001') as r;
grant select on cr to public;
select is((select statut from public.commande where id = (select (r ->> 'commande_id')::uuid from cr)), 'en_attente', 'Commande en attente');
select is((select total_cents from public.commande where id = (select (r ->> 'commande_id')::uuid from cr)), 20990, 'total figé');
select is((select telephone from public.commande where id = (select (r ->> 'commande_id')::uuid from cr)), '+243990000000', 'téléphone normalisé');
select is((select origine from public.commande where id = (select (r ->> 'commande_id')::uuid from cr)), 'tiktok', 'origine de la vente figée');
select ok((select expire_le > now() + interval '29 minutes' and expire_le <= now() + interval '31 minutes' from public.commande where id = (select (r ->> 'commande_id')::uuid from cr)), 'échéance à 30 minutes');
select is((select count(*)::int from public.reservation where commande_id = (select (r ->> 'commande_id')::uuid from cr)), 2, 'une réservation par ligne physique (pas pour le Kit)');
select is((select origine from public.ligne_commande where commande_id = (select (r ->> 'commande_id')::uuid from cr) and variante_id is not null and delai_fabrication_jours is not null), 'fabrication', 'la taille L est figée « fabrication »');
select is((select delai_fabrication_jours from public.ligne_commande where commande_id = (select (r ->> 'commande_id')::uuid from cr) and origine = 'fabrication'), 14, 'délai annoncé figé');
select is(public.stock_disponible((select id from vm)), 0, 'les réservations comptent dans stock_disponible');
select is(public.places_fabrication_utilisees(), 2, 'les réservations sur commande comptent dans le Plafond');

-- Le public n'obtient que l'état du Plafond (atteint ou non), jamais le nombre de pièces sur commande.
set local role anon;
select is(public.capacite_fabrication_atteinte(), false, 'anon : 2 pièces réservées, Plafond 3 : état « non atteint »');
select throws_ok($$select public.places_fabrication_utilisees()$$, '42501', null, 'anon : le nombre de pièces sur commande est refusé');
select is(pg_typeof(public.capacite_fabrication_atteinte())::text, 'boolean', 'anon : la fonction publique ne renvoie qu''un booléen, pas un compte');
reset role;
update public.reglage set valeur = '2' where cle = 'plafond_fabrication';
set local role anon;
select is(public.capacite_fabrication_atteinte(), true, 'anon : 2 pièces réservées, Plafond 2 : état « atteint » (« Commandes complètes pour le moment »)');
select is((select count(*)::int from public.reglage where cle = 'plafond_fabrication'), 0, 'anon : le Plafond lui-même reste illisible');
reset role;
update public.reglage set valeur = '3' where cle = 'plafond_fabrication';
select is((select count(*)::int from public.ligne_panier where panier_id = (select id from pp)), 3, 'le Panier reste intact');
select is((public.creer_commande(pg_temp.c1(), (select id from pp), 'goma', 'retrait', '+243 990 000 000', null, pg_temp.acc(), 'tiktok', 20990, (select v from emp), 'cle-cm-0001') ->> 'rejeu')::boolean, true, 'même clé : la même Commande');
select is((select count(*)::int from public.commande where statut = 'en_attente'), 1, 'toujours une seule Commande');
select throws_ok($$select public.creer_commande(pg_temp.c1(), (select id from pp), 'goma', 'retrait', '+243990000000', null, pg_temp.acc(), null, 20990, (select v from emp), 'cle-cm-0002')$$, 'P0001', 'KS_COMMANDE_EN_ATTENTE', 'une seule Commande à payer par Compte : une seconde est refusée');

-- Expiration.
update public.commande set expire_le = now() - interval '1 minute' where statut = 'en_attente';
select is(public.stock_disponible((select id from vm)), 2, 'passé l''échéance, le stock se libère même avant la tâche planifiée');
select is(public.expirer_commandes_echues(), 1, 'une Commande expirée');
select is((select statut from public.commande where compte_id = '00000000-0000-0000-0000-0000000000a1' and statut <> 'offerte' limit 1), 'expiree', 'statut expirée');
select is((select count(*)::int from public.reservation where liberee_le is null), 0, 'réservations libérées');
select is(public.places_fabrication_utilisees(), 0, 'le Plafond est rendu');
select is(public.expirer_commandes_echues(), 0, 'rejouable sans effet');

select * from finish();
rollback;
