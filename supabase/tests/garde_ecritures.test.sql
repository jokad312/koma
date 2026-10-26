-- AD-3 : aucune fonction de `public` exécutable par anon ou authenticated, hors liste blanche.
-- Liste blanche : a_le_role (lecture pure du rôle, appelée par les politiques RLS et le client) ;
-- stock_disponible et places_fabrication_utilisees (lectures pures de la disponibilité, story 2.3) ;
-- lister_catalogue et capacite_fabrication_atteinte (lectures publiques du catalogue, story 2.4) ;
-- disponibilite_variantes (disponibilité par taille d'une fiche produit, story 2.5).
begin;
select plan(4);

-- Fonctions de `public` exécutables par anon ou authenticated, hors fonctions d'extension et liste blanche.
create temp view ks_fonctions_ouvertes as
select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as fonction
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname not in ('a_le_role', 'stock_disponible', 'places_fabrication_utilisees', 'lister_catalogue', 'capacite_fabrication_atteinte', 'disponibilite_variantes')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));

select is(
  (select coalesce(array_agg(fonction order by fonction), '{}') from ks_fonctions_ouvertes),
  '{}'::text[],
  'aucune fonction de public n''est exécutable par anon ou authenticated hors liste blanche'
);

-- La liste blanche est bien ouverte : le garde ne passe pas parce qu'il ne voit rien.
select ok(
  has_function_privilege('anon', 'public.a_le_role(uuid, text, uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.a_le_role(uuid, text, uuid)', 'execute'),
  'a_le_role (liste blanche) est exécutable par anon et authenticated'
);

select ok(
  has_function_privilege('anon', 'public.stock_disponible(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.places_fabrication_utilisees()', 'execute')
  and has_function_privilege('anon', 'public.capacite_fabrication_atteinte()', 'execute')
  and has_function_privilege('anon', 'public.disponibilite_variantes(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.disponibilite_variantes(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.lister_catalogue(text, text, uuid, integer, integer, text, text, timestamptz, integer, uuid, integer)', 'execute'),
  'les fonctions de disponibilité et de listage (liste blanche) sont exécutables par anon et authenticated'
);

-- Preuve que le garde échoue : une fonction ouverte ajoutée ici est détectée.
create function public.ks_test_fuite() returns integer language sql as $$ select 1 $$;
grant execute on function public.ks_test_fuite() to anon;
select is(
  (select coalesce(array_agg(fonction order by fonction), '{}') from ks_fonctions_ouvertes),
  '{"ks_test_fuite()"}'::text[],
  'une fonction exécutable par anon est détectée par le garde'
);

select * from finish();
rollback;
