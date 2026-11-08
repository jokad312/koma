---
title: 'Story 8.1 : Envoyer sa photo depuis son Compte'
type: 'feature'
created: '2026-11-08'
status: 'done'
baseline_commit: 'da6d770'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un client ne peut pas envoyer la photo de lui dans son costume pour le mur « Ils le portent » (FR-40, FR-41).

**Approach:** « Mon compte › Envoyer une photo » : envoi signé vers le bucket privé `galerie-attente`, contrôle et nettoyage par le serveur, accord de publication par photo dans `consentement`, choix d'affichage, état réel et retrait à la demande.

## Boundaries & Constraints

**Always:**
- Texte de l'accord (Jonathan, 2026-11-08), case obligatoire décochée : FR « J'autorise la publication de cette photo sur le site et ses réseaux sociaux, avec mon pseudo. Je confirme être la personne photographiée (ou avoir son accord) et avoir le droit de partager cette photo. Je peux demander son retrait à tout moment. » ; EN « I allow this photo to be published on the website and its social media, with my username. I confirm I am the person in the photo (or have their consent) and have the right to share it. I can ask for it to be removed at any time. »
- Règles de Jonathan : publication seulement après validation de l'admin (8.2) ; retrait sur simple demande ; métadonnées retirées (position GPS) ; moins de 18 ans déclarés : photo jamais publiée (décision d'application : l'envoi est refusé, avec un message).
- JPEG, PNG, WebP, 15 Mo au plus ; progression, reprise, « Annuler l'envoi » ; limite `consommer_essai`.
- Choix d'afficher ou non le pseudo et la ville ; état réel (en attente, publiée, retirée) ; demande de retrait.
- Email `commande_livree` : lien vers « Envoyer une photo » à côté de l'invitation WhatsApp.
- Aucune lecture publique : RLS, aucun droit client ; une désinscription des emails ne retire jamais l'accord de publication.

**Never:** validation, publication, mur public (8.2, 8.3) ; dépôt WhatsApp par l'admin (8.2).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Envoi | photo JPEG avec GPS, accord coché | copie sans métadonnées dans `photos-clients/`, photo en attente, accord enregistré | N/A |
| Sans accord | case décochée | refus, rien n'est envoyé | message sous la case |
| Format | HEIC, > 15 Mo, faux contenu | refus | formats et limite rappelés |
| Mineur | âge déclaré < 18 | envoi impossible | message |
| Retrait | photo en attente | retirée aussitôt, fichier effacé, accord retiré | N/A |
| Retrait | photo publiée | demande enregistrée (l'admin la retire en 8.2) | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261231170000_photo_galerie.sql` : `photo_galerie`, `consentement.cible_id` (accord par photo), `deposer_photo_galerie`, `lister_mes_photos`, `retirer_photo`, `desinscrire` limité aux emails.
- `src/modules/communaute/*`, `src/components/compte/{EnvoiPhotoClient,RetirerPhoto}.tsx`, `src/app/[locale]/compte/photos/page.tsx`, navigation du Compte.
- `src/modules/catalogue/purge.ts` : `photos-clients/` jamais purgé ; `envois-photos/` purgé après 24 h.
- `src/modules/envois/{dependances.ts,modeles/statut-commande.ts}` : lien de l'email livré.

## Tasks & Acceptance

**Execution:**
- [x] Migration, module, page, email, purge, messages FR/EN.
- [x] Tests : `supabase/tests/photo_galerie.test.sql` (24), Vitest `communaute-service`, `communaute-ui`, email, purge.

**Acceptance Criteria:**
- Given une photo envoyée avec une position GPS, when le serveur la finalise, then la copie gardée n'a plus de métadonnées.

## Implementation Notes

- HEIC sur iPhone : le champ n'accepte que JPEG, PNG et WebP ; Safari convertit alors la photo en JPEG au moment du choix. À vérifier à la main sur un iPhone (non automatisable).
- Les métadonnées sont retirées dès l'envoi (la 8.2 publiera la copie déjà nettoyée).

## Spec Change Log

## Review Triage Log

| Constat (relecteur) | Verdict | Preuve / suite |
|---|---|---|
| Envoi non lié au Compte : finaliser/annuler l'envoi d'un autre (BH, EC) | high | chemin `envois-photos/<compte>.<uuid>.<ext>`, vérifié ; test |
| Fichiers orphelins dans `photos-clients/` jamais purgés (BH, EC, VG) | medium | purge des fichiers anciens sans photo vivante en base ; base illisible = rien effacé ; tests |
| Copie nettoyée non effacée si l'enregistrement lève (BH, EC, VG) | medium | `catch` corrigé, échecs journalisés ; test |
| Email livré : « aussi » sans WhatsApp ; lien envoyé à un mineur (BH, EC, VG) | medium | texte autonome `photoCompteSeul`, lien absent pour un Compte mineur ; tests |
| Erreur `affichage_invalide` invisible (BH) | medium | message général ; test |
| Caractères invisibles (U+200B, U+202E) dans le pseudo (EC) | low | `\p{Cf}` refusé ; test |
| Effacement qui lève après un retrait réussi (EC) | low | succès conservé, échec journalisé ; test |
| « Annuler l'envoi » non testé (VG) | medium | test ajouté |
| Lecture des réponses SQL non testée (VG) | medium | `communaute-dependances.test.ts` |
| Unicité de l'accord par photo non testée (BH) | low | pgTAP (26) |
| Taille contrôlée après téléchargement (BH) | false | le bucket `galerie-attente` limite à 15 Mo et aux trois formats (migration 2.2) |
| Accord « avec mon pseudo » alors que le pseudo peut être masqué (BH) | maybe-false | texte de Jonathan : question posée |
| Accord actif pendant une demande de retrait (BH) | low | l'admin retire en 8.2 ; rejeté |
| `cible_id` sans clé étrangère (BH) | low | cible générique (photo aujourd'hui) ; rejeté |
| Compte incomplet renvoyé vers la connexion (BH) | low | même règle que « Mes commandes » ; rejeté |
| Annonce de chaque pourcentage (BH) | low | même composant que l'admin ; reporté |
| Deux finalisations simultanées du même envoi (EC) | low | double clic bloqué côté client ; reporté |
| Aperçus expirés après 10 min (BH) | low | rechargement suffit ; rejeté |
| `rendre` de l'email sans banc de test (VG) | defer | aucun test de `envois/dependances.ts` dans le dépôt |

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- sans erreur ; CI (pgTAP, e2e) verte
