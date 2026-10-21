---
title: 'Story 1.2 : site bilingue et socle SEO'
type: 'feature'
created: '2026-10-21'
status: 'done'
baseline_commit: '3b315160b29641de4c74e58032ad1e27a11510a2'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le site n'a ni routes de langue, ni traductions, ni SEO, ni nom de site configurable : `layout.tsx` fixe `lang="fr"` et écrit « KOMA SHOP » en dur.

**Approach:** next-intl 4.14.9 avec routes `/fr` et `/en` sous `app/[locale]`, redirection de `/` selon cookie puis `Accept-Language`, socle `src/lib/seo/` (metadata, hreflang, JSON-LD, sitemap, robots, 404), table `reglage` portant `nom_site`.

## Boundaries & Constraints

**Always:** Libellés seulement dans `messages/fr.json` et `messages/en.json`. Nom du site lu depuis `reglage.nom_site` (départ « KOMA SHOP »), jamais en dur dans `src/` ni `messages/`. Adresse lue dans `NEXT_PUBLIC_SITE_URL` via `src/lib/env.ts`. Lecture du réglage par le client public mis en cache, étiquette `reglages` (AD-17). Réglage absent : erreur `KS_REGLAGE_MANQUANT`, aucune valeur de repli. `proxy.ts` enchaîne langue et session Supabase. Migration nouvelle, RLS activée, lecture publique de `nom_site` seule, écriture réservée à l'admin, trigger `journal_audit`. Mobile 375 px, un seul H1 par page.

**Never:** Pas de sélecteur de langue ni d'en-tête (story 1.3). Pas de note, avis ni chiffre dans le JSON-LD. Pas de modification de la migration existante. Pas de page admin des réglages. Aucun push vers une autre base que `koma-dev`.

## I/O & Edge-Case Matrix

| Scénario | Entrée | Comportement | Erreur |
|----------|--------|--------------|--------|
| Cookie de langue | `/` avec cookie `en`, `Accept-Language: fr` | redirige vers `/en` | N/A |
| Navigateur français | `/` sans cookie, `fr-CD` | redirige vers `/fr` | N/A |
| Autre langue | `/` sans cookie, `en-US` ou `de` | redirige vers `/en` | N/A |
| En-tête absent ou illisible | `/` sans cookie ni en-tête | redirige vers `/fr` | N/A |
| Cookie invalide | `/` avec cookie `xx` | cookie ignoré, détection par en-tête | N/A |
| URL inconnue | `/fr/zzz`, `/en/zzz` | 404, H1 « Page introuvable » / « Page not found », lien accueil | N/A |
| Clé manquante | clé dans `fr.json` seulement | le test échoue | N/A |

**Décisions de Jonathan (2026-10-21) :** (1) Redirection de `/` : exception à la ligne 462 de l'architecture, notée dans le journal de décisions. (2) Spec gardée entière. (3) En fin d'implémentation, je lance `npm run db:push` sur `koma-dev` seulement : avant, vérifier que le projet lié est `rulkatyetzmsvvmtyzbc` et afficher la liste des migrations envoyées ; jamais de push vers une autre base. (4) L'e2e vérifie redirections, 404, `lang` et hreflang ; le nom du site est couvert par des tests unitaires avec un faux client nommé comme tel (règle 13). (5) `eslint-config-next` figé à 16.4.2, correctif inclus dans le commit de la story.

</frozen-after-approval>

## Code Map

- `src/proxy.ts` -- session Supabase aujourd'hui ; ajouter l'enchaînement next-intl (matcher l.26 : vérifier l'échappement de `\.`).
- `src/app/layout.tsx`, `src/app/page.tsx` -- à déplacer sous `src/app/[locale]/`, `lang` dynamique, nom en dur à retirer.
- `next.config.ts` -- ajouter le plugin next-intl (garder `cacheComponents`).
- `src/lib/env.ts` -- `lireEnvPublique()` fournit `NEXT_PUBLIC_SITE_URL`.
- `src/lib/supabase/public.ts`, `types.ts` -- client public ; types à régénérer après migration.
- `supabase/migrations/` -- une migration existante (ne pas toucher) ; `supabase/tests/` pour les tests SQL.
- `tests/unit/domaine-en-dur.test.ts` -- refuse toute URL https en dur : prévoir l'exception `schema.org`.
- `tests/e2e/accueil.spec.ts` -- `goto("/")` doit suivre la redirection.
- `vitest.config.mts` -- inclut `src/**/*.test.ts` et `tests/unit/**`, pas `.tsx`.
- À créer : `src/i18n/{routing,request}.ts`, `messages/{fr,en}.json`, `src/lib/seo/`, `src/lib/cache/etiquettes.ts`, `src/app/sitemap.ts`, `src/app/robots.ts`, `src/app/[locale]/not-found.tsx`.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- ajouter `next-intl` 4.14.9 exact -- version imposée par l'epic
- [x] `src/i18n/routing.ts`, `src/i18n/request.ts`, `next.config.ts` -- locales `fr`/`en`, défaut `fr`, cookie `NEXT_LOCALE` -- routage de langue
- [x] `src/proxy.ts` -- cookie prioritaire, puis `Accept-Language`, puis `/fr` ; session Supabase conservée -- règle de `/`
- [x] `src/app/[locale]/layout.tsx`, `page.tsx` -- `lang`, `setRequestLocale`, H1 traduit -- pages `/fr` et `/en`
- [x] `messages/fr.json`, `messages/en.json` -- clés pour accueil, 404, métadonnées -- aucun texte en dur
- [x] `supabase/migrations/<horodatage>_creer_reglage.sql`, `supabase/tests/reglage.test.sql` -- table, RLS, trigger, valeur de départ -- source du nom
- [x] `src/lib/reglages.ts`, `src/lib/cache/etiquettes.ts` -- lecture en cache, `KS_REGLAGE_MANQUANT` -- AD-17
- [x] `src/lib/seo/` -- metadata, canonique, hreflang avec `x-default` vers `/fr`, Open Graph, JSON-LD Organization (NATHANGROUP SARL, Goma, RDC) -- SEO
- [x] `src/app/sitemap.ts`, `src/app/robots.ts` -- pages publiques en deux langues ; exclure admin, compte, `/api` -- FR SEO
- [x] `src/app/[locale]/not-found.tsx` -- 404 en deux langues -- URL inconnue
- [x] `eslint.config.mjs` -- règle contre le texte visible en dur -- FR-55
- [x] Tests : `tests/unit/` (détection de langue, 4 cas + cookie invalide ; parité des clés ; nom non écrit en dur dans `src/` et `messages/`), `tests/e2e/` (redirections, H1 unique, 404), `tests/unit/domaine-en-dur.test.ts` (exception `schema.org`)

**Acceptance Criteria:**
- Given `/fr` ou `/en`, when la page s'affiche, then `<html lang>` correspond et les textes viennent des fichiers de traduction.
- Given une page publique, when on lit le `<head>`, then titre et description uniques, canonique, hreflang `fr`, `en`, `x-default` (vers `/fr`) et Open Graph sont construits depuis `NEXT_PUBLIC_SITE_URL`.
- Given le JSON-LD, when on l'inspecte, then il contient le nom issu de `nom_site` et aucune note, avis ni chiffre.
- Given un utilisateur anonyme, when il écrit dans `reglage`, then RLS refuse.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| 404 sans titre ni noindex, clés `nonTrouve` inutilisées | low | patch | `not-found.tsx` sans `generateMetadata` ; clés présentes dans les messages et jamais lues |
| `alternateLinks` par défaut : en-tête Link en doublon, hôte de la requête | low | patch | `routing.ts` ne le désactive pas ; les hreflang viennent déjà des metadata |
| Redirection de `/` sans `Vary` ni `Cache-Control` | low | patch | `proxy.ts` : la réponse dépend du cookie et d'Accept-Language |
| `robots()` et `sitemap()` sans test | medium | patch | aucune assertion sur `/api/`, admin, compte dans `tests/` |
| Regex `g` réutilisée dans `domaine-en-dur.test.ts` | low | patch | `adresse.test()` sur plusieurs fichiers ; seule la liste des fautifs serait incomplète |
| `getClaims()` qui échoue donne une 500 | medium | defer | comportement hérité de la story 1.1, non introduit ici |
| E2E non lancé en CI | medium | defer | `ci.yml` n'a pas de job Playwright ; non demandé par la spec (décision 4) |
| `jsx-no-literals` avec `ignoreProps` laisse passer alt, aria-label | medium | defer | vrai, mais aucun composant n'existe encore ; à traiter en 1.3 |
| Masquage du journal : heuristique par valeur, aucun test SQL du masquage | medium | defer | `journal_audit` sera redéfini en 1.7 ; tests du masquage à y ajouter |
| Cookies de session rafraîchis jamais testés (proxy) | maybe-false | defer | à vérifier avec un vrai test quand l'authentification existe (1.4) |
| `next-intl` embarque `@swc/core` et `@parcel/watcher` (scripts d'installation) | maybe-false | defer | à vérifier : `npm ci` et build sur Hostinger Node 24 |
| `nom_site` absent fait tomber toutes les pages, sans `error.tsx` | low | defer | voulu par la spec (`KS_REGLAGE_MANQUANT`, pas de repli) ; page d'erreur à prévoir plus tard |
| Build et CI ont besoin de la base | false | rejeté | `ci.yml` démarre `supabase start` et injecte les variables ; la migration insère `nom_site` |
| Décision 5 (`eslint-config-next` 16.4.2) absente du diff | false | rejeté | déjà figé à 16.4.2 dans `HEAD` ; rien à changer |
| 404 hors `/fr` et `/en` non traduite | low | rejeté | la spec ne demande que `/fr/*` et `/en/*` |
| robots : préfixe `/fr/compte` bloque `/fr/compte-rendu` | low | rejeté | page hypothétique ; la variante avec barre finale laisserait `/fr/compte` indexable |
| `url.ts` sans barre initiale ou avec chemin dans l'adresse | low | rejeté | appelants internes seulement ; l'adresse est validée par `env.ts` |
| Insertion sans `on conflict` dans la migration | low | rejeté | migration exécutée une seule fois sur une table neuve |
| `og:image`, carte Twitter, `logo`, `sameAs` absents | low | rejeté | hors périmètre de la spec ; aucune image officielle (règle 6) |
| Titre en double si le nom y figure | low | rejeté | aucun titre actuel ne le contient |

## Design Notes

La redirection de `/` est l'exception décidée le 2026-10-21 à la ligne « aucune redirection forcée des pages publiques » de l'architecture (l.462) : à noter dans le journal de décisions. Le sélecteur (story 1.3) écrira le cookie ; la 1.2 ne fait que le lire.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- expected: sans erreur
- `npm run test:e2e` -- expected: sans erreur (redirections, 404, lang, hreflang)
- `npm run test:sql` -- exécuté par la CI (pas de Docker en local)
