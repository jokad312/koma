-- Story 2.5 : disponibilite_variantes (état et délai effectif de chaque taille, jamais de quantité).
-- Les données de ce test sont créées dans la transaction, puis annulées.
begin;
select plan(18);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);

insert into public.produit (id, famille, slug, titre_fr, titre_en, prix_cents, delai_fabrication_jours, publie_le) values
  ('00000000-0000-0000-0000-00000000d001', 'cosplay', 'dv-publie', 'Publié', 'Published', 5000, 14, now() - interval '1 minute'),
  ('00000000-0000-0000-0000-00000000d002', 'cosplay', 'dv-brouillon', 'Brouillon', 'Draft', 5000, 14, null),
  ('00000000-0000-0000-0000-00000000d003', 'cosplay', 'dv-futur', 'Futur', 'Future', 5000, 14, now() + interval '1 day'),
  ('00000000-0000-0000-0000-00000000d004', 'accessoire', 'dv-sans-delai', 'Sans délai', 'No lead time', 900, null, now() - interval '1 minute');

insert into public.variante (produit_id, taille, stock, fabrication_sur_commande, delai_fabrication_jours) values
  ('00000000-0000-0000-0000-00000000d001', 'M', 3, false, null),
  ('00000000-0000-0000-0000-00000000d001', 'S', 0, true, null),
  ('00000000-0000-0000-0000-00000000d001', 'L', 0, true, 21),
  ('00000000-0000-0000-0000-00000000d001', 'XL', 0, false, null),
  ('00000000-0000-0000-0000-00000000d001', 'XS', 2, true, 30),
  ('00000000-0000-0000-0000-00000000d001', 'sur_mesure', 0, true, null),
  ('00000000-0000-0000-0000-00000000d002', 'M', 3, false, null),
  ('00000000-0000-0000-0000-00000000d003', 'M', 3, false, null),
  ('00000000-0000-0000-0000-00000000d004', 'M', 0, true, null);

set local role anon;

select is(
  (select array_agg(taille) from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d001')),
  array['XS', 'S', 'M', 'L', 'XL', 'sur_mesure'],
  'les tailles sont dans l''ordre XS à XXL puis sur mesure');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d001') where taille = 'M'), 'en_stock', 'du stock : en_stock');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d001') where taille = 'S'), 'sur_commande', 'sans stock mais fabriquée sur commande : sur_commande');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d001') where taille = 'XL'), 'indisponible', 'sans stock ni fabrication : indisponible');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d001') where taille = 'XS'), 'en_stock', 'du stock et de la fabrication : en_stock');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d001') where taille = 'sur_mesure'), 'sur_commande', 'le sur-mesure est toujours en fabrication');

select is((select delai_jours from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d001') where taille = 'S'), 14, 'délai du produit quand la variante n''en a pas');
select is((select delai_jours from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d001') where taille = 'L'), 21, 'délai de la variante quand elle en a un');
select is((select delai_jours from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d004') where taille = 'M'), null, 'aucun délai fixé : nul, jamais inventé');

-- Aucune quantité dans les colonnes renvoyées.
select is(
  (select array_agg(c order by c) from (
     select unnest(proargnames[(pronargs + 1):]) as c from pg_proc where oid = 'public.disponibilite_variantes(uuid)'::regprocedure) x),
  array['delai_jours', 'etat', 'taille'],
  'la fonction ne renvoie que taille, état et délai : aucune quantité');

select is((select count(*)::int from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d002')), 0, 'un brouillon est invisible');
select is((select count(*)::int from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d003')), 0, 'un produit publié dans le futur est invisible');
select is((select count(*)::int from public.disponibilite_variantes('00000000-0000-0000-0000-0000000000ff')), 0, 'un produit inconnu : aucune ligne');

-- Plafond de fabrication atteint : plus de fabrication sur commande, le stock reste vendable.
reset role;
insert into public.reglage (cle, valeur) values ('plafond_fabrication', '5') on conflict (cle) do update set valeur = excluded.valeur;
create or replace function public.places_fabrication_utilisees() returns integer language sql stable security invoker set search_path = '' as $$ select 5 $$;
set local role anon;
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d001') where taille = 'S'), 'complet', 'capacité atteinte : complet, jamais épuisé');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d001') where taille = 'M'), 'en_stock', 'capacité atteinte : le stock reste en_stock');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d001') where taille = 'sur_mesure'), 'complet', 'capacité atteinte : le sur-mesure est complet');
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d001') where taille = 'XS'), 'en_stock', 'capacité atteinte : une taille en stock et fabricable reste en_stock');

-- Même résultat pour un compte connecté.
reset role;
set local role authenticated;
select is((select etat from public.disponibilite_variantes('00000000-0000-0000-0000-00000000d001') where taille = 'M'), 'en_stock', 'authenticated lit aussi la disponibilité');
reset role;

select * from finish();
rollback;
