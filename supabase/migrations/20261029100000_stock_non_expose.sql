-- Correctif 2.1/2.3 : le public ne voit jamais le stock exact.
-- anon et authenticated perdent la lecture de variante.stock et l'exécution de stock_disponible ; toute la lecture publique passe par
-- des fonctions qui ne renvoient qu'un état (disponible, dernieres_pieces, sur_commande, complet, epuise). Aucune quantité n'en sort.
-- Les migrations précédentes ne sont pas modifiées : tout est repris ici par create or replace ou revoke/grant.

-- 1. Lecture de variante par colonne : jamais stock. La politique variante_lecture_publiee (produit publié et passé) reste.
revoke select on public.variante from anon, authenticated;
grant select (id, produit_id, taille, fabrication_sur_commande, delai_fabrication_jours, cree_le) on public.variante to anon, authenticated;

-- 1 bis. Realtime ne respecte pas les droits par colonne : variante ne doit pas figurer dans la publication (sans effet si absente).
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'variante'
  ) then
    alter publication supabase_realtime drop table public.variante;
  end if;
end;
$$;

-- 2. stock_disponible : réservée au service_role et aux fonctions internes (propriétaire). L'epic 4 la remplace par create or replace.
revoke all on function public.stock_disponible(uuid) from public, anon, authenticated;
grant execute on function public.stock_disponible(uuid) to service_role;

-- 3. Seuil « dernières pièces » : unique source SQL. Miroir TypeScript : SEUIL_DERNIERES_PIECES (src/modules/catalogue/types.ts).
-- Interne : jamais appelée par un rôle public.
create function public.seuil_dernieres_pieces()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 3
$$;

revoke all on function public.seuil_dernieres_pieces() from public, anon, authenticated;
grant execute on function public.seuil_dernieres_pieces() to service_role;

-- 4. État d'une variante, calculé depuis des valeurs reçues (calcul pur, aucune lecture de table). Interne.
--   disponible (stock > seuil), dernieres_pieces (1 à seuil inclus), sur_commande (aucun stock, fabrication permise, capacité libre),
--   complet (aucun stock, fabrication permise, capacité atteinte), epuise (aucun stock, pas de fabrication).
create function public.etat_disponibilite(p_stock integer, p_fabrication boolean, p_capacite_atteinte boolean)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_stock, 0) > public.seuil_dernieres_pieces() then 'disponible'
    when coalesce(p_stock, 0) > 0 then 'dernieres_pieces'
    when coalesce(p_fabrication, false) and not coalesce(p_capacite_atteinte, false) then 'sur_commande'
    when coalesce(p_fabrication, false) then 'complet'
    else 'epuise'
  end
$$;

revoke all on function public.etat_disponibilite(integer, boolean, boolean) from public, anon, authenticated;
grant execute on function public.etat_disponibilite(integer, boolean, boolean) to service_role;

-- 5. Rang d'un état (1 = le meilleur) pour choisir le meilleur état des variantes d'un produit. Interne.
create function public.rang_disponibilite(p_etat text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select array_position(array['disponible', 'dernieres_pieces', 'sur_commande', 'complet', 'epuise'], p_etat)
$$;

revoke all on function public.rang_disponibilite(text) from public, anon, authenticated;
grant execute on function public.rang_disponibilite(text) to service_role;

-- 6. lister_catalogue : security definer (les rôles publics ne lisent plus le stock). Lecture pure ; le prédicat « publié et passé »
-- est écrit explicitement pour le produit (les photos et variantes lues sont celles de ce produit). Même signature qu'avant.
-- p_dispo : en_stock (disponible ou dernieres_pieces), sur_commande, ou un état exact (complet, epuise, disponible, dernieres_pieces).
-- L'état d'un produit est le meilleur de ses variantes. Aucune quantité n'est renvoyée.
create or replace function public.lister_catalogue(
  p_famille text,
  p_langue text default 'fr',
  p_univers uuid default null,
  p_prix_bas integer default null,
  p_prix_haut integer default null,
  p_dispo text default null,
  p_tri text default 'nouveautes',
  p_curseur_date timestamptz default null,
  p_curseur_prix integer default null,
  p_curseur_id uuid default null,
  p_limite integer default 13
)
returns table (
  id uuid,
  slug text,
  famille text,
  titre text,
  photo_alt text,
  photo_fichier text,
  prix_cents integer,
  univers_id uuid,
  disponibilite text,
  curseur_date text
)
language sql
stable
security definer
set search_path = ''
as $$
  with capacite as (
    select coalesce(public.capacite_fabrication_atteinte(), false) as atteinte
  )
  select
    p.id,
    p.slug,
    p.famille,
    case when p_langue = 'en' then coalesce(p.titre_en, p.titre_fr) else p.titre_fr end as titre,
    case when p_langue = 'en' then coalesce(nullif(btrim(ph.alt_en), ''), ph.alt_fr) else ph.alt_fr end as photo_alt,
    ph.fichier as photo_fichier,
    p.prix_cents,
    p.univers_id,
    d.etat as disponibilite,
    p.publie_le::text as curseur_date
  from public.produit p
  cross join capacite c
  cross join lateral (
    select f.fichier, f.alt_fr, f.alt_en
    from public.produit_photo f
    where f.produit_id = p.id
    order by f.position asc
    limit 1
  ) ph
  cross join lateral (
    select coalesce(
      (array['disponible', 'dernieres_pieces', 'sur_commande', 'complet', 'epuise'])[
        min(public.rang_disponibilite(public.etat_disponibilite(public.stock_disponible(v.id), v.fabrication_sur_commande, c.atteinte)))
      ],
      'epuise'
    ) as etat
    from public.variante v
    where v.produit_id = p.id
  ) d
  where p.publie_le is not null and p.publie_le <= now()
    and p.famille = p_famille
    and p.prix_cents is not null
    and (p_univers is null or p.univers_id = p_univers)
    and (p_prix_bas is null or p.prix_cents >= p_prix_bas)
    and (p_prix_haut is null or p.prix_cents < p_prix_haut)
    and (
      p_dispo is null
      or d.etat = p_dispo
      or (p_dispo = 'en_stock' and d.etat in ('disponible', 'dernieres_pieces'))
    )
    and (
      p_curseur_id is null
      or case p_tri
        when 'prix_asc' then (p.prix_cents, p.id) > (p_curseur_prix, p_curseur_id)
        when 'prix_desc' then (p.prix_cents, p.id) < (p_curseur_prix, p_curseur_id)
        else (p.publie_le, p.id) < (p_curseur_date, p_curseur_id)
      end
    )
  order by
    case when p_tri = 'prix_asc' then p.prix_cents end asc,
    case when p_tri = 'prix_asc' then p.id end asc,
    case when p_tri = 'prix_desc' then p.prix_cents end desc,
    case when p_tri = 'prix_desc' then p.id end desc,
    case when p_tri not in ('prix_asc', 'prix_desc') then p.publie_le end desc,
    case when p_tri not in ('prix_asc', 'prix_desc') then p.id end desc
  limit least(greatest(coalesce(p_limite, 13), 1), 300)
$$;

revoke all on function public.lister_catalogue(text, text, uuid, integer, integer, text, text, timestamptz, integer, uuid, integer) from public;
grant execute on function public.lister_catalogue(text, text, uuid, integer, integer, text, text, timestamptz, integer, uuid, integer) to anon, authenticated, service_role;

-- 7. disponibilite_variantes : security definer, lecture pure, prédicat « publié et passé » explicite. Mêmes colonnes qu'avant
-- (taille, etat, delai_jours) : jamais de quantité. etat : disponible, dernieres_pieces, sur_commande, complet ou epuise.
create or replace function public.disponibilite_variantes(p_produit uuid)
returns table (
  taille text,
  etat text,
  delai_jours integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with capacite as (
    select coalesce(public.capacite_fabrication_atteinte(), false) as atteinte
  )
  select
    v.taille,
    public.etat_disponibilite(public.stock_disponible(v.id), v.fabrication_sur_commande, c.atteinte) as etat,
    coalesce(v.delai_fabrication_jours, p.delai_fabrication_jours) as delai_jours
  from public.produit p
  join public.variante v on v.produit_id = p.id
  cross join capacite c
  where p.id = p_produit
    and p.publie_le is not null and p.publie_le <= now()
  order by array_position(array['XS', 'S', 'M', 'L', 'XL', 'XXL', 'sur_mesure'], v.taille)
$$;

revoke all on function public.disponibilite_variantes(uuid) from public;
grant execute on function public.disponibilite_variantes(uuid) to anon, authenticated, service_role;
