---
topic: Revue accessibilité (WCAG 2.2 AA) — DESIGN.md + EXPERIENCE.md
date: 2026-10-16
relecteur: accessibilité (adversarial)
spines: DESIGN.md (draft), EXPERIENCE.md (draft), .memlog.md
---

# Revue accessibilité — KOMA SHOP (WCAG 2.2 AA)

## Verdict global

**Non conforme en l'état : à corriger avant les epics.** La base est saine : contrastes de texte sur fonds unis justes et vérifiés, règle du rouge correcte, contour des champs à 3:1, socle clavier, alt et aria-live déjà posés. Mais le système **verre dépoli + vidéo**, choisi pour l'effet « waouh », casse le contraste dans les deux thèmes. Le thème sombre est le plus touché : il descend jusqu'à 1,0:1. Le produit payant principal (vidéos de kit) n'a **aucun sous-titre**. Plusieurs garde-fous obligatoires sont encore notés [HYPOTHÈSE] alors que WCAG les exige : pause de la vidéo, lien d'évitement, taille des cibles. Sont aussi absents des spines : le code à 6 chiffres, les délais de paiement, le reflow à 320 px et les alternatives aux gestes.

| Sévérité | Nombre |
|---|---|
| critical | 2 |
| high | 8 |
| medium | 19 |
| low | 9 |

### Vérification des ratios déclarés (recalculés, formule WCAG 2.x)

Tous les ratios publiés dans `DESIGN.md` › Colors sont **exacts** : 16,01 · 6,32 · 16,01 · 7,73 · 4,61 · 4,53 · 4,81 · 6,03 · 1,24, ainsi que rouge 3,98 / 4,34 / 4,02 / 3,67 et border-field 3,64 / 3,97 / 3,72 / 3,39.

Paires supplémentaires recalculées pour cette revue :

| Paire | Ratio | Verdict |
|---|---|---|
| text-secondary / surface (crème) | 6,89 | AA |
| text-secondary / hero-wash-end #EADFCC | 5,54 | AA |
| text-secondary-dark / background-dark | 8,47 | AA |
| success-dark / surface-dark | 8,22 | AA |
| warning-dark / surface-dark | 8,88 | AA |
| danger / surface (crème) | 6,58 | AA |
| danger-dark / surface-dark | 6,10 | AA |
| #FFFFFF / tile-red-end #9E1A12 | 8,05 | AA |
| #FFFFFF / tile-ink-start #5A4C3E | 8,27 | AA |
| #FFFFFF / success #2E7A4E | 5,24 | AA |
| #FFFFFF / danger #B01B13 | 6,97 | AA |
| **#FFFFFF / success-dark #7CC49A** | **2,05** | **échec** |
| **#FFFFFF / danger-dark #F2766B** | **2,77** | **échec** |
| text-primary / halo crème (rouge 25 % sur #EADFCC) | 9,90 | AA |
| **text-secondary / halo crème** | **3,91** | **échec petit texte** |
| **rouge #E3261C / halo crème** | **2,46** | **échec même en grand** |
| **rouge #E3261C / halo sombre (40 % sur #16130F)** | **2,60** | **échec même en grand** |
| **text-primary-dark / verre sombre 6 % sur image blanche** | **1,15** | **échec** |
| **text-primary-dark / verre sombre 6 % sur #F3EEE4** | **1,00** | **échec** |
| **text-primary-dark / verre sombre 6 % sur gris moyen #888** | **2,83** | **échec** |
| text-primary / verre crème 55 % sur image noire | 5,51 | AA |
| **text-secondary / verre crème 55 % sur image noire** | **2,17** | **échec** |
| **rouge / verre crème 55 % sur image noire** | **1,37** | **échec** |
| success vs danger (différence de luminance entre états) | 1,33 | couleur seule = indiscernable |
| success vs rouge (frise : fait vs en cours) | 1,14 | couleur seule = indiscernable |
| surface / background (cartes, squelettes) | 1,09 | décoratif (acceptable si le texte identifie) |

---

## Findings

### critical

**A11Y-01 — Verre sombre à 6 % : texte illisible sur la vidéo, les photos et le contenu qui défile (1,0 à 2,8:1)**
*Où* : DESIGN.md › frontmatter `surface-glass-dark` (#F3EEE40F) ; § Elevation & Depth ; § Components (`hero`, `header`, `mobile-menu-panel`, `hero-option-tile`, `button-secondary`).
Un voile washi à 6 % ne change pratiquement pas la luminance du fond, et le flou ne change pas la luminance moyenne. En thème sombre, le texte `text-primary-dark` posé sur le panneau d'accroche du héros (mobile), sur l'en-tête collant au-dessus d'une photo produit ou sur le Panneau ☰ plein écran tombe à **1,00–2,83:1**. `text-secondary-dark` tombe à **1,04–2,17:1**. Cela touche l'accroche, le surtitre, le bouton secondaire « Le fabriquer moi-même », les rubriques du menu et le compteur du panier (1.4.3, 1.4.11).
*Fix* : définir deux niveaux de verre.
1. **Verre sur fond uni** : conserver 55 % / 6 %.
2. **Verre sur média ou contenu défilant** (héros, en-tête collant, ☰, pilules sur image) : opacité minimale **0,85** dans les deux thèmes, soit `background-dark` à 85 % en sombre et `#FFFFFF` à 85 % en crème. Calcul du minimum : il faut ≥ 0,80 pour que `text-secondary-dark` atteigne 4,5:1 sur une image blanche, et ≥ 0,81 pour que `text-secondary` crème atteigne 4,5:1 sur une image noire.
3. **Panneau ☰** : fond opaque `{colors.background}` / `{colors.background-dark}`, sans verre.

Ajouter ces tokens (`surface-glass-strong`, `surface-glass-strong-dark`). La règle de test : contraste mesuré sur l'image la plus défavorable (blanc pur et noir pur).

**A11Y-02 — Vidéos de kit (produit payant) sans sous-titres ni transcription**
*Où* : EXPERIENCE.md › Component Patterns « Lecteur vidéo à chapitres », Key Flows UJ-2 étape 6–7, Bilingue FR/EN ; DESIGN.md › Components `video-chapter-player`. Aucune mention de sous-titres.
Les tutoriels sont le cœur des Kits et ont une bande son explicative. C'est un échec des critères 1.2.2 (sous-titres, niveau A) et 1.2.5 (audiodescription, AA), pour un produit vendu. Le public visé est aussi sur réseau lent et regarde souvent sans son : les sous-titres servent tout le monde. L'extrait de la Fiche Kit est concerné aussi.
*Fix* :
- sous-titres WebVTT **FR obligatoires, EN si la page /en vend le kit**, activables dans le lecteur et réglés sur la langue de l'interface ;
- les gestes montrés et non dits sont décrits dans la narration ou dans un texte par chapitre (transcription téléchargeable avec les fichiers) ;
- l'admin refuse la publication d'une vidéo sans piste de sous-titres, comme pour l'alt (FR-50) ;
- lecteur personnalisé entièrement au clavier : lecture/pause, piste temporelle (slider ARIA), chapitres en `<button>` avec `aria-current`, bouton sous-titres.

### high

**A11Y-03 — Accroche et textes du héros en rouge ou en secondaire sur le halo et la vidéo**
*Où* : DESIGN.md › Dégradés (halo rouge 25 % / 40 %), § Components `hero` (accroche `display-brush`/`display`, surtitre `label`), Règle du rouge (« grands titres » en rouge).
Le rouge en grand texte sur le halo crème donne **2,46:1** et sur le halo sombre **2,60:1**, sous le seuil de 3:1. `text-secondary` sur le halo crème donne **3,91:1**, en échec pour le surtitre 13 px. Sur l'image de repli ou la vidéo, sans verre renforcé, le rouge descend à 1,37:1.
*Fix* : interdire le rouge en couleur de texte dans le héros et sur tout fond dégradé ou média. L'accroche passe en `text-primary` / `text-primary-dark`, et le rouge ne sert qu'à un soulignement, au sceau ou au bouton. Le surtitre passe en `text-primary`. Ajouter la ligne « Rouge texte : uniquement sur `background`/`surface` unis » à la règle du rouge.

**A11Y-04 — Vidéo du héros : bouton pause encore en [HYPOTHÈSE] (2.2.2, niveau A)**
*Où* : EXPERIENCE.md › Accessibility Floor (« bouton pause [HYPOTHÈSE] »), Interaction Primitives (« Remplacement… par sa photo [HYPOTHÈSE] »), Component Patterns « Héros vidéo ».
Une vidéo en boucle lancée automatiquement et qui dure plus de 5 s **doit** pouvoir être mise en pause. Ce n'est pas une option.
*Fix* :
- décider que le bouton Pause/Lecture est visible, atteignable au clavier, d'au moins 44 × 44 px, dans le coin du héros, avec `aria-label` traduit et un état `aria-pressed`, et que le choix est mémorisé ;
- sous `prefers-reduced-motion: reduce`, afficher la photo de repli sans charger la vidéo (décision, plus hypothèse) ;
- la vidéo porte `aria-hidden="true"` et n'a pas de piste audio. Vérifier qu'il n'y a pas plus de 3 flashs par seconde dans le montage (2.3.1) ;
- même règle pour la parallaxe, qui est coupée aussi si l'utilisateur a mis la vidéo en pause.

**A11Y-05 — Le sélecteur à deux options change de page quand on le sélectionne (3.2.2, niveau A)**
*Où* : EXPERIENCE.md › Component Patterns « Sélecteur à deux options » (« Le fabriquer moi-même… mène à sa fiche ») ; DESIGN.md `segmented-choice`.
Un contrôle présenté comme un choix (radio ou segment) qui navigue dès qu'on le sélectionne désoriente les utilisateurs de lecteur d'écran et de clavier : avec les flèches, on quitte la page sans le vouloir.
*Fix* :
- soit « Le fabriquer moi-même » est un **lien** (stylé en segment, rôle lien) ;
- soit la sélection affiche sur place un panneau « Kit lié : prix, délai » avec un lien explicite « Voir le kit ».

Pour les vrais choix (tailles, Retrait/Livraison) : `role="radiogroup"` ou des `<input type="radio">` natifs, flèches pour se déplacer, aucune action déclenchée par la seule sélection.

**A11Y-06 — Code à 6 chiffres non spécifié (3.3.8 Authentification accessible, AA)**
*Où* : EXPERIENCE.md › Arborescence « Connexion / création de Compte », State Patterns « Navigateur intégré », UJ-2 étape 3.
C'est la seule méthode de connexion dans les navigateurs intégrés. Rien n'est dit sur la saisie.
*Fix* :
- **un seul** champ `<input type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6">` avec un libellé visible. Pas de 6 cases séparées : elles cassent le collage, l'autoremplissage SMS/email et les lecteurs d'écran ;
- coller toujours permis ;
- durée de validité du code annoncée dans le texte (« valable 10 min », valeur à fixer) ;
- bouton « Renvoyer le code » ;
- erreur reliée au champ ;
- pas de soumission automatique sans annonce (si elle existe, l'annoncer en `aria-live`) ;
- l'email du code met le code en texte, pas seulement dans une image.

**A11Y-07 — États de paiement : annonces, focus et délais insuffisamment définis (4.1.3, 2.2.1, 3.3.4)**
*Où* : EXPERIENCE.md › Accessibility Floor (« aria-live polie »), Component Patterns « Écran d'attente de paiement », State Patterns (En attente / En cours de vérification / Échec / Expirée / Payée), Questions E-9.
Avec le sondage du serveur (polling), une région polie risque de répéter les annonces ou d'en manquer. L'échec ne doit pas être poli. Le délai de paiement (E-9) est une limite de temps imposée (2.2.1) : l'utilisateur doit le connaître et pouvoir relancer. Le client quitte aussi le navigateur pour valider le paiement USSD et revient sur une page qui a changé.
*Fix* :
- `role="status"` (poli) pour « Valide le paiement sur ton téléphone » et « en cours de vérification », annoncé **une seule fois par changement réel d'état**, jamais à chaque requête de sondage ;
- `role="alert"` pour l'échec ;
- au passage à « payée » ou « échec », déplacer le focus sur le titre du nouvel état (`tabindex="-1"`) ;
- afficher en texte la durée du Délai de paiement **avant** le lancement (« Tu as X min pour valider »), sans compte à rebours anxiogène ;
- après expiration, proposer de relancer en un geste sans ressaisir (voir A11Y-19) ;
- l'indicateur animé respecte `prefers-reduced-motion` ;
- le titre de page (`<title>`) reflète l'état, ce qui aide au retour depuis l'app de paiement.

**A11Y-08 — Tuiles de catégorie à 2 colonnes : débordement à 375 et 320 px (1.4.10, règle 7)**
*Où* : DESIGN.md › Layout & Spacing (« tuiles de catégorie à deux colonnes »), Components `category-tile` (titre `h2` 30 px majuscules) ; EXPERIENCE.md › Responsive (375 px).
Largeur d'une tuile à 375 px : (375 − 2 × 16 − 12) / 2 ≈ 165 px, soit environ 133 px utiles avec 16 px de padding. « ACCESSOIRES » ou « ÉVÉNEMENTS » en Barlow Condensed 700, 30 px, majuscules, occupe environ 150–165 px : **débordement ou défilement horizontal**. À 320 px (exigence de reflow WCAG) c'est pire, et à 200 % de zoom c'est impossible.
*Fix* :
- titre de tuile en `clamp(20px, 6vw, 30px)` avec `overflow-wrap: anywhere` et `hyphens: auto` (lang défini) ;
- passer à **1 colonne en dessous de 360 px** ou au zoom ≥ 200 % ;
- tester toutes les chaînes FR et EN, les plus longues d'abord ;
- ajouter « reflow à 320 px CSS sans défilement horizontal » à l'Accessibility Floor (voir A11Y-17).

**A11Y-09 — Gestes sans alternative : balayage de la galerie et pincement pour zoomer (2.5.1 A, 2.5.7 AA)**
*Où* : EXPERIENCE.md › Interaction Primitives « Gestes » ; « Tuile de galerie… ouverture en grand au toucher ».
*Fix* :
- la galerie photo de la fiche a des boutons « Photo précédente / suivante » (≥ 44 px, libellés traduits) et des vignettes atteignables au clavier, avec l'annonce « Photo 2 sur 5 » ;
- le zoom a des boutons +/− ou s'ouvre en vue agrandie ;
- ne jamais bloquer le zoom natif du navigateur (`user-scalable` interdit dans le viewport) ;
- la vue agrandie est un `dialog` modal avec libellé, piège de focus, Échap et retour du focus sur la vignette.

**A11Y-10 — Écran de Scan : couleur seule rouge/vert, texte non défini, échec en sombre**
*Où* : DESIGN.md › Components `scan-result` (« fond success / danger »), D-11 ; EXPERIENCE.md › Écran de Scan, E-14.
Le vert et le rouge sont confondus par environ 8 % des hommes (deutéranopie/protanopie) ; la différence de luminance n'est que de 1,33. La couleur du texte n'est pas spécifiée. En thème sombre, `success-dark` et `danger-dark` avec du texte blanc donnent **2,05 / 2,77:1**. Les « couleurs par Type de pass » (D-11) ajoutent une autre information transmise par la couleur seule.
*Fix* :
- l'écran de Scan force les fonds `success` #2E7A4E et `danger` #B01B13 avec texte **#FFFFFF** (5,24 / 6,97:1), quel que soit le thème. Sinon, en sombre, texte `brand-ink` sur `success-dark`/`danger-dark` (9,01 / 6,68) ;
- grand mot « VALIDE » / « REFUSÉ » et grande icône de forme différente (coche / croix) ;
- vibration ou son distinct (E-14 à trancher) ;
- le Type de pass est toujours écrit en toutes lettres en très grand, la couleur ne fait qu'accompagner ;
- résultat dans `role="alert"`.

### medium

**A11Y-11 — Anneau de focus rouge 2 px : confondu avec la sélection, invisible sur média**
*Où* : DESIGN.md `focus-ring` [HYPOTHÈSE], D-5 ; `segmented-choice.active-ring` et `payment-option-card.selected-ring` sont eux aussi rouges.
Sur les segments et les cartes de paiement, l'anneau de sélection (rouge 1,5 px) et l'anneau de focus (rouge 2 px) se ressemblent : impossible de savoir ce qui a le focus. Sur la vidéo, les photos ou le verre, le rouge peut tomber à 1,4–2,5:1.
*Fix* : anneau de focus **double**, 2 px `text-primary` (ou `text-primary-dark`) + halo 2 px `background` (contraste garanti sur tout fond), avec `outline-offset: 2px`. Appliqué par `:focus-visible` uniquement. Garder le rouge pour la sélection et ajouter une coche à l'état sélectionné.

**A11Y-12 — Focus masqué par l'en-tête collant (2.4.11 Focus non masqué, AA, nouveau en 2.2)**
*Où* : EXPERIENCE.md › En-tête « Reste visible en haut au défilement [HYPOTHÈSE] » ; bandeau « Ouvrir dans Chrome ».
*Fix* : `scroll-padding-top` égal à la hauteur de l'en-tête plus celle du bandeau ; à zoom ≥ 200 % ou en paysage bas (< 500 px de haut), l'en-tête cesse d'être collant ; le bandeau intégré ne recouvre jamais un élément focalisé.

**A11Y-13 — Mode contraste élevé (forced-colors) : sélection perdue**
*Où* : DESIGN.md `segmented-choice.active-ring: inset box-shadow`, `payment-option-card.selected-ring`, `glass-panel`.
En mode Couleurs forcées (Windows, certains Android), les `box-shadow` sont supprimés : le segment ou la carte sélectionnés deviennent identiques aux autres.
*Fix* : marquer la sélection par `border`/`outline` réels et une icône ; ajouter une règle `@media (forced-colors: active)` (bordure `Highlight`, verre remplacé par `Canvas`) ; les icônes SVG utilisent `currentColor`.

**A11Y-14 — Panneau ☰ et dialogues : piège de focus insuffisamment spécifié**
*Où* : EXPERIENCE.md › Panneau ☰, Accessibility Floor.
*Fix* :
- bouton ☰ `<button aria-expanded aria-controls>` avec libellé traduit « Menu » (pas le glyphe ☰ lu « trigramme ») ;
- à l'ouverture, focus sur le premier élément ou sur le bouton « Fermer » ;
- reste de la page en `inert` et défilement du corps bloqué ;
- Échap, ✕ (`aria-label="Fermer le menu"`) ou choix d'une rubrique ferment le panneau et **rendent le focus au bouton ☰** ;
- `<dialog>` natif ou `role="dialog" aria-modal="true"` avec `aria-labelledby` ;
- mêmes règles pour la vue agrandie de la galerie et la confirmation d'annulation.

**A11Y-15 — Lien d'évitement encore en [HYPOTHÈSE] (2.4.1, niveau A)**
*Où* : EXPERIENCE.md › Accessibility Floor (« lien Aller au contenu [HYPOTHÈSE] »).
*Fix* : décision ferme. Premier élément focalisable, visible au focus, il cible `<main id="contenu" tabindex="-1">`. Repères `header`, `nav` (avec `aria-label`), `main` et `footer` sur chaque page.

**A11Y-16 — Cibles tactiles : 44 px en [HYPOTHÈSE], plusieurs petites cibles prévues**
*Où* : EXPERIENCE.md › Accessibility Floor ; DESIGN.md « Bascule de thème / langue : pilules compactes », « Case de consentement 24 px », `rounded.sm` « puces d'information », ✕ du bandeau, chapitres, flèches de quantité des Pass.
*Fix* : décider ≥ 44 × 44 px pour toute commande isolée (valeur retenue pour un public sur téléphone d'entrée de gamme, au-delà du minimum AA 2.5.8 de 24 px). La case de 24 px est acceptable si **son libellé entier est cliquable** (`<label>`). Les liens dans un texte de consentement doivent être espacés de 24 px au minimum. Les pilules compactes thème et langue ont une zone de touche étendue à 44 px.

**A11Y-17 — Reflow et zoom : 320 px non exigé, apparitions au défilement**
*Où* : EXPERIENCE.md › Accessibility Floor (« Zoom jusqu'à 200 % »), Interaction Primitives (« apparitions au défilement »).
WCAG 1.4.10 exige 320 px CSS (équivalent à 400 % sur 1280 px). Les apparitions au défilement qui partent d'`opacity: 0` cachent le contenu si le JavaScript échoue (réseau lent en RDC) et pour la navigation par lecteur d'écran.
*Fix* :
- ajouter « reflow à 320 px sans perte ni défilement horizontal ; texte agrandi à 200 % » ;
- le contenu est **visible par défaut** dans le rendu serveur et l'apparition est une amélioration, déclenchée uniquement si JS est chargé et que le mouvement est autorisé ;
- espacement de texte (1.4.12) : aucune pilule ni carte à hauteur fixe qui couperait le texte.

**A11Y-18 — Information portée par la couleur seule : frise, chapitres, badges**
*Où* : DESIGN.md `order-timeline` (fait = success, en cours = primary, à venir = text-secondary), `video-chapter-player.chapter-active` rouge ; EXPERIENCE.md › Frise des statuts.
Fait (vert) et en cours (rouge) ont 1,14:1 de différence de luminance : indiscernables pour les daltoniens. Le rouge, couleur d'erreur, sert ici pour « en cours ». Si la date ou le libellé de l'étape courante est en rouge en petit texte, la règle du rouge est violée.
*Fix* :
- icônes distinctes (coche / point plein / cercle vide) et libellé texte (« Fait », « En cours », « À venir », masqué visuellement si besoin) ;
- `aria-current="step"` sur l'étape courante ;
- textes de la frise en `text-primary` / `text-secondary`, jamais en rouge ;
- chapitre actif : icône « en lecture » + `aria-current="true"`.

**A11Y-19 — Formulaires : autocomplete, Mesures, ressaisie, résumé d'erreurs**
*Où* : EXPERIENCE.md › Champ de formulaire, Schéma des Mesures, Étape de commande, Sélecteur pays + opérateur ; DESIGN.md `form-field`.
*Fix* :
- (1.3.5) `autocomplete` sur email, `tel`, `name`, `address-level2`, `street-address`, `country` ; `inputmode="tel"` pour le numéro mobile money, avec l'indicatif affiché en aide et un format d'exemple ;
- (3.3.7, nouveau en 2.2) téléphone, opérateur, Zone et adresse sont conservés après un échec de paiement, un « Réessayer », une connexion en cours de route ou l'expiration de la commande. Rien n'est ressaisi ;
- **Mesures** :
  - chaque champ porte le numéro du repère du schéma et l'unité (« 3. Tour de poitrine (cm) »), `inputmode="decimal"`, avec des bornes plausibles et un message en clair en cas de dépassement ;
  - les instructions de prise de mesure sont **en texte**, pas seulement dans l'illustration ;
  - l'illustration a un alt court qui renvoie à la liste ;
- (3.3.1/3.3.3) à l'envoi : résumé d'erreurs en tête (`role="alert"`, liens vers les champs), focus déplacé sur le résumé, chaque erreur dit comment corriger ;
- valider à la perte de focus seulement quand le champ a été modifié, pour éviter les erreurs prématurées pendant une simple navigation au clavier ;
- (3.3.4) le récapitulatif avant paiement et la confirmation des Mesures Sur-mesure sont des étapes de vérification explicites (déjà présentes, à rendre obligatoires) ;
- pas de placeholder utilisé comme libellé ; si un placeholder existe, contraste ≥ 4,5:1 ;
- corriger l'incohérence de DESIGN.md › Components « Champ de formulaire » : « filet `text-secondary` [HYPOTHÈSE] » doit devenir `border-field`.

**A11Y-20 — Bouton principal désactivé : la raison est inatteignable au clavier**
*Où* : EXPERIENCE.md › Bouton principal, Mesures incomplètes ; DESIGN.md « Désactivé : opacité réduite ».
Un `<button disabled>` sort de l'ordre de tabulation : la raison affichée « à côté » n'est pas associée au bouton. Le rouge à 50 % avec du blanc tombe à 2,48:1 (toléré pour un état désactivé, mais illisible).
*Fix* : `aria-disabled="true"` (le bouton reste focalisable) + `aria-describedby` vers la raison. Au clic, l'action est refusée et le focus va au premier champ manquant. Remplacer l'opacité par un fond `surface` avec bordure `border-field` et texte `text-secondary` (≥ 4,5:1), pour que le libellé reste lisible.

**A11Y-21 — Cartes entièrement cliquables : noms de lien verbeux, liens imbriqués**
*Où* : EXPERIENCE.md › Carte produit (« Toute la carte est un lien »), Tuile d'option du héros, Carte Événement.
Envelopper toute la carte dans `<a>` produit un nom de lien qui lit image, prix, badge et délai, et interdit des liens ou boutons internes (partage, Kit lié).
*Fix* : le lien porte sur le **titre** (`h3 > a`), étendu à toute la carte par un pseudo-élément. L'image est décorative (`alt=""`) si le titre la nomme déjà, sinon son alt est descriptif. Le prix et le badge restent du texte lu après le titre.

**A11Y-22 — Langue des passages (3.1.2) et noms de langue**
*Où* : EXPERIENCE.md › Bilingue FR/EN (« Sakura Town convient à beaucoup de titres anglais ») ; DESIGN.md (katakana コマ, hanko) ; Voice and Tone (nakama, WIP, props).
*Fix* :
- `lang` sur `<html>` selon /fr ou /en (déjà prévu) ;
- **`lang="en"` sur tout titre ou passage anglais affiché dans une page /fr** (et inversement) ;
- les liens du sélecteur de langue sont écrits dans leur propre langue (« English » avec `lang="en"`, « Français » avec `lang="fr"`) et portent `hreflang` ;
- alt du logo : « KOMA SHOP » (le katakana コマ n'est pas lu, ou porte `lang="ja"` s'il est exposé) ;
- ne jamais exposer de mot japonais sans `lang="ja"`.

**A11Y-23 — Emojis et glyphes lus par les lecteurs d'écran**
*Où* : EXPERIENCE.md › Voice and Tone (« quelques emojis ») ; boutons ☰ et ✕.
TalkBack et VoiceOver lisent le nom de chaque emoji (« visage qui pleure de rire ») et les glyphes (« trigramme du ciel », « multiplication »).
*Fix* :
- jamais d'emoji dans un titre, un libellé de bouton ou de lien, ni dans un nom accessible ;
- en vitrine, au plus un emoji par phrase, en fin de phrase, enveloppé dans `<span aria-hidden="true">` s'il est décoratif ;
- jamais d'emoji pour porter seul une information ;
- les boutons ☰ et ✕ ont un `aria-label` traduit, et le glyphe ou l'icône est `aria-hidden` ;
- vérifier les objets d'email marketing : les emojis y sont lus aussi.

**A11Y-24 — Lisibilité de Sakura Town et des capitales condensées**
*Où* : DESIGN.md › Typography (`display-brush`, `label` 13 px +0,14 em, tous les rôles en majuscules).
Un pinceau irrégulier gêne les lecteurs dyslexiques ou malvoyants. Des majuscules condensées sur plusieurs lignes ralentissent la lecture. Un `label` à 13 px est petit pour un téléphone moyen. Si les majuscules sont tapées dans les fichiers de traduction, certains lecteurs d'écran épellent les mots (« K-I-T-S »).
*Fix* :
- Sakura Town limitée à **1 à 4 mots**, ≥ 40 px, jamais sur un lien, un bouton, un prix ou une information indispensable ;
- toujours du **texte HTML réel**, jamais une image ou un SVG de texte ;
- `font-display: swap` avec repli métrique Barlow Condensed pour éviter le décalage de mise en page ;
- majuscules **uniquement** par `text-transform: uppercase`, les traductions restent en casse normale ;
- `label` à 14 px minimum ;
- jamais plus de 3 lignes de texte en majuscules condensées ;
- l'italique 800 est réservé à l'accroche.

**A11Y-25 — Code QR des Pass : alternative et robustesse**
*Où* : DESIGN.md `pass-card` (QR sur fond blanc) ; EXPERIENCE.md › Pass, Mes Pass.
*Fix* :
- alt du QR : « Code QR du Pass {Type} de {Nom}, {Événement} » ;
- **code alphanumérique court lisible** affiché sous le QR, saisissable à la main par le bénévole (utile aussi si la luminosité de l'écran est faible ou si le QR est abîmé) ;
- zone de silence de 4 modules, taille minimale ≈ 200 px ;
- bouton « Agrandir », avec suggestion d'augmenter la luminosité ;
- même alt et même code dans l'email.

**A11Y-26 — Annonces manquantes : panier, copie de lien, filtres**
*Où* : EXPERIENCE.md › En-tête (compteur du panier), Bouton de partage (« copie du lien »), Catalogues (filtres et tri).
*Fix* :
- le bouton panier a pour nom « Panier, 2 articles » ;
- l'ajout au panier est confirmé par `role="status"` (« Ajouté au panier ») sans déplacer le focus ;
- « Lien copié » est annoncé ;
- filtrer ou trier annonce « 12 produits » et ne recharge pas la page sans prévenir ;
- les squelettes portent `aria-busy="true"` sur la région, et un texte masqué « Chargement… » est disponible.

**A11Y-27 — Verre crème 55 % sur média : texte secondaire et rouge en échec**
*Où* : DESIGN.md `surface-glass` ; `hero-option-tile` (ordinateur), pilules sur image, tuile de galerie (« sur voile », opacité non définie).
Sur une image sombre, `text-secondary` donne 2,17:1 et le rouge 1,37:1 (le texte principal tient à 5,51).
*Fix* : le même niveau « verre fort » que A11Y-01 s'applique dès que le verre recouvre une photo ou une vidéo. Le voile de la tuile de galerie est défini : `brand-ink` à 60 % minimum sous du texte blanc (≥ 5,9:1 même sur photo blanche), ou un bandeau `surface` opaque.

**A11Y-28 — Sélecteur pays et opérateur : listes dépendantes et logos**
*Où* : EXPERIENCE.md › Sélecteur pays + opérateur ; DESIGN.md (logos d'opérateurs [HYPOTHÈSE]).
*Fix* :
- `<select>` natifs avec libellés ;
- changer de pays réinitialise l'opérateur, ce qui est annoncé (`role="status"` : « 3 opérateurs disponibles ») ;
- aucune soumission ni navigation au changement (3.2.2) ;
- les logos d'opérateurs sont accompagnés du **nom en texte** et sont décoratifs (`alt=""`) ;
- le message « couple non couvert » est relié au champ opérateur.

**A11Y-29 — Critère de validation trop faible : « Lighthouse ≥ 90 »**
*Où* : EXPERIENCE.md › Accessibility Floor (NFR-2).
Lighthouse détecte environ 30 à 40 % des problèmes et ne voit ni le verre sur la vidéo, ni le focus, ni les annonces.
*Fix* : ajouter aux critères d'acceptation de chaque story d'interface :
- axe-core sans violation (tests e2e) ;
- passage clavier seul ;
- test **TalkBack sur Android** (dominant en RDC) et VoiceOver iOS, y compris dans le navigateur intégré d'Instagram ;
- vérification à 320 px, à 200 % de zoom, en `prefers-reduced-motion` et en `forced-colors` ;
- contraste mesuré sur les cas extrêmes du verre.

### low

**A11Y-30 — Bandeau « Ouvrir dans Chrome »** (EXPERIENCE.md › Bandeau d'information) : `role="region"` avec libellé (pas `alert`, il n'est pas urgent) ; bouton de fermeture « Fermer le bandeau » ≥ 44 px ; après fermeture, focus sur l'élément suivant logique ; le choix est mémorisé.

**A11Y-31 — Boutons « Télécharger » répétés** (DESIGN.md › Ligne de fichier de kit) : nom accessible complet, par exemple « Télécharger Patron A4 (PDF, 2,4 Mo) » ; la taille du fichier est affichée, ce qui est utile sur réseau lent ; l'état « préparation du lien… » est annoncé pendant la génération du lien signé.

**A11Y-32 — Bascule de thème** (EXPERIENCE.md › Bascule de thème) : `<button aria-pressed>` ou libellé d'état (« Thème sombre : activé ») ; premier affichage sans flash de thème (script en ligne avant le rendu). Option : respecter `prefers-color-scheme` à la première visite (décision produit, pas une exigence WCAG).

**A11Y-33 — Hiérarchie des titres et H1 du héros** (EXPERIENCE.md › Un seul H1) : sur l'accueil, l'accroche du héros est le H1 en texte réel, même quand elle est en Sakura Town ; les titres de section sont en H2 ; les noms de produit sur carte en H3 ; les questions FAQ sont des `<button aria-expanded>` dans des H3.

**A11Y-34 — Accordéon FAQ « une question ouverte à la fois »** (EXPERIENCE.md, [HYPOTHÈSE]) : fermer automatiquement la question précédente déplace le contenu et désoriente au zoom. Préférer des accordéons indépendants. `<details>/<summary>` natifs conviennent.

**A11Y-35 — Admin** (EXPERIENCE.md › Admin) : les graphiques de paiement ont un tableau de données équivalent ; les Cartes de tâche admin portent un nom de lien complet (« 3 Mesures à vérifier ») ; le téléversement annonce sa progression (`role="progressbar"` avec valeur) ; mêmes règles clavier et focus que la vitrine.

**A11Y-36 — Mouvement résiduel** (EXPERIENCE.md › Interaction Primitives) : l'élévation des cartes au survol (−4 px) est acceptable mais coupée en mouvement réduit (déjà prévu) ; aucune transition de plus de 5 s ni défilement automatique (carrousel) sans pause ; l'indicateur d'attente de paiement est statique en mouvement réduit.

**A11Y-37 — Motifs manga** (DESIGN.md › Motifs manga, D-10) : opacité ≤ 6 % confirmée, jamais derrière un texte de petite taille. Vérifier que le contraste du texte reste ≥ 4,5:1 sur la zone la plus dense de la trame.

**A11Y-38 — Marge de contraste serrée** (DESIGN.md › Contrastes) : `success` sur `background` = 4,53:1, soit 0,03 au-dessus du seuil. Ne jamais l'afficher en petit texte sur verre ni sur `hero-wash-end`, ni avec une opacité réduite. Préférer `surface` (4,94). Note : `rouge` sur `surface-dark` (3,67) suffit en grand texte, mais pas pour un trait fin de moins de 3 px utilisé comme seul indicateur.

---

## Ce qui est déjà bien (ne pas régresser)

- Ratios publiés exacts ; texte blanc sur le rouge (4,61) ; rouge réservé au grand texte ; `border-field` ≥ 3:1 dans les deux thèmes.
- Erreurs reliées par `aria-describedby`, état transmis par icône + texte (Message d'état), alt obligatoire avec refus de publication sans alt.
- Garde-fous de mouvement validés, aucune animation bloquante, urgence artificielle interdite (pas de compte à rebours).
- Un seul H1, `lang` par route, bandeau du navigateur intégré non bloquant, cases jamais pré-cochées.
