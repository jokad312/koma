-- Story 7.4 : enregistrer_evenement refuse de retirer un Type de pass déjà commandé (KS_TYPE_PASS_VENDU). Version de 20270103120000 (qui refuse déjà
-- de rendre incomplet un événement publié) avec ce seul ajout.
create or replace function public.enregistrer_evenement(p_auteur jsonb, p_id uuid, p_evenement jsonb, p_types jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titre_fr text;
  v_titre_en text;
  v_slug text;
  v_desc_fr text;
  v_desc_en text;
  v_lieu_type text;
  v_lieu_fr text;
  v_lieu_en text;
  v_debut timestamptz;
  v_fin timestamptz;
  v_capacite integer;
  v_ouvre timestamptz;
  v_ferme timestamptz;
  v_images jsonb;
  v_id uuid;
  v_type jsonb;
  v_pos integer := 0;
  v_type_id uuid;
  v_gardes uuid[] := '{}';
  v_prix integer;
  v_quota integer;
  v_manques text[];
begin
  perform public.exiger_admin(p_auteur);
  if p_evenement is null or jsonb_typeof(p_evenement) <> 'object' then
    raise exception 'KS_EVENEMENT_INVALIDE' using errcode = 'P0001';
  end if;
  v_titre_fr := btrim(coalesce(p_evenement ->> 'titre_fr', ''));
  if char_length(v_titre_fr) < 1 or char_length(v_titre_fr) > 120 then
    raise exception 'KS_TITRE_INVALIDE' using errcode = 'P0001';
  end if;
  v_titre_en := nullif(btrim(coalesce(p_evenement ->> 'titre_en', '')), '');
  if v_titre_en is not null and char_length(v_titre_en) > 120 then
    raise exception 'KS_TITRE_INVALIDE' using errcode = 'P0001';
  end if;
  v_slug := btrim(coalesce(p_evenement ->> 'slug', ''));
  if char_length(v_slug) < 1 or char_length(v_slug) > 80 or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'KS_SLUG_INVALIDE' using errcode = 'P0001';
  end if;
  v_desc_fr := nullif(btrim(coalesce(p_evenement ->> 'description_fr', '')), '');
  v_desc_en := nullif(btrim(coalesce(p_evenement ->> 'description_en', '')), '');
  if char_length(coalesce(v_desc_fr, '')) > 5000 or char_length(coalesce(v_desc_en, '')) > 5000 then
    raise exception 'KS_TEXTE_INVALIDE' using errcode = 'P0001';
  end if;
  v_lieu_type := nullif(btrim(coalesce(p_evenement ->> 'lieu_type', '')), '');
  if v_lieu_type is not null and v_lieu_type not in ('salle', 'plein_air') then
    raise exception 'KS_LIEU_INVALIDE' using errcode = 'P0001';
  end if;
  v_lieu_fr := nullif(btrim(coalesce(p_evenement ->> 'lieu_fr', '')), '');
  v_lieu_en := nullif(btrim(coalesce(p_evenement ->> 'lieu_en', '')), '');
  if char_length(coalesce(v_lieu_fr, '')) > 200 or char_length(coalesce(v_lieu_en, '')) > 200 then
    raise exception 'KS_LIEU_INVALIDE' using errcode = 'P0001';
  end if;
  begin
    v_debut := nullif(p_evenement ->> 'debut_le', '')::timestamptz;
    v_fin := nullif(p_evenement ->> 'fin_le', '')::timestamptz;
    v_ouvre := nullif(p_evenement ->> 'vente_ouvre_le', '')::timestamptz;
    v_ferme := nullif(p_evenement ->> 'vente_ferme_le', '')::timestamptz;
  exception when others then
    raise exception 'KS_DATE_INVALIDE' using errcode = 'P0001';
  end;
  if (v_fin is not null and v_debut is not null and v_fin < v_debut)
     or (v_ouvre is not null and v_ferme is not null and v_ferme <= v_ouvre) then
    raise exception 'KS_DATE_INVALIDE' using errcode = 'P0001';
  end if;
  if nullif(p_evenement ->> 'capacite', '') is not null then
    if (p_evenement ->> 'capacite') !~ '^[0-9]{1,6}$' then
      raise exception 'KS_CAPACITE_INVALIDE' using errcode = 'P0001';
    end if;
    v_capacite := (p_evenement ->> 'capacite')::integer;
    if v_capacite < 1 or v_capacite > 100000 then
      raise exception 'KS_CAPACITE_INVALIDE' using errcode = 'P0001';
    end if;
  end if;
  v_images := coalesce(p_evenement -> 'images', '[]'::jsonb);
  if jsonb_typeof(v_images) <> 'array' or jsonb_array_length(v_images) > 10
     or exists (select 1 from jsonb_array_elements(v_images) img where jsonb_typeof(img) <> 'object' or coalesce(img ->> 'fichier', '') = '') then
    raise exception 'KS_EVENEMENT_INVALIDE' using errcode = 'P0001';
  end if;
  if p_types is null or jsonb_typeof(p_types) <> 'array' or jsonb_array_length(p_types) > 20 then
    raise exception 'KS_TYPE_PASS_INVALIDE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  begin
    if p_id is null then
      insert into public.evenement (auteur_id, titre_fr, titre_en, slug, description_fr, description_en, lieu_type, lieu_fr, lieu_en,
                                    debut_le, fin_le, capacite, vente_ouvre_le, vente_ferme_le, images, publie_le)
      values ((p_auteur ->> 'id')::uuid, v_titre_fr, v_titre_en, v_slug, v_desc_fr, v_desc_en, v_lieu_type, v_lieu_fr, v_lieu_en,
              v_debut, v_fin, v_capacite, v_ouvre, v_ferme, v_images, null)
      returning id into v_id;
    else
      update public.evenement
        set titre_fr = v_titre_fr, titre_en = v_titre_en, slug = v_slug, description_fr = v_desc_fr, description_en = v_desc_en,
            lieu_type = v_lieu_type, lieu_fr = v_lieu_fr, lieu_en = v_lieu_en, debut_le = v_debut, fin_le = v_fin, capacite = v_capacite,
            vente_ouvre_le = v_ouvre, vente_ferme_le = v_ferme, images = v_images
      where id = p_id;
      if not found then
        raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
      end if;
      v_id := p_id;
    end if;
  exception when unique_violation then
    raise exception 'KS_SLUG_PRIS' using errcode = 'P0001';
  end;

  for v_type in select value from jsonb_array_elements(p_types) loop
    if jsonb_typeof(v_type) <> 'object' then
      raise exception 'KS_TYPE_PASS_INVALIDE' using errcode = 'P0001';
    end if;
    if char_length(btrim(coalesce(v_type ->> 'nom_fr', ''))) not between 1 and 80
       or char_length(coalesce(btrim(v_type ->> 'nom_en'), '')) > 80
       or char_length(coalesce(v_type ->> 'inclus_fr', '')) > 1000
       or char_length(coalesce(v_type ->> 'inclus_en', '')) > 1000 then
      raise exception 'KS_TYPE_PASS_INVALIDE' using errcode = 'P0001';
    end if;
    if coalesce(v_type ->> 'prix_cents', '') !~ '^[0-9]{1,8}$' then
      raise exception 'KS_PRIX_INVALIDE' using errcode = 'P0001';
    end if;
    v_prix := (v_type ->> 'prix_cents')::integer;
    if v_prix > 10000000 then
      raise exception 'KS_PRIX_INVALIDE' using errcode = 'P0001';
    end if;
    v_quota := null;
    if nullif(v_type ->> 'quota', '') is not null then
      if (v_type ->> 'quota') !~ '^[0-9]{1,6}$' or (v_type ->> 'quota')::integer not between 1 and 100000 then
        raise exception 'KS_QUOTA_INVALIDE' using errcode = 'P0001';
      end if;
      v_quota := (v_type ->> 'quota')::integer;
    end if;
    if jsonb_typeof(coalesce(v_type -> 'est_stand', 'false'::jsonb)) <> 'boolean' then
      raise exception 'KS_TYPE_PASS_INVALIDE' using errcode = 'P0001';
    end if;
    v_type_id := nullif(v_type ->> 'id', '')::uuid;
    if v_type_id is null then
      insert into public.type_pass (evenement_id, nom_fr, nom_en, prix_cents, quota, inclus_fr, inclus_en, est_stand, ordre)
      values (v_id, btrim(v_type ->> 'nom_fr'), nullif(btrim(coalesce(v_type ->> 'nom_en', '')), ''), v_prix, v_quota,
              nullif(btrim(coalesce(v_type ->> 'inclus_fr', '')), ''), nullif(btrim(coalesce(v_type ->> 'inclus_en', '')), ''),
              coalesce((v_type ->> 'est_stand')::boolean, false), v_pos)
      returning id into v_type_id;
    else
      update public.type_pass
        set nom_fr = btrim(v_type ->> 'nom_fr'), nom_en = nullif(btrim(coalesce(v_type ->> 'nom_en', '')), ''), prix_cents = v_prix, quota = v_quota,
            inclus_fr = nullif(btrim(coalesce(v_type ->> 'inclus_fr', '')), ''), inclus_en = nullif(btrim(coalesce(v_type ->> 'inclus_en', '')), ''),
            est_stand = coalesce((v_type ->> 'est_stand')::boolean, false), ordre = v_pos
      where id = v_type_id and evenement_id = v_id;
      if not found then
        raise exception 'KS_TYPE_PASS_INTROUVABLE' using errcode = 'P0001';
      end if;
    end if;
    v_gardes := v_gardes || v_type_id;
    v_pos := v_pos + 1;
  end loop;
  -- Un Type déjà commandé (une ligne de Commande y fait référence, quel que soit le statut de la Commande) ne se retire jamais : la preuve de la vente
  -- et les noms figés des titulaires en dépendent. Toute la transaction est annulée ; le Type reste à vendre ou se renomme.
  if exists (
    select 1 from public.ligne_commande l join public.type_pass t on t.id = l.type_pass_id
    where t.evenement_id = v_id and not (t.id = any (v_gardes))
  ) then
    raise exception 'KS_TYPE_PASS_VENDU' using errcode = 'P0001';
  end if;
  delete from public.type_pass where evenement_id = v_id and not (id = any (v_gardes));

  -- Un événement publié doit rester publiable : retirer le dernier Type payant, une photo ou un texte anglais est refusé
  -- (toute la transaction est annulée). Pour vider un événement, le dépublier d'abord.
  if exists (select 1 from public.evenement where id = v_id and publie_le is not null) then
    v_manques := public.manques_publication_evenement(v_id);
    if cardinality(v_manques) > 0 then
      raise exception 'KS_PUBLICATION_INCOMPLETE:%', array_to_string(v_manques, ',') using errcode = 'P0001';
    end if;
  end if;

  return v_id;
end;
$$;
