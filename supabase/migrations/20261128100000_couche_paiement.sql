-- Story 4.5 : couche de paiement. Tables prestataire, tentative_paiement, notification_recue, trop_percu (module paiement), valeurs d'anomalie,
-- fonctions d'administration des Prestataires (activer / désactiver, Ordre de priorité) et lecture des Familles d'une Commande par le serveur.
-- Aucune politique de lecture : tout passe par le serveur (service_role). AD-4, AD-5, AD-6, AD-28 ; règles 2, 10, 11 de CLAUDE.md.
-- Aucun paiement n'est initié ni confirmé ici : les adaptateurs viennent avec les stories 4.7 et 5.4 à 5.7.

-- Anomalies propres au paiement (la table et l'énumération datent de la story 4.4).
alter type public.anomalie_type add value if not exists 'montant_insuffisant';
alter type public.anomalie_type add value if not exists 'notification_invalide';
alter type public.anomalie_type add value if not exists 'transition_refusee';
alter type public.anomalie_type add value if not exists 'kit_deja_possede';

-- Prestataires. Le code est fixe ; les moyens que chacun propose sont fixes aussi (règle 10) : seul l'état « actif » et l'Ordre de priorité
-- des Agrégateurs se règlent dans l'admin. Tout démarre désactivé : un Prestataire ne s'active que lorsque son adaptateur existe.
create table public.prestataire (
  code text primary key check (code in ('pawapay', 'kpay', 'maishapay', 'polar')),
  nom text not null check (char_length(nom) between 1 and 40),
  type text not null check (type in ('agregateur', 'carte')),
  mobile_money boolean not null,
  carte boolean not null,
  actif boolean not null default false,
  -- Ordre de priorité des Agrégateurs (1 = interrogé en premier) ; vide pour le Prestataire carte seul.
  ordre integer check (ordre is null or ordre >= 1),
  modifie_le timestamptz not null default now(),
  constraint prestataire_type_ordre check ((type = 'agregateur') = (ordre is not null)),
  -- Contrôlée en fin d'instruction : un échange de rangs en une seule mise à jour est permis.
  constraint prestataire_ordre_unique unique (ordre) deferrable initially immediate
);

insert into public.prestataire (code, nom, type, mobile_money, carte, ordre) values
  ('pawapay', 'PawaPay', 'agregateur', true, false, 1),
  ('kpay', 'K-Pay', 'agregateur', true, true, 2),
  ('maishapay', 'MaishaPay', 'agregateur', true, false, 3),
  ('polar', 'Polar', 'carte', false, true, null);

alter table public.prestataire enable row level security;
revoke all on public.prestataire from public, anon, authenticated;

create trigger prestataire_journaliser
  after insert or update or delete on public.prestataire
  for each row execute function public.journaliser('code');

-- Tentatives de paiement (AD-4, AD-28). Un résultat d'adaptateur n'est jamais stocké comme statut : « inconnu » laisse la Tentative en cours.
create table public.tentative_paiement (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.commande (id) on delete restrict,
  prestataire text not null references public.prestataire (code),
  moyen text not null check (moyen in ('mobile_money', 'carte')),
  pays text check (pays is null or char_length(pays) = 2),
  operateur text check (operateur is null or char_length(operateur) between 1 and 40),
  -- Générée par nous, envoyée au Prestataire.
  reference_interne text not null unique check (char_length(reference_interne) between 8 and 80),
  -- Renvoyée par le Prestataire.
  reference_transaction text check (reference_transaction is null or char_length(reference_transaction) between 1 and 120),
  -- Montant attendu, en centimes d'USD, et montant réellement débité tel que l'agrégateur le renvoie (devise d'origine).
  montant_attendu_cents integer not null check (montant_attendu_cents > 0),
  montant_recu numeric(18, 4) check (montant_recu is null or montant_recu >= 0),
  devise_recue text check (devise_recue is null or devise_recue ~ '^[A-Z]{3}$'),
  statut text not null default 'en_cours' check (statut in ('en_cours', 'reussie', 'echouee', 'abandonnee')),
  cause text check (cause in ('client', 'prestataire')),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  -- La cause n'existe que pour une Tentative échouée, et toute Tentative échouée en a une.
  constraint tentative_cause_coherente check ((statut = 'echouee') = (cause is not null))
);

-- Au plus une Tentative en cours par Commande.
create unique index tentative_une_en_cours on public.tentative_paiement (commande_id) where statut = 'en_cours';
-- Une référence de transaction ne sert qu'une fois par Prestataire.
create unique index tentative_reference_transaction_unique on public.tentative_paiement (prestataire, reference_transaction) where reference_transaction is not null;
create index tentative_commande_idx on public.tentative_paiement (commande_id);

alter table public.tentative_paiement enable row level security;
revoke all on public.tentative_paiement from public, anon, authenticated;

-- Notifications reçues (AD-5) : une même notification n'est traitée qu'une fois. Aucun contenu brut n'est conservé (numéros de téléphone).
create table public.notification_recue (
  id uuid primary key default gen_random_uuid(),
  prestataire text not null references public.prestataire (code),
  id_notification text not null check (char_length(id_notification) between 1 and 200),
  tentative_id uuid references public.tentative_paiement (id) on delete set null,
  signature_valide boolean not null,
  recue_le timestamptz not null default now(),
  constraint notification_recue_unique unique (prestataire, id_notification)
);

alter table public.notification_recue enable row level security;
revoke all on public.notification_recue from public, anon, authenticated;

-- Trop-perçus (AD-4) : remboursés à la main depuis l'admin ; aucun remboursement automatique.
create table public.trop_percu (
  id uuid primary key default gen_random_uuid(),
  commande_id uuid not null references public.commande (id) on delete restrict,
  tentative_id uuid not null unique references public.tentative_paiement (id) on delete restrict,
  motif text not null check (motif in ('montant_superieur', 'deja_payee', 'expiree', 'annulee', 'reservations_liberees')),
  montant_attendu_cents integer not null check (montant_attendu_cents > 0),
  montant_recu numeric(18, 4) not null check (montant_recu >= 0),
  devise_recue text not null check (devise_recue ~ '^[A-Z]{3}$'),
  statut text not null default 'ouvert' check (statut in ('ouvert', 'honore', 'rembourse')),
  cree_le timestamptz not null default now(),
  clos_le timestamptz,
  constraint trop_percu_clos_coherent check ((statut = 'ouvert') = (clos_le is null))
);

create index trop_percu_commande_idx on public.trop_percu (commande_id);

alter table public.trop_percu enable row level security;
revoke all on public.trop_percu from public, anon, authenticated;

-- Active ou désactive un Prestataire (admin). Journalisé par le déclencheur.
create function public.definir_prestataire_actif(p_auteur jsonb, p_code text, p_actif boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_admin(p_auteur);
  if p_actif is null then
    raise exception 'KS_PRESTATAIRE_INVALIDE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.prestataire set actif = p_actif, modifie_le = now() where code = p_code;
  if not found then
    raise exception 'KS_PRESTATAIRE_INTROUVABLE' using errcode = 'P0001';
  end if;
end;
$$;

-- Monte ou descend un Agrégateur dans l'Ordre de priorité (admin) : échange son rang avec son voisin. Au bord de la liste : sans effet.
create function public.deplacer_prestataire(p_auteur jsonb, p_code text, p_sens text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ordre integer;
  v_voisin text;
  v_ordre_voisin integer;
begin
  perform public.exiger_admin(p_auteur);
  if p_sens not in ('monter', 'descendre') then
    raise exception 'KS_SENS_INVALIDE' using errcode = 'P0001';
  end if;
  select ordre into v_ordre from public.prestataire where code = p_code for update;
  if not found then
    raise exception 'KS_PRESTATAIRE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_ordre is null then
    raise exception 'KS_PRESTATAIRE_SANS_ORDRE' using errcode = 'P0001';
  end if;
  if p_sens = 'monter' then
    select code, ordre into v_voisin, v_ordre_voisin from public.prestataire where ordre < v_ordre order by ordre desc limit 1 for update;
  else
    select code, ordre into v_voisin, v_ordre_voisin from public.prestataire where ordre > v_ordre order by ordre asc limit 1 for update;
  end if;
  if v_voisin is null then
    return;
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.prestataire
    set ordre = case when code = p_code then v_ordre_voisin else v_ordre end, modifie_le = now()
  where code in (p_code, v_voisin);
end;
$$;

-- Familles des lignes d'une Commande, lues en base pour le Compte propriétaire (règle 11) : jamais ce que le navigateur annonce.
-- Null si la Commande n'est pas à ce Compte ou n'existe pas.
create function public.familles_commande(p_commande uuid, p_compte uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select case when c.id is null then null else coalesce((
    select array_agg(distinct p.famille order by p.famille)
    from public.ligne_commande l join public.produit p on p.id = l.produit_id
    where l.commande_id = c.id
  ), '{}'::text[]) end
  from (select id from public.commande where id = p_commande and compte_id = p_compte) c;
$$;

revoke all on function public.definir_prestataire_actif(jsonb, text, boolean) from public, anon, authenticated;
revoke all on function public.deplacer_prestataire(jsonb, text, text) from public, anon, authenticated;
revoke all on function public.familles_commande(uuid, uuid) from public, anon, authenticated;
grant execute on function public.definir_prestataire_actif(jsonb, text, boolean) to service_role;
grant execute on function public.deplacer_prestataire(jsonb, text, text) to service_role;
grant execute on function public.familles_commande(uuid, uuid) to service_role;
