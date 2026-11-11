-- Story 7.6 : scan en ligne à l'entrée (FR-35, AD-12, AD-13, AD-22).
-- scanner_pass(auteur, événement, jeton | code court) : en UNE transaction, avec verrou de la ligne du Pass (for update), passe un Pass « valide » à
-- « scanne » et rend un résultat structuré. Aucune écriture directe dans la table pass n'est ouverte : le serveur n'écrit que par cette fonction.
--
-- Garantie contre le double scan : le Pass est lu avec « for update ». Deux scans simultanés du même Pass se mettent en file sur ce verrou ; le
-- second relit la ligne APRÈS la fin du premier, la trouve « scanne » et reçoit « deja_scanne » avec l'heure du premier. Un seul scan est validé.
--
-- Point d'extension de la story 7.7 (Accès bénévole) : le droit de scanner est contrôlé par scan_exiger_acces(auteur, événement), fonction interne
-- que scanner_pass appelle en premier. Aujourd'hui elle n'accepte que l'Admin (exiger_admin). La story 7.7 la REMPLACE (create or replace, même
-- signature) pour accepter aussi un bénévole dont l'accès couvre CET Événement et le jour courant ; scanner_pass n'a pas à changer.
--
-- Journal : chaque scan, accepté ou refusé, écrit une ligne « scan » dans journal_audit avec le résultat, la raison et l'Événement choisi, et
-- l'identifiant du Pass quand il existe. Jamais le jeton, le code court, le nom du titulaire ni la saisie. (Le déclencheur pass_journaliser
-- journalise en plus le passage à « scanne », lui aussi sans secret.)

create function public.scan_exiger_acces(p_auteur jsonb, p_evenement uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Aujourd'hui : Admin seulement. Remplacée par la story 7.7.
  perform public.exiger_admin(p_auteur);
end;
$$;
revoke all on function public.scan_exiger_acces(jsonb, uuid) from public, anon, authenticated, service_role;

create function public.scanner_pass(p_auteur jsonb, p_evenement uuid, p_jeton text default null, p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.pass%rowtype;
  v_commande_statut text;
  v_code text;
  v_trouve boolean := false;
  v_raison text;
  v_resultat jsonb;
  v_nom_fr text;
  v_nom_en text;
  v_titre_fr text;
  v_titre_en text;
begin
  perform public.scan_exiger_acces(p_auteur, p_evenement);
  if p_evenement is null or ((p_jeton is null) = (p_code is null)) then
    raise exception 'KS_SCAN_ARGUMENT' using errcode = 'P0001';
  end if;

  if p_jeton is not null then
    -- Jeton du Code QR : 48 caractères hexadécimaux. Tout autre format est un code inconnu (aucune recherche).
    if lower(btrim(p_jeton)) ~ '^[0-9a-f]{48}$' then
      select * into v_p from public.pass where jeton = lower(btrim(p_jeton)) for update;
      v_trouve := found;
    end if;
  else
    -- Code court : majuscules, sans espaces ni tirets, 8 caractères de l'alphabet sans ambiguïté.
    v_code := upper(regexp_replace(p_code, '[\s-]', '', 'g'));
    if v_code ~ '^[A-HJ-NP-Z2-9]{8}$' then
      select * into v_p from public.pass where code_court = v_code for update;
      v_trouve := found;
    end if;
  end if;

  if not v_trouve then
    v_raison := 'inconnu';
  else
    select c.statut into v_commande_statut from public.commande c where c.id = v_p.commande_id;
    if v_p.evenement_id <> p_evenement then
      v_raison := 'autre_evenement';
    elsif v_p.statut = 'annule' then
      v_raison := 'annule';
    elsif v_p.statut = 'rembourse' then
      v_raison := 'rembourse';
    elsif v_commande_statut is distinct from 'payee' and v_commande_statut is distinct from 'offerte' then
      -- Commande annulée, remboursée ou expirée : le Pass n'est plus honoré même si son statut est encore « valide ».
      v_raison := 'commande_non_payee';
    elsif v_p.statut = 'scanne' then
      v_raison := 'deja_scanne';
    end if;
  end if;

  if v_raison is not null then
    v_resultat := jsonb_build_object('resultat', 'refuse', 'raison', v_raison);
    if v_raison = 'deja_scanne' then
      v_resultat := v_resultat || jsonb_build_object('scanne_le', v_p.scanne_le);
    end if;
    insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
    values (p_auteur, 'scan', 'pass', case when v_trouve then v_p.id::text else 'inconnu' end,
      jsonb_build_object('resultat', 'refuse', 'raison', v_raison, 'evenement_id', p_evenement));
    return v_resultat;
  end if;

  -- Valide : le passage à « scanne » est journalisé par pass_journaliser, qui lit l'auteur posé ici (transaction locale).
  perform set_config('ks.auteur', p_auteur::text, true);
  update public.pass set statut = 'scanne', scanne_le = now(), scanne_par = (p_auteur ->> 'id')::uuid where id = v_p.id;

  select t.nom_fr, t.nom_en, e.titre_fr, e.titre_en into v_nom_fr, v_nom_en, v_titre_fr, v_titre_en
  from public.type_pass t join public.evenement e on e.id = v_p.evenement_id where t.id = v_p.type_pass_id;

  insert into public.journal_audit (auteur, action, cible_table, cible_id, apres)
  values (p_auteur, 'scan', 'pass', v_p.id::text, jsonb_build_object('resultat', 'valide', 'evenement_id', p_evenement, 'type_pass_id', v_p.type_pass_id));

  return jsonb_build_object(
    'resultat', 'valide',
    'nom', v_p.nom_titulaire,
    'evenement_fr', v_titre_fr, 'evenement_en', v_titre_en,
    'type_pass_fr', v_nom_fr, 'type_pass_en', v_nom_en
  );
end;
$$;

revoke all on function public.scanner_pass(jsonb, uuid, text, text) from public, anon, authenticated;
grant execute on function public.scanner_pass(jsonb, uuid, text, text) to service_role;
