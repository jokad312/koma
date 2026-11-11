-- Story 7.9, correctif de revue (les migrations précédentes sont déjà appliquées : elles ne sont pas modifiées).
-- demander_annulation_pass verrouille toute l'unité (le Pass demandé, et son second titulaire pour un Stand) dans l'ordre des identifiants,
-- comme annuler_pass, avant de vérifier le motif : deux clics simultanés sur les deux cartes d'un Stand ne créent plus deux demandes ouvertes.
create or replace function public.demander_annulation_pass(p_compte uuid, p_pass uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.pass;
  v_motif text;
  v_id uuid;
begin
  if not exists (select 1 from public.pass p join public.commande c on c.id = p.commande_id where p.id = p_pass and c.compte_id = p_compte) then
    raise exception 'KS_PASS_INTROUVABLE' using errcode = 'P0001';
  end if;
  perform 1 from public.pass where id in (select public.evenements_unite_pass(p_pass)) order by id for update;
  select * into v_p from public.pass where id = p_pass;
  v_motif := public.evenements_motif_refus_annulation(v_p.id);
  if v_motif is not null then
    raise exception '%', v_motif using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', jsonb_build_object('type', 'compte', 'id', p_compte)::text, true);
  insert into public.demande_client (commande_id, type, pass_id) values (v_p.commande_id, 'annulation_pass', v_p.id) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.demander_annulation_pass(uuid, uuid) from public, anon, authenticated;
grant execute on function public.demander_annulation_pass(uuid, uuid) to service_role;
