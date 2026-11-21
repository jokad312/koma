---
title: '9.16 p) — Étape 8, page Prestataires dans le style de l''admin'
type: 'feature'
created: '2026-11-21'
status: 'done'
route: 'dispatch'
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
  - '{project-root}/docs/design/admin/DECISIONS-NUIT.md'
---

## Intent

**Problem:** `/admin/prestataires` garde l'apparence d'avant la refonte ; aucune maquette n'existe pour cette page.

**Approach:** style des pages refaites (consigne de la nuit : « ce qui manque sur la maquette est ajouté dans le même style ») : titre en majuscules, liste en panneau, chaque prestataire en carte, règle de la carte en carte ; aucune action de paiement changée.

## Boundaries & Constraints

**Always :** rien retiré (champs, actions, filtres, messages d'erreur, liens) ; droit inchangé (`prestataires.gerer` ou celui déjà vérifié par la page) ; 16 px minimum ; aucun défilement horizontal à 390 px.

**Never :** aucune migration, aucune nouvelle lecture ou écriture, aucun changement de droits ni de paiement.

## Acceptance Criteria

- Given la page, then son contenu d'avant est entier, dans les panneaux et cartes de l'admin.
- Tests unitaires et e2e existants verts ; captures `docs/captures-admin/9-16-etape-8/` (1366 sombre et clair, 390 px), données TEST_ à 0.
