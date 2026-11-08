-- Story 9.3 : vue commission_code_promo. Commandes payées seulement, montant hors livraison et hors lignes annulées, taux figé de chaque Commande,
-- annulation mixte (le Kit reste compté), remboursement en entier (non compté), Commande en attente non comptée, code sans vente à 0.
-- Données TEST_ annulées à la fin.
begin;
select plan(19);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'test-cm1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', 'test-cm2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b3', 'test-cm3@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b4', 'test-cm4@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b5', 'test-cm5@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b6', 'test-cm6@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b9', 'test-cm9@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, u, 25) from unnest(array[
  '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b4',
  '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000b6'
]::uuid[]) u;
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b9', 'admin');
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000b9","role":"admin"}'::jsonb $$;
create function pg_temp.acc() returns jsonb language sql as $$ select '[{"objet":"cgv","version":"v1"},{"objet":"kit_acces_immediat","version":"v1"}]'::jsonb $$;

insert into public.reglage (cle, valeur) values
  ('forfait_livraison_goma_cents', '500'), ('forfait_livraison_bukavu_cents', '1200'), ('retrait_goma_fr', 'Lieu'), ('retrait_goma_en', 'Place'), ('plafond_fabrication', '10')
  on conflict (cle) do update set valeur = excluded.valeur;
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'cm-cos', 'C', 'C', 5000, 14, now() - interval '1 minute');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'cm-kit', 'K', 'K', 990, 'debutant', now() - interval '1 minute');
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values ((select id from public.produit where slug = 'cm-cos'), 'M', 20, false);

-- Panier d'un Compte (cosplay x nombre, Kit en option), puis Commande avec le code, en livraison à Goma (Forfait 5,00).
create function pg_temp.commander(p_compte uuid, p_nb integer, p_kit boolean, p_code text, p_cle text) returns uuid language plpgsql as $$
declare
  v_auteur jsonb := jsonb_build_object('type', 'compte', 'id', p_compte, 'role', null);
  v_panier uuid := public.creer_panier('{"type":"visiteur"}'::jsonb);
  v_recap jsonb;
begin
  perform public.fusionner_panier(v_auteur, p_compte, v_panier);
  perform public.ajouter_au_panier(v_auteur, v_panier, p_compte, (select id from public.produit where slug = 'cm-cos'), 'M', p_nb);
  if p_kit then
    perform public.ajouter_au_panier(v_auteur, v_panier, p_compte, (select id from public.produit where slug = 'cm-kit'), null, 1);
  end if;
  v_recap := public.recapitulatif_commande(p_compte, v_panier, 'goma', 'livraison', p_code);
  return (public.creer_commande(v_auteur, v_panier, 'goma', 'livraison', '+243990000000', 'TEST adresse', pg_temp.acc(), null,
    (v_recap ->> 'total_cents')::integer, v_recap ->> 'empreinte', p_cle, p_code) ->> 'commande_id')::uuid;
end;
$$;

select public.creer_code_promo(pg_temp.adm(), 'COMM10', 'TEST_Affilie', 10, 5, 50, true);
select public.creer_code_promo(pg_temp.adm(), 'NEUF', 'TEST_Affilie', 10, 5, 50, true);
create temp table cm as select
  (select id from public.code_promo where code = 'COMM10') as code_id,
  (select id from public.code_promo where code = 'NEUF') as neuf_id,
  pg_temp.commander('00000000-0000-0000-0000-0000000000b1', 2, true, 'COMM10', 'cle-cm-0001') as c1,
  pg_temp.commander('00000000-0000-0000-0000-0000000000b2', 2, true, 'COMM10', 'cle-cm-0002') as c2,
  pg_temp.commander('00000000-0000-0000-0000-0000000000b3', 1, false, 'COMM10', 'cle-cm-0003') as c3,
  pg_temp.commander('00000000-0000-0000-0000-0000000000b4', 1, false, 'COMM10', 'cle-cm-0004') as c4;
grant select on cm to public;

-- c1, c2, c3 payées ; c4 reste en attente.
update public.commande set statut = 'payee', paye_le = now() where id in ((select c1 from cm), (select c2 from cm), (select c3 from cm));

-- Droits : la vue n'est lisible que par le serveur.
select is((select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and table_name = 'commission_code_promo' and lower(grantee) in ('anon', 'authenticated', 'public')), 0, 'aucun droit client sur commission_code_promo');
select ok(not has_table_privilege('anon', 'public.commission_code_promo', 'select') and not has_table_privilege('authenticated', 'public.commission_code_promo', 'select'), 'anon et authenticated ne lisent pas la vue');
select ok(has_table_privilege('service_role', 'public.commission_code_promo', 'select'), 'service_role lit la vue');

-- Avant annulation : c1 (9 891), c2 (9 891), c3 (4 500). Hors livraison, réduction déduite. Commissions à 5 % : 494 + 494 + 225.
select is((select ventes from public.commission_code_promo where code_promo_id = (select code_id from cm)), 3, 'trois ventes payées ; la Commande en attente ne compte pas');
select is((select montant_cents from public.commission_code_promo where code_promo_id = (select code_id from cm)), 24282::bigint, 'montant hors livraison, réduction déduite');
select is((select commission_cents from public.commission_code_promo where code_promo_id = (select code_id from cm)), 1213::bigint, 'commission arrondie au centime inférieur par Commande');

-- Annulation mixte de c2 (le Kit reste) et annulation puis remboursement en entier de c3 (cosplay seul).
select public.annuler_commande(pg_temp.adm(), (select c2 from cm));
select public.annuler_commande(pg_temp.adm(), (select c3 from cm));
-- Toutes les lignes de c3 sont annulées : la vente disparaît dès l'annulation (le remboursement suit forcément une annulation).
select is((select ventes from public.commission_code_promo where code_promo_id = (select code_id from cm)), 2, 'annulée, remboursement pas encore confirmé : c3 ne compte déjà plus');
select public.confirmer_remboursement(pg_temp.adm(), 'commande', (select c3 from cm), 'TEST-preuve-0003');
select is((select statut from public.commande where id = (select c3 from cm)), 'remboursee', 'c3 est remboursée en entier');
select is((select ventes from public.commission_code_promo where code_promo_id = (select code_id from cm)), 2, 'la Commande remboursée en entier ne compte plus ; la Commande mixte annulée garde son Kit');
select is((select montant_cents from public.commission_code_promo where code_promo_id = (select code_id from cm)), 10782::bigint, 'montant : c1 entière + ligne Kit de c2 (891)');
select is((select commission_cents from public.commission_code_promo where code_promo_id = (select code_id from cm)), 538::bigint, 'commission : 494 + 44');
select isnt((select commission_cents from public.commission_code_promo where code_promo_id = (select code_id from cm)), floor(10782 * 5 / 100.0)::bigint, 'arrondi par Commande, jamais sur le total (539)');

-- La Commande en attente c4 expire : elle ne compte toujours pas.
update public.commande set expire_le = now() - interval '1 minute' where id = (select c4 from cm);
select public.expirer_commandes_echues();
select is((select ventes from public.commission_code_promo where code_promo_id = (select code_id from cm)), 2, 'Commande expirée : non comptée');

-- Le taux du code change après les ventes : la commission due ne bouge pas (taux figé avec chaque Commande).
select public.modifier_code_promo(pg_temp.adm(), (select code_id from cm), 'TEST_Affilie', 10, 50, 50, true);
select is((select commission_cents from public.commission_code_promo where code_promo_id = (select code_id from cm)), 538::bigint, 'taux modifié après coup : commission inchangée');

-- Une nouvelle vente au nouveau taux (50 %) : chaque Commande garde son taux, le code additionne les deux (538 + 2 250).
create temp table cm5 as select pg_temp.commander('00000000-0000-0000-0000-0000000000b5', 1, false, 'COMM10', 'cle-cm-0005') as c5;
grant select on cm5 to public;
update public.commande set statut = 'payee', paye_le = now() where id = (select c5 from cm5);
select is((select commission_cents from public.commission_code_promo where code_promo_id = (select code_id from cm)), 2788::bigint, 'taux figés différents sur un même code : additionnés');

-- Code à 100 % avec livraison payée : la Commande est une vente, à 0 de montant et de commission.
select public.creer_code_promo(pg_temp.adm(), 'TOUT100', 'TEST_Affilie', 100, 10, 50, true);
create temp table cm6 as select pg_temp.commander('00000000-0000-0000-0000-0000000000b6', 1, false, 'TOUT100', 'cle-cm-0006') as c6;
grant select on cm6 to public;
update public.commande set statut = 'payee', paye_le = now() where id = (select c6 from cm6);
select is((select ventes from public.commission_code_promo where code_promo_id = (select id from public.code_promo where code = 'TOUT100')), 1, 'code à 100 % : la Commande payée (livraison) est une vente');
select is((select commission_cents from public.commission_code_promo where code_promo_id = (select id from public.code_promo where code = 'TOUT100')), 0::bigint, 'code à 100 % : 0 de commission');

-- Code sans vente.
select is((select ventes from public.commission_code_promo where code_promo_id = (select neuf_id from cm)), 0, 'code sans vente : 0 vente');
select is((select commission_cents from public.commission_code_promo where code_promo_id = (select neuf_id from cm)), 0::bigint, 'code sans vente : 0 de commission');

select * from finish();
rollback;
