---
title: '9.16 r) — Étape 8, page Détail d'une commande dans le style de l''admin'
type: 'feature'
created: '2026-11-21'
status: 'done'
route: 'dispatch'
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
  - '{project-root}/docs/design/admin/DECISIONS-NUIT.md'
---

## Intent

**Problem:** `/admin/commandes/[numero]` garde l'apparence d'avant la refonte ; aucune maquette n'existe pour cette page.

**Approach:** style des pages refaites (consigne de la nuit : « ce qui manque sur la maquette est ajouté dans le même style ») : titre en majuscules, titre en majuscules, chaque partie (avancement, argent, réclamations, lignes, remise) en panneau.

## Boundaries & Constraints

**Always :** rien retiré (champs, actions, filtres, messages d'erreur, liens) ; droit inchangé (`commandes.voir` ou celui déjà vérifié par la page) ; 16 px minimum ; aucun défilement horizontal à 390 px.

**Never :** aucune migration, aucune nouvelle lecture ou écriture, aucun changement de droits ni de paiement.

## Acceptance Criteria

- Given la page, then son contenu d'avant est entier, dans les panneaux et cartes de l'admin.
- Tests unitaires et e2e existants verts ; captures `docs/captures-admin/9-16-etape-8/` (1366 sombre et clair, 390 px), données TEST_ à 0.
