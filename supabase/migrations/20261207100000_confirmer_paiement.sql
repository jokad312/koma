-- Story 4.8 : socle de confirmation du paiement (AD-4, AD-5, AD-10 ; règles 2 et 3 de CLAUDE.md).
--   confirmer_paiement          : la SEULE porte vers « payee ». Appelée par le serveur après une confirmation fiable (notification vérifiée ou
--                                 contre-vérification de l'API du Prestataire), avec le résultat de la comparaison de montant fait par l'adaptateur.
--   enregistrer_notification    : une même notification n'est traitée qu'une fois (unique par Prestataire et identifiant).
--   tentatives_a_reconcilier    : lot borné de Tentatives à interroger (tâche reconcilier-tentatives).
--   abandonner_tentatives_perimees : une Tentative en cours dont la Commande est expirée ou annulée passe « abandonnee ».
-- Accès : service_role seulement. Aucun paiement n'est simulé ici : les tests posent des données TEST_ dans une transaction annulée.

alter type public.anomalie_type add value if not exists 'montant_indetermine';

-- Rejeu et concurrence : la Tentative puis la Commande sont verrouillées. Résultat : payee | montant_insuffisant | trop_percu | deja_traite.
--   p_comparaison : résultat de comparerMontant (adaptateur, selon la documentation du Prestataire) : egal | inferieur | superieur.
create function public.confirmer_paiement(p_auteur jsonb, p_tentative uuid, p_comparaison text, p_montant_recu numeric, p_devise_recue text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t record;
  v_c record;
  v_motif text;
  v_physique boolean;
  v_ligne record;
  v_nouveaux integer := 0;
begin
  if p_comparaison is null or p_comparaison not in ('egal', 'inferieur', 'superieur') then
    raise exception 'KS_COMPARAISON_INVALIDE' using errcode = 'P0001';
  end if;
  if p_montant_recu is null or p_montant_recu < 0 or p_devise_recue is null or p_devise_recue !~ '^[A-Z]{3}$' then
    raise exception 'KS_MONTANT_INVALIDE' using errcode = 'P0001';
  end if;
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' or p_auteur ->> 'type' not in ('systeme', 'cron') then
    raise exception 'KS_AUTEUR_INVALIDE' using errcode = 'P0001';
  end if;

  select * into v_t from public.tentative_paiement where id = p_tentative for update;
  if not found then
    raise exception 'KS_TENTATIVE_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Rejeu : une Tentative déjà réussie ou échouée n'a plus aucun effet.
  if v_t.statut in ('reussie', 'echouee') then
    return jsonb_build_object('resultat', 'deja_traite');
  end if;

  select * into v_c from public.commande where id = v_t.commande_id for update;
  perform set_config('ks.auteur', p_auteur::text, true);

  update public.tentative_paiement
    set statut = 'reussie', cause = null, montant_recu = p_montant_recu, devise_recue = p_devise_recue, modifie_le = now()
  where id = v_t.id;

  -- Commande qui ne peut plus être honorée (déjà payée, expirée, annulée, réservations libérées) : trop-perçu, quel que soit le montant.
  if v_c.statut not in ('en_attente', 'echouee') or v_c.expire_le is null or v_c.expire_le <= now() then
    v_motif := case
      when v_c.statut in ('payee', 'en_fabrication', 'expediee', 'livree') then 'deja_payee'
      when v_c.statut = 'expiree' then 'expiree'
      when v_c.statut in ('annulee', 'remboursee') then 'annulee'
      else 'reservations_liberees'
    end;
    insert into public.trop_percu (commande_id, tentative_id, motif, montant_attendu_cents, montant_recu, devise_recue)
    values (v_c.id, v_t.id, v_motif, v_t.montant_attendu_cents, p_montant_recu, p_devise_recue)
    on conflict (tentative_id) do nothing;
    return jsonb_build_object('resultat', 'trop_percu', 'motif', v_motif);
  end if;

  if p_comparaison = 'inferieur' then
    insert into public.anomalie (type, gravite, cible_type, cible_id, details)
    values ('montant_insuffisant', 'critique', 'tentative', v_t.id,
      jsonb_build_object('montant_attendu_cents', v_t.montant_attendu_cents, 'montant_recu', p_montant_recu, 'devise_recue', p_devise_recue, 'commande_id', v_c.id))
    on conflict do nothing;
    return jsonb_build_object('resultat', 'montant_insuffisant');
  end if;

  if p_comparaison = 'superieur' then
    insert into public.trop_percu (commande_id, tentative_id, motif, montant_attendu_cents, montant_recu, devise_recue)
    values (v_c.id, v_t.id, 'montant_superieur', v_t.montant_attendu_cents, p_montant_recu, p_devise_recue)
    on conflict (tentative_id) do nothing;
    return jsonb_build_object('resultat', 'trop_percu', 'motif', 'montant_superieur');
  end if;

  -- Montant égal, Commande honorable (réservations actives) : stock, Plafond et Code promo ne sont pas revérifiés (AD-26, AD-29).
  select exists (select 1 from public.ligne_commande where commande_id = v_c.id and variante_id is not null) into v_physique;

  update public.commande
    set statut = 'payee', prestataire = v_t.prestataire, reference_transaction = v_t.reference_transaction, paye_le = now(), mis_a_jour_le = now()
  where id = v_c.id;

  -- Stock des lignes d'origine « stock » ; les lignes « fabrication » n'y touchent jamais.
  update public.variante v
    set stock = v.stock - s.total
  from (
    select variante_id, sum(nombre)::integer as total
    from public.ligne_commande
    where commande_id = v_c.id and origine = 'stock'
    group by variante_id
  ) s
  where v.id = s.variante_id;

  update public.reservation set liberee_le = now() where commande_id = v_c.id and liberee_le is null;

  -- Kits : accès ouvert aussitôt (AD-11). Un Kit déjà possédé ne bloque pas le paiement : anomalie.
  for v_ligne in
    select l.produit_id from public.ligne_commande l join public.produit p on p.id = l.produit_id
    where l.commande_id = v_c.id and p.famille = 'kit'
  loop
    if public.bibliotheque_ouvrir_acces(v_c.compte_id, v_ligne.produit_id, v_c.id) then
      v_nouveaux := v_nouveaux + 1;
      perform public.envois_planifier('kit_ouvert', v_c.compte_id, jsonb_build_object('commande_id', v_c.id, 'produit_id', v_ligne.produit_id),
        'kit_ouvert:' || v_c.id::text || ':' || v_ligne.produit_id::text);
    else
      insert into public.anomalie (type, gravite, cible_type, cible_id, details)
      values ('kit_deja_possede', 'attention', 'commande', v_c.id, jsonb_build_object('produit_id', v_ligne.produit_id))
      on conflict do nothing;
    end if;
  end loop;

  if v_physique then
    perform public.envois_planifier('commande_payee', v_c.compte_id, jsonb_build_object('commande_id', v_c.id), 'commande_payee:' || v_c.id::text);
  else
    -- Commande 100 % numérique : payee puis livree dans la même transaction (deux lignes de journal).
    update public.commande set statut = 'livree', mis_a_jour_le = now() where id = v_c.id and statut = 'payee';
  end if;

  -- Le Panier du Compte n'est vidé que par une Commande payée.
  delete from public.ligne_panier where panier_id in (select id from public.panier where compte_id = v_c.compte_id);

  return jsonb_build_object('resultat', 'payee', 'kits_ouverts', v_nouveaux);
end;
$$;

-- Notification reçue : vrai la première fois, faux si elle a déjà été vue (rejeu). Aucun contenu brut n'est conservé.
create function public.enregistrer_notification(p_prestataire text, p_id_notification text, p_tentative uuid, p_signature_valide boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  insert into public.notification_recue (prestataire, id_notification, tentative_id, signature_valide)
  values (p_prestataire, p_id_notification, p_tentative, p_signature_valide)
  on conflict (prestataire, id_notification) do nothing;
  get diagnostics v_n = row_count;
  return v_n = 1;
end;
$$;

-- Tentative retrouvée par la référence que nous avons générée (la notification d'un Prestataire la renvoie). Null si inconnue.
create function public.tentative_par_reference_interne(p_reference text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(r) from (
    select id, prestataire, statut, reference_interne, reference_transaction
    from public.tentative_paiement where reference_interne = p_reference
  ) r
$$;

-- Lot borné de Tentatives à interroger : en cours, ou abandonnées depuis moins de 72 h (succès tardif), les plus anciennement vérifiées d'abord.
create function public.tentatives_a_reconcilier(p_limite integer, p_delai_secondes integer)
returns table (id uuid, prestataire text, statut text, reference_interne text, reference_transaction text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.prestataire, t.statut, t.reference_interne, t.reference_transaction
  from public.tentative_paiement t
  where (t.statut = 'en_cours' or (t.statut = 'abandonnee' and t.modifie_le > now() - interval '72 hours'))
    and t.cree_le > now() - interval '72 hours'
    and t.modifie_le <= now() - make_interval(secs => greatest(p_delai_secondes, 0))
  order by t.modifie_le asc
  limit least(greatest(p_limite, 1), 100)
$$;

-- Marque une Tentative comme vérifiée à l'instant sans changer son état (elle ne sera pas réinterrogée avant le délai).
create function public.toucher_tentative(p_tentative uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.tentative_paiement set modifie_le = now() where id = p_tentative and statut in ('en_cours', 'abandonnee');
$$;

-- Une Tentative en cours dont la Commande est expirée ou annulée passe « abandonnee » (elle reste réconciliée 72 h). Renvoie le nombre.
create function public.abandonner_tentatives_perimees()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  perform set_config('ks.auteur', '{"type":"cron","nom":"reconcilier_tentatives"}', true);
  update public.tentative_paiement t
    set statut = 'abandonnee', modifie_le = now()
  from public.commande c
  where c.id = t.commande_id and t.statut = 'en_cours' and c.statut in ('expiree', 'annulee');
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Signalement d'une comparaison de montant impossible à trancher (documentation silencieuse) : l'admin le voit, rien n'est validé.
create function public.signaler_montant_indetermine(p_tentative uuid, p_montant_recu numeric, p_devise_recue text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande uuid;
begin
  select commande_id into v_commande from public.tentative_paiement where id = p_tentative;
  if not found then
    raise exception 'KS_TENTATIVE_INTROUVABLE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', '{"type":"systeme","nom":"paiement"}', true);
  insert into public.anomalie (type, gravite, cible_type, cible_id, details)
  values ('montant_indetermine', 'critique', 'tentative', p_tentative,
    jsonb_build_object('commande_id', v_commande, 'montant_recu', p_montant_recu, 'devise_recue', p_devise_recue))
  on conflict do nothing;
end;
$$;

revoke all on function public.confirmer_paiement(jsonb, uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.enregistrer_notification(text, text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.tentative_par_reference_interne(text) from public, anon, authenticated;
revoke all on function public.tentatives_a_reconcilier(integer, integer) from public, anon, authenticated;
revoke all on function public.toucher_tentative(uuid) from public, anon, authenticated;
revoke all on function public.abandonner_tentatives_perimees() from public, anon, authenticated;
revoke all on function public.signaler_montant_indetermine(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.confirmer_paiement(jsonb, uuid, text, numeric, text) to service_role;
grant execute on function public.enregistrer_notification(text, text, uuid, boolean) to service_role;
grant execute on function public.tentative_par_reference_interne(text) to service_role;
grant execute on function public.tentatives_a_reconcilier(integer, integer) to service_role;
grant execute on function public.toucher_tentative(uuid) to service_role;
grant execute on function public.abandonner_tentatives_perimees() to service_role;
grant execute on function public.signaler_montant_indetermine(uuid, numeric, text) to service_role;

-- Déclenchement de /api/cron/reconcilier-tentatives chaque minute, comme les envois (secrets Vault site_url et cron_secret ; sans eux, rien n'est envoyé).
create function public.reconcilier_declencher()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'site_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret';
  if v_url is null or v_secret is null then
    raise notice 'reconcilier_declencher : secrets Vault site_url / cron_secret absents, rien envoyé';
    return false;
  end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/api/cron/reconcilier-tentatives',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  return true;
exception when others then
  raise notice 'reconcilier_declencher : appel impossible (%)', sqlstate;
  return false;
end;
$$;
revoke all on function public.reconcilier_declencher() from public, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('reconcilier-tentatives', '* * * * *', 'select public.reconcilier_declencher()');
  else
    raise notice 'pg_cron indisponible : tâche reconcilier-tentatives non planifiée';
  end if;
exception when others then
  raise notice 'planification reconcilier-tentatives impossible (%)', sqlstate;
end
$$;
