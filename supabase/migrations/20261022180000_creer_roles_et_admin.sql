-- Story 1.7 : rôles (AD-13), réglages écrits par l'admin, correction d'âge.
-- Chaque fonction d'écriture : SECURITY DEFINER, search_path vide, p_auteur en premier, service_role seulement (AD-25),
-- droit `admin` revérifié en base sur p_auteur.id (jamais auth.uid()). Les migrations précédentes ne sont pas modifiées.

create table public.role_utilisateur (
  id uuid primary key default gen_random_uuid(),
  compte uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'assistant', 'benevole')),
  -- Événement visé par un rôle de bénévole ; sans clé étrangère jusqu'à l'epic 7 (la table des événements n'existe pas encore).
  evenement uuid,
  valide_du timestamptz,
  valide_au timestamptz,
  cree_le timestamptz not null default now(),
  constraint role_utilisateur_validite check (valide_du is null or valide_au is null or valide_au > valide_du)
);

-- Un même rôle ne s'attribue qu'une fois par Compte et par événement.
create unique index role_utilisateur_unique
  on public.role_utilisateur (compte, role, coalesce(evenement, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.role_utilisateur enable row level security;
-- Aucune politique et aucun droit pour anon ni authenticated : le serveur lit et écrit par les fonctions ci-dessous.
revoke all on public.role_utilisateur from public, anon, authenticated;

-- Supprimer un Compte supprime ses rôles en cascade : sans auteur posé, cette suppression-là (et elle seule, détectée par la
-- profondeur de déclencheur) est journalisée au nom du système, pour ne jamais bloquer la suppression d'un Compte.
-- Une suppression directe sans auteur reste refusée par journaliser().
create function public.role_utilisateur_auteur_cascade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 and coalesce(current_setting('ks.auteur', true), '') = '' then
    perform set_config('ks.auteur', '{"type":"systeme","nom":"suppression_compte"}', true);
  end if;
  return old;
end;
$$;

revoke all on function public.role_utilisateur_auteur_cascade() from public, anon, authenticated;

create trigger role_utilisateur_auteur_cascade
  before delete on public.role_utilisateur
  for each row execute function public.role_utilisateur_auteur_cascade();

create trigger role_utilisateur_journaliser
  after insert or update or delete on public.role_utilisateur
  for each row execute function public.journaliser('compte');

-- Source de vérité des rôles. Seule fonction lisible par anon et authenticated (lecture pure, aucune écriture).
-- Un rôle global (evenement nul) vaut pour tous les événements ; un rôle d'événement ne vaut que pour lui.
create function public.a_le_role(p_compte uuid, p_role text, p_evenement uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.role_utilisateur r
    where r.compte = p_compte
      and r.role = p_role
      and (r.evenement is null or r.evenement = p_evenement)
      and (r.valide_du is null or r.valide_du <= now())
      and (r.valide_au is null or r.valide_au > now())
  )
$$;

revoke all on function public.a_le_role(uuid, text, uuid) from public;
grant execute on function public.a_le_role(uuid, text, uuid) to anon, authenticated, service_role;

-- Vérifie l'auteur reçu : objet présent, Compte réel avec le rôle admin en base. Le rôle écrit dans p_auteur n'est jamais cru.
create function public.exiger_admin(p_auteur jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  if (p_auteur ->> 'type') is distinct from 'compte'
     or (p_auteur ->> 'id') is null
     or (p_auteur ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'KS_DROIT_REFUSE' using errcode = 'P0001';
  end if;
  if not public.a_le_role((p_auteur ->> 'id')::uuid, 'admin') then
    raise exception 'KS_DROIT_REFUSE' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.exiger_admin(jsonb) from public, anon, authenticated;

-- Attribue un rôle. Auteur : un Compte admin, ou `systeme` (commande npm run admin:attribuer, jamais un écran).
-- Si le Compte a déjà ce rôle pour cet événement, ses dates de validité sont mises à jour.
create function public.attribuer_role(
  p_auteur jsonb,
  p_compte uuid,
  p_role text,
  p_evenement uuid default null,
  p_valide_du timestamptz default null,
  p_valide_au timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  if (p_auteur ->> 'type') is distinct from 'systeme' then
    perform public.exiger_admin(p_auteur);
  end if;
  if p_role is null or p_role not in ('admin', 'assistant', 'benevole') then
    raise exception 'KS_ROLE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_compte is null or not exists (select 1 from auth.users u where u.id = p_compte) then
    raise exception 'KS_COMPTE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if p_valide_du is not null and p_valide_au is not null and p_valide_au <= p_valide_du then
    raise exception 'KS_VALIDITE_INVALIDE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);

  -- Rôle déjà présent pour cet événement : seules les dates sont mises à jour (le trigger journalise), pour qu'un rôle expiré ou futur
  -- puisse être rétabli ou prolongé.
  update public.role_utilisateur r
    set valide_du = p_valide_du, valide_au = p_valide_au
    where r.compte = p_compte and r.role = p_role
      and coalesce(r.evenement, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_evenement, '00000000-0000-0000-0000-000000000000'::uuid);
  if found then
    return;
  end if;

  insert into public.role_utilisateur (compte, role, evenement, valide_du, valide_au)
  values (p_compte, p_role, p_evenement, p_valide_du, p_valide_au);
end;
$$;

revoke all on function public.attribuer_role(jsonb, uuid, text, uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.attribuer_role(jsonb, uuid, text, uuid, timestamptz, timestamptz) to service_role;

-- Écrit un réglage (admin). Clés permises : nom_site (1 à 60 caractères, jamais vide) et numero_whatsapp
-- (format international « + » puis 8 à 15 chiffres, espaces retirés ; vide = effacé). Le journal masque le numéro.
create function public.enregistrer_reglage(p_auteur jsonb, p_cle text, p_valeur text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_valeur text;
begin
  perform public.exiger_admin(p_auteur);
  if p_cle is null or p_cle not in ('nom_site', 'numero_whatsapp') then
    raise exception 'KS_REGLAGE_INCONNU' using errcode = 'P0001';
  end if;

  if p_cle = 'nom_site' then
    v_valeur := btrim(coalesce(p_valeur, ''));
    if char_length(v_valeur) < 1 or char_length(v_valeur) > 60 then
      raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
    end if;
  else
    v_valeur := nullif(regexp_replace(coalesce(p_valeur, ''), '\s', '', 'g'), '');
    if v_valeur is not null and v_valeur !~ '^\+[0-9]{8,15}$' then
      raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
    end if;
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  insert into public.reglage (cle, valeur, mis_a_jour_le)
  values (p_cle, v_valeur, now())
  on conflict (cle) do update set valeur = excluded.valeur, mis_a_jour_le = excluded.mis_a_jour_le;
end;
$$;

revoke all on function public.enregistrer_reglage(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.enregistrer_reglage(jsonb, text, text) to service_role;

-- Corrige l'âge déclaré d'un Compte (admin, avec une raison). Journalise avant, après, raison et auteur (action age_corrige).
-- Sous 13 ans : journalise puis renvoie vrai sans changer l'âge ; le service supprime alors le Compte, comme declarer_age.
create function public.corriger_age(p_auteur jsonb, p_compte uuid, p_age integer, p_raison text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trouve boolean;
  v_avant smallint;
  v_declare timestamptz;
  v_raison text := btrim(coalesce(p_raison, ''));
begin
  perform public.exiger_admin(p_auteur);
  if char_length(v_raison) < 3 or char_length(v_raison) > 500 then
    raise exception 'KS_RAISON_MANQUANTE' using errcode = 'P0001';
  end if;

  select true, age_declare, age_declare_le into v_trouve, v_avant, v_declare
    from public.profil where id = p_compte for update;
  if v_trouve is not true then
    raise exception 'KS_PROFIL_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_declare is null then
    raise exception 'KS_AGE_NON_DECLARE' using errcode = 'P0001';
  end if;
  if p_age is null or p_age < 0 or p_age > 120 then
    raise exception 'KS_AGE_INVALIDE' using errcode = 'P0001';
  end if;

  insert into public.journal_audit (auteur, action, cible_table, cible_id, avant, apres)
  values (
    p_auteur, 'age_corrige', 'profil', p_compte::text,
    jsonb_build_object('age_declare', v_avant),
    jsonb_build_object('age_declare', p_age, 'raison', v_raison)
  );

  if p_age < 13 then
    return true;
  end if;

  update public.profil set age_declare = p_age, age_declare_le = now() where id = p_compte;
  return false;
end;
$$;

revoke all on function public.corriger_age(jsonb, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.corriger_age(jsonb, uuid, integer, text) to service_role;
