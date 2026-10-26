---
title: 'Story 2.3 : réglages de remise et Plafond de fabrication'
type: 'feature'
created: '2026-10-26'
status: 'done'
baseline_commit: '3a49f960949f221160a7915de510a84a65b4e5da'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les fiches de l'epic 2 doivent afficher la remise (forfaits de Goma et Bukavu, retrait à Goma), le filtre de prix et la disponibilité, mais rien de cela n'est réglable : aucun forfait, aucun lieu de retrait, aucun Plafond de fabrication, aucune tranche de prix, et pas de fonctions de disponibilité.

**Approach:** Cinq nouvelles clés de la table `reglage` écrites par `enregistrer_reglage` (recréée par une nouvelle migration), une table `tranche_prix` écrite par une fonction journalisée, deux fonctions de lecture `stock_disponible` et `places_fabrication_utilisees`, et la page Réglages de l'admin étendue (livraison, retrait, plafond, tranches). Aucune valeur par défaut : « Valeur à fixer » tant que rien n'est saisi.

## Boundaries & Constraints

**Always:** Nouvelles migrations seulement (la précédente `enregistrer_reglage` est recréée par `create or replace` avec la même signature, départ de la dernière version). Droit `reglages.modifier` (existant) revérifié par `exigerDroit` ; écritures journalisées (trigger `reglage_journaliser` existant ; trigger `journaliser('id')` sur `tranche_prix`) ; confirmation affichée seulement après la réponse réelle de la base ; cache `reglages` invalidé comme pour le nom du site.
Clés ajoutées (valeur texte, vide = effacé = « Valeur à fixer ») : `forfait_livraison_goma_cents` et `forfait_livraison_bukavu_cents` (entier en centimes USD, 0 à 100 000 ; saisie en USD décimal, point ou virgule, deux décimales au plus, convertie par `src/lib/argent.ts`) ; `retrait_goma_fr` et `retrait_goma_en` (1 à 500 caractères) ; `plafond_fabrication` (entier de 1 à 10 000 pièces). Erreur de base `KS_REGLAGE_INVALIDE` comme aujourd'hui, avec un message d'interface par clé. Les clés actuelles (`nom_site`, `numero_whatsapp`) ne changent pas.
Lecture publique de `reglage` : la politique passe à `nom_site`, `numero_whatsapp`, les deux forfaits et `retrait_goma_fr/en` ; `plafond_fabrication` reste illisible par `anon` (capacité interne, jamais affichée). Lecture admin par le client service.
`tranche_prix(id, ordre, libelle_fr, libelle_en, bas_cents, haut_cents)` : libellés 1 à 40 caractères ; `bas_cents` ≥ 0 ; `haut_cents` nul (tranche ouverte) ou > `bas_cents` ; au plus 8 tranches ; lecture `SELECT` pour `anon`/`authenticated`, aucune écriture directe. `enregistrer_tranches_prix(p_auteur, p_tranches jsonb) returns void` (service seulement, `exiger_admin`, `ks.auteur` posé) remplace l'ensemble (liste vide = plus de tranche) ; l'ordre est celui de la liste (`ordre` 1..n). Sans tranche réglée, aucun filtre de prix (décision du 2026-10-21) : la lecture `lireTranchesPrix()` renvoie une liste vide, jamais une tranche inventée.
Fonctions de lecture : `stock_disponible(p_variante uuid) returns integer` (stable, `security invoker`, vaut le stock de la variante ; nul si la variante n'est pas visible par l'appelant) et `places_fabrication_utilisees() returns integer` (stable, vaut 0 : aucune commande n'existe) ; exécutables par `anon` et `authenticated` (ajoutées à la liste blanche de `garde_ecritures.test.sql`, AD-3) ; l'epic 4 les remplacera par `create or replace` ; tests SQL des deux.
Délais de remise : texte fixe des fichiers de traduction (Goma : moins d'un jour ; Bukavu : un jour au plus), sans réglage (E-26), affichés sous les forfaits dans l'admin à titre d'information.
Interface (`/admin/reglages`, `messages/{fr,en}.json` `Admin.reglages.*`, tutoiement) : sections Livraison (deux forfaits en USD), Retrait à Goma (FR et EN), Plafond de fabrication, Tranches de prix (éditeur : libellé FR/EN, borne basse, borne haute facultative, boutons Monter / Descendre de 44 px au nom complet avec `aria-disabled` en bout, Ajouter, Retirer la tranche, un seul bouton Enregistrer, résumé d'erreur `role="alert"`, saisie conservée après échec). « Valeur actuelle : … » ou « Valeur à fixer » comme pour les réglages existants ; 375 px sans défilement horizontal ; libellés visibles, erreur liée par `aria-describedby`.

**Never:** Pas de catalogue, de fiche ni de filtre public (2.4, 2.5) ; pas de calcul de frais ni de commande (epic 4) ; pas de réglage de délai de livraison ; pas de valeur par défaut ; pas de forfait par famille ; pas de modification d'une migration appliquée ; pas de `npm run dev`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Forfait | `5`, `5,50`, `0` | enregistré en centimes (500, 550, 0), journalisé | N/A |
| Forfait invalide | `-1`, `abc`, `5,555`, `1001` | refusé, rien d'enregistré | erreur sous le champ |
| Retrait | texte FR et EN | enregistré, journalisé | > 500 caractères : refusé |
| Valeur jamais saisie | clé absente | « Valeur à fixer », aucun repli | N/A |
| Effacer | vide | clé effacée, « Valeur à fixer » | N/A |
| Plafond | `40` | enregistré | `0`, `2,5`, `10001` refusés |
| Tranches | 3 valides | remplacent les précédentes, ordre conservé, journalisées | haut ≤ bas, libellé vide, 9 tranches : refusé |
| Aucune tranche | liste vide | lecture vide, filtre absent | N/A |
| `stock_disponible` | variante d'un produit publié | stock de la variante | variante d'un brouillon (anon) : nul |
| `places_fabrication_utilisees` | aucune commande | 0 | N/A |
| Lecture publique | `anon` | forfaits et retrait lisibles, plafond illisible | N/A |
| Assistant / Compte simple | action | refus serveur | `non_autorise` |
| Échec serveur | base en erreur | pas de succès, saisie conservée | `generique` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261022180000_creer_roles_et_admin.sql` (`enregistrer_reglage`) et `20261022200000_creer_contact_et_limite_essai.sql` (politique `reglage_lecture_publique`) : dernières versions à reprendre, ne pas modifier. Nouvelle `supabase/migrations/20261025100000_reglages_remise_et_disponibilite.sql` ; tests `supabase/tests/reglages_remise.test.sql` ; mettre à jour la liste blanche de `garde_ecritures.test.sql` ; `garde_colonnes_privees` doit rester vert.
- `src/modules/admin/{schemas,types,service,actions,dependances,queries}.ts`, `src/components/admin/FormulaireReglage.tsx`, `src/app/[locale]/admin/reglages/page.tsx` : étendre (nouvelles clés, `lireReglagesAdmin`), ne pas dupliquer. Tranches : module `catalogue` (`lireTranchesPrix` public en cache `reglages`, action `enregistrerTranchesPrix`) ; composant `EditeurTranchesPrix.tsx`.
- `src/lib/argent.ts` (conversion USD ↔ centimes existante), `src/lib/reglages.ts` (lecture publique en cache : ajouter les lecteurs des forfaits et du retrait sans valeur de repli), `tests/doubles/TEST_dependances-admin.ts` et `TEST_dependances-catalogue.ts`.
- `src/lib/supabase/types.ts` : régénérer par `npm run types` après `db:push`.
- `tests/unit/*` : schémas, service, actions, formulaires, éditeur de tranches ; `tests/unit/messages-parite.test.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] Migration + `reglages_remise.test.sql` + liste blanche -- clés, politique, table, fonctions -- AD-3, AD-13, AD-26
- [ ] Module admin et catalogue : schémas, service, actions, dépendances, lecteurs, tests -- règle 15
- [ ] Page Réglages : sections, éditeur de tranches, messages FR/EN, tests UI -- FR-51, UX-DR43
- [ ] `db:push` sur koma-dev uniquement, puis `npm run types`

**Acceptance Criteria:**
- Given la page Réglages, when Jonathan saisit forfaits, retrait FR/EN et plafond, then chaque valeur est enregistrée, journalisée et confirmée seulement après la réponse de la base ; jamais saisie, elle affiche « Valeur à fixer »
- Given des tranches, when il les enregistre, then elles remplacent les précédentes dans l'ordre, journalisées ; sans tranche, la lecture est vide
- Given `anon`, when il lit `reglage`, then forfaits et retrait sont lisibles et `plafond_fabrication` ne l'est pas
- Given les deux fonctions, then elles sont en lecture pure, exécutables par `anon` et `authenticated`, couvertes par des tests SQL
- Given `lint`, `typecheck`, `test`, `build`, then tous passent ; `test:sql` en CI

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Retrait > 2000 caractères : erreur générique au lieu de l'erreur du champ | medium | patch | schéma externe échoue avant la validation par clé |
| Deux enregistrements simultanés des tranches : violation d'unicité | low | patch | delete sans verrou, correction directe |
| Lecteur de forfait accepte jusqu'à 999 999 centimes (base : 100 000) | medium | patch | bornes différentes |
| Commentaire de `stock_disponible` (Sur-mesure à 0) inexact ; sens du nul non dit | low | patch | commentaire seulement |
| Commentaire « à venir » présuppose la 2.5 | low | patch | commentaire seulement |
| `invaliderReglages` et étiquettes de cache des lecteurs non testés | medium | patch | doubles seulement |
| Éditeur de tranches : focus perdu après Retirer / Ajouter / échec | medium | patch | règle 7 (clavier) |
| Câblage clé → champ de la page Réglages non testé | low | rejeté | types identiques mais éléments visibles et testés par clé dans le formulaire |
| Chevauchement, trous et ordre des tranches non contrôlés | low | rejeté | l'ordre est libre (épic : « ordre »), aucune règle demandée |
| Journal bruyant (supprime/réinsère tout) | low | rejeté | remplacement complet voulu, volumétrie minime |
| `places_fabrication_utilisees` = 0 « donnée simulée » | false | rejeté | exigé par l'épic (aucune commande n'existe) |
| Liste blanche par nom seulement ; permissions SQL supplémentaires | low | rejeté | invoker déjà épinglé, `enregistrer_reglage` revoke inchangé |
| Clé effacée = ligne à valeur nulle | false | rejeté | `lireReglagePublic` traite le nul comme manquant (testé) |
| Longueur UTF-16 contre points de code, messages avec limites en dur, six listes de clés, retirer sans confirmation, compteur de caractères, resynchronisation après enregistrement, réponse tardive | low | rejeté | cosmétique ou sans dommage constaté |

## Design Notes

Dépasse 1600 jetons ; non scindée (base, serveur et écran se testent ensemble). Choix du développeur : `stock_disponible` en `security invoker` (la RLS cache les variantes non publiées) et nul plutôt que 0 si la variante est invisible ; le Plafond reste illisible par le public ; remplacement complet des tranches (pas de modification ligne à ligne) ; 8 tranches au plus.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur
- `npm run test:sql` -- CI

**Manual checks:**
- `/fr/admin/reglages` : saisir les deux forfaits, le retrait FR/EN, le plafond, deux tranches ; recharger ; vérifier la ligne de `journal_audit`.
