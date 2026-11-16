---
title: '9.16 étape 3 a) — Police unique KOMA Chikara et règle des 16 px'
type: 'feature'
created: '2026-11-16'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le site et l'admin utilisent Barlow et Barlow Condensed ; Jonathan a choisi une police unique, KOMA Chikara (dérivée de 851 Chikara Dzuyoku, licence vérifiée, planche validée le 2026-11-15), avec une règle : aucun texte sous 16 px.

**Approach:** Charger KOMA Chikara par `next/font/local` et en faire la police de tous les rôles typographiques (site public, admin, `/scan`, connexion) ; porter à 16 px au moins tout rôle ou toute taille écrite en dur qui est plus petite ; un test automatique interdit tout retour sous 16 px.

## Boundaries & Constraints

**Always:** une seule police web chargée ; textes inchangés (aucun texte visible ajouté ou retiré) ; 375 px et 320 px sans défilement horizontal ; contraste et focus inchangés ; licence et fichiers de la police notés dans `docs/licences/polices.md` ; DESIGN.md et CLAUDE.md décrivent la nouvelle typographie.

**Décisions de Jonathan (2026-11-16) :**
- KOMA Chikara aussi pour les grands titres : l'option `NEXT_PUBLIC_TITRES_SAKURA` et tout son code sont retirés ; plus aucune mention de Sakura Town dans CLAUDE.md ni DESIGN.md (la fiche de licence reste, marquée « non utilisée »).
- Un seul poids : `font-synthesis: none` ; la hiérarchie vient de la taille, de la couleur et des majuscules ; les poids déclarés (rôles `t-*`, `font-bold`, `font-semibold`) n'ont plus d'effet visible et sont retirés quand ils sont seuls sur leur ligne de sens.
- Les signes absents `•` `‹` `›` `→` `−` `⋯` sont composés dans la police à partir de ses propres signes, comme les accents ; nouveau woff2 et planche régénérée, que Jonathan revoit avant le commit.
- Spec gardée entière (environ 2 300 jetons).
- Reprise (2026-11-16, après les premières captures) : liens et réglages de l'en-tête à partir de 1280 px, menu ☰ en dessous (l'en-tête d'une personne connectée débordait à 1024 px) ; mot géant « Cosplay » réduit (× 0,74) pour garder sa largeur d'avant ; CLS de l'accueil à 390 px en 4G lent (0 ou 0,0551, au-dessus de 0,0094 avant mais sous 0,1) accepté et noté dans deferred-work.md.
- Revue des captures (2026-11-16) : « FABRIQUE-LE. » insécable et titre sur trois lignes de 320 à 430 px ; tuiles Catégories sur une colonne sous 480 px ; CLS maximum sous 0,05 (replis Arial et Roboto réglés, hauteur du titre réservée) ; interligne du titre 1,1 sur ordinateur ; mot géant à opacité 0,5 en crème sous 1280 px (contraste AA du surtitre) ; encart « Besoin d'aide ? » de l'admin noté pour le cadre A (cause antérieure).

**Ajouts de Jonathan (2026-11-16, reprise avant implémentation) :**
1. **Police de secours.** Pile partout : `"KOMA Chikara", system-ui, sans-serif`. Tout caractère absent de KOMA Chikara (japonais dans un nom de produit, accent rare dans un pseudo, emoji) est dessiné par une police système, jamais par un carré vide. Test e2e : un produit TEST_ dont le nom contient « 鬼滅の刃 » et un emoji, affiché sur sa fiche et dans le catalogue : aucun carré vide (chaque caractère rendu sur canvas avec la pile calculée de l'élément diffère du rendu d'un point de code non attribué), et la pile calculée se termine par `system-ui, sans-serif`.
2. **Chargement sans décalage.** Le woff2 est préchargé (`<link rel="preload" as="font" type="font/woff2" crossorigin>`, posé par `next/font/local`) et déclaré en `font-display: swap`, avec une police de repli aux métriques ajustées (`adjustFontFallback`) pour que le remplacement ne déplace rien. Score CLS de l'accueil (`/fr`, 390 et 1440 px, build de production, clair) mesuré AVANT et APRÈS par `PerformanceObserver('layout-shift')` : APRÈS ≤ AVANT et < 0,1 ; valeurs notées dans `docs/design/admin/INVENTAIRE.md`.
3. **Captures avant le commit.** AVANT (code actuel) et APRÈS, en clair et en sombre, à 1440, 1024 et 390 px : accueil visiteur, en-tête avec le menu « Boutique » ouvert (aucun débordement à 1024 px), fiche produit, panier, connexion, `/compte`, admin tableau de bord, commandes, produits. Présentées côte à côte avant/après dans `docs/captures-police/index.html` (dossier ignoré par Git, jamais commité). Jonathan valide les captures avant le commit ; aucun commit sans cette validation.

**Never:** toucher aux emails (`src/modules/envois/modeles/`, polices du client mail) ni au filigrane PDF des kits (`src/fonts/filigrane/Barlow-Regular.ttf`) ; changer la mise en page, les couleurs ou le cadre de l'admin (étape 3 b, notée dans deferred-work.md) ; ajouter une dépendance.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rôle typographique | `t-small`, `t-label` (14 px aujourd'hui) | 16 px au moins, hauteur de ligne ajustée | N/A |
| Taille écrite en dur | `heros-visiteur.css` 11, 12, 13, 14 px | 16 px au moins | N/A |
| Régression | une feuille ou un composant ajoute `font-size: 14px`, `text-xs`, `text-sm` ou `text-[Npx]` avec N < 16 | le test échoue en nommant le fichier et la ligne | N/A |
| Police indisponible | woff2 non chargé | repli système (`system-ui`, `sans-serif`) | `display: swap` |
| Caractère absent de la police | nom « TEST_ 鬼滅の刃 … 🔥 », pseudo avec accent rare | caractère dessiné par la police système, aucun carré vide | test e2e `police-secours` |
| Chargement de la police | première visite de `/fr` | woff2 préchargé, `swap`, repli aux métriques ajustées : CLS APRÈS ≤ AVANT et < 0,1 | mesure notée dans INVENTAIRE.md |
| Menu « Boutique » à 1024 px | en-tête, menu ouvert | aucun débordement horizontal ni texte coupé | capture + `scrollWidth <= innerWidth` |

</frozen-after-approval>

## Code Map

- `public/fonts/koma-chikara/koma-chikara.woff2` + `LICENCE.txt` -- police (172 glyphes, poids 400, famille « KOMA Chikara »), déjà prête, non commitée ; `.gitignore` (exception `public/fonts/koma-chikara/`), `docs/licences/polices.md` (fiche), `scripts/polices/creer-koma-chikara.py`, `docs/design/admin/` : fichiers réservés à cette étape, à commiter avec elle.
- `src/lib/fonts.ts` -- `barlow`, `barlowCondensed` (`next/font/local`, variables `--font-barlow`, `--font-barlow-condensed`) : remplacer par `komaChikara`. `localFont` exige un chemin relatif au module : déplacer le woff2 sous `src/fonts/koma-chikara/` ou le charger depuis là (garder `LICENCE.txt` à côté).
- `src/app/[locale]/layout.tsx:15,46` -- classes de variables de police sur `<html>`.
- `src/app/globals.css:91-92` -- `--font-corps`, `--font-condensee` : les deux pointent sur KOMA Chikara (noms gardés : 690 emplois de `t-*` et `font-condensee` dans `src/components/scan/ResultatPlein.tsx` restent valides).
- `src/app/globals.css:155-256` -- utilitaires `t-display-brush`, `t-display`, `t-h1`…`t-price-page` ; `t-small` (l. ~214) et `t-label` (l. ~220) à 14 px.
- `src/components/accueil/heros-visiteur.css:83,125,161,236,276,310` -- tailles 11 à 14 px.
- `src/lib/typo/titre.ts` (+ `titre.test.ts`), `src/components/ui/TitreVitrine.tsx`, `src/app/globals.css:261-271` (`.titre-vitrine[data-police="sakura"]`), `src/lib/env.ts:9,47`, `.env.example:9`, `@font-face` Sakura de `src/app/[locale]/layout.tsx:26-50` -- option Sakura, à retirer ; `TitreVitrine` garde son API (rôle, niveau, `donnee`) et rend le rôle `t-*` directement, avec ses accents.
- `scripts/polices/creer-koma-chikara.py` -- fonction `ajouter(nom_glyphe, composants, avance, unicode_)` : modèle pour composer les nouveaux signes ; `docs/design/admin/essais/planche-koma-chikara.html` à régénérer avec ces signes. Vérifier la couverture avec fontTools (`uv run --no-project --with fonttools --with brotli`) : tous les caractères de `messages/*.json` présents.
- `src/components/accueil/HerosVisiteur.tsx:18` -- commentaire « Polices du site (Barlow…) ».
- `src/fonts/barlow-*.woff2` -- ne servent plus après le changement : retirés du dépôt (historique Git conserve) ; `src/fonts/filigrane/` reste.
- Aucune classe Tailwind `text-xs`, `text-sm` ni `text-[Npx]` aujourd'hui dans `src/`.

## Tasks & Acceptance

**Execution:**
- [x] AVANT tout changement : build de production du code actuel ; mesure CLS de l'accueil (390 et 1440 px) ; captures AVANT (9 pages × clair/sombre × 1440/1024/390) par `scripts/captures-police.mjs` (Compte TEST_ admin et produit TEST_ créés puis supprimés, rien ne reste) dans `docs/captures-police/avant/`.
- [x] `src/fonts/koma-chikara/` + `src/lib/fonts.ts` -- charger KOMA Chikara (`display: swap`, repli `system-ui, sans-serif`), retirer Barlow -- police unique.
- [x] `scripts/polices/creer-koma-chikara.py` -- composer `•` `‹` `›` `→` `−` `⋯` ; régénérer le woff2 et la planche -- couverture complète des textes.
- [x] `src/app/[locale]/layout.tsx`, `src/lib/typo/titre.ts`, `src/components/ui/TitreVitrine.tsx`, `src/lib/env.ts`, `.env.example` -- variable de KOMA Chikara sur `<html>` ; option Sakura retirée.
- [x] `src/app/globals.css` -- variables de police sur KOMA Chikara ; `t-small` et `t-label` à 16 px (hauteurs de ligne ajustées) ; `font-synthesis: none` ; règles Sakura retirées -- règle des 16 px, un seul poids.
- [x] `src/components/accueil/heros-visiteur.css` -- tailles sous 16 px portées à 16 px.
- [x] `tests/unit/taille-minimale-texte.test.ts` -- lit `globals.css`, toutes les feuilles `src/**/*.css` et les `.tsx` : échoue sur toute taille sous 16 px (`px`, `rem`, `em` rapportés à 16 px), sur `text-xs`, `text-sm`, `text-[Npx]` N < 16 ; message avec fichier et ligne -- empêcher le retour.
- [x] `tests/unit/police-unique.test.ts` -- aucune référence à Barlow ni à Sakura dans `src/` hors `src/fonts/filigrane/` et du module de filigrane ; `src/lib/fonts.ts` n'exporte que KOMA Chikara ; tous les caractères de `messages/fr.json` et `en.json` sont dans la police (liste `couverture.txt` écrite par le script de création à côté du woff2, relue par le test : pas de décodage woff2 en test) -- police unique et couverture.
- [x] `tests/e2e/police.spec.ts` -- `/fr`, `/en/kits`, une fiche, `/fr/connexion`, `/fr/admin` (connecté) : `document.fonts.check('16px "KOMA Chikara"')` vrai, aucun élément de texte visible sous 16 px (`getComputedStyle`), 320 px sans défilement horizontal, axe-core sans violation grave.
- [x] `tests/e2e/police-secours.spec.ts` -- produit TEST_ « TEST_ 鬼滅の刃 cosplay 🔥 » (semé puis supprimé, comptage final à 0) : sur la fiche et le catalogue, aucun carré vide ; pile calculée `"KOMA Chikara", system-ui, sans-serif` -- ajout 1.
- [x] `src/lib/fonts.ts` -- préchargement (`preload: true`), `display: "swap"`, `adjustFontFallback` ; test unitaire ou e2e : la page `/fr` contient un `<link rel="preload" as="font">` vers le woff2 de KOMA Chikara -- ajout 2.
- [x] APRÈS : nouvelle mesure CLS et captures APRÈS (`docs/captures-police/apres/`), page `docs/captures-police/index.html` côte à côte ; `.gitignore` : `docs/captures-police/` ; ARRÊT pour validation de Jonathan avant le commit -- ajout 3.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/DESIGN.md`, `CLAUDE.md`, `docs/licences/polices.md` -- typographie KOMA Chikara, 16 px minimum, Barlow retiré (sauf filigrane).
- [x] `docs/design/admin/INVENTAIRE.md` -- étape 3 a) faite : liste des endroits touchés (rôles, feuilles, composants).

**Acceptance Criteria:**
- Given n'importe quelle page publique ou admin, when elle s'affiche à 375 px, then tout le texte est en KOMA Chikara et aucun texte calculé ne fait moins de 16 px.
- Given le dépôt, when `npm test` tourne, then le test des 16 px et celui de la police unique passent, et échouent si l'on réintroduit 14 px ou Barlow.
- Given les emails et un PDF de kit, when ils sont produits, then rien ne change.
- Given un nom de produit avec « 鬼滅の刃 » et un emoji, when la fiche s'affiche, then chaque caractère est dessiné (police système pour ceux qu'ignore KOMA Chikara), aucun carré vide.
- Given l'accueil en build de production, when on mesure le CLS avant et après le changement de police, then APRÈS ≤ AVANT et < 0,1.
- Given les captures avant/après (9 pages, clair et sombre, 1440/1024/390 px), when Jonathan les a revues dans `docs/captures-police/index.html`, then seulement le commit part ; à 1024 px le menu « Boutique » ne déborde pas.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- code de sortie 0, lu à part.
- `npx playwright test tests/e2e/police.spec.ts tests/e2e/police-secours.spec.ts tests/e2e/accueil.spec.ts` -- tout passe ; puis la CI GitHub verte (terminé = CI verte).
- `node scripts/captures-police.mjs avant|apres` -- captures et CLS ; page de comparaison ouverte et validée par Jonathan avant le commit.

**Manual checks (if no CLI):**
- Accueil, catalogue, fiche, panier, connexion, admin, `/scan` en crème et sombre, à 375 px : lisibilité, pas de texte coupé.

## Spec Change Log

- 2026-11-16 (implémentation, avant validation de Jonathan) :
  - Nom de famille CSS : `next/font/local` nomme la famille d'après la constante (« komaChikara », repli « komaChikara Fallback ») ; un nom posé par `declarations` n'est pas repris par Turbopack dans la variable (essai : police plus appliquée du tout). La pile reste celle de l'ajout 1 : KOMA Chikara, repli ajusté, `system-ui`, `sans-serif`. Les tests visent « komaChikara ».
  - Police : point médian `·` (vide dans l'original) composé à partir du « . » ; ¥ © ® (vides dans l'original) retirés de la table des caractères (police système) ; drapeau USE_TYPO_METRICS (Windows mesurait la ligne avec usWinAscent, d'où un saut de la ligne de base au remplacement).
  - Héros : titre 58 → 48 px à partir de 1280 px (KOMA Chikara plus large : 4e ligne sur les boutons) ; titres rouges 19 px gras → 24 px (seuil « grand texte » sans gras, contraste inchangé). Changement de taille seulement, mise en page inchangée.
  - E2E : la fiche est vérifiée dans `police-secours.spec.ts` (produit TEST_ à nom japonais), pas dans `police.spec.ts` ; outils communs dans `tests/e2e/police-outils.ts`.
  - CLS (ajout 2) : médiane 0 en réseau direct ; en 4G lent émulé, 0 dans 2 cas sur 3, sinon 0,11 (390 px) à 0,16 (1440 px) quand le woff2 arrive après le premier affichage. Critère « APRÈS < 0,1 » non garanti en 4G lent : décision à prendre par Jonathan (voir INVENTAIRE.md § 6). `optional` essayé et écarté (première visite lente en Arial).
  - Constats hors champ (cadre, étape 3 b) : en-tête connecté qui déborde à 1024 px (déjà AVANT) ; « ESPACE ADMINISTRATEUR » coupé en plein mot dans la barre du haut de l'admin à 1024 px (APRÈS).
