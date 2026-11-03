-- Story 4.8 (suite, après 20261207100000 qui n'est pas modifiée) : les lectures de la confirmation portent aussi le montant attendu et le numéro de
-- la Commande, dont le service a besoin pour comparer le montant reçu et pour rediriger le client. Aucune donnée personnelle.

create or replace function public.tentative_par_reference_interne(p_reference text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select to_jsonb(r) from (
    select t.id, t.prestataire, t.statut, t.reference_interne, t.reference_transaction, t.montant_attendu_cents, c.numero as commande_numero
    from public.tentative_paiement t join public.commande c on c.id = t.commande_id
    where t.reference_interne = p_reference
  ) r
$$;

drop function public.tentatives_a_reconcilier(integer, integer);
create function public.tentatives_a_reconcilier(p_limite integer, p_delai_secondes integer)
returns table (id uuid, prestataire text, statut text, reference_interne text, reference_transaction text, montant_attendu_cents integer)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.prestataire, t.statut, t.reference_interne, t.reference_transaction, t.montant_attendu_cents
  from public.tentative_paiement t
  where (t.statut = 'en_cours' or (t.statut = 'abandonnee' and t.modifie_le > now() - interval '72 hours'))
    and t.cree_le > now() - interval '72 hours'
    and t.modifie_le <= now() - make_interval(secs => greatest(p_delai_secondes, 0))
  order by t.modifie_le asc
  limit least(greatest(p_limite, 1), 100)
$$;

revoke all on function public.tentative_par_reference_interne(text) from public, anon, authenticated;
revoke all on function public.tentatives_a_reconcilier(integer, integer) from public, anon, authenticated;
grant execute on function public.tentative_par_reference_interne(text) to service_role;
grant execute on function public.tentatives_a_reconcilier(integer, integer) to service_role;
