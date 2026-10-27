-- Story 3.1 : créer un Kit et ses fichiers (AD-2, AD-3, AD-18, AD-30, règle 1).
-- Famille « kit » dans produit, lien un pour un vers un cosplay ou un accessoire, tables de fichiers (données publiables séparées du
-- chemin de stockage), bucket privé kits-private sans aucune politique pour anon ni authenticated.
-- Écriture : aucune depuis anon ni authenticated ; seules les fonctions ci-dessous, SECURITY DEFINER, service_role seulement,
-- droit admin revérifié en base sur p_auteur (exiger_admin). Aucune donnée par défaut. Les migrations précédentes ne sont pas modifiées.

-- 1. Famille « kit » et prix 0 (réservé aux Kits : le Kit gratuit).
alter table public.produit drop constraint produit_famille_check;
alter table public.produit add constraint produit_famille_check check (famille in ('cosplay', 'accessoire', 'kit'));

alter table public.produit drop constraint produit_prix_cents_check;
alter table public.produit add constraint produit_prix_cents_check
  check (prix_cents is null or (prix_cents <= 1000000 and (prix_cents > 0 or (prix_cents = 0 and famille = 'kit'))));

-- 2. Colonnes propres au Kit. Elles ne sont lisibles par anon qu'avec le produit publié (politique produit_lecture_publiee).
alter table public.produit
  add column materiel_fr text check (materiel_fr is null or char_length(materiel_fr) between 1 and 5000),
  add column materiel_en text check (materiel_en is null or char_length(materiel_en) between 1 and 5000),
  add column niveau text check (niveau is null or niveau in ('debutant', 'intermediaire', 'avance')),
  -- Cosplay ou accessoire lié à ce Kit. Un seul Kit par cosplay ou accessoire (unique), un seul lien par Kit (une colonne).
  add column produit_lie_id uuid references public.produit (id) on delete set null;

alter table public.produit add constraint produit_produit_lie_id_key unique (produit_lie_id);
alter table public.produit add constraint produit_kit_champs
  check (famille = 'kit' or (materiel_fr is null and materiel_en is null and niveau is null and produit_lie_id is null));
alter table public.produit add constraint produit_lie_pas_soi check (produit_lie_id is null or produit_lie_id <> id);

-- La famille ne passe jamais vers ou depuis « kit » ; la cible d'un lien est un cosplay ou un accessoire, jamais un Kit.
create function public.verifier_produit_kit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.famille is distinct from old.famille and (old.famille = 'kit' or new.famille = 'kit') then
    raise exception 'KS_FAMILLE_INVALIDE' using errcode = 'P0001';
  end if;
  if new.produit_lie_id is not null and (tg_op = 'INSERT' or new.produit_lie_id is distinct from old.produit_lie_id) then
    if not exists (select 1 from public.produit c where c.id = new.produit_lie_id and c.famille in ('cosplay', 'accessoire')) then
      raise exception 'KS_KIT_LIE_INVALIDE' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.verifier_produit_kit() from public, anon, authenticated;

create trigger produit_verifier_kit
  before insert or update on public.produit
  for each row execute function public.verifier_produit_kit();

-- 3. Un Kit ne peut pas être publié dans cette story : sa publication (vidéo, fichiers, sous-titres) est définie par la story 3.2.
-- manques_publication reprend la fonction de la story 2.2 à l'identique, avec ce refus en plus.
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
  if v_produit.famille = 'kit' then
    return array['kit']::text[];
  end if;
  if v_produit.prix_cents is null then
    v_manques := v_manques || 'prix'::text;
  end if;
  if not exists (select 1 from public.produit_photo ph where ph.produit_id = p_produit_id) then
    v_manques := v_manques || 'photo'::text;
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
  if not exists (select 1 from public.variante va where va.produit_id = p_produit_id) then
    v_manques := v_manques || 'variante'::text;
  end if;
  return v_manques;
end;
$$;

revoke all on function public.manques_publication(uuid) from public, anon, authenticated;
grant execute on function public.manques_publication(uuid) to service_role;

-- 4. Fichiers d'un Kit. fichier_kit : données publiables seulement. fichier_kit_prive : chemin dans kits-private, aucune lecture publique.
create table public.fichier_kit (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references public.produit (id) on delete cascade,
  nom_fr text not null check (char_length(nom_fr) between 1 and 120),
  nom_en text not null check (char_length(nom_en) between 1 and 120),
  format text not null check (format in ('pdf_a4', 'pdf_letter', 'svg', 'stl', 'transcription')),
  -- 50 Mo au plus (52 428 800 octets) ; 1 Mo pour une transcription. Miroir TypeScript : TAILLE_MAX_FICHIER_KIT.
  taille_octets bigint not null check (taille_octets > 0 and taille_octets <= 52428800 and (format <> 'transcription' or taille_octets <= 1048576)),
  ordre integer not null check (ordre >= 1),
  version integer not null default 1 check (version >= 1),
  cree_le timestamptz not null default now(),
  constraint fichier_kit_ordre_unique unique (produit_id, ordre)
);

create table public.fichier_kit_prive (
  fichier_id uuid primary key references public.fichier_kit (id) on delete cascade,
  -- Objet du bucket kits-private : <produit>/<uuid>.<extension du format>.
  chemin_stockage text not null unique check (char_length(chemin_stockage) between 1 and 200)
);

alter table public.fichier_kit enable row level security;
alter table public.fichier_kit_prive enable row level security;

revoke all on public.fichier_kit from public, anon, authenticated;
revoke all on public.fichier_kit_prive from public, anon, authenticated;
grant select on public.fichier_kit to anon, authenticated;

-- Les fichiers d'un Kit publié (et passé) sont listables ; ceux d'un brouillon sont introuvables côté public.
-- Aucune politique sur fichier_kit_prive : RLS active, personne hors service ne lit ni n'écrit.
create policy fichier_kit_lecture_publiee on public.fichier_kit
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.produit p
      where p.id = fichier_kit.produit_id and p.famille = 'kit' and p.publie_le is not null and p.publie_le <= now()
    )
  );

create trigger fichier_kit_journaliser
  after insert or update or delete on public.fichier_kit
  for each row execute function public.journaliser('id');

-- 5. Bucket privé : jamais public, aucune politique storage.objects pour anon, authenticated ou public. L'envoi passe par un jeton
-- signé créé par le serveur, la lecture par un lien signé de courte durée (story 3.6).
insert into storage.buckets (id, name, public, file_size_limit)
values ('kits-private', 'kits-private', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

-- 6. Extension d'un format (interne).
create function public.extension_fichier_kit(p_format text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_format
    when 'pdf_a4' then 'pdf'
    when 'pdf_letter' then 'pdf'
    when 'svg' then 'svg'
    when 'stl' then 'stl'
    when 'transcription' then 'txt'
  end
$$;

revoke all on function public.extension_fichier_kit(text) from public, anon, authenticated;
grant execute on function public.extension_fichier_kit(text) to service_role;

-- 7. Crée (p_id nul) ou modifie un brouillon de Kit (admin).
-- p_kit : famille (kit), slug, titre_fr, titre_en, description_fr, description_en, materiel_fr, materiel_en, univers_id, prix_cents
-- (0 admis), niveau, produit_lie_id. Ne pose jamais publie_le.
create function public.enregistrer_kit(p_auteur jsonb, p_id uuid, p_kit jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_slug text;
  v_titre_fr text;
  v_titre_en text;
  v_desc_fr text;
  v_desc_en text;
  v_mat_fr text;
  v_mat_en text;
  v_univers uuid;
  v_prix integer;
  v_niveau text;
  v_lie uuid;
  v_texte text;
  v_id uuid;
  v_famille_actuelle text;
  v_contrainte text;
begin
  perform public.exiger_admin(p_auteur);
  if p_kit is null or jsonb_typeof(p_kit) <> 'object' then
    raise exception 'KS_PRODUIT_INVALIDE' using errcode = 'P0001';
  end if;
  if p_kit ->> 'famille' is distinct from 'kit' then
    raise exception 'KS_FAMILLE_INVALIDE' using errcode = 'P0001';
  end if;

  v_titre_fr := btrim(coalesce(p_kit ->> 'titre_fr', ''));
  if char_length(v_titre_fr) < 1 or char_length(v_titre_fr) > 120 then
    raise exception 'KS_TITRE_INVALIDE' using errcode = 'P0001';
  end if;
  v_titre_en := nullif(btrim(coalesce(p_kit ->> 'titre_en', '')), '');
  if v_titre_en is not null and char_length(v_titre_en) > 120 then
    raise exception 'KS_TITRE_INVALIDE' using errcode = 'P0001';
  end if;

  v_desc_fr := nullif(btrim(coalesce(p_kit ->> 'description_fr', '')), '');
  v_desc_en := nullif(btrim(coalesce(p_kit ->> 'description_en', '')), '');
  v_mat_fr := nullif(btrim(coalesce(p_kit ->> 'materiel_fr', '')), '');
  v_mat_en := nullif(btrim(coalesce(p_kit ->> 'materiel_en', '')), '');
  if char_length(coalesce(v_desc_fr, '')) > 5000 or char_length(coalesce(v_desc_en, '')) > 5000
     or char_length(coalesce(v_mat_fr, '')) > 5000 or char_length(coalesce(v_mat_en, '')) > 5000 then
    raise exception 'KS_TEXTE_INVALIDE' using errcode = 'P0001';
  end if;

  v_slug := btrim(coalesce(p_kit ->> 'slug', ''));
  if char_length(v_slug) < 1 or char_length(v_slug) > 80 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'KS_SLUG_INVALIDE' using errcode = 'P0001';
  end if;

  -- Prix en centimes entiers (absent = à fixer) : de 0 (Kit gratuit) à 1 000 000.
  v_texte := p_kit ->> 'prix_cents';
  if v_texte is not null then
    if v_texte !~ '^[0-9]{1,7}$' then
      raise exception 'KS_PRIX_INVALIDE' using errcode = 'P0001';
    end if;
    v_prix := v_texte::integer;
    if v_prix > 1000000 then
      raise exception 'KS_PRIX_INVALIDE' using errcode = 'P0001';
    end if;
  end if;

  v_niveau := nullif(btrim(coalesce(p_kit ->> 'niveau', '')), '');
  if v_niveau is not null and v_niveau not in ('debutant', 'intermediaire', 'avance') then
    raise exception 'KS_NIVEAU_INVALIDE' using errcode = 'P0001';
  end if;

  v_texte := p_kit ->> 'univers_id';
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
    -- Cette fonction ne touche que les Kits.
    if v_famille_actuelle <> 'kit' then
      raise exception 'KS_FAMILLE_INVALIDE' using errcode = 'P0001';
    end if;
  end if;

  -- Lien : un cosplay ou un accessoire qui n'a pas déjà un autre Kit.
  v_texte := p_kit ->> 'produit_lie_id';
  if v_texte is not null then
    if v_texte !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'KS_KIT_LIE_INVALIDE' using errcode = 'P0001';
    end if;
    v_lie := v_texte::uuid;
    if not exists (select 1 from public.produit c where c.id = v_lie and c.famille in ('cosplay', 'accessoire')) then
      raise exception 'KS_KIT_LIE_INVALIDE' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.produit k where k.produit_lie_id = v_lie and k.id is distinct from p_id) then
      raise exception 'KS_KIT_LIE_INVALIDE' using errcode = 'P0001';
    end if;
  end if;

  if exists (select 1 from public.produit p where p.slug = v_slug and p.id is distinct from p_id) then
    raise exception 'KS_SLUG_PRIS' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);

  begin
    if p_id is null then
      insert into public.produit (famille, slug, titre_fr, titre_en, description_fr, description_en, materiel_fr, materiel_en, univers_id, prix_cents, niveau, produit_lie_id)
      values ('kit', v_slug, v_titre_fr, v_titre_en, v_desc_fr, v_desc_en, v_mat_fr, v_mat_en, v_univers, v_prix, v_niveau, v_lie)
      returning id into v_id;
    else
      v_id := p_id;
      update public.produit
        set slug = v_slug, titre_fr = v_titre_fr, titre_en = v_titre_en, description_fr = v_desc_fr, description_en = v_desc_en,
            materiel_fr = v_mat_fr, materiel_en = v_mat_en, univers_id = v_univers, prix_cents = v_prix, niveau = v_niveau,
            produit_lie_id = v_lie
        where id = v_id;
    end if;
  exception when unique_violation then
    -- Deux enregistrements simultanés : la même adresse ou le même cosplay lié.
    get stacked diagnostics v_contrainte = constraint_name;
    if v_contrainte = 'produit_produit_lie_id_key' then
      raise exception 'KS_KIT_LIE_INVALIDE' using errcode = 'P0001';
    end if;
    raise exception 'KS_SLUG_PRIS' using errcode = 'P0001';
  end;

  return v_id;
end;
$$;

revoke all on function public.enregistrer_kit(jsonb, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.enregistrer_kit(jsonb, uuid, jsonb) to service_role;

-- 8. Ajoute un fichier à un Kit (admin), en dernière position, version 1. L'objet est déjà dans kits-private (envoi TUS signé).
-- Le chemin respecte <produit>/<uuid>.<extension du format> en minuscules.
create function public.ajouter_fichier_kit(
  p_auteur jsonb, p_produit_id uuid, p_nom_fr text, p_nom_en text, p_format text, p_taille bigint, p_chemin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_famille text;
  v_nom_fr text := btrim(coalesce(p_nom_fr, ''));
  v_nom_en text := btrim(coalesce(p_nom_en, ''));
  v_ext text;
  v_ordre integer;
  v_id uuid;
begin
  perform public.exiger_admin(p_auteur);

  -- Verrou du produit : deux ajouts simultanés ne se partagent pas le même rang.
  select p.famille into v_famille from public.produit p where p.id = p_produit_id for update;
  if not found then
    raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_famille <> 'kit' then
    raise exception 'KS_FAMILLE_INVALIDE' using errcode = 'P0001';
  end if;

  v_ext := public.extension_fichier_kit(p_format);
  if v_ext is null then
    raise exception 'KS_FORMAT_INVALIDE' using errcode = 'P0001';
  end if;
  if char_length(v_nom_fr) < 1 or char_length(v_nom_fr) > 120 or char_length(v_nom_en) < 1 or char_length(v_nom_en) > 120 then
    raise exception 'KS_NOM_INVALIDE' using errcode = 'P0001';
  end if;
  if p_taille is null or p_taille < 1 or p_taille > 52428800 or (p_format = 'transcription' and p_taille > 1048576) then
    raise exception 'KS_TAILLE_FICHIER_INVALIDE' using errcode = 'P0001';
  end if;
  if p_chemin is null
     or p_chemin !~ ('^' || p_produit_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.' || v_ext || '$') then
    raise exception 'KS_CHEMIN_INVALIDE' using errcode = 'P0001';
  end if;

  select coalesce(max(f.ordre), 0) + 1 into v_ordre from public.fichier_kit f where f.produit_id = p_produit_id;

  perform set_config('ks.auteur', p_auteur::text, true);
  begin
    insert into public.fichier_kit (produit_id, nom_fr, nom_en, format, taille_octets, ordre)
    values (p_produit_id, v_nom_fr, v_nom_en, p_format, p_taille, v_ordre)
    returning id into v_id;
    insert into public.fichier_kit_prive (fichier_id, chemin_stockage) values (v_id, p_chemin);
  exception when unique_violation then
    -- Chemin déjà enregistré pour un autre fichier.
    raise exception 'KS_CHEMIN_INVALIDE' using errcode = 'P0001';
  end;
  return v_id;
end;
$$;

revoke all on function public.ajouter_fichier_kit(jsonb, uuid, text, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.ajouter_fichier_kit(jsonb, uuid, text, text, text, bigint, text) to service_role;

-- 9. Remplace le contenu d'un fichier (admin) : version + 1, nouvelle taille, nouveau chemin. Renvoie l'ancien chemin : le serveur
-- efface l'ancien objet APRÈS cette réponse (un orphelin vaut mieux qu'un fichier cassé). La version est journalisée avant et après.
create function public.remplacer_fichier_kit(p_auteur jsonb, p_fichier_id uuid, p_taille bigint, p_chemin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produit uuid;
  v_format text;
  v_ext text;
  v_ancien text;
begin
  perform public.exiger_admin(p_auteur);

  select f.produit_id into v_produit from public.fichier_kit f where f.id = p_fichier_id;
  if not found then
    raise exception 'KS_FICHIER_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Même verrou de produit que l'ajout et la suppression, puis relecture du fichier verrouillé.
  perform 1 from public.produit p where p.id = v_produit for update;
  select f.format, k.chemin_stockage into v_format, v_ancien
  from public.fichier_kit f join public.fichier_kit_prive k on k.fichier_id = f.id
  where f.id = p_fichier_id for update of f;
  if not found then
    raise exception 'KS_FICHIER_INTROUVABLE' using errcode = 'P0001';
  end if;

  v_ext := public.extension_fichier_kit(v_format);
  if p_taille is null or p_taille < 1 or p_taille > 52428800 or (v_format = 'transcription' and p_taille > 1048576) then
    raise exception 'KS_TAILLE_FICHIER_INVALIDE' using errcode = 'P0001';
  end if;
  if p_chemin is null
     or p_chemin !~ ('^' || v_produit::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.' || v_ext || '$')
     or p_chemin = v_ancien then
    raise exception 'KS_CHEMIN_INVALIDE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  begin
    update public.fichier_kit set taille_octets = p_taille, version = version + 1 where id = p_fichier_id;
    update public.fichier_kit_prive set chemin_stockage = p_chemin where fichier_id = p_fichier_id;
  exception when unique_violation then
    raise exception 'KS_CHEMIN_INVALIDE' using errcode = 'P0001';
  end;
  return v_ancien;
end;
$$;

revoke all on function public.remplacer_fichier_kit(jsonb, uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.remplacer_fichier_kit(jsonb, uuid, bigint, text) to service_role;

-- 10. Supprime un fichier (admin) et renvoie son chemin : le serveur efface l'objet APRÈS cette réponse.
create function public.supprimer_fichier_kit(p_auteur jsonb, p_fichier_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produit uuid;
  v_chemin text;
begin
  perform public.exiger_admin(p_auteur);

  select f.produit_id into v_produit from public.fichier_kit f where f.id = p_fichier_id;
  if not found then
    raise exception 'KS_FICHIER_INTROUVABLE' using errcode = 'P0001';
  end if;
  perform 1 from public.produit p where p.id = v_produit for update;
  select k.chemin_stockage into v_chemin from public.fichier_kit_prive k where k.fichier_id = p_fichier_id;
  if not found then
    raise exception 'KS_FICHIER_INTROUVABLE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  delete from public.fichier_kit where id = p_fichier_id;
  if not found then
    raise exception 'KS_FICHIER_INTROUVABLE' using errcode = 'P0001';
  end if;
  return v_chemin;
end;
$$;

revoke all on function public.supprimer_fichier_kit(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.supprimer_fichier_kit(jsonb, uuid) to service_role;
