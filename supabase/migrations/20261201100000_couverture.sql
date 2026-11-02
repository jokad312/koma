-- Story 5.1 : Couverture des Agrégateurs. Table couverture (module paiement) : chaque ligne relie un Agrégateur à un couple pays-opérateur,
-- avec sa source (document ou contrat) et son état (« à vérifier » ou « confirmé »). Règle 9 et Q-1 : la couverture vient de la documentation
-- officielle et des contrats, jamais d'une supposition. AUCUNE ligne n'est créée ici : aucun pays ni aucun opérateur n'est écrit en dur.
-- Seul un couple confirmé d'un Agrégateur actif sert au paiement (lu par le serveur). Chaque ajout, confirmation ou retrait est journalisé.

create table public.couverture (
  id uuid primary key default gen_random_uuid(),
  prestataire text not null references public.prestataire (code),
  -- Code pays ISO 3166-1 alpha-2, en majuscules (saisi par Jonathan ; son nom s'affiche par la bibliothèque d'internationalisation).
  pays text not null check (pays ~ '^[A-Z]{2}$'),
  operateur text not null check (char_length(operateur) between 1 and 40 and operateur = btrim(operateur)),
  -- Document ou contrat dont le couple est tiré (obligatoire).
  source text not null check (char_length(source) between 3 and 300 and source = btrim(source)),
  etat text not null default 'a_verifier' check (etat in ('a_verifier', 'confirme')),
  cree_le timestamptz not null default now(),
  modifie_le timestamptz not null default now(),
  constraint couverture_couple_unique unique (prestataire, pays, operateur)
);

create index couverture_confirmee_idx on public.couverture (prestataire) where etat = 'confirme';

alter table public.couverture enable row level security;
revoke all on public.couverture from public, anon, authenticated;

create trigger couverture_journaliser
  after insert or update or delete on public.couverture
  for each row execute function public.journaliser('id');

-- Ajoute un couple « à vérifier » (admin). La source est obligatoire. Seuls les Agrégateurs ont une Couverture.
create function public.ajouter_couverture(p_auteur jsonb, p_prestataire text, p_pays text, p_operateur text, p_source text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pays text := upper(btrim(coalesce(p_pays, '')));
  v_operateur text := btrim(coalesce(p_operateur, ''));
  v_source text := btrim(coalesce(p_source, ''));
  v_id uuid;
begin
  perform public.exiger_admin(p_auteur);
  if v_source = '' or char_length(v_source) < 3 then
    raise exception 'KS_SOURCE_MANQUANTE' using errcode = 'P0001';
  end if;
  if v_pays !~ '^[A-Z]{2}$' then
    raise exception 'KS_PAYS_INVALIDE' using errcode = 'P0001';
  end if;
  if char_length(v_operateur) < 1 or char_length(v_operateur) > 40 then
    raise exception 'KS_OPERATEUR_INVALIDE' using errcode = 'P0001';
  end if;
  if char_length(v_source) > 300 then
    raise exception 'KS_SOURCE_INVALIDE' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.prestataire where code = p_prestataire and type = 'agregateur') then
    raise exception 'KS_AGREGATEUR_INVALIDE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  begin
    insert into public.couverture (prestataire, pays, operateur, source) values (p_prestataire, v_pays, v_operateur, v_source) returning id into v_id;
  exception when unique_violation then
    raise exception 'KS_COUPLE_EXISTANT' using errcode = 'P0001';
  end;
  return v_id;
end;
$$;

-- Confirme un couple (admin) : il peut alors servir au paiement, si son Agrégateur est actif.
create function public.confirmer_couverture(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_admin(p_auteur);
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.couverture set etat = 'confirme', modifie_le = now() where id = p_id and etat = 'a_verifier';
  if not found and not exists (select 1 from public.couverture where id = p_id) then
    raise exception 'KS_COUVERTURE_INTROUVABLE' using errcode = 'P0001';
  end if;
end;
$$;

-- Retire un couple (admin).
create function public.retirer_couverture(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_admin(p_auteur);
  perform set_config('ks.auteur', p_auteur::text, true);
  delete from public.couverture where id = p_id;
  if not found then
    raise exception 'KS_COUVERTURE_INTROUVABLE' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.ajouter_couverture(jsonb, text, text, text, text) from public, anon, authenticated;
revoke all on function public.confirmer_couverture(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.retirer_couverture(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.ajouter_couverture(jsonb, text, text, text, text) to service_role;
grant execute on function public.confirmer_couverture(jsonb, uuid) to service_role;
grant execute on function public.retirer_couverture(jsonb, uuid) to service_role;
