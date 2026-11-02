# Notes de la voie 2 — avancement (story 3.4 en cours)

- Contexte : `_bmad-output/implementation-artifacts/epic-3-context.md`, spec `spec-3-4-double-option-et-kit-lie-dans-toute-la-boutique.md`.
- Branche : `feat/voie-2-kits` (worktree `C:/Users/jonathan/Desktop/KOMA-SHOP-voie-2-kits`).

## Story 3.4 — « Double option et Kit lié dans toute la boutique » (3 commits locaux)

1. `dd6dd50` — la fiche publique porte le Kit lié publié : type `KitLieFiche` + `FicheProduit.kitLie` (`src/modules/catalogue/types.ts`), `lireFicheProduit` porte `produit_lie_id` et lit le Kit lié publié (`src/modules/catalogue/queries.ts`).
2. `afce1a2` — double option « Prêt à porter » / « Le fabriquer moi-même » sur la fiche physique : `src/components/fiche/DoubleOption.tsx`, rendu dans `FicheProduit` si `kitLie`.
3. `9a3479b` — héros et bloc Kits de l'accueil : `VedetteHeros` enrichi (`hrefKit`, `titreKit`, `prixCentsKit`) ; `BoutonVedette` (principal + secondaire si `hrefKit`) ; `TuileVedette` en deux options ; `src/modules/accueil/kits.ts` (`lireKits`) ; `src/components/accueil/BlocKits.tsx` ; bloc 1 des blocs d'accueil passé de `reserve` à `affiche` ; tuile de catégorie Kits ajoutée.

## Vérifications (dernière passe, commit 3)

- `npm run lint` : vert.
- `npm run typecheck` (`next typegen && tsc --noEmit`) : vert.
- Tests ciblés fiche + accueil : `fiche-*`, `accueil-blocs`, `accueil-composants`, `accueil-kits-double-option` → 84 tests, tous verts.
- Suite Vitest complète : 1403 tests passés / 2 échecs transitoires (parallélisation) — rejoués en isolation : verts.
- `npm run build` : réussi.

## Points de vigilance / dette connue

- `src/modules/accueil/heros-queries.ts` : `import "server-only";` restauré (disparu pendant l'édition, remis en place — règle des modules serveur).
- `tests/e2e/accueil.spec.ts` mis à jour pour le bloc Kits (h2 conditionnel) et les tuiles en 3.
- Le sitemap `/kits` (attente e2e 3.3) était déjà en place côté code : aucune action.

## État du flux

- Rien de bloquant côté voie 2. Le choix A / B / C restait en attente de Jonathan sur le CI rouge de la story 4.3 (côté voie 1) : **aucun impact sur la voie 2**.
- La voie 2 n'a pas été poussée ; pas de `db:push`.

## Prochaine étape attendue

- Fin de la story 3.4 : bandeau de zone / Plafond de fabrication avec Kit lié (FR-6 / FR-10), bloc 1 « Porte-le ou fabrique-le » (FR-2).
- Puis la story 3.2 (vidéo chapitres / sous-titres / publication d'un Kit).
