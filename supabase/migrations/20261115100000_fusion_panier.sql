-- Story 4.2 : fusion du Panier à la connexion (AD-15). Un Compte n'a jamais plus d'un Panier actif ; les lignes du Panier du visiteur sont
-- réunies à celui du Compte (un Kit n'apparaît qu'une fois, les quantités d'un produit physique s'additionnent dans la limite de 10) ;
-- un Kit déjà possédé est retiré, et le Panier garde la trace de ce retrait pour l'annoncer au client.

alter table public.panier add column kit_possede_retire_le timestamptz;

-- Toute modification d'une ligne efface l'annonce « Kit déjà possédé » : elle ne vaut que jusqu'à la prochaine action du client.
-- (La fonction de fusion pose l'annonce après ses propres modifications.)
create function public.panier_effacer_avis()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.panier set kit_possede_retire_le = null
  where id = coalesce(new.panier_id, old.panier_id) and kit_possede_retire_le is not null;
  return null;
end;
$$;
revoke all on function public.panier_effacer_avis() from public, anon, authenticated;

create trigger ligne_panier_effacer_avis
  after insert or update or delete on public.ligne_panier
  for each row execute function public.panier_effacer_avis();

-- Rattache le Panier du visiteur (p_panier, peut être nul) au Compte, ou le réunit au Panier existant du Compte. Renvoie
-- {panier_id, retires} : le Panier à utiliser désormais (nul si le Compte n'en a aucun) et le nombre de Kits déjà possédés retirés.
-- Un Panier déjà rattaché à un autre Compte est ignoré. Rejouable sans effet (second appel, deuxième onglet).
create function public.fusionner_panier(p_auteur jsonb, p_compte uuid, p_panier uuid)
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

-- Vrai si la dernière fusion a retiré un Kit déjà possédé et que le client n'a pas encore modifié son Panier.
create function public.avis_kit_possede(p_panier uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select kit_possede_retire_le is not null from public.panier where id = p_panier), false)
$$;

revoke all on function public.fusionner_panier(jsonb, uuid, uuid) from public, anon, authenticated;
revoke all on function public.avis_kit_possede(uuid) from public, anon, authenticated;
grant execute on function public.fusionner_panier(jsonb, uuid, uuid) to service_role;
grant execute on function public.avis_kit_possede(uuid) to service_role;
