-- Stories 5.2 et 5.3 : cycle d'une Tentative de paiement (AD-4, AD-28) et état enrichi pour l'écran d'attente.
--   demarrer_tentative    : crée la Tentative « en_cours » d'une Commande à payer (propriétaire, Compte complet, Commande payable, Prestataire actif,
--                           moyen proposé par le Prestataire, couple pays-opérateur confirmé pour le mobile money).
--   enregistrer_initiation : pose la référence de transaction renvoyée par le Prestataire (une référence déjà utilisée est refusée).
--   echouer_tentative      : échec vérifié (cause client ou Prestataire) ; la Commande en attente passe « echouee » (repayable).
--   etat_paiement_commande : (remplace la version de la story 4.6) ajoute le montant, le Prestataire et le numéro MASQUÉ de la Tentative en cours,
--                           la dernière Tentative échouée et les Agrégateurs exclus pour le repli.
-- Aucun paiement n'est confirmé ici : confirmer_paiement vient avec les stories des adaptateurs. Accès : service_role seulement.

-- Le numéro de téléphone n'est jamais conservé en clair : seule sa forme masquée sert à l'écran d'attente (« +243•••••678 »).
alter table public.tentative_paiement
  add column telephone_masque text check (telephone_masque is null or char_length(telephone_masque) between 4 and 30);

create function public.demarrer_tentative(
  p_compte uuid, p_numero text, p_prestataire text, p_moyen text, p_pays text, p_operateur text, p_reference_interne text, p_telephone_masque text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande record;
  v_prestataire record;
  v_id uuid;
begin
  if not public.compte_complet(p_compte) then
    raise exception 'KS_COMPTE_INCOMPLET' using errcode = 'P0001';
  end if;
  select id, statut, total_cents, expire_le into v_commande
  from public.commande where numero = p_numero and compte_id = p_compte for update;
  if not found then
    raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_commande.statut not in ('en_attente', 'echouee') or v_commande.expire_le is null or v_commande.expire_le <= now() or v_commande.total_cents <= 0 then
    raise exception 'KS_COMMANDE_NON_PAYABLE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.tentative_paiement where commande_id = v_commande.id and statut = 'en_cours') then
    raise exception 'KS_TENTATIVE_EN_COURS' using errcode = 'P0001';
  end if;
  select * into v_prestataire from public.prestataire where code = p_prestataire and actif;
  if not found then
    raise exception 'KS_PRESTATAIRE_INACTIF' using errcode = 'P0001';
  end if;
  if p_moyen not in ('mobile_money', 'carte') or (p_moyen = 'mobile_money' and not v_prestataire.mobile_money) or (p_moyen = 'carte' and not v_prestataire.carte) then
    raise exception 'KS_MOYEN_INVALIDE' using errcode = 'P0001';
  end if;
  if p_moyen = 'mobile_money' and not exists (
    select 1 from public.couverture c
    where c.prestataire = p_prestataire and c.pays = p_pays and lower(c.operateur) = lower(coalesce(p_operateur, '')) and c.etat = 'confirme'
  ) then
    raise exception 'KS_COUVERTURE_ABSENTE' using errcode = 'P0001';
  end if;
  insert into public.tentative_paiement (commande_id, prestataire, moyen, pays, operateur, reference_interne, montant_attendu_cents, telephone_masque)
  values (
    v_commande.id, p_prestataire, p_moyen,
    case when p_moyen = 'mobile_money' then p_pays end, case when p_moyen = 'mobile_money' then p_operateur end,
    p_reference_interne, v_commande.total_cents, case when p_moyen = 'mobile_money' then p_telephone_masque end
  )
  returning id into v_id;
  return jsonb_build_object('tentative_id', v_id, 'montant_attendu_cents', v_commande.total_cents);
end;
$$;

create function public.enregistrer_initiation(p_tentative uuid, p_reference_transaction text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    update public.tentative_paiement set reference_transaction = p_reference_transaction, modifie_le = now()
    where id = p_tentative and statut = 'en_cours';
  exception when unique_violation then
    raise exception 'KS_REFERENCE_DEJA_UTILISEE' using errcode = 'P0001';
  end;
end;
$$;

-- Échec vérifié d'une Tentative. Sans effet (faux) si elle n'est plus en cours. Une Commande qui n'est plus en attente n'est pas modifiée.
create function public.echouer_tentative(p_tentative uuid, p_cause text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_commande uuid;
  v_statut text;
begin
  if p_cause not in ('client', 'prestataire') then
    raise exception 'KS_CAUSE_INVALIDE' using errcode = 'P0001';
  end if;
  select commande_id, statut into v_commande, v_statut from public.tentative_paiement where id = p_tentative for update;
  if not found or v_statut <> 'en_cours' then
    return false;
  end if;
  update public.tentative_paiement set statut = 'echouee', cause = p_cause, modifie_le = now() where id = p_tentative;
  update public.commande set statut = 'echouee', mis_a_jour_le = now() where id = v_commande and statut = 'en_attente';
  return true;
end;
$$;

create or replace function public.etat_paiement_commande(p_numero text, p_compte uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'statut', c.statut,
    'expire_le', c.expire_le,
    'total_cents', c.total_cents,
    'kit', exists (
      select 1 from public.ligne_commande l join public.produit p on p.id = l.produit_id where l.commande_id = c.id and p.famille = 'kit'
    ),
    'tentative_en_cours', (
      select jsonb_build_object(
        'moyen', t.moyen, 'age_secondes', floor(extract(epoch from now() - t.cree_le))::int,
        'prestataire', pr.nom, 'telephone_masque', t.telephone_masque
      )
      from public.tentative_paiement t join public.prestataire pr on pr.code = t.prestataire
      where t.commande_id = c.id and t.statut = 'en_cours'
    ),
    'derniere_echec', (
      select jsonb_build_object('cause', t.cause, 'prestataire', t.prestataire, 'moyen', t.moyen, 'pays', t.pays, 'operateur', t.operateur)
      from public.tentative_paiement t where t.commande_id = c.id and t.statut = 'echouee' order by t.modifie_le desc, t.cree_le desc limit 1
    ),
    -- Agrégateurs dont une Tentative de cette Commande a fini en échec côté Prestataire : exclus du repli (AD-6).
    'exclus', coalesce((
      select jsonb_agg(distinct t.prestataire) from public.tentative_paiement t
      where t.commande_id = c.id and t.statut = 'echouee' and t.cause = 'prestataire'
    ), '[]'::jsonb),
    -- Motif résumé pour le client : expirée, déjà payée, ou impossible à honorer (tout autre cas).
    'trop_percu', (
      select case when tp.motif = 'expiree' then 'expiree' when tp.motif = 'deja_payee' then 'deja_payee' else 'impossible' end
      from public.trop_percu tp where tp.commande_id = c.id order by tp.cree_le desc limit 1
    )
  )
  from public.commande c
  where c.numero = p_numero and c.compte_id = p_compte;
$$;

revoke all on function public.demarrer_tentative(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.enregistrer_initiation(uuid, text) from public, anon, authenticated;
revoke all on function public.echouer_tentative(uuid, text) from public, anon, authenticated;
grant execute on function public.demarrer_tentative(uuid, text, text, text, text, text, text, text) to service_role;
grant execute on function public.enregistrer_initiation(uuid, text) to service_role;
grant execute on function public.echouer_tentative(uuid, text) to service_role;
