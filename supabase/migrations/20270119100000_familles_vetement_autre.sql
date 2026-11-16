-- Story 9.15 (2/2) : familles « vetement » (tailles XS à XXL × couleurs) et « autre » (une variante « unique »), physiques partout.
-- Physique = toute famille autre que « kit » (règle 10, décision de Jonathan du 2026-11-15) : le panier, la Commande, la réservation et le
-- décompte du stock passent par la variante, sans liste de familles physiques. Aucune migration appliquée n'est modifiée : tout est repris
-- ici par alter, create or replace ou drop/create. Droits et RLS identiques à l'existant ; journal d'audit inchangé (déclencheurs journaliser).

-- 1. Familles autorisées.
alter table public.produit drop constraint produit_famille_check;
alter table public.produit add constraint produit_famille_check check (famille in ('cosplay', 'accessoire', 'vetement', 'autre', 'kit'));

-- 2. Variante : couleur facultative (Vêtement seulement), taille « unique » (Autre article seulement).
alter table public.variante
  add column couleur_fr text check (couleur_fr is null or (char_length(couleur_fr) between 1 and 40 and couleur_fr = btrim(couleur_fr))),
  add column couleur_en text check (couleur_en is null or (char_length(couleur_en) between 1 and 40 and couleur_en = btrim(couleur_en))),
  add column couleur_hex text check (couleur_hex is null or couleur_hex ~ '^#[0-9A-F]{6}$'),
  -- Le nom anglais et la pastille n'existent que pour une couleur nommée en français.
  add constraint variante_couleur_coherente check (couleur_fr is not null or (couleur_en is null and couleur_hex is null));

alter table public.variante drop constraint variante_taille_check;
alter table public.variante add constraint variante_taille_check check (taille in ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'sur_mesure', 'unique'));

-- Une ligne par taille et par couleur ; « sans couleur » compte comme une valeur (les variantes existantes restent valides).
alter table public.variante drop constraint variante_une_par_taille;
alter table public.variante add constraint variante_une_par_taille_couleur unique nulls not distinct (produit_id, taille, couleur_fr);

-- Autre article : une seule variante (de taille « unique », contrôle ci-dessous).
create unique index variante_unique_seule on public.variante (produit_id) where taille = 'unique';

-- Lecture publique des nouvelles colonnes (le stock reste caché) ; la politique variante_lecture_publiee s'applique toujours.
grant select (couleur_fr, couleur_en, couleur_hex) on public.variante to anon, authenticated;

-- 3. Cohérence variante / famille, contrôlée par la base quelle que soit la fonction qui écrit :
--   taille « unique » si et seulement si la famille est « autre » ; Vêtement sans sur-mesure ; couleur interdite hors Vêtement.
create function public.verifier_variante_famille()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_famille text;
begin
  select p.famille into v_famille from public.produit p where p.id = new.produit_id;
  if (new.taille = 'unique') <> (v_famille = 'autre') then
    raise exception 'KS_TAILLE_INVALIDE' using errcode = 'P0001';
  end if;
  if v_famille = 'vetement' and new.taille = 'sur_mesure' then
    raise exception 'KS_TAILLE_INVALIDE' using errcode = 'P0001';
  end if;
  if new.couleur_fr is not null and v_famille <> 'vetement' then
    raise exception 'KS_COULEUR_INVALIDE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.verifier_variante_famille() from public, anon, authenticated;

create trigger variante_verifier_famille
  before insert or update on public.variante
  for each row execute function public.verifier_variante_famille();

-- La famille d'un Vêtement ou d'un Autre article ne change jamais, et aucune famille ne le devient (variantes incompatibles).
create function public.verifier_famille_figee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.famille is distinct from old.famille and (old.famille in ('vetement', 'autre') or new.famille in ('vetement', 'autre')) then
    raise exception 'KS_FAMILLE_INVALIDE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.verifier_famille_figee() from public, anon, authenticated;

create trigger produit_verifier_famille_figee
  before update of famille on public.produit
  for each row execute function public.verifier_famille_figee();

-- 4. enregistrer_produit : même signature, recréée pour les nouvelles familles et la couleur des variantes.
-- p_variantes : tableau d'objets taille, couleur_fr, couleur_en, couleur_hex, stock, fabrication_sur_commande, delai_fabrication_jours.
-- Tailles par famille : cosplay XS à XXL et sur_mesure ; accessoire et vetement XS à XXL ; autre « unique » seulement (une seule ligne,
-- créée d'office si le tableau est vide). Couleur : Vêtement seulement, toutes les variantes ou aucune ; une couleur garde le même nom
-- anglais et la même pastille sur toutes ses tailles ; deux couleurs ne diffèrent jamais par la seule casse. Chaque variante existante est
-- désignée par son identifiant (« id ») et mise à jour SUR PLACE (renommer une couleur = mettre à jour couleur_fr, couleur_en, couleur_hex :
-- commandes et paniers gardent leur ligne) ; une entrée sans identifiant reprend la variante du même couple (taille, couleur), sinon elle est
-- créée. Une variante absente est supprimée, sauf si elle a déjà été commandée : KS_VARIANTE_COMMANDEE, rien n'est écrit.
create or replace function public.enregistrer_produit(p_auteur jsonb, p_id uuid, p_produit jsonb, p_variantes jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_famille text;
  v_famille_actuelle text;
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
  v_couleur_fr text;
  v_couleur_en text;
  v_couleur_hex text;
  v_stock integer;
  v_commande boolean;
  v_delai_var integer;
  v_cles text[] := '{}';
  v_cle text;
  v_avec_couleur integer := 0;
  v_sans_couleur integer := 0;
  v_ids uuid[] := '{}';
  v_var_id uuid;
  v_gardees uuid[];
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

  -- Familles physiques (le Kit a sa propre fonction, enregistrer_kit).
  v_famille := p_produit ->> 'famille';
  if v_famille is null or v_famille not in ('cosplay', 'accessoire', 'vetement', 'autre') then
    raise exception 'KS_FAMILLE_INVALIDE' using errcode = 'P0001';
  end if;

  -- Autre article : sa variante « Taille unique » existe toujours, même sans saisie.
  if v_famille = 'autre' and jsonb_array_length(p_variantes) = 0 then
    p_variantes := '[{"taille": "unique", "stock": "0", "fabrication_sur_commande": false}]'::jsonb;
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
    select p.famille into v_famille_actuelle from public.produit p where p.id = p_id for update;
    if not found then
      raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
    end if;
    -- Un Vêtement ou un Autre article garde sa famille ; aucune famille ne le devient.
    if v_famille_actuelle is distinct from v_famille
       and (v_famille_actuelle in ('vetement', 'autre', 'kit') or v_famille in ('vetement', 'autre')) then
      raise exception 'KS_FAMILLE_INVALIDE' using errcode = 'P0001';
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
    if v_taille is null
       or (v_famille = 'cosplay' and v_taille not in ('XS', 'S', 'M', 'L', 'XL', 'XXL', 'sur_mesure'))
       or (v_famille in ('accessoire', 'vetement') and v_taille not in ('XS', 'S', 'M', 'L', 'XL', 'XXL'))
       or (v_famille = 'autre' and v_taille <> 'unique') then
      raise exception 'KS_TAILLE_INVALIDE' using errcode = 'P0001';
    end if;

    v_couleur_fr := nullif(btrim(coalesce(v_var ->> 'couleur_fr', '')), '');
    v_couleur_en := nullif(btrim(coalesce(v_var ->> 'couleur_en', '')), '');
    v_couleur_hex := upper(nullif(btrim(coalesce(v_var ->> 'couleur_hex', '')), ''));
    if v_couleur_fr is null and (v_couleur_en is not null or v_couleur_hex is not null) then
      raise exception 'KS_COULEUR_INVALIDE' using errcode = 'P0001';
    end if;
    if v_couleur_fr is not null then
      if v_famille <> 'vetement' or char_length(v_couleur_fr) > 40 or char_length(coalesce(v_couleur_en, '')) > 40
         or (v_couleur_hex is not null and v_couleur_hex !~ '^#[0-9A-F]{6}$') then
        raise exception 'KS_COULEUR_INVALIDE' using errcode = 'P0001';
      end if;
      v_avec_couleur := v_avec_couleur + 1;
    else
      v_sans_couleur := v_sans_couleur + 1;
    end if;

    -- Identifiant d'une variante existante : du produit modifié, une seule fois.
    v_texte := nullif(btrim(coalesce(v_var ->> 'id', '')), '');
    if v_texte is not null then
      if p_id is null or v_texte !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         or not exists (select 1 from public.variante va where va.id = v_texte::uuid and va.produit_id = p_id)
         or v_texte::uuid = any (v_ids) then
        raise exception 'KS_TAILLE_INVALIDE' using errcode = 'P0001';
      end if;
      v_ids := v_ids || v_texte::uuid;
    end if;

    -- Une seule ligne par couple (taille, couleur).
    v_cle := v_taille || chr(31) || coalesce(lower(v_couleur_fr), '');
    if v_cle = any (v_cles) then
      raise exception 'KS_TAILLE_INVALIDE' using errcode = 'P0001';
    end if;
    v_cles := v_cles || v_cle;

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

  -- Vêtement : toutes les variantes ont une couleur, ou aucune.
  if v_avec_couleur > 0 and v_sans_couleur > 0 then
    raise exception 'KS_COULEUR_INVALIDE' using errcode = 'P0001';
  end if;
  -- Une couleur a le même nom anglais et la même pastille sur toutes ses tailles, et une seule orthographe.
  if exists (
    select 1
    from jsonb_array_elements(p_variantes) e
    where nullif(btrim(coalesce(e ->> 'couleur_fr', '')), '') is not null
    group by lower(btrim(e ->> 'couleur_fr'))
    having count(distinct btrim(e ->> 'couleur_fr') || chr(31) || coalesce(btrim(e ->> 'couleur_en'), '') || chr(31) || coalesce(upper(btrim(e ->> 'couleur_hex')), '')) > 1
  ) then
    raise exception 'KS_COULEUR_INVALIDE' using errcode = 'P0001';
  end if;

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

  -- Variantes gardées : celles désignées par leur identifiant ; pour une entrée sans identifiant, celle du même couple (taille, couleur).
  select coalesce(array_agg(va.id), '{}') into v_gardees
  from public.variante va
  where va.produit_id = v_id
    and (
      va.id = any (v_ids)
      or exists (
        select 1 from jsonb_array_elements(p_variantes) e
        where nullif(btrim(coalesce(e ->> 'id', '')), '') is null
          and e ->> 'taille' = va.taille
          and lower(nullif(btrim(coalesce(e ->> 'couleur_fr', '')), '')) is not distinct from lower(va.couleur_fr)
      )
    );
  -- Une variante déjà commandée ne se retire jamais (les lignes de Commande la gardent) : code dédié, rien n'est écrit.
  if exists (
    select 1 from public.variante va join public.ligne_commande l on l.variante_id = va.id
    where va.produit_id = v_id and not (va.id = any (v_gardees))
  ) then
    raise exception 'KS_VARIANTE_COMMANDEE' using errcode = 'P0001';
  end if;
  delete from public.variante va where va.produit_id = v_id and not (va.id = any (v_gardees));

  -- Les variantes désignées par leur identifiant d'abord (un renommage libère son ancien couple avant une éventuelle création).
  for v_var in select value from jsonb_array_elements(p_variantes) order by nullif(btrim(coalesce(value ->> 'id', '')), '') is null loop
    v_taille := v_var ->> 'taille';
    v_couleur_fr := nullif(btrim(coalesce(v_var ->> 'couleur_fr', '')), '');
    v_couleur_en := nullif(btrim(coalesce(v_var ->> 'couleur_en', '')), '');
    v_couleur_hex := upper(nullif(btrim(coalesce(v_var ->> 'couleur_hex', '')), ''));
    v_delai_var := nullif(v_var ->> 'delai_fabrication_jours', '')::integer;
    if v_taille = 'sur_mesure' then
      v_stock := 0;
      v_commande := true;
    else
      v_stock := (v_var ->> 'stock')::integer;
      v_commande := coalesce((v_var ->> 'fabrication_sur_commande')::boolean, false);
    end if;
    v_var_id := nullif(btrim(coalesce(v_var ->> 'id', '')), '')::uuid;
    if v_var_id is null then
      select va.id into v_var_id from public.variante va
      where va.produit_id = v_id and va.taille = v_taille and lower(va.couleur_fr) is not distinct from lower(v_couleur_fr)
        and not (va.id = any (v_ids));
    end if;
    if v_var_id is not null then
      update public.variante va
        set taille = v_taille, couleur_fr = v_couleur_fr, couleur_en = v_couleur_en, couleur_hex = v_couleur_hex,
            stock = v_stock, fabrication_sur_commande = v_commande, delai_fabrication_jours = v_delai_var
        where va.id = v_var_id
          and (va.taille, va.couleur_fr, va.couleur_en, va.couleur_hex, va.stock, va.fabrication_sur_commande, va.delai_fabrication_jours)
            is distinct from (v_taille, v_couleur_fr, v_couleur_en, v_couleur_hex, v_stock, v_commande, v_delai_var);
    else
      insert into public.variante (produit_id, taille, couleur_fr, couleur_en, couleur_hex, stock, fabrication_sur_commande, delai_fabrication_jours)
      values (v_id, v_taille, v_couleur_fr, v_couleur_en, v_couleur_hex, v_stock, v_commande, v_delai_var);
    end if;
  end loop;

  return v_id;
end;
$$;

revoke all on function public.enregistrer_produit(jsonb, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.enregistrer_produit(jsonb, uuid, jsonb, jsonb) to service_role;

-- 4 bis. Couleurs déjà utilisées par les variantes (autocomplétion de l'admin, décision 2) : une ligne par nom français sans tenir compte de
-- la casse, dédoublonnée par la base (jamais tronquée côté serveur). Le nom anglais et la pastille renseignés passent avant les vides.
-- Admin seulement (service_role), lecture pure, sans table dédiée.
create function public.couleurs_utilisees()
returns table (couleur_fr text, couleur_en text, couleur_hex text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (lower(v.couleur_fr)) v.couleur_fr, v.couleur_en, v.couleur_hex
  from public.variante v
  where v.couleur_fr is not null
  order by lower(v.couleur_fr), v.couleur_en nulls last, v.couleur_hex nulls last, v.cree_le
$$;

revoke all on function public.couleurs_utilisees() from public, anon, authenticated;
grant execute on function public.couleurs_utilisees() to service_role;

-- 5. Ce qui manque pour publier : identique à 20261103100000, plus « couleurs » (en dernier pour un produit physique) quand une couleur
-- n'a pas de nom anglais.
create or replace function public.manques_publication(p_produit_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_produit public.produit%rowtype;
  v_manques text[] := '{}';
begin
  select * into v_produit from public.produit p where p.id = p_produit_id;
  if not found then
    return null;
  end if;
  if v_produit.prix_cents is null then
    v_manques := v_manques || 'prix'::text;
  end if;
  if not exists (select 1 from public.produit_photo ph where ph.produit_id = p_produit_id) then
    v_manques := v_manques || 'photo'::text;
  end if;
  if v_produit.famille = 'kit' then
    if btrim(coalesce(v_produit.titre_fr, '')) = '' then
      v_manques := v_manques || 'titre_fr'::text;
    end if;
  end if;
  if btrim(coalesce(v_produit.titre_en, '')) = '' then
    v_manques := v_manques || 'titre_en'::text;
  end if;
  if btrim(coalesce(v_produit.description_fr, '')) = '' then
    v_manques := v_manques || 'description_fr'::text;
  end if;
  if btrim(coalesce(v_produit.description_en, '')) = '' then
    v_manques := v_manques || 'description_en'::text;
  end if;
  if v_produit.famille <> 'kit' then
    if not exists (select 1 from public.variante va where va.produit_id = p_produit_id) then
      v_manques := v_manques || 'variante'::text;
    end if;
    if exists (select 1 from public.variante va where va.produit_id = p_produit_id and va.couleur_fr is not null and va.couleur_en is null) then
      v_manques := v_manques || 'couleurs'::text;
    end if;
    return v_manques;
  end if;
  if btrim(coalesce(v_produit.materiel_fr, '')) = '' then
    v_manques := v_manques || 'materiel_fr'::text;
  end if;
  if btrim(coalesce(v_produit.materiel_en, '')) = '' then
    v_manques := v_manques || 'materiel_en'::text;
  end if;
  if v_produit.niveau is null then
    v_manques := v_manques || 'niveau'::text;
  end if;
  if not exists (select 1 from public.fichier_kit f where f.produit_id = p_produit_id) then
    v_manques := v_manques || 'fichier'::text;
  end if;
  if not exists (select 1 from public.video_kit v where v.produit_id = p_produit_id) then
    v_manques := v_manques || 'video'::text;
  end if;
  if not exists (select 1 from public.sous_titre_kit s where s.produit_id = p_produit_id and s.langue = 'fr') then
    v_manques := v_manques || 'sous_titres_fr'::text;
  end if;
  if exists (
    select 1 from public.video_kit v
    where v.produit_id = p_produit_id and v.extrait_bunny_id is not null and not v.extrait_sans_parole
      and not ('fr' = any (v.extrait_sous_titres))
  ) then
    v_manques := v_manques || 'sous_titres_extrait_fr'::text;
  end if;
  return v_manques;
end;
$$;

revoke all on function public.manques_publication(uuid) from public, anon, authenticated;
grant execute on function public.manques_publication(uuid) to service_role;

-- 6. lister_catalogue : même signature et même corps que 20261103100000 ; accepte les familles « vetement » et « autre ».
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
  p_limite integer default 13,
  p_niveau text default null
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
  curseur_date text,
  niveau text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_famille is null or p_famille not in ('cosplay', 'accessoire', 'vetement', 'autre', 'kit') then
    raise exception 'KS_FAMILLE_INVALIDE' using errcode = 'P0001';
  end if;
  return query
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
    case when p.famille = 'kit' then 'disponible' else d.etat end as disponibilite,
    p.publie_le::text as curseur_date,
    p.niveau as niveau
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
    and (p_niveau is null or p.niveau = p_niveau)
    and (
      p_famille = 'kit'
      or p_dispo is null
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
  limit least(greatest(coalesce(p_limite, 13), 1), 300);
end;
$$;

revoke all on function public.lister_catalogue(text, text, uuid, integer, integer, text, text, timestamptz, integer, uuid, integer, text) from public;
grant execute on function public.lister_catalogue(text, text, uuid, integer, integer, text, text, timestamptz, integer, uuid, integer, text) to anon, authenticated, service_role;

-- 7. Fiche publique : disponibilite_variantes renvoie aussi la couleur de chaque variante (jamais de quantité). Colonnes ajoutées en fin :
-- drop puis create (le type de retour change). Ordre : taille (XS à XXL, sur mesure, unique), puis couleur (sans couleur d'abord).
drop function public.disponibilite_variantes(uuid);

create function public.disponibilite_variantes(p_produit uuid)
returns table (
  taille text,
  etat text,
  delai_jours integer,
  couleur_fr text,
  couleur_en text,
  couleur_hex text
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
    coalesce(v.delai_fabrication_jours, p.delai_fabrication_jours) as delai_jours,
    v.couleur_fr,
    v.couleur_en,
    v.couleur_hex
  from public.produit p
  join public.variante v on v.produit_id = p.id
  cross join capacite c
  where p.id = p_produit
    and p.publie_le is not null and p.publie_le <= now()
  order by array_position(array['XS', 'S', 'M', 'L', 'XL', 'XXL', 'sur_mesure', 'unique'], v.taille), v.couleur_fr nulls first
$$;

revoke all on function public.disponibilite_variantes(uuid) from public;
grant execute on function public.disponibilite_variantes(uuid) to anon, authenticated, service_role;

-- 8. ajouter_au_panier : nouvelle signature avec p_couleur (dernier, facultatif) ; l'ancienne (sans couleur) est retirée. Les appels sans
-- couleur restent valides. La variante est choisie par la taille ET la couleur : une couleur absente, oubliée ou inconnue ne trouve aucune
-- variante (KS_VARIANTE_INTROUVABLE), le Panier ne change pas. Autre article : taille absente = « unique ». Corps repris de 20261114100000.
drop function public.ajouter_au_panier(jsonb, uuid, uuid, uuid, text, integer);

create function public.ajouter_au_panier(p_auteur jsonb, p_panier uuid, p_compte uuid, p_produit uuid, p_taille text, p_nombre integer, p_couleur text default null)
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
  v_taille text := p_taille;
  v_couleur text := nullif(btrim(coalesce(p_couleur, '')), '');
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
    if p_taille is not null or v_couleur is not null then
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
    if v_produit.famille = 'autre' then
      v_taille := coalesce(v_taille, 'unique');
    end if;
    select id, stock, fabrication_sur_commande into v_variante
    from public.variante
    where produit_id = p_produit and taille = v_taille and couleur_fr is not distinct from v_couleur;
    if not found then
      raise exception 'KS_VARIANTE_INTROUVABLE' using errcode = 'P0001';
    end if;
    v_etat := public.etat_disponibilite(public.stock_disponible(v_variante.id), v_variante.fabrication_sur_commande, coalesce(public.capacite_fabrication_atteinte(), false));
    if v_etat in ('complet', 'epuise') then
      raise exception 'KS_INDISPONIBLE' using errcode = 'P0001';
    end if;
    select id, nombre into v_ligne from public.ligne_panier where panier_id = p_panier and produit_id = p_produit and variante_id = v_variante.id;
    v_total := coalesce(v_ligne.nombre, 0) + p_nombre;
    if v_total > 10 then
      raise exception 'KS_QUANTITE_INVALIDE' using errcode = 'P0001';
    end if;
    -- Une variante qui n'est pas fabriquée sur commande ne se commande pas au-delà de son stock.
    if not v_variante.fabrication_sur_commande and public.stock_disponible(v_variante.id) < v_total then
      raise exception 'KS_INDISPONIBLE' using errcode = 'P0001';
    end if;
    if v_ligne.id is not null then
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

revoke all on function public.ajouter_au_panier(jsonb, uuid, uuid, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.ajouter_au_panier(jsonb, uuid, uuid, uuid, text, integer, text) to service_role;

-- 9. lire_panier : la couleur de la ligne s'ajoute (colonnes en fin, drop puis create). Corps repris de 20261113100000.
drop function public.lire_panier(uuid);

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
  delai_jours integer,
  couleur_fr text,
  couleur_en text
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
    end,
    v.couleur_fr,
    v.couleur_en
  from public.ligne_panier l
  join public.produit p on p.id = l.produit_id
  left join public.variante v on v.id = l.variante_id
  cross join capacite c
  where l.panier_id = p_panier
  order by l.cree_le, l.id
$$;

revoke all on function public.lire_panier(uuid) from public, anon, authenticated;
grant execute on function public.lire_panier(uuid) to service_role;

-- 10. Réclamation : toute ligne physique prête à porter (famille autre que « kit », jamais sur mesure). Corps repris de 20261216100000.
create or replace function public.lignes_reclamables(p_compte uuid, p_numero text)
returns table (ligne_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id
  from public.commande c
  join public.ligne_commande l on l.commande_id = c.id
  join public.produit p on p.id = l.produit_id
  join public.variante v on v.id = l.variante_id
  where c.numero = p_numero and c.compte_id = p_compte
    and c.statut = 'livree' and c.livree_le is not null and c.livree_le > now() - interval '48 hours'
    and p.famille <> 'kit' and v.taille <> 'sur_mesure' and not l.annulee
    and not exists (select 1 from public.demande_client d where d.ligne_id = l.id and d.type = 'reclamation')
$$;
revoke all on function public.lignes_reclamables(uuid, text) from public, anon, authenticated;
grant execute on function public.lignes_reclamables(uuid, text) to service_role;

-- 11. Annulation (décision 10 de Jonathan, 2026-11-15, FR-25) : une Commande payée, pas encore en fabrication, est annulable si elle
-- contient un Cosplay (règle d'avant, en stock compris) OU au moins une ligne physique fabriquée sur commande (origine « fabrication »),
-- quelle que soit sa famille. Rien n'est retiré de la règle d'avant. Une seule source de la condition, lue par demander_annulation (client)
-- et annuler_commande (admin), reprises de leurs versions les plus récentes (20261214100000 et 20261217100000) ; le remboursement porte
-- toujours sur toutes les lignes physiques et le Forfait (les Kits ne sont jamais remboursés).
create function public.commande_contenu_annulable(p_commande uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ligne_commande l
    join public.produit p on p.id = l.produit_id
    where l.commande_id = p_commande
      and (p.famille = 'cosplay' or (p.famille <> 'kit' and l.variante_id is not null and l.origine = 'fabrication'))
  )
$$;
revoke all on function public.commande_contenu_annulable(uuid) from public, anon, authenticated;
grant execute on function public.commande_contenu_annulable(uuid) to service_role;

create or replace function public.demander_annulation(p_compte uuid, p_numero text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.commande;
  v_id uuid;
begin
  select * into v_c from public.commande where numero = p_numero and compte_id = p_compte for update;
  if not found then
    raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_c.statut <> 'payee' or v_c.offerte
     or not public.commande_contenu_annulable(v_c.id) then
    raise exception 'KS_ANNULATION_IMPOSSIBLE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.demande_client d where d.commande_id = v_c.id and d.type = 'annulation_commande' and d.statut in ('ouverte', 'acceptee')) then
    raise exception 'KS_DEMANDE_EN_COURS' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', jsonb_build_object('type', 'compte', 'id', p_compte)::text, true);
  insert into public.demande_client (commande_id, type) values (v_c.id, 'annulation_commande') returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.demander_annulation(uuid, text) from public, anon, authenticated;
grant execute on function public.demander_annulation(uuid, text) to service_role;

create or replace function public.annuler_commande(p_auteur jsonb, p_commande uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.commande;
  v_montant integer;
  v_inconnu integer;
begin
  perform public.exiger_admin(p_auteur);
  select * into v_c from public.commande where id = p_commande for update;
  if not found then
    raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_c.statut <> 'payee' or v_c.offerte
     or not public.commande_contenu_annulable(v_c.id) then
    raise exception 'KS_ANNULATION_IMPOSSIBLE' using errcode = 'P0001';
  end if;
  select coalesce(sum(l.prix_cents * l.nombre - l.reduction_cents), 0)::integer + v_c.forfait_cents into v_montant
    from public.ligne_commande l where l.commande_id = v_c.id and l.variante_id is not null;
  v_montant := least(greatest(v_montant, 0), v_c.total_cents);
  if v_montant <= 0 then
    raise exception 'KS_REMBOURSEMENT_NUL' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);

  perform 1 from public.variante
    where id in (select variante_id from public.ligne_commande where commande_id = v_c.id and variante_id is not null and origine = 'stock')
    order by id for update;
  select count(*)::integer into v_inconnu
    from public.ligne_commande l where l.commande_id = v_c.id and l.variante_id is not null and l.origine = 'stock' and l.stock_retire is null;
  update public.variante v set stock = v.stock + s.total
    from (select l.variante_id, sum(l.stock_retire)::integer as total from public.ligne_commande l
          where l.commande_id = v_c.id and l.variante_id is not null and l.origine = 'stock' and l.stock_retire is not null group by l.variante_id) s
    where v.id = s.variante_id;

  update public.ligne_commande set annulee = true where commande_id = v_c.id and variante_id is not null;
  update public.commande set statut = 'annulee', stock_a_verifier = (v_inconnu > 0), mis_a_jour_le = now() where id = v_c.id;
  update public.demande_client set statut = 'acceptee', traitee_le = now()
    where commande_id = v_c.id and type = 'annulation_commande' and statut = 'ouverte';
  insert into public.remboursement (cible_type, cible_id, montant_cents, devise) values ('commande', v_c.id, v_montant, v_c.devise);
  perform public.envois_planifier('commande_annulee', v_c.compte_id, jsonb_build_object('commande_id', v_c.id), 'commande_annulee:' || v_c.id::text);
  return v_montant;
end;
$$;
revoke all on function public.annuler_commande(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.annuler_commande(jsonb, uuid) to service_role;

-- 12. commande_calculer (Récapitulatif et Commande) : la couleur de chaque ligne s'ajoute au JSON des lignes, pour le libellé « Taille M · Noir ».
-- Même signature et même corps que 20261231100000 ; seuls la lecture de la variante et le JSON de ligne changent. Droits inchangés (fonction
-- interne : aucun rôle ne l'exécute directement).
create or replace function public.commande_calculer(p_compte uuid, p_panier uuid, p_zone text, p_mode text, p_strict boolean, p_code text default null, p_sauf_commande uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ligne record;
  v_lignes jsonb := '[]'::jsonb;
  v_prises jsonb := '{}'::jsonb;
  v_prises_n integer;
  v_fab_prises integer := 0;
  v_plafond integer;
  v_stock integer;
  v_etat text;
  v_origine text;
  v_delai integer;
  v_sous_total bigint := 0;
  v_forfait integer := 0;
  v_physique boolean := false;
  v_kit boolean := false;
  v_sur_mesure boolean := false;
  v_indisponible boolean := false;
  v_remise_manquante boolean := false;
  v_reglage text;
  v_empreinte text;
  v_eval jsonb;
  v_code jsonb := null;
  v_pct numeric;
  v_reduction bigint := 0;
  v_reste bigint;
  v_part bigint;
  v_eligibles integer;
  v_rang integer;
  v_json jsonb;
  v_nouvelles jsonb := '[]'::jsonb;
begin
  select (valeur)::integer into v_plafond from public.reglage where cle = 'plafond_fabrication' and valeur ~ '^[0-9]{1,5}$';

  for v_ligne in
    select lp.id as ligne_id, lp.produit_id, lp.variante_id, lp.nombre::integer as nombre,
           p.famille, p.slug, p.titre_fr, p.titre_en, p.prix_cents, p.publie_le, p.delai_fabrication_jours as delai_produit,
           v.taille, v.couleur_fr, v.couleur_en, v.fabrication_sur_commande as fabrication, v.delai_fabrication_jours as delai_variante
    from public.ligne_panier lp
    join public.produit p on p.id = lp.produit_id
    left join public.variante v on v.id = lp.variante_id
    where lp.panier_id = p_panier
    order by lp.cree_le, lp.id
  loop
    v_origine := null;
    v_delai := null;
    v_etat := 'disponible';

    if v_ligne.publie_le is null or v_ligne.publie_le > now() or v_ligne.prix_cents is null then
      v_etat := 'epuise';
    elsif v_ligne.prix_cents = 0 then
      raise exception 'KS_PRODUIT_GRATUIT' using errcode = 'P0001';
    elsif v_ligne.famille = 'kit' then
      v_kit := true;
      if exists (select 1 from public.acces_kit where compte_id = p_compte and produit_id = v_ligne.produit_id)
         or exists (
           select 1 from public.ligne_commande lc join public.commande c on c.id = lc.commande_id
           where c.compte_id = p_compte and c.statut in ('en_attente', 'echouee') and c.expire_le > now() and lc.produit_id = v_ligne.produit_id
         ) then
        raise exception 'KS_KIT_DEJA_POSSEDE' using errcode = 'P0001';
      end if;
    else
      v_physique := true;
      if v_ligne.taille = 'sur_mesure' then
        v_sur_mesure := true;
      end if;
      v_prises_n := coalesce((v_prises ->> v_ligne.variante_id::text)::integer, 0);
      v_stock := coalesce(public.stock_disponible(v_ligne.variante_id), 0) - v_prises_n;
      if v_stock >= v_ligne.nombre then
        v_origine := 'stock';
        v_prises := v_prises || jsonb_build_object(v_ligne.variante_id::text, v_prises_n + v_ligne.nombre);
      elsif v_ligne.fabrication and (v_plafond is null or public.places_fabrication_utilisees() + v_fab_prises + v_ligne.nombre <= v_plafond) then
        v_origine := 'fabrication';
        v_fab_prises := v_fab_prises + v_ligne.nombre;
        v_delai := coalesce(v_ligne.delai_variante, v_ligne.delai_produit);
        v_etat := 'sur_commande';
      else
        v_etat := 'epuise';
      end if;
    end if;

    if v_etat = 'epuise' then
      if p_strict then
        raise exception 'KS_INDISPONIBLE' using errcode = 'P0001';
      end if;
      v_indisponible := true;
    else
      v_sous_total := v_sous_total + v_ligne.prix_cents::bigint * v_ligne.nombre;
    end if;

    v_lignes := v_lignes || jsonb_build_object(
      'ligne_id', v_ligne.ligne_id, 'produit_id', v_ligne.produit_id, 'variante_id', v_ligne.variante_id,
      'famille', v_ligne.famille, 'slug', v_ligne.slug, 'titre_fr', v_ligne.titre_fr, 'titre_en', v_ligne.titre_en,
      'taille', v_ligne.taille, 'couleur_fr', v_ligne.couleur_fr, 'couleur_en', v_ligne.couleur_en, 'nombre', v_ligne.nombre, 'prix_cents', v_ligne.prix_cents,
      'etat', v_etat, 'origine', v_origine, 'delai_fabrication_jours', v_delai
    );
  end loop;

  if jsonb_array_length(v_lignes) = 0 then
    raise exception 'KS_PANIER_VIDE' using errcode = 'P0001';
  end if;

  -- Remise : seulement pour un Panier qui contient un produit physique. Retrait gratuit à Goma ; Bukavu : livraison obligatoire.
  if v_physique then
    if p_zone is null or p_mode is null then
      if p_strict then
        raise exception 'KS_REMISE_MANQUANTE' using errcode = 'P0001';
      end if;
      v_remise_manquante := true;
    elsif p_zone not in ('goma', 'bukavu') or p_mode not in ('retrait', 'livraison') or (p_zone = 'bukavu' and p_mode = 'retrait') then
      raise exception 'KS_REMISE_INVALIDE' using errcode = 'P0001';
    elsif p_mode = 'retrait' then
      v_forfait := 0;
      if p_strict and (
        coalesce((select btrim(valeur) from public.reglage where cle = 'retrait_goma_fr'), '') = ''
        or coalesce((select btrim(valeur) from public.reglage where cle = 'retrait_goma_en'), '') = ''
      ) then
        raise exception 'KS_REGLAGE_MANQUANT' using errcode = 'P0001';
      end if;
    else
      select valeur into v_reglage from public.reglage where cle = 'forfait_livraison_' || p_zone || '_cents';
      if v_reglage is null or v_reglage !~ '^[0-9]{1,6}$' then
        raise exception 'KS_REGLAGE_MANQUANT' using errcode = 'P0001';
      end if;
      v_forfait := v_reglage::integer;
    end if;
  elsif p_zone is not null or p_mode is not null then
    raise exception 'KS_REMISE_INVALIDE' using errcode = 'P0001';
  end if;

  -- Code promo (FR-46, FR-47, AD-8, AD-29) : la réduction porte sur tous les Produits, jamais sur le Forfait de livraison ; elle est calculée ici,
  -- depuis la base, puis répartie par ligne (réduction totale x prix de la ligne / sous-total, arrondie au centime inférieur, reste sur la dernière ligne).
  if p_code is not null and btrim(p_code) <> '' then
    v_eval := public.code_promo_evaluer(p_compte, p_code, p_sauf_commande);
    if (v_eval ->> 'valide')::boolean then
      v_pct := (v_eval ->> 'reduction_pct')::numeric;
      v_reduction := floor(v_sous_total * v_pct / 100)::bigint;
      -- Aucun paiement ne porte sur 0 USD : un code qui rendrait la Commande gratuite est refusé.
      if v_reduction > 0 and v_sous_total - v_reduction + v_forfait <= 0 then
        v_eval := jsonb_build_object('valide', false, 'erreur', 'code_total_nul');
        v_reduction := 0;
      end if;
    end if;
    if not (v_eval ->> 'valide')::boolean then
      if p_strict then
        raise exception '%', 'KS_' || upper(v_eval ->> 'erreur') using errcode = 'P0001';
      end if;
      v_reduction := 0;
    end if;
    v_code := v_eval;

    select count(*) into v_eligibles from jsonb_array_elements(v_lignes) as e where e ->> 'etat' <> 'epuise';
    v_rang := 0;
    v_reste := v_reduction;
    for v_json in select e from jsonb_array_elements(v_lignes) with ordinality as t(e, n) order by n loop
      if v_json ->> 'etat' = 'epuise' then
        v_nouvelles := v_nouvelles || (v_json || jsonb_build_object('reduction_cents', 0));
      else
        v_rang := v_rang + 1;
        if v_reduction = 0 then
          v_part := 0;
        elsif v_rang = v_eligibles then
          v_part := v_reste;
        else
          v_part := (v_reduction * (v_json ->> 'prix_cents')::bigint * (v_json ->> 'nombre')::bigint) / v_sous_total;
        end if;
        v_reste := v_reste - v_part;
        v_nouvelles := v_nouvelles || (v_json || jsonb_build_object('reduction_cents', v_part));
      end if;
    end loop;
    v_lignes := v_nouvelles;
  end if;

  -- Empreinte des lignes (ligne, nombre, origine, délai annoncé) : le client la renvoie à la création, qui la refuse si elle a changé
  -- (par exemple la dernière pièce en stock prise entre-temps : la ligne passe en fabrication au même prix, avec un délai que le client n'a pas vu).
  select md5(coalesce(string_agg((e ->> 'ligne_id') || ':' || (e ->> 'nombre') || ':' || coalesce(e ->> 'origine', '-') || ':' || coalesce(e ->> 'delai_fabrication_jours', '0'), ',' order by e ->> 'ligne_id'), ''))
    into v_empreinte from jsonb_array_elements(v_lignes) as e;

  return jsonb_build_object(
    'lignes', v_lignes, 'physique', v_physique, 'kit', v_kit, 'sur_mesure', v_sur_mesure,
    'sous_total_cents', v_sous_total, 'forfait_cents', v_forfait, 'reduction_cents', v_reduction, 'total_cents', v_sous_total - v_reduction + v_forfait,
    'code', v_code,
    'indisponible', v_indisponible, 'remise_manquante', v_remise_manquante, 'empreinte', v_empreinte
  );
end;
$$;

revoke all on function public.commande_calculer(uuid, uuid, text, text, boolean, text, uuid) from public, anon, authenticated, service_role;
