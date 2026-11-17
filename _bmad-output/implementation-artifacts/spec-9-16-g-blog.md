---
title: '9.16 g) — Étape 4, page 5 : liste du blog selon la maquette, archivage'
type: 'feature'
created: '2026-11-17'
status: 'in-review'
baseline_commit: '462f603a7d610e81bfdf1d9b2d56f1be84bd7947'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
  - '{project-root}/docs/design/admin/DECISIONS-NUIT.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-9-16-e-produits.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/admin/blog` est une liste simple (titre, statut, date de modification) alors que la maquette `docs/references/maquettes-admin/05-blog.png` (CB1 à CB10 d'INVENTAIRE.md) montre « ÉCRIRE UN ARTICLE », un panneau avec « N ARTICLES » et des filtres en pastilles, et des cartes en grille de 2 (image, statut, date, titre et extrait, crayon, dépublier, corbeille).

**Approach:** Redessiner la liste avec les composants de `src/components/admin/ui/`, avec les filtres TOUS, PUBLIÉS, BROUILLONS, ARCHIVÉS (Q26/Q27) et la corbeille = archiver (Q22), comme pour les produits (page 3). Consigne de la nuit (2026-11-17) : pas de validation intermédiaire.

## Boundaries & Constraints

**Always :**
- Droit inchangé : `blog.gerer` (Admin et Assistant).
- Carte : première image de l'article (sinon icône image, jamais une image inventée, texte alternatif de l'article) ; pastille de statut (PUBLIÉ en rouge #D7261E comme la maquette, BROUILLON, ARCHIVÉ) ; date courte (date de publication, sinon de modification) ; titre ; extrait = 160 premiers caractères du contenu sans Markdown (Q28 ; le champ Extrait arrive à la page 6, la carte l'utilisera alors s'il est rempli) ; trait ; crayon (Modifier), cercle barré (Dépublier, seulement si publié ; Publier reste disponible pour un brouillon), corbeille (Archiver). Noms accessibles sur chaque icône.
- Archivage : comme les produits — confirmation, dépublication + marque d'archivage, disparition du blog public et de la liste par défaut, filtre ARCHIVÉS, « Restaurer » en brouillon, un article archivé ne peut pas être publié ; écriture par fonction `security definer` avec `p_auteur`, droit revérifié en base, `journal_audit`. Nouvelle migration koma-dev, test SQL, notée dans DECISIONS-NUIT.md.
- Grille de 2 à 1366 px, 1 colonne à 390 px ; compteur annoncé en statut ; filtres dans l'adresse (`PastilleFiltre`, `aria-pressed`).

**Never :** aucune suppression d'article ni d'image ; pas de changement du formulaire (page 6), des droits ni de la RLS.

</frozen-after-approval>

## Code Map

- `src/app/[locale]/admin/blog/page.tsx` -- droit `blog.gerer`, lecture.
- `src/components/admin/ListeArticles.tsx` (82 l.), `PublicationArticle.tsx`, `ImagesArticle.tsx` (forme des images, textes alternatifs), `PastilleStatut.tsx`.
- Module du blog : `grep -rl "PublicationArticle\|publierArticle" src/modules` (service, actions, requêtes) — modèle pour archiver/restaurer et pour la garde de publication.
- `supabase/migrations/20261125120000_article.sql` -- table `article` (`publie_le`). Archivage des produits (page 3) comme modèle. Nouvelle migration `20270123100000_articles_archivage.sql` + test SQL.
- `messages/*.json` -- `Admin.blog.*`. Captures `docs/captures-admin/9-16-g/`.

## Tasks & Acceptance

**Execution :**
- [x] Migration + test SQL ; types régénérés.
- [x] Module du blog (archiver, restaurer, garde de publication, filtres) + tests.
- [x] `page.tsx`, `ListeArticles.tsx` -- mise en page CB1 à CB10.
- [x] `messages/*.json` ; tests unitaires de la carte et e2e (archiver puis restaurer un article TEST_).
- [x] Captures 1366 × 768 sombre (côte à côte + superposées 50 %), clair, 390 px ; données TEST_ supprimées.

**Acceptance Criteria :**
- Given un Assistant, then il voit la page et peut archiver (même droit `blog.gerer`).
- Given un article publié archivé, then il disparaît de `/fr/blog`, apparaît sous ARCHIVÉS, et le journal d'audit a une ligne.
- Given un contenu Markdown de 400 caractères, then la carte montre 160 caractères de texte sans syntaxe Markdown.

## Verification

**Commands :**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` -- tous à 0 ; `npm run test:sql` en CI.

## Implementation Notes

- Migration `20270123100000_articles_archivage.sql` : test `supabase/tests/articles_archivage.test.sql` (30 assertions) exécuté sur koma-dev avec la migration dans une transaction annulée (pgTAP créé puis annulé) : 30/30 ; puis `supabase db push` sur koma-dev ; types régénérés (`archive_le`, `archiver_article`, `restaurer_article`).
- Base : colonne `archive_le` (non ouverte à anon / authenticated) ; déclencheur `article_archive_non_publie` (KS_ARTICLE_ARCHIVE) ; `publier_article` recréée (refus d'un archivé avant la complétude, `exiger_admin` inchangé) ; `archiver_article` (publie_le nul + archive_le, une écriture = une ligne au journal) et `restaurer_article` (archive_le nul, reste brouillon), `exiger_personnel` (Admin ou Assistant), service_role seulement.
- Module : `lireArticlesAdmin` lit `archive_le`, la première image complète (adresse publique, texte alternatif FR) et calcule l'extrait (`extraitCarte` dans `texte.ts`, 160 caractères sans Markdown + « … ») ; le texte entier ne part pas au navigateur. `archiverArticle` / `restaurerArticle` (service, actions `archiverArticleAction` / `restaurerArticleAction`, dépendance `changerArchivage`) ; code d'erreur `article_archive`. `Article.archiveLe` (facultatif) lu pour la fiche.
- Écran : `ListeArticles.tsx` réécrit en composant client (ÉCRIRE UN ARTICLE, `Panneau`, compteur en statut, pastilles TOUS / PUBLIÉS / BROUILLONS / ARCHIVÉS en `aria-pressed`, filtre écrit dans `?filtre=` par `history.replaceState`, grille 1 puis 2 colonnes à `xl`) ; nouveau `ActionsArticle.tsx` (Dépublier cercle barré, Publier, corbeille + `Dialogue`, Restaurer) ; `page.tsx` lit `?filtre=` ; fiche : `PublicationArticle` prop `archive` (Archivé + Restaurer), `PastilleStatut` prop `archive` (icône d'archive).
- Tests : `tests/unit/blog-admin-liste.test.tsx` (8), `tests/unit/blog-admin-lecture.test.ts` (4, dont l'AC des 400 caractères), service (5), fiche archivée (1) ; e2e `admin.spec.ts` « liste du blog et archivage (9.16 g) » avec un Compte TEST_ **Assistant** (article TEST_ publié, visible sur /fr/blog, archivé avec confirmation, journal +1, absent de /fr/blog, sous Archivés avec `?filtre=archives`, Restaurer → Brouillons, 390 px sans défilement, article compté à 0 après nettoyage).
- Captures : `scripts/captures-admin.mjs` sème 4 articles TEST_ (publié avec image dessinée, publié sans image, brouillon, archivé) quand la vue « blog » est demandée et les supprime (restes comptés).
- Correctifs de revue : migration `20270123110000_articles_archivage_correctifs.sql` (archivage et restauration réservés à l'Admin en base, comme la publication ; test SQL 33/33 sur koma-dev, appliquée) ; la page passe `peutPublier` (rôle Admin lu côté serveur) : Publier, Dépublier, Archiver, Restaurer rendus pour l'Admin seulement, crayon pour tous ; `Article.archiveLe` obligatoire ; vignette = vraie première image (texte alternatif FR, sinon titre de l'article) ; annonce effacée au début de chaque action et au changement de filtre, focus sur le compteur seulement après archivage ou restauration ; Publier bloqué pendant toute action de la carte ; test SQL renforcé (anon lit l'article publié avant l'archivage, valeurs du journal comparées) ; e2e : archivage par un Compte TEST_ Admin, Assistant sans boutons d'action.
- Incohérence antérieure, notée dans DECISIONS-NUIT.md (à signaler à Jonathan) : `blog.gerer` ouvre le blog à l'Assistant, mais `enregistrer_article`, `publier_article` et `depublier_article` exigent l'Admin en base ; non touchée.

## Spec Change Log

## Review Triage Log

## Spec Change Log (nuit du 2026-11-17)

- Revue : `archiver_article`/`restaurer_article` en `exiger_personnel` ouvraient à l'Assistant un moyen de dépublier, alors que publier, dépublier et enregistrer sont réservés à l'Admin en base. La consigne de la nuit interdit de changer les droits : l'archivage passe Admin seulement et les actions de publication ne sont montrées qu'à l'Admin. Le critère « un Assistant peut archiver » de cette spec est donc remplacé ; à confirmer par Jonathan (DECISIONS-NUIT.md).

| # | Relecteur | Constat | Verdict | Preuve / route |
|---|---|---|---|---|
| 1 | Tous | Assistant : archivage = dépublication contournant `exiger_admin` ; boutons qui échouent toujours | high | Fonctions anciennes en `exiger_admin` ; patch (Admin seulement, boutons masqués) |
| 2 | VerifGap + Blind | État archivé de la fiche non vérifié ; `archiveLe` facultatif | medium | Patch (type obligatoire, test de lecture) |
| 3 | VerifGap | Filtre inconnu dans l'adresse non testé | low | Rejeté : repli simple vers « tous » |
| 4 | Blind | Commentaire « retour arrière » faux | low | Patch (commentaire) |
| 5 | Blind + Edge | Annonce de succès persistante et non relue | low | Patch |
| 6 | Blind | Tri par modification, date affichée de publication | low | Rejeté : cosmétique |
| 7 | Blind + Edge | « Pas d'image » faux ; `alt` vide | medium | Règle 7 ; patch |
| 8 | Blind | Texte entier lu pour l'extrait | low | Rejeté : volume du blog faible |
| 9 | Blind | Déclencheur au lieu d'un CHECK | low | Rejeté : fonctionne, déjà testé |
| 10 | Blind | Assertions SQL faibles | low | Patch |
| 11 | Blind | Messages d'erreur dupliqués | low | Rejeté : cosmétique |
| 12 | Blind | Cartes en français sur /en | low | Différé (même défaut que les produits) |
| 13 | Blind | Focus déplacé même quand la carte reste | low | Patch |
| 14 | Blind | e2e sans Annuler / Échap ni 375 px | low | Rejeté : `Dialogue` déjà testé ; 390 px = consigne de Jonathan |
| 15 | Edge | Filtre non resynchronisé si l'adresse change | low | Rejeté : navigation non proposée par la page |
| 16 | Edge | Publier actif pendant une autre action | low | Patch |
| 17 | Edge | Nettoyage des captures fragile | low | Rejeté : outil local |
