-- Story 2.6 : héros vidéo de l'accueil (FR-1, AD-18).
-- Une seule ligne (singleton) : Cosplay vedette, vidéo de la bibliothèque Bunny PUBLIQUE, photo de repli (bucket produits-public) et ses textes alternatifs.
-- Tout y est publiable (l'identifiant d'une vidéo publique figure dans son adresse) : lecture pour anon et authenticated ; aucune écriture directe,
-- seules les fonctions ci-dessous (SECURITY DEFINER, search_path vide, p_auteur en premier, exiger_admin, ks.auteur posé avant l'écriture,
-- service_role seulement). Les migrations précédentes ne sont pas modifiées.

create table public.heros_accueil (
  id boolean primary key default true check (id),
  -- Cosplay vedette : un cosplay publié au moment du choix ; s'il est dépublié ou supprimé, l'accueil n'en montre rien (la lecture publique passe par la RLS de produit).
  produit_id uuid references public.produit (id) on delete set null,
  -- Vidéo de la bibliothèque Bunny publique : identifiant enregistré à la fin de l'envoi, fichier MP4 enregistré seulement une fois l'encodage
  -- et le fichier vérifiés par le serveur (jamais avant : tant qu'il est nul, l'accueil montre la photo).
  video_id uuid,
  video_fichier text check (video_fichier ~ '^play_[0-9]{3,4}p[.]mp4$'),
  -- Photo de repli : objet du bucket produits-public heros/<uuid>.<jpg|png|webp>, avec ses deux textes alternatifs.
  repli_fichier text check (repli_fichier ~ '^heros/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$'),
  repli_alt_fr text check (char_length(repli_alt_fr) between 1 and 200),
  repli_alt_en text check (char_length(repli_alt_en) between 1 and 200),
  mis_a_jour_le timestamptz not null default now(),
  constraint heros_video_coherente check (video_fichier is null or video_id is not null),
  constraint heros_repli_coherent check ((repli_fichier is null) = (repli_alt_fr is null) and (repli_fichier is null) = (repli_alt_en is null))
);

alter table public.heros_accueil enable row level security;

revoke all on public.heros_accueil from public, anon, authenticated;
grant select on public.heros_accueil to anon, authenticated;

create policy heros_accueil_lecture_publique on public.heros_accueil
  for select to anon, authenticated
  using (true);

create trigger heros_accueil_journaliser
  after insert or update or delete on public.heros_accueil
  for each row execute function public.journaliser('id');

select set_config('ks.auteur', '{"type":"migration","nom":"heros_accueil"}', true);
insert into public.heros_accueil (id) values (true);

-- Choisit le Cosplay vedette (admin) : un cosplay publié. p_produit_id nul : retire la vedette.
create function public.choisir_vedette_heros(p_auteur jsonb, p_produit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_admin(p_auteur);
  if p_produit_id is not null and not exists (
    select 1 from public.produit p
    where p.id = p_produit_id and p.famille = 'cosplay' and p.publie_le is not null and p.publie_le <= now()
  ) then
    raise exception 'KS_VEDETTE_INVALIDE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.heros_accueil set produit_id = p_produit_id, mis_a_jour_le = now() where id;
end;
$$;

revoke all on function public.choisir_vedette_heros(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.choisir_vedette_heros(jsonb, uuid) to service_role;

-- Enregistre la vidéo envoyée (admin) : le fichier MP4 repasse à nul (à vérifier). Renvoie l'ancienne vidéo, que le serveur efface chez Bunny
-- APRÈS cette réponse. p_video_id nul : retire la vidéo.
create function public.enregistrer_video_heros(p_auteur jsonb, p_video_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ancien uuid;
begin
  perform public.exiger_admin(p_auteur);
  select h.video_id into v_ancien from public.heros_accueil h where h.id for update;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.heros_accueil set video_id = p_video_id, video_fichier = null, mis_a_jour_le = now() where id;
  if v_ancien is not distinct from p_video_id then
    return null;
  end if;
  return v_ancien;
end;
$$;

revoke all on function public.enregistrer_video_heros(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.enregistrer_video_heros(jsonb, uuid) to service_role;

-- Valide la vidéo (admin) : le serveur a vu l'encodage terminé et le MP4 sans piste audio. Refusé si la vidéo enregistrée n'est plus celle-là.
create function public.valider_video_heros(p_auteur jsonb, p_video_id uuid, p_fichier text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_courant uuid;
begin
  perform public.exiger_admin(p_auteur);
  if p_fichier is null or p_fichier !~ '^play_[0-9]{3,4}p[.]mp4$' then
    raise exception 'KS_FICHIER_INVALIDE' using errcode = 'P0001';
  end if;
  select h.video_id into v_courant from public.heros_accueil h where h.id for update;
  if v_courant is null or v_courant is distinct from p_video_id then
    raise exception 'KS_VIDEO_INTROUVABLE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.heros_accueil set video_fichier = p_fichier, mis_a_jour_le = now() where id;
end;
$$;

revoke all on function public.valider_video_heros(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.valider_video_heros(jsonb, uuid, text) to service_role;

-- Enregistre la photo de repli (admin) et ses textes alternatifs (1 à 200 caractères chacun, après rognage). Renvoie l'ancien objet (à effacer
-- du bucket APRÈS cette réponse). p_fichier nul : seuls les textes changent (une photo doit déjà exister).
create function public.enregistrer_repli_heros(p_auteur jsonb, p_fichier text, p_alt_fr text, p_alt_en text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alt_fr text := btrim(coalesce(p_alt_fr, ''));
  v_alt_en text := btrim(coalesce(p_alt_en, ''));
  v_ancien text;
begin
  perform public.exiger_admin(p_auteur);
  if char_length(v_alt_fr) < 1 or char_length(v_alt_fr) > 200 or char_length(v_alt_en) < 1 or char_length(v_alt_en) > 200 then
    raise exception 'KS_ALT_INVALIDE' using errcode = 'P0001';
  end if;
  select h.repli_fichier into v_ancien from public.heros_accueil h where h.id for update;
  if p_fichier is null then
    if v_ancien is null then
      raise exception 'KS_PHOTO_INTROUVABLE' using errcode = 'P0001';
    end if;
    perform set_config('ks.auteur', p_auteur::text, true);
    update public.heros_accueil set repli_alt_fr = v_alt_fr, repli_alt_en = v_alt_en, mis_a_jour_le = now() where id;
    return null;
  end if;
  if p_fichier !~ '^heros/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|png|webp)$' then
    raise exception 'KS_FICHIER_INVALIDE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.heros_accueil
  set repli_fichier = p_fichier, repli_alt_fr = v_alt_fr, repli_alt_en = v_alt_en, mis_a_jour_le = now()
  where id;
  if v_ancien is not distinct from p_fichier then
    return null;
  end if;
  return v_ancien;
end;
$$;

revoke all on function public.enregistrer_repli_heros(jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.enregistrer_repli_heros(jsonb, text, text, text) to service_role;
