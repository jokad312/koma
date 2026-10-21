begin;
select plan(8);

select set_config('ks.auteur', '{"type":"test","nom":"reglage.test"}', true);

select is((select valeur from public.reglage where cle = 'nom_site'), 'KOMA SHOP', 'nom_site a sa valeur de départ');
select ok(
  exists (select 1 from public.journal_audit where cible_table = 'reglage' and cible_id = 'nom_site'),
  'la valeur de départ est journalisée'
);

-- Une autre clé, présente pour vérifier que la lecture publique ne montre que nom_site.
insert into public.reglage (cle, valeur) values ('autre_cle', 'x');

set local role anon;
select is((select count(*)::int from public.reglage), 1, 'anon ne lit que nom_site');
select throws_ok($$insert into public.reglage (cle, valeur) values ('pirate', 'x')$$, '42501', null, 'anon ne peut pas insérer');
select throws_ok($$update public.reglage set valeur = 'x' where cle = 'nom_site'$$, '42501', null, 'anon ne peut pas modifier');
select throws_ok($$delete from public.reglage where cle = 'nom_site'$$, '42501', null, 'anon ne peut pas supprimer');
select throws_ok($$select * from public.journal_audit$$, '42501', null, 'anon ne lit pas le journal');
reset role;

set local ks.auteur = '';
select throws_ok(
  $$update public.reglage set valeur = 'Y' where cle = 'nom_site'$$,
  'P0001', 'KS_AUTEUR_MANQUANT', 'une écriture sans auteur est refusée'
);

select * from finish();
rollback;
