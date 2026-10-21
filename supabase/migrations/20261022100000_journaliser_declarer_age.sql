-- Story 1.4 (audit du 2026-10-21) : declarer_age écrit dans journal_audit (AD-25).
-- La fonction est remplacée (create or replace) : droits et signature inchangés. La migration 20261021160000 n'est pas modifiée.
-- La valeur journalisée est l'âge déclaré ; le Compte est la cible ; l'auteur est celui reçu en paramètre.

create or replace function public.declarer_age(p_auteur jsonb, p_compte uuid, p_age integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deja timestamptz;
  v_trouve boolean;
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;

  -- Le profil et l'âge déjà déclaré passent avant le contrôle de l'âge : un Compte complet n'est jamais supprimé.
  select true, age_declare_le into v_trouve, v_deja from public.profil where id = p_compte for update;
  if v_trouve is not true then
    raise exception 'KS_PROFIL_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_deja is not null then
    raise exception 'KS_AGE_DEJA_DECLARE' using errcode = 'P0001';
  end if;

  if p_age is null or p_age > 120 or p_age < 0 then
    raise exception 'KS_AGE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_age < 13 then
    raise exception 'KS_AGE_MINIMUM' using errcode = 'P0001';
  end if;

  update public.profil set age_declare = p_age, age_declare_le = now() where id = p_compte;

  insert into public.journal_audit (auteur, action, cible_table, cible_id, avant, apres)
  values (p_auteur, 'age_declare', 'profil', p_compte::text, null, jsonb_build_object('age_declare', p_age));
end;
$$;

revoke all on function public.declarer_age(jsonb, uuid, integer) from public, anon, authenticated;
grant execute on function public.declarer_age(jsonb, uuid, integer) to service_role;
