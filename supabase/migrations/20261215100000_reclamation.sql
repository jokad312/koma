-- Story 6.7 : reclamation et remplacement (FR-26, AD-31, AD-23). Une reclamation est une demande_client de type « reclamation » ; elle suit
-- ouverte -> acceptee -> article_rendu -> remplacement_remis (ou refusee). La Commande reste « livree ». Aucun remboursement n'est propose ; aucun email
-- de reclamation n'est envoye au lancement (decision du 2026-10-21). Aucune photo n'est demandee : un lien WhatsApp permet de les envoyer.

alter table public.demande_client
  add column ligne_id uuid references public.ligne_commande (id) on delete restrict,
  add column description text check (description is null or char_length(description) between 1 and 2000);
alter table public.demande_client drop constraint demande_client_statut_check;
alter table public.demande_client add constraint demande_client_statut_check check (statut in ('ouverte', 'acceptee', 'refusee', 'close', 'article_rendu', 'remplacement_remis'));
alter table public.demande_client add constraint demande_reclamation_coherente check ((type = 'reclamation') = (ligne_id is not null and description is not null) or type = 'annulation_pass');
-- Une seule reclamation en cours par ligne.
create unique index demande_reclamation_unique on public.demande_client (ligne_id) where type = 'reclamation' and statut in ('ouverte', 'acceptee', 'article_rendu');

-- Retire du stock (remplacement pris en stock). Interne : appelee par traiter_reclamation, jamais par un rôle client. Refuse si le stock est insuffisant.
create function public.catalogue_decrementer_stock(p_variante uuid, p_nombre integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_nombre is null or p_nombre <= 0 then
    raise exception 'KS_STOCK_INVALIDE' using errcode = 'P0001';
  end if;
  update public.variante set stock = stock - p_nombre where id = p_variante and stock >= p_nombre;
  if not found then
    raise exception 'KS_STOCK_INSUFFISANT' using errcode = 'P0001';
  end if;
end;
$$;
revoke all on function public.catalogue_decrementer_stock(uuid, integer) from public, anon, authenticated;
grant execute on function public.catalogue_decrementer_stock(uuid, integer) to service_role;

-- Lignes reclamables d'une Commande du Compte : Commande « livree » depuis moins de 48 h (calcul avec now(), AD-23), ligne Accessoire ou Cosplay en taille
-- standard (jamais Sur-mesure), non annulee, sans reclamation en cours. Un Kit n'est jamais reclamable.
create function public.lignes_reclamables(p_compte uuid, p_numero text)
returns table (ligne_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id
  from public.commande c
  join public.ligne_commande l on l.commande_id = c.id
  join public.produit p on p.id = l.produit_id
  join public.variante v on v.id = l.variante_id
  where c.numero = p_numero and c.compte_id = p_compte
    and c.statut = 'livree' and c.livree_le is not null and c.livree_le > now() - interval '48 hours'
    and p.famille in ('accessoire', 'cosplay') and v.taille <> 'sur_mesure' and not l.annulee
    and not exists (select 1 from public.demande_client d where d.ligne_id = l.id and d.type = 'reclamation' and d.statut in ('ouverte', 'acceptee', 'article_rendu'))
$$;
revoke all on function public.lignes_reclamables(uuid, text) from public, anon, authenticated;
grant execute on function public.lignes_reclamables(uuid, text) to service_role;

-- Le client signale un probleme (appelee par le serveur apres verification de la session). La description est obligatoire.
create function public.signaler_probleme(p_compte uuid, p_numero text, p_ligne uuid, p_description text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_description text := btrim(coalesce(p_description, ''));
  v_commande uuid;
  v_id uuid;
begin
  if char_length(v_description) not between 1 and 2000 then
    raise exception 'KS_DESCRIPTION_REQUISE' using errcode = 'P0001';
  end if;
  select id into v_commande from public.commande where numero = p_numero and compte_id = p_compte;
  if not found then
    raise exception 'KS_COMMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.lignes_reclamables(p_compte, p_numero) r where r.ligne_id = p_ligne) then
    raise exception 'KS_RECLAMATION_IMPOSSIBLE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', jsonb_build_object('type', 'compte', 'id', p_compte)::text, true);
  insert into public.demande_client (commande_id, type, ligne_id, description) values (v_commande, 'reclamation', p_ligne, v_description) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.signaler_probleme(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.signaler_probleme(uuid, text, uuid, text) to service_role;

-- Fait avancer une reclamation (admin) : accepter | refuser (depuis ouverte), article_rendu (depuis acceptee), remplacement_remis (depuis article_rendu).
-- Un remplacement pris en stock (p_depuis_stock) retire la piece du stock par catalogue_decrementer_stock. La Commande reste « livree ». Aucun remboursement.
create function public.traiter_reclamation(p_auteur jsonb, p_demande uuid, p_etape text, p_depuis_stock boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.demande_client;
  v_l public.ligne_commande;
  v_vers text;
begin
  perform public.exiger_admin(p_auteur);
  select * into v_d from public.demande_client where id = p_demande for update;
  if not found then
    raise exception 'KS_DEMANDE_INTROUVABLE' using errcode = 'P0001';
  end if;
  if v_d.type <> 'reclamation' then
    raise exception 'KS_TYPE_NON_PRIS_EN_CHARGE' using errcode = 'P0001';
  end if;
  v_vers := case
    when p_etape = 'accepter' and v_d.statut = 'ouverte' then 'acceptee'
    when p_etape = 'refuser' and v_d.statut = 'ouverte' then 'refusee'
    when p_etape = 'article_rendu' and v_d.statut = 'acceptee' then 'article_rendu'
    when p_etape = 'remplacement_remis' and v_d.statut = 'article_rendu' then 'remplacement_remis'
    else null end;
  if v_vers is null then
    raise exception 'KS_DEMANDE_DEJA_TRAITEE' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', p_auteur::text, true);
  if v_vers = 'remplacement_remis' and p_depuis_stock then
    select * into v_l from public.ligne_commande where id = v_d.ligne_id;
    perform public.catalogue_decrementer_stock(v_l.variante_id, v_l.nombre);
  end if;
  update public.demande_client set statut = v_vers, traitee_le = coalesce(traitee_le, now()) where id = v_d.id;
end;
$$;
revoke all on function public.traiter_reclamation(jsonb, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.traiter_reclamation(jsonb, uuid, text, boolean) to service_role;
