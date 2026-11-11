-- Story 7.11 : réglage delai_stand_heures (heures de paiement d'un Stand accepté, entier de 1 à 168) dans enregistrer_reglage.
-- Même fonction qu'en 20270103100000, avec la clé ajoutée. Les droits de la fonction ne changent pas (create or replace les conserve).

create or replace function public.enregistrer_reglage(p_auteur jsonb, p_cle text, p_valeur text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_valeur text;
  v_texte text;
  v_entier bigint;
begin
  perform public.exiger_admin(p_auteur);
  if p_cle is null or p_cle not in (
    'nom_site', 'numero_whatsapp',
    'forfait_livraison_goma_cents', 'forfait_livraison_bukavu_cents',
    'retrait_goma_fr', 'retrait_goma_en',
    'plafond_fabrication', 'delai_paiement', 'frais_annulation_pass', 'delai_stand_heures'
  ) then
    raise exception 'KS_REGLAGE_INCONNU' using errcode = 'P0001';
  end if;

  if p_cle = 'nom_site' then
    v_valeur := btrim(coalesce(p_valeur, ''));
    if char_length(v_valeur) < 1 or char_length(v_valeur) > 60 then
      raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
    end if;
  elsif p_cle = 'numero_whatsapp' then
    v_valeur := nullif(regexp_replace(coalesce(p_valeur, ''), '\s', '', 'g'), '');
    if v_valeur is not null and v_valeur !~ '^\+[0-9]{8,15}$' then
      raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
    end if;
  elsif p_cle in ('forfait_livraison_goma_cents', 'forfait_livraison_bukavu_cents') then
    v_texte := btrim(coalesce(p_valeur, ''));
    if v_texte = '' then
      v_valeur := null;
    else
      if v_texte !~ '^[0-9]{1,6}$' then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_entier := v_texte::bigint;
      if v_entier > 100000 then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_valeur := v_entier::text;
    end if;
  elsif p_cle in ('retrait_goma_fr', 'retrait_goma_en') then
    v_valeur := nullif(btrim(coalesce(p_valeur, '')), '');
    if v_valeur is not null and char_length(v_valeur) > 500 then
      raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
    end if;
  elsif p_cle = 'delai_paiement' then
    -- Minutes laissées au client pour payer une Commande en attente (1 à 1440, soit 24 heures). Vide : effacé.
    v_texte := btrim(coalesce(p_valeur, ''));
    if v_texte = '' then
      v_valeur := null;
    else
      if v_texte !~ '^[0-9]{1,4}$' then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_entier := v_texte::bigint;
      if v_entier < 1 or v_entier > 1440 then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_valeur := v_entier::text;
    end if;
  elsif p_cle = 'frais_annulation_pass' then
    -- Pourcentage retenu lors de l'annulation d'un Pass (0 à 100, entier). Vide : effacé, aucune annulation de Pass acceptée (règle 15).
    v_texte := btrim(coalesce(p_valeur, ''));
    if v_texte = '' then
      v_valeur := null;
    else
      if v_texte !~ '^[0-9]{1,3}$' then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_entier := v_texte::bigint;
      if v_entier > 100 then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_valeur := v_entier::text;
    end if;
  elsif p_cle = 'delai_stand_heures' then
    -- Heures laissées à un exposant pour payer son Stand accepté (1 à 168, entier). Vide : effacé, aucune candidature acceptée (règle 15).
    v_texte := btrim(coalesce(p_valeur, ''));
    if v_texte = '' then
      v_valeur := null;
    else
      if v_texte !~ '^[0-9]{1,3}$' then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_entier := v_texte::bigint;
      if v_entier < 1 or v_entier > 168 then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_valeur := v_entier::text;
    end if;
  else
    -- plafond_fabrication
    v_texte := btrim(coalesce(p_valeur, ''));
    if v_texte = '' then
      v_valeur := null;
    else
      if v_texte !~ '^[0-9]{1,5}$' then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_entier := v_texte::bigint;
      if v_entier < 1 or v_entier > 10000 then
        raise exception 'KS_REGLAGE_INVALIDE' using errcode = 'P0001';
      end if;
      v_valeur := v_entier::text;
    end if;
  end if;

  perform set_config('ks.auteur', p_auteur::text, true);
  insert into public.reglage (cle, valeur, mis_a_jour_le)
  values (p_cle, v_valeur, now())
  on conflict (cle) do update set valeur = excluded.valeur, mis_a_jour_le = excluded.mis_a_jour_le;
end;
$$;
