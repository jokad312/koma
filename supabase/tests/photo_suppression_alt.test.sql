-- Correctif 2.2 : suppression d'une photo et texte alternatif modifiable (droits, journal, renumérotation, garde différé).
begin;
select plan(36);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-supp1@example.invalid', '{}'),
  ('00000000-0000-0000-0000-0000000000a2', 'test-supp2@example.invalid', '{}');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a1', 'admin');
select public.attribuer_role('{"type":"systeme","nom":"test"}'::jsonb, '00000000-0000-0000-0000-0000000000a2', 'assistant');

-- Droits d'exécution : service seulement.
select ok(
  has_function_privilege('service_role', 'public.supprimer_photo_produit(jsonb, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.supprimer_photo_produit(jsonb, uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.supprimer_photo_produit(jsonb, uuid)', 'execute'),
  'supprimer_photo_produit : service seulement'
);
select ok(
  has_function_privilege('service_role', 'public.modifier_alt_photo(jsonb, uuid, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.modifier_alt_photo(jsonb, uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.modifier_alt_photo(jsonb, uuid, text, text)', 'execute'),
  'modifier_alt_photo : service seulement'
);

-- A : brouillon complet à trois photos. B : produit complet qui sera publié.
select public.enregistrer_produit(
  '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb, null::uuid,
  '{"famille":"cosplay","slug":"supp-a","titre_fr":"A","titre_en":"A en","description_fr":"D","description_en":"D en","prix_cents":4990,"delai_fabrication_jours":10}'::jsonb,
  '[{"taille":"M","stock":1}]'::jsonb);
select public.enregistrer_produit(
  '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb, null::uuid,
  '{"famille":"cosplay","slug":"supp-b","titre_fr":"B","titre_en":"B en","description_fr":"D","description_en":"D en","prix_cents":4990,"delai_fabrication_jours":10}'::jsonb,
  '[{"taille":"M","stock":1}]'::jsonb);
create temp table ks_ids as
  select (select id from public.produit where slug = 'supp-a') as a,
         (select id from public.produit where slug = 'supp-b') as b;
grant select on ks_ids to public;

select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
  (select a from ks_ids), (select a from ks_ids)::text || '/aaaaaaa1-1111-4111-8111-111111111111.jpg', 'Un', 'One');
select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
  (select a from ks_ids), (select a from ks_ids)::text || '/aaaaaaa2-2222-4222-8222-222222222222.jpg', 'Deux', 'Two');
select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
  (select a from ks_ids), (select a from ks_ids)::text || '/aaaaaaa3-3333-4333-8333-333333333333.jpg', 'Trois', 'Three');
select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
  (select b from ks_ids), (select b from ks_ids)::text || '/bbbbbbb1-1111-4111-8111-111111111111.jpg', 'B un', 'B one');
select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
  (select b from ks_ids), (select b from ks_ids)::text || '/bbbbbbb2-2222-4222-8222-222222222222.jpg', 'B deux', 'B two');

-- ---- modifier_alt_photo ----
select throws_ok(
  $$select public.modifier_alt_photo('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a2","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%aaaaaaa1-1111%'), 'x', 'y')$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne modifie pas un texte alternatif'
);
select throws_ok(
  $$select public.modifier_alt_photo('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    '00000000-0000-0000-0000-00000000ffff', 'x', 'y')$$,
  'P0001', 'KS_PHOTO_INTROUVABLE', 'photo inconnue refusée (alt)'
);
select throws_ok(
  $$select public.modifier_alt_photo('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%aaaaaaa1-1111%'), '   ', 'y')$$,
  'P0001', 'KS_ALT_INVALIDE', 'texte alternatif français vide refusé'
);
select throws_ok(
  $$select public.modifier_alt_photo('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%aaaaaaa1-1111%'), 'x', null)$$,
  'P0001', 'KS_ALT_INVALIDE', 'texte alternatif anglais absent refusé'
);
select throws_ok(
  $$select public.modifier_alt_photo('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%aaaaaaa1-1111%'), repeat('x', 201), 'y')$$,
  'P0001', 'KS_ALT_INVALIDE', 'texte alternatif de 201 caractères refusé'
);
select is((select alt_fr from public.produit_photo where fichier like '%aaaaaaa1-1111%'), 'Un', 'les refus ne changent rien');
select lives_ok(
  $$select public.modifier_alt_photo('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%aaaaaaa1-1111%'), '  Face  ', repeat('y', 200))$$,
  'l''admin corrige les textes (200 caractères acceptés)'
);
select is((select alt_fr from public.produit_photo where fichier like '%aaaaaaa1-1111%'), 'Face', 'texte français rogné et enregistré');
select is((select char_length(alt_en) from public.produit_photo where fichier like '%aaaaaaa1-1111%'), 200, 'texte anglais enregistré');
select is(
  (select auteur ->> 'id' || '|' || (avant ->> 'alt_fr') || '|' || (apres ->> 'alt_fr')
   from public.journal_audit where cible_table = 'produit_photo' and action = 'update' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000a1|Un|Face',
  'le journal garde l''auteur, l''avant et l''après'
);

select throws_ok(
  $$select public.modifier_alt_photo('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%aaaaaaa1-1111%'), 'x', '   ')$$,
  'P0001', 'KS_ALT_INVALIDE', 'texte alternatif anglais fait d''espaces refusé'
);

-- Cinq photos sur C, une sur D : supprimer la première renumérote C sans collision et sans toucher D.
select public.enregistrer_produit(
  '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb, null::uuid,
  '{"famille":"accessoire","slug":"supp-c","titre_fr":"C"}'::jsonb, '[]'::jsonb);
select public.enregistrer_produit(
  '{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb, null::uuid,
  '{"famille":"accessoire","slug":"supp-d","titre_fr":"D"}'::jsonb, '[]'::jsonb);
create temp table ks_cd as
  select (select id from public.produit where slug = 'supp-c') as c, (select id from public.produit where slug = 'supp-d') as d;
grant select on ks_cd to public;
select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
  (select c from ks_cd), (select c from ks_cd)::text || '/ccccccc' || n || '-1111-4111-8111-111111111111.jpg', 'C' || n, 'C' || n)
  from generate_series(1, 5) n;
select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
  (select d from ks_cd), (select d from ks_cd)::text || '/ddddddd1-1111-4111-8111-111111111111.jpg', 'D1', 'D1');
select lives_ok(
  $$select public.supprimer_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%ccccccc1-1111%'))$$,
  'supprimer la première de cinq photos'
);
select is(
  (select array_agg(substr(fichier, 38, 8) || ':' || position order by position) from public.produit_photo where produit_id = (select c from ks_cd)),
  array['ccccccc2:1', 'ccccccc3:2', 'ccccccc4:3', 'ccccccc5:4'],
  'quatre photos restantes renumérotées 1..4 dans l''ordre'
);
select is((select position from public.produit_photo where produit_id = (select d from ks_cd)), 1, 'les photos d''un autre produit ne bougent pas');
select is((select count(*)::int from public.produit_photo where produit_id = (select d from ks_cd)), 1, 'ni ne sont supprimées');

-- ---- supprimer_photo_produit : brouillon A ----
select throws_ok(
  $$select public.supprimer_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a2","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%aaaaaaa2-2222%'))$$,
  'P0001', 'KS_DROIT_REFUSE', 'un Assistant ne supprime pas de photo'
);
select throws_ok(
  $$select public.supprimer_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    '00000000-0000-0000-0000-00000000ffff')$$,
  'P0001', 'KS_PHOTO_INTROUVABLE', 'photo inconnue refusée (suppression)'
);
select is((select count(*)::int from public.produit_photo where produit_id = (select a from ks_ids)), 3, 'les refus ne suppriment rien');
select is(
  public.supprimer_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%aaaaaaa2-2222%')),
  (select a from ks_ids)::text || '/aaaaaaa2-2222-4222-8222-222222222222.jpg',
  'la suppression renvoie le fichier du bucket public'
);
select is((select count(*)::int from public.produit_photo where fichier like '%aaaaaaa2-2222%'), 0, 'la ligne a disparu');
select is(
  (select array_agg(substr(fichier, 38, 8) order by position) from public.produit_photo where produit_id = (select a from ks_ids)),
  array['aaaaaaa1', 'aaaaaaa3'],
  'l''ordre des photos restantes est conservé'
);
select is(
  (select array_agg(position order by position) from public.produit_photo where produit_id = (select a from ks_ids)),
  array[1, 2],
  'positions contiguës 1..2 après suppression au milieu'
);
select is(
  (select auteur ->> 'id' from public.journal_audit where cible_table = 'produit_photo' and action = 'delete' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000a1',
  'le journal de la suppression porte l''auteur'
);
select lives_ok(
  $$select public.supprimer_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%aaaaaaa1-1111%'))$$,
  'supprimer la première photo'
);
select is(
  (select array_agg(position order by position) from public.produit_photo where produit_id = (select a from ks_ids)),
  array[1],
  'la photo restante passe en position 1'
);
select lives_ok(
  $$select public.supprimer_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like '%aaaaaaa3-3333%'))$$,
  'la dernière photo d''un brouillon peut être supprimée'
);
select is((select count(*)::int from public.produit_photo where produit_id = (select a from ks_ids)), 0, 'le brouillon n''a plus de photo');

-- ---- supprimer_photo_produit : produit publié B (contrôle différé, forcé ici par SET CONSTRAINTS) ----
select public.publier_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb, (select b from ks_ids));
create function pg_temp.essai_supprimer(p_fichier text) returns void language plpgsql as $$
begin
  perform public.supprimer_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where fichier like p_fichier));
  set constraints all immediate;
end $$;
select lives_ok($$select pg_temp.essai_supprimer('%bbbbbbb1-1111%')$$, 'une photo d''un produit publié qui en garde une autre peut être supprimée');
select is((select array_agg(position order by position) from public.produit_photo where produit_id = (select b from ks_ids)), array[1], 'positions contiguës sur le produit publié');
select throws_ok(
  $$select pg_temp.essai_supprimer('%bbbbbbb2-2222%')$$,
  'P0001', 'KS_PUBLICATION_INCOMPLETE', 'la dernière photo d''un produit publié ne peut pas être supprimée'
);
select is((select count(*)::int from public.produit_photo where produit_id = (select b from ks_ids)), 1, 'le refus ne supprime rien');
select lives_ok(
  $$select public.modifier_alt_photo('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
    (select id from public.produit_photo where produit_id = (select b from ks_ids)), 'Corrigé', 'Fixed')$$,
  'le texte alternatif d''un produit publié se corrige'
);

-- Supprimer un produit publié (cascade) n'est pas bloqué par le contrôle de sa dernière photo.
create function pg_temp.essai_cascade() returns void language plpgsql as $$
begin
  delete from public.produit where id = (select b from ks_ids);
  set constraints all immediate;
end $$;
select set_config('ks.auteur', '{"type":"systeme","nom":"test"}', true);
select lives_ok($$select pg_temp.essai_cascade()$$, 'supprimer un produit publié emporte ses photos sans refus');

-- Dépublié, un produit perd sa dernière photo sans refus.
select public.ajouter_photo_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb,
  (select a from ks_ids), (select a from ks_ids)::text || '/aaaaaaa4-4444-4444-8444-444444444444.jpg', 'Quatre', 'Four');
select public.publier_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb, (select a from ks_ids));
select public.depublier_produit('{"type":"compte","id":"00000000-0000-0000-0000-0000000000a1","role":"admin"}'::jsonb, (select a from ks_ids));
select lives_ok($$select pg_temp.essai_supprimer('%aaaaaaa4-4444%')$$, 'après dépublication, la dernière photo peut être supprimée');

select * from finish();
rollback;
