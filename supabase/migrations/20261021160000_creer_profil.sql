-- Story 1.4 : table profil (langue, âge déclaré), déclencheur de création, declarer_age, est_mineur, compte_complet.
-- Le Compte vit dans auth.users ; profil porte ce que le site en sait. Aucune écriture directe : seul le serveur
-- (service_role) appelle les fonctions ci-dessous, avec un auteur (AD-25).

create table public.profil (
  id uuid primary key references auth.users (id) on delete cascade,
  langue text not null default 'fr' check (langue in ('fr', 'en')),
  age_declare smallint check (age_declare between 13 and 120),
  age_declare_le timestamptz,
  cree_le timestamptz not null default now(),
  -- L'âge et sa date vont ensemble.
  constraint profil_age_et_date check ((age_declare is null) = (age_declare_le is null))
);

alter table public.profil enable row level security;
revoke all on public.profil from public, anon, authenticated;
grant select on public.profil to authenticated;

-- Lecture de sa propre ligne seulement ; aucune politique d'écriture.
create policy profil_lecture_propre on public.profil
  for select to authenticated
  using (id = (select auth.uid()));

-- Création du profil à la création du Compte : langue de la route (posée par le serveur dans les métadonnées),
-- « fr » si elle est absente ou invalide.
create function public.creer_profil_a_la_creation_du_compte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_langue text := new.raw_user_meta_data ->> 'langue';
begin
  if v_langue is null or v_langue not in ('fr', 'en') then
    v_langue := 'fr';
  end if;
  insert into public.profil (id, langue) values (new.id, v_langue);
  return new;
end;
$$;

revoke all on function public.creer_profil_a_la_creation_du_compte() from public, anon, authenticated;

create trigger creer_profil_apres_creation_du_compte
  after insert on auth.users
  for each row execute function public.creer_profil_a_la_creation_du_compte();

-- Déclare l'âge d'un Compte. Refuse sous 13 ans (le serveur supprime alors le Compte) et toute nouvelle déclaration.
create function public.declarer_age(p_auteur jsonb, p_compte uuid, p_age integer)
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
end;
$$;

-- Vrai de 13 à 17 ans, faux à 18 ans et plus, faux si l'âge n'est pas déclaré.
-- Âge actuel = âge déclaré + années entières écoulées depuis la déclaration.
create function public.est_mineur(p_compte uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select (age_declare + extract(year from age(now(), age_declare_le))::int) < 18
      from public.profil
      where id = p_compte and age_declare is not null
    ),
    false
  )
$$;

-- Un Compte est complet quand son âge est déclaré (AD-24).
create function public.compte_complet(p_compte uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profil where id = p_compte and age_declare is not null)
$$;

revoke all on function public.declarer_age(jsonb, uuid, integer) from public, anon, authenticated;
revoke all on function public.est_mineur(uuid) from public, anon, authenticated;
revoke all on function public.compte_complet(uuid) from public, anon, authenticated;
grant execute on function public.declarer_age(jsonb, uuid, integer) to service_role;
grant execute on function public.est_mineur(uuid) to service_role;
grant execute on function public.compte_complet(uuid) to service_role;
