-- Story 2.1 : catalogue des produits physiques (univers, produit, variante), écritures journalisées (AD-2, AD-3, AD-30).
-- Lecture publique : seulement les produits publiés (publie_le non nul et passé) et leurs variantes, et les univers.
-- Écriture : aucune depuis anon ni authenticated ; seules les fonctions ci-dessous, SECURITY DEFINER, service_role seulement,
-- droit admin revérifié en base sur p_auteur (exiger_admin). Aucune donnée par défaut : aucun univers, produit ni prix (E-29).
-- Les migrations précédentes ne sont pas modifiées.

create table public.univers (
  id uuid primary key default gen_random_uuid(),
  nom_fr text not null check (char_length(nom_fr) between 1 and 60),
  nom_en text not null check (char_length(nom_en) between 1 and 60),
  cree_le timestamptz not null default now()
);

-- Un nom d'univers est unique par langue, sans tenir compte de la casse.
create unique index univers_nom_fr_unique on public.univers (lower(nom_fr));
create unique index univers_nom_en_unique on public.univers (lower(nom_en));

create table public.produit (
  id uuid primary key default gen_random_uuid(),
  -- Les Kits (famille « kit ») arrivent à l'epic 3 par une nouvelle migration.
  famille text not null check (famille in ('cosplay', 'accessoire')),
  slug text not null unique check (char_length(slug) between 1 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titre_fr text not null check (char_length(titre_fr) between 1 and 120),
  titre_en text check (titre_en is null or char_length(titre_en) between 1 and 120),
  description_fr text check (description_fr is null or char_length(description_fr) between 1 and 5000),
  description_en text check (description_en is null or char_length(description_en) between 1 and 5000),
  univers_id uuid references public.univers (id),
  -- Prix en centimes entiers USD ; absent tant que Jonathan ne l'a pas fixé (jamais de prix par défaut).
  prix_cents integer check (prix_cents is null or (prix_cents > 0 and prix_cents <= 1000000)),
  devise text not null default 'USD' check (devise = 'USD'),
  delai_fabrication_jours integer check (delai_fabrication_jours is null or delai_fabrication_jours between 1 and 365),
  -- Posé par la publication (story 2.2), jamais ici : un produit créé ou modifié par cette story reste un brouillon.
  publie_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create index produit_univers_idx on public.produit (univers_id);

create table public.variante (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references public.produit (id) on delete cascade,
  taille text not null check (taille in ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'sur_mesure')),
  stock integer not null default 0 check (stock >= 0),
  fabrication_sur_commande boolean not null default false,
  -- Facultatif : remplace le délai du produit pour cette variante.
  delai_fabrication_jours integer check (delai_fabrication_jours is null or delai_fabrication_jours between 1 and 365),
  cree_le timestamptz not null default now(),
  constraint variante_une_par_taille unique (produit_id, taille),
  -- Sur-mesure : toujours fabriqué, stock 0 (AD-26).
  constraint variante_sur_mesure_fabrication check (taille <> 'sur_mesure' or (stock = 0 and fabrication_sur_commande))
);

alter table public.univers enable row level security;
alter table public.produit enable row level security;
alter table public.variante enable row level security;

-- anon et authenticated : SELECT seulement, jamais d'écriture ; le serveur écrit par les fonctions ci-dessous.
revoke all on public.univers from public, anon, authenticated;
revoke all on public.produit from public, anon, authenticated;
revoke all on public.variante from public, anon, authenticated;
grant select on public.univers to anon, authenticated;
grant select on public.produit to anon, authenticated;
grant select on public.variante to anon, authenticated;

create policy univers_lecture_publique on public.univers
  for select to anon, authenticated
  using (true);

-- Un brouillon et un produit publié dans le futur sont introuvables côté public.
create policy produit_lecture_publiee on public.produit
  for select to anon, authenticated
  using (publie_le is not null and publie_le <= now());

-- La variante suit son produit.
create policy variante_lecture_publiee on public.variante
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.produit p
      where p.id = variante.produit_id and p.publie_le is not null and p.publie_le <= now()
    )
  );

create trigger univers_journaliser
  after insert or update or delete on public.univers
  for each row execute function public.journaliser('id');

create trigger produit_journaliser
  after insert or update or delete on public.produit
  for each row execute function public.journaliser('id');

create trigger variante_journaliser
  after insert or update or delete on public.variante
  for each row execute function public.journaliser('id');

-- Crée un univers (admin). Création seulement : ni renommage ni suppression au lancement.
-- Noms de 1 à 60 caractères, uniques par langue sans tenir compte de la casse.
create function public.creer_univers(p_auteur jsonb, p_nom_fr text, p_nom_en text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom_fr text := btrim(coalesce(p_nom_fr, ''));
  v_nom_en text := btrim(coalesce(p_nom_en, ''));
  v_id uuid;
begin
  perform public.exiger_admin(p_auteur);
  if char_length(v_nom_fr) < 1 or char_length(v_nom_fr) > 60 or char_length(v_nom_en) < 1 or char_length(v_nom_en) > 60 then
    raise exception 'KS_UNIVERS_INVALIDE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.univers u where lower(u.nom_fr) = lower(v_nom_fr) or lower(u.nom_en) = lower(v_nom_en)) then
    raise exception 'KS_UNIVERS_EXISTE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  begin
    insert into public.univers (nom_fr, nom_en) values (v_nom_fr, v_nom_en) returning id into v_id;
  exception when unique_violation then
    -- Deux créations simultanées du même nom.
    raise exception 'KS_UNIVERS_EXISTE' using errcode = 'P0001';
  end;
  return v_id;
end;
$$;

revoke all on function public.creer_univers(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.creer_univers(jsonb, text, text) to service_role;

-- Crée (p_id nul) ou modifie un produit physique avec ses variantes, en une seule transaction, journalisée avant et après.
-- p_produit : famille, slug, titre_fr, titre_en, description_fr, description_en, univers_id, prix_cents, delai_fabrication_jours.
-- p_variantes : tableau d'objets taille, stock, fabrication_sur_commande, delai_fabrication_jours.
-- L'ensemble des variantes est remplacé : une taille absente est supprimée, une taille présente est mise à jour (même ligne,
-- même identifiant). Un brouillon peut être incomplet (prix, textes, variante) : la publication stricte est la story 2.2.
-- Ne pose jamais publie_le.
create function public.enregistrer_produit(p_auteur jsonb, p_id uuid, p_produit jsonb, p_variantes jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_famille text;
  v_slug text;
  v_titre_fr text;
  v_titre_en text;
  v_desc_fr text;
  v_desc_en text;
  v_univers uuid;
  v_prix integer;
  v_delai integer;
  v_texte text;
  v_id uuid;
  v_var jsonb;
  v_taille text;
  v_stock integer;
  v_commande boolean;
  v_delai_var integer;
  v_tailles text[] := '{}';
begin
  perform public.exiger_admin(p_auteur);
  if p_produit is null or jsonb_typeof(p_produit) <> 'object' then
    raise exception 'KS_PRODUIT_INVALIDE' using errcode = 'P0001';
  end if;
  if p_variantes is null or jsonb_typeof(p_variantes) = 'null' then
    p_variantes := '[]'::jsonb;
  end if;
  if jsonb_typeof(p_variantes) <> 'array' then
    raise exception 'KS_PRODUIT_INVALIDE' using errcode = 'P0001';
  end if;

  -- Famille : cosplay ou accessoire (kit : epic 3).
  v_famille := p_produit ->> 'famille';
  if v_famille is null or v_famille not in ('cosplay', 'accessoire') then
    raise exception 'KS_FAMILLE_INVALIDE' using errcode = 'P0001';
  end if;

  v_titre_fr := btrim(coalesce(p_produit ->> 'titre_fr', ''));
  if char_length(v_titre_fr) < 1 or char_length(v_titre_fr) > 120 then
    raise exception 'KS_TITRE_INVALIDE' using errcode = 'P0001';
  end if;
  v_titre_en := nullif(btrim(coalesce(p_produit ->> 'titre_en', '')), '');
  if v_titre_en is not null and char_length(v_titre_en) > 120 then
    raise exception 'KS_TITRE_INVALIDE' using errcode = 'P0001';
  end if;

  v_desc_fr := nullif(btrim(coalesce(p_produit ->> 'description_fr', '')), '');
  v_desc_en := nullif(btrim(coalesce(p_produit ->> 'description_en', '')), '');
  if char_length(coalesce(v_desc_fr, '')) > 5000 or char_length(coalesce(v_desc_en, '')) > 5000 then
    raise exception 'KS_TEXTE_INVALIDE' using errcode = 'P0001';
  end if;

  v_slug := btrim(coalesce(p_produit ->> 'slug', ''));
  if char_length(v_slug) < 1 or char_length(v_slug) > 80 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'KS_SLUG_INVALIDE' using errcode = 'P0001';
  end if;

  -- Prix en centimes entiers (absent = à fixer) : entier > 0 et <= 1 000 000.
  v_texte := p_produit ->> 'prix_cents';
  if v_texte is not null then
    if v_texte !~ '^[0-9]{1,7}$' then
      raise exception 'KS_PRIX_INVALIDE' using errcode = 'P0001';
    end if;
    v_prix := v_texte::integer;
    if v_prix < 1 or v_prix > 1000000 then
      raise exception 'KS_PRIX_INVALIDE' using errcode = 'P0001';
    end if;
  end if;

  -- Délai de fabrication du produit (absent = non fixé) : 1 à 365 jours.
  v_texte := p_produit ->> 'delai_fabrication_jours';
  if v_texte is not null then
    if v_texte !~ '^[0-9]{1,4}$' then
      raise exception 'KS_DELAI_INVALIDE' using errcode = 'P0001';
    end if;
    v_delai := v_texte::integer;
    if v_delai < 1 or v_delai > 365 then
      raise exception 'KS_DELAI_INVALIDE' using errcode = 'P0001';
    end if;
  end if;

  v_texte := p_produit ->> 'univers_id';
  if v_texte is not null then
    if v_texte !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'KS_UNIVERS_INTROUVABLE' using errcode = 'P0001';
    end if;
    v_univers := v_texte::uuid;
    if not exists (select 1 from public.univers u where u.id = v_univers) then
      raise exception 'KS_UNIVERS_INTROUVABLE' using errcode = 'P0001';
    end if;
  end if;

  if p_id is not null then
    perform 1 from public.produit p where p.id = p_id for update;
    if not found then
      raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
    end if;
  end if;
  if exists (select 1 from public.produit p where p.slug = v_slug and p.id is distinct from p_id) then
    raise exception 'KS_SLUG_PRIS' using errcode = 'P0001';
  end if;

  -- Variantes : validées toutes avant la première écriture.
  for v_var in select value from jsonb_array_elements(p_variantes) loop
    if jsonb_typeof(v_var) <> 'object' then
      raise exception 'KS_TAILLE_INVALIDE' using errcode = 'P0001';
    end if;
    v_taille := v_var ->> 'taille';
    if v_taille is null or v_taille not in ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'sur_mesure') then
      raise exception 'KS_TAILLE_INVALIDE' using errcode = 'P0001';
    end if;
    -- Sur-mesure : cosplay seulement.
    if v_taille = 'sur_mesure' and v_famille <> 'cosplay' then
      raise exception 'KS_TAILLE_INVALIDE' using errcode = 'P0001';
    end if;
    -- Une seule ligne par taille.
    if v_taille = any (v_tailles) then
      raise exception 'KS_TAILLE_INVALIDE' using errcode = 'P0001';
    end if;
    v_tailles := v_tailles || v_taille;

    v_delai_var := null;
    v_texte := v_var ->> 'delai_fabrication_jours';
    if v_texte is not null then
      if v_texte !~ '^[0-9]{1,4}$' then
        raise exception 'KS_DELAI_INVALIDE' using errcode = 'P0001';
      end if;
      v_delai_var := v_texte::integer;
      if v_delai_var < 1 or v_delai_var > 365 then
        raise exception 'KS_DELAI_INVALIDE' using errcode = 'P0001';
      end if;
    end if;

    if v_taille = 'sur_mesure' then
      v_stock := 0;
      v_commande := true;
    else
      v_texte := v_var ->> 'stock';
      if v_texte is null or v_texte !~ '^[0-9]{1,9}$' then
        raise exception 'KS_STOCK_INVALIDE' using errcode = 'P0001';
      end if;
      v_stock := v_texte::integer;
      v_texte := v_var ->> 'fabrication_sur_commande';
      if v_texte is null or v_texte = 'false' then
        v_commande := false;
      elsif v_texte = 'true' then
        v_commande := true;
      else
        raise exception 'KS_PRODUIT_INVALIDE' using errcode = 'P0001';
      end if;
    end if;

    -- Fabrication sur commande : un délai est exigé (celui de la variante, sinon celui du produit).
    if v_commande and coalesce(v_delai_var, v_delai) is null then
      raise exception 'KS_DELAI_MANQUANT' using errcode = 'P0001';
    end if;
  end loop;

  perform set_config('ks.auteur', p_auteur::text, true);

  begin
    if p_id is null then
      insert into public.produit (famille, slug, titre_fr, titre_en, description_fr, description_en, univers_id, prix_cents, delai_fabrication_jours)
      values (v_famille, v_slug, v_titre_fr, v_titre_en, v_desc_fr, v_desc_en, v_univers, v_prix, v_delai)
      returning id into v_id;
    else
      v_id := p_id;
      update public.produit
        set famille = v_famille, slug = v_slug, titre_fr = v_titre_fr, titre_en = v_titre_en,
            description_fr = v_desc_fr, description_en = v_desc_en, univers_id = v_univers,
            prix_cents = v_prix, delai_fabrication_jours = v_delai, modifie_le = now()
        where id = v_id;
    end if;
  exception when unique_violation then
    -- Deux enregistrements simultanés de la même adresse.
    raise exception 'KS_SLUG_PRIS' using errcode = 'P0001';
  end;

  -- Remplacement de l'ensemble des variantes : les tailles absentes sont supprimées, les présentes mises à jour (même ligne).
  delete from public.variante v where v.produit_id = v_id and not (v.taille = any (v_tailles));

  for v_var in select value from jsonb_array_elements(p_variantes) loop
    v_taille := v_var ->> 'taille';
    v_delai_var := nullif(v_var ->> 'delai_fabrication_jours', '')::integer;
    if v_taille = 'sur_mesure' then
      v_stock := 0;
      v_commande := true;
    else
      v_stock := (v_var ->> 'stock')::integer;
      v_commande := coalesce((v_var ->> 'fabrication_sur_commande')::boolean, false);
    end if;
    insert into public.variante as va (produit_id, taille, stock, fabrication_sur_commande, delai_fabrication_jours)
    values (v_id, v_taille, v_stock, v_commande, v_delai_var)
    on conflict (produit_id, taille) do update
      set stock = excluded.stock,
          fabrication_sur_commande = excluded.fabrication_sur_commande,
          delai_fabrication_jours = excluded.delai_fabrication_jours
      where (va.stock, va.fabrication_sur_commande, va.delai_fabrication_jours)
        is distinct from (excluded.stock, excluded.fabrication_sur_commande, excluded.delai_fabrication_jours);
  end loop;

  return v_id;
end;
$$;

revoke all on function public.enregistrer_produit(jsonb, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.enregistrer_produit(jsonb, uuid, jsonb, jsonb) to service_role;
