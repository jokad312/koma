begin;
select plan(12);

-- Le déclencheur crée le profil à l'insertion d'un utilisateur.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000c1', 'test-c1@example.invalid', '{"langue":"en"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'test-c2@example.invalid', '{}');
select is((select langue from public.profil where id = '00000000-0000-0000-0000-0000000000c1'), 'en', 'profil créé à l''insertion de l''utilisateur');

-- Profil retouché à la main (comme l'essai manuel) : le rattrapage ci-dessous ne doit pas le toucher.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c3', 'test-c3@example.invalid');
update public.profil set langue = 'en' where id = '00000000-0000-0000-0000-0000000000c3';

-- Rattrapage : on rejoue l'instruction de la migration sur un utilisateur sans profil.
delete from public.profil where id = '00000000-0000-0000-0000-0000000000c2';
insert into public.profil (id, langue)
select u.id, case when u.raw_user_meta_data ->> 'langue' in ('fr', 'en') then u.raw_user_meta_data ->> 'langue' else 'fr' end
from auth.users u
where not exists (select 1 from public.profil p where p.id = u.id)
on conflict (id) do nothing;
select is((select langue from public.profil where id = '00000000-0000-0000-0000-0000000000c2'), 'fr', 'rattrapage : profil recréé pour un utilisateur sans profil');
select is((select langue from public.profil where id = '00000000-0000-0000-0000-0000000000c3'), 'en', 'rattrapage : profil existant intact');

-- assurer_profil : crée la ligne manquante avec la langue donnée, et journalise.
delete from public.profil where id = '00000000-0000-0000-0000-0000000000c2';
select lives_ok($$select public.assurer_profil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c2","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000c2', 'en')$$, 'assurer_profil crée la ligne manquante');
select is((select langue from public.profil where id = '00000000-0000-0000-0000-0000000000c2'), 'en', 'la langue donnée est enregistrée');
select is((select count(*)::int from public.journal_audit where action = 'profil_cree' and cible_id = '00000000-0000-0000-0000-0000000000c2'), 1, 'la création est journalisée');

-- Idempotente : un second appel ne change rien et ne journalise pas.
select lives_ok($$select public.assurer_profil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c2","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000c2', 'fr')$$, 'second appel sans erreur');
select is((select langue from public.profil where id = '00000000-0000-0000-0000-0000000000c2'), 'en', 'profil existant intact');
select is((select count(*)::int from public.journal_audit where action = 'profil_cree' and cible_id = '00000000-0000-0000-0000-0000000000c2'), 1, 'rien de plus au journal');

-- Refus : sans auteur, pour un autre Compte, langue inconnue.
select throws_ok($$select public.assurer_profil(null, '00000000-0000-0000-0000-0000000000c2', 'fr')$$, 'P0001', 'KS_AUTEUR_MANQUANT', 'sans auteur refusé');
select throws_ok($$select public.assurer_profil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000c2', 'fr')$$, 'P0001', 'KS_DROIT_REFUSE', 'le profil d''un autre est refusé');

-- Droits : réservé au service_role.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select throws_ok($$select public.assurer_profil('{"type":"compte","id":"00000000-0000-0000-0000-0000000000c1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000c1', 'fr')$$, '42501', null, 'non exécutable par authenticated');
reset role;

select * from finish();
rollback;
