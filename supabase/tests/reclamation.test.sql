-- Story 6.7 : lignes_reclamables (48 h, famille, taille, Commande livree), signaler_probleme (description obligatoire, une seule en cours par ligne),
-- traiter_reclamation (accepter -> article_rendu -> remplacement_remis ou refuser, admin seulement, stock decompte, Commande inchangee).
-- Donnees TEST_ annulees a la fin.
begin;
select plan(23);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-re1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-re2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-re3@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a2', 'assistant');
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb $$;
create function pg_temp.ass() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a2","role":"admin"}'::jsonb $$;

insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 're-cos', 'C', 'C', 5000, 14, now() - interval '1 minute'),
  ('accessoire', 're-acc', 'A', 'A', 1000, 3, now() - interval '1 minute');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 're-kit', 'K', 'K', 500, 'debutant', now() - interval '1 minute');
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values
  ((select id from public.produit where slug = 're-cos'), 'M', 3, false),
  ((select id from public.produit where slug = 're-cos'), 'sur_mesure', 0, true),
  ((select id from public.produit where slug = 're-acc'), 'U', 5, false);

-- g1 : livree il y a 1 h (accessoire, cosplay M, cosplay sur mesure, Kit) ; g2 : livree il y a 3 jours ; g3 : en attente ; g4 : livree d un autre Compte.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, paye_le, livree_le) values
  ('00000000-0000-4000-8000-0000000000f1', 'KS-2026-860001', '00000000-0000-0000-0000-0000000000a3', 'produits', 'livree', 11500, 11500, now() - interval '2 days', now() - interval '1 hour'),
  ('00000000-0000-4000-8000-0000000000f2', 'KS-2026-860002', '00000000-0000-0000-0000-0000000000a3', 'produits', 'livree', 1000, 1000, now() - interval '5 days', now() - interval '3 days'),
  ('00000000-0000-4000-8000-0000000000f3', 'KS-2026-860003', '00000000-0000-0000-0000-0000000000a3', 'produits', 'en_attente', 1000, 1000, null, null);
insert into public.ligne_commande (id, commande_id, produit_id, variante_id, origine, nombre, prix_cents) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000f1', (select id from public.produit where slug = 're-acc'), (select id from public.variante where taille = 'U' and produit_id = (select id from public.produit where slug = 're-acc')), 'stock', 1, 1000),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000f1', (select id from public.produit where slug = 're-cos'), (select id from public.variante where taille = 'M' and produit_id = (select id from public.produit where slug = 're-cos')), 'stock', 1, 5000),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000f1', (select id from public.produit where slug = 're-cos'), (select id from public.variante where taille = 'sur_mesure' and produit_id = (select id from public.produit where slug = 're-cos')), 'fabrication', 1, 5000),
  ('00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-0000000000f2', (select id from public.produit where slug = 're-acc'), (select id from public.variante where taille = 'U' and produit_id = (select id from public.produit where slug = 're-acc')), 'stock', 1, 1000),
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-0000000000f3', (select id from public.produit where slug = 're-acc'), (select id from public.variante where taille = 'U' and produit_id = (select id from public.produit where slug = 're-acc')), 'stock', 1, 1000);
insert into public.ligne_commande (id, commande_id, produit_id, nombre, prix_cents) values
  ('00000000-0000-4000-8000-0000000000e6', '00000000-0000-4000-8000-0000000000f1', (select id from public.produit where slug = 're-kit'), 1, 500);

-- Lignes reclamables.
select is((select array_agg(ligne_id order by ligne_id) from public.lignes_reclamables('00000000-0000-0000-0000-0000000000a3', 'KS-2026-860001')),
  array['00000000-0000-4000-8000-0000000000e1'::uuid, '00000000-0000-4000-8000-0000000000e2'::uuid], 'accessoire et cosplay en taille standard seulement (ni Sur-mesure ni Kit)');
select is((select count(*)::int from public.lignes_reclamables('00000000-0000-0000-0000-0000000000a3', 'KS-2026-860002')), 0, 'au-dela de 48 h : rien');
select is((select count(*)::int from public.lignes_reclamables('00000000-0000-0000-0000-0000000000a3', 'KS-2026-860003')), 0, 'Commande non livree : rien');
select is((select count(*)::int from public.lignes_reclamables('00000000-0000-0000-0000-0000000000a1', 'KS-2026-860001')), 0, 'Commande d un autre Compte : rien');

-- Signalement.
select throws_ok($$ select public.signaler_probleme('00000000-0000-0000-0000-0000000000a3', 'KS-2026-860001', '00000000-0000-4000-8000-0000000000e1', '   ') $$, 'KS_DESCRIPTION_REQUISE', 'description obligatoire');
select throws_ok($$ select public.signaler_probleme('00000000-0000-0000-0000-0000000000a3', 'KS-2026-860001', '00000000-0000-4000-8000-0000000000e3', 'Trop grand') $$, 'KS_RECLAMATION_IMPOSSIBLE', 'ligne Sur-mesure : impossible');
select throws_ok($$ select public.signaler_probleme('00000000-0000-0000-0000-0000000000a3', 'KS-2026-860001', '00000000-0000-4000-8000-0000000000e6', 'Kit abime') $$, 'KS_RECLAMATION_IMPOSSIBLE', 'Kit : impossible');
select throws_ok($$ select public.signaler_probleme('00000000-0000-0000-0000-0000000000a3', 'KS-2026-860002', '00000000-0000-4000-8000-0000000000e4', 'Trop tard') $$, 'KS_RECLAMATION_IMPOSSIBLE', 'apres 48 h : impossible');
select throws_ok($$ select public.signaler_probleme('00000000-0000-0000-0000-0000000000a1', 'KS-2026-860001', '00000000-0000-4000-8000-0000000000e1', 'Pas a moi') $$, 'KS_COMMANDE_INTROUVABLE', 'Commande d un autre Compte : introuvable');
select lives_ok($$ select public.signaler_probleme('00000000-0000-0000-0000-0000000000a3', 'KS-2026-860001', '00000000-0000-4000-8000-0000000000e1', 'Fermoir casse') $$, 'reclamation ouverte');
select is((select statut from public.commande where numero = 'KS-2026-860001'), 'livree', 'la Commande reste livree');
select is((select count(*)::int from public.lignes_reclamables('00000000-0000-0000-0000-0000000000a3', 'KS-2026-860001')), 1, 'la ligne reclamee n est plus proposee');
select throws_ok($$ select public.signaler_probleme('00000000-0000-0000-0000-0000000000a3', 'KS-2026-860001', '00000000-0000-4000-8000-0000000000e1', 'Encore') $$, 'KS_RECLAMATION_IMPOSSIBLE', 'une seule reclamation en cours par ligne');

-- Traitement.
select throws_ok($$ select public.traiter_reclamation(pg_temp.ass(), (select id from public.demande_client where type = 'reclamation' limit 1), 'accepter') $$, 'KS_DROIT_REFUSE', 'un assistant ne traite pas une reclamation');
select throws_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where type = 'reclamation' limit 1), 'article_rendu') $$, 'KS_DEMANDE_DEJA_TRAITEE', 'pas d etape sautee');
select lives_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where type = 'reclamation' limit 1), 'accepter') $$, 'acceptation');
select lives_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where type = 'reclamation' limit 1), 'article_rendu') $$, 'article rendu');
select is((select stock from public.variante where taille = 'U' and produit_id = (select id from public.produit where slug = 're-acc')), 5, 'le stock n a pas bouge avant le remplacement');
select lives_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where type = 'reclamation' limit 1), 'remplacement_remis', true) $$, 'remplacement remis, pris en stock');
select is((select stock from public.variante where taille = 'U' and produit_id = (select id from public.produit where slug = 're-acc')), 4, 'remplacement pris en stock : stock decompte');
select is((select statut from public.demande_client where type = 'reclamation' limit 1), 'remplacement_remis', 'etat final');
select throws_ok($$ select public.traiter_reclamation(pg_temp.adm(), (select id from public.demande_client where type = 'reclamation' limit 1), 'refuser') $$, 'KS_DEMANDE_DEJA_TRAITEE', 'aucune etape apres le remplacement remis');
select is((select count(*)::int from public.remboursement), 0, 'aucun remboursement n est cree par une reclamation');

select * from finish();
rollback;
