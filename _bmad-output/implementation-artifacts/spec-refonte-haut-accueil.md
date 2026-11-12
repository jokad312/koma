---
title: 'Refonte du haut de la page d''accueil (héros « fusion »)'
type: 'feature'
created: '2026-11-12'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'a9f6482611c8a86a44f5512a18bfc4eb55900b05'
context:
  - '{project-root}/docs/design/maquette-accueil/fusion.html'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le héros actuel (vidéo ~2/3 + deux tuiles « Prêt à porter / Le fabriquer ») ne correspond plus à la maquette validée par Jonathan (`docs/design/maquette-accueil/`, fusion-creme / fusion-sombre ; `fusion.html` = référence de mise en page).

**Approach:** Remplacer `HerosAccueil` par la composition de la maquette (mot géant « COSPLAY » en filigrane, surtitre, deux points, H1, deux boutons, deux colonnes de texte, photo détourée du cosplay vedette avec halo, rangée de 3 cartes, bouton rond, signature), puis mettre à jour la section héros de DESIGN.md et EXPERIENCE.md. Les autres blocs de l'accueil restent intacts.

## Boundaries & Constraints

**Always:**
- Jetons de DESIGN.md seulement (rouge #E3261C, crème, sumi, Barlow / Barlow Condensed, `TitreVitrine` pour le H1), thèmes clair et sombre. Textes dans `messages/fr.json` et `en.json` (FR/EN, aucun texte en dur).
- Un seul H1 ; ordre de lecture logique ; contrastes AA ; cibles 44 px ; `prefers-reduced-motion` respecté ; mot géant en texte, `aria-hidden`.
- Photo vedette = photo de repli réglée dans l'admin (2.6), `priority` ; la vidéo du héros reste possible au même emplacement (bouton Pause conservé). Sans photo de repli : première photo du cosplay vedette ; sans rien : pas de média.
- Cartes = vrais produits publiés (cosplay : le plus récent différent de la vedette, sinon la vedette ; accessoire : le plus récent ; Kit du mois : le Kit publié le plus récent). Prix et titres lus en base. Sans produit ou Kit publié, la carte est masquée proprement.
- Mobile 375 px : une colonne, cartes en défilement horizontal, aucun défilement horizontal de la page. Le bloc « Porte-le ou fabrique-le » garde les clés `heros.pretAPorter`, `fabriquer`, `acces`, `delai`.

**Never:**
- Aucun contenu, avis ou chiffre inventé (les textes de la maquette « Armure EVA — buste » etc. sont des exemples, pas du contenu). Pas de migration, pas de champ admin « kit du mois » (hors périmètre).
- Pas de texte rouge de petite taille sur crème/halo (échec AA : DESIGN.md) : le rouge ne sert qu'aux boutons, repères et au bouton rond. Pas de couleur hors jetons (le gris chaud sombre du halo de la maquette est remplacé par le halo rouge 25 % / 40 % de DESIGN.md).
- Ne pas toucher à l'en-tête du site, ni aux autres blocs de l'accueil.

## I/O & Edge-Case Matrix

| Scénario | État | Résultat |
|---|---|---|
| Nominal | vedette + photo de repli, cosplay, accessoire, kit publiés | Maquette complète, 3 cartes |
| Aucun accessoire / kit publié | catalogue partiel | Carte absente, rangée sans trou ni titre vide |
| Aucune vedette ni photo | héros non réglé | Texte, boutons, colonnes ; pas de média ni de halo vide |
| Lecture en erreur | base en panne | Héros en texte seul, jamais de carte inventée |
| Mouvement réduit | préférence active | Photo seule, pas de vidéo, pas de parallaxe |

</frozen-after-approval>

## Code Map

- `src/components/accueil/HerosAccueil.tsx` -- héros actuel (H1 dans la coque statique, `lireHeros` partagé avec `BlocPorteOuFabrique`) : à réécrire, supprimer `TuileVedette` / `BoutonVedette`.
- `src/components/accueil/MediaHeros.tsx` -- photo + vidéo + Pause + parallaxe, plein cadre `object-cover` : ajouter un mode « cadre » (photo détourée `object-contain`).
- `src/modules/accueil/heros-queries.ts` -- `lireHerosPublic` (repli, vedette) ; ne pas changer son contrat.
- `src/modules/accueil/cosplays-recents.ts`, `kits.ts` -- modèles de lecture (`listerCatalogue`, `connection()`, erreur journalisée) pour le nouveau `heros-cartes.ts`.
- `src/components/ui/classes.ts`, `TitreVitrine.tsx`, `globals.css` -- boutons, titre, jetons (`--ks-*`, `verre-fort`) ; ajouter le halo.
- `messages/fr.json`, `messages/en.json` (`Accueil.heros`) ; `tests/e2e/accueil.spec.ts` (accroche H1 à mettre à jour, H2 inchangés).

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/accueil/heros-cartes.ts` -- lecture des 3 cartes + fonction pure de choix -- cartes réelles, masquées si vides
- [x] `src/components/accueil/HerosAccueil.tsx`, `MediaHeros.tsx`, `globals.css` -- nouvelle composition desktop/mobile, thèmes, halo
- [x] `messages/fr.json`, `messages/en.json` -- textes du héros -- FR/EN
- [x] `tests/unit/heros-cartes.test.ts`, `tests/e2e/accueil.spec.ts` -- choix des cartes, H1, absence de défilement horizontal 375 px
- [x] `DESIGN.md`, `EXPERIENCE.md` -- section héros (composants, layout, responsive, E-16)

**Acceptance Criteria:**
- Given l'accueil à 1440 px en clair puis en sombre, when on le compare à `fusion.html`, then la composition correspond (ordre, alignements, halo, cartes, bouton rond, signature).
- Given 375 px, when la page charge, then une colonne, cartes défilant horizontalement, `scrollWidth <= innerWidth`.
- Given un clavier, when on tabule, then l'ordre suit la lecture et chaque cible fait ≥ 44 px.
- Given Lighthouse (mobile et ordinateur), then performance ≥ 90.

## Implementation Notes

- Fichiers : `HerosAccueil.tsx` (lecture + `RangeeVue` exportée pour les tests), `MediaHeros.tsx` (mode photo détourée / cadre), `heros-cartes.ts` + `heros-cartes-choix.ts` (lecture et choix purs), `heros-queries.ts` (`slug` ajouté à `VedetteHeros`), `globals.css` (halo, mot géant), textes FR/EN, tests (unitaires, e2e), DESIGN.md et EXPERIENCE.md.
- Décisions : trois colonnes à partir de `xl` (1280 px), une colonne en dessous (la photo y resterait trop petite) ; rouge jamais en texte (repères) ; halo rouge 25 % / 40 % de DESIGN.md au lieu du gris chaud de la maquette sombre ; mot géant à 4 % de `text-primary`, texte généré en CSS, exclu du contrôle de contraste axe (décoration pure).
- Photo détourée = photo de repli de l'admin : pour un vrai détourage, envoyer un PNG ou WebP à fond transparent (`sharp` conserve la transparence).
- Lighthouse (build de production, base `koma-dev` sans produit publié) : ordinateur 98, mobile 81 ; les autres pages du même build font 71 à 84 en mobile (LCP ≈ 4,4 s partout) : l'écart avec 90 n'est pas propre au héros.

## Spec Change Log

## Review Triage Log

| Constat | Verdict | Preuve / suite |
|---|---|---|
| Débordement mobile (colonne 744 px, contenu rogné) | high → patch | `min-w-0` + colonne `minmax(0,1fr)` ; test e2e mesure les éléments |
| Photo minuscule 1024–1280 px | high → patch | trois colonnes à partir de `xl`, `sizes` aligné |
| Trou vide 26 rem sans média | medium → patch | enveloppe déplacée dans `MediaVue` |
| Lien étendu limité au bandeau | high → patch | légende non positionnée, vérifié au navigateur (clic en haut de carte = lien) |
| Hauteurs fixes des cartes | medium → patch | `min-h`, titres coupés (2 / 3 lignes) |
| `color-mix` sans repli | low → patch | `color: transparent` avant |
| Slug vedette lu depuis l'URL | medium → patch | `slug` exposé dans `VedetteHeros` |
| Bouton rond vers un catalogue vide | low → patch | première famille ayant un produit |
| Parallaxe sur photo détourée | low → patch | transformée seulement si vidéo affichée |
| `RangeeVue` / mesure e2e non testés | medium → patch | `heros-rangee.test.tsx`, garde `nb > 0` |
| Années / « Kit du mois » non sourcés | false | textes demandés par Jonathan |
| Boutons vers catalogues vides, double option retirée du héros | false | demandé ; la double option reste dans le bloc 1 |
| Badge de disponibilité absent des cartes | false | non demandé, déjà sur les fiches |
| Variantes `MediaHeros` non testées | defer | surtout visuel ; contrôle humain sur la maquette |

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- expected: code de sortie 0 chacun
- `npm run test:e2e -- accueil` -- expected: vert
