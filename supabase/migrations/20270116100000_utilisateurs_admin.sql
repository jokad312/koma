-- Story 9.10 : page « Utilisateurs » de l'admin (lecture seule, Admin seulement).
-- lister_utilisateurs_admin(p_auteur) rend, pour chaque Compte (les plus récents d'abord, au plus 500), son nom ou pseudo s'il en a un (métadonnées de connexion),
-- son email PARTIELLEMENT MASQUÉ (le masquage est fait ici : l'adresse complète ne quitte jamais la base), sa date d'inscription, son rôle le plus fort
-- (admin, assistant, bénévole, ou aucun), son nombre de Commandes réelles (ni en attente, ni échouées, ni expirées) et son nombre de Pass valides ou scannés.
-- Aucun changement de rôle ici. Fonction réservée au serveur (service_role) : rien n'est exposé à anon ni à authenticated.

create function public.lister_utilisateurs_admin(p_auteur jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.exiger_admin(p_auteur);
  return coalesce((
    select jsonb_agg(l.ligne order by l.cree_le desc)
    from (
      select
        u.created_at as cree_le,
        jsonb_build_object(
          'id', u.id,
          'nom', nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')), ''),
          'email_masque',
            case
              when u.email is null or position('@' in u.email) < 2 then null
              when position('@' in u.email) <= 3 then left(u.email, 1) || '***' || substr(u.email, position('@' in u.email))
              else left(u.email, 2) || '***' || substr(u.email, position('@' in u.email))
            end,
          'inscrit_le', u.created_at,
          'role', (
            select r.role from public.role_utilisateur r
            where r.compte = u.id and (r.valide_au is null or r.valide_au > now())
            order by case r.role when 'admin' then 1 when 'assistant' then 2 else 3 end
            limit 1
          ),
          'commandes', (
            select count(*)::int from public.commande c
            where c.compte_id = u.id and c.statut not in ('en_attente', 'echouee', 'expiree')
          ),
          'pass', (
            select count(*)::int from public.pass p join public.commande c on c.id = p.commande_id
            where c.compte_id = u.id and p.statut in ('valide', 'scanne')
          )
        ) as ligne
      from auth.users u
      order by u.created_at desc
      limit 500
    ) l
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.lister_utilisateurs_admin(jsonb) from public, anon, authenticated;
grant execute on function public.lister_utilisateurs_admin(jsonb) to service_role;
