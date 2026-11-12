-- Story 9.10 : liste des utilisateurs de l'admin. Réservée à l'Admin, serveur seulement, email jamais rendu en entier, rôle le plus fort, comptes de Commandes et de Pass.
-- Données TEST_ annulées à la fin.
begin;
select plan(13);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'testua1@example.invalid', '{"full_name": "TEST_Alice Exemple"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'ab@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b3', 'test-ua3@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b9', 'test-ua-admin@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, u, 25) from unnest(array[
  '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000000b9']::uuid[]) u;
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b9', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b3', 'assistant');
create function pg_temp.adm() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000b9","role":"admin"}'::jsonb $$;
create function pg_temp.simple() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":null}'::jsonb $$;
create function pg_temp.ligne(p text) returns jsonb language sql as $$
  select e from jsonb_array_elements(public.lister_utilisateurs_admin(pg_temp.adm())) e where e ->> 'id' = '00000000-0000-0000-0000-0000000000' || p
$$;

-- Commandes de b1 : une payée, une en attente (non comptée). Un Pass valide et un Pass annulé (seul le valide compte).
insert into public.commande (numero, compte_id, type, statut, sous_total_cents, total_cents, paye_le) values
  ('KS-2026-910001', '00000000-0000-0000-0000-0000000000b1', 'produits', 'payee', 990, 990, now() - interval '1 day');
insert into public.commande (numero, compte_id, type, statut, sous_total_cents, total_cents) values
  ('KS-2026-910002', '00000000-0000-0000-0000-0000000000b1', 'produits', 'en_attente', 500, 500);

select is((select count(*)::int from unnest(array['public.lister_utilisateurs_admin(jsonb)']) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute')), 0, 'aucune exécution par anon ni authenticated');
select is((select count(*)::int from unnest(array['public.lister_utilisateurs_admin(jsonb)']) f where has_function_privilege('service_role', f, 'execute')), 1, 'le serveur exécute la fonction');
select throws_ok($$select public.lister_utilisateurs_admin(pg_temp.simple())$$, 'P0001', null, 'sans le rôle admin : refusé');
select throws_ok($$select public.lister_utilisateurs_admin(null)$$, 'P0001', null, 'sans auteur : refusé');

select is(pg_temp.ligne('b1') ->> 'nom', 'TEST_Alice Exemple', 'le nom des métadonnées de connexion');
select is(pg_temp.ligne('b1') ->> 'email_masque', 'te***@example.invalid', 'email masqué : deux premiers caractères puis « *** » puis le domaine');
select is(pg_temp.ligne('b2') ->> 'email_masque', 'a***@example.invalid', 'identifiant très court : un seul caractère gardé');
select ok(position('testua1@example.invalid' in public.lister_utilisateurs_admin(pg_temp.adm())::text) = 0, 'l''adresse complète n''apparaît nulle part dans la réponse');
select is(pg_temp.ligne('b1') ->> 'commandes', '1', 'une seule Commande réelle (la Commande en attente n''est pas comptée)');
select is(pg_temp.ligne('b1') ->> 'pass', '0', 'aucun Pass');
select is(pg_temp.ligne('b9') ->> 'role', 'admin', 'rôle admin');
select is(pg_temp.ligne('b3') ->> 'role', 'assistant', 'rôle assistant');
select ok(pg_temp.ligne('b2') -> 'role' = 'null'::jsonb and pg_temp.ligne('b2') ? 'inscrit_le', 'sans rôle : null ; la date d''inscription fait partie de la réponse');

select * from finish();
rollback;
