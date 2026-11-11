-- Story 7.11 : nouveaux modèles d'email « candidature_validee » et « candidature_refusee » dans l'énumération fermée envoi.modele (AD-9).
-- Fichier à part : une valeur d'énumération ne s'emploie pas dans la transaction qui l'ajoute.
alter type public.envoi_modele add value if not exists 'candidature_validee';
alter type public.envoi_modele add value if not exists 'candidature_refusee';
