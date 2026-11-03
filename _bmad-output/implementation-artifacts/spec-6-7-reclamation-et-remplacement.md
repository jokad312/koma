# Spec 6.7 : Réclamation et remplacement

Source : `epics.md`, story 6.7 (FR-26, AD-23, AD-31).

## Plan (approuvé par l'agent, mode enchaîné)
- Migration `20261215100000_reclamation.sql` : colonnes `ligne_id` et `description` de `demande_client`, statuts `article_rendu` et `remplacement_remis`, `lignes_reclamables` (Commande `livree` depuis moins de 48 h avec `now()` en base, Accessoire ou Cosplay en taille standard, jamais Sur-mesure ni Kit), `signaler_probleme` (description obligatoire, une seule réclamation en cours par ligne), `catalogue_decrementer_stock`, `traiter_reclamation` (admin : accepter ou refuser, article rendu, remplacement remis ; stock décompté si le remplacement vient du stock).
- Client : « Signaler un problème » (formulaire sans photo, lien WhatsApp pour les photos), état réel dans le détail de la commande et dans « Mes commandes ». Admin : étapes dans le détail, tâche dans « Argent à traiter ». Aucun email de réclamation (décision du 2026-10-21), aucun remboursement.
- La Commande reste `livree`.

## Écart
`catalogue_decrementer_stock` n'existait pas dans les migrations : créée ici (interne, refuse un stock insuffisant).
