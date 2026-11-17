-- Story 9.16 g) : archivage des articles du blog (décision Q22 de Jonathan : la corbeille archive, jamais de suppression), sur le modèle de
-- l'archivage des produits (20270122100000_produits_archivage.sql).
-- 1. Colonne archive_le : un article archivé est dépublié, absent du blog public (la lecture publique exige déjà publie_le) et de la liste
--    par défaut de l'admin ; il est retrouvé par le filtre « Archivés ». La colonne n'est pas ouverte en lecture à anon ni à authenticated
--    (droits par colonne de 20261126100000_article_correctifs.sql, inchangés).
-- 2. Garde : un article archivé n'est jamais publié (déclencheur BEFORE, KS_ARTICLE_ARCHIVE), quel que soit le chemin d'écriture.
-- 3. publier_article recréée : le refus KS_ARTICLE_ARCHIVE passe avant la liste des manques (sinon un archivé incomplet répondrait « incomplet »).
--    Même fonction que 20261125120000_article.sql pour le reste (exiger_admin conservé : aucun droit n'est changé).
-- 4. archiver_article (dépublie + archive) et restaurer_article (retour en brouillon) : SECURITY DEFINER, search_path vide, p_auteur en premier,
--    exiger_personnel (Admin ou Assistant, rôle relu en base : le droit blog.gerer de la matrice est accordé aux deux), ks.auteur posé avant
--    l'écriture (journal_audit par le déclencheur article_journaliser), service_role seulement. Ni image, ni texte ne sont touchés ; rien
--    n'est supprimé.
-- Les migrations précédentes ne sont pas modifiées.

-- 1.
alter table public.article add column archive_le timestamptz;

-- 2.
create function public.refuser_publication_article_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archive_le is not null and new.publie_le is not null then
    raise exception 'KS_ARTICLE_ARCHIVE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.refuser_publication_article_archive() from public, anon, authenticated;

create trigger article_archive_non_publie
  before insert or update on public.article
  for each row execute function public.refuser_publication_article_archive();

-- 3. Identique à la story 8.6, plus le refus d'un article archivé (avant la complétude).
create or replace function public.publier_article(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publie timestamptz;
  v_archive timestamptz;
  v_titre_fr text;
  v_texte_fr text;
begin
  perform public.exiger_admin(p_auteur);
  select a.publie_le, a.archive_le into v_publie, v_archive from public.article a where a.id = p_id for update;
  if not found then
    raise exception 'KS_ARTICLE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_archive is not null then
    raise exception 'KS_ARTICLE_ARCHIVE' using errcode = 'P0001';
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

-- 4. Archive un article (Admin ou Assistant) : publie_le remis à nul et archive_le posé, en une seule écriture (une ligne au journal).
-- Déjà archivé : sans effet.
create function public.archiver_article(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archive timestamptz;
begin
  perform public.exiger_personnel(p_auteur);
  select a.archive_le into v_archive from public.article a where a.id = p_id for update;
  if not found then
    raise exception 'KS_ARTICLE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_archive is not null then
    return;
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.article set publie_le = null, archive_le = now() where id = p_id;
end;
$$;

revoke all on function public.archiver_article(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.archiver_article(jsonb, uuid) to service_role;

-- Restaure un article archivé (Admin ou Assistant) : il revient en brouillon (publie_le reste nul). Pas archivé : sans effet.
create function public.restaurer_article(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archive timestamptz;
begin
  perform public.exiger_personnel(p_auteur);
  select a.archive_le into v_archive from public.article a where a.id = p_id for update;
  if not found then
    raise exception 'KS_ARTICLE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_archive is null then
    return;
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.article set archive_le = null where id = p_id;
end;
$$;

revoke all on function public.restaurer_article(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.restaurer_article(jsonb, uuid) to service_role;
