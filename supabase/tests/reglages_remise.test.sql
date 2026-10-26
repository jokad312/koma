-- Story 2.3 : forfaits, retrait, Plafond de fabrication, tranches de prix, stock_disponible, places_fabrication_utilisees.
begin;
select plan(56);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f1', 'test-rem1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'test-rem2@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000f2', 'assistant');

-- Aucune valeur par défaut.
select is((select count(*)::int from public.reglage where cle in ('forfait_livraison_goma_cents', 'forfait_livraison_bukavu_cents', 'retrait_goma_fr', 'retrait_goma_en', 'plafond_fabrication')), 0, 'aucun réglage de remise par défaut');
select is((select count(*)::int from public.tranche_prix), 0, 'aucune tranche par défaut');

-- Forfaits : centimes entiers, 0 à 100 000, journalisés.
select lives_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'forfait_livraison_goma_cents', '550')$$, 'l''admin fixe le forfait de Goma');
select is((select valeur from public.reglage where cle = 'forfait_livraison_goma_cents'), '550', 'forfait enregistré en centimes');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'reglage' and cible_id = 'forfait_livraison_goma_cents' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000f1',
  'le journal du forfait porte l''auteur'
);
select is(
  (select apres ->> 'valeur' from public.journal_audit where cible_table = 'reglage' and cible_id = 'forfait_livraison_goma_cents' order by id desc limit 1),
  '550',
  'le journal du forfait garde la valeur'
);
select lives_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'forfait_livraison_bukavu_cents', '0')$$, 'un forfait gratuit (0) est accepté');
select is((select valeur from public.reglage where cle = 'forfait_livraison_bukavu_cents'), '0', 'forfait 0 enregistré');
select lives_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'forfait_livraison_bukavu_cents', '100000')$$, 'le plafond du forfait (100 000) est accepté');
select throws_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'forfait_livraison_goma_cents', '100001')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'un forfait au-dessus de 100 000 est refusé');
select throws_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'forfait_livraison_goma_cents', '-1')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'un forfait négatif est refusé');
select throws_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'forfait_livraison_goma_cents', 'abc')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'un forfait non numérique est refusé');
select throws_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'forfait_livraison_goma_cents', '5.5')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'un forfait décimal est refusé');
select is((select valeur from public.reglage where cle = 'forfait_livraison_goma_cents'), '550', 'les refus ne changent rien');
select lives_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'forfait_livraison_goma_cents', '  ')$$, 'un forfait vide est accepté (effacé)');
select is((select valeur from public.reglage where cle = 'forfait_livraison_goma_cents'), null, 'le forfait est effacé');

-- Retrait : 1 à 500 caractères, vide = effacé.
select lives_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'retrait_goma_fr', '  Texte de test  ')$$, 'l''admin fixe le lieu de retrait français');
select is((select valeur from public.reglage where cle = 'retrait_goma_fr'), 'Texte de test', 'le retrait est rogné');
select lives_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'retrait_goma_en', repeat('x', 500))$$, '500 caractères acceptés');
select throws_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'retrait_goma_en', repeat('x', 501))$$, 'P0001', 'KS_REGLAGE_INVALIDE', '501 caractères refusés');
select lives_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'retrait_goma_en', '')$$, 'un retrait vide est accepté (effacé)');
select is((select valeur from public.reglage where cle = 'retrait_goma_en'), null, 'le retrait est effacé');

-- Plafond de fabrication : entier de 1 à 10 000.
select lives_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'plafond_fabrication', '40')$$, 'l''admin fixe le Plafond');
select is((select valeur from public.reglage where cle = 'plafond_fabrication'), '40', 'Plafond enregistré');
select throws_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'plafond_fabrication', '0')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'Plafond 0 refusé');
select throws_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'plafond_fabrication', '2,5')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'Plafond décimal refusé');
select throws_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'plafond_fabrication', '10001')$$, 'P0001', 'KS_REGLAGE_INVALIDE', 'Plafond au-dessus de 10 000 refusé');

-- Droits.
select throws_ok($$select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f2","role":"admin"}'::jsonb, 'plafond_fabrication', '5')$$, 'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne règle pas le Plafond');
select throws_ok($$select public.enregistrer_tranches_prix('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f2","role":"admin"}'::jsonb, '[]'::jsonb)$$, 'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne règle pas les tranches');
select throws_ok($$select public.enregistrer_tranches_prix(null, '[]'::jsonb)$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'tranches sans auteur refusées');

-- Lecture publique : forfaits et retrait lisibles, plafond illisible.
select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'forfait_livraison_goma_cents', '300');
select public.enregistrer_reglage('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, 'retrait_goma_en', 'Pickup text');
set local role anon;
select is((select count(*)::int from public.reglage where cle in ('forfait_livraison_goma_cents', 'forfait_livraison_bukavu_cents', 'retrait_goma_fr', 'retrait_goma_en')), 4, 'anon lit les forfaits et le retrait');
select is((select count(*)::int from public.reglage where cle = 'plafond_fabrication'), 0, 'anon ne lit pas le Plafond de fabrication');
reset role;

-- Tranches : remplacement complet, ordre conservé, journal.
select lives_ok(
  $$select public.enregistrer_tranches_prix('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    '[{"libelle_fr":"  Petit  ","libelle_en":"Small","bas_cents":0,"haut_cents":2000},
      {"libelle_fr":"Moyen","libelle_en":"Medium","bas_cents":2000,"haut_cents":5000},
      {"libelle_fr":"Grand","libelle_en":"Large","bas_cents":5000,"haut_cents":null}]'::jsonb)$$,
  'l''admin enregistre trois tranches'
);
select is((select array_agg(libelle_fr order by ordre) from public.tranche_prix), array['Petit', 'Moyen', 'Grand'], 'ordre conservé et libellé rogné');
select is((select haut_cents from public.tranche_prix where ordre = 3), null, 'la dernière tranche est ouverte');
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'tranche_prix' and action = 'insert' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000f1',
  'le journal des tranches porte l''auteur'
);
select lives_ok(
  $$select public.enregistrer_tranches_prix('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    '[{"libelle_fr":"Tout","libelle_en":"All","bas_cents":0}]'::jsonb)$$,
  'une nouvelle liste remplace la précédente'
);
select is((select count(*)::int from public.tranche_prix), 1, 'une seule tranche reste');

-- Tranches refusées : rien ne change.
select throws_ok($$select public.enregistrer_tranches_prix('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, '[{"libelle_fr":"A","libelle_en":"A","bas_cents":500,"haut_cents":500}]'::jsonb)$$, 'P0001', 'KS_TRANCHE_INVALIDE', 'haut égal à bas refusé');
select throws_ok($$select public.enregistrer_tranches_prix('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, '[{"libelle_fr":"  ","libelle_en":"A","bas_cents":0}]'::jsonb)$$, 'P0001', 'KS_TRANCHE_INVALIDE', 'libellé vide refusé');
select throws_ok(
  $$select public.enregistrer_tranches_prix('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb,
    (select jsonb_agg(jsonb_build_object('libelle_fr', 'T' || g, 'libelle_en', 'T' || g, 'bas_cents', g * 100, 'haut_cents', g * 100 + 50)) from generate_series(1, 9) g))$$,
  'P0001', 'KS_TRANCHE_INVALIDE', 'neuf tranches refusées'
);
select throws_ok($$select public.enregistrer_tranches_prix('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, '[{"libelle_fr":"A","libelle_en":"A","bas_cents":-1}]'::jsonb)$$, 'P0001', 'KS_TRANCHE_INVALIDE', 'borne basse négative refusée');
select is((select count(*)::int from public.tranche_prix where libelle_fr = 'Tout'), 1, 'les refus ne changent rien');
select lives_ok($$select public.enregistrer_tranches_prix('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, '[]'::jsonb)$$, 'une liste vide est acceptée');
select is((select count(*)::int from public.tranche_prix), 0, 'plus aucune tranche');

-- Lecture publique et écriture directe des tranches.
select public.enregistrer_tranches_prix('{"type":"compte","id":"00000000-0000-0000-0000-0000000000f1","role":"admin"}'::jsonb, '[{"libelle_fr":"A","libelle_en":"A","bas_cents":0}]'::jsonb);
set local role anon;
select is((select count(*)::int from public.tranche_prix), 1, 'anon lit les tranches');
select throws_ok($$insert into public.tranche_prix (ordre, libelle_fr, libelle_en, bas_cents) values (2, 'x', 'x', 0)$$, '42501', null, 'anon n''écrit pas dans tranche_prix');
reset role;
select ok(
  not has_function_privilege('anon', 'public.enregistrer_tranches_prix(jsonb, jsonb)', 'execute')
  and not has_function_privilege('authenticated', 'public.enregistrer_tranches_prix(jsonb, jsonb)', 'execute')
  and has_function_privilege('service_role', 'public.enregistrer_tranches_prix(jsonb, jsonb)', 'execute'),
  'enregistrer_tranches_prix est réservée au service_role'
);

-- stock_disponible et places_fabrication_utilisees.
select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into public.produit (id, famille, slug, titre_fr, prix_cents, publie_le) values
  ('00000000-0000-0000-0000-00000000fa01', 'cosplay', 'remise-publie', 'Publié', 1000, now() - interval '1 day'),
  ('00000000-0000-0000-0000-00000000fa02', 'cosplay', 'remise-brouillon', 'Brouillon', 1000, null);
insert into public.variante (id, produit_id, taille, stock) values
  ('00000000-0000-0000-0000-00000000fb01', '00000000-0000-0000-0000-00000000fa01', 'M', 7),
  ('00000000-0000-0000-0000-00000000fb02', '00000000-0000-0000-0000-00000000fa02', 'M', 3);
set local role anon;
select throws_ok($$select public.stock_disponible('00000000-0000-0000-0000-00000000fb01')$$, '42501', null, 'anon : stock_disponible refusée (le stock exact n''est pas public)');
select is(public.places_fabrication_utilisees(), 0, 'anon : aucune place de fabrication utilisée');
reset role;
select is(public.stock_disponible('00000000-0000-0000-0000-00000000fb01'), 7, 'le propriétaire lit le stock d''une variante publiée');
select is(public.stock_disponible('00000000-0000-0000-0000-00000000fb02'), 3, 'le propriétaire voit le stock d''un brouillon');
select is(public.stock_disponible('00000000-0000-0000-0000-00000000ffff'), null, 'variante inconnue : valeur nulle');
set local role service_role;
select is(public.stock_disponible('00000000-0000-0000-0000-00000000fb02'), 3, 'le service_role lit le stock exact');
reset role;
select ok(
  not has_function_privilege('anon', 'public.stock_disponible(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.stock_disponible(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.stock_disponible(uuid)', 'execute')
  and has_function_privilege('anon', 'public.places_fabrication_utilisees()', 'execute')
  and has_function_privilege('authenticated', 'public.places_fabrication_utilisees()', 'execute'),
  'stock_disponible est réservée au service_role ; places_fabrication_utilisees reste publique'
);
select ok(
  (select bool_and(p.provolatile = 's' and not p.prosecdef)
   from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('stock_disponible', 'places_fabrication_utilisees')),
  'les deux fonctions sont stables (lecture pure) et security invoker'
);

select * from finish();
rollback;
