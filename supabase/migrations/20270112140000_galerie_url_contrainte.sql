-- Story 7.10, correctif de relecture : le lien de la Galerie (Google Drive ou Google Photos seulement) est aussi contrôlé par une contrainte de colonne,
-- pas seulement par la fonction d'écriture : une écriture directe en base ne peut plus y mettre un autre hôte.
alter table public.evenement add constraint evenement_galerie_url_hote check (galerie_url is null or public.galerie_url_valide(galerie_url));
