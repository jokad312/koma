---
title: 'Story 2.1 : univers et création d''un produit physique'
type: 'feature'
created: '2026-10-22'
status: 'done'
baseline_commit: 'f6cd381de9d6b6ee73af220abedf96afb6f90392'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le catalogue n'existe pas : aucune table d'univers, de produit ni de variante, aucun écran pour les créer, et la question « Quel univers préfères-tu ? » promise à l'étape « questions » de `/connexion` (1.6) manque.

**Approach:** Module `catalogue` : tables `univers`, `produit`, `variante` (RLS en lecture publique des seuls produits publiés), fonctions d'écriture `SECURITY DEFINER` journalisées (univers, produit avec ses variantes et leur stock), admin `/admin/univers` et `/admin/produits` (liste en cartes ou tableau, formulaire de création et d'édition d'un brouillon), prix en centimes USD via `src/lib/argent.ts`, et question « univers » ajoutée aux questions d'accueil par une nouvelle migration.

## Boundaries & Constraints

**Always:** Nouvelles migrations seulement. Toute fonction d'écriture : `SECURITY DEFINER`, `search_path = ''`, `p_auteur jsonb` en premier, `REVOKE` à `public/anon/authenticated`, `GRANT` à `service_role`, `exiger_admin(p_auteur)` (1.7), `ks.auteur` posé avant le DML, triggers `journaliser('id')` sur les trois tables. `anon` et `authenticated` : `SELECT` seulement ; produit et variante visibles seulement si `publie_le` non nul et `<= now()` (la variante suit son produit), univers visibles ; aucune colonne `prive`, `chemin` ou `note_admin`. Droit `produits.modifier` (Admin seul, matrice inchangée) vérifié par `exigerDroit` dans chaque action et `exigerAdminPage` dans chaque page, `noindex`. Contenus `*_fr` et `*_en`. Aucun univers, produit ni prix créé par défaut (E-29, règle 15) ; aucune donnée d'exemple.
`univers(id, nom_fr, nom_en, cree_le)` : noms de 1 à 60 caractères, uniques sans tenir compte de la casse par langue (`KS_UNIVERS_EXISTE`) ; création seulement (ni renommage ni suppression). Univers « publié » = existant : l'étape « questions » propose la question dès qu'il en existe un, avec les noms dans la langue de la route.
`produit` : `famille` dans `cosplay|accessoire` (`kit` : epic 3 ; autre valeur : `KS_FAMILLE_INVALIDE`), `slug` unique (`^[a-z0-9]+(-[a-z0-9]+)*$`, 1 à 80, `KS_SLUG_PRIS`), `titre_fr` obligatoire (1 à 120), `titre_en`, `description_fr`, `description_en`, `univers_id`, `prix_cents` (entier > 0 et ≤ 1 000 000), `devise` `USD` (check), `delai_fabrication_jours` du produit (1 à 365), `publie_le` (toujours vide ici), dates. Un brouillon peut être incomplet : la publication stricte (prix, textes, photo, variante) est la 2.2. Prix saisi en USD décimal (point ou virgule, deux décimales au plus), converti en centimes par `src/lib/argent.ts` (nouveau, AD-8) qui seul formate l'affichage (`fr-FR`, `en-US`), « Prix à fixer » si absent. Slug proposé depuis le titre FR (minuscules, sans accent, tirets), recalculé à la saisie tant que le champ n'a pas été modifié à la main ; en cas de conflit, erreur sous le champ avec la première adresse libre proposée ; modifiable.
`variante(produit_id on delete cascade, taille, stock, fabrication_sur_commande, delai_fabrication_jours)` : taille parmi XS, S, M, L, XL, XXL et `sur_mesure` (cosplay seulement, `KS_TAILLE_INVALIDE`) ; une seule ligne par taille ; stock entier ≥ 0 (`KS_STOCK_INVALIDE`) ; délai de variante facultatif (1 à 365) qui remplace celui du produit ; Fabrication sur commande autorisée exige un délai (variante, sinon produit : `KS_DELAI_MANQUANT`) ; Sur-mesure : toujours fabrication, stock 0 (AD-26). « Sur-mesure » n'est ici qu'un choix de taille (Mesures : 6.4). Le stock ne change que par `enregistrer_produit(p_auteur, p_id, p_produit jsonb, p_variantes jsonb) returns uuid` (crée si `p_id` est nul, sinon modifie le produit et remplace l'ensemble de ses variantes par taille, stable par `(produit_id, taille)`), atomique, journalisée avant/après ; elle ne pose jamais `publie_le`. `creer_univers(p_auteur, p_nom_fr, p_nom_en) returns uuid`.
Question « univers » : `profil.univers_prefere uuid references univers on delete set null` ; `enregistrer_questions_accueil` est recréée (nouvelle migration, départ de la dernière version, ancienne signature supprimée) avec `p_univers uuid default null` (inexistant : `KS_REPONSE_INVALIDE`) ; les tests de la 1.6 repassent. Étape et lecture serveur : liste lue par `catalogue/queries.ts` (client public), non affichée si vide ; choix facultatif (`<select>` avec « Je ne réponds pas »), « Passer » et le silence ne bloquent rien ; un Compte dont les questions sont déjà vues ne les revoit pas (`KS_QUESTIONS_DEJA_VUES` inchangé).
Admin : entrées « Produits » et « Univers » dans `NavigationAdmin` ; `/admin/produits` (liste : titre, Famille, pastille de statut icône + mot « Brouillon », prix ; tableau avec `<caption>` et `<th scope>` à partir de `md`, cartes sur mobile ; nombre de produits en `role="status"` ; état vide avec bouton de création), `/admin/produits/nouveau`, `/admin/produits/[id]` (404 si inconnu) ; `/admin/univers` (liste et formulaire FR/EN). Sans univers, le formulaire de produit le dit et renvoie vers `/admin/univers`. Formulaire : libellés visibles, erreur sous le champ liée par `aria-describedby`, résumé `role="alert"` au focus, saisie conservée après échec, succès affiché seulement après la réponse réelle (création : redirection vers la fiche d'édition avec confirmation) ; choix de Famille et tailles en cases ou radios natifs sans action au choix ; Sur-mesure absent pour un accessoire ; cibles 44 px, 375 px sans défilement horizontal ; aucun comptage ni mot d'urgence. Textes dans `messages/{fr,en}.json` (`Admin.produits`, `Admin.univers`, `Admin.nav`, `Connexion.questions.univers`), tutoiement, sobres, sans emoji. Lint, types, tests et build verts.

**Never:** Pas de photo, de publication ni de dépublication (2.2) ; pas de réglage de remise, de forfait ni de Plafond, ni `stock_disponible` ni `places_fabrication_utilisees` (2.3) ; pas de catalogue ni de fiche publics, de plan du site ni d'étiquette de cache (2.4, 2.5) ; pas de Kit ni de Kit lié (epic 3) ; pas de Mesures (6.4) ; pas de renommage ni suppression d'univers ; pas d'univers, de produit ou de prix par défaut ; pas d'écriture depuis le navigateur ; pas de modification d'une migration appliquée ; je ne lance ni `db:push` ni `npm run dev`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Créer un univers | admin, nom FR et EN | enregistré, journalisé (auteur) | doublon : `KS_UNIVERS_EXISTE` ; nom vide ou > 60 : refus |
| Question à un nouveau Compte | ≥ 1 univers, questions non vues | `select` des noms de la langue de la route, réponse enregistrée dans le profil | univers inconnu : `KS_REPONSE_INVALIDE`, rien d'enregistré |
| Aucun univers | table vide | question absente, le reste de l'étape inchangé | N/A |
| Questions déjà vues avant l'univers | `questions_accueil_le` posé | étape non rouverte, `univers_prefere` inchangé | N/A |
| Créer un produit | famille, titre FR, slug, prix `49,90`, variantes | brouillon (`publie_le` nul), `prix_cents` 4990, `USD`, journalisé | N/A |
| Brouillon côté public | `anon` ou Compte connecté | introuvable (RLS) | N/A |
| Slug déjà pris | titre identique | erreur sous le champ, première adresse libre proposée | `KS_SLUG_PRIS` |
| Prix invalide | `0`, `-3`, `12,345`, `abc` | erreur sous le champ, rien d'enregistré | refus Zod et SQL |
| Famille `kit` | appel direct | refusée | `KS_FAMILLE_INVALIDE` |
| Sur-mesure sur un accessoire | taille `sur_mesure` | refusée ; option absente de l'écran | `KS_TAILLE_INVALIDE` |
| Fabrication sans délai | variante sans délai, produit sans délai | refusée, erreur sur le champ | `KS_DELAI_MANQUANT` |
| Stock | `-1` ou `2,5` | refusé | `KS_STOCK_INVALIDE` |
| Modifier le stock | admin, variante M passe de 2 à 5 | enregistré, journal avant/après | N/A |
| Assistant ou Compte simple | action ou page | refus serveur / 404 | `KS_DROIT_REFUSE` |
| Échec serveur | rpc en erreur | pas de succès, saisie conservée | `generique` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261022180000_creer_roles_et_admin.sql` -- modèle des fonctions (`exiger_admin`, `set_config('ks.auteur')`) ; ne pas modifier. `20261021140000_creer_reglage.sql` -- `journaliser()`. `20261022140000_ajouter_questions_accueil.sql` -- dernière version de `enregistrer_questions_accueil` (4 paramètres) à reprendre ; ne pas modifier.
- Nouvelles migrations `supabase/migrations/20261023100000_creer_catalogue_physique.sql` (tables, RLS, triggers, `creer_univers`, `enregistrer_produit`) et `20261023120000_ajouter_univers_prefere.sql` (colonne, fonction recréée).
- `supabase/tests/` -- modèles `reglage_admin.test.sql`, `questions_accueil.test.sql`, `garde_ecritures.test.sql` (doit rester vert sans liste blanche), `garde_colonnes_privees.test.sql` ; nouveaux `catalogue.test.sql` (RLS brouillon/publié/futur, privilèges, droits, journal du stock, validations) et `questions_accueil_univers.test.sql`.
- `src/lib/argent.ts` -- nouveau (`formaterUsd(cents, locale)`, `analyserPrixUsd(texte)`) ; `src/lib/auth/matrice-droits.ts` -- `produits.modifier` existe déjà, ne rien ajouter.
- `src/modules/catalogue/{actions,service,schemas,types,dependances,queries,slug}.ts` -- nouveau, calqué sur `src/modules/admin/` (dépendances injectées, mappage d'erreurs `KS_` sans donnée personnelle, `slug.ts` pur et partagé avec le formulaire) ; `queries.ts` : lectures admin par client service, `lireUniversPublics(locale)` par `src/lib/supabase/public.ts`, `premierSlugLibre`.
- `src/app/[locale]/admin/{produits/page,produits/nouveau/page,produits/[id]/page,univers/page}.tsx` -- modèle `reglages/page.tsx` (`exigerAdminPage(locale, chemin, "produits.modifier")` sous Suspense, `CoqueAdmin`, `indexable: false`) ; `src/components/admin/{NavigationAdmin,FormulaireProduit,EditeurVariantes,FormulaireUnivers,ListeProduits}.tsx` ; modèle de formulaire : `FormulaireReglage.tsx` ; réutiliser `ui/{Bouton,MessageEtat,Squelette}`.
- `src/modules/comptes/{schemas,service,types,dependances}.ts`, `src/app/[locale]/connexion/{page,FormulaireConnexion,QuestionsAccueil}.tsx`, `tests/doubles/TEST_dependances-comptes.ts` -- `univers` facultatif (`z.uuid()`), `p_univers`, liste passée de la page au formulaire (aucune requête côté client).
- `src/lib/supabase/types.ts` -- compléter à la main (tables, fonctions, `profil.univers_prefere`) ; `messages/*.json` -- parité imposée par `tests/unit/messages-parite.test.ts` ; `tests/unit/coque-admin.test.tsx` -- entrées de navigation.
- `tests/unit/`, `tests/e2e/admin.spec.ts`, `tests/e2e/connexion.spec.ts` -- service, schémas, slug, argent, formulaires, liste ; e2e : visiteur redirigé, axe, clavier, 375 px sur les écrans accessibles sans simuler.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20261023100000_creer_catalogue_physique.sql` + `supabase/tests/catalogue.test.sql` -- tables, RLS, fonctions, journal ; preuves CI -- AD-2, AD-3, AD-30
- [ ] `supabase/migrations/20261023120000_ajouter_univers_prefere.sql` + `supabase/tests/questions_accueil_univers.test.sql` -- colonne et fonction recréée -- AD-1, AD-25
- [ ] `src/lib/argent.ts`, `src/modules/catalogue/*` + `src/lib/supabase/types.ts` -- prix, slug, schémas Zod, service, actions, requêtes -- règles 3, AD-8
- [ ] `src/app/[locale]/admin/**`, `src/components/admin/**`, `messages/*.json` -- navigation, listes, formulaires, états -- UX-DR43, UX-DR44
- [ ] `src/modules/comptes/*`, `connexion/*`, double `TEST_` -- question « univers » -- E-29
- [ ] `tests/unit/*`, `tests/e2e/*` -- matrice d'E/S, droits Assistant, succès seulement après réponse, axe, clavier, 375 px -- règle 13

**Acceptance Criteria:**
- Given la migration appliquée, when `anon` ou un Compte connecté lit `produit` ou `variante`, then il ne voit que les produits publiés et passés et leurs variantes, jamais un brouillon ni un publié futur, et ne peut rien écrire (test SQL)
- Given un admin, when il crée un univers puis un cosplay avec variantes, then les lignes existent en brouillon, `journal_audit` porte l'auteur, le stock modifié montre avant et après, et aucune donnée n'existait avant sa saisie
- Given un Assistant ou un Compte simple, when il appelle une action ou ouvre une page de produits ou d'univers, then refus serveur ou 404
- Given au moins un univers et un nouveau Compte, when il arrive aux questions, then la question « univers » apparaît dans sa langue et la réponse est enregistrée ; sans univers, elle est absente ; un Compte aux questions déjà vues ne les revoit pas
- Given `lint`, `typecheck`, `test`, `build`, then tous passent ; `test:sql` en CI

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Page `/connexion` : branchement de `univers` jamais testé | medium | patch | aucun test de la page |
| `p_univers` transmis à `enregistrer_questions_accueil` jamais testé | medium | patch | double seulement |
| `lireProduitAdmin` sans test (filtre `produit_id`, mapping) | medium | patch | formulaire d'édition pré-rempli par cette lecture |
| `enregistrer_questions_accueil` : univers inconnu avant le contrôle « déjà vues » ; `KS_REPONSE_INVALIDE` non mappé | low | patch | migration non appliquée, modifiable |
| `FormulaireUnivers` : `nom_invalide` hors liste blanche → message générique | low | patch | correction directe |
| Message « produit enregistré » reste affiché après modification | low | patch | effacer l'état au premier changement |
| Écrasement du stock par formulaire périmé ; suppression d'une taille sans garde | medium | defer | le stock n'est modifié ailleurs qu'à l'epic 4 (commandes) ; ajouter version et `restrict` alors |
| Slug et famille modifiables après publication ; « Programmé » vs « Publié » ; `modifie_le` hors fonction | medium | defer | la publication arrive en 2.2 |
| Stock exact et délai lisibles par `anon` (table `variante`) | maybe-false (medium) | defer | exigé par l'epic (SELECT public) mais expose les quantités ; décision à prendre avec 2.3 (`stock_disponible`) |
| Titres `<title>` identiques sur toutes les pages admin | low | defer | touche aussi les pages 1.7 et 1.8 ; à traiter pour toute l'admin |
| Bornes SQL de `enregistrer_produit` peu testées | low | defer | contraintes de table + Zod couvrent ; ajouter en 2.2 |
| Erreur SQL attribuée à `titre_fr` plutôt que `titre_en` | low | rejeté | Zod intercepte avant ; chemin base seulement |
| Slug tronqué en collision, séparateur de milliers, NFC/NFD, UTF-16 vs points de code | low | rejeté | cas rares sans dommage |
| `?cree=1`, point décimal en français, pagination de la liste, audit sans changement | low | rejeté | cosmétique ou volumétrie lointaine |
| Typage `as never`, `drop function` sans `if exists`, droits matrice/base, forme du payload | low | rejeté | aucun effet constaté |
| Univers non renommable | low | défait déjà | entrée de deferred-work.md ajoutée |

## Design Notes

Cette story dépasse 1600 jetons (elle couvre base, serveur, deux écrans admin et l'accueil) ; elle n'est pas scindée car les couches se testent ensemble. Ordre d'exécution proposé, chaque étape verte avant la suivante : (1) migration du catalogue et `catalogue.test.sql` ; (2) `argent.ts`, `slug.ts`, schémas et service du module avec tests Vitest ; (3) univers : action, page `/admin/univers`, entrée de navigation ; (4) liste des produits et formulaire avec `EditeurVariantes`, pages `nouveau` et `[id]` ; (5) migration `univers_prefere`, service des questions, écran `QuestionsAccueil` ; (6) e2e, parité des messages, lint, types, build.

Choix du développeur (non visibles par Jonathan) : un brouillon n'exige que Famille, titre FR et adresse, car la liste des manques de la 2.2 (prix, textes, variante) suppose un brouillon incomplet ; `/admin` continue de rediriger vers Réglages ; `enregistrer_produit` remplace l'ensemble des variantes pour garder une seule transaction et un journal cohérent (les lignes de commande de l'epic 4 devront refuser la suppression d'une variante vendue) ; le Sur-mesure est stocké comme taille `sur_mesure` à stock 0 et fabrication forcée (AD-26).

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- expected: aucune erreur
- `npm run test:e2e` -- expected: parcours existants et admin verts
- `npm run test:sql` -- expected: message explicatif en local ; vert en CI

**Manual checks (if no CLI):**
- `npm run db:push` sur `koma-dev` (à confirmer par Jonathan), puis `/fr/admin/univers` : créer un univers ; `/fr/admin/produits/nouveau` : créer un cosplay avec tailles et stock, vérifier la liste (cartes à 375 px, tableau sur ordinateur) et la ligne de `journal_audit` ; avec un autre Compte : 404 ; créer un Compte neuf : la question « univers » apparaît une fois
