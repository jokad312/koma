-- Story 6.3 : avancement manuel des Commandes physiques et emails de statut (AD-3, AD-9). « payee » ne se pose jamais ici : seule confirmer_paiement
-- y mene (regle 2). Les emails sont planifies dans la meme transaction que le changement de statut (boite d'envoi).

alter type public.envoi_modele add value if not exists 'commande_en_fabrication';
alter type public.envoi_modele add value if not exists 'commande_expediee';
alter type public.envoi_modele add value if not exists 'commande_livree';

-- Transitions autorisees : payee -> en_fabrication ; payee -> expediee (seulement si toutes les lignes physiques viennent du stock) ;
-- en_fabrication -> expediee ; expediee -> livree. Aucun statut ne recule. Une Commande sans ligne physique n'avance jamais a la main.
-- Passage en fabrication d'une ligne Sur-mesure : la reception des mesures doit etre confirmee (story 6.5, AD-32).
-- Le numero de suivi (texte libre, facultatif, 100 caracteres) ne se pose qu'a l'expedition ; il est affiche tel quel (regle 12).
create function public.avancer_statut(p_auteur jsonb, p_numero text, p_vers text, p_numero_suivi text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.commande;
  v_suivi text := nullif(btrim(coalesce(p_numero_suivi, '')), '');
  v_physiques integer;
  v_fabriquees integer;
  v_mesures_manquantes integer;
begin
  perform public.exiger_personnel(p_auteur);
  if p_vers is null or p_vers not in ('en_fabrication', 'expediee', 'livree') then
    raise exception 'KS_TRANSITION_INTERDITE' using errcode = 'P0001';
  end if;
  if v_suivi is not null and (p_vers <> 'expediee' or char_length(v_suivi) > 100) then
    raise exception 'KS_SUIVI_INVALIDE' using errcode = 'P0001';
  end if;
  select * into v_c from public.commande where numero = p_numero for update;
  if not found then
    raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  select count(*), count(*) filter (where l.origine = 'fabrication')
    into v_physiques, v_fabriquees
    from public.ligne_commande l where l.commande_id = v_c.id and l.variante_id is not null;
  if v_c.offerte or v_physiques = 0 then
    raise exception 'KS_TRANSITION_INTERDITE' using errcode = 'P0001';
  end if;
  if not (
    (v_c.statut = 'payee' and p_vers = 'en_fabrication')
    or (v_c.statut = 'payee' and p_vers = 'expediee' and v_fabriquees = 0)
    or (v_c.statut = 'en_fabrication' and p_vers = 'expediee')
    or (v_c.statut = 'expediee' and p_vers = 'livree')
  ) then
    raise exception 'KS_TRANSITION_INTERDITE' using errcode = 'P0001';
  end if;
  if p_vers = 'en_fabrication' then
    select count(*) into v_mesures_manquantes
      from public.ligne_commande l join public.variante v on v.id = l.variante_id
      where l.commande_id = v_c.id and v.taille = 'sur_mesure' and l.mesures_recues_le is null;
    if v_mesures_manquantes > 0 then
      raise exception 'KS_MESURES_NON_RECUES' using errcode = 'P0001';
    end if;
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  update public.commande set
    statut = p_vers,
    fabrication_le = case when p_vers = 'en_fabrication' then now() else fabrication_le end,
    expediee_le = case when p_vers = 'expediee' then now() else expediee_le end,
    livree_le = case when p_vers = 'livree' then now() else livree_le end,
    numero_suivi = case when p_vers = 'expediee' then v_suivi else numero_suivi end,
    mis_a_jour_le = now()
  where id = v_c.id;
  -- Email planifie dans la meme transaction ; la cle rend l'envoi unique par Commande et par statut.
  perform public.envois_planifier(('commande_' || p_vers)::public.envoi_modele, v_c.compte_id, jsonb_build_object('commande_id', v_c.id), 'commande_' || p_vers || ':' || v_c.id::text);
end;
$$;
revoke all on function public.avancer_statut(jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.avancer_statut(jsonb, text, text, text) to service_role;
