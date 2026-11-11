-- Story 7.5 : nouveau modèle d'email « pass_emis » dans l'énumération fermée envoi.modele (AD-9). Fichier à part : une valeur d'énumération ajoutée
-- ne peut pas être employée dans la transaction qui l'ajoute ; la fonction qui la planifie arrive dans la migration suivante.
alter type public.envoi_modele add value if not exists 'pass_emis';
