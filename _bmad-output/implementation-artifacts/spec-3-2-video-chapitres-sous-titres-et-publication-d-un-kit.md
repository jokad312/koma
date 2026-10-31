---
title: "Story 3.2 : vidéo, chapitres, sous-titres et publication d'un Kit"
type: 'feature'
created: '2026-10-31'
status: 'done'
baseline_commit: '57821b49c1e6ff8b23b84aa5b8397971f81d2c45'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un Kit (3.1) n'a ni photo, ni vidéo, ni chapitres, ni sous-titres, et ne peut pas être publié : les acheteurs ne pourront pas suivre le tutoriel.

**Approach:** Photos de Kit (système existant), vidéo complète en TUS vers la bibliothèque Bunny **privée** et extrait facultatif vers la bibliothèque **publique** (client Bunny de la 2.6 paramétré par bibliothèque), chapitres FR/EN ordonnés, sous-titres WebVTT (FR obligatoire, EN facultatif) dans `kits-private`, publication d'un Kit avec la liste des manques. Correctif inclus : `kits-private` n'accepte plus `application/octet-stream` et accepte `text/vtt`, avec un test pgTAP sur `allowed_mime_types`.

## Boundaries & Constraints

**Always:** Nouvelle migration datée après `20261101100000` ; mêmes règles d'écriture qu'en 3.1 (`SECURITY DEFINER`, `search_path = ''`, `p_auteur` en premier, `exiger_admin`, `ks.auteur`, journal, `REVOKE`/`GRANT service_role`, droit `produits.modifier`).
Tables : `video_kit(produit_id pk → produit on delete cascade, duree_secondes, extrait_bunny_id null, prete_le, cree_le)` lisible par le public seulement pour un Kit publié et passé ; `video_kit_prive(produit_id pk → video_kit on delete cascade, bunny_video_id_prive)` sans aucune politique ni droit pour `anon`/`authenticated` (AD-30 : nom de colonne contenant `prive`, garde `garde_colonnes_privees` vert) ; `chapitre_kit(id, produit_id, titre_fr, titre_en (1 à 120), debut_secondes ≥ 0 et < durée de la vidéo, ordre)`, 50 chapitres au plus, instants de début distincts ; `sous_titre_kit(produit_id, langue fr|en, taille_octets, version, unique (produit_id, langue))` + `sous_titre_kit_prive(sous_titre_id, chemin_stockage)` sans lecture publique. Seule la famille `kit` est acceptée (`KS_FAMILLE_INVALIDE`). Une vidéo n'est enregistrée qu'après encodage `termine` lu chez Bunny (pas de simulation, règle 13) ; sa durée vient de Bunny.
Vidéo : `demanderEnvoiVideoKit` vérifie le droit, le Kit, le type (`video/mp4`, `video/quicktime`, `video/webm`) et la taille (vidéo complète 4 Go, extrait 200 Mo), crée la vidéo par l'API Bunny côté serveur (titre `KIT_<produit>` / `KIT_EXTRAIT_<produit>`, aucun nom de franchise) et renvoie la signature TUS ; le navigateur envoie avec progression, reprise et « Annuler l'envoi » ; le serveur interroge l'état, enregistre à `termine`, supprime chez Bunny la vidéo remplacée APRÈS la base (échec journalisé, non bloquant) ; échec d'encodage ou annulation : vidéo supprimée chez Bunny. Clés et `BUNNY_PRIVE_*` lues côté serveur uniquement ; jamais d'identifiant privé dans une réponse au navigateur ni dans le HTML.
Sous-titres : `.vtt`, 1 Mo au plus, même schéma d'envoi signé que les fichiers (3.1) vers `kits-private/<produit>/sous-titres/<uuid>.vtt`, puis vérification du contenu (UTF-8, en-tête `WEBVTT`, au moins une réplique au format `hh:mm:ss.mmm --> hh:mm:ss.mmm`, fin après début) ; refus : objet effacé. Remplacer augmente la version.
Publication d'un Kit : `manques_publication` renvoie pour un Kit les codes `prix`, `photo`, `titre_fr`, `titre_en`, `description_fr`, `description_en`, `materiel_fr`, `materiel_en`, `niveau`, `fichier`, `video`, `sous_titres_fr` ; l'absence d'anglais et d'extrait ne bloque pas. Un Kit publié reste complet (garde différée étendue aux nouvelles tables et à `fichier_kit`, `photo` : `KS_PUBLICATION_INCOMPLETE`). Tant que la fiche Kit n'existe pas (3.3), un Kit publié n'apparaît dans aucun catalogue, ni dans le plan du site, ni dans aucune adresse publique.
Interface (`Admin.kits.*`, tutoiement, sans emoji) : sur la fiche d'édition d'un Kit, sections Photos (composants existants), Vidéo complète, Extrait public, Chapitres (ajout, modification, Monter / Descendre, suppression avec confirmation, instant saisi `mm:ss` ou `h:mm:ss`), Sous-titres (FR obligatoire, EN facultatif), puis `PublicationProduit` avec ses manques traduits ; succès affiché après la réponse réelle, erreurs liées aux champs, 375 px, cibles de 44 px.

**Never:** Pas de lecteur ni de jeton CDN (3.7) ; pas de fiche ni de catalogue Kit (3.3) ; pas de Kit lié sur les fiches physiques (3.4) ; pas d'accès ni de commande (3.5) ; pas d'Embed token ni de domaine autorisé Bunny ; pas de réglage Bunny par API ; pas de modification d'une migration appliquée ; pas de `npm run dev` à la main.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Vidéo complète | MP4 de 800 Mo | TUS vers la bibliothèque privée, enregistrée à l'encodage terminé, durée lue | N/A |
| Type refusé | `.avi`, image | refusé avant l'envoi | `format_invalide` |
| Encodage en échec | statut Bunny `echec` | rien d'enregistré, vidéo supprimée chez Bunny | `video_echec` |
| Chapitre hors durée | début 12:00 pour 10:00 | refusé | `KS_CHAPITRE_INVALIDE` |
| Chapitre sans vidéo | aucune vidéo prête | refusé | `KS_VIDEO_ABSENTE` |
| Sous-titres invalides | `.vtt` sans `WEBVTT` | refusé, objet effacé | `format_invalide` |
| Publier incomplet | Kit sans vidéo ni sous-titres FR | refusé, liste `video`, `sous_titres_fr` | `KS_PUBLICATION_INCOMPLETE` |
| Publier sans EN ni extrait | tout le reste présent | publié | N/A |
| Kit publié, retirer le dernier fichier | suppression | refusée | `KS_PUBLICATION_INCOMPLETE` |
| Lecture publique | `anon` sur `*_prive` | refusée | permission refusée |
| Assistant / Compte simple | action | refus serveur | `non_autorise` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261031100000_heros_accueil.sql` (modèle de fonctions), `20261030100000_kits_et_fichiers.sql:56-140` (`manques_publication` actuelle, `fichier_kit`/`_prive`), `20261024100000_photos_et_publication.sql:205-335` (`publier_produit`, `exiger_produit_publie_complet` posée sur `produit` et `variante`), `20261026100000_listage_catalogue.sql` (`lister_catalogue` filtre déjà la famille) : ne pas modifier. Nouvelle migration `20261102100000_kits_video_et_publication.sql` + tests `supabase/tests/kits_video.test.sql` ; ajouter à `kits_fichiers.test.sql` (ou au nouveau test) l'égalité exacte de `allowed_mime_types`.
- Bunny : `src/lib/bunny/config.ts` (ajouter `lireConfigBunnyPrive`, type de config commun renommé), `src/lib/bunny/api.ts` (lire `length` dans `VideoBunny`), `src/lib/bunny/envoi-tus-navigateur.ts` (réutiliser tel quel). Modèle de service et de composant : `src/modules/accueil/heros-service.ts` (`demanderEnvoiVideo`, `verifierVideo`, `annulerEnvoiVideo`), `src/components/admin/heros/VideoHerosAdmin.tsx`.
- Catalogue : `src/modules/catalogue/{types,schemas,service,actions,dependances,queries,publication}.ts` (retirer `kit_non_publiable`, `publication.ts:10`, `service.ts:331` ; codes de manques `types.ts:75`) ; nouveau `src/modules/catalogue/sous-titres.ts` (validation WebVTT pure) ; `fichiers-kit.ts` (modèle de vérification et de chemin) ; `queries.ts` `lireSlugsPublies` (exclure les Kits) et `src/app/sitemap.ts`.
- UI : `src/app/[locale]/admin/produits/[id]/page.tsx:87-98` (branche Kit : ajouter `GaleriePhotos`/`EnvoiPhoto`, nouvelles sections, `PublicationProduit` à la place de `MessageEtat`), `PublicationProduit.tsx:63-75`, modèle Monter/Descendre `GaleriePhotos.tsx:141-210`, `Dialogue.tsx`, `MessageEtat.tsx`, `EnvoiFichierKit.tsx` ; nouveaux `src/components/admin/{VideoKit,ChapitresKit,SousTitresKit}.tsx`.
- `messages/{fr,en}.json` (`Admin.kits.*`, `Admin.produits.publication.manques.*`), `tests/doubles/TEST_dependances-catalogue.ts`, `tests/unit/*` (modèles `heros-service.test.ts`, `bunny-api.test.ts`), `src/lib/supabase/types.ts` (régénéré).

## Tasks & Acceptance

**Execution:**
- [x] Migration + tests SQL -- tables, fonctions (`enregistrer_video_kit`, `supprimer_video_kit`, `enregistrer_extrait_kit`, `ajouter/modifier/deplacer/supprimer_chapitre_kit`, `enregistrer_sous_titre_kit`, `supprimer_sous_titre_kit`), `manques_publication` Kit, garde différée, `allowed_mime_types` -- AD-11, AD-16, AD-30, règle 1
- [x] Config Bunny privée, durée, services vidéo/chapitres/sous-titres, validation WebVTT, exclusion des Kits du plan du site -- AD-18, règle 13
- [x] Composants et page d'édition, messages FR/EN, tests unitaires (matrice ci-dessus)
- [x] `db:push` sur koma-dev après la revue, puis `npm run types`

**Acceptance Criteria:**
- Given la migration appliquée, then l'identifiant Bunny privé n'est que dans `video_kit_prive`, illisible hors service, et `allowed_mime_types` de `kits-private` vaut exactement PDF, SVG, STL, `text/plain`, `text/vtt`
- Given un Kit complet sans sous-titres anglais, when Jonathan touche « Publier », then il est publié ; incomplet, la liste traduite des manques s'affiche
- Given un Kit publié, then il n'apparaît ni dans les catalogues cosplays/accessoires ni dans `sitemap.xml`
- Given `lint`, `typecheck`, `test`, `build`, then tous passent ; `test:sql` en CI

## Spec Change Log

- 2026-10-31, revue 1 (aucune boucle, corrections en patch) : (1) le contrôle WebVTT accepte les heures facultatives (`mm:ss.mmm`), comme la norme WebVTT ; la mention `hh:mm:ss.mmm` de l'intention décrivait la forme longue, pas une exclusion ; état évité : refus de fichiers valides exportés par la plupart des outils. (2) Écart accepté : l'identifiant de la vidéo privée en cours d'envoi est remis au navigateur de l'admin, car l'en-tête TUS `VideoId` de Bunny l'exige ; il n'est jamais relu depuis la base, ni rendu dans le HTML, ni renvoyé à un visiteur. KEEP : tout le reste du code.

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| VideoKit abandonne le suivi à toute erreur (`bunny_indisponible`, `duree_invalide`, durée 0 à « terminé ») : vidéo orpheline | medium | patch | `VideoKit.tsx:79-89` vide `videoEnCours` et repasse en `repos` |
| Statut Bunny inconnu (7, 8…) traité en échec, donc vidéo effacée | medium | patch | `api.ts:etatDe` `default: "echec"`, et `verifierVideoKit` efface à `echec` |
| Erreur réseau (non KS_) à l'écriture des sous-titres : objet effacé alors que la base a pu valider | medium | patch | `dependances.ts:242` renvoie `error.message` pour toute erreur ; `medias-kit.ts:471-474` efface |
| WebVTT sans heures refusé | medium | patch | `sous-titres.ts` exige `hh:` ; la norme les rend facultatives |
| `File.type` vide (MOV sous Windows/Android) : vidéo valide refusée | medium | patch | `VideoKit.tsx:119,129` |
| Quitter la page pendant l'envoi ou l'encodage : aucun avertissement, orphelin | low | patch | ni `beforeunload` ni nettoyage au démontage |
| Titre du chapitre toujours en FR à l'écran | low | patch | `ChapitresKit.tsx:204` `titre: c.titreFr` alors que `titreDe` existe |
| Câblage réel de `dependancesMediasKit` / `lireVideoKitService` (bibliothèque privée vs publique) non testé | medium | patch | aucun test ; inversion = tutoriel payant en bibliothèque publique |
| Enveloppe des Server Actions médias non testée | medium | patch | les tests UI simulent les actions |
| RLS « publié et passé » des nouvelles tables non testée pour un Kit programmé | medium | patch | `kits_video.test.sql` sans `publie_le` futur |
| Identifiant privé remis au navigateur pendant l'envoi | low | rejeté | exigé par TUS Bunny, noté au Spec Change Log |
| Vidéos orphelines sans tâche de nettoyage ni reprise | medium | defer | même nature que la purge de `kits-private` déjà reportée |
| Nouvelle vidéo plus courte que les chapitres : refusée et effacée après un long envoi | medium | defer | cas rare (remplacement) ; durée inconnue avant encodage |
| `types.ts` écrit à la main avant `db:push` | false | rejeté | régénération prévue (`npm run types`) avant le commit |
| Suivi incohérent (sprint, cases, journal 21/20 migrations) | low | patch | corrigé par l'orchestrateur à la clôture |
| L'extrait exige le nom d'hôte CDN public | low | rejeté | variable présente ; config publique unique et cohérente |
| Ordre des chapitres non chronologique sans avertissement | low | rejeté | choix écrit dans les Design Notes (AC : Monter / Descendre) |
| Boutons de retrait actifs sur un Kit publié | low | rejeté | la base refuse avec un message ; correctif = branches en plus |
| Annulation entre la fin de l'envoi et l'encodage | low | rejeté | fenêtre de quelques ms ; correctif = garde en plus |
| Journal SQL ne recopie pas l'identifiant privé : non testé | false | rejeté | le déclencheur n'est posé que sur `video_kit`, sans colonne privée |
| `kits_fichiers.test.sql` publie un Kit par `update` direct | low | rejeté | transaction annulée, la garde différée ne s'exécute pas ; usage déjà présent |
| Filtre `langue = 'fr'` de `lireProduitPourPublication` non testé | low | rejeté | la base revérifie, testée en SQL |

## Design Notes

Dépasse 1600 jetons ; non scindée (mode enchaîné, même choix qu'en 3.1). Choix du développeur : l'extrait public est facultatif (absent de la liste des manques de l'AC) ; le matériel FR/EN compte dans « textes FR et EN » ; le texte alternatif ne peut pas manquer (`alt_fr`/`alt_en` sont `not null` sur `produit_photo`), d'où aucun code `alt` ; plafond vidéo 4 Go (tutoriels longs), extrait 200 Mo comme le héros ; l'ordre des chapitres est libre (Monter / Descendre, AC) mais les instants sont distincts. Rendu 360p : vérifié par Jonathan le 2026-10-31 sur la bibliothèque privée (240p à 1080p activés) ; aucun réglage manuel restant.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur
- `npm run test:e2e` -- parcours existants verts
- `npm run test:sql` -- CI

**Manual checks:**
- Sur un Kit : photo, vidéo complète (progression, encodage, prête), extrait, 3 chapitres réordonnés, sous-titres FR, publication refusée puis acceptée, à 375 px.
