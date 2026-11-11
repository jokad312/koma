-- Story 7.7, correctifs de revue.
-- 1. Seuls les Comptes dont l'email est CONFIRMÉ reçoivent un accès : sinon « sans_compte ». Un tiers ne peut pas pré-créer un Compte avec l'email du futur bénévole.
-- 2. La fenêtre suit la date de l'Événement : un déclencheur recalcule les accès quand debut_le ou fin_le change (même règle que l'attribution).
--    Sans date, la fenêtre devient VIDE (valable_jusqu_au = valable_du) : l'accès est invalide, jamais élargi.

-- Règle unique de la fenêtre : minuit de Goma du jour de début jusqu'à la fin du jour de fin (le jour de début sans fin). Interne.
create function public.acces_benevole_fenetre(p_debut timestamptz, p_fin timestamptz)
returns table (du timestamptz, jusqu_au timestamptz)
language sql
immutable
set search_path = ''
as $$
  select
    date_trunc('day', p_debut at time zone 'Africa/Lubumbashi') at time zone 'Africa/Lubumbashi',
    (date_trunc('day', (case when p_fin > p_debut then p_fin - interval '1 microsecond' else p_debut end) at time zone 'Africa/Lubumbashi') + interval '1 day') at time zone 'Africa/Lubumbashi'
  where p_debut is not null
$$;
revoke all on function public.acces_benevole_fenetre(timestamptz, timestamptz) from public, anon, authenticated;

-- Une fenêtre vide (sans date d'Événement) est permise ; une fenêtre à l'envers reste interdite.
alter table public.acces_benevole drop constraint acces_benevole_fenetre;
alter table public.acces_benevole add constraint acces_benevole_fenetre check (valable_jusqu_au >= valable_du);

create or replace function public.attribuer_acces_benevole(p_auteur jsonb, p_evenement uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_debut timestamptz;
  v_fin timestamptz;
  v_du timestamptz;
  v_jusqu_au timestamptz;
  v_compte uuid;
  v_id uuid;
  v_ancien_du timestamptz;
  v_ancien_au timestamptz;
begin
  perform public.exiger_admin(p_auteur);
  if char_length(v_email) not between 3 and 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'KS_EMAIL_INVALIDE' using errcode = 'P0001';
  end if;
  if p_evenement is null then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;

  select e.debut_le, e.fin_le into v_debut, v_fin from public.evenement e where e.id = p_evenement;
  if not found then
    raise exception 'KS_EVENEMENT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_debut is null then
    raise exception 'KS_EVENEMENT_SANS_DATE' using errcode = 'P0001';
  end if;
  select f.du, f.jusqu_au into v_du, v_jusqu_au from public.acces_benevole_fenetre(v_debut, v_fin) f;
  if v_jusqu_au <= now() then
    raise exception 'KS_EVENEMENT_PASSE' using errcode = 'P0001';
  end if;

  -- Email confirmé seulement : un Compte non confirmé peut avoir été créé par un tiers avec cette adresse.
  select u.id into v_compte from auth.users u
    where lower(u.email) = v_email and u.email_confirmed_at is not null order by u.created_at limit 1;
  if v_compte is null then
    return jsonb_build_object('statut', 'sans_compte');
  end if;

  insert into public.acces_benevole (compte_id, evenement_id, valable_du, valable_jusqu_au, cree_par)
  values (v_compte, p_evenement, v_du, v_jusqu_au, (p_auteur ->> 'id')::uuid)
  on conflict (compte_id, evenement_id) do nothing
  returning id into v_id;
  if v_id is not null then
    insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
    values (p_auteur, 'acces_benevole_attribue', 'acces_benevole', v_id::text,
      jsonb_build_object('compte_id', v_compte, 'evenement_id', p_evenement, 'valable_du', v_du, 'valable_jusqu_au', v_jusqu_au));
    return jsonb_build_object('statut', 'attribue', 'id', v_id);
  end if;

  select a.id, a.valable_du, a.valable_jusqu_au into v_id, v_ancien_du, v_ancien_au
    from public.acces_benevole a where a.compte_id = v_compte and a.evenement_id = p_evenement for update;
  if v_ancien_du = v_du and v_ancien_au = v_jusqu_au then
    return jsonb_build_object('statut', 'deja', 'id', v_id);
  end if;
  update public.acces_benevole set valable_du = v_du, valable_jusqu_au = v_jusqu_au, modifie_le = now() where id = v_id;
  insert into public.journal_audit (auteur, action, cible_table, cible_id, avant, apres)
  values (p_auteur, 'acces_benevole_mis_a_jour', 'acces_benevole', v_id::text,
    jsonb_build_object('valable_du', v_ancien_du, 'valable_jusqu_au', v_ancien_au),
    jsonb_build_object('compte_id', v_compte, 'evenement_id', p_evenement, 'valable_du', v_du, 'valable_jusqu_au', v_jusqu_au));
  return jsonb_build_object('statut', 'mis_a_jour', 'id', v_id);
end;
$$;
revoke all on function public.attribuer_acces_benevole(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.attribuer_acces_benevole(jsonb, uuid, text) to service_role;

-- La date de l'Événement change : les accès suivent. Sans date, fenêtre vide (accès invalide). Journalisé sans email.
create function public.evenement_recalculer_acces_benevole()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_du timestamptz;
  v_au timestamptz;
  v_auteur jsonb;
  r record;
begin
  if new.debut_le is not distinct from old.debut_le and new.fin_le is not distinct from old.fin_le then
    return new;
  end if;
  begin
    v_auteur := nullif(current_setting('ks.auteur', true), '')::jsonb;
  exception when others then
    v_auteur := null;
  end;
  v_auteur := coalesce(v_auteur, '{"type":"systeme","nom":"evenement_date_modifiee"}'::jsonb);
  select f.du, f.jusqu_au into v_du, v_au from public.acces_benevole_fenetre(new.debut_le, new.fin_le) f;

  for r in select a.id, a.compte_id, a.valable_du, a.valable_jusqu_au from public.acces_benevole a where a.evenement_id = new.id for update loop
    -- Sans date : fenêtre vide, ancrée sur le début actuel de l'accès.
    declare
      n_du timestamptz := coalesce(v_du, r.valable_du);
      n_au timestamptz := coalesce(v_au, r.valable_du);
    begin
      if n_du is distinct from r.valable_du or n_au is distinct from r.valable_jusqu_au then
        update public.acces_benevole set valable_du = n_du, valable_jusqu_au = n_au, modifie_le = now() where id = r.id;
        insert into public.journal_audit (auteur, action, cible_table, cible_id, avant, apres)
        values (v_auteur, 'acces_benevole_fenetre_recalculee', 'acces_benevole', r.id::text,
          jsonb_build_object('valable_du', r.valable_du, 'valable_jusqu_au', r.valable_jusqu_au),
          jsonb_build_object('compte_id', r.compte_id, 'evenement_id', new.id, 'valable_du', n_du, 'valable_jusqu_au', n_au));
      end if;
    end;
  end loop;
  return new;
end;
$$;
revoke all on function public.evenement_recalculer_acces_benevole() from public, anon, authenticated;

create trigger evenement_recalculer_acces_benevole
  after update of debut_le, fin_le on public.evenement
  for each row execute function public.evenement_recalculer_acces_benevole();
