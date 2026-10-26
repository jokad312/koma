-- Story 2.4 : listage public du catalogue (lister_catalogue) et capacite_fabrication_atteinte.
-- Les données de ce test sont créées dans la transaction, puis annulées.
begin;
select plan(41);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);

insert into public.univers (id, nom_fr, nom_en) values
  ('00000000-0000-0000-0000-00000000a001', 'Univers A', 'Universe A'),
  ('00000000-0000-0000-0000-00000000a002', 'Univers B', 'Universe B');

-- 30 cosplays publiés : 7 dates de publication et 5 prix seulement, donc beaucoup d'égalités (le départage par identifiant est exercé).
insert into public.produit (famille, slug, titre_fr, titre_en, description_fr, description_en, univers_id, prix_cents, publie_le)
select 'cosplay', 'cat-c-' || lpad(n::text, 2, '0'), 'Cosplay ' || n, 'Cosplay en ' || n, 'Description', 'Description',
  case when n <= 10 then '00000000-0000-0000-0000-00000000a001'::uuid else '00000000-0000-0000-0000-00000000a002'::uuid end,
  1000 + (n % 5) * 500,
  now() - ((n % 7) || ' minutes')::interval
from generate_series(1, 30) as n;

-- Cas particuliers.
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, publie_le) values
  ('cosplay', 'cat-sur-commande', 'Sur commande', 'Made to order', 3000, now() - interval '1 minute'),
  ('cosplay', 'cat-indispo', 'Indispo', 'Unavailable', 3000, now() - interval '2 minutes'),
  ('cosplay', 'cat-sans-photo', 'Sans photo', 'No photo', 3000, now() - interval '3 minutes'),
  ('cosplay', 'cat-brouillon', 'Brouillon', 'Draft', 3000, null),
  ('cosplay', 'cat-futur', 'Futur', 'Future', 3000, now() + interval '1 day'),
  ('cosplay', 'cat-depublie', 'Depublie', 'Unpublished', 3000, now() - interval '4 minutes'),
  ('accessoire', 'cat-acc-1', 'Accessoire un', 'Accessory one', 800, now() - interval '5 minutes');

insert into public.produit_photo (produit_id, fichier, alt_fr, alt_en, position)
select p.id, p.id::text || '/a.jpg', 'Alt fr ' || p.slug, 'Alt en ' || p.slug, 1
from public.produit p where p.slug like 'cat-%' and p.slug <> 'cat-sans-photo';
-- Une deuxième photo : seule la première (position 1) sert à la carte.
insert into public.produit_photo (produit_id, fichier, alt_fr, alt_en, position)
select p.id, p.id::text || '/b.jpg', 'Seconde fr', 'Seconde en', 2 from public.produit p where p.slug = 'cat-c-01';

insert into public.variante (produit_id, taille, stock, fabrication_sur_commande)
select p.id, 'M', case when p.slug = 'cat-c-03' then 2 else 10 end, false from public.produit p
where p.slug like 'cat-c-%' or p.slug in ('cat-sans-photo', 'cat-brouillon', 'cat-futur', 'cat-depublie', 'cat-acc-1');
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande)
select p.id, 'L', 0, true from public.produit p where p.slug = 'cat-sur-commande';
insert into public.variante (produit_id, taille, stock, fabrication_sur_commande)
select p.id, 'M', 0, false from public.produit p where p.slug = 'cat-indispo';

-- Texte alternatif anglais vide (espaces) : repli sur le français.
update public.produit_photo set alt_en = ' ' where fichier like '%/a.jpg' and produit_id = (select id from public.produit where slug = 'cat-c-02');

-- Dépublié après coup : disparaît du listage.
update public.produit set publie_le = null where slug = 'cat-depublie';

-- Ordres attendus, calculés depuis les tables (sans passer par la fonction).
create temp table ks_attendu as
with visibles as (
  select p.* from public.produit p
  where p.famille = 'cosplay' and p.publie_le is not null and p.publie_le <= now()
    and exists (select 1 from public.produit_photo f where f.produit_id = p.id)
)
select
  (select array_agg(id::text order by publie_le desc, id desc) from visibles) as nouveautes,
  (select array_agg(id::text order by prix_cents asc, id asc) from visibles) as prix_asc,
  (select array_agg(id::text order by prix_cents desc, id desc) from visibles) as prix_desc;
grant select on ks_attendu to public;

-- Parcours complet par pages (p_taille produits par page, une ligne de plus lue pour savoir s'il en reste).
create function pg_temp.ks_parcourir(p_tri text, p_taille integer) returns text[]
language plpgsql as $$
declare
  v_ids text[] := '{}';
  v_date timestamptz;
  v_prix integer;
  v_id uuid;
  v_lignes integer;
  v_tour integer := 0;
  r record;
begin
  loop
    v_tour := v_tour + 1;
    exit when v_tour > 20;
    v_lignes := 0;
    for r in select * from public.lister_catalogue('cosplay', 'fr', null, null, null, null, p_tri, v_date, v_prix, v_id, p_taille + 1) loop
      v_lignes := v_lignes + 1;
      if v_lignes <= p_taille then
        v_ids := v_ids || r.id::text;
        v_date := r.curseur_date::timestamptz;
        v_prix := r.prix_cents;
        v_id := r.id;
      end if;
    end loop;
    exit when v_lignes <= p_taille;
  end loop;
  return v_ids;
end
$$;
grant execute on function pg_temp.ks_parcourir(text, integer) to public;

-- Droits et nature des fonctions.
select ok(
  has_function_privilege('anon', 'public.lister_catalogue(text, text, uuid, integer, integer, text, text, timestamptz, integer, uuid, integer)', 'execute')
  and has_function_privilege('authenticated', 'public.lister_catalogue(text, text, uuid, integer, integer, text, text, timestamptz, integer, uuid, integer)', 'execute')
  and has_function_privilege('anon', 'public.capacite_fabrication_atteinte()', 'execute')
  and has_function_privilege('authenticated', 'public.capacite_fabrication_atteinte()', 'execute'),
  'anon et authenticated exécutent lister_catalogue et capacite_fabrication_atteinte'
);
select is((select prosecdef from pg_proc where proname = 'lister_catalogue'), true, 'lister_catalogue est security definer (les rôles publics ne lisent plus le stock)');
select is((select prosecdef from pg_proc where proname = 'capacite_fabrication_atteinte'), true, 'capacite_fabrication_atteinte est security definer');
select is(
  (select count(*)::int from pg_proc p, unnest(coalesce(p.proargnames, '{}')) as nom
   where p.proname = 'lister_catalogue' and (nom ilike '%stock%' or nom ilike '%quantite%')),
  0,
  'lister_catalogue ne renvoie aucune quantité'
);

set local role anon;

-- Visibilité (RLS).
select is((select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 50)), 32,
  '32 cosplays visibles : ni brouillon, ni futur, ni dépublié, ni sans photo');
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 50)
   where slug in ('cat-brouillon', 'cat-futur', 'cat-depublie', 'cat-sans-photo')),
  0,
  'brouillon, futur, dépublié et sans photo sont absents'
);
select is((select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 13)), 13,
  '13 lignes lues pour afficher 12 et savoir s''il en reste');

-- Tri et curseur : pages de 12, sans doublon ni trou, même ordre que le calcul indépendant.
select is(pg_temp.ks_parcourir('nouveautes', 12), (select nouveautes from ks_attendu), 'nouveautés : parcours par curseur = ordre attendu (sans trou)');
select is((select count(distinct x)::int from unnest(pg_temp.ks_parcourir('nouveautes', 12)) as x), 32, 'nouveautés : aucun doublon');
select is(pg_temp.ks_parcourir('prix_asc', 12), (select prix_asc from ks_attendu), 'prix croissant : parcours par curseur = ordre attendu (sans trou)');
select is((select count(distinct x)::int from unnest(pg_temp.ks_parcourir('prix_asc', 12)) as x), 32, 'prix croissant : aucun doublon');
select is(pg_temp.ks_parcourir('prix_desc', 12), (select prix_desc from ks_attendu), 'prix décroissant : parcours par curseur = ordre attendu (sans trou)');
select is((select count(distinct x)::int from unnest(pg_temp.ks_parcourir('prix_desc', 12)) as x), 32, 'prix décroissant : aucun doublon');
select is(pg_temp.ks_parcourir('inconnu', 12), (select nouveautes from ks_attendu), 'un tri inconnu se comporte comme nouveautés');

-- Filtres.
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', '00000000-0000-0000-0000-00000000a001', null, null, null, 'nouveautes', null, null, null, 50)),
  10, 'filtre univers');
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, 1500, 2500, null, 'nouveautes', null, null, null, 50)),
  12, 'filtre prix : borne basse incluse, borne haute exclue');
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, 'en_stock', 'nouveautes', null, null, null, 50)),
  30, 'filtre en stock');
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, 'sur_commande', 'nouveautes', null, null, null, 50)),
  1, 'filtre sur commande');

-- États de disponibilité.
select is(
  (select disponibilite from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 50) where slug = 'cat-sur-commande'),
  'sur_commande', 'fabrication possible et plafond non réglé : sur commande');
select is(
  (select disponibilite from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 50) where slug = 'cat-indispo'),
  'epuise', 'ni stock ni fabrication : epuise');
select is(
  (select disponibilite from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 50) where slug = 'cat-c-03'),
  'dernieres_pieces', 'stock de 2 (jusqu''au seuil) : dernieres_pieces');
select is(
  (select disponibilite from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 50) where slug = 'cat-c-04'),
  'disponible', 'stock de 10 : disponible');
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, 'dernieres_pieces', 'nouveautes', null, null, null, 50)),
  1, 'filtre sur l''état exact dernieres_pieces');

-- Famille, langue, première photo, borne de la limite.
select is(
  (select array_agg(slug) from public.lister_catalogue('accessoire', 'fr', null, null, null, null, 'nouveautes', null, null, null, 50)),
  array['cat-acc-1'], 'la famille accessoire ne liste que les accessoires');
select is(
  (select titre from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 50) where slug = 'cat-c-01'),
  'Cosplay 1', 'titre français');
select is(
  (select titre from public.lister_catalogue('cosplay', 'en', null, null, null, null, 'nouveautes', null, null, null, 50) where slug = 'cat-c-01'),
  'Cosplay en 1', 'titre anglais');
select is(
  (select photo_alt from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 50) where slug = 'cat-c-01'),
  'Alt fr cat-c-01', 'texte alternatif français de la première photo');
select is(
  (select photo_alt from public.lister_catalogue('cosplay', 'en', null, null, null, null, 'nouveautes', null, null, null, 50) where slug = 'cat-c-01'),
  'Alt en cat-c-01', 'texte alternatif anglais de la première photo');
select is((select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 0)), 1,
  'une limite nulle est ramenée à 1');

select is(
  (select photo_alt from public.lister_catalogue('cosplay', 'en', null, null, null, null, 'nouveautes', null, null, null, 50) where slug = 'cat-c-02'),
  'Alt fr cat-c-02', 'texte alternatif anglais vide : repli sur le français');

-- Curseur + disponibilité + univers combinés : la suite d'une page de 3 est faite des 7 autres produits de l'univers A, sans les 3 premiers.
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', '00000000-0000-0000-0000-00000000a001', null, null, 'en_stock', 'nouveautes',
    (select curseur_date::timestamptz from public.lister_catalogue('cosplay', 'fr', '00000000-0000-0000-0000-00000000a001', null, null, 'en_stock', 'nouveautes', null, null, null, 3) offset 2 limit 1),
    null,
    (select id from public.lister_catalogue('cosplay', 'fr', '00000000-0000-0000-0000-00000000a001', null, null, 'en_stock', 'nouveautes', null, null, null, 3) offset 2 limit 1),
    50)),
  7, 'curseur + disponibilité + univers : 7 produits suivent');
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', '00000000-0000-0000-0000-00000000a001', null, null, 'en_stock', 'nouveautes',
    (select curseur_date::timestamptz from public.lister_catalogue('cosplay', 'fr', '00000000-0000-0000-0000-00000000a001', null, null, 'en_stock', 'nouveautes', null, null, null, 3) offset 2 limit 1),
    null,
    (select id from public.lister_catalogue('cosplay', 'fr', '00000000-0000-0000-0000-00000000a001', null, null, 'en_stock', 'nouveautes', null, null, null, 3) offset 2 limit 1),
    50) s
   where s.id in (select id from public.lister_catalogue('cosplay', 'fr', '00000000-0000-0000-0000-00000000a001', null, null, 'en_stock', 'nouveautes', null, null, null, 3))),
  0, 'curseur + filtres : aucun des 3 premiers n''est répété');

-- Plafond de fabrication.
select is(public.capacite_fabrication_atteinte(), false, 'plafond non réglé : jamais atteint');
reset role;
insert into public.reglage (cle, valeur) values ('plafond_fabrication', '5');
set local role anon;
select is(public.capacite_fabrication_atteinte(), false, 'plafond 5 et 0 place prise : non atteint');
select is((select count(*)::int from public.reglage where cle = 'plafond_fabrication'), 0, 'anon ne lit pas le plafond');
reset role;

-- Remplace la lecture des places prises (comme le fera l'epic 4) : 5 places prises, plafond atteint.
create or replace function public.places_fabrication_utilisees() returns integer language sql stable security invoker set search_path = '' as $$ select 5 $$;
set local role anon;
select is(public.capacite_fabrication_atteinte(), true, 'plafond 5 et 5 places prises : atteint');
select is(
  (select disponibilite from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 50) where slug = 'cat-sur-commande'),
  'complet', 'fabrication possible mais capacité atteinte : complet');
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, 'en_stock', 'nouveautes', null, null, null, 50)),
  30, 'capacité atteinte : les articles en stock restent en stock');
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, 'sur_commande', 'nouveautes', null, null, null, 50)),
  0, 'capacité atteinte : plus rien sur commande');
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, 'complet', 'nouveautes', null, null, null, 50)),
  1, 'capacité atteinte : le filtre complet trouve l''article en fabrication');
reset role;

-- Prédicat de publication explicite : un rôle qui contourne la RLS (ici le propriétaire) ne voit pas non plus le brouillon.
select is(
  (select count(*)::int from public.lister_catalogue('cosplay', 'fr', null, null, null, null, 'nouveautes', null, null, null, 300)
   where slug in ('cat-brouillon', 'cat-futur', 'cat-depublie')),
  0, 'hors RLS, brouillon, futur et dépublié restent absents du listage');

select * from finish();
rollback;
