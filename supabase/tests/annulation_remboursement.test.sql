-- Story 6.6 : demander_annulation, traiter_demande, annuler_commande, confirmer_remboursement (AD-27, AD-31). Montant fige = lignes physiques - reduction +
-- Forfait ; stock rendu ; Kit conserve ; preuve exigee ; Trop-percu clos par la meme fonction ; admin seulement. Donnees TEST_ annulees a la fin.
begin;
select plan(30);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-an1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-an2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a3', 'test-an3@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a2', 'assistant');
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb $$;
create function pg_temp.ass() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a2","role":"admin"}'::jsonb $$;

insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'an-cos', 'C', 'C', 5000, 14, now() - interval '1 minute'),
  ('accessoire', 'an-acc', 'A', 'A', 1000, 3, now() - interval '1 minute');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'an-kit', 'K', 'K', 500, 'debutant', now() - interval '1 minute');
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values
  ((select id from public.produit where slug = 'an-cos'), 'M', 4, false),
  ((select id from public.produit where slug = 'an-acc'), 'S', 7, false);

-- k1 : cosplay stock (2 x 5000 - 300) + accessoire (1 x 1000) + Kit + forfait 200, payee, compte a3 ; k2 : en fabrication ; k3 : Kit seul ;
-- k4 : meme profil que k1, pour le refus ; k5 : annulee, remboursement a confirmer.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, forfait_cents, paye_le) values
  ('00000000-0000-4000-8000-0000000000f1', 'KS-2026-850001', '00000000-0000-0000-0000-0000000000a3', 'produits', 'payee', 11200, 11400, 200, now()),
  ('00000000-0000-4000-8000-0000000000f2', 'KS-2026-850002', '00000000-0000-0000-0000-0000000000a3', 'produits', 'en_fabrication', 5000, 5000, 0, now()),
  ('00000000-0000-4000-8000-0000000000f3', 'KS-2026-850003', '00000000-0000-0000-0000-0000000000a3', 'produits', 'payee', 500, 500, 0, now()),
  ('00000000-0000-4000-8000-0000000000f4', 'KS-2026-850004', '00000000-0000-0000-0000-0000000000a3', 'produits', 'payee', 5000, 5000, 0, now());
insert into public.ligne_commande (id, commande_id, produit_id, variante_id, origine, nombre, prix_cents, reduction_cents) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000f1', (select id from public.produit where slug = 'an-cos'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'an-cos')), 'stock', 2, 5000, 300),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000f1', (select id from public.produit where slug = 'an-acc'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'an-acc')), 'stock', 1, 1000, 0),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000f2', (select id from public.produit where slug = 'an-cos'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'an-cos')), 'stock', 1, 5000, 0),
  ('00000000-0000-4000-8000-0000000000e5', '00000000-0000-4000-8000-0000000000f4', (select id from public.produit where slug = 'an-cos'), (select id from public.variante where produit_id = (select id from public.produit where slug = 'an-cos')), 'stock', 1, 5000, 0);
update public.ligne_commande set stock_retire = nombre where id in ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000e2');
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents) values
  ('00000000-0000-4000-8000-0000000000f1', (select id from public.produit where slug = 'an-kit'), 1, 500),
  ('00000000-0000-4000-8000-0000000000f3', (select id from public.produit where slug = 'an-kit'), 1, 500);

-- Tables fermees aux clients.
select ok((select relrowsecurity from pg_class where oid = 'public.demande_client'::regclass) and (select relrowsecurity from pg_class where oid = 'public.remboursement'::regclass), 'RLS active sur demande_client et remboursement');
select is((select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and table_name in ('demande_client', 'remboursement') and lower(grantee) in ('anon', 'authenticated', 'public')), 0, 'aucun droit client sur les deux tables');
select is(
  (select array_agg(f order by f) from unnest(array[
    'public.demander_annulation(uuid, text)', 'public.annuler_commande(jsonb, uuid)', 'public.traiter_demande(jsonb, uuid, text)', 'public.confirmer_remboursement(jsonb, text, uuid, text)'
  ]) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or not has_function_privilege('service_role', f, 'execute')),
  null,
  'les quatre fonctions : service seulement'
);

-- Demande du client.
select throws_ok($$ select public.demander_annulation('00000000-0000-0000-0000-0000000000a1', 'KS-2026-850001') $$, 'KS_COMMANDE_INTROUVABLE', 'la Commande d un autre Compte est introuvable');
select throws_ok($$ select public.demander_annulation('00000000-0000-0000-0000-0000000000a3', 'KS-2026-850002') $$, 'KS_ANNULATION_IMPOSSIBLE', 'en fabrication : impossible');
select throws_ok($$ select public.demander_annulation('00000000-0000-0000-0000-0000000000a3', 'KS-2026-850003') $$, 'KS_ANNULATION_IMPOSSIBLE', 'Kit seul (sans Cosplay) : impossible');
select lives_ok($$ select public.demander_annulation('00000000-0000-0000-0000-0000000000a3', 'KS-2026-850001') $$, 'demande d annulation ouverte');
select throws_ok($$ select public.demander_annulation('00000000-0000-0000-0000-0000000000a3', 'KS-2026-850001') $$, 'KS_DEMANDE_EN_COURS', 'une seule demande en cours');
select is((select statut from public.commande where numero = 'KS-2026-850001'), 'payee', 'la demande n annule rien');
select lives_ok($$ select public.demander_annulation('00000000-0000-0000-0000-0000000000a3', 'KS-2026-850004') $$, 'seconde demande (pour le refus)');

-- Traitement : admin seulement.
select throws_ok($$ select public.traiter_demande(pg_temp.ass(), (select id from public.demande_client where commande_id = '00000000-0000-4000-8000-0000000000f1'), 'accepter') $$, 'KS_DROIT_REFUSE', 'un assistant ne traite pas une demande d annulation');
select throws_ok($$ select public.traiter_demande(pg_temp.adm(), (select id from public.demande_client where commande_id = '00000000-0000-4000-8000-0000000000f1'), 'peut-etre') $$, 'KS_DECISION_INVALIDE', 'decision invalide');
select lives_ok($$ select public.traiter_demande(pg_temp.adm(), (select id from public.demande_client where commande_id = '00000000-0000-4000-8000-0000000000f4'), 'refuser') $$, 'refus');
select is((select statut from public.commande where numero = 'KS-2026-850004'), 'payee', 'refus : la Commande ne change pas');
select is((select statut from public.demande_client where commande_id = '00000000-0000-4000-8000-0000000000f4'), 'refusee', 'refus : demande refusee');

-- Acceptation : annulation, stock rendu, montant fige, Kit conserve.
select lives_ok($$ select public.traiter_demande(pg_temp.adm(), (select id from public.demande_client where commande_id = '00000000-0000-4000-8000-0000000000f1'), 'accepter') $$, 'acceptation');
select is((select statut from public.commande where numero = 'KS-2026-850001'), 'annulee', 'Commande annulee');
select is((select montant_cents from public.remboursement where cible_type = 'commande' and cible_id = '00000000-0000-4000-8000-0000000000f1'), 10900::bigint, 'montant a rendre : (2 x 5000 - 300) + 1000 + forfait 200');
select is((select stock from public.variante where produit_id = (select id from public.produit where slug = 'an-cos')), 6, 'stock du cosplay rendu (4 + 2)');
select is((select count(*)::int from public.ligne_commande where commande_id = '00000000-0000-4000-8000-0000000000f1' and annulee), 2, 'les deux lignes physiques sont annulees');
select is((select count(*)::int from public.ligne_commande where commande_id = '00000000-0000-4000-8000-0000000000f1' and not annulee), 1, 'la ligne Kit n est pas annulee');
select is((select count(*)::int from public.envoi where cle = 'commande_annulee:00000000-0000-4000-8000-0000000000f1'), 1, 'email d annulation planifie');
select throws_ok($$ select public.traiter_demande(pg_temp.adm(), (select id from public.demande_client where commande_id = '00000000-0000-4000-8000-0000000000f1'), 'accepter') $$, 'KS_DEMANDE_DEJA_TRAITEE', 'une demande ne se traite qu une fois');

-- Remboursement : preuve exigee, admin seulement.
select throws_ok($$ select public.confirmer_remboursement(pg_temp.adm(), 'commande', '00000000-0000-4000-8000-0000000000f1', '  ') $$, 'KS_PREUVE_REQUISE', 'sans preuve : refuse');
select is((select statut from public.commande where numero = 'KS-2026-850001'), 'annulee', 'sans preuve, la Commande reste annulee');
select throws_ok($$ select public.confirmer_remboursement(pg_temp.ass(), 'commande', '00000000-0000-4000-8000-0000000000f1', 'VIR-TEST-1') $$, 'KS_DROIT_REFUSE', 'un assistant ne valide pas un remboursement');
select lives_ok($$ select public.confirmer_remboursement(pg_temp.adm(), 'commande', '00000000-0000-4000-8000-0000000000f1', 'VIR-TEST-1') $$, 'remboursement confirme avec preuve');
select is((select statut from public.commande where numero = 'KS-2026-850001'), 'remboursee', 'Commande remboursee');
select is((select statut from public.demande_client where commande_id = '00000000-0000-4000-8000-0000000000f1'), 'close', 'demande close');
select throws_ok($$ select public.confirmer_remboursement(pg_temp.adm(), 'commande', '00000000-0000-4000-8000-0000000000f1', 'VIR-TEST-2') $$, 'KS_REMBOURSEMENT_IMPOSSIBLE', 'pas de second remboursement');

select * from finish();
rollback;
