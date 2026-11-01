-- Story 4.1 : Panier sans compte (AD-15). Tables panier et ligne_panier (module commande), écrites seulement par les fonctions ci-dessous,
-- appelées par le serveur (service_role). Le Panier ne fige aucun prix : lire_panier relit prix, disponibilité et délai à chaque appel (règle 3).
-- Un Pass n'entre jamais dans le Panier : aucune colonne ni fonction ne le permet (FR-11). Le Kit gratuit non plus (KS_PRODUIT_GRATUIT).

create table public.panier (
  id uuid primary key default gen_random_uuid(),
  -- Rattaché au Compte à la connexion (story 4.2) ; un seul Panier actif par Compte.
  compte_id uuid references auth.users (id) on delete cascade,
  cree_le timestamptz not null default now(),
  mis_a_jour_le timestamptz not null default now()
);

create unique index panier_un_par_compte on public.panier (compte_id) where compte_id is not null;

create table public.ligne_panier (
  id uuid primary key default gen_random_uuid(),
  panier_id uuid not null references public.panier (id) on delete cascade,
  produit_id uuid not null references public.produit (id) on delete cascade,
  -- Variante (taille) d'un produit physique ; nulle pour un Kit, toujours en un seul exemplaire.
  variante_id uuid references public.variante (id) on delete cascade,
  -- Nombre d'exemplaires d'une ligne : 1 à 10 (une pièce physique commandée en plus grand nombre se traite avec Jonathan).
  nombre smallint not null check (nombre between 1 and 10),
  cree_le timestamptz not null default now(),
  constraint ligne_panier_kit_un_exemplaire check (variante_id is not null or nombre = 1)
);

create unique index ligne_panier_unique on public.ligne_panier (panier_id, produit_id, coalesce(variante_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.panier enable row level security;
alter table public.ligne_panier enable row level security;
-- Aucun droit ni aucune politique pour anon et authenticated : le navigateur n'écrit ni ne lit ces tables (AD-2).
revoke all on public.panier, public.ligne_panier from public, anon, authenticated;

create trigger panier_journaliser
  after insert or update or delete on public.panier
  for each row execute function public.journaliser('id');
create trigger ligne_panier_journaliser
  after insert or update or delete on public.ligne_panier
  for each row execute function public.journaliser('id');

-- Crée un Panier vide (visiteur sans Compte). Renvoie son identifiant, que le serveur signe dans le cookie.
create function public.creer_panier(p_auteur jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  insert into public.panier default values returning id into v_id;
  return v_id;
end;
$$;

-- Ajoute un article. Produit physique : p_taille obligatoire, p_nombre de 1 à 10 (cumulé avec la ligne existante). Kit payant : un seul
-- exemplaire, un second ajout ne change rien. p_compte : Compte connecté s'il y en a un (un Kit déjà possédé est refusé).
create function public.ajouter_au_panier(p_auteur jsonb, p_panier uuid, p_compte uuid, p_produit uuid, p_taille text, p_nombre integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produit record;
  v_variante record;
  v_ligne record;
  v_etat text;
  v_total integer;
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;

  perform 1 from public.panier where id = p_panier for update;
  if not found then
    raise exception 'KS_PANIER_INTROUVABLE' using errcode = 'P0001';
  end if;

  select famille, prix_cents, publie_le into v_produit from public.produit where id = p_produit;
  if not found or v_produit.publie_le is null or v_produit.publie_le > now() or v_produit.prix_cents is null then
    raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Le Kit gratuit, seul Produit à 0 USD, ne s'obtient que par offrir_commande (AD-15).
  if v_produit.prix_cents = 0 then
    raise exception 'KS_PRODUIT_GRATUIT' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);

  if v_produit.famille = 'kit' then
    if p_taille is not null then
      raise exception 'KS_VARIANTE_INVALIDE' using errcode = 'P0001';
    end if;
    if p_compte is not null and exists (select 1 from public.acces_kit where compte_id = p_compte and produit_id = p_produit) then
      raise exception 'KS_KIT_DEJA_POSSEDE' using errcode = 'P0001';
    end if;
    insert into public.ligne_panier (panier_id, produit_id, variante_id, nombre) values (p_panier, p_produit, null, 1)
    on conflict do nothing;
    select id, nombre into v_ligne from public.ligne_panier where panier_id = p_panier and produit_id = p_produit and variante_id is null;
  else
    if p_nombre is null or p_nombre not between 1 and 10 then
      raise exception 'KS_QUANTITE_INVALIDE' using errcode = 'P0001';
    end if;
    select id, stock, fabrication_sur_commande into v_variante from public.variante where produit_id = p_produit and taille = p_taille;
    if not found then
      raise exception 'KS_VARIANTE_INTROUVABLE' using errcode = 'P0001';
    end if;
    v_etat := public.etat_disponibilite(public.stock_disponible(v_variante.id), v_variante.fabrication_sur_commande, coalesce(public.capacite_fabrication_atteinte(), false));
    if v_etat in ('complet', 'epuise') then
      raise exception 'KS_INDISPONIBLE' using errcode = 'P0001';
    end if;
    select id, nombre into v_ligne from public.ligne_panier where panier_id = p_panier and produit_id = p_produit and variante_id = v_variante.id;
    if found then
      v_total := v_ligne.nombre + p_nombre;
      if v_total > 10 then
        raise exception 'KS_QUANTITE_INVALIDE' using errcode = 'P0001';
      end if;
      update public.ligne_panier set nombre = v_total where id = v_ligne.id;
      v_ligne.nombre := v_total;
    else
      insert into public.ligne_panier (panier_id, produit_id, variante_id, nombre) values (p_panier, p_produit, v_variante.id, p_nombre)
      returning id, nombre into v_ligne;
    end if;
  end if;

  update public.panier set mis_a_jour_le = now() where id = p_panier;
  return jsonb_build_object('ligne_id', v_ligne.id, 'nombre', v_ligne.nombre);
end;
$$;

-- Change le nombre d'exemplaires d'une ligne de produit physique (1 à 10). Une ligne de Kit n'a pas de quantité.
create function public.modifier_ligne_panier(p_auteur jsonb, p_panier uuid, p_ligne uuid, p_nombre integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ligne record;
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  perform 1 from public.panier where id = p_panier for update;
  if not found then
    raise exception 'KS_PANIER_INTROUVABLE' using errcode = 'P0001';
  end if;
  select id, variante_id into v_ligne from public.ligne_panier where id = p_ligne and panier_id = p_panier;
  if not found then
    raise exception 'KS_LIGNE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_ligne.variante_id is null then
    raise exception 'KS_LIGNE_UNIQUE' using errcode = 'P0001';
  end if;
  if p_nombre is null or p_nombre not between 1 and 10 then
    raise exception 'KS_QUANTITE_INVALIDE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.ligne_panier set nombre = p_nombre where id = p_ligne;
  update public.panier set mis_a_jour_le = now() where id = p_panier;
end;
$$;

create function public.retirer_ligne_panier(p_auteur jsonb, p_panier uuid, p_ligne uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  perform 1 from public.panier where id = p_panier for update;
  if not found then
    raise exception 'KS_PANIER_INTROUVABLE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  delete from public.ligne_panier where id = p_ligne and panier_id = p_panier;
  if not found then
    raise exception 'KS_LIGNE_INTROUVABLE' using errcode = 'P0001';
  end if;
  update public.panier set mis_a_jour_le = now() where id = p_panier;
end;
$$;

-- Lecture du Panier : prix, disponibilité et délai relus en base à chaque appel, jamais figés (règle 3, UX-DR32).
-- etat : disponible | dernieres_pieces | sur_commande | complet | epuise. Un produit dépublié ou sans prix est « epuise » (Plus disponible).
-- delai_jours : délai de fabrication, seulement pour un état « sur_commande ». Aucune quantité en stock n'est renvoyée.
create function public.lire_panier(p_panier uuid)
returns table (
  ligne_id uuid,
  produit_id uuid,
  famille text,
  slug text,
  titre_fr text,
  titre_en text,
  taille text,
  nombre integer,
  prix_cents integer,
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
    l.id,
    p.id,
    p.famille,
    p.slug,
    p.titre_fr,
    p.titre_en,
    v.taille,
    l.nombre::integer,
    p.prix_cents,
    case
      when p.publie_le is null or p.publie_le > now() or p.prix_cents is null or p.prix_cents = 0 then 'epuise'
      when p.famille = 'kit' then 'disponible'
      else public.etat_disponibilite(public.stock_disponible(v.id), v.fabrication_sur_commande, c.atteinte)
    end,
    case
      when p.famille <> 'kit' and public.etat_disponibilite(public.stock_disponible(v.id), v.fabrication_sur_commande, c.atteinte) = 'sur_commande'
        then coalesce(v.delai_fabrication_jours, p.delai_fabrication_jours)
      else null
    end
  from public.ligne_panier l
  join public.produit p on p.id = l.produit_id
  left join public.variante v on v.id = l.variante_id
  cross join capacite c
  where l.panier_id = p_panier
  order by l.cree_le, l.id
$$;

-- Nombre d'articles du Panier (en-tête : « Panier, N articles »). 0 si le Panier n'existe pas.
create function public.compter_panier(p_panier uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(nombre), 0)::integer from public.ligne_panier where panier_id = p_panier
$$;

revoke all on function public.creer_panier(jsonb) from public, anon, authenticated;
revoke all on function public.ajouter_au_panier(jsonb, uuid, uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.modifier_ligne_panier(jsonb, uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.retirer_ligne_panier(jsonb, uuid, uuid) from public, anon, authenticated;
revoke all on function public.lire_panier(uuid) from public, anon, authenticated;
revoke all on function public.compter_panier(uuid) from public, anon, authenticated;
grant execute on function public.creer_panier(jsonb) to service_role;
grant execute on function public.ajouter_au_panier(jsonb, uuid, uuid, uuid, text, integer) to service_role;
grant execute on function public.modifier_ligne_panier(jsonb, uuid, uuid, integer) to service_role;
grant execute on function public.retirer_ligne_panier(jsonb, uuid, uuid) to service_role;
grant execute on function public.lire_panier(uuid) to service_role;
grant execute on function public.compter_panier(uuid) to service_role;
