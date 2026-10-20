---
title: "PRD — KOMA SHOP"
status: final
created: 2026-10-16
updated: 2026-10-20
---

# PRD : KOMA SHOP

## 0. Objet du document

Ce PRD décrit ce que KOMA SHOP (domaine à acheter, Q-D1) doit faire le jour de son lancement public, puis dans les semaines qui suivent. Il s'adresse à Jonathan (créateur et décideur) et aux agents BMad suivants : UX (`bmad-ux`), architecture (`bmad-architecture`), découpage en epics et stories. Il s'appuie sur le brief produit du 2026-10-15 (`_bmad-output/planning-artifacts/briefs/brief-KOMA SHOP-2026-10-15/`) et sur `docs/guide-koma-shop.md`, sans les recopier. **En cas de contradiction, ce PRD fait foi**, car il intègre les décisions de Jonathan du 2026-10-16 (paiement, événements, blog, codes promo), qui figurent aussi dans `CLAUDE.md`.

Les termes du Glossaire (§3) sont employés tels quels dans tout le document. Les fonctionnalités sont regroupées en §4, avec des exigences numérotées FR-1 à FR-59. Les hypothèses formulées pendant la rédaction ont toutes été confirmées par Jonathan le 2026-10-16 ; elles sont listées en §12. Les montants (prix, forfaits, frais) et les délais ne figurent jamais ici : ils sont saisis dans l'admin.

## 1. Vision

Un otaku de Goma qui veut incarner son personnage a deux mauvaises options : commander un costume sur AliExpress (45 à 80 USD, 45 à 50 jours d'attente, souvent trop tard pour le festival) ou le fabriquer seul, sans patron ni méthode. KOMA SHOP lui offre deux bonnes options sur la même fiche : **le porter**, un Cosplay fait main à Goma et remis à Goma ou à Bukavu, ou **le fabriquer soi-même**, avec un Kit numérique (patrons imprimables, fichiers 3D et tutoriel vidéo complet, accessible à vie).

KOMA SHOP ne vend pas d'abord un produit : **il vend la fierté de devenir son personnage**. Le visiteur trouve le site si beau qu'il a envie de fabriquer son cosplay. Il est fier de partager sa passion, et il gagne en notoriété auprès de ses amis quand sa photo apparaît sur le mur « Ils le portent ». Le site entretient cette communauté grâce à un blog de guides (Articles) et à une section Événements, où l'on achète son Pass pour la prochaine rencontre cosplay à Goma.

Le **Kit est le cœur du projet** : il se vend sans limite, partout, et ne consomme pas le temps de fabrication du créateur ; le prêt-à-porter le complète pour Goma et Bukavu. KOMA SHOP ne part pas de zéro : Jonathan anime déjà un groupe WhatsApp de plus de 170 otakus actifs et a co-organisé un festival à Goma, où un cosplay s'est vendu autour de 30 USD et un accessoire 1,5 à 2 USD. Ce groupe et ce festival sont les premiers canaux du lancement, avant la publicité et les influenceurs.

Le paiement suit la réalité africaine. Le mobile money passe d'abord par plusieurs Agrégateurs, pour couvrir le plus grand nombre de pays et d'opérateurs et pour qu'une panne n'arrête pas les ventes. La carte bancaire permet ensuite de vendre les Kits à l'international.

## 2. Utilisateurs cibles

### 2.1 Jobs To Be Done

- **Incarner son personnage** pour un festival, un shooting ou son quartier, sans attendre 50 jours ni payer le prix d'un import.
- **Pouvoir dire « c'est moi qui l'ai fait »** : apprendre une technique (mousse, patron, impression 3D) avec un petit budget.
- **Être vu et reconnu** par ses amis et la communauté otaku : Galerie, partage WhatsApp, Événements.
- **Payer simplement** avec son mobile money, ou par carte depuis l'étranger.
- **Retrouver la communauté en vrai** : participer à un Événement, tenir un stand, exposer.
- **Pour Jonathan** : vendre sans y passer ses nuits. Un seul créateur, des délais tenus, une admin qui lui montre l'essentiel dès le matin.

### 2.2 Non-utilisateurs (lancement)

- Les clients qui veulent un produit physique livré **hors de Goma et Bukavu** : ils se voient proposer le Kit à la place.
- Les revendeurs et les commandes en gros.
- Les personnes qui cherchent des produits sous licence officielle d'une franchise.

### 2.3 Parcours utilisateurs

Les montants et délais affichés dans ces parcours viennent toujours de la fiche produit et de l'admin.

**UJ-1. Grâce, à Bukavu, commande un cosplay sur mesure.**
Grâce voit une vidéo de fabrication sur TikTok et arrive sur la fiche du cosplay depuis son téléphone. Elle hésite entre « Prêt à porter » et « Le fabriquer moi-même », puis choisit « Prêt à porter », en Sur-mesure, et saisit ses Mesures à l'aide du schéma. Comme elle habite Bukavu, la livraison est obligatoire et payante (forfait Bukavu). À Goma, elle aurait pu choisir entre retrait gratuit et livraison payante. Elle écrit son adresse dans un champ libre. Le Panier affiche le prix, le forfait Bukavu et le délai total (fabrication + livraison). Avant de payer, elle crée son Compte et revient à son Panier. Elle paie par M-Pesa : le serveur choisit l'agrégateur prioritaire qui couvre RDC + M-Pesa, et en propose un autre s'il échoue. Elle valide sur son téléphone.
Avant de couper le tissu, Jonathan vérifie ses Mesures. En cas de doute, il la contacte et corrige lui-même les Mesures dans l'admin ; il complète aussi l'adresse si besoin. Grâce reçoit un email à chaque étape : payée, en fabrication, expédiée (avec le numéro de suivi s'il existe), livrée. Pendant l'attente, elle pose une question via le bouton WhatsApp de la page de suivi.
À la livraison, on l'invite à partager une photo, par WhatsApp ou sur le site. Elle donne son accord explicite et choisit d'afficher ou non son prénom (ou pseudo) et sa ville. Jonathan valide la photo avant publication, et Grâce peut en demander le retrait à tout moment.
**Cas limite :** si elle avait voulu annuler, elle aurait pu le faire seulement avant le début de la fabrication.

**UJ-2. Patrick, étudiant à Kinshasa, achète un kit.**
Patrick a peu de budget. Il découvre KOMA SHOP par une publicité ou par un influenceur qui lui donne son Code promo. Il met un Kit dans son Panier sans Compte. Avant de payer, il crée son Compte en quelques secondes avec un code reçu par email, et revient exactement là où il en était. Le Code promo lui donne une réduction en pourcentage, valable sur ce premier achat. Il paie par Airtel Money. Le Kit s'ouvre aussitôt dans « Ma bibliothèque ». Il télécharge les patrons en A4, autant de fois qu'il veut, même après avoir changé de téléphone. Il regarde la Vidéo de kit en ligne, chapitre par chapitre ; la qualité s'adapte à sa connexion lente. Le lendemain, il reprend là où il s'était arrêté.
S'il y a consenti, il reçoit une Relance tous les 2 à 3 jours pendant 90 jours au plus, qui l'invite à revenir. Chaque Relance contient un lien de désinscription. Une fois son cosplay terminé, il envoie sa Réalisation. S'il fait partie des 10 premiers Comptes à le faire, il gagne un Pass gratuit pour l'Événement.

**UJ-3. Amina, depuis l'étranger, paie un kit par carte.**
Amina vit hors d'Afrique et n'a pas de mobile money. Elle repère un Accessoire, mais la fiche la prévient avant l'ajout au Panier que les Produits physiques ne sont remis qu'à Goma et Bukavu, et lui propose le Kit correspondant. Elle achète le Kit et le paie par carte via Polar, puisque son Panier est un Panier 100 % numérique.

**UJ-3b. Un client de Goma paie un panier mixte par carte.**
Un client de Goma met un Kit et un Accessoire dans le même Panier et choisit la carte. Comme ce Panier mixte contient un Produit physique, Polar n'apparaît pas parmi les choix : la carte passe par K-Pay.

**UJ-4. Kevin, 19 ans, à Goma, découvre KOMA SHOP par la page d'accueil.**
Kevin regarde des animes de samouraïs et de chasseurs de démons depuis le lycée. Un soir, sur Instagram, il voit une pub de 6 secondes : un plastron en mousse découpé, peint, puis porté. Il clique. Le site ne nomme jamais la franchise et n'affiche aucune image officielle : Kevin reconnaît de lui-même l'ambiance qu'il aime dans les créations de Jonathan.
*Les 3 premières secondes.* Une vidéo courte, en boucle et sans son, remplit l'écran : les mains de Jonathan découpent, peignent, ajustent, puis le costume fini apparaît, porté en pleine lumière, de face, la cape en mouvement. Par-dessus, une phrase : « Deviens ton personnage. » Dessous, deux boutons : « Prêt à porter » et « Le fabriquer moi-même ». Kevin se demande : « C'est fait ici ? À Goma ? » La surprise laisse place à l'envie.
*Il fait défiler la page.* Il découvre le même costume sur deux colonnes, porté (avec son prix et son délai) ou en pièces sur l'établi (avec le prix du Kit) ; puis les Cosplays prêts à porter (« Fait main à Goma ») ; les Kits ; « Ils le portent », la Galerie des vrais clients (« Moi aussi, je veux être sur ce mur ») ; le prochain Événement avec « Me prévenir » ; Jonathan à l'atelier, en trois phrases ; les guides ; une FAQ courte.
*Le moment où il craque.* Il clique sur « Le fabriquer moi-même » : le prêt-à-porter le fait rêver, mais son budget est serré, et le Kit lui promet qu'il pourra dire « c'est moi qui l'ai fait ».
*Ensuite.* Il est dans le navigateur intégré d'Instagram ; le site l'invite à ouvrir la page dans Chrome, et sinon lui propose le code par email. Il achète un Kit payant par mobile money. Il partage la fiche dans le groupe WhatsApp de ses amis ; l'aperçu montre la grande photo et le titre. Il clique sur « Me prévenir » pour le prochain Événement. À l'Événement, il porte son costume, envoie sa photo, et elle apparaît dans « Ils le portent ».
*Le jour du lancement*, le bloc Kit gratuit et la Galerie restent masqués tant qu'ils n'ont pas de vrai contenu. À partir de la 5ᵉ semaine, Kevin aurait pu commencer par le Kit gratuit.

**UJ-5. Divine, 23 ans, à Goma, achète des pass pour l'événement.**
Divine apprend qu'un Événement se prépare, par l'Alerte événement « Me prévenir », le blog, Instagram ou une affiche. La page de l'Événement lui donne la date, le lieu, le programme et des photos. Elle compare les trois Types de pass : Standard (entrée simple, peu d'avantages), VIP (entrée avec des avantages en plus) et Stand (exposants, vendeurs, artistes ; valable pour deux personnes). Elle veut présenter ses dessins : elle prend un Pass Stand pour elle et son aide, et un Pass Standard pour sa sœur. Son Pass reprend les informations de son Compte ; elle saisit le nom de son aide et celui de sa sœur. Elle accepte la mention sur la publication des photos et vidéos de l'Événement. Elle paie à part, par mobile money ou par carte via K-Pay. Elle reçoit aussitôt par email ses trois Pass nominatifs, chacun avec son Code QR, et les retrouve dans son profil. C'est elle qui les transmet.
Le jour J, un bénévole scanne chaque Code QR à l'entrée. L'écran affiche le Type de pass. Divine reçoit le bracelet des stands et on l'oriente vers l'espace exposants ; les Pass Standard et VIP ont leur propre bracelet. Un Pass déjà scanné est refusé. Après l'Événement, Divine reçoit un email avec le lien de la Galerie d'événement (Google Drive ou Google Photos) et peut demander le retrait d'une photo.
**Cas limite :** jusqu'à 48 h avant l'Événement, elle aurait pu annuler un Pass et demander son remboursement. Jonathan valide chaque demande, et un pourcentage de frais est retenu.

**UJ-6. Jonathan gère la boutique depuis l'admin.**
Le matin, Jonathan ouvre l'admin. Il voit d'abord les nouvelles Commandes payées, puis les graphiques de paiement et les tâches en attente : Mesures à vérifier, demandes d'annulation, de remboursement ou de remplacement, photos à valider. Il vérifie les Mesures d'une Commande Sur-mesure, contacte la cliente en cas de doute, et fait avancer les Commandes. Il ajoute un Cosplay et son Kit lié, publie un Article, crée un Événement avec ses trois Types de pass, crée un Code promo pour un influenceur et consulte les ventes et la commission de ce Code promo. La veille de l'Événement, il crée un Accès bénévole d'une journée.
Plus tard, deux Assistants l'aideront avec un rôle restreint (FR-53).

## 3. Glossaire

- **Famille** — catégorie d'un Produit : `cosplay`, `accessoire` ou `kit`. Le Pass n'est pas une Famille de produit (voir Pass).
- **Produit physique** — Produit de famille `cosplay` ou `accessoire`. Remis à Goma ou à Bukavu uniquement.
- **Cosplay** — costume complet fait main. Vendu en taille standard (XS à XXL) ou en Sur-mesure, en stock ou en Fabrication sur commande. Peut être lié à un Kit.
- **Accessoire** — perruque, arme factice, masque, armure, bijou ou objet de scène, fait main.
- **Kit** — Produit numérique : Fichiers de kit et Vidéo de kit en chapitres, accès à vie. Ne se livre pas ; vendu dans tous les pays.
- **Kit lié** — Kit associé à un Cosplay ou à un Accessoire. La fiche d'un Cosplay qui a un Kit lié propose « Prêt à porter » et « Le fabriquer moi-même » ; la fiche d'un Produit physique propose son Kit lié aux visiteurs hors Zone de remise ou quand le Plafond de fabrication est atteint.
- **Kit gratuit** — Kit à 0 USD, disponible 4 semaines après le lancement (§6.2).
- **Fichiers de kit** — PDF (A4 et US Letter), SVG, STL. Stockés dans le bucket privé `kits-private`.
- **Vidéo de kit** — tutoriel complet découpé en chapitres, lu en ligne uniquement.
- **Bibliothèque** — espace du Compte (« Ma bibliothèque ») où s'ouvrent les Kits achetés.
- **Sur-mesure** — option de Cosplay pour laquelle le client saisit ses Mesures.
- **Mesures** — valeurs saisies par le client avec le schéma d'aide, vérifiées par l'Admin avant fabrication.
- **Fabrication sur commande** — Produit physique fabriqué après paiement, avec un Délai de fabrication.
- **Délai de fabrication** — fixé par produit ou variante dans l'admin, affiché avant paiement.
- **Plafond de fabrication** — nombre maximal de pièces fabriquées sur commande en cours (réservées par une Commande en attente, payées ou en fabrication), réglé dans l'admin. Les pièces vendues en stock n'y comptent pas.
- **Zone de remise** — Goma ou Bukavu. Les seules au lancement.
- **Mode de remise** — `retrait` (gratuit, à Goma uniquement) ou `livraison` (payante, Forfait de livraison).
- **Forfait de livraison** — montant fixe par Zone de remise, réglé dans l'admin.
- **Panier** — sélection d'articles, possible sans Compte. Un Panier ne contient jamais de Pass.
- **Panier 100 % numérique** — Panier qui ne contient que des Kits.
- **Panier mixte** — Panier qui contient au moins un Produit physique et au moins un Kit.
- **Compte** — compte client. Créé sans achat ou juste avant le paiement ; obligatoire pour payer. Réservé aux personnes de 13 ans et plus.
- **Compte mineur** — Compte dont le titulaire a moins de 18 ans, d'après l'âge déclaré à la création. Soumis à des protections propres (FR-12, FR-40).
- **Capacité** — nombre maximal de personnes pour un Événement, facultatif, réglé dans l'admin. Un Pass Stand compte pour deux.
- **Commande** — achat payé ou en attente de paiement. Porte un Statut de commande, le Prestataire utilisé, la Référence de transaction, le montant et la devise.
- **Statut de commande** — `en attente` → `payée` → `en fabrication` → `expédiée` → `livrée` ; plus `échouée` (aucune Tentative de paiement n'a abouti), `expirée` (Délai de paiement dépassé), `annulée`, `remboursée` (argent effectivement rendu, preuve à l'appui) et `offerte` (Commande à 0 USD créée par le serveur, sans Prestataire). Une Commande issue d'un Panier 100 % numérique passe de `payée` (ou `offerte`) à `livrée`. Un Produit physique en stock passe directement de `payée` à `expédiée`. Pour un retrait à Goma, une Commande `expédiée` s'affiche « Prête à retirer » côté client, sans statut supplémentaire. Dans l'admin, aucun statut ne revient en arrière.
- **Tentative de paiement** — un essai de paiement d'une Commande auprès d'un Prestataire, avec sa propre Référence de transaction. Une Commande peut avoir plusieurs Tentatives de paiement, mais une seule aboutit.
- **Délai de paiement** — durée, réglée dans l'admin, pendant laquelle une Commande `en attente` réserve son stock et sa place dans le Plafond de fabrication.
- **Trop-perçu** — paiement réussi reçu pour une Commande déjà payée, expirée ou impossible à honorer. Toujours signalé à l'Admin pour remboursement.
- **Prestataire** — service de paiement : un Agrégateur mobile money ou Polar.
- **Agrégateur** — PawaPay, K-Pay, MaishaPay ou GeniusPay.
- **Adaptateur** — module qui branche un Prestataire sur la couche de paiement commune.
- **Couverture** — couples pays-opérateur qu'un Agrégateur sait encaisser.
- **Ordre de priorité** — ordre des Agrégateurs réglé dans l'admin, utilisé pour choisir et pour basculer.
- **Notification de paiement** — message serveur à serveur d'un Prestataire annonçant le résultat d'un paiement.
- **Référence de transaction** — identifiant du paiement chez le Prestataire ; ne valide jamais deux Commandes.
- **Événement** — rencontre organisée par KOMA SHOP (convention, shooting), avec sa page, ses Types de pass et sa Galerie d'événement.
- **Pass** — droit d'entrée nominatif, numérique, unique, avec un Code QR. Acheté à part, jamais dans un Panier de produits.
- **Type de pass** — `Standard` (entrée simple), `VIP` (entrée avec avantages), `Stand` (exposant, vendeur, artiste ; donne deux Pass nominatifs). Prix et avantages fixés par Événement.
- **Statut de pass** — `valide` → `scanné` ; plus `annulé` (annulation validée) et `remboursé` (argent effectivement rendu). Un Pass offert est `valide` dès son émission.
- **Code QR** — code unique d'un Pass, scanné une seule fois à l'entrée.
- **Verrou hors ligne** — autorisation, prise en ligne avant la coupure, qui désigne le seul appareil autorisé à scanner hors ligne pour un Événement.
- **Licence de kit** — droit d'usage personnel d'un Kit : ni revente, ni partage, ni diffusion des Fichiers de kit ou de la Vidéo de kit.
- **Accès bénévole** — accès temporaire réservé au Scan, valable le jour de l'Événement seulement.
- **Scan** — contrôle d'un Code QR à l'entrée ; affiche le Type de pass ou un refus.
- **Galerie** — mur « Ils le portent » : photos de vrais clients en costume, publiées avec leur accord après validation.
- **Réalisation** — photo d'un cosplay fabriqué avec un Kit acheté sur KOMA SHOP, envoyée par son auteur.
- **Galerie d'événement** — album public hors du site (Google Drive ou Google Photos) dont le lien est saisi dans l'admin.
- **Alerte événement** — inscription « Me prévenir » par email, par Compte ou par numéro WhatsApp.
- **Article** — publication du blog (guides, annonces).
- **Code promo** — code d'affiliation : réduction en pourcentage, premier achat uniquement, plafond d'utilisations, commission calculée pour l'affilié.
- **Affilié** — influenceur ou ambassadeur à qui un Code promo est attribué. N'a pas de compte dans l'admin.
- **Email commercial** — tout email non indispensable à une Commande ou à un Pass : Relance, panier abandonné, rappel de Kit, nouveau produit. Toujours avec consentement et lien de désinscription ; un seul tous les 2 jours au plus, tous types confondus.
- **Relance** — Email commercial envoyé tous les 2 à 3 jours, pendant 90 jours au plus après un achat.
- **Admin** — Jonathan ; tous les droits.
- **Assistant** — rôle restreint de l'admin (FR-53), après le lancement.

## 4. Fonctionnalités

### 4.1 Page d'accueil et vitrine

**Description :** la page d'accueil vend la fierté de devenir son personnage. Elle doit frapper dès le premier regard sur un téléphone, y compris dans le navigateur intégré d'Instagram, et mener en un geste vers « Prêt à porter » ou « Le fabriquer moi-même ». Réalise UJ-4.

#### FR-1 : Héros vidéo
Le visiteur voit, dès l'arrivée, un héros plein écran : vidéo courte en boucle, sans son, montrant la fabrication puis le costume porté ; la phrase « Deviens ton personnage. » ; les boutons « Prêt à porter » et « Le fabriquer moi-même ». Réalise UJ-4.
- Le héros s'affiche en moins de 2,5 s sur un téléphone moyen, en 4G, dans le navigateur intégré d'Instagram.
- Si la vidéo ne peut pas se charger à temps ou n'est pas prise en charge, une photo plein écran la remplace.
- La vidéo et la photo sont choisies dans l'admin et proviennent uniquement des créations de Jonathan.
- Le héros met en avant un Cosplay précis, choisi dans l'admin : « Prêt à porter » mène à sa fiche (option « Prêt à porter » présélectionnée), « Le fabriquer moi-même » à son Kit lié.

#### FR-2 : Blocs de la page d'accueil
Le visiteur trouve, dans cet ordre : (1) « Porte-le ou fabrique-le », le même costume sur deux colonnes, porté avec son prix et son délai, et en pièces avec le prix du Kit ; (2) les Cosplays prêts à porter, « Fait main à Goma » ; (3) les Kits, avec le Kit gratuit en évidence quand il existe ; (4) la Galerie « Ils le portent », avec prénom et ville quand ils sont autorisés ; (5) « Rendez-vous otaku », le prochain Événement avec « Me prévenir » ; (6) « Jonathan et son atelier », le créateur en trois phrases ; (7) les guides (Articles) ; (8) une FAQ courte (paiement, livraison, délais). Réalise UJ-4.
- Un bloc sans contenu réel est masqué : Kit gratuit absent, Galerie vide, aucun Événement à venir, aucun Article.
- Aucun bloc n'affiche de contenu inventé : avis, chiffres, clients ou logos (règle 5).
- La Galerie n'a pas de page dédiée : tout lien vers la Galerie mène au bloc 4 de l'accueil (ancre `#galerie`).
- Les grands titres de la vitrine s'écrivent sans accent et en majuscules (contrainte de la police d'affichage, §10).

#### FR-3 : Navigateur intégré
Quand le visiteur ouvre le site dans le navigateur intégré d'une application (Instagram, Facebook, TikTok…), le site l'invite à « Ouvrir dans Chrome » (ou dans le navigateur du téléphone) sans bloquer la navigation. Réalise UJ-4.
- Le bouton de connexion Google est masqué dans ces navigateurs (voir FR-12).

#### FR-4 : Pages vitrines
Le visiteur accède aux pages À propos, FAQ, Contact (formulaire + bouton WhatsApp) et aux pages légales (mentions légales, CGV, livraison et retours, confidentialité). La page À propos s'intitule « Jonathan et son atelier ». Les textes légaux sont fournis par Jonathan (§11, Q-5).

**Exigences propres :** aucune image ni aucun nom de franchise sur tout le site (règle 6). Les héros de chaque page reprennent la direction visuelle (§10).

### 4.2 Catalogue et fiches produits

**Description :** catalogues par Famille, fiches qui montrent tout ce qu'il faut savoir avant de payer (prix, délai, remise), et double option « Prêt à porter / Le fabriquer moi-même » pour un Cosplay qui a un Kit lié. Réalise UJ-1, UJ-3, UJ-4.

#### FR-5 : Catalogues
Le visiteur parcourt les catalogues Cosplays, Accessoires et Kits, les filtre (univers, prix, disponibilité, niveau pour les Kits) et les trie (nouveauté, prix). Seuls les Produits publiés apparaissent ; un brouillon est introuvable (catalogue, plan du site, URL directe).

#### FR-6 : Fiche d'un Produit physique
Le visiteur voit une galerie de photos (zoom sur mobile), le titre, le prix en USD, la description, les tailles (XS à XXL) ou le Sur-mesure, la disponibilité (« En stock » ou « Fabrication sur commande » avec le Délai de fabrication), les Modes de remise et Forfaits de livraison, et le délai total (fabrication + remise).
- Avant l'ajout au Panier, la fiche indique : « Remise uniquement à Goma et Bukavu », et propose le Kit lié s'il existe. Ce message est affiché à tous les visiteurs, sans détection de leur pays. Réalise UJ-3.

#### FR-7 : Double option Cosplay / Kit lié
Sur la fiche d'un Cosplay qui a un Kit lié, le visiteur choisit « Prêt à porter » ou « Le fabriquer moi-même » ; le second affiche le prix du Kit et mène à sa fiche. Réalise UJ-1, UJ-4.

#### FR-8 : Sur-mesure
Le visiteur qui choisit le Sur-mesure saisit ses Mesures avec un schéma d'aide ; il ne peut pas ajouter le Cosplay au Panier sans Mesures complètes. Réalise UJ-1.
- Après le paiement, le client ne peut plus modifier ses Mesures ; l'Admin les corrige après l'avoir contacté.

#### FR-9 : Fiche d'un Kit
Le visiteur voit le contenu du Kit (Fichiers de kit et formats, plan des chapitres, extrait vidéo public, niveau, matériel nécessaire) et le prix. Aucun lien vers `kits-private` n'apparaît. S'il possède déjà le Kit, le bouton devient « Ouvrir dans ma bibliothèque ».
- La fiche résume la Licence de kit (usage personnel, ni revente ni partage).

#### FR-10 : Stock et Plafond de fabrication
L'Admin indique une quantité pour les articles déjà fabriqués ; elle diminue à chaque Commande payée.
- Stock à zéro et Plafond de fabrication non atteint : l'article reste commandable en Fabrication sur commande, avec son Délai de fabrication.
- Plafond de fabrication atteint : la Fabrication sur commande n'est plus proposée ; la fiche affiche « Commandes complètes pour le moment » (jamais « Épuisé ») et propose le Kit lié. Les articles en stock restent vendables.
- Le stock et le Plafond de fabrication sont vérifiés côté serveur au paiement (règle 3).

### 4.3 Panier, compte et commande

**Description :** on visite et on remplit son Panier sans Compte ; le Compte devient obligatoire juste avant le paiement, et le client revient exactement où il en était. Réalise UJ-1, UJ-2, UJ-4.

#### FR-11 : Panier sans compte
Le visiteur ajoute, modifie et retire des articles sans Compte. Le Panier est conservé et fusionné avec le Compte à la connexion.
- Un Kit est limité à un exemplaire par Panier et ne peut pas être ajouté s'il est déjà possédé.
- Un Pass ne peut pas être ajouté au Panier (voir §4.7).

#### FR-12 : Création de compte et connexion
Le visiteur crée un Compte sans rien acheter, ou au moment de payer. Il se connecte avec un code à 6 chiffres reçu par email (partout), ou avec Google (hors navigateurs intégrés). Réalise UJ-2, UJ-4.
- Après création ou connexion, il revient à la page et au Panier qu'il avait quittés.
- À la création, il déclare son âge. Moins de 13 ans : la création est refusée. De 13 à 17 ans : le Compte est un Compte mineur ; il peut acheter, obtenir des Pass et participer à l'opération « 10 pass gratuits ».
- Juste après la création, trois questions d'accueil facultatives lui sont proposées : « Comment nous as-tu connus ? », « Quel univers préfères-tu ? », « Tu préfères porter ou fabriquer ? ». Les réponses alimentent l'origine des ventes (FR-54) et l'email « nouveau produit dans ton univers » (FR-59).

#### FR-13 : Étape de commande
Le client saisit son téléphone, choisit la Zone de remise (Goma ou Bukavu) et, à Goma seulement, le Mode de remise (retrait gratuit ou livraison). Il saisit son adresse dans un champ libre si le Mode de remise est la livraison. Ces champs n'apparaissent pas pour un Panier 100 % numérique. Réalise UJ-1.
- Le client coche l'acceptation des CGV. Pour un Kit, il coche aussi une case par laquelle il demande l'accès immédiat, renonce à son droit de rétractation et accepte la Licence de kit ; les Kits ne sont pas remboursables. Pour un Cosplay en Sur-mesure, il coche une case qui confirme ses Mesures et le fait que l'annulation n'est plus possible après le début de la fabrication.
- Le serveur recalcule depuis la base le sous-total, le Forfait de livraison, la réduction du Code promo et le total (règle 3), vérifie le stock et le Plafond de fabrication, puis crée la Commande `en attente`.
- La Commande `en attente` réserve son stock et sa place dans le Plafond de fabrication pendant le Délai de paiement. À l'échéance, sans paiement vérifié, elle passe `expirée` et libère la réservation. Le client qui revient est ramené à son Panier, avec les champs déjà saisis, et repart sur une nouvelle Commande.

#### FR-14 : Récapitulatif avant paiement
Avant de payer, le client voit le prix de chaque article en USD, le Forfait de livraison, la réduction éventuelle, le total en USD et le délai total pour chaque Produit physique.

### 4.4 Paiement

**Description :** décision de Jonathan du 2026-10-16, intégrée telle quelle. Elle remplace les règles 9 à 11 d'origine de `CLAUDE.md` et la section « Paiement et livraison » du guide.

1. **Mobile money : plusieurs Agrégateurs en parallèle.** KOMA SHOP utilise quatre Agrégateurs de mobile money : PawaPay, K-Pay, MaishaPay et GeniusPay. Objectif : couvrir plus de pays et d'opérateurs, et disposer d'une solution de secours si un Agrégateur est en panne. Le client choisit son pays et son opérateur ; le serveur choisit l'Agrégateur qui couvre ce couple pays-opérateur, selon un Ordre de priorité réglable dans l'admin. Si l'Agrégateur prioritaire échoue ou est désactivé, le serveur propose le suivant qui couvre le même couple. La Couverture de chaque Agrégateur n'est pas inventée : elle reste une question ouverte, à remplir depuis leur documentation officielle et les contrats marchands de Jonathan.
2. **Carte bancaire pour les Produits physiques** (Cosplays, Accessoires) : paiement par carte via K-Pay. Jamais Polar. MaishaPay et GeniusPay acceptent aussi les cartes : solutions de secours possibles, à activer plus tard, non branchées au lancement.
3. **Carte bancaire pour les Kits** : Polar, uniquement pour un Panier 100 % numérique. Dès qu'un Cosplay ou un Accessoire est dans le Panier, Polar disparaît des choix ; la carte passe par K-Pay.
4. **Pass** : mobile money via les quatre Agrégateurs, carte via K-Pay. Jamais Polar sans accord écrit de Polar (la vente de billets est une activité restreinte dans sa politique d'usage).
5. Prix affichés en USD, identiques partout ; la conversion en devise locale est faite par le Prestataire.

Réalise UJ-1, UJ-2, UJ-3, UJ-3b, UJ-5.

#### FR-15 : Couche de paiement à Adaptateurs
Le système encaisse via une couche de paiement commune, avec un Adaptateur par Prestataire. Ajouter ou retirer un Agrégateur ne touche pas au reste du site.
- Adaptateurs au lancement : PawaPay (API v2, mobile money), K-Pay (mobile money et carte), MaishaPay (mobile money), Polar (carte, Kits). Ceux de K-Pay et MaishaPay sont construits à partir de la documentation officielle de K-Pay et de MaishaPay, fournie par Jonathan dans `docs/references/paiements/` (hors dépôt) ; couverture pays-opérateur (Q-1) et contrôle du montant reçu (Q-3) tirés de cette documentation. Ils utilisent les comptes marchands de NATHANGROUP SARL, dont les clés restent dans les variables d'environnement. Celui de GeniusPay est en attente de sa documentation (§11, Q-2) : rien de son API n'est supposé.

#### FR-16 : Choix du moyen de paiement
Le client choisit mobile money (pays + opérateur + numéro) ou carte. Le système ne propose que les Prestataires autorisés pour ce Panier ou cet achat de Pass, selon les points 1 à 4 du §4.4.
- Le client choisit d'abord son pays. Si un Agrégateur actif couvre ce pays, le mobile money est proposé en premier ; sinon, seule la carte est proposée (Q-11 tranchée).
- Avant de valider, le client lit « Paiement traité par {Prestataire} », en texte, sans logo de Prestataire.
- Panier 100 % numérique alors que Polar est désactivé : la carte s'affiche « Carte indisponible » ; aucun autre Prestataire ne la remplace (K-Pay seulement sur accord écrit de Jonathan et mise à jour de la règle 10 de `CLAUDE.md`).
- Panier mixte ou Panier avec Produit physique + carte → K-Pay ; Polar n'est jamais proposé.
- Panier 100 % numérique + carte → Polar.
- Pass + carte → K-Pay.
- Mobile money → l'Agrégateur actif prioritaire qui couvre le couple pays-opérateur.
- Aucun Agrégateur actif ne couvre le couple → le client en est informé et invité à choisir un autre opérateur ou la carte. Aucun Prestataire n'est inventé.

#### FR-17 : Repli entre Agrégateurs
Chaque essai de paiement est une Tentative de paiement distincte. Si l'Agrégateur choisi est désactivé, ou si la Tentative de paiement est **confirmée en échec** par l'Agrégateur (réponse explicite d'échec ou d'annulation), le système propose au client de réessayer avec l'Agrégateur suivant qui couvre le même couple, dans l'Ordre de priorité.
- Une Tentative de paiement sans réponse (délai dépassé, réponse ambiguë) n'est **jamais** traitée comme un échec : le système interroge l'Agrégateur, et le client voit « paiement en cours de vérification » ; aucun repli n'est proposé tant que son état n'est pas connu.
- Un échec dû au client (refus, solde insuffisant, abandon) ne déclenche pas de bascule automatique ; le client peut réessayer.
- Une seule Tentative de paiement peut être en cours à la fois pour une Commande.
- Un test automatique prouve qu'un délai dépassé ne déclenche pas de repli.

#### FR-18 : Vérification serveur du Prestataire
La route serveur qui choisit le Prestataire vérifie en base la Famille de chaque article, la présence d'un Pass, le moyen de paiement, le pays et l'opérateur.
- Des tests automatiques prouvent : qu'un Panier mixte ne part jamais chez Polar ; qu'un Pass ne part jamais chez Polar ; que le repli passe à l'Agrégateur suivant qui couvre le couple ; qu'une Référence de transaction déjà utilisée est refusée.

#### FR-19 : Notifications de paiement
Chaque Prestataire a sa route serveur de Notification de paiement. Chaque notification est vérifiée (signature ou contre-vérification auprès du Prestataire, montant compris) avant de passer une Commande en `payée`. Jamais le navigateur.
- Une même Référence de transaction ne valide jamais deux fois une Commande, quel que soit le Prestataire.
- Chaque Commande enregistre le Prestataire, la Référence de transaction, le montant et la devise effectivement encaissés.
- Le passage en `payée` déclenche : décompte du stock, ouverture des Kits dans la Bibliothèque, émission des Pass, email de confirmation.
- Une Commande ne passe `payée` qu'une fois. Une Tentative de paiement réussie qui arrive pour une Commande déjà `payée`, `expirée` ou devenue impossible à honorer (article vendu entre-temps, Événement passé, Code promo épuisé) crée un Trop-perçu : la Commande garde son statut, l'Admin est alerté et rembourse le client. Si l'argent arrive après l'expiration, l'Admin peut aussi honorer la Commande à la main, si le stock ou la Capacité le permettent encore.
- Une Tentative de paiement en échec, sans autre Tentative en cours, fait passer la Commande `échouée` ; le client peut repayer.
- Des tests automatiques couvrent : notification tardive après expiration, deux Tentatives réussies sur deux Agrégateurs, notification rejouée.

#### FR-20 : Page de retour après paiement
Après le paiement, le client voit l'état réel de sa Commande (payée, en attente, échouée), lu côté serveur. En cas d'échec confirmé, il peut réessayer ou écrire sur WhatsApp ; si l'état est inconnu, la page affiche « paiement en cours de vérification » et ne propose pas de repayer. La page n'affiche jamais « payée » avant une confirmation fiable du Prestataire (notification à signature vérifiée ou contre-vérification auprès de son API).

#### FR-21 : Administration des Prestataires
L'Admin active ou désactive chaque Prestataire, règle l'Ordre de priorité des Agrégateurs, saisit leur Couverture (pays-opérateur) depuis leurs documents, et voit les paiements par Prestataire.

**Exigences propres :**
- Interdiction de simuler (règle 13) : aucun faux paiement ni aucune fausse notification hors des tests automatiques, avec des données de test clairement nommées.
- Les secrets des Prestataires restent côté serveur, dans les variables d'environnement (règle 4).

### 4.5 Remise, suivi et service après-vente

**Description :** Jonathan remet lui-même les Produits physiques : retrait à Goma, livraison à Goma (moins d'un jour) ou à Bukavu (un jour au plus). Il n'y a ni transporteur intégré ni suivi automatique. Réalise UJ-1, UJ-6.

#### FR-22 : Suivi de commande client
Le client voit, dans son Compte, ses Commandes et une frise des Statuts de commande avec leurs dates, le numéro de suivi s'il existe, et un bouton WhatsApp. Réalise UJ-1.

#### FR-23 : Vérification des Mesures
Pour une Commande Sur-mesure payée, l'Admin voit une tâche « Mesures à vérifier ». Il contacte le client hors du site (WhatsApp, téléphone), corrige les Mesures si besoin et les valide avant de passer la Commande `en fabrication`. Réalise UJ-1.
- Une Commande Sur-mesure ne peut pas passer `en fabrication` sans Mesures validées.

#### FR-24 : Avancement manuel des Commandes
L'Admin fait passer une Commande par ses Statuts de commande, saisit à la main un numéro de suivi facultatif (texte libre) et corrige l'adresse. Chaque changement de statut envoie l'email correspondant (FR-44).
- La nature exacte du numéro de suivi sera précisée par Jonathan (Q-9).
- Seules les transitions autorisées sont proposées. Un Accessoire ou un Cosplay en stock passe directement de `payée` à `expédiée`.
- Aucun statut ne revient en arrière : une erreur se corrige avec le client hors du site (WhatsApp) et la correction est journalisée (NFR-9).
- Pour un retrait à Goma, le client voit « Prête à retirer » quand la Commande est `expédiée`.

#### FR-25 : Annulation d'une Commande de Cosplay
Le client demande l'annulation d'une Commande de Cosplay tant qu'elle n'est pas `en fabrication` ; l'Admin valide, la Commande passe `annulée`, et le stock et la place dans le Plafond de fabrication sont libérés. Elle passe `remboursée` seulement quand l'Admin confirme que l'argent a été rendu, avec la preuve (référence du Prestataire ou du virement manuel). Après le début de la fabrication, l'annulation n'est plus proposée.
- Commande mixte : toutes les pièces physiques de la Commande (Cosplay et Accessoires) sont annulées ensemble ; le Kit reste dans la Bibliothèque et n'est pas remboursé ; le montant rendu correspond aux pièces physiques et au Forfait de livraison. L'annulation partielle n'existe pas au lancement.
- Le mécanisme de remboursement dépend du Prestataire (Q-4) ; le PRD ne suppose rien.

#### FR-26 : Réclamation et remplacement
Dans les 48 h suivant la livraison, le client signale un Produit physique abîmé ou différent de la Commande (Accessoire ou Cosplay en taille standard). L'Admin valide ; le client rend l'article et reçoit un remplacement, refabriqué si besoin. Les Produits physiques livrés ne sont pas remboursés. Les Kits ne sont jamais remboursables.
- Au-delà de 48 h, la réclamation n'est plus proposée en ligne.
- Cas où le remplacement serait impossible : à régler dans les CGV (Q-6).

### 4.6 Bibliothèque de kits

**Description :** le Kit s'ouvre dès le paiement. Les Fichiers de kit se téléchargent sans limite, la Vidéo de kit se regarde en ligne seulement, avec une qualité adaptée à la connexion. Réalise UJ-2, UJ-3.

#### FR-27 : Ma bibliothèque
Le client retrouve ses Kits achetés, avec leur progression, dans « Ma bibliothèque ».

#### FR-28 : Téléchargement des Fichiers de kit
Le client télécharge chaque Fichier de kit (PDF A4 et US Letter, SVG, STL) sans limite de nombre, depuis n'importe quel appareil connecté à son Compte.
- Chaque téléchargement passe par un lien signé de courte durée, créé côté serveur après vérification d'un accès payé (règle 1).
- Chaque PDF téléchargé porte un filigrane discret avec l'identité de l'acheteur (nom ou email), sans gêner l'impression du patron.

#### FR-29 : Lecture de la Vidéo de kit
Le client regarde la Vidéo de kit en ligne, chapitre par chapitre ; la qualité s'adapte au débit. Aucun bouton de téléchargement n'existe. Il reprend là où il s'était arrêté, sur n'importe quel appareil.
- La Vidéo de kit complète n'est publiée nulle part ailleurs (ni YouTube, ni Drive).
- Aucune protection ne peut empêcher de filmer l'écran : l'objectif est d'empêcher le téléchargement direct et le partage de liens, pas d'installer une protection anti-copie lourde.
- La Vidéo de kit démarre sur une connexion lente (3G) en moins de 5 s, avec une version 360p disponible (seuil fixé par l'architecture).
- Chaque Vidéo de kit a des sous-titres (WebVTT) en français. Les sous-titres anglais sont facultatifs : sous `/en`, la fiche d'un Kit sans sous-titres anglais l'indique (Q-15 tranchée). Le lecteur se pilote au clavier.
- Une transcription texte de chaque chapitre se télécharge avec les Fichiers de kit.

#### FR-30 : Accès à vie et mises à jour
Un Kit acheté reste accessible à vie, mises à jour comprises.

#### FR-58 : Kit gratuit (lancement + 4 semaines)
Le visiteur connecté obtient le Kit gratuit d'un clic depuis sa fiche, sans Panier ni Prestataire : le serveur crée une Commande `offerte` (0 USD) et ouvre le Kit dans sa Bibliothèque. Réalise UJ-4.
- Un Compte obtient chaque Kit gratuit une seule fois.
- Une Commande `offerte` n'est jamais marquée `payée` et ne compte pas comme premier achat pour un Code promo.
- Le Kit gratuit est soumis à la Licence de kit : avant « Obtenir », le visiteur coche son acceptation (aucune renonciation au droit de rétractation n'est demandée, rien n'étant payé).

### 4.7 Événements et Pass

**Description :** une section Événements annonce les prochaines activités et vend des Pass nominatifs avec Code QR, contrôlés à l'entrée par Scan, avec un mode hors ligne. Les Pass s'achètent à part. Réalise UJ-4, UJ-5.

#### FR-31 : Pages Événements
Le visiteur voit la liste des Événements à venir et la page de chaque Événement : date, lieu (salle ou plein air), programme, photos, Types de pass avec leurs prix et avantages.
- Quand la Capacité est atteinte, la page affiche « Complet » et la vente de Pass s'arrête. Sans Capacité réglée, il n'y a pas de limite.
- Un Événement passé reste consultable avec le lien de sa Galerie d'événement.

#### FR-32 : Alerte événement
Le visiteur s'inscrit à « Me prévenir » par email, par son Compte ou par numéro WhatsApp, au choix. Réalise UJ-4, UJ-5.
- Email et Compte : l'annonce d'un nouvel Événement part automatiquement par email.
- WhatsApp : l'Admin exporte la liste des numéros et envoie le message lui-même. Aucune API WhatsApp au lancement.
- Le visiteur consent explicitement et peut se désinscrire.

#### FR-33 : Achat de Pass
Le client connecté choisit un ou plusieurs Pass, d'un ou plusieurs Types de pass. Pour lui-même, le Pass reprend les informations de son Compte ; pour chaque autre personne, il saisit son nom. Un Pass Stand produit deux Pass nominatifs, pour le titulaire et pour son aide. Il n'y a pas de quota par Type de pass, seulement la Capacité facultative de l'Événement, vérifiée côté serveur au paiement. Réalise UJ-5.
- L'achat de Pass est séparé du Panier de produits.
- Le client accepte une mention : des photos et vidéos de l'Événement seront publiées.
- Le paiement suit §4.4 (mobile money ou K-Pay, jamais Polar).

#### FR-34 : Émission des Pass
Dès le paiement vérifié, l'acheteur reçoit par email tous les Pass, chacun avec un Code QR unique, et les retrouve dans son profil. C'est lui qui les transmet.
- Un Code QR ne peut pas être deviné ni fabriqué à partir d'un autre.
- Sous chaque Code QR figure un code court qui identifie le même Pass ; comme le Code QR, il ne peut pas être deviné ni déduit d'un autre.

#### FR-35 : Scan à l'entrée
Le Scan d'un Code QR affiche le nom, l'Événement et le Type de pass (Standard, VIP, Stand) pour remettre le bon bracelet et orienter la personne. Un Pass déjà scanné, annulé ou d'un autre Événement est refusé, avec la raison.
- Si le Code QR ne se lit pas, le bénévole saisit le code court ; les mêmes contrôles s'appliquent.

#### FR-36 : Scan hors ligne
Avant une coupure possible, un appareil connecté prend le Verrou hors ligne de l'Événement et charge la liste des Pass au statut `valide`. Tant que le Verrou hors ligne est tenu, cet appareil est le seul à pouvoir scanner, en ligne comme hors ligne ; les autres appareils affichent « scan réservé à l'appareil hors ligne ». Au retour de la connexion, les Scans se synchronisent, puis l'appareil rend le Verrou hors ligne.
- Sans Verrou hors ligne pris à l'avance, aucun Scan hors ligne n'est possible.
- L'Admin peut forcer la libération d'un Verrou hors ligne (appareil perdu) ; les Scans non synchronisés de cet appareil sont alors signalés.

#### FR-37 : Accès bénévole
L'Admin, et lui seul, crée à l'avance (par exemple la veille) un Accès bénévole pour un Événement. Il est limité au Scan et ne fonctionne que le jour de l'Événement ; il est ensuite déconnecté et supprimé automatiquement.
- Un Accès bénévole ne voit ni Commandes, ni clients, ni Produits, ni réglages.

#### FR-38 : Annulation et remboursement d'un Pass
Le client demande l'annulation d'un Pass jusqu'à 48 h avant l'Événement. L'Admin valide chaque demande. Un pourcentage de frais, réglé dans l'admin, est retenu ; le reste est remboursé. Le Pass passe `annulé` dès la validation (refusé au Scan), puis `remboursé` quand l'Admin confirme, preuve à l'appui, que l'argent a été rendu.
- Le mécanisme de remboursement par Prestataire reste une question ouverte (Q-4).

#### FR-39 : Galerie d'événement
L'Admin saisit le lien public (Google Drive ou Google Photos) de la Galerie d'événement. Après l'Événement, chaque détenteur de Pass reçoit un email avec ce lien. Toute personne, ou le parent d'un mineur, peut demander par email (ou via le contact) le retrait d'une photo où elle apparaît ; Jonathan la retire à la main. Il n'y a pas d'autre recueil de consentement que la mention acceptée par l'acheteur (FR-33), conformément à l'usage des festivals.

### 4.8 Galerie « Ils le portent » et Réalisations

**Description :** le mur des vrais clients est le moteur de la fierté et de la notoriété. Rien n'y est publié sans accord explicite et validation. Réalise UJ-1, UJ-2, UJ-4.

#### FR-40 : Envoi d'une photo
Le client envoie sa photo depuis son Compte (dépôt sur le site) ou par WhatsApp, et l'Admin la dépose pour lui. Le client donne son accord explicite pour la publication et choisit d'afficher ou non son prénom (ou pseudo) et sa ville.
- Pour un Compte mineur, seuls le prénom ou le pseudo peuvent être affichés, jamais la ville ; un parent peut demander le retrait de la photo.
- Après une livraison, le client est invité à envoyer sa photo (email « livrée »).

#### FR-41 : Validation et retrait
L'Admin valide chaque photo avant publication. Le client peut demander le retrait de sa photo à tout moment, et l'Admin la retire.

#### FR-42 : Opération « 10 pass gratuits »
Les 10 premiers Comptes qui envoient une Réalisation faite avec un Kit acheté sur KOMA SHOP gagnent un Pass gratuit pour l'Événement organisé. L'Admin vérifie que le Compte a bien acheté le Kit et valide la Réalisation ; le serveur crée alors une Commande `offerte` (0 USD, sans Prestataire) et émet le Pass comme un Pass normal (Code QR, email, profil). Une Commande `offerte` n'est jamais marquée `payée`.
- Le compteur suit l'ordre des Réalisations validées et s'arrête à 10. Le Pass offert est un Pass Standard.

### 4.9 Blog

**Description :** les Articles (guides de fabrication, annonces d'événements) nourrissent la communauté et le référencement. Réalise UJ-4, UJ-5.

#### FR-43 : Publication d'Articles
L'Admin (et plus tard l'Assistant) écrit, illustre, publie, modifie et dépublie des Articles. Le visiteur lit la liste des Articles et chaque Article. Les Articles peuvent renvoyer vers des Produits et des Événements.
- Chaque Article existe en français ; la version anglaise est facultative. Un Article sans version anglaise n'apparaît pas sous /en (exception à FR-55).
- Les images respectent les règles 6 et 7 (photos du créateur, texte alternatif).

### 4.10 Emails et Relances

**Description :** les emails accompagnent chaque étape et font revenir le client, toujours avec son consentement pour les messages commerciaux. Envoi par Resend.

#### FR-44 : Emails transactionnels
Le client reçoit un email à chaque événement de sa Commande : payée, en fabrication, expédiée (avec numéro de suivi s'il existe), livrée (avec invitation à envoyer une photo), annulée ou remboursée ; Kit ouvert dans la Bibliothèque ; Pass émis ; code de connexion. Réalise UJ-1, UJ-2, UJ-5.
- Aucun email n'est affiché comme envoyé sans réponse réelle du service d'envoi (règle 13).

#### FR-45 : Relances
Un client qui a consenti reçoit une Relance tous les 2 à 3 jours pendant 90 jours au plus après son achat, pour l'inviter à revenir (chapitre suivant, nouveautés, événement). Chaque Relance contient un lien de désinscription ; la désinscription prend effet immédiatement. Réalise UJ-2.
- Au lancement, aucun Email commercial n'est envoyé à un Compte mineur, même s'il a consenti ; les emails liés à ses achats partent normalement. Un réglage permettra de les ouvrir si le juriste les valide (Q-5) (décision de Jonathan du 2026-10-21).

#### FR-59 : Emails commerciaux ciblés
Un client qui a consenti reçoit aussi :
- **panier abandonné** : 1 h puis 24 h après avoir quitté un Panier non payé (Compte créé) ; arrêt dès le paiement ;
- **rappels de Kit** : 2 jours après l'achat s'il n'a pas démarré la Vidéo de kit (« Commence le chapitre 1 ») ; 7 jours après s'il ne l'a pas terminée ;
- **nouveau produit dans ton univers** : quand un Produit est publié dans un univers où il a déjà acheté ou qu'il a déclaré préférer.
- Un client ne reçoit jamais plus d'un Email commercial tous les 2 jours, tous types confondus ; les emails transactionnels (FR-44) ne comptent pas dans cette limite.

### 4.11 Codes promo d'affiliation

**Description :** l'affiliation passe par des Codes promo. Le site calcule la commission ; Jonathan paie l'Affilié lui-même, hors du site. Réalise UJ-2, UJ-6.

#### FR-46 : Création d'un Code promo
L'Admin crée un Code promo en indiquant : l'Affilié, le pourcentage de réduction, le taux de commission, le plafond d'utilisations (50 par défaut, modifiable) et son état (actif ou inactif).

#### FR-47 : Application d'un Code promo
Le client saisit un Code promo avant de payer. Le serveur l'accepte seulement s'il est actif, sous son plafond, et si c'est le premier achat payé du Compte (Produits ou Pass : un achat de Pass compte comme premier achat ; une Commande `offerte` ne compte pas). La réduction s'applique à tout le catalogue (Produits et Pass) mais pas au Forfait de livraison.
- Un seul Code promo par achat.

#### FR-48 : Suivi et commission
L'Admin voit, pour chaque Code promo, les ventes générées, leur montant et la commission due. Seules les Commandes payées et non remboursées comptent. La commission se calcule sur le montant payé hors livraison.

### 4.12 Admin et rôles

**Description :** l'admin fonctionne aussi bien sur téléphone que sur ordinateur. Jonathan y voit d'abord ce qui demande une action. Réalise UJ-6.

#### FR-49 : Tableau de bord
À l'ouverture, l'Admin voit d'abord les nouvelles Commandes payées, puis les graphiques de paiement (par Prestataire, par Famille, dans le temps), les tâches en attente (Mesures à vérifier, demandes d'annulation, de remboursement ou de remplacement, Trop-perçus à rembourser, photos à valider, Réalisations) et les indicateurs du §7.
- La liste des Commandes se filtre par Statut de commande, Famille, Prestataire et Zone de remise.

#### FR-50 : Gestion des Produits
L'Admin crée et modifie les Produits : Famille, textes FR et EN, photos (ordre, texte alternatif obligatoire), prix en USD, tailles et Sur-mesure, stock, Délai de fabrication par produit ou variante, Kit lié, Fichiers de kit et Vidéo de kit (chapitres, extrait public).
- La publication est refusée sans prix, sans photo, sans texte alternatif, ou, pour un Kit, sans Fichier de kit ou sans sous-titres français de la Vidéo de kit (les sous-titres anglais sont facultatifs, FR-29).
- Le téléversement des Fichiers de kit et des Vidéos de kit affiche sa progression et reprend après une coupure de connexion.

#### FR-51 : Réglages
L'Admin règle : Délai de paiement, Forfaits de livraison Goma et Bukavu, lieu et modalités du retrait, Plafond de fabrication, numéro WhatsApp, Prestataires (FR-21), pourcentage de frais d'annulation des Pass, vidéo et photo du héros.

#### FR-52 : Gestion des Événements
L'Admin crée et modifie un Événement : date, lieu, Capacité facultative, programme, photos, Types de pass avec prix et avantages, lien de la Galerie d'événement ; il voit les Pass vendus et scannés.

#### FR-53 : Rôle Assistant
Plus tard, l'Admin crée jusqu'à deux comptes Assistant. Un Assistant peut : voir les Commandes et changer leur statut (numéro de suivi compris) ; vérifier les Mesures et contacter les clients ; valider les photos de la Galerie ; gérer le Blog ; créer et modifier les Événements ; préparer une demande de remboursement, que seul l'Admin valide ; voir les graphiques de sa propre activité.
- Un Assistant ne peut pas : modifier les prix ni les Produits ; gérer les Codes promo ni voir les commissions ; gérer les Prestataires ; voir le chiffre d'affaires ni les graphiques de paiement ; créer des Accès bénévoles ; valider un remboursement.
- Les droits sont contrôlés côté serveur et en base (RLS), pas seulement dans l'interface.

### 4.13 Mesure d'audience et indicateurs

#### FR-54 : Actions mesurées
Le système mesure au moins : origine de la visite et de la vente (réseau social, publicité, groupe WhatsApp, Code promo, Événement), clic sur un bouton du héros, vue de fiche, ajout au Panier, création de Compte à l'étape de paiement, abandon à cette étape, paiement réussi ou échoué (par Prestataire), partage d'une fiche, inscription à une Alerte événement, Pass vendu, photo et Réalisation envoyées, Kit gratuit récupéré, ventes par Code promo, chargement du héros (durée), désinscription des Relances, livraisons en retard, Vidéo de kit démarrée et terminée, deuxième achat d'un même Compte, et l'entonnoir vue de fiche → Panier → Commande → payée → livrée. Ces données alimentent le §7.
- La mesure respecte le consentement des visiteurs, de préférence sans cookies ; l'architecte choisit l'outil.

### 4.14 Langues, SEO et partage

#### FR-55 : Français et anglais
Toutes les pages publiques existent en français et en anglais, sous /fr et /en, sauf les Articles du Blog (FR-43). Aucun texte visible n'est écrit en dur hors des fichiers de traduction. Les emails partent dans la langue choisie par le client.

#### FR-56 : Référencement
Chaque page publique a un titre et une description uniques, une URL lisible, Open Graph et des données structurées JSON-LD (Product et Offer, Event, Article, BreadcrumbList, Organization, FAQPage, VideoObject selon la page), un plan du site, un fichier robots.txt, une URL canonique, les balises hreflang entre /fr et /en, et un seul titre H1 par page (règle 8).

#### FR-57 : Aperçu de partage
Une fiche partagée sur WhatsApp ou un réseau social affiche la grande photo du Produit et son titre. Un bouton de partage est présent sur chaque fiche et chaque Événement. Réalise UJ-4.

## 5. Exigences non fonctionnelles transverses

- **NFR-1 Mobile d'abord** : utilisable à 375 px de large sans défilement horizontal ; pensé d'abord pour le téléphone et le navigateur intégré d'Instagram.
- **NFR-2 Performance** : héros affiché en moins de 2,5 s (FR-1) ; Core Web Vitals au vert ; Lighthouse mobile ≥ 90 en performance, accessibilité et SEO sur l'accueil.
- **NFR-3 Accessibilité** : contraste suffisant, texte alternatif sur chaque image, navigation au clavier, vidéo du héros sans son et sans information indispensable ; Vidéos de kit sous-titrées et transcrites (FR-29).
- **NFR-4 Sécurité des contenus payants** : Fichiers de kit dans le bucket privé `kits-private` ; Vidéos de kit complètes dans une bibliothèque Bunny Stream privée (décision d'architecture du 2026-10-20). Fichiers et vidéos ne s'ouvrent que par un lien ou un jeton signé de courte durée, créé côté serveur après vérification d'un accès payé ; RLS sur toutes les tables.
- **NFR-5 Intégrité des paiements** : seul le serveur, après une confirmation fiable du Prestataire (notification à signature vérifiée ou contre-vérification auprès de son API), passe une Commande en `payée` ; idempotence par Référence de transaction ; prix, stock, livraison et réductions toujours calculés côté serveur.
- **NFR-6 Résilience du paiement** : la panne d'un Agrégateur n'empêche pas de payer si un autre couvre le même couple pays-opérateur.
- **NFR-7 Secrets** : clés et secrets uniquement dans les variables d'environnement ; `.env.example` tenu à jour.
- **NFR-8 Honnêteté** : aucun avis, chiffre, logo ou témoignage inventé ; aucun paiement, statut, email ou réponse d'API simulé hors des tests automatiques.
- **NFR-9 Traçabilité** : chaque changement de statut d'une Commande ou d'un Pass, chaque validation (remboursement, remplacement, photo) et chaque action d'un Assistant est horodatée avec son auteur.

## 6. Périmètre et phases

### 6.1 Lancement
- Page d'accueil et pages vitrines (§4.1), catalogue et fiches (§4.2), Panier, Compte et commande (§4.3).
- Paiement : mobile money via PawaPay, K-Pay, MaishaPay et GeniusPay (K-Pay et MaishaPay construits à partir de la documentation officielle de K-Pay et de MaishaPay, fournie par Jonathan dans `docs/references/paiements/` (hors dépôt) ; couverture pays-opérateur (Q-1) et contrôle du montant reçu (Q-3) tirés de cette documentation ; GeniusPay dès que sa documentation est lue), carte via K-Pay (Produits physiques et Pass) et via Polar (Paniers 100 % numériques) (§4.4).
- Remise à Goma et Bukavu, retrait à Goma, suivi manuel, annulation, réclamation et remplacement (§4.5).
- Bibliothèque de kits (§4.6).
- Événements, Pass, Scan avec mode hors ligne, Accès bénévole (§4.7).
- Galerie et opération « 10 pass gratuits » (§4.8) ; Blog (§4.9).
- Emails, Relances (§4.10) ; Codes promo (§4.11).
- Admin pour Jonathan seul (§4.12, sauf FR-53) ; mesure (§4.13) ; FR/EN, SEO, partage (§4.14).

**Conditions d'ouverture** (toutes requises) :
- au moins un Agrégateur couvrant la RDC (M-Pesa, Airtel Money, Orange Money, Africell), documenté et testé avec de vrais petits paiements ;
- K-Pay carte opérationnel ;
- textes légaux validés et en ligne (Q-5) ;
- au moins un Kit filmé et des Produits publiés.

Les autres Agrégateurs et Polar s'ajoutent dès qu'ils sont prêts, sans bloquer l'ouverture. Jonathan a choisi de tout ouvrir au lancement, Événements et Pass compris (pas de lancement en deux temps).

### 6.2 Lancement + 4 semaines
- Kit gratuit, avec son bloc sur la page d'accueil (« Ton premier accessoire, offert. »).
- Revue des indicateurs et fixation des objectifs à 3 mois (§7).

### 6.3 Plus tard (non planifié)
- Rôle Assistant (FR-53 ; prévu dans le modèle de droits dès le lancement).
- MaishaPay et GeniusPay comme secours pour la carte.
- Envoi automatique des Alertes événement par WhatsApp (API WhatsApp Business).
- Polar pour les Pass, seulement après accord écrit de Polar.
- Remise hors de Goma et Bukavu.

## 7. Indicateurs de succès

**Principe :** tous les indicateurs sont mesurés dès le lancement (FR-54) et visibles dans le tableau de bord (FR-49). Aucun objectif chiffré n'est fixé avant le lancement. Une revue à 4 semaines fixe les objectifs à 3 mois à partir des chiffres réels. Repère : « plus de 20 ventes le premier mois » est une estimation de Jonathan, pas un engagement.

**Indicateurs principaux**
- **SM-1** Ventes payées par Famille et Pass vendus. Valide §4.2 à §4.7.
- **SM-2** Part des visiteurs de l'accueil qui cliquent sur un bouton du héros. Valide FR-1, FR-2.
- **SM-3** Partages de fiches. Valide FR-57.
- **SM-4** Inscriptions aux Alertes événement et Pass vendus par Événement. Valide FR-32, FR-33.
- **SM-5** Photos et Réalisations envoyées. Valide FR-40, FR-42.
- **SM-6** Kits gratuits récupérés, puis passage à un Kit payant (à partir de la 5ᵉ semaine). Valide §6.2.
- **SM-7** Ventes par Code promo et par origine. Valide FR-47, FR-48, FR-54.
- **SM-8** Part des acheteurs de Kit qui terminent la Vidéo de kit. Valide §4.6 : un Kit terminé produit une Réalisation.
- **SM-9** Part des clients qui font un deuxième achat. Valide l'ensemble de l'expérience.
- **SM-10** Entonnoir hebdomadaire : vue de fiche → Panier → Commande → payée → livrée dans le délai. Montre où les clients décrochent.

**Signaux d'alerte (à ne pas sacrifier aux ventes)**
- **SM-C1** Commandes remises après le délai annoncé. Contrebalance SM-1 : vendre plus que la capacité de fabrication.
- **SM-C2** Taux d'échec des paiements par Agrégateur. Contrebalance SM-1 ; sert à régler l'Ordre de priorité.
- **SM-C3** Commandes Sur-mesure dont les Mesures ont dû être corrigées. Signale un schéma d'aide mal compris.
- **SM-C4** Demandes de remboursement de Pass. Contrebalance SM-4.
- **SM-C5** Désinscriptions des Relances. Contrebalance la fréquence de FR-45.
- **SM-C6** Héros chargé en plus de 2,5 s. Contrebalance SM-2 : un héros plus riche mais plus lent.
- **SM-C7** Abandons à l'étape « créer un compte ». Contrebalance le Compte obligatoire avant paiement (FR-12).

## 8. Risques

| # | Risque | Effet | Parade prévue |
|---|---|---|---|
| R-1 | Un seul créateur face à un périmètre large (boutique, Événements, Blog, Relances, Codes promo) | Délais non tenus, site incomplet au lancement | Plafond de fabrication ; blocs masqués sans contenu ; Assistants plus tard ; suivi de SM-C1 |
| R-2 | Contenu de lancement insuffisant | Rien à vendre au cœur du projet | Selon Jonathan, des Kits sont déjà filmés et des Produits prêts ; un Kit filmé reste une condition d'ouverture (§6.1) |
| R-3 | Documentation et Couverture des Agrégateurs pas encore transmises | Adaptateurs impossibles à développer | Selon Jonathan, les quatre couvrent la RDC et sont testés ; documents à transmettre (Q-1, Q-2) ; un seul Agrégateur suffit pour ouvrir (§6.1) |
| R-4 | K-Pay refuse les pièces « inspirées de » ou les Pass | Plus de paiement par carte pour le physique ou les Pass | K-Pay déjà en production avec un compte marchand de NATHANGROUP SARL (Q-14 réglée) ; avis juridique (Q-7) |
| R-5 | Polar ne verse pas les fonds à une société en RDC | Ventes de Kits par carte bloquées | Compte Polar déjà vérifié au nom de NATHANGROUP SARL (Q-13 réglée) |
| R-6 | Double débit ou paiement perdu lors d'un repli | Perte de confiance, remboursements manuels | Tentatives de paiement, aucun repli sur délai dépassé, Trop-perçus signalés (FR-17, FR-19) |
| R-7 | Partage des Fichiers de kit | Ventes perdues | Liens signés et Licence de kit ; risque accepté : la confiance et la proximité protègent mieux qu'une barrière technique |
| R-8 | Comptes TikTok et Instagram pas encore créés (brief) | UJ-1 et UJ-4 sans canal | Le groupe WhatsApp et le festival restent les premiers canaux ; comptes créés avant les publicités |

## 9. Non-objectifs

- KOMA SHOP n'est pas une place de marché : un seul créateur vend ; ni vendeurs tiers, ni revendeurs.
- Aucune intégration de transporteur ni aucun suivi automatique.
- Aucune vente de produit sous licence officielle, aucune image ni aucun nom de franchise.
- Aucun programme d'affiliation automatisé : pas de compte affilié, pas de paiement de commission par le site.
- Aucune fonction communautaire intégrée (forum, messagerie, Discord) : la communauté vit sur WhatsApp et aux Événements.
- Aucun hébergement de la Galerie d'événement sur le site.
- Aucun prestataire, aucune page ni aucune fonction hors de ce PRD sans nouvelle décision de Jonathan (règle 14).

## 10. Image et ton

- **Promesse** : « fait par un otaku, pour les otakus ». Vraies photos et vidéos du créateur, en grand.
- **Direction visuelle** (tranchée en UX le 2026-10-17 ; détail dans `ux-designs/ux-KOMA SHOP-2026-10-16/DESIGN.md` et `EXPERIENCE.md`, qui priment sur les maquettes) : thème Sumi & washi, crème par défaut, sombre au choix, choix mémorisé ; un seul rouge (#E3261C) pour les boutons et les accents, prix dans la couleur du texte ; Sakura Town pour les grands titres, en majuscules et sans accent, Barlow pour le texte ; effet verre discret ; clins d'œil manga légers (trames, cases, traits de vitesse), jamais sur une photo de produit.
- **Ton** : tutoiement, phrases courtes, vocabulaire de la communauté (cosplay, con, WIP, props), sans jargon de vendeur.
- **Confiance sans rien inventer** : photos réelles, atelier, WhatsApp visible, délai annoncé avant paiement.

## 11. Questions ouvertes

1. **Q-1 Couverture des Agrégateurs** : tableau des pays et opérateurs couverts par PawaPay, K-Pay, MaishaPay et GeniusPay, tiré de leur documentation et des contrats marchands de Jonathan. Pour la RDC, Jonathan indique M-Pesa, Airtel Money, Orange Money et Africell chez les quatre. *Bloque FR-16 en production.*
2. **Q-2 Documentation GeniusPay** : lien transmis le 2026-10-16 (https://geniuspay.ci/docs/api). Reste à vérifier, à partir de ce document, ce que son API permet (Notification de paiement vérifiable, remboursement, devise) avant de développer son Adaptateur, sans rien supposer. K-Pay et MaishaPay : leurs Adaptateurs sont construits à partir de la documentation officielle de K-Pay et de MaishaPay, fournie par Jonathan dans `docs/references/paiements/` (hors dépôt) ; couverture pays-opérateur (Q-1) et contrôle du montant reçu (Q-3) tirés de cette documentation.
3. **Q-3 Devise débitée** : chaque Prestataire débite-t-il en USD ou convertit-il ? Quel montant afficher au client au moment de valider ?
4. **Q-4 Remboursements par API** : chaque Prestataire permet-il de rembourser par son API (annulation de Cosplay, Pass) ? Sinon, comment Jonathan rembourse-t-il à la main ?
5. **Q-5 Textes légaux** : mentions légales, CGV, livraison et retours, confidentialité et cookies, mention sur le droit à l'image des Événements, conditions de l'opération « 10 pass gratuits », identifiants RCCM, Id. Nat. et NIF. À valider par un juriste : âge minimum de 13 ans et Emails commerciaux envoyés aux mineurs, publication des photos d'événement sur la seule mention acceptée par l'acheteur. Un brouillon des CGV et de la politique de confidentialité sera préparé dans une session séparée, puis validé par un juriste avant la première vente.
6. **Q-6 Remplacement impossible** : si un Produit physique défectueux ne peut être ni remplacé ni refabriqué, l'absence de remboursement doit être validée par un juriste dans les CGV.
7. **Q-7 Avis juridique sur la propriété intellectuelle** : vendre des pièces « inspirées de » sans nommer la franchise, et acceptation de ces pièces par K-Pay.
9. **Q-9 Numéro de suivi** : que représente-t-il pour une remise à Bukavu (bateau, agence) ?
10. **Q-10 Ressources à fournir** : photos et vidéo du héros, email admin, numéro WhatsApp, liens des réseaux sociaux, premiers Kits filmés. Le domaine relève de Q-D1.
11. **Q-11 Ordre d'affichage des moyens de paiement** : *tranchée le 2026-10-17 (UX)* — pays d'abord ; mobile money en premier si un Agrégateur actif couvre ce pays, sinon carte seule (FR-16).
12. **Q-12 Montants** : prix des Produits et des Pass, Forfaits de livraison, pourcentage de frais d'annulation des Pass, pourcentages des Codes promo. Saisis dans l'admin, jamais dans le code.
13. **Q-D1 Nom de domaine** : pas encore acheté (décision du 2026-10-20). Jonathan l'achète lui-même chez Hostinger à la fin. Le site est construit et testé en local ; son adresse est lue dans la variable d'environnement `NEXT_PUBLIC_SITE_URL`, jamais écrite en dur. Bloque seulement la mise en ligne (domaine, Resend, SMTP de Supabase Auth).
14. **Q-N1 Nom affiché** : nom définitif du site (KOMA SHOP ou KOMA FEST). Valeur de départ provisoire « KOMA SHOP », dans un réglage modifiable dans l'admin, seule source du nom affiché. Bloque seulement la mise en ligne.

**Tranchées depuis (retirées de la liste ci-dessus) :**
- **Q-8 Hébergement des Vidéos de kit** : bibliothèque Bunny Stream privée, lecture par jeton signé de courte durée (décision d'architecture du 2026-10-20 ; `CLAUDE.md` règle 1 ; spine d'architecture AD-11).
- **Q-13 Polar et la RDC** : réglée le 2026-10-20 ; le compte Polar de Jonathan est déjà vérifié au nom de NATHANGROUP SARL.
- **Q-14 K-Pay et le catalogue** : réglée le 2026-10-20 ; K-Pay est déjà en production avec un compte marchand de NATHANGROUP SARL, carte activée.
- **Q-15 Sous-titres anglais des Vidéos de kit** : tranchée le 2026-10-20 ; facultatifs au lancement, la fiche `/en` d'un Kit sans sous-titres anglais l'indique (FR-29, FR-50).

## 12. Hypothèses confirmées

Toutes confirmées par Jonathan le 2026-10-16.

- §4.1 FR-1 — Le héros met en avant un Cosplay précis, choisi dans l'admin, avec son Kit lié.
- §4.2 FR-6 — L'avertissement de zone s'affiche à tous, sans détection de pays.
- §4.2 FR-8 — Le client ne modifie plus ses Mesures après paiement ; l'Admin les corrige.
- §4.2 FR-10 — Stock à zéro : Fabrication sur commande tant que le Plafond de fabrication n'est pas atteint, puis « Commandes complètes pour le moment » et Kit lié (libellé révisé le 2026-10-17, décision UX C-4).
- §4.4 FR-17 — Un échec dû au client ne déclenche pas de bascule automatique.
- §4.5 FR-23 — Pas de passage `en fabrication` sans Mesures validées.
- §4.5 FR-26 — Pas de réclamation en ligne au-delà de 48 h.
- §4.6 FR-29 — Seuil de démarrage vidéo en 3G à fixer par l'architecte.
- §4.7 FR-31 — Un Événement passé reste consultable.
- §4.7 FR-32 — Annonce automatique par email pour les inscrits email et Compte.
- §4.7 FR-36 — Un seul appareil peut scanner pour l'Événement tant que le Verrou hors ligne est tenu.
- §4.8 FR-42 — Ordre des Réalisations validées ; Pass offert de Type Standard.
- §4.9 FR-43 — Articles en français, version anglaise facultative.
- §4.11 FR-47 — Réduction hors livraison ; un seul Code promo par achat.
- §5 NFR-9 — Journal horodaté des actions sensibles.
