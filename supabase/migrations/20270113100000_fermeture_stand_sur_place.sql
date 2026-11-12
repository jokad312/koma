-- Décision de Jonathan du 2026-11-12 (CGV §10) : avant l'Événement, un Stand non conforme est refusé et remboursé (circuit de la 7.9, refuser_candidature_stand) ;
-- le jour de l'Événement, un Stand qui présente des contrefaçons est fermé sur place, SANS remboursement.
-- Cette migration ajoute la fermeture sur place : la candidature reste « validee » (elle compte toujours comme active : pas de nouvelle candidature),
-- avec la date et le motif de fermeture ; les Pass du Stand passent à « annule » (le Scan les refuse) ; aucune ligne de remboursement n'est créée.

alter table public.candidature_stand
  add column fermee_le timestamptz,
  add column motif_fermeture text check (motif_fermeture is null or char_length(motif_fermeture) <= 500);

create or replace function public.fermer_stand_sur_place(p_auteur jsonb, p_candidature uuid, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  k public.candidature_stand;
  v_c public.commande;
  v_l public.ligne_commande;
  v_debut timestamptz;
  v_motif text := nullif(btrim(coalesce(p_motif, '')), '');
begin
  perform public.exiger_admin(p_auteur);
  if v_motif is not null and char_length(v_motif) > 500 then
    raise exception 'KS_MOTIF_INVALIDE' using errcode = 'P0001';
  end if;
  select * into k from public.candidature_stand where id = p_candidature for update;
  if not found then
    raise exception 'KS_CANDIDATURE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if k.statut = 'refusee' then
    raise exception 'KS_CANDIDATURE_REFUSEE' using errcode = 'P0001';
  end if;
  if k.fermee_le is not null then
    raise exception 'KS_STAND_DEJA_FERME' using errcode = 'P0001';
  end if;
  if k.commande_id is null then
    raise exception 'KS_STAND_NON_PAYE' using errcode = 'P0001';
  end if;
  select e.debut_le into v_debut from public.evenement e where e.id = k.evenement_id;
  if v_debut is not null and v_debut > now() then
    raise exception 'KS_EVENEMENT_PAS_COMMENCE' using errcode = 'P0001';
  end if;
  -- Même ordre de verrous que refuser_candidature_stand et annuler_pass : Pass d'abord, puis Commande.
  perform 1 from public.pass where commande_id = k.commande_id order by id for update;
  select * into v_c from public.commande where id = k.commande_id for update;
  if v_c.statut not in ('payee', 'offerte') then
    raise exception 'KS_STAND_NON_PAYE' using errcode = 'P0001';
  end if;
  select * into v_l from public.ligne_commande where commande_id = v_c.id and type_pass_id = k.type_pass_id and est_stand limit 1;
  if v_l.id is null then
    raise exception 'KS_PASS_INTROUVABLE' using errcode = 'P0001';
  end if;
  perform 1 from public.pass where ligne_commande_id = v_l.id order by id for update;
  -- Un Pass déjà annulé ou remboursé (annulation ou refus antérieur) ne se ferme pas une seconde fois.
  if exists (select 1 from public.pass u where u.ligne_commande_id = v_l.id and u.statut in ('annule', 'rembourse')) then
    raise exception 'KS_ANNULATION_IMPOSSIBLE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  -- Un Pass déjà scanné à l'entrée repasse sans date de scan (contrainte pass_scanne_coherent) ; le journal d'audit garde l'ancien statut.
  update public.pass set statut = 'annule', scanne_le = null where ligne_commande_id = v_l.id;
  update public.demande_client set statut = 'refusee', traitee_le = now()
    where type = 'annulation_pass' and statut = 'ouverte' and pass_id in (select id from public.pass where ligne_commande_id = v_l.id);
  update public.candidature_stand set fermee_le = now(), motif_fermeture = v_motif where id = k.id;
  -- Aucun remboursement : pas de ligne « remboursement », pas d'email de refus (le stand est fermé sur place).
end;
$$;
revoke all on function public.fermer_stand_sur_place(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.fermer_stand_sur_place(jsonb, uuid, text) to service_role;
