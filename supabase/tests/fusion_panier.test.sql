-- Story 4.2 : fusion du Panier à la connexion. Rattachement, réunion avec le Panier du Compte (un Kit une seule fois, quantités additionnées),
-- Kit déjà possédé retiré avec annonce, Panier d'un autre Compte ignoré, rejeu sans effet, droits. Données créées dans la transaction, puis annulées.
begin;
select plan(26);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'test-fu1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'test-fu2@example.invalid', '{}');
create function pg_temp.vis() returns jsonb language sql as $$ select '{"type":"visiteur"}'::jsonb $$;
create function pg_temp.c1() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":null}'::jsonb $$;
create function pg_temp.c2() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000d2","role":null}'::jsonb $$;

insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('cosplay', 'fu-cos', 'C', 'C', 5000, 14, now() - interval '1 minute');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'fu-kit', 'K', 'K', 990, 'debutant', now() - interval '1 minute'),
  ('kit', 'fu-kit2', 'K2', 'K2', 990, 'debutant', now() - interval '1 minute');
create temp table fu as
  select (select id from public.produit where slug = 'fu-cos') as cos,
         (select id from public.produit where slug = 'fu-kit') as kit,
         (select id from public.produit where slug = 'fu-kit2') as kit2;
grant select on fu to public;
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande) values ((select cos from fu), 'M', 50, false);

create temp table p1 as select public.creer_panier(pg_temp.vis()) as id;
create temp table p2 as select public.creer_panier(pg_temp.vis()) as id;
create temp table p3 as select public.creer_panier(pg_temp.vis()) as id;
create temp table p4 as select public.creer_panier(pg_temp.vis()) as id;
grant select on p1, p2, p3, p4 to public;

-- Droits.
select is(
  (select count(*)::int from unnest(array['public.fusionner_panier(jsonb, uuid, uuid)', 'public.avis_kit_possede(uuid)']) f
   where not has_function_privilege('anon', f, 'execute') and not has_function_privilege('authenticated', f, 'execute') and has_function_privilege('service_role', f, 'execute')),
  2,
  'fusionner_panier et avis_kit_possede : service seulement'
);
select ok(
  (select count(*) = 2 and bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where pronamespace = 'public'::regnamespace and proname in ('fusionner_panier', 'avis_kit_possede')),
  'security definer, search_path vide'
);
select throws_ok($$select public.fusionner_panier(null, '00000000-0000-0000-0000-0000000000d1', (select id from p1))$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'sans auteur : refusé');
select throws_ok($$select public.fusionner_panier(pg_temp.c1(), gen_random_uuid(), (select id from p1))$$, 'P0001', 'KS_COMPTE_INTROUVABLE', 'Compte inconnu : refusé');

-- Compte sans Panier : le Panier du visiteur lui est rattaché.
select public.ajouter_au_panier(pg_temp.vis(), (select id from p1), null, (select cos from fu), 'M', 2);
select public.ajouter_au_panier(pg_temp.vis(), (select id from p1), null, (select kit from fu), null, 1);
create temp table r1 as select public.fusionner_panier(pg_temp.c1(), '00000000-0000-0000-0000-0000000000d1', (select id from p1)) as r;
grant select on r1 to public;
select is((select (r ->> 'panier_id')::uuid from r1), (select id from p1), 'le Panier du visiteur devient celui du Compte');
select is((select (r ->> 'retires')::int from r1), 0, 'aucun Kit retiré');
select is((select compte_id from public.panier where id = (select id from p1)), '00000000-0000-0000-0000-0000000000d1'::uuid, 'Panier rattaché au Compte');
select is(public.compter_panier((select id from p1)), 3, 'les lignes sont conservées');

-- Rejeu : sans effet.
select is((public.fusionner_panier(pg_temp.c1(), '00000000-0000-0000-0000-0000000000d1', (select id from p1)) ->> 'panier_id')::uuid, (select id from p1), 'second appel : même Panier');
select is(public.compter_panier((select id from p1)), 3, 'second appel : rien ne change');

-- Compte avec Panier : réunion, Kit une seule fois, quantités additionnées.
select public.ajouter_au_panier(pg_temp.vis(), (select id from p2), null, (select cos from fu), 'M', 3);
select public.ajouter_au_panier(pg_temp.vis(), (select id from p2), null, (select kit from fu), null, 1);
select public.ajouter_au_panier(pg_temp.vis(), (select id from p2), null, (select kit2 from fu), null, 1);
create temp table r2 as select public.fusionner_panier(pg_temp.c1(), '00000000-0000-0000-0000-0000000000d1', (select id from p2)) as r;
grant select on r2 to public;
select is((select (r ->> 'panier_id')::uuid from r2), (select id from p1), 'le Panier du Compte est conservé');
select is((select count(*)::int from public.panier where id = (select id from p2)), 0, 'le Panier du visiteur disparaît');
select is((select count(*)::int from public.ligne_panier where panier_id = (select id from p1)), 3, 'trois lignes : cosplay, Kit, second Kit');
select is((select nombre::int from public.ligne_panier where panier_id = (select id from p1) and variante_id is not null), 5, 'les quantités d''un produit physique s''additionnent');
select is((select count(*)::int from public.ligne_panier where panier_id = (select id from p1) and produit_id = (select kit from fu)), 1, 'un Kit n''apparaît qu''une fois');
select is((select count(*)::int from public.panier where compte_id = '00000000-0000-0000-0000-0000000000d1'), 1, 'un seul Panier actif par Compte');
select is(public.avis_kit_possede((select id from p1)), false, 'aucune annonce sans Kit retiré');

-- Quantités : jamais au-delà de 10 après réunion.
select public.ajouter_au_panier(pg_temp.vis(), (select id from p4), null, (select cos from fu), 'M', 8);
select public.fusionner_panier(pg_temp.c1(), '00000000-0000-0000-0000-0000000000d1', (select id from p4));
select is((select nombre::int from public.ligne_panier where panier_id = (select id from p1) and variante_id is not null), 10, 'réunion plafonnée à 10 exemplaires');

-- Kit déjà possédé : retiré, annonce posée ; une action du client l'efface.
insert into public.commande (compte_id, type, statut, sous_total_cents, total_cents) values ('00000000-0000-0000-0000-0000000000d1', 'produits', 'livree', 990, 990);
insert into public.acces_kit (compte_id, produit_id, commande_origine) values ('00000000-0000-0000-0000-0000000000d1', (select kit from fu), (select id from public.commande));
select public.ajouter_au_panier(pg_temp.vis(), (select id from p3), null, (select kit from fu), null, 1);
create temp table r3 as select public.fusionner_panier(pg_temp.c1(), '00000000-0000-0000-0000-0000000000d1', (select id from p3)) as r;
grant select on r3 to public;
select is((select (r ->> 'retires')::int from r3), 1, 'le Kit possédé est retiré');
select is((select count(*)::int from public.ligne_panier where panier_id = (select id from p1) and produit_id = (select kit from fu)), 0, 'plus de Kit possédé dans le Panier');
select is(public.avis_kit_possede((select id from p1)), true, 'l''annonce « Kit déjà possédé » est posée');
select lives_ok($$select public.retirer_ligne_panier(pg_temp.vis(), (select id from p1), (select id from public.ligne_panier where produit_id = (select kit2 from fu) and panier_id = (select id from p1)))$$, 'le client retire une ligne');
select is(public.avis_kit_possede((select id from p1)), false, 'son action efface l''annonce');

-- Panier d'un autre Compte ignoré ; sans cookie, le Panier du Compte est renvoyé.
select is((public.fusionner_panier(pg_temp.c2(), '00000000-0000-0000-0000-0000000000d2', (select id from p1)) ->> 'panier_id'), null, 'le Panier d''un autre Compte est ignoré : le Compte 2 n''en a pas');
select is((select compte_id from public.panier where id = (select id from p1)), '00000000-0000-0000-0000-0000000000d1'::uuid, 'le Panier du Compte 1 n''est pas volé');
select is((public.fusionner_panier(pg_temp.c1(), '00000000-0000-0000-0000-0000000000d1', null) ->> 'panier_id')::uuid, (select id from p1), 'sans cookie : le Panier du Compte est renvoyé');

select * from finish();
rollback;
