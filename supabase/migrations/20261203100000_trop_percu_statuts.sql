-- Story 4.5 (correctif d'alignement sur l'architecture, AD-27) : le Trop-perçu a pour statuts « a_rembourser », « rembourse » et « honore »
-- (et non « ouvert »). Aucune ligne n'existe encore : le renommage ne touche que la définition. La migration 20261128100000 n'est pas modifiée.
alter table public.trop_percu drop constraint trop_percu_clos_coherent;
alter table public.trop_percu drop constraint trop_percu_statut_check;
update public.trop_percu set statut = 'a_rembourser' where statut = 'ouvert';
alter table public.trop_percu alter column statut set default 'a_rembourser';
alter table public.trop_percu add constraint trop_percu_statut_check check (statut in ('a_rembourser', 'rembourse', 'honore'));
-- Un Trop-perçu à rembourser n'est pas clos ; tout autre statut l'est.
alter table public.trop_percu add constraint trop_percu_clos_coherent check ((statut = 'a_rembourser') = (clos_le is null));
