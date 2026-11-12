-- Story 8.5 : opération « 10 Pass gratuits » (FR-42, AD-33).
-- Jonathan attribue un Pass Standard offert à l'auteur d'une Réalisation validée, pour un Événement à venir qui a encore de la place.
-- Au plus 10 Pass offerts par Événement (rang 1 à 10, unique), un seul par Compte et par Événement, une Réalisation donne au plus un Pass.
-- Le Pass vient d'une Commande de Pass « offerte » (0 USD, sans Prestataire) et s'émet comme un Pass normal (Code QR, email pass_emis, « Mes Pass », « Offert »).

create table public.pass_offert (
  id uuid primary key default gen_random_uuid(),
  evenement_id uuid not null references public.evenement (id) on delete restrict,
  rang smallint not null check (rang between 1 and 10),
  compte_id uuid not null references auth.users (id) on delete cascade,
  realisation_id uuid not null unique references public.realisation (id) on delete cascade,
  commande_id uuid not null unique references public.commande (id) on delete cascade,
  cree_le timestamptz not null default now(),
  constraint pass_offert_rang_unique unique (evenement_id, rang),
  constraint pass_offert_compte_unique unique (evenement_id, compte_id)
);
alter table public.pass_offert enable row level security;
revoke all on public.pass_offert from public, anon, authenticated;
grant select on public.pass_offert to service_role;
create trigger pass_offert_journaliser
  after insert or update or delete on public.pass_offert
  for each row execute function public.journaliser('id');

-- Ce que l'Admin voit pour attribuer : les Événements à venir, publiés, avec de la place et moins de 10 Pass offerts (avec leurs Types de pass
-- non Stand), et les attributions déjà faites par Réalisation.
create function public.pass_offerts_options(p_auteur jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_evenements jsonb;
  v_attributions jsonb;
begin
  perform public.exiger_admin(p_auteur);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'titre_fr', e.titre_fr, 'titre_en', e.titre_en, 'debut_le', e.debut_le,
    'attribues', (select count(*) from public.pass_offert o where o.evenement_id = e.id),
    'types', (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'nom_fr', t.nom_fr, 'nom_en', t.nom_en) order by t.prix_cents, t.nom_fr), '[]'::jsonb)
              from public.type_pass t where t.evenement_id = e.id and not t.est_stand)
  ) order by e.debut_le), '[]'::jsonb) into v_evenements
  from public.evenement e
  where e.publie_le is not null and e.publie_le <= now() and e.debut_le is not null and e.debut_le > now()
    and (select count(*) from public.pass_offert o where o.evenement_id = e.id) < 10
    and (e.capacite is null or e.capacite - public.places_evenement_utilisees(e.id) >= 1)
    and exists (select 1 from public.type_pass t where t.evenement_id = e.id and not t.est_stand);
  select coalesce(jsonb_agg(jsonb_build_object('realisation_id', o.realisation_id, 'evenement_id', o.evenement_id, 'rang', o.rang)), '[]'::jsonb) into v_attributions
  from public.pass_offert o;
  return jsonb_build_object('evenements', v_evenements, 'attributions', v_attributions);
end;
$$;

-- Le Compte et le pseudo d'une Réalisation (pour nommer le titulaire du Pass).
create function public.realisation_pour_offre(p_auteur jsonb, p_realisation uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_r record;
begin
  perform public.exiger_admin(p_auteur);
  select z.compte_id, ph.nom_affiche into v_r from public.realisation z join public.photo_galerie ph on ph.id = z.photo_id where z.id = p_realisation;
  if not found then
    raise exception 'KS_REALISATION_INTROUVABLE' using errcode = 'P0001';
  end if;
  return jsonb_build_object('compte_id', v_r.compte_id, 'nom_affiche', v_r.nom_affiche);
end;
$$;

-- Attribution. Verrouille l'Événement, vérifie la Réalisation validée et le Kit payé, le rang suivant (1 à 10), puis crée la Commande offerte et émet le Pass.
-- Événement complet : aucune Commande, une anomalie « pass_offert_impossible » est créée et la réponse porte KS_COMPLET (l'anomalie est écrite, donc pas d'exception).
create function public.attribuer_pass_offert(p_auteur jsonb, p_realisation uuid, p_type uuid, p_titulaire text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom text := regexp_replace(btrim(coalesce(p_titulaire, '')), '\s+', ' ', 'g');
  v_r record;
  v_t public.type_pass;
  v_e public.evenement;
  v_rang integer;
  v_id uuid;
  v_numero text;
begin
  perform public.exiger_admin(p_auteur);
  if char_length(v_nom) not between 2 and 80 then
    raise exception 'KS_TITULAIRE_INVALIDE' using errcode = 'P0001';
  end if;
  select z.id, z.compte_id, z.produit_id, z.validee_le, ph.statut as photo_statut into v_r
  from public.realisation z join public.photo_galerie ph on ph.id = z.photo_id where z.id = p_realisation;
  if not found then
    raise exception 'KS_REALISATION_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_r.validee_le is null or v_r.photo_statut <> 'publiee' then
    raise exception 'KS_REALISATION_NON_VALIDEE' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.acces_kit a join public.commande c on c.id = a.commande_origine and c.paye_le is not null
    where a.compte_id = v_r.compte_id and a.produit_id = v_r.produit_id
  ) then
    raise exception 'KS_KIT_NON_PAYE' using errcode = 'P0001';
  end if;
  select * into v_t from public.type_pass where id = p_type;
  if not found or v_t.est_stand then
    raise exception 'KS_TYPE_PASS_INTROUVABLE' using errcode = 'P0001';
  end if;
  -- Verrou de l'Événement : deux attributions simultanées s'attendent ; le rang suivant est calculé sous ce verrou.
  select * into v_e from public.evenement where id = v_t.evenement_id for update;
  if v_e.publie_le is null or v_e.publie_le > now() or v_e.debut_le is null or v_e.debut_le <= now() then
    raise exception 'KS_EVENEMENT_INDISPONIBLE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.pass_offert where realisation_id = p_realisation) then
    raise exception 'KS_REALISATION_DEJA_UTILISEE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.pass_offert where evenement_id = v_e.id and compte_id = v_r.compte_id) then
    raise exception 'KS_DEJA_OFFERT' using errcode = 'P0001';
  end if;
  select coalesce(max(rang), 0) + 1 into v_rang from public.pass_offert where evenement_id = v_e.id;
  if v_rang > 10 then
    raise exception 'KS_OPERATION_TERMINEE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  if (v_e.capacite is not null and v_e.capacite - public.places_evenement_utilisees(v_e.id) < 1)
     or (v_t.quota is not null and public.places_type_pass_utilisees(v_t.id) + 1 > v_t.quota) then
    insert into public.anomalie (type, gravite, cible_type, cible_id, details)
    values ('pass_offert_impossible', 'attention', 'realisation', p_realisation, jsonb_build_object('evenement_id', v_e.id, 'type_pass_id', v_t.id, 'raison', 'KS_COMPLET'))
    on conflict (type, cible_type, cible_id) where resolue_le is null do nothing;
    return jsonb_build_object('attribue', false, 'erreur', 'KS_COMPLET');
  end if;

  insert into public.commande (compte_id, type, statut, offerte, sous_total_cents, total_cents, cle_idempotence)
  values (v_r.compte_id, 'pass', 'offerte', true, 0, 0, 'pass-offert:' || p_realisation::text)
  returning id, numero into v_id, v_numero;
  insert into public.ligne_commande (commande_id, produit_id, nombre, prix_cents, reduction_cents, type_pass_id, titulaires, pass_nom_fr, pass_nom_en, est_stand)
  values (v_id, null, 1, 0, 0, v_t.id, jsonb_build_array(v_nom), v_t.nom_fr, nullif(v_t.nom_en, ''), false);
  perform public.evenements_emettre_pass(v_id);
  insert into public.pass_offert (evenement_id, rang, compte_id, realisation_id, commande_id) values (v_e.id, v_rang, v_r.compte_id, p_realisation, v_id);
  return jsonb_build_object('attribue', true, 'rang', v_rang, 'commande_id', v_id, 'numero', v_numero, 'evenement_id', v_e.id);
end;
$$;

-- Événements dont l'opération est terminée (10 Pass offerts attribués) : lisible par le serveur pour la page des Réalisations du client.
create function public.operations_pass_offerts_terminees()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('titre_fr', e.titre_fr, 'titre_en', e.titre_en, 'slug', e.slug) order by e.debut_le), '[]'::jsonb)
  from public.evenement e
  where e.publie_le is not null and e.publie_le <= now() and e.debut_le is not null and e.debut_le > now()
    and (select count(*) from public.pass_offert o where o.evenement_id = e.id) >= 10
$$;

revoke all on function public.pass_offerts_options(jsonb) from public, anon, authenticated;
revoke all on function public.realisation_pour_offre(jsonb, uuid) from public, anon, authenticated;
revoke all on function public.attribuer_pass_offert(jsonb, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.operations_pass_offerts_terminees() from public, anon, authenticated;
grant execute on function public.pass_offerts_options(jsonb) to service_role;
grant execute on function public.realisation_pour_offre(jsonb, uuid) to service_role;
grant execute on function public.attribuer_pass_offert(jsonb, uuid, uuid, text) to service_role;
grant execute on function public.operations_pass_offerts_terminees() to service_role;
