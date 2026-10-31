-- Story 3.2 : vidéo, chapitres, sous-titres et publication d'un Kit (AD-11, AD-16, AD-18, AD-30, règles 1 et 13).
-- video_kit (données publiables) et video_kit_prive (identifiant de la bibliothèque Bunny PRIVÉE, aucune lecture publique) ; chapitre_kit ;
-- sous_titre_kit (données publiables) et sous_titre_kit_prive (chemin dans kits-private, aucune lecture publique) ; manques_publication
-- d'un Kit ; garde différée étendue aux fichiers, à la vidéo et aux sous-titres ; types MIME de kits-private corrigés.
-- Écriture : aucune depuis anon ni authenticated ; seules les fonctions ci-dessous, SECURITY DEFINER, search_path vide, p_auteur en premier,
-- exiger_admin, ks.auteur posé avant l'écriture, service_role seulement. Les migrations précédentes ne sont pas modifiées.

-- 1. Types MIME de kits-private : PDF, SVG, STL, transcription texte et sous-titres WebVTT. application/octet-stream n'est plus accepté
-- (le type de contenu de chaque envoi est choisi par le serveur).
update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/svg+xml', 'model/stl', 'text/plain', 'text/vtt']
where id = 'kits-private';

-- 2. Vidéo complète d'un Kit. Une ligne n'existe qu'une fois l'encodage terminé, lu chez Bunny par le serveur ; la durée vient de Bunny.
-- extrait_bunny_id : vidéo de la bibliothèque Bunny PUBLIQUE (son identifiant figure dans son adresse publique), facultative.
create table public.video_kit (
  produit_id uuid primary key references public.produit (id) on delete cascade,
  duree_secondes integer not null check (duree_secondes between 1 and 86400),
  extrait_bunny_id uuid,
  prete_le timestamptz not null default now(),
  cree_le timestamptz not null default now()
);

-- Identifiant de la vidéo dans la bibliothèque Bunny PRIVÉE : jamais lisible hors service (AD-30 : nom de colonne contenant « prive »).
create table public.video_kit_prive (
  produit_id uuid primary key references public.video_kit (produit_id) on delete cascade,
  bunny_video_id_prive uuid not null unique
);

-- 3. Chapitres de la vidéo : titres FR et EN, instant de début (secondes, avant la fin de la vidéo), ordre libre (Monter / Descendre).
-- 50 chapitres au plus par Kit, instants de début distincts.
create table public.chapitre_kit (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references public.produit (id) on delete cascade,
  titre_fr text not null check (char_length(titre_fr) between 1 and 120),
  titre_en text not null check (char_length(titre_en) between 1 and 120),
  debut_secondes integer not null check (debut_secondes >= 0),
  ordre integer not null check (ordre between 1 and 50),
  cree_le timestamptz not null default now(),
  -- Contrôlée en fin d'instruction : un échange de rangs en une seule mise à jour est permis.
  constraint chapitre_kit_ordre_unique unique (produit_id, ordre) deferrable initially immediate,
  constraint chapitre_kit_debut_unique unique (produit_id, debut_secondes)
);

-- 4. Sous-titres WebVTT : un fichier par langue (français obligatoire pour publier, anglais facultatif), 1 Mo au plus.
create table public.sous_titre_kit (
  id uuid primary key default gen_random_uuid(),
  produit_id uuid not null references public.produit (id) on delete cascade,
  langue text not null check (langue in ('fr', 'en')),
  taille_octets integer not null check (taille_octets between 1 and 1048576),
  version integer not null default 1 check (version >= 1),
  cree_le timestamptz not null default now(),
  constraint sous_titre_kit_langue_unique unique (produit_id, langue)
);

create table public.sous_titre_kit_prive (
  sous_titre_id uuid primary key references public.sous_titre_kit (id) on delete cascade,
  -- Objet du bucket kits-private : <produit>/sous-titres/<uuid>.vtt.
  chemin_stockage text not null unique check (char_length(chemin_stockage) between 1 and 200)
);

alter table public.video_kit enable row level security;
alter table public.video_kit_prive enable row level security;
alter table public.chapitre_kit enable row level security;
alter table public.sous_titre_kit enable row level security;
alter table public.sous_titre_kit_prive enable row level security;

revoke all on public.video_kit from public, anon, authenticated;
revoke all on public.video_kit_prive from public, anon, authenticated;
revoke all on public.chapitre_kit from public, anon, authenticated;
revoke all on public.sous_titre_kit from public, anon, authenticated;
revoke all on public.sous_titre_kit_prive from public, anon, authenticated;
grant select on public.video_kit to anon, authenticated;
grant select on public.chapitre_kit to anon, authenticated;
grant select on public.sous_titre_kit to anon, authenticated;

-- Lisibles seulement pour un Kit publié (et passé). Aucune politique sur les tables _prive : RLS active, personne hors service ne les lit.
create policy video_kit_lecture_publiee on public.video_kit
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.produit p
      where p.id = video_kit.produit_id and p.famille = 'kit' and p.publie_le is not null and p.publie_le <= now()
    )
  );

create policy chapitre_kit_lecture_publiee on public.chapitre_kit
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.produit p
      where p.id = chapitre_kit.produit_id and p.famille = 'kit' and p.publie_le is not null and p.publie_le <= now()
    )
  );

create policy sous_titre_kit_lecture_publiee on public.sous_titre_kit
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.produit p
      where p.id = sous_titre_kit.produit_id and p.famille = 'kit' and p.publie_le is not null and p.publie_le <= now()
    )
  );

-- Journal des données publiables (comme fichier_kit) ; les identifiants et chemins privés ne sont jamais recopiés dans le journal.
create trigger video_kit_journaliser
  after insert or update or delete on public.video_kit
  for each row execute function public.journaliser('produit_id');

create trigger chapitre_kit_journaliser
  after insert or update or delete on public.chapitre_kit
  for each row execute function public.journaliser('id');

create trigger sous_titre_kit_journaliser
  after insert or update or delete on public.sous_titre_kit
  for each row execute function public.journaliser('id');

-- 5. Verrou d'un Kit (interne) : le produit existe et est un Kit, sinon refus. Toutes les écritures ci-dessous le prennent d'abord.
create function public.verrouiller_kit(p_produit_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_famille text;
begin
  select p.famille into v_famille from public.produit p where p.id = p_produit_id for update;
  if not found then
    raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_famille <> 'kit' then
    raise exception 'KS_FAMILLE_INVALIDE' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.verrouiller_kit(uuid) from public, anon, authenticated;

-- 6. Enregistre la vidéo complète (admin), appelée par le serveur seulement après avoir lu chez Bunny l'encodage terminé et la durée.
-- Renvoie l'identifiant privé de la vidéo remplacée (à effacer chez Bunny APRÈS cette réponse) ou null. Même vidéo : sans effet, null.
-- Refusée si un chapitre commencerait après la fin de la nouvelle vidéo (KS_CHAPITRES_HORS_DUREE).
create function public.enregistrer_video_kit(p_auteur jsonb, p_produit_id uuid, p_bunny_id uuid, p_duree integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ancien uuid;
begin
  perform public.exiger_admin(p_auteur);
  perform public.verrouiller_kit(p_produit_id);
  if p_bunny_id is null then
    raise exception 'KS_VIDEO_INVALIDE' using errcode = 'P0001';
  end if;
  if p_duree is null or p_duree < 1 or p_duree > 86400 then
    raise exception 'KS_DUREE_INVALIDE' using errcode = 'P0001';
  end if;

  select vp.bunny_video_id_prive into v_ancien from public.video_kit_prive vp where vp.produit_id = p_produit_id;
  if v_ancien = p_bunny_id then
    return null;
  end if;
  if exists (select 1 from public.chapitre_kit c where c.produit_id = p_produit_id and c.debut_secondes >= p_duree) then
    raise exception 'KS_CHAPITRES_HORS_DUREE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  begin
    insert into public.video_kit (produit_id, duree_secondes, prete_le)
    values (p_produit_id, p_duree, now())
    on conflict (produit_id) do update set duree_secondes = excluded.duree_secondes, prete_le = excluded.prete_le;
    insert into public.video_kit_prive (produit_id, bunny_video_id_prive)
    values (p_produit_id, p_bunny_id)
    on conflict (produit_id) do update set bunny_video_id_prive = excluded.bunny_video_id_prive;
  exception when unique_violation then
    -- La même vidéo Bunny est déjà la vidéo d'un autre Kit.
    raise exception 'KS_VIDEO_INVALIDE' using errcode = 'P0001';
  end;
  return v_ancien;
end;
$$;

revoke all on function public.enregistrer_video_kit(jsonb, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.enregistrer_video_kit(jsonb, uuid, uuid, integer) to service_role;

-- 7. Retire la vidéo complète (admin) et son extrait. Renvoie {"prive": uuid, "extrait": uuid|null} : le serveur les efface chez Bunny
-- APRÈS cette réponse. Un Kit publié la garde (garde différée : KS_PUBLICATION_INCOMPLETE).
create function public.supprimer_video_kit(p_auteur jsonb, p_produit_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prive uuid;
  v_extrait uuid;
begin
  perform public.exiger_admin(p_auteur);
  perform public.verrouiller_kit(p_produit_id);
  select vp.bunny_video_id_prive, v.extrait_bunny_id into v_prive, v_extrait
  from public.video_kit v join public.video_kit_prive vp on vp.produit_id = v.produit_id
  where v.produit_id = p_produit_id;
  if not found then
    raise exception 'KS_VIDEO_ABSENTE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  delete from public.video_kit where produit_id = p_produit_id;
  return jsonb_build_object('prive', v_prive, 'extrait', v_extrait);
end;
$$;

revoke all on function public.supprimer_video_kit(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.supprimer_video_kit(jsonb, uuid) to service_role;

-- 8. Enregistre (ou retire, p_extrait nul) l'extrait public (admin), après l'encodage terminé lu chez Bunny. La vidéo complète doit exister.
-- Renvoie l'extrait remplacé (à effacer chez Bunny APRÈS cette réponse) ou null.
create function public.enregistrer_extrait_kit(p_auteur jsonb, p_produit_id uuid, p_extrait uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ancien uuid;
begin
  perform public.exiger_admin(p_auteur);
  perform public.verrouiller_kit(p_produit_id);
  select v.extrait_bunny_id into v_ancien from public.video_kit v where v.produit_id = p_produit_id;
  if not found then
    raise exception 'KS_VIDEO_ABSENTE' using errcode = 'P0001';
  end if;
  if v_ancien is not distinct from p_extrait then
    return null;
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.video_kit set extrait_bunny_id = p_extrait where produit_id = p_produit_id;
  return v_ancien;
end;
$$;

revoke all on function public.enregistrer_extrait_kit(jsonb, uuid, uuid) from public, anon, authenticated;
grant execute on function public.enregistrer_extrait_kit(jsonb, uuid, uuid) to service_role;

-- 9. Chapitres (admin). Contrôles communs : titres de 1 à 120 caractères après rognage, début entier >= 0 et avant la fin de la vidéo.
create function public.verifier_chapitre_kit(p_produit_id uuid, p_titre_fr text, p_titre_en text, p_debut integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duree integer;
begin
  if char_length(btrim(coalesce(p_titre_fr, ''))) not between 1 and 120 or char_length(btrim(coalesce(p_titre_en, ''))) not between 1 and 120 then
    raise exception 'KS_TITRE_INVALIDE' using errcode = 'P0001';
  end if;
  select v.duree_secondes into v_duree from public.video_kit v where v.produit_id = p_produit_id;
  if not found then
    raise exception 'KS_VIDEO_ABSENTE' using errcode = 'P0001';
  end if;
  if p_debut is null or p_debut < 0 or p_debut >= v_duree then
    raise exception 'KS_CHAPITRE_INVALIDE' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.verifier_chapitre_kit(uuid, text, text, integer) from public, anon, authenticated;

-- Ajoute un chapitre en dernière position.
create function public.ajouter_chapitre_kit(p_auteur jsonb, p_produit_id uuid, p_titre_fr text, p_titre_en text, p_debut integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ordre integer;
  v_id uuid;
begin
  perform public.exiger_admin(p_auteur);
  perform public.verrouiller_kit(p_produit_id);
  perform public.verifier_chapitre_kit(p_produit_id, p_titre_fr, p_titre_en, p_debut);
  select count(*) into v_ordre from public.chapitre_kit c where c.produit_id = p_produit_id;
  if v_ordre >= 50 then
    raise exception 'KS_CHAPITRES_LIMITE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.chapitre_kit c where c.produit_id = p_produit_id and c.debut_secondes = p_debut) then
    raise exception 'KS_CHAPITRE_DEBUT_PRIS' using errcode = 'P0001';
  end if;
  select coalesce(max(c.ordre), 0) + 1 into v_ordre from public.chapitre_kit c where c.produit_id = p_produit_id;
  perform set_config('ks.auteur', p_auteur::text, true);
  insert into public.chapitre_kit (produit_id, titre_fr, titre_en, debut_secondes, ordre)
  values (p_produit_id, btrim(p_titre_fr), btrim(p_titre_en), p_debut, v_ordre)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.ajouter_chapitre_kit(jsonb, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.ajouter_chapitre_kit(jsonb, uuid, text, text, integer) to service_role;

-- Modifie les titres et l'instant de début d'un chapitre (son rang ne change pas).
create function public.modifier_chapitre_kit(p_auteur jsonb, p_chapitre_id uuid, p_titre_fr text, p_titre_en text, p_debut integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produit uuid;
begin
  perform public.exiger_admin(p_auteur);
  select c.produit_id into v_produit from public.chapitre_kit c where c.id = p_chapitre_id;
  if not found then
    raise exception 'KS_CHAPITRE_INTROUVABLE' using errcode = 'P0001';
  end if;
  perform public.verrouiller_kit(v_produit);
  perform public.verifier_chapitre_kit(v_produit, p_titre_fr, p_titre_en, p_debut);
  if exists (select 1 from public.chapitre_kit c where c.produit_id = v_produit and c.debut_secondes = p_debut and c.id <> p_chapitre_id) then
    raise exception 'KS_CHAPITRE_DEBUT_PRIS' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.chapitre_kit
  set titre_fr = btrim(p_titre_fr), titre_en = btrim(p_titre_en), debut_secondes = p_debut
  where id = p_chapitre_id;
  if not found then
    raise exception 'KS_CHAPITRE_INTROUVABLE' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.modifier_chapitre_kit(jsonb, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.modifier_chapitre_kit(jsonb, uuid, text, text, integer) to service_role;

-- Monte (haut) ou descend (bas) un chapitre d'un rang ; en bout de liste : sans effet. Les rangs sont renumérotés de 1 à n.
create function public.deplacer_chapitre_kit(p_auteur jsonb, p_chapitre_id uuid, p_sens text)
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
  select c.produit_id into v_produit from public.chapitre_kit c where c.id = p_chapitre_id;
  if not found then
    raise exception 'KS_CHAPITRE_INTROUVABLE' using errcode = 'P0001';
  end if;
  perform public.verrouiller_kit(v_produit);

  select o.rang, o.total into v_rang, v_total
  from (
    select x.id, row_number() over (order by x.ordre, x.id)::integer as rang, count(*) over ()::integer as total
    from public.chapitre_kit x where x.produit_id = v_produit
  ) o
  where o.id = p_chapitre_id;
  if not found then
    raise exception 'KS_CHAPITRE_INTROUVABLE' using errcode = 'P0001';
  end if;

  v_delta := case when p_sens = 'haut' then -1 else 1 end;
  if v_rang + v_delta < 1 or v_rang + v_delta > v_total then
    v_delta := 0;
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  update public.chapitre_kit c
  set ordre = n.nouvelle
  from (
    select o.id,
      case
        when v_delta = 0 then o.rang
        when o.id = p_chapitre_id then o.rang + v_delta
        when o.rang = v_rang + v_delta then v_rang
        else o.rang
      end as nouvelle
    from (
      select x.id, row_number() over (order by x.ordre, x.id)::integer as rang
      from public.chapitre_kit x where x.produit_id = v_produit
    ) o
  ) n
  where c.id = n.id and c.ordre <> n.nouvelle;
end;
$$;

revoke all on function public.deplacer_chapitre_kit(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.deplacer_chapitre_kit(jsonb, uuid, text) to service_role;

-- Supprime un chapitre ; les rangs suivants sont renumérotés.
create function public.supprimer_chapitre_kit(p_auteur jsonb, p_chapitre_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_produit uuid;
begin
  perform public.exiger_admin(p_auteur);
  select c.produit_id into v_produit from public.chapitre_kit c where c.id = p_chapitre_id;
  if not found then
    raise exception 'KS_CHAPITRE_INTROUVABLE' using errcode = 'P0001';
  end if;
  perform public.verrouiller_kit(v_produit);
  perform set_config('ks.auteur', p_auteur::text, true);
  delete from public.chapitre_kit where id = p_chapitre_id;
  if not found then
    raise exception 'KS_CHAPITRE_INTROUVABLE' using errcode = 'P0001';
  end if;
  update public.chapitre_kit c
  set ordre = n.nouvelle
  from (
    select x.id, row_number() over (order by x.ordre, x.id)::integer as nouvelle
    from public.chapitre_kit x where x.produit_id = v_produit
  ) n
  where c.id = n.id and c.ordre <> n.nouvelle;
end;
$$;

revoke all on function public.supprimer_chapitre_kit(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.supprimer_chapitre_kit(jsonb, uuid) to service_role;

-- 10. Sous-titres (admin). L'objet est déjà dans kits-private (envoi signé) et son contenu WebVTT vérifié par le serveur.
-- Ajout (version 1) ou remplacement (version + 1) ; renvoie l'ancien chemin (à effacer APRÈS cette réponse) ou null.
create function public.enregistrer_sous_titre_kit(p_auteur jsonb, p_produit_id uuid, p_langue text, p_taille integer, p_chemin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_ancien text;
begin
  perform public.exiger_admin(p_auteur);
  perform public.verrouiller_kit(p_produit_id);
  if p_langue is null or p_langue not in ('fr', 'en') then
    raise exception 'KS_LANGUE_INVALIDE' using errcode = 'P0001';
  end if;
  if p_taille is null or p_taille < 1 or p_taille > 1048576 then
    raise exception 'KS_TAILLE_FICHIER_INVALIDE' using errcode = 'P0001';
  end if;
  if p_chemin is null
     or p_chemin !~ ('^' || p_produit_id::text || '/sous-titres/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.vtt$') then
    raise exception 'KS_CHEMIN_INVALIDE' using errcode = 'P0001';
  end if;

  select s.id, sp.chemin_stockage into v_id, v_ancien
  from public.sous_titre_kit s join public.sous_titre_kit_prive sp on sp.sous_titre_id = s.id
  where s.produit_id = p_produit_id and s.langue = p_langue
  for update of s;
  if v_ancien = p_chemin then
    raise exception 'KS_CHEMIN_INVALIDE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  begin
    if v_id is null then
      insert into public.sous_titre_kit (produit_id, langue, taille_octets) values (p_produit_id, p_langue, p_taille) returning id into v_id;
      insert into public.sous_titre_kit_prive (sous_titre_id, chemin_stockage) values (v_id, p_chemin);
    else
      update public.sous_titre_kit set taille_octets = p_taille, version = version + 1 where id = v_id;
      update public.sous_titre_kit_prive set chemin_stockage = p_chemin where sous_titre_id = v_id;
    end if;
  exception when unique_violation then
    raise exception 'KS_CHEMIN_INVALIDE' using errcode = 'P0001';
  end;
  return v_ancien;
end;
$$;

revoke all on function public.enregistrer_sous_titre_kit(jsonb, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.enregistrer_sous_titre_kit(jsonb, uuid, text, integer, text) to service_role;

-- Supprime les sous-titres d'une langue et renvoie leur chemin (à effacer APRÈS cette réponse). Les sous-titres français d'un Kit publié
-- restent (garde différée : KS_PUBLICATION_INCOMPLETE).
create function public.supprimer_sous_titre_kit(p_auteur jsonb, p_produit_id uuid, p_langue text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_chemin text;
begin
  perform public.exiger_admin(p_auteur);
  perform public.verrouiller_kit(p_produit_id);
  select s.id, sp.chemin_stockage into v_id, v_chemin
  from public.sous_titre_kit s join public.sous_titre_kit_prive sp on sp.sous_titre_id = s.id
  where s.produit_id = p_produit_id and s.langue = p_langue;
  if not found then
    raise exception 'KS_SOUS_TITRES_INTROUVABLES' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  delete from public.sous_titre_kit where id = v_id;
  return v_chemin;
end;
$$;

revoke all on function public.supprimer_sous_titre_kit(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.supprimer_sous_titre_kit(jsonb, uuid, text) to service_role;

-- 11. Ce qui manque pour publier. Produit physique : identique à la story 2.2. Kit : prix, photo, titres, descriptions et matériel FR et EN,
-- niveau, au moins un fichier, vidéo complète, sous-titres français (l'anglais et l'extrait ne bloquent pas). Le texte alternatif ne peut
-- pas manquer (alt_fr et alt_en sont obligatoires sur produit_photo).
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
  return v_manques;
end;
$$;

revoke all on function public.manques_publication(uuid) from public, anon, authenticated;
grant execute on function public.manques_publication(uuid) to service_role;

-- 12. Garde différée (fin de transaction) étendue : un Kit publié ne perd ni son dernier fichier, ni sa vidéo, ni ses sous-titres français.
-- Si le Kit lui-même est supprimé (cascade), il n'existe plus à la fin : aucun refus. Les photos sont déjà gardées (story 2.2).
create constraint trigger fichier_kit_publie_complet
  after delete or update on public.fichier_kit
  deferrable initially deferred
  for each row execute function public.exiger_produit_publie_complet();

create constraint trigger video_kit_publie_complet
  after delete or update on public.video_kit
  deferrable initially deferred
  for each row execute function public.exiger_produit_publie_complet();

create constraint trigger sous_titre_kit_publie_complet
  after delete or update on public.sous_titre_kit
  deferrable initially deferred
  for each row execute function public.exiger_produit_publie_complet();
