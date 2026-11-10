-- Story 7.1, correctif : « text[] || 'texte' » était lu comme un tableau (erreur 22P02) ; array_append, sans ambiguïté.
create or replace function public.manques_publication_evenement(p_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.evenement%rowtype;
  v_manques text[] := '{}';
begin
  select * into e from public.evenement where id = p_id;
  if not found then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if coalesce(e.titre_fr, '') = '' then v_manques := array_append(v_manques, 'titre_fr'); end if;
  if coalesce(e.titre_en, '') = '' then v_manques := array_append(v_manques, 'titre_en'); end if;
  if coalesce(e.description_fr, '') = '' then v_manques := array_append(v_manques, 'description_fr'); end if;
  if coalesce(e.description_en, '') = '' then v_manques := array_append(v_manques, 'description_en'); end if;
  if e.debut_le is null then v_manques := array_append(v_manques, 'date'); end if;
  if e.lieu_type is null or coalesce(e.lieu_fr, '') = '' or coalesce(e.lieu_en, '') = '' then v_manques := array_append(v_manques, 'lieu'); end if;
  if jsonb_array_length(coalesce(e.images, '[]'::jsonb)) = 0
     or exists (
       select 1 from jsonb_array_elements(coalesce(e.images, '[]'::jsonb)) img
       where jsonb_typeof(img) <> 'object' or coalesce(img ->> 'alt_fr', '') = '' or coalesce(img ->> 'alt_en', '') = ''
     ) then
    v_manques := array_append(v_manques, 'photo');
  end if;
  if not exists (select 1 from public.type_pass t where t.evenement_id = p_id and t.prix_cents > 0) then
    v_manques := array_append(v_manques, 'type_pass');
  end if;
  if exists (
    select 1 from public.type_pass t
    where t.evenement_id = p_id and (coalesce(t.nom_en, '') = '' or coalesce(t.inclus_fr, '') = '' or coalesce(t.inclus_en, '') = '')
  ) then
    v_manques := array_append(v_manques, 'types_incomplets');
  end if;
  return v_manques;
end;
$$;
