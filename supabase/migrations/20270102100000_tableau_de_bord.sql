-- Story 9.8, partie 1 (décision de Jonathan du 2026-11-10) : agrégats du tableau de bord, lus par le serveur seulement.
-- La page (partie 2) ne lit que ces fonctions et les vues de la story 9.7 ; jamais une table de Commande ou de client directement.
-- Chiffre d'affaires et paiements : droits chiffre_affaires.voir et paiements.graphiques, réservés à l'Admin. Chaque fonction
-- revérifie ce droit en base (exiger_admin) et n'est exécutable que par service_role (jamais anon ni authenticated).
-- Aucune donnée de client : ni Compte, ni email, ni téléphone, ni adresse. Jour : date à Goma (Africa/Lubumbashi, UTC+2).
-- p_depuis : l'appelant passe minuit à Goma (par exemple il y a 7 ou 30 jours) pour que le premier jour soit complet ; null :
-- minuit à Goma aujourd'hui (Commandes payées) ou il y a 29 jours (les autres), soit 30 jours pleins.
-- Hors périmètre (décision du 2026-11-10) : SM-4, SM-C4 (Pass, epic 7), SM-C1 (aucun délai promis stocké), SM-C7 (voie 1).

-- Tri et filtre par date de paiement (toutes les fonctions ci-dessous).
create index commande_paye_le_idx on public.commande (paye_le) where paye_le is not null;
create index tentative_paiement_cree_le_idx on public.tentative_paiement (cree_le);

-- Minuit à Goma, il y a p_jours jours.
create function public.minuit_goma(p_jours integer)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (date_trunc('day', now() at time zone 'Africa/Lubumbashi') - make_interval(days => p_jours)) at time zone 'Africa/Lubumbashi'
$$;
revoke all on function public.minuit_goma(integer) from public, anon, authenticated;

-- Nouvelles Commandes payées depuis p_depuis, la plus récente d'abord (200 au plus) : numéro, montant, Prestataire, Familles.
-- Hors Commandes annulées et remboursées. Familles : celles des lignes non annulées (cosplay, accessoire, kit), « pass » pour un Pass.
-- total_cents : le total payé, forfait de livraison compris.
create function public.tableau_commandes_payees(p_auteur jsonb, p_depuis timestamptz)
returns table (numero text, total_cents integer, prestataire text, familles text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.exiger_admin(p_auteur);
  return query
    select
      c.numero,
      c.total_cents,
      c.prestataire,
      case when c.type = 'pass' then array['pass']::text[]
        else coalesce((
          select array_agg(distinct p.famille order by p.famille)
          from public.ligne_commande l
          join public.produit p on p.id = l.produit_id
          where l.commande_id = c.id and not l.annulee
        ), array[]::text[])
      end
    from public.commande c
    where c.paye_le is not null
      and c.paye_le >= coalesce(p_depuis, public.minuit_goma(0))
      and c.statut not in ('annulee', 'remboursee')
    order by c.paye_le desc, c.numero desc
    limit 200;
end;
$$;

-- Paiements vérifiés (Commandes payées, hors annulées et remboursées) depuis p_depuis, par jour, Prestataire et Famille.
-- montant_cents : somme des lignes non annulées de cette Famille (prix x nombre, moins la réduction, Code promo compris) ;
-- un Pass compte son total ; le forfait de livraison forme la Famille « livraison ». La somme des montants d'un jour égale donc
-- la somme des total_cents de ses Commandes.
-- commandes : nombre de Commandes ayant une ligne de cette Famille. Une Commande mixte compte dans chaque Famille : ne jamais
-- additionner cette colonne entre Familles.
create function public.tableau_paiements(p_auteur jsonb, p_depuis timestamptz)
returns table (jour date, prestataire text, famille text, commandes integer, montant_cents bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.exiger_admin(p_auteur);
  return query
    with payees as (
      select c.id, c.type, c.total_cents, c.forfait_cents, c.prestataire, (c.paye_le at time zone 'Africa/Lubumbashi')::date as jour
      from public.commande c
      where c.paye_le is not null
        and c.paye_le >= coalesce(p_depuis, public.minuit_goma(29))
        and c.statut not in ('annulee', 'remboursee')
    ), par_famille as (
      select y.jour, y.prestataire, p.famille, y.id, sum(l.prix_cents::bigint * l.nombre - l.reduction_cents) as montant
      from payees y
      join public.ligne_commande l on l.commande_id = y.id and not l.annulee
      join public.produit p on p.id = l.produit_id
      where y.type <> 'pass'
      group by y.jour, y.prestataire, p.famille, y.id
      union all
      select y.jour, y.prestataire, 'pass', y.id, y.total_cents::bigint
      from payees y
      where y.type = 'pass'
      union all
      select y.jour, y.prestataire, 'livraison', y.id, y.forfait_cents::bigint
      from payees y
      where y.type <> 'pass' and y.forfait_cents > 0
    )
    select f.jour, f.prestataire, f.famille, count(distinct f.id)::integer, sum(f.montant)::bigint
    from par_famille f
    group by f.jour, f.prestataire, f.famille
    order by f.jour, f.prestataire, f.famille;
end;
$$;

-- Taux d'échec par Agrégateur (SM-C2) : tentatives créées depuis p_depuis, par Prestataire et moyen, comptées par statut.
-- reussies : le Prestataire a confirmé le débit (la Commande peut ensuite rester non payée : montant insuffisant, trop-perçu).
-- Les échecs sont séparés selon leur cause : client (solde, code refusé) ou Prestataire. Le taux d'échec d'un Agrégateur se lit
-- sur echouees_prestataire / (reussies + echouees_client + echouees_prestataire + abandonnees) ; en_cours n'est pas terminé.
create function public.tableau_echecs_paiement(p_auteur jsonb, p_depuis timestamptz)
returns table (
  prestataire text, moyen text, tentatives integer, reussies integer, echouees_client integer, echouees_prestataire integer,
  abandonnees integer, en_cours integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.exiger_admin(p_auteur);
  return query
    select
      t.prestataire,
      t.moyen,
      count(*)::integer,
      (count(*) filter (where t.statut = 'reussie'))::integer,
      (count(*) filter (where t.statut = 'echouee' and t.cause = 'client'))::integer,
      (count(*) filter (where t.statut = 'echouee' and t.cause = 'prestataire'))::integer,
      (count(*) filter (where t.statut = 'abandonnee'))::integer,
      (count(*) filter (where t.statut = 'en_cours'))::integer
    from public.tentative_paiement t
    where t.cree_le >= coalesce(p_depuis, public.minuit_goma(29))
    group by t.prestataire, t.moyen
    order by t.prestataire, t.moyen;
end;
$$;

-- Délai de réception des mesures (SM-C3) : lignes Sur-mesure non annulées des Commandes payées depuis p_depuis (hors annulées et
-- remboursées). delai_moyen_heures : moyenne de (mesures reçues - paiement) sur les lignes reçues, null s'il n'y en a aucune.
create function public.tableau_delai_mesures(p_auteur jsonb, p_depuis timestamptz)
returns table (lignes_recues integer, lignes_en_attente integer, delai_moyen_heures numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.exiger_admin(p_auteur);
  return query
    select
      (count(*) filter (where l.mesures_recues_le is not null))::integer,
      (count(*) filter (where l.mesures_recues_le is null))::integer,
      round((avg(extract(epoch from (l.mesures_recues_le - c.paye_le))) filter (where l.mesures_recues_le is not null) / 3600)::numeric, 1)
    from public.ligne_commande l
    join public.variante v on v.id = l.variante_id and v.taille = 'sur_mesure'
    join public.commande c on c.id = l.commande_id
    where not l.annulee
      and c.paye_le is not null
      and c.paye_le >= coalesce(p_depuis, public.minuit_goma(29))
      and c.statut not in ('annulee', 'remboursee');
end;
$$;

-- Tâche « Trop-perçus » : trop-perçus à rembourser à la main (statut a_rembourser), par motif, avec le plus ancien. Aucun
-- montant reçu : il est en devise locale ; le détail se lit dans l'écran des Commandes.
create function public.tableau_trop_percus(p_auteur jsonb)
returns table (motif text, a_rembourser integer, plus_ancien_le timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.exiger_admin(p_auteur);
  return query
    select t.motif, count(*)::integer, min(t.cree_le)
    from public.trop_percu t
    where t.statut = 'a_rembourser'
    group by t.motif
    order by t.motif;
end;
$$;

revoke all on function public.tableau_commandes_payees(jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.tableau_paiements(jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.tableau_echecs_paiement(jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.tableau_delai_mesures(jsonb, timestamptz) from public, anon, authenticated;
revoke all on function public.tableau_trop_percus(jsonb) from public, anon, authenticated;
grant execute on function public.tableau_commandes_payees(jsonb, timestamptz) to service_role;
grant execute on function public.tableau_paiements(jsonb, timestamptz) to service_role;
grant execute on function public.tableau_echecs_paiement(jsonb, timestamptz) to service_role;
grant execute on function public.tableau_delai_mesures(jsonb, timestamptz) to service_role;
grant execute on function public.tableau_trop_percus(jsonb) to service_role;
