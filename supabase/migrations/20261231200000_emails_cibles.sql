-- Story 9.6 : emails ciblés (FR-59, AD-9). planifier_emails_cibles() pose dans la boîte d'envoi (envois_planifier, clé unique : jamais deux
-- fois le même email) :
--   - panier_abandonne : Panier d'un Compte, non vide, non modifié depuis 1 heure puis depuis 24 heures (une clé par modification du Panier) ;
--   - rappel_kit : Kit acheté (Commande avec paye_le), sans Vidéo démarrée 2 jours après l'achat, ou sans Vidéo terminée 7 jours après ;
--   - nouveau_produit : Produit publié depuis moins de 7 jours dans un univers où le Compte a acheté ou qu'il a déclaré préféré (story 1.6).
-- Seuls les Comptes qui ont le consentement concerné sont visés ; la boîte d'envoi applique ensuite toutes les règles de la story 9.4
-- (consentement, désinscription, Compte mineur, un Email commercial tous les 2 jours) au moment de l'envoi. Le rendu relit la base :
-- un Panier vidé (payé) ou un Kit terminé n'est jamais rappelé. Fenêtres bornées (7 jours, 60 jours) : pas de vague d'emails à la mise en ligne.

create function public.planifier_emails_cibles()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
  v_r record;
begin
  perform set_config('ks.auteur', '{"type":"cron","nom":"planifier_emails_cibles"}', true);

  -- Panier oublié : 1 heure puis 24 heures après la dernière modification (fenêtre de 7 jours).
  for v_r in
    select p.id, p.compte_id, p.mis_a_jour_le, (p.mis_a_jour_le <= now() - interval '24 hours') as jour
    from public.panier p
    where p.compte_id is not null
      and p.mis_a_jour_le <= now() - interval '1 hour'
      and p.mis_a_jour_le > now() - interval '7 days'
      and exists (select 1 from public.ligne_panier l where l.panier_id = p.id)
      and exists (select 1 from public.consentement c where c.compte_id = p.compte_id and c.objet = 'relances' and c.retire_le is null)
  loop
    if public.envois_planifier('panier_abandonne', v_r.compte_id, jsonb_build_object('panier_id', v_r.id),
         'panier_abandonne:' || v_r.id || ':' || floor(extract(epoch from v_r.mis_a_jour_le))::bigint || ':1h') is not null then
      v_n := v_n + 1;
    end if;
    if v_r.jour and public.envois_planifier('panier_abandonne', v_r.compte_id, jsonb_build_object('panier_id', v_r.id),
         'panier_abandonne:' || v_r.id || ':' || floor(extract(epoch from v_r.mis_a_jour_le))::bigint || ':24h') is not null then
      v_n := v_n + 1;
    end if;
  end loop;

  -- Rappel de Kit acheté (fenêtre de 60 jours après l'achat) : pas démarré à 2 jours, pas terminé à 7 jours.
  for v_r in
    select a.id, a.compte_id, a.produit_id, a.cree_le, pv.max_position_secondes, pv.terminee_le
    from public.acces_kit a
    join public.commande c on c.id = a.commande_origine and c.paye_le is not null
    join public.video_kit v on v.produit_id = a.produit_id
    left join public.progression_video pv on pv.compte_id = a.compte_id and pv.produit_id = a.produit_id
    where a.cree_le <= now() - interval '2 days'
      and a.cree_le > now() - interval '60 days'
      and exists (select 1 from public.consentement cs where cs.compte_id = a.compte_id and cs.objet = 'relances' and cs.retire_le is null)
  loop
    if coalesce(v_r.max_position_secondes, 0) = 0 then
      if public.envois_planifier('rappel_kit', v_r.compte_id, jsonb_build_object('produit_id', v_r.produit_id), 'rappel_kit:' || v_r.id || ':debut') is not null then
        v_n := v_n + 1;
      end if;
    elsif v_r.terminee_le is null and v_r.cree_le <= now() - interval '7 days' then
      if public.envois_planifier('rappel_kit', v_r.compte_id, jsonb_build_object('produit_id', v_r.produit_id), 'rappel_kit:' || v_r.id || ':fin') is not null then
        v_n := v_n + 1;
      end if;
    end if;
  end loop;

  -- Nouveau produit dans un univers acheté ou préféré (publié depuis moins de 7 jours).
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
  loop
    if public.envois_planifier('nouveau_produit', v_r.compte_id, jsonb_build_object('produit_id', v_r.produit_id), 'nouveau_produit:' || v_r.produit_id || ':' || v_r.compte_id) is not null then
      v_n := v_n + 1;
    end if;
  end loop;

  return v_n;
end;
$$;

revoke all on function public.planifier_emails_cibles() from public, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('planifier-emails-cibles', '*/15 * * * *', 'select public.planifier_emails_cibles()');
  else
    raise notice 'pg_cron indisponible : planifier_emails_cibles n''est pas planifiée';
  end if;
end;
$$;
