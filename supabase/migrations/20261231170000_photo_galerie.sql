-- Story 8.1 : envoyer sa photo depuis son Compte (FR-40, FR-41, AD-18, AD-22, AD-34). Module communaute.
-- - photo_galerie : la photo envoyée (original nettoyé, rangé dans le bucket privé galerie-attente sous photos-clients/), les choix
--   d'affichage (pseudo, ville) et l'état réel (en_attente, publiee, retiree). Aucun droit client : lecture et écriture par le serveur.
-- - L'accord de publication (texte fourni par Jonathan le 2026-11-08) est un consentement « publication_photo » propre à chaque photo
--   (cible_id), avec sa version et sa date. Une désinscription des emails ne le retire jamais.
-- - Règles de Jonathan (2026-11-08) : publication seulement après validation de l'admin (story 8.2) ; retrait sur simple demande ;
--   métadonnées retirées ; un Compte qui a déclaré moins de 18 ans ne peut pas envoyer de photo (elle ne serait jamais publiée).

alter table public.consentement add column cible_id uuid;
alter table public.consentement drop constraint consentement_objet_check;
alter table public.consentement add constraint consentement_objet_check check (objet in ('relances', 'nouveautes', 'alertes_festival', 'publication_photo'));
alter table public.consentement drop constraint consentement_source_check;
alter table public.consentement add constraint consentement_source_check check (source in ('creation_compte', 'commande', 'preferences', 'photo'));
alter table public.consentement add constraint consentement_cible_coherente check ((objet = 'publication_photo') = (cible_id is not null));
-- Un accord par photo : l'unicité « un consentement actif par objet » ne vaut que pour les emails.
drop index public.consentement_actif_unique;
create unique index consentement_actif_unique on public.consentement (compte_id, objet) where retire_le is null and objet <> 'publication_photo';
create unique index consentement_photo_unique on public.consentement (cible_id) where objet = 'publication_photo';

create table public.photo_galerie (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid not null references auth.users (id) on delete cascade,
  objet text not null unique check (objet ~ '^photos-clients/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'),
  statut text not null default 'en_attente' check (statut in ('en_attente', 'publiee', 'retiree')),
  -- Choix d'affichage : null = ne pas afficher.
  nom_affiche text check (nom_affiche is null or (char_length(nom_affiche) between 1 and 40 and nom_affiche !~ '[[:cntrl:]]')),
  ville text check (ville is null or (char_length(ville) between 1 and 60 and ville !~ '[[:cntrl:]]')),
  retrait_demande_le timestamptz,
  retiree_le timestamptz,
  cree_le timestamptz not null default now(),
  constraint photo_retiree_coherente check ((statut = 'retiree') = (retiree_le is not null))
);
create index photo_galerie_compte_idx on public.photo_galerie (compte_id, cree_le desc);
alter table public.photo_galerie enable row level security;
revoke all on public.photo_galerie from public, anon, authenticated;
create trigger photo_galerie_journaliser
  after insert or update or delete on public.photo_galerie
  for each row execute function public.journaliser('id');

-- Désinscription des emails (story 9.4) : seuls les consentements aux emails sont retirés, jamais un accord de publication.
create or replace function public.desinscrire(p_compte uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dernier_don timestamptz;
  c_emails constant text[] := array['relances', 'nouveautes', 'alertes_festival'];
begin
  if p_compte is null or not exists (select 1 from auth.users where id = p_compte) then
    return false;
  end if;
  perform set_config('ks.auteur', jsonb_build_object('type', 'systeme', 'nom', 'lien_desinscription', 'compte', p_compte)::text, true);
  perform pg_advisory_xact_lock(hashtextextended('consentement:' || p_compte::text, 0));
  select max(donne_le) into v_dernier_don from public.consentement where compte_id = p_compte and objet = any (c_emails);
  if not exists (select 1 from public.consentement where compte_id = p_compte and objet = any (c_emails) and retire_le is null)
     and exists (select 1 from public.desinscription where compte_id = p_compte and cree_le >= coalesce(v_dernier_don, '-infinity'::timestamptz)) then
    return true;
  end if;
  insert into public.desinscription (compte_id) values (p_compte);
  update public.consentement set retire_le = now() where compte_id = p_compte and objet = any (c_emails) and retire_le is null;
  return true;
end;
$$;

-- Enregistre une photo envoyée et son accord de publication (après contrôle du contenu et nettoyage par le serveur).
create function public.deposer_photo_galerie(p_auteur jsonb, p_objet text, p_nom text, p_ville text, p_version_accord text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_nom text := nullif(btrim(coalesce(p_nom, '')), '');
  v_ville text := nullif(btrim(coalesce(p_ville, '')), '');
  v_id uuid;
begin
  v_compte := public.exiger_client(p_auteur);
  if public.est_mineur(v_compte) then
    raise exception 'KS_PHOTO_MINEUR' using errcode = 'P0001';
  end if;
  if p_version_accord is null or char_length(p_version_accord) not between 1 and 50 then
    raise exception 'KS_ACCORD_MANQUANT' using errcode = 'P0001';
  end if;
  if (v_nom is not null and (char_length(v_nom) > 40 or v_nom ~ '[[:cntrl:]]')) or (v_ville is not null and (char_length(v_ville) > 60 or v_ville ~ '[[:cntrl:]]')) then
    raise exception 'KS_AFFICHAGE_INVALIDE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  insert into public.photo_galerie (compte_id, objet, nom_affiche, ville) values (v_compte, p_objet, v_nom, v_ville) returning id into v_id;
  insert into public.consentement (compte_id, objet, version, source, cible_id) values (v_compte, 'publication_photo', p_version_accord, 'photo', v_id);
  return v_id;
end;
$$;

-- Photos du Compte, la plus récente d'abord, avec leur état réel.
create function public.lister_mes_photos(p_compte uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'objet', p.objet, 'statut', p.statut, 'nom_affiche', p.nom_affiche, 'ville', p.ville,
    'retrait_demande_le', p.retrait_demande_le, 'cree_le', p.cree_le
  ) order by p.cree_le desc, p.id), '[]'::jsonb)
  from public.photo_galerie p
  where p.compte_id = p_compte
$$;

-- Retrait demandé par le client. Photo en attente (jamais publiée) : retirée aussitôt, accord retiré, l'original est effacé par le serveur.
-- Photo publiée : la demande est enregistrée, l'admin la retire (story 8.2). Renvoie 'retiree', 'demande' ou 'deja_retiree', et l'objet.
create function public.retirer_photo(p_auteur jsonb, p_photo uuid)
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
  if v_p.statut = 'retiree' then
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

revoke all on function public.deposer_photo_galerie(jsonb, text, text, text, text) from public, anon, authenticated;
revoke all on function public.lister_mes_photos(uuid) from public, anon, authenticated;
revoke all on function public.retirer_photo(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.deposer_photo_galerie(jsonb, text, text, text, text) to service_role;
grant execute on function public.lister_mes_photos(uuid) to service_role;
grant execute on function public.retirer_photo(jsonb, uuid) to service_role;
