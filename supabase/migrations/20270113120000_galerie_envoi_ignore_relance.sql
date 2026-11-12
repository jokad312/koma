-- Revue de la 7.10 (action 5 de la rétro de l'epic 7) : la clé d'envoi de l'email de Galerie n'est plus consommée par un envoi « ignoré » ;
-- il repart quand le lien est de nouveau saisi et que le Compte garde un Pass.
create or replace function public.planifier_galeries_evenements()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
  v_r record;
  v_id uuid;
begin
  perform set_config('ks.auteur', '{"type":"cron","nom":"planifier_galeries_evenements"}', true);
  -- Un email « ignoré » (lien effacé ou Pass annulé au moment du rendu) repart si, depuis, le lien est de nouveau saisi et que le Compte garde un Pass :
  -- la clé d'envoi ne reste pas consommée par un envoi qui n'a jamais eu lieu.
  update public.envoi x set statut = 'a_envoyer', derniere_erreur = null, tentatives = 0, prochain_essai = now()
  where x.modele = 'galerie_evenement' and x.statut = 'ignore'
    and exists (
      select 1
      from public.evenement e
      join public.pass p on p.evenement_id = e.id and p.statut in ('valide', 'scanne')
      join public.commande c on c.id = p.commande_id and c.type = 'pass' and c.statut in ('payee', 'offerte') and c.compte_id = x.compte_id
      where e.id::text = x.donnees ->> 'evenement_id' and e.publie_le is not null and e.galerie_url is not null
        and coalesce(e.fin_le, e.debut_le) is not null and coalesce(e.fin_le, e.debut_le) <= now()
    );
  for v_r in
    select distinct e.id as evenement_id, c.compte_id
    from public.evenement e
    join public.pass p on p.evenement_id = e.id and p.statut in ('valide', 'scanne')
    join public.commande c on c.id = p.commande_id and c.type = 'pass' and c.statut in ('payee', 'offerte')
    where e.publie_le is not null and e.galerie_url is not null
      and coalesce(e.fin_le, e.debut_le) is not null and coalesce(e.fin_le, e.debut_le) <= now()
      and not exists (select 1 from public.envoi x where x.cle = 'galerie_evenement:' || e.id::text || ':' || c.compte_id::text)
    order by e.id, c.compte_id
    limit 500
  loop
    v_id := public.envois_planifier('galerie_evenement', v_r.compte_id, jsonb_build_object('evenement_id', v_r.evenement_id), 'galerie_evenement:' || v_r.evenement_id::text || ':' || v_r.compte_id::text);
    if v_id is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;
