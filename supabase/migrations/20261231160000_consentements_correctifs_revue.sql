-- Story 9.4, correctifs de la revue :
-- 1. emails_commerciaux_bloques_mineur est interne : fermée aussi à service_role (privilège donné par défaut aux nouvelles fonctions).
-- 2. desinscrire est idempotent : un lien rouvert (rechargement, logiciel de prévisualisation) n'ajoute ni ligne ni entrée de journal
--    tant qu'aucun consentement n'a été redonné depuis la dernière désinscription.

revoke all on function public.emails_commerciaux_bloques_mineur(uuid) from service_role;

create or replace function public.desinscrire(p_compte uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dernier_don timestamptz;
begin
  if p_compte is null or not exists (select 1 from auth.users where id = p_compte) then
    return false;
  end if;
  perform set_config('ks.auteur', jsonb_build_object('type', 'systeme', 'nom', 'lien_desinscription', 'compte', p_compte)::text, true);
  perform pg_advisory_xact_lock(hashtextextended('consentement:' || p_compte::text, 0));
  select max(donne_le) into v_dernier_don from public.consentement where compte_id = p_compte;
  if not exists (select 1 from public.consentement where compte_id = p_compte and retire_le is null)
     and exists (select 1 from public.desinscription where compte_id = p_compte and cree_le >= coalesce(v_dernier_don, '-infinity'::timestamptz)) then
    -- Déjà désinscrit, rien de redonné depuis : effet déjà acquis.
    return true;
  end if;
  insert into public.desinscription (compte_id) values (p_compte);
  update public.consentement set retire_le = now() where compte_id = p_compte and retire_le is null;
  return true;
end;
$$;
