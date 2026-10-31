# Licence de hls.js

Règle 6 de `CLAUDE.md` : aucun fichier tiers n'est servi au public sans licence vérifiée et notée dans `docs/licences/`.

| Champ | Valeur |
| --- | --- |
| Paquet | `hls.js` (npm) |
| Version exacte | 1.7.3 (épinglée dans `package.json`) |
| Usage dans KOMA SHOP | Lecture HLS de l'extrait public d'un Kit sur la fiche (`src/components/fiche/LecteurExtrait.tsx`), story 3.3 ; le code est envoyé au navigateur du visiteur |
| Fichier dans le dépôt | Aucun : le paquet est installé par npm (`node_modules`, hors dépôt) et intégré au bundle au build |
| Licence | Apache License 2.0 — Copyright (c) 2017 Dailymotion |
| Texte de la licence | https://github.com/video-dev/hls.js/blob/master/LICENSE (copie dans `node_modules/hls.js/LICENSE`) |
| Page officielle | https://github.com/video-dev/hls.js |
| Date de vérification | 2026-10-31 |

## Obligations (Apache 2.0, section 4)

- Garder les avis de droit d'auteur et de licence du paquet dans toute redistribution (le bundle de Next.js conserve les commentaires de licence des dépendances).
- Fichier NOTICE : le paquet 1.7.3 n'en contient pas (vérifié dans `node_modules/hls.js` le 2026-10-31). Si une version future en ajoute un, son contenu doit être reproduit (par exemple dans une page ou un fichier de mentions des composants tiers) avant la mise à jour.
- Aucune modification du code de hls.js n'est faite ; si c'était le cas, les fichiers modifiés devraient le signaler.
