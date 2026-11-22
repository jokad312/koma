-- Bug A1-bis (2026-11-22) : garde « premier appel de la session » (voir fusion_panier_premier_appel.test.sql, bug A1 : PL/pgSQL prépare le plan
-- d'une expression à sa première exécution ; un appel précédent dans la même session peut masquer un défaut).
-- Fonction gardée : expirer_commandes_echues (tâche pg_cron, toujours appelée en session neuve). Cas limite : aucune Commande à expirer.
-- La fonction porte sur toute la table : le résultat attendu est le nombre de Commandes échues comptées juste avant l'appel, dans la même
-- transaction (now() y est figé). Sur la base locale de la CI il vaut 0 ; sur koma-dev il ne dépend d'aucune ligne précise. Une Commande TEST_ en
-- attente, non échue, doit rester en attente.
-- Ce fichier ne contient QU'UN appel de expirer_commandes_echues (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(3);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-a1b110000001', 'test-a1bis-11@example.invalid', '{}');
insert into public.commande (id, numero, compte_id, type, statut, sous_total_cents, total_cents, expire_le) values
  ('00000000-0000-4000-8000-a1b110000031', 'KS-2026-9111001', '00000000-0000-0000-0000-a1b110000001', 'produits', 'en_attente', 990, 990, now() + interval '1 hour');

create temp table avant as
  select count(*)::int as n from public.commande where statut in ('en_attente', 'echouee') and expire_le is not null and expire_le <= now();
create temp table r as select public.expirer_commandes_echues() as n;

select is((select n from r), (select n from avant), 'premier appel de la session, aucune Commande TEST_ à expirer : aucune erreur, seules les Commandes déjà échues comptent');
select is((select statut from public.commande where id = '00000000-0000-4000-8000-a1b110000031'), 'en_attente', 'la Commande non échue reste en attente');
select is(
  (select count(*)::int from public.commande where statut in ('en_attente', 'echouee') and expire_le is not null and expire_le <= now()),
  0,
  'plus aucune Commande échue en attente'
);

select * from finish();
rollback;
