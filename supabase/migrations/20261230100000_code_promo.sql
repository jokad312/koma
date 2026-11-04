-- Story 9.1 : Code promo. Table code_promo (module promo) : un code par Affilié, avec son pourcentage de réduction, son taux
-- de commission, son plafond d'utilisations et son état. AUCUNE colonne ne compte les utilisations (AD-29) : elles se calculent
-- à partir des Commandes (story 9.2). Table réservée à l'admin : RLS active, aucun droit direct pour anon ni authenticated.
-- Les écritures passent par deux fonctions security definer qui reçoivent l'auteur (AD-25). Chaque création ou modification est
-- journalisée. Le code est normalisé en majuscules : il est donc unique sans distinction de casse.

create table public.code_promo (
  id uuid primary key default gen_random_uuid(),
  -- Code saisi par Jonathan, stocké en majuscules (voir creer_code_promo) : A-Z, chiffres, tiret et souligné.
  code text not null check (code ~ '^[A-Z0-9_-]{3,24}$'),
  -- Nom de l'Affilié, sans compte dans l'admin (FR-46).
  affilie text not null check (char_length(affilie) between 1 and 120 and affilie = btrim(affilie)),
  reduction_pct numeric(5,2) not null check (reduction_pct > 0 and reduction_pct <= 100),
  commission_pct numeric(5,2) not null check (commission_pct >= 0 and commission_pct <= 100),
  plafond integer not null default 50 check (plafond between 1 and 100000),
  actif boolean not null default true,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint code_promo_code_unique unique (code)
);

alter table public.code_promo enable row level security;
revoke all on public.code_promo from public, anon, authenticated;

create trigger code_promo_journaliser
  after insert or update or delete on public.code_promo
  for each row execute function public.journaliser('id');

-- Crée un Code promo (admin). Le code est normalisé en majuscules, l'Affilié est nettoyé. Le plafond absent vaut 50 (FR-46).
-- Les pourcentages sont refusés au-delà de deux décimales plutôt qu'arrondis en silence.
create function public.creer_code_promo(
  p_auteur jsonb,
  p_code text,
  p_affilie text,
  p_reduction_pct numeric,
  p_commission_pct numeric,
  p_plafond integer,
  p_actif boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_affilie text := btrim(coalesce(p_affilie, ''));
  v_plafond integer := coalesce(p_plafond, 50);
  v_id uuid;
begin
  perform public.exiger_admin(p_auteur);
  if v_code !~ '^[A-Z0-9_-]{3,24}$' then
    raise exception 'KS_CODE_INVALIDE' using errcode = 'P0001';
  end if;
  if char_length(v_affilie) < 1 or char_length(v_affilie) > 120 then
    raise exception 'KS_AFFILIE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_reduction_pct is null or p_reduction_pct <= 0 or p_reduction_pct > 100 or p_reduction_pct <> round(p_reduction_pct, 2) then
    raise exception 'KS_REDUCTION_INVALIDE' using errcode = 'P0001';
  end if;
  if p_commission_pct is null or p_commission_pct < 0 or p_commission_pct > 100 or p_commission_pct <> round(p_commission_pct, 2) then
    raise exception 'KS_COMMISSION_INVALIDE' using errcode = 'P0001';
  end if;
  if v_plafond < 1 or v_plafond > 100000 then
    raise exception 'KS_PLAFOND_INVALIDE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  begin
    insert into public.code_promo (code, affilie, reduction_pct, commission_pct, plafond, actif)
    values (v_code, v_affilie, p_reduction_pct, p_commission_pct, v_plafond, coalesce(p_actif, true))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'KS_CODE_EXISTANT' using errcode = 'P0001';
  end;
  return v_id;
end;
$$;

-- Modifie un Code promo (admin). Le code n'est jamais modifiable : pour le changer, il faut créer un autre code.
create function public.modifier_code_promo(
  p_auteur jsonb,
  p_id uuid,
  p_affilie text,
  p_reduction_pct numeric,
  p_commission_pct numeric,
  p_plafond integer,
  p_actif boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_affilie text := btrim(coalesce(p_affilie, ''));
begin
  perform public.exiger_admin(p_auteur);
  if char_length(v_affilie) < 1 or char_length(v_affilie) > 120 then
    raise exception 'KS_AFFILIE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_reduction_pct is null or p_reduction_pct <= 0 or p_reduction_pct > 100 or p_reduction_pct <> round(p_reduction_pct, 2) then
    raise exception 'KS_REDUCTION_INVALIDE' using errcode = 'P0001';
  end if;
  if p_commission_pct is null or p_commission_pct < 0 or p_commission_pct > 100 or p_commission_pct <> round(p_commission_pct, 2) then
    raise exception 'KS_COMMISSION_INVALIDE' using errcode = 'P0001';
  end if;
  if p_plafond is null or p_plafond < 1 or p_plafond > 100000 then
    raise exception 'KS_PLAFOND_INVALIDE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.code_promo
     set affilie = v_affilie,
         reduction_pct = p_reduction_pct,
         commission_pct = p_commission_pct,
         plafond = p_plafond,
         actif = coalesce(p_actif, actif),
         modifie_le = now()
   where id = p_id;
  if not found then
    raise exception 'KS_CODE_PROMO_INTROUVABLE' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.creer_code_promo(jsonb, text, text, numeric, numeric, integer, boolean) from public, anon, authenticated;
revoke all on function public.modifier_code_promo(jsonb, uuid, text, numeric, numeric, integer, boolean) from public, anon, authenticated;
grant execute on function public.creer_code_promo(jsonb, text, text, numeric, numeric, integer, boolean) to service_role;
grant execute on function public.modifier_code_promo(jsonb, uuid, text, numeric, numeric, integer, boolean) to service_role;
