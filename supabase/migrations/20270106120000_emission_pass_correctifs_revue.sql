-- Story 7.5, correctifs de revue : un Pass ne compte dans la Capacité et dans le quota que si sa Commande est payee ou offerte.
-- Le statut annule/rembourse du Pass n'est posé qu'à la story 7.9 : d'ici là, une Commande annulée, remboursée ou expirée libère ses places.
-- Autres règles inchangées (Pass annulé ou remboursé ne compte pas, lignes des Commandes en attente ou échouées non échues comptent, aucun double comptage).
create or replace function public.places_evenement_utilisees(p_evenement uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((
      select sum(l.nombre * (case when l.est_stand then 2 else 1 end))
      from public.ligne_commande l
      join public.type_pass t on t.id = l.type_pass_id
      join public.commande c on c.id = l.commande_id
      where t.evenement_id = p_evenement
        and c.type = 'pass'
        and c.statut in ('en_attente', 'echouee') and c.expire_le is not null and c.expire_le > now()
    ), 0)
    + (select count(*) from public.pass p join public.commande c on c.id = p.commande_id
       where p.evenement_id = p_evenement and p.statut not in ('annule', 'rembourse') and c.statut in ('payee', 'offerte'))
  )::integer
$$;

create or replace function public.places_type_pass_utilisees(p_type uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((
      select sum(l.nombre)
      from public.ligne_commande l
      join public.commande c on c.id = l.commande_id
      where l.type_pass_id = p_type
        and c.type = 'pass'
        and c.statut in ('en_attente', 'echouee') and c.expire_le is not null and c.expire_le > now()
    ), 0)
    + coalesce((
      select ceil(count(*)::numeric / (case when (select t.est_stand from public.type_pass t where t.id = p_type) then 2 else 1 end))
      from public.pass p join public.commande c on c.id = p.commande_id
      where p.type_pass_id = p_type and p.statut not in ('annule', 'rembourse') and c.statut in ('payee', 'offerte')
    ), 0)
  )::integer
$$;
