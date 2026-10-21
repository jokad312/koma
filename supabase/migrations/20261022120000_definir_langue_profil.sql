-- Story 1.5 : un Compte créé par Google n'a pas de langue dans ses métadonnées (le déclencheur met « fr »).
-- Cette fonction pose la langue de la route sur le profil de l'auteur, tant que l'âge n'est pas déclaré.
-- Convention AD-25 : écriture par service_role seulement, p_compte vient de la session vérifiée par le serveur.
create function public.definir_langue_profil(p_auteur jsonb, p_compte uuid, p_langue text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  -- Seul le profil de l'auteur peut être modifié.
  if p_compte is null or (p_auteur ->> 'id') is distinct from p_compte::text then
    raise exception 'KS_DROIT_REFUSE' using errcode = 'P0001';
  end if;
  if p_langue is null or p_langue not in ('fr', 'en') then
    raise exception 'KS_LANGUE_INVALIDE' using errcode = 'P0001';
  end if;
  -- Compte déjà complet : la langue ne bouge plus.
  update public.profil set langue = p_langue where id = p_compte and age_declare is null;
end;
$$;

revoke all on function public.definir_langue_profil(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.definir_langue_profil(jsonb, uuid, text) to service_role;
