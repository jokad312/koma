# Licences des polices

Règle 6 de `CLAUDE.md` : aucune police, image ou fichier tiers n'entre dans le dépôt sans licence vérifiée et notée dans `docs/licences/`.

## Sakura Town

| Champ | Valeur |
| --- | --- |
| Nom de la police | Sakura Town |
| Éditeur | Letterhend Studio |
| Usage dans KOMA SHOP | Grands titres de la vitrine, en majuscules et sans accent (voir `DESIGN.md`) |
| Fichier dans le dépôt | `_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/imports/fonts/Sakura Town.otf` (commité le 2026-10-17) |
| Source du fichier | [À COMPLÉTER : où le fichier a été obtenu, version complète ou démo] |
| Page officielle de la police | https://www.creativefabrica.com/product/sakura-town/ref/2203/ |
| Licence accordée | Usage personnel et commercial, projets publics compris, confirmé par l'éditeur à Jonathan Manduara Tshimpaka (NATHANGROUP SARL) |
| Date de l'accord | [À COMPLÉTER] |
| Preuve écrite | [À COMPLÉTER : copie du message de l'éditeur, sans ses coordonnées personnelles] |

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
