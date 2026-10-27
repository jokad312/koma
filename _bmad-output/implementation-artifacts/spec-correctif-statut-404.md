---
title: 'Correctif : toute page introuvable répond en HTTP 404 en production'
type: 'bugfix'
created: '2026-10-27'
status: 'done'
baseline_commit: '9ba4584'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-5-fiche-d-un-produit-physique.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** En production (`next start`, `cacheComponents` actif, coque prérendue), la fiche d'un produit inconnu ou dépublié et les pages introuvables affichent bien le contenu « 404 » mais répondent avec le statut HTTP 200 (+ noindex) : les robots et les liens partagés voient une « soft 404 ». Décision de Jonathan : la fiche inconnue ou dépubliée, et toute page introuvable, doivent répondre en HTTP 404.

**Approach:** Trouver et appliquer une solution compatible avec `cacheComponents` et `Suspense` qui fait partir le statut 404 avant le début du flux (piste de la documentation de Next.js : décider dans `src/proxy.ts`, avant le rendu, par une réécriture avec statut 404 vers la page d'erreur de la langue ; ou toute autre solution dont le test prouve l'effet), puis ajouter un test qui vérifie le statut sur le serveur de production.

## Boundaries & Constraints

**Always:** Le comportement doit être démontré sur un build de production servi par `next start`, jamais seulement en développement (où le statut est déjà correct). Pages concernées : toute adresse inconnue sous `/fr` et `/en` (route attrape-tout), toute adresse d'une autre forme (`/zzz`, `/fr/zzz/aaa`), la fiche d'un produit inconnu, dépublié ou d'une autre famille (`/fr/cosplays/<adresse>`, `/fr/accessoires/<adresse>`, `/en/cosplays/<adresse>`, `/en/accessories/<adresse>`), et `/admin/produits/<identifiant inconnu>` si la même solution le permet sans fuite d'information (l'accès admin ne doit jamais révéler qu'une page existe à un visiteur : le statut 404 d'un non-admin reste celui déjà en place). Les pages qui existent gardent 200 ; les redirections existantes (308 des adresses de l'autre langue, `/` vers la langue) sont inchangées ; la page 404 affichée garde son contenu traduit (clés `NonTrouve.*`), son `noindex` et son lien vers l'accueil.
Si la solution lit la base dans le proxy (existence d'une fiche publiée), elle utilise la clé publique et la RLS (jamais la clé de service), une requête légère limitée aux adresses de fiche, avec une courte durée de cache si cela ne change pas le résultat, un délai maximal raisonnable, et un repli sûr : si la base ne répond pas, la fiche suit le chemin normal (pas de 404 à tort, pas de 500). Aucune donnée personnelle journalisée.
Test : un test automatique qui construit ou réutilise le build de production, démarre `next start` sur un port libre et vérifie les statuts HTTP réels (404 pour les cas ci-dessus, 200 pour `/fr`, `/fr/cosplays`, `/fr/contact`, 308 pour `/en/accessoires`) ; branché sur `package.json` (script nommé, par exemple `test:e2e:prod`) et dans le workflow GitHub Actions après l'étape de build ; ne crée aucun produit sur la base (la fiche « dépubliée » est couverte par une adresse inexistante ; le cas « produit publié → 200 » est ajouté seulement si une donnée de test nommée `TEST_` est créée et supprimée dans le test, sinon documenté comme non couvert) ; il échoue si le statut redevient 200.
Documentation : noter la solution et sa limite éventuelle dans `journal-enchainement.md` et fermer l'entrée correspondante de `deferred-work.md`.

**Never:** Pas de désactivation de `cacheComponents`, pas de pages passées en rendu entièrement dynamique si cela dégrade les performances de toutes les pages sans nécessité, pas de lecture de la base avec la clé de service dans le proxy, pas de modification d'une migration, pas de `npm run dev` pour valider.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Page inconnue | `/fr/zzz`, `/en/zzz/aaa` | 404, page « introuvable » traduite | N/A |
| Hors langue | `/zzz` | 404 | N/A |
| Fiche inconnue | `/fr/cosplays/inexistant` | 404 | N/A |
| Fiche d'une autre famille | un cosplay sous `/accessoires/` | 404 | N/A |
| Page existante | `/fr`, `/fr/cosplays`, `/fr/contact` | 200 | N/A |
| Adresse de l'autre langue | `/en/accessoires` | 308 vers `/en/accessories` | N/A |
| Base indisponible | lecture du proxy en erreur | la fiche suit le chemin normal, jamais un 500 | N/A |

</frozen-after-approval>

## Code Map

- `src/proxy.ts` (session Supabase puis langue ; modèle des réponses), `src/app/[locale]/[...rest]/page.tsx` et `not-found.tsx`, `src/app/[locale]/cosplays/[slug]/page.tsx`, `src/app/[locale]/accessoires/[slug]/page.tsx`, `src/components/fiche/PageFiche.tsx` (`notFound()` actuel), `src/modules/catalogue/queries.ts` (`lireFicheProduit`), `src/i18n/adresses.ts`, `next.config.ts` (redirections, réécritures `/en/accessories`), `src/lib/supabase/public.ts`.
- `playwright.config.ts` (serveur de développement), `.github/workflows/*.yml` (étape de build puis `test:e2e`), `package.json` (scripts), `tests/e2e/*`, `tests/unit/entetes-securite.test.ts`.
- `_bmad-output/implementation-artifacts/deferred-work.md` (entrées « statut HTTP de la 404 » des stories 1.7 et 2.5).

## Tasks & Acceptance

**Execution:**
- [ ] Reproduire le problème sur un build de production (statuts réels) et choisir la solution
- [ ] Appliquer la solution (proxy et/ou pages) sans dégrader les pages existantes
- [ ] Test de statut sur `next start`, script `package.json` et étape du workflow CI
- [ ] Documenter dans le journal, fermer l'entrée de `deferred-work.md`

**Acceptance Criteria:**
- Given un build de production servi par `next start`, when on demande une page inconnue ou la fiche d'un produit inconnu, then la réponse a le statut 404 et affiche la page « introuvable » traduite
- Given les pages existantes et les redirections, then elles gardent leurs statuts (200, 308)
- Given le test de statut, then il échoue si une de ces adresses redevient 200 et il tourne dans la CI
- Given `lint`, `typecheck`, `test`, `build`, then tous passent ; la CI est verte

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Branche du proxy (« non » → 404, « oui »/« incertain » → réponse normale) non testée ; cookies de session sur la réponse réécrite | high | patch | aucun test du proxy sur une adresse de fiche |
| Requête de `ficheExiste` non vérifiée (filtres famille, prix, photo) | medium | patch | réponse simulée sans lire l'URL |
| Script de production : disponibilité sans exiger 200, SIGTERM, corps des 404 trop lâche, cas majuscules/barre finale/accès direct, délais, processus enfants sous Windows | medium | patch | script de test |
| Entrée de la 1.7 fermée à tort dans `deferred-work.md` | low | patch | `/fr/admin` encore 200 |
| Lecture de base à chaque requête de fiche, sans cache | low | rejeté | volontaire : jamais de 404 à un produit tout juste publié |
| Slug de forme inhabituelle refusé sans lecture, version de build obsolète, variables d'environnement de la CI | low | rejeté | slugs produits par l'application ; CI exporte déjà les variables Supabase |
| `/admin/produits/<inconnu>` et `/fr/admin` encore à 200 | medium | defer | vérifier le rôle admin avant rendu risque une fuite d'information ; noté dans `deferred-work.md` |

## Design Notes

Le choix de la solution revient au développeur mais doit être démontré par le test sur le build de production ; la limite connue (l'admin non connecté reçoit déjà une 404 ou une redirection) ne doit pas changer.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur
- `npm run test:e2e:prod` (ou le script retenu) -- statuts de production corrects
- `npm run test:e2e` -- parcours existants verts

**Manual checks:**
- `npm run build && npx next start`, puis `curl -I http://localhost:3000/fr/zzz` : `404`.
