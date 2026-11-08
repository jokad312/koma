-- Story 9.2 : appliquer un Code promo. code_promo_evaluer (inconnu, inactif, plafond, premier achat, un seul code), reduction repartie et figee par ligne,
-- Forfait jamais reduit, taux de reduction et de commission figes avec la Commande, utilisations calculees (AD-29), utilisation liberee a l'expiration
-- et a l'annulation, Commande offerte qui ne compte pas comme achat, total nul refuse. Donnees TEST_ annulees a la fin.
begin;
select plan(44);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-cp1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-cp2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-cp3@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a4', 'test-cp4@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a2', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a4', 25);
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a3', 'admin');
create function pg_temp.vis() returns jsonb language sql as $$ select '{"type":"visiteur"}'::jsonb $$;
create function pg_temp.c1() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":null}'::jsonb $$;
create function pg_temp.c2() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a2","role":null}'::jsonb $$;
create function pg_temp.c4() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a4","role":null}'::jsonb $$;
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a3","role":"admin"}'::jsonb $$;
create function pg_temp.acc() returns jsonb language sql as $$ select '[{"objet":"cgv","version":"v1"},{"objet":"kit_acces_immediat","version":"v1"}]'::jsonb $$;

insert into public.reglage (cle, valeur) values
  ('forfait_livraison_goma_cents', '500'), ('forfait_livraison_bukavu_cents', '1200'), ('retrait_goma_fr', 'Lieu'), ('retrait_goma_en', 'Place'), ('plafond_fabrication', '10')
  on conflict (cle) do update set valeur = excluded.valeur;
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'cp-cos', 'C', 'C', 5000, 14, now() - interval '1 minute');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'cp-kit', 'K', 'K', 990, 'debutant', now() - interval '1 minute');
create temp table cp as
  select (select id from public.produit where slug = 'cp-cos') as cos, (select id from public.produit where slug = 'cp-kit') as kit;
grant select on cp to public;
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values ((select cos from cp), 'M', 20, false);

-- Paniers identiques (cosplay x2 a 50,00 + Kit a 9,90 = 109,90) pour les comptes a1, a2 et a4.
create temp table pp1 as select public.creer_panier(pg_temp.vis()) as id;
create temp table pp2 as select public.creer_panier(pg_temp.vis()) as id;
create temp table pp4 as select public.creer_panier(pg_temp.vis()) as id;
grant select on pp1, pp2, pp4 to public;
select public.fusionner_panier(pg_temp.c1(), '00000000-0000-0000-0000-0000000000a1', (select id from pp1));
select public.ajouter_au_panier(pg_temp.c1(), (select id from pp1), '00000000-0000-0000-0000-0000000000a1', (select cos from cp), 'M', 2);
select public.ajouter_au_panier(pg_temp.c1(), (select id from pp1), '00000000-0000-0000-0000-0000000000a1', (select kit from cp), null, 1);
select public.fusionner_panier(pg_temp.c2(), '00000000-0000-0000-0000-0000000000a2', (select id from pp2));
select public.ajouter_au_panier(pg_temp.c2(), (select id from pp2), '00000000-0000-0000-0000-0000000000a2', (select cos from cp), 'M', 2);
select public.ajouter_au_panier(pg_temp.c2(), (select id from pp2), '00000000-0000-0000-0000-0000000000a2', (select kit from cp), null, 1);
select public.fusionner_panier(pg_temp.c4(), '00000000-0000-0000-0000-0000000000a4', (select id from pp4));
select public.ajouter_au_panier(pg_temp.c4(), (select id from pp4), '00000000-0000-0000-0000-0000000000a4', (select cos from cp), 'M', 2);
select public.ajouter_au_panier(pg_temp.c4(), (select id from pp4), '00000000-0000-0000-0000-0000000000a4', (select kit from cp), null, 1);

-- Codes : PROMO10 (10 %, commission 5 %), ARRET10 (inactif), PETIT (20 %, commission 10 %), GRATUIT (100 %).
select public.creer_code_promo(pg_temp.adm(), 'PROMO10', 'TEST_Affilie', 10, 5, 50, true);
select public.creer_code_promo(pg_temp.adm(), 'ARRET10', 'TEST_Affilie', 10, 5, 50, false);
select public.creer_code_promo(pg_temp.adm(), 'PETIT', 'TEST_Affilie', 20, 10, 50, true);
select public.creer_code_promo(pg_temp.adm(), 'GRATUIT', 'TEST_Affilie', 100, 0, 50, true);
create temp table codes as select code, id from public.code_promo;
grant select on codes to public;

-- Droits : le taux de commission ne quitte jamais le serveur.
select is(
  (select count(*)::int from unnest(array[
    'public.utilisations_code_promo(uuid)', 'public.a_deja_achete(uuid, uuid)', 'public.recapitulatif_commande(uuid, uuid, text, text, text)',
    'public.creer_commande(jsonb, uuid, text, text, text, text, jsonb, text, integer, text, text, text)'
  ]) f where not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute')),
  4,
  'fonctions du Code promo : service seulement'
);
select ok(not has_function_privilege('anon', 'public.code_promo_evaluer(uuid, text, uuid)', 'execute') and not has_function_privilege('authenticated', 'public.code_promo_evaluer(uuid, text, uuid)', 'execute'), 'code_promo_evaluer : fermée au public');
select ok((select relrowsecurity from pg_class where oid = 'public.commande_code_promo'::regclass), 'RLS active sur commande_code_promo');
select is((select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and table_name = 'commande_code_promo' and lower(grantee) in ('anon', 'authenticated', 'public')), 0, 'aucun droit client sur commande_code_promo (taux de commission)');

-- Récapitulatif avec un code accepté (saisi en minuscules) : 10 % de 109,90 = 10,99 ; Forfait de livraison jamais réduit.
create temp table r1 as select public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp1), 'goma', 'livraison', ' promo10 ') as r;
grant select on r1 to public;
select is((select (r -> 'code' ->> 'valide')::boolean from r1), true, 'code accepté sans distinction de majuscules ni espaces');
select is((select (r ->> 'reduction_cents')::int from r1), 1099, 'réduction totale : 10 % de 10 990 centimes');
select is((select (r ->> 'forfait_cents')::int from r1), 500, 'le Forfait de livraison n''est jamais réduit');
select is((select (r ->> 'total_cents')::int from r1), 10391, 'total = sous-total - réduction + Forfait');
select is((select sum((e ->> 'reduction_cents')::int)::int from r1, jsonb_array_elements(r -> 'lignes') e), 1099, 'la somme des réductions par ligne est la réduction totale');
select is((select (e ->> 'reduction_cents')::int from r1, jsonb_array_elements(r -> 'lignes') e where e ->> 'famille' = 'kit'), 99, 'le reste est sur la dernière ligne (Kit : 99 centimes)');
select is((select (e ->> 'reduction_cents')::int from r1, jsonb_array_elements(r -> 'lignes') e where e ->> 'famille' = 'cosplay'), 1000, 'part de la première ligne arrondie au centime inférieur (Cosplay : 1 000 centimes)');
select ok(not jsonb_exists((select r -> 'code' from r1), 'commission_pct'), 'le Récapitulatif ne porte jamais le taux de commission');

-- Refus (Récapitulatif : rendus dans « code », jamais en erreur).
select is(public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp1), 'goma', 'retrait', 'NOPE') -> 'code' ->> 'erreur', 'code_inconnu', 'code inexistant');
select is((public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp1), 'goma', 'retrait', 'NOPE') ->> 'total_cents')::int, 10990, 'code refusé : total sans réduction');
select is(public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp1), 'goma', 'retrait', 'arret10') -> 'code' ->> 'erreur', 'code_inactif', 'code inactif');
select is(jsonb_typeof(public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp1), 'goma', 'retrait', '   ') -> 'code'), 'null', 'saisie vide : pas de code');
select is(public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp1), 'goma', 'retrait', 'GRATUIT') -> 'code' ->> 'erreur', 'code_total_nul', 'un code qui rendrait la Commande gratuite est refusé');
select is((public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp1), 'goma', 'livraison', 'GRATUIT') ->> 'total_cents')::int, 500, 'avec un Forfait à payer, 100 % laisse le Forfait');

-- Création : refus strict, puis création.
create temp table emp as select public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp1), 'goma', 'livraison', null) ->> 'empreinte' as v;
grant select on emp to public;
select throws_ok($$select public.creer_commande(pg_temp.c1(), (select id from pp1), 'goma', 'livraison', '+243990000000', 'TEST adresse', pg_temp.acc(), null, 10990, (select v from emp), 'cle-cp-0000', 'NOPE')$$, 'P0001', 'KS_CODE_INCONNU', 'création avec un code inconnu : refusée');
select throws_ok($$select public.creer_commande(pg_temp.c1(), (select id from pp1), 'goma', 'livraison', '+243990000000', 'TEST adresse', pg_temp.acc(), null, 10990, (select v from emp), 'cle-cp-0000', 'ARRET10')$$, 'P0001', 'KS_CODE_INACTIF', 'création avec un code inactif : refusée');
select throws_ok($$select public.creer_commande(pg_temp.c1(), (select id from pp1), 'goma', 'livraison', '+243990000000', 'TEST adresse', pg_temp.acc(), null, 10990, (select v from emp), 'cle-cp-0000', 'promo10')$$, 'P0001', 'KS_TOTAL_CHANGE', 'total vu sans la réduction : le total relu en base fait foi');
create temp table cr as select public.creer_commande(pg_temp.c1(), (select id from pp1), 'goma', 'livraison', '+243990000000', 'TEST adresse', pg_temp.acc(), 'tiktok', 10391, (select v from emp), 'cle-cp-0001', 'promo10') as r;
grant select on cr to public;
select is((select total_cents from public.commande where id = (select (r ->> 'commande_id')::uuid from cr)), 10391, 'Commande créée au total réduit');
select is((select origine from public.commande where id = (select (r ->> 'commande_id')::uuid from cr)), 'code_promo10', 'l''origine de la vente enregistre le Code promo');
select is(
  (select code || '/' || reduction_pct || '/' || commission_pct || '/' || reduction_cents from public.commande_code_promo where commande_id = (select (r ->> 'commande_id')::uuid from cr)),
  'PROMO10/10.00/5.00/1099',
  'code, taux de réduction, taux de commission et réduction figés avec la Commande'
);
select is((select sum(reduction_cents)::int from public.ligne_commande where commande_id = (select (r ->> 'commande_id')::uuid from cr)), 1099, 'réduction figée par ligne');
select is(
  (select (sum(prix_cents * nombre - reduction_cents) + max(c.forfait_cents))::int from public.ligne_commande l join public.commande c on c.id = l.commande_id where l.commande_id = (select (r ->> 'commande_id')::uuid from cr)),
  10391,
  'prix - réduction par ligne + Forfait = total (base du montant à rendre, AD-27)'
);
select is(public.utilisations_code_promo((select id from codes where code = 'PROMO10')), 1, 'la Commande en attente compte une utilisation');
select is((public.creer_commande(pg_temp.c1(), (select id from pp1), 'goma', 'livraison', '+243990000000', 'TEST adresse', pg_temp.acc(), 'tiktok', 10391, (select v from emp), 'cle-cp-0001', 'promo10') ->> 'rejeu')::boolean, true, 'même clé : la même Commande, sans seconde utilisation');

-- Les taux sont figés : modifier le code ne change pas la Commande.
select public.modifier_code_promo(pg_temp.adm(), (select id from codes where code = 'PROMO10'), 'TEST_Affilie', 50, 20, 1, true);
select is(
  (select reduction_pct || '/' || commission_pct from public.commande_code_promo where commande_id = (select (r ->> 'commande_id')::uuid from cr)),
  '10.00/5.00',
  'une modification du code ne touche jamais les taux d''une Commande passée'
);

-- Plafond (1) atteint par la Commande en attente de a1 ; un seul code par achat pour a1.
select is(public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a4', (select id from pp4), 'goma', 'retrait', 'PROMO10') -> 'code' ->> 'erreur', 'code_plafond', 'plafond atteint : refusé');
select throws_ok($$select public.creer_commande(pg_temp.c4(), (select id from pp4), 'goma', 'retrait', '+243990000001', null, pg_temp.acc(), null, 10990, (select public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a4', (select id from pp4), 'goma', 'retrait', null) ->> 'empreinte'), 'cle-cp-0004', 'PROMO10')$$, 'P0001', 'KS_CODE_PLAFOND', 'création au-dessus du plafond : refusée');
-- Évalué directement : le Récapitulatif de a1 refuserait d'abord le Kit déjà présent dans sa Commande en attente (KS_KIT_DEJA_POSSEDE).
select is(public.code_promo_evaluer('00000000-0000-0000-0000-0000000000a1', 'PETIT') ->> 'erreur', 'code_un_seul', 'un seul code par achat : a1 a déjà une Commande en attente avec un code');

-- Expiration : l'utilisation est libérée.
update public.commande set expire_le = now() - interval '1 minute' where id = (select (r ->> 'commande_id')::uuid from cr);
-- Avant le passage de expirer_commandes_echues : l'échéance passée suffit à libérer l'utilisation et le « un seul code par achat ».
select is(public.utilisations_code_promo((select id from codes where code = 'PROMO10')), 0, 'échéance passée : utilisation libérée sans attendre la tâche d''expiration');
select is(public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a1', (select id from pp1), 'goma', 'livraison', 'PETIT') -> 'code' ->> 'valide', 'true', 'échéance passée : un autre code redevient possible pour a1');
select is(public.expirer_commandes_echues(), 1, 'la Commande échue expire');
select is(public.utilisations_code_promo((select id from codes where code = 'PROMO10')), 0, 'une Commande expirée libère son utilisation');
select is(public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a4', (select id from pp4), 'goma', 'retrait', 'PROMO10') -> 'code' ->> 'valide', 'true', 'le code est de nouveau utilisable');

-- Premier achat : une Commande payée l'interdit, une Commande offerte ne compte pas.
insert into public.commande (numero, compte_id, type, statut, sous_total_cents, total_cents, paye_le) values
  ('KS-2026-860001', '00000000-0000-0000-0000-0000000000a2', 'produits', 'payee', 100, 100, now());
insert into public.commande (numero, compte_id, type, statut, offerte, sous_total_cents, total_cents) values
  ('KS-2026-860002', '00000000-0000-0000-0000-0000000000a4', 'produits', 'offerte', true, 0, 0);
select is(public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a2', (select id from pp2), 'goma', 'retrait', 'PETIT') -> 'code' ->> 'erreur', 'code_premier_achat', 'code réservé à un premier achat');
select is(public.a_deja_achete('00000000-0000-0000-0000-0000000000a2'), true, 'a_deja_achete : une Commande avec paye_le');
select is(public.a_deja_achete('00000000-0000-0000-0000-0000000000a2', (select id from public.commande where numero = 'KS-2026-860001')), false, 'a_deja_achete : on peut exclure la Commande en cours');
select is(public.a_deja_achete('00000000-0000-0000-0000-0000000000a4'), false, 'une Commande offerte ne compte pas comme un achat');

-- Utilisation d'une Commande payée, puis annulée.
create temp table cr4 as select public.creer_commande(pg_temp.c4(), (select id from pp4), 'goma', 'retrait', '+243990000001', null, pg_temp.acc(), null, 8792, (select public.recapitulatif_commande('00000000-0000-0000-0000-0000000000a4', (select id from pp4), 'goma', 'retrait', null) ->> 'empreinte'), 'cle-cp-0005', 'PETIT') as r;
grant select on cr4 to public;
select is(public.utilisations_code_promo((select id from codes where code = 'PETIT')), 1, 'PETIT : une utilisation réservée à la création');
update public.commande set statut = 'payee', paye_le = now() where id = (select (r ->> 'commande_id')::uuid from cr4);
select is(public.utilisations_code_promo((select id from codes where code = 'PETIT')), 1, 'PETIT : la Commande payée compte');
update public.commande set statut = 'annulee' where id = (select (r ->> 'commande_id')::uuid from cr4);
select is(public.utilisations_code_promo((select id from codes where code = 'PETIT')), 0, 'PETIT : la Commande annulée libère son utilisation');

select * from finish();
rollback;
