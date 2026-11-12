-- Story 9.5 : Relances après achat (FR-45, AD-23).
-- planifier_relances() pose dans la boîte d'envoi (envois_planifier, clé unique : jamais deux fois la même Relance) au plus un email « relance » par Compte
-- et par rythme (réglage relances_rythme_jours, 3 jours au départ), pour les Comptes qui :
--   - ont un dernier paiement (paye_le) de moins de 90 jours (une Commande offerte n'a pas de paye_le : elle n'ouvre aucune fenêtre) ;
--   - ont le consentement « relances » (non retiré).
-- Chaque Relance ne traite qu'un sujet, choisi dans cet ordre : (a) un Kit commencé et pas terminé ; (b) un Événement publié dans les 30 prochains jours ;
-- (c) une nouveauté (publiée depuis moins de 30 jours) de l'univers préféré ou acheté, que le Compte n'a pas déjà. Aucun sujet : aucune Relance.
-- Le sujet est porté par la clé de envoi.donnees (kit_id, evenement_id ou produit_id : des identifiants seulement). La boîte d'envoi applique ensuite les règles
-- de la story 9.4 au moment de l'envoi (consentement, désinscription, Compte mineur, un Email commercial tous les 2 jours) ; le rendu relit la base.

create function public.planifier_relances()
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
    group by c.compte_id
    having max(c.paye_le) > now() - interval '90 days'
    order by c.compte_id
    limit 1000
  loop
    continue when not exists (select 1 from public.consentement cs where cs.compte_id = v_r.compte_id and cs.objet = 'relances' and cs.retire_le is null);
    continue when exists (select 1 from public.envoi x where x.modele = 'relance' and x.compte_id = v_r.compte_id and x.cree_le > now() - make_interval(days => v_jours));

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
              where c2.compte_id = v_r.compte_id and c2.paye_le is not null and achete.univers_id = pr.univers_id
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
revoke all on function public.planifier_relances() from public, anon, authenticated;
grant execute on function public.planifier_relances() to service_role;

-- Déclenchement de /api/cron/relances toutes les 6 heures (secrets Vault site_url et cron_secret ; sans eux, rien n'est planifié), comme la galerie d'événement.
create function public.relances_declencher()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'site_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    raise notice 'relances_declencher : secrets Vault site_url / cron_secret absents, rien envoyé';
    return false;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/relances',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  return true;
exception when others then
  raise notice 'relances_declencher : appel impossible (%)', sqlstate;
  return false;
end;
$$;
revoke all on function public.relances_declencher() from public, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('relances', '23 */6 * * *', 'select public.relances_declencher()');
  else
    raise notice 'pg_cron indisponible : tâche relances non planifiée';
  end if;
exception when others then
  raise notice 'planification relances impossible (%)', sqlstate;
end
$$;
