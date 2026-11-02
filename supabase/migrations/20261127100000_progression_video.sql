-- Story 3.7 : lecteur vidéo à chapitres. Table progression_video (position reprise sur tout appareil), enregistrement de la position
-- (toutes les 15 s et à la pause), lecture de la vidéo d'un Kit pour le serveur (identifiant Bunny privé : service seulement),
-- résumé de vidéo ajouté au détail de bibliothèque, progression de chaque Kit pour la liste.
-- Chaque fonction vérifie l'accès (acces_kit) elle-même : sans accès, rien n'est renvoyé ni écrit (règle 1, AD-11). Accès : service_role seulement.

create table public.progression_video (
  compte_id uuid not null references auth.users (id) on delete cascade,
  produit_id uuid not null references public.video_kit (produit_id) on delete cascade,
  -- Dernière position connue (reprise sur un autre appareil) et position la plus avancée atteinte (chapitres terminés).
  position_secondes integer not null default 0 check (position_secondes >= 0),
  max_position_secondes integer not null default 0 check (max_position_secondes >= 0),
  -- Posée une fois : la vidéo est « terminée » à 90 % de sa durée (décision du 2026-10-20).
  terminee_le timestamptz,
  modifie_le timestamptz not null default now(),
  primary key (compte_id, produit_id)
);

alter table public.progression_video enable row level security;
revoke all on public.progression_video from public, anon, authenticated;
grant select on public.progression_video to authenticated;

-- Un client lit seulement sa progression ; aucune politique d'écriture (AD-2).
create policy progression_video_lecture_propre on public.progression_video
  for select to authenticated
  using (compte_id = (select auth.uid()));

-- Enregistre la position d'un Compte. Faux : pas d'accès au Kit, ou Kit sans vidéo (rien n'est écrit).
create function public.bibliotheque_enregistrer_progression(p_compte uuid, p_produit uuid, p_position integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_duree integer;
  v_position integer;
begin
  if p_position is null then
    return false;
  end if;
  select v.duree_secondes into v_duree
  from public.video_kit v
  join public.acces_kit a on a.produit_id = v.produit_id and a.compte_id = p_compte
  where v.produit_id = p_produit;
  if v_duree is null then
    return false;
  end if;
  v_position := least(greatest(p_position, 0), v_duree);
  insert into public.progression_video as pv (compte_id, produit_id, position_secondes, max_position_secondes, terminee_le)
  values (p_compte, p_produit, v_position, v_position, case when v_position * 10 >= v_duree * 9 then now() end)
  on conflict (compte_id, produit_id) do update
    set position_secondes = excluded.position_secondes,
        max_position_secondes = greatest(pv.max_position_secondes, excluded.position_secondes),
        terminee_le = coalesce(pv.terminee_le, case when greatest(pv.max_position_secondes, excluded.position_secondes) * 10 >= v_duree * 9 then now() end),
        modifie_le = now();
  return true;
end;
$$;

-- Ce qu'il faut pour lire la vidéo d'un Kit : null sans accès ou sans vidéo. L'identifiant Bunny privé ne sort que par cette fonction (service).
create function public.bibliotheque_video_a_lire(p_compte uuid, p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'produit_id', p.id,
    'video_prive', vp.bunny_video_id_prive,
    'duree_secondes', v.duree_secondes,
    'sous_titres', coalesce((select jsonb_agg(s.langue order by s.langue) from public.sous_titre_kit s where s.produit_id = p.id), '[]'::jsonb),
    'position_secondes', coalesce((select g.position_secondes from public.progression_video g where g.compte_id = p_compte and g.produit_id = p.id), 0)
  )
  from public.produit p
  join public.video_kit v on v.produit_id = p.id
  join public.video_kit_prive vp on vp.produit_id = p.id
  where p.slug = p_slug and p.famille = 'kit'
    and exists (select 1 from public.acces_kit a where a.compte_id = p_compte and a.produit_id = p.id);
$$;

-- Détail d'un Kit de la bibliothèque (même fonction que la migration 20261124100000, avec le résumé de la vidéo : durée, chapitres, langues
-- des sous-titres, progression). Aucun identifiant ni chemin privé. Null sans accès.
create or replace function public.bibliotheque_kit(p_compte uuid, p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'produit_id', p.id, 'slug', p.slug, 'titre_fr', p.titre_fr, 'titre_en', p.titre_en,
    'fichiers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', f.id, 'nom_fr', f.nom_fr, 'nom_en', f.nom_en, 'format', f.format, 'taille_octets', f.taille_octets, 'version', f.version
      ) order by f.ordre)
      from public.fichier_kit f where f.produit_id = p.id
    ), '[]'::jsonb),
    'video', (
      select jsonb_build_object(
        'duree_secondes', v.duree_secondes,
        'chapitres', coalesce((
          select jsonb_agg(jsonb_build_object('id', c.id, 'titre_fr', c.titre_fr, 'titre_en', c.titre_en, 'debut_secondes', c.debut_secondes) order by c.ordre)
          from public.chapitre_kit c where c.produit_id = p.id
        ), '[]'::jsonb),
        'sous_titres', coalesce((select jsonb_agg(s.langue order by s.langue) from public.sous_titre_kit s where s.produit_id = p.id), '[]'::jsonb),
        'position_secondes', coalesce(g.position_secondes, 0),
        'max_position_secondes', coalesce(g.max_position_secondes, 0),
        'terminee', g.terminee_le is not null
      )
      from public.video_kit v
      left join public.progression_video g on g.produit_id = v.produit_id and g.compte_id = p_compte
      where v.produit_id = p.id
    )
  )
  from public.produit p
  where p.slug = p_slug and p.famille = 'kit'
    and exists (select 1 from public.acces_kit a where a.compte_id = p_compte and a.produit_id = p.id);
$$;

-- Progression de chaque Kit à vidéo d'un Compte, pour la liste de la bibliothèque : positions, instants de début des chapitres (triés).
create function public.bibliotheque_progressions(p_compte uuid)
returns table (produit_id uuid, position_secondes integer, max_position_secondes integer, terminee boolean, debuts integer[])
language sql
stable
security definer
set search_path = ''
as $$
  select g.produit_id, g.position_secondes, g.max_position_secondes, g.terminee_le is not null,
         coalesce((select array_agg(c.debut_secondes order by c.debut_secondes) from public.chapitre_kit c where c.produit_id = g.produit_id), '{}'::integer[])
  from public.progression_video g
  join public.acces_kit a on a.produit_id = g.produit_id and a.compte_id = g.compte_id
  where g.compte_id = p_compte;
$$;

revoke all on function public.bibliotheque_enregistrer_progression(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.bibliotheque_video_a_lire(uuid, text) from public, anon, authenticated;
revoke all on function public.bibliotheque_progressions(uuid) from public, anon, authenticated;
grant execute on function public.bibliotheque_enregistrer_progression(uuid, uuid, integer) to service_role;
grant execute on function public.bibliotheque_video_a_lire(uuid, text) to service_role;
grant execute on function public.bibliotheque_progressions(uuid) to service_role;
