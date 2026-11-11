-- Story 7.7 : accès bénévole (FR-37, AD-10, AD-13). Un bénévole scanne les Pass d'UN Événement, pendant le jour de cet Événement, et rien d'autre.
--
-- Choix de conception (moindre privilège, refus par défaut) :
-- - L'accès vit dans une table dédiée, acces_benevole, et NON dans role_utilisateur : le Compte n'obtient AUCUN rôle. a_le_role(...) ne change pas,
--   la matrice des droits de l'application ne change pas (le bénévole n'a toujours aucun droit admin). Le seul pouvoir donné est celui de
--   scan_exiger_acces, qui n'est appelée que par scanner_pass. Aucun autre contrôle d'accès de la base ne lit cette table.
-- - Validité calculée à CHAQUE contrôle (valable_du <= now() < valable_jusqu_au) : un accès échu est refusé même si la tâche de suppression n'a pas
--   encore tourné, et même si le bénévole est encore connecté.
-- - Fenêtre : du minuit de Goma (Africa/Lubumbashi, UTC+2) du jour de début de l'Événement jusqu'à la fin du jour de fin (le jour de début si l'Événement
--   n'a pas de fin). Un Événement sur plusieurs jours donne donc un accès sur plusieurs jours.
-- - Écriture par fonctions security definer (search_path vide), réservées à service_role, droit Admin revérifié en base (exiger_admin).
-- - Journal : chaque attribution, mise à jour et retrait est journalisé (identifiant du Compte, jamais l'adresse email).

create table public.acces_benevole (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references auth.users (id) on delete cascade,
  evenement_id uuid not null references public.evenement (id) on delete cascade,
  valable_du timestamptz not null,
  valable_jusqu_au timestamptz not null,
  -- Compte Admin qui a donné l'accès (sans clé étrangère : la suppression d'un Admin ne doit pas effacer le journal de ses actes).
  cree_par uuid not null,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint acces_benevole_fenetre check (valable_jusqu_au > valable_du),
  constraint acces_benevole_unique unique (compte_id, evenement_id)
);

create index acces_benevole_evenement_idx on public.acces_benevole (evenement_id);
create index acces_benevole_echeance_idx on public.acces_benevole (valable_jusqu_au);

alter table public.acces_benevole enable row level security;
-- Aucune politique et aucun droit pour anon ni authenticated : le serveur lit et écrit par les fonctions ci-dessous.
revoke all on public.acces_benevole from public, anon, authenticated;

-- Le Compte a-t-il, maintenant, un accès valable au Scan de CET Événement ? Calculé à chaque appel.
create function public.acces_scan_valide(p_compte uuid, p_evenement uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_compte is not null and p_evenement is not null and exists (
    select 1
    from public.acces_benevole a
    where a.compte_id = p_compte
      and a.evenement_id = p_evenement
      and a.valable_du <= now()
      and a.valable_jusqu_au > now()
  )
$$;
revoke all on function public.acces_scan_valide(uuid, uuid) from public, anon, authenticated;
grant execute on function public.acces_scan_valide(uuid, uuid) to service_role;

-- Remplace le contrôle de la story 7.6 (même signature, scanner_pass ne change pas) : l'Admin passe toujours ; un bénévole passe seulement pour
-- l'Événement de son accès et dans la fenêtre valable ; tout le reste est refusé.
create or replace function public.scan_exiger_acces(p_auteur jsonb, p_evenement uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  if (p_auteur ->> 'type') is distinct from 'compte'
     or (p_auteur ->> 'id') is null
     or (p_auteur ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'KS_DROIT_REFUSE' using errcode = 'P0001';
  end if;
  v_compte := (p_auteur ->> 'id')::uuid;
  -- Le rôle écrit dans p_auteur n'est jamais cru : tout vient de la base.
  if public.a_le_role(v_compte, 'admin') then
    return;
  end if;
  if p_evenement is not null and public.acces_scan_valide(v_compte, p_evenement) then
    return;
  end if;
  raise exception 'KS_DROIT_REFUSE' using errcode = 'P0001';
end;
$$;
revoke all on function public.scan_exiger_acces(jsonb, uuid) from public, anon, authenticated, service_role;

-- Donne l'accès au Scan de l'Événement au Compte de cet email (Admin seulement). Idempotente.
-- Rend { statut: 'attribue' | 'deja' | 'mis_a_jour' | 'sans_compte', id? }. « sans_compte » : aucun Compte pour cet email, rien n'est créé
-- (le bénévole crée son Compte lui-même par code email) et rien n'est journalisé.
create function public.attribuer_acces_benevole(p_auteur jsonb, p_evenement uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_debut timestamptz;
  v_fin timestamptz;
  v_du timestamptz;
  v_jusqu_au timestamptz;
  v_compte uuid;
  v_id uuid;
  v_ancien_du timestamptz;
  v_ancien_au timestamptz;
begin
  perform public.exiger_admin(p_auteur);
  if char_length(v_email) not between 3 and 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'KS_EMAIL_INVALIDE' using errcode = 'P0001';
  end if;
  if p_evenement is null then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;

  select e.debut_le, case when e.fin_le > e.debut_le then e.fin_le - interval '1 microsecond' else e.debut_le end
    into v_debut, v_fin
    from public.evenement e where e.id = p_evenement;
  if not found then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_debut is null then
    raise exception 'KS_EVENEMENT_SANS_DATE' using errcode = 'P0001';
  end if;
  v_du := date_trunc('day', v_debut at time zone 'Africa/Lubumbashi') at time zone 'Africa/Lubumbashi';
  v_jusqu_au := (date_trunc('day', v_fin at time zone 'Africa/Lubumbashi') + interval '1 day') at time zone 'Africa/Lubumbashi';
  if v_jusqu_au <= now() then
    raise exception 'KS_EVENEMENT_PASSE' using errcode = 'P0001';
  end if;

  select u.id into v_compte from auth.users u where lower(u.email) = v_email order by u.created_at limit 1;
  if v_compte is null then
    return jsonb_build_object('statut', 'sans_compte');
  end if;

  insert into public.acces_benevole (compte_id, evenement_id, valable_du, valable_jusqu_au, cree_par)
  values (v_compte, p_evenement, v_du, v_jusqu_au, (p_auteur ->> 'id')::uuid)
  on conflict (compte_id, evenement_id) do nothing
  returning id into v_id;
  if v_id is not null then
    insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
    values (p_auteur, 'acces_benevole_attribue', 'acces_benevole', v_id::text,
      jsonb_build_object('compte_id', v_compte, 'evenement_id', p_evenement, 'valable_du', v_du, 'valable_jusqu_au', v_jusqu_au));
    return jsonb_build_object('statut', 'attribue', 'id', v_id);
  end if;

  -- Déjà présent : si la fenêtre a changé (date de l'Événement modifiée), elle est remise à jour ; sinon rien ne change et rien n'est journalisé.
  select a.id, a.valable_du, a.valable_jusqu_au into v_id, v_ancien_du, v_ancien_au
    from public.acces_benevole a where a.compte_id = v_compte and a.evenement_id = p_evenement for update;
  if v_ancien_du = v_du and v_ancien_au = v_jusqu_au then
    return jsonb_build_object('statut', 'deja', 'id', v_id);
  end if;
  update public.acces_benevole set valable_du = v_du, valable_jusqu_au = v_jusqu_au, modifie_le = now() where id = v_id;
  insert into public.journal_audit (auteur, action, cible_table, cible_id, avant, apres)
  values (p_auteur, 'acces_benevole_mis_a_jour', 'acces_benevole', v_id::text,
    jsonb_build_object('valable_du', v_ancien_du, 'valable_jusqu_au', v_ancien_au),
    jsonb_build_object('compte_id', v_compte, 'evenement_id', p_evenement, 'valable_du', v_du, 'valable_jusqu_au', v_jusqu_au));
  return jsonb_build_object('statut', 'mis_a_jour', 'id', v_id);
end;
$$;
revoke all on function public.attribuer_acces_benevole(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.attribuer_acces_benevole(jsonb, uuid, text) to service_role;

-- Retire un accès (Admin seulement). L'accès doit appartenir à l'Événement indiqué. Rend vrai s'il existait.
create function public.retirer_acces_benevole(p_auteur jsonb, p_evenement uuid, p_acces uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_du timestamptz;
  v_au timestamptz;
begin
  perform public.exiger_admin(p_auteur);
  delete from public.acces_benevole a
    where a.id = p_acces and a.evenement_id = p_evenement
    returning a.compte_id, a.valable_du, a.valable_jusqu_au into v_compte, v_du, v_au;
  if not found then
    return false;
  end if;
  insert into public.journal_audit (auteur, action, cible_table, cible_id, avant)
  values (p_auteur, 'acces_benevole_retire', 'acces_benevole', p_acces::text,
    jsonb_build_object('compte_id', v_compte, 'evenement_id', p_evenement, 'valable_du', v_du, 'valable_jusqu_au', v_au));
  return true;
end;
$$;
revoke all on function public.retirer_acces_benevole(jsonb, uuid, uuid) from public, anon, authenticated;
grant execute on function public.retirer_acces_benevole(jsonb, uuid, uuid) to service_role;

-- Liste des accès d'UN Événement (Admin seulement) ; l'email n'est montré qu'ici.
create function public.lister_acces_benevoles(p_auteur jsonb, p_evenement uuid)
returns table (id uuid, email text, valable_du timestamptz, valable_jusqu_au timestamptz, valide boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_admin(p_auteur);
  return query
    select a.id, u.email::text, a.valable_du, a.valable_jusqu_au, (a.valable_du <= now() and a.valable_jusqu_au > now())
    from public.acces_benevole a
    join auth.users u on u.id = a.compte_id
    where a.evenement_id = p_evenement
    order by a.cree_le, a.id;
end;
$$;
revoke all on function public.lister_acces_benevoles(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.lister_acces_benevoles(jsonb, uuid) to service_role;

-- Accès d'UN Compte (page de Scan) : Événement, fenêtre et validité calculée par la base. Ne rend jamais l'accès d'un autre Compte.
create function public.lire_acces_benevole_compte(p_compte uuid)
returns table (evenement_id uuid, valable_du timestamptz, valable_jusqu_au timestamptz, valide boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.evenement_id, a.valable_du, a.valable_jusqu_au, (a.valable_du <= now() and a.valable_jusqu_au > now())
  from public.acces_benevole a
  where p_compte is not null and a.compte_id = p_compte
  order by a.valable_du
$$;
revoke all on function public.lire_acces_benevole_compte(uuid) from public, anon, authenticated;
grant execute on function public.lire_acces_benevole_compte(uuid) to service_role;

-- Tâche planifiée (AD-10) : supprime les accès dont le jour est passé. Le contrôle d'accès refuse déjà un accès échu ; cette tâche ne fait que
-- ranger la table. Un accès supprimé est journalisé au nom du système. Rend le nombre d'accès supprimés.
create function public.supprimer_acces_benevoles_echus()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre integer;
begin
  with supprimes as (
    delete from public.acces_benevole a where a.valable_jusqu_au <= now()
    returning a.id, a.compte_id, a.evenement_id, a.valable_du, a.valable_jusqu_au
  ), journal as (
    insert into public.journal_audit (auteur, action, cible_table, cible_id, avant)
    select '{"type":"systeme","nom":"supprimer_acces_benevoles_echus"}'::jsonb, 'acces_benevole_echu_supprime', 'acces_benevole', s.id::text,
      jsonb_build_object('compte_id', s.compte_id, 'evenement_id', s.evenement_id, 'valable_du', s.valable_du, 'valable_jusqu_au', s.valable_jusqu_au)
    from supprimes s
    returning 1
  )
  select count(*)::integer into v_nombre from supprimes;
  return v_nombre;
end;
$$;
revoke all on function public.supprimer_acces_benevoles_echus() from public, anon, authenticated;
grant execute on function public.supprimer_acces_benevoles_echus() to service_role;

-- Planification toutes les dix minutes par pg_cron (AD-10), sans route HTTP. Si l'extension n'est pas disponible, la migration continue :
-- le contrôle d'accès calcule la validité à chaque appel, donc un accès échu reste refusé même sans la tâche.
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('supprimer-acces-benevoles-echus', '*/10 * * * *', 'select public.supprimer_acces_benevoles_echus()');
  else
    raise notice 'pg_cron indisponible : supprimer_acces_benevoles_echus n''est pas planifiée';
  end if;
exception when others then
  raise notice 'pg_cron non configuré : %', sqlerrm;
end
$cron$;
