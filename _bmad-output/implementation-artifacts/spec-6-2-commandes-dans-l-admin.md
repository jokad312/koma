# Spec 6.2 : Commandes dans l'admin

Source : `epics.md`, story 6.2 (FR-49, FR-24, NFR-9, UX-DR43, règle 2).

## Plan (approuvé par l'agent, mode enchaîné)
- Migration `20261211100000_commandes_admin.sql` : `exiger_personnel` (admin ou assistant, rôle relu en base) et `corriger_adresse_commande` (livraison seulement, journalisée avec l'auteur).
- Page `/admin/commandes` : filtres Statut, Famille, Prestataire, Zone en formulaire GET (listes fermées), nombre de résultats annoncé (`role="status"`), « Effacer les filtres », « Voir plus » par 12, tableau sur ordinateur et cartes sur mobile.
- Page `/admin/commandes/[numero]` : lignes, zone et mode, téléphone, adresse (formulaire de correction), pastille de statut, bloc Paiement en lecture seule avec « Le statut « payée » ne se pose jamais à la main. ».
- Droits : lecture `commandes.voir`, correction `commandes.changer_statut` (admin et assistant).

## Écart assumé
« La tâche liée » du détail n'est pas affichée : les tâches de l'admin sont calculées, pas des lignes rattachées à une Commande. Le lien « Mesures à recevoir » arrive avec la story 6.5.
