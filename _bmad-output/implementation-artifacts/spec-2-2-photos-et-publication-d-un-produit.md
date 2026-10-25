---
title: 'Story 2.2 : photos et publication d''un produit'
type: 'feature'
created: '2026-10-25'
status: 'done'
baseline_commit: 'b14d93c4142e1f3d269703522f1a8a1c107c792b'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un produit physique créé en 2.1 reste un brouillon sans photo et sans moyen d'être publié : aucun stockage de photos, aucun ordre, aucune règle de complétude, aucun moyen d'apparaître (ou de disparaître) côté public.

**Approach:** Deux buckets Storage (privé `galerie-attente`, public `produits-public`), table `produit_photo`, fonctions d'écriture journalisées (ajout, déplacement, publication, dépublication), envoi TUS direct du navigateur sur autorisation signée par le serveur, nettoyage des métadonnées par sharp côté serveur avant copie dans le bucket public, éditeur de photos et panneau de publication dans la fiche d'édition admin, invalidation du cache par étiquette.

## Boundaries & Constraints

**Always:** Nouvelles migrations seulement. Fonctions d'écriture comme en 2.1 (`SECURITY DEFINER`, `search_path = ''`, `p_auteur jsonb` en premier, `exiger_admin`, `ks.auteur` avant le DML, `REVOKE` à `public/anon/authenticated`, `GRANT` à `service_role`, trigger `journaliser('id')` sur `produit_photo`). Droit `produits.modifier` revérifié par `exigerDroit` dans chaque action.
Buckets (migration) : `galerie-attente` privé, `produits-public` public ; l'un et l'autre limités à 15 Mo (15 728 640 octets) et à `image/jpeg`, `image/png`, `image/webp` ; aucune politique sur `storage.objects` pour `anon` ni `authenticated` (écriture et lecture de `galerie-attente` : service ou jeton signé seulement).
Envoi : l'action `demanderEnvoiPhoto` vérifie le droit, le produit, le type (liste ci-dessus), la taille (≤ 15 Mo) et le nombre de photos (10 au plus par produit), puis renvoie un jeton `createSignedUploadUrl` pour un objet `galerie-attente/<produit>/<uuid>.<ext>` choisi par le serveur. Le navigateur envoie en TUS (`tus-js-client`, points d'accès `/storage/v1/upload/resumable`, en-tête `x-signature`, morceaux de 6 Mo, reprise après coupure) ; barre de progression avec la valeur en texte, « Annuler l'envoi ». Un fichier refusé (type ou taille) est refusé avant tout envoi, avec un message qui rappelle JPEG, PNG, WebP et 15 Mo.
Finalisation (`finaliserPhoto`, serveur) : relit l'objet d'attente, vérifie par sharp que son contenu réel est JPEG, PNG ou WebP (le type annoncé ne suffit pas), applique l'orientation puis ré-encode sans AUCUNE métadonnée (EXIF, GPS), écrit le résultat dans `produits-public/<produit>/<uuid>.<ext>`, enregistre la photo par `ajouter_photo_produit`, puis efface l'original d'attente. En cas d'échec après l'écriture publique, l'objet public est effacé (aucun fichier orphelin) ; l'original d'attente est effacé dans tous les cas.
`produit_photo(id, produit_id on delete cascade, fichier, alt_fr, alt_en, position, cree_le)` : `fichier` (et non « chemin » : fichier d'un bucket public, lisible par `anon` avec son produit publié) ; `alt_fr` et `alt_en` obligatoires, 1 à 200 caractères (`KS_ALT_INVALIDE`) ; `position` entière ≥ 1, ordre `position` ; RLS : `SELECT` seulement pour `anon`/`authenticated`, photos d'un produit publié et passé. `ajouter_photo_produit(p_auteur, p_produit_id, p_fichier, p_alt_fr, p_alt_en) returns uuid` (ajoute en dernière position ; `KS_PRODUIT_INTROUVABLE`, `KS_PHOTOS_LIMITE`, `KS_FICHIER_INVALIDE`, `KS_ALT_INVALIDE`). `deplacer_photo_produit(p_auteur, p_photo_id, p_sens)` avec `p_sens` `haut` ou `bas` (renumérote 1..n de façon contiguë ; en bout de liste : sans effet, sans erreur).
Publication : `manques_publication(produit_id) returns text[]` (interne, service seulement) renvoie parmi `prix`, `photo`, `titre_en`, `description_fr`, `description_en`, `variante` (le titre français est déjà obligatoire ; le texte alternatif de chaque photo l'est à l'ajout). `publier_produit(p_auteur, p_id)` refuse (`KS_PUBLICATION_INCOMPLETE`) s'il manque quelque chose, sinon pose `publie_le = now()` ; déjà publié : sans effet. `depublier_produit(p_auteur, p_id)` remet `publie_le` à nul. Un déclencheur différé (fin de transaction) sur `produit` et `variante` refuse (`KS_PUBLICATION_INCOMPLETE`) qu'un produit publié devienne incomplet (prix effacé, dernière variante supprimée…). Un déclencheur refuse (`KS_PRODUIT_PUBLIE_VERROUILLE`) de changer le slug ou la famille d'un produit publié. Un déclencheur tient `modifie_le` à jour. Journal : trigger existant sur `produit`.
Cache : à la publication et à la dépublication, `updateTag` sur l'étiquette `catalogue` (ajoutée à `src/lib/cache/etiquettes.ts`), appelée par la Server Action après la réponse réelle de la base.
Interface (fiche d'édition, `messages/{fr,en}.json` `Admin.produits.photos`, `Admin.produits.publication`, tutoiement, sans emoji) : liste des photos avec miniature, textes alternatifs, boutons Monter / Descendre de 44 px au nom complet (« Monter la photo 2 : <texte> »), `aria-disabled` en bout de liste, résultat annoncé en `role="status"` ; formulaire d'ajout (fichier + texte alternatif FR + EN, libellés visibles, erreur sous le champ reliée par `aria-describedby`) ; panneau de publication : pastille de statut icône + mot (Brouillon / Publié), bouton « Publier » (« Dépublier » si publié), liste des manques en `role="alert"` quand la publication est refusée, succès affiché seulement après la réponse réelle ; la liste des produits affiche « Publié » ; 375 px sans défilement horizontal ; `next/image` avec `images.remotePatterns` dérivé de `NEXT_PUBLIC_SUPABASE_URL`.
Tests : images générées par les tests (jamais une image tierce, règle 6) ; une photo avec position GPS ressort sans elle ; matrice SQL (droits, RLS brouillon/publié, bornes, déclencheurs, buckets).

**Never:** Pas de suppression ni de modification de texte alternatif d'une photo (reporté dans `deferred-work.md`) ; pas de catalogue ni de fiche publics, de plan du site, d'URL directe ni de JSON-LD (2.4, 2.5) ; pas de remise, de forfait ni de Plafond (2.3) ; pas de héros vidéo (2.6) ; pas d'écriture de table depuis le navigateur ; pas d'autre photo que celles envoyées par Jonathan ; aucune image tierce dans le dépôt ; pas de modification d'une migration appliquée ; pas de `npm run dev`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Ajouter une photo | JPEG 2 Mo + alt FR/EN | jeton signé, envoi TUS, nettoyée, copiée, enregistrée en dernière position, original d'attente effacé | N/A |
| Photo avec GPS | JPEG avec EXIF GPS | publiée sans aucune métadonnée | N/A |
| Format refusé | GIF, PDF, faux `.jpg` (contenu texte) | refusé, message avec formats et limite | `format_invalide` |
| Trop lourde | 16 Mo | refusée avant envoi | `fichier_trop_lourd` |
| Alt manquant | FR vide | refusé | `alt_invalide` |
| 11e photo | 10 déjà là | refusée | `photos_limite` |
| Coupure réseau | envoi en cours | reprise automatique, progression conservée ; « Annuler l'envoi » arrête et efface | message d'échec si abandon |
| Monter / Descendre | 3 photos | ordre échangé, positions contiguës ; en bout : `aria-disabled`, sans effet | N/A |
| Publier incomplet | sans prix ni photo | refusé, liste des manques | `KS_PUBLICATION_INCOMPLETE` |
| Publier complet | tout fourni | `publie_le` posé, journalisé, étiquette invalidée | N/A |
| Dépublier | produit publié | introuvable côté public, journalisé | N/A |
| Publié devenu incomplet | prix effacé via le formulaire | refusé | `KS_PUBLICATION_INCOMPLETE` |
| Changer slug d'un publié | publié | refusé | `KS_PRODUIT_PUBLIE_VERROUILLE` |
| Assistant / Compte simple | action | refus serveur | `non_autorise` |
| Échec serveur | storage ou rpc en erreur | pas de succès, rien d'orphelin | `generique` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261023100000_creer_catalogue_physique.sql` -- modèle des fonctions et déclencheurs ; ne pas modifier. Nouvelle `supabase/migrations/20261024100000_photos_et_publication.sql` (buckets, `produit_photo`, fonctions, déclencheurs) ; tests `supabase/tests/photos_publication.test.sql` ; `garde_*` doivent rester verts sans liste blanche.
- `src/modules/catalogue/{types,schemas,service,actions,dependances,queries}.ts` -- étendre (ne pas dupliquer) : dépendances injectées (`signerEnvoiPhoto`, `lireObjetAttente`, `ecrireObjetPublic`, `supprimerObjets`, `ecrirePhoto`, `deplacerPhoto`, `changerPublication`, `invaliderCatalogue`, `lireProduitComplet`) ; nouveaux `photo.ts` (sharp : `nettoyerPhoto`) et `publication.ts` (pur : `manquesPublication`).
- `src/lib/supabase/stockage.ts` -- `urlPhotoPublique(fichier)` depuis `NEXT_PUBLIC_SUPABASE_URL` ; `src/lib/cache/etiquettes.ts` ; `next.config.ts` (`images.remotePatterns`).
- `src/components/admin/{GaleriePhotos,EnvoiPhoto,PublicationProduit,ListeProduits}.tsx`, `src/app/[locale]/admin/produits/[id]/page.tsx` ; `lireProduitAdmin` renvoie aussi les photos.
- `tests/doubles/TEST_dependances-catalogue.ts`, `tests/unit/*` (photo.ts avec images générées par sharp, publication, service, UI), `tests/e2e/admin.spec.ts`.
- `package.json` : `sharp` (déjà présent via Next, déclaré direct, version exacte) et `tus-js-client` 4.3.1 (MIT).

## Tasks & Acceptance

**Execution:**
- [ ] Migration + `photos_publication.test.sql` -- buckets, table, RLS, fonctions, déclencheurs -- AD-2, AD-3, AD-18, AD-30
- [ ] `photo.ts`, `publication.ts`, types, schémas, service, actions, dépendances, requêtes, tests Vitest -- règle 13
- [ ] Composants admin, page d'édition, liste, messages FR/EN -- UX-DR30, UX-DR43, UX-DR44
- [ ] `next.config.ts`, étiquettes, `stockage.ts` -- AD-17, AD-18
- [ ] Essai réel d'un envoi TUS sur koma-dev avec une image générée, puis nettoyage des objets -- preuve du protocole (pas une simulation)
- [ ] `deferred-work.md` (suppression et texte alternatif modifiable)

**Acceptance Criteria:**
- Given un produit en édition, when Jonathan envoie un JPEG avec position GPS, then le fichier public n'a aucune métadonnée et l'original d'attente est effacé
- Given un fichier GIF, un faux JPEG ou plus de 15 Mo, then il est refusé avec le rappel des formats et de la limite
- Given des photos, when Jonathan touche Monter ou Descendre, then l'ordre change, au clavier comme au doigt, et les boutons de bout de liste sont `aria-disabled`
- Given un produit incomplet, when il touche Publier, then la liste des manques s'affiche et rien n'est publié
- Given un produit complet, when il est publié puis dépublié, then `publie_le` est posé puis effacé, le journal porte l'auteur et l'étiquette `catalogue` est invalidée
- Given `lint`, `typecheck`, `test`, `build`, then tous passent ; `test:sql` en CI

## Implementation Notes

Chemin du fichier public : `<produit>/<uuid>.<ext>` ; l'extension suit le format réel détecté (pas le nom envoyé).

## Spec Change Log

- Écart constaté à l'essai réel sur koma-dev : avec le jeton signé, le point d'accès TUS qui fonctionne est `/storage/v1/upload/resumable/sign` (l'autre répond 403). Le texte figé n'est pas modifié ; le code fait foi (commentaire dans `envoi-tus.ts`).

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Annuler pendant un vrai envoi TUS : `terminer` jamais résolue, formulaire bloqué | high | patch | abort sans rejet |
| Annuler pendant la demande d'autorisation : l'envoi part quand même, orphelin | medium | patch | `annule` testé trop tard |
| Type annoncé « constructor » accepté (`in`) | low | patch | correction directe `Object.hasOwn` |
| sharp sans plafond de pixels | medium | patch | limite par défaut 268 MP |
| Identifiant de produit en majuscules : refus SQL après traitement | low | patch | regex SQL minuscule |
| Objet public non nettoyé si l'écriture lève ; objet supprimé si `ecrirePhoto` lève après validation | medium | patch | service.ts |
| Clés d'erreur `produit_publie_verrouille` et `publication_incomplete` absentes du formulaire | medium | patch | message manquant |
| Cache non invalidé après modification, photo, déplacement | low | patch | étiquette sans lecteur pour l'instant |
| Tests : `envoi-tus.ts`, `remotePatterns` | medium | patch | jamais exécutés |
| Note de deferred-work fausse (déclencheur de complétude sur photo) | medium | patch | aucun déclencheur sur `produit_photo` |
| Suppression d'une photo : aucun garde de complétude | medium | defer | suppression non livrée (deferred-work) |
| Pas de purge Cron de `galerie-attente` | medium | defer | à traiter avec les tâches Cron |
| Double finalisation concurrente | low | rejeté | admin unique, double clic bloqué par `enVol` |
| Profil ICC perdu | false | rejeté | sharp convertit en sRGB par défaut sans `withMetadata` |
| CSP et `.env.example` | false | rejeté | CSP en rapport seul, `connect-src` contient Supabase, clé déjà dans `.env.example` |
| `on conflict` des buckets | false | rejeté | migration appliquée, base neuve en CI |
| Original effacé après échec transitoire | low | rejeté | spec : « effacé dans tous les cas » |
| Limitation de débit, journal des appels Storage | low | rejeté | actions réservées à l'admin |
| Annonce du rang, a11y doublons, `security definer` du trigger, dérive TS/SQL | low | rejeté | cosmétique |
| Point d'accès `/upload/resumable/sign` au lieu de `/upload/resumable` | low | spec | essai réel : 403 sur l'autre ; écart consigné ci-dessous |

## Design Notes

Dépasse 1600 jetons (base, stockage, serveur, interface) ; non scindée car les couches se testent ensemble. Choix du développeur : 10 photos au plus par produit ; suppression et modification du texte alternatif reportées (hors critères) ; contrôle de complétude doublé en base par un déclencheur différé (une édition ne peut pas dépublier de fait) ; reprises traitées avec les constats 2.1 (verrou slug/famille, `modifie_le`, bornes SQL ; l'état « Programmé » est sans objet : la publication pose `now()`).

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur
- `npm run test:e2e` -- parcours existants verts
- `npm run test:sql` -- CI

**Manual checks:**
- Fiche d'édition d'un produit : ajouter 2 photos avec textes alternatifs, les réordonner, tenter « Publier » incomplet, compléter, publier, dépublier.
