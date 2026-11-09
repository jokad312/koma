-- Story 8.2 : validation, dépôt WhatsApp et retrait des photos (FR-40, FR-41, AD-18, AD-21, AD-34). Droit galerie.valider : Admin et Assistant
-- (exiger_personnel). Décisions de Jonathan (2026-11-08) : publication seulement après validation ; dépôt WhatsApp avec la case « La personne
-- m'a confirmé avoir 18 ans ou plus », refusé si la photo est rattachée à un Compte mineur ; retrait sur simple demande.
-- - photo_galerie : statut « refusee », copie publique (produits-public, galerie/), source (compte ou whatsapp), accord WhatsApp daté,
--   confirmation de majorité, capture de l'accord (bucket privé accords-whatsapp, sans aucune politique), auteur de la décision.
-- - consentement : un accord de publication reçu par WhatsApp peut ne pas avoir de Compte (personne sans Compte).

select set_config('ks.auteur', '{"type":"migration","nom":"galerie_validation"}', true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('accords-whatsapp', 'accords-whatsapp', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

alter table public.photo_galerie drop constraint photo_galerie_statut_check;
alter table public.photo_galerie add constraint photo_galerie_statut_check check (statut in ('en_attente', 'publiee', 'refusee', 'retiree'));
alter table public.photo_galerie alter column compte_id drop not null;
alter table public.photo_galerie
  add column source text not null default 'compte' check (source in ('compte', 'whatsapp')),
  add column fichier_public text unique check (fichier_public is null or fichier_public ~ '^galerie/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'),
  add column publiee_le timestamptz,
  add column refusee_le timestamptz,
  add column accord_whatsapp_le date,
  add column majeur_confirme_le timestamptz,
  add column capture_accord text check (capture_accord is null or capture_accord ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'),
  add column decide_par jsonb;
alter table public.photo_galerie
  add constraint photo_source_coherente check (
    (source = 'compte' and compte_id is not null)
    or (source = 'whatsapp' and accord_whatsapp_le is not null and majeur_confirme_le is not null)
  ),
  add constraint photo_publiee_coherente check ((statut = 'publiee') = (fichier_public is not null and publiee_le is not null)),
  add constraint photo_refusee_coherente check ((statut = 'refusee') = (refusee_le is not null));

alter table public.consentement alter column compte_id drop not null;
alter table public.consentement drop constraint consentement_source_check;
alter table public.consentement add constraint consentement_source_check check (source in ('creation_compte', 'commande', 'preferences', 'photo', 'whatsapp'));
alter table public.consentement add constraint consentement_compte_requis check (compte_id is not null or (objet = 'publication_photo' and source = 'whatsapp'));

-- Retrait demandé par le client (story 8.1), réécrit depuis sa dernière version : une photo refusée est traitée comme déjà retirée.
create or replace function public.retirer_photo(p_auteur jsonb, p_photo uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_p public.photo_galerie;
begin
  v_compte := public.exiger_client(p_auteur);
  select * into v_p from public.photo_galerie where id = p_photo and compte_id = v_compte for update;
  if not found then
    raise exception 'KS_PHOTO_INTROUVABLE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  if v_p.statut in ('retiree', 'refusee') then
    return jsonb_build_object('resultat', 'deja_retiree', 'objet', v_p.objet);
  end if;
  if v_p.statut = 'en_attente' then
    update public.photo_galerie set statut = 'retiree', retiree_le = now() where id = v_p.id;
    update public.consentement set retire_le = now() where cible_id = v_p.id and objet = 'publication_photo' and retire_le is null;
    return jsonb_build_object('resultat', 'retiree', 'objet', v_p.objet);
  end if;
  update public.photo_galerie set retrait_demande_le = coalesce(retrait_demande_le, now()) where id = v_p.id;
  return jsonb_build_object('resultat', 'demande', 'objet', v_p.objet);
end;
$$;

-- Compte d'un client retrouvé par son email (dépôt WhatsApp) : null s'il n'existe pas. Réservée au personnel.
create function public.trouver_compte_par_email(p_auteur jsonb, p_email text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_personnel(p_auteur);
  if p_email is null or char_length(btrim(p_email)) not between 3 and 320 then
    return null;
  end if;
  return (select id from auth.users where lower(email) = lower(btrim(p_email)) limit 1);
end;
$$;

-- Photos à traiter par le personnel : en attente (la plus ancienne d'abord), retraits demandés, puis publiées (la plus récente d'abord).
create function public.lister_photos_admin(p_auteur jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_personnel(p_auteur);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'objet', p.objet, 'fichier_public', p.fichier_public, 'statut', p.statut, 'source', p.source,
      'nom_affiche', p.nom_affiche, 'ville', p.ville, 'retrait_demande_le', p.retrait_demande_le, 'cree_le', p.cree_le,
      'publiee_le', p.publiee_le, 'accord_whatsapp_le', p.accord_whatsapp_le, 'capture', p.capture_accord is not null
    ) order by case p.statut when 'en_attente' then 0 else 1 end, p.retrait_demande_le nulls last, p.cree_le)
    from public.photo_galerie p
    where p.statut in ('en_attente', 'publiee')
  ), '[]'::jsonb);
end;
$$;

-- Compteurs réels des tâches « Photos à valider » et « Retraits demandés » (AD-21).
create function public.compter_photos_a_traiter()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'a_valider', (select count(*) from public.photo_galerie where statut = 'en_attente'),
    'retraits', (select count(*) from public.photo_galerie where statut = 'publiee' and retrait_demande_le is not null)
  )
$$;

-- Validation : la copie publique (déjà écrite par le serveur, métadonnées retirées) devient la photo du mur. Un Compte mineur n'est jamais publié.
create function public.valider_photo(p_auteur jsonb, p_photo uuid, p_fichier_public text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.photo_galerie;
begin
  perform public.exiger_personnel(p_auteur);
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
  update public.photo_galerie set statut = 'publiee', fichier_public = p_fichier_public, publiee_le = now(), decide_par = p_auteur where id = v_p.id;
end;
$$;

-- Refus : la photo n'est jamais publiée ; l'accord est retiré ; l'original est effacé par le serveur.
create function public.refuser_photo(p_auteur jsonb, p_photo uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.photo_galerie;
begin
  perform public.exiger_personnel(p_auteur);
  select * into v_p from public.photo_galerie where id = p_photo for update;
  if not found then
    raise exception 'KS_PHOTO_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_p.statut <> 'en_attente' then
    raise exception 'KS_PHOTO_DEJA_TRAITEE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.photo_galerie set statut = 'refusee', refusee_le = now(), decide_par = p_auteur where id = v_p.id;
  update public.consentement set retire_le = now() where cible_id = v_p.id and objet = 'publication_photo' and retire_le is null;
  return v_p.objet;
end;
$$;

-- Retrait par le personnel (demande du client, du formulaire de contact ou d'un parent) : la photo quitte le mur aussitôt ; le serveur
-- efface la copie publique et l'original, puis invalide le cache « galerie ». Renvoie les deux chemins.
create function public.retirer_photo_admin(p_auteur jsonb, p_photo uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.photo_galerie;
begin
  perform public.exiger_personnel(p_auteur);
  select * into v_p from public.photo_galerie where id = p_photo for update;
  if not found then
    raise exception 'KS_PHOTO_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_p.statut <> 'publiee' then
    raise exception 'KS_PHOTO_NON_PUBLIEE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.photo_galerie set statut = 'retiree', retiree_le = now(), fichier_public = null, publiee_le = null, decide_par = p_auteur where id = v_p.id;
  update public.consentement set retire_le = now() where cible_id = v_p.id and objet = 'publication_photo' and retire_le is null;
  return jsonb_build_object('fichier_public', v_p.fichier_public, 'objet', v_p.objet);
end;
$$;

-- Dépôt d'une photo reçue par WhatsApp (la copie nettoyée est déjà dans photos-clients/). Accord daté et majorité confirmée obligatoires ;
-- un Compte rattaché mineur est refusé ; sans Compte, le pseudo est obligatoire. La photo rejoint la file « À valider ».
create function public.deposer_photo_whatsapp(
  p_auteur jsonb, p_objet text, p_compte uuid, p_nom text, p_ville text, p_accord_le date, p_majeur boolean, p_capture text, p_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom text := nullif(btrim(coalesce(p_nom, '')), '');
  v_ville text := nullif(btrim(coalesce(p_ville, '')), '');
  v_id uuid;
begin
  perform public.exiger_personnel(p_auteur);
  if p_majeur is not true then
    raise exception 'KS_MAJORITE_NON_CONFIRMEE' using errcode = 'P0001';
  end if;
  if p_accord_le is null or p_accord_le > current_date or p_accord_le < current_date - 365 then
    raise exception 'KS_ACCORD_MANQUANT' using errcode = 'P0001';
  end if;
  if p_version is null or char_length(p_version) not between 1 and 50 then
    raise exception 'KS_ACCORD_MANQUANT' using errcode = 'P0001';
  end if;
  if p_compte is not null then
    if not exists (select 1 from auth.users where id = p_compte) then
      raise exception 'KS_COMPTE_INTROUVABLE' using errcode = 'P0001';
    end if;
    if public.est_mineur(p_compte) then
      raise exception 'KS_PHOTO_MINEUR' using errcode = 'P0001';
    end if;
  elsif v_nom is null then
    raise exception 'KS_AFFICHAGE_INVALIDE' using errcode = 'P0001';
  end if;
  if (v_nom is not null and (char_length(v_nom) > 40 or v_nom ~ '[[:cntrl:]]')) or (v_ville is not null and (char_length(v_ville) > 60 or v_ville ~ '[[:cntrl:]]')) then
    raise exception 'KS_AFFICHAGE_INVALIDE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  insert into public.photo_galerie (compte_id, objet, nom_affiche, ville, source, accord_whatsapp_le, majeur_confirme_le, capture_accord, decide_par)
  values (p_compte, p_objet, v_nom, v_ville, 'whatsapp', p_accord_le, now(), p_capture, p_auteur)
  returning id into v_id;
  insert into public.consentement (compte_id, objet, version, source, cible_id, donne_le)
  values (p_compte, 'publication_photo', p_version, 'whatsapp', v_id, p_accord_le::timestamptz);
  return v_id;
end;
$$;

revoke all on function public.trouver_compte_par_email(jsonb, text) from public, anon, authenticated;
revoke all on function public.lister_photos_admin(jsonb) from public, anon, authenticated;
revoke all on function public.compter_photos_a_traiter() from public, anon, authenticated;
revoke all on function public.valider_photo(jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.refuser_photo(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.retirer_photo_admin(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.deposer_photo_whatsapp(jsonb, text, uuid, text, text, date, boolean, text, text) from public, anon, authenticated;
grant execute on function public.trouver_compte_par_email(jsonb, text) to service_role;
grant execute on function public.lister_photos_admin(jsonb) to service_role;
grant execute on function public.compter_photos_a_traiter() to service_role;
grant execute on function public.valider_photo(jsonb, uuid, text) to service_role;
grant execute on function public.refuser_photo(jsonb, uuid) to service_role;
grant execute on function public.retirer_photo_admin(jsonb, uuid) to service_role;
grant execute on function public.deposer_photo_whatsapp(jsonb, text, uuid, text, text, date, boolean, text, text) to service_role;
