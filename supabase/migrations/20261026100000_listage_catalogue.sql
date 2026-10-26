-- Story 2.4 : listage public des catalogues Cosplays et Accessoires (AD-3, AD-17, AD-26).
-- Lecture pure : aucune table, aucune donnée. Les migrations précédentes ne sont pas modifiées.

-- Le Plafond de fabrication est-il atteint ? Compare places_fabrication_utilisees() au réglage privé « plafond_fabrication ».
-- Plafond non réglé (ou illisible) : jamais atteint. SECURITY DEFINER pour lire le réglage privé sans l'exposer ;
-- seul un booléen sort, jamais la valeur du plafond ni le nombre de places prises.
create function public.capacite_fabrication_atteinte()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select public.places_fabrication_utilisees() >= r.valeur::integer
      from public.reglage r
      where r.cle = 'plafond_fabrication' and r.valeur ~ '^[0-9]{1,5}$'
    ),
    false
  )
$$;

revoke all on function public.capacite_fabrication_atteinte() from public;
grant execute on function public.capacite_fabrication_atteinte() to anon, authenticated, service_role;

-- Liste une page du catalogue, par curseur (jamais par décalage). SECURITY INVOKER : la RLS ne laisse voir que les produits
-- publiés et passés, leurs variantes et leurs photos ; le même prédicat est aussi écrit explicitement (un rôle qui contourne la RLS ne voit pas
-- un brouillon dans le listage). Un produit sans photo n'est pas listé. Texte alternatif anglais vide : repli sur le français.
--   p_famille : cosplay ou accessoire (obligatoire) ; p_langue : fr ou en (en : titre et texte alternatif anglais, repli français).
--   p_univers : filtre facultatif ; p_prix_bas (inclus) et p_prix_haut (exclu), en centimes USD : filtre facultatif.
--   p_dispo : en_stock ou sur_commande (l'état affiché sur la carte) ; facultatif.
--   p_tri : nouveautes (publication décroissante puis identifiant), prix_asc, prix_desc (prix puis identifiant) ; autre valeur : nouveautes.
--   Curseur : la clé de tri du dernier produit déjà vu (p_curseur_date en nouveautés, p_curseur_prix en tri par prix) et son identifiant.
--   p_limite : nombre de lignes lues (13 pour afficher 12 et savoir s'il en reste), borné de 1 à 300 (la page à curseur relit depuis le début les produits déjà vus, 240 au plus, plus 12 et un).
-- L'état de disponibilité vient de stock_disponible et de capacite_fabrication_atteinte (remplacées à l'epic 4), jamais d'un calcul dupliqué :
--   en_stock (une variante a du stock), sinon sur_commande (une variante se fabrique sur commande et la capacité n'est pas atteinte),
--   sinon complet (fabrication possible mais capacité atteinte), sinon indisponible. Aucune quantité n'est renvoyée.
-- curseur_date : publie_le en texte (microsecondes conservées), à rendre tel quel dans p_curseur_date.
create function public.lister_catalogue(
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
security invoker
set search_path = ''
as $$
  with capacite as (
    select public.capacite_fabrication_atteinte() as atteinte
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
    select case
      when bool_or(coalesce(public.stock_disponible(v.id), 0) > 0) then 'en_stock'
      when bool_or(v.fabrication_sur_commande) and not c.atteinte then 'sur_commande'
      when bool_or(v.fabrication_sur_commande) then 'complet'
      else 'indisponible'
    end as etat
    from public.variante v
    where v.produit_id = p.id
  ) d
  where p.publie_le is not null and p.publie_le <= now()
    and p.famille = p_famille
    and p.prix_cents is not null
    and (p_univers is null or p.univers_id = p_univers)
    and (p_prix_bas is null or p.prix_cents >= p_prix_bas)
    and (p_prix_haut is null or p.prix_cents < p_prix_haut)
    and (p_dispo is null or d.etat = p_dispo)
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
