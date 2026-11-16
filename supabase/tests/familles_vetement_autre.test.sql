-- Story 9.15 : familles « vetement » (tailles × couleurs) et « autre » (variante « unique »), physiques partout. Contraintes, enregistrer_produit
-- (droit, journal), RLS des nouvelles colonnes, ajouter_au_panier avec couleur, réservation, décompte au paiement confirmé, libération à
-- l'expiration, annulation (décision 10). Données TEST_ créées dans la transaction, puis annulées.
begin;
select plan(75);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000009a1', 'test-va1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000009a2', 'test-va2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000009a3', 'test-va3@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000009a1', 'admin');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000009a2', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000009a3', 25);
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000009a1","role":"admin"}'::jsonb $$;
create function pg_temp.c2() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000009a2","role":null}'::jsonb $$;
create function pg_temp.c3() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000009a3","role":null}'::jsonb $$;
create function pg_temp.vis() returns jsonb language sql as $$ select '{"type":"visiteur"}'::jsonb $$;
insert into public.reglage (cle, valeur) values
  ('forfait_livraison_goma_cents', '500'), ('forfait_livraison_bukavu_cents', '1200'), ('retrait_goma_fr', 'Lieu'), ('retrait_goma_en', 'Place')
  on conflict (cle) do update set valeur = excluded.valeur;

-- 1. Contraintes de la table et de la famille.
select throws_ok($$insert into public.produit (famille, slug, titre_fr) values ('TEST_inconnue', 'va-inconnue', 'X')$$, '23514', null, 'famille inconnue : refusée');
select lives_ok($$insert into public.produit (famille, slug, titre_fr, titre_en, description_fr, description_en, prix_cents) values
  ('vetement', 'va-polo', 'TEST_Polo', 'TEST_Polo', 'd', 'e', 2000),
  ('autre', 'va-objet', 'TEST_Objet', 'TEST_Object', 'd', 'e', 1000),
  ('accessoire', 'va-acc', 'TEST_Acc', 'TEST_Acc', 'd', 'e', 1500),
  ('cosplay', 'va-cos', 'TEST_Cos', 'TEST_Cos', 'd', 'e', 5000)$$, 'familles vetement et autre acceptées');
create temp table vp as select
  (select id from public.produit where slug = 'va-polo') as polo,
  (select id from public.produit where slug = 'va-objet') as objet,
  (select id from public.produit where slug = 'va-acc') as acc,
  (select id from public.produit where slug = 'va-cos') as cos;
grant select on vp to public;

select throws_ok($$insert into public.variante (produit_id, taille, stock) values ((select acc from vp), 'unique', 1)$$, 'P0001', 'KS_TAILLE_INVALIDE', 'taille unique réservée à un Autre article');
select throws_ok($$insert into public.variante (produit_id, taille, stock) values ((select objet from vp), 'M', 1)$$, 'P0001', 'KS_TAILLE_INVALIDE', 'un Autre article n''a que la taille unique');
select throws_ok($$insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values ((select polo from vp), 'sur_mesure', 0, true)$$, 'P0001', 'KS_TAILLE_INVALIDE', 'pas de sur-mesure pour un Vêtement');
select throws_ok($$insert into public.variante (produit_id, taille, stock, couleur_fr) values ((select acc from vp), 'M', 1, 'Noir')$$, 'P0001', 'KS_COULEUR_INVALIDE', 'couleur interdite hors Vêtement');
select throws_ok($$insert into public.variante (produit_id, taille, stock, couleur_en) values ((select polo from vp), 'M', 1, 'Black')$$, '23514', null, 'nom anglais sans nom français : refusé');
select throws_ok($$insert into public.variante (produit_id, taille, stock, couleur_fr, couleur_hex) values ((select polo from vp), 'M', 1, 'Noir', 'noir')$$, '23514', null, 'pastille mal formée : refusée');
insert into public.variante (produit_id, taille, stock, couleur_fr, couleur_en, couleur_hex) values ((select polo from vp), 'M', 1, 'Noir', 'Black', '#1B1713');
select throws_ok($$insert into public.variante (produit_id, taille, stock, couleur_fr) values ((select polo from vp), 'M', 3, 'Noir')$$, '23505', null, 'unicité taille × couleur');
select lives_ok($$insert into public.variante (produit_id, taille, stock, couleur_fr) values ((select polo from vp), 'M', 3, 'Blanc')$$, 'même taille, autre couleur : acceptée');
insert into public.variante (produit_id, taille, stock) values ((select acc from vp), 'M', 2);
select throws_ok($$insert into public.variante (produit_id, taille, stock) values ((select acc from vp), 'M', 2)$$, '23505', null, 'sans couleur : une ligne par taille, comme avant');
insert into public.variante (produit_id, taille, stock) values ((select objet from vp), 'unique', 1);
select throws_ok($$insert into public.variante (produit_id, taille, stock) values ((select objet from vp), 'unique', 1)$$, '23505', null, 'une seule variante pour un Autre article');
select throws_ok($$update public.produit set famille = 'accessoire' where id = (select polo from vp)$$, 'P0001', 'KS_FAMILLE_INVALIDE', 'un Vêtement ne change pas de famille');
select throws_ok($$update public.produit set famille = 'autre' where id = (select cos from vp)$$, 'P0001', 'KS_FAMILLE_INVALIDE', 'aucune famille ne devient Autre article');
delete from public.variante where produit_id in ((select polo from vp), (select objet from vp), (select acc from vp));

-- 2. enregistrer_produit : droit admin, couleurs, Taille unique, journal d'audit.
select throws_ok($$select public.enregistrer_produit(pg_temp.c2(), null::uuid, '{"famille":"vetement","slug":"va-refus","titre_fr":"X"}'::jsonb, '[]'::jsonb)$$, 'P0001', 'KS_DROIT_REFUSE', 'sans droit admin : refusé');
select lives_ok($$select public.enregistrer_produit(pg_temp.adm(), (select polo from vp), '{"famille":"vetement","slug":"va-polo","titre_fr":"TEST_Polo","titre_en":"TEST_Polo","description_fr":"d","description_en":"e","prix_cents":"2000"}'::jsonb,
  '[{"taille":"M","couleur_fr":"Noir","couleur_en":"Black","couleur_hex":"#1b1713","stock":"1","fabrication_sur_commande":false},
    {"taille":"L","couleur_fr":"Noir","couleur_en":"Black","couleur_hex":"#1B1713","stock":"0","fabrication_sur_commande":false},
    {"taille":"M","couleur_fr":"Blanc","couleur_en":"White","stock":"0","fabrication_sur_commande":false},
    {"taille":"L","couleur_fr":"Blanc","couleur_en":"White","stock":"0","fabrication_sur_commande":true,"delai_fabrication_jours":"7"}]'::jsonb)$$, 'Vêtement en M et L, Noir et Blanc');
select is((select count(*)::int from public.variante where produit_id = (select polo from vp)), 4, 'quatre variantes taille × couleur');
select is((select couleur_hex from public.variante where produit_id = (select polo from vp) and taille = 'M' and couleur_fr = 'Noir'), '#1B1713', 'pastille en majuscules');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'variante' and action = 'insert' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000009a1', 'journal d''audit : l''auteur de l''écriture');
select throws_ok($$select public.enregistrer_produit(pg_temp.adm(), (select polo from vp), '{"famille":"vetement","slug":"va-polo","titre_fr":"TEST_Polo"}'::jsonb,
  '[{"taille":"M","couleur_fr":"Noir","stock":"1"},{"taille":"L","stock":"1"}]'::jsonb)$$, 'P0001', 'KS_COULEUR_INVALIDE', 'couleurs mélangées (avec et sans) : refusé');
select throws_ok($$select public.enregistrer_produit(pg_temp.adm(), (select polo from vp), '{"famille":"vetement","slug":"va-polo","titre_fr":"TEST_Polo"}'::jsonb,
  '[{"taille":"M","couleur_fr":"Noir","couleur_en":"Black","stock":"1"},{"taille":"L","couleur_fr":"Noir","couleur_en":"Dark","stock":"1"}]'::jsonb)$$, 'P0001', 'KS_COULEUR_INVALIDE', 'une couleur garde le même nom anglais');
select throws_ok($$select public.enregistrer_produit(pg_temp.adm(), (select acc from vp), '{"famille":"accessoire","slug":"va-acc","titre_fr":"TEST_Acc"}'::jsonb,
  '[{"taille":"M","couleur_fr":"Noir","stock":"1"}]'::jsonb)$$, 'P0001', 'KS_COULEUR_INVALIDE', 'enregistrer_produit : couleur hors Vêtement refusée');
select throws_ok($$select public.enregistrer_produit(pg_temp.adm(), (select polo from vp), '{"famille":"accessoire","slug":"va-polo","titre_fr":"TEST_Polo"}'::jsonb, '[]'::jsonb)$$, 'P0001', 'KS_FAMILLE_INVALIDE', 'enregistrer_produit : un Vêtement garde sa famille');
select lives_ok($$select public.enregistrer_produit(pg_temp.adm(), (select objet from vp), '{"famille":"autre","slug":"va-objet","titre_fr":"TEST_Objet","titre_en":"TEST_Object","description_fr":"d","description_en":"e","prix_cents":"1000"}'::jsonb, '[]'::jsonb)$$, 'Autre article sans taille');
select is((select array_agg(taille) from public.variante where produit_id = (select objet from vp)), array['unique'], 'une variante « Taille unique » est créée');
select throws_ok($$select public.enregistrer_produit(pg_temp.adm(), (select objet from vp), '{"famille":"autre","slug":"va-objet","titre_fr":"TEST_Objet"}'::jsonb, '[{"taille":"M","stock":"1"}]'::jsonb)$$, 'P0001', 'KS_TAILLE_INVALIDE', 'Autre article : une autre taille est refusée');
update public.variante set stock = 1 where produit_id = (select objet from vp);
insert into public.produit_photo (produit_id, fichier, alt_fr, alt_en, position)
  select id, id::text || '/a.jpg', 'Alt', 'Alt en', 1 from public.produit where slug in ('va-polo', 'va-objet');

-- 3. Publication : couleurs nommées en anglais.
update public.variante set couleur_en = null where produit_id = (select polo from vp) and couleur_fr = 'Blanc';
select ok('couleurs' = any (public.manques_publication((select polo from vp))), 'une couleur sans nom anglais manque pour publier');
update public.variante set couleur_en = 'White' where produit_id = (select polo from vp) and couleur_fr = 'Blanc';
select is(public.manques_publication((select polo from vp)), '{}'::text[], 'Vêtement complet');
select is(public.manques_publication((select objet from vp)), '{}'::text[], 'Autre article complet avec sa Taille unique');
update public.produit set publie_le = now() - interval '1 minute' where slug in ('va-polo', 'va-objet', 'va-acc');
insert into public.variante (produit_id, taille, stock) values ((select acc from vp), 'M', 2);

-- 4. Lecture publique : nouvelles colonnes lisibles, jamais le stock ; catalogues et fiche.
set local role anon;
select ok(has_column_privilege('anon', 'public.variante', 'couleur_fr', 'select') and has_column_privilege('anon', 'public.variante', 'couleur_hex', 'select'), 'anon lit la couleur');
select is((select count(*)::int from public.variante where produit_id = (select polo from vp) and couleur_fr is not null), 4, 'RLS : les variantes d''un produit publié sont lisibles avec leur couleur');
select is((select count(*)::int from public.lister_catalogue('vetement', 'fr')), 1, 'catalogue des Vêtements');
select is((select count(*)::int from public.lister_catalogue('autre', 'en')), 1, 'catalogue des Autres articles');
select is((select etat from public.disponibilite_variantes((select polo from vp)) where taille = 'L' and couleur_fr = 'Blanc'), 'sur_commande', 'fiche : L Blanc sur commande');
select is((select etat from public.disponibilite_variantes((select polo from vp)) where taille = 'M' and couleur_fr = 'Blanc'), 'epuise', 'fiche : M Blanc épuisé');
select is((select couleur_en from public.disponibilite_variantes((select polo from vp)) where taille = 'M' and couleur_fr = 'Noir'), 'Black', 'fiche : nom anglais de la couleur');
reset role;

-- 5. Panier : choix par taille et couleur.
create temp table vpn as select public.creer_panier(pg_temp.vis()) as a, public.creer_panier(pg_temp.vis()) as b;
grant select on vpn to public;
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select a from vpn), null, (select polo from vp), 'M', 1, 'TEST_Rose')$$, 'P0001', 'KS_VARIANTE_INTROUVABLE', 'couleur inconnue : refusée');
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select a from vpn), null, (select polo from vp), 'M', 1)$$, 'P0001', 'KS_VARIANTE_INTROUVABLE', 'couleur oubliée : refusée');
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select a from vpn), null, (select polo from vp), 'M', 1, 'Blanc')$$, 'P0001', 'KS_INDISPONIBLE', 'M Blanc épuisé : refusé');
select is((select count(*)::int from public.ligne_panier where panier_id = (select a from vpn)), 0, 'le Panier ne change pas après un refus');
select is((public.ajouter_au_panier(pg_temp.vis(), (select a from vpn), null, (select polo from vp), 'M', 1, 'Noir') ->> 'nombre')::int, 1, 'M Noir ajouté');
select is((public.ajouter_au_panier(pg_temp.vis(), (select a from vpn), null, (select objet from vp), null, 1) ->> 'nombre')::int, 1, 'Autre article sans taille : variante unique');
select is((select array_agg(coalesce(couleur_fr, '-') || ':' || taille order by taille) from public.lire_panier((select a from vpn))), array['Noir:M', '-:unique'], 'lecture du Panier avec taille et couleur');
select is((public.ajouter_au_panier(pg_temp.vis(), (select b from vpn), null, (select acc from vp), 'M', 1) ->> 'nombre')::int, 1, 'appel sans couleur (accessoire) : toujours valide');

-- 6. Réservation, décompte au paiement confirmé, libération à l'expiration.
select public.fusionner_panier(pg_temp.c2(), '00000000-0000-0000-0000-0000000009a2', (select a from vpn));
create temp table vr as select public.recapitulatif_commande('00000000-0000-0000-0000-0000000009a2', (select a from vpn), 'goma', 'retrait') as r;
grant select on vr to public;
-- Deux lignes ajoutées dans la même transaction (même cree_le) : leur ordre dépend de l'id aléatoire. On lit la ligne du polo par son produit.
select is((select l ->> 'couleur_fr' from vr, jsonb_array_elements(r -> 'lignes') as l where (l ->> 'produit_id')::uuid = (select polo from vp)), 'Noir', 'Récapitulatif : la couleur de la ligne');
-- Deux paniers contiennent déjà le dernier M Noir (c2 et c3) : la première Commande le réserve, la seconde est refusée.
create temp table vpn2 as select public.creer_panier(pg_temp.vis()) as a;
grant select on vpn2 to public;
select public.fusionner_panier(pg_temp.c3(), '00000000-0000-0000-0000-0000000009a3', (select a from vpn2));
select is((public.ajouter_au_panier(pg_temp.c3(), (select a from vpn2), '00000000-0000-0000-0000-0000000009a3', (select polo from vp), 'M', 1, 'Noir') ->> 'nombre')::int, 1, 'second panier avec le même dernier M Noir');
create temp table vr3 as select public.recapitulatif_commande('00000000-0000-0000-0000-0000000009a3', (select a from vpn2), 'goma', 'retrait') as r;
grant select on vr3 to public;
create temp table vc as select public.creer_commande(pg_temp.c2(), (select a from vpn), 'goma', 'retrait', '+243990000000', null, '[{"objet":"cgv","version":"v1"}]'::jsonb, null,
  (select (r ->> 'total_cents')::int from vr), (select r ->> 'empreinte' from vr), 'cle-va-0001') as r;
grant select on vc to public;
select is(public.stock_disponible((select id from public.variante where produit_id = (select polo from vp) and taille = 'M' and couleur_fr = 'Noir')), 0, 'réservation : le dernier M Noir est pris');
select throws_ok($$select public.creer_commande(pg_temp.c3(), (select a from vpn2), 'goma', 'retrait', '+243990000001', null, '[{"objet":"cgv","version":"v1"}]'::jsonb, null,
  (select (r ->> 'total_cents')::int from vr3), (select r ->> 'empreinte' from vr3), 'cle-va-0002')$$, 'P0001', 'KS_INDISPONIBLE', 'seconde creer_commande sur le dernier exemplaire : refusée');
select is((select count(*)::int from public.commande where compte_id = '00000000-0000-0000-0000-0000000009a3'), 0, 'le refus ne crée aucune Commande');
insert into public.tentative_paiement (id, commande_id, prestataire, moyen, reference_interne, reference_transaction, montant_attendu_cents) values
  ('00000000-0000-4000-8000-0000000009d1', (select (r ->> 'commande_id')::uuid from vc), 'pawapay', 'carte', 'TEST-VA-REF-0001', 'TEST-VA-TX-0001', (select (r ->> 'total_cents')::int from vr));
select is((public.confirmer_paiement('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-4000-8000-0000000009d1', 'egal', (select (r ->> 'total_cents')::numeric / 100 from vr), 'USD', 'TEST-VA-TX-0001') ->> 'resultat'), 'payee', 'paiement confirmé');
select is((select stock from public.variante where produit_id = (select polo from vp) and taille = 'M' and couleur_fr = 'Noir'), 0, 'stock de M Noir décompté');
select is((select stock from public.variante where produit_id = (select objet from vp)), 0, 'stock de l''Autre article décompté');
select is((public.confirmer_paiement('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-4000-8000-0000000009d1', 'egal', (select (r ->> 'total_cents')::numeric / 100 from vr), 'USD', 'TEST-VA-TX-0001') ->> 'resultat'), 'deja_traite', 'même référence rejouée : déjà traitée');
select is((select stock from public.variante where produit_id = (select objet from vp)), 0, 'une seconde confirmation ne décompte rien (stock jamais négatif, une seule fois)');
select is((select count(*)::int from public.reservation where commande_id = (select (r ->> 'commande_id')::uuid from vc) and liberee_le is null and expire_le > now()), 0, 'réservations closes après le paiement');

-- Libération à l'expiration : XL Noir (1 pièce) réservé par c3, puis l'échéance passe.
insert into public.variante (produit_id, taille, stock, couleur_fr, couleur_en, couleur_hex) values ((select polo from vp), 'XL', 1, 'Noir', 'Black', '#1B1713');
create temp table vxl as select id from public.variante where produit_id = (select polo from vp) and taille = 'XL';
grant select on vxl to public;
delete from public.ligne_panier where panier_id = (select a from vpn2);
select public.ajouter_au_panier(pg_temp.c3(), (select a from vpn2), '00000000-0000-0000-0000-0000000009a3', (select polo from vp), 'XL', 1, 'Noir');
create temp table vr4 as select public.recapitulatif_commande('00000000-0000-0000-0000-0000000009a3', (select a from vpn2), 'goma', 'retrait') as r;
grant select on vr4 to public;
select lives_ok($$select public.creer_commande(pg_temp.c3(), (select a from vpn2), 'goma', 'retrait', '+243990000001', null, '[{"objet":"cgv","version":"v1"}]'::jsonb, null,
  (select (r ->> 'total_cents')::int from vr4), (select r ->> 'empreinte' from vr4), 'cle-va-0003')$$, 'Commande en attente sur XL Noir');
select is(public.stock_disponible((select id from vxl)), 0, 'XL Noir réservé');
update public.commande set expire_le = now() - interval '1 minute' where compte_id = '00000000-0000-0000-0000-0000000009a3' and statut = 'en_attente';
select ok(public.expirer_commandes_echues() >= 1, 'la Commande échue expire');
select is((select count(*)::int from public.reservation r join public.ligne_commande l on l.commande_id = r.commande_id where l.variante_id = (select id from vxl) and r.liberee_le is null), 0, 'réservation libérée à l''expiration');
select is(public.stock_disponible((select id from vxl)), 1, 'XL Noir de nouveau disponible');

-- Réclamation : lignes Vêtement et Autre article prêtes à porter, jamais le Kit.
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values ('kit', 'va-kit', 'TEST_Kit', 'TEST_Kit', 900, 'debutant', now() - interval '1 minute');
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, forfait_cents, paye_le, livree_le) values
  ('00000000-0000-4000-8000-0000000009f8', 'KS-2026-990008', '00000000-0000-0000-0000-0000000009a3', 'produits', 'livree', 3900, 3900, 0, now() - interval '2 days', now() - interval '1 hour');
insert into public.ligne_commande (commande_id, produit_id, variante_id, origine, nombre, prix_cents) values
  ('00000000-0000-4000-8000-0000000009f8', (select polo from vp), (select id from public.variante where produit_id = (select polo from vp) and taille = 'M' and couleur_fr = 'Noir'), 'stock', 1, 2000),
  ('00000000-0000-4000-8000-0000000009f8', (select objet from vp), (select id from public.variante where produit_id = (select objet from vp)), 'stock', 1, 1000);
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents) values
  ('00000000-0000-4000-8000-0000000009f8', (select id from public.produit where slug = 'va-kit'), 1, 900);
select is(
  (select array_agg(p.famille order by p.famille) from public.lignes_reclamables('00000000-0000-0000-0000-0000000009a3', 'KS-2026-990008') r
   join public.ligne_commande l on l.id = r.ligne_id join public.produit p on p.id = l.produit_id),
  array['autre', 'vetement'], 'lignes réclamables : Vêtement et Autre article, jamais le Kit');

-- 7. Annulation (décision 10) : une ligne physique fabriquée sur commande rend la Commande annulable, quelle que soit sa famille.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, forfait_cents, paye_le) values
  ('00000000-0000-4000-8000-0000000009f1', 'KS-2026-990001', '00000000-0000-0000-0000-0000000009a3', 'produits', 'payee', 2000, 2000, 0, now()),
  ('00000000-0000-4000-8000-0000000009f2', 'KS-2026-990002', '00000000-0000-0000-0000-0000000009a3', 'produits', 'payee', 1500, 1500, 0, now()),
  ('00000000-0000-4000-8000-0000000009f3', 'KS-2026-990003', '00000000-0000-0000-0000-0000000009a3', 'produits', 'en_fabrication', 2000, 2000, 0, now());
insert into public.ligne_commande (commande_id, produit_id, variante_id, origine, nombre, prix_cents, delai_fabrication_jours) values
  ('00000000-0000-4000-8000-0000000009f1', (select polo from vp), (select id from public.variante where produit_id = (select polo from vp) and taille = 'L' and couleur_fr = 'Blanc'), 'fabrication', 1, 2000, 7),
  ('00000000-0000-4000-8000-0000000009f2', (select acc from vp), (select id from public.variante where produit_id = (select acc from vp)), 'stock', 1, 1500, null),
  ('00000000-0000-4000-8000-0000000009f3', (select polo from vp), (select id from public.variante where produit_id = (select polo from vp) and taille = 'L' and couleur_fr = 'Blanc'), 'fabrication', 1, 2000, 7);
select lives_ok($$select public.demander_annulation('00000000-0000-0000-0000-0000000009a3', 'KS-2026-990001')$$, 'Vêtement fabriqué sur commande : annulable');
select throws_ok($$select public.demander_annulation('00000000-0000-0000-0000-0000000009a3', 'KS-2026-990002')$$, 'KS_ANNULATION_IMPOSSIBLE', 'accessoire en stock seul (sans Cosplay) : non annulable');
select throws_ok($$select public.demander_annulation('00000000-0000-0000-0000-0000000009a3', 'KS-2026-990003')$$, 'KS_ANNULATION_IMPOSSIBLE', 'en fabrication : plus annulable');
select is(public.annuler_commande(pg_temp.adm(), '00000000-0000-4000-8000-0000000009f1'), 2000, 'annuler_commande accepte la même condition ; montant = lignes physiques + Forfait');
select throws_ok($$select public.annuler_commande(pg_temp.adm(), '00000000-0000-4000-8000-0000000009f2')$$, 'KS_ANNULATION_IMPOSSIBLE', 'annuler_commande refuse un accessoire en stock seul');
-- Cosplay en stock : toujours annulable (FR-25) ; Autre article fabriqué sur commande + Kit : annulable, le Kit n'est jamais remboursé.
insert into public.variante (produit_id, taille, stock) values ((select cos from vp), 'M', 1);
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, forfait_cents, paye_le) values
  ('00000000-0000-4000-8000-0000000009f4', 'KS-2026-990004', '00000000-0000-0000-0000-0000000009a3', 'produits', 'payee', 5000, 5000, 0, now()),
  ('00000000-0000-4000-8000-0000000009f5', 'KS-2026-990005', '00000000-0000-0000-0000-0000000009a3', 'produits', 'payee', 1900, 2200, 300, now());
insert into public.ligne_commande (commande_id, produit_id, variante_id, origine, nombre, prix_cents, delai_fabrication_jours) values
  ('00000000-0000-4000-8000-0000000009f4', (select cos from vp), (select id from public.variante where produit_id = (select cos from vp)), 'stock', 1, 5000, null),
  ('00000000-0000-4000-8000-0000000009f5', (select objet from vp), (select id from public.variante where produit_id = (select objet from vp)), 'fabrication', 1, 1000, 5);
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents) values
  ('00000000-0000-4000-8000-0000000009f5', (select id from public.produit where slug = 'va-kit'), 1, 900);
select lives_ok($$select public.demander_annulation('00000000-0000-0000-0000-0000000009a3', 'KS-2026-990004')$$, 'Cosplay en stock : annulable');
select lives_ok($$select public.demander_annulation('00000000-0000-0000-0000-0000000009a3', 'KS-2026-990005')$$, 'Autre article fabriqué sur commande : annulable');
select is(public.annuler_commande(pg_temp.adm(), '00000000-0000-4000-8000-0000000009f5'), 1300, 'commande mixte : Autre article (1000) + Forfait (300), le Kit (900) n''est jamais remboursé');

-- 8. Variantes mises à jour sur place par leur identifiant : renommer une couleur garde la même ligne ; une variante commandée ne se retire pas.
create temp table vids as select taille, couleur_fr, id from public.variante where produit_id = (select polo from vp);
grant select on vids to public;
create function pg_temp.v(t text, c text) returns text language sql as $$ select id::text from vids where taille = t and couleur_fr = c $$;
create function pg_temp.variantes_polo(avec_l_blanc boolean) returns jsonb language sql as $$
  select jsonb_agg(e) from (
    select jsonb_build_object('id', pg_temp.v('M', 'Noir'), 'taille', 'M', 'couleur_fr', 'Noir', 'couleur_en', 'Black', 'couleur_hex', '#1B1713', 'stock', '0') as e
    union all select jsonb_build_object('id', pg_temp.v('L', 'Noir'), 'taille', 'L', 'couleur_fr', 'Noir', 'couleur_en', 'Black', 'couleur_hex', '#1B1713', 'stock', '0')
    union all select jsonb_build_object('id', pg_temp.v('XL', 'Noir'), 'taille', 'XL', 'couleur_fr', 'Noir', 'couleur_en', 'Black', 'couleur_hex', '#1B1713', 'stock', '1')
    union all select jsonb_build_object('id', pg_temp.v('M', 'Blanc'), 'taille', 'M', 'couleur_fr', 'Ivoire', 'couleur_en', 'Ivory', 'stock', '0')
    union all select jsonb_build_object('id', pg_temp.v('L', 'Blanc'), 'taille', 'L', 'couleur_fr', 'Ivoire', 'couleur_en', 'Ivory', 'stock', '0', 'fabrication_sur_commande', true, 'delai_fabrication_jours', '7') where avec_l_blanc
  ) x
$$;
select lives_ok($$select public.enregistrer_produit(pg_temp.adm(), (select polo from vp), '{"famille":"vetement","slug":"va-polo","titre_fr":"TEST_Polo","titre_en":"TEST_Polo","description_fr":"d","description_en":"e","prix_cents":"2000"}'::jsonb, pg_temp.variantes_polo(true))$$, 'Blanc renommé Ivoire');
select is((select couleur_fr || '/' || couleur_en from public.variante where id = pg_temp.v('L', 'Blanc')::uuid), 'Ivoire/Ivory', 'renommage sur place : même identifiant, nouvelle couleur');
select is((select count(*)::int from public.ligne_commande where variante_id = pg_temp.v('L', 'Blanc')::uuid), 2, 'les lignes de Commande gardent leur variante');
select throws_ok($$select public.enregistrer_produit(pg_temp.adm(), (select polo from vp), '{"famille":"vetement","slug":"va-polo","titre_fr":"TEST_Polo","titre_en":"TEST_Polo","description_fr":"d","description_en":"e","prix_cents":"2000"}'::jsonb, pg_temp.variantes_polo(false))$$,
  'P0001', 'KS_VARIANTE_COMMANDEE', 'retirer une variante déjà commandée : refusé');
select is((select count(*)::int from public.variante where produit_id = (select polo from vp)), 5, 'rien n''est retiré après le refus');
select throws_ok($$select public.enregistrer_produit(pg_temp.adm(), (select polo from vp), '{"famille":"vetement","slug":"va-polo","titre_fr":"TEST_Polo"}'::jsonb,
  jsonb_build_array(jsonb_build_object('id', (select id from public.variante where produit_id = (select acc from vp) limit 1), 'taille', 'M', 'couleur_fr', 'Noir', 'stock', '1')))$$,
  'P0001', 'KS_TAILLE_INVALIDE', 'l''identifiant d''une variante d''un autre produit : refusé');

select * from finish();
rollback;
