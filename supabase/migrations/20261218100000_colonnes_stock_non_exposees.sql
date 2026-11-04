-- Garde « le public ne voit jamais de quantite de stock » (migration 20261029100000, test stock_non_expose) : les colonnes ligne_commande.stock_retire et
-- commande.stock_a_verifier (migration 20261217100000) sont internes (admin et serveur). authenticated garde la lecture de ses Commandes (RLS) sauf ces deux
-- colonnes : le droit de lecture de la table est retire, puis rendu colonne par colonne. Toute lecture se fait par le client de service ; aucune lecture
-- de ces tables ne passe par la session du client.
do $$
declare
  v_commande text;
  v_ligne text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_commande
    from information_schema.columns where table_schema = 'public' and table_name = 'commande' and column_name <> 'stock_a_verifier';
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_ligne
    from information_schema.columns where table_schema = 'public' and table_name = 'ligne_commande' and column_name <> 'stock_retire';
  revoke select on public.commande, public.ligne_commande from authenticated;
  execute format('grant select (%s) on public.commande to authenticated', v_commande);
  execute format('grant select (%s) on public.ligne_commande to authenticated', v_ligne);
end;
$$;
