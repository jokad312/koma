-- Story 9.7 : mesure d'audience maison (FR-54, AD-19). Aucun outil externe, aucun cookie, aucune donnée personnelle.
-- Seuls sont gardés : un nom d'événement pris dans une liste fermée, le chemin sans paramètres, l'origine normalisée,
-- le référent réduit à son domaine, la langue, le type d'appareil, l'heure et un identifiant de session aléatoire.
-- Ni IP, ni email, ni identifiant de Compte, ni numéro de Commande, ni chaîne de requête : la route serveur ne peut pas
-- les écrire, et les contraintes ci-dessous refusent tout ce qui sort de ce cadre.
-- Les migrations précédentes ne sont pas modifiées.

create table public.evenement_mesure (
  id bigint generated always as identity primary key,
  -- Liste fermée : une valeur inconnue est refusée par la base comme par Zod.
  action text not null check (action in (
    'clic_heros',
    'chargement_heros',
    'vue_fiche',
    'ajout_panier',
    'partage_fiche',
    'kit_gratuit_recupere',
    'photo_envoyee',
    'realisation_envoyee',
    'video_kit_demarree',
    'video_kit_terminee'
  )),
  -- Chemin seul : jamais de « ? », de « # », d'espace ni de caractère de contrôle (donc jamais de jeton ni de numéro).
  page text not null check (
    char_length(page) between 1 and 200
    and left(page, 1) = '/'
    and page !~ '[[:space:][:cntrl:]]'
    and strpos(page, '?') = 0
    and strpos(page, '#') = 0
    and left(page, 2) <> '//'
  ),
  -- Origine : valeur d'un paramètre « origine » ou « utm_source », jamais l'adresse. Même forme que commande.origine.
  origine text check (origine is null or origine ~ '^[a-z0-9_-]{1,40}$'),
  -- Référent : domaine seul, sans chemin ni requête.
  referent_domaine text check (referent_domaine is null or referent_domaine ~ '^[a-z0-9.-]{1,100}$'),
  langue text not null check (langue in ('fr', 'en')),
  appareil text not null check (appareil in ('mobile', 'tablette', 'ordinateur', 'inconnu')),
  session_id uuid not null,
  cree_le timestamptz not null default now(),
  -- Durée de chargement du héros seulement, en millisecondes (FR-54) ; absente pour toutes les autres actions.
  duree_ms integer check (duree_ms is null or (action = 'chargement_heros' and duree_ms between 0 and 60000)),
  -- Dérogation limitée à l'espace privé (décision de Jonathan du 2026-11-10) : ces quatre actions viennent toujours de
  -- /compte et n'enregistrent jamais le sous-chemin ; la page « /compte » n'accepte qu'elles (et le Kit gratuit, qui
  -- peut aussi venir d'une fiche publique).
  constraint evenement_mesure_compte check (case
    when action in ('photo_envoyee', 'realisation_envoyee', 'video_kit_demarree', 'video_kit_terminee') then page = '/compte'
    when page = '/compte' then action = 'kit_gratuit_recupere'
    else true
  end)
);

-- Agrégats par jour et par action : deux index suffisent (aucune lecture publique, aucune recherche par session).
create index evenement_mesure_cree_le on public.evenement_mesure (cree_le);
create index evenement_mesure_action_cree_le on public.evenement_mesure (action, cree_le);

alter table public.evenement_mesure enable row level security;
-- Aucune politique et aucun droit : seul le serveur écrit, par la fonction ci-dessous.
revoke all on public.evenement_mesure from public, anon, authenticated;

-- Enregistre un événement de mesure. Auteur : un visiteur (type « visiteur »), jamais un Compte. Tout est revalidé en base
-- (la base a le dernier mot) : la route ne peut pas contourner les contraintes en appelant la fonction autrement.
-- Pas de déclencheur de journal : ce n'est pas une table métier (aucun état, aucun droit admin, aucune donnée personnelle)
-- et journaliser chaque vue de page noierait journal_audit. Divergence assumée avec AD-21, actée au plan de la story.
create function public.enregistrer_evenement_mesure(
  p_auteur jsonb,
  p_action text,
  p_page text,
  p_origine text,
  p_referent text,
  p_langue text,
  p_appareil text,
  p_session uuid,
  p_duree_ms integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  if (p_auteur ->> 'type') is distinct from 'visiteur' then
    raise exception 'KS_AUTEUR_INVALIDE' using errcode = 'P0001';
  end if;
  if p_action is null or p_action not in (
    'clic_heros', 'chargement_heros', 'vue_fiche', 'ajout_panier', 'partage_fiche', 'kit_gratuit_recupere',
    'photo_envoyee', 'realisation_envoyee', 'video_kit_demarree', 'video_kit_terminee'
  ) then
    raise exception 'KS_MESURE_ACTION_INVALIDE' using errcode = 'P0001';
  end if;
  if p_page is null
     or char_length(p_page) not between 1 and 200
     or left(p_page, 1) <> '/'
     or left(p_page, 2) = '//'
     or p_page ~ '[[:space:][:cntrl:]]'
     or strpos(p_page, '?') > 0
     or strpos(p_page, '#') > 0 then
    raise exception 'KS_MESURE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_action in ('photo_envoyee', 'realisation_envoyee', 'video_kit_demarree', 'video_kit_terminee')
     and p_page <> '/compte' then
    raise exception 'KS_MESURE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_page = '/compte'
     and p_action not in ('photo_envoyee', 'realisation_envoyee', 'video_kit_demarree', 'video_kit_terminee', 'kit_gratuit_recupere') then
    raise exception 'KS_MESURE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_origine is not null and p_origine !~ '^[a-z0-9_-]{1,40}$' then
    raise exception 'KS_MESURE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_referent is not null and (char_length(p_referent) > 100 or p_referent !~ '^[a-z0-9.-]{1,100}$') then
    raise exception 'KS_MESURE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_langue is null or p_langue not in ('fr', 'en') then
    raise exception 'KS_MESURE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_appareil is null or p_appareil not in ('mobile', 'tablette', 'ordinateur', 'inconnu') then
    raise exception 'KS_MESURE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_session is null then
    raise exception 'KS_MESURE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_duree_ms is not null and (p_action <> 'chargement_heros' or p_duree_ms < 0 or p_duree_ms > 60000) then
    raise exception 'KS_MESURE_INVALIDE' using errcode = 'P0001';
  end if;

  -- Aucun déclencheur ne lit cet auteur : il est posé pour rester dans le même modèle d'écriture que les autres fonctions.
  perform set_config('ks.auteur', p_auteur::text, true);
  insert into public.evenement_mesure (action, page, origine, referent_domaine, langue, appareil, session_id, duree_ms)
  values (p_action, p_page, p_origine, p_referent, p_langue, p_appareil, p_session, p_duree_ms);
end;
$$;

revoke all on function public.enregistrer_evenement_mesure(jsonb, text, text, text, text, text, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.enregistrer_evenement_mesure(jsonb, text, text, text, text, text, text, uuid, integer)
  to service_role;

-- Indicateurs. Toutes les vues sont des agrégats, jamais une ligne nominative, et lisent les tables métier :
-- les ventes, paiements, livraisons et Codes promo ne se calculent jamais à partir des clics (AD-19, story 9.7).

-- Visites mesurées : jour x action x langue x appareil, en événements et en sessions distinctes.
create view public.vue_visites_jour with (security_invoker = true) as
  select
    date_trunc('day', m.cree_le)::date as jour,
    m.action,
    m.langue,
    m.appareil,
    count(*)::integer as evenements,
    count(distinct m.session_id)::integer as sessions
  from public.evenement_mesure m
  group by 1, 2, 3, 4;

-- D'où viennent les visiteurs : jour x origine (nulle = accès direct), en sessions distinctes.
create view public.vue_origines_jour with (security_invoker = true) as
  select
    date_trunc('day', m.cree_le)::date as jour,
    m.origine,
    count(distinct m.session_id)::integer as sessions,
    count(*)::integer as evenements
  from public.evenement_mesure m
  group by 1, 2;

-- Entonnoir vue de fiche -> Panier -> Commande -> payée -> livrée : comptes agrégés par jour et par étape.
-- Aucune jointure entre une session et une Commande : la ligne « fiche » et « panier » compte des sessions,
-- les lignes suivantes comptent des Commandes (AD-19).
create view public.vue_entonnoir_jour with (security_invoker = true) as
  with mesures as (
    select
      date_trunc('day', m.cree_le)::date as jour,
      case m.action when 'vue_fiche' then 'fiche' else 'panier' end as etape,
      count(distinct m.session_id)::integer as sessions,
      null::integer as commandes
    from public.evenement_mesure m
    where m.action in ('vue_fiche', 'ajout_panier')
    group by 1, 2
  ), commandes as (
    select date_trunc('day', c.cree_le)::date as jour, 'commande'::text as etape, null::integer as sessions, count(*)::integer as commandes
    from public.commande c
    group by 1, 2
    union all
    select date_trunc('day', c.paye_le)::date, 'payee', null, count(*)::integer
    from public.commande c
    where c.paye_le is not null
    group by 1, 2
    union all
    select date_trunc('day', c.livree_le)::date, 'livree', null, count(*)::integer
    from public.commande c
    where c.livree_le is not null
    group by 1, 2
  )
  select * from mesures
  union all
  select * from commandes;

-- Paiements réussis ou échoués, par Prestataire et par moyen.
create view public.vue_paiements_jour with (security_invoker = true) as
  select
    date_trunc('day', t.cree_le)::date as jour,
    t.prestataire,
    t.moyen,
    t.statut,
    count(*)::integer as tentatives
  from public.tentative_paiement t
  group by 1, 2, 3, 4;

-- Ventes par Code promo. Même règle que commission_code_promo (story 9.3) : seules les Commandes ayant un paye_le comptent,
-- pour que les deux vues ne se contredisent jamais.
create view public.vue_ventes_code_promo with (security_invoker = true) as
  select
    ccp.code,
    count(*) filter (where c.paye_le is not null)::integer as commandes_payees,
    coalesce(sum(ccp.reduction_cents) filter (where c.paye_le is not null), 0)::bigint as reduction_cents,
    coalesce(sum(c.total_cents) filter (where c.paye_le is not null), 0)::bigint as montant_paye_cents
  from public.commande_code_promo ccp
  join public.commande c on c.id = ccp.commande_id
  group by ccp.code;

-- Ventes par origine de la visite (valeur figée dans commande.origine à la création).
create view public.vue_ventes_origine with (security_invoker = true) as
  select
    date_trunc('day', c.paye_le)::date as jour,
    c.origine,
    count(*)::integer as commandes_payees,
    coalesce(sum(c.total_cents), 0)::bigint as montant_paye_cents
  from public.commande c
  where c.paye_le is not null
  group by 1, 2;

-- Deuxièmes achats d'un même Compte (une Commande offerte n'a pas de paye_le : elle ne compte pas).
create view public.vue_deuxiemes_achats with (security_invoker = true) as
  select
    c.compte_id,
    count(*)::integer as commandes_payees,
    min(c.paye_le) as premier_achat_le,
    max(c.paye_le) as dernier_achat_le
  from public.commande c
  where c.paye_le is not null
  group by c.compte_id
  having count(*) >= 2;

-- Désinscriptions des Relances, par jour.
create view public.vue_desinscriptions_jour with (security_invoker = true) as
  select
    date_trunc('day', d.cree_le)::date as jour,
    count(*)::integer as desinscriptions
  from public.desinscription d
  group by 1;

-- Lecture par le serveur seulement (story 9.8 pour l'écran qui les consomme).
revoke all on public.vue_visites_jour from public, anon, authenticated;
revoke all on public.vue_origines_jour from public, anon, authenticated;
revoke all on public.vue_entonnoir_jour from public, anon, authenticated;
revoke all on public.vue_paiements_jour from public, anon, authenticated;
revoke all on public.vue_ventes_code_promo from public, anon, authenticated;
revoke all on public.vue_ventes_origine from public, anon, authenticated;
revoke all on public.vue_deuxiemes_achats from public, anon, authenticated;
revoke all on public.vue_desinscriptions_jour from public, anon, authenticated;

grant select on public.vue_visites_jour to service_role;
grant select on public.vue_origines_jour to service_role;
grant select on public.vue_entonnoir_jour to service_role;
grant select on public.vue_paiements_jour to service_role;
grant select on public.vue_ventes_code_promo to service_role;
grant select on public.vue_ventes_origine to service_role;
grant select on public.vue_deuxiemes_achats to service_role;
grant select on public.vue_desinscriptions_jour to service_role;
