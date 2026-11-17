-- Story 9.16 g) (correctifs de revue, appliqués après 20270123100000_articles_archivage.sql, qui n'est pas modifiée).
-- archiver_article et restaurer_article exigent l'Admin (exiger_admin), comme publier_article, depublier_article et enregistrer_article :
-- avec exiger_personnel, l'Assistant obtenait un nouveau moyen de dépublier un article, ce qui changeait les droits. Corps identiques sinon.

create or replace function public.archiver_article(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archive timestamptz;
begin
  perform public.exiger_admin(p_auteur);
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

create or replace function public.restaurer_article(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archive timestamptz;
begin
  perform public.exiger_admin(p_auteur);
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
