-- Story 9.6, correctifs de la revue (planifier_emails_cibles réécrite depuis sa dernière version, AD-1) :
-- - Panier : un seul email par modification du Panier, 1 h (Panier de moins de 24 h) ou 24 h (Panier plus ancien), jamais les deux d'un coup ;
--   aucun rappel tant qu'une Commande du Compte attend son paiement (créée après la dernière modification du Panier).
-- - Kit : « Commence le chapitre 1 » seulement entre 2 et 7 jours après l'achat ; à 7 jours, rappel pour tout Kit non terminé (démarré ou non) ;
--   jamais au-delà de 60 jours.
-- - Nouveau produit : jamais pour un produit que le Compte a déjà acheté ou déjà dans sa bibliothèque.

create or replace function public.planifier_emails_cibles()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
  v_r record;
  v_etape text;
begin
  perform set_config('ks.auteur', '{"type":"cron","nom":"planifier_emails_cibles"}', true);

  for v_r in
    select p.id, p.compte_id, p.mis_a_jour_le
    from public.panier p
    where p.compte_id is not null
      and p.mis_a_jour_le <= now() - interval '1 hour'
      and p.mis_a_jour_le > now() - interval '7 days'
      and exists (select 1 from public.ligne_panier l where l.panier_id = p.id)
      and exists (select 1 from public.consentement c where c.compte_id = p.compte_id and c.objet = 'relances' and c.retire_le is null)
      and not exists (
        select 1 from public.commande co
        where co.compte_id = p.compte_id and co.statut in ('en_attente', 'echouee') and co.expire_le > now() and co.cree_le >= p.mis_a_jour_le
      )
  loop
    v_etape := case when v_r.mis_a_jour_le <= now() - interval '24 hours' then '24h' else '1h' end;
    if public.envois_planifier('panier_abandonne', v_r.compte_id, jsonb_build_object('panier_id', v_r.id),
         'panier_abandonne:' || v_r.id || ':' || floor(extract(epoch from v_r.mis_a_jour_le))::bigint || ':' || v_etape) is not null then
      v_n := v_n + 1;
    end if;
  end loop;

  for v_r in
    select a.id, a.compte_id, a.produit_id, a.cree_le, pv.max_position_secondes, pv.terminee_le
    from public.acces_kit a
    join public.commande c on c.id = a.commande_origine and c.paye_le is not null
    join public.video_kit v on v.produit_id = a.produit_id
    left join public.progression_video pv on pv.compte_id = a.compte_id and pv.produit_id = a.produit_id
    where a.cree_le <= now() - interval '2 days'
      and a.cree_le > now() - interval '60 days'
      and pv.terminee_le is null
      and exists (select 1 from public.consentement cs where cs.compte_id = a.compte_id and cs.objet = 'relances' and cs.retire_le is null)
  loop
    if v_r.cree_le <= now() - interval '7 days' then
      if public.envois_planifier('rappel_kit', v_r.compte_id, jsonb_build_object('produit_id', v_r.produit_id), 'rappel_kit:' || v_r.id || ':fin') is not null then
        v_n := v_n + 1;
      end if;
    elsif coalesce(v_r.max_position_secondes, 0) = 0 then
      if public.envois_planifier('rappel_kit', v_r.compte_id, jsonb_build_object('produit_id', v_r.produit_id), 'rappel_kit:' || v_r.id || ':debut') is not null then
        v_n := v_n + 1;
      end if;
    end if;
  end loop;

  for v_r in
    select distinct pr.id as produit_id, cs.compte_id
    from public.produit pr
    join public.consentement cs on cs.objet = 'nouveautes' and cs.retire_le is null and cs.compte_id is not null
    where pr.univers_id is not null
      and pr.publie_le is not null and pr.publie_le <= now() and pr.publie_le > now() - interval '7 days'
      and (
        exists (select 1 from public.profil pf where pf.id = cs.compte_id and pf.univers_prefere = pr.univers_id)
        or exists (
          select 1 from public.commande c
          join public.ligne_commande l on l.commande_id = c.id
          join public.produit achete on achete.id = l.produit_id
          where c.compte_id = cs.compte_id and c.paye_le is not null and achete.univers_id = pr.univers_id
        )
      )
      and not exists (select 1 from public.acces_kit ak where ak.compte_id = cs.compte_id and ak.produit_id = pr.id)
      and not exists (
        select 1 from public.commande c2 join public.ligne_commande l2 on l2.commande_id = c2.id
        where c2.compte_id = cs.compte_id and c2.paye_le is not null and l2.produit_id = pr.id
      )
  loop
    if public.envois_planifier('nouveau_produit', v_r.compte_id, jsonb_build_object('produit_id', v_r.produit_id), 'nouveau_produit:' || v_r.produit_id || ':' || v_r.compte_id) is not null then
      v_n := v_n + 1;
    end if;
  end loop;

  return v_n;
end;
$$;
