---
title: '9.17 — Page de connexion selon la maquette (connexion.mp4)'
type: 'feature'
created: '2026-11-21'
status: 'done'
route: 'dispatch'
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
---

## Intent

**Problem:** `/[l]/connexion` garde l'en-tête complet du site, le pied de page et un panneau sans image : elle ne respecte pas `connexion.mp4` (modèle F d'INVENTAIRE.md).

**Approach:** exactement la vidéo (demande de Jonathan du 2026-11-21) :
- en-tête réduit propre à la page : logo à gauche, bouton thème et langue à droite, trait fin dessous ; ni menu (Boutique, Festival, Blog, À propos), ni « Se connecter », ni panier ;
- à gauche, grand panneau image (~45 % de la largeur, coins arrondis), fondu d'une image à l'autre toutes les 3 s environ ; « réduire les animations » : image fixe ; masqué sous 768 px ;
- à droite, la carte CONNEXION (texte, email, RECEVOIR UN CODE, « ou », CONTINUER AVEC GOOGLE), fonctionnement inchangé ;
- aucun pied de page.

**Images (décision explicite de Jonathan, 2026-11-21) :** les 3 images de `docs/references/images-connexion/` dans cet ordre (1005006473090799219, 202099102020657130, 440508407324240551), copiées dans `public/images/connexion/` en WebP sans métadonnées, texte alternatif « Illustration ». Exception à la règle 6 notée dans CLAUDE.md et `docs/licences/images-connexion.md` ; aucune autre page concernée.

## Boundaries & Constraints

**Always :** authentification inchangée (code par email, Google, âge, questions d'accueil, session expirée, retour) ; SEO, Open Graph et JSON-LD gardés ; 16 px minimum ; aucun défilement horizontal à 390 px ; textes dans `messages/*.json`.

**Never :** aucune autre page ne perd son en-tête ni son pied de page ; aucune image ailleurs que sur cette page.

## Acceptance Criteria

- Given `/fr/connexion` à 1366 px, then en-tête réduit (logo, thème, langue, trait), panneau image à gauche, carte à droite, aucun pied de page, aucun lien de menu, ni « Se connecter » ni panier.
- Given 3 s, then l'image suivante apparaît en fondu ; given « réduire les animations », then la première image reste fixe.
- Given 390 px, then aucune image, la carte et le champ email visibles sans défiler.
- Given une autre page, then l'en-tête et le pied de page complets.

## Verification

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, e2e connexion ; captures 1366 clair et sombre (2 étapes du fondu) et 390.

## Décisions et limites connues

- Bouton Pause / Lecture (aria-pressed) dans le coin du panneau : ajouté pour WCAG 2.2.2 (contenu qui bouge plus de 5 s, règle 7) ; absent de la vidéo, à retirer si Jonathan le refuse. Placé après la carte dans l'ordre du clavier.
- En-tête et pied du site masqués par `body:has([data-page-connexion])` (même mécanisme que l'admin) : un navigateur sans `:has()` (Firefox < 121, très vieux Chrome ou WebView) afficherait aussi l'en-tête et le pied du site. L'en-tête réduit est rendu par la page, donc dans `<main>` : ce n'est pas un repère « banner », et le lien d'évitement arrive juste avant lui. Correction (spec-9-17-connexion-maquette-2.md) : plus de `-mt-8` ; `main:has([data-page-connexion])` retire la largeur maximale et la marge intérieure de `<main>`.
- Trait sous l'en-tête : toute la largeur de la fenêtre (correction, spec-9-17-connexion-maquette-2.md).
- Texte alternatif « Illustration » (demande de Jonathan), porté par la seule image visible.
- Images : exception à la règle 6 (CLAUDE.md, docs/licences/images-connexion.md) ; elles restent dans l'historique Git.
