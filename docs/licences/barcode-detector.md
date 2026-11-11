# Licence de barcode-detector (et zxing-wasm)

Règle 6 de `CLAUDE.md` : aucun fichier tiers n'entre dans le dépôt, ni n'est servi au public, sans licence vérifiée et notée dans `docs/licences/`.

| Champ | Valeur |
| --- | --- |
| Paquet | `barcode-detector` (npm), qui dépend de `zxing-wasm` 3.1.6 (version figée par `barcode-detector` lui-même) |
| Dépendance directe | `zxing-wasm` 3.1.6 est aussi déclaré dans `package.json` (version figée, sans `^` ni `~`) parce que `lecteur-qr.ts` désigne son fichier `.wasm` ; c'est la version que `barcode-detector` 3.2.3 exige. |
| Version exacte | 3.2.3 (épinglée dans `package.json`, sans `^` ni `~` ; dernière modification sur npm le 2026-10-19) |
| Usage dans KOMA SHOP | Lecture du Code QR d'un Pass sur l'écran de Scan (story 7.6), seulement quand le navigateur n'a pas l'API native `BarcodeDetector` (`src/components/scan/lecteur-qr.ts`, import dynamique : la bibliothèque n'est chargée que sur la page de Scan). |
| Fichier dans le dépôt | Aucun : paquet installé par npm. Le bundler publie `zxing_reader.wasm` (environ 0,9 Mo) sous `/_next/static/media` : il est servi par le site lui-même, jamais par un CDN tiers (le réglage par défaut de la bibliothèque, jsDelivr, est remplacé par `setZXingModuleOverrides`). |
| Licence de `barcode-detector` | MIT (champ `license` de son `package.json`, fichier `LICENSE`) |
| Licence de `zxing-wasm` | MIT — Copyright (c) 2023 Ze-Zheng Wu (fichier `LICENSE` du paquet) |
| Code compilé dans le `.wasm` | ZXing-C++ (https://github.com/zxing-cpp/zxing-cpp) et `ZXingWasm.cpp` : Apache License 2.0, comme l'indique le README de `zxing-wasm` (section licences) |
| Pages officielles | https://github.com/Sec-ant/barcode-detector et https://github.com/Sec-ant/zxing-wasm |
| Date de vérification | 2026-11-11 |

## Obligations

- MIT : garder l'avis de droit d'auteur et le texte de la licence dans toute copie substantielle. Le code n'est pas copié dans le dépôt ; npm le fournit avec ses fichiers `LICENSE`.
- Apache 2.0 (code compilé dans le `.wasm`) : conserver l'avis de licence et de droit d'auteur du composant. Aucune modification du code n'est faite. À rappeler dans les mentions légales si Jonathan le souhaite quand la page des mentions de composants libres sera rédigée.

## Choix (comparaison faite le 2026-11-11)

| Bibliothèque | Licence | Dernière version / activité | Décision |
| --- | --- | --- | --- |
| `barcode-detector` 3.2.3 | MIT | modifiée le 2026-10-19, dépôt actif | Retenue : même interface que l'API native, donc un seul code de lecture ; maintenue ; licence permissive. |
| `@zxing/library` 0.23.0 | Apache-2.0 | 2026-04-29, mais README « Project in Maintenance Mode Only » | Écartée : maintenance minimale. |
| `jsqr` 1.4.0 | Apache-2.0 | code de 2019, peu de maintenance | Écartée : pas de mises à jour réelles. |
| `qr-scanner` 1.4.2 | MIT | dernière version en 2022 | Écartée : plus de version depuis quatre ans. |
| `html5-qrcode` 2.3.8 | Apache-2.0 | dernière version en 2023 | Écartée : non maintenue. |
