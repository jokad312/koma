-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : creer_commande. Cas limite : sans Code promo (v_code jamais rempli). Panier d'un seul Kit : ni remise, ni téléphone, ni adresse.
-- Le total et l'empreinte attendus sont calculés ici, comme commande_calculer les calcule (empreinte = md5 de « ligne:nombre:origine:délai »),
-- sans appeler recapitulatif_commande : aucun appel préalable ne prépare commande_calculer dans cette session.
-- Ce fichier ne contient QU'UN appel de creer_commande (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(6);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-a1b060000001', 'test-a1bis-06@example.invalid', '{}');
-- Compte complet : âge déclaré, écrit directement (exiger_client lit profil.age_declare).
update public.profil set age_declare = 25, age_declare_le = now() where id = '00000000-0000-0000-0000-a1b060000001';
-- Délai de paiement : réglage posé ici, sans supposer celui de la base.
insert into public.reglage (cle, valeur) values ('delai_paiement', '30') on conflict (cle) do update set valeur = excluded.valeur;

insert into public.produit (id, famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('00000000-0000-4000-8000-a1b060000011', 'kit', 'test-a1bis-06-kit', 'TEST_Kit', 'TEST_Kit', 990, 'debutant', now() - interval '1 minute');
insert into public.panier (id, compte_id) values ('00000000-0000-4000-8000-a1b060000061', '00000000-0000-0000-0000-a1b060000001');
insert into public.ligne_panier (id, panier_id, produit_id, variante_id, nombre) values
  ('00000000-0000-4000-8000-a1b060000062', '00000000-0000-4000-8000-a1b060000061', '00000000-0000-4000-8000-a1b060000011', null, 1);

create temp table r as select public.creer_commande(
  '{"type":"compte","id":"00000000-0000-0000-0000-a1b060000001","role":null}'::jsonb,
  '00000000-0000-4000-8000-a1b060000061', null, null, null, null,
  '[{"objet":"cgv","version":"TEST_v1"},{"objet":"kit_acces_immediat","version":"TEST_v1"}]'::jsonb,
  null, 990, md5('00000000-0000-4000-8000-a1b060000062:1:-:0'), 'TEST-A1BIS-06-CLE', null
) as r;

select is((select r ->> 'rejeu' from r), 'false', 'premier appel de la session, sans Code promo : aucune erreur, Commande nouvelle');
select is(
  (select statut || '|' || type || '|' || total_cents::text || '|' || sous_total_cents::text || '|' || forfait_cents::text
   from public.commande where id = (select (r ->> 'commande_id')::uuid from r)),
  'en_attente|produits|990|990|0',
  'Commande créée en attente, total relu en base'
);
select is(
  (select numero from public.commande where id = (select (r ->> 'commande_id')::uuid from r)),
  (select r ->> 'numero' from r),
  'le numéro rendu est celui de la Commande'
);
select ok(
  (select expire_le > now() and origine is null from public.commande where id = (select (r ->> 'commande_id')::uuid from r)),
  'échéance future, aucune origine (ni code, ni origine transmise)'
);
select is(
  (select count(*)::int from public.ligne_commande
   where commande_id = (select (r ->> 'commande_id')::uuid from r) and produit_id = '00000000-0000-4000-8000-a1b060000011' and variante_id is null and nombre = 1 and reduction_cents = 0),
  1,
  'une ligne de Commande pour le Kit, sans réduction'
);
select is(
  (select count(*)::int from public.commande_code_promo where commande_id = (select (r ->> 'commande_id')::uuid from r)),
  0,
  'aucune ligne commande_code_promo'
);

select * from finish();
rollback;
