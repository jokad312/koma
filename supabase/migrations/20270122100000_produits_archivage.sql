-- Story 9.16 e) : archivage des produits (décision Q22 de Jonathan : la corbeille archive, jamais de suppression) et compteurs des cartes de la
-- liste admin (décision Q20 : TÉLÉCHARGEMENTS pour un Kit, VENDUS pour un article physique).
-- 1. Colonne archive_le : un produit archivé est dépublié, absent de la boutique (les lectures publiques exigent déjà publie_le) et de la liste
--    par défaut de l'admin ; il est retrouvé par le filtre « Archivés ».
-- 2. Garde : un produit archivé n'est jamais publié (déclencheur BEFORE, KS_PRODUIT_ARCHIVE), quel que soit le chemin d'écriture.
-- 3. publier_produit recréée : le refus KS_PRODUIT_ARCHIVE passe avant la liste des manques (sinon un archivé incomplet répondrait « incomplet »).
-- 4. archiver_produit (dépublie + archive) et restaurer_produit (retour en brouillon) : SECURITY DEFINER, search_path vide, p_auteur en premier,
--    exiger_admin (droit produits.modifier = Admin), ks.auteur posé avant l'écriture (journal_audit par le déclencheur produit_journaliser),
--    service_role seulement. Ni commande, ni accès aux Kits, ni photo, ni fichier ne sont touchés ; rien n'est supprimé.
-- 5. produits_admin_compteurs : lecture seule, Admin, service_role. acces = Comptes qui ont l'accès au Kit (acces_kit, une ligne par Compte) ;
--    vendus = pièces (nombre) des lignes non annulées des Commandes payées, hors Commandes annulées ou remboursées (même règle que SM-1).
-- Les migrations précédentes ne sont pas modifiées.

-- 1.
alter table public.produit add column archive_le timestamptz;

-- 2.
create function public.refuser_publication_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archive_le is not null and new.publie_le is not null then
    raise exception 'KS_PRODUIT_ARCHIVE' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.refuser_publication_archive() from public, anon, authenticated;

create trigger produit_archive_non_publie
  before insert or update on public.produit
  for each row execute function public.refuser_publication_archive();

-- 3. Identique à la story 2.2, plus le refus d'un produit archivé (avant la complétude).
create or replace function public.publier_produit(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_publie timestamptz;
  v_archive timestamptz;
begin
  perform public.exiger_admin(p_auteur);
  select p.publie_le, p.archive_le into v_publie, v_archive from public.produit p where p.id = p_id for update;
  if not found then
    raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_archive is not null then
    raise exception 'KS_PRODUIT_ARCHIVE' using errcode = 'P0001';
  end if;
  if v_publie is not null then
    return;
  end if;
  if cardinality(public.manques_publication(p_id)) > 0 then
    raise exception 'KS_PUBLICATION_INCOMPLETE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.produit set publie_le = now() where id = p_id;
end;
$$;

revoke all on function public.publier_produit(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.publier_produit(jsonb, uuid) to service_role;

-- 4. Archive un produit (admin) : publie_le remis à nul et archive_le posé, en une seule écriture (une ligne au journal). Déjà archivé : sans effet.
create function public.archiver_produit(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archive timestamptz;
begin
  perform public.exiger_admin(p_auteur);
  select p.archive_le into v_archive from public.produit p where p.id = p_id for update;
  if not found then
    raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_archive is not null then
    return;
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.produit set publie_le = null, archive_le = now() where id = p_id;
end;
$$;

revoke all on function public.archiver_produit(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.archiver_produit(jsonb, uuid) to service_role;

-- Restaure un produit archivé (admin) : il revient en brouillon (publie_le reste nul). Pas archivé : sans effet.
create function public.restaurer_produit(p_auteur jsonb, p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archive timestamptz;
begin
  perform public.exiger_admin(p_auteur);
  select p.archive_le into v_archive from public.produit p where p.id = p_id for update;
  if not found then
    raise exception 'KS_PRODUIT_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_archive is null then
    return;
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.produit set archive_le = null where id = p_id;
end;
$$;

revoke all on function public.restaurer_produit(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.restaurer_produit(jsonb, uuid) to service_role;

-- 5. Compteurs des cartes : une ligne par produit (archivés compris), zéro quand il n'y a rien.
create function public.produits_admin_compteurs(p_auteur jsonb)
returns table (produit_id uuid, acces integer, vendus integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.exiger_admin(p_auteur);
  return query
    select
      p.id,
      (select count(*)::integer from public.acces_kit a where a.produit_id = p.id),
      (select coalesce(sum(l.nombre), 0)::integer
         from public.ligne_commande l
         join public.commande c on c.id = l.commande_id
        where l.produit_id = p.id
          and not l.annulee
          and c.paye_le is not null
          and c.statut not in ('annulee', 'remboursee'))
    from public.produit p;
end;
$$;

revoke all on function public.produits_admin_compteurs(jsonb) from public, anon, authenticated;
grant execute on function public.produits_admin_compteurs(jsonb) to service_role;
