# Notes Voie 3 — Contenu & Blog

## Story 8.6 : Écrire et publier un Article (Blog)

### Implémentation réalisée
- **Dépendances de rendu** : `react-markdown` (10.1.0), `remark-gfm` (4.0.1), `rehype-sanitize` (6.0.0), versions figées sans `^`/`~`. Licences MIT notées dans `docs/licences/markdown.md`. `rehype-raw` n'est jamais utilisé.
- **Rendu Markdown** : `src/components/blog/ContenuArticle.tsx` (client), schéma `defaultSchema` + protocoles `href`/`src` limités à `http`/`https` ; seuls les liens internes commençant par `/` (pas `//`) sont acceptés ; une image sans texte alternatif n'est pas affichée ; les liens externes portent `rel="noopener noreferrer"`. Même composant pour l'aperçu admin et les pages publiques de 8.7.
- **Migrations SQL** :
  - `supabase/migrations/20261125120000_article.sql` : table `article`, RLS (lecture publique des seuls articles publiés), fonctions `enregistrer_article`, `publier_article`, `depublier_article`, triggers de journalisation et de `modifie_le`.
  - `supabase/migrations/20261125130000_article_slug_obligatoire.sql` (correctif) : index unique sur `slug`, adresse vide refusée explicitement (`KS_SLUG_INVALIDE`), adresse déjà prise refusée (`KS_SLUG_PRIS`). La fonction est remplacée à partir de sa dernière version, conformément à AD-1.
- **Module TS** : `src/modules/blog/{types,schemas,queries,dependances,service,actions}.ts`.
  - Validation Zod, conversion camelCase → snake_case dans le service (la fonction Postgres attend des clés snake_case).
  - Adresse facultative à la saisie : vide, elle est déduite du titre français avec `proposerSlug` (même règle que les Produits) ; un titre sans lettre latine donne `slug_invalide`.
  - Images : chemin imposé `articles/<uuid>.<ext>`, envoi TUS vers `galerie-attente`, contrôle du contenu réel et nettoyage des métadonnées par `nettoyerPhoto`, copie dans `produits-public` (même bucket que les photos produit, aucune politique Storage nouvelle). Les fichiers publics retirés du formulaire ne sont effacés qu'**après** la sauvegarde réussie de l'article.
- **Admin** : `/admin/blog` (liste), `/admin/blog/nouveau`, `/admin/blog/[id]` (édition, images, publication), entrée « Blog » dans la navigation admin. Les images ne sont ajoutables qu'après la première sauvegarde : `/admin/blog/nouveau` redirige vers la fiche d'édition (`?cree=1`).
- **Messages** : `Admin.blog.*` et `Admin.nav.blog` ajoutés dans `messages/fr.json` et `messages/en.json`.
- **Tests** :
  - `tests/unit/blog-markdown.test.tsx` (7 tests) : HTML brut, scripts, `javascript:` et `data:` neutralisés, liens externes sûrs.
  - `tests/unit/blog-service.test.ts` (33 tests) et `tests/unit/blog-admin-ui.test.tsx` (6 tests).
  - `tests/doubles/TEST_dependances-blog.ts` : faux serveur de test nommé `TEST_`, jamais importé par `src/`.
  - `supabase/tests/article.test.sql` (54 assertions pgTAP) : RLS, privilèges, droits, validations, adresse unique, publication incomplète, journal, dépublication. Écrit ici, exécuté par la CI.

### Points de décision et écarts assumés
- **Droit** : le TypeScript vérifie `blog.gerer` (droit ouvert à l'Assistant dans la matrice), mais les fonctions SQL appellent `exiger_admin` : en base, seul l'Admin écrit. Écart assumé, cohérent avec les autres fonctions d'écriture ; à trancher si l'Assistant doit réellement gérer le blog.
- **Liens Événements** : le module Événements n'existe pas encore (epic 7). Seul le lien vers un Produit est exposé dans le formulaire ; le lien vers un Événement est reporté à l'epic 7.
- **Pages publiques** : `/fr/blog`, `/en/blog` et `/fr|en/blog/[slug]` ont été réalisées par la story 8.7 (voir plus bas).
- **Orphelins du bucket** : si l'enregistrement d'un article échoue après l'envoi d'images, les fichiers publics déjà copiés ne sont pas référencés et ne sont pas supprimés par cette story (aucune tâche de purge des orphelins de `produits-public` n'existe). Le bucket d'attente, lui, est purgé par la tâche existante.
- **`db:push`** : non exécuté (interdit). `src/lib/supabase/types.ts` n'est pas régénéré ; `article` et les fonctions blog sont lues via des types locaux dans `queries.ts` et un cast `AppelRpc` dans `dependances.ts`, sans jamais modifier les types générés.
- **`npm run test:sql`** : ne tourne pas en local faute de Docker (le script l'explique et sort sans erreur) ; les tests pgTAP passent par GitHub Actions.

### État des vérifications
- `npm run lint` : vert (0 erreur, 0 avertissement).
- `npm run typecheck` : vert.
- `npm run build` : vert.
- `npm test` (suite complète) : 8 échecs **préexistants** dans 4 fichiers (`commande-ui`, `panier-ui`, `vitrine-composants`, `lint-texte-en-dur`), hérités de `main` et constatés dès le commit `421ae92`. `catalogue-ui` et `obtention-kit-ui` échouent seulement sous la charge de la suite complète (délais) et passent seuls. Tous les tests 8.6 passent.
- `tests/unit/coque-admin.test.tsx` a été mis à jour pour la nouvelle entrée « Blog » de la navigation admin.

### Décisions de licence
- `react-markdown`, `remark-gfm`, `rehype-sanitize` : MIT, licences et versions figées notées dans `docs/licences/markdown.md` (règle 6).

## Story 8.7 : Blog public

### Implémentation réalisée
- **Lecture publique** (`src/modules/blog/{types,adresse,texte,existence,voir-plus,queries}.ts`) :
  - `listerArticlesPublies` : 12 par page, tri `publie_le desc, id desc`, curseur opaque `[publie_le, id, n]` en base64url ; `cumul` pour la page à curseur, clé de tri seule pour la Server Action. Filtres de version anglaise posés **en base** (titre **et** texte non nuls, non vides, sans `[Texte à fournir]`).
  - `lireDerniersArticles` (bloc 7), `lireArticlePublie` (article + Produit lié), `lireProduitLie`, `lireSlugsArticlesPublies` (plan du site), `lireSlugsSansVersionAnglaise` (sélecteur de langue).
  - Cache `"use cache"` + `cacheTag(ETIQUETTES.articles)` ; le Produit lié ajoute `catalogue` (un renommage de Produit met le lien à jour). Jamais de client service pour la lecture publique.
  - `chargerPlusArticles` (Server Action) revalide le curseur et la langue ; un curseur illisible rend `ok: false`.
- **Pages** : `/fr|en/blog` (H1, cartes, « Voir plus », état vide, erreur sobre) et `/fr|en/blog/[slug]` (`instant = false` pour une vraie 404, `cache(lireArticlePublie)` partagé entre métadonnées et page).
- **Rendu** : `CarteArticle` (vignette 4/3 `next/image` si image, sinon carte sans vignette), `ListeArticles` (client, ajout par 12, `replaceState`, focus sur la première carte ajoutée), `ArticleComplet` (fil d'Ariane, JSON-LD `Article` + `BreadcrumbList`, date, `ContenuArticle`, galerie `loading="lazy"`, lien Produit dont le nom accessible est son titre), `BlocGuides` (3 derniers, masqué sans Article).
- **Métadonnées** : `Metadata.blog.*` (descriptions fournies le 2026-11-02) ; `/blog` indexable avec canonique ; page à curseur `noindex, follow` **sans canonique**. Article : description extraite du Markdown, première image en Open Graph (aucune image si l'Article n'en a pas), `hreflang` limité aux versions réellement servies.
- **Navigation** : « Blog » après « Kits » dans `rubriques.ts` (en-tête et menu ☰) ; `SelecteurLangue` reçoit `sansTraduction` et mène à `/en/blog` depuis un Article FR sans version anglaise.
- **Plan du site** : `/blog` dans les deux langues ; Article FR toujours, entrée EN seulement si la version anglaise existe ; erreur de lecture journalisée sans vider le reste du plan.
- **Aucune migration.** Aucun changement de `src/lib/supabase/types.ts`, de `.env*`, de `sprint-status.yaml` ni de `journal-enchainement.md`.

### Points de décision et écarts assumés
- **Divergence avec la spec 8.7 (`Design Notes`, ligne « l'emplacement `guides` numéro 5 est supprimé »)** : l'emplacement `guides` nº 5 **reste** `reserve`, et seul `bloc7` passe de `reserve` à `affiche`. Objectif : limiter le conflit avec la voie 2, qui touche aussi `src/modules/accueil/blocs.ts`. Le résultat visible est conforme à FR-2 (Guides au bloc 7). À trancher lors de l'intégration.
- **Conflit probable avec la voie 2 sur `src/modules/accueil/blocs.ts`** : voie 3 n'y a fait que deux changements d'une ligne (type `bloc7` + entrée `BLOCS_ACCUEIL`), sans réordonner ni toucher `guides`. Attendre un conflit de fusion à cet endroit.
- **`src/proxy.ts`** : ajout minimal, sans réorganiser l'authentification. La branche Article est évaluée **avant** la branche fiche, avec la même règle : `non` → réécriture `/<langue>/introuvable` en 404 ; `oui`/`incertain` → chemin normal. Une base muette laisse donc le chemin normal décider, comme pour les fiches.
- **Robustesse au build (Cache Components)** : la lecture des adresses d'Articles pour le sélecteur ne doit pas faire tomber le build si la base ou la table `article` n'est pas disponible. `lireSlugsArticlesPubliesOuNull` (en cache) journalise et rend `null` au lieu de jeter ; `lireSlugsSansVersionAnglaise` rend `[]` (sélecteur inchangé) et `lireSlugsArticlesPublies` relance l'erreur hors cache pour que le plan du site la journalise. Écart assumé par rapport à « une erreur est relancée » : aucune donnée n'est inventée, et un build sans base reste possible.
- **`/blog` et `searchParams`** : comme les catalogues, la page garde un titre fixe prérendu et met la liste (qui dépend de `?curseur=`) derrière un `Suspense`.
- **`ContenuArticle` (correction après revue)** : les titres saisis dans le texte sont décalés d'un cran (`#` → `<h2>`, `##` → `<h3>` … `#####` → `<h6>`), `h6` restant `h6`. La page ne garde donc qu'un seul H1, celui du titre de l'Article ; l'aperçu admin emprunte le même rendu et suit la même règle. Test : `blog-markdown` (séquence h2 → h6, aucun h1) et `blog-public-page` (un `#` dans le corps ne crée pas de second H1).
- **Texte du bloc 7** : « GUIDES » (FR et EN), en majuscules sans accent, cohérent avec les autres titres de blocs. Les autres textes visibles sont ceux déjà approuvés (liste dans la spec).

### Tests ajoutés ou mis à jour
- Ajoutés : `blog-adresse` (curseur et adresses), `blog-queries` (filtres EN, cumul, carte, article, Produit lié, plan du site), `blog-public-page` (liste, état vide, « Voir plus », métadonnées, Article, 404, erreurs), `blog-voir-plus-ui` (focus, `replaceState`, erreurs, Ctrl), `blog-accueil` (bloc 7), `proxy-article-404` (404 avant le flux, `incertain`).
- Mis à jour : `robots-sitemap` (entrées `/blog` et Articles FR/EN filtrés), `selecteur-langue-requete` (`sansTraduction`), `accueil-blocs` (bloc 7 affiché, emplacement 5 toujours réservé), `jsonld-vitrine` (`articleJsonLd`), `adresses-langues` (mock du module blog pour le plan du site), `blog-markdown` (décalage des titres, aucun H1 dans le corps).

### État des vérifications
- `npm run lint` : vert.
- `npm run typecheck` : vert.
- `npm run build` : vert (les lectures d'Articles indisponibles à la construction sont journalisées, le build continue).
- `npm test` : **1637 tests verts, 127 fichiers** au dernier passage complet.
- **Échecs préexistants constatés plus tôt dans ce worktree** (environnement, pas 8.7) : `commande-ui` et `panier-ui` (faux `SUPABASE_SECRET_KEY` / dépendances de test), `vitrine-composants`, `lint-texte-en-dur` ; `catalogue-ui` et `obtention-kit-ui` échouent seulement sous la charge parallèle et passent seuls. Ces fichiers n'ont pas été modifiés par 8.7 ; Claude Code doit confirmer leur état sur `main`.
- `npm run test:sql` : non exécuté en local (pas de Docker) ; pgTAP en CI.
- Aucun `git push`, `git merge`, `git rebase` ni `npm run db:push`.

VOIE 3 PRÊTE POUR INTÉGRATION (8.6 + 8.7)
