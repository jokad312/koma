---
title: 'Story 3.7 : lecteur vidéo à chapitres'
type: 'feature'
created: '2026-11-02'
status: 'done'
route: 'dispatch'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** un client doit regarder le tutoriel de son Kit chapitre par chapitre, même avec une connexion lente, et reprendre où il s'était arrêté, sans que la vidéo privée puisse s'ouvrir sans accès (FR-29, règle 1, AD-11).

**Approche :** le serveur vérifie `acces_kit` puis signe un jeton Bunny de répertoire (CDN Token Auth, mode Advanced, style chemin) ; lecteur `hls.js` à commandes faites à la main (clavier, ARIA, aucun téléchargement) ; position enregistrée toutes les 15 s et à la pause dans `progression_video` ; progression en texte dans la bibliothèque.

## Décisions

- **Durée du jeton : 4 heures** (`DUREE_JETON_VIDEO_SECONDES`). Un tutoriel regardé avec des pauses ne doit pas voir ses segments répondre 403 en cours de lecture ; une adresse copiée devient inutile le jour même. Chaque ouverture et chaque « Réessayer » demandent un nouveau jeton.
- **Jeton Bunny** : HMAC-SHA256, `HS256-` + Base64URL, chemin signé = répertoire de la vidéo (`/<id>/`) donné aussi en `token_path`, style chemin (`/bcdn_token=…&expires=…&token_path=…/<id>/playlist.m3u8`) pour que les segments relatifs de la playlist héritent du jeton. Source : documentation officielle Bunny (token-authentication/advanced), **non vérifiée contre une vraie zone**.
- **Réglage à faire par Jonathan** : sur la zone CDN de la bibliothèque privée, activer « Token Authentication » en mode **Advanced** ; `BUNNY_PRIVE_TOKEN_KEY` = sa clé de sécurité, `BUNNY_PRIVE_CDN_HOSTNAME` = son nom d'hôte (déjà dans `.env.example`).
- Vidéo « terminée » à 90 % de sa durée (position la plus avancée) ; chapitres terminés = ceux que cette position a dépassés ; chapitre courant = dernier dont le début est atteint.
- Sous-titres : français toujours, anglais s'ils existent ; par défaut la langue de l'interface (français si l'anglais manque). Liste de choix plutôt que bouton unique.

</frozen-after-approval>

## Réalisé

- Migration `20261127100000_progression_video.sql` (appliquée sur koma-dev, types régénérés) : table `progression_video` (RLS : lecture de ses lignes), fonctions `bibliotheque_enregistrer_progression`, `bibliotheque_video_a_lire`, `bibliotheque_progressions` (security definer, service seulement, accès vérifié) ; `bibliotheque_kit` complétée du résumé de vidéo (sans identifiant privé).
- `src/lib/bunny/jeton.ts` (signature, config), `src/modules/bibliotheque/{video,dependances-video}.ts`, route `GET /api/kits/video/[slug]` (`no-store`), action `enregistrerProgression`, `src/components/bibliotheque/LecteurVideoKit.tsx`, lignes de progression dans `PageBibliotheque`.
- Tests : pgTAP `progression_video.test.sql` (28 ; logique vérifiée aussi sur koma-dev dans une transaction annulée), Vitest `bunny-jeton`, `bibliotheque-video`, `bibliotheque-lecteur-ui`.

## À vérifier à la main (definition of done)

- Avec les deux bibliothèques Bunny réglées : lecture d'un Kit possédé sur téléphone ; **une adresse de vidéo privée copiée sans jeton valide est refusée par Bunny** ; première image en moins de 5 s sur 3G simulée, rendu 360p ; reprise sur un autre appareil ; sous-titres.

## Écarts / dette

- Le format exact du jeton n'a pas été éprouvé contre Bunny (aucune bibliothèque réglée au moment de la story) : s'il est refusé (403), corriger `jeton.ts` selon la documentation de la zone.
- « Terminée » se déclenche aussi si l'on saute à la fin ; l'état « terminée » ne se réinitialise pas.
- Pas de limite de fréquence sur l'enregistrement de la position.
