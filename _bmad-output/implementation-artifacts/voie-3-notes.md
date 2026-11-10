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

## Story 9.1 : Créer un Code promo

### Implémentation réalisée
- **Migration** : `supabase/migrations/20261230100000_code_promo.sql`. L'horodatage `20261210100000` proposé au plan était déjà pris par l'epic 6 ; la dernière migration de `origin/main` est `20261215100000_reclamation.sql`, d'où `20261230100000`. Aucune migration existante n'a été modifiée.
- **Table `code_promo`** : `code` (unique, normalisé en majuscules, 3 à 24 caractères `A-Z 0-9 - _`), `affilie` (1 à 120), `reduction_pct` et `commission_pct` (`numeric(5,2)`, bornes 0/100), `plafond` (entier, défaut 50, 1 à 100 000), `actif`, `cree_le`, `modifie_le`. **Aucune colonne compteur** (AD-29). RLS active, aucun droit direct pour `public`, `anon`, `authenticated` ; déclencheur `journaliser('id')`.
- **Fonctions** (`security definer`, `search_path` vide, auteur en premier, `exiger_admin` puis `set_config('ks.auteur', …)`, `service_role` seul) :
  - `creer_code_promo(p_auteur, p_code, p_affilie, p_reduction_pct, p_commission_pct, p_plafond, p_actif)` : normalise le code et l'Affilié, applique le plafond 50 si absent, refuse plus de deux décimales plutôt que d'arrondir.
  - `modifier_code_promo(p_auteur, p_id, p_affilie, p_reduction_pct, p_commission_pct, p_plafond, p_actif)` : **le code n'est jamais modifiable** ; plafond absent refusé.
  - Codes d'erreur : `KS_CODE_INVALIDE`, `KS_CODE_EXISTANT`, `KS_AFFILIE_INVALIDE`, `KS_REDUCTION_INVALIDE`, `KS_COMMISSION_INVALIDE`, `KS_PLAFOND_INVALIDE`, `KS_CODE_PROMO_INTROUVABLE`.
- **Module** : `src/modules/promo/{types,codes,queries,dependances,actions}.ts`. Validation pure dans `codes.ts`, normalisation de la casse, virgule décimale acceptée, refus du droit avant toute écriture, erreurs de base traduites en codes du module.
- **Admin** : page `/fr|en/admin/codes-promo` (`exigerAdminPage(…, "codes_promo.gerer")`, lecture par le client service), formulaire de création, liste triée par code croissant avec modification en ligne (code affiché en lecture seule), entrée « Codes promo » dans la navigation admin (ordre d'EXPERIENCE.md, après Blog).
- **Types** : `code_promo` et les deux fonctions sont absentes de `src/lib/supabase/types.ts` (fichier interdit). Un client structurel local est utilisé dans `queries.ts` et `dependances.ts`, comme pour les tables récentes ; aucun type généré n'a été modifié.
- **Messages** : `Admin.codesPromo.*` et `Admin.nav.codesPromo` ajoutés en parité FR/EN. Les libellés validés par Jonathan sont en place ; **les phrases d'aide, d'erreur, d'introduction, d'état vide et de succès restent `[Texte à fournir]`** jusqu'à validation (propositions ci-dessous).
- **Fichiers interdits** : `sprint-status.yaml`, `journal-enchainement.md`, `src/lib/supabase/types.ts`, `CLAUDE.md` et `.env*` inchangés. Aucun `git push`, `merge`, `rebase` ni `npm run db:push`.

### Points de décision et écarts assumés
- **Création + modification** : la modification existe dès 9.1, le code restant immuable (FR-46, « chaque création ou modification est journalisée »).
- **Pourcentages** : `numeric(5,2)`, réduction strictement positive et ≤ 100, commission de 0 à 100, deux décimales au plus.
- **Plafond** : 1 à 100 000 ; vide vaut 50 à la création seulement, refusé à la modification.
- **Tri** : par code croissant.
- **Portée** : aucune modification de `creer_commande`, du Panier, de la Commande ou du calcul de réduction (story 9.2).

### Phrases d'aide et d'erreur proposées (à valider)
Tant qu'elles ne sont pas validées, les clés correspondantes de `messages/fr.json` et `messages/en.json` valent `[Texte à fournir]`.

| Clé | Proposition FR | Proposition EN |
|---|---|---|
| `intro` | Crée un code pour chaque influenceur, avec sa réduction, sa commission et son plafond d'utilisations. Le code ne peut plus être changé après la création. | Create one code per influencer, with its discount, commission rate and usage limit. The code cannot be changed after creation. |
| `vide` | Aucun Code promo pour le moment. | No promo code yet. |
| `erreurLecture` | Les codes promo n'ont pas pu être chargés. Réessaie dans un instant. | Promo codes could not be loaded. Try again in a moment. |
| `aides.code` | De 3 à 24 caractères : lettres sans accent, chiffres, tiret ou souligné. Il n'est pas modifiable ensuite. | 3 to 24 characters: unaccented letters, digits, hyphen or underscore. It cannot be changed later. |
| `aides.plafond` | Nombre maximal d'utilisations. Vide, il vaut 50. | Maximum number of uses. Empty means 50. |
| `succes.creation` | Le Code promo est créé. | The promo code is created. |
| `succes.modification` | Le Code promo est modifié. | The promo code is updated. |
| `erreurs.non_autorise` | Tu n'as plus le droit de gérer les codes promo. Recharge la page ou reconnecte-toi. | You can no longer manage promo codes. Reload the page or sign in again. |
| `erreurs.code_invalide` | Le code doit avoir de 3 à 24 caractères : lettres sans accent, chiffres, tiret ou souligné. | The code must be 3 to 24 characters: unaccented letters, digits, hyphen or underscore. |
| `erreurs.code_existant` | Ce code existe déjà, même écrit en minuscules. Choisis-en un autre. | This code already exists, even in lowercase. Choose another one. |
| `erreurs.affilie_invalide` | Le nom de l'Affilié doit avoir de 1 à 120 caractères. | The affiliate name must be 1 to 120 characters long. |
| `erreurs.reduction_invalide` | La réduction doit être un pourcentage supérieur à 0 et inférieur ou égal à 100, avec deux décimales au plus. | The discount must be a percentage above 0 and at most 100, with two decimals at most. |
| `erreurs.commission_invalide` | Le taux de commission doit être un pourcentage entre 0 et 100, avec deux décimales au plus. | The commission rate must be a percentage between 0 and 100, with two decimals at most. |
| `erreurs.plafond_invalide` | Le plafond doit être un nombre entier entre 1 et 100 000. | The usage limit must be a whole number between 1 and 100,000. |
| `erreurs.introuvable` | Ce Code promo n'existe plus. La liste a été actualisée. | This promo code no longer exists. The list has been refreshed. |
| `erreurs.generique` | Le changement n'a pas pu être enregistré. Réessaie. | The change could not be saved. Try again. |

### Tests
- `tests/unit/promo-codes.test.ts` (20 tests) : normalisation et format du code, virgule décimale, bornes et décimales des pourcentages, plafond, Affilié, droit refusé, mapping des erreurs de base, identifiant invalide, exception générique sans donnée dans le journal.
- `tests/unit/promo-admin-ui.test.tsx` (10 tests) : champs et libellés, envoi de la saisie brute puis vidage, erreur reliée au champ `Code` (`aria-invalid`, `aria-describedby`), message général, succès après réponse serveur, liste et états Actif/Inactif, modification préremplie avec code en lecture seule, fermeture par « Annuler », état vide.
- `tests/unit/coque-admin.test.tsx` : navigation mise à jour avec « Codes promo » et `/admin/codes-promo`.
- `supabase/tests/code_promo.test.sql` (36 assertions pgTAP) : RLS, privilèges, aucune colonne compteur, droits admin, validations, unicité insensible à la casse, plafond par défaut, création et modification journalisées, code inchangé, code inconnu. Écrit ici, exécuté en CI.

### État des vérifications
- `npm run lint` : vert (0 erreur, 0 avertissement).
- `npm run typecheck` : vert.
- `npm test` (suite complète) : **2 095 tests verts, 160 fichiers**.
- `npm run build` : **bloqué par l'environnement**, pas par la 9.1. La compilation TypeScript passe ; le prérendu de `/fr/a-propos` échoue sur `Lecture des Prestataires impossible` parce que la clé de service de `.env.local` est refusée. Vérifié directement : `GET /rest/v1/prestataire` répond **401 « Invalid API key »**. `.env*` est interdit et n'a pas été modifié. Aucune page de la 9.1 n'est prérendue (admin dynamique).
- `npm run test:sql` : sort proprement en local (Docker absent) ; pgTAP en CI.
- Aucun `git push`, `git merge`, `git rebase` ni `npm run db:push`.

VOIE 3 PRÊTE POUR INTÉGRATION (9.1)


## Story 9.1 : intégration (revue croisée)

- Revue Blind Hunter, Edge Case Hunter et Verification Gap faite par Claude Code ; correctifs dans `20261230110000_code_promo_correctifs_revue.sql` (caractères de contrôle refusés pour l'Affilié, code immuable en base par déclencheur, modification sans changement non écrite ni journalisée) et dans le module `promo` (validation de type à l'exécution, droit vérifié avant la validation, panne distinguée d'un refus, code testé avant la mise en majuscules).
- Les 16 textes FR/EN sont appliqués (`Admin.codesPromo`), corrigés pour la cohérence (« Code promo », impératif, « Laisse vide pour 50 » en création seulement).
- **À traiter en 9.2** : la modification d'un taux n'est pas figée sur les Commandes ; la Commande devra copier le code, le taux de réduction et le taux de commission au moment du paiement, sinon les commissions passées seraient recalculées au taux actuel. Prévoir aussi le comportement quand les utilisations dépassent un plafond réduit.

## Story 9.7 : Mesure d'audience maison

### Implémentation réalisée

- **Décision** : Umami est abandonné (essai non commité, spec réécrite). La mesure est **maison**, conforme à `epics.md` 9.7 et AD-19 : aucun script tiers, aucune modification de la CSP, aucun cookie.
- **Migration** `supabase/migrations/20270101100000_mesure.sql` (dernière de `origin/main` : `20261231210000_emails_cibles_correctifs.sql`). Aucune migration existante modifiée.
  - Table `evenement_mesure` : `action` (liste fermée de 10 valeurs, `check`), `page` (1 à 200, commence par `/`, sans `?`, `#`, espace, caractère de contrôle ni `//`), `origine` (`^[a-z0-9_-]{1,40}$`, même forme que `commande.origine`), `referent_domaine` (`^[a-z0-9.-]{1,100}$`), `langue`, `appareil`, `session_id uuid`, `duree_ms` (0 à 60 000, uniquement pour `chargement_heros`), `cree_le`. Index `(cree_le)` et `(action, cree_le)`.
  - RLS active, **aucune politique**, `revoke all` pour `public`, `anon`, `authenticated`. Écriture par la seule fonction `enregistrer_evenement_mesure(p_auteur jsonb, …)` (`security definer`, `search_path` vide, `AUTEUR_VISITEUR`, `service_role` seul).
  - **Pas de déclencheur de journal** : ce n'est pas une table métier (aucun état, aucun droit admin, aucune donnée personnelle) et journaliser chaque vue de page noierait `journal_audit`. Divergence assumée avec AD-21, actée au plan.
  - Contrainte `evenement_mesure_compte` : les quatre actions privées exigent `page = '/compte'` ; la page `/compte` n'accepte que ces quatre actions et `kit_gratuit_recupere`.
  - Huit vues `security_invoker` (`service_role` seule) : `vue_visites_jour`, `vue_origines_jour`, `vue_entonnoir_jour` (comptes agrégés par jour et par étape, **sans jointure** session ↔ Commande), `vue_paiements_jour`, `vue_ventes_code_promo`, `vue_ventes_origine`, `vue_deuxiemes_achats`, `vue_desinscriptions_jour`. `vue_ventes_code_promo` suit la même règle que `commission_code_promo` (9.3) : seules les Commandes avec `paye_le` comptent.
- **Module** `src/modules/mesure/{actions,types,chemins,schemas,service,dependances,client}.ts`.
  - Liste fermée d'actions côté TypeScript, identique au `check` SQL.
  - Règles pures dans `chemins.ts` : chemin sans requête, retrait du préfixe de langue, exclusions par segment entier, dérogation `/compte`, origine normalisée, référent réduit au domaine, appareil déduit de la largeur seulement.
  - Service : Zod `.strict()` (aucun champ inconnu, **aucun champ `page`** envoyé par le client), chemin recalculé depuis le `Referer` (même origine seulement), limitation `consommer_essai` par session (300/h) puis par HMAC d'IP (1 200/h).
- **Route** `src/app/api/mesure/route.ts` : POST seulement, `application/json` exigé, corps ≤ 1 024 octets, `connection()`, `Cache-Control: no-store`, codes 204 / 400 / 413 / 415 / 500, aucune réponse détaillée.
- **Client** : `EnvoiMesure` monté une fois dans le layout des langues (prépare la session et l'origine, délègue les clics `data-mesure`), `MesureVueFiche` sur les fiches Produit et Kit. `sessionStorage` (repli mémoire), `fetch` `keepalive`, aucune requête en cas d'échec affichable.
- **Actions instrumentées** : `clic_heros` (boutons du héros), `chargement_heros` (durée réelle jusqu'au premier média prêt), `vue_fiche` (une fois par onglet et par page), `ajout_panier` (après succès serveur), `partage_fiche` (partage ou copie réussis), `kit_gratuit_recupere` (après succès serveur), `photo_envoyee` / `realisation_envoyee` (après finalisation réussie), `video_kit_demarree` / `video_kit_terminee`.
- **Types** : `evenement_mesure` et la fonction sont absentes de `src/lib/supabase/types.ts` (fichier interdit) ; client structurel local dans `dependances.ts`, comme `promo`.

### Points de décision et écarts assumés

- **Durée du héros** : colonne `duree_ms` ajoutée sur accord de Jonathan (2026-11-10), réservée à `chargement_heros`. Mesure du début de navigation au premier média prêt (`performance.now()`, bornée à 60 s) ; aucun héros sans média n'émet d'événement.
- **Empreinte d'IP** : HMAC dans `limite_essai` seulement (modèle du contact), jamais dans `evenement_mesure`, jamais en clair, jamais journalisée. Si le HMAC est indisponible (pas d'en-tête d'adresse), seule la limite par session s'applique.
- **Dérogation `/compte`** : liste fermée `photo_envoyee`, `realisation_envoyee`, `kit_gratuit_recupere`, `video_kit_demarree`, `video_kit_terminee`. La page enregistrée est toujours `/compte` (jamais le sous-chemin), aucune donnée de Compte, de Kit ni de Commande. Toute autre action venue de `/compte` est refusée côté client **et** côté serveur. `kit_gratuit_recupere` reste mesurable depuis une fiche publique, avec le chemin de la fiche.
- **Referer** : le chemin ne vient **jamais** du corps. Referer absent, illisible ou d'une autre origine → 204 sans écriture (décision de Jonathan du 2026-11-10). Conséquence : un navigateur qui supprime le Referer même en interne ne produit aucune mesure ; c'est préféré à un chemin fourni par le client.
- **Actions non mesurées, hors périmètre** (impossibles sans toucher à l'authentification, aux commandes ou aux paiements, ou sans l'epic 7) : création de Compte à l'étape de paiement et abandon à cette étape (voie 1) ; inscription à une Alerte événement et Pass vendus (aucune table `alerte` ni `pass`) ; livraisons en retard (aucun délai promis n'est stocké : SM-C1 reste à définir). À traiter dans une story ultérieure.
- **Origine et Code promo** : l'origine d'un achat par Code promo est calculée par `vue_ventes_code_promo` (tables métier), pas par un événement. L'événement retient seulement la valeur d'un paramètre `origine` ou `utm_source`.
- **Aucun écran** : la story 9.7 ne publie rien ; le tableau de bord qui consomme les vues est la 9.8.
- **Pas de purge planifiée** de `evenement_mesure` au lancement, comme `limite_essai`. À décider avec la 9.8 ou 9.9 si le volume le demande.

### Phrase de confidentialité proposée (à valider — non appliquée)

Aucun texte visible n'a été ajouté. Proposition, à placer dans la page de confidentialité si Jonathan la valide :

- FR : « La boutique mesure l'audience sans cookie et sans traceur : seuls le nom de l'action, la page, l'origine de la visite, la langue, le type d'appareil et un identifiant de session aléatoire (effacé à la fermeture de l'onglet) sont conservés. Ni votre adresse IP, ni votre adresse email, ni votre Compte, ni vos numéros de commande ne sont enregistrés. »
- EN : « The shop measures traffic without cookies or trackers: only the action name, the page, the visit source, the language, the device type and a random session identifier (cleared when the tab closes) are kept. Your IP address, email address, account and order numbers are never recorded. »

### Tests

- `tests/unit/mesure-chemins.test.ts` (14 tests) : normalisation du chemin, préfixe de langue, exclusions par segment (`/administration`, `/comptes`, `/commandes` mesurés), dérogation `/compte`, `Referer` (absent, autre origine, requête retirée), origine, référent, appareil, liste fermée.
- `tests/unit/mesure-service.test.ts` (9 tests) : chemin tiré du `Referer`, aucun `page` accepté du client, refus des champs inconnus (email, durée mal placée), rien sans `Referer`, pages exclues, dérogation `/compte`, limites session puis IP, panne.
- `tests/unit/mesure-route.test.ts` (11 tests) : 204, `no-store`, aucune chaîne de requête enregistrée, `Referer` absent ou étranger, page exclue, `/compte`, 400 / 413 / 415 / 500, pas de GET.
- `tests/unit/mesure-client.test.ts` (9 tests, jsdom) : session aléatoire unique, origine sans requête, référent réduit, aucun envoi depuis les pages exclues, actions `/compte` acceptées et les autres refusées, durée bornée, échec silencieux.
- `supabase/tests/mesure.test.sql` (30 assertions pgTAP) : droits `anon`/`authenticated` (lecture et écriture directes refusées), fonction réservée à `service_role`, écriture valide, contraintes (action, page, `/compte`, durée, auteur, origine, référent, langue, appareil, session), vues fermées et lisibles par le serveur. Exécuté en CI.

### État des vérifications

- `npm run lint` : vert (0 erreur, 0 avertissement).
- `npm run typecheck` : vert.
- `npm test` : **2 348 tests verts, 184 fichiers**.
- `npm run build` : **bloqué par l'environnement**, pas par la 9.7. La compilation passe et la route est bien produite (`.next/routes-manifest.json` contient `^/api/mesure(?:/)?$`) ; le prérendu de `/fr/[...rest]` échoue sur `Lecture des Prestataires impossible`, car la clé de service de `.env.local` est refusée. Vérifié directement : `GET /rest/v1/prestataire` répond **401**. `.env*` interdit et non modifié.
- `npm run test:sql` : sort proprement en local (Docker absent) ; le pgTAP tourne en CI.
- Aucun `git push`, `git merge`, `git rebase` ni `npm run db:push`. Aucune écriture dans Supabase.

VOIE 3 PRÊTE POUR INTÉGRATION (9.7)
