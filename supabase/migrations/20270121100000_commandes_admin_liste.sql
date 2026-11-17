-- Story 9.16 d) : liste des Commandes de l'admin selon la maquette (lecture seule, Admin et Assistant : droit commandes.voir).
-- commandes_admin_liste(p_auteur, filtres, recherche, page, taille) rend, en une lecture :
--   - total : nombre de Commandes correspondant aux filtres et à la recherche ;
--   - commandes : la page demandée (plus récentes d'abord), avec, pour le client, son nom s'il en a un (métadonnées de connexion) et son email
--     PARTIELLEMENT MASQUÉ (masquage fait ici, comme lister_utilisateurs_admin : l'adresse complète ne quitte jamais la base) ;
--   - chiffres : cartes de la page, « depuis le début », sans le revenu (le revenu reste dans tableau_chiffres, réservé à l'Admin) :
--     commandes payées hors annulées et remboursées, tentatives de paiement réussies, Commandes en attente de paiement non expirées.
-- Mêmes règles de statut que la liste de la 6.2 : une Commande en attente ou échouée dont expire_le est passé est « expirée ». Filtres contrôlés
-- contre des listes fermées ; recherche par numéro (partiel, sans casse), nom ou email (partiel, sans casse), jokers échappés.
-- Aucune écriture. Fonction réservée au serveur (service_role) : rien n'est exposé à anon ni à authenticated.

create function public.commandes_admin_liste(
  p_auteur jsonb,
  p_statut text default null,
  p_famille text default null,
  p_prestataire text default null,
  p_zone text default null,
  p_recherche text default null,
  p_page integer default 1,
  p_taille integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(btrim(coalesce(p_recherche, '')), '');
  v_motif text;
  v_total integer;
  v_lignes jsonb;
begin
  perform public.exiger_personnel(p_auteur);
  if (p_statut is not null and p_statut not in ('en_attente', 'echouee', 'expiree', 'payee', 'en_fabrication', 'expediee', 'livree', 'annulee', 'remboursee', 'offerte'))
     or (p_famille is not null and p_famille not in ('cosplay', 'accessoire', 'vetement', 'autre', 'kit'))
     or (p_prestataire is not null and p_prestataire not in ('pawapay', 'maishapay', 'polar'))
     or (p_zone is not null and p_zone not in ('goma', 'bukavu'))
     or (v_q is not null and char_length(v_q) > 100)
     or p_page is null or p_page < 1 or p_page > 100000
     or p_taille is null or p_taille < 1 or p_taille > 100 then
    raise exception 'KS_ENTREE_INVALIDE' using errcode = 'P0001';
  end if;
  if v_q is not null then
    v_motif := '%' || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  with filtrees as (
    select
      c.numero, c.cree_le, c.statut, c.expire_le, c.total_cents, c.offerte, c.prestataire, c.zone, c.mode_remise,
      nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')), '') as nom,
      u.email
    from public.commande c
    left join auth.users u on u.id = c.compte_id
    where
      (p_statut is null
        or (p_statut = 'expiree' and (c.statut = 'expiree' or (c.statut in ('en_attente', 'echouee') and c.expire_le <= now())))
        or (p_statut in ('en_attente', 'echouee') and c.statut = p_statut and c.expire_le > now())
        or (p_statut = 'offerte' and c.offerte)
        or (p_statut not in ('expiree', 'en_attente', 'echouee', 'offerte') and c.statut = p_statut))
      and (p_prestataire is null or c.prestataire = p_prestataire)
      and (p_zone is null or c.zone = p_zone)
      and (p_famille is null or exists (
        select 1 from public.ligne_commande l join public.produit pr on pr.id = l.produit_id
        where l.commande_id = c.id and pr.famille::text = p_famille))
      and (v_motif is null
        or c.numero ilike v_motif
        or coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '') ilike v_motif
        or u.email ilike v_motif)
  ),
  page as (
    select * from filtrees f order by f.cree_le desc, f.numero desc limit p_taille offset (p_page - 1) * p_taille
  )
  select
    (select count(*)::integer from filtrees),
    (select coalesce(jsonb_agg(jsonb_build_object(
      'numero', p.numero,
      'cree_le', p.cree_le,
      'statut', p.statut,
      'expire_le', p.expire_le,
      'total_cents', p.total_cents,
      'offerte', p.offerte,
      'prestataire', p.prestataire,
      'zone', p.zone,
      'mode_remise', p.mode_remise,
      'client_nom', p.nom,
      'client_email_masque',
        case
          when p.email is null or position('@' in p.email) < 2 then null
          when position('@' in p.email) <= 3 then left(p.email, 1) || '***' || substr(p.email, position('@' in p.email))
          else left(p.email, 2) || '***' || substr(p.email, position('@' in p.email))
        end
    ) order by p.cree_le desc, p.numero desc), '[]'::jsonb) from page p)
  into v_total, v_lignes;

  return jsonb_build_object(
    'total', v_total,
    'commandes', v_lignes,
    'chiffres', jsonb_build_object(
      'commandes_payees', (select count(*)::integer from public.commande c where c.paye_le is not null and c.statut not in ('annulee', 'remboursee')),
      'tentatives_reussies', (select count(*)::integer from public.tentative_paiement t where t.statut = 'reussie'),
      'en_attente', (select count(*)::integer from public.commande c where c.statut = 'en_attente' and c.expire_le > now())
    )
  );
end;
$$;

revoke all on function public.commandes_admin_liste(jsonb, text, text, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.commandes_admin_liste(jsonb, text, text, text, text, text, integer, integer) to service_role;
