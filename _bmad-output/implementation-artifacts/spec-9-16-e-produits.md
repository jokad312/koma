---
title: '9.16 e) — Étape 4, page 3 : liste des produits selon la maquette, archivage'
type: 'feature'
created: '2026-11-17'
status: 'in-review'
baseline_commit: 'e9103ee378179a14e683561c729ac61a78d8e199'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
  - '{project-root}/docs/design/admin/DECISIONS-NUIT.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-9-16-d-commandes.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/admin/produits` garde la grille de la 9.10 alors que la maquette `docs/references/maquettes-admin/03-produits.png` (C1 à C17 d'INVENTAIRE.md) montre une barre (recherche, « N PRODUITS », bouton Univers, + NOUVEAU PRODUIT), un grand panneau et des cartes à pastilles (prix, téléchargements ou vendus, univers, type), avec crayon, corbeille et statut.

**Approach:** Redessiner la page avec les composants de `src/components/admin/ui/`, appliquer les décisions Q19 (Univers), Q20 (Téléchargements / VENDUS), Q22 (corbeille = archiver, jamais supprimer). Consigne de la nuit (2026-11-17) : pas de validation intermédiaire, choix notés dans DECISIONS-NUIT.md.

## Boundaries & Constraints

**Always :**
- Droit inchangé : `produits.modifier` (Admin).
- Barre : `ChampRecherche` (recherche actuelle : nom, famille, univers, sans casse ni accents), compteur « N PRODUITS » annoncé en statut, bouton « UNIVERS » (#8C514E, jeton existant) vers `/admin/univers`, bouton rouge « + NOUVEAU PRODUIT ».
- Carte (grille de 2 à 1366 px, 1 colonne à 390 px) : vignette (photo ou icône image, jamais une image inventée) ; nom en pastille sombre ; pastille PRIX (« Gratuit » si 0, « Prix à fixer » si absent) ; pastille TÉLÉCHARGEMENTS : N pour un Kit (acheteurs qui ont l'accès) ou VENDUS : N pour un article physique (articles des commandes payées, hors annulés et remboursés) ; pastille UNIVERS : … ; pastille du type (Cosplay, Accessoire, Vêtement, Autre article, Kit) ; trait ; crayon (Modifier), corbeille (Archiver), pastille de statut PUBLIÉ / BROUILLON / ARCHIVÉ. L'état du stock (Numérique, En stock, Sur commande, Épuisé) et Publier / Dépublier restent sur la carte.
- Icônes : nom accessible (« Modifier X », « Archiver X »), pas de couleur seule.
- Archivage (Q22) : confirmation avant l'action ; le produit est dépublié et marqué archivé ; il disparaît de la boutique et de la liste par défaut ; filtre « Archivés » (`PastilleFiltre`) pour le retrouver, avec « Restaurer » (il revient en brouillon). Un produit archivé ne peut pas être publié. Commandes, accès aux Kits et fichiers ne sont jamais touchés. Écriture par fonction `security definer` avec `p_auteur`, droit revérifié en base, entrée dans `journal_audit`.
- Nouvelle migration (colonne d'archivage, fonctions d'archivage et de restauration, lecture des compteurs), koma-dev seulement, test SQL, notée dans DECISIONS-NUIT.md.

**Never :** aucune suppression de produit, de photo, de fichier ni de commande ; pas de changement de RLS ni des droits ; pas de changement du formulaire produit (page 4).

</frozen-after-approval>

## Code Map

- `src/app/[locale]/admin/produits/page.tsx` -- droit `produits.modifier`, lecture de la liste.
- `src/components/admin/ListeProduits.tsx` (104 lignes, client) -- grille, recherche, compteur ; `PublierDepublierCarte.tsx`, `PastilleStatut.tsx`.
- `src/modules/catalogue/` -- `types.ts` (`ProduitListe`, `FAMILLES_PRODUIT`), `service.ts` (`publierProduit`, `depublierProduit` l. 355 : modèle pour archiver/restaurer, et garde « archivé non publiable »), `actions.ts` (`envelopper`), requête de liste à trouver (grep `ProduitListe`).
- Boutique publique : vérifier que les lectures publiques ne montrent que les produits publiés (`publie_le`) — l'archivage dépublie, donc aucune lecture publique ne change.
- `supabase/migrations/20261024100000_photos_et_publication.sql` -- `journal_audit`, fonctions de publication (modèle). `acces_kit` (`20261110100000_commande_offerte_et_acces_kit.sql`). Nouvelle migration `20270122100000_produits_archivage.sql` + `supabase/tests/produits_archivage.test.sql`.
- `src/components/admin/ui/` -- `ChampRecherche`, `Panneau`, `Pastille`, `PastilleFiltre`. `src/components/ui/Dialogue.tsx` pour la confirmation.
- `messages/*.json` -- `Admin.produits.*`.
- Captures dans `docs/captures-admin/9-16-e/` (`scripts/captures-admin.mjs`).

## Tasks & Acceptance

**Execution :**
- [x] Migration + test SQL -- archivage, restauration, garde de publication, compteurs ; droits et journal.
- [x] Types régénérés ; `service.ts`, `actions.ts`, requête de liste (+ tests unitaires).
- [x] `page.tsx`, `ListeProduits.tsx` et carte -- mise en page C1 à C17, filtre Archivés, confirmation.
- [x] `messages/*.json` -- FR et EN.
- [x] Tests unitaires de la carte (pastilles selon la famille, noms accessibles) et e2e (archiver puis restaurer un produit TEST_).
- [x] Captures 1366 × 768 sombre (côte à côte + superposées 50 %), clair, 390 px ; données TEST_ supprimées.

**Acceptance Criteria :**
- Given un Kit acheté par 2 Comptes, then sa carte affiche TÉLÉCHARGEMENTS : 2 ; given un cosplay vendu 3 fois dans des commandes payées, then VENDUS : 3.
- Given un produit publié, when l'Admin confirme « Archiver », then il disparaît de la boutique et de la liste par défaut, apparaît sous « Archivés », et une ligne est ajoutée au journal d'audit.
- Given un produit archivé, when on tente de le publier, then refus ; when « Restaurer », then il revient en brouillon.

## Verification

**Commands :**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` -- tous à 0 ; `npm run test:sql` en CI.

## Implementation Notes

- Migration `20270122100000_produits_archivage.sql` appliquée sur koma-dev (`supabase db push`) après le test `produits_archivage.test.sql` (30 assertions) exécuté sur koma-dev avec la migration dans une transaction annulée (pgTAP créé puis annulé) : 30/30. Types régénérés (`archive_le`, `archiver_produit`, `restaurer_produit`, `produits_admin_compteurs`).
- Base : colonne `archive_le` ; déclencheur `produit_archive_non_publie` (KS_PRODUIT_ARCHIVE, tout chemin d'écriture) ; `publier_produit` recréée (refus d'un archivé avant la complétude) ; `archiver_produit` (publie_le nul + archive_le, une seule écriture donc une ligne au journal) et `restaurer_produit` (archive_le nul, reste brouillon) ; `produits_admin_compteurs` (accès au Kit ; pièces des lignes non annulées des Commandes payées hors annulées / remboursées). Tout `exiger_admin`, `service_role` seulement.
- Module : `lireProduitsAdmin()` lit `archive_le` (le blog l'utilise toujours, sans compteurs) ; nouvelle `lireProduitsAdminAvecCompteurs(auteur)` pour la page ; `archiverProduit` / `restaurerProduit` (service, actions, dépendance `changerArchivage`) ; `publierProduit` refuse un archivé (`produit_archive`) avant toute écriture ; code d'erreur `produit_archive`.
- Écran : `ListeProduits.tsx` réécrit (barre, `Panneau`, pastilles TOUS / ARCHIVÉS, cartes C6 à C17), nouveau `ArchivageProduit.tsx` (corbeille + `Dialogue` de confirmation, ou « Restaurer »), jeton `admin-grille` (#1D1B1A / #F3EEE4). `PublierDepublierCarte` connaît `produit_archive`. Le titre de niveau 1 et l'intro restent au-dessus de la barre (comme Commandes).
- Choix notés dans DECISIONS-NUIT.md (TÉLÉCHARGEMENTS = tous les accès, Kits gratuits compris ; filtre local ; carte non entièrement cliquable ; Restaurer sans confirmation ; fiche produit page 4 non modifiée, message générique si on tente d'y publier un archivé).
- Tests : `tests/unit/produits-admin-liste.test.tsx` (10), service (5), dépendances (1), lecture des compteurs (1) ; anciens tests de la grille 9.10 retirés de `catalogue-ui.test.tsx` ; e2e `admin.spec.ts` « liste des produits et archivage (9.16 e) » (produit TEST_ publié, archive avec confirmation, journal +1, absent de /fr/vetements, Archivés, Restaurer → Brouillon, 390 px sans défilement, nettoyage compté à 0).
- Captures : `scripts/captures-admin.mjs` sème 4 produits TEST_ quand la vue « produits » est demandée et les supprime (restes comptés : 0) ; sortie `docs/captures-admin/9-16-e/` (ignoré par Git) ; aucun débordement de 320 à 1440 px.

- Correctifs de revue : migration `20270122110000_produits_archivage_correctifs.sql` (appliquée sur koma-dev ; TÉLÉCHARGEMENTS sans les Kits offerts), test SQL porté à 34 (archivé incomplet → KS_PRODUIT_ARCHIVE, journal de la restauration, aucune ligne pour les appels sans effet) ; fiche d'un archivé : « Archivé » + « Restaurer » (`PublicationProduit`, prop `archive`), message `produit_archive` ; sélecteur de produit du blog sans les archivés (sauf celui déjà lié, `modules/blog/produits-lien.ts`) ; annonce en statut et focus sur le compteur après archivage ou restauration ; clés orphelines `Admin.produits.nouveau` et `Admin.produits.liste` retirées.

## Spec Change Log

## Review Triage Log

| # | Relecteur | Constat | Verdict | Preuve / route |
|---|---|---|---|---|
| 1 | Tous | `PublicationProduit` ignore `produit_archive` | medium | `erreurConnue` l. 81 ; patch |
| 2 | Blind + Edge | La fiche d'un archivé se présente comme un brouillon publiable | medium | `publie` seul passé au panneau ; patch (statut Archivé + Restaurer) |
| 3 | Blind + Edge | Le sélecteur de produit du blog propose les archivés | medium | `lireProduitsAdmin` les renvoie ; patch |
| 4 | Blind | Ordre « archivé avant manques » non testé | low | Patch (test SQL) |
| 5 | Blind | Journal de restauration non testé | low | Patch (test SQL) |
| 6 | Blind + Edge | Focus perdu, succès non annoncé | low | Règle 7 ; patch |
| 7 | Blind | Message d'erreur casse la rangée d'actions | low | Rejeté : cas d'erreur rare, cosmétique |
| 8 | Blind | Libellé « Tous » exclut les archivés | low | Rejeté : même convention que les filtres du blog (Q26/Q27), message vide explicite |
| 9 | Blind | TÉLÉCHARGEMENTS compte les Kits offerts | medium | Q20 dit « acheteurs » ; patch (nouvelle migration) |
| 10 | Blind | Repli `{0,0}` sur compteur absent | false | Seul un produit créé entre les deux lectures parallèles est concerné : il a réellement 0 |
| 11 | Blind | Archivage sans alerte sur commandes en cours | low | Différé (deferred-work) : la commande reste valide, décision produit à prendre |
| 12 | Blind + Edge | Fragilités de `captures-admin.mjs` | low | Rejeté : outil local, même décision qu'en 9.16 b |
| 13 | Blind | Carte en anglais avec titres FR | low | Préexistant ; différé |
| 14 | Blind | Clés de traduction orphelines | low | Patch (vérification et suppression) |
| 15 | VerifGap | Messages vides par filtre non testés | low | Patch (tests) |
