# Spec 6.6 : Annulation d'une Commande de Cosplay et remboursement

Source : `epics.md`, story 6.6 (FR-25, AD-27, AD-31, UX-DR44, Q-4).

## Plan (approuvé par l'agent, mode enchaîné)
- Migration `20261214100000_annulation_et_remboursement.sql` : `ligne_commande.annulee`, tables `demande_client` (statuts `ouverte`, `acceptee`, `refusee`, `close`) et `remboursement` (RLS, aucun droit client, journalisées), modèles d'email `commande_annulee` et `commande_remboursee`.
- `demander_annulation(compte, numero)` : Commande payée avec un Cosplay, pas en fabrication, une seule demande en cours. `traiter_demande` (admin) accepte ou refuse. `annuler_commande` (admin) : lignes physiques annulées, stock rendu, Commande `annulee`, montant à rendre figé = somme (prix × nombre − réduction) des lignes physiques + Forfait ; les Kits restent dans la Bibliothèque ; les places du Plafond se libèrent seules (elles ne comptent que `payee` et `en_fabrication`).
- `confirmer_remboursement(auteur, cible, id, preuve)` (admin) : preuve de 3 à 200 caractères exigée, passe `annulee → remboursee` et clôt la demande, ou clôt un Trop-perçu (`a_rembourser → rembourse`) en créant son remboursement. Aucun remboursement n'est lancé chez un Prestataire.
- Client : « Demander l'annulation » avec boîte de dialogue, absent après la fabrication. Admin : décision et formulaire de preuve dans le détail ; tâche « Argent à traiter ».

## Hypothèse à confirmer
`reduction_cents` est lu comme la réduction TOTALE de la ligne (AD-8 : réduction totale répartie au prorata du prix de la ligne). Aucun code promo n'existe encore (story 9.2) : la valeur est 0 aujourd'hui.
