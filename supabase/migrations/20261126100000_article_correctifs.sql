-- Story 8.6 (correctifs de revue, appliqués après les migrations 20261125120000 et 20261125130000, qui ne sont pas modifiées).
--
-- 1. L'identifiant du Compte auteur ne doit pas être lisible par le public : anon et authenticated ne lisent plus que les colonnes
--    publiables (PostgREST permettait `?select=auteur_id` sur un article publié).
-- 2. Un article publié ne peut plus être vidé ni changer d'adresse : sans cela, un article en ligne pouvait perdre son texte français ou
--    ses textes alternatifs, ou casser les liens existants. Le titre, le texte français et les textes alternatifs des images restent
--    obligatoires tant que l'article est publié ; l'adresse est figée (KS_SLUG_PUBLIE) ; pour changer l'un ou l'autre, dépublier d'abord.
--    Même fonction que la migration 20261125130000, avec ces seuls ajouts (AD-1).

revoke select on public.article from anon, authenticated;
grant select (id, titre_fr, titre_en, texte_fr, texte_en, slug, lien_produit_id, images, publie_le, cree_le, modifie_le)
  on public.article to anon, authenticated;

create or replace function public.enregistrer_article(p_auteur jsonb, p_id uuid, p_article jsonb, p_images jsonb)
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
  v_publie timestamptz;
  v_slug_actuel text;
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
  if char_length(v_slug) < 1 or char_length(v_slug) > 80 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
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
  -- Chaque image vient du circuit d'envoi des photos produit : un objet avec un fichier nommé.
  if exists (
    select 1 from jsonb_array_elements(v_images) img
    where jsonb_typeof(img) <> 'object' or coalesce(img ->> 'fichier', '') = ''
  ) then
    raise exception 'KS_ARTICLE_INVALIDE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  if p_id is null then
    begin
      insert into public.article (auteur_id, titre_fr, titre_en, texte_fr, texte_en, slug, lien_produit_id, images, publie_le)
      values ((p_auteur ->> 'id')::uuid, v_titre_fr, v_titre_en, v_texte_fr, v_texte_en, v_slug, v_lien_produit_id, v_images, null)
      returning id into v_id;
    exception when unique_violation then
      raise exception 'KS_SLUG_PRIS' using errcode = 'P0001';
    end;
  else
    -- Verrou sur la ligne : l'état « publié » ne change pas entre la lecture et l'écriture.
    select a.publie_le, a.slug into v_publie, v_slug_actuel from public.article a where a.id = p_id for update;
    if not found then
      raise exception 'KS_ARTICLE_INTROUVABLE' using errcode = 'P0001';
    end if;
    if v_publie is not null then
      if v_texte_fr is null then
        raise exception 'KS_PUBLICATION_INCOMPLETE' using errcode = 'P0001';
      end if;
      if exists (
        select 1 from jsonb_array_elements(v_images) img
        where coalesce(img ->> 'alt_fr', '') = '' or coalesce(img ->> 'alt_en', '') = ''
      ) then
        raise exception 'KS_PUBLICATION_INCOMPLETE' using errcode = 'P0001';
      end if;
      if v_slug is distinct from v_slug_actuel then
        raise exception 'KS_SLUG_PUBLIE' using errcode = 'P0001';
      end if;
    end if;
    begin
      update public.article
        set titre_fr = v_titre_fr,
            titre_en = v_titre_en,
            texte_fr = v_texte_fr,
            texte_en = v_texte_en,
            slug = v_slug,
            lien_produit_id = v_lien_produit_id,
            images = v_images
      where id = p_id
      returning id into v_id;
    exception when unique_violation then
      raise exception 'KS_SLUG_PRIS' using errcode = 'P0001';
    end;
  end if;

  return v_id;
end;
$$;

revoke all on function public.enregistrer_article(jsonb, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.enregistrer_article(jsonb, uuid, jsonb, jsonb) to service_role;
