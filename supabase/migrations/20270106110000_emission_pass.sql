-- Story 7.5 : émission des Pass (FR-34, AD-4, AD-12). Un Pass est une personne : une ligne par titulaire d'une Commande de Pass payée.
-- 1. Table pass : jeton du Code QR (secret de 192 bits, jamais l'identifiant du Pass) et code court de 8 caractères sans ambiguïté, tirés au hasard
--    et indépendants l'un de l'autre. Lecture par le Compte acheteur de SES Pass seulement ; aucune écriture pour anon ni authenticated ; le serveur
--    n'écrit que par les fonctions ci-dessous (droit d'écriture retiré à service_role aussi).
-- 2. evenements_emettre_pass(commande) : interne, idempotente (unicité ligne + rang), planifie l'email « pass_emis » une seule fois. Appelée par
--    confirmer_paiement ; la story 8.5 (offrir_commande) l'appellera aussi.
-- 3. confirmer_paiement : dernière version appliquée (20261217100000) + émission pour une Commande de type pass. Rien d'autre ne change.
-- 4. places_evenement_utilisees / places_type_pass_utilisees : une Commande payée compte par ses Pass non annulés (jamais deux fois) ; une Commande en
--    attente ou échouée, non échue, compte par ses lignes.
-- Journal d'audit : déclencheur propre (pass_journaliser) qui n'écrit NI le jeton, NI le code court, NI le nom du titulaire (le masque générique ne
-- reconnaît que emails et téléphones). Aucun Pass, événement ni donnée d'exemple n'est créé par la migration (règle 14).

create table public.pass (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenement (id) on delete restrict,
  type_pass_id uuid not null references public.type_pass (id) on delete restrict,
  commande_id uuid not null references public.commande (id) on delete restrict,
  ligne_commande_id uuid not null references public.ligne_commande (id) on delete restrict,
  -- Position du titulaire dans la ligne (1, 2, ... ; un Stand a deux titulaires par unité).
  rang smallint not null check (rang >= 1),
  -- Nom figé à l'achat (jamais modifié).
  nom_titulaire text not null check (char_length(nom_titulaire) between 2 and 80),
  -- 'rembourse' est posé par la story 7.9 ; il est déjà permis ici pour que la table n'ait pas à changer.
  statut text not null default 'valide' check (statut in ('valide', 'scanne', 'annule', 'rembourse')),
  -- Contenu du Code QR : 48 caractères hexadécimaux (192 bits aléatoires). Secret : ne se déduit ni de l'identifiant ni d'un autre Pass.
  jeton text not null unique check (jeton ~ '^[0-9a-f]{48}$'),
  -- Code court de secours, saisi à la main : 8 caractères parmi 32 (sans I, O, 0, 1).
  code_court text not null unique check (code_court ~ '^[A-HJ-NP-Z2-9]{8}$'),
  scanne_le timestamptz,
  scanne_par uuid references auth.users (id) on delete set null,
  cree_le timestamptz not null default now(),
  constraint pass_ligne_rang_unique unique (ligne_commande_id, rang),
  constraint pass_scanne_coherent check ((statut = 'scanne') = (scanne_le is not null))
);
create index pass_commande_idx on public.pass (commande_id);
create index pass_evenement_statut_idx on public.pass (evenement_id, statut);
create index pass_type_pass_idx on public.pass (type_pass_id);

alter table public.pass enable row level security;
revoke all on public.pass from public, anon, authenticated;
grant select on public.pass to authenticated, service_role;
-- Les écritures passent par les fonctions security definer : même le serveur n'écrit pas directement dans la table.
revoke insert, update, delete, truncate on public.pass from service_role;

create policy pass_lecture_propre on public.pass
  for select to authenticated
  using (exists (select 1 from public.commande c where c.id = pass.commande_id and c.compte_id = (select auth.uid())));

-- Ce qui identifie le Pass ne change jamais (statut et scan sont les seules colonnes mobiles).
create function public.pass_figer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id or new.evenement_id is distinct from old.evenement_id or new.type_pass_id is distinct from old.type_pass_id
     or new.commande_id is distinct from old.commande_id or new.ligne_commande_id is distinct from old.ligne_commande_id
     or new.rang is distinct from old.rang or new.nom_titulaire is distinct from old.nom_titulaire
     or new.jeton is distinct from old.jeton or new.code_court is distinct from old.code_court or new.cree_le is distinct from old.cree_le then
    raise exception 'KS_PASS_FIGE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.pass_figer() from public, anon, authenticated, service_role;
create trigger pass_figer before update on public.pass for each row execute function public.pass_figer();

-- Journal d'audit sans donnée personnelle ni secret.
create function public.pass_journaliser()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auteur jsonb;
begin
  begin
    v_auteur := nullif(current_setting('ks.auteur', true), '')::jsonb;
  exception when others then
    v_auteur := null;
  end;
  if v_auteur is null then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  insert into public.journal_audit (auteur, action, cible_table, cible_id, avant, apres)
  values (
    v_auteur, lower(tg_op), tg_table_name, new.id::text,
    case when tg_op = 'UPDATE' then jsonb_build_object('statut', old.statut) end,
    jsonb_build_object('statut', new.statut, 'commande_id', new.commande_id, 'evenement_id', new.evenement_id, 'type_pass_id', new.type_pass_id, 'rang', new.rang)
  );
  return new;
end;
$$;
revoke all on function public.pass_journaliser() from public, anon, authenticated, service_role;
create trigger pass_journaliser after insert or update on public.pass for each row execute function public.pass_journaliser();

-- Jeton du Code QR : 24 octets du générateur cryptographique de la base, en hexadécimal.
create function public.pass_jeton_generer()
returns text
language sql
volatile
set search_path = ''
as $$
  select encode(extensions.gen_random_bytes(24), 'hex')
$$;

-- Code court : 8 tirages indépendants dans un alphabet de 32 caractères (256 est un multiple de 32 : aucun biais). Réessaie en cas de collision.
create function public.pass_code_court_generer()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_octets bytea;
  v_code text;
  v_i integer;
begin
  loop
    v_octets := extensions.gen_random_bytes(8);
    v_code := '';
    for v_i in 0..7 loop
      v_code := v_code || substr(c_alphabet, (get_byte(v_octets, v_i) & 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.pass where code_court = v_code);
  end loop;
  return v_code;
end;
$$;
revoke all on function public.pass_jeton_generer() from public, anon, authenticated, service_role;
revoke all on function public.pass_code_court_generer() from public, anon, authenticated, service_role;

-- Émet les Pass d'une Commande de Pass payée (ou offerte, story 8.5). Interne : jamais appelée par un rôle client ni par le serveur directement.
-- Rejouable : (ligne, rang) est unique, un second appel n'ajoute rien. Rend le nombre de Pass créés par CET appel. Le Pass est `valide`.
-- Le statut de la Commande ne change pas : un Pass n'a ni fabrication ni livraison.
create function public.evenements_emettre_pass(p_commande uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.commande;
  v_l record;
  v_nom jsonb;
  v_rang integer;
  v_cree integer := 0;
  v_ins integer;
begin
  select * into v_c from public.commande where id = p_commande for update;
  if not found then
    raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_c.type <> 'pass' or v_c.statut not in ('payee', 'offerte') then
    raise exception 'KS_EMISSION_IMPOSSIBLE' using errcode = 'P0001';
  end if;

  for v_l in
    select l.id, l.type_pass_id, l.titulaires, t.evenement_id
    from public.ligne_commande l join public.type_pass t on t.id = l.type_pass_id
    where l.commande_id = v_c.id
    order by l.cree_le, l.id
  loop
    v_rang := 0;
    for v_nom in select value from jsonb_array_elements(v_l.titulaires) loop
      v_rang := v_rang + 1;
      insert into public.pass (evenement_id, type_pass_id, commande_id, ligne_commande_id, rang, nom_titulaire, jeton, code_court)
      values (v_l.evenement_id, v_l.type_pass_id, v_c.id, v_l.id, v_rang, v_nom #>> '{}', public.pass_jeton_generer(), public.pass_code_court_generer())
      on conflict (ligne_commande_id, rang) do nothing;
      get diagnostics v_ins = row_count;
      v_cree := v_cree + v_ins;
    end loop;
  end loop;

  -- Un seul email par Commande (clé fixe) : un rejeu ne le planifie jamais deux fois. Il ne porte que des identifiants.
  if exists (select 1 from public.pass where commande_id = v_c.id) then
    perform public.envois_planifier('pass_emis', v_c.compte_id, jsonb_build_object('commande_id', v_c.id), 'pass_emis:' || v_c.id::text);
  end if;
  return v_cree;
end;
$$;
revoke all on function public.evenements_emettre_pass(uuid) from public, anon, authenticated, service_role;

-- Places (personnes) occupées dans un Événement : Pass émis non annulés + Commandes de Pass en attente ou échouées non échues (un Stand compte pour 2).
-- Une Commande payée est comptée par ses Pass, jamais par ses lignes : aucune place n'est comptée deux fois.
create or replace function public.places_evenement_utilisees(p_evenement uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((
      select sum(l.nombre * (case when l.est_stand then 2 else 1 end))
      from public.ligne_commande l
      join public.type_pass t on t.id = l.type_pass_id
      join public.commande c on c.id = l.commande_id
      where t.evenement_id = p_evenement
        and c.type = 'pass'
        and c.statut in ('en_attente', 'echouee') and c.expire_le is not null and c.expire_le > now()
    ), 0)
    + (select count(*) from public.pass p where p.evenement_id = p_evenement and p.statut not in ('annule', 'rembourse'))
  )::integer
$$;

-- Unités vendues d'un Type de pass (pour un Stand : des Stands, pas des personnes), mêmes règles.
create or replace function public.places_type_pass_utilisees(p_type uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select (
    coalesce((
      select sum(l.nombre)
      from public.ligne_commande l
      join public.commande c on c.id = l.commande_id
      where l.type_pass_id = p_type
        and c.type = 'pass'
        and c.statut in ('en_attente', 'echouee') and c.expire_le is not null and c.expire_le > now()
    ), 0)
    + coalesce((
      select ceil(count(*)::numeric / (case when (select t.est_stand from public.type_pass t where t.id = p_type) then 2 else 1 end))
      from public.pass p where p.type_pass_id = p_type and p.statut not in ('annule', 'rembourse')
    ), 0)
  )::integer
$$;

-- confirmer_paiement : même corps que 20261217100000 ; en plus, une Commande de type pass émet ses Pass dans la même transaction.
create or replace function public.confirmer_paiement(
  p_auteur jsonb, p_tentative uuid, p_comparaison text, p_montant_recu numeric, p_devise_recue text, p_reference_transaction text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t record;
  v_c record;
  v_motif text;
  v_physique boolean;
  v_ligne record;
  v_nouveaux integer := 0;
  v_pass integer := 0;
  v_manque integer := 0;
  v_l record;
  v_dispo integer;
  v_retire integer;
begin
  if p_comparaison is null or p_comparaison not in ('egal', 'inferieur', 'superieur') then
    raise exception 'KS_COMPARAISON_INVALIDE' using errcode = 'P0001';
  end if;
  if p_montant_recu is null or p_montant_recu < 0 or p_devise_recue is null or p_devise_recue !~ '^[A-Z]{3}$' then
    raise exception 'KS_MONTANT_INVALIDE' using errcode = 'P0001';
  end if;
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' or coalesce(p_auteur ->> 'type', '') not in ('systeme', 'cron') then
    raise exception 'KS_AUTEUR_INVALIDE' using errcode = 'P0001';
  end if;
  if p_reference_transaction is not null and char_length(p_reference_transaction) not between 1 and 120 then
    raise exception 'KS_REFERENCE_INVALIDE' using errcode = 'P0001';
  end if;

  select * into v_t from public.tentative_paiement where id = p_tentative for update;
  if not found then
    raise exception 'KS_TENTATIVE_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Rejeu : une Tentative déjà réussie n'a plus aucun effet.
  if v_t.statut = 'reussie' then
    return jsonb_build_object('resultat', 'deja_traite');
  end if;

  select * into v_c from public.commande where id = v_t.commande_id for update;
  perform set_config('ks.auteur', p_auteur::text, true);

  -- Référence du Prestataire : celle de la notification doit être celle de la Tentative ; sans aucune référence, rien n'est validé.
  if p_reference_transaction is not null and v_t.reference_transaction is not null and p_reference_transaction <> v_t.reference_transaction then
    insert into public.anomalie (type, gravite, cible_type, cible_id, details)
    values ('notification_invalide', 'critique', 'tentative', v_t.id, jsonb_build_object('motif', 'reference_differente', 'commande_id', v_c.id))
    on conflict do nothing;
    return jsonb_build_object('resultat', 'reference_incoherente');
  end if;
  if coalesce(p_reference_transaction, v_t.reference_transaction) is null then
    insert into public.anomalie (type, gravite, cible_type, cible_id, details)
    values ('notification_invalide', 'critique', 'tentative', v_t.id, jsonb_build_object('motif', 'reference_absente', 'commande_id', v_c.id))
    on conflict do nothing;
    return jsonb_build_object('resultat', 'reference_incoherente');
  end if;
  if v_t.reference_transaction is null then
    begin
      update public.tentative_paiement set reference_transaction = p_reference_transaction where id = v_t.id;
    exception when unique_violation then
      insert into public.anomalie (type, gravite, cible_type, cible_id, details)
      values ('notification_invalide', 'critique', 'tentative', v_t.id, jsonb_build_object('motif', 'reference_deja_utilisee', 'commande_id', v_c.id))
      on conflict do nothing;
      return jsonb_build_object('resultat', 'reference_incoherente');
    end;
    v_t.reference_transaction := p_reference_transaction;
  end if;

  update public.tentative_paiement
    set statut = 'reussie', cause = null, montant_recu = p_montant_recu, devise_recue = p_devise_recue, modifie_le = now()
  where id = v_t.id;

  -- Commande qui ne peut plus être honorée (déjà payée, expirée, annulée, réservations libérées) : trop-perçu, quel que soit le montant.
  if v_c.statut not in ('en_attente', 'echouee') or v_c.expire_le is null or v_c.expire_le <= now() then
    v_motif := case
      when v_c.statut in ('payee', 'en_fabrication', 'expediee', 'livree') then 'deja_payee'
      when v_c.statut = 'expiree' then 'expiree'
      when v_c.statut in ('annulee', 'remboursee') then 'annulee'
      else 'reservations_liberees'
    end;
    insert into public.trop_percu (commande_id, tentative_id, motif, montant_attendu_cents, montant_recu, devise_recue)
    values (v_c.id, v_t.id, v_motif, v_t.montant_attendu_cents, p_montant_recu, p_devise_recue)
    on conflict (tentative_id) do nothing;
    return jsonb_build_object('resultat', 'trop_percu', 'motif', v_motif);
  end if;

  if p_comparaison = 'inferieur' then
    insert into public.anomalie (type, gravite, cible_type, cible_id, details)
    values ('montant_insuffisant', 'critique', 'tentative', v_t.id,
      jsonb_build_object('montant_attendu_cents', v_t.montant_attendu_cents, 'montant_recu', p_montant_recu, 'devise_recue', p_devise_recue, 'commande_id', v_c.id))
    on conflict do nothing;
    return jsonb_build_object('resultat', 'montant_insuffisant');
  end if;

  if p_comparaison = 'superieur' then
    insert into public.trop_percu (commande_id, tentative_id, motif, montant_attendu_cents, montant_recu, devise_recue)
    values (v_c.id, v_t.id, 'montant_superieur', v_t.montant_attendu_cents, p_montant_recu, p_devise_recue)
    on conflict (tentative_id) do nothing;
    return jsonb_build_object('resultat', 'trop_percu', 'motif', 'montant_superieur');
  end if;

  -- Montant égal, Commande honorable (réservations actives) : stock, Plafond et Code promo ne sont pas revérifiés (AD-26, AD-29).
  select exists (
    select 1 from public.ligne_commande l join public.produit p on p.id = l.produit_id where l.commande_id = v_c.id and p.famille <> 'kit'
  ) into v_physique;

  update public.commande
    set statut = 'payee', prestataire = v_t.prestataire, reference_transaction = v_t.reference_transaction, paye_le = now(), mis_a_jour_le = now()
  where id = v_c.id;

  -- Stock des lignes d'origine « stock » : variantes verrouillées dans un ordre fixe, plancher à zéro (un stock baissé à la main depuis la
  -- réservation ne doit jamais empêcher d'enregistrer un paiement déjà encaissé : anomalie à la place).
  perform 1 from public.variante
  where id in (select variante_id from public.ligne_commande where commande_id = v_c.id and origine = 'stock')
  order by id for update;
  -- Quantite reellement retiree du stock, ligne par ligne (ligne_commande.stock_retire) : l'annulation rendra exactement cette quantite.
  for v_l in
    select l.id, l.variante_id, l.nombre from public.ligne_commande l where l.commande_id = v_c.id and l.origine = 'stock' order by l.variante_id, l.id
  loop
    select v.stock into v_dispo from public.variante v where v.id = v_l.variante_id;
    v_retire := least(v_l.nombre, greatest(coalesce(v_dispo, 0), 0));
    update public.variante set stock = stock - v_retire where id = v_l.variante_id;
    update public.ligne_commande set stock_retire = v_retire where id = v_l.id;
    v_manque := v_manque + (v_l.nombre - v_retire);
  end loop;
  if v_manque > 0 then
    insert into public.anomalie (type, gravite, cible_type, cible_id, details)
    values ('stock_insuffisant', 'critique', 'commande', v_c.id, jsonb_build_object('pieces_manquantes', v_manque))
    on conflict do nothing;
  end if;

  update public.reservation set liberee_le = now() where commande_id = v_c.id and liberee_le is null;

  -- Kits : accès ouvert aussitôt (AD-11). Un Kit déjà possédé ne bloque pas le paiement : anomalie.
  for v_ligne in
    select l.produit_id from public.ligne_commande l join public.produit p on p.id = l.produit_id
    where l.commande_id = v_c.id and p.famille = 'kit'
  loop
    if public.bibliotheque_ouvrir_acces(v_c.compte_id, v_ligne.produit_id, v_c.id) then
      v_nouveaux := v_nouveaux + 1;
      perform public.envois_planifier('kit_ouvert', v_c.compte_id, jsonb_build_object('commande_id', v_c.id, 'produit_id', v_ligne.produit_id),
        'kit_ouvert:' || v_c.id::text || ':' || v_ligne.produit_id::text);
    else
      insert into public.anomalie (type, gravite, cible_type, cible_id, details)
      values ('kit_deja_possede', 'attention', 'commande', v_c.id, jsonb_build_object('produit_id', v_ligne.produit_id))
      on conflict do nothing;
    end if;
  end loop;

  if v_c.type = 'pass' then
    -- Commande de Pass (story 7.5) : un Pass par titulaire et l'email « pass_emis », dans la même transaction que le passage à « payee ».
    -- Toute erreur d'émission annule aussi le paiement enregistré : jamais une Commande payée sans ses Pass. La Commande reste payee.
    v_pass := public.evenements_emettre_pass(v_c.id);
  elsif v_physique then
    perform public.envois_planifier('commande_payee', v_c.compte_id, jsonb_build_object('commande_id', v_c.id), 'commande_payee:' || v_c.id::text);
  elsif v_c.type = 'produits' then
    -- Commande 100 % numérique : payee puis livree dans la même transaction (deux lignes de journal).
    update public.commande set statut = 'livree', mis_a_jour_le = now() where id = v_c.id and statut = 'payee';
  end if;

  -- Le Panier n'est vidé que des lignes de cette Commande : un article ajouté pendant l'attente du paiement reste.
  delete from public.ligne_panier lp
  using public.panier p
  where lp.panier_id = p.id and p.compte_id = v_c.compte_id
    and exists (
      select 1 from public.ligne_commande l
      where l.commande_id = v_c.id and l.produit_id = lp.produit_id and l.variante_id is not distinct from lp.variante_id
    );

  return jsonb_build_object('resultat', 'payee', 'kits_ouverts', v_nouveaux) || case when v_c.type = 'pass' then jsonb_build_object('pass_emis', v_pass) else '{}'::jsonb end;
end;
$$;

revoke all on function public.confirmer_paiement(jsonb, uuid, text, numeric, text, text) from public, anon, authenticated;
grant execute on function public.confirmer_paiement(jsonb, uuid, text, numeric, text, text) to service_role;
