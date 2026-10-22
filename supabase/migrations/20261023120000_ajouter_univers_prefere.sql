-- Story 2.1 : question « Quel univers préfères-tu ? » des questions d'accueil (1.6), enfin possible avec la table des univers.
-- Réponse facultative ; si l'univers est supprimé un jour, la préférence redevient vide. Les migrations précédentes ne sont pas modifiées :
-- la fonction est recréée à partir de la dernière version (20261022140000), avec un cinquième paramètre facultatif.

alter table public.profil
  add column univers_prefere uuid references public.univers (id) on delete set null;

drop function public.enregistrer_questions_accueil(jsonb, uuid, text, text);

create function public.enregistrer_questions_accueil(p_auteur jsonb, p_compte uuid, p_origine text, p_preference text, p_univers uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trouve boolean;
  v_age smallint;
  v_vues timestamptz;
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  -- Seul le profil de l'auteur peut être modifié.
  if p_compte is null or (p_auteur ->> 'id') is distinct from p_compte::text then
    raise exception 'KS_DROIT_REFUSE' using errcode = 'P0001';
  end if;
  if p_origine is not null and p_origine not in ('tiktok', 'instagram', 'facebook', 'youtube', 'whatsapp', 'google', 'ia', 'ami', 'evenement', 'autre') then
    raise exception 'KS_REPONSE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_preference is not null and p_preference not in ('porter', 'fabriquer') then
    raise exception 'KS_REPONSE_INVALIDE' using errcode = 'P0001';
  end if;
  select true, age_declare, questions_accueil_le into v_trouve, v_age, v_vues
    from public.profil where id = p_compte for update;
  if v_trouve is not true then
    raise exception 'KS_PROFIL_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_age is null then
    raise exception 'KS_AGE_NON_DECLARE' using errcode = 'P0001';
  end if;
  if v_vues is not null then
    raise exception 'KS_QUESTIONS_DEJA_VUES' using errcode = 'P0001';
  end if;
  -- Univers inexistant : refusé, rien n'est enregistré (après le contrôle « déjà vues » : un Compte qui les a vues reste en succès idempotent).
  if p_univers is not null and not exists (select 1 from public.univers u where u.id = p_univers) then
    raise exception 'KS_REPONSE_INVALIDE' using errcode = 'P0001';
  end if;

  update public.profil
    set origine = p_origine, preference_creation = p_preference, univers_prefere = p_univers, questions_accueil_le = now()
    where id = p_compte;
end;
$$;

revoke all on function public.enregistrer_questions_accueil(jsonb, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.enregistrer_questions_accueil(jsonb, uuid, text, text, uuid) to service_role;
