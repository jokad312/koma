-- Story 6.2 : Commandes dans l'admin. Verification de l'auteur pour le personnel (admin ou assistant, role relu en base, jamais cru depuis
-- l'objet recu) et correction d'une adresse de livraison, journalisee avec son auteur (FR-24, NFR-9).

create function public.exiger_personnel(p_auteur jsonb)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  if (p_auteur ->> 'type') is distinct from 'compte'
     or (p_auteur ->> 'id') is null
     or (p_auteur ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'KS_DROIT_REFUSE' using errcode = 'P0001';
  end if;
  if not (public.a_le_role((p_auteur ->> 'id')::uuid, 'admin') or public.a_le_role((p_auteur ->> 'id')::uuid, 'assistant')) then
    raise exception 'KS_DROIT_REFUSE' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.exiger_personnel(jsonb) from public, anon, authenticated;
grant execute on function public.exiger_personnel(jsonb) to service_role;

-- Corrige l'adresse d'une Commande en livraison. Une Commande en retrait n'a pas d'adresse (contrainte de la table). Le trigger de journal enregistre
-- l'ancienne et la nouvelle valeur avec l'auteur.
create function public.corriger_adresse_commande(p_auteur jsonb, p_numero text, p_adresse text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_adresse text := btrim(coalesce(p_adresse, ''));
  v_c public.commande;
begin
  perform public.exiger_personnel(p_auteur);
  if char_length(v_adresse) not between 1 and 500 then
    raise exception 'KS_ADRESSE_INVALIDE' using errcode = 'P0001';
  end if;
  select * into v_c from public.commande where numero = p_numero for update;
  if not found then
    raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_c.mode_remise is distinct from 'livraison' then
    raise exception 'KS_PAS_DE_LIVRAISON' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.commande set adresse = v_adresse, mis_a_jour_le = now() where id = v_c.id;
end;
$$;
revoke all on function public.corriger_adresse_commande(jsonb, text, text) from public, anon, authenticated;
grant execute on function public.corriger_adresse_commande(jsonb, text, text) to service_role;
