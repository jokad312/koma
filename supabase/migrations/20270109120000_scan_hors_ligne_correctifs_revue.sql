-- Story 7.8, correctifs de revue.
-- 1. synchroniser_scans accepte aussi un Verrou libéré de force, en mode « conflits seulement » (choix le plus sûr : aucun scan réel d'un appareil retrouvé n'est
--    perdu, et rien n'est jamais écrasé). Un scan n'est appliqué que si le Pass est encore valide, non scanné, payé, et daté d'avant la libération ; sinon conflit
--    (motifs existants, plus « apres_liberation ») avec anomalie. Un Pass scanné pendant CE Verrou par le même Compte n'est pas un conflit mais un « doublon »
--    (scan en ligne de l'appareil, ou serveur lent puis scan jugé en local) : aucune anomalie trompeuse.
-- 2. Accès bénévole retiré ou raccourci (story 7.7) : son Verrou actif sur cet Événement passe à « force » (anomalie si la liste avait été téléchargée) ou voit
--    expire_le raccourci. Il ne bloque donc plus le Scan des autres. Après un retrait, l'appareil peut encore synchroniser (mode « conflits seulement »).
-- 3. scan_horodatage est « stable » (le fuseau de la session joue dans la conversion).

alter function public.scan_horodatage(text) stable;

alter table public.scan_hors_ligne drop constraint if exists scan_hors_ligne_resultat_check;
alter table public.scan_hors_ligne add constraint scan_hors_ligne_resultat_check check (resultat in ('applique', 'conflit', 'inconnu', 'doublon'));
alter table public.scan_hors_ligne drop constraint if exists scan_hors_ligne_motif_check;
alter table public.scan_hors_ligne add constraint scan_hors_ligne_motif_check
  check (motif in ('deja_scanne', 'annule', 'rembourse', 'commande_non_payee', 'statut', 'apres_liberation'));

create or replace function public.synchroniser_scans(p_auteur jsonb, p_evenement uuid, p_appareil text, p_scans jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_v public.verrou_hors_ligne%rowtype;
  v_scan record;
  v_id uuid;
  v_t timestamptz;
  v_t_retenu timestamptz;
  v_p public.pass%rowtype;
  v_trouve boolean;
  v_commande_statut text;
  v_motif text;
  v_doublon boolean;
  v_resultat text;
  v_connu public.scan_hors_ligne%rowtype;
  v_sortie jsonb := '[]'::jsonb;
  v_appliques integer := 0;
  v_conflits integer := 0;
  v_inconnus integer := 0;
  v_deja integer := 0;
  v_invalides integer := 0;
begin
  v_compte := public.scan_compte_depuis_auteur(p_auteur);
  if p_evenement is null or p_appareil is null or p_appareil !~ '^[0-9a-f]{32}$' then
    raise exception 'KS_APPAREIL_INVALIDE' using errcode = 'P0001';
  end if;
  if p_scans is null or jsonb_typeof(p_scans) <> 'array' then
    raise exception 'KS_LOT_INVALIDE' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_scans) > 200 then
    raise exception 'KS_LOT_TROP_GRAND' using errcode = 'P0001';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('verrou_hors_ligne:' || p_evenement::text, 0));

  -- Un Verrou libéré de force est lui aussi accepté, en mode « conflits seulement » : un scan n'est appliqué que si le Pass est encore valide, non scanné, et si
  -- le scan date d'avant la libération ; sinon c'est un conflit, sans jamais écraser un état existant. Un Verrou rendu normalement ('libere') ne l'est pas.
  select * into v_v from public.verrou_hors_ligne v
    where v.evenement_id = p_evenement and v.compte_id = v_compte and v.appareil = p_appareil and v.statut in ('actif', 'expire', 'force')
    order by v.pris_le desc limit 1 for update;
  if not found then
    raise exception 'KS_VERROU_ABSENT' using errcode = 'P0001';
  end if;
  perform set_config('ks.auteur', (p_auteur - 'appareil')::text, true);

  for v_scan in
    select e.value as s, e.ordinality as rang
    from jsonb_array_elements(p_scans) with ordinality e
    order by public.scan_horodatage(e.value ->> 'scanne_le') nulls last, e.ordinality
  loop
    v_resultat := null;
    v_motif := null;
    v_doublon := false;
    v_trouve := false;
    -- Forme du scan : tout ce qui n'est pas exactement attendu est « invalide » (rien n'est écrit).
    if jsonb_typeof(v_scan.s) <> 'object'
       or (v_scan.s ->> 'id') is null or (v_scan.s ->> 'id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or (v_scan.s ->> 'nature') is null or (v_scan.s ->> 'nature') not in ('jeton', 'code')
       or (v_scan.s ->> 'empreinte') is null or (v_scan.s ->> 'empreinte') !~ '^[0-9a-f]{64}$'
       or public.scan_horodatage(v_scan.s ->> 'scanne_le') is null then
      v_invalides := v_invalides + 1;
      v_sortie := v_sortie || jsonb_build_object('id', v_scan.s ->> 'id', 'resultat', 'invalide');
      continue;
    end if;
    v_id := (v_scan.s ->> 'id')::uuid;
    v_t := public.scan_horodatage(v_scan.s ->> 'scanne_le');

    -- Rejeu : le résultat d'origine est rendu tel quel.
    select * into v_connu from public.scan_hors_ligne where id = v_id;
    if found then
      if v_connu.verrou_id = v_v.id then
        v_deja := v_deja + 1;
        v_sortie := v_sortie || jsonb_build_object('id', v_id, 'resultat', v_connu.resultat, 'motif', v_connu.motif, 'rejeu', true);
      else
        v_invalides := v_invalides + 1;
        v_sortie := v_sortie || jsonb_build_object('id', v_id, 'resultat', 'invalide');
      end if;
      continue;
    end if;

    if (v_scan.s ->> 'nature') = 'jeton' then
      select * into v_p from public.pass p
        where p.evenement_id = p_evenement and encode(extensions.digest(p.jeton, 'sha256'), 'hex') = (v_scan.s ->> 'empreinte')
        for update;
    else
      select * into v_p from public.pass p
        where p.evenement_id = p_evenement
          and encode(extensions.hmac(convert_to(p.code_court, 'UTF8'), decode(v_v.cle_code_court, 'hex'), 'sha256'), 'hex') = (v_scan.s ->> 'empreinte')
        for update;
    end if;
    v_trouve := found;

    if not v_trouve then
      v_resultat := 'inconnu';
      v_inconnus := v_inconnus + 1;
    else
      select c.statut into v_commande_statut from public.commande c where c.id = v_p.commande_id;
      if v_p.statut = 'annule' then
        v_motif := 'annule';
      elsif v_p.statut = 'rembourse' then
        v_motif := 'rembourse';
      elsif v_commande_statut is distinct from 'payee' and v_commande_statut is distinct from 'offerte' then
        v_motif := 'commande_non_payee';
      elsif v_p.statut = 'scanne' and v_p.scanne_par = v_compte and v_p.scanne_le >= v_v.pris_le then
        -- Scanné pendant CE Verrou par ce même Compte : seul l'appareil qui le tient pouvait scanner, c'est donc lui (scan en ligne, ou serveur lent puis
        -- scan jugé en local). Ce n'est pas un vrai conflit : aucune anomalie.
        v_doublon := true;
      elsif v_p.statut = 'scanne' then
        v_motif := 'deja_scanne';
      elsif v_p.statut <> 'valide' then
        v_motif := 'statut';
      elsif v_v.statut = 'force' and v_t > v_v.libere_le then
        v_motif := 'apres_liberation';
      end if;

      if v_doublon then
        v_resultat := 'doublon';
        v_motif := 'deja_scanne';
        v_deja := v_deja + 1;
      elsif v_motif is not null then
        v_resultat := 'conflit';
        v_conflits := v_conflits + 1;
        insert into public.anomalie (type, gravite, cible_type, cible_id, details)
        values ('scan_conflit', 'attention', 'pass', v_p.id,
          jsonb_build_object('evenement_id', p_evenement, 'verrou_id', v_v.id, 'motif', v_motif, 'scan_appareil_le', v_t,
            'premier_scan_le', case when v_motif = 'deja_scanne' then v_p.scanne_le end))
        on conflict do nothing;
      else
        v_resultat := 'applique';
        v_appliques := v_appliques + 1;
        v_t_retenu := least(greatest(v_t, v_v.pris_le), now());
        update public.pass set statut = 'scanne', scanne_le = v_t_retenu, scanne_par = v_compte where id = v_p.id;
      end if;
    end if;

    insert into public.scan_hors_ligne (id, verrou_id, pass_id, resultat, motif, scanne_le_appareil)
    values (v_id, v_v.id, case when v_trouve then v_p.id end, v_resultat, v_motif, v_t);
    v_sortie := v_sortie || jsonb_build_object('id', v_id, 'resultat', v_resultat, 'motif', v_motif);
  end loop;

  insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
  values (p_auteur - 'appareil', 'scans_synchronises', 'verrou_hors_ligne', v_v.id::text,
    jsonb_build_object('evenement_id', p_evenement, 'appliques', v_appliques, 'conflits', v_conflits, 'inconnus', v_inconnus, 'deja_traites', v_deja, 'invalides', v_invalides));

  return jsonb_build_object('resultats', v_sortie, 'appliques', v_appliques, 'conflits', v_conflits, 'inconnus', v_inconnus, 'deja_traites', v_deja, 'invalides', v_invalides);
end;
$$;
revoke all on function public.synchroniser_scans(jsonb, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.synchroniser_scans(jsonb, uuid, text, jsonb) to service_role;


-- Passe un Verrou actif à « force » (accès retiré ou raccourci). Interne. Anomalie « scans_non_synchronises » seulement si la liste avait été téléchargée
-- (sinon l'appareil n'a pu rien scanner hors ligne).
create function public.scan_forcer_verrou_interne(p_verrou uuid, p_auteur jsonb, p_motif text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_v public.verrou_hors_ligne%rowtype;
  v_synchronises integer;
begin
  update public.verrou_hors_ligne set statut = 'force', libere_le = now() where id = p_verrou and statut = 'actif' returning * into v_v;
  if not found then
    return;
  end if;
  if v_v.liste_telechargee_le is not null then
    select count(*)::integer into v_synchronises from public.scan_hors_ligne s where s.verrou_id = v_v.id;
    insert into public.anomalie (type, gravite, cible_type, cible_id, details)
    values ('scans_non_synchronises', 'attention', 'verrou', v_v.id,
      jsonb_build_object('evenement_id', v_v.evenement_id, 'verrou_id', v_v.id, 'pris_le', v_v.pris_le, 'liste_telechargee', true, 'scans_synchronises', v_synchronises, 'motif', p_motif))
    on conflict do nothing;
  end if;
  insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
  values (p_auteur, 'verrou_force', 'verrou_hors_ligne', v_v.id::text, jsonb_build_object('evenement_id', v_v.evenement_id, 'motif', p_motif));
end;
$$;
revoke all on function public.scan_forcer_verrou_interne(uuid, jsonb, text) from public, anon, authenticated, service_role;

create or replace function public.retirer_acces_benevole(p_auteur jsonb, p_evenement uuid, p_acces uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_du timestamptz;
  v_au timestamptz;
  v_verrou uuid;
begin
  perform public.exiger_admin(p_auteur);
  delete from public.acces_benevole a
    where a.id = p_acces and a.evenement_id = p_evenement
    returning a.compte_id, a.valable_du, a.valable_jusqu_au into v_compte, v_du, v_au;
  if not found then
    return false;
  end if;
  insert into public.journal_audit (auteur, action, cible_table, cible_id, avant)
  values (p_auteur, 'acces_benevole_retire', 'acces_benevole', p_acces::text,
    jsonb_build_object('compte_id', v_compte, 'evenement_id', p_evenement, 'valable_du', v_du, 'valable_jusqu_au', v_au));
  -- Le Verrou hors ligne de ce Compte sur cet Événement ne doit plus bloquer le Scan des autres.
  for v_verrou in select v.id from public.verrou_hors_ligne v where v.evenement_id = p_evenement and v.compte_id = v_compte and v.statut = 'actif' loop
    perform public.scan_forcer_verrou_interne(v_verrou, p_auteur, 'acces_retire');
  end loop;
  return true;
end;
$$;
revoke all on function public.retirer_acces_benevole(jsonb, uuid, uuid) from public, anon, authenticated;
grant execute on function public.retirer_acces_benevole(jsonb, uuid, uuid) to service_role;

create or replace function public.evenement_recalculer_acces_benevole()
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
  v record;
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
        -- Story 7.8 : le Verrou hors ligne suit la fenêtre. Fenêtre déjà finie (ou finie avant la prise) : Verrou forcé ; sinon expire_le raccourci.
        for v in select x.id, x.pris_le, x.expire_le from public.verrou_hors_ligne x where x.evenement_id = new.id and x.compte_id = r.compte_id and x.statut = 'actif' loop
          if n_au <= now() or n_au <= v.pris_le then
            perform public.scan_forcer_verrou_interne(v.id, v_auteur, 'fenetre_raccourcie');
          elsif n_au < v.expire_le then
            update public.verrou_hors_ligne set expire_le = n_au where id = v.id;
          end if;
        end loop;
      end if;
    end;
  end loop;
  return new;
end;
$$;
