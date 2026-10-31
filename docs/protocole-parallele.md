# Protocole de travail en parallèle (validé par Jonathan le 2026-10-31)

Deux sessions OpenCode avancent en même temps sur des stories sans paiement ni accès payé ; Claude Code code lui-même la voie sensible et relit tout le reste. Les règles 1 à 15 de CLAUDE.md et le parcours BMad restent inchangés (une story à la fois par voie, nouvelle session pour chaque workflow, plan proposé et validé avant de coder).

## Rôles
- **Voie 1 : Claude Code.** Commande, paiement, accès aux Kits payés. Elle est sensible de bout en bout (règles 1, 2, 9 à 11).
- **Voie 2 : OpenCode A** et **voie 3 : OpenCode B.** Chacune code sur sa branche, dans son dossier de travail (`git worktree`). Elles ne touchent pas à `main`.
- **Intégrateur : Claude Code.** Relit chaque branche (un autre modèle que celui qui a codé), vérifie la CI, fusionne dans `main`, **pousse seul les migrations sur `koma-dev`** après fusion, régénère les types, met à jour le sprint. Jonathan garde le dernier mot et fait les essais à la main.

## Les voies
| Voie | Branche / dossier | Stories (dans l'ordre) |
|---|---|---|
| 1 : Claude Code | `main` | 3.5, 4.1 à 4.6, puis 5.1 à 5.3, **puis 3.6 et 3.7** (elles touchent à `acces_kit`, aux liens signés, aux jetons Bunny et à la RLS : règles 1 et 2) |
| 2 : OpenCode A | `feat/voie-2-kits` | 3.4 |
| 3 : OpenCode B | `feat/voie-3-contenu` | 8.6, 8.7, 9.1 ; puis **7.1 après le correct-course Q-C1** (Stand : FR-33 et AD-7) ; puis **7.2 après la fusion de 3.5** (la fonction `places_evenement_utilisees` lit les Commandes `pass`) ; puis 6.1 à 6.3 **après la fusion de 4.3**, avec relecture ligne à ligne |

Une voie ne démarre une story que si ses dépendances sont **fusionnées dans `main`**. Quand la voie 2 a fini la 3.4, elle s'arrête : l'intégrateur décide de la suite.

## Interdits aux voies 2 et 3
`git push`, `git merge` dans `main`, `npm run db:push`, `npm run db:link`, tout appel à l'API Supabase avec une clé de service, toute modification de `sprint-status.yaml`, `journal-enchainement.md`, `epics.md`, `CLAUDE.md`, `.env.example`, `src/lib/supabase/types.ts`, ou d'une migration existante. Aucun secret dans le dépôt ni dans les notes.

## Fichiers partagés, avec règle
- **Migrations** : une plage de dates par voie, pour éviter les collisions. Voie 1 : `20261110…` à `20261119…` ; voie 2 : `20261120…` à `20261124…` ; voie 3 : `20261125…` à `20261129…` (puis `202612…` pour la voie 3 si besoin). Une migration ne dépend jamais d'une table d'une autre voie non fusionnée. Comme les plages ne suivent pas l'ordre de fusion, l'intégrateur pousse avec `--include-all`.
- **Types Supabase** : régénérés par l'intégrateur seulement. Une voie qui a besoin d'un type de sa migration l'écrit à la main dans son module, et l'intégrateur le remplace.
- **Traductions** (`messages/fr.json`, `en.json`) : chaque voie ajoute ses propres espaces de noms, sans reformater le reste.
- Pas de reformatage, de renommage ni de refactor hors de la story. Pas de nouvelle dépendance sans licence notée dans `docs/licences/` (règle 6).

## Cycle d'une story (voies 2 et 3)
1. `git fetch` puis `git rebase main` (la branche locale `main` est mise à jour par l'intégrateur).
2. Spec BMad et plan, validé par Jonathan. Puis code, `npm run lint`, `typecheck`, `test`, `build` verts. Les tests SQL s'écrivent mais ne tournent qu'en CI (pas de Docker en local).
3. Commit sur la branche (message « Story X.Y : … ») et note `.relais/voie-N.md` : fichiers changés, ce qu'il faut tester à la main, migration éventuelle, points d'attention. **Pas de push.**
4. Jonathan prévient l'intégrateur ; celui-ci récupère la branche, la pousse, vérifie la CI, relit, demande les correctifs, fusionne en *squash*, pousse la migration sur `koma-dev`, régénère les types, met à jour le sprint.
5. La voie rebase avant sa story suivante.

## Arrêts obligatoires
Information manquante (documentation K-Pay ou MaishaPay, domaine, texte légal, contenu) : arrêt et signalement (règle 15). Test qui échoue deux fois de suite : arrêt et rapport. Doute sur une règle métier : demander. Si une story semble toucher aux paiements, à l'accès aux fichiers payants, à une fonction `SECURITY DEFINER` sensible ou à la RLS d'une table de commande : arrêt, elle revient à la voie 1.
