-- Story 7.3, correctifs de la revue (les migrations 20270104100000 et 20270104110000 sont déjà appliquées : elles ne sont pas modifiées).
-- 1. email_commercial_autorise : l'alerte « Me prévenir » est un message unique demandé par l'inscrit ; la règle « un Email commercial tous les
--    2 jours » ne s'applique plus au modèle alerte_evenement (consentement actif et non-désinscription restent vérifiés).
-- 2. inscrire_alerte_evenement : une inscription par email ou WhatsApp déjà désinscrite n'est jamais réactivée par un tiers (aucune preuve de
--    propriété de l'adresse) ; la réponse reste identique. Un Compte connecté (titulaire authentifié) peut se réinscrire.
-- 3. planifier_alertes_evenements : un seul email par événement et par adresse effective (adresse de l'inscription ou du Compte) ;
--    la seconde ligne est marquée traitée sans email.
-- 4. inscrire_alerte_evenement refuse aussi un événement dont la vente est fermée ou qui a déjà commencé (KS_ALERTE_INDISPONIBLE).

create or replace function public.email_commercial_autorise(p_envoi uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_e record;
  v_a public.alerte_evenement%rowtype;
  v_objet text;
  v_dernier_don timestamptz;
  c_commerciaux constant text[] := array['relance', 'panier_abandonne', 'rappel_kit', 'nouveau_produit', 'alerte_evenement'];
begin
  select id, modele::text as modele, compte_id, donnees into v_e from public.envoi where id = p_envoi;
  if not found then
    raise exception 'KS_ENVOI_INTROUVABLE' using errcode = 'P0001';
  end if;
  if not (v_e.modele = any (c_commerciaux)) then
    return jsonb_build_object('autorise', true, 'commercial', false);
  end if;

  if v_e.compte_id is null then
    select * into v_a from public.alerte_evenement where id = nullif(v_e.donnees ->> 'alerte_id', '')::uuid;
    if not found or v_a.canal <> 'email' then
      return jsonb_build_object('autorise', false, 'commercial', true, 'motif', 'sans_consentement');
    end if;
    if v_a.desinscrit_le is not null then
      return jsonb_build_object('autorise', false, 'commercial', true, 'motif', 'desinscription');
    end if;
    return jsonb_build_object('autorise', true, 'commercial', true);
  end if;

  v_objet := case v_e.modele when 'nouveau_produit' then 'nouveautes' when 'alerte_evenement' then 'alertes_festival' else 'relances' end;

  if not exists (select 1 from public.consentement where compte_id = v_e.compte_id and objet = v_objet and retire_le is null) then
    select max(donne_le) into v_dernier_don from public.consentement where compte_id = v_e.compte_id and objet = v_objet;
    if exists (select 1 from public.desinscription where compte_id = v_e.compte_id and cree_le >= coalesce(v_dernier_don, '-infinity'::timestamptz)) then
      return jsonb_build_object('autorise', false, 'commercial', true, 'motif', 'desinscription');
    end if;
    return jsonb_build_object('autorise', false, 'commercial', true, 'motif', 'sans_consentement');
  end if;
  if public.emails_commerciaux_bloques_mineur(v_e.compte_id) then
    return jsonb_build_object('autorise', false, 'commercial', true, 'motif', 'compte_mineur');
  end if;
  -- L'alerte « Me prévenir » échappe à l'écart de 2 jours : message unique demandé par l'inscrit, jamais ignoré à cause d'un autre email.
  if v_e.modele <> 'alerte_evenement' and exists (
    select 1 from public.envoi e
    where e.compte_id = v_e.compte_id and e.id <> v_e.id and e.statut = 'envoye'
      and e.modele::text = any (c_commerciaux) and e.envoye_le > now() - interval '2 days'
  ) then
    return jsonb_build_object('autorise', false, 'commercial', true, 'motif', 'ecart_2_jours');
  end if;
  return jsonb_build_object('autorise', true, 'commercial', true);
end;
$$;

create or replace function public.inscrire_alerte_evenement(p_auteur jsonb, p_evenement uuid, p_canal text, p_valeur text, p_langue text, p_version text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_compte uuid;
  v_valeur text;
  v_ev record;
  v_a public.alerte_evenement%rowtype;
  v_consentement_donne boolean := false;
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  v_type := p_auteur ->> 'type';
  if p_canal is null or p_canal not in ('email', 'compte', 'whatsapp') or p_evenement is null
     or p_langue is null or p_langue not in ('fr', 'en')
     or p_version is null or char_length(p_version) not between 1 and 50 then
    raise exception 'KS_ALERTE_INVALIDE' using errcode = 'P0001';
  end if;
  if (p_canal = 'compte' and v_type is distinct from 'compte') or (p_canal <> 'compte' and v_type is distinct from 'visiteur') then
    raise exception 'KS_AUTEUR_INVALIDE' using errcode = 'P0001';
  end if;

  if p_canal = 'compte' then
    v_compte := public.exiger_client(p_auteur);
  elsif p_canal = 'email' then
    v_valeur := lower(btrim(coalesce(p_valeur, '')));
    if char_length(v_valeur) not between 3 and 254 or v_valeur !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'KS_EMAIL_INVALIDE' using errcode = 'P0001';
    end if;
  else
    v_valeur := regexp_replace(coalesce(p_valeur, ''), '\s', '', 'g');
    if v_valeur !~ '^\+[0-9]{8,15}$' then
      raise exception 'KS_WHATSAPP_INVALIDE' using errcode = 'P0001';
    end if;
  end if;

  select e.id, e.publie_le, e.vente_ouvre_le, e.vente_ferme_le, e.debut_le into v_ev from public.evenement e where e.id = p_evenement;
  if not found or v_ev.publie_le is null or v_ev.publie_le > now()
     or (v_ev.vente_ferme_le is not null and v_ev.vente_ferme_le <= now())
     or (v_ev.debut_le is not null and v_ev.debut_le <= now()) then
    raise exception 'KS_ALERTE_INDISPONIBLE' using errcode = 'P0001';
  end if;
  if coalesce(v_ev.vente_ouvre_le, v_ev.publie_le) <= now() then
    raise exception 'KS_VENTE_OUVERTE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  perform pg_advisory_xact_lock(hashtextextended('alerte:' || p_evenement::text || ':' || p_canal || ':' || coalesce(v_valeur, v_compte::text), 0));

  if p_canal = 'compte' then
    perform pg_advisory_xact_lock(hashtextextended('consentement:' || v_compte::text, 0));
    if not exists (select 1 from public.consentement where compte_id = v_compte and objet = 'alertes_festival' and retire_le is null) then
      insert into public.consentement (compte_id, objet, version, source) values (v_compte, 'alertes_festival', p_version, 'alerte_evenement');
      v_consentement_donne := true;
    end if;
  end if;

  select * into v_a from public.alerte_evenement
  where evenement_id = p_evenement and canal = p_canal
    and ((p_canal = 'email' and email = v_valeur) or (p_canal = 'whatsapp' and whatsapp = v_valeur) or (p_canal = 'compte' and compte_id = v_compte))
  for update;
  if found then
    -- Une inscription par email ou WhatsApp désinscrite n'est jamais réactivée par une saisie anonyme (pas de preuve de propriété) ;
    -- la réponse reste identique. Un Compte connecté (titulaire authentifié) peut se réinscrire.
    if (v_a.desinscrit_le is not null and p_canal = 'compte') or v_consentement_donne then
      update public.alerte_evenement
      set desinscrit_le = null, consentement_version = p_version, consentement_le = now(), langue = p_langue
      where id = v_a.id;
    end if;
  else
    insert into public.alerte_evenement (evenement_id, canal, email, compte_id, whatsapp, langue, consentement_version)
    values (
      p_evenement, p_canal,
      case when p_canal = 'email' then v_valeur end,
      v_compte,
      case when p_canal = 'whatsapp' then v_valeur end,
      p_langue, p_version
    );
  end if;
  return true;
end;
$$;

create or replace function public.planifier_alertes_evenements()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer := 0;
  v_r record;
  v_adresse text;
begin
  perform set_config('ks.auteur', '{"type":"cron","nom":"planifier_alertes_evenements"}', true);
  for v_r in
    select a.id, a.canal, a.compte_id, a.evenement_id, a.langue, a.email
    from public.alerte_evenement a
    join public.evenement e on e.id = a.evenement_id
    where a.canal in ('email', 'compte')
      and a.envoye_le is null
      and a.desinscrit_le is null
      and e.publie_le is not null and e.publie_le <= now()
      and coalesce(e.vente_ouvre_le, e.publie_le) <= now()
      and (e.vente_ferme_le is null or e.vente_ferme_le > now())
      and (e.debut_le is null or e.debut_le > now())
      and (a.canal <> 'compte' or exists (
        select 1 from public.consentement c where c.compte_id = a.compte_id and c.objet = 'alertes_festival' and c.retire_le is null
      ))
    order by a.cree_le, a.id
    limit 500
    for update of a skip locked
  loop
    -- Adresse effective : celle de l'inscription, ou celle du Compte.
    v_adresse := case when v_r.canal = 'compte' then (select lower(u.email) from auth.users u where u.id = v_r.compte_id) else v_r.email end;
    -- Un seul email par événement et par adresse : si une autre ligne de cet événement a déjà été traitée pour la même adresse
    -- (Compte et email, ou lors de ce passage), cette ligne est marquée traitée sans email.
    if v_adresse is not null and exists (
      select 1 from public.alerte_evenement b
      left join auth.users bu on bu.id = b.compte_id
      where b.evenement_id = v_r.evenement_id and b.id <> v_r.id and b.envoye_le is not null and b.canal in ('email', 'compte')
        and lower(case when b.canal = 'compte' then bu.email else b.email end) = v_adresse
    ) then
      update public.alerte_evenement set envoye_le = now() where id = v_r.id;
      continue;
    end if;
    if v_r.canal = 'compte' then
      perform public.envois_planifier('alerte_evenement', v_r.compte_id, jsonb_build_object('alerte_id', v_r.id, 'evenement_id', v_r.evenement_id), 'alerte_evenement:' || v_r.id::text);
    else
      insert into public.envoi (modele, compte_id, langue, donnees, cle)
      values ('alerte_evenement', null, v_r.langue, jsonb_build_object('alerte_id', v_r.id, 'evenement_id', v_r.evenement_id), 'alerte_evenement:' || v_r.id::text)
      on conflict (cle) do nothing;
    end if;
    update public.alerte_evenement set envoye_le = now() where id = v_r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
