---
title: 'Story 8.4 : Réalisations'
type: 'feature'
created: '2026-11-09'
status: 'done'
baseline_commit: '48090e7'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un client qui a fabriqué son costume avec un Kit ne peut pas montrer sa Réalisation (FR-42).

**Approach:** « Mon compte › Envoyer une Réalisation » : choix du Kit parmi ceux qu'il a payés, puis envoi comme à la story 8.1 ; côté admin, « Réalisations à valider » avec le Kit déclaré et la preuve d'achat ; la validation est journalisée, horodatée et fixe le rang.

## Boundaries & Constraints

**Always:**
- Kit déclarable = accès dont la Commande d'origine a un `paye_le` ; un Kit gratuit ne compte pas (AD-33). Vérifié par la base.
- Même envoi, même accord de publication, même nettoyage des métadonnées, mêmes règles (Compte mineur, choix d'affichage) qu'aux stories 8.1 et 8.2.
- Validation : date et rang (ordre des Réalisations validées), sans doublon de rang sous concurrence, journalisée.
- La Réalisation validée porte de quoi afficher « Fait avec un kit KOMA » sur le mur (affichage : story 8.3).

**Never:** opération « 10 pass » (8.5) ; affichage public du mur (8.3).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Kit payé | accès avec Commande payée | Réalisation en attente, preuve enregistrée | N/A |
| Kit gratuit ou d'un autre Compte | accès offert / absent | refus `KS_KIT_NON_PAYE` | message sous le champ Kit |
| Aucun Kit payé | Compte sans achat | page qui l'explique, lien vers les Kits | N/A |
| Validation | Réalisation en attente | publiée, datée, rang suivant, journal | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261231190000_realisations.sql` : table `realisation`, `kits_payes`, `deposer_realisation` ; `valider_photo`, `lister_photos_admin`, `lister_mes_photos`, `compter_photos_a_traiter` réécrites.
- `src/modules/communaute/*` (kit transmis, `lireKitsPayes`), `src/components/compte/EnvoiPhotoClient.tsx` (choix du Kit), `src/app/[locale]/compte/realisation/page.tsx`, `src/components/admin/{FilePhotos,TachePhotos}.tsx`.

## Tasks & Acceptance

**Execution:**
- [x] Migration, module, pages, admin, messages FR/EN.
- [x] Tests : `supabase/tests/realisations.test.sql` (14), Vitest `communaute-service`, `communaute-ui`, `galerie-admin-ui`, `galerie-tache`.

**Acceptance Criteria:**
- Given un Kit obtenu gratuitement, when le client le déclare, then la Réalisation est refusée.

## Implementation Notes

- Une Réalisation est une photo de `photo_galerie` reliée à une ligne `realisation` ; la file du personnel la montre dans sa propre section.

## Spec Change Log

## Review Triage Log

| Constat (relecteur) | Verdict | Preuve / suite |
|---|---|---|
| Kit d'une Commande remboursée encore accepté (BH, EC) | false | l'annulation ne porte que sur les lignes physiques (AD-27) ; un Kit n'est jamais remboursé et reste payé |
| Kit reçu gratuit puis acheté, jamais déclarable (BH) | false | le panier refuse un Kit déjà possédé (`KS_KIT_DEJA_POSSEDE`) : ce cas ne peut pas exister |
| Kit vérifié seulement après l'envoi complet (BH) | medium | vérifié dès l'autorisation (aucune photo envoyée pour rien), revérifié en base ; test |
| Aiguillage vers `deposer_realisation` non testé (BH, VG) | medium | test de l'adaptateur |
| Lecture de la Réalisation côté admin non testée (EC, VG) | medium | `galerie-admin-dependances.test.ts` |
| Compteur `a_valider` qui exclut les Réalisations non testé (VG) | medium | objet complet vérifié en pgTAP |
| Rang 2, photo simple, refus sans rang, Kit dans « Mes photos » non testés (BH, VG) | medium | pgTAP (18) |
| Date de paiement vide dans la preuve (BH, EC) | low | repli sur la valeur brute |
| Nom de fonction de repli trompeur (BH, VG) | low | corrigé |
| Bizarreries des tests (BH, VG) | low | corrigées |
| Rang conservé après un retrait ; plusieurs Réalisations par Compte (BH) | low | à trancher avec la 8.5 (un Pass par Compte et par Événement) ; noté |
| Mention « Fait avec un kit KOMA » promise avant le mur (BH) | low | le mur est la story 8.3, qui lira `realisation` ; noté |
| Page `/compte/realisation` sans test (BH) | low | même modèle que les autres pages du Compte ; reporté |
| `kitId` accepté depuis `/compte/photos` (BH) | false | la base vérifie le Kit payé ; c'est alors une Réalisation légitime |
| Réalisation mal formée classée en photo simple (EC) | low | réponse produite par notre propre fonction SQL ; rejeté |

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- sans erreur ; CI (pgTAP, e2e) verte
