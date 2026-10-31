-- Story 3.5 : Kit gratuit. Tables commande, ligne_commande, acces_kit (RLS, droits, unicité), numéro KS-AAAA-NNNNNN,
-- offrir_commande (acceptation, Compte complet, Kit gratuit publié, rejeu, double accès), journal à deux lignes, Commande jamais payee.
-- Données créées dans la transaction, puis annulées.
begin;
select plan(49);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'test-kg1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'test-kg2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f3', 'test-kg3@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f1', 25);
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 30);
-- f3 : âge non déclaré (Compte incomplet).

create function pg_temp.c1() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":null}'::jsonb $$;
create function pg_temp.c2() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f2","role":null}'::jsonb $$;
create function pg_temp.c3() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000f3","role":null}'::jsonb $$;
create function pg_temp.lic() returns jsonb language sql as $$ select '[{"objet":"licence_kit","version":"test-v1"}]'::jsonb $$;

-- Un Kit gratuit publié, un Kit payant publié, un Kit gratuit non publié, un cosplay.
select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'kg-gratuit', 'Gratuit', 'Free', 0, 'debutant', now() - interval '1 minute'),
  ('kit', 'kg-payant', 'Payant', 'Paid', 990, 'debutant', now() - interval '1 minute'),
  ('kit', 'kg-brouillon', 'Brouillon', 'Draft', 0, 'debutant', null),
  ('kit', 'kg-gratuit-2', 'Gratuit 2', 'Free 2', 0, 'debutant', now() - interval '1 minute');
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, publie_le) values
  ('cosplay', 'kg-cosplay', 'Cosplay', 'Cosplay', 5000, now() - interval '1 minute');
create temp table kg as
  select (select id from public.produit where slug = 'kg-gratuit') as gratuit,
         (select id from public.produit where slug = 'kg-payant') as payant,
         (select id from public.produit where slug = 'kg-brouillon') as brouillon,
         (select id from public.produit where slug = 'kg-gratuit-2') as gratuit2,
         (select id from public.produit where slug = 'kg-cosplay') as cosplay;
grant select on kg to public;

-- Tables, RLS, droits.
select has_table('public', 'commande', 'la table commande existe');
select has_table('public', 'ligne_commande', 'la table ligne_commande existe');
select has_table('public', 'acces_kit', 'la table acces_kit existe');
select ok(
  (select bool_and(relrowsecurity) from pg_class where oid in ('public.commande'::regclass, 'public.ligne_commande'::regclass, 'public.acces_kit'::regclass)),
  'RLS active sur les trois tables'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('commande', 'ligne_commande', 'acces_kit')
     and lower(grantee) in ('anon', 'authenticated', 'public') and privilege_type <> 'SELECT'),
  0,
  'aucun droit d''écriture pour anon, authenticated ni public'
);
select is(
  (select count(*)::int from information_schema.role_table_grants
   where table_schema = 'public' and table_name in ('commande', 'ligne_commande', 'acces_kit') and grantee = 'anon'),
  0,
  'anon ne lit rien'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'public' and tablename in ('commande', 'ligne_commande', 'acces_kit') and cmd <> 'SELECT'),
  0,
  'aucune politique d''écriture'
);
select is(
  (select array_agg(f order by f) from unnest(array[
    'public.offrir_commande(jsonb, uuid, jsonb, text)', 'public.possede_kit(uuid, uuid)'
  ]) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or not has_function_privilege('service_role', f, 'execute')),
  null,
  'offrir_commande et possede_kit : service seulement'
);
select is(
  (select array_agg(f order by f) from unnest(array[
    'public.exiger_client(jsonb)', 'public.bibliotheque_ouvrir_acces(uuid, uuid, uuid)'
  ]) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or has_function_privilege('service_role', f, 'execute')),
  null,
  'les fonctions internes ne sont appelables par aucun rôle'
);
select ok(
  (select count(*) = 4 and bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where pronamespace = 'public'::regnamespace and proname in ('offrir_commande', 'bibliotheque_ouvrir_acces', 'exiger_client', 'possede_kit')),
  'security definer, search_path vide'
);

-- Refus.
select throws_ok($$select public.offrir_commande(null, (select gratuit from kg), pg_temp.lic(), 'cle-test-0001')$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'sans auteur : refusé');
select throws_ok($$select public.offrir_commande('{"type":"cron"}'::jsonb, (select gratuit from kg), pg_temp.lic(), 'cle-test-0001')$$, 'P0001', 'KS_AUTEUR_INVALIDE', 'auteur qui n''est pas un Compte : refusé');
select throws_ok($$select public.offrir_commande('{"type":"compte","id":"pas-un-uuid"}'::jsonb, (select gratuit from kg), pg_temp.lic(), 'cle-test-0001')$$, 'P0001', 'KS_AUTEUR_INVALIDE', 'identifiant de Compte invalide : refusé');
select throws_ok($$select public.offrir_commande(pg_temp.c3(), (select gratuit from kg), pg_temp.lic(), 'cle-test-0001')$$, 'P0001', 'KS_COMPTE_INCOMPLET', 'Compte sans âge déclaré : refusé');
select throws_ok($$select public.offrir_commande(pg_temp.c1(), (select gratuit from kg), pg_temp.lic(), 'court')$$, 'P0001', 'KS_CLE_IDEMPOTENCE_INVALIDE', 'clé d''idempotence trop courte : refusée');
select throws_ok($$select public.offrir_commande(pg_temp.c1(), (select gratuit from kg), '[]'::jsonb, 'cle-test-0001')$$, 'P0001', 'KS_ACCEPTATION_MANQUANTE', 'sans acceptation de la Licence : refusé');
select throws_ok($$select public.offrir_commande(pg_temp.c1(), (select gratuit from kg), null, 'cle-test-0001')$$, 'P0001', 'KS_ACCEPTATION_MANQUANTE', 'acceptations nulles : refusé');
select throws_ok($$select public.offrir_commande(pg_temp.c1(), (select gratuit from kg), '[{"objet":"cgv","version":"v1"}]'::jsonb, 'cle-test-0001')$$, 'P0001', 'KS_ACCEPTATION_MANQUANTE', 'une autre acceptation que la Licence de kit : refusé');
select throws_ok($$select public.offrir_commande(pg_temp.c1(), (select gratuit from kg), '[{"objet":"licence_kit","version":""}]'::jsonb, 'cle-test-0001')$$, 'P0001', 'KS_ACCEPTATION_MANQUANTE', 'version du texte vide : refusé');
select throws_ok($$select public.offrir_commande(pg_temp.c1(), (select payant from kg), pg_temp.lic(), 'cle-test-0001')$$, 'P0001', 'KS_KIT_NON_GRATUIT', 'un Kit payant ne s''obtient pas sans paiement');
select throws_ok($$select public.offrir_commande(pg_temp.c1(), (select brouillon from kg), pg_temp.lic(), 'cle-test-0001')$$, 'P0001', 'KS_PRODUIT_INTROUVABLE', 'un Kit non publié : introuvable');
select throws_ok($$select public.offrir_commande(pg_temp.c1(), (select cosplay from kg), pg_temp.lic(), 'cle-test-0001')$$, 'P0001', 'KS_PRODUIT_INTROUVABLE', 'un cosplay : introuvable');
select is((select count(*)::int from public.commande), 0, 'aucun refus ne crée de Commande');
select is((select count(*)::int from public.acces_kit), 0, 'aucun refus n''ouvre d''accès');

-- Succès.
select is(
  (public.offrir_commande(pg_temp.c1(), (select gratuit from kg), pg_temp.lic(), 'cle-test-0001') ->> 'rejeu')::boolean,
  false,
  'le Kit gratuit est obtenu'
);
select matches((select numero from public.commande), '^KS-[0-9]{4}-[0-9]{6}$', 'numéro lisible KS-AAAA-NNNNNN');
select is((select statut from public.commande), 'livree', 'la Commande offerte passe livree dans la même transaction');
select ok(
  (select offerte and total_cents = 0 and sous_total_cents = 0 and paye_le is null and prestataire is null and reference_transaction is null and type = 'produits' from public.commande),
  'offerte : 0 USD, jamais payée, sans Prestataire ni référence'
);
select is((select count(*)::int from public.commande where statut = 'payee'), 0, 'jamais payee');
select is((select acceptations -> 0 ->> 'version' from public.commande), 'test-v1', 'l''acceptation garde la version du texte');
select ok((select (acceptations -> 0 ->> 'accepte_le') is not null and acceptations -> 0 ->> 'objet' = 'licence_kit' from public.commande), 'l''acceptation garde l''objet et l''heure');
select is((select count(*)::int from public.ligne_commande where commande_id = (select id from public.commande) and prix_cents = 0 and produit_id = (select gratuit from kg)), 1, 'une ligne de Commande à 0 USD');
select is((select count(*)::int from public.acces_kit where compte_id = '00000000-0000-0000-0000-0000000000f1' and produit_id = (select gratuit from kg) and commande_origine = (select id from public.commande)), 1, 'l''accès est ouvert, rattaché à la Commande d''origine');
select is((select public.possede_kit('00000000-0000-0000-0000-0000000000f1', (select gratuit from kg))), true, 'possede_kit : vrai');
select is((select public.possede_kit('00000000-0000-0000-0000-0000000000f2', (select gratuit from kg))), false, 'possede_kit : faux pour un autre Compte');
select is((select count(*)::int from public.journal_audit where cible_table = 'commande' and cible_id = (select id::text from public.commande)), 2, 'deux lignes de journal : création, puis passage à livree');
select is((select apres ->> 'statut' from public.journal_audit where cible_table = 'commande' and action = 'update'), 'livree', 'la seconde ligne de journal porte le statut livree');

-- Rejeu et double accès.
select is(
  (public.offrir_commande(pg_temp.c1(), (select gratuit from kg), pg_temp.lic(), 'cle-test-0001') ->> 'rejeu')::boolean,
  true,
  'même clé : la même Commande, sans nouvel effet'
);
select throws_ok($$select public.offrir_commande(pg_temp.c1(), (select gratuit from kg), pg_temp.lic(), 'cle-test-0002')$$, 'P0001', 'KS_KIT_DEJA_POSSEDE', 'un second essai avec une autre clé est refusé');
select throws_ok($$select public.offrir_commande(pg_temp.c1(), (select gratuit2 from kg), pg_temp.lic(), 'cle-test-0001')$$, 'P0001', 'KS_CLE_IDEMPOTENCE_INVALIDE', 'une clé déjà utilisée pour un autre Kit est refusée');
select is((select count(*)::int from public.commande), 1, 'toujours une seule Commande');
select is((select count(*)::int from public.acces_kit), 1, 'toujours un seul accès');

-- Le numéro avance pour un autre Compte.
select public.offrir_commande(pg_temp.c2(), (select gratuit from kg), pg_temp.lic(), 'cle-test-0003');
select is((select count(distinct numero)::int from public.commande), 2, 'deux Commandes, deux numéros distincts');

-- Contraintes de base : une Commande offerte ne peut pas être payée.
select throws_ok(
  $$update public.commande set statut = 'payee' where compte_id = '00000000-0000-0000-0000-0000000000f1'$$,
  '23514', null, 'une Commande offerte ne peut pas passer payee'
);
select throws_ok(
  $$update public.commande set paye_le = now() where compte_id = '00000000-0000-0000-0000-0000000000f1'$$,
  '23514', null, 'une Commande offerte n''a jamais de paye_le'
);

-- RLS : un client lit seulement ses Commandes et ses accès, n'écrit rien.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}';
select is((select count(*)::int from public.commande), 1, 'f1 lit sa Commande seulement');
select is((select count(*)::int from public.acces_kit), 1, 'f1 lit son accès seulement');
select is((select count(*)::int from public.ligne_commande), 1, 'f1 lit sa ligne de Commande seulement');
select throws_ok($$delete from public.acces_kit$$, '42501', null, 'f1 ne supprime pas d''accès');
reset role;

select * from finish();
rollback;
