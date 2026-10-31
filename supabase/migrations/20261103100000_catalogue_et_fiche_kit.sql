-- Story 3.3 : catalogue Kits et fiche Kit ; sous-titres de l'extrait public (décision de Jonathan du 2026-10-31).
-- 1. video_kit : extrait_sans_parole, extrait_sous_titres (langues déposées chez Bunny, bibliothèque publique), extrait_le.
-- 2. Remplacer ou retirer l'extrait vide ses sous-titres, remet « sans parole » à faux et repose extrait_le (déclencheur BEFORE).
-- 3. Écritures (admin) : enregistrer_sous_titres_extrait_kit, supprimer_sous_titres_extrait_kit, definir_extrait_sans_parole.
-- 4. manques_publication : sous_titres_extrait_fr quand un extrait existe, n'est pas « sans parole » et n'a pas de sous-titres français.
--    Amendement de la revue 1 : publier_produit l'exige, la garde différée (exiger_produit_publie_complet) ne le compte pas.
-- 5. lister_catalogue recréée (drop + nouveau grant) avec p_niveau ; famille inconnue refusée ; Kit : ni filtre de disponibilité, ni variante.
-- Même schéma de sécurité que les stories précédentes : SECURITY DEFINER, search_path vide, p_auteur en premier, exiger_admin, ks.auteur posé
-- avant l'écriture, service_role seulement. Les migrations précédentes ne sont pas modifiées.

-- 1. Colonnes de l'extrait (données publiables, lisibles avec video_kit pour un Kit publié : aucun identifiant privé).
alter table public.video_kit
  add column extrait_sans_parole boolean not null default false,
  add column extrait_sous_titres text[] not null default '{}'
    constraint video_kit_extrait_sous_titres_langues check (extrait_sous_titres <@ array['fr', 'en']::text[]),
  add column extrait_le timestamptz;

-- Extraits déjà enregistrés : leur date d'enregistrement n'a pas été gardée ; la date de cette migration est la seule connue.
select set_config('ks.auteur', '{"type":"migration","nom":"catalogue_et_fiche_kit"}', true);
update public.video_kit set extrait_le = now() where extrait_bunny_id is not null and extrait_le is null;

-- 2. Extrait remplacé ou retiré : ses sous-titres n'existent plus (ils sont attachés à la vidéo d'extrait chez Bunny), la case « sans parole »
-- repasse à faux ; extrait_le est posé à l'enregistrement d'un extrait, effacé à son retrait.
create function public.video_kit_extrait_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.extrait_sous_titres := '{}';
    new.extrait_le := case when new.extrait_bunny_id is null then null else now() end;
  elsif new.extrait_bunny_id is distinct from old.extrait_bunny_id then
    -- Un nouvel extrait repart « parlé » : la case « Extrait sans parole » est remise à faux (amendement de la revue 1).
    new.extrait_sous_titres := '{}';
    new.extrait_sans_parole := false;
    new.extrait_le := case when new.extrait_bunny_id is null then null else now() end;
  end if;
  return new;
end;
$$;

revoke all on function public.video_kit_extrait_change() from public, anon, authenticated;

create trigger video_kit_extrait_change
  before insert or update on public.video_kit
  for each row execute function public.video_kit_extrait_change();

-- 3. Sous-titres de l'extrait (admin). Le fichier est déjà déposé chez Bunny par le serveur (après vérification WebVTT) : la base enregistre
-- seulement la langue. L'extrait doit exister (KS_EXTRAIT_ABSENT).
create function public.enregistrer_sous_titres_extrait_kit(p_auteur jsonb, p_produit_id uuid, p_langue text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_extrait uuid;
  v_langues text[];
begin
  perform public.exiger_admin(p_auteur);
  perform public.verrouiller_kit(p_produit_id);
  if p_langue is null or p_langue not in ('fr', 'en') then
    raise exception 'KS_LANGUE_INVALIDE' using errcode = 'P0001';
  end if;
  select v.extrait_bunny_id, v.extrait_sous_titres into v_extrait, v_langues from public.video_kit v where v.produit_id = p_produit_id;
  if not found then
    raise exception 'KS_VIDEO_ABSENTE' using errcode = 'P0001';
  end if;
  if v_extrait is null then
    raise exception 'KS_EXTRAIT_ABSENT' using errcode = 'P0001';
  end if;
  if p_langue = any (v_langues) then
    return;
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.video_kit
  set extrait_sous_titres = array(select l from unnest(v_langues || p_langue) l order by l desc)
  where produit_id = p_produit_id;
end;
$$;

revoke all on function public.enregistrer_sous_titres_extrait_kit(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.enregistrer_sous_titres_extrait_kit(jsonb, uuid, text) to service_role;

-- Retire une langue des sous-titres de l'extrait ; le serveur les efface chez Bunny APRÈS cette réponse. Sur un Kit publié, retirer le français
-- d'un extrait parlé est permis : la fiche publique cesse alors de montrer l'extrait.
create function public.supprimer_sous_titres_extrait_kit(p_auteur jsonb, p_produit_id uuid, p_langue text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_langues text[];
begin
  perform public.exiger_admin(p_auteur);
  perform public.verrouiller_kit(p_produit_id);
  if p_langue is null or p_langue not in ('fr', 'en') then
    raise exception 'KS_LANGUE_INVALIDE' using errcode = 'P0001';
  end if;
  select v.extrait_sous_titres into v_langues from public.video_kit v where v.produit_id = p_produit_id;
  if not found or not (p_langue = any (v_langues)) then
    raise exception 'KS_SOUS_TITRES_INTROUVABLES' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.video_kit set extrait_sous_titres = array_remove(v_langues, p_langue) where produit_id = p_produit_id;
end;
$$;

revoke all on function public.supprimer_sous_titres_extrait_kit(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.supprimer_sous_titres_extrait_kit(jsonb, uuid, text) to service_role;

-- Case « Extrait sans parole » (admin). Décochée sur un Kit publié sans sous-titres français d'extrait : la fiche publique cache l'extrait.
create function public.definir_extrait_sans_parole(p_auteur jsonb, p_produit_id uuid, p_valeur boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_admin(p_auteur);
  perform public.verrouiller_kit(p_produit_id);
  if p_valeur is null then
    raise exception 'KS_VALEUR_INVALIDE' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.video_kit v where v.produit_id = p_produit_id) then
    raise exception 'KS_VIDEO_ABSENTE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.video_kit set extrait_sans_parole = p_valeur where produit_id = p_produit_id and extrait_sans_parole is distinct from p_valeur;
end;
$$;

revoke all on function public.definir_extrait_sans_parole(jsonb, uuid, boolean) from public, anon, authenticated;
grant execute on function public.definir_extrait_sans_parole(jsonb, uuid, boolean) to service_role;

-- 4. Garde différée (amendement de la revue 1) : sous_titres_extrait_fr est exigé par publier_produit, mais la garde ne le compte pas. Sur un
-- Kit publié, un extrait parlé peut donc être ajouté ou remplacé avant le dépôt de son .vtt français ; la fiche publique ne le montre pas
-- tant que ce fichier manque (ni lecteur ni VideoObject).
create or replace function public.exiger_produit_publie_complet()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if tg_table_name = 'produit' then
    v_id := new.id;
  elsif tg_op = 'DELETE' then
    v_id := old.produit_id;
  else
    v_id := new.produit_id;
  end if;
  if exists (select 1 from public.produit p where p.id = v_id and p.publie_le is not null)
     and cardinality(array_remove(public.manques_publication(v_id), 'sous_titres_extrait_fr')) > 0 then
    raise exception 'KS_PUBLICATION_INCOMPLETE' using errcode = 'P0001';
  end if;
  return null;
end;
$$;

revoke all on function public.exiger_produit_publie_complet() from public, anon, authenticated;

-- 4 bis. Ce qui manque pour publier : identique à la story 3.2, plus sous_titres_extrait_fr (en dernier).
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
  if btrim(coalesce(v_produit.titre_en, '')) = '' then
    v_manques := v_manques || 'titre_en'::text;
  end if;
  if btrim(coalesce(v_produit.description_fr, '')) = '' then
    v_manques := v_manques || 'description_fr'::text;
  end if;
  if btrim(coalesce(v_produit.description_en, '')) = '' then
    v_manques := v_manques || 'description_en'::text;
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
  if btrim(coalesce(v_produit.materiel_en, '')) = '' then
    v_manques := v_manques || 'materiel_en'::text;
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

-- 5. lister_catalogue : recréée avec p_niveau (en dernier : les appels positionnels existants restent valides) et la colonne niveau.
-- Famille inconnue : KS_FAMILLE_INVALIDE. Kit : aucune variante, disponibilité « disponible », p_dispo sans effet. Lecture pure,
-- security definer, prédicat « publié et passé » explicite. Aucune quantité n'est renvoyée.
drop function public.lister_catalogue(text, text, uuid, integer, integer, text, text, timestamptz, integer, uuid, integer);

create function public.lister_catalogue(
  p_famille text,
  p_langue text default 'fr',
  p_univers uuid default null,
  p_prix_bas integer default null,
  p_prix_haut integer default null,
  p_dispo text default null,
  p_tri text default 'nouveautes',
  p_curseur_date timestamptz default null,
  p_curseur_prix integer default null,
  p_curseur_id uuid default null,
  p_limite integer default 13,
  p_niveau text default null
)
returns table (
  id uuid,
  slug text,
  famille text,
  titre text,
  photo_alt text,
  photo_fichier text,
  prix_cents integer,
  univers_id uuid,
  disponibilite text,
  curseur_date text,
  niveau text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_famille is null or p_famille not in ('cosplay', 'accessoire', 'kit') then
    raise exception 'KS_FAMILLE_INVALIDE' using errcode = 'P0001';
  end if;
  return query
  with capacite as (
    select coalesce(public.capacite_fabrication_atteinte(), false) as atteinte
  )
  select
    p.id,
    p.slug,
    p.famille,
    case when p_langue = 'en' then coalesce(p.titre_en, p.titre_fr) else p.titre_fr end as titre,
    case when p_langue = 'en' then coalesce(nullif(btrim(ph.alt_en), ''), ph.alt_fr) else ph.alt_fr end as photo_alt,
    ph.fichier as photo_fichier,
    p.prix_cents,
    p.univers_id,
    case when p.famille = 'kit' then 'disponible' else d.etat end as disponibilite,
    p.publie_le::text as curseur_date,
    p.niveau as niveau
  from public.produit p
  cross join capacite c
  cross join lateral (
    select f.fichier, f.alt_fr, f.alt_en
    from public.produit_photo f
    where f.produit_id = p.id
    order by f.position asc
    limit 1
  ) ph
  cross join lateral (
    select coalesce(
      (array['disponible', 'dernieres_pieces', 'sur_commande', 'complet', 'epuise'])[
        min(public.rang_disponibilite(public.etat_disponibilite(public.stock_disponible(v.id), v.fabrication_sur_commande, c.atteinte)))
      ],
      'epuise'
    ) as etat
    from public.variante v
    where v.produit_id = p.id
  ) d
  where p.publie_le is not null and p.publie_le <= now()
    and p.famille = p_famille
    and p.prix_cents is not null
    and (p_univers is null or p.univers_id = p_univers)
    and (p_prix_bas is null or p.prix_cents >= p_prix_bas)
    and (p_prix_haut is null or p.prix_cents < p_prix_haut)
    and (p_niveau is null or p.niveau = p_niveau)
    and (
      p_famille = 'kit'
      or p_dispo is null
      or d.etat = p_dispo
      or (p_dispo = 'en_stock' and d.etat in ('disponible', 'dernieres_pieces'))
    )
    and (
      p_curseur_id is null
      or case p_tri
        when 'prix_asc' then (p.prix_cents, p.id) > (p_curseur_prix, p_curseur_id)
        when 'prix_desc' then (p.prix_cents, p.id) < (p_curseur_prix, p_curseur_id)
        else (p.publie_le, p.id) < (p_curseur_date, p_curseur_id)
      end
    )
  order by
    case when p_tri = 'prix_asc' then p.prix_cents end asc,
    case when p_tri = 'prix_asc' then p.id end asc,
    case when p_tri = 'prix_desc' then p.prix_cents end desc,
    case when p_tri = 'prix_desc' then p.id end desc,
    case when p_tri not in ('prix_asc', 'prix_desc') then p.publie_le end desc,
    case when p_tri not in ('prix_asc', 'prix_desc') then p.id end desc
  limit least(greatest(coalesce(p_limite, 13), 1), 300);
end;
$$;

revoke all on function public.lister_catalogue(text, text, uuid, integer, integer, text, text, timestamptz, integer, uuid, integer, text) from public;
grant execute on function public.lister_catalogue(text, text, uuid, integer, integer, text, text, timestamptz, integer, uuid, integer, text) to anon, authenticated, service_role;
