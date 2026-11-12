-- Story 9.5, revue : (1) les filtres de consentement et de rythme passent avant la limite de 1000 Comptes (pas de famine au-delà de 1000 Comptes dans la fenêtre) ;
-- (2) l'univers « acheté » ne compte que des achats payés (pas une Commande offerte), comme la fenêtre de 90 jours ; (3) index de recherche des Relances récentes.

create index if not exists envoi_modele_compte_idx on public.envoi (modele, compte_id, cree_le);

create or replace function public.planifier_relances()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_texte text;
  v_jours integer;
  v_fenetre bigint;
  v_n integer := 0;
  v_r record;
  v_kit uuid;
  v_evenement uuid;
  v_produit uuid;
  v_donnees jsonb;
begin
  perform set_config('ks.auteur', '{"type":"cron","nom":"planifier_relances"}', true);
  select valeur into v_texte from public.reglage where cle = 'relances_rythme_jours';
  -- Réglage absent ou invalide : aucune Relance (règle 15, jamais de valeur de repli).
  if v_texte is null or v_texte !~ '^[0-9]{1,2}$' or v_texte::integer not between 1 and 30 then
    return 0;
  end if;
  v_jours := v_texte::integer;
  v_fenetre := floor(extract(epoch from now()) / (v_jours * 86400))::bigint;

  for v_r in
    select c.compte_id
    from public.commande c
    where c.paye_le is not null and not c.offerte
      -- Les filtres sont dans la requête, avant la limite : un Compte non éligible n'occupe jamais une place du lot.
      and exists (select 1 from public.consentement cs where cs.compte_id = c.compte_id and cs.objet = 'relances' and cs.retire_le is null)
      and not exists (select 1 from public.envoi x where x.modele = 'relance' and x.compte_id = c.compte_id and x.cree_le > now() - make_interval(days => v_jours))
    group by c.compte_id
    having max(c.paye_le) > now() - interval '90 days'
    order by c.compte_id
    limit 1000
  loop

    v_donnees := null;
    -- (a) Kit commencé et pas terminé.
    select a.produit_id into v_kit
    from public.acces_kit a
    join public.progression_video pv on pv.compte_id = a.compte_id and pv.produit_id = a.produit_id
    where a.compte_id = v_r.compte_id and pv.max_position_secondes > 0 and pv.terminee_le is null
    order by a.cree_le desc limit 1;
    if v_kit is not null then
      v_donnees := jsonb_build_object('kit_id', v_kit);
    else
      -- (b) Événement publié dans les 30 prochains jours.
      select e.id into v_evenement
      from public.evenement e
      where e.publie_le is not null and e.publie_le <= now() and e.debut_le is not null and e.debut_le > now() and e.debut_le <= now() + interval '30 days'
      order by e.debut_le limit 1;
      if v_evenement is not null then
        v_donnees := jsonb_build_object('evenement_id', v_evenement);
      else
        -- (c) Nouveauté de son univers (préféré ou acheté), publiée depuis moins de 30 jours, pas déjà possédée.
        select pr.id into v_produit
        from public.produit pr
        where pr.univers_id is not null and pr.publie_le is not null and pr.publie_le <= now() and pr.publie_le > now() - interval '30 days'
          and (
            exists (select 1 from public.profil pf where pf.id = v_r.compte_id and pf.univers_prefere = pr.univers_id)
            or exists (
              select 1 from public.commande c2 join public.ligne_commande l on l.commande_id = c2.id join public.produit achete on achete.id = l.produit_id
              where c2.compte_id = v_r.compte_id and c2.paye_le is not null and not c2.offerte and achete.univers_id = pr.univers_id
            )
          )
          and not exists (select 1 from public.ligne_commande l2 join public.commande c3 on c3.id = l2.commande_id where c3.compte_id = v_r.compte_id and c3.paye_le is not null and l2.produit_id = pr.id)
          and not exists (select 1 from public.acces_kit ak where ak.compte_id = v_r.compte_id and ak.produit_id = pr.id)
        order by pr.publie_le desc limit 1;
        if v_produit is not null then
          v_donnees := jsonb_build_object('produit_id', v_produit);
        end if;
      end if;
    end if;
    v_kit := null; v_evenement := null; v_produit := null;

    if v_donnees is not null
       and public.envois_planifier('relance', v_r.compte_id, v_donnees, 'relance:' || v_r.compte_id::text || ':' || v_fenetre::text) is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end;
$$;
