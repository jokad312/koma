# Spine Pair Review — KOMA SHOP

Relecteur : rubric walker (validate.md, Pass 1 catégories 1-5, Pass 2 catégories 6-8). Date : 2026-10-16.
Spines relus sans modification : `DESIGN.md` (draft, 2026-10-16), `EXPERIENCE.md` (draft, 2026-10-16). Sources croisées : `prd.md` (§2.3, §3, §4, §10, §11), `CLAUDE.md`, `.memlog.md` (fait foi sur les décisions), exemples `design-example-*.md` / `experience-example-*.md`, `design-md-spec.md`.

## Overall verdict

La paire est un contrat solide et exploitable pour l'architecture et les stories : les six parcours du PRD (UJ-1 à UJ-6 + UJ-3b) sont repris mot pour mot avec protagoniste, étapes, moment fort et échecs ; tous les tokens couleur ont un hex et une paire sombre ; toutes les références `{chemin.token}` se résolvent ; la logique de paiement (Polar, repli, « en cours de vérification ») est exemplaire et fidèle aux règles 2, 10, 11 et 13. Les manques sont ciblés : une ligne de composant périmée qui contredit le frontmatter (contour des champs), des bordures décoratives à 1,24:1 réutilisées sur des contrôles interactifs, quelques composants et états absents (galerie photo de la fiche, filtres de catalogue, Panier vide, erreurs du code de connexion, Kit gratuit FR-58), et des références visuelles qui reposent sur `.working/` faute de `mockups/`. Rien de critique ; à corriger avant de découper les epics.

## 1. Flow coverage — adequate

Vérifié : les 7 parcours de PRD §2.3 (UJ-1, UJ-2, UJ-3, UJ-3b, UJ-4, UJ-5, UJ-6) ont chacun une Key Flow avec protagoniste nommé, étapes numérotées, **Moment fort** et chemin d'échec ; titres identiques au PRD. Puis les FR « orientés client » qui n'appartiennent à aucun UJ ont été recherchés dans les spines.

### Findings
- **medium** FR-58 « Kit gratuit » (obtention d'un clic, Commande `offerte`, sans Panier ni Prestataire) n'a ni flow, ni composant, ni état : seul le masquage du bloc d'accueil est décrit (EXPERIENCE.md › IA « Accueil — ordre des blocs », State Patterns « Bloc vide »). Cas non connecté, Kit gratuit déjà obtenu, fin de la période de 4 semaines : non spécifiés. *Fix :* ajouter une ligne Component Patterns « Bouton Obtenir le Kit gratuit » (fiche Kit) + 2-3 états (non connecté → connexion puis retour ; déjà dans la bibliothèque ; période terminée), et une étape d'alternative dans UJ-4 (« à partir de la 5ᵉ semaine », déjà dans le PRD).
- **low** UJ-3b n'a pas de chemin d'échec (EXPERIENCE.md › Key Flows › UJ-3b), alors qu'UJ-3 en a un. *Fix :* « Échec : carte refusée par K-Pay → « Réessayer », sans proposer Polar ».
- **low** Les questions d'accueil après création de Compte (FR-12, 3 questions facultatives) n'apparaissent que dans l'IA ; aucun flow ni règle (passer, revenir plus tard, retour au Panier quitté). *Fix :* une ligne dans Component Patterns ou une phrase dans UJ-2 étape 3 précisant que les questions ne retardent pas le retour au Panier.

## 2. Token completeness — adequate

Vérifié : 41 tokens couleur (tous en hex, paires `-dark` complètes), 11 rôles typographiques, 6 rayons, 11 espacements, 30 composants frontmatter ; toutes les références `{…}` des deux spines (≈ 60 distinctes) se résolvent. Contrastes recalculés : toutes les paires listées sont justes et aucune paire texte utilisée n'échoue (succès/attention/erreur sur surface crème 4,94 / 5,25 / 6,58 ; équivalents sombres ≥ 6,1).

### Findings
- **high** Ligne périmée qui contredit le frontmatter : DESIGN.md › Components › « Champ de formulaire » dit « filet `{colors.text-secondary}` [HYPOTHÈSE pour 3:1] », alors que le frontmatter `form-field.border` utilise `{colors.border-field}` et que D-4 est marqué résolu (memlog « (change) Contour des champs »). Un développeur qui lit la table implémente le mauvais token. *Fix :* remplacer par `{colors.border-field}` / `{colors.border-field-dark}`, retirer [HYPOTHÈSE].
- **high** `{colors.border}` (1,24:1, « décoratif seulement » selon Colors et Do's and Don'ts) est le seul contour de contrôles interactifs : `button-secondary`, `segmented-choice` (segments inactifs), `payment-option-card` (carte radio non sélectionnée) (DESIGN.md frontmatter `components`). Contradiction interne avec la règle « ne délimite jamais un champ » et risque WCAG 1.4.11 / règle 7 sur le sélecteur « Prêt à porter / Le fabriquer moi-même » et le choix du moyen de paiement. *Fix :* passer ces contours à `{colors.border-field}` (ou ajouter un indicateur radio ≥ 3:1 sur `payment-option-card` et un fond distinct ≥ 3:1 pour le segment inactif), et l'écrire dans Do's and Don'ts.
- **medium** Contrastes non déclarés pour des combinaisons porteuses : texte sur `surface-glass` au-dessus de la vidéo du héros (accroche, boutons, panneau de verre), texte des tuiles d'option, `on-primary` sur `tile-red-end` / `tile-ink-*`, couleurs d'état en thème sombre (DESIGN.md › Colors › Contrastes de référence). Le verre sur vidéo est le seul cas réellement non garanti. *Fix :* ajouter les lignes calculées (ex. blanc/tile-red-end 8,05:1 ; danger-dark/surface-dark 6,1:1) et une règle de voile minimal sous le texte du héros (opacité du verre ou dégradé sombre) avec cible ≥ 4,5:1.
- **medium** Tokens typographiques incomplets : `price` sans `fontSize`/`lineHeight` (« selon le contexte » [HYPOTHÈSE]), `display-brush` sans taille rendue (D-3), aucune échelle ordinateur (D-2), `display` « italique » seulement en note (pas de `fontStyle`), `button` sans `lineHeight`. Le prix est affiché sur chaque carte et chaque fiche. *Fix :* définir `price-card` (= h3) et `price-page` (= h1) explicitement ; ajouter des tokens `*-desktop` ou une règle d'échelle (ex. ×1,25 à `lg`).
- **medium** Les composants ne référencent que les tokens crème ; la correspondance sombre (`{colors.x}` → `{colors.x-dark}`) n'est énoncée que pour `form-field`. *Fix :* une phrase unique en tête de Components : « en thème sombre, chaque `{colors.x}` se lit `{colors.x-dark}` » ; préciser l'exception `scan-result` (fond `success`/`danger` crème quel que soit le thème ?).
- **low** Valeurs brutes hors tokens : `glass-panel.border` « text-primary à 14 % », `pass-card.qr-background '#FFFFFF'`, `button-primary.padding '12px 18px'`, opacité du repli verre 92 %, ombre de survol. *Fix :* tokens nommés (`qr-background`, `glass-border`, `shadow-hover`) ou références `{spacing.3} {spacing.5}` approximées.
- **low** `glass-blur` est rangé sous `spacing` alors que ce n'est pas un espacement. *Fix :* le déplacer dans un groupe `effects` ou le garder en `note` du composant `glass-panel`.

## 3. Component coverage — adequate

Vérifié : 35 composants de DESIGN.md › Components ont tous une ligne dans EXPERIENCE.md › Component Patterns (Bascule de thème et Sélecteur de langue séparés côté EXPERIENCE, sans perte) avec de vraies règles. Puis recherche des composants utilisés ailleurs sans spécification.

### Findings
- **high** Galerie photo de la fiche produit (FR-6 : face, dos, profil, détail, porté ; balayage horizontal ; pincer/toucher pour zoomer) : citée seulement dans Interaction Primitives › Gestes et DESIGN.md › Photographie, sans ligne Components ni Component Patterns. C'est l'élément principal de la Fiche Produit physique. *Fix :* ajouter « Galerie photo produit » (visuel : ratio, rayon `{rounded.lg}`, indicateur de position ; comportement : balayage, zoom, ordre défini dans l'admin, alt obligatoire, vidéo éventuelle).
- **medium** Filtres et tri des catalogues (FR-5 : univers, prix, disponibilité, niveau ; tri nouveauté/prix) : DESIGN.md › Shapes mentionne « filtres » en pilule, mais aucun composant n'est spécifié (pilules ? feuille mobile ? multi-sélection ? URL partageable ?). *Fix :* ajouter « Filtres de catalogue » dans les deux spines.
- **medium** Sélection des Pass (Types, quantités, noms par personne, Pass Stand = 2 noms) sur la surface Achat de Pass : aucun composant. *Fix :* « Sélecteur de Pass » (compteur par Type, champs de noms générés, rappel Capacité côté serveur).
- **medium** Emails transactionnels et commerciaux (FR-44, FR-45, FR-59) : surface visible de marque sans spec visuelle (seule mention : hanko en signature d'email [HYPOTHÈSE]). *Fix :* une ligne « Gabarit d'email » (logo, couleurs sûres en client mail, bouton, pied avec désinscription) ou déclarer explicitement le sujet hors périmètre UX.
- **low** Composants cités sans spec : lien « Aller au contenu » et bouton pause de la vidéo du héros (Accessibility Floor, [HYPOTHÈSE]), fil d'Ariane (IA › Navigation), boîte de dialogue (Accessibility Floor « dialogues »), onglets en pilule (Brand & Style, Inspiration), `focus-ring` (frontmatter seulement, pas de ligne dans la table Components). *Fix :* lignes courtes dans DESIGN.md › Components, ou retrait des mentions non utilisées.
- **low** `hero.headline` du frontmatter vaut `{typography.display}` alors que la table dit `display-brush` ou `display`. *Fix :* aligner (ex. `headline: '{typography.display-brush}'` + `headline-fallback: '{typography.display}'`).

## 4. State coverage — adequate

Vérifié : chaque surface de l'IA contre empty / cold-load / focus / erreur / hors ligne / permission refusée. Les états de paiement, de stock, de zone, de Kit possédé, de Scan et d'admin sont très complets et fidèles aux règles 2 et 13.

### Findings
- **high** Connexion par code à 6 chiffres : aucun état pour code faux, code expiré, renvoi du code, email non reçu (EXPERIENCE.md › State Patterns ; surface « Connexion / création de Compte »). C'est le passage obligé de tout acheteur, et le seul moyen de connexion dans le navigateur intégré. *Fix :* 3-4 lignes d'état (message clair sans argot, bouton « Renvoyer le code » avec délai réel, retour au Panier conservé).
- **medium** Listes vides non traitées : Panier vide, Mes commandes vide, Ma bibliothèque vide, Mes Pass vide, liste Événements sans Événement à venir, Blog sans Article. *Fix :* une ligne chacune (phrase + lien vers le catalogue ou les Événements), conforme règle 5 (rien d'inventé).
- **medium** Erreurs d'accès au contenu payé : lien signé expiré ou échec de téléchargement d'un Fichier de kit, vidéo de kit qui ne charge pas (Ligne de fichier de kit, Lecteur vidéo à chapitres). *Fix :* état « Le lien a expiré, réessaie » (nouveau lien demandé au serveur, règle 1) et erreur de lecture avec reprise.
- **medium** Écran de Scan : refus d'accès à la caméra non couvert (permission-denied), alors que le Scan en dépend. *Fix :* état « Autorise la caméra » + saisie manuelle du code si l'architecture la prévoit (sinon question ouverte).
- **medium** Envoi d'une photo / Réalisation : échec de téléversement, fichier trop lourd ou format refusé non couverts (seul l'admin a « téléversement interrompu »). *Fix :* reprendre le même traitement côté client (progression, reprise, limite affichée).
- **low** Hors ligne côté client (au-delà du « réseau lent ») et erreur serveur (500) non couverts. *Fix :* une ligne chacune ; pour le paiement, renvoyer explicitement à « en cours de vérification ».
- **low** Kit gratuit (voir §1) et Pass acheté sans être connecté (FR-33 : « client connecté ») sans état explicite. *Fix :* état « Connexion requise » avec retour sur la page Événement.

## 5. Visual reference coverage — adequate

Fichiers listés : `imports/` (planche capture, 3 captures 1win, 5 JPG de logo, pack `logos/SVG` et `logos/PNG` de 41 fichiers, `fonts/Sakura Town.otf`, `fonts/READ THIS.txt`, `fonts/Cover.png`) ; pas de dossier `mockups/` ni `wireframes/`. « Les spines priment » est énoncé (DESIGN.md en tête ; EXPERIENCE.md en tête et sous l'IA).

### Findings
- **medium** Aucune maquette d'écran clé (`mockups/` absent) : les seules références visuelles composées sont `.working/color-themes-1.html` et `.working/typography-1.html`, citées comme sources et références (DESIGN.md frontmatter `sources`, Colors, Typography ; EXPERIENCE.md › IA). `.working/` est un espace de travail, susceptible d'être nettoyé. *Fix :* copier ces deux rendus dans `mockups/` (ou `imports/`) et mettre à jour les liens ; envisager 3-4 écrans clés (accueil mobile, fiche Cosplay avec double option, récapitulatif + paiement, attente de paiement).
- **low** Orphelins : les 5 JPG à la racine d'`imports/` (`KOMA_hanko_blanc.jpg`, `KOMA_symbol_couleur.jpg`, `KOMA_vertical_couleur.jpg`, `KOMA_wordmark_couleur.jpg`, `logo principale.jpg`) et `imports/fonts/Cover.png` ne sont cités nulle part. *Fix :* une ligne dans DESIGN.md › Logo : « JPG d'origine remplacés par le pack SVG/PNG, ne pas utiliser ».
- **low** Références peu spécifiques : EXPERIENCE.md cite `imports/gofullpage-*.png` en glob sans dire ce que chaque capture illustre (DESIGN.md le fait partiellement) ; le pack logo est cité par dossier (acceptable). *Fix :* nommer ce qu'illustre chaque capture 1win (accueil = héros + tuiles ; bonuses = rangées de cartes à dégradés ; casino-play = accordéons FAQ / pied de page).

## 6. Bloat & overspecification — adequate

### Findings
- **low** EXPERIENCE.md › « Paiement & confiance » restate largement CLAUDE.md règles 2, 3, 10 et FR-16/FR-20 déjà repris dans Component Patterns et State Patterns. Seules les phrases « Repli : jamais automatique… jamais après un délai dépassé » et « délai 24 h non affiché » sont des décisions nouvelles. *Fix :* réduire à ces décisions + renvoi aux règles, ou garder tel quel en acceptant la redondance (section très lue par les devs paiement : le coût est faible).
- **low** EXPERIENCE.md › « Bilingue FR/EN » recoupe Foundation et IA › Navigation. *Fix :* fusionner dans Foundation.
- **low** DESIGN.md › Photographie restate PRD §10 et le Guide ; utile au photographe, peu au dev. Acceptable en voix éditoriale.

## 7. Inheritance discipline — adequate

Vérifié : `sources` des deux spines (prd.md, addendum.md, guide-koma-shop.md, CLAUDE.md, .memlog.md, .working/*) existent ; titres des UJ verbatim ; termes du Glossaire (Produit physique, Panier mixte, Tentative de paiement, Ordre de priorité, Type de pass, Verrou hors ligne, statuts `en fabrication`, `livrée`, `échouée`, `expirée`…) employés tels quels ; noms de composants cohérents entre DESIGN et EXPERIENCE ; références de tokens dans EXPERIENCE (`{colors.background}`, `{colors.background-dark}`, `{components.focus-ring}`) résolues.

### Findings
- **medium** Mises à jour PRD nécessaires (écarts qui sont des décisions memlog, donc non fautifs côté spines) : (a) « Le porter » → « Prêt à porter » dans FR-1, §4.1 (description et FR-1), §4.2 (description), FR-7, Glossaire « Kit lié », UJ-4 (déjà listé E-5) ; noter que PRD UJ-1 emploie déjà « Prêt à porter », d'où une incohérence interne au PRD ; (b) §10 « sombre par défaut, mode clair mémorisé » → crème par défaut (D-13, E-5) ; (c) **non listé** : §10 « un ou deux accents vifs pour les boutons et les prix » → un seul rouge, prix en `text-primary` (décision memlog « Règle du rouge validée »). *Fix :* ajouter (c) à E-5/D-13 et faire passer ces trois mises à jour par bmad-prd avant les epics.
- **low** Termes abrégés : « Zone » pour « Zone de remise » (Component Patterns › Sélecteur à deux options, UJ-1), « Alertes » pour « Alerte événement » (IA › Préférences, Admin). *Fix :* employer le terme complet du Glossaire au moins à la première occurrence.
- **low** `.working/extract-sources.md` et les rendus `.working/*.html` figurent dans `sources` : ce sont des intermédiaires, pas des sources amont. *Fix :* voir §5 (promouvoir les rendus) ; retirer `extract-sources.md` des sources ou le garder en note de traçabilité.

## 8. Shape fit — strong

DESIGN.md : Brand & Style → Colors → Typography → Layout & Spacing → Elevation & Depth → Shapes → Components → Do's and Don'ts, ordre respecté ; « Questions ouvertes » ajoutée en fin, sans casser l'ordre. EXPERIENCE.md : les 8 défauts requis sont présents ; Responsive & Platform (multi-largeur) et Inspiration & Anti-patterns (1win, animotaku, myutaku, cultureotaku dans le memlog) présents comme requis. Sections inventées « Paiement & confiance », « Admin », « Questions ouvertes » méritent leur place (enjeu paiement réel, surface admin à part entière, questions bloquantes tracées) ; « Bilingue FR/EN » est la plus faible (voir §6).

### Findings
- **low** « Motifs manga » est rangé sous Shapes ; il relève plutôt de Brand & Style ou Do's and Don'ts (règle de décor). *Fix :* déplacer, sans autre changement.

## Mechanical notes

- Numérotation des questions ouvertes d'EXPERIENCE.md : **E-19 manque** (E-18 → E-20).
- Questions ouvertes **bloquantes** à résoudre avant les stories concernées (correctement tracées, mais le contrat n'est pas complet sans elles) : E-1 (ordre des moyens de paiement), E-2 (libellé Plafond atteint), E-6 (nom du Prestataire affiché), E-7 / Q-3 (montant débité), E-8 / Q-1 (Couverture), E-10 (liste des Mesures), E-22 / Q-5 (textes légaux des cases), D-1 / E-21 (licence Sakura Town, bloque la mise en ligne).
- Frontmatter : DESIGN.md complet (`name`, `description`, `status`, `updated`, `sources`, tokens). EXPERIENCE.md sans `description` (les exemples n'en ont pas non plus : acceptable). `surface-glass` en hex à 8 chiffres (`#FFFFFF8C`) : valide CSS, à confirmer côté outil de génération de tokens.
- Aucun diagramme Mermaid : rien à valider.
- Cohérence de nommage : `hero.headline` (frontmatter) vs table Components (voir §3) ; ligne « Champ de formulaire » périmée (voir §2).
- Toutes les références `{colors.*}`, `{typography.*}`, `{rounded.*}`, `{spacing.*}`, `{components.*}` se résolvent (`{chemin.du.token}` d'EXPERIENCE.md est un exemple de syntaxe, pas une référence).

### Décompte
- critical : 0
- high : 4
- medium : 13
- low : 16
