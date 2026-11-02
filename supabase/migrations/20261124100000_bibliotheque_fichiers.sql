-- Story 3.6 : Ma bibliothèque et téléchargement des fichiers de Kit.
-- Copies filigranées (table privée, aucune politique), et lectures par le serveur seulement : liste des Kits d'un Compte, fichiers d'un Kit,
-- fichier à remettre (avec l'email et le numéro de la Commande d'origine pour le filigrane), enregistrement d'une copie filigranée.
-- Chaque fonction vérifie l'accès (acces_kit) elle-même : sans accès, rien n'est renvoyé (règle 1, AD-11). Accès : service_role seulement.

create table public.fichier_filigrane (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references auth.users (id) on delete cascade,
  fichier_id uuid not null references public.fichier_kit (id) on delete cascade,
  version integer not null check (version >= 1),
  -- Objet du bucket kits-private : filigranes/<compte>/<fichier>-v<version>.pdf.
  chemin_stockage text not null unique check (char_length(chemin_stockage) between 1 and 250),
  cree_le timestamptz not null default now(),
  constraint fichier_filigrane_unique unique (compte_id, fichier_id, version)
);

alter table public.fichier_filigrane enable row level security;
revoke all on public.fichier_filigrane from public, anon, authenticated;
-- Aucune politique : ni lecture ni écriture hors service.

-- Les Kits d'un Compte, du plus récent au plus ancien, avec la première photo (vignette).
create function public.bibliotheque_lister(p_compte uuid)
returns table (produit_id uuid, slug text, titre_fr text, titre_en text, photo text, alt_fr text, alt_en text, acces_le timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.slug, p.titre_fr, p.titre_en, ph.fichier, ph.alt_fr, ph.alt_en, a.cree_le
  from public.acces_kit a
  join public.produit p on p.id = a.produit_id
  left join lateral (
    select f.fichier, f.alt_fr, f.alt_en from public.produit_photo f where f.produit_id = p.id order by f.position limit 1
  ) ph on true
  where a.compte_id = p_compte
  order by a.cree_le desc, p.slug;
$$;

-- Un Kit de la bibliothèque et ses fichiers actuels (nouvelle version comprise : FR-30). Null sans accès.
create function public.bibliotheque_kit(p_compte uuid, p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'produit_id', p.id, 'slug', p.slug, 'titre_fr', p.titre_fr, 'titre_en', p.titre_en,
    'fichiers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'nom_fr', f.nom_fr, 'nom_en', f.nom_en, 'format', f.format, 'taille_octets', f.taille_octets, 'version', f.version
      ) order by f.ordre)
      from public.fichier_kit f where f.produit_id = p.id
    ), '[]'::jsonb)
  )
  from public.produit p
  where p.slug = p_slug and p.famille = 'kit'
    and exists (select 1 from public.acces_kit a where a.compte_id = p_compte and a.produit_id = p.id);
$$;

-- Ce qu'il faut pour remettre un fichier : null si le Compte n'a pas accès au Kit du fichier.
create function public.bibliotheque_fichier_a_servir(p_compte uuid, p_fichier uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'fichier_id', f.id, 'format', f.format, 'version', f.version, 'nom_fr', f.nom_fr, 'nom_en', f.nom_en,
    'chemin_stockage', k.chemin_stockage,
    'email', u.email::text,
    'numero_commande', c.numero,
    'chemin_filigrane', (
      select w.chemin_stockage from public.fichier_filigrane w
      where w.compte_id = p_compte and w.fichier_id = f.id and w.version = f.version
    )
  )
  from public.fichier_kit f
  join public.fichier_kit_prive k on k.fichier_id = f.id
  join public.acces_kit a on a.produit_id = f.produit_id and a.compte_id = p_compte
  join public.commande c on c.id = a.commande_origine
  join auth.users u on u.id = p_compte
  where f.id = p_fichier;
$$;

-- Enregistre la copie filigranée d'un Compte pour une version. La première enregistrée gagne ; renvoie le chemin retenu.
-- Refusé (null) sans accès, ou si la version n'est plus la version actuelle du fichier.
create function public.bibliotheque_enregistrer_filigrane(p_compte uuid, p_fichier uuid, p_version integer, p_chemin text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_chemin text;
begin
  if not exists (
    select 1 from public.fichier_kit f
    join public.acces_kit a on a.produit_id = f.produit_id and a.compte_id = p_compte
    where f.id = p_fichier and f.version = p_version
  ) then
    return null;
  end if;
  insert into public.fichier_filigrane (compte_id, fichier_id, version, chemin_stockage)
  values (p_compte, p_fichier, p_version, p_chemin)
  on conflict (compte_id, fichier_id, version) do nothing;
  select w.chemin_stockage into v_chemin from public.fichier_filigrane w
  where w.compte_id = p_compte and w.fichier_id = p_fichier and w.version = p_version;
  return v_chemin;
end;
$$;

revoke all on function public.bibliotheque_lister(uuid) from public, anon, authenticated;
revoke all on function public.bibliotheque_kit(uuid, text) from public, anon, authenticated;
revoke all on function public.bibliotheque_fichier_a_servir(uuid, uuid) from public, anon, authenticated;
revoke all on function public.bibliotheque_enregistrer_filigrane(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.bibliotheque_lister(uuid) to service_role;
grant execute on function public.bibliotheque_kit(uuid, text) to service_role;
grant execute on function public.bibliotheque_fichier_a_servir(uuid, uuid) to service_role;
grant execute on function public.bibliotheque_enregistrer_filigrane(uuid, uuid, integer, text) to service_role;
