-- Story 6.5 : confirmer_mesures_recues. Seule la date est posee (aucune mesure stockee) ; personnel seulement ; ligne Sur-mesure d une Commande payee ;
-- une seconde confirmation est refusee ; avancer_statut refuse la fabrication tant que les mesures manquent, puis l accepte. Donnees TEST_ annulees.
begin;
select plan(11);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'test-me1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000c2', 'test-me2@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000c1', 'assistant');
create function pg_temp.ass() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000c1","role":"assistant"}'::jsonb $$;
create function pg_temp.faux() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000c2","role":"admin"}'::jsonb $$;

insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'me-cos', 'C', 'C', 5000, 14, now() - interval '1 minute');
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values
  ((select id from public.produit where slug = 'me-cos'), 'M', 5, false),
  ((select id from public.produit where slug = 'me-cos'), 'sur_mesure', 0, true);
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, paye_le) values
  ('00000000-0000-4000-8000-0000000000d1', 'KS-2026-840001', '00000000-0000-0000-0000-0000000000c2', 'produits', 'payee', 5000, 5000, now()),
  ('00000000-0000-4000-8000-0000000000d2', 'KS-2026-840002', '00000000-0000-0000-0000-0000000000c2', 'produits', 'en_attente', 5000, 5000, null);
insert into public.ligne_commande (id, commande_id, produit_id, variante_id, origine, nombre, prix_cents) values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-0000000000d1', (select id from public.produit where slug = 'me-cos'), (select id from public.variante where taille = 'sur_mesure' and produit_id = (select id from public.produit where slug = 'me-cos')), 'fabrication', 1, 5000),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000d1', (select id from public.produit where slug = 'me-cos'), (select id from public.variante where taille = 'M' and produit_id = (select id from public.produit where slug = 'me-cos')), 'stock', 1, 5000),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000d2', (select id from public.produit where slug = 'me-cos'), (select id from public.variante where taille = 'sur_mesure' and produit_id = (select id from public.produit where slug = 'me-cos')), 'fabrication', 1, 5000);

select throws_ok($$ select public.confirmer_mesures_recues(pg_temp.faux(), '00000000-0000-4000-8000-0000000000e1') $$, 'KS_DROIT_REFUSE', 'sans role en base : refuse');
select throws_ok($$ select public.confirmer_mesures_recues(pg_temp.ass(), '00000000-0000-4000-8000-0000000000ff') $$, 'KS_LIGNE_INTROUVABLE', 'ligne inconnue');
select throws_ok($$ select public.confirmer_mesures_recues(pg_temp.ass(), '00000000-0000-4000-8000-0000000000e2') $$, 'KS_PAS_SUR_MESURE', 'ligne en taille standard : refuse');
select throws_ok($$ select public.confirmer_mesures_recues(pg_temp.ass(), '00000000-0000-4000-8000-0000000000e3') $$, 'KS_TRANSITION_INTERDITE', 'Commande non payee : refuse');
select throws_ok($$ select public.avancer_statut(pg_temp.ass(), 'KS-2026-840001', 'en_fabrication') $$, 'KS_MESURES_NON_RECUES', 'fabrication refusee tant que les mesures manquent');
select lives_ok($$ select public.confirmer_mesures_recues(pg_temp.ass(), '00000000-0000-4000-8000-0000000000e1') $$, 'l assistant confirme la reception');
select ok((select mesures_recues_le is not null from public.ligne_commande where id = '00000000-0000-4000-8000-0000000000e1'), 'date de reception posee');
select ok(
  exists (select 1 from public.journal_audit where cible_table = 'ligne_commande' and cible_id = '00000000-0000-4000-8000-0000000000e1' and action = 'update' and auteur ->> 'id' = '00000000-0000-0000-0000-0000000000c1'),
  'confirmation journalisee avec son auteur'
);
select throws_ok($$ select public.confirmer_mesures_recues(pg_temp.ass(), '00000000-0000-4000-8000-0000000000e1') $$, 'KS_MESURES_DEJA_RECUES', 'seconde confirmation refusee');
select lives_ok($$ select public.avancer_statut(pg_temp.ass(), 'KS-2026-840001', 'en_fabrication') $$, 'fabrication acceptee une fois les mesures recues');
select is((select statut from public.commande where numero = 'KS-2026-840001'), 'en_fabrication', 'la Commande est en fabrication');

select * from finish();
rollback;
