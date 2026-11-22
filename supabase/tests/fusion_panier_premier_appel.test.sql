-- Bug A1 (2026-11-22) : garde de non-régression du « 55000 record "v_source" is not assigned yet ».
-- Le défaut n'apparaissait qu'au PREMIER appel de fusionner_panier d'une session, avec p_panier null : à la première préparation de
-- l'expression, PL/pgSQL doit connaître le type de v_source.compte_id, et un record jamais rempli n'en a pas. Une fois l'expression
-- préparée dans la session (appel précédent avec un Panier), le même appel passait : c'est pourquoi fusion_panier.test.sql:96 ne le voyait pas.
-- Ce fichier ne contient QUE cet appel (chaque fichier de test a sa propre session). Lançable sur koma-dev : npm run test:sql:linked -- <ce fichier>.
begin;
select plan(1);

select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000b1', 'test-fpa@example.invalid', '{}');

select is(
  public.fusionner_panier('{"type":"compte","id":"00000000-0000-0000-0000-0000000000b1","role":null}'::jsonb, '00000000-0000-0000-0000-0000000000b1', null) ->> 'panier_id',
  null,
  'premier appel de la session, sans Panier invité : aucune erreur, aucun Panier'
);

select * from finish();
rollback;
