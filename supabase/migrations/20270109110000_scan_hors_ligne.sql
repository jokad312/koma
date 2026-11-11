-- Story 7.8 : Scan hors ligne (FR-36, AD-2, AD-12, AD-21).
--
-- Principe : un appareil CONNECTÉ prend le Verrou hors ligne d'un Événement, télécharge la liste de ses Pass « valide » (empreintes, jamais de secret en
-- clair), puis peut scanner sans réseau. Tant que le Verrou est tenu, seul cet appareil scanne (en ligne comme hors ligne) : scanner_pass refuse les
-- autres appareils (KS_SCAN_VERROUILLE). Au retour du réseau, synchroniser_scans applique les scans, puis liberer_verrou rend le Verrou.
--
-- Protection des secrets sur l'appareil (point de sécurité de la story) :
-- - Jeton du Code QR (192 bits aléatoires) : empreinte SHA-256 simple (comme l'epic). 2^192 possibilités : aucune force brute possible.
-- - Code court (8 caractères sur 32 symboles, environ 1,1e12 valeurs) : un SHA-256 simple se casserait en quelques minutes sur un GPU. La liste porte donc
--   un HMAC-SHA-256 du code court, clé = secret aléatoire de 256 bits PROPRE AU VERROU (verrou_hors_ligne.cle_code_court), remis une seule fois à l'appareil
--   qui tient le Verrou avec la liste. La liste volée SANS la clé (journal, trace réseau, copie de la base) ne permet aucune attaque ; sur l'appareil lui-même,
--   la clé est gardée en CryptoKey non extractible (IndexedDB) et le comptage d'essais limite la saisie à la main. Ce que cela ne couvre PAS : un appareil
--   perdu dont le stockage serait lu hors du navigateur. La base ne peut pas imposer ici une fonction lente (PBKDF2, scrypt) sans lui remettre les codes en
--   clair : pgcrypto n'offre pas de PBKDF2 et une boucle plpgsql sur des milliers de Pass est hors de portée. Écart assumé avec l'epic (HMAC et non SHA-256 simple
--   pour le code court) ; le nom du titulaire, lui, est en clair sur l'appareil (il doit s'afficher hors ligne, AD-12).
-- - La clé n'est jamais journalisée, jamais lue par anon ni authenticated. Aucune fonction ne rend jamais un jeton ni un code court en clair.
--
-- Écriture : le navigateur n'écrit jamais dans une table métier (AD-2) ; tout passe par des fonctions security definer (search_path vide), réservées à
-- service_role, qui revérifient le droit en base (scan_exiger_acces : Admin, ou bénévole dans sa fenêtre pour CET Événement).
-- Journal : verrou pris, liste téléchargée (nombre), scans synchronisés (nombres), verrou libéré ou forcé. Jamais de jeton, de code court, de nom,
-- de clé ni d'identifiant d'appareil.

create table public.verrou_hors_ligne (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenement (id) on delete cascade,
  compte_id uuid not null references auth.users (id) on delete cascade,
  -- Identifiant aléatoire (128 bits) généré par l'appareil : il distingue les appareils d'un même Compte.
  appareil text not null check (appareil ~ '^[0-9a-f]{32}$'),
  -- Clé du HMAC des codes courts de la liste (secret du Verrou).
  cle_code_court text not null check (cle_code_court ~ '^[0-9a-f]{64}$'),
  pris_le timestamptz not null default now(),
  -- Fin de la fenêtre de scan : fin de l'accès du bénévole, ou fin du dernier jour de l'Événement pour l'Admin.
  expire_le timestamptz not null,
  liste_telechargee_le timestamptz,
  libere_le timestamptz,
  statut text not null default 'actif' check (statut in ('actif', 'libere', 'expire', 'force')),
  constraint verrou_hors_ligne_libere_coherent check ((statut = 'actif') = (libere_le is null)),
  constraint verrou_hors_ligne_fenetre check (expire_le > pris_le)
);
-- Un seul Verrou actif par Événement.
create unique index verrou_hors_ligne_actif_unique on public.verrou_hors_ligne (evenement_id) where statut = 'actif';
create index verrou_hors_ligne_compte_idx on public.verrou_hors_ligne (compte_id);
alter table public.verrou_hors_ligne enable row level security;
revoke all on public.verrou_hors_ligne from public, anon, authenticated;

-- Mémoire des scans déjà appliqués : un scan (identifiant tiré par l'appareil) n'est jamais appliqué deux fois, même si la synchronisation est rejouée.
create table public.scan_hors_ligne (
  id uuid primary key,
  verrou_id uuid not null references public.verrou_hors_ligne (id) on delete cascade,
  pass_id uuid references public.pass (id) on delete set null,
  resultat text not null check (resultat in ('applique', 'conflit', 'inconnu')),
  motif text check (motif in ('deja_scanne', 'annule', 'rembourse', 'commande_non_payee', 'statut')),
  -- Heure du scan sur l'appareil, telle qu'envoyée (l'heure retenue pour le Pass est bornée, voir synchroniser_scans).
  scanne_le_appareil timestamptz not null,
  applique_le timestamptz not null default now()
);
create index scan_hors_ligne_verrou_idx on public.scan_hors_ligne (verrou_id);
create index scan_hors_ligne_pass_idx on public.scan_hors_ligne (pass_id);
alter table public.scan_hors_ligne enable row level security;
revoke all on public.scan_hors_ligne from public, anon, authenticated;

-- Compte de l'auteur, structure vérifiée (rien n'est cru du rôle écrit dans l'auteur). Interne.
create function public.scan_compte_depuis_auteur(p_auteur jsonb)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  if (p_auteur ->> 'type') is distinct from 'compte'
     or (p_auteur ->> 'id') is null
     or (p_auteur ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'KS_DROIT_REFUSE' using errcode = 'P0001';
  end if;
  return (p_auteur ->> 'id')::uuid;
end;
$$;
revoke all on function public.scan_compte_depuis_auteur(jsonb) from public, anon, authenticated, service_role;

-- Horodatage ISO envoyé par l'appareil, ou null s'il est illisible (un lot ne tombe jamais en erreur à cause d'une date mal formée). Interne.
create function public.scan_horodatage(p_texte text)
returns timestamptz
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_texte is null or p_texte !~ '^\d{4}-\d{2}-\d{2}T' then
    return null;
  end if;
  return p_texte::timestamptz;
exception when others then
  return null;
end;
$$;
revoke all on function public.scan_horodatage(text) from public, anon, authenticated, service_role;

-- Verrous dont la fenêtre est passée sans libération : ils passent à « expire » (l'appareil pourra encore synchroniser). Interne.
create function public.scan_verrou_expirer(p_evenement uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  with echus as (
    update public.verrou_hors_ligne v set statut = 'expire', libere_le = v.expire_le
    where v.evenement_id = p_evenement and v.statut = 'actif' and v.expire_le <= now()
    returning v.id, v.evenement_id
  )
  insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
  select '{"type":"systeme","nom":"verrou_hors_ligne_expire"}'::jsonb, 'verrou_expire', 'verrou_hors_ligne', e.id::text, jsonb_build_object('evenement_id', e.evenement_id)
  from echus e;
end;
$$;
revoke all on function public.scan_verrou_expirer(uuid) from public, anon, authenticated, service_role;

-- Un autre appareil tient-il le Verrou de cet Événement ? Si oui, le scan est refusé. L'appareil de l'auteur est lu dans p_auteur.appareil. Interne.
create function public.scan_exiger_verrou(p_auteur jsonb, p_evenement uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.verrou_hors_ligne v
    where v.evenement_id = p_evenement and v.statut = 'actif' and v.expire_le > now()
      and v.appareil is distinct from nullif(p_auteur ->> 'appareil', '')
  ) then
    raise exception 'KS_SCAN_VERROUILLE' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.scan_exiger_verrou(jsonb, uuid) from public, anon, authenticated, service_role;

-- scanner_pass : même signature et même corps que la story 7.6, avec deux changements. 1) Le Verrou hors ligne est contrôlé (un autre appareil que celui
-- qui le tient est refusé). 2) L'identifiant de l'appareil lu dans l'auteur n'est jamais écrit au journal (p_auteur - 'appareil').
create or replace function public.scanner_pass(p_auteur jsonb, p_evenement uuid, p_jeton text default null, p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.pass%rowtype;
  v_commande_statut text;
  v_code text;
  v_trouve boolean := false;
  v_raison text;
  v_resultat jsonb;
  v_nom_fr text;
  v_nom_en text;
  v_titre_fr text;
  v_titre_en text;
  v_auteur jsonb;
begin
  perform public.scan_exiger_acces(p_auteur, p_evenement);
  perform public.scan_exiger_verrou(p_auteur, p_evenement);
  v_auteur := p_auteur - 'appareil';
  if p_evenement is null or ((p_jeton is null) = (p_code is null)) then
    raise exception 'KS_SCAN_ARGUMENT' using errcode = 'P0001';
  end if;

  if p_jeton is not null then
    if lower(btrim(p_jeton)) ~ '^[0-9a-f]{48}$' then
      select * into v_p from public.pass where jeton = lower(btrim(p_jeton)) for update;
      v_trouve := found;
    end if;
  else
    v_code := upper(regexp_replace(p_code, '[\s-]', '', 'g'));
    if v_code ~ '^[A-HJ-NP-Z2-9]{8}$' then
      select * into v_p from public.pass where code_court = v_code for update;
      v_trouve := found;
    end if;
  end if;

  if not v_trouve then
    v_raison := 'inconnu';
  else
    select c.statut into v_commande_statut from public.commande c where c.id = v_p.commande_id;
    if v_p.evenement_id <> p_evenement then
      v_raison := 'autre_evenement';
    elsif v_p.statut = 'annule' then
      v_raison := 'annule';
    elsif v_p.statut = 'rembourse' then
      v_raison := 'rembourse';
    elsif v_commande_statut is distinct from 'payee' and v_commande_statut is distinct from 'offerte' then
      v_raison := 'commande_non_payee';
    elsif v_p.statut = 'scanne' then
      v_raison := 'deja_scanne';
    end if;
  end if;

  if v_raison is not null then
    v_resultat := jsonb_build_object('resultat', 'refuse', 'raison', v_raison);
    if v_raison = 'deja_scanne' then
      v_resultat := v_resultat || jsonb_build_object('scanne_le', v_p.scanne_le);
    end if;
    insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
    values (v_auteur, 'scan', 'pass', case when v_trouve then v_p.id::text else 'inconnu' end,
      jsonb_build_object('resultat', 'refuse', 'raison', v_raison, 'evenement_id', p_evenement));
    return v_resultat;
  end if;

  perform set_config('ks.auteur', v_auteur::text, true);
  update public.pass set statut = 'scanne', scanne_le = now(), scanne_par = (p_auteur ->> 'id')::uuid where id = v_p.id;

  select t.nom_fr, t.nom_en, e.titre_fr, e.titre_en into v_nom_fr, v_nom_en, v_titre_fr, v_titre_en
  from public.type_pass t join public.evenement e on e.id = v_p.evenement_id where t.id = v_p.type_pass_id;

  insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
  values (v_auteur, 'scan', 'pass', v_p.id::text, jsonb_build_object('resultat', 'valide', 'evenement_id', p_evenement, 'type_pass_id', v_p.type_pass_id));

  return jsonb_build_object(
    'resultat', 'valide',
    'nom', v_p.nom_titulaire,
    'evenement_fr', v_titre_fr, 'evenement_en', v_titre_en,
    'type_pass_fr', v_nom_fr, 'type_pass_en', v_nom_en
  );
end;
$$;
revoke all on function public.scanner_pass(jsonb, uuid, text, text) from public, anon, authenticated;
grant execute on function public.scanner_pass(jsonb, uuid, text, text) to service_role;

-- Prend le Verrou hors ligne de l'Événement pour l'appareil indiqué. Idempotente pour le même Compte et le même appareil ('deja').
-- Refus : KS_VERROU_PRIS (un autre appareil, ou un autre Compte, le tient), KS_APPAREIL_INVALIDE, KS_EVENEMENT_PASSE.
-- Fenêtre : bénévole = fin de son accès ; Admin = fin du dernier jour de l'Événement (jour suivant 24 h si l'Événement n'a pas de date).
create function public.prendre_verrou(p_auteur jsonb, p_evenement uuid, p_appareil text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_debut timestamptz;
  v_fin timestamptz;
  v_expire timestamptz;
  v_v public.verrou_hors_ligne%rowtype;
begin
  perform public.scan_exiger_acces(p_auteur, p_evenement);
  if p_evenement is null then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if p_appareil is null or p_appareil !~ '^[0-9a-f]{32}$' then
    raise exception 'KS_APPAREIL_INVALIDE' using errcode = 'P0001';
  end if;
  v_compte := public.scan_compte_depuis_auteur(p_auteur);

  select e.debut_le, e.fin_le into v_debut, v_fin from public.evenement e where e.id = p_evenement;
  if not found then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if public.a_le_role(v_compte, 'admin') then
    select f.jusqu_au into v_expire from public.acces_benevole_fenetre(v_debut, v_fin) f;
    v_expire := coalesce(v_expire, now() + interval '1 day');
  else
    select a.valable_jusqu_au into v_expire from public.acces_benevole a where a.compte_id = v_compte and a.evenement_id = p_evenement;
  end if;
  if v_expire is null or v_expire <= now() then
    raise exception 'KS_EVENEMENT_PASSE' using errcode = 'P0001';
  end if;

  -- Sérialise les prises de Verrou d'un même Événement.
  perform pg_advisory_xact_lock(hashtextextended('verrou_hors_ligne:' || p_evenement::text, 0));
  perform public.scan_verrou_expirer(p_evenement);

  select * into v_v from public.verrou_hors_ligne where evenement_id = p_evenement and statut = 'actif' for update;
  if found then
    if v_v.compte_id = v_compte and v_v.appareil = p_appareil then
      return jsonb_build_object('statut', 'deja', 'verrou_id', v_v.id, 'pris_le', v_v.pris_le, 'expire_le', v_v.expire_le);
    end if;
    raise exception 'KS_VERROU_PRIS' using errcode = 'P0001';
  end if;

  insert into public.verrou_hors_ligne (evenement_id, compte_id, appareil, cle_code_court, expire_le)
  values (p_evenement, v_compte, p_appareil, encode(extensions.gen_random_bytes(32), 'hex'), v_expire)
  returning * into v_v;

  insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
  values (p_auteur - 'appareil', 'verrou_pris', 'verrou_hors_ligne', v_v.id::text, jsonb_build_object('evenement_id', p_evenement, 'expire_le', v_v.expire_le));
  return jsonb_build_object('statut', 'pris', 'verrou_id', v_v.id, 'pris_le', v_v.pris_le, 'expire_le', v_v.expire_le);
end;
$$;
revoke all on function public.prendre_verrou(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.prendre_verrou(jsonb, uuid, text) to service_role;

-- Liste hors ligne : seulement pour l'appareil qui tient le Verrou (KS_VERROU_ABSENT sinon). Ne contient QUE les Pass « valide » de CET Événement dont la
-- Commande est payée ou offerte. Par Pass : empreinte SHA-256 du jeton (j), HMAC-SHA-256 du code court avec la clé du Verrou (c), nom du titulaire (n)
-- et rang de son Type de pass (t). Ni jeton, ni code court, ni email, ni Compte, ni identifiant de Pass, ni de Commande.
create function public.telecharger_liste_hors_ligne(p_auteur jsonb, p_evenement uuid, p_appareil text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_v public.verrou_hors_ligne%rowtype;
  v_titre_fr text;
  v_titre_en text;
  v_types jsonb;
  v_pass jsonb;
  v_nombre integer;
begin
  perform public.scan_exiger_acces(p_auteur, p_evenement);
  v_compte := public.scan_compte_depuis_auteur(p_auteur);
  perform pg_advisory_xact_lock(hashtextextended('verrou_hors_ligne:' || p_evenement::text, 0));

  select * into v_v from public.verrou_hors_ligne v
    where v.evenement_id = p_evenement and v.statut = 'actif' and v.expire_le > now() and v.compte_id = v_compte and v.appareil = p_appareil
    for update;
  if not found then
    raise exception 'KS_VERROU_ABSENT' using errcode = 'P0001';
  end if;

  select e.titre_fr, e.titre_en into v_titre_fr, v_titre_en from public.evenement e where e.id = p_evenement;
  select coalesce(jsonb_agg(jsonb_build_object('fr', t.nom_fr, 'en', t.nom_en) order by t.id), '[]'::jsonb) into v_types
    from public.type_pass t where t.evenement_id = p_evenement;

  select coalesce(jsonb_agg(jsonb_build_object(
      'j', encode(extensions.digest(p.jeton, 'sha256'), 'hex'),
      'c', encode(extensions.hmac(convert_to(p.code_court, 'UTF8'), decode(v_v.cle_code_court, 'hex'), 'sha256'), 'hex'),
      'n', p.nom_titulaire,
      't', r.rang
    ) order by p.id), '[]'::jsonb)
    into v_pass
    from public.pass p
    join public.commande c on c.id = p.commande_id
    join (select t.id, (row_number() over (order by t.id) - 1)::integer as rang from public.type_pass t where t.evenement_id = p_evenement) r on r.id = p.type_pass_id
    where p.evenement_id = p_evenement and p.statut = 'valide' and c.statut in ('payee', 'offerte');
  v_nombre := jsonb_array_length(v_pass);

  update public.verrou_hors_ligne set liste_telechargee_le = now() where id = v_v.id;
  insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
  values (p_auteur - 'appareil', 'liste_hors_ligne_telechargee', 'verrou_hors_ligne', v_v.id::text, jsonb_build_object('evenement_id', p_evenement, 'nombre', v_nombre));

  return jsonb_build_object(
    'verrou_id', v_v.id, 'pris_le', v_v.pris_le, 'expire_le', v_v.expire_le, 'genere_le', now(),
    'evenement_fr', v_titre_fr, 'evenement_en', v_titre_en,
    'cle_code_court', v_v.cle_code_court,
    'types', v_types, 'pass', v_pass
  );
end;
$$;
revoke all on function public.telecharger_liste_hors_ligne(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.telecharger_liste_hors_ligne(jsonb, uuid, text) to service_role;

-- Applique les scans faits hors ligne, dans l'ordre de leur heure sur l'appareil. Chaque scan : { id (uuid tiré par l'appareil), nature ('jeton' | 'code'),
-- empreinte (64 hexadécimaux), scanne_le (ISO) }. Seuls les scans affichés VALIDE sur l'appareil sont envoyés.
-- Idempotente : un scan déjà appliqué (même id) rend son résultat d'origine sans rien réécrire. Un Pass déjà scanné ailleurs entre-temps, annulé ou
-- dont la Commande n'est plus payée est un CONFLIT : le Pass n'est pas modifié (le premier scan n'est jamais écrasé) et une anomalie « scan_conflit » est créée.
-- L'heure retenue pour le Pass est celle de l'appareil, bornée entre la prise du Verrou et maintenant (une horloge fausse ne place jamais un scan dans le futur).
-- Réservée au Compte et à l'appareil qui tiennent (ou ont tenu, expiré) le Verrou ; refus si l'Admin l'a libéré de force (KS_VERROU_LIBERE_DE_FORCE).
-- Lot borné à 200 scans (KS_LOT_TROP_GRAND).
create function public.synchroniser_scans(p_auteur jsonb, p_evenement uuid, p_appareil text, p_scans jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_v public.verrou_hors_ligne%rowtype;
  v_force boolean;
  v_scan record;
  v_id uuid;
  v_t timestamptz;
  v_t_retenu timestamptz;
  v_p public.pass%rowtype;
  v_trouve boolean;
  v_commande_statut text;
  v_motif text;
  v_resultat text;
  v_connu public.scan_hors_ligne%rowtype;
  v_sortie jsonb := '[]'::jsonb;
  v_appliques integer := 0;
  v_conflits integer := 0;
  v_inconnus integer := 0;
  v_deja integer := 0;
  v_invalides integer := 0;
begin
  v_compte := public.scan_compte_depuis_auteur(p_auteur);
  if p_evenement is null or p_appareil is null or p_appareil !~ '^[0-9a-f]{32}$' then
    raise exception 'KS_APPAREIL_INVALIDE' using errcode = 'P0001';
  end if;
  if p_scans is null or jsonb_typeof(p_scans) <> 'array' then
    raise exception 'KS_LOT_INVALIDE' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_scans) > 200 then
    raise exception 'KS_LOT_TROP_GRAND' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('verrou_hors_ligne:' || p_evenement::text, 0));

  select * into v_v from public.verrou_hors_ligne v
    where v.evenement_id = p_evenement and v.compte_id = v_compte and v.appareil = p_appareil and v.statut in ('actif', 'expire')
    order by v.pris_le desc limit 1 for update;
  if not found then
    select exists (select 1 from public.verrou_hors_ligne v where v.evenement_id = p_evenement and v.compte_id = v_compte and v.appareil = p_appareil and v.statut = 'force')
      into v_force;
    raise exception using message = case when v_force then 'KS_VERROU_LIBERE_DE_FORCE' else 'KS_VERROU_ABSENT' end, errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', (p_auteur - 'appareil')::text, true);

  for v_scan in
    select e.value as s, e.ordinality as rang
    from jsonb_array_elements(p_scans) with ordinality e
    order by public.scan_horodatage(e.value ->> 'scanne_le') nulls last, e.ordinality
  loop
    v_resultat := null;
    v_motif := null;
    v_trouve := false;
    -- Forme du scan : tout ce qui n'est pas exactement attendu est « invalide » (rien n'est écrit).
    if jsonb_typeof(v_scan.s) <> 'object'
       or (v_scan.s ->> 'id') is null or (v_scan.s ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or (v_scan.s ->> 'nature') is null or (v_scan.s ->> 'nature') not in ('jeton', 'code')
       or (v_scan.s ->> 'empreinte') is null or (v_scan.s ->> 'empreinte') !~ '^[0-9a-f]{64}$'
       or public.scan_horodatage(v_scan.s ->> 'scanne_le') is null then
      v_invalides := v_invalides + 1;
      v_sortie := v_sortie || jsonb_build_object('id', v_scan.s ->> 'id', 'resultat', 'invalide');
      continue;
    end if;
    v_id := (v_scan.s ->> 'id')::uuid;
    v_t := public.scan_horodatage(v_scan.s ->> 'scanne_le');

    -- Rejeu : le résultat d'origine est rendu tel quel.
    select * into v_connu from public.scan_hors_ligne where id = v_id;
    if found then
      if v_connu.verrou_id = v_v.id then
        v_deja := v_deja + 1;
        v_sortie := v_sortie || jsonb_build_object('id', v_id, 'resultat', v_connu.resultat, 'motif', v_connu.motif, 'rejeu', true);
      else
        v_invalides := v_invalides + 1;
        v_sortie := v_sortie || jsonb_build_object('id', v_id, 'resultat', 'invalide');
      end if;
      continue;
    end if;

    if (v_scan.s ->> 'nature') = 'jeton' then
      select * into v_p from public.pass p
        where p.evenement_id = p_evenement and encode(extensions.digest(p.jeton, 'sha256'), 'hex') = (v_scan.s ->> 'empreinte')
        for update;
    else
      select * into v_p from public.pass p
        where p.evenement_id = p_evenement
          and encode(extensions.hmac(convert_to(p.code_court, 'UTF8'), decode(v_v.cle_code_court, 'hex'), 'sha256'), 'hex') = (v_scan.s ->> 'empreinte')
        for update;
    end if;
    v_trouve := found;

    if not v_trouve then
      v_resultat := 'inconnu';
      v_inconnus := v_inconnus + 1;
    else
      select c.statut into v_commande_statut from public.commande c where c.id = v_p.commande_id;
      if v_p.statut = 'annule' then
        v_motif := 'annule';
      elsif v_p.statut = 'rembourse' then
        v_motif := 'rembourse';
      elsif v_commande_statut is distinct from 'payee' and v_commande_statut is distinct from 'offerte' then
        v_motif := 'commande_non_payee';
      elsif v_p.statut = 'scanne' then
        v_motif := 'deja_scanne';
      elsif v_p.statut <> 'valide' then
        v_motif := 'statut';
      end if;

      if v_motif is not null then
        v_resultat := 'conflit';
        v_conflits := v_conflits + 1;
        insert into public.anomalie (type, gravite, cible_type, cible_id, details)
        values ('scan_conflit', 'attention', 'pass', v_p.id,
          jsonb_build_object('evenement_id', p_evenement, 'verrou_id', v_v.id, 'motif', v_motif, 'scan_appareil_le', v_t,
            'premier_scan_le', case when v_motif = 'deja_scanne' then v_p.scanne_le end))
        on conflict do nothing;
      else
        v_resultat := 'applique';
        v_appliques := v_appliques + 1;
        v_t_retenu := least(greatest(v_t, v_v.pris_le), now());
        update public.pass set statut = 'scanne', scanne_le = v_t_retenu, scanne_par = v_compte where id = v_p.id;
      end if;
    end if;

    insert into public.scan_hors_ligne (id, verrou_id, pass_id, resultat, motif, scanne_le_appareil)
    values (v_id, v_v.id, case when v_trouve then v_p.id end, v_resultat, v_motif, v_t);
    v_sortie := v_sortie || jsonb_build_object('id', v_id, 'resultat', v_resultat, 'motif', v_motif);
  end loop;

  insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
  values (p_auteur - 'appareil', 'scans_synchronises', 'verrou_hors_ligne', v_v.id::text,
    jsonb_build_object('evenement_id', p_evenement, 'appliques', v_appliques, 'conflits', v_conflits, 'inconnus', v_inconnus, 'deja_traites', v_deja, 'invalides', v_invalides));

  return jsonb_build_object('resultats', v_sortie, 'appliques', v_appliques, 'conflits', v_conflits, 'inconnus', v_inconnus, 'deja_traites', v_deja, 'invalides', v_invalides);
end;
$$;
revoke all on function public.synchroniser_scans(jsonb, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.synchroniser_scans(jsonb, uuid, text, jsonb) to service_role;

-- Rend le Verrou (Compte et appareil qui le tiennent). Rend 'libere', 'deja' (déjà libéré ou expiré) ou 'force' (libéré de force par l'Admin).
-- KS_VERROU_ABSENT si ce Compte n'a jamais tenu de Verrou sur cet appareil pour cet Événement. L'appareil efface sa liste locale après cette réponse.
create function public.liberer_verrou(p_auteur jsonb, p_evenement uuid, p_appareil text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_v public.verrou_hors_ligne%rowtype;
begin
  v_compte := public.scan_compte_depuis_auteur(p_auteur);
  if p_evenement is null or p_appareil is null or p_appareil !~ '^[0-9a-f]{32}$' then
    raise exception 'KS_APPAREIL_INVALIDE' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('verrou_hors_ligne:' || p_evenement::text, 0));

  select * into v_v from public.verrou_hors_ligne v
    where v.evenement_id = p_evenement and v.compte_id = v_compte and v.appareil = p_appareil
    order by v.pris_le desc limit 1 for update;
  if not found then
    raise exception 'KS_VERROU_ABSENT' using errcode = 'P0001';
  end if;
  if v_v.statut = 'force' then
    return jsonb_build_object('statut', 'force');
  end if;
  if v_v.statut <> 'actif' then
    return jsonb_build_object('statut', 'deja');
  end if;
  update public.verrou_hors_ligne set statut = 'libere', libere_le = now() where id = v_v.id;
  insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
  values (p_auteur - 'appareil', 'verrou_libere', 'verrou_hors_ligne', v_v.id::text, jsonb_build_object('evenement_id', p_evenement));
  return jsonb_build_object('statut', 'libere');
end;
$$;
revoke all on function public.liberer_verrou(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.liberer_verrou(jsonb, uuid, text) to service_role;

-- Libération forcée (Admin seulement, appareil perdu). Le Verrou actif passe à « force » ; une anomalie « scans_non_synchronises » signale que les scans
-- éventuels de cet appareil ne sont pas connus. L'appareil ne pourra plus synchroniser. Rend 'force' ou 'aucun' (pas de Verrou actif).
create function public.forcer_liberation_verrou(p_auteur jsonb, p_evenement uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_v public.verrou_hors_ligne%rowtype;
  v_synchronises integer;
begin
  perform public.exiger_admin(p_auteur);
  if p_evenement is null then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('verrou_hors_ligne:' || p_evenement::text, 0));
  select * into v_v from public.verrou_hors_ligne where evenement_id = p_evenement and statut = 'actif' for update;
  if not found then
    return jsonb_build_object('statut', 'aucun');
  end if;
  select count(*)::integer into v_synchronises from public.scan_hors_ligne s where s.verrou_id = v_v.id;
  update public.verrou_hors_ligne set statut = 'force', libere_le = now() where id = v_v.id;
  insert into public.anomalie (type, gravite, cible_type, cible_id, details)
  values ('scans_non_synchronises', 'attention', 'verrou', v_v.id,
    jsonb_build_object('evenement_id', p_evenement, 'verrou_id', v_v.id, 'pris_le', v_v.pris_le, 'liste_telechargee', v_v.liste_telechargee_le is not null, 'scans_synchronises', v_synchronises))
  on conflict do nothing;
  insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
  values (p_auteur - 'appareil', 'verrou_force', 'verrou_hors_ligne', v_v.id::text, jsonb_build_object('evenement_id', p_evenement));
  return jsonb_build_object('statut', 'force', 'verrou_id', v_v.id);
end;
$$;
revoke all on function public.forcer_liberation_verrou(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.forcer_liberation_verrou(jsonb, uuid) to service_role;

-- État du Verrou vu par cet appareil : 'libre', 'moi' (il le tient) ou 'autre' (« Scan réservé à l'appareil hors ligne »). Droit de scanner revérifié.
-- Ne rend aucune information sur l'autre appareil.
create function public.lire_etat_verrou(p_auteur jsonb, p_evenement uuid, p_appareil text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_v public.verrou_hors_ligne%rowtype;
begin
  perform public.scan_exiger_acces(p_auteur, p_evenement);
  v_compte := public.scan_compte_depuis_auteur(p_auteur);
  select * into v_v from public.verrou_hors_ligne v where v.evenement_id = p_evenement and v.statut = 'actif' and v.expire_le > now();
  if not found then
    return jsonb_build_object('etat', 'libre');
  end if;
  if v_v.compte_id = v_compte and v_v.appareil = p_appareil then
    return jsonb_build_object('etat', 'moi', 'verrou_id', v_v.id, 'pris_le', v_v.pris_le, 'expire_le', v_v.expire_le);
  end if;
  return jsonb_build_object('etat', 'autre');
end;
$$;
revoke all on function public.lire_etat_verrou(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.lire_etat_verrou(jsonb, uuid, text) to service_role;

-- Page admin d'un Événement : le Verrou actif (Admin seulement). L'email du Compte qui le tient n'est montré qu'ici ; jamais l'identifiant de l'appareil.
create function public.lire_verrou_evenement(p_auteur jsonb, p_evenement uuid)
returns table (id uuid, email text, pris_le timestamptz, expire_le timestamptz, liste_telechargee boolean, echu boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_admin(p_auteur);
  return query
    select v.id, u.email::text, v.pris_le, v.expire_le, v.liste_telechargee_le is not null, v.expire_le <= now()
    from public.verrou_hors_ligne v
    join auth.users u on u.id = v.compte_id
    where v.evenement_id = p_evenement and v.statut = 'actif';
end;
$$;
revoke all on function public.lire_verrou_evenement(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.lire_verrou_evenement(jsonb, uuid) to service_role;
