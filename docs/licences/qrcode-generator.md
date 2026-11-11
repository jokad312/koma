# Licence de qrcode-generator

Règle 6 de `CLAUDE.md` : aucun fichier tiers n'entre dans le dépôt, ni n'est servi au public, sans licence vérifiée et notée dans `docs/licences/`.

| Champ | Valeur |
| --- | --- |
| Paquet | `qrcode-generator` (npm) |
| Version exacte | 2.0.4 (épinglée dans `package.json`, sans `^` ni `~` ; publiée le 2025-08-07) |
| Usage dans KOMA SHOP | Calcul de la matrice des modules du Code QR d'un Pass (story 7.5) : dessin SVG de la page « Mes Pass » (`src/modules/evenements/pass-qr.ts`) et image GIF jointe à l'email `pass_emis`. Le calcul se fait côté serveur ; le navigateur ne reçoit que le dessin, jamais la bibliothèque. |
| Fichier dans le dépôt | Aucun : le paquet est installé par npm (`node_modules`, hors dépôt) |
| Dépendances | Aucune (le paquet n'en déclare pas) |
| Licence | MIT — Copyright (c) 2009 Kazuhiko Arase |
| Texte de la licence | https://opensource.org/license/mit (l'en-tête de `node_modules/qrcode-generator/dist/qrcode.js` renvoie à la licence MIT ; le champ `license` de son `package.json` est « MIT ») |
| Page officielle | https://github.com/kazuhikoarase/qrcode-generator |
| Date de vérification | 2026-11-11 |

## Obligations (MIT)

- Garder l'avis de droit d'auteur et le texte de la licence dans toute copie substantielle du code. Le paquet n'est pas copié dans le dépôt ; son code est intégré par npm au build du serveur, avec son en-tête.
- Aucune modification du code de la bibliothèque n'est faite.

## Marque

« QR Code » est une marque déposée de DENSO WAVE INCORPORATED (rappel inscrit dans l'en-tête de la bibliothèque). Le site écrit « Code QR » dans ses textes ; aucun logo de cette marque n'est utilisé.

## Choix

`qrcode-generator` a été préféré à `qrcode` (MIT aussi) parce qu'il n'a aucune dépendance (`qrcode` tire `pngjs`, `yargs` et `dijkstrajs`) et parce qu'il expose la matrice des modules : le Code QR est dessiné par nos soins en SVG (fond blanc pur, zone de silence de 4 modules), sans HTML injecté.
