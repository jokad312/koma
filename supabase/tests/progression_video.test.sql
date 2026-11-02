-- Story 3.7 : progression_video (RLS, droits), enregistrement de la position (accès vérifié, bornes, position la plus avancée, vidéo terminée à 90 %),
-- lecture de la vidéo pour le serveur (accès vérifié, identifiant privé), résumé de vidéo dans le détail de bibliothèque, progressions de la liste.
-- Données créées dans la transaction, puis annulées.
begin;
select plan(28);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'test-pv1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'test-pv2@example.invalid', '{}');
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000d1', 25);

create function pg_temp.c1() returns jsonb language sql as $$ select '{"type":"compte","id":"00000000-0000-0000-0000-0000000000d1","role":null}'::jsonb $$;

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into public.produit (famille, slug, titre_fr, titre_en, prix_cents, niveau, publie_le) values
  ('kit', 'pv-kit', 'Kit vidéo', 'Video kit', 0, 'debutant', now() - interval '1 minute'),
  ('kit', 'pv-sans-video', 'Kit sans vidéo', 'Kit without video', 0, 'debutant', now() - interval '1 minute');
create temp table pv as
  select (select id from public.produit where slug = 'pv-kit') as kit, (select id from public.produit where slug = 'pv-sans-video') as sans;
grant select on pv to public;
insert into public.video_kit (produit_id, duree_secondes) values ((select kit from pv), 600);
insert into public.video_kit_prive (produit_id, bunny_video_id_prive) values ((select kit from pv), '11111111-2222-4333-8444-555555555555');
insert into public.chapitre_kit (produit_id, titre_fr, titre_en, debut_secondes, ordre) values
  ((select kit from pv), 'Découpe', 'Cutting', 0, 1),
  ((select kit from pv), 'Assemblage', 'Assembly', 120, 2),
  ((select kit from pv), 'Finitions', 'Finishing', 300, 3);
-- d1 obtient les deux Kits (Commandes offertes) ; d2 n'a rien.
select public.offrir_commande(pg_temp.c1(), (select kit from pv), '[{"objet":"licence_kit","version":"test-v1"}]'::jsonb, 'cle-test-pv-0001');
select public.offrir_commande(pg_temp.c1(), (select sans from pv), '[{"objet":"licence_kit","version":"test-v1"}]'::jsonb, 'cle-test-pv-0002');

-- Table et fonctions.
select ok((select relrowsecurity from pg_class where oid = 'public.progression_video'::regclass), 'progression_video : RLS active');
select is(
  (select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and table_name = 'progression_video'
     and lower(grantee) in ('anon', 'authenticated', 'public') and privilege_type <> 'SELECT'),
  0,
  'progression_video : aucun droit d''écriture pour les rôles publics'
);
select is((select count(*)::int from information_schema.role_table_grants where table_schema = 'public' and table_name = 'progression_video' and grantee = 'anon'), 0, 'progression_video : anon ne lit rien');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'progression_video' and cmd <> 'SELECT'), 0, 'progression_video : aucune politique d''écriture');
select is(
  (select array_agg(f order by f) from unnest(array[
    'public.bibliotheque_enregistrer_progression(uuid, uuid, integer)', 'public.bibliotheque_video_a_lire(uuid, text)', 'public.bibliotheque_progressions(uuid)'
  ]) f where has_function_privilege('anon', f, 'execute') or has_function_privilege('authenticated', f, 'execute') or not has_function_privilege('service_role', f, 'execute')),
  null,
  'les trois fonctions de la vidéo : service seulement'
);
select ok(
  (select count(*) = 3 and bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
   where pronamespace = 'public'::regnamespace and proname in ('bibliotheque_enregistrer_progression', 'bibliotheque_video_a_lire', 'bibliotheque_progressions')),
  'security definer, search_path vide'
);

-- Enregistrement : refus sans accès ou sans vidéo, rien d'écrit.
select is(public.bibliotheque_enregistrer_progression('00000000-0000-0000-0000-0000000000d2', (select kit from pv), 50), false, 'd2 sans accès : refusé');
select is(public.bibliotheque_enregistrer_progression('00000000-0000-0000-0000-0000000000d1', (select sans from pv), 50), false, 'Kit sans vidéo : refusé');
select is(public.bibliotheque_enregistrer_progression('00000000-0000-0000-0000-0000000000d1', (select kit from pv), null), false, 'position absente : refusée');
select is((select count(*)::int from public.progression_video), 0, 'les refus n''écrivent rien');

-- Enregistrement : position, bornes, position la plus avancée, vidéo terminée à 90 %.
select is(public.bibliotheque_enregistrer_progression('00000000-0000-0000-0000-0000000000d1', (select kit from pv), 130), true, 'd1 enregistre sa position');
select is((select position_secondes from public.progression_video), 130, 'la position est enregistrée');
select is((select terminee_le is null from public.progression_video), true, 'pas terminée à 130 s sur 600');
select public.bibliotheque_enregistrer_progression('00000000-0000-0000-0000-0000000000d1', (select kit from pv), 400);
select public.bibliotheque_enregistrer_progression('00000000-0000-0000-0000-0000000000d1', (select kit from pv), 50);
select is((select position_secondes from public.progression_video), 50, 'la position reprend là où l''on s''est arrêté');
select is((select max_position_secondes from public.progression_video), 400, 'la position la plus avancée est conservée');
select public.bibliotheque_enregistrer_progression('00000000-0000-0000-0000-0000000000d1', (select kit from pv), -20);
select is((select position_secondes from public.progression_video), 0, 'une position négative vaut 0');
select public.bibliotheque_enregistrer_progression('00000000-0000-0000-0000-0000000000d1', (select kit from pv), 99999);
select is((select position_secondes from public.progression_video), 600, 'une position au-delà de la durée vaut la durée');
select is((select terminee_le is not null from public.progression_video), true, 'terminée à 90 % de la durée');
select is((select count(*)::int from public.progression_video), 1, 'une seule ligne par Compte et par Kit');

-- Lecture pour le serveur.
select is((public.bibliotheque_video_a_lire('00000000-0000-0000-0000-0000000000d1', 'pv-kit')->>'video_prive'), '11111111-2222-4333-8444-555555555555', 'd1 : identifiant de la vidéo pour le jeton');
select is(public.bibliotheque_video_a_lire('00000000-0000-0000-0000-0000000000d2', 'pv-kit'), null, 'd2 sans accès : rien');
select is(public.bibliotheque_video_a_lire('00000000-0000-0000-0000-0000000000d1', 'pv-sans-video'), null, 'Kit sans vidéo : rien');

-- Détail de bibliothèque : résumé sans aucun identifiant privé.
select is(jsonb_array_length(public.bibliotheque_kit('00000000-0000-0000-0000-0000000000d1', 'pv-kit') -> 'video' -> 'chapitres'), 3, 'le détail porte les trois chapitres');
select ok(
  public.bibliotheque_kit('00000000-0000-0000-0000-0000000000d1', 'pv-kit')::text not like '%11111111-2222-4333-8444-555555555555%'
  and public.bibliotheque_kit('00000000-0000-0000-0000-0000000000d1', 'pv-kit')::text not like '%prive%',
  'le détail ne contient aucun identifiant de vidéo privé'
);
select is(public.bibliotheque_kit('00000000-0000-0000-0000-0000000000d1', 'pv-sans-video') -> 'video', 'null'::jsonb, 'Kit sans vidéo : video vaut null');

-- Progressions de la liste : instants de début triés.
select is((select debuts from public.bibliotheque_progressions('00000000-0000-0000-0000-0000000000d1')), array[0, 120, 300], 'progressions : débuts des chapitres triés');

-- RLS : d1 lit sa progression, d2 ne lit rien.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select is((select count(*)::int from public.progression_video), 1, 'd1 lit sa progression');
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d2","role":"authenticated"}';
select is((select count(*)::int from public.progression_video), 0, 'd2 ne lit pas la progression de d1');
reset role;

select * from finish();
rollback;
