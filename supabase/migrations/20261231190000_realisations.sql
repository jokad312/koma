-- Story 8.4 : Réalisations (FR-42, AD-33). Module communaute.
-- - realisation : la photo d'un costume fabriqué avec un Kit PAYÉ (accès dont la Commande d'origine a un paye_le ; un Kit gratuit ne compte pas).
--   La photo elle-même vit dans photo_galerie (même envoi, même accord, même nettoyage qu'à la story 8.1) ; la Réalisation y ajoute le Kit
--   déclaré, la preuve d'achat (la Commande d'origine) et, à la validation, sa date et son rang (ordre des Réalisations validées).
-- - valider_photo et lister_photos_admin sont réécrites depuis leur dernière version (story 8.2, AD-1).

create table public.realisation (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null unique references public.photo_galerie (id) on delete cascade,
  compte_id uuid not null references auth.users (id) on delete cascade,
  produit_id uuid not null references public.produit (id) on delete restrict,
  commande_preuve uuid not null references public.commande (id) on delete restrict,
  cree_le timestamptz not null default now(),
  validee_le timestamptz,
  rang integer unique check (rang is null or rang >= 1),
  constraint realisation_validee_coherente check ((validee_le is null) = (rang is null))
);
create index realisation_compte_idx on public.realisation (compte_id);
alter table public.realisation enable row level security;
revoke all on public.realisation from public, anon, authenticated;
create trigger realisation_journaliser
  after insert or update or delete on public.realisation
  for each row execute function public.journaliser('id');

-- Kits payés du Compte (ceux qui peuvent être déclarés pour une Réalisation), titres dans les deux langues.
create function public.kits_payes(p_compte uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'titre_fr', p.titre_fr, 'titre_en', p.titre_en) order by p.titre_fr), '[]'::jsonb)
  from public.acces_kit a
  join public.commande c on c.id = a.commande_origine and c.paye_le is not null
  join public.produit p on p.id = a.produit_id and p.famille = 'kit'
  where a.compte_id = p_compte
$$;

-- Envoi d'une Réalisation : la photo (nettoyée par le serveur) et son accord comme à la story 8.1, puis le Kit déclaré, qui doit être payé.
create function public.deposer_realisation(p_auteur jsonb, p_objet text, p_nom text, p_ville text, p_version_accord text, p_kit uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_commande uuid;
  v_photo uuid;
begin
  v_compte := public.exiger_client(p_auteur);
  select a.commande_origine into v_commande
  from public.acces_kit a
  join public.commande c on c.id = a.commande_origine and c.paye_le is not null
  join public.produit p on p.id = a.produit_id and p.famille = 'kit'
  where a.compte_id = v_compte and a.produit_id = p_kit;
  if v_commande is null then
    raise exception 'KS_KIT_NON_PAYE' using errcode = 'P0001';
  end if;
  v_photo := public.deposer_photo_galerie(p_auteur, p_objet, p_nom, p_ville, p_version_accord);
  insert into public.realisation (photo_id, compte_id, produit_id, commande_preuve) values (v_photo, v_compte, p_kit, v_commande);
  return v_photo;
end;
$$;

-- Validation (story 8.2, réécrite) : pour une Réalisation, la validation est datée et fixe son rang (ordre des Réalisations validées).
create or replace function public.valider_photo(p_auteur jsonb, p_photo uuid, p_fichier_public text)
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
  if exists (select 1 from public.realisation where photo_id = v_p.id) then
    -- Deux validations simultanées ne prennent jamais le même rang.
    perform pg_advisory_xact_lock(hashtextextended('realisation:rang', 0));
    update public.realisation
      set validee_le = now(), rang = (select coalesce(max(rang), 0) + 1 from public.realisation)
      where photo_id = v_p.id;
  end if;
end;
$$;

-- File du personnel (story 8.2, réécrite) : chaque Réalisation porte son Kit déclaré et sa preuve d'achat (numéro de Commande, date de paiement).
create or replace function public.lister_photos_admin(p_auteur jsonb)
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
      'publiee_le', p.publiee_le, 'accord_whatsapp_le', p.accord_whatsapp_le, 'capture', p.capture_accord is not null,
      'realisation', case when r.id is null then null else jsonb_build_object(
        'kit_fr', k.titre_fr, 'kit_en', k.titre_en, 'commande', c.numero, 'paye_le', c.paye_le, 'rang', r.rang
      ) end
    ) order by case p.statut when 'en_attente' then 0 else 1 end, p.retrait_demande_le nulls last, p.cree_le)
    from public.photo_galerie p
    left join public.realisation r on r.photo_id = p.id
    left join public.produit k on k.id = r.produit_id
    left join public.commande c on c.id = r.commande_preuve
    where p.statut in ('en_attente', 'publiee')
  ), '[]'::jsonb);
end;
$$;

-- Photos du Compte (story 8.1, réécrite) : une Réalisation porte le titre de son Kit.
create or replace function public.lister_mes_photos(p_compte uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'objet', p.objet, 'statut', p.statut, 'nom_affiche', p.nom_affiche, 'ville', p.ville,
    'retrait_demande_le', p.retrait_demande_le, 'cree_le', p.cree_le,
    'kit_fr', k.titre_fr, 'kit_en', k.titre_en
  ) order by p.cree_le desc, p.id), '[]'::jsonb)
  from public.photo_galerie p
  left join public.realisation r on r.photo_id = p.id
  left join public.produit k on k.id = r.produit_id
  where p.compte_id = p_compte
$$;

-- Compteurs (story 8.2, réécrite) : Réalisations à valider comptées à part.
create or replace function public.compter_photos_a_traiter()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'a_valider', (select count(*) from public.photo_galerie p where p.statut = 'en_attente' and not exists (select 1 from public.realisation r where r.photo_id = p.id)),
    'realisations', (select count(*) from public.photo_galerie p join public.realisation r on r.photo_id = p.id where p.statut = 'en_attente'),
    'retraits', (select count(*) from public.photo_galerie where statut = 'publiee' and retrait_demande_le is not null)
  )
$$;

revoke all on function public.kits_payes(uuid) from public, anon, authenticated;
revoke all on function public.deposer_realisation(jsonb, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.kits_payes(uuid) to service_role;
grant execute on function public.deposer_realisation(jsonb, text, text, text, text, uuid) to service_role;
