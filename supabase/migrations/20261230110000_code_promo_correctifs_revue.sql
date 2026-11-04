-- Story 9.1, correctifs de la revue croisee (la migration 20261230100000 n'est pas modifiee) :
-- 1. L'Affilie n'accepte aucun caractere de controle (retour a la ligne, NUL, tabulation) : contrainte et validation des deux fonctions.
-- 2. Le code est immuable en base (declencheur), pas seulement par l'absence de parametre.
-- 3. Une modification qui ne change aucune valeur n'ecrit rien et ne journalise rien.

alter table public.code_promo
  add constraint code_promo_affilie_sans_controle check (affilie !~ '[[:cntrl:]]');

create function public.code_promo_code_immuable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.code is distinct from old.code then
    raise exception 'KS_CODE_IMMUABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.code_promo_code_immuable() from public, anon, authenticated;

create trigger code_promo_code_immuable
  before update on public.code_promo
  for each row execute function public.code_promo_code_immuable();

create or replace function public.creer_code_promo(
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
  if char_length(v_affilie) < 1 or char_length(v_affilie) > 120 or v_affilie ~ '[[:cntrl:]]' then
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

create or replace function public.modifier_code_promo(
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
  v_ancien public.code_promo%rowtype;
begin
  perform public.exiger_admin(p_auteur);
  if char_length(v_affilie) < 1 or char_length(v_affilie) > 120 or v_affilie ~ '[[:cntrl:]]' then
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
  select * into v_ancien from public.code_promo where id = p_id for update;
  if not found then
    raise exception 'KS_CODE_PROMO_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Aucune valeur ne change : rien n'est ecrit (ni modifie_le, ni ligne de journal). p_actif absent conserve l'etat actuel.
  if v_ancien.affilie = v_affilie
     and v_ancien.reduction_pct = p_reduction_pct
     and v_ancien.commission_pct = p_commission_pct
     and v_ancien.plafond = p_plafond
     and v_ancien.actif = coalesce(p_actif, v_ancien.actif) then
    return;
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
end;
$$;

revoke all on function public.creer_code_promo(jsonb, text, text, numeric, numeric, integer, boolean) from public, anon, authenticated;
revoke all on function public.modifier_code_promo(jsonb, uuid, text, numeric, numeric, integer, boolean) from public, anon, authenticated;
grant execute on function public.creer_code_promo(jsonb, text, text, numeric, numeric, integer, boolean) to service_role;
grant execute on function public.modifier_code_promo(jsonb, uuid, text, numeric, numeric, integer, boolean) to service_role;
