---
title: 'Story 9.6 : Emails ciblés'
type: 'feature'
created: '2026-11-10'
status: 'done'
baseline_commit: '72ce262'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Aucun email ne rappelle un panier oublié, un Kit pas commencé ou une nouveauté de l'univers du client (FR-59).

**Approach:** Une planification en base (`planifier_emails_cibles`, pg_cron toutes les 15 min) pose les emails `panier_abandonne`, `rappel_kit`, `nouveau_produit` dans la boîte d'envoi ; le rendu relit la base ; la boîte d'envoi applique les règles de la story 9.4.

## Boundaries & Constraints

**Always:**
- Textes validés par Jonathan (2026-11-10) : panier « Ton panier t'attend » / « Tu as laissé des articles dans ton panier sur {nomSite}. Ils t'y attendent : les prix et la disponibilité sont vérifiés au moment de commander. » ; Kit « Ton kit {kit} t'attend » / « Commence le chapitre 1 de {kit} » ou « Reprends au chapitre {n} » ; produit « Nouveau dans {univers} : {produit} » / « {produit} vient d'arriver dans l'univers {univers}. »
- Panier : 1 h puis 24 h après la dernière modification ; plus envoyé dès que le Panier est payé (vidé) ; Compte qui accepte « Relances et rappels ».
- Kit acheté : 2 jours sans Vidéo démarrée, 7 jours sans Vidéo terminée (90 %).
- Produit publié dans un univers acheté ou préféré, Compte qui accepte « Nouveautés de mon univers ».
- Règles de 9.4 à l'envoi (consentement, désinscription, Compte mineur, un Email commercial tous les 2 jours) ; lien de désinscription dans chaque email ; langue du client.

**Never:** Relances post-achat (9.5) ; Alertes Festival (7.3).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Panier | non vide, modifié il y a 25 h | emails 1 h et 24 h planifiés | 24 h écarté si le 1 h est parti (2 jours) |
| Panier payé | vidé | rendu ignoré | N/A |
| Kit | acheté, pas démarré à 2 j / pas fini à 7 j | rappel planifié | Kit gratuit : jamais |
| Produit | publié < 7 j dans l'univers préféré | planifié | plus vieux : jamais |
| Rejeu | même état | aucun doublon | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261231200000_emails_cibles.sql` : `planifier_emails_cibles`, tâche pg_cron `planifier-emails-cibles`.
- `src/modules/envois/{dependances.ts,modeles/commerciaux.ts,modeles/commun.ts}` : rendu, gabarits, pied de désinscription.
- `messages/{fr,en}.json` : `Emails.commercial`, `panier_abandonne`, `rappel_kit`, `nouveau_produit`.

## Tasks & Acceptance

**Execution:**
- [x] Migration, rendu, gabarits, textes.
- [x] Tests : `supabase/tests/emails_cibles.test.sql` (13), Vitest `envois-commerciaux-modeles`.

**Acceptance Criteria:**
- Given un Email ciblé planifié, when la boîte d'envoi le traite, then les règles de la story 9.4 s'appliquent et l'email porte le lien de désinscription.

## Implementation Notes

- La limite absolue d'un Email commercial tous les 2 jours (règle de l'epic) fait écarter (`ignore`, motif `ecart_2_jours`) l'email de 24 h si celui d'1 h est parti. À valider par Jonathan.
- Fenêtres bornées (Panier 7 jours, Kit 60 jours, Produit 7 jours) pour éviter une vague d'emails à la mise en ligne.

## Spec Change Log

## Review Triage Log

| Constat (relecteur) | Verdict | Preuve / suite |
|---|---|---|
| Rendu commercial (gardes, chapitre, liens) sans test (BH, VG) | medium | banc `envois-dependances-commerciaux.test.ts` (faux client) |
| Emails 1 h et 24 h posés ensemble (BH, EC) | medium | un seul par modification (`20261231210000`) ; test |
| Rappel de Panier pendant un paiement en cours (EC) | medium | exclu ; test |
| « Commence » jusqu'à 60 jours ; Kit jamais démarré sans rappel à 7 jours (BH, EC) | medium | « Commence » de 2 à 7 jours, rappel à 7 jours pour tout Kit non terminé ; tests |
| Nouveau produit déjà possédé (EC) | low | exclu ; test |
| `relance` / `alerte_evenement` rendus par erreur (BH, EC, VG) | medium | aiguillage limité aux trois modèles ; test |
| Clé de désinscription absente : exception à chaque essai (EC) | low | nouvel essai explicite, jamais d'email sans lien ; test |
| Rappel d'un Kit sans accès ou d'un produit qui n'est pas un Kit (EC) | low | vérifié au rendu ; test |
| Seuils 2/7 jours, univers acheté, consentements non testés (BH, VG) | medium | pgTAP (20) |
| Kit d'une Commande remboursée (BH, EC) | false | un Kit n'est jamais remboursé (AD-27) |
| En-têtes List-Unsubscribe (BH) | defer | déjà reporté avec la 9.4 |
| Panier modifié après la planification (EC) | low | l'email reste vrai (Panier non vide) ; rejeté |
| Chapitre calculé sur la dernière position (BH) | low | « Reprends » = dernière position connue ; décision notée |
| Lien de bibliothèque hors `cheminPublic` (BH) | low | `/compte` n'est pas traduit ; rejeté |
| Plusieurs nouveautés dans la semaine (BH) | low | la limite de 2 jours (9.4) s'applique ; rejeté |
| Plusieurs vidéos par Kit (BH) | false | `video_kit` a le produit pour clé primaire : une vidéo par Kit |

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- sans erreur ; CI (pgTAP, e2e) verte
