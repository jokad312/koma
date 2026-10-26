-- Correctif 2.1/2.3 : le public ne voit jamais le stock exact (privilèges par colonne, stock_disponible réservée, états aux bornes).
-- Les données de ce test sont créées dans la transaction, puis annulées.
begin;
select plan(55);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);

insert into public.produit (id, famille, slug, titre_fr, titre_en, description_fr, description_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('00000000-0000-0000-0000-00000000e001', 'cosplay', 'sne-publie', 'Publié', 'Published', 'D', 'D', 5000, 14, now() - interval '1 minute'),
  ('00000000-0000-0000-0000-00000000e002', 'cosplay', 'sne-brouillon', 'Brouillon', 'Draft', 'D', 'D', 5000, 14, null),
  ('00000000-0000-0000-0000-00000000e003', 'cosplay', 'sne-zero', 'Zéro', 'Zero', 'D', 'D', 5000, 14, now() - interval '1 minute'),
  ('00000000-0000-0000-0000-00000000e004', 'cosplay', 'sne-un', 'Un', 'One', 'D', 'D', 5000, 14, now() - interval '1 minute'),
  ('00000000-0000-0000-0000-00000000e005', 'cosplay', 'sne-seuil', 'Seuil', 'Threshold', 'D', 'D', 5000, 14, now() - interval '1 minute'),
  ('00000000-0000-0000-0000-00000000e006', 'cosplay', 'sne-seuil-plus-un', 'Seuil+1', 'Threshold+1', 'D', 'D', 5000, 14, now() - interval '1 minute'),
  ('00000000-0000-0000-0000-00000000e007', 'cosplay', 'sne-fabrication', 'Fabrication', 'Made', 'D', 'D', 5000, 14, now() - interval '1 minute'),
  ('00000000-0000-0000-0000-00000000e008', 'cosplay', 'sne-mixte', 'Mixte', 'Mixed', 'D', 'D', 5000, 14, now() - interval '1 minute'),
  ('00000000-0000-0000-0000-00000000e009', 'cosplay', 'sne-pieces-fabrication', 'Pièces et fabrication', 'Pieces and made', 'D', 'D', 5000, 14, now() - interval '1 minute');
insert into public.produit_photo (produit_id, fichier, alt_fr, alt_en, position)
select p.id, p.id::text || '/a.jpg', 'Alt', 'Alt', 1 from public.produit p where p.slug like 'sne-%';

insert into public.variante (id, produit_id, taille, stock, fabrication_sur_commande) values
  ('00000000-0000-0000-0000-00000000f001', '00000000-0000-0000-0000-00000000e001', 'M', 12, false),
  ('00000000-0000-0000-0000-00000000f002', '00000000-0000-0000-0000-00000000e002', 'M', 9, false),
  ('00000000-0000-0000-0000-00000000f003', '00000000-0000-0000-0000-00000000e003', 'M', 0, false),
  ('00000000-0000-0000-0000-00000000f004', '00000000-0000-0000-0000-00000000e004', 'M', 1, false),
  ('00000000-0000-0000-0000-00000000f005', '00000000-0000-0000-0000-00000000e005', 'M', 3, false),
  ('00000000-0000-0000-0000-00000000f006', '00000000-0000-0000-0000-00000000e006', 'M', 4, false),
  ('00000000-0000-0000-0000-00000000f007', '00000000-0000-0000-0000-00000000e007', 'M', 0, true),
  ('00000000-0000-0000-0000-00000000f008', '00000000-0000-0000-0000-00000000e008', 'M', 0, false),
  ('00000000-0000-0000-0000-00000000f009', '00000000-0000-0000-0000-00000000e008', 'L', 1, false),
  ('00000000-0000-0000-0000-00000000f00a', '00000000-0000-0000-0000-00000000e009', 'M', 2, true);

-- Privilèges : jamais stock pour les rôles publics.
select ok(not has_column_privilege('anon', 'public.variante', 'stock', 'select'), 'anon n''a pas le privilège select sur variante.stock');
select ok(not has_column_privilege('authenticated', 'public.variante', 'stock', 'select'), 'authenticated n''a pas le privilège select sur variante.stock');
select ok(not has_table_privilege('anon', 'public.variante', 'select') and not has_table_privilege('authenticated', 'public.variante', 'select'),
  'aucun select au niveau de la table variante pour anon et authenticated');
select ok(
  has_column_privilege('anon', 'public.variante', 'taille', 'select')
  and has_column_privilege('authenticated', 'public.variante', 'fabrication_sur_commande', 'select')
  and has_column_privilege('anon', 'public.variante', 'delai_fabrication_jours', 'select')
  and has_column_privilege('anon', 'public.variante', 'id', 'select')
  and has_column_privilege('anon', 'public.variante', 'produit_id', 'select')
  and has_column_privilege('anon', 'public.variante', 'cree_le', 'select'),
  'les autres colonnes de variante restent lisibles');
select is(
  (select array_agg(a.attname::text order by a.attname) from pg_attribute a
   where a.attrelid = 'public.variante'::regclass and a.attnum > 0 and not a.attisdropped
     and has_column_privilege('anon', a.attrelid, a.attnum, 'select')),
  array['cree_le', 'delai_fabrication_jours', 'fabrication_sur_commande', 'id', 'produit_id', 'taille'],
  'anon lit exactement les six colonnes autorisées');
select ok(
  not has_function_privilege('anon', 'public.stock_disponible(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.stock_disponible(uuid)', 'execute')
  and has_function_privilege('service_role', 'public.stock_disponible(uuid)', 'execute'),
  'stock_disponible : refusée à anon et authenticated, permise au service_role');
select ok(
  not has_function_privilege('anon', 'public.seuil_dernieres_pieces()', 'execute')
  and not has_function_privilege('authenticated', 'public.etat_disponibilite(integer, boolean, boolean)', 'execute')
  and not has_function_privilege('anon', 'public.rang_disponibilite(text)', 'execute'),
  'les fonctions internes d''état ne sont pas exécutables par les rôles publics');

-- Realtime ne respecte pas les droits par colonne : variante n'est pas publiée.
select is((select count(*)::int from pg_publication_tables where schemaname = 'public' and tablename = 'variante'), 0, 'variante est absente de toute publication (Realtime)');

-- Aucun privilège d'écriture ni de référence sur stock pour les rôles publics.
select ok(
  not has_column_privilege('anon', 'public.variante', 'stock', 'insert')
  and not has_column_privilege('anon', 'public.variante', 'stock', 'update')
  and not has_column_privilege('anon', 'public.variante', 'stock', 'references')
  and not has_column_privilege('authenticated', 'public.variante', 'stock', 'insert')
  and not has_column_privilege('authenticated', 'public.variante', 'stock', 'update')
  and not has_column_privilege('authenticated', 'public.variante', 'stock', 'references'),
  'anon et authenticated n''ont ni insert, ni update, ni references sur variante.stock');

-- journal_audit (avant et après de chaque écriture, donc le stock) n'est lisible par aucun rôle public.
select ok(
  not has_table_privilege('anon', 'public.journal_audit', 'select')
  and not has_table_privilege('authenticated', 'public.journal_audit', 'select')
  and not has_any_column_privilege('anon', 'public.journal_audit', 'select')
  and not has_any_column_privilege('authenticated', 'public.journal_audit', 'select'),
  'journal_audit n''est lisible ni par anon ni par authenticated');

-- Garde générique : aucune colonne de stock ou de quantité lisible par un rôle public, dans toute table, vue ou vue matérialisée de public.
create temp view ks_colonnes_quantite_ouvertes as
select c.relname || '.' || a.attname as colonne
from pg_attribute a
join pg_class c on c.oid = a.attrelid
where c.relnamespace = 'public'::regnamespace
  and c.relkind in ('r', 'v', 'm', 'p', 'f')
  and a.attnum > 0
  and not a.attisdropped
  and a.attname ~* '(stock|quantite|qty|quantity)'
  and (has_column_privilege('anon', c.oid, a.attnum, 'select') or has_column_privilege('authenticated', c.oid, a.attnum, 'select'));
select is(
  (select coalesce(array_agg(colonne order by colonne), '{}') from ks_colonnes_quantite_ouvertes),
  '{}'::text[],
  'aucune colonne stock, quantite, qty ou quantity n''est lisible par anon ou authenticated');
-- Preuve que le garde échoue : une telle colonne rendue lisible est détectée.
create table public.ks_test_quantite (id int, stock_exact int);
grant select on public.ks_test_quantite to authenticated;
select is(
  (select coalesce(array_agg(colonne order by colonne), '{}') from ks_colonnes_quantite_ouvertes),
  '{ks_test_quantite.stock_exact}'::text[],
  'une colonne de stock lisible par authenticated est détectée par le garde');

-- anon.
set local role anon;
select throws_ok($$select stock from public.variante$$, '42501', null, 'anon : select stock refusé');
select throws_ok($$select * from public.variante$$, '42501', null, 'anon : select * refusé');
select throws_ok($$select v.stock from public.variante v where v.taille = 'M'$$, '42501', null, 'anon : stock refusé même avec un filtre');
select throws_ok($$select public.stock_disponible('00000000-0000-0000-0000-00000000f001')$$, '42501', null, 'anon : stock_disponible refusée');
select throws_ok($$select public.seuil_dernieres_pieces()$$, '42501', null, 'anon : seuil_dernieres_pieces refusée');
select is((select count(*)::int from public.variante where produit_id = '00000000-0000-0000-0000-00000000e001'), 1, 'anon lit les variantes sans colonne de stock (count)');
select is((select taille from public.variante where produit_id = '00000000-0000-0000-0000-00000000e001'), 'M', 'anon lit la taille d''une variante publiée');
select is((select count(*)::int from public.variante where produit_id = '00000000-0000-0000-0000-00000000e002'), 0, 'anon ne voit pas les variantes d''un brouillon');
-- Requêtes « oracle » (déduire le stock par filtre, tri ou mise à jour conditionnelle) : refusées.
select throws_ok($$select id from public.variante where stock > 5$$, '42501', null, 'anon : filtre sur stock refusé');
select throws_ok($$select id from public.variante order by stock$$, '42501', null, 'anon : tri sur stock refusé');
select throws_ok($$update public.variante set taille = taille where stock = 1$$, '42501', null, 'anon : update conditionné par stock refusé');
reset role;

-- authenticated.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e3","role":"authenticated"}';
select throws_ok($$select stock from public.variante$$, '42501', null, 'authenticated : select stock refusé');
select throws_ok($$select * from public.variante$$, '42501', null, 'authenticated : select * refusé');
select throws_ok($$select public.stock_disponible('00000000-0000-0000-0000-00000000f001')$$, '42501', null, 'authenticated : stock_disponible refusée');
select throws_ok($$select id from public.variante where stock > 5$$, '42501', null, 'authenticated : filtre sur stock refusé');
select throws_ok($$select id from public.variante order by stock$$, '42501', null, 'authenticated : tri sur stock refusé');
select throws_ok($$update public.variante set taille = taille where stock = 1$$, '42501', null, 'authenticated : update conditionné par stock refusé');
reset role;

-- service_role : stock exact.
set local role service_role;
select is(public.stock_disponible('00000000-0000-0000-0000-00000000f001'), 12, 'service_role : stock exact d''une variante publiée');
select is((select stock from public.variante where id = '00000000-0000-0000-0000-00000000f002'), 9, 'service_role : lit variante.stock (admin)');
reset role;

-- Seuil.
select is(public.seuil_dernieres_pieces(), 3, 'le seuil « dernières pièces » vaut 3');

-- États aux bornes, vus par anon.
set local role anon;
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000e001')), 'disponible', 'stock 12 : disponible');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000e003')), 'epuise', 'stock 0 sans fabrication : epuise');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000e004')), 'dernieres_pieces', 'stock 1 : dernieres_pieces');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000e005')), 'dernieres_pieces', 'stock égal au seuil (3) : dernieres_pieces');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000e006')), 'disponible', 'stock seuil + 1 (4) : disponible');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000e007')), 'sur_commande', 'stock 0 et fabrication, capacité libre : sur_commande');
select is(
  (select disponibilite from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 300) where slug = 'sne-mixte'),
  'dernieres_pieces', 'produit : le meilleur état de ses variantes (épuisée + 1 pièce)');
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, 'en_stock', 'nouveautes', null, null, null, 300) where slug like 'sne-%'),
  6, 'filtre en_stock : disponible et dernieres_pieces (stock 12, 1, 3, 4, le produit mixte et le produit 2 pièces avec fabrication)');
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, 'epuise', 'nouveautes', null, null, null, 300) where slug like 'sne-%'),
  1, 'filtre epuise : un produit');
reset role;

-- Visibilité identique à celle de produit pour anon : mêmes identifiants publiés, dans le listage et dans la disponibilité.
set local role anon;
select is(
  (select array_agg(id order by id) from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 300) where slug like 'sne-%'),
  (select array_agg(id order by id) from public.produit where slug like 'sne-%'),
  'lister_catalogue montre à anon exactement les produits que select produit lui montre');
select is(
  (select array_agg(p.id order by p.id) from public.produit p where p.slug like 'sne-%' and exists (select 1 from public.disponibilite_variantes(p.id))),
  (select array_agg(id order by id) from public.produit where slug like 'sne-%'),
  'disponibilite_variantes a des lignes pour anon exactement pour les produits que select produit lui montre');
reset role;

-- Capacité atteinte : sur_commande devient complet, jamais epuise.
insert into public.reglage (cle, valeur) values ('plafond_fabrication', '5') on conflict (cle) do update set valeur = excluded.valeur;
create or replace function public.places_fabrication_utilisees() returns integer language sql stable security invoker set search_path = '' as $$ select 5 $$;
set local role anon;
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000e007')), 'complet', 'stock 0 et fabrication, capacité atteinte : complet');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000e003')), 'epuise', 'capacité atteinte : sans fabrication, toujours epuise');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000e001')), 'disponible', 'capacité atteinte : le stock reste disponible');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000e009')), 'dernieres_pieces', 'stock 2 avec fabrication permise et capacité atteinte : reste dernieres_pieces');
reset role;

-- Aucune colonne de quantité dans les fonctions publiques.
select is(
  (select array_agg(c order by c) from (
     select unnest(proargnames[(pronargs + 1):]) as c from pg_proc where oid = 'public.disponibilite_variantes(uuid)'::regprocedure) x),
  array['delai_jours', 'etat', 'taille'],
  'disponibilite_variantes ne renvoie que taille, état et délai');
select is(
  (select count(*)::int from pg_proc p, unnest(coalesce(p.proargnames, '{}')) as nom
   where p.proname in ('lister_catalogue', 'disponibilite_variantes') and (nom ilike '%stock%' or nom ilike '%quantite%')),
  0, 'aucune colonne de quantité dans lister_catalogue ni disponibilite_variantes');
select ok(
  (select bool_and(prosecdef) from pg_proc where proname in ('lister_catalogue', 'disponibilite_variantes') and pronamespace = 'public'::regnamespace),
  'lister_catalogue et disponibilite_variantes sont security definer');
select ok(
  (select bool_and(p.proconfig @> array['search_path=""']) from pg_proc p
   where p.proname in ('lister_catalogue', 'disponibilite_variantes') and p.pronamespace = 'public'::regnamespace),
  'elles épinglent un search_path vide');

-- Un brouillon reste invisible (prédicat explicite, fonctions security definer).
select is((select count(*)::int from public.disponibilite_variantes('00000000-0000-0000-0000-00000000e002')), 0, 'un brouillon n''a aucune disponibilité publique');
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 300) where slug = 'sne-brouillon'),
  0, 'un brouillon n''est pas listé');
set local role anon;
select is((select count(*)::int from public.disponibilite_variantes('00000000-0000-0000-0000-00000000e002')), 0, 'anon : un brouillon n''a aucune disponibilité publique');
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 300) where slug = 'sne-brouillon'),
  0, 'anon : un brouillon n''est pas listé');
reset role;

select * from finish();
rollback;
