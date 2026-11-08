---
title: 'Story 9.3 : Ventes et commissions par Code promo'
type: 'feature'
created: '2026-11-08'
status: 'done'
baseline_commit: '3cbc2c7'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Jonathan ne voit pas ce que chaque Code promo a rapporté ni ce qu'il doit à l'Affilié (FR-48).

**Approach:** Une vue SQL `commission_code_promo`, seule source du calcul (AD-27), lue par la page admin Codes promo : nombre de ventes, montant, commission due, pour chaque code.

## Boundaries & Constraints

**Always:**
- Seules comptent les Commandes avec un `paye_le` (une Commande offerte n'en a pas).
- Montant = somme de (prix × nombre − `reduction_cents`) des lignes non annulées, donc hors livraison (AD-27).
- Commission = montant × taux FIGÉ de la Commande (`commande_code_promo.commission_pct`), jamais le taux actuel du code.
- Une Commande dont toutes les lignes sont annulées (remboursée en entier) ne compte ni comme vente ni en montant ; une Commande mixte annulée garde la ligne Kit conservée.
- Vue service seulement (aucun droit client), page sous le droit `codes_promo.gerer`.

**Never:** aucun paiement de commission par le site ; aucun compteur stocké ; aucune donnée inventée (code sans vente : 0).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Vente payée | Commande payée avec code | comptée, montant hors livraison, commission au taux figé | N/A |
| Non payée | en attente, expirée, offerte | non comptée | N/A |
| Annulation mixte | Cosplay annulé, Kit gardé | seule la ligne Kit compte | N/A |
| Remboursée en entier | toutes les lignes annulées | non comptée | N/A |
| Taux modifié après | commission du code changée | commission inchangée | N/A |
| Aucune vente | code neuf | 0 vente, 0 USD | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261231120000_commission_code_promo.sql` -- vue `commission_code_promo` (security_invoker, service_role seul).
- `src/modules/promo/{types,queries}.ts` -- `lireCodesPromoAdmin` joint la vue (ventes, montant, commission).
- `src/components/admin/ListeCodesPromo.tsx` -- trois valeurs par code, en USD par `formaterUsd`.
- `messages/{fr,en}.json` -- `Admin.codesPromo.ventes.*`.

## Tasks & Acceptance

**Execution:**
- [x] Migration + `supabase/tests/commission_code_promo.test.sql` (matrice).
- [x] Lecture, liste, messages ; tests `promo-admin-ui`, requête.

**Acceptance Criteria:**
- Given la page Codes promo, when Jonathan l'ouvre, then chaque code montre ventes, montant et commission due, lus dans la vue.

## Design Notes

Arrondi : commission de chaque Commande arrondie au centime inférieur (`floor`), puis additionnée ; même règle que la réduction (AD-8). Aucune somme ne dépasse ce qui est dû.

## Implementation Notes

- Migrations `20261231120000_commission_code_promo.sql` et `20261231130000_commission_code_promo_vente.sql` (correctif de revue), appliquées sur koma-dev, types régénérés. Lecture réelle sur koma-dev : la vue répond au serveur, `anon` reçoit 42501.
- Une vente disparaît dès que toutes ses lignes sont annulées (le remboursement suit toujours une annulation : `confirmer_remboursement` exige `annulee`).

## Spec Change Log

## Review Triage Log

| Constat (relecteur) | Verdict | Preuve / suite |
|---|---|---|
| Vente à 0 USD (code 100 % + livraison) non comptée (BH, EC) | medium | filtre `montant > 0` ; corrigé : `bool_or(not annulee)`, migration `20261231130000`, test |
| Test `promo-dependances` rouge (VG) | high | faux client sans la vue ; corrigé |
| Matrice : expirée non testée, état annulé avant remboursement, taux figés mélangés, arrondi global (BH) | medium | tests pgTAP ajoutés (19) |
| Droits testés par `information_schema` seulement (BH) | low | `has_table_privilege` ajouté |
| `aria-label` sur `<dl>` non annoncé (BH) | low | `role="group"` ajouté |
| Commandes offertes non testées (BH) | false | `creer_commande` seule crée un `commande_code_promo` ; une Commande offerte n'en a jamais |
| Ligne à réduction > montant (EC) | low | reste d'arrondi, déjà reporté (9.2) |
| Tronquage PostgREST (EC) | low | quelques codes, limite 1000 ; rejeté |
| `Number` non sûr (EC) | low | centimes ≪ 2^53 ; rejeté |
| `langue as Locale` (BH, EC) | low | même usage que le reste du code ; rejeté |
| Types locaux au lieu des types générés (BH) | low | style existant du module 9.1 ; rejeté |
| Total tous codes (BH) | false | non demandé (règle 14) |
| Ordre des clés FR/EN (BH) | low | sans effet ; rejeté |

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- sans erreur ; CI (pgTAP) verte
