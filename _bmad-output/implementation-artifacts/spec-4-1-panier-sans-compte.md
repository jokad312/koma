---
title: 'Story 4.1 : panier sans compte'
type: 'feature'
created: '2026-11-01'
status: 'done'
route: 'dispatch'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** un visiteur sans Compte doit pouvoir préparer son achat (FR-11, AD-15) sans que le Panier fige un prix.

**Approche :** `panier` et `ligne_panier` en base, reconnus par un cookie httpOnly signé (`PANIER_COOKIE_SECRET`), écrits seulement par des fonctions réservées au serveur ; bouton « Ajouter au panier » sur les fiches (taille obligatoire pour un produit physique, un seul exemplaire pour un Kit payant) ; compteur « Panier, N articles » dans l'en-tête ; page Panier qui relit tout en base.

## Décisions

- Quantité d'une ligne physique : 1 à 10, jamais au-delà du stock d'une taille non fabriquée sur commande. Cookie valable 30 jours.
- Le Kit gratuit (0 USD) et le Pass n'entrent jamais au Panier. Le Panier d'un visiteur reste anonyme jusqu'à la story 4.2 (fusion à la connexion) ; le contrôle « Kit déjà possédé » joue dès qu'un Compte est connecté.
- « Passer la commande » mène à `/commande` (story 4.3) : 404 d'ici là.
- Délai total : la page affiche le délai de fabrication de chaque ligne sur commande ; le délai de livraison dépend de la zone choisie à l'étape de commande (4.3).

</frozen-after-approval>

## Réalisé

- Migrations `20261113100000_panier.sql` et `20261114100000_panier_stock_et_modification.sql` (correctifs de revue : quantité bornée par le stock, modification refusée sur un produit indisponible), appliquées sur koma-dev, types régénérés.
- `src/lib/panier/cookie.ts`, module `src/modules/panier`, composants `BoutonAjouterPanier`, `ZonePanier`, `PagePanier`, route `/panier` (`/cart` en anglais, noindex).
- `connection()` avant toute lecture du cookie : sans lui, le service avalait le signal de pré-rendu et la page figeait un état d'erreur.
- Tests : pgTAP `panier.test.sql` (45, en CI), Vitest (cookie, service, forme des appels RPC, interface, lectures dynamiques), e2e existants verts.

## Reporté / dette

- Pas de limite d'appels ni de purge des Paniers abandonnés (à traiter avec les tâches de nettoyage, AD-22).
- Une erreur de modification ou de retrait sur la page Panier n'est pas affichée (la page se relit seulement).
- Deux premiers ajouts simultanés sans cookie créent deux Paniers (le dernier cookie gagne).
