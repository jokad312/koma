-- Story 8.6 : création de l'Article (module blog) et fonctions d'écriture.
-- Modèle reproduite à l'identique de celui des Produits (functions comme definir_langue_profil et enregistrer_produit) :
-- ecriture reservee au service_role, p_auteur verifie le droit admin, journal_audit declenche le trigger journaliser.

create table public.article (
  id uuid primary key default gen_random_uuid(),
  auteur_id uuid not null,
  titre_fr text not null,
  titre_en text,
  texte_fr text not null,
  texte_en text,
  slug text,
  lien_produit_id uuid,
  images jsonb not null default '[]'::jsonb,
  publie_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

alter table public.article enable row level security;

-- Lecture publique : un article n'est lisible que s'il est publie (publie_le renseigne).
create policy article_lecture_publiee on public.article
  for select to anon, authenticated
  using (publie_le is not null and publie_le <= now());

create index article_publie_le_idx on public.article (publie_le) where publie_le is not null;

create trigger article_journaliser
  after insert or update or delete on public.article
  for each row execute function public.journaliser('id');

-- Tient modifie_le a jour a chaque modification de l'article.
create function public.toucher_modifie_le()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

revoke all on function public.toucher_modifie_le() from public, anon, authenticated;

create trigger article_modifie_le
  before update on public.article
  for each row execute function public.toucher_modifie_le();

-- Enregistre (création ou modification) un brouillon d'article : titres, textes FR/EN, slug, lien produit, images.
create function public.enregistrer_article(p_auteur jsonb, p_id uuid, p_article jsonb, p_images jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titre_fr text;
  v_titre_en text;
  v_texte_fr text;
  v_texte_en text;
  v_slug text;
  v_lien_produit_id uuid;
  v_images jsonb;
  v_id uuid;
begin
  perform public.exiger_admin(p_auteur);
  if p_article is null or jsonb_typeof(p_article) <> 'object' then
    raise exception 'KS_ARTICLE_INVALIDE' using errcode = 'P0001';
  end if;
  v_titre_fr := btrim(coalesce(p_article ->> 'titre_fr', ''));
  if char_length(v_titre_fr) < 1 or char_length(v_titre_fr) > 120 then
    raise exception 'KS_TITRE_INVALIDE' using errcode = 'P0001';
  end if;
  v_titre_en := nullif(btrim(coalesce(p_article ->> 'titre_en', '')), '');
  if v_titre_en is not null and char_length(v_titre_en) > 120 then
    raise exception 'KS_TITRE_INVALIDE' using errcode = 'P0001';
  end if;
  v_texte_fr := nullif(btrim(coalesce(p_article ->> 'texte_fr', '')), '');
  if char_length(coalesce(v_texte_fr, '')) > 5000 then
    raise exception 'KS_TEXTE_INVALIDE' using errcode = 'P0001';
  end if;
  v_texte_en := nullif(btrim(coalesce(p_article ->> 'texte_en', '')), '');
  if char_length(coalesce(v_texte_en, '')) > 5000 then
    raise exception 'KS_TEXTE_INVALIDE' using errcode = 'P0001';
  end if;
  v_slug := btrim(coalesce(p_article ->> 'slug', ''));
  if char_length(v_slug) > 80 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'KS_SLUG_INVALIDE' using errcode = 'P0001';
  end if;
  v_lien_produit_id := nullif(p_article ->> 'lien_produit_id', '')::uuid;
  if v_lien_produit_id is not null and not exists (select 1 from public.produit p where p.id = v_lien_produit_id) then
    raise exception 'KS_PRODUIT_INEXISTANT' using errcode = 'P0001';
  end if;
  v_images := coalesce(p_images, '[]'::jsonb);
  if jsonb_typeof(v_images) <> 'array' then
    raise exception 'KS_ARTICLE_INVALIDE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  if p_id is null then
    insert into public.article (auteur_id, titre_fr, titre_en, texte_fr, texte_en, slug, lien_produit_id, images, publie_le)
    values ((p_auteur ->> 'id')::uuid, v_titre_fr, v_titre_en, v_texte_fr, v_texte_en, v_slug, v_lien_produit_id, v_images, null)
    returning id into v_id;
  else
    update public.article
      set titre_fr = v_titre_fr,
          titre_en = v_titre_en,
          texte_fr = v_texte_fr,
          texte_en = v_texte_en,
          slug = v_slug,
          lien_produit_id = v_lien_produit_id,
          images = v_images,
          modifie_le = now()
    where id = p_id;
    select id into v_id from public.article where id = p_id;
  end if;

  return v_id;
end;
$$;

revoke all on function public.enregistrer_article(jsonb, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.enregistrer_article(jsonb, uuid, jsonb, jsonb) to service_role;

-- Publie un article (admin) : refuse si titre FR ou texte FR absent (KS_PUBLICATION_INCOMPLETE), puis pose publie_le = now().
-- Une image sans texte alternatif FR ou EN est refusee (texte alternatif obligatoire, regle de publication).
create function public.publier_article(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publie timestamptz;
  v_titre_fr text;
  v_texte_fr text;
begin
  perform public.exiger_admin(p_auteur);
  select a.publie_le into v_publie from public.article a where a.id = p_id for update;
  if not found then
    raise exception 'KS_ARTICLE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_publie is not null then
    return;
  end if;
  select a.titre_fr, a.texte_fr into v_titre_fr, v_texte_fr from public.article a where a.id = p_id;
  if char_length(coalesce(v_titre_fr, '')) < 1 or char_length(coalesce(v_texte_fr, '')) < 1 then
    raise exception 'KS_PUBLICATION_INCOMPLETE' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.article a,
         jsonb_array_elements(coalesce(a.images, '[]'::jsonb)) as img
    where a.id = p_id
      and (jsonb_typeof(img) <> 'object' or coalesce(img ->> 'alt_fr', '') = '' or coalesce(img ->> 'alt_en', '') = '')
  ) then
    raise exception 'KS_PUBLICATION_INCOMPLETE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.article set publie_le = now() where id = p_id;
end;
$$;

revoke all on function public.publier_article(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.publier_article(jsonb, uuid) to service_role;

-- Depublie un article (admin) : publie_le remis a null. Déjà brouillon : sans effet.
create function public.depublier_article(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publie timestamptz;
begin
  perform public.exiger_admin(p_auteur);
  select a.publie_le into v_publie from public.article a where a.id = p_id for update;
  if not found then
    raise exception 'KS_ARTICLE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_publie is null then
    return;
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.article set publie_le = null where id = p_id;
end;
$$;

revoke all on function public.depublier_article(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.depublier_article(jsonb, uuid) to service_role;
