-- Story 2.3 : réglages de remise (forfaits de Goma et Bukavu, lieu de retrait), Plafond de fabrication, tranches de prix,
-- et fonctions de lecture de la disponibilité (AD-3, AD-13, AD-26).
-- Aucune valeur par défaut : une clé jamais saisie reste absente (l'admin affiche « Valeur à fixer »).
-- Les migrations précédentes ne sont pas modifiées : enregistrer_reglage est recréée (même signature), la politique remplacée.

-- Écrit un réglage (admin). Clés permises :
--   nom_site (1 à 60 caractères, jamais vide) ;
--   numero_whatsapp (format international « + » puis 8 à 15 chiffres, espaces retirés ; vide = effacé) ;
--   forfait_livraison_goma_cents, forfait_livraison_bukavu_cents (entier en centimes USD, 0 à 100 000 ; vide = effacé) ;
--   retrait_goma_fr, retrait_goma_en (1 à 500 caractères ; vide = effacé) ;
--   plafond_fabrication (entier de 1 à 10 000 pièces ; vide = effacé).
-- Le journal masque le numéro WhatsApp.
create or replace function public.enregistrer_reglage(p_auteur jsonb, p_cle text, p_valeur text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_valeur text;
  v_texte text;
  v_entier bigint;
begin
  perform public.exiger_admin(p_auteur);
  if p_cle is null or p_cle not in (
    'nom_site', 'numero_whatsapp',
    'forfait_livraison_goma_cents', 'forfait_livraison_bukavu_cents',
    'retrait_goma_fr', 'retrait_goma_en',
    'plafond_fabrication'
  ) then
    raise exception 'KS_REGLAGE_INCONNU' using errcode = 'P0001';
  end if;

  if p_cle = 'nom_site' then
    v_valeur := btrim(coalesce(p_valeur, ''));
    if char_length(v_valeur) < 1 or char_length(v_valeur) > 60 then
      raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
    end if;
  elsif p_cle = 'numero_whatsapp' then
    v_valeur := nullif(regexp_replace(coalesce(p_valeur, ''), '\s', '', 'g'), '');
    if v_valeur is not null and v_valeur !~ '^\+[0-9]{8,15}$' then
      raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
    end if;
  elsif p_cle in ('forfait_livraison_goma_cents', 'forfait_livraison_bukavu_cents') then
    v_texte := btrim(coalesce(p_valeur, ''));
    if v_texte = '' then
      v_valeur := null;
    else
      if v_texte !~ '^[0-9]{1,6}$' then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_entier := v_texte::bigint;
      if v_entier > 100000 then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_valeur := v_entier::text;
    end if;
  elsif p_cle in ('retrait_goma_fr', 'retrait_goma_en') then
    v_valeur := nullif(btrim(coalesce(p_valeur, '')), '');
    if v_valeur is not null and char_length(v_valeur) > 500 then
      raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
    end if;
  else
    -- plafond_fabrication
    v_texte := btrim(coalesce(p_valeur, ''));
    if v_texte = '' then
      v_valeur := null;
    else
      if v_texte !~ '^[0-9]{1,5}$' then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_entier := v_texte::bigint;
      if v_entier < 1 or v_entier > 10000 then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_valeur := v_entier::text;
    end if;
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  insert into public.reglage (cle, valeur, mis_a_jour_le)
  values (p_cle, v_valeur, now())
  on conflict (cle) do update set valeur = excluded.valeur, mis_a_jour_le = excluded.mis_a_jour_le;
end;
$$;

revoke all on function public.enregistrer_reglage(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.enregistrer_reglage(jsonb, text, text) to service_role;

-- Lecture publique : le nom, le numéro WhatsApp, les deux forfaits et le lieu de retrait (affichés sur les fiches).
-- Le Plafond de fabrication reste illisible par anon : capacité interne, jamais affichée.
drop policy reglage_lecture_publique on public.reglage;
create policy reglage_lecture_publique on public.reglage
  for select to anon, authenticated
  using (cle in (
    'nom_site', 'numero_whatsapp',
    'forfait_livraison_goma_cents', 'forfait_livraison_bukavu_cents',
    'retrait_goma_fr', 'retrait_goma_en'
  ));

-- Tranches de prix du filtre des catalogues : au plus 8, dans l'ordre d'affichage. Aucune tranche par défaut (décision du 2026-10-21).
-- haut_cents nul = tranche ouverte. Lecture publique ; aucune écriture directe.
create table public.tranche_prix (
  id uuid primary key default gen_random_uuid(),
  ordre integer not null unique check (ordre between 1 and 8),
  libelle_fr text not null check (char_length(libelle_fr) between 1 and 40),
  libelle_en text not null check (char_length(libelle_en) between 1 and 40),
  bas_cents integer not null check (bas_cents >= 0),
  haut_cents integer,
  constraint tranche_prix_bornes check (haut_cents is null or haut_cents > bas_cents)
);

alter table public.tranche_prix enable row level security;
revoke all on public.tranche_prix from public, anon, authenticated;
grant select on public.tranche_prix to anon, authenticated;

create policy tranche_prix_lecture_publique on public.tranche_prix
  for select to anon, authenticated
  using (true);

create trigger tranche_prix_journaliser
  after insert or update or delete on public.tranche_prix
  for each row execute function public.journaliser('id');

-- Remplace l'ensemble des tranches (admin) : liste vide = plus de tranche ; l'ordre est celui de la liste (1..n).
-- p_tranches : tableau d'objets libelle_fr, libelle_en, bas_cents, haut_cents (absent ou nul = tranche ouverte).
-- Une seule transaction : une liste invalide ne change rien.
create function public.enregistrer_tranches_prix(p_auteur jsonb, p_tranches jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_elem jsonb;
  v_libelle_fr text;
  v_libelle_en text;
  v_bas numeric;
  v_haut numeric;
  v_bas_json jsonb;
  v_haut_json jsonb;
begin
  perform public.exiger_admin(p_auteur);
  if p_tranches is null or jsonb_typeof(p_tranches) <> 'array' or jsonb_array_length(p_tranches) > 8 then
    raise exception 'KS_TRANCHE_INVALIDE' using errcode = 'P0001';
  end if;

  for v_elem in select value from jsonb_array_elements(p_tranches) loop
    if jsonb_typeof(v_elem) <> 'object' then
      raise exception 'KS_TRANCHE_INVALIDE' using errcode = 'P0001';
    end if;
    if jsonb_typeof(v_elem -> 'libelle_fr') is distinct from 'string' or jsonb_typeof(v_elem -> 'libelle_en') is distinct from 'string' then
      raise exception 'KS_TRANCHE_INVALIDE' using errcode = 'P0001';
    end if;
    v_libelle_fr := btrim(v_elem ->> 'libelle_fr');
    v_libelle_en := btrim(v_elem ->> 'libelle_en');
    if char_length(v_libelle_fr) not between 1 and 40 or char_length(v_libelle_en) not between 1 and 40 then
      raise exception 'KS_TRANCHE_INVALIDE' using errcode = 'P0001';
    end if;

    v_bas_json := v_elem -> 'bas_cents';
    v_haut_json := v_elem -> 'haut_cents';
    if jsonb_typeof(v_bas_json) is distinct from 'number' then
      raise exception 'KS_TRANCHE_INVALIDE' using errcode = 'P0001';
    end if;
    v_bas := (v_bas_json #>> '{}')::numeric;
    if v_bas <> trunc(v_bas) or v_bas < 0 or v_bas > 2147483647 then
      raise exception 'KS_TRANCHE_INVALIDE' using errcode = 'P0001';
    end if;
    if v_haut_json is null or jsonb_typeof(v_haut_json) = 'null' then
      v_haut := null;
    else
      if jsonb_typeof(v_haut_json) <> 'number' then
        raise exception 'KS_TRANCHE_INVALIDE' using errcode = 'P0001';
      end if;
      v_haut := (v_haut_json #>> '{}')::numeric;
      if v_haut <> trunc(v_haut) or v_haut > 2147483647 or v_haut <= v_bas then
        raise exception 'KS_TRANCHE_INVALIDE' using errcode = 'P0001';
      end if;
    end if;
  end loop;

  perform set_config('ks.auteur', p_auteur::text, true);
  -- Deux enregistrements simultanés se suivent : le second attend le premier, au lieu de heurter unique(ordre).
  lock table public.tranche_prix in share row exclusive mode;
  delete from public.tranche_prix where true;
  insert into public.tranche_prix (ordre, libelle_fr, libelle_en, bas_cents, haut_cents)
  select
    t.ordre,
    btrim(t.valeur ->> 'libelle_fr'),
    btrim(t.valeur ->> 'libelle_en'),
    (t.valeur ->> 'bas_cents')::numeric::integer,
    case when jsonb_typeof(t.valeur -> 'haut_cents') = 'number' then (t.valeur ->> 'haut_cents')::numeric::integer end
  from jsonb_array_elements(p_tranches) with ordinality as t(valeur, ordre);
end;
$$;

revoke all on function public.enregistrer_tranches_prix(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.enregistrer_tranches_prix(jsonb, jsonb) to service_role;

-- Disponibilité (lecture pure). Remplacées à l'epic 4 (create or replace) pour compter les réservations.
-- stock_disponible : renvoie le stock enregistré de la variante ; nul si la variante est inconnue ou invisible pour l'appelant
-- (security invoker : la RLS cache les variantes des brouillons). L'appelant ne doit jamais lire nul comme 0 ni comme « disponible ».
create function public.stock_disponible(p_variante uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select v.stock from public.variante v where v.id = p_variante
$$;

-- places_fabrication_utilisees : places du Plafond de fabrication déjà prises. Aucune commande n'existe encore : 0.
create function public.places_fabrication_utilisees()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select 0
$$;

revoke all on function public.stock_disponible(uuid) from public;
revoke all on function public.places_fabrication_utilisees() from public;
grant execute on function public.stock_disponible(uuid) to anon, authenticated, service_role;
grant execute on function public.places_fabrication_utilisees() to anon, authenticated, service_role;
