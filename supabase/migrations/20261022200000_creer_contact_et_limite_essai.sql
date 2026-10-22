-- Story 1.8 : limitation des essais (consommer_essai, AD-22), messages de contact, lecture publique du numéro WhatsApp.
-- Mêmes règles que la 1.7 : SECURITY DEFINER, search_path vide, service_role seulement (AD-25), droit admin revérifié en base.
-- Les migrations précédentes ne sont pas modifiées.

-- Compteurs de la limitation des essais : fenêtre fixe, un compteur par clé et par fenêtre. Pas de nettoyage planifié au lancement.
-- La clé est choisie par le serveur (jamais une adresse brute). Non journalisée : ce sont des compteurs techniques.
create table public.limite_essai (
  cle text not null check (char_length(cle) between 1 and 200),
  fenetre_debut timestamptz not null,
  compteur integer not null default 0 check (compteur >= 0),
  primary key (cle, fenetre_debut)
);

alter table public.limite_essai enable row level security;
-- Aucune politique et aucun droit pour anon ni authenticated : seul le serveur écrit, par consommer_essai.
revoke all on public.limite_essai from public, anon, authenticated;

-- Compte un essai pour la clé dans la fenêtre fixe en cours (insert ... on conflict : atomique, sans course entre deux requêtes).
-- Renvoie vrai si l'essai est permis (compteur <= maximum), faux si la limite est dépassée. Un essai refusé est compté aussi.
create function public.consommer_essai(p_cle text, p_fenetre_secondes integer, p_maximum integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debut timestamptz;
  v_compteur integer;
begin
  if p_cle is null or btrim(p_cle) = '' or char_length(p_cle) > 200
     or p_fenetre_secondes is null or p_fenetre_secondes < 1
     or p_maximum is null or p_maximum < 1 then
    raise exception 'KS_LIMITE_INVALIDE' using errcode = 'P0001';
  end if;

  v_debut := to_timestamp(floor(extract(epoch from now()) / p_fenetre_secondes) * p_fenetre_secondes);

  insert into public.limite_essai as l (cle, fenetre_debut, compteur)
  values (p_cle, v_debut, 1)
  on conflict (cle, fenetre_debut) do update set compteur = l.compteur + 1
  returning l.compteur into v_compteur;

  return v_compteur <= p_maximum;
end;
$$;

revoke all on function public.consommer_essai(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consommer_essai(text, integer, integer) to service_role;

-- Messages du formulaire de contact : tâche admin (nouveau, puis traite). Lecture réservée à l'admin, par le serveur.
create table public.message_contact (
  id uuid primary key default gen_random_uuid(),
  nom text not null check (char_length(nom) between 1 and 80),
  email text not null check (char_length(email) between 3 and 254),
  message text not null check (char_length(message) between 10 and 2000),
  langue text not null check (langue in ('fr', 'en')),
  statut text not null default 'nouveau' check (statut in ('nouveau', 'traite')),
  cree_le timestamptz not null default now(),
  traite_le timestamptz
);

create index message_contact_statut_cree on public.message_contact (statut, cree_le);

alter table public.message_contact enable row level security;
-- Aucune politique et aucun droit pour anon ni authenticated.
revoke all on public.message_contact from public, anon, authenticated;

-- L'insertion n'est pas journalisée (données personnelles) ; le passage à « traite » l'est (colonnes modifiées seulement).
create trigger message_contact_journaliser
  after update on public.message_contact
  for each row execute function public.journaliser('id');

-- Enregistre un message de contact. Auteur : un visiteur (type « visiteur »), jamais un Compte. Revalide tout (la base a le dernier mot).
create function public.enregistrer_message_contact(
  p_auteur jsonb,
  p_nom text,
  p_email text,
  p_message text,
  p_langue text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nom text := btrim(coalesce(p_nom, ''));
  v_email text := btrim(coalesce(p_email, ''));
  v_message text := btrim(coalesce(p_message, ''));
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  if (p_auteur ->> 'type') is distinct from 'visiteur' then
    raise exception 'KS_AUTEUR_INVALIDE' using errcode = 'P0001';
  end if;
  if char_length(v_nom) not between 1 and 80
     or char_length(v_email) not between 3 and 254
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
     or char_length(v_message) not between 10 and 2000
     or p_langue is null or p_langue not in ('fr', 'en') then
    raise exception 'KS_MESSAGE_INVALIDE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  insert into public.message_contact (nom, email, message, langue)
  values (v_nom, v_email, v_message, p_langue);
end;
$$;

revoke all on function public.enregistrer_message_contact(jsonb, text, text, text, text) from public, anon, authenticated;
grant execute on function public.enregistrer_message_contact(jsonb, text, text, text, text) to service_role;

-- Passe un message « nouveau » à « traite » (admin). Le trigger journalise le changement avec l'auteur.
create function public.marquer_message_traite(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.exiger_admin(p_auteur);
  perform set_config('ks.auteur', p_auteur::text, true);

  update public.message_contact
    set statut = 'traite', traite_le = now()
    where id = p_id and statut = 'nouveau';
  if not found then
    raise exception 'KS_MESSAGE_INTROUVABLE' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.marquer_message_traite(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.marquer_message_traite(jsonb, uuid) to service_role;

-- Le numéro WhatsApp est affiché publiquement (bouton, pied de page) : la lecture publique passe à deux clés, pas une de plus.
drop policy reglage_lecture_publique on public.reglage;
create policy reglage_lecture_publique on public.reglage
  for select to anon, authenticated
  using (cle in ('nom_site', 'numero_whatsapp'));
