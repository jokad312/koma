-- Story 6.3 : avancer_statut. Transitions autorisees seulement, jamais vers « payee », jamais en arriere ; expedition directe seulement pour des pieces
-- en stock ; numero de suivi facultatif et limite ; email planifie dans la meme transaction ; droit relu en base. Donnees TEST_ annulees a la fin.
begin;
select plan(22);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'test-av1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'test-av2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f3', 'test-av3@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 'assistant');
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb $$;
create function pg_temp.ass() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f2","role":"assistant"}'::jsonb $$;
create function pg_temp.faux() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f3","role":"admin"}'::jsonb $$;

insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'av-cos', 'C', 'C', 5000, 14, now() - interval '1 minute');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'av-kit', 'K', 'K', 500, 'debutant', now() - interval '1 minute');
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values
  ((select id from public.produit where slug = 'av-cos'), 'M', 5, false),
  ((select id from public.produit where slug = 'av-cos'), 'sur_mesure', 0, true);

-- e1 : piece en stock, payee ; e2 : piece fabriquee, payee ; e3 : Kit seul livre ; e4 : en attente ; e5 : sur mesure payee.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, paye_le) values
  ('00000000-0000-4000-8000-0000000000a1', 'KS-2026-830001', '00000000-0000-0000-0000-0000000000f3', 'produits', 'payee', 5000, 5000, now()),
  ('00000000-0000-4000-8000-0000000000a2', 'KS-2026-830002', '00000000-0000-0000-0000-0000000000f3', 'produits', 'payee', 5000, 5000, now()),
  ('00000000-0000-4000-8000-0000000000a3', 'KS-2026-830003', '00000000-0000-0000-0000-0000000000f3', 'produits', 'livree', 500, 500, now()),
  ('00000000-0000-4000-8000-0000000000a4', 'KS-2026-830004', '00000000-0000-0000-0000-0000000000f3', 'produits', 'en_attente', 5000, 5000, null),
  ('00000000-0000-4000-8000-0000000000a5', 'KS-2026-830005', '00000000-0000-0000-0000-0000000000f3', 'produits', 'payee', 5000, 5000, now());
insert into public.ligne_commande (id, commande_id, produit_id, variante_id, origine, nombre, prix_cents) values
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', (select id from public.produit where slug = 'av-cos'), (select id from public.variante where taille = 'M' and produit_id = (select id from public.produit where slug = 'av-cos')), 'stock', 1, 5000),
  ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a2', (select id from public.produit where slug = 'av-cos'), (select id from public.variante where taille = 'M' and produit_id = (select id from public.produit where slug = 'av-cos')), 'fabrication', 1, 5000),
  ('00000000-0000-4000-8000-0000000000b4', '00000000-0000-4000-8000-0000000000a4', (select id from public.produit where slug = 'av-cos'), (select id from public.variante where taille = 'M' and produit_id = (select id from public.produit where slug = 'av-cos')), 'stock', 1, 5000),
  ('00000000-0000-4000-8000-0000000000b5', '00000000-0000-4000-8000-0000000000a5', (select id from public.produit where slug = 'av-cos'), (select id from public.variante where taille = 'sur_mesure' and produit_id = (select id from public.produit where slug = 'av-cos')), 'fabrication', 1, 5000);
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents) values
  ('00000000-0000-4000-8000-0000000000a3', (select id from public.produit where slug = 'av-kit'), 1, 500);

-- Droit.
select throws_ok($$ select public.avancer_statut(pg_temp.faux(), 'KS-2026-830001', 'en_fabrication') $$, 'KS_DROIT_REFUSE', 'sans role en base : refuse');
select throws_ok($$ select public.avancer_statut(null, 'KS-2026-830001', 'en_fabrication') $$, 'KS_AUTEUR_MANQUANT', 'auteur absent : refuse');
select is((select statut from public.commande where numero = 'KS-2026-830001'), 'payee', 'les refus ne changent rien');

-- Jamais vers payee, offerte, echouee, expiree, annulee ; jamais en arriere.
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-830004', 'payee') $$, 'KS_TRANSITION_INTERDITE', 'vers payee : interdit (regle 2)');
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-830001', 'offerte') $$, 'KS_TRANSITION_INTERDITE', 'vers offerte : interdit');
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-830004', 'en_fabrication') $$, 'KS_TRANSITION_INTERDITE', 'depuis en_attente : interdit');
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-830003', 'livree') $$, 'KS_TRANSITION_INTERDITE', 'Kit seul : jamais avance a la main');

-- Expedition directe : stock oui, fabrication non.
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-830002', 'expediee') $$, 'KS_TRANSITION_INTERDITE', 'payee -> expediee refuse pour une piece fabriquee');
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-830001', 'livree') $$, 'KS_TRANSITION_INTERDITE', 'payee -> livree : interdit');
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-830001', 'expediee', repeat('x', 101)) $$, 'KS_SUIVI_INVALIDE', 'suivi trop long');
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-830002', 'en_fabrication', 'AB1') $$, 'KS_SUIVI_INVALIDE', 'suivi hors expedition');
select lives_ok($$ select public.avancer_statut(pg_temp.ass(), 'KS-2026-830001', 'expediee', '  AB 123/x  ') $$, 'piece en stock : payee -> expediee par un assistant');
select is((select numero_suivi from public.commande where numero = 'KS-2026-830001'), 'AB 123/x', 'suivi enregistre tel quel (espaces de bord retires)');
select ok((select expediee_le is not null from public.commande where numero = 'KS-2026-830001'), 'date d expedition posee');
select is((select count(*)::int from public.envoi where cle = 'commande_expediee:00000000-0000-4000-8000-0000000000a1'), 1, 'email planifie dans la meme transaction');
select lives_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-830001', 'livree') $$, 'expediee -> livree');
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-830001', 'expediee') $$, 'KS_TRANSITION_INTERDITE', 'aucun retour en arriere');

-- Fabrication, puis expedition ; sur mesure : mesures d abord.
select lives_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-830002', 'en_fabrication') $$, 'payee -> en_fabrication');
select is((select count(*)::int from public.envoi where cle = 'commande_en_fabrication:00000000-0000-4000-8000-0000000000a2'), 1, 'email en fabrication planifie');
select throws_ok($$ select public.avancer_statut(pg_temp.adm(), 'KS-2026-830005', 'en_fabrication') $$, 'KS_MESURES_NON_RECUES', 'sur mesure sans reception des mesures : refuse');
select is((select statut from public.commande where numero = 'KS-2026-830005'), 'payee', 'la Commande sur mesure reste payee');
select is((select count(*)::int from public.envoi where cle like 'commande_livree:%' and donnees ->> 'commande_id' = '00000000-0000-4000-8000-0000000000a3'), 0, 'un Kit seul ne recoit jamais commande_livree');

select * from finish();
rollback;
