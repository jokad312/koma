-- Story 9.2, correctif de la revue : une Commande en attente ou échouée dont l'échéance (expire_le) est passée libère son utilisation tout de suite,
-- sans attendre le passage de expirer_commandes_echues (AD-29 : « libérée à son expiration »). Même règle pour « un seul code par achat », alignée
-- sur creer_commande (une Commande à payer est en attente ou échouée ET non échue). Signatures inchangées : les droits sont conservés.

create or replace function public.utilisations_code_promo(p_code uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.commande_code_promo ccp
  join public.commande c on c.id = ccp.commande_id
  where ccp.code_promo_id = p_code
    and (
      (c.statut in ('en_attente', 'echouee') and c.expire_le > now())
      or (c.paye_le is not null and c.statut not in ('annulee', 'remboursee'))
    )
$$;

create or replace function public.code_promo_evaluer(p_compte uuid, p_code text, p_sauf_commande uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_norm text := upper(btrim(coalesce(p_code, '')));
  v_c record;
begin
  if v_norm !~ '^[A-Z0-9_-]{3,24}$' then
    return jsonb_build_object('valide', false, 'erreur', 'code_inconnu');
  end if;
  select id, code, reduction_pct, plafond, actif into v_c from public.code_promo where code = v_norm;
  if not found then
    return jsonb_build_object('valide', false, 'erreur', 'code_inconnu');
  end if;
  if not v_c.actif then
    return jsonb_build_object('valide', false, 'erreur', 'code_inactif');
  end if;
  if public.utilisations_code_promo(v_c.id) >= v_c.plafond then
    return jsonb_build_object('valide', false, 'erreur', 'code_plafond');
  end if;
  if public.a_deja_achete(p_compte, p_sauf_commande) then
    return jsonb_build_object('valide', false, 'erreur', 'code_premier_achat');
  end if;
  if exists (
    select 1 from public.commande c join public.commande_code_promo ccp on ccp.commande_id = c.id
    where c.compte_id = p_compte and c.statut in ('en_attente', 'echouee') and c.expire_le > now() and c.id is distinct from p_sauf_commande
  ) then
    return jsonb_build_object('valide', false, 'erreur', 'code_un_seul');
  end if;
  return jsonb_build_object('valide', true, 'id', v_c.id, 'code', v_c.code, 'reduction_pct', v_c.reduction_pct);
end;
$$;
