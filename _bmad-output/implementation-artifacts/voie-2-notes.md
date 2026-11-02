# Notes de la voie 2 — avancement (story 3.4 terminée)

- Contexte : `_bmad-output/implementation-artifacts/epic-3-context.md`, spec `spec-3-4-double-option-et-kit-lie-dans-toute-la-boutique.md`.
- Branche : `feat/voie-2-kits` (worktree `C:/Users/jonathan/Desktop/KOMA-SHOP-voie-2-kits`).

## Story 3.4 — « Double option et Kit lié dans toute la boutique » (3 commits locaux + commit de fin de story)

1. `dd6dd50` — la fiche publique porte le Kit lié publié : type `KitLieFiche` + `FicheProduit.kitLie` (`src/modules/catalogue/types.ts`), `lireFicheProduit` porte `produit_lie_id` et lit le Kit lié publié (`src/modules/catalogue/queries.ts`).
2. `afce1a2` — double option « Prêt à porter » / « Le fabriquer moi-même » sur la fiche physique : `src/components/fiche/DoubleOption.tsx`, rendu dans `FicheProduit` si `kitLie`.
3. `9a3479b` — héros et bloc Kits de l'accueil : `VedetteHeros` enrichi (`hrefKit`, `titreKit`, `prixCentsKit`) ; `BoutonVedette` (principal + secondaire si `hrefKit`) ; `TuileVedette` en deux options ; `src/modules/accueil/kits.ts` (`lireKits`) ; `src/components/accueil/BlocKits.tsx` ; bloc 1 des blocs d'accueil passé de `reserve` à `affiche` ; tuile de catégorie Kits ajoutée.
4. Commit de fin de story (cette passe) — **bandeau de zone + Plafond avec Kit lié (FR-6 / FR-10)** puis **bloc 1 « Porte-le ou fabrique-le » (FR-2)**, avec leurs tests.

## Clés de messages ajoutées (sources FR-1 / FR-2 / FR-6 / FR-7 / FR-10)

| Espace | Clé | FR | EN | Source |
|---|---|---|---|---|
| Accueil | `porteOuFabrique.titre` | « PORTE-LE OU FABRIQUE-LE » | `[Texte à fournir]` | EXPERIENCE.md:102 (renommage du bloc 1) ; EN : texte à fournir |
| Accueil | `heros.fabriquer` | « Le fabriquer moi-même » | « Make it yourself » | EXPERIENCE.md:159 |
| Accueil | `heros.acces` | « Accès immédiat » | « Immediate access » | EXPERIENCE.md:161 |
| Accueil | `kits.titre` | « KITS » | « KITS » | DESIGN.md (accueil et catalogues), section Accueil |
| Accueil | `kits.gratuit` | « Ton premier accessoire, offert. » | « Your first freebie, gifted. » | DESIGN.md (accueil et catalogues), section Accueil |
| Accueil | `kits.voirTout` | « Voir tous les kits » | « See all kits » | DESIGN.md (accueil et catalogues), section Accueil |
| Accueil | `categories.kits` (nom / description) | « Kits » / « Kits de cosplay à fabriquer soi-même… » | « Kits » / « DIY cosplay kits… » | DESIGN.md (Catalogue, `key-catalogue`) |
| Fiche | `bandeau` | « Remise uniquement à Goma et Bukavu. Tu es ailleurs ? Le kit, lui, voyage partout. » | idem | EXPERIENCE.md:113 (formulation [HYPOTHÈSE]) / EXPERIENCE.md:179 (zone, FR-6) |
| Fiche | `option.libelle` / `option.porter` / `option.fabriquer` / `option.kitTitre` / `option.acces` / `option.voirLeKit` | « Tu préfères porter ou fabriquer ? » / « Prêt à porter » / « Le fabriquer moi-même » / « Kit lié » / « Accès immédiat, à vie » / « Voir le kit » | EN équivalent | EXPERIENCE.md:176 (double option, panneau « Kit lié » sur place, lien « Voir le kit » FR-7), DESIGN.md:718 (sélecteur à deux options) |
| Fiche | `tailles.complet` | « Commandes complètes pour le moment » | « Orders are complete for the moment » | EXPERIENCE.md:165, DESIGN.md:707 (C-4 tranché ; jamais « Épuisé ») |

- `Accueil.porteOuFabrique.titre` (FR) : source EXPERIENCE.md:102 — le bloc 1 est renommé « Prêt à porter ou fait par toi » en « Porte-le ou fabrique-le » ; le FR retenu est en majuscules sans accent (DESIGN.md:609-610). **EN : `[Texte à fournir]`** — source absente, texte à fournir par Jonathan.
- Clé ajoutée en fin de session (fin de la 3.4) : `Accueil.porteOuFabrique.titre`.

## Vérifications (dernière passe, fin de la story 3.4)

- `npm run lint` : vert.
- `npm run typecheck` (`next typegen && tsc --noEmit`) : vert.
- Tests ciblés fiche + accueil : `fiche-*`, `accueil-blocs`, `accueil-composants`, `accueil-kits-double-option` → **63 tests, tous verts** (dont les nouveaux : bandeau avec / sans Kit lié (FR-6), Plafond + Kit lié (FR-10), bloc 1 « Porte-le ou fabrique-le » sans / avec Kit, marqueurs accueil, ordre des blocs).
- Suite Vitest complète : **1413 tests / 105 fichiers, tous verts** (les 2 échecs précédents — `catalogue-ui.test.tsx` « doublon et échec serveur… » et `lint-texte-en-dur.test.ts` « refuse alt, aria-label… » — étaient des instabilités de parallélisation : rejoués en isolation et sur `main` en isolation : verts).
- `npm run build` : réussi.
- E2E accueil : `npx playwright test tests/e2e/accueil.spec.ts` → **22/22 passés**.

## Points de vigilance / dette connue

- `src/modules/accueil/heros-queries.ts` : `import "server-only";` restauré (disparu pendant l'édition, remis en place — règle des modules serveur).
- `src/components/fiche/BandeauZone.tsx` : prop optionnel `kit` (FR-6) — le bandeau propose le Kit lié via le lien existant `Fiche.option.voirLeKit`, sans nouvelle clé.
- `src/components/fiche/ZoneAchat.tsx` : prop optionnel `kit` (FR-10) — quand le Plafond est atteint, le message « Commandes complètes pour le moment » est accompagné de la proposition du Kit lié (prix, accès, lien) ; sans Kit, message seul.
- `src/components/fiche/DoubleOption.tsx` : la branche « fabriquer » masque bandeau et tailles ; la branche « porter » passe bandeau + zone d'achat avec le Kit.
- `src/components/accueil/BlocPorteOuFabrique.tsx` : nouveau bloc 1 — deux colonnes (porté / fabriqué) ; masqué sans Kit lié publié.
- `src/components/accueil/HerosAccueil.tsx` : `lireHeros` exporté (`cache`) pour le partage avec le bloc.
- `src/modules/accueil/blocs.ts` + `src/app/[locale]/page.tsx` : bloc `porteOuFabrique` enregistré (numero 1) avant `kits` (numero 3).
- `tests/e2e/accueil.spec.ts` mis à jour pour le bloc Kits (h2 conditionnel) et les tuiles en 3.
- Le sitemap `/kits` (attente e2e 3.3) était déjà en place côté code : aucune action.

## État du flux

- Rien de bloquant côté voie 2. Le choix A / B / C restait en attente de Jonathan sur le CI rouge de la story 4.3 (côté voie 1) : **aucun impact sur la voie 2**.
- La voie 2 n'a pas été poussée ; pas de `db:push`.

## Prochaine étape attendue

- Fin de la story 3.4 : bandeau de zone / Plafond de fabrication avec Kit lié (FR-6 / FR-10), bloc 1 « Porte-le ou fabrique-le » (FR-2). **Terminée.**
- Puis la story 3.2 (vidéo chapitres / sous-titres / publication d'un Kit).

## Textes validés par Jonathan (2026-11-02)

- « Voir tous les kits » / « See all kits » : validé. Bandeau de zone : « Remise uniquement à Goma et Bukavu » conservé. EN `Fiche.tailles.complet` : « Orders full for now » (déjà en place).
- EN `Accueil.kits.gratuit` : « Your first kit is on us. » (remplace « Your first freebie, gifted. »).

## Intégration sur main (2026-11-02, voie 1)

- Rebase sur `d31f9f0` : conflits résolus dans `messages/*.json` (bloc `Fiche.panier` de la 4.1 conservé à côté de `Fiche.option`), `FicheProduit`, `DoubleOption` et `ZoneAchat` (`produitId` transmis au bouton « Ajouter au panier », absent de l'option « fabriquer »).
- Revue (2 sous-agents) : **bug bloquant corrigé** — le Kit lié était cherché par `produit_lie_id` lu sur le cosplay, alors que le lien est porté par le Kit (`produit_lie_id` = id du cosplay, unique) : la double option, le bloc 1 et la proposition au Plafond ne s'affichaient jamais. Requête corrigée, tests réécrits (le faux client répond maintenant séparément pour le produit et pour le Kit). Région `aria-live` autour du panneau de la double option ; titre du Kit affiché dans le panneau.
- Texte du bloc 1 : source `EXPERIENCE.md:86, 102, 511` = « Porte-le ou fabrique-le » (jamais « fabriquer-le ») ; FR `PORTE-LE OU FABRIQUE-LE` (majuscules sans accent, comme les autres titres de bloc), EN `WEAR IT OR MAKE IT`. `Kit lié` en anglais devient `Linked kit`.
- Renommage `BlocPorteOuFabrire` en `BlocPorteOuFabrique` (fichier, identifiant de bloc `porteOuFabrique`, clé de message, tests, e2e) ; fautes « fabricher » corrigées.
- Tests instables : `catalogue-ui` « doublon et échec serveur » (délai de `findByText` porté à 8 s) et `lint-texte-en-dur` (délai du test porté à 90 s, cinq passes ESLint).
- Textes sans source exacte, à valider par Jonathan : `Accueil.kits.voirTout` « Voir tous les kits » (absent des sources) ; `Accueil.kits.gratuit` EN « Your first freebie, gifted. » (FR sourcé EXPERIENCE.md:520, EN inventé par la story) ; `Fiche.bandeau` (EXPERIENCE.md:113 marque la phrase [HYPOTHÈSE], le site n'en garde que « Remise uniquement à Goma et Bukavu ») ; `Fiche.tailles.complet` EN « Orders are complete for the moment » (EXPERIENCE.md:263 : « Orders full for now », [HYPOTHÈSE de traduction]) ; libellés EN « Immediate access, for life », « See the kit », « See all kits » (E-23 : story i18n). `Accueil.kits.gratuit` ne s'affiche que s'il existe un Kit gratuit publié (à vérifier à la main).
