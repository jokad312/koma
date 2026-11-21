---
title: '9.16 m) — Étape 8, page Événements dans le style de l''admin'
type: 'feature'
created: '2026-11-21'
status: 'done'
route: 'dispatch'
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
  - '{project-root}/docs/design/admin/DECISIONS-NUIT.md'
---

## Intent

**Problem:** `/admin/evenements`, `/nouveau`, `/[id]` garde l'apparence d'avant la refonte ; aucune maquette n'existe pour cette page.

**Approach:** style des pages refaites (consigne de la nuit : « ce qui manque sur la maquette est ajouté dans le même style ») : titre en majuscules, titre et « + Créer » sur une ligne, cartes en panneau (2 colonnes à partir de 1280 px) ; création dans une `FenetreFormulaire` (Q23, Échap et × ramènent à la liste) ; la fiche reste une page (trop de parties pour 670 px), chaque partie en panneau.

## Boundaries & Constraints

**Always :** rien retiré (champs, actions, filtres, messages d'erreur, liens) ; droit inchangé (`evenements.gerer` ou celui déjà vérifié par la page) ; 16 px minimum ; aucun défilement horizontal à 390 px.

**Never :** aucune migration, aucune nouvelle lecture ou écriture, aucun changement de droits ni de paiement.

## Acceptance Criteria

- Given la page, then son contenu d'avant est entier, dans les panneaux et cartes de l'admin.
- Tests unitaires et e2e existants verts ; captures `docs/captures-admin/9-16-etape-8/` (1366 sombre et clair, 390 px), données TEST_ à 0.
