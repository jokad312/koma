# Licence de fake-indexeddb

Règle 6 de `CLAUDE.md` : aucun fichier tiers n'entre dans le dépôt, ni n'est servi au public, sans licence vérifiée et notée dans `docs/licences/`.

| Champ | Valeur |
| --- | --- |
| Paquet | `fake-indexeddb` (npm), implémentation d'IndexedDB en mémoire pour Node.js |
| Version exacte | 6.2.8 (épinglée dans `package.json`, sans `^` ni `~` ; dernière modification sur npm le 2026-11-08) |
| Usage dans KOMA SHOP | Dépendance de TEST seulement (`devDependencies`) : les tests Vitest du Scan hors ligne (story 7.8) font tourner le vrai code de stockage (`src/modules/scan/stockage-hors-ligne.ts`) sur une IndexedDB en mémoire, avec des données nommées `TEST_`. |
| Fichier dans le dépôt | Aucun : paquet installé par npm. Rien n'est livré au navigateur ni au public ; le paquet n'entre jamais dans le build de production. |
| Licence | Apache License 2.0 (fichier `LICENSE` du paquet) |
| Page officielle | https://github.com/dumbmatter/fakeIndexedDB |
| Date de vérification | 2026-11-11 |

## Obligations

- Apache 2.0 : conserver l'avis de licence et de droit d'auteur si le code était redistribué. Il ne l'est pas (outil de test, non copié dans le dépôt, absent du build).
