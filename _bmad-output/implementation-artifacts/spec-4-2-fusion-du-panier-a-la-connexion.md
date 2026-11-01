---
title: 'Story 4.2 : fusion du panier à la connexion'
type: 'feature'
created: '2026-11-01'
status: 'review'
route: 'dispatch'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** un visiteur qui se connecte au moment de payer doit retrouver le Panier qu'il avait rempli (FR-12, AD-15), sans jamais avoir deux Paniers actifs.

**Approche :** `fusionner_panier` rattache le Panier du cookie au Compte, ou le réunit à celui du Compte (un Kit une fois, quantités additionnées jusqu'à 10) ; un Kit déjà possédé est retiré et annoncé ; appelée par le module comptes après chaque connexion réussie (code email et Google), sans jamais la bloquer.

## Décisions

- Cookie absent (autre appareil) : le cookie est pointé sur le Panier du Compte s'il existe.
- Un Panier déjà lié à un autre Compte est ignoré (jamais volé).
- L'annonce « Tu possèdes déjà ce kit : il est dans ta bibliothèque. » vaut 24 heures après la fusion.
- Une erreur de fusion est journalisée (code seulement) et la connexion réussit quand même.

</frozen-after-approval>

## Réalisé

- Migration `20261115100000_fusion_panier.sql` (essai préalable dans une transaction annulée sur koma-dev, puis appliquée) : colonne `kit_possede_retire_le`, déclencheur d'effacement, `fusionner_panier`, `avis_kit_possede` (service seulement).
- Module panier : `fusionner` (service), `fusion.ts` ; module comptes : crochet facultatif `fusionnerPanier` dans `verifierCode` et `terminerGoogle` ; page Panier : annonce.
- Tests : pgTAP `fusion_panier.test.sql` (26, en CI), Vitest (service, comptes, interface).

## Correctifs de revue (migration `20261116100000_fusion_panier_correctifs.sql`)

- Supprimer un Compte qui a un Panier réussit (auteur « système » en cascade) : sans cela, la suppression du Compte d'un mineur échouait.
- `panier_accessible` : un Panier lié à un Compte n'est ni lu ni modifié par une autre personne ; cookie effacé à la déconnexion et quand la fusion ignore un Panier d'autrui ; un Compte connecté sans cookie retrouve son propre Panier (un seul Panier actif).
- La réunion de deux Paniers est plafonnée au stock d'une taille non fabriquée sur commande.

## Reporté / dette

- Une fusion longue (verrou) retarde la connexion : pas de délai maximal pour l'instant.

- La fusion n'a pas d'essai de bout en bout navigateur (connexion réelle par code email) : à tester à la main.
