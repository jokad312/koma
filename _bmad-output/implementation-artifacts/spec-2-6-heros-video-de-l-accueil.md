---
title: 'Story 2.6 : héros vidéo de l''accueil'
type: 'feature'
created: '2026-10-27'
status: 'done'
baseline_commit: '5ab9c09'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'accueil n'a pas de héros. Le visiteur arrivé d'une publicité doit voir tout de suite une vidéo de fabrication puis le costume porté, avec l'accroche « Deviens ton personnage. » (FR-1). Jonathan règle le Cosplay vedette, la vidéo et la photo de repli depuis l'admin.

**Approach:** Une table singleton `heros_accueil` (Cosplay vedette, vidéo Bunny publique, photo de repli et ses textes alternatifs), écrite seulement par des fonctions SQL réservées au serveur. L'envoi de la vidéo se fait directement du navigateur vers la bibliothèque Bunny PUBLIQUE en TUS, sur une autorisation signée par le serveur (la clé Bunny ne quitte jamais le serveur). Aucun lecteur intégré Bunny, aucun jeton d'intégration, aucun domaine autorisé requis : le héros lit le MP4 public du CDN dans une balise `<video>`. Le serveur ne publie la vidéo qu'après avoir lu à l'API de Bunny que l'encodage est terminé et avoir contrôlé le fichier MP4 réel (lisible depuis le CDN, piste vidéo, AUCUNE piste audio). La photo de repli suit le passage de la 2.2 (original en attente, sharp sans métadonnées, copie dans `produits-public`).

## Boundaries & Constraints

**Always:** Clés Bunny côté serveur seulement ; jamais d'affichage de valeurs de `.env.local` ; aucune valeur de repli si une variable manque (règle 15), l'erreur nomme la variable. Vidéo `muted loop playsinline aria-hidden`, sans piste audio, jamais chargée sous `prefers-reduced-motion` (la photo est affichée, bouton Pause absent). Le MP4 n'est montré au public qu'une fois validé (`video_fichier` non nul). Le serveur n'efface chez Bunny qu'une vidéo dont le titre porte le préfixe `koma-heros-`. Accroche = H1 en texte réel (Sakura Town si activée, sans accent, majuscules), dans un panneau de verre renforcé. Bouton Pause obligatoire (44 × 44 px, `aria-pressed`, étiquette traduite, choix mémorisé), parallaxe légère coupée en mouvement réduit et en pause. Sans Cosplay vedette ni média, le héros n'affiche aucun média inventé et l'accroche reste. « Le fabriquer moi-même » n'apparaît pas dans cet epic (E-16). Textes FR et EN dans `messages/*.json`. Écritures par fonctions `SECURITY DEFINER` (`search_path` vide, `p_auteur` en premier, `exiger_admin`, `ks.auteur`, `REVOKE`/`GRANT service_role`, journal). Migration neuve, appliquée sur koma-dev seulement.

**Ask First:** Toute dépendance à l'Embed token ou à un domaine autorisé de Bunny (non requise par cette solution).

**Never:** Simuler un état d'encodage ou un MP4 (règle 13) ; lire la clé Bunny dans le navigateur ; modifier une migration déjà appliquée ; ajouter la double option « Le fabriquer moi-même » ; toucher à la 3.2.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Rien de réglé | ligne vide | H1 seul, aucun média, aucune tuile | N/A |
| Photo seule | repli réglé | photo + H1 ; pas de bouton Pause | N/A |
| Vidéo validée | `video_fichier` posé | photo d'abord, vidéo en fondu à la première image, bouton Pause | N/A |
| Vidéo non validée | `video_fichier` nul | photo seulement | N/A |
| Mouvement réduit | préférence système | photo, pas de `<video>`, pas de bouton | N/A |
| Vidéo en erreur | `error` du média | photo, bouton retiré | N/A |
| Vedette dépubliée | RLS cache le produit | pas de tuile ni de bouton | N/A |
| Encodage en cours | Bunny status 2–3 | « Encodage en cours : n % », vérification toutes les 5 s | N/A |
| MP4 inaccessible | MP4 Fallback éteint ou référent refusé | rien n'est validé, message qui nomme le réglage Bunny | `mp4_indisponible` |
| MP4 avec audio | piste `soun` | refusé, rien n'est validé | `video_avec_audio` |
| Clé Bunny absente | variable vide | message dans l'admin, aucun envoi | `bunny_non_configure` |
| Droit refusé | assistant | rien n'est écrit ni appelé | `non_autorise` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261031100000_heros_accueil.sql`, `supabase/tests/heros_accueil.test.sql` (27 assertions).
- `src/lib/bunny/{config,api,envoi-tus-navigateur}.ts` : configuration, API (création, lecture, suppression, signature TUS, choix du MP4), envoi TUS du navigateur.
- `src/modules/accueil/heros-{types,mp4,service,dependances,queries,affichage,actions}.ts`.
- `src/components/admin/heros/*` (réglages), `src/components/accueil/{HerosAccueil,MediaHeros}.tsx` (public), `src/app/[locale]/page.tsx`, `src/modules/accueil/blocs.ts`, `src/lib/securite/entetes.ts` (CSP `media-src`).
- Tests : `tests/unit/{heros-mp4,bunny-api,heros-service}.test.ts`, `tests/e2e/{bunny-public,accueil}.spec.ts`.

## Tasks & Acceptance

**Execution:**
- [x] Migration, fonctions, test SQL ; `db:push` sur koma-dev ; `npm run types`
- [x] Bibliothèque Bunny (config, API, signature), analyse MP4, service avec dépendances injectées, actions
- [x] Réglages admin : vedette, vidéo (progression, reprise, annulation, vérification), photo de repli et textes
- [x] Héros public (coque, média, Pause, parallaxe, tuile de bureau), blocs, messages FR/EN, CSP
- [x] Tests unitaires, e2e, test réseau réel nommé TEST_

**Acceptance Criteria:**
- Given la page Réglages, when Jonathan choisit la vedette, envoie la vidéo et la photo avec leurs textes FR/EN, then la vidéo part en TUS vers Bunny publique sur autorisation signée, la photo passe par sharp dans `produits-public`, et la clé reste côté serveur
- Given l'accueil, when le MP4 est validé, then il joue muet en boucle, sinon la photo ; sous mouvement réduit la vidéo n'est pas chargée ; le bouton Pause est opérant et mémorisé
- Given aucun réglage, then l'accroche H1 seule s'affiche
- Given `lint`, `typecheck`, `test`, `build`, `test:sql` (CI), then tout passe

## Implementation Notes

- **Décision audio (FR-1)** : vérification serveur du MP4 rendu par Bunny, lu par intervalles d'octets (boîtes `moov/trak/mdia/hdlr`, pas de téléchargement complet). Une piste `soun` bloque la validation. Un fichier illisible est refusé (jamais « sans audio » par défaut). La balise `<video>` reste `muted` en plus.
- **Fichier choisi** : `play_720p.mp4` si rendu, sinon la plus grande résolution en dessous, sinon la plus petite. Réglage Bunny requis : MP4 Fallback activé.
- **Interprétation de « à temps »** : la photo est toujours rendue d'abord (premier octet) et la vidéo la remplace seulement quand sa première image est décodée ; il n'y a pas de minuterie qui retire la vidéo ensuite. Mesure des 2,5 s sur 4G/Instagram : à faire sur appareil (voir journal).
- **Aucun Embed token / domaine autorisé** : le CDN public sert le MP4 ; l'API Bunny n'est appelée que par le serveur (clé en en-tête) ; l'envoi TUS du navigateur n'utilise qu'une signature SHA-256 limitée à une vidéo et à 6 h.
- **Mesures** : test réseau réel `bunny-public.spec.ts` (création, signature acceptée en 201, fausse signature refusée, vidéo effacée).

## Spec Change Log

- Aucun changement de l'intention gelée. Plan auto-approuvé (mode enchaîné).

## Review Triage Log

Revue faite en une passe par l'agent unique (pas de sous-agent possible depuis une branche déléguée) selon les trois lentilles.

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Bouton « Vérifier maintenant » sans effet quand l'état est déjà « en cours » (la boucle automatique épuisée ne repart pas) | medium | patch | `relance` ajouté aux dépendances de l'effet |
| Effacement chez Bunny d'une vidéo étrangère par un identifiant forgé | high | patch (déjà couvert) | préfixe de titre vérifié avant tout effacement ; test `n'efface jamais une vidéo étrangère` |
| Validation d'une vidéo remplacée entre-temps | medium | patch (déjà couvert) | `valider_video_heros` compare `video_id` ; test SQL |
| MP4 lu sans `Referer` alors que la bibliothèque limiterait les référents | medium | patch | `Referer` = `NEXT_PUBLIC_SITE_URL` dans `ouvrirLecteurMp4` |
| H1 en double dans le HTML (coque + contenu diffusé), contenu du héros invisible sans JavaScript (CI : `gabarit.spec.ts`) | high | patch | H1 déplacé dans la coque statique, une seule fois ; média, bouton et tuile dans leurs propres limites d'attente, une lecture partagée par `cache()` |
| Vidéos Bunny orphelines (onglet fermé en plein envoi) | low | defer | `deferred-work.md` |
| Vedette dépubliée : le héros perd sa tuile sans avertir l'admin | low | defer | `deferred-work.md` |
| Mesure < 2,5 s sur 4G/Instagram non automatisable | low | defer | à mesurer sur appareil (journal) |
| Parcours complet avec vraie vidéo non couvert en e2e (aucune vidéo de test encodable sans ffmpeg) | medium | defer | couvert par tests unitaires du service, test réseau réel de la signature et test SQL ; essai manuel listé |

## Design Notes

L'état d'encodage vient toujours de l'API de Bunny et le fichier toujours du CDN : aucun succès n'est déduit (règle 13). Les pas courts de l'admin (envoi, finalisation, vérification) permettent de reprendre après une coupure : `video_id` est enregistré à la fin de l'envoi, le MP4 seulement après contrôle.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur
- `npx playwright test tests/e2e/bunny-public.spec.ts tests/e2e/accueil.spec.ts` -- verts
- pgTAP `heros_accueil.test.sql` -- 27/27 (CI : `npm run test:sql`)
