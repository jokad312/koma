-- Story 4.2, correctifs de revue :
-- 1. supprimer un Compte (mineur de moins de 13 ans, demande admin) supprime son Panier en cascade : l'auteur « système » est posé comme pour role_utilisateur ;
-- 2. l'annonce « Kit déjà possédé » vaut 24 heures (plus de déclencheur qui l'efface à chaque écriture de ligne) ;
-- 3. la réunion de deux Paniers ne dépasse jamais le stock d'une taille non fabriquée sur commande ;
-- 4. panier_accessible : un Panier rattaché à un Compte n'est lisible ni modifiable par une autre personne sur le même appareil.

create function public.panier_auteur_cascade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 and coalesce(current_setting('ks.auteur', true), '') = '' then
    perform set_config('ks.auteur', '{"type":"systeme","nom":"suppression_compte"}', true);
  end if;
  return old;
end;
$$;
revoke all on function public.panier_auteur_cascade() from public, anon, authenticated;

create trigger panier_auteur_cascade
  before delete on public.panier
  for each row execute function public.panier_auteur_cascade();
create trigger ligne_panier_auteur_cascade
  before delete on public.ligne_panier
  for each row execute function public.panier_auteur_cascade();

drop trigger ligne_panier_effacer_avis on public.ligne_panier;
drop function public.panier_effacer_avis();

create or replace function public.avis_kit_possede(p_panier uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select kit_possede_retire_le > now() - interval '24 hours' from public.panier where id = p_panier), false)
$$;

-- Vrai si le Panier n'est lié à aucun Compte, ou au Compte donné (p_compte nul : visiteur sans session).
create function public.panier_accessible(p_panier uuid, p_compte uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.panier where id = p_panier and (compte_id is null or compte_id = p_compte))
$$;
revoke all on function public.panier_accessible(uuid, uuid) from public, anon, authenticated;
grant execute on function public.panier_accessible(uuid, uuid) to service_role;

create or replace function public.fusionner_panier(p_auteur jsonb, p_compte uuid, p_panier uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cible uuid;
  v_du_compte uuid;
  v_source record;
  v_source_ok boolean := false;
  v_ligne record;
  v_retires integer := 0;
begin
  if p_auteur is null or jsonb_typeof(p_auteur) <> 'object' then
    raise exception 'KS_AUTEUR_MANQUANT' using errcode = 'P0001';
  end if;
  if p_compte is null or not exists (select 1 from auth.users where id = p_compte) then
    raise exception 'KS_COMPTE_INTROUVABLE' using errcode = 'P0001';
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  -- Deux connexions simultanées du même Compte s'attendent : un seul Panier actif.
  perform pg_advisory_xact_lock(hashtextextended('panier:' || p_compte::text, 0));

  select id into v_du_compte from public.panier where compte_id = p_compte for update;

  if p_panier is not null then
    select id, compte_id into v_source from public.panier where id = p_panier for update;
    v_source_ok := found and (v_source.compte_id is null or v_source.compte_id = p_compte);
  end if;

  if v_source_ok and v_source.compte_id = p_compte then
    v_cible := v_source.id;
  elsif v_source_ok then
    if v_du_compte is null then
      update public.panier set compte_id = p_compte, mis_a_jour_le = now() where id = v_source.id;
      v_cible := v_source.id;
    else
      for v_ligne in select produit_id, variante_id, nombre from public.ligne_panier where panier_id = v_source.id loop
        insert into public.ligne_panier (panier_id, produit_id, variante_id, nombre)
        values (v_du_compte, v_ligne.produit_id, v_ligne.variante_id, v_ligne.nombre)
        on conflict (panier_id, produit_id, (coalesce(variante_id, '00000000-0000-0000-0000-000000000000'::uuid)))
        do update set nombre = least(10, ligne_panier.nombre + excluded.nombre)
        where ligne_panier.variante_id is not null;
      end loop;
      delete from public.panier where id = v_source.id;
      update public.panier set mis_a_jour_le = now() where id = v_du_compte;
      v_cible := v_du_compte;
    end if;
  else
    v_cible := v_du_compte;
  end if;

  if v_cible is not null then
    -- La réunion ne dépasse pas le stock d'une taille qui n'est pas fabriquée sur commande (au moins 1 : la ligne reste visible, « Plus disponible » si le stock est nul).
    update public.ligne_panier l set nombre = greatest(1, public.stock_disponible(l.variante_id))
    from public.variante v
    where l.panier_id = v_cible and v.id = l.variante_id and not v.fabrication_sur_commande and l.nombre > public.stock_disponible(v.id);
    -- Un Kit déjà possédé n'a rien à faire dans le Panier (KS_KIT_DEJA_POSSEDE à l'ajout, retiré ici à la fusion).
    delete from public.ligne_panier l
    using public.acces_kit a
    where l.panier_id = v_cible and l.variante_id is null and a.compte_id = p_compte and a.produit_id = l.produit_id;
    get diagnostics v_retires = row_count;
    if v_retires > 0 then
      update public.panier set kit_possede_retire_le = now() where id = v_cible;
    end if;
  end if;

  return jsonb_build_object('panier_id', v_cible, 'retires', v_retires);
end;
$$;
