-- Story 9.12 : crochet Supabase « Custom Access Token » qui ajoute la revendication `koma_role` (admin | assistant) au jeton de session.
-- Le jeton ne sert qu'à l'aiguillage du proxy (/fr, /en, /compte → /admin) : sans requête en base à chaque page. Les vraies barrières restent
-- côté serveur (exigerAdminPage, exigerConnectePage, a_le_role à chaque action). Le rôle est lu par a_le_role (source de vérité, rôles globaux
-- et valides maintenant seulement) : admin passe avant assistant ; le rôle bénévole n'est jamais mis dans le jeton.
-- Activation (hors migration) : Dashboard Supabase › Authentication › Hooks › Customize Access Token (JWT) Claims › public.crochet_role_jeton.
-- Crochet non activé : la revendication est absente et le proxy traite la personne comme un client (aucune erreur).

create function public.crochet_role_jeton(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_compte uuid;
  v_role text;
  v_claims jsonb;
begin
  v_claims := coalesce(event -> 'claims', '{}'::jsonb);
  -- Une revendication venue d'ailleurs n'est jamais gardée : seule la base décide.
  v_claims := v_claims - 'koma_role';
  begin
    v_compte := (event ->> 'user_id')::uuid;
    if v_compte is not null then
      if public.a_le_role(v_compte, 'admin') then
        v_role := 'admin';
      elsif public.a_le_role(v_compte, 'assistant') then
        v_role := 'assistant';
      end if;
    end if;
  exception when others then
    -- Identifiant illisible ou lecture impossible : jeton sans rôle (la connexion n'échoue jamais à cause de l'aiguillage).
    v_role := null;
  end;
  if v_role is not null then
    v_claims := jsonb_set(v_claims, '{koma_role}', to_jsonb(v_role));
  end if;
  return jsonb_set(event, '{claims}', v_claims);
end;
$$;

-- Seul le service d'authentification de Supabase appelle le crochet.
revoke all on function public.crochet_role_jeton(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.crochet_role_jeton(jsonb) to supabase_auth_admin;
