-- Story 4.6 : état réel de la Commande pour la page de retour et d'attente (AD-35). Une seule lecture, par le serveur, pour le Compte
-- propriétaire : le statut de la Commande, la Tentative en cours, l'échec de la dernière Tentative, le Trop-perçu et la présence d'un Kit.
-- Rien n'est jamais déduit du navigateur (FR-20). Accès : service_role seulement. Ne renvoie ni référence de transaction ni montant reçu.

create function public.etat_paiement_commande(p_numero text, p_compte uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'statut', c.statut,
    'expire_le', c.expire_le,
    'kit', exists (
      select 1 from public.ligne_commande l join public.produit p on p.id = l.produit_id where l.commande_id = c.id and p.famille = 'kit'
    ),
    'tentative_en_cours', (
      select jsonb_build_object('moyen', t.moyen, 'age_secondes', floor(extract(epoch from now() - t.cree_le))::int)
      from public.tentative_paiement t where t.commande_id = c.id and t.statut = 'en_cours'
    ),
    'derniere_cause_echec', (
      select t.cause from public.tentative_paiement t where t.commande_id = c.id and t.statut = 'echouee' order by t.modifie_le desc, t.cree_le desc limit 1
    ),
    -- Motif résumé pour le client : expirée, déjà payée, ou impossible à honorer (tout autre cas).
    'trop_percu', (
      select case when tp.motif = 'expiree' then 'expiree' when tp.motif = 'deja_payee' then 'deja_payee' else 'impossible' end
      from public.trop_percu tp where tp.commande_id = c.id order by tp.cree_le desc limit 1
    )
  )
  from public.commande c
  where c.numero = p_numero and c.compte_id = p_compte;
$$;

revoke all on function public.etat_paiement_commande(text, uuid) from public, anon, authenticated;
grant execute on function public.etat_paiement_commande(text, uuid) to service_role;
