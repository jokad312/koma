-- Story 2.2 : photos et publication d'un produit physique (AD-2, AD-3, AD-18, AD-30).
-- Deux buckets : galerie-attente (privé : original envoyé par l'admin, lisible par le service seulement) et produits-public
-- (public : copie nettoyée de toute métadonnée par le serveur). Aucune politique sur storage.objects pour anon ni authenticated :
-- l'écriture passe par un jeton signé créé par le serveur, la lecture publique par l'adresse publique du bucket.
-- Écriture : aucune depuis anon ni authenticated ; seules les fonctions ci-dessous, SECURITY DEFINER, service_role seulement,
-- droit admin revérifié en base sur p_auteur (exiger_admin). Les migrations précédentes ne sont pas modifiées.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('galerie-attente', 'galerie-attente', false, 15728640, array['image/jpeg', 'image/png', 'image/webp']),
  ('produits-public', 'produits-public', true, 15728640, array['image/jpeg', 'image/png', 'image/webp']);

-- Photo d'un produit. « fichier » (et non « chemin ») : fichier d'un bucket public, lisible par anon avec son produit publié.
create table public.produit_photo (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references public.produit (id) on delete cascade,
  -- Objet du bucket produits-public : <produit>/<uuid>.<jpg|png|webp>.
  fichier text not null unique check (char_length(fichier) between 1 and 200),
  alt_fr text not null check (char_length(alt_fr) between 1 and 200),
  alt_en text not null check (char_length(alt_en) between 1 and 200),
  position integer not null check (position >= 1),
  cree_le timestamptz not null default now(),
  -- Vérifiée en fin d'instruction : un échange de positions passe par un état intermédiaire.
  constraint produit_photo_position_unique unique (produit_id, position) deferrable initially deferred
);

alter table public.produit_photo enable row level security;

revoke all on public.produit_photo from public, anon, authenticated;
grant select on public.produit_photo to anon, authenticated;

-- Les photos d'un brouillon (ou d'un produit publié dans le futur) sont introuvables côté public.
create policy produit_photo_lecture_publiee on public.produit_photo
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.produit p
      where p.id = produit_photo.produit_id and p.publie_le is not null and p.publie_le <= now()
    )
  );

create trigger produit_photo_journaliser
  after insert or update or delete on public.produit_photo
  for each row execute function public.journaliser('id');

-- Ce qui manque à un produit pour être publié, dans l'ordre : prix, photo, titre_en, description_fr, description_en, variante.
-- (Le titre français est déjà obligatoire ; le texte alternatif de chaque photo l'est à l'ajout.) Interne : service seulement.
-- Produit inconnu : null.
create function public.manques_publication(p_produit_id uuid)
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
  if btrim(coalesce(v_produit.titre_en, '')) = '' then
    v_manques := v_manques || 'titre_en'::text;
  end if;
  if btrim(coalesce(v_produit.description_fr, '')) = '' then
    v_manques := v_manques || 'description_fr'::text;
  end if;
  if btrim(coalesce(v_produit.description_en, '')) = '' then
    v_manques := v_manques || 'description_en'::text;
  end if;
  if not exists (select 1 from public.variante va where va.produit_id = p_produit_id) then
    v_manques := v_manques || 'variante'::text;
  end if;
  return v_manques;
end;
$$;

revoke all on function public.manques_publication(uuid) from public, anon, authenticated;
grant execute on function public.manques_publication(uuid) to service_role;

-- Ajoute une photo en dernière position (admin). 10 photos au plus par produit.
create function public.ajouter_photo_produit(p_auteur jsonb, p_produit_id uuid, p_fichier text, p_alt_fr text, p_alt_en text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alt_fr text := btrim(coalesce(p_alt_fr, ''));
  v_alt_en text := btrim(coalesce(p_alt_en, ''));
  v_position integer;
  v_id uuid;
begin
  perform public.exiger_admin(p_auteur);

  -- Verrou du produit : deux ajouts simultanés ne se partagent pas la même position ni ne dépassent la limite.
  perform 1 from public.produit p where p.id = p_produit_id for update;
  if not found then
    raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
  end if;

  if p_fichier is null
     or p_fichier !~ ('^' || p_produit_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$') then
    raise exception 'KS_FICHIER_INVALIDE' using errcode = 'P0001';
  end if;
  if char_length(v_alt_fr) < 1 or char_length(v_alt_fr) > 200 or char_length(v_alt_en) < 1 or char_length(v_alt_en) > 200 then
    raise exception 'KS_ALT_INVALIDE' using errcode = 'P0001';
  end if;

  select coalesce(max(ph.position), 0) + 1 into v_position from public.produit_photo ph where ph.produit_id = p_produit_id;
  if (select count(*) from public.produit_photo ph where ph.produit_id = p_produit_id) >= 10 then
    raise exception 'KS_PHOTOS_LIMITE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  begin
    insert into public.produit_photo (produit_id, fichier, alt_fr, alt_en, position)
    values (p_produit_id, p_fichier, v_alt_fr, v_alt_en, v_position)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'KS_FICHIER_INVALIDE' using errcode = 'P0001';
  end;
  return v_id;
end;
$$;

revoke all on function public.ajouter_photo_produit(jsonb, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.ajouter_photo_produit(jsonb, uuid, text, text, text) to service_role;

-- Déplace une photo d'un cran (p_sens : haut ou bas) et renumérote 1..n de façon contiguë.
-- En bout de liste : sans effet, sans erreur.
create function public.deplacer_photo_produit(p_auteur jsonb, p_photo_id uuid, p_sens text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produit uuid;
  v_rang integer;
  v_total integer;
  v_delta integer;
begin
  perform public.exiger_admin(p_auteur);
  if p_sens is null or p_sens not in ('haut', 'bas') then
    raise exception 'KS_SENS_INVALIDE' using errcode = 'P0001';
  end if;
  v_delta := case when p_sens = 'haut' then -1 else 1 end;

  select ph.produit_id into v_produit from public.produit_photo ph where ph.id = p_photo_id;
  if not found then
    raise exception 'KS_PHOTO_INTROUVABLE' using errcode = 'P0001';
  end if;
  perform 1 from public.produit p where p.id = v_produit for update;

  select o.rang, o.total into v_rang, v_total
  from (
    select ph.id, row_number() over (order by ph.position, ph.cree_le, ph.id) as rang, count(*) over () as total
    from public.produit_photo ph where ph.produit_id = v_produit
  ) o
  where o.id = p_photo_id;
  if v_rang is null then
    raise exception 'KS_PHOTO_INTROUVABLE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);

  -- Hors bornes : pas d'échange, mais les positions restent contiguës.
  if v_rang + v_delta < 1 or v_rang + v_delta > v_total then
    v_delta := 0;
  end if;

  update public.produit_photo ph
  set position = n.nouvelle
  from (
    select o.id,
      case
        when v_delta = 0 then o.rang
        when o.id = p_photo_id then o.rang + v_delta
        when o.rang = v_rang + v_delta then v_rang
        else o.rang
      end as nouvelle
    from (
      select x.id, row_number() over (order by x.position, x.cree_le, x.id) as rang
      from public.produit_photo x where x.produit_id = v_produit
    ) o
  ) n
  where ph.id = n.id and ph.position <> n.nouvelle;
end;
$$;

revoke all on function public.deplacer_photo_produit(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.deplacer_photo_produit(jsonb, uuid, text) to service_role;

-- Publie un produit (admin) : refusé s'il manque quelque chose (KS_PUBLICATION_INCOMPLETE), sinon pose publie_le = now().
-- Déjà publié : sans effet.
create function public.publier_produit(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publie timestamptz;
begin
  perform public.exiger_admin(p_auteur);
  select p.publie_le into v_publie from public.produit p where p.id = p_id for update;
  if not found then
    raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_publie is not null then
    return;
  end if;
  if cardinality(public.manques_publication(p_id)) > 0 then
    raise exception 'KS_PUBLICATION_INCOMPLETE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.produit set publie_le = now() where id = p_id;
end;
$$;

revoke all on function public.publier_produit(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.publier_produit(jsonb, uuid) to service_role;

-- Dépublie un produit (admin) : publie_le remis à nul. Déjà brouillon : sans effet.
create function public.depublier_produit(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publie timestamptz;
begin
  perform public.exiger_admin(p_auteur);
  select p.publie_le into v_publie from public.produit p where p.id = p_id for update;
  if not found then
    raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_publie is null then
    return;
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.produit set publie_le = null where id = p_id;
end;
$$;

revoke all on function public.depublier_produit(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.depublier_produit(jsonb, uuid) to service_role;

-- Un produit publié ne change ni d'adresse ni de famille (son adresse est publique).
create function public.verrouiller_produit_publie()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.publie_le is not null and (new.slug is distinct from old.slug or new.famille is distinct from old.famille) then
    raise exception 'KS_PRODUIT_PUBLIE_VERROUILLE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.verrouiller_produit_publie() from public, anon, authenticated;

create trigger produit_verrou_publie
  before update on public.produit
  for each row execute function public.verrouiller_produit_publie();

-- Tient modifie_le à jour à chaque modification d'un produit.
create function public.toucher_modifie_le()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.modifie_le := now();
  return new;
end;
$$;

revoke all on function public.toucher_modifie_le() from public, anon, authenticated;

create trigger produit_modifie_le
  before update on public.produit
  for each row execute function public.toucher_modifie_le();

-- Contrôle différé (fin de transaction) : un produit publié ne devient jamais incomplet (prix effacé, dernière variante supprimée…).
-- La transaction d'enregistrer_produit remplace les variantes : seul l'état final compte.
create function public.exiger_produit_publie_complet()
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
     and cardinality(public.manques_publication(v_id)) > 0 then
    raise exception 'KS_PUBLICATION_INCOMPLETE' using errcode = 'P0001';
  end if;
  return null;
end;
$$;

revoke all on function public.exiger_produit_publie_complet() from public, anon, authenticated;

create constraint trigger produit_publie_complet
  after insert or update on public.produit
  deferrable initially deferred
  for each row execute function public.exiger_produit_publie_complet();

create constraint trigger variante_produit_publie_complet
  after insert or update or delete on public.variante
  deferrable initially deferred
  for each row execute function public.exiger_produit_publie_complet();
