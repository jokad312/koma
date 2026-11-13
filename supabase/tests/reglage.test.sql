begin;
select plan(9);

select set_config('ks.auteur', '{"type":"test","nom":"reglage.test"}', true);

select is((select valeur from public.reglage where cle = 'nom_site'), 'KOMA SHOP', 'nom_site a sa valeur de départ');
select ok(
  exists (select 1 from public.journal_audit where cible_table = 'reglage' and cible_id = 'nom_site'),
  'la valeur de départ est journalisée'
);

-- Le numéro WhatsApp (public depuis la 1.8) et une autre clé, pour vérifier que la lecture publique ne montre que ces deux clés.
insert into public.reglage (cle, valeur) values ('numero_whatsapp', '+243970000000');
insert into public.reglage (cle, valeur) values ('autre_cle', 'x');

set local role anon;
-- Story 9.14 : session_inactivite_heures est lisible par anon (le proxy le lit avec la clé publique ; la valeur n'a rien de secret).
select is(
  (select array_agg(cle order by cle) from public.reglage where cle in ('nom_site', 'numero_whatsapp', 'session_inactivite_heures', 'autre_cle')),
  array['nom_site', 'numero_whatsapp', 'session_inactivite_heures'],
  'anon lit nom_site, numero_whatsapp et session_inactivite_heures, pas une autre clé'
);
select ok(exists (select 1 from public.reglage where cle = 'session_inactivite_heures'), 'anon lit session_inactivite_heures');
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
