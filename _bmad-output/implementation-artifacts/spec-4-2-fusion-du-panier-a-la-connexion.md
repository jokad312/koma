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
- L'annonce « Tu possèdes déjà ce kit : il est dans ta bibliothèque. » reste jusqu'à la prochaine modification du Panier par le client (un déclencheur l'efface).
- Une erreur de fusion est journalisée (code seulement) et la connexion réussit quand même.

</frozen-after-approval>

## Réalisé

- Migration `20261115100000_fusion_panier.sql` (essai préalable dans une transaction annulée sur koma-dev, puis appliquée) : colonne `kit_possede_retire_le`, déclencheur d'effacement, `fusionner_panier`, `avis_kit_possede` (service seulement).
- Module panier : `fusionner` (service), `fusion.ts` ; module comptes : crochet facultatif `fusionnerPanier` dans `verifierCode` et `terminerGoogle` ; page Panier : annonce.
- Tests : pgTAP `fusion_panier.test.sql` (26, en CI), Vitest (service, comptes, interface).

## Reporté / dette

- La fusion n'a pas d'essai de bout en bout navigateur (connexion réelle par code email) : à tester à la main.
