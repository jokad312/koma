---
title: 'Story 3.5 : obtenir le Kit gratuit'
type: 'feature'
created: '2026-10-31'
status: 'done'
route: 'dispatch'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** un visiteur connecté doit pouvoir obtenir le Kit gratuit d'un geste, sans panier ni paiement (FR-58).

**Approche :** tables `commande`, `ligne_commande`, `acces_kit` ; fonction `offrir_commande` (Commande `offerte` à 0 USD, sans Prestataire, qui passe `livree` dans la même transaction, deux lignes de journal) ; `bibliotheque_ouvrir_acces` ; zone « Obtenir » sur la fiche Kit.

## Décisions

- Licence de kit : la case porte le marqueur « [Texte à fournir] » (Q-5) ; l'espace `Kit` est contrôlé par le build de production. Version enregistrée : `v0-provisoire`, à changer avec le vrai texte.
- Lien « Ouvrir dans ma bibliothèque » vers `/compte/bibliotheque` : la page arrive à la story 3.6 (404 d'ici là).
- Aucun email « Kit ouvert » (epic 4, `envois_planifier`).

</frozen-after-approval>

## Réalisé

- Migrations `20261110100000_commande_offerte_et_acces_kit.sql`, `20261111100000_offrir_commande_cle_et_verrous.sql` (correctif de revue : une clé ne rejoue que la Commande du même Kit ; verrou aussi sur le couple Compte-clé), appliquées sur koma-dev, types régénérés.
- Fonctions `exiger_client`, `bibliotheque_ouvrir_acces` (internes, aucun rôle), `offrir_commande`, `possede_kit` (service seulement). RLS : lecture de ses propres lignes, aucune écriture.
- Modules `commande` et `bibliotheque` ; composant `ObtentionKit` ; textes FR/EN `Kit.obtention`.
- Tests : pgTAP `kit_gratuit.test.sql` (49, en CI), Vitest (service, état, interface, marqueur). Le comportement SQL a aussi été vérifié sur koma-dev dans une transaction annulée.

## Reporté / dette

- `ligne_commande.produit_id` est obligatoire : les lignes de Pass (epic 7) demanderont une migration.
- Si la lecture de l'état échoue pour un Compte complet, le bouton mène à la connexion (qui le renvoie sur la fiche) : à améliorer avec les états d'erreur de l'epic 4.
