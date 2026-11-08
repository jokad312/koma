---
title: 'Story 9.2 : Appliquer un Code promo'
type: 'feature'
created: '2026-11-04'
status: 'done'
baseline_commit: 'ed6dad5fa1a15b8f3dcac055a96c788f876887e4'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-KOMA SHOP-2026-10-17/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le client ne peut pas saisir le code de son influenceur à l'étape de commande ; aucune Commande ne garde le code, la réduction ni le taux de commission (FR-46, FR-47, AD-8, AD-29).

**Approach:** Champ « Code promo » à l'étape de commande (4.3). Le serveur évalue le code, calcule la réduction depuis la base et fige avec la Commande le code, le taux de réduction, le taux de commission et la réduction par ligne.

## Boundaries & Constraints

**Always:**
- Exigence de Jonathan (2026-11-08) : à son paiement, la Commande porte le code utilisé, le taux de réduction et le taux de commission, figés. Modifier un Code promo plus tard ne change jamais une Commande passée ni la commission due. Décision : copie dans `commande_code_promo` par `creer_commande` (AD-8), jamais relue dans `code_promo` ensuite ; `confirmer_paiement` ne revérifie pas le code.
- Plafond vérifié côté serveur, sans compteur stocké (`utilisations_code_promo`, AD-29) ; ligne du code verrouillée avant le comptage.
- Prix, réduction et total calculés côté serveur, depuis la base (règle 3, FR-14) ; réduction jamais sur le Forfait ; `floor`, répartie par ligne, reste sur la dernière ligne.
- Taux de commission jamais lisible par un client (table service seulement).
- Accepté seulement si actif, sous le plafond, `a_deja_achete` faux (une Commande offerte ne compte pas), et aucune autre Commande `en_attente` du Compte avec un code.
- Messages de refus de la story sous le champ, annoncés (UX-DR27) ; origine de la vente = le code (AD-19).
- Migration `20261231100000` déjà appliquée sur koma-dev : tout correctif passe par une nouvelle migration.

**Never:** achat de Pass (7.4 n'existe pas) ; écran des commissions (9.3) ; compteur d'utilisations ; Commande à 0 USD payée.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Code valide | Code actif, premier achat | Réduction affichée, total recalculé, Commande avec `commande_code_promo` figé | N/A |
| Code refusé | Inconnu / inactif / plafond / déjà acheté / second code | Message de la story sous le champ, total sans réduction | `KS_CODE_*` à la création |
| Plafond abaissé | utilisations > plafond | Commandes existantes intactes, nouvelles refusées | `code_plafond` |
| Code modifié après | Taux changés après création | Commande et commission inchangées | N/A |
| Expiration / annulation | Commande expirée ou annulée | Utilisation libérée | N/A |
| Total nul | 100 % sans Forfait | Refusé | `code_total_nul` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261231100000_appliquer_code_promo.sql` -- appliquée : `commande_code_promo`, `utilisations_code_promo`, `a_deja_achete`, `code_promo_evaluer`, `commande_calculer`/`recapitulatif_commande`/`creer_commande` réécrites. NE PAS MODIFIER.
- `supabase/migrations/20261230100000_code_promo.sql`, `20261230110000_code_promo_correctifs_revue.sql` -- table `code_promo` (9.1).
- `src/modules/commande/{types,schemas,service,dependances,queries,admin-queries}.ts` -- code transmis, erreurs `KS_CODE_*`, lecture du code figé (client : code + réduction ; admin : + taux).
- `src/components/commande/{FormulaireCommande,RecapCommande,PageDetailCommande}.tsx`, `src/components/admin/DetailCommandeAdmin.tsx` -- champ, réduction affichée.
- `messages/{fr,en}.json` -- `Commande.code.*`, `Commande.recap.reduction*`.

## Tasks & Acceptance

**Execution:**
- [x] Migration, types, module, composants, messages (travail du 2026-11-04).
- [x] `supabase/tests/appliquer_code_promo.test.sql`, `tests/unit/commande-code-promo{,-ui}.test.ts(x)` -- matrice ci-dessus.
- [x] Vérifier lint, types, tests, build ; revue par sous-agents ; correctifs éventuels dans une nouvelle migration.

**Acceptance Criteria:**
- Given une Commande créée avec un code, when l'admin change ensuite les taux du code, then `commande_code_promo` garde les taux du jour de la Commande.
- Given deux Commandes simultanées sur la dernière utilisation, when elles sont créées, then une seule passe.

## Implementation Notes

- Travail fait le 2026-11-04 avant une coupure de session ; migration poussée sur koma-dev et types régénérés, rien commité. Repris le 2026-11-08.
- `code_total_nul` : texte rédigé par l'agent, à valider par Jonathan.
- Correctifs de revue (2026-11-08) : migration `20261231110000_code_promo_echeance.sql` (appliquée sur koma-dev) ; ligne « Réduction » dans l'email `commande_payee` (`src/modules/envois`, clé `commande_payee.reduction`) ; `{pct, number}` ; messages d'erreur de lecture séparés ; tests pgTAP (+2), UI (+2, un test complété), email (+1).

## Spec Change Log

## Review Triage Log

| Constat (relecteur) | Verdict | Preuve / suite |
|---|---|---|
| Commande échue non encore balayée comptée dans le plafond (EC, BH, VG) | medium | `utilisations_code_promo` sans `expire_le` ; corrigé par la migration `20261231110000`, test pgTAP |
| `code_un_seul` sans `expire_le`, sans `echouee` (EC, BH) | medium | aligné sur `creer_commande` dans la même migration |
| `code_un_seul` inatteignable à la création (BH, VG) | low | `KS_COMMANDE_EN_ATTENTE` passe avant ; le message reste utile au Récapitulatif ; rejeté |
| Email `commande_payee` sans réduction (BH, VG) | medium | lignes + livraison ≠ total ; corrigé, test `envois-modeles` |
| Tests manquants : Zone changée avec un code, code refusé à la création (VG) | medium | ajoutés dans `commande-code-promo-ui.test.tsx` |
| Pourcentage non localisé (BH) | low | corrigé `{pct, number}`, test |
| Messages d'erreur de lecture trompeurs (BH) | low | corrigé |
| Code valide à 0 centime de réduction (EC, BH) | low | sous-total < 100/pct centimes, irréaliste ; reporté (deferred-work) |
| Reste de l'arrondi > montant de la dernière ligne (EC) | low | lignes à quelques centimes seulement ; reporté |
| Réponses de recalcul hors ordre, Confirmer pendant le recalcul (EC, BH) | low | `KS_TOTAL_CHANGE` rattrape côté serveur ; reporté |
| Champ modifié sans réappliquer (BH) | low | le code envoyé est celui affiché comme appliqué ; rejeté |
| Pages détail client/admin sans test de rendu (VG) | medium | lacune antérieure (aucun test de ces pages) ; reporté |
| Taux figés non affichés dans l'admin (BH) | low | écran des commissions = 9.3 ; rejeté |
| `p_sauf_commande` inutilisé, nom `p_code` uuid (BH) | low | signatures déjà appliquées ; rejeté |
| Origine « tiktok » écrasée par le code (BH) | false | décision AD-19 de la spec |
| `enCodeRecap` réduction avec code invalide (BH) | false | la base remet la réduction à 0 quand le code est refusé |
| Suppression d'un code utilisé (BH) | false | la 9.1 n'offre pas de suppression (désactivation seulement) |
| Code à 100 % refusé en passant en retrait (BH) | low | refus annoncé sous le champ (`code_total_nul`) ; rejeté |

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- sans erreur
- CI GitHub (pgTAP) -- verte
