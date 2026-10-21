-- Story 1.2 : table reglage (nom du site), journal d'audit minimal et trigger journaliser().
-- La table `role_utilisateur` et la fonction `a_le_role` arrivent avec la story 1.7 : d'ici là,
-- aucune politique n'ouvre l'écriture à anon ni à authenticated ; seul le serveur (service_role) écrit.

create table public.journal_audit (
  id bigint generated always as identity primary key,
  auteur jsonb not null,
  action text not null,
  cible_table text not null,
  cible_id text not null,
  avant jsonb,
  apres jsonb,
  cree_le timestamptz not null default now()
);

alter table public.journal_audit enable row level security;
revoke all on public.journal_audit from public, anon, authenticated;

-- Masque emails et numéros de téléphone dans une valeur journalisée.
create function public.masquer_donnee_personnelle(p_valeur jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when jsonb_typeof(p_valeur) = 'string' and (p_valeur #>> '{}') ~ '^[^@\s]+@[^@\s]+$' then to_jsonb('***@***'::text)
    when jsonb_typeof(p_valeur) = 'string' and (p_valeur #>> '{}') ~ '^\+?[0-9][0-9 .()-]{6,}$' then to_jsonb('***'::text)
    else p_valeur
  end
$$;

-- Journalise les colonnes modifiées ; refuse toute écriture sans auteur (posé par le serveur : ks.auteur).
create function public.journaliser()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auteur jsonb;
  v_avant jsonb := '{}'::jsonb;
  v_apres jsonb := '{}'::jsonb;
  v_ancien jsonb;
  v_nouveau jsonb;
  v_colonne text;
begin
  begin
    v_auteur := nullif(current_setting('ks.auteur', true), '')::jsonb;
  exception when others then
    v_auteur := null;
  end;
  if v_auteur is null then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;

  v_ancien := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_nouveau := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;

  for v_colonne in select distinct k from jsonb_object_keys(v_ancien || v_nouveau) as k loop
    if v_ancien -> v_colonne is distinct from v_nouveau -> v_colonne then
      if v_ancien ? v_colonne then
        v_avant := v_avant || jsonb_build_object(v_colonne, public.masquer_donnee_personnelle(v_ancien -> v_colonne));
      end if;
      if v_nouveau ? v_colonne then
        v_apres := v_apres || jsonb_build_object(v_colonne, public.masquer_donnee_personnelle(v_nouveau -> v_colonne));
      end if;
    end if;
  end loop;

  insert into public.journal_audit (auteur, action, cible_table, cible_id, avant, apres)
  values (
    v_auteur,
    lower(tg_op),
    tg_table_name,
    coalesce(v_nouveau ->> tg_argv[0], v_ancien ->> tg_argv[0]),
    nullif(v_avant, '{}'::jsonb),
    nullif(v_apres, '{}'::jsonb)
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.journaliser() from public, anon, authenticated;
revoke all on function public.masquer_donnee_personnelle(jsonb) from public, anon, authenticated;

create table public.reglage (
  cle text primary key,
  valeur text,
  mis_a_jour_le timestamptz not null default now()
);

alter table public.reglage enable row level security;

-- Écriture : aucune politique ni droit pour anon et authenticated (le serveur écrit avec service_role, rôle admin vérifié en 1.7).
revoke all on public.reglage from public, anon, authenticated;
grant select on public.reglage to anon, authenticated;

-- Lecture publique de nom_site seule.
create policy reglage_lecture_publique on public.reglage
  for select to anon, authenticated
  using (cle = 'nom_site');

create trigger reglage_journaliser
  after insert or update or delete on public.reglage
  for each row execute function public.journaliser('cle');

-- Valeur de départ provisoire (Q-N1 : nom définitif à décider par Jonathan).
select set_config('ks.auteur', '{"type":"migration","nom":"creer_reglage"}', true);
insert into public.reglage (cle, valeur) values ('nom_site', 'KOMA SHOP');
