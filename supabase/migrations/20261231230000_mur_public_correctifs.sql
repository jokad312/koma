-- Correctifs de la revue croisée de 20261231220000_mur_public.sql (déjà appliquée, donc non modifiée) :
-- - curseur_date au format ISO 8601 UTC fixe (microsecondes), indépendant de DateStyle et TimeZone de la session ;
-- - curseur par comparaison de lignes (publiee_le, id) et index partiel sur le tri du mur ;
-- - textes alternatifs : espaces Unicode retirés aux deux bouts, caractères invisibles refusés (mêmes règles que le serveur Next.js).
-- valider_photo et lister_mur_public sont réécrites depuis leur dernière version (20261231220000).

select set_config('ks.auteur', '{"type":"migration","nom":"mur_public_correctifs"}', true);

create index photo_galerie_mur_idx on public.photo_galerie (publiee_le desc, id desc) where statut = 'publiee';

-- Texte alternatif nettoyé : espaces (ASCII et Unicode) retirés aux deux bouts ; null s'il est vide, trop long (200 caractères) ou s'il
-- contient un caractère de contrôle ou invisible (format, bidi, espace sans chasse, trait d'union conditionnel).
create function public.alt_nettoye(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when v is null or char_length(v) not between 1 and 200 then null
    when v ~ '[[:cntrl:]­؜᠎​-‏‪-‮⁠-⁤⁦-⁯﻿￹-￻]' then null
    else v
  end
  from (select nullif(regexp_replace(coalesce(p, ''), '^[[:space:]   -     　]+|[[:space:]   -     　]+$', '', 'g'), '') as v) s
$$;
revoke all on function public.alt_nettoye(text) from public, anon, authenticated;

create or replace function public.valider_photo(p_auteur jsonb, p_photo uuid, p_fichier_public text, p_alt_fr text, p_alt_en text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.photo_galerie;
  v_alt_fr text := public.alt_nettoye(p_alt_fr);
  v_alt_en text := public.alt_nettoye(p_alt_en);
begin
  perform public.exiger_personnel(p_auteur);
  if v_alt_fr is null or v_alt_en is null then
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

-- Mur public (voir 20261231220000). curseur_date : valide_le en ISO 8601 UTC avec microsecondes (« 2026-11-10T08:15:30.123456Z »),
-- à rendre tel quel dans p_curseur_date. Un curseur incomplet (un seul des deux paramètres) ramène à la première page.
create or replace function public.lister_mur_public(
  p_curseur_date timestamptz default null,
  p_curseur_id uuid default null,
  p_limite integer default 24
)
returns table (
  id uuid,
  fichier text,
  alt_fr text,
  alt_en text,
  pseudo text,
  valide_le timestamptz,
  type text,
  fait_avec_kit boolean,
  kit_slug text,
  kit_titre_fr text,
  kit_titre_en text,
  curseur_date text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    p.fichier_public,
    p.alt_fr,
    p.alt_en,
    p.nom_affiche,
    p.publiee_le,
    case when r.validee_le is not null then 'realisation' else 'photo' end,
    r.validee_le is not null,
    case when k.id is not null then k.slug end,
    case when k.id is not null then k.titre_fr end,
    case when k.id is not null then k.titre_en end,
    to_char(p.publiee_le at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
  from public.photo_galerie p
  left join public.realisation r on r.photo_id = p.id and r.validee_le is not null
  left join public.produit k on k.id = r.produit_id and k.famille = 'kit' and k.publie_le is not null and k.publie_le <= now()
  where p.statut = 'publiee'
    and p.fichier_public is not null
    and p.publiee_le is not null
    and p.retiree_le is null
    and p.retrait_demande_le is null
    and p.alt_fr is not null
    and p.alt_en is not null
    and (p.compte_id is null or not public.est_mineur(p.compte_id))
    and exists (select 1 from public.consentement c where c.cible_id = p.id and c.objet = 'publication_photo' and c.retire_le is null)
    and (p_curseur_date is null or p_curseur_id is null or (p.publiee_le, p.id) < (p_curseur_date, p_curseur_id))
  order by p.publiee_le desc, p.id desc
  limit least(greatest(coalesce(p_limite, 24), 1), 24)
$$;
