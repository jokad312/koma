---
title: 'Correctif 2.2 : suppression d''une photo, texte alternatif modifiable, purge des envois abandonnés'
type: 'bugfix'
created: '2026-10-27'
status: 'done'
baseline_commit: 'a41cacc74d658a0775305a4aa9de80c23aa28b12'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-2-photos-et-publication-d-un-produit.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Depuis la 2.2, une photo mal envoyée ou un texte alternatif fautif ne peut ni être retiré ni être corrigé : une erreur reste définitive sur un produit, alors que Jonathan va charger son vrai catalogue. Les envois abandonnés (onglet fermé, coupure) laissent aussi des originaux dans le bucket privé `galerie-attente`.

**Approach:** Deux fonctions d'écriture journalisées (`supprimer_photo_produit`, `modifier_alt_photo`), un garde différé qui interdit de retirer la dernière photo d'un produit publié, la suppression du fichier public après la base, les actions et l'interface dans la fiche d'édition, et une route de purge protégée par secret qui efface les originaux de `galerie-attente` de plus de 24 h (sans planification : il n'y a pas encore de domaine).

## Boundaries & Constraints

**Always:** Nouvelle migration seulement. Mêmes règles d'écriture qu'en 2.2 (`SECURITY DEFINER`, `search_path = ''`, `p_auteur jsonb` en premier, `exiger_admin`, `ks.auteur` avant le DML, `REVOKE`/`GRANT service_role`, journal par le déclencheur existant de `produit_photo`). `modifier_alt_photo(p_auteur, p_photo_id, p_alt_fr, p_alt_en)` : 1 à 200 caractères chacun (`KS_ALT_INVALIDE`), `KS_PHOTO_INTROUVABLE`. `supprimer_photo_produit(p_auteur, p_photo_id)` : supprime la ligne, renumérote les positions de façon contiguë 1..n, renvoie le fichier public supprimé pour que le serveur l'efface du bucket `produits-public` APRÈS la réponse de la base (un échec d'effacement est journalisé sans annuler la suppression en base) ; retirer la dernière photo d'un produit PUBLIÉ est refusé (`KS_PUBLICATION_INCOMPLETE`) par un déclencheur de contrainte différé sur `produit_photo` (comme `produit` et `variante` en 2.2) ; retirer la dernière photo d'un brouillon est permis. Cache : `updateTag` `catalogue` après chaque succès.
Interface (fiche d'édition, `Admin.produits.photos.*`, tutoiement) : sur chaque photo, bouton « Supprimer la photo N » (nom complet, 44 px) qui ouvre la boîte de dialogue existante de confirmation (Annuler / Supprimer) ; formulaire « Modifier le texte alternatif de la photo N » (champs FR et EN, libellés visibles, erreur sous le champ reliée par `aria-describedby`, saisie conservée après échec) ; succès annoncé en `role="status"` seulement après la réponse réelle ; focus après suppression sur le bouton « Ajouter » ou la photo voisine ; message clair si la suppression est refusée (dernière photo d'un produit publié : « dépublie le produit d'abord »). Les boutons Monter/Descendre restent corrects après suppression.
Purge : route serveur `GET/POST /api/cron/purger-galerie-attente`, refusée (401) sans l'en-tête `Authorization: Bearer <CRON_SECRET>` (comparaison à temps constant, `CRON_SECRET` lue dans l'environnement, jamais en dur), qui liste `galerie-attente` par le client service et efface les objets de plus de 24 h (constante nommée), répond avec le nombre d'objets effacés (jamais leurs noms) et journalise sans donnée personnelle ; pas de planification (aucun domaine : Q-D1) ; la mise en place du Cron (Hostinger ou Supabase) est notée dans `journal-enchainement.md`. Variable déjà dans `.env.example` ; sinon l'y ajouter.
Tests : SQL (droits, journal, renumérotation, garde de la dernière photo d'un publié, brouillon permis, alt invalide) ; service et actions (ordre base puis fichier, échec d'effacement journalisé, cache invalidé) ; UI (dialogue, formulaire, focus) ; route de purge (401 sans secret, secret faux, effacement des seuls objets de plus de 24 h) avec un stockage simulé nommé `TEST_`.

**Never:** Pas de remplacement du fichier d'une photo (supprimer puis ajouter), pas de modification de la hauteur ou du recadrage, pas de planification Cron, pas de modification d'une migration appliquée, pas de `npm run dev`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Supprimer une photo | 3 photos, la 2e | ligne retirée, positions 1..2 contiguës, fichier public effacé, journalisé | N/A |
| Dernière photo d'un brouillon | 1 photo | supprimée | N/A |
| Dernière photo d'un publié | produit publié, 1 photo | refusée, rien supprimé | message « dépublie d'abord » |
| Corriger l'alt | FR/EN valides | enregistré, journalisé avant/après | vide ou > 200 : refusé |
| Échec d'effacement du fichier | stockage en erreur | suppression en base conservée, erreur journalisée | N/A |
| Assistant / Compte simple | action | refus serveur | `non_autorise` |
| Purge sans secret | requête anonyme | 401, rien effacé | N/A |
| Purge avec secret | objets de 2 h et de 30 h | seul celui de 30 h est effacé | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261024100000_photos_et_publication.sql` (`produit_photo`, `ajouter_photo_produit`, `deplacer_photo_produit`, déclencheurs différés) : modèle, ne pas modifier. Nouvelle `supabase/migrations/20261028100000_supprimer_et_corriger_photo.sql` ; tests `supabase/tests/photo_suppression_alt.test.sql` ; liste blanche inchangée (fonctions réservées à `service_role`).
- `src/modules/catalogue/{service,actions,dependances,types,schemas,queries}.ts`, `src/components/admin/GaleriePhotos.tsx`, `src/components/ui/Dialogue.tsx`, `messages/{fr,en}.json` (`Admin.produits.photos`), `tests/doubles/TEST_dependances-catalogue.ts`.
- Nouveau `src/app/api/cron/purger-galerie-attente/route.ts` (modèle des routes `api` existantes, ex. `src/app/api/sante`), `.env.example`, `src/lib/supabase/types.ts` (régénéré après le push).

## Tasks & Acceptance

**Execution:**
- [ ] Migration + test SQL -- suppression, alt, garde différé
- [ ] Service, actions, dépendances, interface, messages FR/EN, tests
- [ ] Route de purge protégée par secret et ses tests
- [ ] `db:push` sur koma-dev après la revue, puis `npm run types`

**Acceptance Criteria:**
- Given une photo, when Jonathan la supprime après confirmation, then la ligne et le fichier public disparaissent, les positions restent contiguës et l'action est journalisée
- Given un produit publié à une seule photo, when il tente de la supprimer, then c'est refusé avec un message clair
- Given une photo, when il corrige son texte alternatif FR/EN, then c'est enregistré, journalisé et confirmé après la réponse réelle
- Given la route de purge, then sans secret valide elle répond 401 et n'efface rien ; avec le secret elle n'efface que les originaux de plus de 24 h
- Given `lint`, `typecheck`, `test`, `build`, then tous passent ; `test:sql` en CI

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Suppression réussie en base mais `fichier` nul : erreur affichée, cache non invalidé | medium | patch | ligne déjà supprimée |
| `modifier_alt_photo` réussit sur 0 ligne ; produit disparu non détecté | medium | patch | UPDATE sans contrôle |
| Renumération vs contrainte d'unicité, non testée avec 5 photos | medium | patch | test à 3 photos seulement |
| Annuler actif pendant la suppression ; alt non resynchronisé ; erreur attribuée au champ français | medium | patch | interface |
| Purge sur GET, schéma Bearer sensible à la casse, tri absent, âge sans `updated_at`, compte non réel, échec partiel en 200, pagination non testée | medium | patch | route et logique de purge |
| Orphelins de `produits-public` sans balayage | low | defer | à traiter avec les tâches Cron |
| Focus armé non effacé, suppression concurrente par un autre admin, formulaires toujours visibles, limites dupliquées | low | rejeté | cas rares ou cosmétiques |
| Parcours profond du bucket, tentative de commit réel via PostgREST | low | rejeté | disposition à deux niveaux documentée ; le garde différé est prouvé en SQL |

## Design Notes

Choix du développeur : la suppression du fichier public suit la base (un orphelin vaut mieux qu'une photo cassée) ; la purge n'est pas planifiée faute de domaine, la route est prête et testée.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur
- `npm run test:sql` -- CI

**Manual checks:**
- Fiche d'un produit : supprimer une photo (confirmation), corriger un texte alternatif, tenter de supprimer la dernière photo d'un produit publié.
