---
title: '9.17 (correction) — Connexion aux proportions exactes de la capture de référence'
type: 'bugfix'
created: '2026-11-21'
status: 'done'
baseline_commit: '95c57dc3a5228891c124d1139d62c81ec863ce72'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-9-17-connexion-maquette.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** la page `/[l]/connexion` de la story 9.17 (non commitée) ne reprend pas les proportions de la capture de référence (`connexion.mp4`, 1108 × 643 px) : grille 45/55 dans le conteneur `max-w-7xl`, panneau de hauteur fixe (560 px), carte en haut.

**Approach :** mesures de Jonathan (2026-11-21), en % de la largeur de la fenêtre, de 1024 à 1920 px : marge gauche 3,2 % ; panneau image 46,3 %, coins arrondis ~14 px ; écart 5,1 % ; carte CONNEXION 38,6 % ; marge droite 6,8 %. En-tête réduit ~50 px, trait fin dessous. Panneau : 16 px sous l'en-tête, 22 px au-dessus du bas, hauteur `100dvh − en-tête − 38 px` ; aucune barre de défilement à 1366 × 768. Carte : hauteur selon son contenu, centrée verticalement par rapport au panneau ; même contenu ; champ email à fond sombre ; RECEVOIR UN CODE rouge ; « ou » ; bouton Google sur une seule ligne. Police KOMA Chikara. Le bouton ▶ visible au centre de la capture vient du lecteur vidéo : non reproduit.

**Décision de Jonathan (2026-11-21) :** le fond sombre du champ email ne s'applique qu'au thème sombre ; en thème clair, le champ garde son fond crème actuel.

**Gardé :** fondu toutes les 3 s entre les 3 images, bouton Pause discret dans le coin, image fixe avec « réduire les animations », panneau masqué sous 768 px (carte pleine largeur).

**Tous les cas (demande de Jonathan, 2026-11-21) :** la page est la même pour tout le monde (clients, bénévoles, admin) et sert aussi d'inscription (première connexion = création du Compte). Le nouveau design est vérifié par e2e ou capture dans chaque cas : clic sur « Se connecter » depuis le site ; arrivée depuis le panier ou le paiement (`?retour=`), puis retour au bon endroit après connexion ; déconnexion pour inactivité (`?expiree=1`, bandeau « session expirée » visible) ; étape du code à 6 chiffres et étape de l'âge d'un nouveau Compte (même mise en page, même panneau) ; retour de Google (`?erreur=google` : le vrai Google n'est pas simulé, règle 13) ; `/en/connexion` ; bouton thème clair ↔ sombre sur cette page.

**Livrables avant commit :** captures 1366 × 768 clair et sombre, 1108 × 643 côte à côte avec `docs/references/maquettes-admin/connexion-reference.png` (ajoutée par Jonathan), et 390 px, montrées à Jonathan.

## Boundaries & Constraints

**Always :** tout ce que garantit spec-9-17-connexion-maquette.md (authentification inchangée, SEO, 16 px minimum, aucun défilement horizontal à 390 px, textes dans `messages/*.json`, en-tête et pied du site gardés ailleurs).

**Never :** reproduire le ▶ du lecteur ; changer une autre page ; changer le champ email ou le bouton Google ailleurs que sur la connexion.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bureau | 1366 × 768 | gauche du panneau à 3,2 % (±2 px), largeur 46,3 %, carte 38,6 %, marge droite 6,8 % ; panneau de (en-tête + 16) à (768 − 22) ; centre vertical carte = centre panneau (±2 px) ; `scrollHeight ≤ innerHeight` | N/A |
| Capture | 1108 × 643 | mêmes proportions, côte à côte avec la référence | N/A |
| Étroit | 390 px | panneau masqué, carte pleine largeur, email visible sans défiler | N/A |
| Contenu haut | étape code, aide ouverte | la carte grandit, la page défile verticalement, rien ne se chevauche | N/A |

</frozen-after-approval>

## Code Map

- `src/app/[locale]/connexion/page.tsx` -- mise en page : remplacer la grille `md:grid-cols-[45fr_55fr]` et `min-h-[560px]` ; garder l'ordre DOM carte puis panneau (`order-first`), `data-*` et JsonLd.
- `src/app/[locale]/connexion/EnTeteConnexion.tsx` -- `h-entete` (64 px) → 50 px, mêmes marges que la page, trait pleine largeur.
- `src/app/[locale]/connexion/connexion.css` -- classes `cx-` propres à la page : variables de largeur en `vw`, hauteur du panneau.
- `src/app/globals.css:496` -- ajouter `main:has([data-page-connexion]) { max-width:none; padding:0 }` (modèle : `main:has([data-coque-admin])`, ligne ~492) ; retirer le `-mt-8` de la page.
- `src/app/[locale]/connexion/FormulaireConnexion.tsx:17` -- `CHAMP` local au formulaire de connexion : fond sombre du champ email en thème sombre seulement (décision ci-dessus).
- `src/app/[locale]/connexion/BoutonGoogle.tsx` -- `whitespace-nowrap` sur le bouton (couleurs Google inchangées).
- `src/app/[locale]/connexion/DiaporamaConnexion.tsx` -- `sizes` à mettre à jour (46,3vw) ; bouton Pause inchangé.
- `tests/e2e/connexion-maquette.spec.ts` -- ajouter les mesures de la matrice.
- `src/components/ui/Bouton.tsx` -- bouton rouge déjà utilisé pour RECEVOIR UN CODE : ne pas toucher.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/globals.css` -- `main` pleine largeur sans marge intérieure sur la connexion -- les % se mesurent sur la fenêtre.
- [x] `src/app/[locale]/connexion/connexion.css` + `page.tsx` -- dès 768 px : rangée `padding-left 3,2vw`, panneau `46,3vw`, écart `5,1vw`, carte `38,6vw` (min. 340 px entre 768 et 1023 px, le panneau prend le reste), marge droite `6,8vw` ; panneau `margin-top 16px`, `height calc(100dvh − 50px − 38px)`, rayon 14 px ; carte `align-self: center` ; sous 768 px : carte pleine largeur avec `px-marge`.
- [x] `EnTeteConnexion.tsx` -- hauteur 50 px, marges 3,2vw / 6,8vw dès 768 px, trait fin pleine largeur.
- [x] `FormulaireConnexion.tsx`, `BoutonGoogle.tsx`, `DiaporamaConnexion.tsx` -- champ sombre, Google sur une ligne, `sizes`.
- [x] `tests/e2e/connexion-maquette.spec.ts`, `tests/unit/connexion-page.test.tsx` -- mesures de la matrice ; tests unitaires adaptés.
- [x] `tests/e2e/connexion-maquette.spec.ts` -- cas de « Tous les cas » : « Se connecter » depuis `/fr` ; `?retour=` depuis le panier (chemin réel de la redirection, lu dans le code du panier) conservé jusqu'après connexion (`connecterCompteTest` de `tests/e2e/police-outils.ts`, ou flux réel de `tests/e2e/connexion.spec.ts`) ; `?expiree=1` (bandeau + panneau) ; étape code puis âge d'un Compte TEST_ neuf (panneau visible, carte centrée) ; `?erreur=google` ; `/en/connexion` ; clic sur le bouton thème → `data-theme` passe à `dark` puis `light`.
- [x] Captures (scratchpad) : 1366 × 768 clair et sombre, 1108 × 643 côte à côte avec la référence, 390 px ; plus étape code, étape âge, session expirée, `?erreur=google` et `/en` à 1366 × 768.

**Acceptance Criteria:**
- Given 1024, 1366 et 1920 px, when la page s'affiche, then chaque mesure de la matrice tient à ±2 px.
- Given 1366 × 768, then aucun défilement vertical ni horizontal.
- Given « réduire les animations », then image fixe, pas de bouton Pause.

## Design Notes

Entre 768 et 1023 px (non mesuré par Jonathan), 38,6 % ferait une carte de 296 px où le bouton Google ne tient plus sur une ligne : carte au moins 340 px, le panneau rétrécit. Marges de l'en-tête alignées sur celles de la page (logo au-dessus du bord gauche du panneau).

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- expected: code de sortie 0
- `npx playwright test tests/e2e/connexion-maquette.spec.ts` -- expected: vert

**Manual checks:**
- Captures comparées à `connexion-reference.png` (présente dans `docs/references/maquettes-admin/` avant la comparaison).

## Review Triage Log

Revue du 2026-11-21 (3 relecteurs : blind-hunter, edge-case-hunter, verification-gap).

| # | Constat | Verdict | Preuve | Suite |
|---|---------|---------|--------|-------|
| 1 | `align-items: center` sur la rangée recentre aussi le panneau quand la carte est plus haute (aide ouverte) | medium | flex : la hauteur de la rangée = la carte, le panneau est centré dessus et descend sous en-tête + 16 px | patch |
| 2 | Test 768–900 px : « au moins 340 px », vérifie `>= 339` alors que le plancher codé est 392 px | medium | un recul à 340 px passerait le test | patch |
| 3 | Test « aide ouverte » ne vérifie ni la carte qui grandit ni le haut du panneau | medium | `panneauEtCarte` ne contrôle que l'ordre horizontal et le défilement horizontal | patch |
| 4 | Première image du diaporama sans `priority` (LCP chargée en différé) | low | `next/image` `fill` sans `priority` = `loading="lazy"` | patch |
| 5 | Tri numérique de `lirePhotosConnexion` non vérifié | low | jeu d'essai sans chiffres ; `.sort()` passerait aussi | patch |
| 6 | `.frame-tmp.mjs` à la racine risque d'être commité | low | fichier temporaire d'extraction d'images de la vidéo | corrigé (supprimé) |
| 7 | Premier spec 9.17 encore inexact (`-mt-8`, trait limité à `max-w-7xl`) | low | lignes 43-44 de spec-9-17-connexion-maquette.md | corrigé (note) |
| 8 | Carte min. 392 px et `cqw` au lieu de 340 px et `vw` (écart avec les tâches) | low | mesuré : Google déborde à 340 px ; `vw` crée un défilement horizontal avec barre verticale ; identique sans barre | rejeté (écart justifié, signalé à Jonathan) |
| 9 | Aucun repli sans `:has()` | low | même mécanisme que l'admin, limite déjà notée dans le premier spec ; correctif = groupe de routes (hors périmètre) | rejeté |
| 10 | Panneau très bas sur fenêtre large mais courte (paysage) | low | à 844 × 390 : ~302 px, jamais négatif ; avec #1 rien ne se chevauche | rejeté |
| 11 | Libellé Pause fixe avec `aria-pressed`, `title` qui change | low | modèle bouton bascule WCAG valide | rejeté |
| 12 | Lien d'évitement mène à l'en-tête réduit | low | limite déjà décrite et acceptée dans le premier spec | rejeté |
| 13 | Test du code laisse un Compte `test-…@example.com` | false | même modèle que tests/e2e/connexion.spec.ts:95 ; ne tourne qu'en CI (base locale jetable) | rejeté |
| 14 | Domaine de cookie `localhost` en dur | false | même modèle que tests/e2e/police-outils.ts:115 ; baseURL Playwright = localhost | rejeté |
| 15 | Couleur `rgb(22, 19, 15)` en dur dans le test | low | casse seulement si le jeton change (et alors le test le signale) | rejeté |
| 16 | `supprimer()` en `finally` peut masquer l'erreur du test | low | rare (suppression Supabase) | rejeté |
| 17 | Test `?retour=` passe par des cookies, pas par le vrai formulaire | false | la tâche autorise `connecterCompteTest` ; le flux réel est couvert par connexion.spec.ts:109 | rejeté |
| 18 | Captures exigées absentes du diff | false | livrable montré à Jonathan hors dépôt | rejeté |

## Corrections après captures (Jonathan, 2026-11-21)

1. **Ordre des images** : fixé explicitement (`ORDRE` dans `src/lib/vitrine/photos-connexion.ts`) : `3-illustration.webp` (en couleur, celle de la référence) d'abord, puis `1-` et `2-`. Plus de tri par numéro (seuls les fichiers hors liste passent après, par nom). Vérifié par capture : étape 1 du fondu = image couleur (`data-diapo=0`).
2. **Titre « TON ÂGE »** : son fond sombre était le halo de `:focus-visible` (ombre de 6 px couleur du fond, globals.css), le titre recevant le focus à l'arrivée sur l'étape. `shadow-none` sur les titres d'étape (code, âge, moins de 13 ans) : plus de fond, comme « CONNEXION ».
3. **Rond de langue, partout (site et admin)** : texte visible = code de la langue actuelle (« FR » / « EN ») ; nom accessible « FR – Changer de langue : English » / « EN – Switch language: Français » (`Langue.changer`). `SelecteurLangue` (rond et pastille) et `LangueRepli`. DESIGN.md et EXPERIENCE.md mis à jour. Le nom accessible commence par le texte visible (WCAG 2.5.3) : la CI de c47effd avait échoué sur axe `label-content-name-mismatch` avec « Changer de langue : English » seul ; préfixe « FR – » choisi par Jonathan.

Captures : `docs/captures-admin/9-17-connexion-3/` (ignoré par Git).
