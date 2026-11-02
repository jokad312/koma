-- Story 4.4, correctifs de revue (la migration 20261121100000 est déjà appliquée : elle n'est pas modifiée).
-- 1. envois_planifier est interne : aucun rôle, service_role compris.
-- 2. Un envoi dont le worker plante à chaque passage ne boucle plus : à la réservation, un envoi qui a déjà 5 essais est abandonné avec son anomalie.
-- 3. donnees_envoi_valides ne parcourt jamais autre chose qu'un objet (un tableau donne « faux », jamais une erreur).

revoke all on function public.envois_planifier(public.envoi_modele, uuid, jsonb, text) from public, anon, authenticated, service_role;

create or replace function public.donnees_envoi_valides(p_donnees jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_donnees) = 'object' then not exists (
      select 1 from jsonb_each(p_donnees) e
      where jsonb_typeof(e.value) <> 'string' or (e.value #>> '{}') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    )
    else false
  end
$$;

create or replace function public.envois_reserver_lot(p_limite integer)
returns table (id uuid, modele text, compte_id uuid, langue text, donnees jsonb, tentatives integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- Épuisés : 5 essais déjà faits et plus de réponse du worker (bail expiré) -> abandon et anomalie.
  with epuises as (
    update public.envoi x
    set statut = 'abandonne', derniere_erreur = 'bail expiré après 5 essais'
    where x.statut in ('a_envoyer', 'echec') and x.prochain_essai <= now() and x.tentatives >= 5
    returning x.id as envoi_id, x.modele as envoi_modele, x.tentatives as envoi_tentatives
  )
  insert into public.anomalie (type, gravite, cible_type, cible_id, details)
  select 'envoi_echec_definitif', 'attention', 'envoi', ep.envoi_id,
         jsonb_build_object('modele', ep.envoi_modele::text, 'tentatives', ep.envoi_tentatives)
  from epuises ep
  on conflict do nothing;

  return query
  with lot as (
    select e.id from public.envoi e
    where e.statut in ('a_envoyer', 'echec') and e.prochain_essai <= now()
    order by e.prochain_essai, e.cree_le
    limit greatest(1, least(coalesce(p_limite, 10), 50))
    for update skip locked
  )
  update public.envoi e
  set tentatives = e.tentatives + 1, prochain_essai = now() + interval '10 minutes'
  from lot
  where e.id = lot.id
  returning e.id, e.modele::text, e.compte_id, e.langue, e.donnees, e.tentatives::integer;
end;
$$;
