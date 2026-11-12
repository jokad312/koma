-- Story 8.5, correctif : l'écran de l'Admin connaît la photo d'une Réalisation, pas son identifiant de Réalisation.
-- realisation_pour_offre prend donc l'identifiant de la photo et rend aussi celui de la Réalisation (validée seulement) ;
-- pass_offerts_options rend l'identifiant de la photo de chaque attribution. Mêmes droits (serveur seulement, Admin).

drop function public.realisation_pour_offre(jsonb, uuid);
create function public.realisation_pour_offre(p_auteur jsonb, p_photo uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_r record;
begin
  perform public.exiger_admin(p_auteur);
  select z.id, z.compte_id, ph.nom_affiche into v_r from public.realisation z join public.photo_galerie ph on ph.id = z.photo_id where z.photo_id = p_photo;
  if not found then
    raise exception 'KS_REALISATION_INTROUVABLE' using errcode = 'P0001';
  end if;
  return jsonb_build_object('realisation_id', v_r.id, 'compte_id', v_r.compte_id, 'nom_affiche', v_r.nom_affiche);
end;
$$;

create or replace function public.pass_offerts_options(p_auteur jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_evenements jsonb;
  v_attributions jsonb;
begin
  perform public.exiger_admin(p_auteur);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'titre_fr', e.titre_fr, 'titre_en', e.titre_en, 'debut_le', e.debut_le,
    'attribues', (select count(*) from public.pass_offert o where o.evenement_id = e.id),
    'types', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nom_fr', t.nom_fr, 'nom_en', t.nom_en) order by t.prix_cents, t.nom_fr), '[]'::jsonb)
              from public.type_pass t where t.evenement_id = e.id and not t.est_stand)
  ) order by e.debut_le), '[]'::jsonb) into v_evenements
  from public.evenement e
  where e.publie_le is not null and e.publie_le <= now() and e.debut_le is not null and e.debut_le > now()
    and (select count(*) from public.pass_offert o where o.evenement_id = e.id) < 10
    and (e.capacite is null or e.capacite - public.places_evenement_utilisees(e.id) >= 1)
    and exists (select 1 from public.type_pass t where t.evenement_id = e.id and not t.est_stand);
  select coalesce(jsonb_agg(jsonb_build_object('photo_id', z.photo_id, 'evenement_id', o.evenement_id, 'titre_fr', e.titre_fr, 'titre_en', e.titre_en, 'rang', o.rang)), '[]'::jsonb) into v_attributions
  from public.pass_offert o
  join public.realisation z on z.id = o.realisation_id
  join public.evenement e on e.id = o.evenement_id;
  return jsonb_build_object('evenements', v_evenements, 'attributions', v_attributions);
end;
$$;

revoke all on function public.realisation_pour_offre(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.realisation_pour_offre(jsonb, uuid) to service_role;
