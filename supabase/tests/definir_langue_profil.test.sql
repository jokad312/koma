begin;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000b1', 'test-g1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b2', 'test-g2@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000b3', 'test-g3@example.invalid', '{}');

-- Compte créé par Google : « fr » par défaut, puis la langue de la route.
select is((select langue from public.profil where id = '00000000-0000-0000-0000-0000000000b1'), 'fr', 'sans métadonnée : fr par défaut');
select lives_ok($$select public.definir_langue_profil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000b1', 'en')$$, 'la langue est définie pour son propre profil');
select is((select langue from public.profil where id = '00000000-0000-0000-0000-0000000000b1'), 'en', 'la langue de la route est enregistrée');

-- Langues acceptées : fr et en seulement.
select throws_ok($$select public.definir_langue_profil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000b1', 'xx')$$, 'P0001', 'KS_LANGUE_INVALIDE', 'une langue inconnue est refusée');
select throws_ok($$select public.definir_langue_profil(null, '00000000-0000-0000-0000-0000000000b1', 'fr')$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'sans auteur refusé');

-- Jamais le profil d'un autre.
select throws_ok($$select public.definir_langue_profil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000b2', 'en')$$, 'P0001', 'KS_DROIT_REFUSE', 'modifier le profil d''un autre est refusé');
select is((select langue from public.profil where id = '00000000-0000-0000-0000-0000000000b2'), 'fr', 'le profil d''un autre reste inchangé');

-- Âge déclaré : la langue ne bouge plus.
select public.declarer_age('{"type":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000b3', 20);
select lives_ok($$select public.definir_langue_profil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b3","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000b3', 'en')$$, 'appel sans effet sur un Compte complet');
select is((select langue from public.profil where id = '00000000-0000-0000-0000-0000000000b3'), 'fr', 'Compte complet : langue inchangée');

-- Droits : réservé au service_role.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}';
select throws_ok($$select public.definir_langue_profil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000b1', 'fr')$$, '42501', null, 'non exécutable par authenticated');
reset role;

select * from finish();
rollback;
