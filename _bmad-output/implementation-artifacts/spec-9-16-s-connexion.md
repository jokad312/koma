---
title: '9.16 s) — Page 9 : connexion selon le modèle F'
type: 'feature'
created: '2026-11-21'
status: 'done'
route: 'dispatch'
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
  - '{project-root}/docs/design/admin/DECISIONS-NUIT.md'
---

## Intent

**Problem:** `/[l]/connexion` n'a pas la disposition de la maquette `connexion.mp4` (modèle F d'INVENTAIRE.md : F1 à F5).

**Approach:** panneau d'image à gauche (~46 %, coins de 10 px) et carte CONNEXION (fond « surface », coins de 12 px, ~440 px) à droite ; titre en majuscules ; mêmes textes et même fonctionnement (F4). Aucune photo de connexion n'existe : panneau vide aux couleurs du site, décoratif (F3, règles 5 et 6). Panneau masqué sous 768 px (Q32). Police unique KOMA Chikara (F5).

## Boundaries & Constraints

**Always :** formulaire de connexion inchangé (code par email, Google, âge, questions d'accueil, session expirée, retour à la page quittée) ; SEO et JSON-LD gardés ; 16 px minimum ; aucun défilement horizontal à 390 px.

**Never :** aucune image inventée, aucun changement d'authentification.

## Écarts connus (notés dans la revue complète)

- F1 : en-tête complet du site gardé (l'en-tête réduit demanderait une mise en page à part pour une seule route).
- F3 : pas de fondu entre deux images (aucune photo fournie).

## Acceptance Criteria

- Given 1366 px, then panneau à gauche et carte à droite ; given 390 px, then panneau masqué, champ email visible sans défiler ; aucun débordement (mesuré à 390, 768 et 1366 px).
- e2e connexion et Google existants verts.
