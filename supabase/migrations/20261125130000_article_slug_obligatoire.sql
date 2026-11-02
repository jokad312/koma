-- Story 8.6 (correctif) : l'adresse de l'Article est obligatoire et unique.
-- Le champ reste facultatif dans l'interface : le service déduit l'adresse du titre quand elle est vide,
-- et l'Admin peut la corriger. La base refuse deux Articles à la même adresse, ce dont les pages publiques
-- /fr/blog/[slug] et /en/blog/[slug] (story 8.7) ont besoin.

create unique index article_slug_unique on public.article (slug) where slug is not null;

-- Même fonction que la migration 20261125120000, avec deux corrections :
--   * l'adresse vide est refusée explicitement (KS_SLUG_INVALIDE) au lieu de passer par la contrainte de colonne ;
--   * une adresse déjà prise est refusée (KS_SLUG_PRIS), y compris en cas de course entre deux écritures.
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
    if v_id is null then
      raise exception 'KS_ARTICLE_INTROUVABLE' using errcode = 'P0001';
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.enregistrer_article(jsonb, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.enregistrer_article(jsonb, uuid, jsonb, jsonb) to service_role;
