---
name: KOMA SHOP
description: Boutique d'un seul créateur otaku de Goma — cosplays faits main, accessoires et kits à fabriquer soi-même. Palette « Sumi & washi » (encre et papier), rouge de marque unique, verre dépoli discret sur fond uni et verre renforcé sur média, coins très arrondis. Thème crème par défaut, thème sombre par bascule.
status: final
updated: 2026-10-17
sources:
  - "{planning_artifacts}/prds/prd-KOMA SHOP-2026-10-16/prd.md"
  - "{planning_artifacts}/prds/prd-KOMA SHOP-2026-10-16/addendum.md"
  - "{project-root}/docs/guide-koma-shop.md"
  - "{project-root}/CLAUDE.md"
  - ./.memlog.md
  - ./mockups/color-themes-1.html
  - ./mockups/typography-1.html
  - ./mockups/key-*.html
  - ./imports/logos/
  - ./imports/fonts/Sakura Town.otf
colors:
  # Constantes de marque (tirées des SVG du logo) — jamais modifiées
  brand-red: '#E3261C'
  brand-ink: '#16130F'
  brand-washi: '#F3EEE4'
  # Thème CRÈME (défaut) — variation « Sumi & washi », .sumi-cream
  background: '#F3EEE4'
  surface: '#FBF8F2'
  surface-glass: '#FFFFFF8C'        # rgba(255,255,255,0.55) — verre discret, sur fond UNI seulement
  surface-glass-strong: '#FFFFFFD9' # rgba(255,255,255,0.85) — verre renforcé, sur vidéo / photo / contenu qui défile
  glass-border: '#16130F24'         # text-primary à 14 %, filet décoratif du verre
  text-primary: '#16130F'
  text-secondary: '#5E554A'
  primary: '#E3261C'                # rouge unique, boutons et grands textes sur fond uni
  on-primary: '#FFFFFF'
  border: '#E0D6C5'                 # décoratif uniquement (1,24:1)
  border-field: '#857A6B'           # contour de tout contrôle interactif : 3,64:1 sur background, 3,97:1 sur surface
  success: '#2E7A4E'
  warning: '#8F5E10'
  danger: '#B01B13'
  qr-background: '#FFFFFF'          # fond du Code QR, identique dans les deux thèmes
  hero-wash-start: '#FBF8F2'
  hero-wash-end: '#EADFCC'
  tile-red-start: '#E3261C'
  tile-red-end: '#9E1A12'
  tile-ink-start: '#5A4C3E'
  tile-ink-end: '#2B241D'
  # Thème SOMBRE (bascule) — variation « Sumi & washi », .sumi-dark
  background-dark: '#16130F'
  surface-dark: '#211C17'
  surface-glass-dark: '#F3EEE40F'   # rgba(243,238,228,0.06) — verre discret, sur fond UNI seulement
  surface-glass-strong-dark: '#16130FD9' # rgba(22,19,15,0.85) — verre renforcé, sur vidéo / photo / contenu qui défile
  glass-border-dark: '#F3EEE424'    # text-primary-dark à 14 %
  text-primary-dark: '#F3EEE4'
  text-secondary-dark: '#B9AE9E'
  primary-dark: '#E3261C'
  on-primary-dark: '#FFFFFF'
  border-dark: '#3A322A'            # décoratif uniquement (1,47:1)
  border-field-dark: '#7A6E5E'      # contour de tout contrôle interactif : 3,72:1 sur background-dark, 3,39:1 sur surface-dark
  success-dark: '#7CC49A'
  warning-dark: '#E2B566'
  danger-dark: '#F2766B'
  qr-background-dark: '#FFFFFF'     # le QR reste sur blanc pur en thème sombre
  hero-wash-start-dark: '#2A221B'
  hero-wash-end-dark: '#16130F'
  tile-red-start-dark: '#E3261C'
  tile-red-end-dark: '#7A1A12'
  tile-ink-start-dark: '#4A3D31'
  tile-ink-end-dark: '#211C17'
typography:
  # Échelle « Affiche shōnen » rendue à 375 px (mockups/typography-1.html, duo 5)
  # Ordinateur (>= lg) : [HYPOTHÈSE] tailles x 1,25, interlignage proportionnel (D-2 ouverte)
  display-brush:
    fontFamily: 'Sakura Town'
    fontSize: 52px                  # [HYPOTHÈSE] ; rendu : 42px accroche mobile, 44px titres de section et nom de produit mobile ; jamais < 40px
    lineHeight: '1'
    textTransform: uppercase
    note: 'Police PRINCIPALE des grands titres de vitrine. Fichier local imports/fonts/Sakura Town.otf (pas Google Fonts). Titres rédigés SANS accent, affichés en MAJUSCULES (text-transform), texte HTML réel. Titre saisi par l admin avec accent : bascule ENTIÈRE en Barlow Condensed. Licence webfont requise avant mise en ligne.'
  display:
    fontFamily: 'Barlow Condensed'
    fontSize: 52px
    fontWeight: '800'
    fontStyle: italic
    lineHeight: 50px
    letterSpacing: -0.005em
    note: 'Majuscules par text-transform ; italique réservé à l’accroche du héros'
  h1:
    fontFamily: 'Barlow Condensed'
    fontSize: 38px
    fontWeight: '700'
    lineHeight: 40px
    note: 'Majuscules par text-transform'
  h2:
    fontFamily: 'Barlow Condensed'
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: 0.01em
    note: 'Majuscules par text-transform'
  h3:
    fontFamily: 'Barlow Condensed'
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 24px
  body:
    fontFamily: 'Barlow'
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  small:
    fontFamily: 'Barlow'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label:
    fontFamily: 'Barlow Condensed'
    fontSize: 14px                  # relevé de 13 à 14 px (lisibilité, A11Y-24)
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.14em
    note: 'Majuscules par text-transform'
  button:
    fontFamily: 'Barlow Condensed'
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.06em
    note: 'Majuscules par text-transform'
  price-card:
    fontFamily: 'Barlow Condensed'
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 24px
    note: 'Prix USD sur carte, tuile, ligne de Récapitulatif'
  price-page:
    fontFamily: 'Barlow Condensed'
    fontSize: 38px
    fontWeight: '700'
    lineHeight: 40px
    note: 'Prix USD sur fiche et total du Récapitulatif'
rounded:
  sm: 10px        # pilules d'info, puces (rendu)
  md: 14px        # vignettes dans une carte, messages d'état, champs (rendu)
  glass: 18px     # panneaux en verre (rendu)
  lg: 20px        # cartes et tuiles (décision ~20 px)
  xl: 22px        # héros (rendu)
  full: 9999px    # boutons en pilule, sélecteurs segmentés
spacing:
  # [HYPOTHÈSE] Échelle Tailwind par défaut (pas de 4 px), aucune valeur décidée en Discovery
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
  '12': 48px
  margin-mobile: 16px   # [HYPOTHÈSE]
  card-gap: 12px        # rendu (grilles 10-12 px)
  touch-target: 44px    # décision accessibilité : cible minimale de toute commande isolée
components:
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.on-primary}'
    radius: '{rounded.full}'
    typography: '{typography.button}'
    padding: '{spacing.3} {spacing.5}'
    min-height: '{spacing.touch-target}'
    disabled-background: '{colors.surface}'
    disabled-border: '1px solid {colors.border-field}'
    disabled-foreground: '{colors.text-secondary}'
  button-secondary:
    background: '{colors.surface}'
    foreground: '{colors.text-primary}'
    border: '1px solid {colors.border-field}'
    radius: '{rounded.full}'
    typography: '{typography.button}'
    min-height: '{spacing.touch-target}'
  segmented-choice:
    background: '{colors.background}'
    border: '1px solid {colors.border-field}'
    radius: '{rounded.full}'
    active-background: '{colors.surface}'
    active-border: '2px solid {colors.primary}'
    active-indicator: 'icône coche + texte'
    active-foreground: '{colors.text-primary}'
    inactive-foreground: '{colors.text-secondary}'
    min-height: '{spacing.touch-target}'
  glass-panel:
    background: '{colors.surface-glass}'
    backdrop: 'blur(10px) saturate(140%)'   # décision : flou ~10 px
    border: '1px solid {colors.glass-border}'
    radius: '{rounded.glass}'
    usage: 'fond uni seulement'
  glass-panel-strong:
    background: '{colors.surface-glass-strong}'
    backdrop: 'blur(10px) saturate(140%)'
    border: '1px solid {colors.glass-border}'
    radius: '{rounded.glass}'
    usage: 'tout texte posé sur vidéo, photo ou contenu qui défile'
  hero:
    background: 'radial {colors.primary} 25 % + dégradé {colors.hero-wash-start} → {colors.hero-wash-end}'
    radius: '{rounded.xl}'
    panel: '{components.glass-panel-strong}'
    headline: '{typography.display-brush}'
    headline-fallback: '{typography.display}'
    headline-color: '{colors.text-primary}'
    eyebrow-color: '{colors.text-primary}'
  hero-pause-button:
    background: '{colors.surface}'
    foreground: '{colors.text-primary}'
    border: '1px solid {colors.border-field}'
    radius: '{rounded.full}'
    size: '{spacing.touch-target}'
  hero-option-tile:
    background: '{colors.surface-glass-strong}'
    radius: '{rounded.lg}'
    label: '{typography.label}'
    price: '{typography.price-card}'
  product-gallery:
    radius: '{rounded.lg}'
    control: '{components.button-secondary}'
    thumbnail-radius: '{rounded.md}'
    thumbnail-active: '2px solid {colors.text-primary}'
    position: '{typography.small}'
  product-card:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    image-radius: '{rounded.md}'
    title: '{typography.h3}'
    price: '{typography.price-card}'
  catalog-filters:
    chip-background: '{colors.surface}'
    chip-border: '1px solid {colors.border-field}'
    chip-active-background: '{colors.text-primary}'
    chip-active-foreground: '{colors.background}'
    radius: '{rounded.full}'
    typography: '{typography.small}'
    min-height: '{spacing.touch-target}'
  category-tile:
    background: 'dégradé {colors.tile-red-start} → {colors.tile-red-end} ou {colors.tile-ink-start} → {colors.tile-ink-end}'
    foreground: '{colors.on-primary}'
    radius: '{rounded.lg}'
    title: '{typography.h2}'
    title-size: 'clamp(20px, 6vw, 30px)'
  event-card:
    background: '{colors.surface}'
    radius: '{rounded.lg}'
  article-card:
    background: '{colors.surface}'
    radius: '{rounded.lg}'
  gallery-tile:
    radius: '{rounded.lg}'
    caption-background: '{colors.surface-glass-strong}'
    caption-foreground: '{colors.text-primary}'
  availability-badge:
    radius: '{rounded.full}'
    typography: '{typography.label}'
  status-message:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.md}'
    typography: '{typography.small}'
  info-banner:
    background: '{colors.surface}'
    accent: '4px {colors.primary} à gauche'
    radius: '{rounded.md}'
  form-field:
    background: '{colors.surface}'
    border: '1px solid {colors.border-field}'   # >= 3:1 (WCAG 1.4.11)
    radius: '{rounded.md}'
    min-height: '{spacing.touch-target}'
  otp-field:
    base: '{components.form-field}'
    typography: '{typography.h3}'
    letterSpacing: 0.3em
  focus-ring:
    outline: '2px solid {colors.text-primary}'
    halo: '2px {colors.background}'
    offset: 2px
  skip-link:
    background: '{colors.text-primary}'
    foreground: '{colors.background}'
    radius: '{rounded.full}'
  header:
    background: '{colors.surface-glass-strong}'
    backdrop: 'blur(10px)'
  mobile-menu-panel:
    background: '{colors.background}'          # opaque, sans verre (décision)
  dialog:
    background: '{colors.surface}'
    scrim: '{colors.brand-ink} à 60 %'
    radius: '{rounded.lg}'
  footer:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    card-title: '{typography.label}'
    link: '{components.footer-link}'
  faq-accordion:
    background: '{colors.surface}'
    radius: '{rounded.lg}'
  payment-option-card:
    background: '{colors.surface}'
    border: '1px solid {colors.border-field}'
    selected-border: '2px solid {colors.primary}'
    selected-indicator: 'bouton radio plein + coche'
    radius: '{rounded.lg}'
  pass-selector:
    background: '{colors.surface}'
    stepper: '{components.button-secondary}'
    radius: '{rounded.lg}'
  free-kit-button:
    base: '{components.button-primary}'
  order-timeline:
    done: '{colors.success} + icône coche'
    current: '{colors.text-primary} + point plein'
    upcoming: '{colors.text-secondary} + cercle vide'
    text: '{colors.text-primary} / {colors.text-secondary}, jamais rouge'
  pass-card:
    background: '{colors.surface}'
    qr-background: '{colors.qr-background}'
    radius: '{rounded.lg}'
  scan-result:
    valid: '{colors.success} + {colors.on-primary}'    # forcé dans les deux thèmes
    refused: '{colors.danger} + {colors.on-primary}'   # forcé dans les deux thèmes
  video-chapter-player:
    radius: '{rounded.lg}'
    chapter-active: '{colors.text-primary} + icône « en lecture »'
    captions-background: '{colors.brand-ink} à 85 %'
    captions-foreground: '{colors.brand-washi}'
  skeleton:
    background: '{colors.surface}'
    radius: '{rounded.md}'
  size-selector:
    background: '{colors.background}'
    border: '1px solid {colors.border-field}'
    radius: '{rounded.full}'
    typography: '{typography.h3}'
    min-width: 52px
    min-height: '{spacing.touch-target}'
    active-background: '{colors.surface}'
    active-border: '2px solid {colors.primary}'
    active-indicator: 'icône coche + texte'
  pass-type-card:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    title: '{typography.h3}'
    price: '{typography.price-card}'
  account-nav:
    item-background: '{colors.surface}'
    item-border: '1px solid {colors.border}'
    item-radius: '{rounded.lg}'
    item-min-height: 64px                # 56 px dans la colonne ordinateur
    icon-background: '{colors.background}'
    title: '{typography.h3}'
    hint: '{typography.small}'
    current-border: '2px solid {colors.text-primary}'
    desktop-column: 300px
  library-kit-row:
    background: '{colors.surface}'
    border: '1px solid {colors.border}'
    radius: '{rounded.lg}'
    thumbnail: '72px, {rounded.md}'
    title: '{typography.h3}'
    progress: '{typography.small}'
  footer-link:
    foreground: '{colors.text-primary}'
    underline: '2px {colors.primary}'
    min-height: '{spacing.touch-target}'
  progress-bar:
    track-background: '{colors.background}'
    track-border: '1px solid {colors.border-field}'
    fill: '{colors.text-primary}'
    height: 12px
    radius: '{rounded.full}'
    value: '{typography.small}'
  admin-sidebar:
    background: '{colors.surface}'
    divider: '1px solid {colors.border}'
    item-min-height: '{spacing.touch-target}'
    item-radius: '{rounded.md}'
    item-current-background: '{colors.background}'
    item-current-marker: '4px {colors.primary} à gauche'
    counter-border: '1px solid {colors.border-field}'
  admin-tab-bar:
    background: '{colors.surface}'
    divider: '1px solid {colors.border}'
    tab-min-height: 58px
    tab-radius: '{rounded.md}'
    label: '{typography.small}'
    current-foreground: '{colors.text-primary}'
    current-background: '{colors.background}'
    current-marker: '3px {colors.primary} en haut'
    counter-background: '{colors.text-primary}'
    counter-foreground: '{colors.background}'
  bar-chart:
    track-background: '{colors.background}'
    track-border: '1px solid {colors.border}'
    fill: '{colors.text-primary}'
    height: 16px
    radius: '{rounded.full}'
  data-table:
    header: '{typography.label}'
    header-foreground: '{colors.text-secondary}'
    header-divider: '1px solid {colors.border-field}'
    row-divider: '1px solid {colors.border}'
    cell: '{typography.small}'
  switch:
    track: '46 x 28 px'
    border: '2px solid {colors.border-field}'
    background: '{colors.background}'
    on-background: '{colors.text-primary}'
    thumb-on: '{colors.background}'
    radius: '{rounded.full}'
    min-height: '{spacing.touch-target}'
  reorder-buttons:
    size: '{spacing.touch-target}'
    background: '{colors.surface}'
    border: '1px solid {colors.border-field}'
    radius: '{rounded.md}'
    disabled-foreground: '{colors.text-secondary}'
    disabled-border: '1px dashed {colors.border-field}'
  status-pill:
    background: '{colors.surface}'
    border: '1px solid currentColor'
    radius: '{rounded.full}'
    typography: '{typography.label}'
  payment-readonly:
    background: '{colors.background}'
    border: '1px dashed {colors.border-field}'
    radius: '{rounded.md}'
    term: '{colors.text-secondary}'
  scan-next-button:
    base: '{components.button-secondary}'
    background: '{colors.on-primary}'
    foreground: '{colors.brand-ink}'
    width: '100 %'
---

# KOMA SHOP — Design Spine

> DESIGN.md dit **à quoi ressemble** KOMA SHOP ; `EXPERIENCE.md` dit comment il se comporte. En cas de conflit, ce document prime sur les maquettes. Il prime aussi sur les rendus et les imports. Les valeurs non décidées par Jonathan sont marquées **[HYPOTHÈSE]** et reprises en fin de document.

## Brand & Style

KOMA SHOP est la boutique d'un seul créateur, Jonathan, à Goma. Elle ne vend pas d'abord un produit mais **la fierté de devenir son personnage** (PRD §1). Le visiteur — otaku d'Afrique ou de la diaspora — doit penser « waouh, ça me donne envie » dès l'arrivée, sur un téléphone moyen, souvent dans le navigateur intégré d'Instagram.

La posture visuelle est **« Sumi & washi »** : l'encre (`{colors.brand-ink}`) et le papier (`{colors.brand-washi}`) de la case de manga, avec un seul rouge de sceau (`{colors.brand-red}`). Le style est cool, très doux, apprécié de tous : surfaces papier chaudes, verre dépoli discret, coins très arrondis, boutons en pilule. L'énergie vient des **vraies photos et vidéos de Jonathan**, en grand, et d'une typographie d'affiche shōnen (condensée, majuscules, italique pour l'accroche). Les clins d'œil manga (trames, cases, traits de vitesse) restent en décor léger.

La **mise en page** s'inspire des captures 1win importées, sans leur esthétique de casino, leurs couleurs ni leurs mécaniques.
- `imports/gofullpage-ineu-ru-2026-10-15-17_29_09.png` : accueil — héros large + deux tuiles verticales, onglets en pilule.
- `imports/gofullpage-1wmljx-life-bonuses-2026-10-15-17_31_46.png` : rangées de cartes à dégradés, coins très arrondis.
- `imports/gofullpage-1wmljx-life-casino-play-v-3oaks-coinuphotfire-2026-10-15-17_32_12.png` : FAQ en accordéons sur deux colonnes, pied de page en cartes.

### Maquettes de référence

Toutes les maquettes sont dans `mockups/` ; une copie reste dans `.working/` (piste d'audit). Jonathan les a validées comme référence d'inspiration pour toutes les pages. Chaque maquette porte en tête un bandeau « Maquette — prix et produits fictifs » (ou « données fictives ») : ce bandeau appartient à la toile de présentation, **jamais au produit** (règles 5 et 13). Noms, prix, chiffres, QR et références y sont inventés.

| Maquette | Illustre |
|---|---|
| [color-themes-1](mockups/color-themes-1.html) | palette « Sumi & washi » (variation 1), crème et sombre, à 375 px |
| [typography-1](mockups/typography-1.html) | échelle « Affiche shōnen » (duo 5) |
| [key-accueil](mockups/key-accueil.html) | en-tête, héros mobile et ordinateur (vidéo ~2/3 + deux tuiles), blocs 1 à 3, thème sombre |
| [key-catalogue](mockups/key-catalogue.html) | filtres, grille de cartes, aucun résultat, variante Kits, pied de page |
| [key-fiche-cosplay](mockups/key-fiche-cosplay.html) | galerie, double option, sélecteur de tailles, Plafond atteint, bascule de police du nom |
| [key-fiche-kit](mockups/key-fiche-kit.html) | extrait vidéo à chapitres, carte d'achat, kit déjà possédé |
| [key-evenements](mockups/key-evenements.html) | liste « Rendez-vous otaku », Page Événement, cartes Type de pass, état Complet |
| [key-blog](mockups/key-blog.html) | liste d'articles, Article mobile et ordinateur (colonne de 720 px) |
| [key-pages-info](mockups/key-pages-info.html) | À propos, FAQ, Contact, 404, bandeau du navigateur intégré |
| [key-connexion](mockups/key-connexion.html) | code de connexion, âge, questions d'accueil |
| [key-panier-commande](mockups/key-panier-commande.html) | Panier, « Plus disponible », étape de commande (retrait, livraison, 100 % kits) |
| [key-paiement](mockups/key-paiement.html) | Récapitulatif, cartes de moyen de paiement, couple non couvert |
| [key-attente-paiement](mockups/key-attente-paiement.html) | attente, vérification, échec confirmé avec repli |
| [key-compte](mockups/key-compte.html) | Mon compte, navigation du compte, Mes commandes, frise des statuts |
| [key-bibliotheque](mockups/key-bibliotheque.html) | lignes de kit, lecteur à chapitres, lignes de fichier |
| [key-pass-photo](mockups/key-pass-photo.html) | Mes Pass, Achat de Pass, envoi de photo, préférences |
| [key-scan](mockups/key-scan.html) | Écran de Scan (8 états) |
| [key-admin-tableau](mockups/key-admin-tableau.html) | barre latérale et onglets admin, graphiques en barres, tableaux de données, cartes de tâche |
| [key-admin-commandes](mockups/key-admin-commandes.html) | liste filtrable, détail, transitions, bloc Paiement en lecture seule |
| [key-admin-produits](mockups/key-admin-produits.html) | édition Cosplay et Kit, photos ordonnées, progression d'envoi, sous-titres |
| [key-admin-reglages](mockups/key-admin-reglages.html) | Prestataires (interrupteurs, ordre), Réglages, Codes promo, Galerie, Événements |

Fichiers d'`imports/` chargés par les maquettes : `imports/fonts/Sakura Town.otf` seulement (chemin `../imports/fonts/Sakura%20Town.otf`, valide depuis `mockups/` et `.working/`). Les logos y sont recopiés en SVG en ligne depuis `imports/logos/SVG/` (`principale logo.svg`, `KOMA_horizontal_inverse.svg`).

### Logo

Pack complet : `imports/logos/SVG/` et `imports/logos/PNG/` (cinq formes — horizontal, wordmark, vertical, symbole, hanko — en quatre déclinaisons). Planche d'origine : `imports/Capture d'écran 2026-10-16 182259.png`. Le « O » est un disque rouge fendu en diagonale avec un point (œil / case de manga). Les JPG à la racine d'`imports/` (`KOMA_*.jpg`, `logo principale.jpg`) et `imports/fonts/Cover.png` sont des imports d'origine remplacés par le pack SVG/PNG : **ne pas les utiliser**.

| Déclinaison | Couleurs (SVG) | Fond d'usage |
|---|---|---|
| Couleur (`principale logo.svg`, `*_couleur`) | lettres `{colors.brand-ink}` + O `{colors.brand-red}` | thème crème (`{colors.background}`, `{colors.surface}`) — **défaut** |
| Inverse (`*_inverse`) | lettres `{colors.brand-washi}` + O `{colors.brand-red}` | thème sombre (`{colors.background-dark}`) |
| Blanc (`*_blanc`) | monochrome `{colors.brand-washi}` | sur photo ou sur aplat rouge [HYPOTHÈSE] |
| Noir (`*_noir`) | monochrome `{colors.brand-ink}` | impression, documents mono [HYPOTHÈSE] |

- **En-tête** (décision memlog) : **logo principal horizontal (KOMA + コマ) dans le coin gauche**, sur mobile et ordinateur.
  - Crème : `principale logo.svg` (lettres `{colors.brand-ink}`, O et コマ `{colors.brand-red}`, point `{colors.brand-washi}`). Il tient lieu de `KOMA_horizontal_couleur.svg`, qui n'existe pas.
  - Sombre : `KOMA_horizontal_inverse.svg` (lettres et コマ `{colors.brand-washi}`, O `{colors.brand-red}`, point `{colors.brand-ink}`).
  - Largeur : 156 px à 375 px (≈ 37 px de haut), 190 px sur ordinateur (≈ 45 px). `viewBox` recadré à `50 46 530 124` : dessin inchangé, marges réduites de 60 à ~10 unités pour tenir dans la barre.
  - Texte alternatif : « KOMA SHOP » (le katakana コマ n'est pas lu). Le wordmark seul n'est plus utilisé dans l'en-tête.
- **Hanko** (sceau コマ) : usage de sceau — favicon, filigrane d'en-tête de pass, signature d'email [HYPOTHÈSE, à confirmer].
- **Zone de protection** : les SVG horizontaux réservent 60 unités autour d'un logotype de 100 unités de haut → marge minimale = 0,6 × hauteur du logotype [HYPOTHÈSE déduite des fichiers]. Taille minimale : non fournie.
- **Ne jamais** recolorer, étirer, redessiner le logo ni modifier `#E3261C`. Pas d'ombre, pas de verre sur le logo.

### Photographie (PRD §10, Guide)

Vraies photos et vidéos du créateur uniquement, en grand. Pour chaque produit : face, dos, profil, détail et photo portée en action ; lumière naturelle ou douce, fond simple, **même cadrage pour tout le catalogue**. Coulisses de fabrication et portrait à l'atelier pour À propos. Héros : mains qui découpent, peignent, ajustent, puis le costume porté en pleine lumière, de face, la cape en mouvement. Texte alternatif obligatoire sur chaque image. Le montage du héros ne contient pas plus de 3 flashs par seconde.

### Motifs manga

Trames, cadres de cases, traits de vitesse **très légers** en fond de section : opacité **≤ 6 %** (plafond d'accessibilité ; densité exacte : D-10). **Jamais sur une photo produit**, jamais derrière un petit texte, un texte de paiement ou un formulaire. Le texte posé sur la zone la plus dense de la trame garde ≥ 4,5:1.

## Colors

Deux thèmes, mêmes rôles. **Crème = défaut**, sombre = bascule mémorisée. Tous les hex viennent de la variation « Sumi & washi » rendue dans [color-themes-1](mockups/color-themes-1.html) (classes `.sumi-cream` et `.sumi-dark`), corrigée par la décision du rouge unique et par les tokens d'accessibilité (verre renforcé, contour des contrôles).

| Rôle | Crème (défaut) | Sombre | Usage |
|---|---|---|---|
| Fond | `{colors.background}` #F3EEE4 | `{colors.background-dark}` #16130F | toile de page, Panneau ☰ (opaque) |
| Surface | `{colors.surface}` #FBF8F2 | `{colors.surface-dark}` #211C17 | cartes, formulaires, boutons secondaires, pied de page |
| Verre discret | `{colors.surface-glass}` blanc 55 % | `{colors.surface-glass-dark}` washi 6 % | **fond uni seulement** : pilules et panneaux posés sur `background` |
| Verre renforcé | `{colors.surface-glass-strong}` blanc 85 % | `{colors.surface-glass-strong-dark}` encre 85 % | **tout texte sur vidéo, photo ou contenu qui défile** : panneau du héros, en-tête collant, tuiles d'option, légendes de galerie |
| Filet du verre | `{colors.glass-border}` encre 14 % | `{colors.glass-border-dark}` washi 14 % | décoratif |
| Texte | `{colors.text-primary}` #16130F | `{colors.text-primary-dark}` #F3EEE4 | texte courant, petits prix, liens, accroche du héros |
| Texte secondaire | `{colors.text-secondary}` #5E554A | `{colors.text-secondary-dark}` #B9AE9E | métadonnées, délais, aides |
| Rouge | `{colors.primary}` #E3261C | `{colors.primary-dark}` #E3261C | boutons principaux, grands titres sur fond uni, soulignés, sélection |
| Sur rouge | `{colors.on-primary}` #FFFFFF | `{colors.on-primary-dark}` #FFFFFF | texte des boutons et tuiles rouges |
| Filet | `{colors.border}` #E0D6C5 | `{colors.border-dark}` #3A322A | séparateurs **décoratifs** seulement |
| Contour de contrôle | `{colors.border-field}` #857A6B | `{colors.border-field-dark}` #7A6E5E | champs, boutons secondaires, segments, cartes de paiement, filtres |
| Succès | `{colors.success}` #2E7A4E | `{colors.success-dark}` #7CC49A | payée, valide, étape faite |
| Attention | `{colors.warning}` #8F5E10 | `{colors.warning-dark}` #E2B566 | en cours de vérification, avertissement de zone |
| Erreur | `{colors.danger}` #B01B13 | `{colors.danger-dark}` #F2766B | échec confirmé, refus de Scan, erreur de champ |
| Fond du QR | `{colors.qr-background}` #FFFFFF | `{colors.qr-background-dark}` #FFFFFF | Code QR des Pass, blanc pur dans les deux thèmes |

### Règle du rouge (décision validée)

- **Un seul rouge, `#E3261C`, partout** (logo et interface). Le rouge ajusté `#C52118` (primary-strong) est **abandonné** ; aucune teinte « primary-text » n'est retenue.
- **Boutons rouges : texte `#FFFFFF`** (4,61:1, AA). Jamais de texte crème `#F3EEE4` sur rouge (3,98:1, échec).
- **Rouge en couleur de texte : grands textes seulement** (≥ 24 px, ou ≥ 18,66 px en gras ; seuil 3:1), **et uniquement sur `background` ou `surface` unis**. Contrastes mesurés : rouge sur fond crème 3,98:1 ; sur surface crème 4,34:1 ; sur fond sombre 4,02:1 ; sur surface sombre 3,67:1.
- **Aucun texte rouge sur dégradé, halo, verre, photo ou vidéo** (décision) : rouge sur halo crème 2,46:1, sur halo sombre 2,60:1, sur verre crème 55 % au-dessus d'une image noire 1,37:1 — tous en échec. L'accroche et le surtitre du héros sont en `{colors.text-primary}` ; le rouge n'y sert qu'au bouton, au sceau ou à un soulignement.
- **Petits liens et petits prix** : en `{colors.text-primary}`, avec soulignement ou icône rouge.
- Un trait rouge fin (< 3 px) n'est jamais le seul indicateur d'un état ; la sélection a toujours une coche ou un radio plein en plus.

### Contrastes de référence (calculés, formule WCAG 2.x)

| Paire | Ratio | Verdict |
|---|---|---|
| text-primary / background (crème) | 16,01:1 | AA/AAA |
| text-secondary / background (crème) | 6,32:1 | AA |
| text-secondary / surface (crème) | 6,89:1 | AA (aussi : texte du bouton désactivé) |
| text-primary-dark / background-dark | 16,01:1 | AA/AAA |
| text-secondary-dark / surface-dark | 7,73:1 | AA |
| on-primary / primary | 4,61:1 | AA |
| on-primary / tile-red-end #9E1A12 | 8,05:1 | AA |
| on-primary / tile-ink-start #5A4C3E | 8,27:1 | AA |
| on-primary / success #2E7A4E (Scan) | 5,24:1 | AA |
| on-primary / danger #B01B13 (Scan) | 6,97:1 | AA |
| success / background (crème) | 4,53:1 | AA, marge serrée : jamais en petit texte sur verre ni sur `hero-wash-end` ; préférer `surface` (4,94:1) |
| warning / background (crème) | 4,81:1 | AA |
| danger / background (crème) | 6,03:1 | AA |
| success-dark / surface-dark | 8,22:1 | AA |
| danger-dark / surface-dark | 6,10:1 | AA |
| text-primary / halo crème du héros | 9,90:1 | AA |
| text-primary-dark / halo sombre du héros (rouge 40 % sur encre) | 10,35:1 | AA |
| **Verre renforcé crème** (`surface-glass-strong` sur image noire, pire cas) : text-primary / text-secondary | 13,12:1 / 5,18:1 | AA |
| **Verre renforcé crème** sur image blanche : text-primary / text-secondary | 18,52:1 / 7,31:1 | AA |
| **Verre renforcé sombre** (`surface-glass-strong-dark` sur image blanche, pire cas) : text-primary-dark / text-secondary-dark | 10,38:1 / 5,49:1 | AA |
| **Verre renforcé sombre** sur image noire : text-primary-dark / text-secondary-dark | 16,40:1 / 8,68:1 | AA |
| border-field / background (crème) · / surface | 3,64:1 · 3,97:1 | ≥ 3:1 (1.4.11) |
| border-field / verre discret crème sur `background` | 3,94:1 | ≥ 3:1 |
| border-field-dark / background-dark · / surface-dark | 3,72:1 · 3,39:1 | ≥ 3:1 |
| border-field-dark / verre discret sombre sur `background-dark` | 3,26:1 | ≥ 3:1 |
| border-field-dark / verre discret sombre sur `surface-dark` | 2,89:1 | **échec** → c'est pourquoi le bouton secondaire a un fond `surface` opaque |
| text-primary / primary (anneau de focus sur bouton rouge) · text-primary-dark / primary | 4,02:1 · 3,98:1 | ≥ 3:1 |
| brand-ink / qr-background | 18,52:1 | AA |
| border / background (crème) | 1,24:1 | **décoratif seulement** — ne délimite jamais un contrôle |
| ~~verre discret 6 % sombre sur média~~ | 1,00–2,83:1 | **interdit** (d'où le verre renforcé) |

Règle de test : tout texte sur verre est mesuré sur l'image la plus défavorable (blanc pur **et** noir pur).

### Dégradés

- **Héros** : halo rouge doux (`{colors.primary}` à 25 % crème / 40 % sombre) + dégradé `{colors.hero-wash-start}` → `{colors.hero-wash-end}` (sombre : `{colors.hero-wash-start-dark}` → `{colors.hero-wash-end-dark}`). Aucun texte rouge ni `text-secondary` posé directement sur le halo (surtitre secondaire : 3,91:1, échec).
- **Tuiles de catégorie** (façon 1win) : rouge `{colors.tile-red-start}` → `{colors.tile-red-end}` ou encre `{colors.tile-ink-start}` → `{colors.tile-ink-end}`. Texte en `{colors.on-primary}` et en grande taille (le crème `#F3EEE4` rendu dans la maquette échoue sur rouge).

Éviter : tout autre accent chromatique (pas de second accent, pas de néon), les couleurs officielles d'une franchise, le rouge en petit texte, le rouge sur dégradé ou média.

### Couleurs forcées (mode contraste élevé)

Sous `@media (forced-colors: active)` : le verre est remplacé par `Canvas`, la sélection est portée par une bordure réelle (`Highlight`) et une icône, jamais par une ombre ; les icônes SVG utilisent `currentColor`.

## Typography

Duo « Affiche shōnen » ([typography-1](mockups/typography-1.html), duo 5) + Sakura Town pour les grands titres de vitrine.

| Rôle | Police | Mobile 375 px | Règles |
|---|---|---|---|
| `{typography.display-brush}` | **Sakura Town** (pinceau) | accroche 42 px, titres de section et nom de produit 44 px (ordinateur 60 à 72 px) ; jamais < 40 px | Grands titres de vitrine (accroche, titres de section de l'accueil, H1 des catalogues, Événements, Blog, Articles et fiches). Règles : voir ci-dessous. |
| `{typography.display}` | Barlow Condensed 800 italique | 52/50 | repli de l'accroche du héros si elle contient un accent ; seul usage de l'italique |
| `{typography.h1}` | Barlow Condensed 700 | 38/40 | titre de page (un seul H1) |
| `{typography.h2}` | Barlow Condensed 700 | 30/34 | titres de section |
| `{typography.h3}` | Barlow Condensed 600 | 20/24 | nom de produit sur carte |
| `{typography.body}` | Barlow 400 | 16/26 | texte courant |
| `{typography.small}` | Barlow 400 | 14/20 | délais, métadonnées, aides |
| `{typography.label}` | Barlow Condensed 600 | 14/18, +0,14 em | surtitres, badges, « Prêt à porter » en étiquette |
| `{typography.button}` | Barlow Condensed 600 | 18/20, +0,06 em | boutons |
| `{typography.price-card}` | Barlow Condensed 700 | 20/24 | prix USD sur carte, tuile, ligne de Récapitulatif |
| `{typography.price-page}` | Barlow Condensed 700 | 38/40 | prix USD sur fiche, total du Récapitulatif |

- **Majuscules uniquement par `text-transform: uppercase`** : les fichiers de traduction restent en casse normale (sinon certains lecteurs d'écran épellent « K-I-T-S »). Jamais plus de 3 lignes de texte en majuscules condensées.
- **Sakura Town, police principale des grands titres de vitrine** (décision memlog) : fichier local `imports/fonts/Sakura Town.otf` (servi par le site, pas Google Fonts), toujours en **texte HTML réel** (jamais une image ni un SVG de texte), en **MAJUSCULES par `text-transform`**, `font-display: swap` avec repli métrique Barlow Condensed. 98 glyphes : **aucun caractère accentué** (é, è, à, ç, ’, « » absents ; trait d'union et apostrophe droite présents). Les titres fixes de vitrine sont donc **rédigés sans accent** (liste dans `EXPERIENCE.md` › Voice and Tone). Jamais sur un lien, un bouton, un prix, une étiquette ni une information indispensable.
- **Bascule entière** : un grand titre saisi par l'admin qui contient un caractère absent de la police (nom de Produit, titre d'Article, nom d'Événement) s'affiche **en entier** en Barlow Condensed, au rôle de son niveau (`{typography.h1}` pour un H1, `{typography.h2}` pour un H2, `{typography.display}` pour l'accroche). **Jamais de mélange de polices dans un mot ni dans un titre.** Le test se fait au rendu côté serveur. Exemples rendus ([key-fiche-cosplay](mockups/key-fiche-cosplay.html), cadre 4) : « Samurai de Kivu » → Sakura Town ; « Guerrière du désert » → Barlow Condensed entier.
- **Hors vitrine** : panier, étape de commande, paiement, attente, retour, compte, bibliothèque, Scan, légal et admin restent en Barlow Condensed. L'admin n'utilise ni Sakura Town ni motif manga (décision). La page 404 est vitrine : H1 « PAGE INTROUVABLE » en Sakura Town ([key-pages-info](mockups/key-pages-info.html)). Les noms sur carte (`{typography.h3}`), étiquettes et boutons (« Prêt à porter », « Le fabriquer moi-même ») restent en Barlow Condensed.
- **Licence de Sakura Town** : démo, usage personnel uniquement (`imports/fonts/READ THIS.txt`). Licence commerciale webfont requise **avant la mise en ligne** (D-1), non bloquante pour la conception. Sans licence : `{typography.display}` partout.
- Barlow et Barlow Condensed : Google Fonts, graisses 400/500/600 et 600/700/800 + 800 italique.
- Pas de texte sur photo ou vidéo sans `{components.glass-panel-strong}` (Guide + décision verre).
- Échelle ordinateur : **non rendue** [HYPOTHÈSE : mêmes rôles, tailles × 1,25 à partir de `lg`] — D-2.

## Layout & Spacing

- **Mobile d'abord, 375 px, sans défilement horizontal** (CLAUDE règle 7) ; **reflow à 320 px CSS** sans perte ni défilement horizontal ; texte agrandi à 200 % sans coupure. Aucune pilule ni carte à hauteur fixe qui couperait le texte (espacement de texte 1.4.12).
- Une colonne sur mobile. **Tuiles de catégorie** : deux colonnes à partir de 360 px ; **une colonne en dessous de 360 px ou à un zoom ≥ 200 %** ; titre en `clamp(20px, 6vw, 30px)` avec `overflow-wrap: anywhere` et `hyphens: auto`. Toutes les chaînes FR et EN sont testées, les plus longues d'abord (« ACCESSOIRES », « ÉVÉNEMENTS »).
- Espacement : échelle Tailwind (pas de 4 px) **[HYPOTHÈSE]** ; marge latérale mobile `{spacing.margin-mobile}` **[HYPOTHÈSE]** ; écart entre cartes `{spacing.card-gap}` (rendu). Cible tactile de toute commande isolée : `{spacing.touch-target}` (44 × 44 px), zone de touche étendue pour les pilules compactes.
- **Héros** : mobile = vidéo plein écran, accroche et deux boutons dans un `{components.glass-panel-strong}`, bouton Pause dans un coin. Ordinateur = vidéo large (~2/3) + **deux tuiles verticales** à droite (« Prêt à porter » / « Le fabriquer moi-même »), structure 1win ([key-accueil](mockups/key-accueil.html)).
- **Accueil** : sections en rangées (cartes produit, tuiles, galerie), FAQ en accordéons (deux colonnes sur ordinateur, structure 1win), pied de page en cartes.
- **En-tête** : mobile 64 px de haut, cibles 44 × 44 px ; ordinateur sans débordement à 1280 px. Contenu : Components › En-tête ; logo : Brand & Style › Logo.
- Points de rupture : Tailwind par défaut (`sm` 640, `md` 768, `lg` 1024, `xl` 1280) **[HYPOTHÈSE]**, plus le seuil de 360 px des tuiles de catégorie.

### Gabarits rendus (validés avec les maquettes)

| Page | Mobile 375 px | Ordinateur ~1280 px | Maquette |
|---|---|---|---|
| Catalogue | grille de cartes 2 colonnes ; filtres repliés sous « Filtrer (n) » | filtres en rangée qui passe à la ligne, tri à droite, grille 4 colonnes | [key-catalogue](mockups/key-catalogue.html) |
| Fiche Kit | une colonne | extrait, chapitres et contenu à gauche ; carte d'achat collante à droite | [key-fiche-kit](mockups/key-fiche-kit.html) |
| Page Événement | une colonne | affiche, programme et photos à gauche ; infos, Types de pass, achat et « Me prévenir » à droite | [key-evenements](mockups/key-evenements.html) |
| Article | une colonne | colonne de lecture de 720 px centrée, cartes liées côte à côte | [key-blog](mockups/key-blog.html) |
| À propos / FAQ | une colonne | portrait à gauche, texte à droite / accordéons sur deux colonnes | [key-pages-info](mockups/key-pages-info.html) |
| Connexion | une colonne | formulaire centré de 440 px | [key-connexion](mockups/key-connexion.html) |
| Panier, étape de commande, Achat de Pass | une colonne | formulaire ou sélecteur à gauche ; Récapitulatif et bouton à droite | [key-panier-commande](mockups/key-panier-commande.html), [key-pass-photo](mockups/key-pass-photo.html) |
| Compte | **Mon compte** = liste de cartes-liens | **Navigation du compte** en colonne gauche de 300 px ; liste et détail à droite | [key-compte](mockups/key-compte.html) |
| Kit en bibliothèque | une colonne | lecteur 2/3, chapitres 1/3, fichiers en dessous | [key-bibliotheque](mockups/key-bibliotheque.html) |
| Admin | en-tête « Admin » + ☰ ; **Barre d'onglets admin** en bas (4 onglets) | **Barre latérale admin** à gauche, contenu à droite | [key-admin-tableau](mockups/key-admin-tableau.html) |

- **Pied de page** : cartes empilées sur mobile, en rangée sur ordinateur ([key-catalogue](mockups/key-catalogue.html)).
- La règle « pas de barre latérale, pas de barre d'onglets en bas » vise la **vitrine**. L'admin a les deux (décision) ; la colonne de navigation du compte n'est pas une barre latérale de site.

## Elevation & Depth

La profondeur vient du **verre dépoli** et du ton, pas des ombres lourdes. **Deux niveaux de verre** (décision) :

- **Verre discret** (`{components.glass-panel}`) : `{colors.surface-glass}` / `{colors.surface-glass-dark}` (55 % crème, 6 % sombre), flou 10 px, saturation 140 %, filet `{colors.glass-border}`. Intensité « Sumi & washi » telle que rendue. **Uniquement sur fond uni** (`background`).
- **Verre renforcé** (`{components.glass-panel-strong}`) : `{colors.surface-glass-strong}` / `{colors.surface-glass-strong-dark}` (85 % crème ou encre), même flou. **Obligatoire sous tout texte posé sur vidéo, photo ou contenu qui défile** : panneau d'accroche du héros, en-tête collant, tuiles d'option du héros, légendes de la tuile de galerie, pilules sur image.
- **Panneau ☰** : **opaque** (`{colors.background}` / `{colors.background-dark}`), sans verre.
- **Repli** sans `backdrop-filter` (navigateurs intégrés anciens) : le verre renforcé reste à 85 % sans flou ; le verre discret passe à `{colors.surface}` opaque.
- **Cartes** : `{colors.surface}` sur `{colors.background}` + filet décoratif. Au survol (ordinateur), la carte **s'élève** (translation verticale + ombre douce) [HYPOTHÈSE valeurs : −4 px, ombre 0 12px 30px encre à 12 %] ; coupé en mouvement réduit.
- **Boîte de dialogue** (`{components.dialog}`) : surface opaque sur voile encre 60 %.
- Pas d'ombre sur le logo ni sur les photos produit.

## Shapes

Très arrondi, doux, façon 1win :

- `{rounded.lg}` (20 px) : cartes, tuiles, accordéons, cartes de paiement, pass, galerie photo, boîtes de dialogue.
- `{rounded.xl}` (22 px) : héros. `{rounded.glass}` (18 px) : panneaux de verre.
- `{rounded.md}` (14 px) : vignettes dans une carte, messages d'état, champs, entrées de la barre latérale et des onglets admin, boutons Monter / Descendre, bloc Paiement en lecture seule.
- `{rounded.sm}` (10 px) : puces d'information.
- `{rounded.full}` : **tous les boutons (pilules)**, sélecteurs segmentés, sélecteur de tailles, badges, pastilles de statut, filtres, lien d'évitement, interrupteurs, barres de progression et de graphique.
- Les photos suivent le rayon de leur conteneur. Le hanko garde son carré arrondi d'origine.

## Components

Spécifications visuelles ; le comportement est dans `EXPERIENCE.md` § Component Patterns (mêmes noms). **En thème sombre, chaque `{colors.x}` cité se lit `{colors.x-dark}`**, sauf exceptions écrites (Écran de Scan, Code QR).

### Structure et navigation

| Composant | Anatomie et rendu |
|---|---|
| **En-tête** (`header`) | Fond `{colors.surface-glass-strong}`, car il passe au-dessus des photos pendant le défilement. **Logo principal horizontal dans le coin gauche** (déclinaisons : Brand & Style › Logo). Ordinateur : logo, 6 rubriques, puis boutons-icônes 44 px à droite (thème, langue, compte, panier avec compteur). Mobile : logo à gauche ; panier avec compteur puis ☰ à droite. |
| **Panneau ☰** (`mobile-menu-panel`) | Plein écran **opaque** `{colors.background}`, rubriques en `{typography.h2}`, entrée secondaire Galerie, bouton « Fermer le menu » 44 px. |
| **Lien d'évitement** (`skip-link`) | Pilule `{colors.text-primary}` / texte `{colors.background}`, invisible jusqu'au focus, en haut à gauche. |
| **Fil d'Ariane** | Liens `{typography.small}` en `{colors.text-primary}` soulignés, séparateur décoratif. |
| **Pied de page** (`footer`) | Cartes surface `{rounded.lg}` à filet `{colors.border}` : **Aide** (FAQ, Contact, Écrire sur WhatsApp), **Infos légales** (Mentions légales, CGV, Livraison et retours, Confidentialité), **Paiement** (« Mobile money, carte. Prix en USD. »), **KOMA SHOP** (« Fait main à Goma, RDC. NATHANGROUP SARL. » en `{typography.small}` `{colors.text-secondary}`). Titres de carte en `{typography.label}`. Liens (`footer-link`) en `{colors.text-primary}`, soulignés 2 px rouge, hauteur 44 px. Réseaux sociaux et lien Galerie ajoutés seulement quand ils existent ([key-catalogue](mockups/key-catalogue.html)). |
| **Bascule de thème** | Pilule compacte dans l'en-tête, zone de touche 44 px. |
| **Sélecteur de langue** | Pilule compacte dans l'en-tête, zone de touche 44 px ; langues écrites dans leur langue (« Français », « English »). |
| **Anneau de focus** (`focus-ring`) | Double anneau : 2 px `{colors.text-primary}` + halo 2 px `{colors.background}`, décalage 2 px, au `:focus-visible` seulement. Distinct de la sélection (rouge + coche). Visible sur tout fond, média compris. |
| **Boîte de dialogue** (`dialog`) | Surface opaque `{rounded.lg}` sur voile encre 60 %, titre `{typography.h3}`, bouton de fermeture 44 px. Sert à la vue agrandie de la galerie et aux confirmations (annulation). |
| **Squelette** (`skeleton`) | Blocs `{colors.surface}` aux formes du contenu attendu. |

### Actions

| Composant | Anatomie et rendu |
|---|---|
| **Bouton principal** (`button-primary`) | Pilule `{colors.primary}`, texte `{colors.on-primary}` en `{typography.button}`, hauteur ≥ 44 px. Un seul par zone d'action. Désactivé : fond `{colors.surface}`, bordure `{colors.border-field}`, texte `{colors.text-secondary}` (6,89:1) — jamais d'opacité réduite ni de rouge plus clair. État « en cours » : libellé changé + indicateur discret, même forme. |
| **Bouton secondaire** (`button-secondary`) | Pilule `{colors.surface}` opaque, contour `{colors.border-field}` (≥ 3:1), texte `{colors.text-primary}`. |
| **Bouton WhatsApp** | Bouton secondaire avec icône WhatsApp [HYPOTHÈSE de style, D-9]. |
| **Bouton de partage** | Bouton secondaire icône + « Partager ». |

### Accueil et catalogues

| Composant | Anatomie et rendu |
|---|---|
| **Héros vidéo** (`hero`) | Vidéo plein cadre `{rounded.xl}`, halo rouge, `{components.glass-panel-strong}` avec surtitre `{typography.label}` (« Fait main à Goma ») et accroche `{typography.display-brush}` (repli `{typography.display}`), tous deux en `{colors.text-primary}`, deux boutons ([key-accueil](mockups/key-accueil.html)). |
| **Bouton Pause du héros** (`hero-pause-button`) | Pilule ronde 44 × 44 px, fond `{colors.surface}`, contour `{colors.border-field}`, icône pause / lecture, dans un coin du héros, hors du panneau d'accroche. |
| **Tuile d'option du héros** (`hero-option-tile`) | Ordinateur seulement : tuile verticale, photo, bandeau `{colors.surface-glass-strong}` portant étiquette, prix `{typography.price-card}`, délai `{typography.small}`. |
| **Tuile de catégorie** (`category-tile`) | Dégradé rouge ou encre, titre `{typography.h2}` réduit en `clamp(20px, 6vw, 30px)`, en `{colors.on-primary}`. |
| **Carte produit** (`product-card`) | Surface, photo `{rounded.md}`, nom `{typography.h3}`, prix `{typography.price-card}`, badge de disponibilité. |
| **Filtres de catalogue** (`catalog-filters`) | Rangée de pilules filtres (contour `{colors.border-field}`, actif = fond `{colors.text-primary}` + coche) qui passe à la ligne, jamais en défilement horizontal de page ; tri en liste déroulante native ; nombre de résultats en `{typography.small}`. Sur mobile, au-delà d'une ligne, les filtres se replient sous un bouton secondaire « Filtrer (n) », n = nombre de filtres actifs ([key-catalogue](mockups/key-catalogue.html)). |
| **Badge de disponibilité** (`availability-badge`) | Pilule `{typography.label}` avec icône : En stock (`success`), Fabrication sur commande (`text-secondary`), Commandes complètes pour le moment / Complet (`danger`). Jamais de quantité. |
| **Carte Événement** (`event-card`) | Photo, date en `{typography.label}`, titre `{typography.h3}`, lieu, badge « Complet » si applicable. |
| **Carte Article** (`article-card`) | Vignette + titre + date (structure animotaku). |
| **Tuile de galerie** (`gallery-tile`) | Photo portée, prénom/pseudo et ville en `{typography.small}` sur bandeau `{colors.surface-glass-strong}`. |
| **Accordéon FAQ** (`faq-accordion`) | Cartes `{rounded.lg}`, question `{typography.h3}`, chevron ([key-pages-info](mockups/key-pages-info.html)). |

### Fiche produit

| Composant | Anatomie et rendu |
|---|---|
| **Galerie photo produit** (`product-gallery`) | Grande photo `{rounded.lg}` ; boutons « Photo précédente » / « Photo suivante » (`button-secondary`, 44 px) ; rangée de vignettes `{rounded.md}`, vignette active bordée 2 px `{colors.text-primary}` ; position « Photo 2 sur 5 » en `{typography.small}` ; bouton « Agrandir » qui ouvre une **Boîte de dialogue** plein écran avec boutons de zoom +/− ([key-fiche-cosplay](mockups/key-fiche-cosplay.html)). |
| **Sélecteur à deux options** (`segmented-choice`) | Pilule à deux segments, contour `{colors.border-field}` ; segment actif : fond `{colors.surface}`, bordure rouge 2 px **et** icône coche ; segment inactif en `{colors.text-secondary}`. Sert aux vrais choix à deux valeurs : Retrait / Livraison, « Porter / Fabriquer » des questions d'accueil. Pour la double option, le segment « Le fabriquer moi-même » ouvre un panneau « Kit lié » (prix, lien « Voir le kit ») sur place. |
| **Sélecteur de tailles** (`size-selector`) | Variante à N options du sélecteur à deux options : une pilule par taille (XS à XXL, Sur-mesure), 52 px de large minimum, 44 px de haut, qui passent à la ligne. Fond `{colors.background}`, contour `{colors.border-field}` ; taille choisie : fond `{colors.surface}`, bordure rouge 2 px **et** coche ([key-fiche-cosplay](mockups/key-fiche-cosplay.html)). |
| **Schéma des Mesures** | Illustration au trait encre sur surface, repères numérotés en rouge (grand texte, sur fond uni). Chaque champ porte le numéro du repère et l'unité. Illustration à produire. |
| **Bandeau d'information** (`info-banner`) | Surface + barre rouge 4 px à gauche (avertissement de zone, navigateur intégré) ; bouton de fermeture 44 px quand il est refermable. |
| **Bouton Obtenir le Kit gratuit** (`free-kit-button`) | `button-primary` « Obtenir le kit gratuit » sur la Fiche Kit gratuit ; résumé de la Licence de kit en `{typography.small}` juste au-dessus. |

### Formulaires, messages et emails

| Composant | Anatomie et rendu |
|---|---|
| **Champ de formulaire** (`form-field`) | Surface, contour `{colors.border-field}` / `{colors.border-field-dark}` (≥ 3:1), `{rounded.md}`, hauteur ≥ 44 px, libellé visible au-dessus (jamais un placeholder comme libellé), aide en `{typography.small}`, erreur en `{colors.danger}` avec icône. Résumé d'erreurs en tête de formulaire = **Message d'état** erreur. |
| **Champ du code de connexion** (`otp-field`) | **Un seul** `form-field` large, chiffres en `{typography.h3}` espacés ; jamais six cases séparées. Lien « Renvoyer le code » en dessous ([key-connexion](mockups/key-connexion.html)). |
| **Case de consentement** | Case 24 px dont tout le libellé est cliquable, texte `{typography.small}`, lien souligné ; liens espacés d'au moins 24 px. |
| **Formulaire « Me prévenir »** | Carte avec champ(s) et bouton principal. |
| **Message d'état** (`status-message`) | Surface, pastille ronde colorée + icône + phrase `{typography.small}`. Succès / attention / erreur / information. |
| **Barre de progression** (`progress-bar`) | Piste 12 px `{rounded.full}`, fond `{colors.background}`, contour `{colors.border-field}`, remplissage `{colors.text-primary}` ; valeur écrite en `{typography.small}` (« 62 % · 23,6 Mo sur 38 Mo ») et état de reprise sous la piste. Téléversements client et admin ([key-admin-produits](mockups/key-admin-produits.html), [key-pass-photo](mockups/key-pass-photo.html)). |
| **Gabarit d'email** | Logo couleur sur `{colors.surface}`, texte `{colors.text-primary}`, bouton principal rouge à texte blanc, code de connexion et informations en texte (jamais en image), pied avec désinscription pour les emails commerciaux. Polices de repli système. |

### Panier et paiement

| Composant | Anatomie et rendu |
|---|---|
| **Récapitulatif** | Lignes article / forfait / réduction / total ; prix en `{typography.price-card}`, total en `{typography.price-page}` ; délai total par Produit physique en `{typography.small}`. Sert aussi au Récapitulatif de Pass. |
| **Sélecteur pays + opérateur** | Deux listes déroulantes natives en `form-field`. **Noms d'opérateurs en texte seul** ; aucun logo d'opérateur sans autorisation écrite (décision). |
| **Carte de moyen de paiement** (`payment-option-card`) | Carte radio, contour `{colors.border-field}` ; sélectionnée : bordure rouge 2 px **et** radio plein + coche. Libellés texte « Mobile money » / « Carte », sans logo de Prestataire, d'opérateur ni de réseau de carte. Ligne factuelle « Paiement traité par {Prestataire} » en `{typography.small}` juste au-dessus du bouton de validation ([key-paiement](mockups/key-paiement.html)). |
| **Écran d'attente de paiement** | Panneau centré, illustration téléphone, texte `{typography.h3}`, montant USD et numéro masqué en `{typography.small}`, indicateur animé discret (statique en mouvement réduit) ([key-attente-paiement](mockups/key-attente-paiement.html)). |
| **Page de retour après paiement** | Titre `{typography.h1}` de l'état réel + **Message d'état** : « en cours de vérification » en `warning` (jamais `success`), payée en `success`, échec en `danger`, « Offert » en `text-primary` ; icône + texte dans tous les cas ; Bouton WhatsApp en secondaire. |

### Compte, bibliothèque, Pass et Scan

| Composant | Anatomie et rendu |
|---|---|
| **Navigation du compte** (`account-nav`) | Liste de cartes-liens surface `{rounded.lg}`, 64 px de haut (56 px dans la colonne ordinateur) : icône 20 px dans un rond `{colors.background}`, titre `{typography.h3}`, aide `{typography.small}` `{colors.text-secondary}`, chevron. Cinq entrées (Mes commandes, Ma bibliothèque, Mes Pass, Envoyer une photo, Préférences) puis « Se déconnecter ». Entrée courante : bordure 2 px `{colors.text-primary}` ([key-compte](mockups/key-compte.html)). |
| **Frise des statuts** (`order-timeline`) | Étape faite : coche + `success` ; étape courante : point plein + texte `{colors.text-primary}` gras ; à venir : cercle vide + `{colors.text-secondary}`. Libellé texte de chaque état ; dates en `small`. Jamais de texte rouge. Une Commande `offerte` affiche l'étiquette « Offert », distincte de « Payée » ([key-compte](mockups/key-compte.html)). |
| **Ligne de kit en bibliothèque** (`library-kit-row`) | Carte surface `{rounded.lg}` : vignette 72 px `{rounded.md}`, titre `{typography.h3}`, progression **en texte** `{typography.small}` (« Chapitre 3 sur 8 · 2 chapitres terminés »), action suivante (« Reprendre au chapitre 3 »). Aucune barre de progression ([key-bibliotheque](mockups/key-bibliotheque.html)). |
| **Lecteur vidéo à chapitres** (`video-chapter-player`) | Lecteur `{rounded.lg}`, commandes ≥ 44 px (lecture/pause, piste temporelle, sous-titres, plein écran), liste de chapitres ; chapitre en cours : icône « en lecture » + texte gras, pas de rouge seul ; sous-titres en `{colors.brand-washi}` sur bandeau encre 85 % ([key-bibliotheque](mockups/key-bibliotheque.html), [key-fiche-kit](mockups/key-fiche-kit.html)). |
| **Ligne de fichier de kit** | Icône de format (PDF A4, PDF US Letter, SVG, STL), nom, taille du fichier, bouton secondaire « Télécharger ». |
| **Carte Type de pass** (`pass-type-card`) | Page Événement : carte surface `{rounded.lg}`, nom `{typography.h3}`, prix `{typography.price-card}`, avantages en liste `{typography.small}`, badge « Complet » si applicable. **Sans compteur** ([key-evenements](mockups/key-evenements.html)). |
| **Sélecteur de Pass** (`pass-selector`) | Achat de Pass : même carte que la Carte Type de pass, plus un compteur −/+ (`button-secondary` 44 px) avec valeur lisible ; champs de noms générés sous le compteur ([key-pass-photo](mockups/key-pass-photo.html)). |
| **Pass** (`pass-card`) | Carte, Type de pass en `{typography.label}` écrit en toutes lettres, nom, Événement, Code QR sur `{colors.qr-background}` (blanc pur dans les deux thèmes), zone de silence de 4 modules, ≈ 200 px minimum ; code court sous le QR ; bouton « Agrandir » ([key-pass-photo](mockups/key-pass-photo.html)). |
| **Écran de Scan** (`scan-result`) | Plein écran, **mêmes couleurs dans les deux thèmes** : valide = fond `{colors.success}` #2E7A4E + texte #FFFFFF (5,24:1) + grande coche + mot « VALIDE » ; refus = fond `{colors.danger}` #B01B13 + texte #FFFFFF (6,97:1) + grande croix + mot « REFUSÉ » + raison. Type de pass toujours écrit en très grand ; la couleur n'est jamais seule ([key-scan](mockups/key-scan.html)). |
| **Bouton « Scanner le pass suivant »** (`scan-next-button`) | Sur l'Écran de Scan seulement : bouton pleine largeur, fond `{colors.on-primary}` #FFFFFF, texte `{colors.brand-ink}`, posé sur le fond vert ou rouge du résultat ; mêmes couleurs dans les deux thèmes. Lien « Saisir le code à la main » toujours visible ([key-scan](mockups/key-scan.html)). |

### Admin

| Composant | Anatomie et rendu |
|---|---|
| **Barre latérale admin** (`admin-sidebar`) | Ordinateur : colonne surface, filet droit `{colors.border}`. Logo, rôle « Administration », puis entrées de 44 px `{rounded.md}` : icône 22 px + libellé Barlow Condensed 600. Entrée courante : fond `{colors.background}`, trait rouge 4 px à gauche, texte gras. Compteur d'attente en pilule à contour `{colors.border-field}`. Langue en bas ([key-admin-tableau](mockups/key-admin-tableau.html)). |
| **Barre d'onglets admin** (`admin-tab-bar`) | Mobile : 4 onglets égaux en bas, fond surface, filet haut `{colors.border}`, 58 px de haut, icône 22 px + libellé `{typography.small}` (minimum 14 px ; la maquette rend 13 px). Onglet courant : texte `{colors.text-primary}` gras, fond `{colors.background}`, trait rouge 3 px en haut. Compteur : pilule `{colors.text-primary}` à texte `{colors.background}`. |
| **Carte de tâche admin** | Carte surface `{rounded.lg}`, compteur en `{typography.h1}`, libellé `{typography.label}`. Compteur à zéro : fond `{colors.background}`, chiffre `{colors.text-secondary}`. |
| **Graphique en barres** (`bar-chart`) | Une ligne par valeur : libellé, piste 16 px `{rounded.full}` (`{colors.background}`, filet `{colors.border}`), remplissage `{colors.text-primary}`, **valeur toujours écrite** (« 9 · 186 USD »). Mobile : libellé et valeur sur une ligne, barre dessous. Sous chaque graphique : « Voir les données en tableau » (Tableau de données). Jamais de rouge seul ni de couleur par série. |
| **Tableau de données admin** (`data-table`) | En-têtes `{typography.label}` `{colors.text-secondary}`, filet `{colors.border-field}` sous l'en-tête, filets `{colors.border}` entre lignes, cellules `{typography.small}`. Statut en Pastille de statut. Sur mobile, les listes deviennent des cartes ([key-admin-commandes](mockups/key-admin-commandes.html)). |
| **Pastille de statut** (`status-pill`) | Forme du Badge de disponibilité : pilule surface à contour `currentColor`, icône 14 px + mot en `{typography.label}` (minimum 14 px ; la maquette rend 13 px). Tâche liée (« Mesures à vérifier ») écrite sous la pastille. |
| **Bloc Paiement (lecture seule)** (`payment-readonly`) | Encadré `{rounded.md}`, fond `{colors.background}`, contour pointillé `{colors.border-field}`, icône de verrou. Liste termes / valeurs : Prestataire, Moyen, Référence de transaction, Montant encaissé, Devise, Notification vérifiée ; termes en `{colors.text-secondary}`, valeurs en gras. |
| **Interrupteur** (`switch`) | Piste 46 × 28 px `{rounded.full}`, contour 2 px `{colors.border-field}`, fond `{colors.background}` ; activé : fond `{colors.text-primary}`, pastille `{colors.background}`. **Mot écrit à côté** (« Actif » / « Désactivé »). Zone de touche 44 px ([key-admin-reglages](mockups/key-admin-reglages.html)). |
| **Boutons Monter / Descendre** (`reorder-buttons`) | Carrés 44 × 44 px `{rounded.md}`, fond surface, contour `{colors.border-field}`, flèche 20 px. En bout de liste : `{colors.text-secondary}` et contour pointillé. Ordre des Agrégateurs, des photos et des chapitres. |

## Do's and Don'ts

| À faire | À éviter |
|---|---|
| Rouge `#E3261C` unique, texte blanc sur bouton rouge | `#C52118`, un second accent, crème sur rouge |
| Rouge en texte seulement ≥ 24 px (ou ≥ 18,66 px gras), sur `background` ou `surface` unis | Petits liens ou petits prix en rouge ; **tout texte rouge sur dégradé, halo, verre, photo ou vidéo** |
| Vraies photos de Jonathan, en grand, même cadrage | Toute image, logo, nom ou couleur officielle d'une franchise (règle 6) |
| Verre discret (~10 px) sur fond uni ; **verre renforcé ≥ 85 % sous tout texte sur média** ; Panneau ☰ opaque | Verre discret sur vidéo ou photo, verre empilé, verre sur le logo |
| Coins ~20 px, boutons en pilule | Angles vifs, rayons hétérogènes |
| Motifs manga ≤ 6 % en fond de section | Trames sur photo produit, derrière un petit texte ou un formulaire de paiement |
| Sakura Town sur les grands titres de vitrine, sans accent, en majuscules, ≥ 40 px, en texte réel ; bascule entière en Barlow Condensed si accent | Sakura Town sur un mot accentué, un mélange de polices dans un titre, du texte courant, un bouton, un écran transactionnel, ou en ligne sans licence |
| Masquer un bloc vide | Avis, chiffres, logos, témoignages ou compteurs inventés (règle 5) |
| Structure 1win (héros + tuiles, rangées, accordéons) | Esthétique casino : néons clignotants, jetons, comptes à rebours, badges « bonus » |
| Filet décoratif `border` comme séparateur | `border` comme contour d'un contrôle interactif (1,24:1) |
| `border-field` (≥ 3:1) sur champs, boutons secondaires, segments, filtres, cartes de paiement | Sélection portée par la couleur seule ou par une ombre seule |
| Noms d'opérateurs, de Prestataires et de moyens de paiement **en texte** | Logos d'opérateurs mobile money, de Prestataires (K-Pay, Polar, PawaPay…) ou de réseaux de carte (Visa, Mastercard) sans autorisation écrite |
| Logo principal horizontal dans le coin gauche ; couleur sur crème, inverse sur sombre | Logo recoloré, déformé, ombré |
| Écran de Scan : couleur + mot + icône + Type de pass écrit | Résultat de Scan signalé par la couleur seule |
| Graphique admin : valeur écrite sur chaque barre + tableau de données | Graphique sans valeur, couleur par série, rouge comme seul repère |
| Barre latérale et onglets en bas : **admin seulement** | Barre latérale ou barre d'onglets en bas dans la vitrine |
| Interrupteur avec le mot « Actif » / « Désactivé » | État porté par la position ou la couleur seule |
| Bandeau « Maquette » sur la toile de présentation | Bandeau, donnée ou chiffre fictif dans le produit (règles 5 et 13) |

## Questions ouvertes

| # | Question | Bloque ? |
|---|---|---|
| D-1 | Licence commerciale **webfont** de Sakura Town, requise avant la mise en ligne. | Bloque la **mise en ligne** avec Sakura Town ; pas la conception (repli Barlow Condensed). |
| D-2 | Échelle typographique **ordinateur** (seule l'échelle 375 px a été rendue ; × 1,25 proposé). | Non (story front). |
| D-3 | Taille et interlignage de Sakura Town (≥ 40 px imposé). | Non. |
| D-6 | Valeurs d'ombre et d'élévation au survol. | Non. |
| D-7 | Échelle d'espacement, marge mobile, points de rupture (Tailwind par défaut proposé). | Non. |
| D-8 | Zone de protection (0,6 × hauteur déduite des SVG) et taille minimale du logo ; usage exact des déclinaisons blanc, noir et hanko. | Non. |
| D-9 | Bibliothèque d'icônes ; usage de l'icône WhatsApp. **Logos d'opérateurs, de Prestataires et de réseaux de carte : interdits sans autorisation écrite** (décision) ; si Jonathan obtient une autorisation, la liste des logos autorisés devient bloquante pour la story de l'écran de paiement. | Non (texte seul par défaut). |
| D-10 | Densité des motifs manga (plafond 6 % fixé). | Non. |
| D-11 | Codes couleur par Type de pass sur l'écran de Scan (source : extraction §8) ; la couleur ne fait qu'accompagner le Type écrit. | Non. |
| D-12 | Photos et vidéo du héros, dépôt de référence design (`[LIEN DU DÉPÔT DE RÉFÉRENCE]` dans CLAUDE.md, Q-10). | Bloque le contenu, pas le système visuel. |
| D-13 | Alignement du PRD (sombre par défaut, accents vifs…) : voir la liste consolidée **E-5** dans `EXPERIENCE.md` › Questions ouvertes. | Non (alignement documentaire). |

Tranchées : **D-4** contour des champs (`border-field` / `border-field-dark`, étendus à tous les contrôles) ; **D-5** anneau de focus double (`text-primary` + halo `background`) ; **D-14** maquettes d'écrans clés (19 maquettes validées, Brand & Style › Maquettes de référence).
