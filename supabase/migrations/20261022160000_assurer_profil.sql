-- Correctif hors story (essai manuel du 2026-10-22) : un Compte Google recréé après suppression n'avait pas de ligne profil,
-- et l'étape « âge » échouait indéfiniment. Les migrations 20261021160000 et suivantes ne sont pas modifiées.
-- 1. Le déclencheur devient idempotent. 2. Rattrapage des Comptes sans profil. 3. assurer_profil : filet côté serveur.
-- Tout est idempotent : une ligne profil déjà présente (même ajoutée à la main) n'est jamais touchée.

create or replace function public.creer_profil_a_la_creation_du_compte()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_langue text := new.raw_user_meta_data ->> 'langue';
begin
  if v_langue is null or v_langue not in ('fr', 'en') then
    v_langue := 'fr';
  end if;
  insert into public.profil (id, langue) values (new.id, v_langue) on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.creer_profil_a_la_creation_du_compte() from public, anon, authenticated;

-- Rattrapage : même règle de langue que le déclencheur.
insert into public.profil (id, langue)
select u.id, case when u.raw_user_meta_data ->> 'langue' in ('fr', 'en') then u.raw_user_meta_data ->> 'langue' else 'fr' end
from auth.users u
where not exists (select 1 from public.profil p where p.id = u.id)
on conflict (id) do nothing;

-- Crée la ligne profil d'un Compte qui n'en a pas ; sans effet si elle existe. Convention AD-25 : service_role seulement,
-- p_compte vient de la session vérifiée par le serveur et doit être l'auteur. Le journal n'est écrit que si la ligne est créée.
create function public.assurer_profil(p_auteur jsonb, p_compte uuid, p_langue text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_crees integer;
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  if p_compte is null or (p_auteur ->> 'id') is distinct from p_compte::text then
    raise exception 'KS_DROIT_REFUSE' using errcode = 'P0001';
  end if;
  if p_langue is null or p_langue not in ('fr', 'en') then
    raise exception 'KS_LANGUE_INVALIDE' using errcode = 'P0001';
  end if;

  insert into public.profil (id, langue)
  select u.id, p_langue from auth.users u where u.id = p_compte
  on conflict (id) do nothing;
  get diagnostics v_crees = row_count;

  if v_crees > 0 then
    insert into public.journal_audit (auteur, action, cible_table, cible_id, avant, apres)
    values (p_auteur, 'profil_cree', 'profil', p_compte::text, null, jsonb_build_object('langue', p_langue));
  end if;
end;
$$;

revoke all on function public.assurer_profil(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.assurer_profil(jsonb, uuid, text) to service_role;
