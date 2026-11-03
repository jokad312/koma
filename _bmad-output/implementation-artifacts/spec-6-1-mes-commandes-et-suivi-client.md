# Spec 6.1 : Mes commandes et suivi client

Source : `epics.md`, story 6.1 (FR-22, UX-DR38, UX-DR45, E-25, règle 12).

## Plan (approuvé par l'agent, mode enchaîné)
- Migration `20261210100000_commande_suivi_colonnes.sql` : `commande.fabrication_le`, `expediee_le`, `livree_le`, `numero_suivi` ; `ligne_commande.mesures_recues_le`. Colonnes seulement, posées par les fonctions des stories 6.3 et 6.5.
- `listerCommandes` (module `commande`, lecture serveur filtrée par le Compte) ; page `/compte/commandes`, « Voir plus » par 12 (paramètre `n`, multiple de 12).
- `construireFrise` (pur) et `FriseStatuts` : étapes réelles, `aria-current="step"`, état dit en texte, aucun rouge, aucun « en transit ».
- Détail : « Offert » pour une Commande offerte (ni paiement ni Prestataire), « Prête à retirer » pour `expediee` en retrait à Goma, numéro de suivi en texte brut, bouton WhatsApp. Le suivi du paiement (4.6) et « Reprendre mon panier » existent déjà.
- Navigation « Mon compte » : entrée « Mes commandes ».

## Hors périmètre
Kit seul : pas de frise (le passage à `livree` du paiement ne pose pas `livree_le`).
