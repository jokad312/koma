-- Story 7.8 : deux types d'anomalie pour le Scan hors ligne (AD-21, énumération fermée complétée par migration).
-- Fichier séparé : une valeur d'énumération ajoutée ne peut pas être utilisée dans la transaction qui l'ajoute.
-- scans_non_synchronises : un Verrou hors ligne libéré de force par l'Admin (appareil perdu) ; les scans faits sur cet appareil, s'il y en a, ne sont pas connus.
-- scan_conflit : un scan fait hors ligne, VALIDE à l'écran, que la base ne peut pas appliquer (Pass scanné ailleurs entre-temps, annulé, Commande non payée).
alter type public.anomalie_type add value if not exists 'scans_non_synchronises';
alter type public.anomalie_type add value if not exists 'scan_conflit';
