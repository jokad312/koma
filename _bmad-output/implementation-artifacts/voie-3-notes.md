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
- **Pages publiques** : `/fr/blog`, `/en/blog` et `/fr/blog/[slug]` appartiennent à la story 8.7, non commencées ici.
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
