-- Story 1.6 : questions d'accueil facultatives (origine, préférence), affichées une seule fois.
-- Aucune écriture directe : seul le serveur (service_role) appelle ces fonctions, avec un auteur (AD-25).
-- La question « univers » viendra avec la table des univers (epic 2).

alter table public.profil
  add column origine text
    check (origine in ('tiktok', 'instagram', 'facebook', 'youtube', 'whatsapp', 'google', 'ia', 'ami', 'evenement', 'autre')),
  add column preference_creation text
    check (preference_creation in ('porter', 'fabriquer')),
  add column questions_accueil_le timestamptz;

-- Enregistre les réponses (toutes facultatives) et marque les questions comme vues. Une seule fois par Compte.
create function public.enregistrer_questions_accueil(p_auteur jsonb, p_compte uuid, p_origine text, p_preference text)
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

  update public.profil
    set origine = p_origine, preference_creation = p_preference, questions_accueil_le = now()
    where id = p_compte;
end;
$$;

-- Vrai quand les questions ont été vues (répondues ou passées) ; faux sinon, y compris sans profil.
create function public.questions_accueil_vues(p_compte uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profil where id = p_compte and questions_accueil_le is not null)
$$;

revoke all on function public.enregistrer_questions_accueil(jsonb, uuid, text, text) from public, anon, authenticated;
revoke all on function public.questions_accueil_vues(uuid) from public, anon, authenticated;
grant execute on function public.enregistrer_questions_accueil(jsonb, uuid, text, text) to service_role;
grant execute on function public.questions_accueil_vues(uuid) to service_role;
