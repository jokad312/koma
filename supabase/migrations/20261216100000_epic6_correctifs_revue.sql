-- Epic 6, correctifs de la revue croisee (Blind Hunter, Edge Case Hunter, Verification Gap). Les migrations 20261212 a 20261215 ne sont pas modifiees :
-- tout est repris ici par create or replace, alter ou drop/create.

-- 1. remboursement.montant_cents : bigint (un trop-percu en devise a gros montants, comme le CDF, depassait la plage d'un integer).
--    La colonne est exprimee en centimes de la devise de la ligne (USD pour une Commande, devise recue pour un Trop-percu).
alter table public.remboursement alter column montant_cents type bigint;
comment on column public.remboursement.montant_cents is 'Centimes de la devise de la colonne devise : USD pour une Commande ou un Pass, devise recue du Prestataire pour un Trop-percu.';

-- 2. Reclamation : une seule par ligne, quel que soit son statut (refusee ou remplacement remis comprises) ; la ligne n'est plus reclamable ensuite.
drop index public.demande_reclamation_unique;
create unique index demande_reclamation_unique on public.demande_client (ligne_id) where type = 'reclamation';

create or replace function public.lignes_reclamables(p_compte uuid, p_numero text)
returns table (ligne_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id
  from public.commande c
  join public.ligne_commande l on l.commande_id = c.id
  join public.produit p on p.id = l.produit_id
  join public.variante v on v.id = l.variante_id
  where c.numero = p_numero and c.compte_id = p_compte
    and c.statut = 'livree' and c.livree_le is not null and c.livree_le > now() - interval '48 hours'
    and p.famille in ('accessoire', 'cosplay') and v.taille <> 'sur_mesure' and not l.annulee
    and not exists (select 1 from public.demande_client d where d.ligne_id = l.id and d.type = 'reclamation')
$$;
revoke all on function public.lignes_reclamables(uuid, text) from public, anon, authenticated;
grant execute on function public.lignes_reclamables(uuid, text) to service_role;

-- 3. catalogue_decrementer_stock : le stock disponible (reservations actives deduites) doit couvrir la quantite, la ligne de variante reste verrouillee.
create or replace function public.catalogue_decrementer_stock(p_variante uuid, p_nombre integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_nombre is null or p_nombre <= 0 then
    raise exception 'KS_STOCK_INVALIDE' using errcode = 'P0001';
  end if;
  perform 1 from public.variante where id = p_variante for update;
  if not found or coalesce(public.stock_disponible(p_variante), 0) < p_nombre then
    raise exception 'KS_STOCK_INSUFFISANT' using errcode = 'P0001';
  end if;
  update public.variante set stock = stock - p_nombre where id = p_variante;
end;
$$;
revoke all on function public.catalogue_decrementer_stock(uuid, integer) from public, anon, authenticated;
grant execute on function public.catalogue_decrementer_stock(uuid, integer) to service_role;

-- 4. traiter_reclamation : etape inconnue distincte, « depuis le stock » seulement pour le remplacement remis, ligne relue sous verrou avant le decompte.
create or replace function public.traiter_reclamation(p_auteur jsonb, p_demande uuid, p_etape text, p_depuis_stock boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.demande_client;
  v_l public.ligne_commande;
  v_vers text;
begin
  perform public.exiger_admin(p_auteur);
  if p_etape is null or p_etape not in ('accepter', 'refuser', 'article_rendu', 'remplacement_remis') then
    raise exception 'KS_ETAPE_INVALIDE' using errcode = 'P0001';
  end if;
  if coalesce(p_depuis_stock, false) and p_etape <> 'remplacement_remis' then
    raise exception 'KS_DEPUIS_STOCK_INVALIDE' using errcode = 'P0001';
  end if;
  select * into v_d from public.demande_client where id = p_demande for update;
  if not found then
    raise exception 'KS_DEMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_d.type <> 'reclamation' then
    raise exception 'KS_TYPE_NON_PRIS_EN_CHARGE' using errcode = 'P0001';
  end if;
  v_vers := case
    when p_etape = 'accepter' and v_d.statut = 'ouverte' then 'acceptee'
    when p_etape = 'refuser' and v_d.statut = 'ouverte' then 'refusee'
    when p_etape = 'article_rendu' and v_d.statut = 'acceptee' then 'article_rendu'
    when p_etape = 'remplacement_remis' and v_d.statut = 'article_rendu' then 'remplacement_remis'
    else null end;
  if v_vers is null then
    raise exception 'KS_DEMANDE_DEJA_TRAITEE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  if v_vers = 'remplacement_remis' and coalesce(p_depuis_stock, false) then
    select * into v_l from public.ligne_commande where id = v_d.ligne_id for update;
    if not found or v_l.variante_id is null then
      raise exception 'KS_LIGNE_INTROUVABLE' using errcode = 'P0001';
    end if;
    perform public.catalogue_decrementer_stock(v_l.variante_id, v_l.nombre);
  end if;
  update public.demande_client set statut = v_vers, traitee_le = coalesce(traitee_le, now()) where id = v_d.id;
end;
$$;
revoke all on function public.traiter_reclamation(jsonb, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.traiter_reclamation(jsonb, uuid, text, boolean) to service_role;

-- 5. avancer_statut : fabrication seulement s'il y a au moins une piece a fabriquer ; pas de numero de suivi pour un retrait ; les demandes d'annulation
--    ouvertes sont refusees d'office quand la Commande part en fabrication ou en expedition (l'annulation n'est plus possible).
create or replace function public.avancer_statut(p_auteur jsonb, p_numero text, p_vers text, p_numero_suivi text default null)
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
  if v_suivi is not null and v_c.mode_remise = 'retrait' then
    raise exception 'KS_SUIVI_INVALIDE' using errcode = 'P0001';
  end if;
  select count(*), count(*) filter (where l.origine = 'fabrication')
    into v_physiques, v_fabriquees
    from public.ligne_commande l where l.commande_id = v_c.id and l.variante_id is not null;
  if v_c.offerte or v_physiques = 0 then
    raise exception 'KS_TRANSITION_INTERDITE' using errcode = 'P0001';
  end if;
  if not (
    (v_c.statut = 'payee' and p_vers = 'en_fabrication' and v_fabriquees > 0)
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
  if p_vers in ('en_fabrication', 'expediee') then
    update public.demande_client set statut = 'refusee', traitee_le = now()
      where commande_id = v_c.id and type = 'annulation_commande' and statut = 'ouverte';
  end if;
  update public.commande set
    statut = p_vers,
    fabrication_le = case when p_vers = 'en_fabrication' then now() else fabrication_le end,
    expediee_le = case when p_vers = 'expediee' then now() else expediee_le end,
    livree_le = case when p_vers = 'livree' then now() else livree_le end,
    numero_suivi = case when p_vers = 'expediee' then v_suivi else numero_suivi end,
    mis_a_jour_le = now()
  where id = v_c.id;
  perform public.envois_planifier(('commande_' || p_vers)::public.envoi_modele, v_c.compte_id, jsonb_build_object('commande_id', v_c.id), 'commande_' || p_vers || ':' || v_c.id::text);
end;
$$;
revoke all on function public.avancer_statut(jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.avancer_statut(jsonb, text, text, text) to service_role;

-- 6. confirmer_mesures_recues : Commande verrouillee avant la ligne (meme ordre que annuler_commande), Commande « payee » seulement (une Commande en
--    fabrication a deja toutes ses mesures), ligne non annulee.
create or replace function public.confirmer_mesures_recues(p_auteur jsonb, p_ligne uuid)
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
  select * into v_l from public.ligne_commande where id = p_ligne;
  if not found then
    raise exception 'KS_LIGNE_INTROUVABLE' using errcode = 'P0001';
  end if;
  select * into v_c from public.commande where id = v_l.commande_id for update;
  select * into v_l from public.ligne_commande where id = p_ligne for update;
  select taille into v_taille from public.variante where id = v_l.variante_id;
  if v_taille is distinct from 'sur_mesure' then
    raise exception 'KS_PAS_SUR_MESURE' using errcode = 'P0001';
  end if;
  -- Seule une Commande payee et pas encore en fabrication attend des mesures ; une ligne annulee n'en attend plus.
  if v_c.statut <> 'payee' or v_l.annulee then
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

-- 7. annuler_commande : montant borne par le total paye, refus d'un montant nul, variantes verrouillees dans l'ordre des identifiants, stock rendu au plus
--    pour ce qui a ete reellement decompte au paiement (anomalie « stock_insuffisant » : pieces manquantes), demandes d'annulation ouvertes closes.
--    Limite connue : l'anomalie ne donne que le total des pieces manquantes de la Commande. Avec plusieurs variantes concernees, la part de chacune est
--    inconnue : aucun stock n'est alors rendu automatiquement (a corriger a la main dans l'admin) plutot que d'en inventer.
create or replace function public.annuler_commande(p_auteur jsonb, p_commande uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.commande;
  v_montant integer;
  v_nb_variantes integer;
  v_manque integer;
begin
  perform public.exiger_admin(p_auteur);
  select * into v_c from public.commande where id = p_commande for update;
  if not found then
    raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_c.statut <> 'payee' or v_c.offerte
     or not exists (select 1 from public.ligne_commande l join public.produit p on p.id = l.produit_id where l.commande_id = v_c.id and p.famille = 'cosplay') then
    raise exception 'KS_ANNULATION_IMPOSSIBLE' using errcode = 'P0001';
  end if;
  select coalesce(sum(l.prix_cents * l.nombre - l.reduction_cents), 0)::integer + v_c.forfait_cents into v_montant
    from public.ligne_commande l where l.commande_id = v_c.id and l.variante_id is not null;
  v_montant := least(greatest(v_montant, 0), v_c.total_cents);
  if v_montant <= 0 then
    raise exception 'KS_REMBOURSEMENT_NUL' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);

  perform 1 from public.variante
    where id in (select variante_id from public.ligne_commande where commande_id = v_c.id and variante_id is not null and origine = 'stock')
    order by id for update;
  select count(distinct l.variante_id)::integer into v_nb_variantes
    from public.ligne_commande l where l.commande_id = v_c.id and l.variante_id is not null and l.origine = 'stock';
  select coalesce(max((a.details ->> 'pieces_manquantes')::integer), 0) into v_manque
    from public.anomalie a where a.type = 'stock_insuffisant' and a.cible_type = 'commande' and a.cible_id = v_c.id;
  if v_manque = 0 then
    update public.variante v set stock = v.stock + s.total
      from (select l.variante_id, sum(l.nombre)::integer as total from public.ligne_commande l
            where l.commande_id = v_c.id and l.variante_id is not null and l.origine = 'stock' group by l.variante_id) s
      where v.id = s.variante_id;
  elsif v_nb_variantes = 1 then
    update public.variante v set stock = v.stock + greatest(s.total - v_manque, 0)
      from (select l.variante_id, sum(l.nombre)::integer as total from public.ligne_commande l
            where l.commande_id = v_c.id and l.variante_id is not null and l.origine = 'stock' group by l.variante_id) s
      where v.id = s.variante_id;
  end if;

  update public.ligne_commande set annulee = true where commande_id = v_c.id and variante_id is not null;
  update public.commande set statut = 'annulee', mis_a_jour_le = now() where id = v_c.id;
  update public.demande_client set statut = 'acceptee', traitee_le = now()
    where commande_id = v_c.id and type = 'annulation_commande' and statut = 'ouverte';
  insert into public.remboursement (cible_type, cible_id, montant_cents, devise) values ('commande', v_c.id, v_montant, v_c.devise);
  perform public.envois_planifier('commande_annulee', v_c.compte_id, jsonb_build_object('commande_id', v_c.id), 'commande_annulee:' || v_c.id::text);
  return v_montant;
end;
$$;
revoke all on function public.annuler_commande(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.annuler_commande(jsonb, uuid) to service_role;

-- 8. confirmer_remboursement : montant du Trop-percu en bigint, montant nul refuse (aucun email « 0 $ »).
create or replace function public.confirmer_remboursement(p_auteur jsonb, p_cible_type text, p_cible_id uuid, p_preuve text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_preuve text := btrim(coalesce(p_preuve, ''));
  v_c public.commande;
  v_t public.trop_percu;
  v_cents bigint;
begin
  perform public.exiger_admin(p_auteur);
  if char_length(v_preuve) not between 3 and 200 then
    raise exception 'KS_PREUVE_REQUISE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  if p_cible_type = 'commande' then
    select * into v_c from public.commande where id = p_cible_id for update;
    if not found then
      raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
    end if;
    if v_c.statut <> 'annulee' then
      raise exception 'KS_REMBOURSEMENT_IMPOSSIBLE' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.remboursement where cible_type = 'commande' and cible_id = v_c.id and valide_le is null and montant_cents <= 0) then
      raise exception 'KS_REMBOURSEMENT_NUL' using errcode = 'P0001';
    end if;
    update public.remboursement set preuve_reference = v_preuve, valide_par = p_auteur, valide_le = now()
      where cible_type = 'commande' and cible_id = v_c.id and valide_le is null;
    if not found then
      raise exception 'KS_REMBOURSEMENT_IMPOSSIBLE' using errcode = 'P0001';
    end if;
    update public.commande set statut = 'remboursee', mis_a_jour_le = now() where id = v_c.id;
    update public.demande_client set statut = 'close', traitee_le = coalesce(traitee_le, now())
      where commande_id = v_c.id and type = 'annulation_commande' and statut = 'acceptee';
    perform public.envois_planifier('commande_remboursee', v_c.compte_id, jsonb_build_object('commande_id', v_c.id), 'commande_remboursee:' || v_c.id::text);
  elsif p_cible_type = 'trop_percu' then
    select * into v_t from public.trop_percu where id = p_cible_id for update;
    if not found then
      raise exception 'KS_TROP_PERCU_INTROUVABLE' using errcode = 'P0001';
    end if;
    if v_t.statut <> 'a_rembourser' then
      raise exception 'KS_REMBOURSEMENT_IMPOSSIBLE' using errcode = 'P0001';
    end if;
    -- Montant rendu : le montant recu, tel que le Prestataire l'a renvoye, en centimes de sa devise.
    v_cents := round(v_t.montant_recu * 100)::bigint;
    if v_cents <= 0 then
      raise exception 'KS_REMBOURSEMENT_NUL' using errcode = 'P0001';
    end if;
    insert into public.remboursement (cible_type, cible_id, montant_cents, devise, preuve_reference, valide_par, valide_le)
      values ('trop_percu', v_t.id, v_cents, v_t.devise_recue, v_preuve, p_auteur, now());
    update public.trop_percu set statut = 'rembourse', clos_le = now() where id = v_t.id;
  else
    raise exception 'KS_REMBOURSEMENT_IMPOSSIBLE' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.confirmer_remboursement(jsonb, text, uuid, text) from public, anon, authenticated;
grant execute on function public.confirmer_remboursement(jsonb, text, uuid, text) to service_role;
