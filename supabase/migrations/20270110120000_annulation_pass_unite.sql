-- Story 7.9, correctif (la migration 20270110110000 est déjà appliquée : elle n'est pas modifiée).
-- Unité d'annulation d'un Pass : lui seul, sauf pour un Stand où elle est la paire de titulaires de la même unité (rangs 1-2, 3-4, ...).
-- Avant : une ligne de plusieurs Pass non-Stand mettait tous ses Pass dans la même unité.
create or replace function public.evenements_unite_pass(p_pass uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p2.id
  from public.pass p
  join public.ligne_commande l on l.id = p.ligne_commande_id
  join public.pass p2 on p2.ligne_commande_id = p.ligne_commande_id
    and case when coalesce(l.est_stand, false) then (p2.rang + 1) / 2 = (p.rang + 1) / 2 else p2.id = p.id end
  where p.id = p_pass
$$;
revoke all on function public.evenements_unite_pass(uuid) from public, anon, authenticated, service_role;
