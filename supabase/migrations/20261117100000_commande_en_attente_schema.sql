-- Story 4.3 (1/2) : schéma de la Commande en attente, réservations, disponibilité qui compte les réservations, réglage delai_paiement,
-- expiration des Commandes échues (AD-8, AD-10, AD-26). creer_commande arrive dans la migration suivante.

-- Colonnes de la Commande figées à la création (livraison, téléphone, échéance, origine de la vente).
alter table public.commande
  add column origine text check (origine is null or origine ~ '^[a-z0-9_-]{1,40}$'),
  add column expire_le timestamptz,
  add column forfait_cents integer not null default 0 check (forfait_cents >= 0),
  add column zone text check (zone in ('goma', 'bukavu')),
  add column mode_remise text check (mode_remise in ('retrait', 'livraison')),
  add column telephone text check (telephone is null or char_length(telephone) between 8 and 20),
  add column adresse text check (adresse is null or char_length(adresse) between 1 and 500),
  add constraint commande_remise_coherente check (
    (zone is null) = (mode_remise is null)
    and (mode_remise is distinct from 'retrait' or zone = 'goma')
    and (zone is distinct from 'bukavu' or mode_remise = 'livraison')
    and (adresse is null or mode_remise = 'livraison')
  );

-- Ligne physique : variante, origine figée (stock ou fabrication, AD-26) et délai de fabrication annoncé (jours). Nuls pour un Kit.
alter table public.ligne_commande
  add column variante_id uuid references public.variante (id) on delete restrict,
  add column origine text check (origine in ('stock', 'fabrication')),
  add column delai_fabrication_jours integer check (delai_fabrication_jours is null or delai_fabrication_jours between 1 and 365),
  add constraint ligne_commande_physique_coherente check ((variante_id is null) = (origine is null));

-- Réservation d'une ligne physique, active jusqu'à expire_le tant que la Commande est en attente ou échouée et qu'elle n'est pas libérée.
create table public.reservation (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.commande (id) on delete restrict,
  ligne_id uuid not null references public.ligne_commande (id) on delete restrict,
  variante_id uuid not null references public.variante (id) on delete restrict,
  nombre smallint not null check (nombre > 0),
  origine text not null check (origine in ('stock', 'fabrication')),
  expire_le timestamptz not null,
  liberee_le timestamptz,
  cree_le timestamptz not null default now(),
  constraint reservation_une_par_ligne unique (ligne_id)
);
create index reservation_variante_idx on public.reservation (variante_id) where liberee_le is null;
create index commande_echeance_idx on public.commande (expire_le) where statut in ('en_attente', 'echouee');

alter table public.reservation enable row level security;
revoke all on public.reservation from public, anon, authenticated;
create trigger reservation_journaliser
  after insert or update or delete on public.reservation
  for each row execute function public.journaliser('id');

-- stock_disponible = stock moins les réservations actives d'origine « stock ». Mêmes droits qu'avant (service seulement).
create or replace function public.stock_disponible(p_variante uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select v.stock - coalesce((
    select sum(r.nombre)::integer
    from public.reservation r
    join public.commande c on c.id = r.commande_id
    where r.variante_id = v.id and r.origine = 'stock' and r.liberee_le is null and r.expire_le > now()
      and c.statut in ('en_attente', 'echouee')
  ), 0)
  from public.variante v where v.id = p_variante
$$;

-- places_fabrication_utilisees = pièces sur commande réservées (Commandes en attente ou échouées) + pièces sur commande des Commandes
-- payées ou en fabrication. Les pièces en stock n'y comptent jamais (AD-26).
create or replace function public.places_fabrication_utilisees()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((
      select sum(r.nombre)
      from public.reservation r
      join public.commande c on c.id = r.commande_id
      where r.origine = 'fabrication' and r.liberee_le is null and r.expire_le > now() and c.statut in ('en_attente', 'echouee')
    ), 0)
    + coalesce((
      select sum(l.nombre)
      from public.ligne_commande l
      join public.commande c on c.id = l.commande_id
      where l.origine = 'fabrication' and c.statut in ('payee', 'en_fabrication')
    ), 0)
  )::integer
$$;

-- Valeur de départ du délai de paiement : 30 minutes (décision de Jonathan, Q-B4), modifiable dans la page Réglages et journalisée.
select set_config('ks.auteur', '{"type":"migration","nom":"commande_en_attente"}', true);
insert into public.reglage (cle, valeur) values ('delai_paiement', '30') on conflict (cle) do nothing;

-- Expire les Commandes en attente ou échouées dont l'échéance est passée et libère leurs réservations (AD-10). Renvoie le nombre de Commandes expirées.
create function public.expirer_commandes_echues()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  perform set_config('ks.auteur', '{"type":"cron","nom":"expirer_commandes_echues"}', true);
  with e as (
    update public.commande set statut = 'expiree', mis_a_jour_le = now()
    where statut in ('en_attente', 'echouee') and expire_le is not null and expire_le <= now()
    returning id
  ), liberees as (
    update public.reservation set liberee_le = now()
    where commande_id in (select id from e) and liberee_le is null
    returning 1
  )
  select count(*)::integer into v_n from e;
  return v_n;
end;
$$;
revoke all on function public.expirer_commandes_echues() from public, anon, authenticated;
grant execute on function public.expirer_commandes_echues() to service_role;

-- Planification chaque minute par pg_cron (AD-10), sans route HTTP. Si l'extension n'est pas disponible sur la base, la migration continue :
-- le stock se libère de toute façon à l'échéance (les réservations ne comptent que jusqu'à expire_le) et l'état « expirée » est calculé à la lecture.
do $cron$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('expirer-commandes', '* * * * *', 'select public.expirer_commandes_echues()');
  else
    raise notice 'pg_cron indisponible : expirer_commandes_echues n''est pas planifiée';
  end if;
exception when others then
  raise notice 'pg_cron non configuré : %', sqlerrm;
end
$cron$;

-- enregistrer_reglage : même fonction qu'en 20261025100000 avec la clé delai_paiement (entier de 1 à 1440 minutes).
create or replace function public.enregistrer_reglage(p_auteur jsonb, p_cle text, p_valeur text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_valeur text;
  v_texte text;
  v_entier bigint;
begin
  perform public.exiger_admin(p_auteur);
  if p_cle is null or p_cle not in (
    'nom_site', 'numero_whatsapp',
    'forfait_livraison_goma_cents', 'forfait_livraison_bukavu_cents',
    'retrait_goma_fr', 'retrait_goma_en',
    'plafond_fabrication', 'delai_paiement'
  ) then
    raise exception 'KS_REGLAGE_INCONNU' using errcode = 'P0001';
  end if;

  if p_cle = 'nom_site' then
    v_valeur := btrim(coalesce(p_valeur, ''));
    if char_length(v_valeur) < 1 or char_length(v_valeur) > 60 then
      raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
    end if;
  elsif p_cle = 'numero_whatsapp' then
    v_valeur := nullif(regexp_replace(coalesce(p_valeur, ''), '\s', '', 'g'), '');
    if v_valeur is not null and v_valeur !~ '^\+[0-9]{8,15}$' then
      raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
    end if;
  elsif p_cle in ('forfait_livraison_goma_cents', 'forfait_livraison_bukavu_cents') then
    v_texte := btrim(coalesce(p_valeur, ''));
    if v_texte = '' then
      v_valeur := null;
    else
      if v_texte !~ '^[0-9]{1,6}$' then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_entier := v_texte::bigint;
      if v_entier > 100000 then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_valeur := v_entier::text;
    end if;
  elsif p_cle in ('retrait_goma_fr', 'retrait_goma_en') then
    v_valeur := nullif(btrim(coalesce(p_valeur, '')), '');
    if v_valeur is not null and char_length(v_valeur) > 500 then
      raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
    end if;
  elsif p_cle = 'delai_paiement' then
    -- Minutes laissées au client pour payer une Commande en attente (1 à 1440, soit 24 heures). Vide : effacé.
    v_texte := btrim(coalesce(p_valeur, ''));
    if v_texte = '' then
      v_valeur := null;
    else
      if v_texte !~ '^[0-9]{1,4}$' then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_entier := v_texte::bigint;
      if v_entier < 1 or v_entier > 1440 then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_valeur := v_entier::text;
    end if;
  else
    -- plafond_fabrication
    v_texte := btrim(coalesce(p_valeur, ''));
    if v_texte = '' then
      v_valeur := null;
    else
      if v_texte !~ '^[0-9]{1,5}$' then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_entier := v_texte::bigint;
      if v_entier < 1 or v_entier > 10000 then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_valeur := v_entier::text;
    end if;
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  insert into public.reglage (cle, valeur, mis_a_jour_le)
  values (p_cle, v_valeur, now())
  on conflict (cle) do update set valeur = excluded.valeur, mis_a_jour_le = excluded.mis_a_jour_le;
end;
$$;
