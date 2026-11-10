-- Story 9.6 : planification des emails ciblés (correctifs de la revue compris) : un email par modification du Panier (1 h ou 24 h),
-- aucun pendant un paiement en cours, rappels de Kit entre 2 et 7 jours puis à 7 jours, nouveau produit d'un univers préféré ou acheté
-- (jamais un produit déjà possédé), consentement exigé, Kit gratuit exclu, rejeu sans doublon. Données TEST_ annulées à la fin.
begin;
select plan(20);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'test-ec1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'test-ec2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d3', 'test-ec3@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, u, 25) from unnest(array[
  '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d3']::uuid[]) u;
create function pg_temp.c(p text) returns jsonb language sql as $$ select jsonb_build_object('type', 'compte', 'id', '00000000-0000-0000-0000-0000000000' || p, 'role', null) $$;
create function pg_temp.id(p text) returns uuid language sql as $$ select ('00000000-0000-0000-0000-0000000000' || p)::uuid $$;
create function pg_temp.pid(p_slug text) returns uuid language sql as $$ select id from public.produit where slug = p_slug $$;
create function pg_temp.nb(p_compte text, p_modele text) returns int language sql as $$ select count(*)::int from public.envoi where modele::text = p_modele and compte_id = pg_temp.id(p_compte) $$;
-- d1 : relances + nouveautés ; d2 : nouveautés seulement ; d3 : aucun consentement.
select public.donner_consentements(pg_temp.c('d1'), array['relances', 'nouveautes'], 'TEST_v1', 'preferences');
select public.donner_consentements(pg_temp.c('d2'), array['nouveautes'], 'TEST_v1', 'preferences');

insert into public.univers (nom_fr, nom_en) values ('TEST_Univers', 'TEST_Universe');
create temp table u as select id from public.univers where nom_fr = 'TEST_Univers';
grant select on u to public;
update public.profil set univers_prefere = (select id from u) where id in (pg_temp.id('d1'), pg_temp.id('d3'));
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le, univers_id) values
  ('kit', 'ec-kit-a', 'TEST_Kit A', null, 990, 'debutant', now() - interval '30 days', null),
  ('kit', 'ec-kit-b', 'TEST_Kit B', null, 990, 'debutant', now() - interval '30 days', null),
  ('kit', 'ec-kit-c', 'TEST_Kit C', null, 990, 'debutant', now() - interval '30 days', null),
  ('kit', 'ec-kit-d', 'TEST_Kit D', null, 990, 'debutant', now() - interval '30 days', null),
  ('kit', 'ec-kit-e', 'TEST_Kit E', null, 990, 'debutant', now() - interval '30 days', null),
  ('kit', 'ec-kit-gratuit', 'TEST_Kit gratuit', null, 0, 'debutant', now() - interval '30 days', null),
  ('kit', 'ec-kit-univers', 'TEST_Kit univers', null, 990, 'debutant', now() - interval '30 days', (select id from u)),
  ('kit', 'ec-nouveau', 'TEST_Nouveau', null, 990, 'debutant', now() - interval '1 day', (select id from u)),
  ('kit', 'ec-ancien', 'TEST_Ancien', null, 990, 'debutant', now() - interval '20 days', (select id from u)),
  ('kit', 'ec-futur', 'TEST_Futur', null, 990, 'debutant', now() + interval '1 day', (select id from u)),
  ('kit', 'ec-deja', 'TEST_Déjà acheté', null, 990, 'debutant', now() - interval '1 day', (select id from u));
insert into public.video_kit (produit_id, duree_secondes)
  select id, 600 from public.produit where slug in ('ec-kit-a', 'ec-kit-b', 'ec-kit-c', 'ec-kit-d', 'ec-kit-e', 'ec-kit-gratuit');

-- Paniers : d1 modifié il y a 25 h ; d3 sans consentement ; d2 (relances absentes) modifié il y a 2 h.
insert into public.panier (compte_id, mis_a_jour_le) values (pg_temp.id('d1'), now() - interval '25 hours'), (pg_temp.id('d3'), now() - interval '25 hours'), (pg_temp.id('d2'), now() - interval '2 hours');
insert into public.ligne_panier (panier_id, produit_id, nombre) select p.id, pg_temp.pid('ec-nouveau'), 1 from public.panier p where p.compte_id in (pg_temp.id('d1'), pg_temp.id('d2'), pg_temp.id('d3'));

-- Kits de d1 : A 3 j pas démarré ; B 8 j démarré ; C 1 j ; D 3 j démarré ; E 8 j pas démarré ; gratuit (offert).
create function pg_temp.achat(p_numero text, p_compte text, p_jours int) returns uuid language sql as $$
  insert into public.commande (numero, compte_id, type, statut, sous_total_cents, total_cents, paye_le)
  values (p_numero, pg_temp.id(p_compte), 'produits', 'payee', 990, 990, now() - make_interval(days => p_jours)) returning id
$$;
insert into public.acces_kit (compte_id, produit_id, commande_origine, cree_le) values
  (pg_temp.id('d1'), pg_temp.pid('ec-kit-a'), pg_temp.achat('KS-2026-880001', 'd1', 3), now() - interval '3 days'),
  (pg_temp.id('d1'), pg_temp.pid('ec-kit-b'), pg_temp.achat('KS-2026-880002', 'd1', 8), now() - interval '8 days'),
  (pg_temp.id('d1'), pg_temp.pid('ec-kit-c'), pg_temp.achat('KS-2026-880004', 'd1', 1), now() - interval '1 day'),
  (pg_temp.id('d1'), pg_temp.pid('ec-kit-d'), pg_temp.achat('KS-2026-880005', 'd1', 3), now() - interval '3 days'),
  (pg_temp.id('d1'), pg_temp.pid('ec-kit-e'), pg_temp.achat('KS-2026-880006', 'd1', 8), now() - interval '8 days');
insert into public.commande (numero, compte_id, type, statut, offerte, sous_total_cents, total_cents) values ('KS-2026-880003', pg_temp.id('d1'), 'produits', 'offerte', true, 0, 0);
insert into public.acces_kit (compte_id, produit_id, commande_origine, cree_le) values (pg_temp.id('d1'), pg_temp.pid('ec-kit-gratuit'), (select id from public.commande where numero = 'KS-2026-880003'), now() - interval '3 days');
insert into public.progression_video (compte_id, produit_id, position_secondes, max_position_secondes) values
  (pg_temp.id('d1'), pg_temp.pid('ec-kit-b'), 120, 200), (pg_temp.id('d1'), pg_temp.pid('ec-kit-d'), 60, 60);
-- d2 : achat payé dans l'univers (sans univers préféré) ; d1 a déjà acheté « Déjà acheté ».
insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents) values
  (pg_temp.achat('KS-2026-880007', 'd2', 10), pg_temp.pid('ec-kit-univers'), 1, 990),
  ((select id from public.commande where numero = 'KS-2026-880001'), pg_temp.pid('ec-deja'), 1, 990);

select ok(not has_function_privilege('service_role', 'public.planifier_emails_cibles()', 'execute'), 'planifier_emails_cibles est interne (pg_cron)');
select lives_ok($$select public.planifier_emails_cibles()$$, 'planification');

-- Panier.
select is(pg_temp.nb('d1', 'panier_abandonne'), 1, 'panier de 25 h : un seul email (24 h), jamais 1 h et 24 h ensemble');
select is((select count(*)::int from public.envoi where compte_id = pg_temp.id('d1') and cle like 'panier_abandonne:%:24h'), 1, 'c''est l''email de 24 h');
select is(pg_temp.nb('d3', 'panier_abandonne') + pg_temp.nb('d2', 'panier_abandonne'), 0, 'sans consentement aux relances : aucun panier oublié');

-- Kits.
select is((select count(*)::int from public.envoi where cle = 'rappel_kit:' || (select id from public.acces_kit where produit_id = pg_temp.pid('ec-kit-a')) || ':debut'), 1, 'Kit A (3 j, pas démarré) : « Commence le chapitre 1 »');
select is((select count(*)::int from public.envoi where cle = 'rappel_kit:' || (select id from public.acces_kit where produit_id = pg_temp.pid('ec-kit-b')) || ':fin'), 1, 'Kit B (8 j, démarré) : rappel de reprise');
select is((select count(*)::int from public.envoi where cle = 'rappel_kit:' || (select id from public.acces_kit where produit_id = pg_temp.pid('ec-kit-e')) || ':fin'), 1, 'Kit E (8 j, jamais démarré) : rappel à 7 jours aussi');
select is((select count(*)::int from public.envoi e where e.modele = 'rappel_kit' and e.donnees ->> 'produit_id' = pg_temp.pid('ec-kit-c')::text), 0, 'Kit C (1 j) : trop tôt');
select is((select count(*)::int from public.envoi e where e.modele = 'rappel_kit' and e.donnees ->> 'produit_id' = pg_temp.pid('ec-kit-d')::text), 0, 'Kit D (3 j, démarré) : pas encore de rappel de reprise');
select is((select count(*)::int from public.envoi e where e.modele = 'rappel_kit' and e.donnees ->> 'produit_id' = pg_temp.pid('ec-kit-gratuit')::text), 0, 'Kit gratuit : jamais de rappel');

-- Nouveaux produits.
select is((select count(*)::int from public.envoi e where e.modele = 'nouveau_produit' and e.compte_id = pg_temp.id('d1') and e.donnees ->> 'produit_id' = pg_temp.pid('ec-nouveau')::text), 1, 'univers préféré : nouveau produit planifié');
select is((select count(*)::int from public.envoi e where e.modele = 'nouveau_produit' and e.compte_id = pg_temp.id('d2') and e.donnees ->> 'produit_id' = pg_temp.pid('ec-nouveau')::text), 1, 'univers acheté (sans univers préféré) : planifié');
select is(pg_temp.nb('d3', 'nouveau_produit'), 0, 'sans consentement aux nouveautés : rien');
select is((select count(*)::int from public.envoi e where e.modele = 'nouveau_produit' and e.donnees ->> 'produit_id' in (pg_temp.pid('ec-ancien')::text, pg_temp.pid('ec-futur')::text)), 0, 'publié il y a plus de 7 jours ou pas encore publié : rien');
select is((select count(*)::int from public.envoi e where e.modele = 'nouveau_produit' and e.compte_id = pg_temp.id('d1') and e.donnees ->> 'produit_id' = pg_temp.pid('ec-deja')::text), 0, 'produit déjà acheté : jamais annoncé');

-- Rejeu, nouvelle modification, paiement en cours, désinscription.
select is(public.planifier_emails_cibles(), 0, 'rejeu : rien de nouveau');
update public.panier set mis_a_jour_le = now() - interval '2 hours' where compte_id = pg_temp.id('d1');
select is(public.planifier_emails_cibles(), 1, 'panier modifié à nouveau (2 h) : un email à 1 h');
update public.panier set mis_a_jour_le = now() - interval '3 hours' where compte_id = pg_temp.id('d1');
insert into public.commande (numero, compte_id, type, statut, sous_total_cents, total_cents, expire_le) values ('KS-2026-880008', pg_temp.id('d1'), 'produits', 'en_attente', 990, 990, now() + interval '20 minutes');
select is(public.planifier_emails_cibles(), 0, 'Commande à payer en cours : aucun panier oublié');
update public.commande set expire_le = now() - interval '1 minute' where numero = 'KS-2026-880008';
select public.desinscrire(pg_temp.id('d1'));
update public.panier set mis_a_jour_le = now() - interval '4 hours' where compte_id = pg_temp.id('d1');
select is(public.planifier_emails_cibles(), 0, 'après désinscription : aucun nouvel email');

select * from finish();
rollback;
