-- Story 4.1 : Panier sans compte. Tables panier et ligne_panier (RLS, aucun droit client), fonctions creer_panier, ajouter_au_panier,
-- modifier_ligne_panier, retirer_ligne_panier, lire_panier, compter_panier (service seulement). Prix, disponibilité et délai relus à chaque lecture.
-- Données créées dans la transaction, puis annulées.
begin;
select plan(45);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'test-pn1@example.invalid', '{}');
create function pg_temp.vis() returns jsonb language sql as $$ select '{"type":"visiteur"}'::jsonb $$;

insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'pn-cosplay', 'Cosplay', 'Cosplay', 5000, 14, now() - interval '1 minute');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'pn-kit', 'Kit', 'Kit', 990, 'debutant', now() - interval '1 minute'),
  ('kit', 'pn-gratuit', 'Gratuit', 'Free', 0, 'debutant', now() - interval '1 minute');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, publie_le) values
  ('cosplay', 'pn-brouillon', 'Brouillon', 'Draft', 4000, null);
create temp table pn as
  select (select id from public.produit where slug = 'pn-cosplay') as cos,
         (select id from public.produit where slug = 'pn-kit') as kit,
         (select id from public.produit where slug = 'pn-gratuit') as gratuit,
         (select id from public.produit where slug = 'pn-brouillon') as brouillon;
grant select on pn to public;
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values
  ((select cos from pn), 'M', 20, false),
  ((select cos from pn), 'L', 0, true),
  ((select cos from pn), 'S', 0, false),
  ((select cos from pn), 'XS', 2, false);
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values
  ((select brouillon from pn), 'M', 5, false);
create temp table pp as select public.creer_panier(pg_temp.vis()) as id;
create temp table pp2 as select public.creer_panier(pg_temp.vis()) as id;
grant select on pp2 to public;
grant select on pp to public;

-- Tables, RLS, droits.
select has_table('public', 'panier', 'la table panier existe');
select has_table('public', 'ligne_panier', 'la table ligne_panier existe');
select ok((select bool_and(relrowsecurity) from pg_class where oid in ('public.panier'::regclass, 'public.ligne_panier'::regclass)), 'RLS active sur les deux tables');
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('panier', 'ligne_panier') and lower(grantee) in ('anon', 'authenticated', 'public')),
  0,
  'aucun droit pour anon, authenticated ni public : le navigateur ne lit ni n''écrit le Panier'
);
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('panier', 'ligne_panier')), 0, 'aucune politique');
select is(
  (select count(*)::int from unnest(array[
    'public.creer_panier(jsonb)', 'public.ajouter_au_panier(jsonb, uuid, uuid, uuid, text, integer)', 'public.modifier_ligne_panier(jsonb, uuid, uuid, integer)',
    'public.retirer_ligne_panier(jsonb, uuid, uuid)', 'public.lire_panier(uuid)', 'public.compter_panier(uuid)'
  ]) f where not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute')),
  6,
  'les six fonctions du Panier : service seulement'
);
select ok(
  (select count(*) = 6 and bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where pronamespace = 'public'::regnamespace and proname in ('creer_panier', 'ajouter_au_panier', 'modifier_ligne_panier', 'retirer_ligne_panier', 'lire_panier', 'compter_panier')),
  'security definer, search_path vide'
);
select throws_ok($$select public.creer_panier(null)$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'creer_panier sans auteur : refusé');
select throws_ok($$select public.ajouter_au_panier(null, (select id from pp), null, (select cos from pn), 'M', 1)$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'ajouter sans auteur : refusé');

-- Ajout d'un produit physique, cumul de la même ligne.
select is((public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select cos from pn), 'M', 2) ->> 'nombre')::int, 2, 'premier ajout : 2 exemplaires');
select is((public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select cos from pn), 'M', 3) ->> 'nombre')::int, 5, 'même taille : les nombres se cumulent');
select is((select count(*)::int from public.ligne_panier), 1, 'une seule ligne par produit et taille');
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select cos from pn), 'M', 6)$$, 'P0001', 'KS_QUANTITE_INVALIDE', 'au-delà de 10 exemplaires : refusé');
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select cos from pn), 'M', 0)$$, 'P0001', 'KS_QUANTITE_INVALIDE', 'zéro exemplaire : refusé');
select lives_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select cos from pn), 'L', 1)$$, 'taille sur commande : ajoutée');
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select cos from pn), 'S', 1)$$, 'P0001', 'KS_INDISPONIBLE', 'taille épuisée : refusée');
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select cos from pn), 'M', 10)$$, 'P0001', 'KS_QUANTITE_INVALIDE', 'cumul au-delà de 10 : refusé');
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select cos from pn), 'XS', 3)$$, 'P0001', 'KS_INDISPONIBLE', 'quantité au-delà du stock d''une taille non fabriquée sur commande : refusée');
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select cos from pn), 'XL', 1)$$, 'P0001', 'KS_VARIANTE_INTROUVABLE', 'taille inconnue : refusée');
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select cos from pn), null, 1)$$, 'P0001', 'KS_VARIANTE_INTROUVABLE', 'produit physique sans taille : refusé');
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select brouillon from pn), 'M', 1)$$, 'P0001', 'KS_PRODUIT_INTROUVABLE', 'produit non publié : introuvable');
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, gen_random_uuid(), 'M', 1)$$, 'P0001', 'KS_PRODUIT_INTROUVABLE', 'produit inconnu : introuvable');
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), gen_random_uuid(), null, (select cos from pn), 'M', 1)$$, 'P0001', 'KS_PANIER_INTROUVABLE', 'Panier inconnu : refusé');

-- Kit : un seul exemplaire, gratuit refusé, déjà possédé refusé.
select is((public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select kit from pn), null, 1) ->> 'nombre')::int, 1, 'Kit : un exemplaire');
select is((public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select kit from pn), null, 1) ->> 'nombre')::int, 1, 'second ajout du même Kit : sans effet, toujours un exemplaire');
select is((select count(*)::int from public.ligne_panier where produit_id = (select kit from pn)), 1, 'une seule ligne de Kit');
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select kit from pn), 'M', 1)$$, 'P0001', 'KS_VARIANTE_INVALIDE', 'un Kit n''a pas de taille');
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select id from pp), null, (select gratuit from pn), null, 1)$$, 'P0001', 'KS_PRODUIT_GRATUIT', 'le Kit gratuit ne se met pas au Panier (0 USD)');
insert into public.commande (compte_id, type, statut, sous_total_cents, total_cents) values ('00000000-0000-0000-0000-0000000000d1', 'produits', 'livree', 990, 990);
insert into public.acces_kit (compte_id, produit_id, commande_origine) values ('00000000-0000-0000-0000-0000000000d1', (select kit from pn), (select id from public.commande));
select throws_ok($$select public.ajouter_au_panier(pg_temp.vis(), (select id from pp), '00000000-0000-0000-0000-0000000000d1', (select kit from pn), null, 1)$$, 'P0001', 'KS_KIT_DEJA_POSSEDE', 'un Kit déjà possédé par le Compte connecté est refusé');

-- Lecture : tout est relu en base.
select is(public.compter_panier((select id from pp)), 7, 'compter_panier : 5 + 1 + 1 articles');
select is(public.compter_panier(gen_random_uuid()), 0, 'Panier inconnu : 0 article');
select is((select count(*)::int from public.lire_panier((select id from pp))), 3, 'lire_panier : trois lignes');
select is((select delai_jours from public.lire_panier((select id from pp)) where taille = 'L'), 14, 'délai de fabrication relu pour une taille sur commande');
select is((select etat from public.lire_panier((select id from pp)) where taille = 'L'), 'sur_commande', 'état sur_commande relu');
-- Modification (avant tout changement du produit) : quantité, limites, stock, ligne d'un autre Panier.
select throws_ok($$select public.modifier_ligne_panier(pg_temp.vis(), (select id from pp), (select id from public.ligne_panier where produit_id = (select kit from pn)), 2)$$, 'P0001', 'KS_LIGNE_UNIQUE', 'une ligne de Kit n''a pas de quantité');
select lives_ok($$select public.modifier_ligne_panier(pg_temp.vis(), (select id from pp), (select id from public.ligne_panier where produit_id = (select cos from pn) and nombre = 5), 3)$$, 'quantité modifiée');
select throws_ok($$select public.modifier_ligne_panier(pg_temp.vis(), (select id from pp), (select id from public.ligne_panier where produit_id = (select cos from pn) and nombre = 3), 11)$$, 'P0001', 'KS_QUANTITE_INVALIDE', 'quantité de 11 : refusée');
select throws_ok($$select public.modifier_ligne_panier(pg_temp.vis(), (select id from pp2), (select id from public.ligne_panier where produit_id = (select cos from pn) and nombre = 3), 2)$$, 'P0001', 'KS_LIGNE_INTROUVABLE', 'modifier la ligne d''un autre Panier : refusé');
select throws_ok($$select public.retirer_ligne_panier(pg_temp.vis(), (select id from pp2), (select id from public.ligne_panier where produit_id = (select cos from pn) and nombre = 3))$$, 'P0001', 'KS_LIGNE_INTROUVABLE', 'retirer la ligne d''un autre Panier : refusé');

select is((select prix_cents from public.lire_panier((select id from pp)) where taille = 'M'), 5000, 'prix relu en base');
update public.produit set prix_cents = 6000 where id = (select cos from pn);
select is((select prix_cents from public.lire_panier((select id from pp)) where taille = 'M'), 6000, 'un prix modifié est relu : le Panier ne fige rien');
update public.produit set publie_le = null where id = (select cos from pn);
select is((select count(*)::int from public.lire_panier((select id from pp)) where etat = 'epuise'), 2, 'produit dépublié : ses lignes passent « epuise » (Plus disponible)');
select throws_ok($$select public.modifier_ligne_panier(pg_temp.vis(), (select id from pp), (select id from public.ligne_panier where produit_id = (select cos from pn) and nombre = 3), 2)$$, 'P0001', 'KS_INDISPONIBLE', 'modifier la quantité d''un produit dépublié : refusé');

-- Retrait.
select lives_ok($$select public.retirer_ligne_panier(pg_temp.vis(), (select id from pp), (select id from public.ligne_panier where produit_id = (select kit from pn)))$$, 'ligne retirée');
select throws_ok($$select public.retirer_ligne_panier(pg_temp.vis(), (select id from pp), gen_random_uuid())$$, 'P0001', 'KS_LIGNE_INTROUVABLE', 'retirer une ligne inconnue : refusé');

select * from finish();
rollback;
