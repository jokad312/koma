---
title: '9.16 j) — Étape 8, page Tâches dans le style de l'admin'
type: 'feature'
created: '2026-11-21'
status: 'done'
route: 'dispatch'
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
  - '{project-root}/docs/design/admin/DECISIONS-NUIT.md'
---

## Intent

**Problem:** `/admin/taches` garde l'apparence d'avant la refonte (cartes à bordure claire, titres t-h2), alors que les pages 1 à 7 suivent les maquettes. Aucune maquette n'existe pour cette page.

**Approach:** Appliquer le style des pages refaites (consigne de la nuit, « ce qui manque sur la maquette est ajouté dans le même style ») : titre en majuscules, les trois suivis (mesures à recevoir, photos, argent) en panneaux côte à côte à partir de 1280 px, la liste des tâches ouvertes dans un panneau « N TÂCHES OUVERTES », chaque tâche en carte de l'admin, gravité en pastille (mot écrit). Classes du panneau partagées (`CLASSES_PANNEAU`, `CLASSES_TITRE_PANNEAU`, `CLASSES_CARTE_ADMIN`).

## Boundaries & Constraints

**Always :** rien retiré : mêmes lectures, mêmes liens, même bouton « Stock vérifié », mêmes messages d'erreur (jamais un faux zéro), mêmes droits (`admin.acceder`). 16 px minimum, aucun défilement horizontal à 390 px.

**Never :** aucune migration, aucune nouvelle lecture, aucun changement de droits.

## Acceptance Criteria

- Given la page, then le titre « TÂCHES », les trois panneaux et le panneau des tâches ouvertes avec leur nombre.
- Given une tâche, then son type (titre de niveau 3), sa gravité en pastille, son détail et sa date.
- Tests unitaires et e2e existants verts ; captures 1366 sombre et clair, 390 px.

## Verification

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build` ; captures `CAPTURES_VUES=taches`.
