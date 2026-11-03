# Proposition de changement de sprint : K-Pay abandonné (2026-11-03)

**Décision de Jonathan (2026-11-03) :** K-Pay est abandonné, comme GeniusPay. Le mobile money passe par PawaPay et MaishaPay. La carte d'un Panier avec Produit physique ou d'un Pass passe par MaishaPay si sa documentation le permet. Polar reste réservé aux Paniers 100 % Kits.

**Vérification (règle 15) :** la documentation de MaishaPay prévoit la carte (CyberSource : Visa, Mastercard, American Express ; devises USD et EURO ; V2 et V3). Le cas d'arrêt « la documentation ne permet pas la carte » ne s'applique donc pas. Les points non tranchés par la documentation sont des questions ouvertes (voir `docs/references/paiements/maishapay.md`, hors dépôt) et gardent MaishaPay non activable.

## Documents changés
| Document | Changement |
|---|---|
| `CLAUDE.md` | Stack, règle 2 (MaishaPay : notification = signal, API fait foi), règles 9 et 10 (deux Agrégateurs, carte via MaishaPay), règle 15 |
| PRD (§4.4, §6.1, risques R-3 et R-4, Q-1, Q-2, Q-14) | Deux Agrégateurs, carte via MaishaPay ; Q-14 rouverte (compte MaishaPay à créer pour KOMA SHOP, carte à confirmer) |
| Architecture (AD-5, AD-6, schéma, Q-3, Q-S1) | Matrice de choix, adaptateurs, vérification de MaishaPay par contre-vérification seule |
| `epics.md` | FR-15 à FR-17, FR-33, Epic 5 ; stories 5.4 et 5.5 retirées (numéros non réutilisés) ; 5.6 réécrite ; nouvelle 5.9 (carte MaishaPay) ; nouvelle 4.8 (socle de confirmation extrait de la 4.7) |
| `EXPERIENCE.md`, `DESIGN.md` | « K-Pay » devient « MaishaPay » (carte) |
| `sprint-status.yaml` | 5.4 et 5.5 retirées, 5.9 et 4.8 ajoutées |
| `.env.example` | Variables MaishaPay |
| Base (migration `20261206100000_retrait_kpay.sql`) | Retrait du Prestataire `kpay`, contrainte des codes, MaishaPay propose la carte et passe au rang 2 |
| Code et tests | `CODES_PRESTATAIRE`, aiguilleur (carte physique et Pass → `maishapay`), textes admin, tests Vitest et pgTAP |

## Documents laissés tels quels (historique, non normatifs)
Journaux de mémoire des planifications (`.memlog.md`), rapports de revue, extraits de sources, brief, rapports de validation UX et maquettes HTML de `mockups/` (inspiration seulement : en cas de conflit, `DESIGN.md` et `EXPERIENCE.md` priment). Le guide `docs/guide-koma-shop.md` garde son texte paiement « conservé pour mémoire » ; seules ses deux notes de remplacement sont à jour.

## Nouvelle séquence des stories de paiement
4.8 (socle : `confirmer_paiement`, route de notification, réconciliation) → 5.6 (MaishaPay mobile money) → 5.9 (MaishaPay carte). 4.7 (Polar) et 5.7 (PawaPay) restent à faire, en attente de leurs clés et de leur documentation.
