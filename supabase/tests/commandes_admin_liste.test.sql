-- Story 9.16 d) : liste des Commandes de l'admin (commandes_admin_liste). Exécutable par service_role seulement, droit du personnel (Admin ou
-- Assistant) revérifié en base, email toujours masqué. Les recherches portent sur les numéros TEST_ (KS-2026-8810xx) pour ne pas dépendre des
-- lignes déjà présentes ; les chiffres des cartes sont mesurés en écart avec l'état avant les données TEST_. Données TEST_ annulées à la fin.
begin;
select plan(33);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'test-cal-admin@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'test-cal-assistant@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d3', 'test-cal-aicha@example.invalid', '{"full_name":"TEST Aïcha Kahindo"}'),
  ('00000000-0000-0000-0000-0000000000d4', 'zz-cal-sansnom@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d5', 'b@example.invalid', '{"full_name":"  ","name":"TEST Bintou Name"}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000d1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000d2', 'assistant');
create function pg_temp.c(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;
-- Liste lue par l'Admin, recherche sur les numéros TEST_ ; renvoie le résultat complet.
create function pg_temp.l(p_statut text default null, p_famille text default null, p_recherche text default 'ks-2026-8810', p_page integer default 1, p_taille integer default 20,
  p_prestataire text default null, p_zone text default null)
returns jsonb language sql as $$ select public.commandes_admin_liste(pg_temp.c('d1'), p_statut, p_famille, p_prestataire, p_zone, p_recherche, p_page, p_taille) $$;
create function pg_temp.numeros(p jsonb) returns text language sql as $$ select coalesce(string_agg(e ->> 'numero', ',' order by o), '') from jsonb_array_elements(p -> 'commandes') with ordinality x(e, o) $$;

create temp table avant as select public.commandes_admin_liste(pg_temp.c('d1')) -> 'chiffres' as chiffres;

-- Droits : service_role seulement ; SECURITY DEFINER, search_path fixé ; Admin et Assistant, jamais un client.
select ok(
  has_function_privilege('service_role', 'public.commandes_admin_liste(jsonb, text, text, text, text, text, integer, integer)', 'execute')
  and not has_function_privilege('anon', 'public.commandes_admin_liste(jsonb, text, text, text, text, text, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.commandes_admin_liste(jsonb, text, text, text, text, text, integer, integer)', 'execute'),
  'commandes_admin_liste : service_role seulement'
);
select ok(
  (select prosecdef and proconfig @> array['search_path=""'] from pg_proc where oid = 'public.commandes_admin_liste(jsonb, text, text, text, text, text, integer, integer)'::regprocedure),
  'SECURITY DEFINER, search_path fixé'
);
set local role anon;
select throws_ok($$select public.commandes_admin_liste('{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1"}'::jsonb)$$, '42501', null, 'anon ne peut pas l''exécuter');
reset role;
set local role authenticated;
select throws_ok($$select public.commandes_admin_liste('{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1"}'::jsonb)$$, '42501', null, 'authenticated ne peut pas l''exécuter');
reset role;
select throws_ok($$select public.commandes_admin_liste(pg_temp.c('d3'))$$, 'P0001', 'KS_DROIT_REFUSE', 'un client est refusé');
select lives_ok($$select public.commandes_admin_liste(pg_temp.c('d2'))$$, 'l''Assistant lit la liste');

-- Entrées hors des listes fermées : refusées.
select throws_ok($$select public.commandes_admin_liste(pg_temp.c('d1'), 'inconnu')$$, 'P0001', 'KS_ENTREE_INVALIDE', 'statut hors liste refusé');
select throws_ok($$select public.commandes_admin_liste(pg_temp.c('d1'), null, 'pass')$$, 'P0001', 'KS_ENTREE_INVALIDE', 'famille hors liste refusée');
select throws_ok($$select public.commandes_admin_liste(pg_temp.c('d1'), null, null, 'stripe')$$, 'P0001', 'KS_ENTREE_INVALIDE', 'prestataire hors liste refusé');
select throws_ok($$select public.commandes_admin_liste(pg_temp.c('d1'), null, null, null, 'kinshasa')$$, 'P0001', 'KS_ENTREE_INVALIDE', 'zone hors liste refusée');
select throws_ok($$select public.commandes_admin_liste(pg_temp.c('d1'), null, null, null, null, null, 0)$$, 'P0001', 'KS_ENTREE_INVALIDE', 'page 0 refusée');
select throws_ok($$select public.commandes_admin_liste(pg_temp.c('d1'), null, null, null, null, repeat('a', 101))$$, 'P0001', 'KS_ENTREE_INVALIDE', 'recherche de plus de 100 caractères refusée');

-- Données TEST_ : un Kit ; Commandes du plus ancien (01) au plus récent (07).
insert into public.produit (id, famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('00000000-0000-4000-8000-0000000004a1', 'kit', 'cal-kit', 'TEST_Kit', 'TEST_Kit', 1000, 'debutant', now() - interval '1 day');
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, forfait_cents, total_cents, paye_le, expire_le, prestataire, zone, mode_remise, cree_le) values
  ('00000000-0000-4000-8000-0000000004c1', 'KS-2026-881001', '00000000-0000-0000-0000-0000000000d3', 'produits', 'payee', 1000, 0, 1000, now() - interval '1 hour', null, 'pawapay', null, null, now() - interval '7 hours'),
  ('00000000-0000-4000-8000-0000000004c2', 'KS-2026-881002', '00000000-0000-0000-0000-0000000000d3', 'produits', 'en_attente', 5000, 500, 5500, null, now() + interval '1 hour', null, 'goma', 'livraison', now() - interval '6 hours'),
  ('00000000-0000-4000-8000-0000000004c3', 'KS-2026-881003', '00000000-0000-0000-0000-0000000000d3', 'produits', 'en_attente', 5000, 0, 5000, null, now() - interval '1 hour', null, 'goma', 'retrait', now() - interval '5 hours'),
  ('00000000-0000-4000-8000-0000000004c4', 'KS-2026-881004', '00000000-0000-0000-0000-0000000000d4', 'produits', 'echouee', 1000, 0, 1000, null, now() + interval '1 hour', 'maishapay', null, null, now() - interval '4 hours'),
  ('00000000-0000-4000-8000-0000000004c5', 'KS-2026-881005', '00000000-0000-0000-0000-0000000000d4', 'produits', 'remboursee', 2000, 0, 2000, now() - interval '3 hours', null, 'maishapay', null, null, now() - interval '3 hours'),
  ('00000000-0000-4000-8000-0000000004c6', 'KS-2026-881006', '00000000-0000-0000-0000-0000000000d4', 'produits', 'annulee', 2000, 0, 2000, now() - interval '2 hours', null, 'polar', null, null, now() - interval '2 hours');
insert into public.commande (id, numero, compte_id, type, statut, offerte, sous_total_cents, total_cents, cree_le) values
  ('00000000-0000-4000-8000-0000000004c7', 'KS-2026-881007', '00000000-0000-0000-0000-0000000000d4', 'produits', 'offerte', true, 0, 0, now() - interval '1 hour');
-- Hors du préfixe KS-2026-8810 : en attente SANS échéance (expire_le nul), Compte au nom dans « name » seulement et à l'email d'un caractère.
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, cree_le) values
  ('00000000-0000-4000-8000-0000000004c8', 'KS-2026-882001', '00000000-0000-0000-0000-0000000000d5', 'produits', 'en_attente', 1000, 1000, now() - interval '30 minutes');
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents) values
  ('00000000-0000-4000-8000-0000000004c1', '00000000-0000-4000-8000-0000000004a1', 1, 1000);
insert into public.tentative_paiement (commande_id, prestataire, moyen, reference_interne, montant_attendu_cents, statut, cause) values
  ('00000000-0000-4000-8000-0000000004c1', 'pawapay', 'mobile_money', 'TEST-CAL-0001', 1000, 'reussie', null),
  ('00000000-0000-4000-8000-0000000004c4', 'maishapay', 'carte', 'TEST-CAL-0002', 1000, 'echouee', 'client');

-- Recherche par numéro : partielle, sans tenir compte de la casse ; plus récentes d'abord.
select is(pg_temp.numeros(pg_temp.l()), 'KS-2026-881007,KS-2026-881006,KS-2026-881005,KS-2026-881004,KS-2026-881003,KS-2026-881002,KS-2026-881001', 'numéro partiel en minuscules : les 7, plus récentes d''abord');
select is((pg_temp.l() ->> 'total')::int, 7, 'total des Commandes correspondantes');
select is(pg_temp.numeros(pg_temp.l(p_recherche => 'ks-2026-881003')), 'KS-2026-881003', 'numéro complet en minuscules : une seule');

-- Recherche par client : nom des métadonnées, partie de l'email ; jokers échappés.
select is(pg_temp.numeros(pg_temp.l(p_recherche => 'aïcha kah')), 'KS-2026-881003,KS-2026-881002,KS-2026-881001', 'nom partiel, sans casse');
select is((pg_temp.l(p_recherche => 'CAL-SANSNOM') ->> 'total')::int, 0, 'fragment d''email : rien (une adresse masquée ne se reconstitue pas)');
select is(pg_temp.numeros(pg_temp.l(p_recherche => 'ZZ-CAL-SANSNOM@example.INVALID')), 'KS-2026-881007,KS-2026-881006,KS-2026-881005,KS-2026-881004', 'adresse entière, sans casse : ses Commandes');
select is((pg_temp.l(p_recherche => 'ks-2026-88100_') ->> 'total')::int, 0, '« _ » cherché tel quel, pas comme joker');

-- Client : nom s'il existe, email masqué toujours ; jamais l'email complet.
select is(
  (select e ->> 'client_nom' || '|' || (e ->> 'client_email_masque') from jsonb_array_elements(pg_temp.l(p_recherche => 'ks-2026-881001') -> 'commandes') e),
  'TEST Aïcha Kahindo|te***@example.invalid', 'nom et email masqué'
);
select ok(
  (select (e -> 'client_nom') = 'null'::jsonb and e ->> 'client_email_masque' = 'zz***@example.invalid' from jsonb_array_elements(pg_temp.l(p_recherche => 'ks-2026-881007') -> 'commandes') e),
  'sans nom : nom nul (jamais inventé), email masqué'
);
select is(
  (select e ->> 'client_nom' || '|' || (e ->> 'client_email_masque') from jsonb_array_elements(pg_temp.l(p_recherche => 'bintou') -> 'commandes') e),
  'TEST Bintou Name|b***@example.invalid', 'full_name vide : name repris (affichage et recherche) ; email d''un caractère masqué'
);
select ok(position('@example.invalid' in replace(pg_temp.l()::text, '***@example.invalid', '')) = 0, 'aucun email complet dans la réponse');

-- Statuts : en attente et échouée non expirées ; expirée = statut expirée ou échéance passée ; offerte ; remboursée.
select is(pg_temp.numeros(pg_temp.l('en_attente')), 'KS-2026-881002', 'en attente : seulement celle qui n''est pas expirée');
select is(pg_temp.numeros(pg_temp.l('expiree')), 'KS-2026-881003', 'expirée : en attente dont l''échéance est passée');
select is(pg_temp.numeros(pg_temp.l('echouee')) || ' ; ' || pg_temp.numeros(pg_temp.l('offerte')) || ' ; ' || pg_temp.numeros(pg_temp.l('remboursee')),
  'KS-2026-881004 ; KS-2026-881007 ; KS-2026-881005', 'échouée non expirée, offerte, remboursée');
select is(pg_temp.numeros(pg_temp.l(p_famille => 'kit')), 'KS-2026-881001', 'famille : Commandes qui contiennent un article de cette famille');
select is(pg_temp.numeros(pg_temp.l(p_statut => 'en_attente', p_recherche => 'ks-2026-882001')) || ' ; ' || (pg_temp.l(p_statut => 'expiree', p_recherche => 'ks-2026-882001') ->> 'total'),
  'KS-2026-882001 ; 0', 'en attente sans échéance : en attente, jamais expirée');
select is(pg_temp.numeros(pg_temp.l(p_prestataire => 'maishapay')), 'KS-2026-881005,KS-2026-881004', 'prestataire');
select is(pg_temp.numeros(pg_temp.l(p_zone => 'goma')), 'KS-2026-881003,KS-2026-881002', 'zone de remise');

-- Pagination : 3 par page, 7 Commandes : pages de 3, 3 et 1 ; au-delà, page vide mais total connu.
select is(pg_temp.numeros(pg_temp.l(p_page => 3, p_taille => 3)) || ' / ' || (pg_temp.l(p_page => 3, p_taille => 3) ->> 'total'), 'KS-2026-881001 / 7', 'troisième page : la dernière Commande, total 7');
select is(jsonb_array_length(pg_temp.l(p_page => 4, p_taille => 3) -> 'commandes'), 0, 'page au-delà de la dernière : vide');

-- Cartes : commandes payées (annulée et remboursée exclues), tentatives réussies, en attente non expirées.
select is(
  ((public.commandes_admin_liste(pg_temp.c('d1')) -> 'chiffres' ->> 'commandes_payees')::int - (select (chiffres ->> 'commandes_payees')::int from avant)) || '|'
  || ((public.commandes_admin_liste(pg_temp.c('d1')) -> 'chiffres' ->> 'tentatives_reussies')::int - (select (chiffres ->> 'tentatives_reussies')::int from avant)) || '|'
  || ((public.commandes_admin_liste(pg_temp.c('d1')) -> 'chiffres' ->> 'en_attente')::int - (select (chiffres ->> 'en_attente')::int from avant)),
  '1|1|2', 'cartes : 1 payée, 1 tentative réussie, 2 en attente non expirées (dont une sans échéance)'
);

select * from finish();
rollback;
