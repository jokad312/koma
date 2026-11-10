---
title: 'Correctif 9.8b : navigation admin mobile (menu ☰)'
type: 'bugfix'
created: '2026-11-10'
status: 'done'
route: 'dispatch'
---

## Intent

**Problème :** la barre du bas de l'admin avait 11 onglets d'environ 34 px sur mobile, sous les 44 px de la règle 7 (relevé à la fin de la 9.8). Décision de Jonathan du 2026-11-10 : corriger avec le menu ☰ prévu par UX-DR42.

**Approche :** sur mobile, la barre garde Tableau de bord, Commandes, Tâches et un bouton ☰ « Plus » ; le bouton ouvre le `Dialogue` plein écran existant avec les 8 autres pages. Barre latérale inchangée sur ordinateur (md et plus). « Scan » et « Mesures » de UX-DR42 n'ont pas de page : non ajoutés (epics.md : seulement les entrées existantes).

## Critères d'acceptation

1. Mobile : 4 cibles de 44 px au moins ; le bouton annonce `aria-haspopup="dialog"` et `aria-expanded`.
2. Le panneau s'ouvre au clavier, le focus y entre, Échap le ferme, le focus revient au bouton.
3. Page courante dans le panneau : trait rouge et annonce sur le bouton (« page actuelle : … ») ; `aria-current` sur le lien.
4. Compteur de messages annoncé sur le bouton et dans le panneau.
5. Choisir une page, changer de page ou passer à la largeur ordinateur ferme le panneau.
6. Textes dans `Admin.nav` (FR et EN) ; aucun texte en dur.

## Fichiers

`src/components/admin/NavigationAdmin.tsx`, `src/app/globals.css` (scroll-padding sous la barre), `messages/{fr,en}.json`, `tests/unit/coque-admin.test.tsx`.
