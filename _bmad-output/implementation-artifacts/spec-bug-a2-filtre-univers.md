---
title: 'Bug A2 : « [catalogue] lecture impossible » avec le filtre univers'
type: 'bugfix'
created: '2026-11-22'
status: 'in-progress'
baseline_commit: 'd8d8de729172e9b3dcd094cd83b06e75b0769685'
route: 'dispatch'
review_loop_iteration: 1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Journal du 2026-11-22 (l. 140) : `[catalogue] lecture impossible` autour de `/fr/vetements?univers=…`. Le `catch` de `ContenuCatalogue` (`src/components/catalogue/PageCatalogue.tsx:114-117`) avale l'erreur sans cause et sans dire laquelle des trois lectures a échoué (produits, univers, tranches de prix). Enquête du 2026-11-22, NON reproduit : la fonction `lister_catalogue` répond pour les 5 familles avec et sans univers (client public, koma-dev) ; aucune réponse 4xx/5xx de l'API Supabase entre 06:00 et 09:00 UTC hors fusion du Panier ; la page du serveur de dev (port 3000) s'affiche sans erreur avec un univers réel, inconnu ou invalide ; le filtre est juste (le seul vêtement publié est dans l'univers demandé, un univers inconnu donne 0 produit). L'erreur venait donc du code Node et non de la base ; piste la plus probable : les erreurs de Turbopack du même moment (journal l. 119, « module factory is not available »), que le `catch` transforme en « lecture impossible ».

**Approach:** Rendre la cause visible (quelle lecture, nom et message de l'erreur), prouver le filtre univers de bout en bout sur chaque famille par un e2e, et ne corriger que ce que cet e2e ou le journal désignera.

## Boundaries & Constraints

**Always:** message affiché au visiteur inchangé (« Le catalogue est indisponible… ») ; journal sans donnée personnelle (pas d'adresse, pas de paramètres de requête, pas d'identifiant) ; données TEST_ supprimées et comptées à 0.

**Never:** inventer une correction sans cause établie ; changer `lister_catalogue` sans erreur prouvée ; afficher une liste vide à la place d'une erreur.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Univers choisi | `?univers=<A>` sur chaque famille | seuls les produits TEST_ de l'univers A | N/A |
| Univers inconnu ou invalide | UUID absent, `pas-un-uuid` | « Aucun produit ne correspond » (ou filtre ignoré si invalide), jamais l'erreur | N/A |
| Échec d'une lecture | exception dans une des 3 lectures | message au visiteur ; journal `[catalogue] lecture impossible (univers) : Error: …` | page rendue |

</frozen-after-approval>

## Code Map

- `src/components/catalogue/PageCatalogue.tsx:100-117` -- `Promise.all` des trois lectures dans un seul `try`, `catch` muet.
- `src/modules/catalogue/queries.ts:286-293` (`lireUniversPublics`, `"use cache"`), `:303-312` (`lireTranchesPrix`, `"use cache"`), `:334-370` (`listerCatalogue`, lève « Lecture du catalogue impossible. » sur erreur ou disponibilité inconnue).
- `src/modules/catalogue/voir-plus.ts:21` -- même `catch` muet pour « Voir plus ».
- `src/modules/panier/dependances.ts:66-70` -- masquage A1 (code et message Supabase, valeur citée masquée) : à partager, pas à recopier.
- `tests/unit/catalogue-listage.test.ts:185-190` -- « base indisponible » de `chargerPlusProduits` : le journal n'y est pas vérifié.
- `src/modules/catalogue/service.ts:16` -- modèle de journal `[catalogue] ${contexte} : ${code}`.
- `tests/e2e/familles-vetement-autre.spec.ts:1-120` -- modèle de semis et de nettoyage TEST_ (SQL par la CLI, photos dessinées, comptage).
- Chemins : `/fr/cosplays`, `/fr/accessoires`, `/fr/vetements`, `/fr/autres-articles`, `/fr/kits`.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/journal-cause.ts` (nouveau) -- un seul assainisseur partagé avec A1 : `messageSur(texte)` = une ligne, 200 caractères au plus, masque les valeurs entre guillemets doubles (même sans guillemet fermant), entre guillemets simples, les formes `=(…)`, les UUID et les adresses `http(s)://…`. `src/modules/panier/dependances.ts` l'utilise (ses tests A1 restent verts) -- les règles de non-fuite ne divergent pas.
- [x] `src/modules/catalogue/queries.ts` -- `lireUniversPublics`, `lireTranchesPrix`, `listerCatalogue` : l'erreur levée garde l'erreur Supabase en `cause` (`new Error("…", { cause: error })`) ; « disponibilité inconnue » a son propre message (« Lecture du catalogue impossible : disponibilité inconnue. ») ; rien de visible ne change -- sans cela le journal ne dit que la phrase fixe.
- [x] `src/modules/catalogue/journal.ts` -- `causeErreur(e)` : `Nom: message` (assaini par `messageSur`), puis, si `e.cause` est une erreur Supabase (objet avec `code` ou `message`), ` (code=<code> message=<message assaini>)` ; un seul niveau de `cause`, jamais `details` ni `hint`. `ErreurLectureCatalogue` passe sa cause par `super(message, { cause })` (pas de champ `cause` redéclaré) -- un seul format.
- [x] `src/components/catalogue/PageCatalogue.tsx` -- chaque lecture garde son nom : journal `[catalogue] lecture impossible (produits|univers|tranches) : <cause>`, y compris la seconde lecture des produits (curseur périmé).
- [x] `src/modules/catalogue/voir-plus.ts` -- même journal.
- [x] `tests/unit/catalogue-journal.test.ts` -- format ; cause Supabase (code et message) affichée ; UUID, guillemets simples, guillemet non fermé, `=(…)`, adresse masqués ; jamais `details`/`hint`.
- [x] `tests/unit/catalogue-page.test.tsx` -- échec de chaque lecture (message habituel, journal nommé) ; curseur périmé dont la seconde lecture échoue : `(produits)`.
- [x] `tests/unit/catalogue-listage.test.ts` -- « base indisponible » : la ligne journalisée par `chargerPlusProduits` est vérifiée en entier (avec le code Supabase) ; erreur Supabase gardée en `cause` par les trois lectures.
- [x] `tests/e2e/catalogue-univers.spec.ts` -- deux univers TEST_ ; un produit TEST_ publié par famille et par univers (10 produits, kits compris) ; pour chaque famille : sans filtre (les 2), univers A (seulement A), univers B (seulement B), univers inconnu et invalide (jamais l'erreur), sans défilement horizontal à 375 px ; nettoyage et comptage à 0, erreurs de `storage.remove` et `storage.list` levées (jamais un 0 supposé) ; produits TEST_ publiés à `now()` (en tête du tri même si d'autres produits viennent d'être publiés). Tourne aussi en local (koma-dev, sans Mailpit).
- [x] si l'e2e ou le nouveau journal montre une vraie erreur : corriger sa cause dans cette branche (et le noter ici) ; sinon le noter : A2 reste ouvert jusqu'à ce que le journal désigne la cause.

**Acceptance Criteria:**
- Given un univers choisi sur chacune des 5 familles, when la page s'affiche, then seuls les produits de cet univers apparaissent, sans message d'erreur.
- Given une lecture qui échoue, when la page s'affiche, then le visiteur voit le message habituel et le journal nomme la lecture et la cause.

## Implementation Notes

- `journal.ts` : `causeErreur`, `lectureNommee` (enveloppe `ErreurLectureCatalogue` qui garde la lecture et la cause) et `journaliserLectureImpossible` ; masquage repris de A1 (`src/modules/panier/dependances.ts`). Voir plus : `[catalogue] voir plus : lecture impossible : <cause>`.
- Test ajouté aussi dans `tests/unit/catalogue-page.test.tsx` : pour chacune des 3 lectures en échec, message habituel au visiteur et journal `[catalogue] lecture impossible (<lecture>) : <Nom>: <message>`, sans l'univers de la requête.
- e2e lancé en local (koma-dev, 2026-11-22) contre le serveur de dev déjà ouvert sur le port 3000 (le port 3100 de la configuration refusait un second `next dev`) : 9/9 verts, données TEST_ restantes toutes à 0. Aucune erreur reproduite sur les 5 familles (univers A, B, inconnu, invalide) : aucune correction de cause dans cette branche (dernière tâche : rien à corriger tant que le nouveau journal ne désigne pas une vraie erreur).

- Après revue 1 (2026-11-22) : `messageSur` ne masque les guillemets doubles qu'après « : » (avec ou sans guillemet fermant), comme A1 : un nom du code cité sans « : » (`record "v_source" is not assigned yet`) reste lisible, sinon le test A1 qui l'attend tombait. Guillemets simples masqués seulement hors d'un mot (l'apostrophe de « l'univers » n'ouvre rien). `listerCatalogue` : réponse non tableau sans erreur, même message qu'avant, sans cause. e2e relancé (koma-dev, serveur de dev sur le port 3000, configuration temporaire hors dépôt) : 9/9 verts, restes TEST_ à 0, aucune erreur reproduite, donc aucune correction de cause : A2 reste ouvert jusqu'à ce que le journal désigne la cause.

## Spec Change Log

- 2026-11-22, revue 1 (bad_spec). Constat : les trois lectures de `queries.ts` (l. 291, 310, 359) remplacent l'erreur Supabase par une phrase fixe ; le journal A2 n'aurait donc affiché que « Error: Lecture des univers impossible. », jamais la cause. Amendé : tâches `queries.ts` (cause gardée), `journal-cause.ts` (assainisseur partagé, masquage élargi), `causeErreur` (code et message Supabase), tests Voir plus et curseur périmé, e2e (erreurs du stockage, date de publication). État évité : un journal « nommé » qui ne dit toujours pas pourquoi. KEEP : le premier jet est bon et se reprend tel quel (copie complète : `C:/Users/jonathan/AppData/Local/Temp/claude/067c9657c9b14b33/94c2c807-0662-4334-9a00-658eebb958b5/scratchpad/diff-a2.patch`, à réappliquer avec `git apply` puis à compléter) : `lectureNommee`, `ErreurLectureCatalogue` et `journaliserLectureImpossible` (formats `[catalogue] lecture impossible (<lecture>) : …` et `[catalogue] voir plus : lecture impossible : …`), câblage de `PageCatalogue.tsx` et `voir-plus.ts`, tests unitaires du journal et de la page, e2e `catalogue-univers.spec.ts` (semis SQL en un seul bloc `do`, photos dessinées, captures, nettoyage puis comptage) ; message au visiteur inchangé.

## Review Triage Log

| # | Constat | Verdict | Suite |
|---|---------|---------|-------|
| 1 | Cause Supabase perdue dans `queries.ts` : le journal ne dit que la phrase fixe (3 revues) | high : vérifié l. 291, 310, 359 | bad_spec, amendé |
| 2 | « Disponibilité inconnue » et base en échec sous le même message (l. 359 et 363) | medium : vérifié | bad_spec, amendé |
| 3 | Masquage limité aux guillemets doubles après « : » (UUID, `'…'`, `=(…)`, adresse en clair) | medium : la cause Supabase arrivera désormais au journal | bad_spec, amendé |
| 4 | Guillemet ouvrant sans fermant non masqué | low : correction directe de l'expression | inclus dans 3 |
| 5 | Expression recopiée de `panier/dependances.ts` au lieu d'être partagée | low : les règles A1 et A2 divergeraient à la prochaine retouche | bad_spec, amendé |
| 6 | `ErreurLectureCatalogue` redéclare `cause` | low : correction directe | bad_spec, amendé |
| 7 | Journal de Voir plus jamais vérifié dans `chargerPlusProduits` (revue vérification) | gap vérifié par la revue | bad_spec, amendé |
| 8 | Seconde lecture (curseur périmé) jamais testée en échec (revue vérification) | gap vérifié par la revue | bad_spec, amendé |
| 9 | e2e : erreurs de `storage.remove` et `list` ignorées, « 0 fichier » possible à tort | medium : contredit « comptées à 0 » | bad_spec, amendé |
| 10 | e2e : « sans filtre » instable si un produit est publié dans l'heure sur koma-dev | low : correction directe (publié à `now()`) | bad_spec, amendé |
| 11 | `erreur.name` multi-ligne ou très long | rejeté (low) : seuls des noms d'erreurs standards arrivent ici | — |
| 12 | Coupe à 200 au milieu d'une paire UTF-16 | rejeté (low) : sans effet sur la lecture du journal | — |
| 13 | `Promise.all` ne nomme que le premier échec | rejeté (low) : une cause suffit à orienter ; `allSettled` ajoute une branche | — |
| 14 | Erreur Turbopack levée hors du `try` | false : hors du `try`, l'erreur est journalisée par Next lui-même, jamais transformée en « lecture impossible » | — |
| 15 | Chemin temporaire avec espaces et `shell: true` | rejeté (low) : `tmpdir()` sans espace en local comme en CI, même motif que les e2e existants | — |
| 16 | Ordre relatif des deux produits de même date | false : le test ne vérifie que leur présence | — |
| 17 | Détection d'échec SQL par « ERROR » fragile | rejeté (low) : motif commun aux e2e existants, aucun NOTICE émis par ce semis | — |
| 18 | Semis qui désactive `produit_publie_complet` sur koma-dev | rejeté : motif établi (`familles-vetement-autre.spec.ts`), le filtre ne dépend pas de la complétude | — |
| 19 | Choix de l'univers dans le contrôle visible, `/en`, filtres combinés non couverts en e2e | defer : le signalement porte sur `?univers=` | deferred-work |
| 20 | Spec qui coche « corriger » sans correction | rejeté : correction de la spec elle-même (tâche reformulée par le change log) | — |
| 21 | Revue 2 : en production, la cause d'une erreur levée dans une fonction `"use cache"` (univers, tranches) n'arrive pas à la page, et Next journalise lui-même l'erreur d'origine avec `details` et `hint` de la cause brute | high : vérifié dans `next/dist/server/use-cache/use-cache-wrapper.js:894-901` (Next 16.4.6) | patch : cause = objet assaini `{ code, message }` |
| 22 | Guillemet simple non fermé non masqué ; emails et numéros de téléphone en clair non masqués par la règle commune | medium : `messageSur` sert à tout le site | patch |
| 23 | Données non tableau sans erreur : même message qu'une erreur de base | low : correction directe du message | patch |
| 24 | Le journal de Voir plus ne nomme pas la lecture `(produits)` | low : correction directe, format de la spec | patch |
| 25 | Cause réseau profonde (ECONNRESET…) perdue : un seul niveau, jamais `details` | maybe-false : dépend de ce que supabase-js met dans `message` d'un échec réseau | defer (medium, non vérifié) |
| 26 | e2e : le cache `catalogue` n'est pas vidé après le semis et le nettoyage (univers TEST_ visibles dans le filtre d'un serveur de dev déjà ouvert) | low : seulement sur un serveur de dev partagé, jusqu'à la prochaine invalidation | defer (avec 19) |
| 27 | Cause qui est une `Error` affichée en `code=?` ; rejet brut `{ code, message }` donnant « erreur inconnue » | rejeté (low) : aucune des trois lectures ne produit ces formes après le patch 21 | — |
| 28 | `=(a)b)`, guillemet double dans la valeur, nom d'hôte sans `http(s)` | rejeté (low) : formes rares, l'hôte Supabase est déjà public (`NEXT_PUBLIC_SUPABASE_URL`) | — |
| 29 | `message` non textuel ou `name` vide | rejeté (false) : les erreurs journalisées ici sont des `Error` construites par le code | — |
| 30 | Chemin temporaire avec espace (`shell: true`) | carried : rejeté au n° 15 | — |
| 31 | Échec du nettoyage masqué par un échec du comptage | rejeté (low) : les deux échecs font tomber le test, la sortie de la CLI reste dans l'erreur levée | — |
| 32 | L'e2e ne reproduit pas l'hypothèse Turbopack ; aucune pile journalisée | rejeté : impossible à provoquer de façon fiable ; la pile peut citer des chemins, le nom de la lecture suffit à orienter | — |

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- sans erreur.
- `npx playwright test tests/e2e/catalogue-univers.spec.ts` en local (koma-dev), puis CI verte.

**Manual checks:**
- Captures (CI, artefact `captures-e2e`) : `/fr/vetements?univers=<A>` à 375 et 1366 px, clair et sombre.
