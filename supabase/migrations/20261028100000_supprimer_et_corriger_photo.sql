-- Correctif 2.2 : suppression d'une photo et texte alternatif modifiable.
-- Même cadre que ajouter_photo_produit et deplacer_photo_produit : SECURITY DEFINER, search_path vide, p_auteur en premier,
-- exiger_admin, ks.auteur posé avant l'écriture (le déclencheur existant de produit_photo journalise), service_role seulement.
-- Les migrations précédentes ne sont pas modifiées.

-- Corrige les deux textes alternatifs d'une photo (admin). 1 à 200 caractères chacun, après rognage.
create function public.modifier_alt_photo(p_auteur jsonb, p_photo_id uuid, p_alt_fr text, p_alt_en text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alt_fr text := btrim(coalesce(p_alt_fr, ''));
  v_alt_en text := btrim(coalesce(p_alt_en, ''));
  v_produit uuid;
begin
  perform public.exiger_admin(p_auteur);

  select ph.produit_id into v_produit from public.produit_photo ph where ph.id = p_photo_id;
  if not found then
    raise exception 'KS_PHOTO_INTROUVABLE' using errcode = 'P0001';
  end if;
  if char_length(v_alt_fr) < 1 or char_length(v_alt_fr) > 200 or char_length(v_alt_en) < 1 or char_length(v_alt_en) > 200 then
    raise exception 'KS_ALT_INVALIDE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  update public.produit_photo set alt_fr = v_alt_fr, alt_en = v_alt_en where id = p_photo_id;
  if not found then
    raise exception 'KS_PHOTO_INTROUVABLE' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.modifier_alt_photo(jsonb, uuid, text, text) from public, anon, authenticated;
grant execute on function public.modifier_alt_photo(jsonb, uuid, text, text) to service_role;

-- Supprime une photo (admin), renumérote les positions restantes 1..n de façon contiguë et renvoie le fichier du bucket public :
-- le serveur l'efface APRÈS cette réponse (un orphelin vaut mieux qu'une photo cassée).
-- Retirer la dernière photo d'un produit publié est refusé en fin de transaction par le déclencheur différé ci-dessous.
create function public.supprimer_photo_produit(p_auteur jsonb, p_photo_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produit uuid;
  v_fichier text;
begin
  perform public.exiger_admin(p_auteur);

  select ph.produit_id, ph.fichier into v_produit, v_fichier from public.produit_photo ph where ph.id = p_photo_id;
  if not found then
    raise exception 'KS_PHOTO_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Même verrou de produit que l'ajout et le déplacement : pas de renumérotation concurrente.
  perform 1 from public.produit p where p.id = v_produit for update;
  if not found then
    raise exception 'KS_PHOTO_INTROUVABLE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  delete from public.produit_photo where id = p_photo_id;
  if not found then
    raise exception 'KS_PHOTO_INTROUVABLE' using errcode = 'P0001';
  end if;

  -- La contrainte (produit, position) est DEFERRABLE INITIALLY DEFERRED (migration 2.2) : vérifiée en fin de transaction, donc la
  -- renumérotation ne peut pas heurter l'unicité, quel que soit l'ordre des lignes mises à jour.
  update public.produit_photo ph
  set position = n.nouvelle
  from (
    select x.id, row_number() over (order by x.position, x.cree_le, x.id)::integer as nouvelle
    from public.produit_photo x where x.produit_id = v_produit
  ) n
  where ph.id = n.id and ph.position <> n.nouvelle;

  return v_fichier;
end;
$$;

revoke all on function public.supprimer_photo_produit(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.supprimer_photo_produit(jsonb, uuid) to service_role;

-- Contrôle différé (fin de transaction), comme sur produit et variante : un produit publié ne perd pas sa dernière photo.
-- Si le produit lui-même est supprimé (cascade), il n'existe plus à la fin : aucun refus.
create constraint trigger produit_photo_publie_complet
  after delete on public.produit_photo
  deferrable initially deferred
  for each row execute function public.exiger_produit_publie_complet();
