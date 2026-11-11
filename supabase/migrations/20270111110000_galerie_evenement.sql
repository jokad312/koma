-- Story 7.10 : Galerie d'événement (FR-39). Jonathan saisit le lien public (Google Drive ou Google Photos) ; il est journalisé et affiché sur la page de
-- l'Événement passé ; quand l'Événement est terminé, chaque acheteur de Pass reçoit un email avec ce lien, une seule fois (AD-9, AD-10).
-- Les photos restent chez Google : aucune photo n'entre dans le dépôt ni dans le stockage du site. Le retrait d'une photo se demande par le contact ;
-- Jonathan la retire à la main.

alter table public.evenement add column galerie_url text check (galerie_url is null or char_length(galerie_url) between 10 and 600);
-- Le lien est public (il est affiché sur la page de l'Événement) : lisible comme les autres colonnes de présentation, pour les Événements publiés seulement (RLS).
grant select (galerie_url) on public.evenement to anon, authenticated;

-- Lien valable : https seulement, et seulement Google Drive, Google Photos ou un lien court Google Photos, sans espace.
create function public.galerie_url_valide(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_url ~ '^https://(drive\.google\.com|photos\.google\.com|photos\.app\.goo\.gl)/[^[:space:]]{1,500}$'
$$;
revoke all on function public.galerie_url_valide(text) from public, anon, authenticated, service_role;

-- Enregistre (ou efface, avec un texte vide) le lien de la Galerie d'un Événement. Admin seulement ; le changement est journalisé par le déclencheur
-- evenement_journaliser (auteur lu dans ks.auteur). Ne touche à rien d'autre : enregistrer_evenement n'est pas modifiée.
create function public.enregistrer_galerie_evenement(p_auteur jsonb, p_evenement uuid, p_lien text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lien text := nullif(btrim(coalesce(p_lien, '')), '');
begin
  perform public.exiger_admin(p_auteur);
  if v_lien is not null and not public.galerie_url_valide(v_lien) then
    raise exception 'KS_LIEN_INVALIDE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.evenement set galerie_url = v_lien, modifie_le = now() where id = p_evenement;
  if not found then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.enregistrer_galerie_evenement(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.enregistrer_galerie_evenement(jsonb, uuid, text) to service_role;

-- Pose dans la boîte d'envoi un email par acheteur de Pass pour chaque Événement publié, terminé (fin, ou début sans fin, dépassée) et dont le lien est saisi.
-- Acheteur = Compte d'une Commande de Pass payée ou offerte qui garde au moins un Pass valide ou déjà scanné (jamais un Pass annulé ou remboursé).
-- La clé d'envoi (Événement + Compte) fait qu'un même acheteur ne reçoit l'email qu'une fois, même si le lien change ou que la tâche rejoue.
-- Seuls des identifiants vont dans envoi.donnees ; le rendu relit la base. Lot borné : le reste part au passage suivant.
create function public.planifier_galeries_evenements()
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
revoke all on function public.planifier_galeries_evenements() from public, anon, authenticated;
grant execute on function public.planifier_galeries_evenements() to service_role;

-- Ce que le rendu de l'email lit : l'Événement et son lien, et si le Compte garde bien un Pass valide ou scanné de cet Événement.
create function public.galerie_evenement_pour_envoi(p_evenement uuid, p_compte uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'titre_fr', e.titre_fr,
    'titre_en', e.titre_en,
    'galerie_url', e.galerie_url,
    'publie', e.publie_le is not null,
    'termine', coalesce(e.fin_le, e.debut_le) is not null and coalesce(e.fin_le, e.debut_le) <= now(),
    'acheteur', exists (
      select 1 from public.pass p join public.commande c on c.id = p.commande_id
      where p.evenement_id = e.id and p.statut in ('valide', 'scanne') and c.compte_id = p_compte and c.type = 'pass' and c.statut in ('payee', 'offerte')
    )
  )
  from public.evenement e
  where e.id = p_evenement
$$;
revoke all on function public.galerie_evenement_pour_envoi(uuid, uuid) from public, anon, authenticated;
grant execute on function public.galerie_evenement_pour_envoi(uuid, uuid) to service_role;

-- Déclenchement de /api/cron/galerie-evenement chaque heure (secrets Vault site_url et cron_secret ; sans eux, rien n'est envoyé), comme les alertes.
create function public.galerie_evenement_declencher()
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
    raise notice 'galerie_evenement_declencher : secrets Vault site_url / cron_secret absents, rien envoyé';
    return false;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/galerie-evenement',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  return true;
exception when others then
  raise notice 'galerie_evenement_declencher : appel impossible (%)', sqlstate;
  return false;
end;
$$;
revoke all on function public.galerie_evenement_declencher() from public, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('galerie-evenement', '7 * * * *', 'select public.galerie_evenement_declencher()');
  else
    raise notice 'pg_cron indisponible : tâche galerie-evenement non planifiée';
  end if;
exception when others then
  raise notice 'planification galerie-evenement impossible (%)', sqlstate;
end
$$;
