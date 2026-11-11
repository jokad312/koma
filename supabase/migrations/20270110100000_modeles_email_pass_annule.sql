-- Story 7.9 : nouveaux modèles d'email « pass_annule » et « pass_rembourse » dans l'énumération fermée envoi.modele (AD-9).
-- Fichier à part : une valeur d'énumération ne s'emploie pas dans la transaction qui l'ajoute.
alter type public.envoi_modele add value if not exists 'pass_annule';
alter type public.envoi_modele add value if not exists 'pass_rembourse';
