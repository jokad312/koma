# Extraction des sources pour la conception UX : KOMA SHOP

Date : 2026-10-16. Extraction uniquement : rien n'est ajouté aux sources.

**Sources et abréviations**
- PRD = `_bmad-output/planning-artifacts/prds/prd-KOMA SHOP-2026-10-16/prd.md` (statut final ; **fait foi en cas de contradiction**, PRD §0 l.12)
- PRD-add = `.../prds/prd-KOMA SHOP-2026-10-16/addendum.md`
- Brief = `_bmad-output/planning-artifacts/briefs/brief-KOMA SHOP-2026-10-15/brief.md`
- Brief-add = `.../briefs/brief-KOMA SHOP-2026-10-15/addendum.md`
- Guide = `docs/guide-koma-shop.md` (avertissement l.5 : le PRD et CLAUDE.md font foi ; la partie paiement, l.150, et la phase 6, l.480, sont périmées)
- CLAUDE = `CLAUDE.md` à la racine (règles absolues 1 à 15)

Ordre de priorité observé : PRD = CLAUDE > PRD-add > Brief / Brief-add > Guide.

---

## 1. Personas, clients cibles, contexte d'usage

### 1.1 Personas nommés (PRD §2.3, parcours UJ)

| Persona | Qui / où | Contexte d'usage | Source |
|---|---|---|---|
| **Grâce** | Cliente à Bukavu, cosplay Sur-mesure | Téléphone ; arrive par une vidéo TikTok ; paie par M-Pesa | PRD UJ-1, l.47-51 |
| **Patrick** | Étudiant à Kinshasa, petit budget, achète un Kit | Arrive par une pub ou un influenceur avec Code promo ; paie par Airtel Money ; **connexion lente** ; change de téléphone | PRD UJ-2, l.53-55 |
| **Amina** | Vit hors d'Afrique, pas de mobile money | Achète un Kit par carte via Polar (Panier 100 % numérique) | PRD UJ-3, l.57-58 |
| *Client de Goma* (sans nom) | Panier mixte (Kit + Accessoire) payé par carte | Voit Polar disparaître, carte via K-Pay | PRD UJ-3b, l.60-61 |
| **Kevin** | 19 ans, Goma, fan d'animes de samouraïs / chasseurs de démons | **Navigateur intégré d'Instagram**, pub de 6 s ; budget serré ; partage sur WhatsApp | PRD UJ-4, l.63-69 |
| **Divine** | 23 ans, Goma, dessinatrice, exposante | Achète un Pass Stand + un Pass Standard ; mobile money ou carte K-Pay | PRD UJ-5, l.71-74 |
| **Jonathan** | Créateur, Admin unique | Admin « aussi bien sur téléphone que sur ordinateur », consultée le matin | PRD UJ-6, l.76-78 ; FR-49 l.427 |

Rôles secondaires sans persona : **bénévole** au Scan (PRD UJ-5 l.73, FR-37) ; **Assistant**, plus tard (FR-53) ; **Affilié**, sans compte (Glossaire l.133) ; **parent d'un mineur**, qui peut demander un retrait de photo (FR-39, FR-40).

### 1.2 Segments cibles (non nommés)
- Brief §« Pour qui » (l.42-47) : l'otaku africain qui fabrique (cible première des kits ; jeune, budget serré, mobile money) ; l'otaku de Goma ou Bukavu qui achète prêt à porter ; le cosplayeur international (cible seconde, carte, en anglais) ; Jonathan administrateur.
- PRD §2.1 JTBD (l.30-35) : incarner son personnage ; « c'est moi qui l'ai fait » ; être vu et reconnu ; payer simplement ; retrouver la communauté en vrai ; pour Jonathan, vendre sans y passer ses nuits.
- Non-utilisateurs au lancement (PRD §2.2 l.39-41) : clients physiques hors Goma et Bukavu (on leur propose le Kit), revendeurs, chercheurs de produits sous licence.
- Âge : Compte réservé aux 13 ans et plus ; de 13 à 17 ans, **Compte mineur** (PRD Glossaire l.103-104 ; FR-12).

### 1.3 Contexte d'usage
- **Appareil** : téléphone d'abord, 375 px (CLAUDE règle 7 ; PRD NFR-1 l.468) ; « téléphone moyen, en 4G » (FR-1 l.147).
- **Navigateur** : navigateurs intégrés d'Instagram, Facebook et TikTok (FR-3 l.158 ; UJ-4) ; Google OAuth refusé dans ces navigateurs (PRD-add l.26-28).
- **Réseau** : 4G pour le héros (FR-1) ; 3G et connexion lente pour la vidéo de kit (FR-29 l.312 ; UJ-2) ; coupures possibles côté admin, avec téléversement repris (FR-50 l.436) ; coupure pendant l'Événement, avec Scan hors ligne (FR-36).
- **Pays** : RDC d'abord (Goma, Bukavu, Kinshasa), Afrique, puis l'international pour les Kits (CLAUDE « Le produit » ; Brief l.12).
- **Canaux d'arrivée** : groupe WhatsApp de plus de 170 otakus, festival, pub Instagram, TikTok, influenceurs, affiche, blog (PRD §1 l.22 ; UJ-1, UJ-2, UJ-4, UJ-5). ⚠ Le Brief-add (l.47) et le PRD R-8 (l.545) indiquent qu'il n'existe **pas encore de comptes TikTok ni Instagram**.

---

## 2. Parcours déjà décrits

### UJ-1 — Grâce, Bukavu, cosplay sur mesure (PRD l.47-51)
1. Vidéo de fabrication sur TikTok, puis la fiche du cosplay, sur téléphone.
2. Hésite entre « Prêt à porter » et « Le fabriquer moi-même » ; choisit Prêt à porter, en **Sur-mesure**.
3. Saisit ses Mesures **avec le schéma**.
4. Bukavu : livraison obligatoire et payante (forfait Bukavu). (À Goma, choix entre retrait gratuit et livraison.)
5. Adresse dans un **champ libre**.
6. Le Panier affiche le prix, le forfait Bukavu et le **délai total** (fabrication + livraison).
7. Crée son **Compte avant de payer**, puis revient à son Panier.
8. Paie par M-Pesa ; le serveur choisit l'agrégateur ; **un autre est proposé en cas d'échec** ; elle valide sur son téléphone.
9. Jonathan vérifie les Mesures, la contacte en cas de doute et corrige.
10. Email à chaque étape : payée, en fabrication, expédiée (avec numéro de suivi s'il existe), livrée.
11. Pose une question avec le **bouton WhatsApp de la page de suivi**.
12. À la livraison, invitation à partager une photo (WhatsApp ou site) ; accord explicite ; affichage ou non du prénom ou pseudo et de la ville ; validation par Jonathan ; retrait possible à tout moment.
- Cas limite : annulation possible seulement avant le début de la fabrication.

### UJ-2 — Patrick, Kinshasa, kit (PRD l.53-55)
1. Pub ou influenceur avec Code promo.
2. Ajoute un Kit au Panier **sans Compte**.
3. Avant de payer, crée son Compte « en quelques secondes » avec un **code reçu par email**, puis revient exactement où il était.
4. Code promo : réduction en pourcentage sur le premier achat.
5. Paie par Airtel Money.
6. Le Kit s'ouvre aussitôt dans « Ma bibliothèque ».
7. Télécharge les patrons A4, sans limite, y compris sur un nouveau téléphone.
8. Regarde la Vidéo chapitre par chapitre, en **qualité adaptative** ; le lendemain, **reprend** là où il s'était arrêté.
9. S'il a consenti, reçoit des Relances (tous les 2 à 3 jours, 90 jours au plus, avec désinscription).
10. Envoie sa Réalisation ; s'il est parmi les 10 premiers, il gagne un Pass gratuit.

### UJ-3 — Amina, étrangère, kit par carte (PRD l.57-58)
1. Repère un Accessoire ; **avant l'ajout au Panier**, la fiche la prévient (remise à Goma et Bukavu seulement) et propose le Kit correspondant.
2. Achète le Kit et le paie par carte via Polar (Panier 100 % numérique).

### UJ-3b — Client de Goma, panier mixte par carte (PRD l.60-61)
Kit + Accessoire, puis carte : **Polar n'apparaît pas**, la carte passe par K-Pay.

### UJ-4 — Kevin, 19 ans, Goma, page d'accueil (PRD l.63-69)
1. Pub Instagram de 6 s (plastron en mousse découpé, peint, porté). Aucune franchise nommée.
2. **Les 3 premières secondes** : vidéo courte en boucle, sans son, plein écran (mains de Jonathan qui découpent, peignent, ajustent, puis costume porté en pleine lumière, de face, cape en mouvement) ; phrase « Deviens ton personnage. » ; boutons « Le porter » / « Le fabriquer moi-même ». Émotion visée : « C'est fait ici ? À Goma ? », puis la surprise et l'envie.
3. **Défilement** : même costume sur deux colonnes (porté, avec prix et délai / en pièces sur l'établi, avec prix du Kit) ; Cosplays « Fait main à Goma » ; Kits ; « Ils l'ont porté » (« Moi aussi, je veux être sur ce mur ») ; prochain Événement + « Me prévenir » ; Jonathan à l'atelier en trois phrases ; guides ; FAQ courte.
4. **Le moment où il craque** : « Le fabriquer moi-même » (budget, fierté).
5. Navigateur intégré : invitation à ouvrir dans Chrome, sinon code par email ; achète un Kit par mobile money.
6. Partage la fiche sur WhatsApp (aperçu : grande photo et titre) ; « Me prévenir » pour l'Événement.
7. À l'Événement, envoie sa photo ; elle apparaît dans « Ils l'ont porté ».
- Jour du lancement : bloc Kit gratuit et Galerie **masqués** sans vrai contenu ; Kit gratuit à partir de la 5ᵉ semaine.

### UJ-5 — Divine, 23 ans, Goma, pass (PRD l.71-74)
1. Découverte par l'Alerte « Me prévenir », le blog, Instagram ou une affiche.
2. Page Événement : date, lieu, programme, photos.
3. Compare les trois Types de pass : Standard, VIP, Stand (deux personnes).
4. Prend un Pass Stand (elle et son aide) et un Pass Standard (sa sœur).
5. Son Pass reprend les informations de son Compte ; elle **saisit le nom** de son aide et de sa sœur.
6. Accepte la mention sur la publication des photos et vidéos.
7. Paie **à part** (mobile money ou carte K-Pay).
8. Reçoit aussitôt par email trois Pass nominatifs avec Code QR, qu'elle retrouve aussi dans son profil ; c'est elle qui les transmet.
9. Jour J : un bénévole scanne ; l'écran affiche le Type de pass ; bracelet selon le type ; un Pass déjà scanné est refusé.
10. Après l'Événement : email avec le lien de la Galerie d'événement ; retrait de photo possible.
- Cas limite : annulation jusqu'à 48 h avant, validée par Jonathan, avec des frais en pourcentage retenus.

### UJ-6 — Jonathan, admin (PRD l.76-78)
Ouvre l'admin le matin : d'abord les nouvelles Commandes payées, puis les graphiques de paiement et les tâches en attente (Mesures, annulations, remboursements, remplacements, photos). Vérifie les Mesures et fait avancer les Commandes ; ajoute un Cosplay avec son Kit lié ; publie un Article ; crée un Événement avec ses trois Types de pass ; crée un Code promo et consulte ses ventes et sa commission ; la veille de l'Événement, crée un Accès bénévole.

### Parcours secondaires (Guide)
- Fonction cœur (Guide l.61) : trouver un costume, choisir prêt à porter ou kit, payer, puis recevoir le kit ou suivre la fabrication.
- Accueil, phase 2 (Guide l.388) : trois étapes « Choisis → Paie par mobile money ou carte → Reçois ou fabrique » (⚠ absent du PRD FR-2, voir §9).

---

## 3. Inventaire des surfaces

### 3.1 Public (vitrine)
| Surface | Ce qu'elle doit permettre | Source |
|---|---|---|
| **Accueil** | Héros vidéo plein écran (photo de repli), « Deviens ton personnage. », boutons « Le porter » / « Le fabriquer moi-même » vers le Cosplay vedette et son Kit lié. 8 blocs dans l'ordre : (1) « Prêt à porter ou fait par toi », deux colonnes ; (2) Cosplays « Fait main à Goma » ; (3) Kits, avec Kit gratuit en évidence ; (4) Galerie « Ils l'ont porté » ; (5) prochain Événement + « Me prévenir » ; (6) créateur en 3 phrases ; (7) guides ; (8) FAQ courte. Blocs vides masqués. | PRD FR-1, FR-2 l.145-155 |
| Bandeau « Ouvrir dans Chrome » | Invitation non bloquante dans les navigateurs intégrés ; bouton Google masqué | FR-3 l.157-159 |
| À propos | Portrait, histoire, atelier à Goma ; héros « Un seul créateur. Chaque pièce faite main. » + « Écrire sur WhatsApp » | FR-4 ; Guide l.202, l.389 |
| FAQ | Paiement, livraison, délais (JSON-LD FAQPage) | FR-2 (8), FR-4 ; FR-56 |
| Contact | Formulaire + bouton WhatsApp | FR-4 l.162 |
| Pages légales | Mentions légales, CGV, livraison et retours, confidentialité (textes fournis par Jonathan, Q-5) | FR-4 ; Guide l.600-606 |
| Catalogues Cosplays / Accessoires / Kits | Grille, filtres (univers, prix, disponibilité, niveau pour les Kits), tri (nouveauté, prix) | FR-5 l.170-171 |
| Pages univers `/univers/[slug]` | Mentionnées par le Guide (l.221, l.407) ; ⚠ pas de FR dédiée dans le PRD (l'univers n'y est qu'un filtre) | Guide |
| Fiche Produit physique | Galerie de photos avec zoom mobile, titre, prix USD, description, tailles XS à XXL ou Sur-mesure, disponibilité, Modes de remise et forfaits, délai total ; message « Remise uniquement à Goma et Bukavu » + Kit lié **avant l'ajout au Panier** ; bouton de partage | FR-6, FR-7, FR-8, FR-10, FR-57 |
| Fiche Kit | Contenu (fichiers, formats), plan des chapitres, extrait vidéo public, niveau, matériel, prix, résumé de la Licence ; « Ouvrir dans ma bibliothèque » si déjà possédé ; « Obtenir » le Kit gratuit d'un clic (connecté) | FR-9, FR-58 |
| Produits liés (même univers) | Sur la fiche | Guide l.416 (⚠ absent du PRD) |
| Liste des Événements + page Événement | Date, lieu (salle ou plein air), programme, photos, Types de pass avec prix et avantages ; « Complet » ; Événement passé avec lien de la Galerie d'événement ; bouton de partage | FR-31, FR-57 |
| Alerte « Me prévenir » | Inscription par email, par Compte ou par numéro WhatsApp ; consentement ; désinscription | FR-32 |
| Galerie « Ils l'ont porté » | Photos validées ; prénom ou pseudo et ville si autorisés (jamais la ville pour un mineur) | FR-2 (4), FR-40, FR-41 |
| Blog : liste + Article | Lecture ; liens vers Produits et Événements ; FR obligatoire, EN facultatif | FR-43 |
| Page 404 soignée | | Guide l.368 |
| En-tête / pied de page | Guide : logo, Cosplays, Accessoires, Kits, À propos, panier avec compteur, compte, menu ☰ sur mobile ; pied : légal, contact, WhatsApp, réseaux, moyens de paiement ; bascule de thème. ⚠ Le PRD ne définit pas la navigation (Événements et Blog n'y figurent pas chez le Guide). | Guide l.383-385 |

### 3.2 Panier, Compte, commande, paiement
| Surface | Ce qu'elle doit permettre | Source |
|---|---|---|
| Panier | Sans Compte ; modifier et retirer ; Kit limité à 1 exemplaire, impossible s'il est déjà possédé ; jamais de Pass ; fusion à la connexion ; article épuisé signalé | FR-11 ; Guide l.462-463 |
| Création de compte / connexion | Code à 6 chiffres par email (partout) ou Google (hors navigateurs intégrés) ; retour à la page et au Panier d'origine ; âge déclaré (refus sous 13 ans ; Compte mineur de 13 à 17 ans) | FR-12 |
| Accueil après création (onboarding) | 3 questions facultatives : « Comment nous as-tu connus ? », « Quel univers préfères-tu ? », « Tu préfères porter ou fabriquer ? » (choix détaillés : Guide l.543-545) | FR-12 l.207 |
| Étape de commande | Téléphone ; Zone de remise (Goma ou Bukavu) ; à Goma seulement, Mode de remise (retrait gratuit ou livraison) ; adresse en champ libre si livraison ; rien de tout cela pour un Panier 100 % numérique ; cases CGV / Kit (accès immédiat, renonciation, Licence) / Sur-mesure ; Code promo | FR-13, FR-47 |
| Récapitulatif avant paiement | Prix par article en USD, forfait, réduction, total USD, délai total par Produit physique | FR-14 |
| Choix du moyen de paiement | Mobile money (pays + opérateur + numéro) ou carte ; seuls les Prestataires autorisés sont proposés ; message si aucun Agrégateur ne couvre le couple | FR-16 |
| Attente de validation mobile money | « Valide le paiement sur ton téléphone » | Guide l.493 (phase 6, périmée sur les prestataires mais décrit l'état) |
| Proposition de repli | Réessayer avec l'Agrégateur suivant après un échec confirmé | FR-17 |
| Page de retour après paiement | État réel lu côté serveur : payée, en attente (« paiement en cours de vérification »), échouée (réessayer + WhatsApp) | FR-20 ; Guide `/merci` l.501 |

### 3.3 Espace client (Compte)
| Surface | Ce qu'elle doit permettre | Source |
|---|---|---|
| Mes commandes + détail / suivi | Frise des Statuts avec dates, numéro de suivi, bouton WhatsApp ; demande d'annulation (Cosplay, avant fabrication) ; réclamation sous 48 h après la livraison | FR-22, FR-25, FR-26 ; Guide l.525 |
| **Ma bibliothèque** | Kits achetés avec leur progression | FR-27 ; Guide l.517 |
| Page d'un Kit en bibliothèque / **lecteur vidéo** | Téléchargement par fichier (PDF A4 / US Letter, SVG, STL), sans limite, avec filigrane ; lecteur à chapitres cliquables, qualité adaptative, sans bouton de téléchargement, reprise sur tout appareil | FR-28, FR-29, FR-30 ; Guide l.518 |
| Mes Pass (profil) | Pass avec Code QR ; demande d'annulation jusqu'à 48 h avant | FR-34, FR-38 |
| Achat de Pass (hors Panier) | Choix des Types et des quantités ; nom de chaque autre personne ; mention photos et vidéos ; paiement mobile money ou K-Pay | FR-33 |
| Envoi d'une photo / Réalisation | Dépôt ; accord explicite ; choix d'afficher le prénom ou pseudo et la ville ; demande de retrait | FR-40, FR-41, FR-42 |
| Consentements et désinscription | Emails commerciaux, Alertes | FR-32, FR-45, FR-59 |

### 3.4 Événement sur place
| Surface | Ce qu'elle doit permettre | Source |
|---|---|---|
| Écran de Scan | Affiche le nom, l'Événement et le Type de pass, ou un refus avec sa raison (déjà scanné, annulé, autre Événement) | FR-35 |
| Mode hors ligne | Prendre le Verrou hors ligne ; les autres appareils affichent « scan réservé à l'appareil hors ligne » ; synchronisation au retour du réseau ; libération forcée par l'Admin | FR-36 |
| Accès bénévole | Scan seul, le jour J seulement | FR-37 |

### 3.5 Admin (mobile et ordinateur, FR-49 l.427)
Tableau de bord (Commandes payées d'abord, graphiques, tâches, indicateurs) ; liste et détail des Commandes avec filtres et avancement des statuts ; vérification des Mesures ; Produits (photos ordonnées, alt obligatoire, variantes, délais, Kit lié, fichiers et vidéo avec progression et reprise, éditeur de chapitres) ; Réglages ; Prestataires (activation, ordre de priorité, couverture) ; Événements et Pass vendus / scannés ; Accès bénévole ; Galerie et Réalisations (validation) ; Blog ; Codes promo (ventes, commission) ; Trop-perçus ; export des numéros WhatsApp. Rôle Assistant plus tard. Sources : FR-21, FR-23, FR-24, FR-32, FR-37, FR-41, FR-42, FR-43, FR-46 à FR-53 ; Guide phase 4.

### 3.6 Emails (surfaces hors site)
Transactionnels (payée, en fabrication, expédiée, livrée avec « Montre-nous ton costume », annulée, remboursée, Kit ouvert, Pass émis, code de connexion) ; commerciaux (Relances, panier abandonné à 1 h et 24 h, rappels de Kit à 2 et 7 jours, nouveau produit dans l'univers, annonce d'Événement, lien de la Galerie d'événement). « Un seul bouton par email » (Guide l.547). Langue du client (FR-55). Sources : FR-39, FR-44, FR-45, FR-59.

### 3.7 Aperçu de partage (Open Graph)
Grande photo + titre sur WhatsApp et les réseaux (FR-57 ; Guide l.223).

---

## 4. Exigences fonctionnelles à impact UX

- **Double option Cosplay / Kit lié** : la fiche d'un Cosplay qui a un Kit lié propose « Le porter » et « Le fabriquer moi-même » ; la seconde option affiche le prix du Kit et mène à sa fiche (FR-7 ; Glossaire « Kit lié » l.87). Libellés divergents : voir §9.
- **Héros** : mène en un geste à la fiche (option Prêt à porter) ou au Kit lié du Cosplay vedette choisi dans l'admin (FR-1 l.150).
- **Bloc deux colonnes** sur l'accueil : porté (prix + délai) / en pièces (prix du Kit) (FR-2).
- **Tailles et Sur-mesure** : XS à XXL ou Sur-mesure ; Mesures avec un schéma d'aide ; ajout au Panier bloqué sans Mesures complètes ; non modifiables après le paiement (FR-6, FR-8). Champs du Guide : poitrine, taille, hanches, hauteur, notes (Guide l.72).
- **Disponibilité** : « En stock » ou « Fabrication sur commande » avec le Délai de fabrication ; stock à zéro → sur commande ; Plafond atteint → « Épuisé » / « Commandes complètes pour le moment » + Kit lié ; les articles en stock restent vendables (FR-6, FR-10).
- **Délai total affiché avant paiement** (fabrication + remise), sur la fiche, au Panier et au récapitulatif (FR-6, FR-14 ; UJ-1 ; CLAUDE). Exemple du Guide : « Fabriqué sous 12 jours, livré en moins d'un jour à Bukavu » (l.175).
- **Remise** : Goma (retrait gratuit ou livraison payante) ; Bukavu (livraison obligatoire) ; forfait par ville ; adresse en champ libre ; aucun champ pour un Panier 100 % numérique (FR-13 ; Glossaire l.97-99).
- **Avertissement de zone** « Remise uniquement à Goma et Bukavu », montré à tous, sans détection du pays, **avant** l'ajout au Panier, avec le Kit lié proposé (FR-6 ; §12).
- **Compte obligatoire juste avant le paiement**, Panier sans compte, retour exact à l'endroit quitté (FR-11, FR-12).
- **Cases à cocher** : CGV ; Kit (accès immédiat, renonciation à la rétractation, Licence ; non remboursable) ; Sur-mesure (Mesures confirmées ; pas d'annulation après le début de la fabrication) (FR-13).
- **Paiement visible par l'utilisateur** : le client choisit mobile money (pays + opérateur + numéro) ou carte (FR-16). Panier avec Produit physique ou mixte + carte → K-Pay, **Polar jamais proposé** ; Panier 100 % numérique + carte → Polar ; Pass + carte → K-Pay ; couple non couvert → message et invitation à choisir un autre opérateur ou la carte (FR-16 ; CLAUDE règle 10). Le nom du prestataire est-il montré au client ? Les sources ne le disent pas (voir §8).
- **Repli** : proposé seulement après un échec confirmé par l'Agrégateur ; jamais après un délai dépassé (« paiement en cours de vérification ») ; échec dû au client (refus, solde insuffisant, abandon) → réessayer, sans bascule ; une seule Tentative à la fois (FR-17).
- **Prix toujours en USD**, identiques partout ; la conversion est faite par le prestataire (CLAUDE ; PRD §4.4 point 5). Guide : « le montant affiché est exactement celui débité » (l.163) ; voir la tension avec Q-3 au §8.
- **Code promo** : un seul ; premier achat ; hors livraison ; s'applique aussi aux Pass (FR-47).
- **Kits** : accès à vie, mises à jour comprises ; téléchargements illimités ; filigrane PDF ; vidéo en ligne seulement, par chapitres, avec reprise ; « Ouvrir dans ma bibliothèque » si déjà possédé ; un exemplaire par Panier (FR-9, FR-11, FR-27 à FR-30).
- **Kit gratuit** (à partir de lancement + 4 semaines) : un clic depuis la fiche, connecté, sans Panier ; une seule fois par Compte (FR-58 ; §6.2 « Ton premier accessoire, offert. »).
- **Pass** : achat séparé du Panier ; Pass Stand = 2 Pass nominatifs ; noms à saisir ; mention photos ; « Complet » ; QR par email et dans le profil (FR-31, FR-33, FR-34).
- **Galerie** : accord explicite, choix d'affichage, validation, retrait ; règles propres aux mineurs (FR-40, FR-41).
- **Opération « 10 pass gratuits »** pour les Réalisations (FR-42).
- **Partage** : bouton sur chaque fiche et chaque Événement (FR-57).
- **WhatsApp** omniprésent : Contact, suivi, échec de paiement, À propos (FR-4, FR-20, FR-22 ; Guide l.163).
- **Thème** : sombre par défaut, mode clair mémorisé (PRD §10 ; Guide l.190, l.385).

---

## 5. Contraintes non fonctionnelles UX

- **Mobile d'abord** : 375 px, sans défilement horizontal ; pensé pour le navigateur intégré d'Instagram (CLAUDE règle 7 ; NFR-1).
- **Performance** : héros en moins de 2,5 s (4G, navigateur intégré, téléphone moyen), photo de repli ; Core Web Vitals au vert ; Lighthouse mobile ≥ 90 (performance, accessibilité, SEO) sur l'accueil (FR-1, NFR-2 ; Guide l.213, l.398). Vidéo de kit en 3G : seuil fixé par l'architecte (FR-29). Signal d'alerte SM-C6 : héros chargé en plus de 2,5 s.
- **Accessibilité** : contraste suffisant (y compris le texte sur photo, Guide l.213, l.397) ; texte alternatif sur chaque image (obligatoire pour publier, FR-50) ; navigation au clavier ; vidéo du héros sans son et sans information indispensable (CLAUDE règle 7 ; NFR-3) ; un seul H1 par page (FR-56).
- **i18n** : /fr et /en ; aucun texte en dur ; emails dans la langue du client ; Articles en FR, EN facultatif (absents de /en sans traduction) (CLAUDE ; FR-55, FR-43) ; hreflang (FR-56).
- **SEO** : titre et description uniques, URL lisible, Open Graph, JSON-LD (Product/Offer, Event, Article, BreadcrumbList, Organization, FAQPage, VideoObject), sitemap, robots.txt, canonique (CLAUDE règle 8 ; FR-56). Gabarit de titre du Guide : « [Titre] — cosplay fait main, prêt à porter | KOMA SHOP » (l.222). Brouillon introuvable (FR-5).
- **Honnêteté** : aucun avis, chiffre, logo ou témoignage inventé ; blocs vides masqués ; aucun état simulé (payé, email envoyé) (CLAUDE règles 5 et 13 ; FR-2, FR-20, FR-44 ; NFR-8). La page n'affiche jamais « payée » avant la notification vérifiée (FR-20).
- **Propriété intellectuelle** : aucune image, aucun logo et **aucun nom** de franchise sur tout le site ; seulement les photos du créateur (CLAUDE règle 6 ; FR-4 l.164 ; UJ-4 l.64). Guide : clins d'œil manga jamais sur une photo produit (l.192).
- **Sécurité visible** : aucun lien vers `kits-private` dans le HTML ; pas de bouton de téléchargement vidéo (FR-9, FR-29).
- **Confidentialité** : mesure d'audience avec consentement, de préférence sans cookies (FR-54) ; mineurs : jamais la ville affichée (FR-40).
- **Traçabilité** dans l'admin : actions horodatées avec leur auteur (NFR-9).

---

## 6. Marque, ton, style visuel

- **Nom** : KOMA SHOP ; domaine komashop.com (disponibilité non vérifiée : Brief l.78, Q-10).
- **Promesse** : « fait par un otaku, pour les otakus » (PRD §10 ; Guide l.181). « Il vend la fierté de devenir son personnage » ; le visiteur trouve le site « si beau qu'il a envie de fabriquer son cosplay » (PRD §1 l.20).
- **Accroche principale** : « Deviens ton personnage. » (FR-1 ; Guide l.198).
- **Micro-copies existantes** : « Le porter » / « Le fabriquer moi-même » ; « Prêt à porter » ; « Fait main à Goma » ; « Prêt à porter ou fait par toi » ; « Ils l'ont porté » ; « Moi aussi, je veux être sur ce mur » (pensée de Kevin) ; « Me prévenir » ; « Ouvrir dans Chrome » ; « Ouvrir dans ma bibliothèque » ; « paiement en cours de vérification » ; « Épuisé » / « Commandes complètes pour le moment » ; « Complet » ; « scan réservé à l'appareil hors ligne » ; « Ton premier accessoire, offert. » ; « Commence le chapitre 1 ». Héros du Guide (l.196-202) : Cosplays « Prêts à porter, faits main à Goma » ; Kits « Fabrique-le toi-même, pas à pas » ; Accessoires « La pièce qui manquait à ton costume » ; À propos « Un seul créateur. Chaque pièce faite main. » ; sous-titre d'accueil « Cosplays faits main, prêts à porter ou à fabriquer toi-même. » Emails : « Montre-nous ton costume », « Reprends au chapitre [n] » (Guide l.548-549).
- **Ton** : tutoiement, phrases courtes, vocabulaire de la communauté (cosplay, con, WIP, props), sans jargon de vendeur (PRD §10 ; Guide l.204).
- **Direction visuelle proposée** (Guide l.188-192, reprise dans PRD §10, « à ajuster avec le dépôt de référence design, encore à fournir ») :
  - mode sombre par défaut, mode clair mémorisé ;
  - une ou deux couleurs d'accent vives pour les boutons et les prix (**aucune couleur précise n'est donnée**) ;
  - une police d'affichage expressive pour les titres, une police de texte très lisible (**aucune police nommée**) ;
  - clins d'œil manga en décor léger (trames, cadres de cases, traits de vitesse), jamais sur une photo produit.
- **Photographie** (Guide l.181, l.206-211) : vraies photos en grand, héros plein écran ; pour chaque produit : face, dos, profil, détail et photo portée en action ; lumière naturelle ou douce, fond simple, même cadrage pour tout le catalogue ; coulisses de fabrication ; portrait à l'atelier. Héros vidéo : mains, découpe, peinture, puis costume porté « en pleine lumière, de face, la cape en mouvement » (UJ-4).
- **Référence d'inspiration** : « dépôt GitHub de référence design » pour les composants, espacements et style : **non fourni** (CLAUDE « [LIEN DU DÉPÔT DE RÉFÉRENCE] » ; Guide l.186 ; Q-10). Le Guide s'inspire aussi du « guide SwitchPro » pour la méthode, pas pour le visuel.
- **Logo** : mentionné dans l'en-tête (Guide l.383) ; **aucune description ni fichier**.
- **Confiance sans rien inventer** : photos réelles, atelier, WhatsApp visible, délai annoncé ; Guide : « réponse sous 24 h » (l.612, ⚠ absent du PRD) ; idées physiques : étiquette cousue, carte avec un QR code vers la galerie dans chaque colis (Guide l.622, hors site).

---

## 7. États et cas limites

**Produit et stock**
- En stock / Fabrication sur commande avec délai / stock à zéro mais Plafond non atteint / Plafond atteint (« Épuisé », Kit lié, articles en stock toujours vendables) (FR-10).
- Brouillon introuvable (FR-5).
- Visiteur hors zone : avertissement + Kit lié (FR-6).
- Kit déjà possédé : « Ouvrir dans ma bibliothèque » ; ajout au Panier impossible (FR-9, FR-11).
- Mesures incomplètes : ajout au Panier bloqué (FR-8).
- Article épuisé dans le Panier : signalé (Guide l.463) ; stock et Plafond revérifiés côté serveur au paiement (FR-10, FR-13).

**Compte**
- Moins de 13 ans : refus ; de 13 à 17 ans : Compte mineur (FR-12).
- Navigateur intégré : Google masqué, invitation Chrome, code email (FR-3, FR-12).

**Commande et paiement**
- Statuts : en attente → payée → en fabrication → expédiée → livrée ; échouée, expirée, annulée, remboursée, offerte ; Panier 100 % numérique : payée → livrée (Glossaire l.107).
- Commande en attente : réserve le stock et la place pendant le Délai de paiement, puis passe `expirée` (FR-13).
- Aucun Agrégateur ne couvre le couple : message, autre opérateur ou carte (FR-16).
- Agrégateur désactivé ou échec confirmé : proposition du suivant (FR-17).
- Délai dépassé ou réponse ambiguë : « paiement en cours de vérification », pas de repli, pas de bouton repayer (FR-17, FR-20).
- Échec dû au client : réessayer, sans bascule (FR-17).
- Une seule Tentative en cours à la fois (FR-17).
- Échec sans autre Tentative en cours : `échouée`, possibilité de repayer (FR-19).
- Trop-perçu (payé deux fois, payé après expiration, article vendu entre-temps, Événement passé, Code promo épuisé) : statut inchangé, Admin alerté, remboursement (FR-19). ⚠ Ce que voit le client dans ce cas n'est pas décrit.
- Code promo refusé (inactif, plafond atteint, pas un premier achat) (FR-47) : message non décrit.

**Après l'achat**
- Annulation d'un Cosplay : possible avant `en fabrication`, ensuite plus proposée ; `annulée`, puis `remboursée` avec preuve (FR-25).
- Réclamation : sous 48 h après la livraison, ensuite plus proposée en ligne ; remplacement, pas de remboursement (FR-26).
- Sur-mesure : Mesures à vérifier ; pas de passage `en fabrication` sans validation (FR-23).
- Numéro de suivi facultatif, en texte libre (FR-24).
- Kits jamais remboursables (FR-13, FR-26).

**Kits**
- Reprise de la lecture ; qualité adaptative ; 3G ; progression ; changement d'appareil (FR-29, UJ-2). Guide : position enregistrée toutes les 15 s, vidéo terminée à 90 % (l.518, à confirmer).

**Événements et Pass**
- « Complet » quand la Capacité est atteinte ; pas de limite sans Capacité (FR-31).
- Événement passé : consultable, avec le lien de sa Galerie (FR-31).
- Scan : valide, déjà scanné, annulé, autre Événement (refus avec raison) ; appareil non verrouillé (« scan réservé… ») ; hors ligne sans verrou (impossible) ; Scans non synchronisés signalés après libération forcée (FR-35, FR-36).
- Pass : valide → scanné ; annulé ; remboursé ; offert (valide dès l'émission) (Glossaire l.121) ; annulation jusqu'à 48 h avant, avec frais (FR-38).
- Accès bénévole expiré après le jour J (FR-37).

**Contenu**
- Blocs d'accueil vides masqués (Kit gratuit, Galerie, Événement, Article) (FR-2).
- Article sans version EN : absent sous /en (FR-43).
- Photo de Galerie : en attente de validation, publiée, retirée (FR-41).
- Opération « 10 pass gratuits » : compteur arrêté à 10 (FR-42).

**Admin**
- Publication refusée sans prix, photo, alt ou fichier de Kit (FR-50).
- Téléversement interrompu puis repris (FR-50).

---

## 8. Questions ouvertes et éléments manquants pour l'UX

Issues des sources :
- **Q-10 Ressources** : dépôt de référence design, photos et vidéo du héros, numéro WhatsApp, réseaux sociaux, domaine. **Bloquant pour DESIGN.md** : aucune palette, aucune police ni aucun logo n'existe (PRD l.576).
- **Q-11 Ordre d'affichage des moyens de paiement** : mobile money d'abord pour tous, ou selon le pays ? (PRD l.577 ; le Guide l.163 proposait selon la provenance du visiteur.)
- **Q-3 Devise débitée** : quel montant afficher au moment de valider si le prestataire convertit ? (PRD l.568) ; tension avec « le montant affiché est exactement celui débité » (Guide l.163) et « le site n'affiche que l'USD » (CLAUDE).
- **Q-1 Couverture** : liste des pays et opérateurs du sélecteur mobile money (PRD l.566).
- **Q-9 Numéro de suivi** : nature pour Bukavu (PRD l.574) ; influe sur l'affichage de la frise.
- **Q-5 Textes légaux** : contenu des cases à cocher, de la mention photos, du règlement « 10 pass » (PRD l.570).
- **Q-4 Remboursement** : délais et messages côté client (PRD l.569).
- **Q-12 Montants** : saisis dans l'admin, jamais dans le code.

Non tranchés par les sources (à demander à Jonathan) :
- Structure de la **navigation principale** : Événements, Blog et Galerie dans le menu ? (Guide l.383 : seulement Cosplays, Accessoires, Kits, À propos.)
- **Libellé exact de la double option** (« Le porter » ou « Prêt à porter ») : voir §9.
- **Nom du prestataire affiché** au client : par exemple « Carte (K-Pay) » ou simplement « Carte ».
- **Comportement du sélecteur pays + opérateur** : pré-remplissage ? détection ? (Le PRD interdit la détection pour l'avertissement de zone seulement.)
- **Schéma d'aide aux Mesures** : liste exacte des mesures (Guide : poitrine, taille, hanches, hauteur, notes ; le PRD ne la donne pas) et illustration à produire.
- **Délai total** : format (jours ouvrés ? fourchette ?) ; délai Goma « moins d'un jour » (CLAUDE) contre « à préciser » (Guide l.171).
- Écran de **Trop-perçu** ou de Commande impossible à honorer côté client.
- **Filtres « univers »** : liste des univers (le Guide donne : anime, manga, jeu vidéo, fantasy, science-fiction, personnages originaux, l.544) ; existence ou non de pages `/univers/[slug]`.
- **Niveau des Kits** : échelle non définie.
- **Durée du Délai de paiement** et affichage d'un compte à rebours.
- **Écran de Scan** : appareil (téléphone du bénévole ?), retour sonore ou visuel, codes couleur par Type de pass.
- **Kit gratuit** : bouton « Obtenir gratuitement » (Guide) ; la page Kits du Guide met « Obtenir le kit gratuit » en bouton du héros, ce qui n'est pas possible au lancement.
- Emplacement de la **bascule FR / EN** et du thème.
- Formulaire « Me prévenir » : un seul champ multi-canal ou trois options ?

---

## 9. Contradictions entre les sources

| # | Sujet | Versions | Statut |
|---|---|---|---|
| C-1 | **Libellé de la double option** | CLAUDE : « Prêt à porter » / « Le fabriquer moi-même » ; PRD FR-7, FR-1, Glossaire l.87 : « Le porter » / « Le fabriquer moi-même » ; PRD UJ-1 l.48 : « Prêt à porter » ; Guide l.99, l.413 : « Prêt à porter » / « Le fabriquer moi-même (kit) » | **Non tranché** ; le PRD lui-même est incohérent. Hypothèse possible : « Le porter » pour les boutons et « Prêt à porter » comme nom de l'option sur la fiche, **à confirmer**. |
| C-2 | Boutons du héros d'accueil | PRD FR-1 : « Le porter » / « Le fabriquer moi-même » ; Guide l.198 : « Voir les cosplays · Découvrir les kits » | PRD fait foi |
| C-3 | Blocs de l'accueil | PRD FR-2 : 8 blocs ordonnés ; Guide l.388 : héros, « Prêt à porter ou fait par toi », 6 derniers produits, trois étapes, FAQ | PRD fait foi (les « trois étapes » ont disparu) |
| C-4 | Message quand le Plafond est atteint | PRD FR-10 : « Épuisé » (ou « Commandes complètes pour le moment ») ; Guide l.26, l.412 : « Carnet de commandes complet » | PRD fait foi, mais il laisse deux libellés possibles |
| C-5 | Création de compte | Guide l.102, l.466 : compte créé automatiquement avec l'email au paiement ; Guide phase 1 l.364 : lien magique + Google ; PRD FR-12 + PRD-add l.28 : code à 6 chiffres, compte explicite avant le paiement, lien magique écarté | PRD fait foi |
| C-6 | Case Sur-mesure | Guide l.469 : « ne peut être ni reprise ni échangée » ; PRD FR-13 : confirme les Mesures + pas d'annulation après le début de la fabrication | PRD fait foi |
| C-7 | Retours | Guide l.605 : pièce en stock retournable sous 14 jours ; kit remboursé si fichier illisible ; PRD FR-26 : remplacement seul sous 48 h, aucun remboursement du physique livré, Kits jamais remboursables | PRD fait foi |
| C-8 | Téléchargements de Kit | Guide l.90, l.521 : 10 au plus ; PRD FR-28 : illimités | Tranché (PRD-add l.47) |
| C-9 | Paiement | Brief l.29, l.63, l.69 et Guide l.152-159 : K-Pay pour tout, Polar plus tard ; PRD §4.4 + CLAUDE 9 à 11 : 4 agrégateurs, Polar dès le lancement pour les Paniers 100 % kits | Tranché (PRD) |
| C-10 | Périmètre du lancement | Brief l.69 : Kit gratuit, galerie, guides et affiliation exclus ; PRD §6.1 : Galerie, Blog, Codes promo et Événements inclus au lancement ; Kit gratuit à +4 semaines | Tranché (PRD-add l.45) |
| C-11 | Statut d'échec de paiement | Guide l.498 : `cancelled` ; PRD Glossaire : `échouée` | PRD fait foi |
| C-12 | Délai Bukavu / Goma | Brief l.28, Guide l.35, l.172 : Bukavu « moins d'un jour » ; CLAUDE et PRD §4.5 l.274 : Bukavu « un jour au plus », Goma « moins d'un jour » ; Guide l.171 : délai Goma « à préciser » | CLAUDE / PRD font foi |
| C-13 | Ordre des moyens de paiement | Guide l.163, l.490 : selon la provenance du visiteur ; PRD Q-11 : question ouverte | Non tranché |
| C-14 | Formats de Kit | CLAUDE et PRD : PDF, SVG, STL ; Brief l.26 et Brief-add l.24 : PDF et STL (pas de SVG) | PRD / CLAUDE font foi |
| C-15 | Héros de la page Kits | Guide l.200 : bouton « Obtenir le kit gratuit » ; PRD §6.2 : pas de Kit gratuit avant +4 semaines, bloc masqué sans contenu | PRD fait foi |
| C-16 | Pages univers | Guide l.221, l.407 : `/univers/[slug]` ; PRD : univers uniquement en filtre (FR-5) | Non tranché (risque de violer la règle 14 si elles sont ajoutées sans décision) |
| C-17 | Canaux TikTok / Instagram | PRD UJ-1 et UJ-4 supposent ces canaux ; Brief-add l.47 et PRD R-8 : comptes pas encore créés | Assumé par le PRD (R-8) |
| C-18 | Affiliation | Guide l.570 : lien `?ref=`, 60 jours, espace affilié dans le compte ; PRD FR-46 à FR-48 et §9 : Codes promo seulement, pas de compte affilié | Tranché (PRD-add l.48) |
| C-19 | Galerie « Réalisations » | Guide l.574 : photos liées au produit ; PRD : Galerie « Ils l'ont porté » + Réalisations (Kit) distinctes, Réalisations liées à l'opération « 10 pass » | PRD fait foi ; affichage des Réalisations sur la fiche produit non précisé |
| C-20 | Produits liés sur la fiche | Guide l.416 : « Produits liés (même univers) » ; PRD : absent | Non tranché |
