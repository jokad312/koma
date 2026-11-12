-- Story 8.5 : nouvelle valeur d'énumération pour l'anomalie « Pass offert impossible » (Événement complet au moment de l'attribution, AD-12).
-- Fichier à part : une valeur d'énumération ajoutée ne s'utilise qu'après la fin de la transaction qui l'a créée.
alter type public.anomalie_type add value if not exists 'pass_offert_impossible';
