-- Story 7.1 : Événements et Types de pass (module evenements), frais d'annulation des Pass (réglage).
-- Même modèle que les Articles (8.6) : écriture réservée au service_role, p_auteur vérifié par exiger_admin,
-- journal_audit alimenté par le trigger journaliser. Lecture publique : seulement les Événements publiés et leurs Types de pass.
-- Aucun événement, aucun Type de pass ni aucun texte n'est créé par la migration : tout vient de l'admin (règle 14).
-- Décisions de Jonathan du 2026-11-10 : Types de pass libres (quota facultatif, case Stand), dates de vente facultatives (AD-37).

create table public.evenement (
  id uuid primary key default gen_random_uuid(),
  auteur_id uuid not null,
  titre_fr text not null check (char_length(titre_fr) between 1 and 120),
  titre_en text check (titre_en is null or char_length(titre_en) between 1 and 120),
  slug text not null check (char_length(slug) between 1 and 80 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Programme / description, en Markdown simple comme les Articles.
  description_fr text check (description_fr is null or char_length(description_fr) <= 5000),
  description_en text check (description_en is null or char_length(description_en) <= 5000),
  lieu_type text check (lieu_type is null or lieu_type in ('salle', 'plein_air')),
  lieu_fr text check (lieu_fr is null or char_length(lieu_fr) between 1 and 200),
  lieu_en text check (lieu_en is null or char_length(lieu_en) between 1 and 200),
  -- Date et heure de l'Événement : instants absolus ; l'admin les saisit et les affiche en Africa/Lubumbashi.
  debut_le timestamptz,
  fin_le timestamptz,
  capacite integer check (capacite is null or capacite between 1 and 100000),
  -- Ouverture et fermeture de la vente (facultatives) : sans ouverture, dès la publication ; sans fermeture, au début de l'Événement.
  vente_ouvre_le timestamptz,
  vente_ferme_le timestamptz,
  -- Photos : [{ fichier, alt_fr, alt_en }] ; les deux textes alternatifs sont exigés à la publication.
  images jsonb not null default '[]'::jsonb,
  publie_le timestamptz,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  check (fin_le is null or debut_le is null or fin_le >= debut_le),
  check (vente_ouvre_le is null or vente_ferme_le is null or vente_ferme_le > vente_ouvre_le)
);

create unique index evenement_slug_unique on public.evenement (slug);
create index evenement_publie_le_idx on public.evenement (publie_le) where publie_le is not null;

alter table public.evenement enable row level security;
revoke all on public.evenement from public, anon, authenticated;
grant select (id, titre_fr, titre_en, slug, description_fr, description_en, lieu_type, lieu_fr, lieu_en, debut_le, fin_le, capacite,
              vente_ouvre_le, vente_ferme_le, images, publie_le, cree_le, modifie_le)
  on public.evenement to anon, authenticated;

create policy evenement_lecture_publiee on public.evenement
  for select to anon, authenticated
  using (publie_le is not null and publie_le <= now());

create trigger evenement_journaliser
  after insert or update or delete on public.evenement
  for each row execute function public.journaliser('id');
create trigger evenement_modifie_le
  before update on public.evenement
  for each row execute function public.toucher_modifie_le();

create table public.type_pass (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenement (id) on delete cascade,
  nom_fr text not null check (char_length(nom_fr) between 1 and 80),
  nom_en text check (nom_en is null or char_length(nom_en) between 1 and 80),
  prix_cents integer not null check (prix_cents between 0 and 10000000),
  -- Quota facultatif : nombre maximal de Pass de ce Type (pour un Type Stand : nombre de Stands).
  quota integer check (quota is null or quota between 1 and 100000),
  inclus_fr text check (inclus_fr is null or char_length(inclus_fr) <= 1000),
  inclus_en text check (inclus_en is null or char_length(inclus_en) <= 1000),
  -- Stand : deux Pass nominatifs par unité (AD-7), vendu seulement sur candidature validée (AD-37, story 7.11).
  est_stand boolean not null default false,
  ordre integer not null default 0,
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now()
);

create index type_pass_evenement_idx on public.type_pass (evenement_id, ordre);

alter table public.type_pass enable row level security;
revoke all on public.type_pass from public, anon, authenticated;
grant select on public.type_pass to anon, authenticated;

create policy type_pass_lecture_publiee on public.type_pass
  for select to anon, authenticated
  using (exists (
    select 1 from public.evenement e
    where e.id = type_pass.evenement_id and e.publie_le is not null and e.publie_le <= now()
  ));

create trigger type_pass_journaliser
  after insert or update or delete on public.type_pass
  for each row execute function public.journaliser('id');
create trigger type_pass_modifie_le
  before update on public.type_pass
  for each row execute function public.toucher_modifie_le();

-- Enregistre (création ou modification) un brouillon d'Événement avec ses Types de pass, en une seule transaction.
-- p_types : tableau ordonné ; un élément avec « id » met à jour ce Type (qui doit appartenir à l'Événement), sans « id » en crée un ;
-- les Types absents de la liste sont retirés. La story 7.4 refusera le retrait d'un Type déjà commandé.
create function public.enregistrer_evenement(p_auteur jsonb, p_id uuid, p_evenement jsonb, p_types jsonb)
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
  delete from public.type_pass where evenement_id = v_id and not (id = any (v_gardes));

  return v_id;
end;
$$;

revoke all on function public.enregistrer_evenement(jsonb, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.enregistrer_evenement(jsonb, uuid, jsonb, jsonb) to service_role;

-- Ce qui manque pour publier un Événement (liste vide = publiable). Interne : lue par publier_evenement et par l'admin (service).
create function public.manques_publication_evenement(p_id uuid)
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
  if coalesce(e.titre_fr, '') = '' then v_manques := v_manques || 'titre_fr'; end if;
  if coalesce(e.titre_en, '') = '' then v_manques := v_manques || 'titre_en'; end if;
  if coalesce(e.description_fr, '') = '' then v_manques := v_manques || 'description_fr'; end if;
  if coalesce(e.description_en, '') = '' then v_manques := v_manques || 'description_en'; end if;
  if e.debut_le is null then v_manques := v_manques || 'date'; end if;
  if e.lieu_type is null or coalesce(e.lieu_fr, '') = '' or coalesce(e.lieu_en, '') = '' then v_manques := v_manques || 'lieu'; end if;
  if jsonb_array_length(coalesce(e.images, '[]'::jsonb)) = 0
     or exists (
       select 1 from jsonb_array_elements(coalesce(e.images, '[]'::jsonb)) img
       where jsonb_typeof(img) <> 'object' or coalesce(img ->> 'alt_fr', '') = '' or coalesce(img ->> 'alt_en', '') = ''
     ) then
    v_manques := v_manques || 'photo';
  end if;
  if not exists (select 1 from public.type_pass t where t.evenement_id = p_id and t.prix_cents > 0) then
    v_manques := v_manques || 'type_pass';
  end if;
  if exists (
    select 1 from public.type_pass t
    where t.evenement_id = p_id and (coalesce(t.nom_en, '') = '' or coalesce(t.inclus_fr, '') = '' or coalesce(t.inclus_en, '') = '')
  ) then
    v_manques := v_manques || 'types_incomplets';
  end if;
  return v_manques;
end;
$$;

revoke all on function public.manques_publication_evenement(uuid) from public, anon, authenticated;
grant execute on function public.manques_publication_evenement(uuid) to service_role;

-- Publie un Événement (admin) : refuse avec la liste des manques (« KS_PUBLICATION_INCOMPLETE:titre_en,photo,… »).
create function public.publier_evenement(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publie timestamptz;
  v_manques text[];
begin
  perform public.exiger_admin(p_auteur);
  select e.publie_le into v_publie from public.evenement e where e.id = p_id for update;
  if not found then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_publie is not null then
    return;
  end if;
  v_manques := public.manques_publication_evenement(p_id);
  if cardinality(v_manques) > 0 then
    raise exception 'KS_PUBLICATION_INCOMPLETE:%', array_to_string(v_manques, ',') using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.evenement set publie_le = now() where id = p_id;
end;
$$;

revoke all on function public.publier_evenement(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.publier_evenement(jsonb, uuid) to service_role;

create function public.depublier_evenement(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publie timestamptz;
begin
  perform public.exiger_admin(p_auteur);
  select e.publie_le into v_publie from public.evenement e where e.id = p_id for update;
  if not found then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_publie is null then
    return;
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.evenement set publie_le = null where id = p_id;
end;
$$;

revoke all on function public.depublier_evenement(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.depublier_evenement(jsonb, uuid) to service_role;

-- enregistrer_reglage : même fonction qu'en 20261117100000 avec la clé frais_annulation_pass (entier de 0 à 100, en pourcentage).
create or replace function public.enregistrer_reglage(p_auteur jsonb, p_cle text, p_valeur text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_valeur text;
  v_texte text;
  v_entier bigint;
begin
  perform public.exiger_admin(p_auteur);
  if p_cle is null or p_cle not in (
    'nom_site', 'numero_whatsapp',
    'forfait_livraison_goma_cents', 'forfait_livraison_bukavu_cents',
    'retrait_goma_fr', 'retrait_goma_en',
    'plafond_fabrication', 'delai_paiement', 'frais_annulation_pass'
  ) then
    raise exception 'KS_REGLAGE_INCONNU' using errcode = 'P0001';
  end if;

  if p_cle = 'nom_site' then
    v_valeur := btrim(coalesce(p_valeur, ''));
    if char_length(v_valeur) < 1 or char_length(v_valeur) > 60 then
      raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
    end if;
  elsif p_cle = 'numero_whatsapp' then
    v_valeur := nullif(regexp_replace(coalesce(p_valeur, ''), '\s', '', 'g'), '');
    if v_valeur is not null and v_valeur !~ '^\+[0-9]{8,15}$' then
      raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
    end if;
  elsif p_cle in ('forfait_livraison_goma_cents', 'forfait_livraison_bukavu_cents') then
    v_texte := btrim(coalesce(p_valeur, ''));
    if v_texte = '' then
      v_valeur := null;
    else
      if v_texte !~ '^[0-9]{1,6}$' then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_entier := v_texte::bigint;
      if v_entier > 100000 then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_valeur := v_entier::text;
    end if;
  elsif p_cle in ('retrait_goma_fr', 'retrait_goma_en') then
    v_valeur := nullif(btrim(coalesce(p_valeur, '')), '');
    if v_valeur is not null and char_length(v_valeur) > 500 then
      raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
    end if;
  elsif p_cle = 'delai_paiement' then
    -- Minutes laissées au client pour payer une Commande en attente (1 à 1440, soit 24 heures). Vide : effacé.
    v_texte := btrim(coalesce(p_valeur, ''));
    if v_texte = '' then
      v_valeur := null;
    else
      if v_texte !~ '^[0-9]{1,4}$' then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_entier := v_texte::bigint;
      if v_entier < 1 or v_entier > 1440 then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_valeur := v_entier::text;
    end if;
  elsif p_cle = 'frais_annulation_pass' then
    -- Pourcentage retenu lors de l'annulation d'un Pass (0 à 100, entier). Vide : effacé, aucune annulation de Pass acceptée (règle 15).
    v_texte := btrim(coalesce(p_valeur, ''));
    if v_texte = '' then
      v_valeur := null;
    else
      if v_texte !~ '^[0-9]{1,3}$' then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_entier := v_texte::bigint;
      if v_entier > 100 then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_valeur := v_entier::text;
    end if;
  else
    -- plafond_fabrication
    v_texte := btrim(coalesce(p_valeur, ''));
    if v_texte = '' then
      v_valeur := null;
    else
      if v_texte !~ '^[0-9]{1,5}$' then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_entier := v_texte::bigint;
      if v_entier < 1 or v_entier > 10000 then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_valeur := v_entier::text;
    end if;
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  insert into public.reglage (cle, valeur, mis_a_jour_le)
  values (p_cle, v_valeur, now())
  on conflict (cle) do update set valeur = excluded.valeur, mis_a_jour_le = excluded.mis_a_jour_le;
end;
$$;
