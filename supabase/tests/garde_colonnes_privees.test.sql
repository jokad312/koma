-- AD-30 : aucune colonne lisible par anon dont le nom contient `prive`, `chemin` ou `note_admin`.
begin;
select plan(2);

create temp view ks_colonnes_privees_ouvertes as
select c.relname || '.' || a.attname as colonne
from pg_attribute a
join pg_class c on c.oid = a.attrelid
where c.relnamespace = 'public'::regnamespace
  and c.relkind in ('r', 'v', 'm', 'p', 'f')
  and a.attnum > 0
  and not a.attisdropped
  and a.attname ~* '(prive|chemin|note_admin)'
  and has_column_privilege('anon', c.oid, a.attnum, 'select');

select is(
  (select coalesce(array_agg(colonne order by colonne), '{}') from ks_colonnes_privees_ouvertes),
  '{}'::text[],
  'aucune colonne prive, chemin ou note_admin n''est lisible par anon'
);

-- Preuve que le garde échoue : une colonne de ce genre rendue lisible est détectée.
create table public.ks_test_colonnes (id int, chemin_fichier text, note_admin text);
grant select on public.ks_test_colonnes to anon;
select is(
  (select coalesce(array_agg(colonne order by colonne), '{}') from ks_colonnes_privees_ouvertes),
  '{ks_test_colonnes.chemin_fichier,ks_test_colonnes.note_admin}'::text[],
  'une colonne chemin ou note_admin lisible par anon est détectée par le garde'
);

select * from finish();
rollback;
