---
title: 'Story 8.2 : Validation, dépôt WhatsApp et retrait des photos'
type: 'feature'
created: '2026-11-09'
status: 'done'
baseline_commit: '2f2114d'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les photos envoyées (8.1) n'ont aucun circuit de validation, de dépôt WhatsApp ni de retrait ; rien ne peut être publié en sécurité (FR-40, FR-41).

**Approach:** Page admin « Galerie » (droit `galerie.valider`) : file à valider, publication d'une copie sans métadonnées dans `produits-public`, refus, retrait immédiat, dépôt d'une photo reçue par WhatsApp ; tâches à compteur réel.

## Boundaries & Constraints

**Always:**
- Décisions de Jonathan (2026-11-08) : dépôt WhatsApp avec la case obligatoire « La personne m'a confirmé avoir 18 ans ou plus » (datée) ; dépôt refusé si la photo est rattachée à un Compte mineur ; publication seulement après validation ; retrait sur simple demande.
- Validation : métadonnées (EXIF, GPS) retirées par le serveur, copie dans `produits-public`, publication journalisée ; un test le prouve.
- Refus : jamais publiée. Tâche « Photos à valider » à compteur réel.
- Dépôt WhatsApp : Compte rattaché (par son email) ou prénom/pseudo et ville acceptés ; « Accord reçu par WhatsApp le [date] » ; choix d'affichage ; capture facultative dans un stockage privé sans politique de lecture.
- Retrait (Compte, contact, parent) : disparaît aussitôt du mur et de `produits-public`, cache `galerie` invalidé, journalisé.

**Never:** affichage public du mur (8.3) ; Réalisations (8.4).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Valider | photo en attente avec GPS | copie publique sans métadonnées, statut publiée, journal | échec base : copie publique effacée |
| Refuser | photo en attente | refusée, original effacé, accord retiré | N/A |
| Retirer | photo publiée | retirée, copie publique effacée, cache invalidé | N/A |
| Dépôt | sans case 18+ ou sans accord | refusé | message |
| Dépôt | Compte rattaché mineur | refusé | message |
| Droits | client | refusé (KS_DROIT_REFUSE) | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261231180000_galerie_validation.sql` : statut `refusee`, colonnes de publication et de source, bucket privé `accords-whatsapp`, fonctions `lister_photos_admin`, `compter_photos_a_traiter`, `valider_photo`, `refuser_photo`, `retirer_photo_admin`, `deposer_photo_whatsapp`, `trouver_compte_par_email` ; `retirer_photo` (client) réécrite.
- `src/modules/communaute/admin-*.ts`, `src/components/admin/{FilePhotos,DepotPhotoWhatsapp,TachePhotos}.tsx`, `src/app/[locale]/admin/galerie/page.tsx`, navigation et tâches.
- `src/lib/cache/etiquettes.ts` (`galerie`) ; purge : seuls les originaux en attente sont protégés.

## Tasks & Acceptance

**Execution:**
- [x] Migration, module, page, tâche, navigation, messages.
- [x] Tests : `supabase/tests/galerie_validation.test.sql` (29), Vitest `galerie-admin-service`, `galerie-admin-ui`.

**Acceptance Criteria:**
- Given une photo avec position GPS validée, when elle est publiée, then la copie publique n'a plus de métadonnées.

## Implementation Notes

- Une photo déposée par WhatsApp rejoint la file « À valider » (deux gestes : déposer, puis valider).
- La date d'accord est bornée en UTC (base et formulaire).

## Spec Change Log

## Review Triage Log

| Constat (relecteur) | Verdict | Preuve / suite |
|---|---|---|
| Copie publique effacée par le `catch` après une publication enregistrée ; réponse de la base perdue (EC) | high | `fichier` remis à null dès la publication ; ligne relue avant tout effacement ; test |
| Retrait : copie publique restée accessible si son effacement échoue (EC) | high | copie publique effacée avant la base ; échec = rien ne change, retrait rejouable ; tests |
| Copie publique non effacée après un refus de la base, sans journal (EC) | medium | effacement protégé et journalisé |
| Validation d'un Compte devenu mineur non testée en SQL (VG) | medium | pgTAP ajouté (33) |
| Faux zéro dans la tâche (BH, EC, VG) | medium | deux entiers exigés, sinon message d'erreur ; test de rendu |
| Message de succès perdu au rechargement (EC) | medium | zone d'état hors de la liste |
| Refus et retrait sans confirmation (BH) | medium | étape de confirmation ; test |
| « Retraits demandés » sans section (BH) | low | section dédiée avec compteur |
| Assistant sans accès aux compteurs (EC) | low | compteurs dans les titres de la page Galerie |
| Formulaire de dépôt partiellement remis à zéro (BH) | medium | remise à zéro complète, date comprise |
| Date d'accord : limite d'un an invisible, date impossible (BH, EC) | low | bornes min/max, message, contrôle de date réelle ; tests |
| Photo illisible : message de format trompeur (BH) | low | `photo_illisible` |
| Capture identique à la photo (EC) | low | refusée |
| Chemin d'envoi admin non testé (VG) | medium | test `demanderEnvoiDepot` + `CHEMIN_ENVOI_ADMIN` |
| Aperçus des photos publiées/refusées non testés (VG) | low | test complété |
| Spinner sur les deux boutons, clics ignorés sans retour (BH) | low | spinner sur le seul bouton cliqué, `aria-disabled` |
| Taille réelle non vérifiée (BH) | false | limite de 15 Mo et formats imposés par le bucket `galerie-attente` |
| `compter_photos_a_traiter` sans contrôle de droit (BH) | low | lue par le serveur seulement, droit de la page vérifié ; rejeté |
| Tri des publiées contraire au commentaire (BH, EC, VG) | low | reporté |
| Pagination de la file (BH, EC) | low | reporté |
| Règle anti-invisibles absente en SQL (BH) | low | appliquée par le service ; rejeté |
| Fuseau UTC entre 0 h et 2 h à Goma (BH, EC) | low | bornes base et formulaire alignées en UTC ; rejeté |
| Double dépôt simultané (EC) | low | reporté |
| `publiee_le` effacé au retrait (BH) | low | conservé dans le journal ; rejeté |
| Purge : filtre « en attente » non testé (VG) | defer | adaptateur de la route sans banc de test |

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- sans erreur ; CI (pgTAP, e2e) verte
