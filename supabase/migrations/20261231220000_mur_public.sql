-- Préparation de la story 8.3 : lecture publique du mur « Ils le portent » (FR-40, FR-42, AD-17, AD-18). Module communaute.
-- - Texte alternatif des photos de la galerie (règle 7) : saisi par le personnel à la validation (décision de Jonathan du 2026-11-10),
--   en français et en anglais, obligatoire pour toute photo publiée. valider_photo est réécrite depuis sa dernière version (story 8.4).
-- - lister_mur_public : seule lecture publique de la galerie, exécutable par anon et authenticated. Une fonction plutôt qu'une vue :
--   photo_galerie n'a aucun droit client (RLS sans politique) ; une vue lisible par anon devrait tourner avec les droits de son
--   propriétaire (« security definer view », signalée par le conseiller de sécurité de Supabase) et ne pourrait ni plafonner la limite
--   ni porter la pagination. La fonction renvoie une liste fermée de colonnes, jamais l'original, un Compte, un email ou un âge.

select set_config('ks.auteur', '{"type":"migration","nom":"mur_public"}', true);

alter table public.photo_galerie
  add column alt_fr text check (alt_fr is null or (char_length(alt_fr) between 1 and 200 and alt_fr !~ '[[:cntrl:]]')),
  add column alt_en text check (alt_en is null or (char_length(alt_en) between 1 and 200 and alt_en !~ '[[:cntrl:]]')),
  -- Aucune photo n'est publiée sur koma-dev au moment de cette migration (vérifié le 2026-11-10).
  add constraint photo_publiee_alt check (statut <> 'publiee' or (alt_fr is not null and alt_en is not null));

-- Validation (story 8.4, réécrite) : les deux textes alternatifs sont exigés (KS_ALT_INVALIDE) et enregistrés avec la publication.
drop function public.valider_photo(jsonb, uuid, text);
create function public.valider_photo(p_auteur jsonb, p_photo uuid, p_fichier_public text, p_alt_fr text, p_alt_en text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.photo_galerie;
  v_alt_fr text := btrim(coalesce(p_alt_fr, ''));
  v_alt_en text := btrim(coalesce(p_alt_en, ''));
begin
  perform public.exiger_personnel(p_auteur);
  if char_length(v_alt_fr) not between 1 and 200 or char_length(v_alt_en) not between 1 and 200
     or v_alt_fr ~ '[[:cntrl:]]' or v_alt_en ~ '[[:cntrl:]]' then
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

-- Mur public (story 8.3). Photos publiées seulement : jamais en attente, refusées ou retirées ; une photo dont le retrait est demandé
-- quitte le mur aussitôt (retrait sur simple demande), comme celle d'un Compte devenu mineur ou dont l'accord a été retiré.
--   fichier : la copie publiée (bucket public produits-public, galerie/<uuid>.<ext>), jamais l'original du bucket privé galerie-attente.
--   pseudo : le nom choisi par la personne, null si elle n'a pas voulu l'afficher.
--   type : photo ou realisation ; fait_avec_kit : vrai pour une Réalisation validée (« Fait avec un kit KOMA »).
--   kit_slug, kit_titre_fr, kit_titre_en : seulement si le Kit de la Réalisation est publié (sinon null : pas de lien).
-- Tri : validation la plus récente d'abord, puis identifiant. Curseur : valide_le et id de la dernière ligne vue (curseur_date est
-- valide_le en texte, microsecondes conservées, à rendre tel quel). p_limite : 24 par défaut, bornée de 1 à 24.
create function public.lister_mur_public(
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
    p.publiee_le::text
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
    and (
      p_curseur_date is null or p_curseur_id is null
      or p.publiee_le < p_curseur_date
      or (p.publiee_le = p_curseur_date and p.id < p_curseur_id)
    )
  order by p.publiee_le desc, p.id desc
  limit least(greatest(coalesce(p_limite, 24), 1), 24)
$$;

revoke all on function public.valider_photo(jsonb, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.valider_photo(jsonb, uuid, text, text, text) to service_role;
revoke all on function public.lister_mur_public(timestamptz, uuid, integer) from public;
grant execute on function public.lister_mur_public(timestamptz, uuid, integer) to anon, authenticated, service_role;
