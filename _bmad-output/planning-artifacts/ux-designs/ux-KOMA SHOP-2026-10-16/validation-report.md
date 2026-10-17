# Validation Report — KOMA SHOP

- **DESIGN.md:** `C:\Users\mandu\Desktop\KOMA SHOP\_bmad-output\planning-artifacts\ux-designs\ux-KOMA SHOP-2026-10-16\DESIGN.md`
- **EXPERIENCE.md:** `C:\Users\mandu\Desktop\KOMA SHOP\_bmad-output\planning-artifacts\ux-designs\ux-KOMA SHOP-2026-10-16\EXPERIENCE.md`
- **Run at:** 2026-10-16

## Overall verdict
La paire est un contrat solide et exploitable pour l'architecture et les stories : les parcours du PRD (UJ-1 à UJ-6 + UJ-3b) sont repris mot pour mot avec protagoniste, étapes, moment fort et échecs ; tous les tokens couleur ont un hex et une paire sombre ; toutes les références `{chemin.token}` se résolvent ; la logique de paiement (Polar, repli, « en cours de vérification ») est fidèle aux règles 2, 10, 11 et 13. Les manques du rubric sont ciblés : une ligne de composant périmée (contour des champs), des bordures décoratives à 1,24:1 sur des contrôles interactifs, quelques composants et états absents (galerie photo, filtres, Panier vide, erreurs du code de connexion, Kit gratuit) et des références visuelles qui reposent sur `.working/`.

Les deux relecteurs supplémentaires changent le tableau : là où le rubric ne voyait « rien de critique », ils en trouvent trois. Le verre dépoli à 6 % posé sur la vidéo et les photos fait tomber le texte à 1,0–2,8:1 en thème sombre ; les vidéos de kit, produit payant principal, n'ont aucun sous-titre ; et l'admin, tel que décrit, peut passer une Commande en `payée` à la main, contre la règle 2. S'ajoutent des trous d'états de paiement (Commande `offerte`, double soumission, carte indisponible, Trop-perçu) qui laissent le développeur inventer un comportement. Verdict consolidé : prêt pour l'essentiel après corrections, **non prêt pour les stories de paiement, d'accueil (héros) et de lecteur vidéo** tant que les critical et les high ne sont pas traités.

Après dédoublonnage : 96 findings bruts, 8 fusions, **88 findings : 3 critical, 15 high, 41 medium, 29 low.**

## Category verdicts
- Flow coverage — adequate
- Token completeness — adequate
- Component coverage — adequate
- State coverage — adequate
- Visual reference coverage — adequate
- Bloat & overspecification — adequate
- Inheritance discipline — adequate
- Shape fit — strong

## Findings by severity

### Critical (3)
**[Accessibilité + Token completeness]** — A11Y-01 Verre sombre à 6 % : texte illisible sur la vidéo, les photos et le contenu qui défile, 1,0 à 2,8:1 (§ DESIGN.md surface-glass-dark ; Elevation & Depth ; hero, header, mobile-menu-panel, hero-option-tile, button-secondary)
Un voile à 6 % ne change pratiquement pas la luminance ; `text-primary-dark` tombe à 1,00–2,83:1, `text-secondary-dark` à 1,04–2,17:1 (1.4.3, 1.4.11). Fusionné avec le medium rubric « contrastes non déclarés, verre sur vidéo non garanti ». Sources : A11Y-01, rubric §2.
Fix: deux niveaux de verre ; sur média ou contenu défilant, opacité minimale 0,85 dans les deux thèmes ; panneau ☰ opaque ; tokens `surface-glass-strong(-dark)` ; test sur blanc pur et noir pur.

**[Accessibilité]** — A11Y-02 Vidéos de kit (produit payant) sans sous-titres ni transcription (§ EXPERIENCE.md › Lecteur vidéo à chapitres, UJ-2 étapes 6–7 ; DESIGN.md video-chapter-player)
Échec 1.2.2 (A) et 1.2.5 (AA) pour un produit vendu ; public souvent sans son, sur réseau lent.
Fix: WebVTT FR obligatoires, EN si /en vend le kit ; transcription par chapitre ; admin refuse une vidéo sans piste ; lecteur entièrement au clavier.

**[Paiement & confiance]** — C-1 L'admin peut passer une Commande en `payée` à la main : rien ne l'interdit dans l'UX (§ EXPERIENCE.md › Admin « avancement manuel » ; UJ-6 étape 4)
Un sélecteur proposant tous les Statuts viole la règle 2 et NFR-5 : faux stock, faux Kit ouvert, faux Pass émis.
Fix: table « Transitions manuelles autorisées » ; jamais `payée`, `offerte`, `échouée`, `expirée` côté admin ; `remboursée` seulement avec preuve ; pas de `en fabrication` sans Mesures validées ; transition interdite = action absente.

### High (15)
**[Token completeness + Accessibilité]** — Ligne « Champ de formulaire » périmée, contredit le frontmatter (§ DESIGN.md › Components › Champ de formulaire)
La table dit `{colors.text-secondary}` [HYPOTHÈSE], le frontmatter `{colors.border-field}` ; D-4 résolu. Sources : rubric §2, A11Y-19.
Fix: remplacer par `{colors.border-field}` / `{colors.border-field-dark}`, retirer [HYPOTHÈSE].

**[Token completeness]** — `{colors.border}` (1,24:1, décoratif) est le seul contour de contrôles interactifs (§ DESIGN.md frontmatter : button-secondary, segmented-choice, payment-option-card)
Risque WCAG 1.4.11 / règle 7 sur le choix « Prêt à porter / Le fabriquer moi-même » et le moyen de paiement.
Fix: contours en `{colors.border-field}` ou indicateur ≥ 3:1 ; l'écrire dans Do's and Don'ts.

**[Component coverage + Accessibilité]** — Galerie photo de la fiche produit : ni spec, ni alternative aux gestes (§ EXPERIENCE.md › Interaction Primitives › Gestes ; DESIGN.md › Photographie)
Élément principal de la Fiche Produit physique (FR-6), sans ligne Components ; balayage et pincement sans alternative (2.5.1, 2.5.7). Sources : rubric §3, A11Y-09.
Fix: composant « Galerie photo produit » dans les deux spines ; boutons précédent/suivant ≥ 44 px, vignettes clavier, « Photo 2 sur 5 » ; zoom par boutons ou vue agrandie en `dialog` ; zoom natif jamais bloqué.

**[State coverage + Accessibilité]** — Connexion par code à 6 chiffres : saisie et états d'erreur absents (§ EXPERIENCE.md › Connexion / création de Compte ; Navigateur intégré ; UJ-2 étape 3)
Passage obligé de tout acheteur ; ni code faux, expiré, renvoi, email non reçu ; rien sur la saisie (3.3.8). Sources : rubric §4, A11Y-06.
Fix: un seul champ `one-time-code` numérique, collage permis ; validité annoncée ; « Renvoyer le code » ; erreur reliée ; code en texte dans l'email ; retour au Panier conservé.

**[Accessibilité]** — A11Y-03 Accroche et textes du héros en rouge ou secondaire sur le halo et la vidéo (§ DESIGN.md › Dégradés, hero, Règle du rouge)
Rouge 2,46 / 2,60 / 1,37:1 ; surtitre secondaire 3,91:1.
Fix: rouge interdit en texte sur dégradé ou média ; accroche et surtitre en `text-primary`.

**[Accessibilité]** — A11Y-04 Vidéo du héros : bouton pause encore en [HYPOTHÈSE] (§ EXPERIENCE.md › Accessibility Floor, Héros vidéo)
2.2.2 niveau A : la pause n'est pas une option.
Fix: bouton Pause/Lecture ≥ 44 px, `aria-pressed`, mémorisé ; photo de repli en mouvement réduit ; vidéo `aria-hidden` sans audio ; parallaxe coupée.

**[Accessibilité]** — A11Y-05 Le sélecteur à deux options change de page à la sélection (§ EXPERIENCE.md › Sélecteur à deux options ; DESIGN.md segmented-choice)
3.2.2 : avec les flèches on quitte la page sans le vouloir.
Fix: « Le fabriquer moi-même » devient un lien, ou un panneau « Kit lié » avec lien ; vrais choix en `radiogroup`.

**[Accessibilité + Paiement & confiance]** — A11Y-07 États de paiement : annonces, focus et délais insuffisamment définis (§ EXPERIENCE.md › Écran d'attente de paiement, State Patterns, E-9)
Annonces répétées ou manquées au sondage ; échec non poli ; Délai de paiement = limite de temps (2.2.1). Fusionné avec L-1 (compte à rebours). Sources : A11Y-07, L-1.
Fix: `role="status"` une fois par changement réel, `role="alert"` pour l'échec, focus sur le nouvel état ; « À payer avant [heure] » en texte statique lu du serveur, sans compte à rebours ; relance sans ressaisie ; `<title>` reflète l'état.

**[Accessibilité]** — A11Y-08 Tuiles de catégorie à 2 colonnes : débordement à 375 et 320 px (§ DESIGN.md › Layout & Spacing, category-tile)
≈ 133 px utiles ; « ACCESSOIRES » 30 px occupe 150–165 px.
Fix: `clamp(20px, 6vw, 30px)`, césure ; 1 colonne sous 360 px ; tester FR/EN.

**[Accessibilité]** — A11Y-10 Écran de Scan : couleur seule rouge/vert, texte non défini, échec en sombre (§ DESIGN.md scan-result, D-11 ; EXPERIENCE.md › Écran de Scan)
Blanc sur `success-dark` / `danger-dark` : 2,05 / 2,77:1 ; couleurs par Type de pass.
Fix: fonds crème forcés + texte blanc ; « VALIDE » / « REFUSÉ » + icône ; vibration ou son ; Type écrit ; `role="alert"`.

**[Paiement & confiance + Flow coverage + State coverage]** — H-1 Commande `offerte` et Kit gratuit : aucun état, aucun flow, risque d'affichage « Payée » (§ EXPERIENCE.md › State Patterns, Frise, Mes commandes ; FR-58, FR-42)
Sans état dédié, statut simulé (règle 13) ; flux « d'un clic » non décrit ; non connecté, déjà obtenu, période terminée non spécifiés. Sources : H-1, rubric §1 (medium), rubric §4 (low).
Fix: état « Offert » sans montant ni Prestataire ; composant « Bouton Obtenir le Kit gratuit » avec ses états ; alternative dans UJ-4 ; ne compte pas comme premier achat.

**[Paiement & confiance]** — H-2 Double soumission, retour arrière, onglet fermé, multi-onglets : non traités (§ EXPERIENCE.md › Bouton principal, Écran d'attente ; State Patterns)
Double toucher très probable ; risque de double débit (R-6).
Fix: états « Paiement lancé » (verrou + idempotence), « Tentative en cours retrouvée », « Onglet fermé » ; pas de changement de moyen pendant une Tentative.

**[Paiement & confiance]** — H-3 Aucun état « carte indisponible » : risque de Polar en repli ou de bouton carte mort (§ EXPERIENCE.md › State Patterns ; UJ-3 ; Q-13, FR-16)
Violation possible de la règle 10 si K-Pay est coupé.
Fix: état « Carte indisponible pour ce panier », sans substitution ; jamais Polar pour un physique ou un Pass ; question ouverte 100 % kits + Polar inactif ; annoter UJ-3.

**[Paiement & confiance]** — H-4 Logos d'opérateurs mobile money prévus en hypothèse : logos non contractualisés (§ DESIGN.md › Sélecteur pays + opérateur ; D-9)
Marques tierces non autorisées (règle 5, esprit de la règle 6).
Fix: noms en texte ; logos après autorisation écrite ; ligne Do's and Don'ts ; D-9 bloquant si logos envisagés.

**[Paiement & confiance]** — H-5 Trop-perçu côté client classé non bloquant (§ EXPERIENCE.md › State Patterns ; E-13 ; FR-19, R-6)
Client débité qui voit « expirée » : rien ou un message inventé.
Fix: E-13 bloquant ; message proposé à valider + WhatsApp, sans promesse de délai.

### Medium (41)
**[Token completeness]** — Tokens typographiques incomplets (§ DESIGN.md › Typography)
`price` sans taille, `display-brush` sans taille rendue, pas d'échelle ordinateur, italique en note, `button` sans `lineHeight`.
Fix: `price-card` / `price-page` ; tokens `*-desktop` ou règle ×1,25 à `lg`.

**[Token completeness]** — Composants référencés en tokens crème seulement (§ DESIGN.md › Components)
Correspondance sombre énoncée pour `form-field` seulement ; exception `scan-result` non tranchée.
Fix: phrase « en sombre, `{colors.x}` se lit `{colors.x-dark}` » ; préciser `scan-result`.

**[Component coverage]** — Filtres et tri des catalogues non spécifiés (§ DESIGN.md › Shapes ; FR-5)
Forme, multi-sélection, URL partageable inconnues.
Fix: composant « Filtres de catalogue » dans les deux spines.

**[Component coverage]** — Emails transactionnels et commerciaux sans spec visuelle (§ FR-44, FR-45, FR-59)
Surface de marque visible.
Fix: ligne « Gabarit d'email » ou déclarer hors périmètre UX.

**[State coverage]** — Listes vides non traitées (§ EXPERIENCE.md › State Patterns)
Panier, Mes commandes, bibliothèque, Mes Pass, Événements, Blog.
Fix: une ligne chacune, phrase + lien, rien d'inventé.

**[State coverage]** — Erreurs d'accès au contenu payé (§ Ligne de fichier de kit ; Lecteur vidéo à chapitres)
Lien signé expiré, échec de téléchargement, vidéo qui ne charge pas.
Fix: « Le lien a expiré, réessaie » (nouveau lien serveur, règle 1) ; reprise de lecture.

**[State coverage]** — Écran de Scan : refus d'accès à la caméra (§ EXPERIENCE.md › Écran de Scan)
Permission refusée non couverte.
Fix: état « Autorise la caméra » + saisie manuelle si prévue.

**[State coverage]** — Envoi de photo / Réalisation : échecs de téléversement (§ EXPERIENCE.md › State Patterns)
Seul l'admin est couvert.
Fix: progression, reprise, limite affichée côté client.

**[Visual reference coverage]** — Aucune maquette d'écran clé ; références composées dans `.working/` (§ DESIGN.md sources ; EXPERIENCE.md › IA)
Espace de travail susceptible d'être nettoyé.
Fix: copier dans `mockups/`, mettre à jour les liens ; 3-4 écrans clés.

**[Inheritance discipline]** — Mises à jour du PRD nécessaires (§ PRD FR-1, §4.1, §4.2, FR-7, Glossaire, UJ-4, §10)
« Prêt à porter », crème par défaut, un seul rouge (ce dernier non listé dans E-5/D-13).
Fix: ajouter (c) à E-5/D-13 ; passer par bmad-prd avant les epics.

**[Accessibilité]** — A11Y-11 Anneau de focus rouge 2 px confondu avec la sélection, invisible sur média (§ DESIGN.md focus-ring, D-5)
Fix: anneau double `text-primary` + halo `background`, `:focus-visible` ; coche sur la sélection.

**[Accessibilité]** — A11Y-12 Focus masqué par l'en-tête collant (§ EXPERIENCE.md › En-tête ; bandeau Chrome)
Fix: `scroll-padding-top` ; en-tête non collant à zoom ≥ 200 % ou < 500 px de haut.

**[Accessibilité]** — A11Y-13 Couleurs forcées : sélection perdue (§ DESIGN.md active-ring, selected-ring, glass-panel)
Fix: `border`/`outline` réels + icône ; `@media (forced-colors: active)` ; SVG `currentColor`.

**[Accessibilité]** — A11Y-14 Panneau ☰ et dialogues : piège de focus insuffisamment spécifié (§ EXPERIENCE.md › Panneau ☰)
Absorbe la mention rubric « boîte de dialogue sans spec ».
Fix: `aria-expanded`, libellé « Menu », `inert`, Échap, retour du focus, `aria-modal`.

**[Accessibilité + Component coverage]** — A11Y-15 Lien d'évitement encore en [HYPOTHÈSE] (§ EXPERIENCE.md › Accessibility Floor)
Niveau A. Absorbe le low rubric §3 « composants cités sans spec » (avec A11Y-04, A11Y-11, A11Y-14). Sources : A11Y-15, rubric §3.
Fix: décision ferme, cible `<main id="contenu">` ; repères de page.

**[Accessibilité]** — A11Y-16 Cibles tactiles : 44 px en [HYPOTHÈSE] (§ Accessibility Floor ; pilules, case 24 px, ✕, chapitres)
Fix: ≥ 44 × 44 px pour toute commande isolée ; libellé de case cliquable.

**[Accessibilité]** — A11Y-17 Reflow à 320 px non exigé, apparitions au défilement (§ Accessibility Floor, Interaction Primitives)
Fix: reflow 320 px ; contenu visible par défaut au rendu serveur ; pas de hauteur fixe.

**[Accessibilité]** — A11Y-18 Information portée par la couleur seule : frise, chapitres, badges (§ DESIGN.md order-timeline, video-chapter-player)
Fix: icônes + libellés ; `aria-current` ; jamais de texte rouge dans la frise.

**[Accessibilité]** — A11Y-19 Formulaires : autocomplete, Mesures, ressaisie, résumé d'erreurs (§ Champ de formulaire, Mesures, Étape de commande)
Fix: `autocomplete`, rien ressaisi après échec (3.3.7), Mesures numérotées avec unité, résumé d'erreurs avec focus, pas de placeholder comme libellé.

**[Accessibilité]** — A11Y-20 Bouton principal désactivé : raison inatteignable au clavier (§ Bouton principal)
Fix: `aria-disabled` + `aria-describedby` ; fond `surface`, bordure `border-field`.

**[Accessibilité]** — A11Y-21 Cartes entièrement cliquables : noms verbeux, liens imbriqués (§ Carte produit, Tuile d'option, Carte Événement)
Fix: lien sur le titre étendu par pseudo-élément.

**[Accessibilité]** — A11Y-22 Langue des passages et noms de langue (§ Bilingue FR/EN, Voice and Tone)
Fix: `lang` sur les passages, « English » / « Français » dans leur langue, `lang="ja"`.

**[Accessibilité]** — A11Y-23 Emojis et glyphes lus par les lecteurs d'écran (§ Voice and Tone ; ☰ ✕)
Fix: jamais dans un nom accessible ; `aria-hidden` ; `aria-label` traduits.

**[Accessibilité]** — A11Y-24 Lisibilité de Sakura Town et des capitales condensées (§ DESIGN.md › Typography)
Fix: 1–4 mots ≥ 40 px, texte réel, `text-transform`, `label` ≥ 14 px.

**[Accessibilité]** — A11Y-25 Code QR des Pass : alternative et robustesse (§ pass-card ; Mes Pass)
Fix: alt descriptif, code court lisible, zone de silence, bouton « Agrandir ».

**[Accessibilité]** — A11Y-26 Annonces manquantes : panier, copie de lien, filtres (§ En-tête, Bouton de partage, Catalogues)
Fix: `role="status"` pour ajout, copie, nombre de résultats ; `aria-busy`.

**[Accessibilité]** — A11Y-27 Verre crème 55 % sur média : texte secondaire et rouge en échec (§ surface-glass ; hero-option-tile, galerie)
Fix: verre fort de A11Y-01 sur média ; voile `brand-ink` ≥ 60 %.

**[Accessibilité]** — A11Y-28 Sélecteur pays et opérateur : listes dépendantes et logos (§ Sélecteur pays + opérateur)
Fix: `<select>` natifs, changement annoncé, nom en texte, erreur reliée.

**[Accessibilité]** — A11Y-29 Critère de validation trop faible : « Lighthouse ≥ 90 » (§ Accessibility Floor, NFR-2)
Fix: axe-core, clavier, TalkBack/VoiceOver, 320 px, 200 %, mouvement réduit, couleurs forcées.

**[Paiement & confiance]** — M-1 Page de retour : lecture serveur affirmée mais pas cadrée (§ Component Patterns, State Patterns « Payée »)
Fix: ignorer `?status=` ; interroger le serveur ; avant Notification = « en cours de vérification ».

**[Paiement & confiance]** — M-2 Origine de la liste des opérateurs ; épuisement des Agrégateurs (§ Sélecteur pays + opérateur)
Fix: union de la table Couverture ; état « Plus aucun service pour cet opérateur ».

**[Paiement & confiance]** — M-3 Classification échec client / échec Agrégateur non sourcée (§ State Patterns)
Fix: table de codes par Adaptateur ; code inconnu → « en cours de vérification » ; question sur l'annulation client.

**[Paiement & confiance]** — M-4 Repli : ce que voit le client n'est pas spécifié (§ Échec confirmé ; E-6)
Fix: E-6 bloquant ; message « nouvelle demande, la première n'a pas été débitée » après échec confirmé.

**[Paiement & confiance]** — M-5 Zone sans argot ni emoji incomplète (§ Voice and Tone)
Fix: liste exhaustive des surfaces transactionnelles, page payée comprise.

**[Paiement & confiance]** — M-6 Q-3 / E-7 peut faire entrer une devise locale (§ Paiement & confiance ; E-7)
Fix: aucun montant hors USD tant que Q-3 et CLAUDE.md ne sont pas modifiés.

**[Paiement & confiance + Component coverage + State coverage]** — M-7 Achat de Pass : sélecteur, récapitulatif, Code promo, connexion, Capacité non décrits (§ IA « Achat de Pass » ; UJ-5 ; FR-33, FR-47)
Fusionné avec le medium rubric « Sélection des Pass sans composant » et la partie Pass du low rubric §4. Sources : M-7, rubric §3, rubric §4.
Fix: « Sélecteur de Pass » ; Récapitulatif serveur ; « Connexion requise » ; « Événement complet entre-temps » ; jamais dans le Panier ; carte = K-Pay.

**[Paiement & confiance]** — M-8 Panier sans Compte : prix servis par le navigateur ; changement de prix et fusion (§ Article indisponible ; Récapitulatif)
Fix: navigateur = identifiants et quantités ; états « Montant modifié » et « Kit déjà possédé après fusion ».

**[Paiement & confiance]** — M-9 Remise : lieu de retrait, délai de livraison, `expédiée` en retrait (§ Récapitulatif, UJ-1 étape 5 ; FR-51)
Fix: lieu lu du Réglage ; questions ouvertes sur la source du délai et le libellé.

**[Paiement & confiance]** — M-10 Pied de page « moyens de paiement » : risque de liste statique (§ DESIGN.md › Pied de page)
Fix: liste serveur des Prestataires actifs ou formulation générique.

**[Paiement & confiance]** — M-11 Filtre « univers » et noms de franchise (§ Catalogues ; E-15 ; FR-5 vs §9, règle 6)
Fix: question ouverte bloquante pour la story Catalogue, liée à Q-7.

**[Paiement & confiance]** — M-12 Annulation d'une Commande mixte et preuve de remboursement (§ Frise ; Annulation hors délai)
Fix: question ouverte à Jonathan ; `remboursée` impossible sans preuve.

### Low (29)
**[Flow coverage]** — UJ-3b n'a pas de chemin d'échec (§ EXPERIENCE.md › Key Flows › UJ-3b)
Fix: « Échec : carte refusée par K-Pay → Réessayer, sans proposer Polar ».

**[Flow coverage]** — Questions d'accueil après création de Compte (FR-12) sans règle (§ EXPERIENCE.md › IA)
Fix: les questions ne retardent pas le retour au Panier.

**[Token completeness]** — Valeurs brutes hors tokens (§ DESIGN.md frontmatter)
Fix: `qr-background`, `glass-border`, `shadow-hover` ou `{spacing.*}`.

**[Token completeness]** — `glass-blur` rangé sous `spacing` (§ DESIGN.md frontmatter)
Fix: groupe `effects` ou note de `glass-panel`.

**[Component coverage]** — `hero.headline` incohérent avec la table (§ DESIGN.md hero)
Fix: `headline: '{typography.display-brush}'` + `headline-fallback`.

**[State coverage]** — Hors ligne et erreur serveur (500) non couverts (§ State Patterns)
Fix: une ligne chacune ; paiement → « en cours de vérification ».

**[Visual reference coverage]** — Fichiers orphelins dans `imports/` (§ imports/*.jpg, fonts/Cover.png)
Fix: « JPG d'origine remplacés par le pack SVG/PNG, ne pas utiliser ».

**[Visual reference coverage]** — Références peu spécifiques aux captures 1win (§ EXPERIENCE.md)
Fix: nommer ce qu'illustre chaque capture.

**[Bloat & overspecification]** — « Paiement & confiance » restate CLAUDE.md et FR-16/FR-20 (§ EXPERIENCE.md)
Fix: réduire aux décisions nouvelles + renvoi, ou accepter.

**[Bloat & overspecification]** — « Bilingue FR/EN » recoupe Foundation et IA (§ EXPERIENCE.md)
Fix: fusionner dans Foundation.

**[Bloat & overspecification]** — Photographie restate le PRD §10 et le Guide (§ DESIGN.md)
Fix: aucun requis.

**[Inheritance discipline]** — Termes du Glossaire abrégés (§ Sélecteur à deux options, UJ-1 ; IA)
Fix: terme complet à la première occurrence.

**[Inheritance discipline]** — Intermédiaires `.working/` listés dans `sources` (§ frontmatter)
Fix: promouvoir les rendus ; retirer `extract-sources.md`.

**[Shape fit]** — « Motifs manga » rangé sous Shapes (§ DESIGN.md › Shapes)
Fix: déplacer vers Brand & Style ou Do's and Don'ts.

**[Accessibilité]** — A11Y-30 Bandeau « Ouvrir dans Chrome » (§ Bandeau d'information)
Fix: `role="region"`, fermeture ≥ 44 px, choix mémorisé.

**[Accessibilité]** — A11Y-31 Boutons « Télécharger » répétés (§ Ligne de fichier de kit)
Fix: nom complet avec format et taille ; préparation du lien annoncée.

**[Accessibilité]** — A11Y-32 Bascule de thème (§ Bascule de thème)
Fix: `aria-pressed` ; pas de flash au premier rendu.

**[Accessibilité]** — A11Y-33 Hiérarchie des titres et H1 du héros (§ Un seul H1)
Fix: accroche H1 texte réel ; H2 sections ; H3 produits.

**[Accessibilité]** — A11Y-34 Accordéon FAQ « une question ouverte à la fois » (§ EXPERIENCE.md [HYPOTHÈSE])
Fix: accordéons indépendants, `<details>` natifs.

**[Accessibilité]** — A11Y-35 Admin (§ EXPERIENCE.md › Admin)
Fix: tableau de données, noms de lien complets, `progressbar`.

**[Accessibilité]** — A11Y-36 Mouvement résiduel (§ Interaction Primitives)
Fix: pas de carrousel sans pause ; indicateur statique en mouvement réduit.

**[Accessibilité]** — A11Y-37 Motifs manga (§ DESIGN.md › Motifs manga, D-10)
Fix: ≤ 6 %, jamais derrière un petit texte.

**[Accessibilité]** — A11Y-38 Marge de contraste serrée (§ DESIGN.md › Contrastes)
Fix: `success` jamais en petit texte sur verre ; préférer `surface`.

**[Paiement & confiance]** — L-2 « Dernières places !! sans Capacité réelle » ambigu (§ Voice and Tone)
Fix: aucun compteur de places ni de stock, même réel ; seulement « Complet ».

**[Paiement & confiance]** — L-3 JSON-LD : interdiction d'`aggregateRating` / `review` non écrite (§ SEO ; règles 5, 8)
Fix: prix USD en base, `availability` réelle, jamais d'avis structuré.

**[Paiement & confiance]** — L-4 UJ-1 et UJ-2 citent M-Pesa et Airtel Money comme acquis (§ UJ-1 étape 7, UJ-2 étape 5)
Fix: « exemple ; couverture réelle selon Q-1 ».

**[Paiement & confiance]** — L-5 Référence déjà utilisée : aucun comportement client écrit (§ State Patterns)
Fix: aucun écran client ; visible dans l'admin seulement.

**[Paiement & confiance]** — L-6 Numéro de suivi : forme non cadrée (§ Frise ; Q-9)
Fix: texte libre, jamais un lien de transporteur, aucun « en transit » calculé.

**[Paiement & confiance]** — L-7 Écran d'attente : bascule et promesses non bornées (§ Écran d'attente de paiement)
Fix: durée renvoyée à l'architecture ; pas de promesse d'email/SMS non réel.

## Reviewer files
- `review-rubric.md`
- `review-accessibility.md`
- `review-payment-trust.md`
