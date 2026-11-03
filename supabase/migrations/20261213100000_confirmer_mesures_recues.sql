-- Story 6.5 : Jonathan confirme avoir recu les mesures d'une ligne Sur-mesure sur WhatsApp (AD-32). Aucune mesure n'est saisie ni enregistree :
-- seule la date de reception l'est. Le delai de fabrication affiche au client court a partir de cette date. Personnel (admin ou assistant) seulement.
create function public.confirmer_mesures_recues(p_auteur jsonb, p_ligne uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_l public.ligne_commande;
  v_c public.commande;
  v_taille text;
begin
  perform public.exiger_personnel(p_auteur);
  select * into v_l from public.ligne_commande where id = p_ligne for update;
  if not found then
    raise exception 'KS_LIGNE_INTROUVABLE' using errcode = 'P0001';
  end if;
  select * into v_c from public.commande where id = v_l.commande_id;
  select taille into v_taille from public.variante where id = v_l.variante_id;
  if v_taille is distinct from 'sur_mesure' then
    raise exception 'KS_PAS_SUR_MESURE' using errcode = 'P0001';
  end if;
  -- Seule une Commande payee et pas encore en fabrication attend des mesures.
  if v_c.statut not in ('payee', 'en_fabrication') then
    raise exception 'KS_TRANSITION_INTERDITE' using errcode = 'P0001';
  end if;
  if v_l.mesures_recues_le is not null then
    raise exception 'KS_MESURES_DEJA_RECUES' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.ligne_commande set mesures_recues_le = now() where id = v_l.id;
end;
$$;
revoke all on function public.confirmer_mesures_recues(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.confirmer_mesures_recues(jsonb, uuid) to service_role;
