-- Story 2.1 : univers, produits physiques et variantes (RLS, privilèges, droits, journal, validations).
begin;
select plan(56);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'test-cat1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e2', 'test-cat2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000e3', 'test-cat3@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000e2', 'assistant');

-- Aucune donnée par défaut : la migration ne crée ni univers, ni produit, ni variante.
select is((select count(*)::int from public.univers), 0, 'aucun univers par défaut');
select is((select count(*)::int from public.produit) + (select count(*)::int from public.variante), 0, 'aucun produit ni variante par défaut');

-- Univers : création, journal, doublons, noms invalides, droits.
select lives_ok(
  $$select public.creer_univers('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, '  Shonen  ', 'Shonen EN')$$,
  'l''admin crée un univers'
);
select is((select nom_fr from public.univers where nom_en = 'Shonen EN'), 'Shonen', 'le nom est rogné');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'univers' and action = 'insert' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000e1',
  'le journal de l''univers porte l''auteur'
);
select throws_ok($$select public.creer_univers('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, 'SHONEN', 'Autre nom')$$, 'P0001', 'KS_UNIVERS_EXISTE', 'doublon français sans tenir compte de la casse');
select throws_ok($$select public.creer_univers('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, 'Autre nom', 'shonen en')$$, 'P0001', 'KS_UNIVERS_EXISTE', 'doublon anglais sans tenir compte de la casse');
select throws_ok($$select public.creer_univers('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, '   ', 'Vide')$$, 'P0001', 'KS_UNIVERS_INVALIDE', 'nom vide refusé');
select throws_ok($$select public.creer_univers('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, repeat('x', 61), 'Long')$$, 'P0001', 'KS_UNIVERS_INVALIDE', 'nom de plus de 60 caractères refusé');
select throws_ok($$select public.creer_univers('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e2","role":"admin"}'::jsonb, 'Assistant', 'Assistant')$$, 'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne crée pas d''univers');
select is((select count(*)::int from public.univers), 1, 'les refus ne créent aucun univers');

-- Produit : création d'un brouillon avec variantes.
select lives_ok(
  $$select public.enregistrer_produit(
    '{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb,
    null::uuid,
    jsonb_build_object('famille', 'cosplay', 'slug', 'cosplay-test', 'titre_fr', 'Cosplay de test', 'prix_cents', 4990,
      'delai_fabrication_jours', 14, 'univers_id', (select id from public.univers where nom_en = 'Shonen EN')),
    '[{"taille":"M","stock":2,"fabrication_sur_commande":false},{"taille":"sur_mesure"}]'::jsonb
  )$$,
  'l''admin crée un cosplay avec ses variantes'
);
select is((select publie_le is null from public.produit where slug = 'cosplay-test'), true, 'le produit créé est un brouillon');
select is((select prix_cents from public.produit where slug = 'cosplay-test'), 4990, 'prix en centimes');
select is((select devise from public.produit where slug = 'cosplay-test'), 'USD', 'devise USD');
select is((select count(*)::int from public.variante where produit_id = (select id from public.produit where slug = 'cosplay-test')), 2, 'deux variantes créées');
select is(
  (select stock = 0 and fabrication_sur_commande from public.variante where taille = 'sur_mesure' and produit_id = (select id from public.produit where slug = 'cosplay-test')),
  true,
  'sur-mesure : stock 0 et fabrication forcée'
);
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'produit' and action = 'insert' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000e1',
  'le journal du produit porte l''auteur'
);

-- Modifier le stock : journal avant et après, même ligne de variante, publication jamais posée.
create temp table ks_avant as
  select id from public.variante where taille = 'M' and produit_id = (select id from public.produit where slug = 'cosplay-test');
select lives_ok(
  $$select public.enregistrer_produit(
    '{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb,
    (select id from public.produit where slug = 'cosplay-test'),
    jsonb_build_object('famille', 'cosplay', 'slug', 'cosplay-test', 'titre_fr', 'Cosplay de test', 'prix_cents', 4990, 'delai_fabrication_jours', 14),
    '[{"taille":"M","stock":5,"fabrication_sur_commande":false},{"taille":"sur_mesure"}]'::jsonb
  )$$,
  'l''admin modifie le stock de la variante M'
);
select is((select stock from public.variante where taille = 'M' and produit_id = (select id from public.produit where slug = 'cosplay-test')), 5, 'stock enregistré');
select is(
  (select avant ->> 'stock' from public.journal_audit where cible_table = 'variante' and action = 'update' order by id desc limit 1),
  '2',
  'le journal garde le stock d''avant'
);
select is(
  (select apres ->> 'stock' from public.journal_audit where cible_table = 'variante' and action = 'update' order by id desc limit 1),
  '5',
  'le journal garde le stock d''après'
);
select is(
  (select id from public.variante where taille = 'M' and produit_id = (select id from public.produit where slug = 'cosplay-test')),
  (select id from ks_avant),
  'la variante garde le même identifiant (stable par produit et taille)'
);
select is((select univers_id is null from public.produit where slug = 'cosplay-test'), true, 'l''univers retiré du formulaire est effacé');
select is((select publie_le is null from public.produit where slug = 'cosplay-test'), true, 'modifier ne publie jamais');

-- Remplacement de l'ensemble des variantes : une taille absente est supprimée.
select lives_ok(
  $$select public.enregistrer_produit(
    '{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb,
    (select id from public.produit where slug = 'cosplay-test'),
    jsonb_build_object('famille', 'cosplay', 'slug', 'cosplay-test', 'titre_fr', 'Cosplay de test', 'prix_cents', 4990, 'delai_fabrication_jours', 14),
    '[{"taille":"M","stock":5,"fabrication_sur_commande":true,"delai_fabrication_jours":20}]'::jsonb
  )$$,
  'les variantes sont remplacées'
);
select is((select count(*)::int from public.variante where produit_id = (select id from public.produit where slug = 'cosplay-test')), 1, 'la taille absente est supprimée');

-- Un brouillon peut être incomplet : ni prix, ni texte anglais, ni variante.
select lives_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"accessoire","slug":"brouillon-test","titre_fr":"Brouillon"}'::jsonb, '[]'::jsonb)$$,
  'un brouillon incomplet est accepté'
);
select is((select prix_cents is null from public.produit where slug = 'brouillon-test'), true, 'prix absent : à fixer, jamais inventé');

-- Refus : rien n'est enregistré.
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"accessoire","slug":"cosplay-test","titre_fr":"Même adresse"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_SLUG_PRIS', 'adresse déjà prise'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"kit","slug":"kit-test","titre_fr":"Kit"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_FAMILLE_INVALIDE', 'la famille kit est refusée'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"accessoire","slug":"acc-test","titre_fr":"Accessoire"}'::jsonb, '[{"taille":"sur_mesure"}]'::jsonb)$$,
  'P0001', 'KS_TAILLE_INVALIDE', 'sur-mesure refusé pour un accessoire'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"cosplay","slug":"dup-test","titre_fr":"Doublon"}'::jsonb, '[{"taille":"M","stock":1},{"taille":"M","stock":2}]'::jsonb)$$,
  'P0001', 'KS_TAILLE_INVALIDE', 'une seule ligne par taille'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"cosplay","slug":"fab-test","titre_fr":"Fabrication"}'::jsonb, '[{"taille":"M","stock":0,"fabrication_sur_commande":true}]'::jsonb)$$,
  'P0001', 'KS_DELAI_MANQUANT', 'fabrication sur commande sans délai refusée'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"cosplay","slug":"stock-test","titre_fr":"Stock"}'::jsonb, '[{"taille":"M","stock":-1}]'::jsonb)$$,
  'P0001', 'KS_STOCK_INVALIDE', 'stock négatif refusé'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"cosplay","slug":"stock-test","titre_fr":"Stock"}'::jsonb, '[{"taille":"M","stock":2.5}]'::jsonb)$$,
  'P0001', 'KS_STOCK_INVALIDE', 'stock décimal refusé'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"cosplay","slug":"prix-test","titre_fr":"Prix","prix_cents":0}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_PRIX_INVALIDE', 'prix nul refusé'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"cosplay","slug":"Pas Bon","titre_fr":"Adresse"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_SLUG_INVALIDE', 'adresse mal formée refusée'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"cosplay","slug":"univers-test","titre_fr":"Univers","univers_id":"00000000-0000-0000-0000-00000000ffff"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_UNIVERS_INTROUVABLE', 'univers inconnu refusé'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, '00000000-0000-0000-0000-00000000ffff'::uuid,
    '{"famille":"cosplay","slug":"inconnu-test","titre_fr":"Inconnu"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_PRODUIT_INTROUVABLE', 'produit inconnu refusé'
);
select is((select count(*)::int from public.produit), 2, 'les refus ne créent aucun produit');

-- Droits : Assistant, Compte simple, sans auteur.
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e2","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"cosplay","slug":"assistant-test","titre_fr":"Assistant"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne crée pas de produit'
);
select throws_ok(
  $$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e3","role":"admin"}'::jsonb, null::uuid,
    '{"famille":"cosplay","slug":"simple-test","titre_fr":"Simple"}'::jsonb, '[]'::jsonb)$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Compte simple ne crée pas de produit'
);
select throws_ok($$select public.enregistrer_produit(null, null::uuid, '{}'::jsonb, '[]'::jsonb)$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'sans auteur refusé');

-- Écriture directe sans auteur : refusée par le trigger de journal.
set local ks.auteur = '';
select throws_ok($$update public.produit set titre_fr = 'Pirate' where slug = 'cosplay-test'$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'une écriture directe sans auteur est refusée');

-- RLS : seuls les produits publiés et passés (et leurs variantes) sont visibles ; les univers le sont tous.
select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, null::uuid,
  '{"famille":"accessoire","slug":"futur-test","titre_fr":"Futur"}'::jsonb, '[{"taille":"S","stock":1}]'::jsonb);
select set_config('ks.auteur', '{"type":"test"}', true);
update public.produit set publie_le = now() - interval '1 day' where slug = 'cosplay-test';
update public.produit set publie_le = now() + interval '1 day' where slug = 'futur-test';

set local role anon;
select is((select count(*)::int from public.produit), 1, 'anon ne voit que le produit publié (ni brouillon, ni publié futur)');
select is((select slug from public.produit), 'cosplay-test', 'anon voit le produit publié');
select is((select count(*)::int from public.variante), 1, 'anon ne voit que les variantes du produit publié');
select is((select count(*)::int from public.univers), 1, 'anon lit les univers');
select throws_ok($$insert into public.produit (famille, slug, titre_fr) values ('cosplay', 'anon-test', 'Anon')$$, '42501', null, 'anon n''écrit pas dans produit');
select throws_ok($$update public.variante set stock = 99$$, '42501', null, 'anon n''écrit pas dans variante');
select throws_ok($$select public.creer_univers('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, 'Anon', 'Anon')$$, '42501', null, 'creer_univers non exécutable par anon');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select is((select count(*)::int from public.produit), 1, 'un Compte connecté ne voit que le produit publié');
select throws_ok($$delete from public.univers$$, '42501', null, 'un Compte connecté n''écrit pas dans univers');
select throws_ok($$select public.enregistrer_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000e1","role":"admin"}'::jsonb, null::uuid, '{}'::jsonb, '[]'::jsonb)$$, '42501', null, 'enregistrer_produit non exécutable par authenticated');
reset role;

select ok(
  has_function_privilege('service_role', 'public.creer_univers(jsonb, text, text)', 'execute')
  and has_function_privilege('service_role', 'public.enregistrer_produit(jsonb, uuid, jsonb, jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.enregistrer_produit(jsonb, uuid, jsonb, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.creer_univers(jsonb, text, text)', 'execute'),
  'les fonctions d''écriture sont réservées au service_role'
);

select * from finish();
rollback;
