-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : creer_commande_pass. Cas limite : sans Code promo (v_code jamais rempli). Un Pass simple, un titulaire.
-- Ce fichier ne contient QU'UN appel de creer_commande_pass (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(5);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-a1b070000001', 'test-a1bis-07@example.invalid', '{}');
-- Compte complet : âge déclaré, écrit directement (exiger_client lit profil.age_declare).
update public.profil set age_declare = 25, age_declare_le = now() where id = '00000000-0000-0000-0000-a1b070000001';
-- Délai de paiement : réglage posé ici, sans supposer celui de la base.
insert into public.reglage (cle, valeur) values ('delai_paiement', '30') on conflict (cle) do update set valeur = excluded.valeur;

-- Événement publié, vente ouverte (pas de dates de vente : ouverture à la publication, fermeture au début), sans capacité ; Type sans quota.
insert into public.evenement (id, auteur_id, titre_fr, slug, publie_le, debut_le, capacite) values
  ('00000000-0000-4000-8000-a1b070000071', '00000000-0000-0000-0000-a1b070000001', 'TEST_Festival', 'test-a1bis-07-ev', now() - interval '2 days', now() + interval '30 days', null);
insert into public.type_pass (id, evenement_id, nom_fr, nom_en, prix_cents, est_stand) values
  ('00000000-0000-4000-8000-a1b070000081', '00000000-0000-4000-8000-a1b070000071', 'TEST_Simple', 'TEST_Simple', 1500, false);

create temp table r as select public.creer_commande_pass(
  '{"type":"compte","id":"00000000-0000-0000-0000-a1b070000001","role":null}'::jsonb,
  '00000000-0000-4000-8000-a1b070000071',
  '[{"type_pass_id":"00000000-0000-4000-8000-a1b070000081","titulaires":["Alice Test"]}]'::jsonb,
  '[{"objet":"pass_photos_video","version":"TEST_v1"}]'::jsonb,
  1500, 'TEST-A1BIS-07-CLE', null, null
) as r;

select is((select r ->> 'rejeu' from r), 'false', 'premier appel de la session, sans Code promo : aucune erreur, Commande nouvelle');
select is(
  (select statut || '|' || type || '|' || total_cents::text || '|' || sous_total_cents::text || '|' || forfait_cents::text
   from public.commande where id = (select (r ->> 'commande_id')::uuid from r)),
  'en_attente|pass|1500|1500|0',
  'Commande de Pass créée en attente, total relu en base'
);
select ok(
  (select expire_le > now() and origine is null from public.commande where id = (select (r ->> 'commande_id')::uuid from r)),
  'échéance future, aucune origine (ni code, ni origine transmise)'
);
select is(
  (select count(*)::int from public.ligne_commande
   where commande_id = (select (r ->> 'commande_id')::uuid from r) and type_pass_id = '00000000-0000-4000-8000-a1b070000081'
     and nombre = 1 and titulaires = '["Alice Test"]'::jsonb and reduction_cents = 0),
  1,
  'une ligne de Pass, le titulaire figé, sans réduction'
);
select is(
  (select count(*)::int from public.commande_code_promo where commande_id = (select (r ->> 'commande_id')::uuid from r)),
  0,
  'aucune ligne commande_code_promo'
);

select * from finish();
rollback;
