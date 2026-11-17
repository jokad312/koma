---
title: '9.16 c) — Étape 4, page 1 : tableau de bord selon la maquette'
type: 'feature'
created: '2026-11-17'
status: 'in-review'
baseline_commit: 'a0a45f6bb6b1a1941150ded5e146cb97f45f7886'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-9-16-b-cadre-admin-et-composants.md'
  - '{project-root}/docs/design/admin/DECISIONS-NUIT.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le tableau de bord (`/admin`) garde la mise en page de la 9.8 (listes et barres horizontales grises) alors que le cadre A est en place. Il ne suit pas la maquette `docs/references/maquettes-admin/Admin · Tableau de bord.png` (fichier attendu sous le nom `01-tableau-de-bord.png`) : 4 cartes de chiffres, graphique des ventes, « Performance du jour », « À faire » et « Indicateurs » avec « Voir plus ».

**Approach:** Redessiner la page avec les composants de `src/components/admin/ui/` (E1 à E15 d'INVENTAIRE.md). Ajouter la seule lecture manquante (cartes de chiffres, Q9 autorisée en lecture seule) par une nouvelle fonction SQL réservée à l'admin. Tout ce qui existe et n'est pas sur la maquette reste, sous la partie visible.

## Boundaries & Constraints

**Always :**
- Décisions Q10 à Q13 : graphique des 30 derniers jours, une barre rouge #D7261E par jour, une date tous les 5 jours sous l'axe ; « Performance du jour » = nombre et montant des ventes payées aujourd'hui à Goma (Africa/Lubumbashi), date écrite JJ/MM/AAAA selon la langue ; « Voir plus » d'À faire → `/admin/taches`, « Voir plus » d'Indicateurs → ancre de la section des indicateurs existante ; libellé « VENTES PAYÉES (SM-1) » sur 7 et 30 jours.
- Mêmes règles d'argent que SM-1 : commandes payées (`paye_le` non nul), hors annulées et remboursées, montants en USD.
- Nouvelle fonction `security definer`, `exiger_admin(p_auteur)`, exécutable par `service_role` seulement, test SQL ; nouvelle migration appliquée sur koma-dev.
- Graphique accessible : axe gradué, « Voir les données en tableau » avec les 30 jours. Une zone illisible le dit (« Cette zone n'a pas pu être lue »), jamais un faux zéro.
- Couleurs par jetons `--ks-admin-*`, KOMA Chikara, 16 px minimum. Sombre et clair. 390 px sans défilement horizontal.
- Rien de l'existant n'est retiré : intro, sélecteur 7 / 30 jours, graphiques par prestataire et par famille, liste « Nouvelles commandes payées », les 11 tâches, les 17 indicateurs.

**Never :** pas de nouvelle route ; pas de donnée personnelle (que des agrégats) ; pas d'écriture en base ; pas de changement des autres pages admin.

**Décisions de Jonathan (2026-11-17) :**
1. Cartes de chiffres, toutes « depuis le début » : PRODUITS PUBLIÉS = produits dont `publie_le` est posé, toutes familles ; COMMANDES AU TOTAL = commandes payées, hors annulées et remboursées ; REVENU TOTAL = somme payée de ces commandes (livraison comprise), USD ; PAIEMENTS RÉUSSIS = taux en % (tentatives réussies / tentatives terminées : réussies + échouées + abandonnées ; aucune terminée → « Aucune donnée »).
2. « Événements et Pass vendus » calculé dans la même fonction : Événements = événements publiés à venir (fin, ou début, dans le futur) ; Pass vendus = Pass valides ou scannés dont la commande est payée, sur 7 et 30 jours (date de paiement à Goma). SM-4 dans la liste des indicateurs utilise les mêmes chiffres (la raison « epic 7 pas encore construit » disparaît).
3. Tâches : les 2 cartes de la maquette (Mesures, Annulations) en haut avec « Voir plus » vers `/admin/taches` ; les 11 cartes dans une section « Toutes les tâches » plus bas.
4. Spec gardée entière (environ 1 800 tokens).

</frozen-after-approval>

## Code Map

- `src/app/[locale]/admin/page.tsx` -- page actuelle (droits `admin.acceder`, `chiffre_affaires.voir`, `paiements.graphiques` à garder ; `?periode=7|30`). À réorganiser.
- `src/modules/tableau-de-bord/queries.ts` -- `lireTableauDeBord` : ajouter la lecture des chiffres (zone `null` si erreur, via `lire`/`entier`). Ajouter la lecture des commandes payées du jour même en mode 7 jours (Performance du jour).
- `src/modules/tableau-de-bord/calculs.ts`, `periode.ts` -- `serieParJour`, `joursFenetre`, `minuitGoma`, `formaterUsd` à réutiliser ; graduations de l'axe à ajouter ici (fonction pure, testée).
- `src/components/admin/tableau/` -- `GraphiqueBarres` (barres horizontales, reste pour prestataire et famille, restylé en `Panneau`), `CartesTaches`, `Indicateurs` (ajouter `id` d'ancre), `CommandesPayees`. Nouveau `GraphiqueJours.tsx` (barres verticales, rouge) et `PerformanceJour.tsx`.
- `src/components/admin/ui/` -- `CarteChiffre`, `Panneau` à utiliser tels quels (petite variante de carte si besoin).
- `supabase/migrations/20270102100000_tableau_de_bord.sql` -- modèle des fonctions `tableau_*` (à ne pas modifier). Nouvelle migration `20270120100000_tableau_chiffres.sql`.
- `supabase/tests/tableau_de_bord.test.sql` -- modèle ; nouveau test `tableau_chiffres.test.sql`.
- `messages/fr.json`, `messages/en.json` -- `Admin.tableau.*` (l. 542-656).
- `tests/e2e/admin.spec.ts`, `scripts/captures-admin.mjs` (captures 1366 × 768, superposition 50 %).

## Tasks & Acceptance

**Execution :**
- [x] `supabase/migrations/…_tableau_chiffres.sql` + `supabase/tests/tableau_chiffres.test.sql` -- fonction `tableau_chiffres(p_auteur)` selon les réponses 1 et 2 ; test des droits et des comptes.
- [x] `src/lib/supabase/types.ts` -- régénéré (`npm run types`).
- [x] `src/modules/tableau-de-bord/queries.ts`, `calculs.ts` (+ tests) -- lecture des chiffres, ventes du jour, graduations.
- [x] `src/components/admin/tableau/GraphiqueJours.tsx`, `PerformanceJour.tsx` (+ tests unitaires) -- nouveaux.
- [x] `src/app/[locale]/admin/page.tsx` + composants existants -- mise en page E1 à E15, le reste en dessous.
- [x] `messages/*.json` -- textes FR et EN.
- [x] `tests/e2e/admin.spec.ts` -- l'Admin voit les 4 cartes, le graphique et les deux « Voir plus ».
- [x] Captures : 1366 × 768 sombre (côte à côte et superposées à 50 %), clair, 390 px, dans `docs/captures-admin/9-16-c/`.

**Acceptance Criteria :**
- Given un Admin à 1366 × 768 en sombre, when il ouvre `/fr/admin`, then cartes, graphique, Performance du jour, À faire et Indicateurs occupent les places de la maquette.
- Given des ventes payées hier et aujourd'hui, then le graphique a 30 barres (jours sans vente à 0) et Performance du jour ne compte que celles d'aujourd'hui à Goma.
- Given une lecture en échec, then la zone concernée affiche « Cette zone n'a pas pu être lue », les autres restent.
- Given un Assistant, then `/admin` reste refusé comme avant.

## Verification

**Commands :**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` -- tous à 0 ; `npm run test:sql` en CI.
- CI GitHub verte sur le dernier commit.

**Manual checks :**
- Captures validées par Jonathan avant le commit ; revue de code BMad avant le commit.

## Implementation Notes

- Migration `20270120100000_tableau_chiffres.sql` appliquée sur koma-dev ; test `tableau_chiffres.test.sql` (14 assertions) exécuté sur koma-dev dans une transaction annulée (pgTAP créé puis annulé), tout vert. `tableau_de_bord.test.sql` : le contrôle SECURITY DEFINER compte désormais les 5 fonctions par leur nom (sinon `tableau\_%` en trouve 6).
- Garde `garde.test.ts` : `tableau_chiffres` ajoutée aux fonctions permises.
- Jetons ajoutés : `--ks-admin-barre` (#D7261E, deux thèmes) et `--ks-admin-axe`. `CarteChiffre` : prop `texte` (chiffre écrit en t-h3 : « Aucune donnée », long montant).
- Correctifs de revue : migration `20270120110000_tableau_chiffres_publie.sql` (publication programmée exclue, appliquée sur koma-dev) ; bornes des Pass testées ; `tableau_de_bord.test.sql` revenu au motif `tableau\_%` (6) ; `cartesChiffres` et `tauxReussite` (arrondi inférieur) testés ; test de `lireTableauDeBord` ; état vide du graphique ; note SM-4 ; `raisonSmc4` corrigée ; `#indicateurs` focusable.
- `scripts/captures-admin.mjs` : `CAPTURES_SORTIE` et `CAPTURES_VUES`, captures de page entière. Choix faits sans Jonathan : `docs/design/admin/DECISIONS-NUIT.md`.

## Spec Change Log

## Review Triage Log

| # | Relecteur | Constat | Verdict | Preuve / route |
|---|---|---|---|---|
| 1 | Blind | Produit à `publie_le` futur compté publié | medium | Les politiques du catalogue exigent `publie_le <= now()` ; patch (nouvelle migration, l'appliquée n'est pas modifiée) |
| 2 | Blind | SM-4 : alertes événement ni mesurées ni signalées | low | Libellé « Alertes événement et Pass vendus » ; patch (note) |
| 3 | Blind | `raisonSmc4` périmée | low | Epic 7 fini ; patch (texte) |
| 4 | Blind | « Commandes au total » ne compte que les payées | false | Décision 1 de Jonathan (option a) |
| 5 | Blind | `abandonnee` comptée comme terminée | false | Définition décidée par Jonathan (décision 1) |
| 6 | Blind | Graphique sans message d'état vide | low | 30 barres à 0 sans texte ; patch |
| 7 | Blind | Test SECURITY DEFINER passé en noms en dur | low | Une future `tableau_*` échapperait ; patch |
| 8 | Blind | e2e sans mobile | false | `police.spec.ts` contrôle `/fr/admin` à 320 px sans débordement |
| 9 | Blind | Pas de test EN de PerformanceJour | low | Rejeté : formatage `Intl` standard, risque faible, ajout de tests seul |
| 10 | Blind + VerifGap | Bornes des fenêtres Pass non testées | low | Patch (test SQL) |
| 11 | Blind | Seuil du revenu dépend de la langue | low | Patch (seuil en centimes) |
| 12 | Blind | Résumé recopie « Voir les données en tableau » | low | Patch (interpolation) |
| 13 | Blind + Edge | Clé `graphiques.parJour` orpheline | low | Patch (suppression) |
| 14 | Blind | `VoirPlus` mal rangé, classe recopiée | low | Rejeté : rangement sans défaut observé |
| 15 | Blind | Focus après « Voir plus » | low | Patch (`tabIndex={-1}`) |
| 16 | Edge | 199/200 affiché 100 % | low | `pourcentage` arrondit ; patch (arrondi inférieur pour la carte) |
| 17 | Edge | Montant du jour négatif → hauteur négative | false | Une réduction ne dépasse pas les lignes (contrôles de la couche promo) ; non atteignable |
| 18 | Edge | Graphique par jour sur 7 jours supprimé | false | Q10 : le graphique par jour devient celui des 30 jours (noté dans DECISIONS-NUIT.md) |
| 19 | VerifGap | `lireTableauDeBord` non testé (ventes du jour en mode 7 j, correspondance des colonnes) | medium | Patch (test Vitest) |
| 20 | VerifGap | Valeurs des cartes et sens du taux non testés | medium | Patch (fonction pure testée) |
