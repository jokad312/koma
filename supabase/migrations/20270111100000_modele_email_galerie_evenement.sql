-- Story 7.10 : nouveau modèle d'email « galerie_evenement » dans l'énumération fermée envoi.modele (AD-9).
-- Fichier à part : une valeur d'énumération ne s'emploie pas dans la transaction qui l'ajoute.
alter type public.envoi_modele add value if not exists 'galerie_evenement';
