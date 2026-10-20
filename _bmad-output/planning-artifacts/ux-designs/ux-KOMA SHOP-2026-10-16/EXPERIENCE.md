---
name: KOMA SHOP
status: final
updated: 2026-10-21
design: ./DESIGN.md
sources:
  - "{planning_artifacts}/prds/prd-KOMA SHOP-2026-10-16/prd.md"
  - "{planning_artifacts}/prds/prd-KOMA SHOP-2026-10-16/addendum.md"
  - "{project-root}/docs/guide-koma-shop.md"
  - "{project-root}/CLAUDE.md"
  - ./.memlog.md
  - ./mockups/key-*.html
# Traçabilité (intermédiaire, pas une source amont) : ./.working/extract-sources.md (personas, contradictions C-1 à C-20)
---

# KOMA SHOP — Experience Spine

> Comment KOMA SHOP se comporte. L'aspect visuel est dans `DESIGN.md` (tokens cités en `{chemin.du.token}`). Les termes du Glossaire du PRD (Cosplay, Kit lié, Panier mixte, Agrégateur, Tentative de paiement, Zone de remise, Alerte événement…) sont employés tels quels. En cas de conflit, ce document prime sur les maquettes. Il prime aussi sur les imports. Les règles absolues 1 à 15 de `CLAUDE.md` priment sur ce document. Valeurs non décidées : **[HYPOTHÈSE]** ; tout le reste est tranché dans `.memlog.md`.

## Foundation

- **Forme** : site web responsive, **mobile d'abord à 375 px**, sans défilement horizontal ; pensé d'abord pour le navigateur intégré d'Instagram (NFR-1). Ordinateur en second. Admin utilisable sur téléphone et ordinateur (FR-49).
- **Pile** : Next.js (App Router, Server Components par défaut) + Tailwind CSS. **Aucun système d'interface tiers** (ni shadcn, ni MUI) n'est nommé par les sources : les composants sont propres au projet et suivent `DESIGN.md`.
- **Thèmes** : crème par défaut (`{colors.background}`), sombre par bascule (`{colors.background-dark}`), choix mémorisé, appliqué avant le premier rendu (pas de flash de thème).
- **Langues** : `/fr` et `/en`, même structure.
  - Aucun texte visible en dur hors des fichiers de traduction (FR-55). Emails dans la langue choisie par le client.
  - Articles : FR obligatoire, EN facultatif ; sans traduction, absents de `/en` (FR-43). `hreflang` entre `/fr` et `/en` (FR-56).
  - `lang` sur `<html>` selon la route ; `lang="en"` sur tout passage anglais d'une page `/fr` (et inversement) ; `lang="ja"` sur tout mot japonais exposé.
  - Grands titres de vitrine en Sakura Town dans les deux langues : voir Voice and Tone et `DESIGN.md` › Typography.
- **SEO** (règle 8) : metadata, Open Graph et JSON-LD sur chaque page publique ; données structurées Product/Offer avec prix USD lu en base et `availability` réelle ; **jamais `aggregateRating` ni `review`** (règle 5).

## Information Architecture

### Arborescence

Toutes les pages publiques existent sous `/fr` et `/en` (sauf Articles sans version anglaise, FR-43). Les chemins exacts sont fixés par l'architecture [HYPOTHÈSE pour les slugs].

| Surface | Atteinte depuis | Rôle | Source |
|---|---|---|---|
| **Accueil** | Domaine, logo | Héros + 8 blocs ordonnés | FR-1, FR-2 |
| **Catalogue Cosplays** | Menu | Grille, **Filtres de catalogue** (univers, prix, disponibilité), tri (nouveauté, prix) | FR-5 |
| **Catalogue Accessoires** | Menu | Idem | FR-5 |
| **Catalogue Kits** | Menu | Idem + filtre niveau | FR-5 |
| **Fiche Produit physique** | Catalogue, héros, accueil | **Galerie photo produit**, prix USD, tailles / Sur-mesure, disponibilité, Zone de remise, délai total, double option | FR-6 à FR-8, FR-10 |
| **Fiche Kit** | Catalogue, double option | Contenu, chapitres, extrait sous-titré, niveau, matériel, Licence, prix ; Kit gratuit : **Bouton Obtenir le Kit gratuit** | FR-9, FR-58 |
| **Événements (liste)** | Menu | À venir + passés | FR-31 |
| **Page Événement** | Liste, accueil bloc 5, Article | Date, lieu, programme, photos, Types de pass, « Me prévenir », partage | FR-31, FR-32, FR-57 |
| **Achat de Pass** | Page Événement | **Connexion requise** ; **Sélecteur de Pass**, noms, mention photos, Récapitulatif de Pass, paiement séparé du Panier | FR-33, FR-47 |
| **Blog (liste)** / **Article** | Menu, accueil bloc 7 | Lecture, liens vers Produits et Événements | FR-43 |
| **À propos** | Menu | Portrait, atelier, « Écrire sur WhatsApp » | FR-4 |
| **Galerie « Ils le portent »** | Accueil bloc 4 (ancre `#galerie`) — **pas de page dédiée** (voir Navigation) | Photos validées | FR-2, FR-40, FR-41 ; décision memlog |
| **FAQ**, **Contact**, **Pages légales** (mentions, CGV, livraison et retours, confidentialité) | Pied de page | Vitrine, textes de Jonathan (Q-5) | FR-4 |
| **Panier** | Icône panier | Sans Compte ; modifier, retirer | FR-11 |
| **Connexion / création de Compte** | Compte, étape de paiement, Achat de Pass, Kit gratuit | **Champ du code de connexion** (6 chiffres par email) ; Google hors navigateur intégré ; âge | FR-12 |
| **Questions d'accueil** | Juste après création | 3 questions facultatives, bouton « Passer » ; **ne retardent jamais le retour** à la page et au Panier quittés | FR-12 |
| **Étape de commande** | Panier | Téléphone, Zone de remise et Mode de remise, lieu de retrait (lu du Réglage), adresse, cases, Code promo | FR-13, FR-47, FR-51 |
| **Récapitulatif et paiement** | Étape de commande | Récapitulatif USD, choix du moyen de paiement | FR-14, FR-16 |
| **Attente de paiement** | Paiement mobile money | « Valide le paiement sur ton téléphone » | FR-17 |
| **Page de retour après paiement** | Prestataire / attente | État réel lu côté serveur | FR-20 |
| **Mon compte** | Icône compte | **Navigation du compte** : cinq entrées puis « Se déconnecter » | FR-22, FR-27, FR-34, FR-40, FR-45 ; décision memlog |
| **Compte › Mes commandes** / **Suivi d'une commande** | Compte | Frise, numéro de suivi, WhatsApp, annulation, réclamation | FR-22, FR-25, FR-26 |
| **Compte › Ma bibliothèque** / **Kit en bibliothèque** | Compte, email « Kit ouvert » | Fichiers, lecteur à chapitres sous-titré, progression | FR-27 à FR-30 |
| **Compte › Mes Pass** | Compte, email | Pass et Codes QR, annulation | FR-34, FR-38 |
| **Compte › Envoyer une photo / une Réalisation** | Compte, email « livrée » | Dépôt, accord, affichage | FR-40, FR-42 |
| **Compte › Préférences** | Compte, liens de désinscription | Consentements emails et Alertes événement | FR-32, FR-45, FR-59 |
| **Scan** | Accès bénévole / Admin | Contrôle des Codes QR, mode hors ligne | FR-35 à FR-37 |
| **Admin** | Connexion Admin | Voir § Admin | FR-49 à FR-52 |
| **Page 404** | — | Retour vers l'accueil et les catalogues | Guide |

### Navigation

- **Menu principal (6 rubriques)** : Cosplays · Accessoires · Kits · Événements · Blog · À propos. Plus : panier (avec compteur), compte, bascule de thème, langue.
- **Ordinateur** : barre unique en haut — **logo principal horizontal (KOMA + コマ) dans le coin gauche**, puis les 6 rubriques, puis à droite les icônes thème, langue, compte, panier. Pas de barre latérale.
- **Mobile** : en-tête compact — **logo principal horizontal à gauche**, panier puis ☰ à droite (cibles 44 × 44 px). Le **Panneau ☰** contient les 6 rubriques, l'entrée secondaire Galerie, compte, thème, langue. Pas de barre d'onglets en bas.
- **Galerie** : bloc 4 de l'accueil (ancre `#galerie`) ; lien en pied de page + entrée secondaire ☰ qui y mènent ; absente de la barre du haut ; pas de page dédiée. **Bloc et liens masqués tant qu'aucune vraie photo n'est validée.**
- **Pas de recherche globale** : filtres et tri par catalogue seulement (FR-5).
- **Fil d'Ariane** sur fiches et Articles (JSON-LD BreadcrumbList, FR-56).
- **Repères** sur chaque page : **Lien d'évitement** en premier élément focalisable → `<main id="contenu" tabindex="-1">` ; `header`, `nav` (avec `aria-label`), `main`, `footer`.
- **Pied de page** : quatre cartes — Aide (FAQ, Contact, WhatsApp), Infos légales, Paiement, identité KOMA SHOP ; liens Galerie et réseaux ajoutés seulement quand ils existent.
- **Compte** : mobile = page « Mon compte » (Navigation du compte) ; ordinateur = Navigation du compte en colonne gauche, contenu à droite ; l'icône compte de l'en-tête est marquée page courante (décision memlog).
- **Admin** : ordinateur = **Barre latérale admin** (Tableau de bord, Commandes, Produits, Événements, Galerie, Blog, Codes promo, Prestataires, Réglages) ; mobile = **Barre d'onglets admin** (Tableau de bord, Commandes, Mesures et tâches, Scan) + ☰ pour le reste (décision memlog). Les règles « pas de barre latérale » et « pas de barre d'onglets en bas » ne visent que la vitrine.
- **Bilingue** : le sélecteur de langue garde la page courante (équivalent `/fr` ↔ `/en`) ; un Article sans version anglaise renvoie vers la liste du Blog `/en` [HYPOTHÈSE].

### Accueil — ordre des blocs (FR-2)

Héros → (1) « Porte-le ou fabrique-le » (même costume, deux colonnes) → (2) Cosplays « Fait main à Goma » → (3) Kits (Kit gratuit en évidence quand il existe) → (4) Galerie « Ils le portent » → (5) « Rendez-vous otaku » (prochain Événement) + « Me prévenir » → (6) Jonathan en trois phrases → (7) guides (Articles) → (8) FAQ courte. **Tout bloc sans contenu réel est masqué.** Hiérarchie : l'accroche du héros est le H1 (texte réel), titres de bloc en H2, noms de produit en H3. Accroche et titres de bloc en Sakura Town, sans accent, en majuscules (Voice and Tone).

→ Maquette : [key-accueil](mockups/key-accueil.html) (héros mobile et ordinateur, blocs 1 à 3, thème sombre). Structure 1win : voir Inspiration & Anti-patterns.

## Voice and Tone

Microcopie. La voix de marque est dans `DESIGN.md` › Brand & Style.

**Vitrine, blog, emails marketing** : tutoiement, phrases courtes, vocabulaire de la communauté (cosplay, con, WIP, props, nakama), quelques emojis, façon cultureotaku (décision). Au plus un emoji par phrase, en fin de phrase, en `aria-hidden="true"` ; **jamais d'emoji dans un titre, un bouton, un lien, un nom accessible ni pour porter seul une information**.

**Zones sans argot ni emoji** (décision validée, liste exhaustive) : Panier, Étape de commande, Récapitulatif, paiement, attente, page de retour (succès compris), Mes commandes, Frise des statuts, Mes Pass, bibliothèque (accès et erreurs), Kit gratuit (obtention), connexion et code, annulation, réclamation, emails transactionnels (confirmation, statuts, Pass, code), bandeau de zone, badges de disponibilité, Mesures, consentements, Scan, erreurs, textes légaux, admin. Tutoiement conservé, langage clair.

**Grands titres de vitrine sans accent** (décision memlog) : ils sont composés en Sakura Town, police sans accent, et affichés en MAJUSCULES par `text-transform` (casse normale dans les fichiers de traduction). On les **rédige sans accent** en reformulant, jamais en retirant un accent (pas de faute d'orthographe), sans apostrophe typographique ’ ni guillemets « ». Même règle pour les titres anglais. Liens du menu, boutons et étiquettes ne changent pas (« Événements », « À propos », « Prêt à porter », « Le fabriquer moi-même », en Barlow Condensed). Un titre saisi par l'admin avec accent n'est pas réécrit : il bascule entier en Barlow Condensed.

| Titre fixe de vitrine (avant) | Titre sans accent (après) |
|---|---|
| Bloc 1 de l'accueil « Prêt à porter ou fait par toi » | « Porte-le ou fabrique-le » |
| Bloc 4, Galerie « Ils l'ont porté » | « Ils le portent » |
| Bloc 5 et H1 de la liste « Événements » | « Rendez-vous otaku » |
| H1 de la page « À propos » | « Jonathan et son atelier » |
| Conservés : « Deviens ton personnage. », « Cosplays », « Accessoires », « Kits », « Blog », « FAQ », bloc 6 « Jonathan en trois phrases », bloc 7 « Guides », H1 de la page 404 « Page introuvable » | — |

| À faire | À éviter |
|---|---|
| « Deviens ton personnage. » | « Achetez maintenant ! » |
| « Prêt à porter » / « Le fabriquer moi-même » (partout) | « Le porter » (ancien libellé du PRD) |
| « Fait main à Goma » | « Qualité premium garantie » |
| « Remise uniquement à Goma et Bukavu. Tu es ailleurs ? Le kit, lui, voyage partout. » [HYPOTHÈSE de formulation] | Cacher la contrainte jusqu'au paiement |
| « Paiement traité par {Prestataire} » (ligne factuelle juste avant validation, décision) | Un logo de Prestataire ou d'opérateur ; un nom de Prestataire dans le choix du moyen |
| « Valide le paiement sur ton téléphone. » | « Patientez… » sans dire quoi faire |
| « Paiement en cours de vérification. » | « Paiement réussi » avant la Notification vérifiée |
| « Le paiement n'a pas abouti. Tu peux réessayer. » | Argot, emoji ou humour dans un message d'échec |
| « Ce service de paiement n'a pas abouti. Réessayer avec {Agrégateur suivant} ? » (repli, décision) | « Erreur 502 », un identifiant technique de Prestataire |
| « Offert » pour une Commande `offerte` | « Payée » pour une Commande `offerte` (règle 13) |
| « À payer avant [heure] » (texte statique lu du serveur) | Compte à rebours animé, couleur d'alerte sur l'échéance |
| « Moi aussi, je veux être sur ce mur » (esprit de la Galerie) | « 500 clients satisfaits » (règle 5) |
| Nommer les Types de pass tels quels : Standard, VIP, Stand ; « Complet » quand la Capacité est atteinte | Tout compteur de places ou de stock (« plus que 3 »), **même réel** : le PRD ne prévoit que « Complet » et des badges sans quantité |
| Aucun nom de franchise, même dans une description | « Costume de [personnage officiel] » (règle 6) |
| « Plus disponible » pour un article du Panier devenu indisponible (décision) | « Épuisé », une quantité restante |
| Montants en USD seulement | Un montant en devise locale, une conversion calculée par le site (voir Paiement & confiance) |

## Component Patterns

Comportement seulement ; l'aspect est dans `DESIGN.md` › Components, sous les mêmes noms et dans les mêmes familles.

### Structure et navigation

| Composant | Usage | Règles de comportement |
|---|---|---|
| **En-tête** | Toutes les pages publiques | **Logo principal horizontal dans le coin gauche** (mobile : panier + ☰ à droite ; ordinateur : 6 rubriques puis icônes thème, langue, compte, panier). Reste visible en haut au défilement [HYPOTHÈSE], sauf à zoom ≥ 200 % ou en hauteur < 500 px (il n'est alors plus collant). `scroll-padding-top` = hauteur de l'en-tête + bandeau : un élément focalisé n'est jamais masqué (WCAG 2.4.11). Bouton panier nommé « Panier, 2 articles » ; ajout au panier confirmé par `role="status"` (« Ajouté au panier ») sans déplacer le focus. |
| **Panneau ☰** | Mobile | Bouton `<button aria-expanded aria-controls>` libellé « Menu » (glyphe `aria-hidden`). Ouverture par-dessus la page (`role="dialog" aria-modal="true"` + `aria-labelledby`) ; focus sur le premier élément ; reste de la page `inert`, défilement bloqué ; se ferme par « Fermer le menu », Échap ou choix d'une rubrique ; **le focus revient au bouton ☰**. |
| **Lien d'évitement** | Toutes les pages | Premier élément focalisable, visible au focus, « Aller au contenu » → `<main id="contenu" tabindex="-1">` (décision). |
| **Fil d'Ariane** | Fiches, Articles | `nav aria-label="Fil d'Ariane"`, page courante en `aria-current="page"` ; JSON-LD BreadcrumbList. |
| **Pied de page** | Toutes les pages publiques | Quatre cartes : Aide (FAQ, Contact, WhatsApp), Infos légales, Paiement, identité. Lien Galerie masqué tant qu'aucune photo n'est validée ; réseaux sociaux masqués tant que les comptes n'existent pas (R-8) ([key-catalogue](mockups/key-catalogue.html)). Moyens de paiement : **liste lue côté serveur** (Prestataires actifs et Couverture), aucun Prestataire inactif ; formulation générique « Mobile money, carte » si Jonathan préfère ne pas nommer [HYPOTHÈSE]. |
| **Bascule de thème** | En-tête, ☰ | Crème ↔ sombre ; `<button aria-pressed>` (« Thème sombre ») ; choix mémorisé, appliqué avant le premier rendu. |
| **Sélecteur de langue** | En-tête, ☰ | FR ↔ EN sur la même page ; « Français » (`lang="fr"`) et « English » (`lang="en"`) écrits dans leur langue, avec `hreflang`. |
| **Anneau de focus** | Partout | `:focus-visible` uniquement ; double anneau (voir `DESIGN.md`) ; distinct de la sélection. |
| **Boîte de dialogue** | Vue agrandie de la galerie, confirmation d'annulation | `<dialog>` natif ou `role="dialog" aria-modal="true"` avec titre ; piège de focus ; Échap et bouton « Fermer » ; retour du focus sur l'élément d'origine. Jamais empilée. |
| **Squelette** | Catalogues, bibliothèque, admin | Formes du contenu attendu ; région en `aria-busy="true"` + texte masqué « Chargement… » ; jamais sur le héros (photo de repli à la place). |

### Actions

| Composant | Usage | Règles de comportement |
|---|---|---|
| **Bouton principal** | Une action par zone | Pilule rouge. Condition non remplie (Mesures complètes, cases cochées) : `aria-disabled="true"` (reste focalisable) + `aria-describedby` vers la raison affichée à côté ; au clic, l'action est refusée et le focus va au premier champ manquant. Jamais un bouton désactivé sans explication. **Bouton qui lance un paiement ou une Commande** : verrouillé au premier toucher (voir State Patterns « Paiement lancé »). |
| **Bouton secondaire** | Actions alternatives | Pilule surface ; jamais pour l'action de paiement. |
| **Bouton WhatsApp** | Contact, À propos, suivi, échec de paiement, Trop-perçu | Ouvre WhatsApp vers le numéro réglé dans l'admin (FR-51), message prérempli [HYPOTHÈSE]. |
| **Bouton de partage** | Chaque fiche et chaque Événement | Partage natif du téléphone si disponible, sinon copie du lien [HYPOTHÈSE], « Lien copié » annoncé (`role="status"`) ; l'aperçu montre la grande photo et le titre (FR-57). |

### Accueil et catalogues

| Composant | Usage | Règles de comportement |
|---|---|---|
| **Héros vidéo** | Accueil | Vidéo en boucle, sans son ni piste audio, `muted` `playsinline` `aria-hidden="true"` ; affichée en < 2,5 s (FR-1) ; photo de repli si la vidéo ne charge pas à temps ou n'est pas prise en charge. **Sous `prefers-reduced-motion: reduce`, la photo de repli est affichée et la vidéo n'est pas chargée** (décision). Aucune information indispensable dans la vidéo (NFR-3). Accroche = H1 en texte réel. Mobile : accroche + **Bouton principal** « Prêt à porter » (→ fiche du Cosplay vedette) + **Bouton secondaire** « Le fabriquer moi-même » (→ son Kit lié). Le Cosplay vedette est choisi dans l'admin. Parallaxe légère, coupée en mouvement réduit et quand la vidéo est en pause. |
| **Bouton Pause du héros** | Héros vidéo | **Obligatoire** (WCAG 2.2.2) : visible, au clavier, 44 × 44 px, `aria-label` traduit (« Mettre la vidéo en pause » / « Lire la vidéo »), `aria-pressed` ; choix mémorisé. Absent quand la photo de repli est affichée. |
| **Tuile d'option du héros** | Accueil, ordinateur | Deux tuiles verticales à droite de la vidéo = la double option : « Prêt à porter » (photo, prix, délai) et « Le fabriquer moi-même » (Kit lié, prix). Lien sur le titre de la tuile, étendu à toute la tuile par pseudo-élément (pas de `<a>` enveloppant). Si le Cosplay vedette n'a pas de Kit lié : [HYPOTHÈSE] une seule tuile, E-16. |
| **Tuile de catégorie** | Accueil | Lien vers le catalogue correspondant. |
| **Carte produit** | Catalogues, accueil | Lien sur le titre (`h3 > a`), étendu à toute la carte par pseudo-élément ; image `alt=""` si le titre la nomme déjà ; prix USD et **Badge de disponibilité** lus après le titre ; s'élève au survol (ordinateur). |
| **Filtres de catalogue** | Catalogues | Filtres de FR-5 (univers, prix, disponibilité, niveau pour les Kits) en multi-sélection [HYPOTHÈSE], tri nouveauté / prix ; l'URL reflète filtres et tri (lien partageable) [HYPOTHÈSE] ; le nombre de résultats est annoncé (`role="status"`, « 12 produits ») ; aucun rechargement sans prévenir ; « Effacer les filtres » dès qu'un filtre est actif. Univers : genres génériques, aucune liste saisie par défaut (E-29). |
| **Badge de disponibilité** | Cartes, fiches | « En stock » ; « Fabrication sur commande » + Délai de fabrication ; « Commandes complètes pour le moment » (C-4 tranché ; jamais « Épuisé ») + Kit lié proposé ; « Complet » pour un Événement. Jamais de quantité. |
| **Carte Événement** | Liste, accueil bloc 5 | Lien sur le titre étendu à la carte ; « Complet » si Capacité atteinte ; Événement passé marqué comme tel avec lien de Galerie d'événement. |
| **Carte Article** | Blog, accueil bloc 7 | Lien sur le titre étendu à la carte. |
| **Tuile de galerie** | Accueil bloc 4 | Affiche prénom/pseudo et ville seulement si autorisés ; **jamais la ville pour un Compte mineur** (FR-40). Ouverture en grand au toucher ou au clavier dans une **Boîte de dialogue** [HYPOTHÈSE]. |
| **Accordéon FAQ** | Accueil bloc 8, FAQ | Accordéons **indépendants** (`<details>`/`<summary>` natifs ou `<button aria-expanded>` dans un H3) ; plusieurs questions peuvent rester ouvertes ; JSON-LD FAQPage. |

### Fiche produit

| Composant | Usage | Règles de comportement |
|---|---|---|
| **Galerie photo produit** | Fiche Produit physique | Photos dans l'ordre fixé dans l'admin, alt obligatoire (FR-50). Balayage horizontal **et** boutons « Photo précédente » / « Photo suivante » ; vignettes atteignables au clavier ; position annoncée « Photo 2 sur 5 ». Zoom : pincement **et** bouton « Agrandir » qui ouvre une **Boîte de dialogue** avec boutons +/−. Le zoom natif du navigateur n'est jamais bloqué (`user-scalable` interdit). Pas de défilement automatique. |
| **Sélecteur à deux options** | Fiche Cosplay avec Kit lié ; Retrait / Livraison ; questions d'accueil | **Aucune sélection ne change de page ni ne déclenche d'action** (WCAG 3.2.2) : `radiogroup` ou `<input type="radio">` natifs, flèches pour se déplacer. Double option : « Prêt à porter » garde le parcours d'achat sur la fiche ; choisir « Le fabriquer moi-même » affiche **sur place** un panneau « Kit lié » (prix du Kit, délai d'accès immédiat) avec un **lien explicite « Voir le kit »** qui mène à sa fiche (FR-7) ; tailles, délai, bandeau et bouton d'ajout du Cosplay se masquent alors ([key-fiche-cosplay](mockups/key-fiche-cosplay.html), cadre 2). Retrait / Livraison : seulement si Zone de remise = Goma ; « Retrait » affiche le lieu et les modalités de retrait lus du Réglage (FR-51). |
| **Sélecteur de tailles** | Fiche Cosplay (« Prêt à porter ») | Mêmes règles que le Sélecteur à deux options, à N valeurs : radios natifs, flèches pour se déplacer, aucune action au choix. Affiche les tailles proposées dans l'admin (XS à XXL) et Sur-mesure ; Sur-mesure affiche le **Schéma des Mesures**. Plafond atteint : seules les tailles en stock restent, sinon le sélecteur disparaît (FR-10) ([key-fiche-cosplay](mockups/key-fiche-cosplay.html)). |
| **Schéma des Mesures** | Fiche Cosplay Sur-mesure | Illustration (alt court qui renvoie à la liste) + champs numérotés avec unité (« 3. Tour de poitrine (cm) »), `inputmode="decimal"`, bornes plausibles avec message clair ; instructions de prise de mesure **en texte** ; ajout au Panier bloqué tant que les Mesures sont incomplètes (FR-8) ; la case Sur-mesure de l'Étape de commande sert d'étape de vérification. Liste des mesures et bornes : E-10. |
| **Bandeau d'information** | Fiche Produit physique, navigateur intégré | Avertissement de zone : affiché à **tous**, sans détection de pays, **avant** le bouton d'ajout au Panier, avec le Kit lié s'il existe (FR-6). Navigateur intégré : « Ouvrir dans Chrome », **non bloquant**, `role="region"` avec libellé, bouton « Fermer le bandeau » 44 px, focus ensuite sur l'élément suivant, choix mémorisé (FR-3). Ne recouvre jamais un élément focalisé. |
| **Bouton Obtenir le Kit gratuit** | Fiche Kit gratuit | **Sans Panier, sans Récapitulatif, sans choix de paiement, sans Prestataire** (FR-58). Visiteur non connecté → connexion puis retour sur la fiche. Au toucher : verrouillé, le serveur crée la Commande `offerte` (0 USD) et ouvre le Kit ; succès = lien « Ouvrir dans ma bibliothèque ». Déjà obtenu → le bouton devient « Ouvrir dans ma bibliothèque ». Résumé de la Licence de kit affiché ; case d'acceptation de la Licence obligatoire, sans renonciation (E-33). Ne compte pas comme premier achat pour un Code promo. Aucun bouton d'ajout au Panier sur le Kit gratuit. |

### Formulaires, messages et emails

| Composant | Usage | Règles de comportement |
|---|---|---|
| **Champ de formulaire** | Partout | Libellé visible (jamais un placeholder comme libellé) ; `autocomplete` (`email`, `tel`, `name`, `address-level2`, `street-address`, `country`) ; `inputmode="tel"` pour le numéro mobile money, indicatif en aide ; validation à la perte de focus **seulement si le champ a été modifié**, et à l'envoi ; erreur sous le champ, reliée par `aria-describedby`, qui dit comment corriger. À l'envoi : résumé d'erreurs en tête (`role="alert"`, liens vers les champs), focus sur le résumé. **Rien n'est ressaisi** après un échec de paiement, un « Réessayer », une connexion en cours de route ou une expiration (téléphone, opérateur, Zone de remise, adresse conservés). |
| **Champ du code de connexion** | Connexion / création de Compte | **Un seul** champ `<input type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6">`, libellé visible ; **coller toujours permis** ; durée de validité du code annoncée en texte (valeur : E-34) ; lien « Renvoyer le code » (avec délai réel avant renvoi, s'il existe, affiché en texte) ; erreur reliée au champ ; pas de soumission automatique non annoncée ; l'email met le code **en texte**. Après connexion : retour à la page et au Panier quittés (FR-12). États : voir State Patterns. |
| **Case de consentement** | Étape de commande, Pass, photo, Alertes événement | Jamais pré-cochée ; libellé entier cliquable. CGV ; Kit (accès immédiat, renonciation, Licence) ; Sur-mesure (Mesures confirmées, pas d'annulation après fabrication) ; mention photos (Pass) ; accord de publication (photo) ; emails commerciaux. Textes : Q-5. |
| **Formulaire « Me prévenir »** | Page Événement, accueil bloc 5 | Email, Compte ou numéro WhatsApp au choix ; consentement explicite ; désinscription (FR-32). Forme (un champ ou trois options) : E-12. |
| **Message d'état** | Panier, paiement, compte, admin | Un message = un état réel lu côté serveur ; succès / attention / erreur / information ; jamais simulé (règle 13). Icône + texte, jamais la couleur seule. |
| **Barre de progression** | Envoi de photo / Réalisation, téléversements admin | `role="progressbar"` (ou `<progress>` natif) avec valeur ; valeur aussi écrite en texte ; coupure → reprise automatique annoncée en texte, rien n'est perdu ; « Annuler l'envoi » disponible. |
| **Gabarit d'email** | Emails transactionnels et commerciaux (FR-44, FR-45, FR-59) | Langue du client ; transactionnels sans argot ni emoji ; code, montants USD et liens en texte ; désinscription dans tout email commercial ; aucune promesse que le site ne tient pas. Contenu de chaque email : stories concernées. |

### Panier et paiement

| Composant | Usage | Règles de comportement |
|---|---|---|
| **Récapitulatif** | Panier, paiement, Achat de Pass | Prix par article en USD, Forfait de livraison, réduction, total USD, délai total par Produit physique (FR-14). Le Panier ne garde côté navigateur que des identifiants et quantités ; **prix, forfait, délais et disponibilité sont relus sur le serveur à chaque affichage** (règle 3). **Récapitulatif de Pass** : Types, noms, prix USD, réduction, total USD, calculés par le serveur. Étape de vérification explicite avant tout paiement. |
| **Sélecteur pays + opérateur** | Paiement mobile money | `<select>` natifs. Pays puis opérateur puis numéro. **Pays et opérateurs listés = union des couples de la table Couverture (base)** ; aucun pays ni opérateur codé en dur (règle 9, Q-1). Changer de pays réinitialise l'opérateur et l'annonce (`role="status"`, « 3 opérateurs disponibles ») ; aucune soumission ni navigation au changement. Seuls les couples couverts par un Agrégateur actif mènent au paiement ; sinon message relié au champ opérateur et invitation à choisir un autre opérateur ou la carte (FR-16). Noms en texte, aucun logo. Pré-remplissage du pays : E-17. |
| **Carte de moyen de paiement** | Récapitulatif et paiement | Le client voit « Mobile money » (pays + opérateur) ou « Carte » (décision) ; `radiogroup`. **Le serveur** décide quels Prestataires sont proposés (FR-16, FR-18) ; l'interface n'affiche que la liste reçue. Panier avec Produit physique ou Panier mixte → la carte passe par K-Pay, **Polar n'apparaît pas**. Achat de Pass → jamais Polar. Ordre d'affichage (C-13 tranché) : le client choisit d'abord **son pays** (aucune détection automatique) ; si au moins un Agrégateur actif couvre ce pays (données serveur), **Mobile money en premier**, puis Carte ; sinon seule la Carte est proposée, avec « Le mobile money n'est pas encore disponible dans ton pays. ». Juste avant le bouton de validation : **« Paiement traité par {Prestataire} »** (nom en texte, lu du serveur). Indisponible pendant une Tentative en cours. |
| **Écran d'attente de paiement** | Après lancement d'une Tentative mobile money | « Valide le paiement sur ton téléphone. » + montant USD et numéro masqué lus du serveur + échéance « À payer avant [heure] » en texte statique. Interroge le serveur ; une seule Tentative à la fois (FR-17). Annonces : `role="status"` **une seule fois par changement réel d'état**, jamais à chaque sondage ; `<title>` reflète l'état (aide au retour depuis l'app de paiement). Indicateur statique en mouvement réduit. Aucune promesse d'email ou de SMS qui ne part pas réellement. Durée avant bascule en « en cours de vérification » : fixée par l'architecture (E-9). |
| **Page de retour après paiement** | Après paiement (carte ou mobile money) | **Ignore tout paramètre de statut de l'URL de redirection** (`?status=…`) ; interroge le serveur par numéro de Commande et vérifie qu'elle appartient au Compte connecté. Avant la Notification vérifiée : « Paiement en cours de vérification » (`warning`, jamais `success`). Au passage à `payée` ou à l'échec : focus déplacé sur le titre du nouvel état (`tabindex="-1"`) ; échec annoncé en `role="alert"`. |

### Compte, bibliothèque, Pass et Scan

| Composant | Usage | Règles de comportement |
|---|---|---|
| **Navigation du compte** | Mon compte (mobile), colonne gauche (ordinateur) | `<nav aria-label>` ; une carte-lien par entrée, lien étendu à la carte ; entrée courante en `aria-current="page"`. « Se déconnecter » en dernier. Même liste sur les deux tailles ([key-compte](mockups/key-compte.html)). |
| **Frise des statuts** | Suivi d'une commande | Statuts réels avec dates ; chaque étape porte icône + libellé texte (« Fait », « En cours », « À venir ») ; `aria-current="step"` sur l'étape courante ; Commande `offerte` → « Offert », sans montant de paiement, sans Prestataire ni référence. Retrait à Goma : `expédiée` s'affiche « Prête à retirer » (E-25). Numéro de suivi : **texte libre** saisi par l'admin, affiché tel quel, jamais transformé en lien de transporteur ; aucun état « en transit » calculé (règle 12). **Bouton WhatsApp**. Annulation proposée seulement avant `en fabrication` (confirmation en **Boîte de dialogue**) ; réclamation seulement dans les 48 h après `livrée`. |
| **Ligne de kit en bibliothèque** | Ma bibliothèque | Une ligne par Kit acheté ou offert ; lien sur le titre étendu à la ligne, vers le Kit en bibliothèque ; progression et action suivante **en texte** (« Reprendre au chapitre 3 »), lues du serveur ([key-bibliotheque](mockups/key-bibliotheque.html)). |
| **Lecteur vidéo à chapitres** | Kit en bibliothèque, extrait de la Fiche Kit | **Sous-titres WebVTT** : FR obligatoires, EN facultatifs (PRD Q-15, 2026-10-20) ; sous `/en`, la fiche d'un Kit sans sous-titres anglais l'indique ; activables, réglés par défaut sur la langue de l'interface. Lecteur **entièrement au clavier** : lecture/pause, piste temporelle (slider ARIA avec valeur en texte), chapitres en `<button>` avec `aria-current="true"`, bouton sous-titres, plein écran. Qualité adaptative ; **aucun bouton de téléchargement** ; reprise à la dernière position sur tout appareil (FR-29). Transcription texte par chapitre, téléchargeable avec les Fichiers de kit (E-32). |
| **Ligne de fichier de kit** | Kit en bibliothèque | Chaque clic demande au serveur un lien signé de courte durée (règle 1) ; aucun lien `kits-private` dans le HTML ; téléchargements illimités. Nom accessible complet : « Télécharger Patron A4 (PDF, 2,4 Mo) » ; taille affichée ; « Préparation du lien… » annoncé pendant la génération. |
| **Carte Type de pass** | Page Événement | Lecture seule : nom, prix USD, avantages ; **aucun compteur**. Un seul bouton « Acheter des pass » sous les cartes, qui mène à l'Achat de Pass (connexion requise). Capacité atteinte : badge « Complet » sur chaque carte, bouton d'achat retiré, « Me prévenir » maintenu ([key-evenements](mockups/key-evenements.html)). |
| **Sélecteur de Pass** | Achat de Pass | Mêmes cartes que la Carte Type de pass, avec un compteur par Type de pass (boutons −/+ 44 px, valeur annoncée) ; pour soi, le Pass reprend le Compte ; un champ de nom par autre personne ; un Pass Stand génère deux noms (titulaire + aide) (FR-33). **Aucun bouton d'ajout au Panier** ; paiement toujours séparé ; carte = K-Pay seulement. Capacité vérifiée par le serveur au paiement ([key-pass-photo](mockups/key-pass-photo.html)). |
| **Pass** | Mes Pass, email | Code QR + nom + Type de pass + Événement ; alt du QR : « Code QR du Pass {Type} de {Nom}, {Événement} » (même alt dans l'email) ; bouton « Agrandir » avec suggestion d'augmenter la luminosité ; demande d'annulation jusqu'à 48 h avant. Code court lisible sous le QR (E-31). |
| **Écran de Scan** | Scan | Résultat plein écran, dans `role="alert"` : « VALIDE » + nom, Événement, Type de pass écrit en très grand ; ou « REFUSÉ » + raison (déjà scanné, annulé, autre Événement). Couleur + mot + icône, jamais la couleur seule. Retour sonore ou vibration : E-14. Mode hors ligne : voir State Patterns. |
| **Bouton « Scanner le pass suivant »** | Écran de Scan | Ferme le résultat et revient à la caméra. « Saisir le code à la main » reste accessible à chaque état (E-31) ([key-scan](mockups/key-scan.html)). |

### Admin

| Composant | Usage | Règles de comportement |
|---|---|---|
| **Barre latérale admin** | Admin, ordinateur | `<nav aria-label="Administration">` ; entrée courante en `aria-current="page"` ; compteur d'attente inclus dans le nom accessible (« Commandes, 3 en attente ») ([key-admin-tableau](mockups/key-admin-tableau.html)). |
| **Barre d'onglets admin** | Admin, mobile | Quatre onglets fixes en bas : Tableau de bord, Commandes, Mesures et tâches, Scan ; le reste dans ☰. Onglet courant en `aria-current="page"` ; une page atteinte par ☰ (Produits…) n'active aucun onglet ; compteur dans le nom accessible. |
| **Carte de tâche admin** | Tableau de bord | Compteur réel + lien vers la liste filtrée, étendu à toute la carte ; nom de lien complet (« 3 Mesures à vérifier »). Une carte à zéro reste affichée, en ton atténué. |
| **Graphique en barres** | Tableau de bord admin | Valeur écrite sur chaque barre ; « Voir les données en tableau » (`<details>` natif) ouvre le Tableau de données équivalent ; légende « fictif » interdite en production : données réelles seulement (règle 13). Aucune donnée → Message d'état, pas de barres à zéro décoratives. |
| **Tableau de données admin** | Listes et doublures de graphiques | `<table>` avec `<caption>` et `<th scope>` ; nombre de résultats annoncé (`role="status"`) quand un filtre change ; filtres natifs + « Effacer les filtres ». Mobile : lignes en cartes cliquables par le numéro, filtres repliés dans `<details>`. Pagination : E-36. |
| **Pastille de statut** | Listes et détails admin, Mes commandes | Statut réel lu du serveur, icône + mot, jamais la couleur seule ; tâche liée écrite dessous. |
| **Bloc Paiement (lecture seule)** | Détail d'une Commande (admin) | Prestataire, moyen, référence de transaction, montant, devise, date de Notification vérifiée ; **aucun champ modifiable** ; phrase « le statut « payée » ne se pose jamais à la main » (règle 2) ([key-admin-commandes](mockups/key-admin-commandes.html)). |
| **Interrupteur** | Prestataires (activation) | `<input type="checkbox" role="switch">` natif, libellé « Activer {Prestataire} », mot d'état écrit et mis à jour après enregistrement réel par le serveur ([key-admin-reglages](mockups/key-admin-reglages.html)). |
| **Boutons Monter / Descendre** | Ordre de priorité des Agrégateurs, photos, chapitres | Déplacement au clavier comme au toucher ; nom complet (« Monter PawaPay dans l'ordre de priorité ») ; en bout de liste : `aria-disabled`, focalisable. |

## State Patterns

### Contenu et catalogue

Maquettes : [key-catalogue](mockups/key-catalogue.html) (aucun résultat), [key-pages-info](mockups/key-pages-info.html) (404), [key-evenements](mockups/key-evenements.html) (Complet).

| État | Surface | Traitement |
|---|---|---|
| **Bloc vide** | Accueil (Kit gratuit, Galerie, Événement, Article) ; liens Galerie du pied de page et du ☰ | Bloc **masqué**, sans espace réservé (FR-2) ; liens Galerie masqués tant qu'aucune photo n'est validée. |
| **Catalogue vide / filtres sans résultat** | Catalogues | Phrase courte + bouton « Effacer les filtres » [HYPOTHÈSE de formulation]. |
| **Panier vide** | Panier | « Ton panier est vide. » + liens vers les catalogues [HYPOTHÈSE de formulation]. |
| **Mes commandes vide** | Compte | « Aucune commande pour le moment. » + lien vers les catalogues. |
| **Ma bibliothèque vide** | Compte | « Aucun kit dans ta bibliothèque. » + lien vers le Catalogue Kits. |
| **Mes Pass vide** | Compte | « Aucun pass pour le moment. » + lien vers les Événements. |
| **Aucun Événement à venir** | Événements (liste) | « Aucun événement à venir pour le moment. » ; Événements passés affichés s'il y en a. Rien d'inventé. |
| **Blog sans Article** | Blog (liste) | « Aucun article pour le moment. » + lien vers l'accueil. |
| **Réseau lent** (Patrick, Kinshasa) | Partout | Photo de repli du héros ; squelettes ; animations allégées ; vidéo de kit en qualité basse d'abord (seuil 3G fixé par l'architecte). Le contenu est visible par défaut au rendu serveur. |
| **Hors ligne** | Partout (client) | Message d'état « Pas de connexion. » ; aucune action envoyée en silence. Pendant un paiement : à la reconnexion, l'état est relu du serveur (« en cours de vérification » tant qu'il est inconnu). |
| **Erreur serveur (500)** | Partout | Page ou message clair « Un problème est survenu. Réessaie dans un instant. » + lien WhatsApp ; pendant un paiement, jamais « échec » : « Paiement en cours de vérification ». |
| **Brouillon** | URL directe d'un Produit non publié | Introuvable (404) (FR-5). |
| **Erreur 404** | Toute URL inconnue | Page soignée, liens vers accueil et catalogues. |
| **Focus** | Partout | `{components.focus-ring}` visible au clavier, jamais masqué par l'en-tête. |

### Fiche, Panier et Compte

Maquettes : [key-fiche-cosplay](mockups/key-fiche-cosplay.html), [key-fiche-kit](mockups/key-fiche-kit.html), [key-panier-commande](mockups/key-panier-commande.html), [key-connexion](mockups/key-connexion.html), [key-compte](mockups/key-compte.html).

| État | Surface | Traitement |
|---|---|---|
| **En stock / Fabrication sur commande** | Fiche, carte | Badge + Délai de fabrication avant paiement. |
| **Commandes complètes** (Plafond atteint) | Fiche, carte | Fabrication sur commande retirée ; « Commandes complètes pour le moment » (EN : « Orders full for now ») [EN : HYPOTHÈSE de traduction] ; **Kit lié proposé** ; articles en stock toujours vendables (FR-10). |
| **Hors zone** | Fiche Produit physique | **Bandeau d'information** avant l'ajout + Kit lié, pour tous (FR-6). |
| **Mesures incomplètes** | Fiche Sur-mesure | Bouton d'ajout en `aria-disabled` avec la raison ; au clic, focus sur la première mesure manquante. |
| **Kit déjà possédé** | Fiche Kit, Panier | Le bouton devient « Ouvrir dans ma bibliothèque » ; ajout au Panier impossible (FR-9, FR-11). |
| **Kit déjà possédé après fusion** | Panier, à la connexion | Kit retiré du Panier fusionné, avec message « Tu possèdes déjà ce kit : il est dans ta bibliothèque. » (FR-11). |
| **Kit en double dans le Panier** | Panier | Un exemplaire maximum (FR-11). |
| **Article devenu indisponible** | Panier, paiement | Libellé **« Plus disponible »** (décision ; jamais « Épuisé ») + « Cet article n'est plus disponible pour le moment. Retire-le pour continuer. » ; icône + texte ; « Passer la commande » en `aria-disabled` avec la raison. Revérifié côté serveur au paiement (FR-10, FR-13). |
| **Montant modifié** | Récapitulatif, paiement | Le serveur a recalculé un total différent (prix, Forfait, Code promo) : « Le total a changé : [ancien] → [nouveau] USD. » ; **reconfirmation obligatoire** avant paiement. |
| **Panier 100 % numérique** | Étape de commande | Aucun champ de remise, d'adresse ni de téléphone (FR-13, décision) ; le numéro est saisi au paiement mobile money. |
| **Retrait choisi** | Étape de commande (Goma) | Lieu et modalités de retrait lus du Réglage (FR-51), affichés avant paiement. |
| **Code promo refusé** (inconnu, inactif, plafond, pas un premier achat, second code) | Étape de commande, Achat de Pass | Message sous le champ, selon le cas : « Ce code n'existe pas. Vérifie l'orthographe. » ; « Ce code n'est plus actif. » ; « Ce code a été utilisé le nombre maximal de fois. » ; « Ce code est réservé à un premier achat. » ; « Un seul code par achat. » (décision du 2026-10-21 ; corrige un renvoi erroné vers E-13, qui concerne le Trop-perçu). |
| **Navigateur intégré** | Partout ; connexion | Bandeau « Ouvrir dans Chrome » non bloquant ; bouton Google masqué ; code par email (FR-3, FR-12). |
| **Moins de 13 ans / Compte mineur** | Création de compte | Âge déclaré dans un champ numérique (rendu validé). Création refusée sous 13 ans, rien n'est enregistré ; 13–17 ans = Compte mineur (ville jamais affichée en Galerie). |
| **Retour après connexion** | Connexion | Retour à la page et au Panier quittés (FR-12) ; les questions d'accueil ne retardent pas ce retour. |
| **Connexion requise** | Achat de Pass, Kit gratuit | Connexion par code, puis retour sur la Page Événement ou la Fiche Kit (FR-33, FR-58). |
| **Code de connexion faux** | Connexion | « Ce code n'est pas le bon. Vérifie-le ou demande un nouveau code. » relié au champ ; la saisie reste modifiable. |
| **Code de connexion expiré** | Connexion | « Ce code a expiré. » + « Renvoyer le code » mis en avant. |
| **Code renvoyé** | Connexion | « Un nouveau code a été envoyé à [email]. » (`role="status"`), seulement après envoi réel (règle 13) ; l'ancien code ne fonctionne plus [HYPOTHÈSE, selon l'architecture]. |
| **Email du code non reçu** | Connexion | Aide en texte : vérifier l'adresse saisie et les courriers indésirables, « Renvoyer le code », « Changer d'adresse email ». |

### Paiement

Maquettes : [key-paiement](mockups/key-paiement.html), [key-attente-paiement](mockups/key-attente-paiement.html), [key-compte](mockups/key-compte.html) (Trop-perçu, Offert).

| État | Surface | Traitement |
|---|---|---|
| **Paiement lancé** | Bouton de paiement | Au **premier toucher**, le bouton passe en `aria-disabled`, libellé « Paiement lancé… », tant que le serveur n'a pas répondu ; un second toucher est ignoré. La requête porte une clé d'idempotence (à confirmer par l'architecte). Une seule Tentative en cours par Commande (FR-17). |
| **Tentative en cours retrouvée** | Paiement (retour arrière, rechargement, second onglet, réouverture du site) | La page lit l'état serveur et affiche l'Écran d'attente ou « Paiement en cours de vérification » ; **aucun nouveau choix de moyen, aucun bouton « Payer »**. |
| **Onglet fermé pendant la validation** | Mes commandes | La Commande `en attente` apparaît avec son état réel et un lien « Voir l'état du paiement » ; un email n'est cité que s'il part réellement (règle 13). |
| **Changement de moyen pendant une Tentative** | Récapitulatif et paiement | Impossible : les Cartes de moyen de paiement sont absentes tant qu'une Tentative est en cours ; message « Un paiement est déjà en cours pour cette commande. ». |
| **Couple pays-opérateur non couvert** | Paiement mobile money | « Aucun moyen de paiement disponible pour cet opérateur. Choisis un autre opérateur ou la carte. » [HYPOTHÈSE de formulation] (FR-16). |
| **Plus aucun service pour cet opérateur** | Après repli(s) | Tous les Agrégateurs du couple ont échoué ou sont désactivés : « Choisis un autre opérateur ou la carte. » + **Bouton WhatsApp** ; plus de « Réessayer avec un autre service ». |
| **Carte indisponible pour ce panier** | Récapitulatif et paiement | Le serveur ne renvoie aucun Prestataire carte autorisé (K-Pay coupé pour un Panier avec Produit physique ou un Pass ; Polar inactif pour un Panier 100 % numérique) : l'option Carte est absente, avec « Le paiement par carte n'est pas disponible pour le moment. ». **Aucune substitution** : jamais Polar pour un Produit physique, un Panier mixte ou un Pass, même si K-Pay est coupé ; jamais MaishaPay ni GeniusPay carte (non branchés). Panier 100 % numérique + Polar inactif : E-19. |
| **Panier mixte + carte** | Paiement | **Polar absent** ; carte via K-Pay (UJ-3b). |
| **En attente de validation** | Attente de paiement | « Valide le paiement sur ton téléphone. » ; échéance « À payer avant [heure] » ; pas de second paiement possible (une Tentative à la fois). |
| **En cours de vérification** (délai dépassé, réponse ambiguë, code d'erreur inconnu, retour carte avant Notification) | Attente, page de retour | « Paiement en cours de vérification. » (`role="status"`, couleur `warning`). **Aucun repli, aucun bouton repayer** tant que l'état est inconnu (FR-17, FR-20). |
| **Échec confirmé par l'Agrégateur / Agrégateur désactivé** | Page de retour, attente | `role="alert"`, focus sur le titre. « Ce service de paiement n'a pas abouti. Réessayer avec {Agrégateur suivant} ? » (décision) + **Bouton WhatsApp** (FR-17, FR-20). Le repli demande une action explicite du client. Après le toucher : « Une nouvelle demande de paiement va arriver sur ton téléphone. » [HYPOTHÈSE de formulation]. La classification (client / Agrégateur / inconnu) vient du serveur, depuis une table de codes par Adaptateur tirée de la documentation ; code inconnu → « en cours de vérification ». |
| **Échec dû au client** (refus, solde insuffisant, abandon) | Page de retour | `role="alert"`. « Le paiement n'a pas abouti. Tu peux réessayer. » ; « Réessayer » sans bascule d'Agrégateur, sans ressaisie (FR-17). Une annulation sur le téléphone est traitée comme un échec client (E-27). |
| **Commande `échouée`** | Mes commandes | Possibilité de repayer (FR-19), sans ressaisie. |
| **Commande `expirée`** (Délai de paiement dépassé) | Mes commandes | Statut affiché ; réservation libérée. Pas de compte à rebours ; l'échéance a été annoncée en texte avant le lancement. « Reprendre mon panier » : retour au Panier, champs repris, nouvelle Commande (E-35). |
| **Payée** | Page de retour | Affichée **seulement** après Notification de paiement vérifiée (FR-20) ; focus sur le titre ; Kit → lien « Ouvrir dans ma bibliothèque » ; Pass → lien « Mes Pass ». Sans argot ni emoji. |
| **Offerte** | Kit gratuit, Mes commandes, Frise, Mes Pass, email | Libellé client **« Offert »**, jamais « Payée » ; aucun montant de paiement, aucun Prestataire, aucune référence. Posée par le serveur seulement (FR-42, FR-58). |
| **Kit gratuit déjà obtenu** | Fiche Kit gratuit | Le bouton devient « Ouvrir dans ma bibliothèque » (un Kit gratuit par Compte, FR-58). |
| **Trop-perçu** | Page de retour, Mes commandes | Texte validé (E-13). Quand le serveur a enregistré un Trop-perçu pour cette Commande : « Nous avons reçu un paiement pour cette commande alors qu'elle était [expirée / déjà payée / impossible à honorer]. Jonathan va te contacter pour le remboursement. » + **Bouton WhatsApp** ; la Commande garde son statut (FR-19) ; **aucune promesse de délai ni de mode de remboursement** tant que Q-4 est ouverte. |
| **Référence de transaction déjà utilisée** | — | **Aucun écran client** ; la Commande garde son état ; aucun identifiant de Prestataire affiché ; visible dans l'admin seulement. |
| **Événement complet entre-temps** | Achat de Pass | Capacité atteinte avant paiement : vente refusée, « Complet » ; atteinte après un paiement réussi : traité comme un Trop-perçu (FR-19). |

### Après-vente, bibliothèque, Pass

Maquettes : [key-bibliotheque](mockups/key-bibliotheque.html), [key-pass-photo](mockups/key-pass-photo.html), [key-scan](mockups/key-scan.html), admin ([key-admin-tableau](mockups/key-admin-tableau.html), [key-admin-commandes](mockups/key-admin-commandes.html), [key-admin-produits](mockups/key-admin-produits.html)).

| État | Surface | Traitement |
|---|---|---|
| **Annulation hors délai** | Suivi | Bouton absent après `en fabrication` (FR-25). |
| **Réclamation hors délai** | Suivi | Bouton absent après 48 h (FR-26). |
| **Lien de téléchargement expiré** | Ligne de fichier de kit | « Le lien a expiré. Touche à nouveau Télécharger. » ; un nouveau lien signé est créé par le serveur à chaque clic (règle 1). |
| **Échec de téléchargement** | Ligne de fichier de kit | « Le téléchargement n'a pas abouti. Réessaie. » ; téléchargements illimités (FR-28). |
| **Vidéo de kit qui ne charge pas** | Lecteur | Message d'état + « Réessayer » ; reprise à la dernière position connue. |
| **Vidéo de kit : reprise** | Lecteur | Reprend à la dernière position ; changement d'appareil sans perte (FR-29). |
| **Événement complet** | Page Événement | « Complet », vente de Pass arrêtée (FR-31). |
| **Événement passé** | Page Événement | Consultable, lien de la Galerie d'événement (FR-31). |
| **Scan : refus** | Écran de Scan | « REFUSÉ » + raison : déjà scanné, annulé, autre Événement (FR-35). |
| **Scan : caméra refusée** | Écran de Scan | « Autorise l'accès à la caméra pour scanner les pass. » + instructions en texte pour rétablir la permission ; « Saisir le code à la main » reste disponible (E-31). |
| **Scan : appareil non verrouillé** | Écran de Scan | « Scan réservé à l'appareil hors ligne » (FR-36). |
| **Scan hors ligne sans Verrou** | Écran de Scan | Scan impossible, message explicite (FR-36). |
| **Accès bénévole expiré** | Scan | Déconnecté après le jour J (FR-37). |
| **Photo en attente / publiée / retirée** | Compte › Envoyer une photo | Statut réel affiché (FR-41). |
| **Téléversement client en cours / échoué** | Compte › Envoyer une photo / une Réalisation | Progression (`role="progressbar"` avec valeur) ; reprise après coupure ; fichier trop lourd ou format refusé → message avec la limite et les formats acceptés (valeurs fixées par l'architecture) ; rien n'est perdu de ce qui a été saisi. |
| **Opération « 10 pass » terminée** | Compte › Réalisation | Compteur arrêté à 10 ; Réalisation toujours envoyable [HYPOTHÈSE]. |
| **Admin : publication refusée** | Gestion des Produits | Liste des manques (prix, photo, alt, fichier de Kit, **sous-titres FR de la Vidéo de kit** ; les sous-titres EN sont facultatifs) (FR-50, PRD Q-15). |
| **Admin : téléversement interrompu** | Gestion des Produits | Progression + reprise après coupure (FR-50). |
| **Admin : transition interdite** | Commandes, Pass | L'action est **absente**, pas désactivée (voir § Admin). |
| **Admin : transition autorisée, condition non remplie** | Détail d'une Commande | Exemple : « Passer en fabrication » sans Mesures validées. Bouton affiché en `aria-disabled` avec la raison écrite à côté (« Valide d'abord les mesures… ») (décision). |
| **Admin : rien de nouveau** | Tableau de bord | « Aucune nouvelle commande payée aujourd'hui. » (information) ; « Aucune tâche en attente. » (succès, icône + texte) ; « Aucun paiement vérifié aujourd'hui. » + lien vers les 7 derniers jours. Aucun zéro décoratif. |
| **Admin : remboursement sans preuve** | Détail d'une Commande annulée | Résumé d'erreur (`role="alert"`) + erreur reliée au champ « Preuve du remboursement » ; la Commande reste `annulée`. |
| **Admin : valeur de Réglage non fournie** | Réglages | Champ laissé vide avec « Valeur à fixer » (par exemple frais d'annulation des Pass) ; aucune valeur par défaut inventée (règle 15). Le Délai de paiement n'est pas concerné : il démarre à 30 minutes, valeur décidée par Jonathan (E-9). |
| **Admin : Couverture non saisie** | Prestataires | Aucune case cochée d'avance ; chaque couple porte « À vérifier » et une source (document ou contrat) à citer (règle 9). |

## Interaction Primitives

**Animations vivantes (décision)** : cartes qui s'élèvent au survol, parallaxe légère sur le héros, apparitions au défilement.

**Garde-fous (décisions validées)** :
- `prefers-reduced-motion` : animations coupées (parallaxe, apparitions, élévations) ; **la vidéo du héros est remplacée par sa photo** (décision) ; indicateurs d'attente statiques.
- Bouton Pause du héros **obligatoire** ; la parallaxe s'arrête aussi quand la vidéo est en pause.
- Réseau lent : animations allégées ; photo de repli du héros [HYPOTHÈSE pour le critère de détection du réseau lent].
- **Jamais** d'animation bloquante : aucune animation ne retarde l'accès au contenu, au bouton d'action ou au paiement.
- **Contenu visible par défaut** dans le rendu serveur : l'apparition au défilement est une amélioration, déclenchée seulement si le JavaScript est chargé et le mouvement autorisé (jamais de contenu bloqué à `opacity: 0`).
- Survol réservé aux pointeurs fins ; toute information révélée au survol existe aussi au toucher et au clavier.
- Aucune transition de plus de 5 s ; aucun carrousel à défilement automatique.

**Gestes** : toucher pour agir. Chaque geste a une alternative par bouton (WCAG 2.5.1, 2.5.7) : balayage de la **Galerie photo produit** ↔ boutons « Photo précédente / suivante » et vignettes ; pincement pour zoomer ↔ bouton « Agrandir » et boutons +/− ; le zoom natif n'est jamais bloqué.

**Interdit partout** : comptes à rebours d'urgence, faux stocks bas, compteurs de places ou de stock, roues, jackpots, notifications « X vient d'acheter », pop-ups bloquants, bonus clignotants (mécaniques 1win rejetées, règle 5) ; boîtes de dialogue empilées ; défilement horizontal de page ; sélection qui change de page.

## Accessibility Floor

Comportement. Le contraste visuel est dans `DESIGN.md` › Colors. Cible : WCAG 2.2 AA.

- **Clavier** : tout est utilisable au clavier (CLAUDE règle 7) ; ordre de focus = ordre de lecture ; **Lien d'évitement** obligatoire ; **Panneau ☰** et **Boîte de dialogue** piègent le focus, se ferment par Échap et rendent le focus à l'élément d'origine ; focus jamais masqué par l'en-tête collant ou le bandeau.
- **Cibles tactiles ≥ 44 × 44 px** pour toute commande isolée (décision) ; case de 24 px acceptée si tout son libellé est cliquable ; liens d'un texte de consentement espacés d'au moins 24 px.
- **Images** : texte alternatif sur chaque image ; publication refusée sans alt (FR-50).
- **Vidéo du héros** : sans son, `aria-hidden`, sans information indispensable ; **bouton Pause obligatoire** ; photo à la place en mouvement réduit ; ≤ 3 flashs par seconde.
- **Vidéos de kit** : **sous-titres WebVTT français obligatoires**, anglais facultatifs (la fiche `/en` d'un Kit sans sous-titres anglais l'indique), publication refusée sans sous-titres français, lecteur entièrement au clavier (décision).
- **Titres** : un seul H1 par page (FR-56) ; H2 pour les sections, H3 pour les produits et questions FAQ.
- **Formulaires** : libellés visibles, `autocomplete`, erreurs reliées et résumé d'erreurs, rien ressaisi (3.3.7), jamais la couleur seule pour signaler un état (icône + texte). Code de connexion : un seul champ `one-time-code`, collage permis (3.3.8).
- **Annonces** : changements d'état du paiement en `role="status"` **une fois par changement réel**, échec en `role="alert"`, focus déplacé sur le titre du nouvel état ; `role="status"` aussi pour l'ajout au panier, la copie de lien, le nombre de résultats des filtres et le changement de pays.
- **Limite de temps** : le Délai de paiement est annoncé en texte avant le lancement (« À payer avant [heure] »), sans compte à rebours ; après un échec, la relance se fait sans ressaisie.
- **Couleur seule interdite** : Frise des statuts, chapitres, badges, Scan, sélection — toujours une icône et un texte.
- **Langue** : `lang` par route et par passage, `lang="ja"` pour le japonais exposé.
- **Emojis et glyphes** : jamais dans un nom accessible ; ☰ et ✕ ont un `aria-label` traduit, le glyphe est `aria-hidden`.
- **Reflow** à 320 px CSS sans perte ni défilement horizontal ; zoom à 200 % ; espacement de texte (1.4.12) sans coupure.
- **Couleurs forcées** : sélection et focus restent visibles (`DESIGN.md` › Colors).
- **Critères d'acceptation de chaque story d'interface** : axe-core sans violation (tests e2e) ; passage clavier seul ; test **TalkBack (Android)** et VoiceOver iOS, y compris dans le navigateur intégré d'Instagram ; vérification à 320 px, à 200 %, en `prefers-reduced-motion` et en `forced-colors` ; contraste du verre mesuré sur blanc pur et noir pur. Lighthouse mobile ≥ 90 en accessibilité sur l'accueil (NFR-2) reste un plancher, pas une preuve.

## Paiement & confiance

Section propre au produit : le paiement est le moment où la confiance se gagne ou se perd. Elle rappelle les règles 2, 3, 9, 10 et 13 de `CLAUDE.md` (redondance acceptée : section la plus lue par les stories de paiement) et ajoute les décisions UX suivantes.

- **Le serveur décide**, l'interface montre. Le navigateur ne passe jamais une Commande en `payée` — ni la page de retour, ni l'admin (voir § Admin) ; la page de retour lit l'état réel et ignore les paramètres d'URL (règle 2, FR-20).
- **Ce que le client choisit** : mobile money (pays + opérateur + numéro) ou carte. **Ce que le serveur choisit** : l'Agrégateur (Ordre de priorité) ou le Prestataire carte (K-Pay / Polar) selon la Famille de chaque article.
- **Nom du Prestataire** (décision) : au choix, « Mobile money » ou « Carte » ; juste avant validation, ligne factuelle « Paiement traité par {Prestataire} » ; au repli après échec confirmé, « Ce service de paiement n'a pas abouti. Réessayer avec {Agrégateur suivant} ? ». **Noms en texte seul, aucun logo** de Prestataire, d'opérateur ni de réseau de carte sans autorisation contractuelle écrite (règle 5).
- **Polar** n'apparaît que pour un Panier 100 % numérique payé par carte ; jamais pour un Panier mixte, un Produit physique ou un Pass (règle 10), **même si K-Pay carte est coupé** (état « Carte indisponible pour ce panier »).
- **Repli** : proposé, jamais automatique sans action du client, seulement après échec confirmé ou Agrégateur désactivé ; jamais après un délai dépassé ni sur un code inconnu.
- **Un seul paiement à la fois** : bouton verrouillé au premier toucher, Tentative en cours retrouvée sur tout onglet ou retour, pas de changement de moyen pendant une Tentative.
- **Prix toujours en USD**, partout, identiques dans tous les pays. **Tant que Q-3 n'est pas tranchée et `CLAUDE.md` modifié, aucun montant hors USD n'est affiché, aucune conversion n'est calculée par le site, aucune phrase sur la devise débitée n'est inventée** (E-7).
- **Délai total avant paiement** sur la fiche, au Panier et au récapitulatif.
- **Signes de confiance autorisés** : vraies photos, atelier, WhatsApp visible, délai annoncé (PRD §10). Rien d'inventé : ni avis (ni `aggregateRating`/`review` en JSON-LD), ni compteur, ni logo de partenaire non contractuel. Le délai de réponse « sous 24 h » du Guide n'est pas affiché (absent du PRD).

## Admin

Utilisable sur téléphone et ordinateur (FR-49). Même thème que le site (crème par défaut, sombre par bascule), **sans motif manga ni Sakura Town** (décision), sans argot ni animation décorative. Navigation : **Barre latérale admin** sur ordinateur, **Barre d'onglets admin** + ☰ sur mobile (décision, voir Navigation). Mêmes règles clavier, focus et cibles que la vitrine ; **Graphiques en barres** doublés d'un **Tableau de données admin** ; téléversements en **Barre de progression**.

Maquettes : [key-admin-tableau](mockups/key-admin-tableau.html), [key-admin-commandes](mockups/key-admin-commandes.html), [key-admin-produits](mockups/key-admin-produits.html), [key-admin-reglages](mockups/key-admin-reglages.html).

| Surface | Rôle | Source |
|---|---|---|
| Tableau de bord | D'abord les nouvelles Commandes payées, puis graphiques de paiement, puis tâches (Mesures à vérifier, annulations, remboursements, remplacements, Trop-perçus à rembourser, photos, Réalisations) et indicateurs | FR-49 |
| Commandes (liste + détail) | Filtres Statut, Famille, Prestataire, Zone de remise ; **avancement manuel limité aux transitions autorisées** ; numéro de suivi (texte libre) ; Mesures ; correction d'adresse | FR-23, FR-24 |
| Produits | Création, photos ordonnées avec alt, variantes, délais, Kit lié, fichiers, vidéo, chapitres et **sous-titres** (publication refusée sans sous-titres FR ; EN facultatifs) | FR-50, décision |
| Réglages, Prestataires | Délai de paiement, forfaits, lieu et modalités du retrait, Plafond, WhatsApp, héros (Cosplay vedette, vidéo, photo de repli) ; activation par **Interrupteur**, Ordre de priorité par **Boutons Monter / Descendre**, Couverture saisie à la main avec source ; règle carte affichée verrouillée (K-Pay : physique et Pass ; Polar : 100 % kits) | FR-21, FR-51 |
| Événements, Pass, Accès bénévole | Création, Pass vendus / scannés par Type, Accès bénévole d'un jour limité au Scan, Verrou hors ligne (appareil qui le tient, libération forcée qui signale les scans non synchronisés), demandes d'annulation de Pass | FR-36 à FR-38, FR-52 |
| Galerie, Réalisations, Blog, Codes promo, Alertes événement | Validation, publication, commissions, export des numéros | FR-32, FR-41 à FR-43, FR-46 à FR-48 |

### Transitions manuelles autorisées (Commandes)

Règle 2 : **l'admin ne peut jamais mettre une Commande en `payée`** ; seule la route de Notification de paiement vérifiée le fait. Une transition non listée ici n'est **pas proposée** (action absente, pas désactivée). Une transition listée dont la condition manque est affichée désactivée, avec sa raison. Chaque changement envoie réellement l'email correspondant (FR-24, FR-44).

| De | Vers | Condition | Source |
|---|---|---|---|
| `payée` | `en fabrication` | Commande avec Produit physique ; Sur-mesure : **Mesures validées** obligatoires. Sans elles, « Passer en fabrication » est affiché en `aria-disabled` avec la raison (décision) | FR-23, FR-24 |
| `payée` | `expédiée` | Accessoire ou Cosplay en stock, sans fabrication (E-24) | FR-24 |
| `en fabrication` | `expédiée` | — | FR-24 |
| `expédiée` | `livrée` | — | FR-24 |
| `payée` | `annulée` | Demande d'annulation du client validée par l'admin, Commande de Cosplay pas encore `en fabrication` ; stock et place dans le Plafond libérés | FR-25 |
| `annulée` | `remboursée` | **Saisie obligatoire de la preuve** (référence du Prestataire ou du virement manuel) ; sans preuve, l'action n'aboutit pas | FR-25 |

**Posés par le serveur uniquement, jamais proposés à l'admin** : `en attente`, `payée`, `offerte` (créée par le serveur : Kit gratuit FR-58, opération « 10 pass » FR-42), `échouée`, `expirée`, et `livrée` pour une Commande 100 % numérique. Aucun retour en arrière proposé (E-30). Un Trop-perçu ne change pas le statut : il crée une tâche « Trop-perçu à rembourser » (FR-19). L'opération « 10 pass » : l'admin **valide la Réalisation** ; c'est le serveur qui crée la Commande `offerte` et émet le Pass.

**Pass** : `valide` → `annulé` (demande du client jusqu'à 48 h avant, validée par l'admin, frais réglés retenus) → `remboursé` (**preuve obligatoire**) (FR-38).


## Responsive & Platform

| Largeur | Comportement |
|---|---|
| **320–359 px** | Une colonne partout, **tuiles de catégorie en 1 colonne** ; reflow sans défilement horizontal. |
| **375 px (référence)** | Une colonne ; héros vidéo plein écran + panneau de verre renforcé ; en-tête compact + ☰ ; tuiles de catégorie en 2 colonnes (≥ 360 px) ; FAQ en 1 colonne. |
| **Tablette** [HYPOTHÈSE `md`] | Grilles de cartes à 2–3 colonnes ; ☰ conservé [HYPOTHÈSE]. |
| **Ordinateur** [HYPOTHÈSE `lg`+] | Barre du haut complète ; héros = vidéo ~2/3 + deux **Tuiles d'option du héros** ; FAQ en 2 colonnes ; survol actif. |
| **Zoom ≥ 200 % ou hauteur < 500 px** | En-tête non collant ; tuiles de catégorie en 1 colonne. |

- **Navigateurs intégrés** (Instagram, Facebook, TikTok) : cible prioritaire ; pas de dépendance à Google OAuth ; verre avec repli (renforcé à 85 % sans flou, discret → surface opaque).
- **Écran de Scan** : téléphone du bénévole, connecté ou avec Verrou hors ligne ; couleurs identiques dans les deux thèmes.
- **Admin** : Barre latérale sur ordinateur, Barre d'onglets en bas + ☰ sur mobile ; listes en tableaux sur ordinateur, en cartes sur mobile.
- Aucun défilement horizontal de page, à aucune largeur.

## Inspiration & Anti-patterns

- **Repris de 1win (structure seulement)** : héros large + deux tuiles verticales, rangées de cartes à dégradés, coins très arrondis, FAQ en accordéons sur deux colonnes, pied de page en cartes, onglets en pilule. Captures : `DESIGN.md` › Brand & Style.
- **Rejeté de 1win** : thème casino, comptes à rebours de bonus, urgence artificielle, barre latérale d'icônes, toute mécanique de jeu d'argent (contraire à la règle 5).
- **Repris d'animotaku.fr** : cartes Article vignette + titre + date ; pas de héros sur le blog [HYPOTHÈSE].
- **Repris de myutaku.com** : mode nuit ; grilles d'affiches. **Rejeté** : barre d'onglets en bas sur mobile (décision : ☰ en haut).
- **Repris de cultureotaku.com** : ton nakama et emojis en vitrine ; catégories de type « Cosplay & Conventions » pour le blog [HYPOTHÈSE].

## Key Flows

Noms et titres repris du PRD §2.3. Libellé de la double option : « Prêt à porter » / « Le fabriquer moi-même ».

### UJ-1. Grâce, à Bukavu, commande un cosplay sur mesure.

Maquettes : [key-fiche-cosplay](mockups/key-fiche-cosplay.html), [key-panier-commande](mockups/key-panier-commande.html), [key-paiement](mockups/key-paiement.html), [key-attente-paiement](mockups/key-attente-paiement.html), [key-compte](mockups/key-compte.html).

1. Grâce arrive d'une vidéo TikTok sur la **Fiche Produit physique** du Cosplay, sur son téléphone ; elle fait défiler la **Galerie photo produit**.
2. Le **Sélecteur à deux options** lui présente « Prêt à porter » et « Le fabriquer moi-même » ; elle garde « Prêt à porter », puis choisit Sur-mesure.
3. Elle remplit le **Schéma des Mesures** ; l'ajout au Panier se débloque quand tout est complet.
4. Le **Bandeau d'information** lui a rappelé la remise à Goma et Bukavu ; à l'étape de commande, elle choisit la Zone de remise Bukavu : livraison obligatoire, forfait Bukavu, adresse en champ libre.
5. Le **Récapitulatif** montre prix, forfait et délai total (fabrication + remise).
6. Elle crée son Compte (**Champ du code de connexion**) et revient à son Panier.
7. Elle choisit Mobile money, son pays puis son opérateur — par exemple M-Pesa (RDC) ; couverture réelle selon Q-1 — ; la ligne « Paiement traité par {Prestataire} » s'affiche ; le bouton se verrouille au toucher ; l'**Écran d'attente de paiement** lui dit de valider sur son téléphone.
8. **Moment fort** : la page de retour affiche « payée » (Notification vérifiée) et la **Frise des statuts** démarre — son costume existe déjà dans la file de Jonathan.
9. Emails à chaque statut ; question posée via le **Bouton WhatsApp** du suivi.
10. À la livraison, invitation à envoyer sa photo, accord explicite, choix d'affichage ; validation par Jonathan.

Échecs : échec confirmé de l'Agrégateur → « Ce service de paiement n'a pas abouti. Réessayer avec {Agrégateur suivant} ? » ; délai dépassé → « Paiement en cours de vérification », sans repli ; double toucher ou retour arrière → Tentative en cours retrouvée. Annulation possible seulement avant `en fabrication`.

### UJ-2. Patrick, étudiant à Kinshasa, achète un kit.

Maquettes : [key-connexion](mockups/key-connexion.html), [key-bibliotheque](mockups/key-bibliotheque.html).

1. Patrick arrive par une pub ou un influenceur, sur une connexion lente : squelettes et photo de repli.
2. Il ajoute un Kit au Panier sans Compte.
3. Avant de payer, il crée son Compte avec le code reçu par email (un seul champ, collage permis) et revient exactement où il était ; il passe les questions d'accueil.
4. Il saisit son Code promo : réduction affichée au **Récapitulatif** (premier achat).
5. Aucun champ de remise (Panier 100 % numérique) ; il paie par mobile money — par exemple Airtel Money ; couverture réelle selon Q-1.
6. **Moment fort** : le Kit s'ouvre aussitôt dans « Ma bibliothèque » — les patrons A4 se téléchargent, le chapitre 1 démarre en qualité adaptée, sous-titré.
7. Le lendemain, sur un autre téléphone, le **Lecteur vidéo à chapitres** reprend où il s'était arrêté.
8. S'il a consenti, Relances avec désinscription ; il envoie sa Réalisation (10 premiers = Pass gratuit).

Échecs : Code promo refusé → message sous le champ ; couple non couvert → autre opérateur ou carte ; code de connexion faux ou expiré → « Renvoyer le code » ; lien de téléchargement expiré → nouveau lien au clic.

### UJ-3. Amina, depuis l'étranger, paie un kit par carte.

1. Amina ouvre la fiche d'un Accessoire.
2. Avant l'ajout au Panier, le **Bandeau d'information** la prévient : remise à Goma et Bukavu seulement ; le Kit lié est proposé.
3. Elle suit le lien vers la **Fiche Kit** et l'ajoute.
4. Au paiement, elle choisit « Carte » : Panier 100 % numérique → « Paiement traité par Polar ». *Ce parcours suppose Polar activé (Q-13) ; sinon état « Carte indisponible pour ce panier » (E-19).*
5. **Moment fort** : sans mobile money et loin de Goma, elle accède au Kit dans sa bibliothèque dès le paiement vérifié.

Échec : paiement carte refusé → « Réessayer », sans changer de Prestataire.

### UJ-3b. Un client de Goma paie un panier mixte par carte.

Maquette : [key-paiement](mockups/key-paiement.html), cadre 2.

1. Le client met un Kit et un Accessoire dans son Panier.
2. À l'étape de commande, il choisit la Zone de remise Goma, puis retrait gratuit (lieu affiché) ou livraison.
3. Il choisit « Carte ».
4. **Moment fort** : seule la carte via K-Pay est proposée (« Paiement traité par K-Pay ») ; **Polar n'apparaît pas** — aucun choix impossible ne lui est présenté.
5. Après paiement vérifié : Kit dans la bibliothèque, Accessoire suivi dans la **Frise des statuts**.

Échecs : carte refusée par K-Pay → « Réessayer », **sans jamais proposer Polar** ; K-Pay carte coupé → « Carte indisponible pour ce panier », mobile money seul, aucune substitution.

### UJ-4. Kevin, 19 ans, à Goma, découvre KOMA SHOP par la page d'accueil.

Maquettes : [key-accueil](mockups/key-accueil.html), [key-fiche-kit](mockups/key-fiche-kit.html).

1. Kevin clique sur une pub Instagram ; le site s'ouvre dans le navigateur intégré, avec le bandeau « Ouvrir dans Chrome » non bloquant.
2. Les 3 premières secondes : le **Héros vidéo** (fabrication puis costume porté), « Deviens ton personnage. », boutons « Prêt à porter » et « Le fabriquer moi-même » ; le **Bouton Pause du héros** est là s'il veut arrêter la vidéo.
3. Il fait défiler : bloc « Porte-le ou fabrique-le », Cosplays, Kits, Galerie (si photos), prochain Événement, Jonathan, guides, FAQ.
4. **Moment fort (le moment où il craque)** : il touche « Le fabriquer moi-même » — budget serré, et la promesse de dire « c'est moi qui l'ai fait ».
5. Sur la **Fiche Kit**, il crée son Compte par code email (Google masqué) et paie par mobile money.
6. Il partage la fiche sur WhatsApp (grande photo + titre) et s'inscrit à « Me prévenir ».
7. À l'Événement, il envoie sa photo ; validée, elle apparaît dans « Ils le portent ».

Jour du lancement : bloc Kit gratuit et Galerie masqués sans vrai contenu.

**Variante (à partir de la 5ᵉ semaine, FR-58) — Kevin commence par le Kit gratuit.**
1. Sur l'accueil, le bloc Kits met en avant le Kit gratuit (« Ton premier accessoire, offert. ») ; Kevin ouvre sa **Fiche Kit**.
2. Il touche **Obtenir le Kit gratuit** ; non connecté, il se connecte par code puis revient sur la fiche.
3. Au toucher, sans Panier, sans Récapitulatif ni choix de paiement, le serveur crée la Commande `offerte` ; « Ouvrir dans ma bibliothèque » apparaît.
4. Dans Mes commandes, la Commande porte « Offert », jamais « Payée ». Son futur Code promo de premier achat reste valable (la Commande `offerte` ne compte pas).

Échecs : Kit gratuit déjà obtenu → le bouton est « Ouvrir dans ma bibliothèque » ; erreur serveur → message clair, aucune Commande affichée tant qu'elle n'est pas créée.

### UJ-5. Divine, 23 ans, à Goma, achète des pass pour l'événement.

Maquettes : [key-evenements](mockups/key-evenements.html), [key-pass-photo](mockups/key-pass-photo.html), [key-scan](mockups/key-scan.html).

1. Divine arrive par l'Alerte événement « Me prévenir », le blog, Instagram ou une affiche, sur la **Page Événement**.
2. Elle lit date, lieu, programme, photos ; compare Standard, VIP et Stand.
3. Connectée (sinon **Connexion requise** puis retour), dans l'**Achat de Pass**, le **Sélecteur de Pass** lui fait prendre un Pass Stand (elle + son aide) et un Pass Standard (sa sœur) ; son Pass reprend son Compte, elle saisit deux noms.
4. Elle coche la mention sur la publication des photos et vidéos ; le **Récapitulatif** de Pass affiche le total USD calculé par le serveur.
5. Elle paie à part, mobile money ou carte via K-Pay (jamais Polar).
6. **Moment fort** : trois **Pass** nominatifs avec Code QR arrivent aussitôt par email et dans « Mes Pass ».
7. Jour J : l'**Écran de Scan** affiche « VALIDE » et le Type de pass écrit → bracelet Stand ; un Pass déjà scanné est refusé (« REFUSÉ » + raison).
8. Après l'Événement : email avec le lien de la Galerie d'événement ; retrait de photo possible.

Échecs : Événement complet → vente arrêtée ; complet entre-temps → vente refusée avant paiement ; annulation jusqu'à 48 h avant, validée par Jonathan, frais retenus.

### UJ-6. Jonathan gère la boutique depuis l'admin.

Maquettes : [key-admin-tableau](mockups/key-admin-tableau.html), [key-admin-commandes](mockups/key-admin-commandes.html), [key-admin-produits](mockups/key-admin-produits.html), [key-admin-reglages](mockups/key-admin-reglages.html).

1. Le matin, sur son téléphone, Jonathan ouvre le **Tableau de bord** : nouvelles Commandes payées en premier.
2. Il parcourt les graphiques de paiement puis les **Cartes de tâche admin** (Mesures, annulations, remboursements, remplacements, Trop-perçus, photos).
3. Il vérifie les Mesures d'une Commande Sur-mesure, contacte la cliente, corrige, valide.
4. **Moment fort** : il passe la Commande `en fabrication` d'un geste — seules les transitions autorisées lui sont proposées — et l'email part réellement à la cliente ; l'essentiel est fait avant d'ouvrir l'atelier.
5. Il ajoute un Cosplay et son Kit lié (téléversement repris après coupure, sous-titres de la vidéo joints), publie un Article, crée un Événement avec ses trois Types de pass, crée un Code promo et consulte ses ventes et sa commission.
6. La veille de l'Événement, il crée un Accès bénévole d'une journée.

Échecs : publication refusée → liste des manques (prix, photo, alt, fichier de Kit, sous-titres) ; remboursement sans preuve → l'action n'aboutit pas.

## Questions ouvertes

| # | Question | Bloque ? |
|---|---|---|
| E-3 | **C-16** : pages univers `/univers/[slug]` (Guide) — absentes du PRD ; non ajoutées ici (règle 14). | Non (rien n'est construit sans décision). |
| E-4 | **C-20** : bloc « Produits liés (même univers) » (Guide) — absent du PRD ; non ajouté ici. | Non. |
| E-7 | **Q-3** : montant et devise débités à afficher au moment de valider. Tant qu'elle est ouverte : USD seul, aucune conversion. | **Oui** pour le récapitulatif si autre chose que l'USD doit apparaître. |
| E-8 | **Q-1** : Couverture pays-opérateur du sélecteur. | **Oui** en production (FR-16). |
| E-10 | Liste exacte des Mesures, bornes plausibles et illustration du schéma. | **Oui** pour la story Sur-mesure. |
| E-11 | Format du délai total (jours, jours ouvrés, fourchette). | Non. |
| E-12 | Forme du formulaire « Me prévenir » (un champ ou trois options). | Non. |
| E-14 | Écran de Scan : vibration ou son distinct, couleurs par Type de pass. | Non. |
| E-15 | Échelle de niveau des Kits (rendu : Débutant, Intermédiaire, Avancé). | Non. |
| E-16 | Héros quand le Cosplay vedette n'a pas de Kit lié. | Non. |
| E-17 | Pré-remplissage du pays dans le sélecteur mobile money (la détection n'est interdite que pour l'avertissement de zone). | Non. |
| E-21 | **Licence Sakura Town** (voir `DESIGN.md` D-1). | Bloque la mise en ligne, pas la conception. |
| E-22 | **Q-5** : textes des cases à cocher, de la mention photos, du règlement « 10 pass ». | **Oui** avant la première vente. |
| E-23 | Libellés EN de « Offert », « Paiement traité par », « Commandes complètes pour le moment » et des états de paiement. | Non (story i18n). |
| E-34 | Durée de validité du code de connexion et délai avant renvoi (valeurs de l'architecture / Supabase Auth), à afficher en texte. | Non (architecture). |
| E-37 | Bouton « Continuer avec Google » : texte seul (rendu) ou logo Google selon les règles de marque de Google ? | Non (texte seul par défaut). |
| E-38 | Granularité des consentements dans Préférences (rendu : emails commerciaux / univers préféré / Alertes événement) ; FR-32, FR-45 et FR-59 ne la fixent pas. | Non. |

### Tranchées (rappel ; le détail est dans `.memlog.md` et dans les sections concernées)

| # | Décision |
|---|---|
| E-36 | **Pagination** (décision de Jonathan du 2026-10-21) : bouton « Voir plus », 12 produits par clic, vrai lien avec curseur dans l'adresse ; mêmes principes pour la liste du Blog et les listes admin. |
| Festival | **Nommage** (décision du 2026-10-21) : la rubrique s'appelle « Festival » dans les deux langues (`/fr/festival`, `/en/festival`, une page par Événement sous cette adresse) ; le mot reste `evenement` dans le code et la base. |
| M5 | **Tunnel `cloudflared`** (décision du 2026-10-21) : réservé au développement, ouvert pendant les essais de paiement seulement, jamais en production. |
| E-5 | Alignement du PRD fermé le 2026-10-20 : le PRD du 2026-10-20 contient les huit alignements demandés (« Prêt à porter », crème par défaut, rouge unique, « Commandes complètes pour le moment », ordre des moyens de paiement, sous-titres français obligatoires et anglais facultatifs selon Q-15, Galerie sans page dédiée, titres sans accent). |
| E-9 | Délai de paiement : 30 minutes, décision de Jonathan du 2026-10-20 (Q-B4) ; valeur de départ du Réglage, modifiable dans l'admin. Bascule en « en cours de vérification » après 2 min sans état final (AD-10). Compte à rebours : non (texte statique « À payer avant [heure] »). |
| E-1 | C-13 / Q-11 : le client choisit d'abord son pays ; mobile money en premier si un Agrégateur actif couvre ce pays, sinon carte seule. |
| E-2 | C-4 : « Commandes complètes pour le moment » ; « Épuisé » n'est jamais utilisé. |
| E-6 | Nom du Prestataire : « Mobile money » / « Carte » au choix ; « Paiement traité par {Prestataire} » avant validation ; repli « Réessayer avec {Agrégateur suivant} ? » ; noms en texte, aucun logo. |
| E-13 | Texte de l'écran client d'un Trop-perçu validé (State Patterns › Paiement). |
| E-18 | Galerie : pas de page dédiée ; les liens pointent vers le bloc 4 (`#galerie`). |
| E-19 | Panier 100 % numérique + Polar inactif : « Carte indisponible » ; K-Pay seulement sur accord écrit de Jonathan et mise à jour de `CLAUDE.md` règle 10. |
| E-20 | Navigation de l'admin : Barre latérale sur ordinateur ; 4 onglets en bas + ☰ sur mobile. |
| E-24 | `payée` → `expédiée` direct pour les Accessoires et Cosplays en stock. |
| E-25 | Retrait à Goma : `expédiée` s'affiche « Prête à retirer » (aucun nouveau statut). |
| E-26 | Délai de remise par Zone : texte fixe tiré de `CLAUDE.md`, aucun nouveau Réglage. |
| E-27 | Annulation du paiement sur le téléphone = échec client, sans repli. |
| E-28 | Commande mixte : seul le Cosplay est annulé ; Kit conservé et non remboursé ; Forfait rendu. |
| E-29 | Filtre « univers » et question d'accueil : genres génériques tant que Q-7 n'est pas rendu ; aucune liste saisie par défaut. |
| E-30 | Aucun retour en arrière de statut dans l'admin ; correction hors site par WhatsApp, action journalisée. |
| E-31 | Code court sous le Code QR + saisie manuelle au Scan (à ajouter au PRD). |
| E-32 | Transcription texte par chapitre, téléchargeable avec les Fichiers de kit. |
| E-33 | Kit gratuit : case d'acceptation de la Licence avant « Obtenir », sans renonciation. |
| E-35 | Commande `expirée` : retour au Panier, champs repris, nouvelle Commande. |
