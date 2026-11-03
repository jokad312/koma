# Spec 6.5 : Réception des mesures confirmée par Jonathan

Source : `epics.md`, story 6.5 (FR-23, AD-32, UX-DR43, UX-DR44). Aucune mesure n'est saisie : seule `ligne_commande.mesures_recues_le` est posée.

## Plan
- Migration `20261213100000_confirmer_mesures_recues.sql` : `confirmer_mesures_recues(auteur, ligne)` (personnel ; ligne Sur-mesure ; Commande payée ou en fabrication ; seconde confirmation refusée ; journalisée). `avancer_statut` (6.3) refuse déjà `en_fabrication` tant qu'une ligne Sur-mesure n'a pas de date (`KS_MESURES_NON_RECUES`).
- Admin : tâche « Mesures à recevoir » avec compteur réel et liens (page Tâches) ; bouton « Mesures reçues » par ligne dans le détail ; « Passer en fabrication » en `aria-disabled` avec la raison « Confirme d'abord la réception des mesures. ».
- Client : la page de la commande affiche la date de réception, à partir de laquelle court le délai de fabrication.
