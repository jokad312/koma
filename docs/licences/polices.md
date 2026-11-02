# Licences des polices

Règle 6 de `CLAUDE.md` : aucune police, image ou fichier tiers n'entre dans le dépôt sans licence vérifiée et notée dans `docs/licences/`.

## Sakura Town

| Champ | Valeur |
| --- | --- |
| Nom de la police | Sakura Town |
| Éditeur | Letterhend Studio |
| Usage dans KOMA SHOP | Grands titres de la vitrine, en majuscules et sans accent (voir `DESIGN.md`) |
| Fichier dans le dépôt | Aucun depuis le 2026-10-21 : `Sakura Town.otf`, `READ THIS.txt` et `Cover.png` ont été retirés de l'index Git (`git rm --cached`) ; la copie locale reste sur le poste de Jonathan dans `_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/imports/fonts/`, dossier ajouté à `.gitignore`. Le fichier a été commité le 2026-10-17 : il reste dans l'historique Git. |
| Source du fichier | [À COMPLÉTER : où le fichier a été obtenu, version complète ou démo] |
| Page officielle de la police | https://www.creativefabrica.com/product/sakura-town/ref/2203/ |
| Licence accordée | Usage personnel et commercial, projets publics compris, confirmé par l'éditeur à Jonathan Manduara Tshimpaka (NATHANGROUP SARL) |
| Date de l'accord | [À COMPLÉTER] |
| Preuve écrite | [À COMPLÉTER : copie du message de l'éditeur, sans ses coordonnées personnelles] |

### Décision du 2026-10-21 (Q-F1 reste ouverte)

- Le fichier est retiré du dépôt (index seulement) et son dossier est ignoré. L'historique n'est **pas** réécrit pour l'instant : Jonathan attend l'accord écrit de l'éditeur.
- Si l'éditeur refuse l'usage commercial, l'historique sera nettoyé (branches `main` et `production`) dans une tâche séparée.
- Les titres restent en Barlow Condensed tant que Q-F1 n'est pas réglée (`NEXT_PUBLIC_TITRES_SAKURA` éteinte).

### Point à vérifier

Le fichier `READ THIS.txt`, commité à côté de la police, décrit une **version de démonstration** réservée à l'usage personnel (« This demo font is for PERSONAL USE ONLY »). Il faut vérifier que `Sakura Town.otf` est la version complète. Si c'est la version de démonstration, il faut la remplacer par la version complète, puis mettre à jour la ligne « Source du fichier ».

## Barlow et Barlow Condensed

| Champ | Valeur |
| --- | --- |
| Noms des polices | Barlow (400, 500, 600) et Barlow Condensed (600, 700, 800 et 800 italique) |
| Auteurs | The Barlow Project Authors |
| Licence | SIL Open Font License 1.1 (utilisation, copie et redistribution libres, y compris commerciales ; vente de la police seule interdite) |
| Texte de la licence | `docs/licences/OFL-barlow.txt` (copie du fichier `LICENSE` du paquet npm, avec les mentions de droits d'auteur) |
| Usage dans KOMA SHOP | Barlow : texte courant. Barlow Condensed : titres, étiquettes, boutons, prix (voir `DESIGN.md`) |
| Fichiers dans le dépôt | `src/fonts/barlow-latin-{400,500,600}-normal.woff2` et `src/fonts/barlow-condensed-latin-{600,700,800}-normal.woff2`, `src/fonts/barlow-condensed-latin-800-italic.woff2` |
| Source des fichiers | Paquets npm `@fontsource/barlow` et `@fontsource/barlow-condensed`, version 5.2.8, sous-ensemble « latin » (accents du français compris), licence déclarée `OFL-1.1` dans les deux paquets. Les paquets ne sont pas des dépendances du projet : seuls les fichiers `.woff2` ont été copiés. |
| Chargement | Auto-hébergé par `next/font/local` (`src/lib/fonts.ts`), `font-display: swap` |
| Date de vérification | 2026-10-21 |

### Sakura Town : état dans le code (story 1.3)

Le fichier `Sakura Town.otf` n'est pas copié dans `public/` ni dans `src/`. L'option `NEXT_PUBLIC_TITRES_SAKURA` est éteinte par défaut : tous les grands titres sont en Barlow Condensed. Quand Jonathan aura la version complète et l'accord écrit de l'éditeur, il dépose le fichier sous le nom `public/fonts/sakura-town.otf` (dossier ignoré par Git) et passe l'option à `true`. Pour une mise en ligne, il faudra alors décider comment livrer ce fichier sur Hostinger sans l'ajouter au dépôt public.

## Barlow Regular (TTF) : filigrane des PDF de kit (story 3.6)

| Champ | Valeur |
| --- | --- |
| Nom de la police | Barlow Regular (400), format TTF |
| Auteurs | The Barlow Project Authors |
| Licence | SIL Open Font License 1.1, la même que pour les fichiers `.woff2` ci-dessus (texte : `docs/licences/OFL-barlow.txt`) |
| Usage dans KOMA SHOP | Texte du filigrane écrit par le serveur dans les PDF de kit (`@cantoo/pdf-lib`), à la première remise par Compte et par version. La police est embarquée en entier dans le PDF remis au client (le sous-ensemble échoue avec ce fichier TTF). |
| Fichier dans le dépôt | `src/fonts/filigrane/Barlow-Regular.ttf` (SHA-256 `77fb1ac54d2ceb980e3ebdfa7a9d0f64e85a66e4fdfb7f914a7b0aa08fb33a5d`) |
| Source du fichier | Paquet npm `@expo-google-fonts/barlow` 0.4.1 (`400Regular/Barlow_400Regular.ttf`), dont le fichier `LICENSE_FONT` reproduit la licence OFL 1.1 et la mention « Copyright 2017 The Barlow Project Authors ». Le paquet n'est pas une dépendance du projet : seul le fichier TTF est copié. |
| Obligations OFL | Mention de droits d'auteur et licence conservées (ce fichier et `OFL-barlow.txt`) ; la police n'est pas vendue seule ; le nom réservé n'est pas utilisé pour une version modifiée (l'embarquement dans un PDF est une utilisation normale). |
| Date de vérification | 2026-11-02 |

Dépendances de code ajoutées par la même story : `@cantoo/pdf-lib` 2.11.1 (MIT) et `@pdf-lib/fontkit` 1.1.1 (MIT), versions épinglées, intégrées au bundle serveur ; aucun fichier de ces paquets n'est copié dans le dépôt.
