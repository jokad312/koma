-- Site en français uniquement (décision de Jonathan du 2026-11-22, spec « B : site en français uniquement ») : l'anglais est désactivé mais
-- conservé pour un éventuel lancement international. Les colonnes _en restent, aucune donnée n'est supprimée ni modifiée ; seuls les
-- contrôles de publication cessent d'exiger l'anglais. Fonctions réécrites depuis leur dernière version :
-- - manques_publication : 20270119100000_familles_vetement_autre.sql, sans titre_en, description_en, materiel_en ni « couleurs »
--   (nom anglais d'une couleur) ;
-- - manques_publication_evenement : 20270103110000_evenements_correctif_manques.sql, sans titre_en, description_en, lieu_en, alt_en des
--   photos, nom_en et inclus_en des types de Pass (« types_incomplets » ne regarde plus que inclus_fr) ;
-- - valider_photo : 20261231230000_mur_public_correctifs.sql ; le texte alternatif anglais devient facultatif et reçoit la copie du
--   français quand il manque (contrainte photo_publiee_alt inchangée et toujours satisfaite).
-- Les droits (revoke/grant) des fonctions remplacées sont conservés par « create or replace » et reposés ici à l'identique.

select set_config('ks.auteur', '{"type":"migration","nom":"site_francais_uniquement"}', true);

-- 1. Ce qui manque pour publier un produit.
create or replace function public.manques_publication(p_produit_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_produit public.produit%rowtype;
  v_manques text[] := '{}';
begin
  select * into v_produit from public.produit p where p.id = p_produit_id;
  if not found then
    return null;
  end if;
  if v_produit.prix_cents is null then
    v_manques := v_manques || 'prix'::text;
  end if;
  if not exists (select 1 from public.produit_photo ph where ph.produit_id = p_produit_id) then
    v_manques := v_manques || 'photo'::text;
  end if;
  if v_produit.famille = 'kit' then
    if btrim(coalesce(v_produit.titre_fr, '')) = '' then
      v_manques := v_manques || 'titre_fr'::text;
    end if;
  end if;
  if btrim(coalesce(v_produit.description_fr, '')) = '' then
    v_manques := v_manques || 'description_fr'::text;
  end if;
  if v_produit.famille <> 'kit' then
    if not exists (select 1 from public.variante va where va.produit_id = p_produit_id) then
      v_manques := v_manques || 'variante'::text;
    end if;
    return v_manques;
  end if;
  if btrim(coalesce(v_produit.materiel_fr, '')) = '' then
    v_manques := v_manques || 'materiel_fr'::text;
  end if;
  if v_produit.niveau is null then
    v_manques := v_manques || 'niveau'::text;
  end if;
  if not exists (select 1 from public.fichier_kit f where f.produit_id = p_produit_id) then
    v_manques := v_manques || 'fichier'::text;
  end if;
  if not exists (select 1 from public.video_kit v where v.produit_id = p_produit_id) then
    v_manques := v_manques || 'video'::text;
  end if;
  if not exists (select 1 from public.sous_titre_kit s where s.produit_id = p_produit_id and s.langue = 'fr') then
    v_manques := v_manques || 'sous_titres_fr'::text;
  end if;
  if exists (
    select 1 from public.video_kit v
    where v.produit_id = p_produit_id and v.extrait_bunny_id is not null and not v.extrait_sans_parole
      and not ('fr' = any (v.extrait_sous_titres))
  ) then
    v_manques := v_manques || 'sous_titres_extrait_fr'::text;
  end if;
  return v_manques;
end;
$$;

revoke all on function public.manques_publication(uuid) from public, anon, authenticated;
grant execute on function public.manques_publication(uuid) to service_role;

-- 2. Ce qui manque pour publier un événement.
create or replace function public.manques_publication_evenement(p_id uuid)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  e public.evenement%rowtype;
  v_manques text[] := '{}';
begin
  select * into e from public.evenement where id = p_id;
  if not found then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if coalesce(e.titre_fr, '') = '' then v_manques := array_append(v_manques, 'titre_fr'); end if;
  if coalesce(e.description_fr, '') = '' then v_manques := array_append(v_manques, 'description_fr'); end if;
  if e.debut_le is null then v_manques := array_append(v_manques, 'date'); end if;
  if e.lieu_type is null or coalesce(e.lieu_fr, '') = '' then v_manques := array_append(v_manques, 'lieu'); end if;
  if jsonb_array_length(coalesce(e.images, '[]'::jsonb)) = 0
     or exists (
       select 1 from jsonb_array_elements(coalesce(e.images, '[]'::jsonb)) img
       where jsonb_typeof(img) <> 'object' or coalesce(img ->> 'alt_fr', '') = ''
     ) then
    v_manques := array_append(v_manques, 'photo');
  end if;
  if not exists (select 1 from public.type_pass t where t.evenement_id = p_id and t.prix_cents > 0) then
    v_manques := array_append(v_manques, 'type_pass');
  end if;
  if exists (
    select 1 from public.type_pass t
    where t.evenement_id = p_id and coalesce(t.inclus_fr, '') = ''
  ) then
    v_manques := array_append(v_manques, 'types_incomplets');
  end if;
  return v_manques;
end;
$$;

revoke all on function public.manques_publication_evenement(uuid) from public, anon, authenticated;
grant execute on function public.manques_publication_evenement(uuid) to service_role;

-- 3. Validation d'une photo de la galerie : texte alternatif anglais facultatif.
create or replace function public.valider_photo(p_auteur jsonb, p_photo uuid, p_fichier_public text, p_alt_fr text, p_alt_en text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.photo_galerie;
  v_alt_fr text := public.alt_nettoye(p_alt_fr);
  -- Anglais facultatif (site en français uniquement) : sans texte anglais valable, le français est copié (la contrainte photo_publiee_alt reste vraie).
  v_alt_en text := coalesce(public.alt_nettoye(p_alt_en), public.alt_nettoye(p_alt_fr));
begin
  perform public.exiger_personnel(p_auteur);
  if v_alt_fr is null then
    raise exception 'KS_ALT_INVALIDE' using errcode = 'P0001';
  end if;
  select * into v_p from public.photo_galerie where id = p_photo for update;
  if not found then
    raise exception 'KS_PHOTO_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_p.statut <> 'en_attente' then
    raise exception 'KS_PHOTO_DEJA_TRAITEE' using errcode = 'P0001';
  end if;
  if v_p.compte_id is not null and public.est_mineur(v_p.compte_id) then
    raise exception 'KS_PHOTO_MINEUR' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.consentement where cible_id = v_p.id and objet = 'publication_photo' and retire_le is null) then
    raise exception 'KS_ACCORD_MANQUANT' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.photo_galerie
    set statut = 'publiee', fichier_public = p_fichier_public, publiee_le = now(), decide_par = p_auteur, alt_fr = v_alt_fr, alt_en = v_alt_en
    where id = v_p.id;
  if exists (select 1 from public.realisation where photo_id = v_p.id) then
    -- Deux validations simultanées ne prennent jamais le même rang.
    perform pg_advisory_xact_lock(hashtextextended('realisation:rang', 0));
    update public.realisation
      set validee_le = now(), rang = (select coalesce(max(rang), 0) + 1 from public.realisation)
      where photo_id = v_p.id;
  end if;
end;
$$;

revoke all on function public.valider_photo(jsonb, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.valider_photo(jsonb, uuid, text, text, text) to service_role;
