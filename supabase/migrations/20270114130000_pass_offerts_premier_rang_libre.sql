-- Story 8.5, revue : l'attribution prend le premier rang libre de 1 à 10 (et non le maximum + 1), pour rester cohérente avec le décompte si une ligne disparaît.

create or replace function public.attribuer_pass_offert(p_auteur jsonb, p_realisation uuid, p_type uuid, p_titulaire text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom text := regexp_replace(btrim(coalesce(p_titulaire, '')), '\s+', ' ', 'g');
  v_r record;
  v_t public.type_pass;
  v_e public.evenement;
  v_rang integer;
  v_id uuid;
  v_numero text;
begin
  perform public.exiger_admin(p_auteur);
  if char_length(v_nom) not between 2 and 80 then
    raise exception 'KS_TITULAIRE_INVALIDE' using errcode = 'P0001';
  end if;
  select z.id, z.compte_id, z.produit_id, z.validee_le, ph.statut as photo_statut into v_r
  from public.realisation z join public.photo_galerie ph on ph.id = z.photo_id where z.id = p_realisation;
  if not found then
    raise exception 'KS_REALISATION_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_r.validee_le is null or v_r.photo_statut <> 'publiee' then
    raise exception 'KS_REALISATION_NON_VALIDEE' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.acces_kit a join public.commande c on c.id = a.commande_origine and c.paye_le is not null
    where a.compte_id = v_r.compte_id and a.produit_id = v_r.produit_id
  ) then
    raise exception 'KS_KIT_NON_PAYE' using errcode = 'P0001';
  end if;
  select * into v_t from public.type_pass where id = p_type;
  if not found or v_t.est_stand then
    raise exception 'KS_TYPE_PASS_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Verrou de l'Événement : deux attributions simultanées s'attendent ; le rang suivant est calculé sous ce verrou.
  select * into v_e from public.evenement where id = v_t.evenement_id for update;
  if v_e.publie_le is null or v_e.publie_le > now() or v_e.debut_le is null or v_e.debut_le <= now() then
    raise exception 'KS_EVENEMENT_INDISPONIBLE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.pass_offert where realisation_id = p_realisation) then
    raise exception 'KS_REALISATION_DEJA_UTILISEE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.pass_offert where evenement_id = v_e.id and compte_id = v_r.compte_id) then
    raise exception 'KS_DEJA_OFFERT' using errcode = 'P0001';
  end if;
  -- Premier rang libre de 1 à 10 (un rang libéré par la suppression d'une Réalisation est réutilisé).
  select min(g) into v_rang from generate_series(1, 10) g where not exists (select 1 from public.pass_offert o where o.evenement_id = v_e.id and o.rang = g);
  if v_rang is null then
    raise exception 'KS_OPERATION_TERMINEE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  if (v_e.capacite is not null and v_e.capacite - public.places_evenement_utilisees(v_e.id) < 1)
     or (v_t.quota is not null and public.places_type_pass_utilisees(v_t.id) + 1 > v_t.quota) then
    insert into public.anomalie (type, gravite, cible_type, cible_id, details)
    values ('pass_offert_impossible', 'attention', 'realisation', p_realisation, jsonb_build_object('evenement_id', v_e.id, 'type_pass_id', v_t.id, 'raison', 'KS_COMPLET'))
    on conflict (type, cible_type, cible_id) where resolue_le is null do nothing;
    return jsonb_build_object('attribue', false, 'erreur', 'KS_COMPLET');
  end if;

  insert into public.commande (compte_id, type, statut, offerte, sous_total_cents, total_cents, cle_idempotence)
  values (v_r.compte_id, 'pass', 'offerte', true, 0, 0, 'pass-offert:' || p_realisation::text)
  returning id, numero into v_id, v_numero;
  insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents, reduction_cents, type_pass_id, titulaires, pass_nom_fr, pass_nom_en, est_stand)
  values (v_id, null, 1, 0, 0, v_t.id, jsonb_build_array(v_nom), v_t.nom_fr, nullif(v_t.nom_en, ''), false);
  perform public.evenements_emettre_pass(v_id);
  insert into public.pass_offert (evenement_id, rang, compte_id, realisation_id, commande_id) values (v_e.id, v_rang, v_r.compte_id, p_realisation, v_id);
  return jsonb_build_object('attribue', true, 'rang', v_rang, 'commande_id', v_id, 'numero', v_numero, 'evenement_id', v_e.id);
end;
$$;
