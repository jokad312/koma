---
status: draft
stepsCompleted: [1, 2, 3, 4]
storiesWritten: ['epic-1', 'epic-2', 'epic-3', 'epic-4', 'epic-5', 'epic-6', 'epic-7', 'epic-8', 'epic-9']
inputDocuments:
  - '_bmad-output/planning-artifacts/prds/prd-KOMA SHOP-2026-10-16/prd.md'
  - '_bmad-output/planning-artifacts/prds/prd-KOMA SHOP-2026-10-16/addendum.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-KOMA SHOP-2026-10-17/ARCHITECTURE-SPINE.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/EXPERIENCE.md'
  - 'docs/guide-koma-shop.md (contrôle seulement, ne crée aucune exigence)'
references:
  - 'CLAUDE.md (règles 1 à 15, prime sur tous les documents de planification)'
  - '_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/mockups/key-*.html (références visuelles, aucune exigence)'
---

# KOMA SHOP - Découpage en epics

## Vue d'ensemble

Ce document découpe en epics et en stories implémentables les exigences du PRD (et de son addendum), du spine d'architecture et de la conception UX (DESIGN.md + EXPERIENCE.md).

**Ordre de priorité en cas de désaccord :** PRD + addendum, ARCHITECTURE-SPINE.md, DESIGN.md + EXPERIENCE.md > CLAUDE.md > docs/guide-koma-shop.md. Les règles absolues 1 à 15 de `CLAUDE.md` restent des garde-fous : aucune story ne les contredit. Le guide sert uniquement de contrôle ; ses désaccords avec les documents finaux sont listés à part (« Désaccords relevés »), sans être tranchés ici.

Les termes en majuscule (Commande, Pass, Tentative de paiement…) sont ceux du Glossaire du PRD (§3). Aucun montant, délai ou tarif n'est fixé ici : ils sont saisis dans l'admin.

## Inventaire des exigences

### Exigences fonctionnelles

**§4.1 Page d'accueil et vitrine**

- **FR-1 Héros vidéo** : dès l'arrivée, un héros plein écran affiche une vidéo courte en boucle, sans son (fabrication puis costume porté), l'accroche « Deviens ton personnage. » et les boutons « Prêt à porter » et « Le fabriquer moi-même ». Affiché en moins de 2,5 s sur un téléphone moyen en 4G, dans le navigateur intégré d'Instagram ; photo plein écran de repli si la vidéo ne charge pas à temps ou n'est pas prise en charge ; vidéo, photo et Cosplay vedette choisis dans l'admin ; « Prêt à porter » mène à la fiche du Cosplay vedette (option présélectionnée), « Le fabriquer moi-même » à son Kit lié.
- **FR-2 Blocs de la page d'accueil** : dans cet ordre, (1) « Porte-le ou fabrique-le » (même costume sur deux colonnes : porté avec prix et délai, en pièces avec le prix du Kit), (2) Cosplays « Fait main à Goma », (3) Kits (Kit gratuit en évidence s'il existe), (4) Galerie « Ils le portent » (prénom et ville si autorisés), (5) « Rendez-vous otaku » (prochain Événement + « Me prévenir »), (6) « Jonathan et son atelier » en trois phrases, (7) guides (Articles), (8) FAQ courte. Un bloc sans contenu réel est masqué ; aucun contenu inventé ; la Galerie n'a pas de page dédiée (ancre `#galerie`) ; grands titres sans accent, en majuscules.
- **FR-3 Navigateur intégré** : dans le navigateur intégré d'une application (Instagram, Facebook, TikTok…), invitation non bloquante à « Ouvrir dans Chrome » (ou dans le navigateur du téléphone) ; bouton Google masqué.
- **FR-4 Pages vitrines** : À propos (« Jonathan et son atelier »), FAQ, Contact (formulaire + bouton WhatsApp), pages légales (mentions légales, CGV, livraison et retours, confidentialité) avec les textes fournis par Jonathan (Q-5). Aucune image ni aucun nom de franchise sur le site.

**§4.2 Catalogue et fiches produits**

- **FR-5 Catalogues** : catalogues Cosplays, Accessoires et Kits ; filtres (univers, prix, disponibilité, niveau pour les Kits) et tri (nouveauté, prix). Seuls les Produits publiés apparaissent ; un brouillon est introuvable (catalogue, plan du site, URL directe).
- **FR-6 Fiche d'un Produit physique** : galerie photo (zoom mobile), titre, prix USD, description, tailles XS à XXL ou Sur-mesure, disponibilité (« En stock » ou « Fabrication sur commande » + Délai de fabrication), Modes de remise et Forfaits de livraison, délai total (fabrication + remise). Avant l'ajout au Panier : « Remise uniquement à Goma et Bukavu », affiché à tous sans détection de pays, avec le Kit lié s'il existe.
- **FR-7 Double option Cosplay / Kit lié** : sur la fiche d'un Cosplay avec Kit lié, choix « Prêt à porter » ou « Le fabriquer moi-même » ; le second affiche le prix du Kit et mène à sa fiche.
- **FR-8 Sur-mesure** : saisie des Mesures avec un schéma d'aide ; ajout au Panier impossible sans Mesures complètes ; après paiement, le client ne modifie plus ses Mesures (l'Admin les corrige).
- **FR-9 Fiche d'un Kit** : contenu (Fichiers de kit et formats, plan des chapitres, extrait vidéo public, niveau, matériel), prix, résumé de la Licence de kit ; aucun lien vers `kits-private` ; Kit déjà possédé → « Ouvrir dans ma bibliothèque ».
- **FR-10 Stock et Plafond de fabrication** : la quantité saisie pour les articles fabriqués diminue à chaque Commande payée ; stock à zéro et Plafond non atteint → Fabrication sur commande avec délai ; Plafond atteint → « Commandes complètes pour le moment » (jamais « Épuisé ») + Kit lié proposé, articles en stock toujours vendables ; vérification côté serveur au paiement.

**§4.3 Panier, compte et commande**

- **FR-11 Panier sans compte** : ajouter, modifier, retirer sans Compte ; Panier conservé et fusionné avec le Compte à la connexion ; un Kit en un exemplaire au plus et jamais s'il est déjà possédé ; jamais de Pass dans le Panier.
- **FR-12 Création de compte et connexion** : Compte créé sans achat ou au moment de payer ; connexion par code à 6 chiffres reçu par email (partout) ou Google (hors navigateurs intégrés) ; retour à la page et au Panier quittés ; âge déclaré à la création (moins de 13 ans refusé, 13 à 17 ans = Compte mineur qui peut acheter, obtenir des Pass et participer à « 10 pass gratuits ») ; trois questions d'accueil facultatives (« Comment nous as-tu connus ? », « Quel univers préfères-tu ? », « Tu préfères porter ou fabriquer ? ») qui alimentent FR-54 et FR-59.
- **FR-13 Étape de commande** : téléphone, Zone de remise (Goma ou Bukavu), Mode de remise à Goma seulement (retrait gratuit ou livraison), adresse en champ libre si livraison ; aucun de ces champs pour un Panier 100 % numérique. Cases : CGV ; Kit (accès immédiat, renonciation au droit de rétractation, Licence de kit ; non remboursable) ; Sur-mesure (Mesures confirmées, pas d'annulation après le début de la fabrication). Le serveur recalcule depuis la base sous-total, Forfait, réduction et total, vérifie stock et Plafond, crée la Commande `en attente` qui réserve stock et place pendant le Délai de paiement ; à l'échéance sans paiement vérifié → `expirée`, réservation libérée ; le client qui revient retrouve son Panier et ses champs, puis repart sur une nouvelle Commande.
- **FR-14 Récapitulatif avant paiement** : prix de chaque article en USD, Forfait de livraison, réduction, total USD, délai total de chaque Produit physique.

**§4.4 Paiement** (décision du 2026-10-16 : mobile money via PawaPay, K-Pay, MaishaPay, GeniusPay ; carte via K-Pay pour tout panier avec Produit physique et pour les Pass ; Polar seulement pour un Panier 100 % numérique ; prix USD, conversion faite par le Prestataire)

- **FR-15 Couche de paiement à Adaptateurs** : une couche commune et un Adaptateur par Prestataire ; ajouter ou retirer un Agrégateur ne touche pas au reste du site. Au lancement : PawaPay (API v2), K-Pay (mobile money et carte), MaishaPay (mobile money), Polar (carte, Kits). K-Pay et MaishaPay sont construits à partir de la documentation officielle de K-Pay et de MaishaPay, fournie par Jonathan dans `docs/references/paiements/` (hors dépôt) ; couverture pays-opérateur (Q-1) et contrôle du montant reçu (Q-3) tirés de cette documentation (Q-S1) ; GeniusPay attend Q-2, rien de son API n'est supposé.
- **FR-16 Choix du moyen de paiement** : le client choisit son pays d'abord ; mobile money proposé en premier si un Agrégateur actif couvre ce pays, sinon carte seule. Seuls les Prestataires autorisés sont proposés : Panier mixte ou avec Produit physique + carte → K-Pay, jamais Polar ; Panier 100 % numérique + carte → Polar, sinon « Carte indisponible » (aucun remplaçant) ; Pass + carte → K-Pay ; mobile money → Agrégateur actif prioritaire couvrant le couple pays-opérateur ; couple non couvert → message et invitation à choisir un autre opérateur ou la carte. Avant validation : « Paiement traité par {Prestataire} », en texte, sans logo.
- **FR-17 Repli entre Agrégateurs** : chaque essai = une Tentative de paiement distincte ; repli proposé au client vers l'Agrégateur suivant couvrant le même couple seulement si l'Agrégateur est désactivé ou si la Tentative est confirmée en échec par l'Agrégateur ; sans réponse ou réponse ambiguë → jamais traité comme un échec, « paiement en cours de vérification », aucun repli ; échec dû au client → pas de bascule, réessai possible ; une seule Tentative en cours par Commande ; test automatique : un délai dépassé ne déclenche pas de repli.
- **FR-18 Vérification serveur du Prestataire** : la route qui choisit le Prestataire vérifie en base la Famille de chaque article, la présence d'un Pass, le moyen, le pays et l'opérateur. Tests automatiques : Panier mixte jamais chez Polar ; Pass jamais chez Polar ; repli vers l'Agrégateur suivant du couple ; Référence de transaction déjà utilisée refusée.
- **FR-19 Notifications de paiement** : une route serveur de notification par Prestataire ; chaque notification est vérifiée (signature ou contre-vérification, montant compris) avant `payée`, jamais le navigateur. Une Référence de transaction ne valide jamais deux fois ; la Commande enregistre Prestataire, référence, montant et devise encaissés. Le passage en `payée` déclenche décompte du stock, ouverture des Kits, émission des Pass, email de confirmation. Paiement réussi sur une Commande déjà `payée`, `expirée` ou impossible à honorer → Trop-perçu signalé à l'Admin, statut inchangé ; l'Admin peut honorer à la main une Commande expirée si stock ou Capacité le permettent. Tentative en échec sans autre Tentative en cours → `échouée`, le client peut repayer. Tests : notification tardive après expiration, deux Tentatives réussies sur deux Agrégateurs, notification rejouée.
- **FR-20 Page de retour après paiement** : état réel lu côté serveur (payée, en attente, échouée) ; échec confirmé → réessayer ou WhatsApp ; état inconnu → « paiement en cours de vérification », sans proposition de repayer ; jamais « payée » avant confirmation fiable du Prestataire.
- **FR-21 Administration des Prestataires** : activer ou désactiver chaque Prestataire, régler l'Ordre de priorité, saisir la Couverture (pays-opérateur) depuis les documents, voir les paiements par Prestataire. Aucun faux paiement hors des tests (règle 13) ; secrets côté serveur (règle 4).

**§4.5 Remise, suivi et service après-vente**

- **FR-22 Suivi de commande client** : dans le Compte, liste des Commandes et frise des Statuts avec dates, numéro de suivi s'il existe, bouton WhatsApp.
- **FR-23 Vérification des Mesures** : tâche « Mesures à vérifier » pour toute Commande Sur-mesure payée ; l'Admin contacte le client hors du site, corrige et valide ; pas de passage `en fabrication` sans Mesures validées.
- **FR-24 Avancement manuel des Commandes** : l'Admin fait avancer les statuts (transitions autorisées seulement), saisit un numéro de suivi facultatif (texte libre, Q-9) et corrige l'adresse ; chaque changement envoie l'email correspondant ; un article en stock passe directement de `payée` à `expédiée` ; aucun retour en arrière (correction hors site, journalisée) ; retrait à Goma : `expédiée` s'affiche « Prête à retirer ».
- **FR-25 Annulation d'une Commande de Cosplay** : demandée par le client tant que la Commande n'est pas `en fabrication`, validée par l'Admin → `annulée`, stock et place dans le Plafond libérés ; `remboursée` seulement quand l'Admin confirme le remboursement avec une preuve. Commande mixte : toutes les pièces physiques annulées ensemble, Kit conservé et non remboursé, montant rendu = pièces physiques + Forfait ; pas d'annulation partielle ; mécanisme de remboursement selon Q-4.
- **FR-26 Réclamation et remplacement** : dans les 48 h suivant la livraison, signalement d'un Produit physique abîmé ou différent (Accessoire ou Cosplay en taille standard) ; validation par l'Admin ; retour de l'article et remplacement, refabriqué si besoin ; pas de remboursement des Produits physiques livrés ; Kits jamais remboursables ; au-delà de 48 h, plus de réclamation en ligne ; cas de remplacement impossible : CGV (Q-6).

**§4.6 Bibliothèque de kits**

- **FR-27 Ma bibliothèque** : le client retrouve ses Kits achetés avec leur progression.
- **FR-28 Téléchargement des Fichiers de kit** : chaque fichier (PDF A4 et US Letter, SVG, STL) sans limite de nombre, depuis tout appareil connecté au Compte ; chaque téléchargement passe par un lien signé de courte durée créé côté serveur après vérification d'un accès payé ; chaque PDF porte un filigrane discret à l'identité de l'acheteur (nom ou email), sans gêner l'impression.
- **FR-29 Lecture de la Vidéo de kit** : lecture en ligne, chapitre par chapitre, qualité adaptée au débit, aucun bouton de téléchargement, reprise sur tout appareil ; vidéo complète publiée nulle part ailleurs ; démarrage en moins de 5 s en 3G avec rendu 360p ; sous-titres WebVTT français obligatoires, anglais facultatifs (sous `/en`, la fiche d'un Kit sans sous-titres anglais l'indique) ; lecteur au clavier ; transcription texte de chaque chapitre téléchargeable avec les Fichiers de kit.
- **FR-30 Accès à vie et mises à jour** : un Kit acheté reste accessible à vie, mises à jour comprises.
- **FR-58 Kit gratuit (lancement + 4 semaines)** : le visiteur connecté obtient le Kit gratuit d'un clic depuis sa fiche, sans Panier ni Prestataire ; le serveur crée une Commande `offerte` (0 USD) et ouvre le Kit ; une seule fois par Compte ; jamais `payée`, ne compte pas comme premier achat ; case d'acceptation de la Licence de kit avant « Obtenir », sans renonciation.

**§4.7 Événements et Pass**

- **FR-31 Pages Événements** : liste des Événements à venir et page de chaque Événement (date, lieu, programme, photos, Types de pass avec prix et avantages) ; Capacité atteinte → « Complet » et vente arrêtée ; sans Capacité, pas de limite ; Événement passé consultable avec le lien de sa Galerie d'événement.
- **FR-32 Alerte événement** : inscription « Me prévenir » par email, par Compte ou par numéro WhatsApp ; email et Compte → annonce automatique par email ; WhatsApp → l'Admin exporte la liste et envoie lui-même (aucune API WhatsApp) ; consentement explicite et désinscription.
- **FR-33 Achat de Pass** : client connecté ; un ou plusieurs Pass d'un ou plusieurs Types ; pour lui-même, le Pass reprend son Compte ; nom saisi pour chaque autre personne ; un Pass Stand produit deux Pass nominatifs (titulaire et aide) ; pas de quota par Type, seulement la Capacité facultative vérifiée côté serveur au paiement ; achat séparé du Panier ; acceptation de la mention sur la publication des photos et vidéos ; paiement mobile money ou K-Pay, jamais Polar.
- **FR-34 Émission des Pass** : dès le paiement vérifié, tous les Pass par email, chacun avec un Code QR unique, et dans le profil ; Code QR et code court impossibles à deviner ou à déduire d'un autre.
- **FR-35 Scan à l'entrée** : le Scan affiche nom, Événement et Type de pass ; refuse, avec la raison, un Pass déjà scanné, annulé ou d'un autre Événement ; saisie manuelle du code court avec les mêmes contrôles.
- **FR-36 Scan hors ligne** : un appareil connecté prend le Verrou hors ligne et charge la liste des Pass `valide` ; tant qu'il le tient, il est le seul à scanner (les autres affichent « scan réservé à l'appareil hors ligne ») ; synchronisation au retour de la connexion puis libération ; sans Verrou, pas de Scan hors ligne ; l'Admin peut forcer la libération (scans non synchronisés signalés).
- **FR-37 Accès bénévole** : créé à l'avance par l'Admin seul, limité au Scan, valable le jour de l'Événement seulement, puis déconnecté et supprimé automatiquement ; ne voit ni Commandes, ni clients, ni Produits, ni réglages.
- **FR-38 Annulation et remboursement d'un Pass** : demande jusqu'à 48 h avant l'Événement, validée par l'Admin ; pourcentage de frais réglé dans l'admin retenu ; Pass `annulé` dès la validation (refusé au Scan), `remboursé` quand l'Admin confirme le remboursement avec preuve (Q-4).
- **FR-39 Galerie d'événement** : lien public (Google Drive ou Google Photos) saisi dans l'admin ; après l'Événement, email à chaque détenteur de Pass avec ce lien ; demande de retrait de photo par email ou via le contact, retirée à la main.

**§4.8 Galerie « Ils le portent » et Réalisations**

- **FR-40 Envoi d'une photo** : depuis le Compte (dépôt) ou par WhatsApp (dépôt par l'Admin) ; accord explicite de publication et choix d'afficher ou non prénom (ou pseudo) et ville ; Compte mineur : prénom ou pseudo seulement, jamais la ville, retrait possible à la demande d'un parent ; invitation après livraison (email « livrée »).
- **FR-41 Validation et retrait** : chaque photo validée par l'Admin avant publication ; retrait à tout moment sur demande.
- **FR-42 Opération « 10 pass gratuits »** : les 10 premiers Comptes qui envoient une Réalisation faite avec un Kit acheté gagnent un Pass Standard gratuit pour l'Événement ; l'Admin vérifie l'achat et valide ; le serveur crée une Commande `offerte` et émet le Pass comme un Pass normal ; compteur dans l'ordre des Réalisations validées, arrêté à 10.

**§4.9 Blog**

- **FR-43 Publication d'Articles** : l'Admin écrit, illustre, publie, modifie et dépublie des Articles ; le visiteur lit la liste et chaque Article ; liens vers Produits et Événements ; version française obligatoire, anglaise facultative (un Article sans version anglaise n'apparaît pas sous `/en`) ; images conformes aux règles 6 et 7.

**§4.10 Emails et Relances** (envoi par Resend)

- **FR-44 Emails transactionnels** : un email à chaque événement d'une Commande (payée, en fabrication, expédiée avec numéro de suivi, livrée avec invitation photo, annulée, remboursée), Kit ouvert, Pass émis, code de connexion ; aucun email affiché comme envoyé sans réponse réelle du service.
- **FR-45 Relances** : avec consentement, une Relance tous les 2 à 3 jours pendant 90 jours au plus après l'achat ; lien de désinscription à effet immédiat ; les Comptes mineurs reçoivent les mêmes Emails commerciaux avec le même consentement (à valider, Q-5).
- **FR-59 Emails commerciaux ciblés** : avec consentement, panier abandonné (1 h puis 24 h, Compte créé, arrêt au paiement) ; rappels de Kit (2 jours sans Vidéo démarrée, 7 jours sans Vidéo terminée) ; nouveau produit dans un univers acheté ou préféré ; au plus un Email commercial tous les 2 jours, tous types confondus (transactionnels hors limite).

**§4.11 Codes promo d'affiliation**

- **FR-46 Création d'un Code promo** : Affilié, pourcentage de réduction, taux de commission, plafond d'utilisations (50 par défaut, modifiable), état actif ou inactif.
- **FR-47 Application d'un Code promo** : saisi avant de payer ; accepté seulement s'il est actif, sous son plafond et s'il s'agit du premier achat payé du Compte (un achat de Pass compte, une Commande `offerte` non) ; réduction sur tout le catalogue (Produits et Pass) mais pas sur le Forfait ; un seul Code promo par achat.
- **FR-48 Suivi et commission** : pour chaque Code promo, ventes générées, montant et commission due ; seules les Commandes payées et non remboursées comptent ; commission calculée sur le montant payé hors livraison.

**§4.12 Admin et rôles** (utilisable sur téléphone et ordinateur)

- **FR-49 Tableau de bord** : d'abord les nouvelles Commandes payées, puis les graphiques de paiement (par Prestataire, par Famille, dans le temps), les tâches en attente (Mesures, annulations, remboursements, remplacements, Trop-perçus, photos, Réalisations) et les indicateurs du §7 ; liste des Commandes filtrable par Statut, Famille, Prestataire et Zone de remise.
- **FR-50 Gestion des Produits** : Famille, textes FR et EN, photos (ordre, texte alternatif obligatoire), prix USD, tailles et Sur-mesure, stock, Délai de fabrication par produit ou variante, Kit lié, Fichiers de kit et Vidéo de kit (chapitres, extrait public) ; publication refusée sans prix, sans photo, sans texte alternatif, ou pour un Kit sans Fichier de kit ou sans sous-titres français ; téléversement avec progression et reprise après coupure.
- **FR-51 Réglages** : Délai de paiement, Forfaits Goma et Bukavu, lieu et modalités du retrait, Plafond de fabrication, numéro WhatsApp, Prestataires (FR-21), pourcentage de frais d'annulation des Pass, vidéo et photo du héros.
- **FR-52 Gestion des Événements** : date, lieu, Capacité facultative, programme, photos, Types de pass avec prix et avantages, lien de la Galerie d'événement ; Pass vendus et scannés.
- **FR-53 Rôle Assistant (plus tard)** : jusqu'à deux Assistants aux droits listés (Commandes et statuts, Mesures, Galerie, Blog, Événements, préparation d'un remboursement, graphiques de leur activité) et interdits listés (prix et Produits, Codes promo et commissions, Prestataires, chiffre d'affaires et graphiques de paiement, Accès bénévoles, validation d'un remboursement) ; droits contrôlés côté serveur et en base. *Création des comptes hors lancement ; modèle de droits écrit dès le lancement (AD-13).*

**§4.13 Mesure d'audience**

- **FR-54 Actions mesurées** : origine de la visite et de la vente, clic sur un bouton du héros, vue de fiche, ajout au Panier, création de Compte à l'étape de paiement, abandon à cette étape, paiement réussi ou échoué par Prestataire, partage, inscription à une Alerte événement, Pass vendu, photo et Réalisation envoyées, Kit gratuit récupéré, ventes par Code promo, durée de chargement du héros, désinscription des Relances, livraisons en retard, Vidéo de kit démarrée et terminée, deuxième achat, entonnoir vue de fiche → Panier → Commande → payée → livrée ; respect du consentement, sans cookie de préférence.

**§4.14 Langues, SEO et partage**

- **FR-55 Français et anglais** : toutes les pages publiques sous `/fr` et `/en` (sauf Articles sans version anglaise) ; aucun texte visible en dur hors des fichiers de traduction ; emails dans la langue du client.
- **FR-56 Référencement** : titre et description uniques, URL lisible, Open Graph, JSON-LD (Product et Offer, Event, Article, BreadcrumbList, Organization, FAQPage, VideoObject selon la page), plan du site, robots.txt, URL canonique, hreflang `/fr` ↔ `/en`, un seul H1 par page.
- **FR-57 Aperçu de partage** : une fiche partagée sur WhatsApp ou un réseau social affiche la grande photo du Produit et son titre ; bouton de partage sur chaque fiche et chaque Événement.

### Exigences non fonctionnelles

- **NFR-1 Mobile d'abord** : utilisable à 375 px de large sans défilement horizontal ; pensé d'abord pour le téléphone et le navigateur intégré d'Instagram (CLAUDE.md règle 7).
- **NFR-2 Performance** : héros en moins de 2,5 s ; Core Web Vitals au vert ; Lighthouse mobile ≥ 90 en performance, accessibilité et SEO sur l'accueil.
- **NFR-3 Accessibilité** : contraste suffisant, texte alternatif sur chaque image, navigation au clavier, vidéo du héros sans son et sans information indispensable, Vidéos de kit sous-titrées et transcrites ; cible WCAG 2.2 AA (EXPERIENCE.md).
- **NFR-4 Sécurité des contenus payants** : Fichiers de kit dans le bucket privé `kits-private`, Vidéos de kit complètes dans une bibliothèque Bunny Stream privée ; ouverture uniquement par lien ou jeton signé de courte durée, créé côté serveur après vérification d'un accès payé ; RLS sur toutes les tables (CLAUDE.md règle 1).
- **NFR-5 Intégrité des paiements** : seul le serveur, après confirmation fiable du Prestataire (signature vérifiée ou contre-vérification de son API), passe une Commande en `payée` ; idempotence par Référence de transaction ; prix, stock, livraison et réductions calculés côté serveur (CLAUDE.md règles 2 et 3).
- **NFR-6 Résilience du paiement** : la panne d'un Agrégateur n'empêche pas de payer si un autre couvre le même couple pays-opérateur (CLAUDE.md règle 9).
- **NFR-7 Secrets** : clés et secrets uniquement dans les variables d'environnement ; `.env.example` à jour ; dépôt public sans secret, numéro de marchand, donnée client ni export (CLAUDE.md règle 4).
- **NFR-8 Honnêteté** : aucun avis, chiffre, logo ou témoignage inventé ; aucun paiement, statut, email ou réponse d'API simulé hors des tests automatiques (CLAUDE.md règles 5 et 13).
- **NFR-9 Traçabilité** : chaque changement de statut d'une Commande ou d'un Pass, chaque validation (remboursement, remplacement, photo) et chaque action d'un Assistant est horodaté avec son auteur.

### Exigences complémentaires (architecture)

**Point de départ (Epic 1, story 1)**

- Démarrage par `create-next-app@16.4.2` (TypeScript, Tailwind 4, `src/`, App Router) + `@supabase/ssr` 0.12.7 selon le guide SSR de Supabase ; connexion par code email sans mot de passe ; aucune redirection forcée vers la connexion sur les pages publiques. Versions figées : Node 24.x, Next 16.4.2 (`cacheComponents: true`), React 19.3.1, TypeScript 5.9.3, supabase-js 2.118.0, Supabase CLI 2.121.0, next-intl 4.14.9, Tailwind 4.3.3, Zod 4.6.7, @cantoo/pdf-lib 2.11.1, qrcode 1.5.4, hls.js 1.7.3, Resend 6.34.1, Vitest 5.0.5, Playwright 1.64.1.
- **Definition of done de la story d'installation (AD-20, adaptée le 2026-10-20)** : lint, types, tests et build verts ; projet Supabase `koma-dev` (gratuit, Paris) relié ; workflow GitHub Actions (lint, typecheck, Vitest, tests SQL sur une base Supabase locale lancée par la CLI, build) vert sur `main` ; branche `production` créée ; vérification en local (pas encore de domaine, Q-D1) ; puis **réglage manuel de Jonathan** : protection GitHub de `production` (contrôles requis, force push et suppression interdits, aucun contournement). Le réglage hPanel (application Node.js, branche `production`, variables d'environnement), le domaine et Resend passent dans une **story de mise en ligne**, placée juste avant l'ouverture des ventes et bloquée par Q-D1 ; Q-A2 y est vérifiée.

**Structure et conventions**

- Monolithe modulaire : `src/app/[locale]/…` (pages), `src/app/api/…` (notifications, cron, kits, mesure, état de commande), `src/modules/<module>/` (`actions.ts`, `service.ts`, `queries.ts`, `schemas.ts`, `types.ts`, `server-only` sauf types et schémas), `src/modules/paiement/adaptateurs/<prestataire>/`, `src/lib/` (supabase, auth, cache, seo, env, argent, dates, journal), `supabase/migrations/`, `supabase/tests/`, `tests/e2e/`, `tests/doubles/`, `messages/fr.json` et `en.json`, `public/sw-scan.js`, `src/proxy.ts`.
- AD-1 : chaque table appartient à un seul module (catalogue, commande, paiement, bibliotheque, evenements, communaute, blog, promo, comptes, envois, mesure, admin) ; effets entre modules par fonctions internes SQL `<module>_<verbe>` ; aucun trigger métier entre modules ; un `CREATE OR REPLACE` part de la dernière version appliquée et tous les tests livrés repassent.
- AD-2 : le navigateur n'écrit jamais dans une table métier ; toute écriture passe par Server Action ou route API validée par Zod ; trois clients Supabase seulement (`public.ts`, `session.ts`, `service.ts`) ; exceptions : téléversements directs sur autorisation signée, file de scans hors ligne en IndexedDB.
- AD-3 : statuts et compteurs de stock modifiés uniquement par des fonctions Postgres `SECURITY DEFINER`, `search_path = ''`, verrou de ligne, matrice de transitions, journal ; `REVOKE` à `anon`/`authenticated`, `GRANT` à `service_role` ; test CI qui échoue si une fonction exécutable par `anon`/`authenticated` écrit ; aucun statut ne recule.
- AD-14 : vocabulaire du Glossaire, sans accent, `snake_case` au singulier en base ; statuts imposés (Commande, Tentative, Pass, Demande client) ; fichiers TS en `kebab-case`, composants en `PascalCase.tsx` ; migrations `AAAAMMJJHHMMSS_verbe_objet.sql`.
- AD-25 : chaque fonction d'écriture reçoit `p_auteur jsonb` construit par `src/lib/auth/auteur.ts` ; aucune fonction ne lit `auth.uid()`.
- Conventions : clés `uuid`, numéro de Commande `KS-AAAA-NNNNNN` par séquence ; argent en centimes entiers + code ISO 4217, formatage par `src/lib/argent.ts` ; dates `timestamptz` UTC, affichage `Africa/Lubumbashi` par `src/lib/dates.ts` ; colonnes `cree_le`, `modifie_le`, `publie_le` ; résultat d'action `{ ok, donnees }` / `{ ok: false, code, message }` ; erreurs SQL `KS_*` ; pagination par curseur ; variables d'environnement lues par `src/lib/env.ts` (Zod au démarrage) ; montants et réglages dans `reglage` (`KS_REGLAGE_MANQUANT` si vide) ; types TS générés depuis la base.
- Tests : Vitest à côté des fichiers, tests SQL dans `supabase/tests/`, Playwright dans `tests/e2e/`, faux prestataires dans `tests/doubles/` préfixés `TEST_`, jamais importés par la production.

**Commande, paiement et argent**

- AD-4 : `confirmer_paiement` est la seule porte vers `payee` (rejeu sans effet ; montant égal → payée + effets ; inférieur → `anomalie montant_insuffisant` ; supérieur ou Commande non honorable → `trop_percu`) ; `honorer_trop_percu` pour l'Admin ; Commande `offerte` jamais `payee`.
- AD-5 : port `PrestatairePaiement` (`initier`, `verifierNotification`, `consulterStatut`, `comparerMontant`), résultat normalisé `succes | echec_client | echec_prestataire | inconnu`, aucun accès à Supabase ; PawaPay par signature RFC 9421, Polar par Standard Webhooks, K-Pay uniquement par contre-vérification ; route `POST /api/paiement/notification/[prestataire]` (401 si vérification échoue, enregistrement dans `notification_recue`, réponse 200 même si transition refusée) ; repli seulement sur `echec_prestataire` ou Agrégateur désactivé, toujours proposé au client.
- AD-6 : aiguilleur unique `choisirPrestataire(...)` dans `src/modules/paiement/aiguillage.ts`, fonction pure, Familles lues en base ; tests obligatoires : Panier mixte jamais Polar, Pass jamais Polar, repli vers le suivant, référence déjà utilisée refusée, délai dépassé sans repli, notification tardive après expiration, deux Tentatives réussies, notification rejouée, montant insuffisant non validé, Kit déjà possédé sans annulation du paiement.
- AD-7 : un achat de Pass est une Commande de type `pass`, même couche de paiement, mêmes statuts, même Code promo ; `ligne_commande` porte soit une variante soit un Type de pass ; Stand = 2 Pass par unité ; noms figés dans `ligne_commande.titulaires`.
- AD-8 : `creer_commande` fige prix, réductions par ligne, sous-total, Forfait, total, taux de commission, frais d'annulation des Pass, délai annoncé, `expire_le` ; `tentative_paiement` enregistre montant attendu (centimes USD), montant et devise reçus ; aucune tolérance inventée ; clé d'idempotence pour `creer_commande` et `demarrer_tentative`.
- AD-10 : pg_cron chaque minute ; tâches en base (`expirer_commandes_echues`, `supprimer_acces_benevoles_echus`) et tâches HTTP via pg_net (`reconcilier-tentatives`, `envois`, `relances`, `galerie-evenement`) protégées par `CRON_SECRET`, lots bornés et rejouables ; Délai de paiement réglable (30 min par défaut d'après l'architecture) ; Tentative `abandonnee` réconciliée 72 h ; écran d'attente : sondage toutes les 3 s, « en cours de vérification » après 2 min.
- AD-15 : Panier en base identifié par cookie httpOnly signé ; `fusionner_panier` à la connexion ; Panier intact tant que la Commande est `en_attente` ou `echouee`, vidé par `confirmer_paiement` ; Kit gratuit seul Produit à 0 USD, refusé au Panier (`KS_PRODUIT_GRATUIT`).
- AD-26 : origine figée par ligne (`stock` ou `fabrication`), réservations, `stock_disponible`, `places_fabrication_utilisees` (Plafond compté en pièces, sur commande seulement) ; stock décrémenté seulement par `confirmer_paiement`, réincrémenté seulement par `annuler_commande`.
- AD-27 : annulation de toutes les lignes physiques d'une Commande `payee` contenant un Cosplay, pas encore `en_fabrication` ; montant à rendre figé une fois ; commission calculée uniquement par la vue `commission_code_promo`.
- AD-28 : statuts de Tentative `en_cours`, `reussie`, `echouee` (cause `client` ou `prestataire`), `abandonnee` ; au plus une Tentative `en_cours` par Commande (index unique partiel).
- AD-29 : `a_deja_achete`, `utilisations_code_promo` ; utilisation réservée à la création de la Commande, libérée à l'expiration ou l'annulation ; aucun compteur sur `code_promo`.
- AD-31 : `demande_client` (annulation_commande, annulation_pass, reclamation) avancée par `traiter_demande` ; `remboursement` figé (Commande, Pass, Trop-perçu) ; `confirmer_remboursement` exige une preuve ; réclamation `acceptee → article_rendu → remplacement_remis`.
- AD-32 : Mesures en `jsonb` validées par un seul schéma Zod versionné `schemaMesures` (centimètres entiers ; liste et bornes : E-10) ; `corriger_mesures`, `valider_mesures`.
- AD-34 : acceptations exigées par `creer_commande` et `offrir_commande` (`KS_ACCEPTATION_MANQUANTE`) et enregistrées avec version et horodatage ; consentements dans la table `consentement`.
- AD-35 : page de retour et écran d'attente ignorent tout paramètre de statut de l'URL ; état lu par `GET /api/commande/[numero]/etat` (404 si la Commande n'est pas au Compte connecté) ; retour POST du Prestataire redirigé en GET.

**Contenus, comptes, événements**

- AD-11 : `acces_kit` unique par (compte, produit), créé par `bibliotheque_ouvrir_acces`, jamais supprimé ; `KS_KIT_DEJA_POSSEDE` ; `GET /api/kits/fichier/[id]` → URL signée 60 s ; PDF filigrané avec `@cantoo/pdf-lib` et police TTF embarquée, copie mise en cache dans `kits-private/filigranes/…` ; Bunny Stream privé avec CDN Token Auth (jeton de répertoire) ; lecteur `hls.js` ; sous-titres et transcriptions dans `kits-private`.
- AD-12 : jeton QR aléatoire de 128 bits et code court de 8 caractères sans caractères ambigus ; `scanner_pass` atomique ; Capacité par `places_evenement_utilisees` (Stand × 2, Pass offerts compris, `KS_COMPLET`) ; Verrou hors ligne unique par Événement, liste locale d'empreintes SHA-256, IndexedDB, synchronisation puis libération ; service worker limité à la route de scan ; lecture du QR par la caméra dans la page.
- AD-13 : `role_utilisateur` (`admin`, `assistant`, `benevole`) ; `a_le_role` seule source de vérité, vérifiée par `src/lib/auth/droits.ts` et par chaque fonction d'écriture ; restrictions Assistant écrites dès le lancement ; bénévole valable le jour J (fuseau `Africa/Lubumbashi`).
- AD-16 : next-intl, libellés dans `messages/*.json`, contenus `*_fr` / `*_en` ; `profil.langue` choisit la langue des emails.
- AD-17 : cache Next 16 (`'use cache'` + `cacheTag`) avec le client public uniquement ; aucune donnée qui dépend des ventes ou de la personne dans un segment en cache (îlots rendus à la requête) ; étiquettes produites par `src/lib/cache/etiquettes.ts` et invalidées par `updateTag` ; `generateMetadata` et JSON-LD par `src/lib/seo/` ; brouillon absent du plan du site et de l'URL directe ; script de thème dans `<head>`.
- AD-18 : bucket public `produits-public` + `next/image` ; bucket privé `galerie-attente` pour les photos clients en attente ; seconde bibliothèque Bunny Stream publique (héros en MP4 court, extraits en HLS) ; polices auto-hébergées par `next/font/local` ; téléversements admin directs en TUS avec reprise (Supabase Storage, Bunny Stream).
- AD-19 : mesure maison, aucun outil externe ni cookie ; vues SQL pour ventes, paiements, livraisons et Codes promo ; `POST /api/mesure` (identifiant de session aléatoire en `sessionStorage`, ni IP, ni empreinte, ni Compte) ; entonnoir en comptes agrégés ; origine figée dans `commande.origine`.
- AD-21 : `journal_audit` (colonnes modifiées, données personnelles masquées) ; trigger générique `journaliser()` sur chaque table métier, auteur obligatoire ; `trop_percu` ; `anomalie` à types fermés ; vue `taches_admin` seule source des tâches ; journaux techniques JSON par `src/lib/journal.ts`.
- AD-22 : `consommer_essai(cle, fenetre, maximum)` pour toutes les limitations (code court au Scan, Tentatives, contact, « Me prévenir », envoi de photo).
- AD-23 : délais calculés en base avec `now()` ; fenêtre de Relances à partir du dernier `paye_le`.
- AD-24 : code à 6 chiffres valable 10 min, renvoi après 60 s ; Google masqué dans les navigateurs intégrés (agent détecté côté serveur) ; Compte incomplet tant que l'âge n'est pas déclaré ; moins de 13 ans → Compte supprimé ; `est_mineur` seule source ; retour vers un chemin interne validé.
- AD-30 : RLS `SELECT` public limité aux lignes publiées ; champs privés dans des tables séparées sans politique de lecture (`video_kit_prive`, `fichier_kit_prive`) ; test CI qui échoue sur une colonne lisible par `anon` nommée `prive`, `chemin` ou `note_admin`.
- AD-33 : `attribuer_pass_offert` (verrou de l'Événement, Kit acheté avec `paye_le`, un Pass offert par Compte et par Événement, rang 1 à 10 unique, Capacité).
- AD-9 : boîte d'envoi `envoi` (modèles en énumération fermée, données = identifiants, langue figée, statuts `a_envoyer`, `envoye`, `echec`, `abandonne`, `ignore`) ; seule `/api/cron/envois` envoie via Resend et pose `envoye` avec l'identifiant Resend ; gabarits dans `src/modules/envois/modeles/` ; code de connexion envoyé par Supabase Auth.

**Exploitation et sécurité (AD-20, AD-36)**

- Production : Hostinger Node 24, une instance, déploiement depuis `production` ; commits sur `main` ; migrations appliquées en production par la CLI **avant** l'avance de `production` ; migration compatible avec le code en ligne ; Supabase production (Paris, Pro à l'ouverture des ventes) et `koma-dev` (seul lieu des données et paiements de test).
- Domaine du site (Q-D1) vérifié chez Resend (SPF, DKIM, DMARC) ; SMTP de Supabase Auth via ce domaine, limite d'envoi relevée : fait dans la story de mise en ligne. En développement, Supabase envoie le code de connexion par son service par défaut sur `koma-dev` (nombre d'emails limité). L'adresse du site est lue dans `NEXT_PUBLIC_SITE_URL`, jamais écrite en dur.
- En-têtes HTTP dans `next.config` (CSP limitée au site, à Supabase et à Bunny ; HSTS ; `X-Content-Type-Options` ; `Referrer-Policy`) ; routes API d'écriture limitées à une signature de Prestataire, au `CRON_SECRET` ou à une session avec contrôle de l'en-tête `Origin`.
- Sauvegardes : base couverte par Supabase Pro ; originaux des fichiers, photos et vidéos gardés par Jonathan hors plateforme. Procédure de remplacement d'une clé compromise (révocation, remplacement, Prestataire désactivé le temps du remplacement).
- Dépôt public : aucun fichier tiers sans licence notée dans `docs/licences/` (règle 6) ; Sakura Town : `docs/licences/polices.md`, version complète et accord écrit à obtenir (Q-F1).

**Questions ouvertes qui bloquent des stories (architecture)**

- **Q-S1 (redéfinie le 2026-10-20)** : aucune intégration existante n'est reprise. Jonathan fournit la documentation officielle de K-Pay et de MaishaPay, tirée de ses espaces marchands, dans `docs/references/paiements/` (dossier exclu du dépôt par `.gitignore`, lu en local seulement). Les clés API et identifiants marchands vont uniquement dans `.env.local` et dans les variables d'environnement de Hostinger, remplis par Jonathan. → bloque les adaptateurs K-Pay et MaishaPay ; leur Couverture (Q-1) et leur règle de comparaison du montant (Q-3) seront tirées de cette documentation, sans rien deviner.
- **Q-1** : Couverture pays-opérateur, surtout PawaPay et GeniusPay → bloque FR-16 en production.
- **Q-2** : API GeniusPay (notification vérifiable, remboursement, devise) → bloque l'adaptateur GeniusPay.
- **Q-3** : devise débitée et règle de comparaison du montant → bloque `comparerMontant` de PawaPay et GeniusPay, et désormais aussi de K-Pay et MaishaPay (construits à partir de leur documentation officielle).
- **Q-4** : remboursement par API → ne bloque aucune story (remboursement manuel avec preuve, AD-31) ; PawaPay et GeniusPay ne dépendent que de Q-1, Q-2 et Q-3 (décision du 2026-10-20).
- **Q-5** : textes légaux, durée de conservation, suppression de Compte → bloque l'ouverture des ventes.
- **Q-N1** : nom affiché définitif du site (KOMA SHOP ou KOMA FEST). Valeur de départ provisoire « KOMA SHOP » dans le réglage `nom_site`, seule source du nom (titres SEO, JSON-LD Organization, emails, pied de page, filigrane), modifiable dans l'admin. Bloque seulement la mise en ligne.
- **Q-D1** : nom de domaine pas encore acheté ; développement et tests en local ; adresse lue dans `NEXT_PUBLIC_SITE_URL` → bloque seulement la story de mise en ligne.
- **Q-C1 Candidature Stand (ajoutée le 2026-10-21)** : Jonathan veut une candidature pour le Pass Stand (description de ce que l'exposant vend, 3 photos, Instagram ; validation par l'Admin ; lien de paiement valable 48 h ; condition écrite : propres créations, aucune contrefaçon). À passer par bmad-correct-course juste après ce découpage (modification de FR-33 et AD-7), puis à ajouter comme story 7.11. Le transfert de Pass n'est pas prévu au lancement (FR-34 inchangé).
- **Décision M5 tranchée le 2026-10-21** : tunnel Cloudflare (`cloudflared`) en développement seulement, ouvert pendant les essais de paiement, pour recevoir les notifications sandbox ; exception à la règle 14 notée dans le journal de décisions de l'architecture ; jamais en production.
- **Q-A1** (tarifs Bunny), **Q-A2** (Hostinger) → budget et première mise en ligne. **Q-F1** (Sakura Town) → reste ouverte ; bloque la mise en ligne avec Sakura Town, pas le développement (repli Barlow Condensed).
- **E-10** : liste et bornes des Mesures, fournies par Jonathan → bloque seulement la story Sur-mesure. **E-36** : tranchée le 2026-10-21 : « Voir plus », 12 éléments par clic, vrai lien avec curseur dans l'adresse.

### Exigences de conception UX

**Fondations visuelles (DESIGN.md)**

- **UX-DR1 Tokens de couleur** : implémenter dans Tailwind 4 les rôles des deux thèmes « Sumi & washi » (crème par défaut, sombre par bascule) : `background`, `surface`, `surface-glass`, `surface-glass-strong`, `glass-border`, `text-primary`, `text-secondary`, `primary` #E3261C, `on-primary`, `border` (décoratif seulement), `border-field` (tout contrôle interactif, ≥ 3:1), `success`, `warning`, `danger`, `qr-background` (#FFFFFF dans les deux thèmes), dégradés du héros et des tuiles ; variantes `-dark` ; aucune autre teinte.
- **UX-DR2 Règle du rouge et contrastes** : rouge unique #E3261C ; texte blanc sur bouton rouge ; rouge en texte seulement ≥ 24 px (ou 18,66 px gras) sur `background` ou `surface` unis ; aucun texte rouge sur dégradé, halo, verre, photo ou vidéo ; petits liens et prix en `text-primary` ; contrastes vérifiés selon le tableau de DESIGN.md (texte sur verre mesuré sur blanc pur et noir pur).
- **UX-DR3 Typographie** : rôles `display-brush` (Sakura Town), `display` (Barlow Condensed 800 italique, accroche seulement), `h1`, `h2`, `h3`, `body`, `small`, `label` (14 px minimum), `button`, `price-card`, `price-page` ; majuscules par `text-transform` seulement ; Barlow et Barlow Condensed auto-hébergées ; échelle ordinateur × 1,25 à partir de `lg` [HYPOTHÈSE D-2].
- **UX-DR4 Sakura Town** : `next/font/local`, `font-display: swap`, repli métrique Barlow Condensed ; grands titres de vitrine seulement, ≥ 40 px, texte HTML réel, en majuscules ; test côté serveur des glyphes : un titre saisi par l'admin qui contient un caractère absent bascule **en entier** en Barlow Condensed au rôle de son niveau ; jamais sur lien, bouton, prix, étiquette, écran transactionnel ni admin ; sans licence validée : `display` partout.
- **UX-DR5 Rayons, espacements, points de rupture** : `rounded` sm 10, md 14, glass 18, lg 20, xl 22, full ; échelle Tailwind (pas de 4 px), marge mobile 16 px, écart entre cartes 12 px, cible tactile 44 px ; points de rupture Tailwind + seuil 360 px des tuiles de catégorie.
- **UX-DR6 Verre** : deux niveaux (discret sur fond uni seulement ; renforcé à 85 % sous tout texte posé sur vidéo, photo ou contenu qui défile) ; flou 10 px, saturation 140 % ; repli sans `backdrop-filter` (renforcé sans flou, discret → surface opaque) ; Panneau ☰ opaque ; jamais de verre sur le logo.
- **UX-DR7 Thème** : bascule `<button aria-pressed>` dans l'en-tête et le ☰, choix mémorisé, appliqué avant le premier rendu (script dans `<head>`, aucun flash) ; mode `forced-colors` (verre → `Canvas`, sélection par bordure `Highlight` + icône, icônes en `currentColor`).
- **UX-DR8 Logo** : logo principal horizontal (KOMA + コマ) dans le coin gauche ; `principale logo.svg` en crème, `KOMA_horizontal_inverse.svg` en sombre ; 156 px à 375 px, 190 px sur ordinateur ; `viewBox` recadré `50 46 530 124` ; alt « KOMA SHOP » ; jamais recoloré, déformé ni ombré ; les JPG d'`imports/` ne sont pas utilisés ; hanko pour le favicon [HYPOTHÈSE].
- **UX-DR9 Motifs manga** : trames, cases, traits de vitesse ≤ 6 % d'opacité en fond de section ; jamais sur une photo produit, derrière un petit texte, un formulaire ou un texte de paiement ; jamais dans l'admin.

**Structure et navigation**

- **UX-DR10 En-tête** : mobile 64 px (logo à gauche, panier avec compteur et ☰ à droite) ; ordinateur (logo, 6 rubriques Cosplays · Accessoires · Kits · Festival · Blog · À propos (« Festival » remplace « Événements » dans les deux langues, décision du 2026-10-21), puis thème, langue, compte, panier) ; collant sauf à zoom ≥ 200 % ou hauteur < 500 px ; `scroll-padding-top` pour ne jamais masquer le focus ; bouton panier nommé « Panier, N articles » ; « Ajouté au panier » en `role="status"` sans déplacer le focus.
- **UX-DR11 Panneau ☰** : `<button aria-expanded aria-controls>` « Menu » ; `role="dialog" aria-modal="true"` ; focus sur le premier élément ; reste de la page `inert` ; défilement bloqué ; fermeture par « Fermer le menu », Échap ou choix d'une rubrique ; focus rendu au bouton ☰ ; contient les 6 rubriques, l'entrée Galerie (si photos), compte, thème, langue.
- **UX-DR12 Lien d'évitement et repères** : « Aller au contenu » en premier élément focalisable vers `<main id="contenu" tabindex="-1">` ; `header`, `nav` (`aria-label`), `main`, `footer` ; anneau de focus double (2 px `text-primary` + halo 2 px `background`, `:focus-visible` seulement).
- **UX-DR13 Pied de page** : quatre cartes (Aide : FAQ, Contact, WhatsApp ; Infos légales ; Paiement : liste lue côté serveur des Prestataires actifs, ou formulation générique ; identité « Fait main à Goma, RDC. NATHANGROUP SARL. ») ; liens Galerie et réseaux masqués tant qu'ils n'existent pas.
- **UX-DR14 Langue et fil d'Ariane** : sélecteur FR ↔ EN qui garde la page (Article sans EN → liste du Blog `/en` [HYPOTHÈSE]) ; « Français » / « English » écrits dans leur langue ; `lang` par route et par passage, `lang="ja"` pour le japonais exposé ; fil d'Ariane `nav aria-label="Fil d'Ariane"` avec `aria-current="page"` sur fiches et Articles.
- **UX-DR15 Boîte de dialogue et squelette** : `<dialog>` ou `role="dialog" aria-modal`, piège de focus, Échap et « Fermer », retour du focus, jamais empilée ; squelettes aux formes du contenu avec `aria-busy="true"` et « Chargement… » masqué, jamais sur le héros.

**Actions**

- **UX-DR16 Boutons** : bouton principal (pilule rouge, un seul par zone, ≥ 44 px ; condition non remplie → `aria-disabled="true"` focalisable + raison reliée par `aria-describedby`, focus sur le premier champ manquant au clic ; état désactivé = surface + `border-field` + `text-secondary`, jamais d'opacité réduite) ; bouton secondaire (surface opaque, contour `border-field`, jamais pour payer) ; bouton qui lance un paiement ou une Commande verrouillé au premier toucher.
- **UX-DR17 Bouton WhatsApp et bouton de partage** : WhatsApp vers le numéro réglé dans l'admin, message prérempli [HYPOTHÈSE] ; partage natif sinon copie du lien, « Lien copié » en `role="status"`.

**Accueil et catalogues**

- **UX-DR18 Héros vidéo** : `muted playsinline aria-hidden="true"`, sans piste audio ; accroche = H1 en texte réel dans un panneau de verre renforcé ; photo de repli et vidéo non chargée sous `prefers-reduced-motion` ; ≤ 3 flashs par seconde ; parallaxe légère coupée en mouvement réduit et en pause ; **bouton Pause obligatoire** (44 px, `aria-label` traduit, `aria-pressed`, choix mémorisé, absent si photo) ; ordinateur : vidéo ~2/3 + deux tuiles d'option (« Prêt à porter » : photo, prix, délai ; « Le fabriquer moi-même » : Kit lié, prix), lien étendu par pseudo-élément.
- **UX-DR19 Cartes et tuiles de vitrine** : tuile de catégorie (dégradé rouge ou encre, titre `clamp(20px, 6vw, 30px)`, 2 colonnes dès 360 px, 1 colonne en dessous ou à 200 %) ; carte produit (`h3 > a` étendu par pseudo-élément, image `alt=""` si le titre la nomme, prix USD et badge lus après le titre, élévation au survol) ; carte Événement (« Complet », passé marqué avec lien de Galerie d'événement) ; carte Article (vignette + titre + date) ; tuile de galerie (prénom/pseudo et ville seulement si autorisés, jamais la ville d'un Compte mineur, ouverture en Boîte de dialogue) ; accordéons FAQ indépendants avec JSON-LD FAQPage.
- **UX-DR20 Badge de disponibilité** : « En stock » (success), « Fabrication sur commande » + délai (text-secondary), « Commandes complètes pour le moment » / « Complet » (danger) ; icône + mot ; jamais de quantité.
- **UX-DR21 Filtres de catalogue** : pilules multi-sélection [HYPOTHÈSE] (univers, prix, disponibilité, niveau pour les Kits), tri en liste native ; URL qui reflète filtres et tri [HYPOTHÈSE] ; nombre de résultats annoncé en `role="status"` ; « Effacer les filtres » dès qu'un filtre est actif ; mobile : repli sous « Filtrer (n) » au-delà d'une ligne ; univers = genres génériques, aucune liste par défaut (E-29).

**Fiche produit**

- **UX-DR22 Galerie photo produit** : photos dans l'ordre de l'admin, alt obligatoire ; balayage **et** boutons « Photo précédente / suivante » ; vignettes au clavier ; position « Photo 2 sur 5 » annoncée ; zoom par pincement **et** bouton « Agrandir » (Boîte de dialogue avec +/−) ; zoom natif jamais bloqué ; pas de défilement automatique.
- **UX-DR23 Sélecteurs à options** : radios natifs ou `radiogroup`, flèches, **aucune sélection ne change de page ni ne déclenche d'action** ; double option : « Le fabriquer moi-même » affiche sur place un panneau « Kit lié » (prix, accès immédiat, lien « Voir le kit ») et masque tailles, délai, bandeau et bouton d'ajout ; Retrait / Livraison seulement si Zone = Goma, avec lieu et modalités du Réglage ; sélecteur de tailles (XS à XXL, Sur-mesure ; Plafond atteint : seules les tailles en stock restent, sinon le sélecteur disparaît) ; sélection = bordure rouge 2 px **et** coche.
- **UX-DR24 Schéma des Mesures** : illustration au trait (alt court renvoyant à la liste), champs numérotés avec unité, `inputmode="decimal"`, bornes plausibles avec message clair, instructions en texte ; ajout au Panier bloqué tant que les Mesures sont incomplètes (liste et bornes : E-10).
- **UX-DR25 Bandeau d'information** : surface + barre rouge 4 px ; avertissement de zone affiché à tous, avant le bouton d'ajout, avec le Kit lié ; bandeau navigateur intégré « Ouvrir dans Chrome » non bloquant, `role="region"` libellé, bouton « Fermer le bandeau » 44 px, choix mémorisé, ne recouvre jamais un élément focalisé.
- **UX-DR26 Bouton Obtenir le Kit gratuit** : sans Panier, Récapitulatif, choix de paiement ni Prestataire ; non connecté → connexion puis retour sur la fiche ; verrouillé au toucher ; succès → « Ouvrir dans ma bibliothèque » ; résumé de la Licence et case d'acceptation obligatoire au-dessus ; aucun bouton d'ajout au Panier sur ce Kit.

**Formulaires, messages et emails**

- **UX-DR27 Champ de formulaire** : libellé visible (jamais un placeholder), `autocomplete` adapté, `inputmode="tel"` pour le numéro mobile money ; validation à la perte de focus seulement si le champ a changé, et à l'envoi ; erreur sous le champ reliée par `aria-describedby` ; résumé d'erreurs `role="alert"` en tête avec liens, focus sur le résumé ; **rien n'est ressaisi** après un échec, un réessai, une connexion ou une expiration.
- **UX-DR28 Champ du code de connexion** : un seul `<input inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6">`, collage permis, validité et délai de renvoi annoncés en texte, « Renvoyer le code », aucune soumission automatique non annoncée ; états code faux, expiré, renvoyé (« Un nouveau code a été envoyé à [email]. » seulement après envoi réel), email non reçu (aide en texte, « Changer d'adresse email »).
- **UX-DR29 Case de consentement** : jamais pré-cochée, libellé entier cliquable, case 24 px, liens espacés d'au moins 24 px ; textes selon Q-5.
- **UX-DR30 Message d'état et barre de progression** : message = état réel lu côté serveur (succès, attention, erreur, information), icône + texte ; barre `role="progressbar"` avec valeur écrite (« 62 % · 23,6 Mo sur 38 Mo »), reprise annoncée après coupure, « Annuler l'envoi ».
- **UX-DR31 Gabarit d'email** : langue du client ; logo couleur sur surface, bouton rouge à texte blanc ; code, montants USD et liens en texte ; transactionnels sans argot ni emoji ; désinscription dans tout email commercial ; polices système de repli ; aucune promesse que le site ne tient pas.

**Panier et paiement**

- **UX-DR32 Récapitulatif** : prix par article, Forfait, réduction, total USD, délai total par Produit physique, tout relu côté serveur à chaque affichage ; « Le total a changé : [ancien] → [nouveau] USD. » avec reconfirmation obligatoire ; « Plus disponible » + « Cet article n'est plus disponible pour le moment. Retire-le pour continuer. » ; Récapitulatif de Pass (Types, noms, prix, réduction, total).
- **UX-DR33 Sélecteur pays + opérateur** : `<select>` natifs ; pays puis opérateur puis numéro ; listes = union des couples de la table Couverture, rien en dur ; changer de pays réinitialise l'opérateur et l'annonce (« 3 opérateurs disponibles ») ; noms en texte, aucun logo ; couple non couvert → message relié au champ opérateur.
- **UX-DR34 Carte de moyen de paiement** : « Mobile money » / « Carte » en `radiogroup`, liste reçue du serveur ; pays d'abord, mobile money en premier s'il est couvert, sinon carte seule avec « Le mobile money n'est pas encore disponible dans ton pays. » ; « Paiement traité par {Prestataire} » juste avant le bouton ; absentes pendant une Tentative en cours (« Un paiement est déjà en cours pour cette commande. ») ; « Le paiement par carte n'est pas disponible pour le moment. » sans aucune substitution.
- **UX-DR35 Écran d'attente** : « Valide le paiement sur ton téléphone. », montant USD et numéro masqué lus du serveur, « À payer avant [heure] » en texte statique (aucun compte à rebours) ; `role="status"` une seule fois par changement réel d'état ; `<title>` qui reflète l'état ; indicateur statique en mouvement réduit.
- **UX-DR36 Page de retour et états de paiement** : ignore les paramètres d'URL ; « Paiement en cours de vérification » en `warning` ; payée seulement après confirmation fiable, focus sur le titre ; échec confirmé par l'Agrégateur → `role="alert"`, « Ce service de paiement n'a pas abouti. Réessayer avec {Agrégateur suivant} ? » + WhatsApp ; échec client → « Le paiement n'a pas abouti. Tu peux réessayer. » sans bascule ; plus aucun service → « Choisis un autre opérateur ou la carte. » + WhatsApp ; Trop-perçu → texte validé (E-13) + WhatsApp, sans promesse de délai ni de mode ; référence déjà utilisée → aucun écran client ; Tentative en cours retrouvée sur tout onglet ou retour → attente ou vérification, aucun bouton « Payer ».

**Compte, bibliothèque, Pass, Scan**

- **UX-DR37 Navigation du compte** : cinq cartes-liens (Mes commandes, Ma bibliothèque, Mes Pass, Envoyer une photo, Préférences) puis « Se déconnecter » ; page « Mon compte » sur mobile, colonne de 300 px sur ordinateur ; `aria-current="page"`.
- **UX-DR38 Frise des statuts** : statuts réels avec dates ; icône + « Fait / En cours / À venir » ; `aria-current="step"` ; jamais de texte rouge ; « Offert » pour une Commande `offerte` (sans montant, Prestataire ni référence) ; « Prête à retirer » pour un retrait à Goma ; numéro de suivi en texte libre jamais transformé en lien ; aucun état « en transit » calculé ; annulation (avant `en fabrication`, confirmation en Boîte de dialogue) et réclamation (48 h après `livrée`) proposées seulement dans leur délai.
- **UX-DR39 Bibliothèque** : ligne de kit (vignette 72 px, progression et action suivante en texte, « Reprendre au chapitre 3 », aucune barre) ; ligne de fichier (nom accessible complet « Télécharger Patron A4 (PDF, 2,4 Mo) », « Préparation du lien… », nouveau lien à chaque clic, messages lien expiré et échec) ; lecteur à chapitres entièrement au clavier (lecture/pause, piste temporelle en slider ARIA avec valeur en texte, chapitres en `<button>` avec `aria-current`, sous-titres activables réglés sur la langue de l'interface, plein écran), qualité adaptative, aucun bouton de téléchargement, message + « Réessayer » si la vidéo ne charge pas ; position de lecture enregistrée toutes les 15 secondes, vidéo « terminée » à 90 % de sa durée (décision du 2026-10-20).
- **UX-DR40 Pass** : carte Type de pass en lecture seule (nom, prix USD, avantages, aucun compteur, « Complet » sur chaque carte, bouton d'achat retiré et « Me prévenir » maintenu) ; sélecteur de Pass (compteurs −/+ 44 px annoncés, un champ de nom par autre personne, deux noms pour un Stand, aucun bouton d'ajout au Panier) ; carte Pass (QR sur blanc pur, zone de silence de 4 modules, ≈ 200 px minimum, code court sous le QR, alt « Code QR du Pass {Type} de {Nom}, {Événement} », bouton « Agrandir » avec conseil de luminosité, demande d'annulation jusqu'à 48 h avant).
- **UX-DR41 Écran de Scan** : résultat plein écran en `role="alert"`, mêmes couleurs dans les deux thèmes : « VALIDE » (fond success #2E7A4E, texte blanc, grande coche) + nom, Événement, Type de pass en très grand ; « REFUSÉ » (fond danger #B01B13, grande croix) + raison ; bouton blanc pleine largeur « Scanner le pass suivant » ; « Saisir le code à la main » toujours accessible ; états caméra refusée, appareil non verrouillé, hors ligne sans Verrou, accès bénévole expiré ; retour sonore ou vibration : E-14.

**Admin**

- **UX-DR42 Navigation admin** : barre latérale sur ordinateur (`nav aria-label="Administration"`, Tableau de bord, Commandes, Produits, Événements, Galerie, Blog, Codes promo, Prestataires, Réglages ; entrée courante avec trait rouge 4 px ; compteur dans le nom accessible) ; barre d'onglets en bas sur mobile (Tableau de bord, Commandes, Mesures et tâches, Scan, 58 px) + ☰ pour le reste ; même thème que le site, sans Sakura Town ni motif manga.
- **UX-DR43 Composants admin** : carte de tâche (compteur réel, lien vers la liste filtrée, carte à zéro atténuée) ; graphique en barres (valeur écrite sur chaque barre, « Voir les données en tableau », aucune donnée fictive, aucune couleur par série) ; tableau de données (`<caption>`, `<th scope>`, nombre de résultats annoncé, cartes sur mobile, filtres repliés dans `<details>`) ; pastille de statut (icône + mot, tâche liée écrite dessous) ; bloc Paiement en lecture seule (Prestataire, moyen, référence, montant, devise, date de notification vérifiée, phrase « le statut payée ne se pose jamais à la main ») ; interrupteur (`role="switch"`, mot « Actif » / « Désactivé » mis à jour après enregistrement réel) ; boutons Monter / Descendre (44 px, nom complet, `aria-disabled` en bout de liste).
- **UX-DR44 Transitions admin** : une transition non autorisée est **absente** ; une transition autorisée dont la condition manque est affichée en `aria-disabled` avec la raison (« Valide d'abord les mesures… ») ; remboursement sans preuve → résumé d'erreur et erreur sur le champ « Preuve du remboursement » ; Réglage sans valeur → « Valeur à fixer », aucune valeur inventée ; Couverture non saisie → chaque couple « À vérifier » avec la source à citer ; « Admin : rien de nouveau » en messages d'état, aucun zéro décoratif.

**États, ton, interactions, accessibilité, responsive (EXPERIENCE.md)**

- **UX-DR45 États de contenu** : bloc vide masqué sans espace réservé ; catalogue sans résultat (« Effacer les filtres ») ; Panier, Mes commandes, Ma bibliothèque, Mes Pass, Événements, Blog vides avec les phrases d'EXPERIENCE.md et un lien de sortie ; réseau lent (photo de repli, squelettes, qualité basse d'abord) ; hors ligne (« Pas de connexion. », état du paiement relu à la reconnexion) ; erreur 500 (« Un problème est survenu. Réessaie dans un instant. » + WhatsApp ; pendant un paiement : « Paiement en cours de vérification ») ; brouillon → 404 ; page 404 soignée (H1 « Page introuvable », liens accueil et catalogues).
- **UX-DR46 Ton et libellés imposés** : tutoiement partout ; argot et au plus un emoji par phrase (`aria-hidden`) en vitrine, blog et emails marketing ; **aucun argot ni emoji** dans la liste exhaustive des zones transactionnelles (Panier, commande, paiement, compte, bibliothèque, Kit gratuit, connexion, annulation, réclamation, emails transactionnels, bandeau de zone, badges, Mesures, consentements, Scan, erreurs, légal, admin) ; grands titres de vitrine rédigés sans accent (« Porte-le ou fabrique-le », « Ils le portent », « Rendez-vous otaku », « Jonathan et son atelier ») ; libellés imposés : « Prêt à porter » / « Le fabriquer moi-même », « Fait main à Goma », « Plus disponible », « Commandes complètes pour le moment », « Offert », « Paiement traité par {Prestataire} », « À payer avant [heure] » ; libellés EN à fixer dans la story i18n (E-23).
- **UX-DR47 Primitives d'interaction** : animations vivantes (élévation au survol, parallaxe légère, apparitions au défilement) coupées en `prefers-reduced-motion` ; contenu visible par défaut au rendu serveur (jamais bloqué à `opacity: 0`) ; aucune animation bloquante ni transition > 5 s ; survol réservé aux pointeurs fins avec équivalent tactile et clavier ; chaque geste a une alternative par bouton ; **interdits** : comptes à rebours d'urgence, faux stocks bas, compteurs de places ou de stock (même réels), roues, notifications « X vient d'acheter », pop-ups bloquants, carrousels automatiques, boîtes de dialogue empilées, défilement horizontal, sélection qui change de page.
- **UX-DR48 Plancher d'accessibilité et vérifications (version allégée pour un développeur seul, décision du 2026-10-20)** : WCAG 2.2 AA ; cibles ≥ 44 × 44 px ; un seul H1 ; reflow à 320 px, zoom 200 %, espacement de texte 1.4.12 ; annonces `role="status"` une fois par changement réel, échecs en `role="alert"` ; jamais la couleur seule. **Automatique, à chaque story avec un écran** (tests Playwright) : axe-core sans violation, parcours au clavier, 320 px, zoom 200 %, `prefers-reduced-motion`, `forced-colors`. **Manuel, TalkBack sur Android** : parcours clés (accueil, fiche produit, panier et paiement, bibliothèque, achat de pass, scan), une fois avant la mise en ligne, puis à chaque modification de ces parcours. **VoiceOver iOS** : Jonathan n'a pas d'iPhone ; test fait par un testeur avant l'ouverture des ventes. **Navigateur intégré d'Instagram** : accueil et parcours d'achat, testés avant la mise en ligne.
- **UX-DR49 Gabarits responsive** : une colonne sur mobile ; catalogue 2 colonnes à 375 px, 4 sur ordinateur ; Fiche Kit avec carte d'achat collante à droite ; Page Événement en deux colonnes ; Article en colonne de 720 px ; connexion centrée sur 440 px ; Panier, commande, Achat de Pass : formulaire à gauche, Récapitulatif à droite ; Kit en bibliothèque : lecteur 2/3, chapitres 1/3 ; Compte : colonne de navigation de 300 px ; admin : barre latérale ou onglets ; FAQ sur deux colonnes à partir de l'ordinateur ; aucun défilement horizontal à aucune largeur.
- **UX-DR50 Signes de confiance** : vraies photos, atelier, WhatsApp visible, délai annoncé avant paiement ; aucun avis, compteur ni logo de partenaire ou de Prestataire, d'opérateur ou de réseau de carte sans autorisation écrite ; pas de « réponse sous 24 h » ; JSON-LD jamais `aggregateRating` ni `review` ; tant que Q-3 est ouverte, aucun montant hors USD et aucune phrase sur la devise débitée.

### Désaccords relevés (tranchés par Jonathan le 2026-10-20)

**Décisions :** A1 : le PRD l'emporte, sous-titres anglais facultatifs ; EXPERIENCE.md corrigé le 2026-10-20. A2 : Q-F1 reste ouverte, bloquante pour la mise en ligne seulement. A3 : E-5 fermée dans EXPERIENCE.md le 2026-10-20 ; elle ne bloque aucune story. B : les documents finaux font foi sur les 18 points ; avertissement « Document historique » ajouté en tête du guide. B17 : retenu (15 s, 90 %), reporté dans UX-DR39.

**A. Entre documents finaux**

1. **Sous-titres anglais des Vidéos de kit** : EXPERIENCE.md (2026-10-17) les rend obligatoires si le Kit est vendu sur `/en` et refuse la publication sans eux ; le PRD (Q-15 tranchée le 2026-10-20) et AD-16 les rendent facultatifs, la fiche `/en` l'indiquant. Le PRD prime : sous-titres anglais facultatifs.
2. **Licence Sakura Town** : DESIGN.md la décrit comme une démo à usage personnel, licence commerciale requise (D-1) ; AD-18 cite une licence notée dans `docs/licences/polices.md` (usage commercial confirmé par l'éditeur) tout en gardant Q-F1 ouverte (version complète et accord écrit). La mise en ligne avec Sakura Town reste conditionnée à Q-F1.
3. **Liste E-5 d'EXPERIENCE.md** (« mises à jour PRD nécessaires avant les epics ») : le PRD du 2026-10-20 semble les avoir intégrées (« Prêt à porter », crème par défaut, rouge unique, « Commandes complètes pour le moment », ordre des moyens de paiement, Galerie sans page, titres sans accent). E-5 reste listée comme ouverte dans EXPERIENCE.md.

**B. Entre le guide et les documents finaux** (le guide ne crée aucune exigence ; les documents finaux font foi)

1. Téléchargements : 10 par fichier (guide, règle 4) ↔ illimités (FR-28 ; addendum, déjà tranché).
2. Affiliation : lien `?ref=CODE` mémorisé 60 jours, commission de 20 % validée 14 jours après livraison, espace affilié (phase 9) ↔ Codes promo, commission calculée et payée à la main, aucun compte affilié (FR-46 à FR-48, §9 ; déjà tranché).
3. Pages `/univers/[slug]` et bloc « Produits liés (même univers) » (phases 3 et SEO) ↔ absents du PRD (E-3, E-4) : non construits.
4. Échec de paiement → Commande `cancelled` (phase 6) ↔ `échouée`, repayable (FR-19).
5. Annuler ou rembourser une Commande retire les accès aux Kits ; remise à zéro des téléchargements (phase 4) ↔ `acces_kit` jamais supprimé, Kit conservé dans une Commande mixte annulée (AD-11, FR-25), téléchargements illimités.
6. Retours : pièce en stock retournable sous 14 jours, Kit remboursé si fichier illisible (section Légal) ↔ aucun remboursement d'un Produit physique livré, remplacement sous 48 h, Kits jamais remboursables (FR-26, FR-13).
7. Case Sur-mesure « ni reprise ni échangée » (phase 5) ↔ Mesures confirmées et annulation impossible après le début de la fabrication (FR-13).
8. Compte créé automatiquement avec l'email au paiement (phase 5, user stories) ↔ Compte obligatoire avant paiement, par code à 6 chiffres ou Google (FR-12).
9. Ordre des moyens de paiement selon l'origine du visiteur (« mobile money en premier pour les visiteurs africains ») ↔ pays choisi par le client, aucune détection (FR-16).
10. Délais de remise : Bukavu « moins d'un jour » et Goma « à préciser » (guide) ↔ Goma en moins d'un jour, Bukavu en un jour au plus (CLAUDE.md, EXPERIENCE.md E-26).
11. « Carnet de commandes complet », Plafond compté en commandes (guide) ↔ « Commandes complètes pour le moment », Plafond compté en pièces sur commande (FR-10, AD-26).
12. Accueil : boutons « Voir les cosplays · Découvrir les kits », « 6 derniers produits » et « trois étapes » (phase 2, héros) ↔ « Prêt à porter » / « Le fabriquer moi-même » et 8 blocs ordonnés (FR-1, FR-2) ; bouton « Obtenir le kit gratuit » sur le héros Kits ↔ Kit gratuit à +4 semaines seulement (FR-58).
13. Entité Expédition avec transporteur (guide) ↔ numéro de suivi en texte libre, aucun transporteur (règle 12, FR-24, Q-9).
14. Page de paiement : sondage toutes les 3 s pendant 3 min (phase 6) ↔ 3 s puis « en cours de vérification » après 2 min (AD-10).
15. Confiance : « réponse sous 24 h » (section Légal) ↔ non affiché (EXPERIENCE.md, Paiement & confiance).
16. Questions d'accueil : listes d'options précises (TikTok, Instagram… ; anime, manga…) et choix « les deux » (phase 8) ↔ genres génériques sans liste par défaut (E-29) et sélecteur à deux options « porter / fabriquer » (EXPERIENCE.md).
17. Progression vidéo enregistrée toutes les 15 s, « terminée » à 90 % (phase 7) ↔ non fixé par les documents finaux (à décider dans la story du lecteur, ou à reprendre du guide si tu le valides).
18. Communauté Discord ou WhatsApp après 50 clients (Lancement) ↔ aucune fonction communautaire intégrée (§9, non-objectif ; pas d'impact sur le site).

### Carte de couverture des FR

| FR | Epic | Ce qui est couvert |
|---|---|---|
| FR-1 | 2 | Héros vidéo, photo de repli, Cosplay vedette |
| FR-2 | 2, 3, 7, 8 | Blocs 2, 6, 8 (epic 2) ; blocs 1 et 3 (epic 3) ; bloc 5 (epic 7) ; blocs 4 et 7 (epic 8) |
| FR-3 | 1 | Bandeau « Ouvrir dans Chrome », Google masqué |
| FR-4 | 1 | À propos, FAQ, Contact, pages légales |
| FR-5 | 2, 3 | Catalogues Cosplays et Accessoires (epic 2) ; catalogue Kits et filtre niveau (epic 3) |
| FR-6 | 2 | Fiche d'un Produit physique, avertissement de zone |
| FR-7 | 3 | Double option « Prêt à porter » / « Le fabriquer moi-même » |
| FR-8 | 6 | Sur-mesure et Schéma des Mesures (story bloquée par E-10) |
| FR-9 | 3 | Fiche Kit et « Ouvrir dans ma bibliothèque » |
| FR-10 | 2, 4 | Disponibilité affichée (epic 2) ; vérification et réservation au paiement (epic 4) |
| FR-11 | 4 | Panier sans compte, fusion, règles des Kits |
| FR-12 | 1 | Compte, code email, Google, âge, questions d'accueil |
| FR-13 | 4 | Étape de commande, acceptations, Commande `en attente`, expiration |
| FR-14 | 4 | Récapitulatif avant paiement |
| FR-15 | 4, 5 | Port commun + Polar (epic 4) ; adaptateurs mobile money et K-Pay (epic 5) |
| FR-16 | 4, 5 | Aiguilleur et choix du moyen (epic 4) ; pays, opérateur, Couverture (epic 5) |
| FR-17 | 5 | Repli entre Agrégateurs, Tentatives, vérification |
| FR-18 | 4 | Vérification serveur du Prestataire et tests de la règle 11 |
| FR-19 | 4 | Notifications, `confirmer_paiement`, Trop-perçu, idempotence |
| FR-20 | 4 | Page de retour après paiement |
| FR-21 | 4, 5 | Activation et ordre (epic 4) ; Couverture (epic 5) |
| FR-22 | 6 | Suivi de commande client |
| FR-23 | 6 | Vérification des Mesures |
| FR-24 | 6 | Avancement manuel, numéro de suivi |
| FR-25 | 6 | Annulation d'une Commande de Cosplay, remboursement avec preuve |
| FR-26 | 6 | Réclamation et remplacement |
| FR-27 | 3 | Ma bibliothèque |
| FR-28 | 3 | Téléchargements signés, filigrane |
| FR-29 | 3 | Lecture de la Vidéo de kit, sous-titres, reprise |
| FR-30 | 3 | Accès à vie |
| FR-31 | 7 | Pages Événements, Capacité, « Complet » |
| FR-32 | 7 | Alerte événement |
| FR-33 | 7 | Achat de Pass (paiement réel après l'epic 5) |
| FR-34 | 7 | Émission des Pass, Code QR, code court |
| FR-35 | 7 | Scan à l'entrée |
| FR-36 | 7 | Scan hors ligne, Verrou |
| FR-37 | 7 | Accès bénévole |
| FR-38 | 7 | Annulation et remboursement d'un Pass |
| FR-39 | 7 | Galerie d'événement |
| FR-40 | 8 | Envoi d'une photo |
| FR-41 | 8 | Validation et retrait |
| FR-42 | 8 | Opération « 10 pass gratuits » |
| FR-43 | 8 | Blog |
| FR-44 | 1, 4, 6, 7 | Code de connexion (1) ; payée, Kit ouvert (4) ; statuts, annulation, remboursement (6) ; Pass (7) |
| FR-45 | 9 | Relances |
| FR-46 | 9 | Création d'un Code promo |
| FR-47 | 9 | Application d'un Code promo |
| FR-48 | 9 | Suivi et commission |
| FR-49 | 6, 9 | Liste et détail des Commandes (6) ; tableau de bord, graphiques, tâches (9) |
| FR-50 | 2, 3 | Produits physiques et photos (2) ; contenu des Kits (3) |
| FR-51 | 1, 2, 4, 7 | WhatsApp (1) ; héros, Plafond, forfaits, retrait (2) ; Délai de paiement (4) ; frais d'annulation des Pass (7) |
| FR-52 | 7 | Gestion des Événements |
| FR-53 | 1 | Modèle de droits Assistant écrit (AD-13) ; création des comptes hors lancement |
| FR-54 | 9 | Mesure d'audience |
| FR-55 | 1 | Français et anglais |
| FR-56 | 1 | Socle SEO ; chaque page publique des epics suivants le respecte |
| FR-57 | 2, 3, 7 | Partage des fiches physiques (2), des fiches Kit (3) et des Événements (7) |
| FR-58 | 3 | Kit gratuit |
| FR-59 | 9 | Emails commerciaux ciblés |

NFR-1 à NFR-9 et UX-DR1 à UX-DR50 s'appliquent à toutes les stories concernées ; UX-DR1 à UX-DR17 sont posées dans l'epic 1.

## Liste des epics

### Epic 1 : Le site en ligne, les comptes et l'accès admin
Le visiteur découvre KOMA SHOP en français ou en anglais, en thème crème ou sombre, avec l'en-tête, le pied de page et les pages À propos, FAQ, Contact, légales et 404. Il crée son Compte avec un code reçu par email (ou Google hors navigateur intégré) et déclare son âge. Jonathan se connecte à l'admin avec son rôle.
**FRs couvertes :** FR-3, FR-4, FR-12, FR-44 (code de connexion), FR-51 (numéro WhatsApp), FR-53 (modèle de droits), FR-55, FR-56 (socle)
**Notes :** story 1 = socle vérifié en local (protection de `production` réglée par Jonathan ; hPanel dans la story de mise en ligne) ; réglage du numéro WhatsApp et messages de contact enregistrés comme tâches admin ; tokens, polices (Sakura Town avec repli, Q-F1 bloque seulement la mise en ligne), journal d'audit, limitation des essais.

### Epic 2 : Le catalogue et la page d'accueil
Jonathan crée et publie ses cosplays et accessoires ; le visiteur parcourt les catalogues filtrables, voit des fiches complètes et l'accueil avec son héros vidéo, et partage une fiche.
**FRs couvertes :** FR-1, FR-2 (blocs 2, 6, 8), FR-5 (Cosplays, Accessoires), FR-6, FR-10 (affichage), FR-50 (physiques), FR-51 (héros, Plafond, forfaits, retrait), FR-57 (fiches physiques)
**Notes :** fiche Kit, catalogue Kits, double option et blocs 1 et 3 déplacés vers l'epic 3 (décision du 2026-10-21) ; blocs 4, 5 et 7 masqués jusqu'aux epics 7 et 8. Pagination (E-36 tranchée) : « Voir plus », 12 produits par clic, vrai lien avec curseur.

### Epic 3 : Les Kits et la bibliothèque
Jonathan téléverse fichiers, vidéo, chapitres et sous-titres d'un Kit et le relie à son Cosplay ; le visiteur découvre les Kits (catalogue, fiche, double option sur la fiche du Cosplay), et le visiteur connecté obtient un Kit gratuit, télécharge les PDF filigranés et regarde la vidéo chapitre par chapitre, avec reprise sur un autre appareil.
**FRs couvertes :** FR-2 (blocs 1 et 3), FR-5 (Kits, filtre niveau), FR-7, FR-9, FR-27, FR-28, FR-29, FR-30, FR-50 (Kits), FR-57 (fiches Kit), FR-58
**Notes :** le Kit gratuit ouvre un vrai accès (Commande `offerte`) sans Prestataire : règles 1 et 13 éprouvées avant tout paiement ; Jonathan ne le publie qu'à la 5e semaine. Progression vidéo : enregistrée toutes les 15 s, terminée à 90 %.

### Epic 4 : Le panier, la commande et le premier paiement réel (Kits par carte via Polar)
Le visiteur remplit son Panier sans Compte, se connecte, passe commande, paie un Kit par carte via Polar, le retrouve aussitôt dans sa bibliothèque et reçoit l'email de confirmation.
**FRs couvertes :** FR-10 (vérification), FR-11, FR-13, FR-14, FR-15 (port + Polar), FR-16 (aiguilleur), FR-18, FR-19, FR-20, FR-21 (activation, ordre), FR-44 (payée, Kit ouvert), FR-51 (Délai de paiement)
**Notes :** tous les tests de la règle 11. L'étape de commande gère déjà les Produits physiques ; tant qu'aucun Prestataire ne les couvre, l'écran affiche honnêtement « Carte indisponible ».

### Epic 5 : Le mobile money et la carte K-Pay
Le client paie par mobile money (pays, opérateur, Agrégateur prioritaire, repli proposé) et paie ses Produits physiques et ses Pass par carte via K-Pay.
**FRs couvertes :** FR-15 (adaptateurs), FR-16 (Couverture), FR-17, FR-21 (Couverture), NFR-6
**Notes :** stories K-Pay (mobile money et carte) et MaishaPay bloquées par Q-S1 (documentation officielle dans `docs/references/paiements/`, hors dépôt), avec Q-1 et Q-3 tirées de cette documentation ; PawaPay bloquée par Q-1 et Q-3 ; GeniusPay bloquée par Q-1, Q-2 et Q-3. Stories communes (attente, repli, réconciliation, Trop-perçu, saisie de la Couverture) non bloquées. Condition d'ouverture §6.1 : au moins un Agrégateur RDC et K-Pay carte.

### Epic 6 : Le suivi et l'après-vente des Produits physiques
Une cliente commande un cosplay sur mesure ; Jonathan vérifie les Mesures, fait avancer la Commande et elle reçoit un email à chaque étape ; le client peut annuler avant fabrication ou réclamer sous 48 h ; Jonathan confirme les remboursements avec preuve.
**FRs couvertes :** FR-8, FR-22, FR-23, FR-24, FR-25, FR-26, FR-44 (statuts), FR-49 (Commandes admin)
**Notes :** story Sur-mesure bloquée par E-10 (Jonathan fournit la liste). Les tests automatiques créent des Commandes physiques dans `koma-dev` (règle 13) ; le test réel de bout en bout attend l'epic 5.

### Epic 7 : Le Festival, les Pass et le Scan
Une visiteuse trouve l'Événement, achète ses Pass nominatifs et les reçoit avec leur Code QR ; le jour J, un bénévole scanne, même hors ligne ; Jonathan crée l'Événement, l'Accès bénévole et traite les annulations.
**FRs couvertes :** FR-2 (bloc 5), FR-31 à FR-39, FR-44 (Pass), FR-51 (frais d'annulation), FR-52, FR-57 (Événements)
**Notes :** l'achat payé d'un Pass passe par le mobile money ou K-Pay (epic 5) ; pages, alerte, émission, Scan, Verrou et Accès bénévole n'en dépendent pas. **Nommage (décision du 2026-10-21)** : rubrique « Festival » dans les deux langues, liste à `/fr/festival` et `/en/festival`, une page par Événement sous cette adresse ; le mot reste `evenement` dans le code et la base (AD-14).

### Epic 8 : La communauté (Galerie « Ils le portent », Réalisations, Blog)
Le client envoie sa photo avec son accord, Jonathan la valide et elle apparaît sur le mur ; les 10 premières Réalisations gagnent un Pass ; Jonathan publie des guides.
**FRs couvertes :** FR-2 (blocs 4 et 7), FR-40, FR-41, FR-42, FR-43

### Epic 9 : La croissance, le pilotage et la mise en ligne
Jonathan crée des Codes promo pour ses Affiliés et suit leurs commissions ; les clients consentants reçoivent Relances et emails ciblés ; Jonathan ouvre chaque matin un tableau de bord aux vrais chiffres.
**FRs couvertes :** FR-45, FR-46, FR-47, FR-48, FR-49 (tableau de bord), FR-54, FR-59
**Notes :** FR-47 modifie `creer_commande` (epic 4) selon AD-1 : départ de la dernière version, tous les tests repassent. Dernière story : **mise en ligne** (domaine Q-D1, hPanel, variables d'environnement de production, Resend et SMTP de Supabase Auth, migrations de production, tests TalkBack et Instagram), juste avant l'ouverture des ventes, bloquée par Q-D1.

**Dépendances :** 1 → 2 → 3 → 4 → 5 ; 6 s'appuie sur 4 ; 7 et 8 sur 1 à 4 ; 9 sur 4. Aucun epic n'a besoin d'un epic suivant pour fonctionner.

## Règles communes à toutes les stories

Ces règles valent pour chaque story de chaque epic ; les critères d'acceptation ne les répètent pas.

- **Terminé** : lint, vérification des types, tests (Vitest, tests SQL, Playwright) et build passent en local et dans GitHub Actions ; liste des fichiers changés, tests à faire à la main et message de commit proposé (CLAUDE.md).
- **Story avec un écran** (UX-DR48) : les tests Playwright de la story vérifient axe-core sans violation, le parcours au clavier, 320 px, zoom 200 %, `prefers-reduced-motion` et `forced-colors` ; aucun défilement horizontal à 375 px (règle 7) ; tous les textes visibles viennent de `messages/fr.json` et `messages/en.json`, dans les deux langues.
- **Test sur téléphone** : tant que le domaine n'existe pas (Q-D1), Jonathan teste sur son téléphone, connecté au même Wi-Fi que son PC, à l'adresse réseau local du serveur de développement.
- **Données** : chaque story crée seulement les tables, fonctions et politiques RLS dont elle a besoin, par une nouvelle migration (jamais en modifiant une migration appliquée) ; RLS active sur toute nouvelle table (règle 1) ; toute écriture passe par une Server Action ou une route API validée par Zod (AD-2) ; toute variable d'environnement ajoutée est déclarée dans `.env.example` sans valeur et dans `src/lib/env.ts` (règle 4).
- **Honnêteté** : aucune donnée, aucun email, aucun statut ni aucune réponse d'API simulés hors des tests automatiques ; les doubles de test vivent dans `tests/doubles/`, préfixés `TEST_` (règle 13, NFR-8).
- **Exigences transverses** : NFR-1 à NFR-9 s'appliquent à chaque story concernée (mobile d'abord, performance, accessibilité, contenus payants, intégrité des paiements, résilience, secrets, honnêteté, traçabilité) ; chaque écran suit les gabarits responsive (UX-DR49) et les signes de confiance autorisés, sans avis, compteur ni logo non autorisé (UX-DR50).

## Epic 1 : Le site en ligne, les comptes et l'accès admin

Le visiteur découvre KOMA SHOP en français ou en anglais, en thème crème ou sombre, avec l'en-tête, le pied de page et les pages À propos, FAQ, Contact et légales. Il crée son Compte avec un code reçu par email (ou Google hors navigateur intégré) et déclare son âge. Jonathan se connecte à l'admin, règle son numéro WhatsApp et retrouve les messages de contact.

### Story 1.1 : Socle du projet, tests et intégration continue

En tant que Jonathan,
je veux un projet Next.js relié à `koma-dev`, avec ses tests et son intégration continue,
afin que chaque story suivante parte d'une base vérifiée.

**Critères d'acceptation :**

**Étant donné** le dépôt actuel (documents de planification seulement)
**Quand** la story est livrée
**Alors** l'application est créée par `create-next-app@16.4.2` (TypeScript, Tailwind CSS 4.3.3, ESLint, `src/`, App Router) avec `cacheComponents: true`
**Et** les versions du tableau Stack de l'architecture sont figées dans `package.json` (Node 24.x déclaré dans `engines`)

**Étant donné** le projet créé
**Quand** un développeur lit `src/lib/supabase/`
**Alors** il y trouve exactement trois clients (`public.ts`, `session.ts`, `service.ts`), `service.ts` important `server-only` (AD-2)
**Et** `src/proxy.ts` rafraîchit la session Supabase sans jamais rediriger une page publique vers la connexion

**Étant donné** une variable d'environnement obligatoire absente
**Quand** l'application démarre
**Alors** `src/lib/env.ts` (Zod) arrête le démarrage avec un message qui nomme la variable sans afficher de valeur
**Et** `.env.example` liste les variables utilisées, sans valeur ; `.env.local` reste ignoré par Git (règle 4)
**Et** l'adresse du site n'est lue que dans `NEXT_PUBLIC_SITE_URL` : un test échoue si un nom de domaine est écrit en dur dans `src/` (Q-D1)

**Étant donné** la Supabase CLI 2.121.0
**Quand** Jonathan lance les commandes documentées
**Alors** le projet est lié à `koma-dev`, les migrations s'appliquent, et les types sont générés dans `src/lib/supabase/types.ts`

**Étant donné** Vitest 5.0.5, Playwright 1.64.1 et le dossier `supabase/tests/`
**Quand** `npm run test`, `npm run test:sql` et `npm run test:e2e` sont lancés
**Alors** au moins un test de chaque type passe
**Et** une règle de lint interdit à tout fichier de `src/` d'importer `tests/doubles/`

**Étant donné** un push sur `main`
**Quand** GitHub Actions s'exécute
**Alors** le workflow `.github/workflows/ci.yml` lance lint, typecheck, Vitest, tests SQL sur une base Supabase locale démarrée par la CLI, et build ; il est vert
**Et** le workflow ne contient aucun secret : il n'utilise que les clés locales générées par la CLI

**Étant donné** le serveur de développement lancé en réseau local
**Quand** Jonathan ouvre `/api/sante` sur son téléphone
**Alors** la route répond 200 avec un état JSON lu côté serveur (connexion à la base vérifiée)

**Étant donné** la story livrée
**Quand** Jonathan la clôt
**Alors** la section « Commandes » de `CLAUDE.md` liste dev, lint, typecheck, test, test:sql, test:e2e et build
**Et** la branche `production` existe, créée depuis un commit vert de `main`
**Et** Jonathan a activé sur GitHub la protection de `production` (contrôle CI requis, force push et suppression interdits, aucun contournement) ; la story n'est terminée qu'après ce réglage manuel (AD-20). Le réglage hPanel est fait dans la story de mise en ligne (epic 9).

### Story 1.2 : Site bilingue et socle SEO

En tant que visiteur,
je veux lire le site en français ou en anglais, à une adresse claire,
afin de comprendre la boutique dans ma langue et de la trouver sur Google.

**Critères d'acceptation :**

**Étant donné** next-intl 4.14.9
**Quand** un visiteur ouvre `/fr` ou `/en`
**Alors** la page s'affiche dans cette langue, avec `<html lang>` correspondant

**Étant donné** un visiteur qui ouvre `/` (décision de Jonathan du 2026-10-21)
**Quand** le serveur choisit la langue
**Alors** un choix déjà fait avec le sélecteur de langue, mémorisé dans un cookie, passe en premier
**Et** sans ce cookie, le serveur lit la langue du navigateur : une langue `fr*` mène à `/fr`, toute autre langue connue à `/en`, une langue absente ou illisible à `/fr`
**Et** des tests couvrent les quatre cas (cookie, `fr-CD`, `en-US`, en-tête absent)

**Étant donné** le sélecteur de langue (story 1.3)
**Quand** le visiteur change de langue
**Alors** son choix est enregistré dans le cookie de langue, sans autre donnée personnelle

**Étant donné** `messages/fr.json` et `messages/en.json`
**Quand** les tests tournent
**Alors** un test échoue si une clé existe dans une langue et manque dans l'autre
**Et** une règle de lint refuse tout texte visible écrit en dur dans un composant (FR-55)

**Étant donné** une page publique
**Quand** son HTML est généré
**Alors** elle a un titre et une description uniques, une URL canonique et des balises hreflang `fr`, `en` et `x-default`, construites depuis `NEXT_PUBLIC_SITE_URL` par `src/lib/seo/`
**Et** `x-default` pointe vers `/fr`
**Et** des balises Open Graph, et un seul H1 (vérifié par Playwright)
**Et** le JSON-LD `Organization` (nom lu dans `nom_site`, NATHANGROUP SARL, Goma, RDC) est présent, sans note, avis ni chiffre (règles 5 et 8)

**Étant donné** le nom affiché du site, pas encore définitif (Q-N1)
**Quand** la story crée la table `reglage` (module `admin`) avec le réglage `nom_site`, valeur de départ « KOMA SHOP »
**Alors** `nom_site` est la seule source du nom dans les titres de page, l'Open Graph, le JSON-LD `Organization`, le pied de page, les emails et le filigrane ; un test échoue si le nom est écrit en dur dans `src/` ou dans `messages/*.json`
**Et** la lecture passe par le client public mis en cache avec l'étiquette `reglages` (AD-17)

**Étant donné** le site
**Quand** un robot lit `/sitemap.xml` et `/robots.txt`
**Alors** le plan du site liste les pages publiques existantes dans les deux langues, avec des adresses fondées sur `NEXT_PUBLIC_SITE_URL`
**Et** `robots.txt` exclut l'admin, le compte et les routes `/api`

**Étant donné** une adresse inconnue
**Quand** un visiteur l'ouvre sur son téléphone
**Alors** il voit la page 404 (statut HTTP 404), H1 « Page introuvable », avec un lien vers l'accueil
**Et** la page existe en `/fr` et en `/en`

### Story 1.3 : Identité visuelle et gabarit commun

En tant que visiteur,
je veux un site au style KOMA (crème ou sombre) avec une navigation simple au doigt et au clavier,
afin de m'y retrouver et d'avoir envie de rester.

**Critères d'acceptation :**

**Étant donné** DESIGN.md
**Quand** la story est livrée
**Alors** les rôles de couleur des deux thèmes, les rayons, les espacements et les rôles typographiques sont déclarés dans le thème Tailwind avec les valeurs exactes de DESIGN.md (UX-DR1, UX-DR3, UX-DR5)
**Et** un test vérifie que le rouge est uniquement `#E3261C` et que le texte des boutons rouges est `#FFFFFF` (UX-DR2)

**Étant donné** les polices
**Quand** le site les charge
**Alors** Barlow et Barlow Condensed sont auto-hébergées par `next/font/local`, et leur licence est notée dans `docs/licences/` (règle 6)
**Et** Sakura Town est chargée depuis le fichier local avec `font-display: swap` et un repli métrique Barlow Condensed ; un titre qui contient un caractère absent de Sakura Town s'affiche en entier en Barlow Condensed (test côté serveur, UX-DR4)
**Et** la mise en ligne avec Sakura Town reste bloquée par Q-F1 ; sans licence confirmée, une seule option de configuration bascule les titres en Barlow Condensed

**Étant donné** un visiteur sur téléphone
**Quand** il touche la bascule de thème
**Alors** le site passe de crème à sombre et inversement, `aria-pressed` change, et le choix est mémorisé
**Et** au rechargement, le bon thème s'affiche dès le premier rendu, sans flash (script dans `<head>`, UX-DR7)
**Et** en `forced-colors`, le verre est remplacé par `Canvas` et la sélection reste visible (UX-DR7)

**Étant donné** l'en-tête
**Quand** la page s'affiche à 375 px
**Alors** le logo principal horizontal est à gauche (version couleur en crème, inverse en sombre, alt « KOMA SHOP », UX-DR8), suivi à droite de l'icône panier et du bouton ☰
**Et** sur ordinateur, l'en-tête montre les rubriques et les icônes thème, langue et compte, sans débordement à 1280 px
**Et** chaque rubrique dont la page n'existe pas encore n'est pas affichée ; elle apparaît avec la story qui crée sa page

**Étant donné** le menu ☰ (UX-DR11)
**Quand** le visiteur l'ouvre au doigt ou au clavier
**Alors** le panneau opaque s'ouvre en `role="dialog"`, le focus va au premier élément, le reste de la page est `inert`
**Et** Échap, « Fermer le menu » ou le choix d'une rubrique le ferme, et le focus revient au bouton ☰

**Étant donné** une page quelconque
**Quand** le visiteur appuie sur Tab
**Alors** le premier élément focalisable est « Aller au contenu », qui mène à `<main id="contenu">` (UX-DR12)
**Et** l'anneau de focus double est visible sur tout fond et n'est jamais caché par l'en-tête collant (UX-DR10)

**Étant donné** le sélecteur de langue (UX-DR14)
**Quand** le visiteur passe de « Français » à « English »
**Alors** il reste sur la même page dans l'autre langue

**Étant donné** le pied de page (UX-DR13)
**Quand** il s'affiche
**Alors** la carte d'identité porte le nom lu dans `nom_site` et dit « Fait main à Goma, RDC. NATHANGROUP SARL. » ; les cartes Aide, Infos légales et Paiement n'apparaissent qu'avec les stories qui créent leurs pages ou leurs données (1.8, 1.9, epic 4)

**Étant donné** les composants de base
**Quand** une story suivante en a besoin
**Alors** bouton principal, bouton secondaire (avec `aria-disabled` et raison reliée), boîte de dialogue, squelette, message d'état et motif manga (≤ 6 %, jamais sur photo) existent et sont couverts par des tests de composants (UX-DR6, UX-DR9, UX-DR15, UX-DR16, UX-DR30)
**Et** les animations sont coupées en `prefers-reduced-motion` et le contenu reste visible sans JavaScript (UX-DR47)

### Story 1.4 : Création de compte et connexion par code email

En tant que visiteur,
je veux créer mon Compte et me connecter avec un code reçu par email,
afin d'acheter plus tard sans mot de passe à retenir.

**Critères d'acceptation :**

**Étant donné** la page de connexion
**Quand** le visiteur saisit son email et demande un code
**Alors** Supabase Auth envoie un code à 6 chiffres, valable 10 minutes, renvoyable après 60 secondes (AD-24)
**Et** en développement, l'envoi passe par le service par défaut de Supabase sur `koma-dev` (nombre d'emails limité) ; l'envoi par Resend est réglé dans la story de mise en ligne
**Et** le message « Un nouveau code a été envoyé à [email] » ne s'affiche qu'après la réponse réelle de Supabase (règle 13)

**Étant donné** le champ du code (UX-DR28)
**Quand** le visiteur colle ou tape le code
**Alors** un seul champ `one-time-code` accepte le collage, et la validité et le délai de renvoi sont écrits en texte
**Et** un code faux affiche « Ce code n'est pas le bon. Vérifie-le ou demande un nouveau code. » relié au champ
**Et** un code expiré affiche « Ce code a expiré. » avec « Renvoyer le code » mis en avant
**Et** l'aide « email non reçu » propose de vérifier l'adresse et les courriers indésirables, de renvoyer le code ou de changer d'adresse

**Étant donné** un premier accès
**Quand** le Compte est créé
**Alors** une ligne `profil` est créée avec la langue de la route (`fr` ou `en`)
**Et** l'âge est demandé dans un champ numérique ; tant qu'il n'est pas déclaré, le Compte est incomplet et toute action réservée aux Comptes complets est refusée côté serveur (AD-24)

**Étant donné** une déclaration d'âge
**Quand** l'âge est inférieur à 13 ans
**Alors** la fonction de profil refuse, le Compte est supprimé et le visiteur voit un message clair ; rien n'est conservé
**Et** de 13 à 17 ans, `est_mineur(compte)` renvoie vrai ; à 18 ans et plus, faux (tests SQL)

**Étant donné** un visiteur qui se connecte depuis une page
**Quand** la connexion réussit
**Alors** il revient à la page quittée ; le chemin de retour est validé côté serveur et toute adresse externe est refusée (test)
**Et** il peut se déconnecter depuis l'en-tête ou le ☰

**Étant donné** les tests e2e
**Quand** ils créent un Compte
**Alors** ils lisent le code dans la boîte de test de la base Supabase locale (aucun envoi réel, aucun code simulé dans le site)

**Note :** la langue de l'email du code dépend des possibilités des modèles de Supabase Auth ; elle sera vérifiée au plan de la story, sans comportement inventé (règle 15).

### Story 1.5 : Navigateurs intégrés et connexion Google

En tant que visiteur arrivé depuis Instagram,
je veux savoir comment ouvrir le site dans mon navigateur et me connecter sans blocage,
afin de ne pas tomber sur une erreur de connexion Google.

**Critères d'acceptation :**

**Étant donné** une requête dont l'agent utilisateur est celui d'un navigateur intégré (Instagram, Facebook, TikTok…)
**Quand** une page s'affiche
**Alors** un bandeau non bloquant (`role="region"` libellé, UX-DR25) invite à « Ouvrir dans Chrome » ou dans le navigateur du téléphone
**Et** le bandeau se ferme par un bouton de 44 px, le choix est mémorisé, et il ne recouvre jamais un élément focalisé
**Et** la détection est faite côté serveur par un seul module, couvert par des tests d'agents utilisateurs réels

**Étant donné** un navigateur intégré
**Quand** le visiteur ouvre la page de connexion
**Alors** le bouton Google est absent et la connexion par code reste disponible (FR-3, FR-12)

**Étant donné** Chrome ou Safari
**Quand** le visiteur choisit « Continuer avec Google » (libellé texte seul, E-37)
**Alors** la connexion Google aboutit et le ramène à la page quittée
**Et** un Compte créé par Google reste incomplet tant que l'âge n'est pas déclaré (AD-24)

**Étant donné** les identifiants Google OAuth
**Quand** la story est livrée
**Alors** ils sont saisis par Jonathan dans Supabase (`koma-dev`), jamais dans le dépôt (règle 4) ; c'est un réglage manuel de la definition of done

**Note :** la manière exacte d'ouvrir Chrome (lien Android, instruction texte sur iPhone) sera validée au plan de la story, puis testée sur téléphone dans Instagram.

### Story 1.6 : Questions d'accueil

En tant que nouveau client,
je veux répondre si je le souhaite à trois questions rapides,
afin que KOMA SHOP me propose ce qui me correspond.

**Critères d'acceptation :**

**Étant donné** un Compte qui vient d'être créé et dont l'âge est déclaré
**Quand** la création se termine
**Alors** les trois questions facultatives s'affichent une seule fois : « Comment nous as-tu connus ? », « Quel univers préfères-tu ? », « Tu préfères porter ou fabriquer ? »
**Et** un bouton « Passer » ramène aussitôt à la page et au Panier quittés ; répondre ramène au même endroit (FR-12)

**Étant donné** la question « Tu préfères porter ou fabriquer ? »
**Quand** elle s'affiche
**Alors** c'est un sélecteur à deux options, sans action au choix (UX-DR23)

**Étant donné** la question « Quel univers préfères-tu ? »
**Quand** aucun univers n'existe encore en base (ils sont créés dans l'admin à l'epic 2)
**Alors** la question n'est pas affichée ; aucune liste n'est saisie par défaut (E-29)

**Étant donné** la question « Comment nous as-tu connus ? »
**Quand** elle s'affiche
**Alors** elle propose une seule réponse parmi : TikTok, Instagram, Facebook, YouTube, WhatsApp, Google, ChatGPT ou une autre IA, un ami, un festival ou un événement KOMA, autre (liste fournie par Jonathan le 2026-10-21)
**Et** elle reste facultative

**Étant donné** des réponses envoyées
**Quand** le serveur les reçoit
**Alors** elles sont enregistrées dans le profil (Zod, AD-2) et serviront à l'origine des ventes (FR-54) et à l'email « nouveau produit dans ton univers » (FR-59)

### Story 1.7 : Accès admin, rôles, journal et réglage WhatsApp

En tant que Jonathan,
je veux une admin réservée à mon rôle, qui garde la trace de chaque modification,
afin de gérer la boutique sans qu'un client puisse y entrer.

**Critères d'acceptation :**

**Étant donné** la table `role_utilisateur` et la fonction `a_le_role` (AD-13)
**Quand** un Compte sans rôle `admin` ouvre une page `/admin`
**Alors** il voit la page 404 ; un visiteur non connecté est envoyé vers la connexion
**Et** chaque action admin vérifie `a_le_role` côté serveur par `src/lib/auth/droits.ts`, et chaque fonction d'écriture la revérifie (`KS_DROIT_REFUSE`, tests SQL)

**Étant donné** le premier Compte admin
**Quand** Jonathan doit s'attribuer le rôle
**Alors** il lance une commande documentée qui prend son email en argument ; aucun email ni identifiant de Compte n'est écrit dans une migration ou dans le dépôt (règle 4)

**Étant donné** le rôle `assistant`
**Quand** `droits.ts` est testé
**Alors** les droits et les interdits de FR-53 sont écrits et prouvés par des tests, sans qu'aucun écran ne permette encore de créer un Assistant

**Étant donné** une écriture admin
**Quand** elle modifie une table métier
**Alors** `src/lib/auth/auteur.ts` construit `p_auteur` depuis la session vérifiée, et le trigger `journaliser()` écrit dans `journal_audit` les colonnes modifiées, emails et téléphones masqués (AD-21, AD-25)
**Et** le trigger refuse une écriture sans auteur (test SQL)

**Étant donné** la CI
**Quand** les tests SQL tournent
**Alors** un test échoue si une fonction exécutable par `anon` ou `authenticated` écrit (AD-3)
**Et** un test échoue si une colonne lisible par `anon` se nomme `prive`, `chemin` ou `note_admin` (AD-30)

**Étant donné** l'admin sur téléphone et sur ordinateur (UX-DR42)
**Quand** Jonathan l'ouvre
**Alors** il voit la barre latérale sur ordinateur et la barre d'onglets en bas sur mobile, sans Sakura Town ni motif manga, avec seulement les entrées qui existent déjà
**Et** les pages admin portent `noindex`

**Étant donné** la page Réglages
**Quand** Jonathan enregistre son numéro WhatsApp ou modifie le nom du site (`nom_site`, créé à la story 1.2)
**Alors** la valeur est enregistrée dans `reglage`, journalisée, le cache `reglages` est invalidé, et le message de succès n'apparaît qu'après l'enregistrement réel (FR-51)
**Et** un réglage sans valeur affiche « Valeur à fixer » ; une fonction qui en dépend renvoie `KS_REGLAGE_MANQUANT` (UX-DR44)

### Story 1.8 : Pages À propos, FAQ et Contact

En tant que visiteur,
je veux découvrir Jonathan et son atelier, lire les réponses aux questions courantes et écrire à KOMA SHOP,
afin d'avoir confiance avant d'acheter.

**Critères d'acceptation :**

**Étant donné** les pages À propos (H1 « Jonathan et son atelier »), FAQ et Contact, en `/fr` et `/en`
**Quand** elles s'affichent
**Alors** leurs textes viennent uniquement des fichiers de traduction (FR-4) ; chaque texte que Jonathan n'a pas encore fourni affiche « [Texte à fournir] » en développement (Q-5, Q-10)
**Et** `npm run build` échoue en production si ce marqueur reste dans un texte utilisé par une page publique (contrôle automatique)
**Et** aucune photo, aucun chiffre ni aucun témoignage n'est ajouté s'il n'a pas été fourni (règle 5)

**Étant donné** la FAQ
**Quand** elle s'affiche
**Alors** ses questions sont des accordéons indépendants au clavier (UX-DR19), et le JSON-LD `FAQPage` ne contient que des questions et réponses réelles, jamais le marqueur

**Étant donné** le numéro WhatsApp réglé dans l'admin
**Quand** le visiteur touche « Écrire sur WhatsApp » (À propos, Contact)
**Alors** WhatsApp s'ouvre vers ce numéro (UX-DR17)
**Et** si aucun numéro n'est réglé, le bouton n'est pas affiché

**Étant donné** le formulaire de contact (nom, email, message, libellés visibles, UX-DR27)
**Quand** le visiteur l'envoie
**Alors** le message est enregistré dans `message_contact` (module `admin`, statut `nouveau`) comme tâche admin à traiter, sans envoi d'email au lancement
**Et** la RLS ne donne ni lecture ni écriture à `anon` ou `authenticated` : seul l'Admin lit et traite les messages, par le serveur
**Et** le message « Message envoyé » n'apparaît qu'après l'enregistrement réel ; en cas d'erreur, rien de ce qui a été saisi n'est perdu
**Et** les envois sont limités par `consommer_essai` (AD-22) ; au-delà, un message clair demande de réessayer plus tard

**Étant donné** l'admin
**Quand** Jonathan ouvre la liste des messages de contact
**Alors** il voit les messages non traités, peut en marquer un comme `traite` (journalisé), et le compteur de la tâche apparaît dans la navigation admin

**Étant donné** le pied de page
**Quand** ces pages existent
**Alors** la carte Aide affiche FAQ, Contact et WhatsApp (si réglé), et l'en-tête affiche la rubrique À propos

**Note :** la durée de conservation des messages de contact reste ouverte avec Q-5 (spine d'architecture, ajouté le 2026-10-21).

### Story 1.9 : Pages légales

En tant que visiteur,
je veux lire les mentions légales, les CGV, la politique de livraison et de retours et la politique de confidentialité,
afin de savoir à qui j'achète et à quelles conditions.

**Critères d'acceptation :**

**Étant donné** les quatre pages légales, en `/fr` et `/en`
**Quand** elles s'affichent
**Alors** leurs textes viennent des fichiers de traduction, fournis par Jonathan et validés par un juriste (FR-4, Q-5) ; tant qu'ils manquent, « [Texte à fournir] » s'affiche en développement et le build de production échoue
**Et** aucun texte légal n'est rédigé ni complété par le code (règle 15)

**Étant donné** un texte légal
**Quand** il s'affiche
**Alors** il porte sa date de version, que les acceptations de commande enregistreront plus tard (AD-34)

**Étant donné** le pied de page
**Quand** les pages existent
**Alors** la carte Infos légales mène aux quatre pages, chaque lien ayant une hauteur de 44 px

**Point bloquant :** le contenu dépend de Q-5 ; la structure des pages ne l'attend pas.

## Epic 2 : Le catalogue et la page d'accueil

Jonathan crée et publie ses cosplays et accessoires ; le visiteur parcourt les catalogues filtrables, voit des fiches complètes (prix, délai, remise) et l'accueil avec son héros vidéo, et partage une fiche. Les Kits (fiche, catalogue, double option, blocs 1 et 3 de l'accueil) arrivent à l'epic 3.

### Story 2.1 : Univers et création d'un produit physique

En tant que Jonathan,
je veux créer un cosplay ou un accessoire avec ses tailles, son stock et son délai, en brouillon,
afin de préparer mon catalogue avant de le montrer.

**Critères d'acceptation :**

**Étant donné** les tables `univers`, `produit` et `variante` (module `catalogue`)
**Quand** la migration est appliquée
**Alors** la RLS ne donne à `anon` et `authenticated` qu'un `SELECT` sur les produits publiés (`publie_le` non nul et passé) et leurs variantes, et sur les univers ; aucune écriture (AD-2, AD-30)
**Et** un test SQL prouve qu'un brouillon n'est lisible ni par `anon` ni par un client connecté

**Étant donné** l'admin
**Quand** Jonathan crée un univers (nom FR et EN)
**Alors** il est enregistré et journalisé ; aucune liste d'univers n'est créée par défaut (E-29)

**Étant donné** le formulaire de produit
**Quand** Jonathan crée un produit
**Alors** il choisit la Famille `cosplay` ou `accessoire` (la Famille `kit` arrive à l'epic 3), saisit titre et description en FR et en EN, l'univers, et le prix en USD
**Et** le prix est enregistré en centimes entiers avec la devise `USD` et affiché par `src/lib/argent.ts` (AD-8)
**Et** une adresse lisible (slug) est proposée depuis le titre, unique et modifiable

**Étant donné** un produit
**Quand** Jonathan ajoute ses variantes
**Alors** il choisit les tailles parmi XS, S, M, L, XL, XXL, et Sur-mesure pour un cosplay seulement ; pour chaque variante : quantité en stock (entier ≥ 0), Fabrication sur commande autorisée ou non, Délai de fabrication en jours (par produit ou par variante, FR-50)
**Et** le stock n'est modifié que par une fonction d'écriture journalisée (AD-3)

**Étant donné** un produit enregistré
**Quand** il n'est pas encore publié
**Alors** il est en brouillon (`publie_le` vide) et n'apparaît nulle part côté public

**Étant donné** la liste des produits de l'admin
**Quand** Jonathan l'ouvre sur son téléphone
**Alors** il voit Famille, statut (brouillon ou publié) et prix, en cartes sur mobile et en tableau sur ordinateur (UX-DR43)

### Story 2.2 : Photos et publication d'un produit

En tant que Jonathan,
je veux ajouter mes photos dans l'ordre voulu et publier mon produit,
afin qu'il apparaisse dans la boutique avec toutes les informations exigées.

**Critères d'acceptation :**

**Étant donné** un produit en cours d'édition
**Quand** Jonathan ajoute une photo
**Alors** le serveur vérifie son rôle puis crée une autorisation signée ; le navigateur envoie la photo en TUS dans le bucket **privé** `galerie-attente` (créé par cette story), jamais directement dans le public (AD-18)
**Et** le serveur supprime toutes les métadonnées de la photo (EXIF, position GPS) puis copie le résultat dans `produits-public` et efface l'original d'attente ; un test prouve qu'une photo avec une position GPS est publiée sans elle (décision du 2026-10-21)
**Et** une barre de progression affiche la valeur en texte, reprend après une coupure de connexion et propose « Annuler l'envoi » (UX-DR30)
**Et** seuls JPEG, PNG et WebP de 15 Mo au plus sont acceptés (décision du 2026-10-21) ; un fichier refusé donne un message qui rappelle les formats et la limite
**Et** le site produit lui-même les versions légères pour l'affichage (`next/image`, AD-18)

**Étant donné** des photos
**Quand** Jonathan les réordonne
**Alors** les boutons Monter et Descendre (44 px, nom complet, `aria-disabled` en bout de liste) changent l'ordre, au doigt comme au clavier (UX-DR43)
**Et** chaque photo exige un texte alternatif en FR et en EN

**Étant donné** un produit incomplet
**Quand** Jonathan touche « Publier »
**Alors** la publication est refusée et la liste des manques s'affiche : prix, photo, texte alternatif, texte FR ou EN, variante (FR-50, UX-DR44)

**Étant donné** un produit complet
**Quand** Jonathan le publie
**Alors** `publie_le` est posé, l'action est journalisée, et le cache public est invalidé par les étiquettes de `src/lib/cache/etiquettes.ts` (AD-17)
**Et** « Dépublier » le retire de nouveau de tout affichage public

**Étant donné** les tests
**Quand** ils ont besoin d'images
**Alors** ils utilisent des images générées par les tests, jamais une image tierce (règle 6)

### Story 2.3 : Réglages de remise et Plafond de fabrication

En tant que Jonathan,
je veux régler les forfaits de livraison, le lieu de retrait et le Plafond de fabrication,
afin que les fiches affichent la bonne remise et que je ne prenne pas plus de commandes que je ne peux en fabriquer.

**Critères d'acceptation :**

**Étant donné** la page Réglages
**Quand** Jonathan saisit le Forfait de livraison de Goma et celui de Bukavu (USD), le lieu et les modalités du retrait à Goma (FR et EN) et le Plafond de fabrication (nombre de pièces)
**Alors** chaque valeur est enregistrée dans `reglage`, journalisée, et confirmée seulement après l'enregistrement réel (FR-51)
**Et** une valeur jamais saisie affiche « Valeur à fixer » ; aucune valeur par défaut n'est inventée (règle 15)

**Étant donné** les tranches de prix du filtre des catalogues
**Quand** Jonathan les règle (libellé FR et EN, borne basse et borne haute en USD, ordre)
**Alors** elles sont enregistrées et journalisées ; sans tranche réglée, le filtre prix n'est pas affiché (décision du 2026-10-21)

**Étant donné** les fonctions `stock_disponible(variante)` et `places_fabrication_utilisees()`
**Quand** elles sont créées
**Alors** elles sont en lecture pure, exécutables par `anon` et `authenticated` (AD-3)
**Et** dans cette story, `stock_disponible` vaut le stock de la variante et `places_fabrication_utilisees` vaut 0, aucune Commande n'existant encore ; l'epic 4 les remplace par `CREATE OR REPLACE` pour compter les réservations (AD-1, AD-26)
**Et** des tests SQL couvrent les deux fonctions

**Étant donné** les délais de remise
**Quand** ils s'affichent
**Alors** ils viennent d'un texte fixe des fichiers de traduction (Goma : moins d'un jour ; Bukavu : un jour au plus), sans nouveau réglage (E-26)

### Story 2.4 : Catalogues Cosplays et Accessoires

En tant que visiteur,
je veux parcourir les cosplays et les accessoires, les filtrer et les trier,
afin de trouver vite la pièce qui me plaît.

**Critères d'acceptation :**

**Étant donné** des produits publiés
**Quand** le visiteur ouvre le catalogue Cosplays (`/fr/cosplays`, `/en/cosplays`) ou Accessoires (`/fr/accessoires`, `/en/accessories`)
**Alors** il voit une grille de cartes (2 colonnes à 375 px, 4 sur ordinateur) : photo, nom (`h3 > a` étendu à la carte), prix USD et Badge de disponibilité (UX-DR19, UX-DR20)
**Et** le badge et toute donnée qui dépend des ventes sont rendus à chaque requête, jamais servis par un segment en cache (AD-17)
**Et** aucun badge n'affiche de quantité

**Étant donné** les filtres (univers, prix, disponibilité) et le tri (nouveauté, prix croissant, prix décroissant)
**Quand** le visiteur en choisit un
**Alors** l'adresse reflète les filtres et le tri, le nombre de résultats est annoncé (`role="status"`), et « Effacer les filtres » apparaît (UX-DR21)
**Et** sur mobile, les filtres se replient sous « Filtrer (n) » au-delà d'une ligne
**Et** le filtre prix propose les tranches réglées dans l'admin (story 2.3), en pilules simples au doigt

**Étant donné** plus de 12 produits
**Quand** le visiteur touche « Voir plus »
**Alors** « Voir plus » est un vrai lien `<a>` dont l'adresse contient le curseur de la suite (pagination par curseur, jamais par décalage)
**Et** avec JavaScript, les 12 produits suivants s'ajoutent sous la liste, l'adresse est mise à jour et le focus va au premier produit ajouté ; sans JavaScript, le lien ouvre la même liste prolongée
**Et** une adresse partagée ou rechargée affiche la même liste, et Google peut parcourir tout le catalogue

**Étant donné** un catalogue filtré, trié ou prolongé (adresse avec query)
**Quand** le visiteur change de langue avec le sélecteur
**Alors** il reste sur la même page, avec les mêmes filtres, tri et curseur dans l'adresse (le sélecteur de langue de la story 1.3 ne conserve aujourd'hui que le chemin ; `useSearchParams` sous Suspense, compatible `cacheComponents`)

**Étant donné** aucun produit ou aucun résultat
**Quand** le catalogue s'affiche
**Alors** une phrase courte et « Effacer les filtres » s'affichent (UX-DR45)

**Étant donné** un produit en brouillon
**Quand** on cherche à l'atteindre
**Alors** il n'apparaît ni dans le catalogue, ni dans le plan du site (FR-5)
**Et** les catalogues ont leurs métadonnées, leur JSON-LD BreadcrumbList et leurs entrées dans le plan du site ; les rubriques Cosplays et Accessoires apparaissent dans l'en-tête et le menu ☰

### Story 2.5 : Fiche d'un produit physique

En tant que visiteur,
je veux voir tout ce qu'il faut savoir sur un cosplay ou un accessoire avant de le commander,
afin de décider sans mauvaise surprise sur le prix, le délai ou la remise.

**Critères d'acceptation :**

**Étant donné** un produit publié
**Quand** le visiteur ouvre sa fiche, sous l'adresse de son catalogue (`/fr/cosplays/[slug]`, `/fr/accessoires/[slug]`, `/en/cosplays/[slug]`, `/en/accessories/[slug]`)
**Alors** il voit la galerie photo (balayage et boutons « Photo précédente / suivante », vignettes au clavier, « Photo 2 sur 5 », bouton « Agrandir » qui ouvre une boîte de dialogue avec +/−, zoom natif jamais bloqué) (UX-DR22)
**Et** le titre (Sakura Town ou Barlow Condensed en entier, UX-DR4), le prix USD, la description et le fil d'Ariane

**Étant donné** les tailles proposées
**Quand** le visiteur en choisit une
**Alors** le sélecteur (radios natifs, flèches, UX-DR23) met à jour sur place la disponibilité et le délai de cette variante, sans changer de page
**Et** la disponibilité est « En stock » ou « Fabrication sur commande » avec le Délai de fabrication (FR-6)

**Étant donné** le Plafond de fabrication atteint
**Quand** la fiche s'affiche
**Alors** la Fabrication sur commande n'est plus proposée, la fiche affiche « Commandes complètes pour le moment » (jamais « Épuisé »), seules les tailles en stock restent, et le sélecteur disparaît s'il n'y en a aucune (FR-10)

**Étant donné** la fiche
**Quand** elle s'affiche
**Alors** le bandeau « Remise uniquement à Goma et Bukavu » est visible par tous, sans détection de pays, avant la zone d'achat (UX-DR25)
**Et** les Modes de remise sont détaillés : Goma (retrait gratuit avec lieu et modalités, ou livraison au forfait Goma), Bukavu (livraison au forfait Bukavu), avec le délai total (fabrication + remise) ; un forfait non réglé n'est pas affiché, rien n'est inventé

**Étant donné** le référencement et le partage
**Quand** la fiche est lue par un robot ou partagée sur WhatsApp
**Alors** elle a son titre et sa description uniques, l'image Open Graph de la première photo, un JSON-LD Product + Offer (prix USD lu en base, disponibilité calculée à la requête, jamais `aggregateRating` ni `review`) et BreadcrumbList (FR-56)
**Et** le bouton « Partager » ouvre le partage natif ou copie le lien avec « Lien copié » annoncé (FR-57, UX-DR17)

**Étant donné** un brouillon ou un produit dépublié
**Quand** son adresse est ouverte
**Alors** la page 404 s'affiche

**Note :** l'ajout au Panier arrive à l'epic 4, le Schéma des Mesures du Sur-mesure à l'epic 6, et la proposition du Kit lié à l'epic 3.

### Story 2.6 : Héros vidéo de l'accueil

En tant que visiteur arrivé depuis une publicité,
je veux voir dès l'arrivée une vidéo de fabrication puis le costume porté, avec « Deviens ton personnage. »,
afin d'avoir envie de devenir mon personnage.

**Critères d'acceptation :**

**Étant donné** la page Réglages
**Quand** Jonathan choisit le Cosplay vedette (parmi les cosplays publiés), envoie la vidéo du héros et sa photo de repli (avec texte alternatif FR et EN)
**Alors** la vidéo part directement dans la bibliothèque Bunny Stream publique en TUS avec reprise, sur autorisation signée par le serveur ; les clés Bunny restent côté serveur (AD-18, règle 4)
**Et** la photo de repli suit le même passage que la story 2.2 (métadonnées supprimées) avant d'arriver dans `produits-public`

**Étant donné** l'accueil sur téléphone, en 4G, dans le navigateur intégré d'Instagram
**Quand** il s'ouvre
**Alors** le héros s'affiche en moins de 2,5 s (mesure documentée dans la story) : vidéo MP4 courte de Bunny, en boucle, `muted playsinline aria-hidden`, sans piste audio (FR-1)
**Et** l'accroche « Deviens ton personnage. » est le H1 en texte réel, dans un panneau de verre renforcé (UX-DR6, UX-DR18)
**Et** si la vidéo ne charge pas à temps ou n'est pas prise en charge, la photo de repli la remplace

**Étant donné** le bouton Pause du héros
**Quand** le visiteur le touche ou l'active au clavier
**Alors** la vidéo s'arrête, `aria-pressed` change, la parallaxe s'arrête, et le choix est mémorisé (UX-DR18)
**Et** sous `prefers-reduced-motion`, la photo de repli est affichée, la vidéo n'est pas chargée et le bouton Pause est absent

**Étant donné** les boutons du héros
**Quand** le visiteur touche « Prêt à porter »
**Alors** il arrive sur la fiche du Cosplay vedette
**Et** « Le fabriquer moi-même » n'apparaît que si le Cosplay vedette a un Kit lié publié (E-16) ; dans cet epic, il n'apparaît donc pas

**Étant donné** un ordinateur
**Quand** l'accueil s'affiche
**Alors** la vidéo occupe environ 2/3 de la largeur, avec à droite la tuile « Prêt à porter » (photo, prix, délai) ; la tuile « Le fabriquer moi-même » suit la même règle que le bouton

**Étant donné** aucun Cosplay vedette ni aucune photo de repli réglés
**Quand** l'accueil s'affiche
**Alors** le héros n'affiche aucun média inventé ; l'accroche H1 reste présente en texte

### Story 2.7 : Blocs de la page d'accueil

En tant que visiteur,
je veux découvrir sur l'accueil les cosplays faits main, Jonathan et les réponses aux questions courantes,
afin de comprendre en quelques secondes ce que propose KOMA SHOP.

**Critères d'acceptation :**

**Étant donné** l'accueil
**Quand** il s'affiche
**Alors** les blocs suivent l'ordre de FR-2 : tuiles de catégorie (Cosplays, Accessoires), bloc 2 « Fait main à Goma » (derniers cosplays publiés, en cartes produit), bloc 6 « Jonathan en trois phrases », bloc 8 FAQ courte (paiement, livraison, délais)
**Et** la place des blocs 1, 3, 4, 5 et 7 est réservée dans l'ordre, sans espace vide affiché ; ils arrivent avec les epics 3, 7 et 8
**Et** les titres de blocs sont en Sakura Town, rédigés sans accent, avec un H2 par bloc (UX-DR46)

**Étant donné** un bloc sans contenu réel
**Quand** l'accueil s'affiche
**Alors** il est masqué, sans espace réservé (FR-2, UX-DR45)
**Et** aucun avis, chiffre, client ni logo inventé n'apparaît (règle 5)

**Étant donné** le bloc 6 et la FAQ courte
**Quand** Jonathan n'a pas encore fourni leurs textes
**Alors** « [Texte à fournir] » s'affiche en développement, et le build de production échoue tant que ce marqueur reste
**Et** le JSON-LD FAQPage ne contient que des questions et réponses réelles

**Étant donné** les tuiles de catégorie
**Quand** l'écran fait moins de 360 px ou le zoom atteint 200 %
**Alors** elles passent sur une colonne, sans coupure de texte (UX-DR19)

**Étant donné** l'accueil
**Quand** Lighthouse mobile est lancé
**Alors** les scores de performance, d'accessibilité et de SEO sont ≥ 90 (NFR-2)
**Et** les animations (élévation, apparitions) sont coupées en mouvement réduit et le contenu est visible sans JavaScript (UX-DR47)

## Epic 3 : Les Kits et la bibliothèque

Jonathan crée ses Kits (fichiers, vidéo, chapitres, sous-titres) et les relie à ses cosplays ; le visiteur découvre les Kits (catalogue, fiche, double option, accueil) ; le visiteur connecté obtient le Kit gratuit, télécharge ses patrons filigranés et regarde la vidéo chapitre par chapitre, avec reprise sur un autre appareil. Aucun paiement dans cet epic : l'accès passe par une Commande `offerte` (règles 1 et 13 éprouvées avant tout Prestataire).

### Story 3.1 : Créer un Kit et ses fichiers

En tant que Jonathan,
je veux créer un Kit, le relier à son cosplay et y déposer ses patrons et fichiers 3D,
afin de vendre la version « Le fabriquer moi-même ».

**Critères d'acceptation :**

**Étant donné** le formulaire de produit
**Quand** Jonathan choisit la Famille `kit`
**Alors** il saisit titre, description et matériel nécessaire en FR et en EN, l'univers, le prix en USD (0 USD réservé au Kit gratuit, AD-15) et le niveau parmi Débutant / Intermédiaire / Avancé (EN : Beginner / Intermediate / Advanced) (E-15)
**Et** il peut relier le Kit à un seul cosplay ou accessoire, et chaque cosplay ou accessoire n'a qu'un seul Kit lié (relation un pour un, contrainte en base)

**Étant donné** les tables `fichier_kit` et `fichier_kit_prive` (module `catalogue`)
**Quand** la migration est appliquée
**Alors** `fichier_kit` ne contient que des données publiables (nom FR et EN, format, taille, ordre, version) et `fichier_kit_prive` contient le chemin dans `kits-private`, sans aucune politique de lecture (AD-30)
**Et** le test CI des colonnes lisibles par `anon` passe

**Étant donné** un Kit en cours d'édition
**Quand** Jonathan envoie un fichier (PDF A4, PDF US Letter, SVG, STL ou transcription texte d'un chapitre)
**Alors** le serveur vérifie son rôle et crée une autorisation signée ; le fichier part directement dans le bucket privé `kits-private` en TUS, avec progression, reprise après coupure et « Annuler l'envoi » (AD-18, UX-DR30)
**Et** les formats acceptés et la taille maximale sont fixés au plan de la story et affichés

**Étant donné** le bucket `kits-private`
**Quand** quelqu'un ouvre l'adresse directe d'un fichier sans lien signé
**Alors** il reçoit une erreur (règle 1, test automatique)

**Étant donné** un fichier déjà envoyé
**Quand** Jonathan le remplace
**Alors** sa version augmente (elle servira aux copies filigranées, story 3.6) et l'action est journalisée

### Story 3.2 : Vidéo, chapitres, sous-titres et publication d'un Kit

En tant que Jonathan,
je veux déposer la vidéo complète du tutoriel, ses chapitres, ses sous-titres et un extrait public, puis publier le Kit,
afin que les acheteurs suivent le tutoriel pas à pas.

**Critères d'acceptation :**

**Étant donné** les tables `video_kit`, `video_kit_prive` et `chapitre_kit`
**Quand** la migration est appliquée
**Alors** l'identifiant de la vidéo dans la bibliothèque Bunny privée n'est que dans `video_kit_prive`, sans politique de lecture (AD-30)

**Étant donné** un Kit en cours d'édition
**Quand** Jonathan envoie la vidéo complète
**Alors** elle part directement dans la bibliothèque Bunny Stream **privée** en TUS, avec reprise, sur autorisation signée par le serveur ; les clés Bunny restent côté serveur (AD-11, AD-18, règle 4)
**Et** l'extrait public part dans la bibliothèque Bunny Stream **publique**

**Étant donné** la vidéo envoyée
**Quand** Jonathan saisit les chapitres
**Alors** chaque chapitre a un titre FR et EN et un instant de début ; l'ordre se règle avec Monter / Descendre (UX-DR43)

**Étant donné** les sous-titres WebVTT
**Quand** Jonathan les envoie
**Alors** le fichier français est obligatoire et l'anglais facultatif ; ils sont stockés dans `kits-private` et leur format WebVTT est vérifié à l'envoi (FR-29, AD-16)

**Étant donné** un Kit incomplet
**Quand** Jonathan touche « Publier »
**Alors** la publication est refusée avec la liste des manques : prix, photo, texte alternatif, texte FR ou EN, niveau, au moins un Fichier de kit, vidéo complète, sous-titres français (FR-50, UX-DR44)
**Et** l'absence de sous-titres anglais n'empêche pas la publication

**Étant donné** la fin de la story
**Quand** Jonathan la clôt
**Alors** il a créé lui-même les deux bibliothèques Bunny Stream (privée avec CDN Token Auth, publique), activé le rendu 360p, et saisi leurs clés dans `.env.local` ; les noms des variables sont dans `.env.example` sans valeur (réglage manuel de la definition of done)

### Story 3.3 : Catalogue Kits et fiche Kit

En tant que visiteur,
je veux parcourir les Kits et voir exactement ce que contient chacun,
afin de savoir si je suis capable de fabriquer mon costume.

**Critères d'acceptation :**

**Étant donné** des Kits publiés
**Quand** le visiteur ouvre le catalogue Kits (`/fr/kits`, `/en/kits`)
**Alors** il retrouve le fonctionnement du catalogue de la story 2.4 (cartes, filtres univers et prix, tri, « Voir plus » par 12, adresse qui garde filtres et position), plus le filtre de niveau (FR-5)
**Et** la rubrique Kits apparaît dans l'en-tête et le menu ☰

**Étant donné** la fiche d'un Kit publié
**Quand** le visiteur l'ouvre (`/fr/kits/[slug]`, `/en/kits/[slug]`)
**Alors** il voit les photos, le titre, le prix USD, la description, le niveau, le matériel nécessaire, la liste des Fichiers de kit avec leur format et leur taille, le plan des chapitres et le résumé de la Licence de kit (usage personnel, ni revente ni partage) (FR-9)
**Et** l'extrait public se lit dans un lecteur au clavier, avec sous-titres (UX-DR39)
**Et** sous `/en`, un Kit sans sous-titres anglais l'indique (FR-29)

**Étant donné** le HTML de la fiche
**Quand** un test le parcourt
**Alors** il ne contient aucun chemin de `kits-private` ni aucun identifiant de la bibliothèque Bunny privée (règle 1)

**Étant donné** le référencement et le partage
**Quand** la fiche est lue ou partagée
**Alors** elle a ses métadonnées, son image Open Graph, un JSON-LD Product + Offer (sans `aggregateRating` ni `review`), VideoObject pour l'extrait et BreadcrumbList, et le bouton « Partager » (FR-56, FR-57)

**Note :** l'achat d'un Kit payant arrive à l'epic 4 ; l'obtention du Kit gratuit à la story 3.5.

### Story 3.4 : Double option et Kit lié dans toute la boutique

En tant que visiteur,
je veux choisir sur la fiche d'un cosplay entre « Prêt à porter » et « Le fabriquer moi-même »,
afin de trouver l'option qui correspond à mon budget et à l'endroit où je vis.

**Critères d'acceptation :**

**Étant donné** la fiche d'un cosplay dont le Kit lié est publié
**Quand** elle s'affiche
**Alors** un sélecteur à deux options « Prêt à porter » / « Le fabriquer moi-même » est présent, « Prêt à porter » choisi par défaut (FR-7)
**Et** choisir « Le fabriquer moi-même » affiche sur place un panneau « Kit lié » (prix du Kit, accès immédiat, lien « Voir le kit ») et masque tailles, délai, bandeau et zone d'achat du cosplay, sans changer de page (UX-DR23)

**Étant donné** la fiche d'un produit physique dont le Kit lié est publié
**Quand** le bandeau de zone s'affiche
**Alors** il propose aussi le Kit lié avec un lien vers sa fiche (FR-6, UX-DR25)
**Et** si le Plafond de fabrication est atteint, « Commandes complètes pour le moment » est accompagné du Kit lié (FR-10)

**Étant donné** le héros de l'accueil
**Quand** le Cosplay vedette a un Kit lié publié
**Alors** le bouton « Le fabriquer moi-même » mène à la fiche du Kit, et sur ordinateur la tuile correspondante affiche son prix (FR-1)

**Étant donné** l'accueil
**Quand** il s'affiche
**Alors** le bloc 1 « Porte-le ou fabrique-le » montre le Cosplay vedette sur deux colonnes (porté : prix et délai ; en pièces : prix du Kit), seulement s'il a un Kit lié publié
**Et** le bloc 3 « Kits » montre les Kits publiés, avec le Kit gratuit en évidence (« Ton premier accessoire, offert. ») quand il existe et est publié
**Et** la tuile de catégorie Kits apparaît ; un bloc sans contenu reste masqué (FR-2)

### Story 3.5 : Obtenir le Kit gratuit

En tant que visiteur connecté,
je veux obtenir le Kit gratuit d'un geste, sans panier ni paiement,
afin de fabriquer mon premier accessoire tout de suite.

**Critères d'acceptation :**

**Étant donné** les tables `commande`, `ligne_commande` (module `commande`) et `acces_kit` (module `bibliotheque`)
**Quand** la migration est appliquée
**Alors** une Commande a un numéro lisible `KS-AAAA-NNNNNN` attribué par séquence, un type (`produits` ou `pass`), un statut parmi les valeurs d'AD-14 et ses acceptations (`commande.acceptations`)
**Et** `acces_kit` est unique par (Compte, produit) ; la RLS laisse un client lire seulement ses Commandes et ses accès, sans aucune écriture (AD-2)

**Étant donné** la fiche du Kit gratuit (seul Produit à 0 USD) et un visiteur non connecté
**Quand** il touche « Obtenir le kit gratuit »
**Alors** il passe par la connexion puis revient sur la fiche (UX-DR26)

**Étant donné** un Compte complet (âge déclaré)
**Quand** il coche l'acceptation de la Licence de kit (sans renonciation au droit de rétractation) puis touche « Obtenir le kit gratuit »
**Alors** le bouton se verrouille, `offrir_commande` crée une Commande `offerte` à 0 USD sans Prestataire, qui passe `livree` dans la même transaction (deux lignes de journal), et `bibliotheque_ouvrir_acces` ouvre le Kit (AD-3, AD-11)
**Et** l'acceptation est enregistrée avec la version du texte et l'heure ; sans elle, la fonction refuse (`KS_ACCEPTATION_MANQUANTE`, AD-34)
**Et** le succès affiche le lien « Ouvrir dans ma bibliothèque »

**Étant donné** un Compte qui possède déjà ce Kit
**Quand** il revient sur la fiche (Kit gratuit ou Kit payant)
**Alors** le bouton devient « Ouvrir dans ma bibliothèque » ; un second essai par la fonction est refusé (tests SQL)

**Étant donné** une Commande `offerte`
**Quand** les tests SQL la vérifient
**Alors** elle n'est jamais `payee`, n'a pas de `paye_le`, et n'a ni Prestataire ni référence (FR-58, AD-4)

**Étant donné** le texte de la Licence de kit
**Quand** Jonathan ne l'a pas encore fourni
**Alors** le marqueur « [Texte à fournir] » s'affiche en développement et le build de production échoue (Q-5)

**Note :** l'email « Kit ouvert » sera planifié à partir de l'epic 4, par `envois_planifier` (AD-1, AD-9). Jonathan ne publie le Kit gratuit qu'à partir de la 5e semaine (PRD §6.2).

### Story 3.6 : Ma bibliothèque et téléchargement des fichiers

En tant que client,
je veux retrouver mes Kits et télécharger mes patrons autant de fois que je veux, sur n'importe quel appareil,
afin d'imprimer et de fabriquer sans crainte de perdre mes fichiers.

**Critères d'acceptation :**

**Étant donné** un Compte avec des accès
**Quand** il ouvre « Mon compte » puis « Ma bibliothèque »
**Alors** la navigation du compte affiche les entrées qui existent déjà (UX-DR37) et la bibliothèque liste une ligne par Kit (vignette, titre, lien étendu à la ligne) (FR-27, UX-DR39)
**Et** une bibliothèque vide affiche « Aucun kit dans ta bibliothèque. » avec un lien vers le catalogue Kits

**Étant donné** la page d'un Kit en bibliothèque
**Quand** le client touche « Télécharger Patron A4 (PDF, 2,4 Mo) »
**Alors** « Préparation du lien… » est annoncé, puis `GET /api/kits/fichier/[id]` vérifie `acces_kit` et renvoie une URL signée valable 60 secondes ; chaque clic crée un nouveau lien ; aucun nombre maximal de téléchargements (FR-28, AD-11)
**Et** un lien expiré affiche « Le lien a expiré. Touche à nouveau Télécharger. », un échec « Le téléchargement n'a pas abouti. Réessaie. »

**Étant donné** un PDF
**Quand** il est téléchargé pour la première fois par un Compte, pour une version du fichier
**Alors** le serveur produit une copie filigranée avec `@cantoo/pdf-lib` et une police TTF embarquée dont la licence est notée dans `docs/licences/` (règle 6), la range dans `kits-private/filigranes/<compte>/…` et la réutilise ensuite
**Et** le filigrane, discret et placé pour ne pas gêner l'impression, dit « Acheté par jo•••@gmail.com · Commande KS-AAAA-NNNNNN · {nom du site} » : les 2 premiers caractères de l'email, puis « ••• », puis le domaine ; le numéro est celui de la Commande d'origine de l'accès (décision du 2026-10-21)
**Et** le nom du site est lu dans le réglage `nom_site` (story 1.2), jamais écrit en dur ; quand Jonathan le modifie, les nouvelles copies filigranées portent le nouveau nom
**Et** les SVG, STL et transcriptions sont servis sans filigrane

**Étant donné** la sécurité des fichiers
**Quand** les tests tournent
**Alors** un lien copié ne marche plus après 60 secondes, un Compte sans accès reçoit un refus, et un visiteur non connecté aussi (règle 1)

**Étant donné** un fichier ajouté ou remplacé par Jonathan après l'achat
**Quand** un client ouvre son Kit
**Alors** il voit et télécharge la nouvelle version, sans rien racheter (FR-30)

### Story 3.7 : Lecteur vidéo à chapitres

En tant que client,
je veux regarder le tutoriel chapitre par chapitre, même avec une connexion lente, et reprendre où je m'étais arrêté,
afin d'avancer dans ma fabrication à mon rythme.

**Critères d'acceptation :**

**Étant donné** un Compte qui a accès au Kit
**Quand** il ouvre la vidéo
**Alors** le serveur vérifie `acces_kit` puis signe un jeton Bunny de courte durée (CDN Token Auth, jeton de répertoire couvrant playlist et segments) ; sans accès, aucun jeton n'est créé (AD-11, règle 1)
**Et** la durée du jeton est fixée au plan de la story

**Étant donné** le lecteur (`hls.js`)
**Quand** la vidéo démarre sur une connexion 3G simulée
**Alors** la première image arrive en moins de 5 secondes et la qualité s'adapte au débit, rendu 360p compris (FR-29)
**Et** aucun bouton de téléchargement n'existe

**Étant donné** le lecteur au clavier (UX-DR39)
**Quand** le client l'utilise sans souris
**Alors** lecture/pause, piste temporelle (slider ARIA avec valeur en texte), chapitres (`<button>` avec `aria-current`), sous-titres et plein écran fonctionnent
**Et** les sous-titres sont réglés par défaut sur la langue de l'interface : français toujours, anglais s'ils existent

**Étant donné** la table `progression_video`
**Quand** le client regarde la vidéo
**Alors** sa position est enregistrée toutes les 15 secondes et à la pause ; la vidéo est « terminée » à 90 % de sa durée (décision du 2026-10-20)
**Et** sur un autre appareil connecté au même Compte, la lecture reprend à la dernière position enregistrée
**Et** la ligne du Kit en bibliothèque affiche la progression en texte (« Chapitre 3 sur 8 · 2 chapitres terminés », « Reprendre au chapitre 3 »)

**Étant donné** une vidéo qui ne charge pas
**Quand** l'erreur survient
**Alors** un message d'état et « Réessayer » s'affichent, et la reprise se fait à la dernière position connue

**Étant donné** la fin de la story
**Quand** Jonathan la teste sur téléphone
**Alors** une adresse de vidéo privée copiée sans jeton valide est refusée par Bunny (test manuel de la definition of done)

## Epic 4 : Le panier, la commande et le premier paiement réel (Kits par carte via Polar)

Le visiteur remplit son Panier sans Compte, se connecte, passe commande, paie un Kit par carte via Polar, le retrouve aussitôt dans sa bibliothèque et reçoit l'email de confirmation. L'étape de commande gère déjà les Produits physiques ; tant qu'aucun Prestataire ne les couvre (epic 5), l'écran le dit honnêtement.

### Story 4.1 : Panier sans compte

En tant que visiteur,
je veux mettre des articles dans mon Panier sans créer de Compte,
afin de préparer mon achat à mon rythme.

**Critères d'acceptation :**

**Étant donné** les tables `panier` et `ligne_panier` (module `commande`)
**Quand** un visiteur sans Compte ajoute un premier article
**Alors** un Panier est créé en base et reconnu par un cookie httpOnly, signé (`PANIER_COOKIE_SECRET`), `SameSite=Lax` (AD-15)
**Et** aucune politique RLS ne permet au navigateur d'écrire dans ces tables ; toute écriture passe par `ajouter_au_panier` et les fonctions du module (AD-2)

**Étant donné** la fiche d'un produit physique
**Quand** le visiteur choisit une taille puis touche « Ajouter au panier »
**Alors** l'article est ajouté, « Ajouté au panier » est annoncé (`role="status"`) sans déplacer le focus, et le compteur de l'en-tête devient « Panier, N articles » (UX-DR10)
**Et** pour la taille Sur-mesure, le bouton reste en `aria-disabled` avec la raison « Les mesures sont nécessaires pour le sur-mesure. » et le serveur refuse l'ajout tant que les Mesures ne sont pas saisies (FR-8 ; saisie des Mesures à l'epic 6)

**Étant donné** la fiche d'un Kit payant
**Quand** le visiteur l'ajoute
**Alors** le Kit entre en un seul exemplaire ; un second ajout ne change rien (FR-11)
**Et** un Kit déjà possédé par le Compte connecté est refusé (`KS_KIT_DEJA_POSSEDE`), et le Kit gratuit est refusé (`KS_PRODUIT_GRATUIT`, AD-15)

**Étant donné** la page Panier
**Quand** elle s'affiche
**Alors** prix, disponibilité et délai total de chaque ligne sont relus en base à chaque affichage ; le Panier ne fige aucun prix (règle 3, UX-DR32)
**Et** le visiteur modifie la quantité d'un produit physique ou retire une ligne
**Et** une ligne devenue indisponible affiche « Plus disponible » et « Cet article n'est plus disponible pour le moment. Retire-le pour continuer. », et « Passer la commande » passe en `aria-disabled` avec la raison
**Et** un Panier vide affiche « Ton panier est vide. » avec des liens vers les catalogues

**Étant donné** un Pass
**Quand** on tente de l'ajouter au Panier
**Alors** aucune fonction ni aucun écran ne le permet (FR-11)

### Story 4.2 : Fusion du panier à la connexion

En tant que visiteur qui se connecte au moment de payer,
je veux retrouver le Panier que j'avais rempli,
afin de ne rien avoir à refaire.

**Critères d'acceptation :**

**Étant donné** un Panier de visiteur et un Compte qui se connecte
**Quand** la connexion réussit
**Alors** `fusionner_panier` rattache le Panier au Compte ; un Compte n'a jamais plus d'un Panier actif (AD-15)
**Et** si le Compte avait déjà un Panier, les lignes sont réunies, un Kit n'apparaissant qu'une fois

**Étant donné** un Kit du Panier déjà possédé par le Compte
**Quand** la fusion a lieu
**Alors** il est retiré et le Panier affiche « Tu possèdes déjà ce kit : il est dans ta bibliothèque. »

**Étant donné** la fusion terminée
**Quand** le visiteur revient au Panier
**Alors** il est exactement où il en était (FR-12) ; des tests SQL couvrent la fusion, les doublons de Kit et le Kit possédé

### Story 4.3 : Étape de commande et Commande en attente

En tant que client,
je veux indiquer comment je reçois ma commande, vérifier le total et réserver mes articles,
afin de payer en sachant exactement ce que je paie et quand je serai livré.

**Critères d'acceptation :**

**Étant donné** un Panier et un visiteur non connecté ou au Compte incomplet
**Quand** il touche « Passer la commande »
**Alors** il passe par la connexion (et la déclaration d'âge), puis revient à l'étape de commande (FR-12)

**Étant donné** un Panier avec au moins un Produit physique
**Quand** l'étape de commande s'affiche
**Alors** le client saisit son téléphone, choisit la Zone de remise (Goma ou Bukavu) et, à Goma seulement, le Mode de remise (retrait gratuit avec lieu et modalités, ou livraison) ; il saisit son adresse en champ libre si le Mode est la livraison (FR-13, UX-DR23, UX-DR27)
**Et** pour un Panier 100 % numérique, aucun de ces champs n'apparaît

**Étant donné** les cases à cocher (UX-DR29)
**Quand** le client valide
**Alors** l'acceptation des CGV est exigée, et pour un Kit la case unique « accès immédiat, renonciation au droit de rétractation, Licence de kit » ; aucune case n'est pré-cochée
**Et** `creer_commande` refuse une Commande sans ces acceptations (`KS_ACCEPTATION_MANQUANTE`) et les enregistre avec la version des textes et l'heure (AD-34)

**Étant donné** le Récapitulatif (FR-14, UX-DR32)
**Quand** il s'affiche
**Alors** il montre le prix de chaque article en USD, le Forfait de livraison, le total USD et le délai total de chaque Produit physique, tous calculés par le serveur
**Et** si le serveur trouve un total différent de celui affiché, « Le total a changé : [ancien] → [nouveau] USD. » s'affiche et une nouvelle confirmation est exigée

**Étant donné** le client qui confirme
**Quand** `creer_commande` s'exécute
**Alors** elle relit tout en base et fige prix, sous-total, Forfait, total, délai annoncé par ligne physique et échéance `expire_le` ; elle fige l'origine de chaque ligne physique (`stock` ou `fabrication`) et crée une `reservation` par ligne physique (AD-8, AD-26)
**Et** elle refuse un article indisponible (`KS_INDISPONIBLE`), un Kit déjà possédé ou déjà présent dans une autre Commande `en_attente` du Compte (`KS_KIT_DEJA_POSSEDE`), une ligne à 0 USD (`KS_PRODUIT_GRATUIT`) et un réglage manquant (`KS_REGLAGE_MANQUANT`)
**Et** une même clé d'idempotence renvoie la même Commande : un double toucher ne crée pas deux Commandes (AD-8)
**Et** le serveur enregistre l'origine de la vente transmise par le formulaire, validée par Zod (`commande.origine`, AD-19)

**Étant donné** les réservations
**Quand** la migration est appliquée
**Alors** `stock_disponible` et `places_fabrication_utilisees` sont remplacées par `CREATE OR REPLACE` pour compter les réservations actives et les Commandes payées ou en fabrication (Plafond compté en pièces sur commande seulement, AD-26), et les tests de la story 2.3 repassent

**Étant donné** le réglage `delai_paiement`
**Quand** la migration est appliquée
**Alors** il est créé avec la valeur de départ de 30 minutes (décision de Jonathan, Q-B4), modifiable dans la page Réglages et journalisé
**Et** la Commande `en_attente` affiche « À payer avant [heure] » en texte statique, à l'heure de `Africa/Lubumbashi`, sans compte à rebours (UX-DR35)

**Étant donné** une Commande `en_attente` dont l'échéance est passée
**Quand** la tâche `expirer_commandes_echues` tourne (pg_cron, chaque minute)
**Alors** la Commande passe `expiree` et ses réservations sont libérées (AD-10)
**Et** le client qui revient voit le statut et « Reprendre mon panier » : son Panier est intact, téléphone, Zone, Mode et adresse sont repris, et une nouvelle Commande sera créée (FR-13, E-35)

**Note :** les moyens de paiement s'affichent à partir de la story 4.5.

### Story 4.4 : Boîte d'envoi et premiers emails

En tant que client,
je veux recevoir un vrai email quand ma commande est payée ou mon Kit ouvert,
afin d'avoir une trace et de retrouver mon achat.

**Critères d'acceptation :**

**Étant donné** la table `envoi` (module `envois`) et la fonction interne `envois_planifier`
**Quand** la migration est appliquée
**Alors** la table `anomalie` (module `admin`) est créée avec le type `envoi_echec_definitif`, et `envoi.modele` est une énumération fermée qui contient ici `commande_payee` et `kit_ouvert` ; les modèles suivants s'ajouteront par migration (AD-9)
**Et** `envoi.donnees` ne contient que des identifiants, et `envoi.langue` est figée depuis `profil.langue`

**Étant donné** un envoi `a_envoyer`
**Quand** la route `/api/cron/envois` est appelée par pg_cron et pg_net avec le `CRON_SECRET` (AD-10)
**Alors** elle traite un lot borné, relit la base au moment du rendu, envoie par Resend et ne pose `envoye` qu'avec l'identifiant renvoyé par Resend (règle 13)
**Et** un échec est réessayé un nombre borné de fois, puis passe `abandonne` et crée une `anomalie` `envoi_echec_definitif` visible dans les tâches admin (AD-21)
**Et** la route refuse toute requête sans le bon secret, et un second appel ne renvoie pas un email déjà envoyé

**Étant donné** les gabarits `commande_payee` et `kit_ouvert` (`src/modules/envois/modeles/`)
**Quand** ils sont rendus
**Alors** ils sont dans la langue du client, sans argot ni emoji, avec le nom lu dans `nom_site`, les montants en USD et les liens en texte (UX-DR31)

**Étant donné** le Kit gratuit de l'epic 3
**Quand** `offrir_commande` ouvre un Kit
**Alors** elle planifie maintenant l'email `kit_ouvert` par `envois_planifier` ; la fonction est réécrite depuis sa dernière version appliquée et les tests de la story 3.5 repassent (AD-1)

**Étant donné** le développement sans domaine (Q-D1)
**Quand** Jonathan clôt la story
**Alors** il a créé son compte Resend, mis la clé dans `.env.local`, et reçoit les emails de test sur son adresse de titulaire, utilisée pour ses Comptes de test (décision du 2026-10-21)
**Et** les tests automatiques remplacent Resend par un double `TEST_` de `tests/doubles/`

### Story 4.5 : Couche de paiement, aiguilleur et admin des Prestataires

En tant que client,
je veux ne voir que les moyens de paiement réellement possibles pour mon achat,
afin de ne jamais tomber sur un choix qui échoue.

**Critères d'acceptation :**

**Étant donné** les tables `prestataire`, `tentative_paiement`, `notification_recue` et `trop_percu` (module `paiement`)
**Quand** la migration est appliquée
**Alors** `tentative_paiement` porte `reference_interne` unique, `reference_transaction` unique par Prestataire, `montant_attendu_cents` en USD, `montant_recu`, `devise_recue`, son statut (`en_cours`, `reussie`, `echouee`, `abandonnee`) et sa cause ; un index unique partiel interdit deux Tentatives `en_cours` pour une Commande (AD-4, AD-28)
**Et** l'énumération des anomalies reçoit `montant_insuffisant`, `notification_invalide`, `transition_refusee` et `kit_deja_possede`

**Étant donné** le port `PrestatairePaiement` (`initier`, `verifierNotification`, `consulterStatut`, `comparerMontant`)
**Quand** un adaptateur est écrit
**Alors** il renvoie un résultat normalisé `succes | echec_client | echec_prestataire | inconnu` avec montant et devise reçus, et une règle de lint lui interdit d'importer Supabase ou un module ; ajouter ou retirer un Prestataire ne touche pas au reste du site (FR-15, AD-5)

**Étant donné** `choisirPrestataire` dans `src/modules/paiement/aiguillage.ts`, fonction pure, et les Familles lues en base par le service (AD-6, règles 10 et 11)
**Quand** les tests Vitest tournent
**Alors** ils prouvent : Panier mixte + carte → K-Pay, jamais Polar ; Panier avec Produit physique + carte → K-Pay ; Panier 100 % numérique + carte → Polar, ou « Carte indisponible » si Polar est inactif, sans aucun remplaçant ; Pass + carte → K-Pay, jamais Polar ; mobile money → premier Agrégateur actif, non exclu, qui couvre le couple pays-opérateur, dans l'Ordre de priorité ; repli vers l'Agrégateur suivant du même couple ; aucun Prestataire inventé quand rien ne couvre
**Et** le service relit en base la Famille de chaque ligne de la Commande ; un test prouve qu'une Famille envoyée par le navigateur est ignorée

**Étant donné** le Récapitulatif d'une Commande `en_attente`
**Quand** les moyens de paiement s'affichent
**Alors** les cartes « Mobile money » et « Carte » ne montrent que ce que le serveur autorise, en texte, sans logo (UX-DR34)
**Et** tant qu'aucune Couverture n'est saisie (epic 5), seule la carte peut être proposée, avec « Le mobile money n'est pas encore disponible dans ton pays. »
**Et** sans Prestataire carte autorisé, « Le paiement par carte n'est pas disponible pour le moment. » s'affiche, sans substitution (UX-DR36)
**Et** juste avant le bouton, « Paiement traité par {Prestataire} » est écrit en texte (FR-16)

**Étant donné** la page admin Prestataires (FR-21, UX-DR43)
**Quand** Jonathan active ou désactive un Prestataire, ou change l'Ordre de priorité des Agrégateurs avec Monter / Descendre
**Alors** l'interrupteur affiche « Actif » ou « Désactivé » après l'enregistrement réel, l'action est journalisée, et la règle carte est affichée verrouillée (K-Pay : physique et Pass ; Polar : 100 % kits)

**Étant donné** le pied de page
**Quand** il s'affiche
**Alors** la carte Paiement liste les moyens des Prestataires actifs, lus côté serveur ; aucun Prestataire inactif n'y figure (UX-DR13)

### Story 4.6 : Page de retour, attente et état réel de la Commande

En tant que client qui vient de payer,
je veux voir l'état réel de mon paiement, jamais une fausse confirmation,
afin de savoir si je dois attendre, réessayer ou écrire sur WhatsApp.

**Critères d'acceptation :**

**Étant donné** la route `GET /api/commande/[numero]/etat`
**Quand** elle est appelée
**Alors** elle vérifie que la Commande appartient au Compte connecté (sinon 404) et ne renvoie que l'état affichable (AD-35)

**Étant donné** la page de retour (route `/api/paiement/retour/[prestataire]`, qui accepte aussi un retour en POST et redirige en GET)
**Quand** l'adresse contient un paramètre de statut (par exemple `?status=success`)
**Alors** la page l'ignore et n'affiche que l'état lu côté serveur (FR-20, test)

**Étant donné** un état en attente
**Quand** la page attend
**Alors** elle interroge le serveur toutes les 3 secondes ; après 2 minutes sans état final, elle affiche « Paiement en cours de vérification. » en couleur `warning`, sans proposer de repayer (AD-10, UX-DR36)
**Et** l'annonce `role="status"` ne part qu'à un changement réel d'état, et le `<title>` reflète l'état

**Étant donné** un état final
**Quand** il arrive
**Alors** « Payée » ne s'affiche qu'avec une Commande `payee` ou `livree` en base, le focus va au titre, et un Kit propose « Ouvrir dans ma bibliothèque »
**Et** un échec confirmé s'annonce en `role="alert"` ; « Le paiement n'a pas abouti. Tu peux réessayer. » propose de réessayer sans rien ressaisir, avec le bouton WhatsApp
**Et** quand un Trop-perçu est enregistré pour la Commande, le texte validé (E-13) s'affiche avec le bouton WhatsApp, sans promesse de délai ni de mode de remboursement

**Étant donné** une Tentative `en_cours`
**Quand** le client revient en arrière, recharge, ou ouvre un autre onglet
**Alors** il retrouve l'attente ou la vérification ; aucun choix de moyen et aucun bouton « Payer » ne s'affichent (UX-DR36)

**Étant donné** les tests
**Quand** ils vérifient les états
**Alors** ils les posent par les fonctions SQL avec des données `TEST_`, jamais par un faux paiement dans le code du site (règle 13)

### Story 4.7 : Paiement d'un Kit par carte via Polar

En tant que client, au Congo ou à l'étranger,
je veux payer mes Kits par carte bancaire,
afin d'ouvrir mon Kit même sans mobile money.

**Critères d'acceptation :**

**Étant donné** l'adaptateur Polar (`src/modules/paiement/adaptateurs/polar/`)
**Quand** une Tentative est lancée pour une Commande 100 % numérique
**Alors** `demarrer_tentative` crée la Tentative (clé d'idempotence, une seule `en_cours`), et l'adaptateur crée chez Polar le paiement du montant figé en USD, avec la référence interne, puis le client est envoyé sur la page de paiement Polar
**Et** le bouton passe « Paiement lancé… » en `aria-disabled` au premier toucher ; un second toucher est ignoré (UX-DR16)
**Et** l'adaptateur refuse de lui-même toute Commande qui contient un Produit physique ou un Pass : aucun produit ni paiement Polar n'est jamais créé pour eux (règle 10, test)

**Étant donné** une notification de Polar
**Quand** elle arrive sur `POST /api/paiement/notification/polar`
**Alors** sa signature est vérifiée selon Standard Webhooks avec `POLAR_WEBHOOK_SECRET` ; une signature invalide reçoit 401 et ne change rien (règle 2)
**Et** la notification est enregistrée dans `notification_recue` (unique par Prestataire et identifiant), le service appelle `confirmer_paiement`, et la route répond 200 même si la transition est refusée, le refus devenant une `anomalie` `transition_refusee` (AD-5)

**Étant donné** `confirmer_paiement`
**Quand** les tests SQL la vérifient
**Alors** ils couvrent : notification rejouée sans effet ; montant égal → Commande `payee` puis `livree` dans la même transaction, `paye_le` posé, `acces_kit` ouvert, Panier vidé, un seul email `kit_ouvert` planifié ; montant inférieur → Commande inchangée et `anomalie` `montant_insuffisant` ; montant supérieur, Commande déjà payée ou expirée → `trop_percu` ; Kit déjà possédé → paiement validé et `anomalie` `kit_deja_possede` ; Référence de transaction déjà utilisée refusée ; deux Tentatives réussies sur deux Prestataires → la seconde devient un Trop-perçu (AD-4, AD-6, FR-19)
**Et** `comparerMontant` de Polar suit sa documentation officielle ; aucune tolérance n'est inventée (AD-8)

**Étant donné** une Tentative restée sans réponse
**Quand** la tâche `/api/cron/reconcilier-tentatives` tourne (CRON_SECRET)
**Alors** elle interroge Polar par `consulterStatut` et applique le résultat par les mêmes fonctions ; une Tentative `abandonnee` reste réconciliée pendant 72 h, et un succès tardif devient un Trop-perçu (AD-10)

**Étant donné** un Trop-perçu
**Quand** Jonathan ouvre ses tâches admin
**Alors** il voit « Trop-perçu à rembourser » avec la Commande, le Prestataire et le montant reçu (FR-49)
**Et** pour une Commande `expiree` dont le montant reçu est égal au montant attendu, il peut l'honorer à la main par `honorer_trop_percu`, qui revérifie le stock, le Plafond et la Capacité (AD-4)

**Étant donné** le développement en local
**Quand** Jonathan teste un vrai paiement sandbox
**Alors** il a créé l'organisation Polar sandbox et mis ses clés dans `.env.local` (`POLAR_SERVER` sur sandbox), et il ouvre un tunnel Cloudflare (`cloudflared`) seulement pendant ses essais, dont il saisit l'adresse dans le tableau de bord Polar sandbox (exception à la règle 14 limitée au développement, jamais en production)
**Et** sur son téléphone, il paie un Kit avec une carte de test Polar, voit « Payée », ouvre le Kit dans sa bibliothèque et reçoit l'email « Kit ouvert »

## Epic 5 : Le mobile money et la carte K-Pay

Le client paie par mobile money (pays, opérateur, Agrégateur prioritaire, repli proposé) et paie ses Produits physiques par carte via K-Pay. Les stories 5.1 à 5.3 ne dépendent d'aucune question ouverte ; chaque adaptateur (5.4 à 5.8) démarre quand sa documentation est disponible, dans l'ordre K-Pay mobile money, K-Pay carte, MaishaPay, PawaPay, GeniusPay, modifiable selon l'arrivée des documentations.

**Règles propres aux stories d'adaptateur (décision de Jonathan du 2026-10-21) :**

- **Essais** : environnement de test du Prestataire s'il existe ; sinon, petits paiements réels faits par Jonathan sur `koma-dev`, au plus petit montant accepté, remboursés à la main et notés dans le journal de décisions (date, Prestataire, montant, remboursement fait), sans clé, numéro de marchand ni donnée personnelle (règle 4).
- **Applications dédiées à KOMA SHOP (décision du 2026-10-21)** : K-Pay et MaishaPay permettent plusieurs applications par compte marchand. Jonathan crée chez chacun une application dédiée à KOMA SHOP, séparée de celle de son autre produit, avec ses propres clés et ses propres adresses de notification ; KOMA SHOP n'utilise jamais les clés ni les réglages de l'autre application. Les adresses de notification et de retour de KOMA SHOP sont aussi envoyées avec chaque paiement quand l'API le permet (K-Pay : paramètre `returl`). Pour PawaPay et GeniusPay, si un réglage s'applique à tout le compte, la story vérifie d'abord que ce compte ne sert qu'à KOMA SHOP, sinon elle s'arrête et le signale (règle 15).
- **Clés** : les clés de l'application KOMA SHOP restent uniquement dans `.env.local`, puis dans les variables d'environnement de Hostinger à la mise en ligne ; jamais dans le dépôt, dans `koma-dev` en ligne, ni dans les journaux (règle 4).
- **Tunnel** : le tunnel Cloudflare (`cloudflared`) reçoit les notifications de tous les Prestataires, ouvert seulement pendant les essais de Jonathan, jamais en production.
- **Rien n'est deviné** : appels, devises, codes d'erreur, classement des échecs (client, Prestataire, inconnu), vérification des notifications et `comparerMontant` viennent de la documentation officielle du Prestataire ; un code inconnu est classé `inconnu` (règle 15, AD-5, AD-8).

### Story 5.1 : Saisie de la Couverture des Agrégateurs

En tant que Jonathan,
je veux saisir, pour chaque Agrégateur, les pays et opérateurs qu'il couvre, avec leur source,
afin que le site ne propose que des couples réellement encaissables.

**Critères d'acceptation :**

**Étant donné** la table `couverture` (module `paiement`)
**Quand** la migration est appliquée
**Alors** chaque ligne relie un Agrégateur à un couple pays-opérateur, avec sa source (document ou contrat) et son état (« À vérifier » ou confirmé)
**Et** aucune ligne n'est créée par la migration : aucun pays ni aucun opérateur n'est écrit en dur (règle 9, Q-1)

**Étant donné** la page admin Prestataires
**Quand** Jonathan ajoute un couple pour un Agrégateur
**Alors** la source est obligatoire ; sans elle, l'enregistrement est refusé avec une erreur reliée au champ (UX-DR44)
**Et** le couple reste « À vérifier » tant que Jonathan ne le confirme pas ; seul un couple confirmé d'un Agrégateur actif peut servir au paiement
**Et** chaque ajout, confirmation ou retrait est journalisé

**Étant donné** la Couverture
**Quand** `choisirPrestataire` est appelé pour du mobile money
**Alors** le service lui passe les couples confirmés lus en base, et les tests de la story 4.5 repassent

### Story 5.2 : Choix du mobile money par le client

En tant que client,
je veux choisir mon pays, mon opérateur et mon numéro,
afin de payer avec le mobile money que j'utilise tous les jours.

**Critères d'acceptation :**

**Étant donné** le Récapitulatif d'une Commande `en_attente`
**Quand** le client choisit d'abord son pays (aucune détection automatique)
**Alors** la liste des pays est l'union des couples confirmés d'Agrégateurs actifs ; si le pays est couvert, « Mobile money » est proposé en premier, puis « Carte » ; sinon, seule la carte est proposée avec « Le mobile money n'est pas encore disponible dans ton pays. » (FR-16, UX-DR34)

**Étant donné** le sélecteur pays + opérateur (UX-DR33)
**Quand** le client change de pays
**Alors** l'opérateur est réinitialisé, « N opérateurs disponibles » est annoncé (`role="status"`), sans envoi ni changement de page
**Et** les listes sont des `<select>` natifs, avec des noms en texte, sans logo

**Étant donné** un couple pays-opérateur qu'aucun Agrégateur actif ne couvre
**Quand** le client le choisit
**Alors** « Aucun moyen de paiement disponible pour cet opérateur. Choisis un autre opérateur ou la carte. » s'affiche, relié au champ opérateur ; aucun Prestataire n'est inventé

**Étant donné** le numéro de téléphone
**Quand** le client le saisit
**Alors** le champ a un libellé visible, `inputmode="tel"` et l'indicatif en aide ; après un échec ou un réessai, pays, opérateur et numéro restent remplis (UX-DR27)
**Et** « Paiement traité par {Agrégateur} » s'affiche avant le bouton, avec le nom choisi par le serveur

**Étant donné** le lancement d'une Tentative
**Quand** le client touche le bouton de paiement
**Alors** `demarrer_tentative` est limitée par `consommer_essai` (AD-22) et le bouton se verrouille au premier toucher

### Story 5.3 : Écran d'attente mobile money et repli entre Agrégateurs

En tant que client,
je veux savoir quoi faire pendant que je valide sur mon téléphone, et pouvoir réessayer avec un autre service si celui-ci tombe en panne,
afin de payer même quand un Agrégateur ne répond pas.

**Critères d'acceptation :**

**Étant donné** une Tentative mobile money `en_cours`
**Quand** l'écran d'attente s'affiche
**Alors** il dit « Valide le paiement sur ton téléphone. », avec le montant USD, le numéro masqué et « À payer avant [heure] » lus du serveur, sans compte à rebours (UX-DR35)
**Et** il suit la story 4.6 : sondage toutes les 3 s, « Paiement en cours de vérification. » après 2 minutes, une annonce par changement réel d'état

**Étant donné** une Tentative confirmée en échec par l'Agrégateur (`echec_prestataire`), ou un Agrégateur désactivé
**Quand** un autre Agrégateur actif couvre le même couple
**Alors** l'écran affiche en `role="alert"` « Ce service de paiement n'a pas abouti. Réessayer avec {Agrégateur suivant} ? » avec le bouton WhatsApp ; la nouvelle Tentative ne part que si le client touche le bouton (FR-17)
**Et** après ce toucher : « Une nouvelle demande de paiement va arriver sur ton téléphone. »
**Et** l'Agrégateur en échec est exclu pour cette Commande (AD-6)

**Étant donné** un échec dû au client (refus, solde insuffisant, annulation sur le téléphone)
**Quand** il est confirmé
**Alors** « Le paiement n'a pas abouti. Tu peux réessayer. » propose de réessayer avec le même Agrégateur, sans bascule ni ressaisie (E-27)

**Étant donné** une Tentative sans réponse, une réponse ambiguë ou un code inconnu
**Quand** l'état reste inconnu
**Alors** aucun repli ni aucun bouton « Payer » n'est proposé ; la tâche de réconciliation interroge l'Agrégateur (FR-17, AD-28)

**Étant donné** tous les Agrégateurs du couple en échec ou désactivés
**Quand** l'écran s'affiche
**Alors** « Choisis un autre opérateur ou la carte. » remplace le repli, avec le bouton WhatsApp

**Étant donné** les tests
**Quand** ils tournent avec des doubles `TEST_` d'Agrégateurs
**Alors** ils prouvent : un délai dépassé ne déclenche pas de repli ; le repli passe à l'Agrégateur suivant du même couple ; un échec client ne bascule pas ; une seule Tentative `en_cours` par Commande ; une Tentative en échec sans autre Tentative en cours fait passer la Commande `echouee`, repayable (FR-17, FR-18, FR-19)

### Story 5.4 : Paiement mobile money via K-Pay

En tant que client en RDC,
je veux payer par mobile money via K-Pay,
afin d'utiliser le premier Agrégateur ouvert au lancement.

**Bloquée par :** Q-S1 (documentation officielle K-Pay dans `docs/references/paiements/`) ; Couverture (Q-1) et contrôle du montant (Q-3) tirés de cette documentation.

**Critères d'acceptation :**

**Étant donné** la documentation officielle de K-Pay
**Quand** l'adaptateur `kpay` est écrit
**Alors** `initier`, `consulterStatut`, `comparerMontant` et la table des codes d'échec suivent cette documentation, et chaque choix y renvoie (référence de section dans le code)
**Et** chaque paiement envoie l'adresse de notification et de retour de KOMA SHOP par le paramètre `returl` ; seules les clés et les réglages de l'application KOMA SHOP sont utilisés

**Étant donné** une notification de K-Pay
**Quand** elle arrive sur `POST /api/paiement/notification/kpay`
**Alors** elle ne sert que de signal : le serveur contre-vérifie le statut et le montant par `consulterStatut` avant tout appel à `confirmer_paiement` ; une notification qui ne correspond à aucune transaction réelle ne valide rien (règle 2, AD-5)

**Étant donné** la fin de la story
**Quand** Jonathan teste sur son téléphone
**Alors** il paie une Commande par mobile money via K-Pay (environnement de test, ou petit paiement réel remboursé et noté), voit « Payée » et reçoit l'email
**Et** une même notification reçue deux fois ne valide qu'une fois
**Et** l'application KOMA SHOP est créée chez le Prestataire et ses clés sont dans `.env.local` (réglage manuel de Jonathan, definition of done)

### Story 5.5 : Paiement par carte via K-Pay (Produits physiques et Paniers mixtes)

En tant que client,
je veux payer par carte un Panier qui contient un cosplay ou un accessoire,
afin de commander une pièce physique sans mobile money.

**Bloquée par :** Q-S1.

**Critères d'acceptation :**

**Étant donné** une Commande avec au moins un Produit physique
**Quand** le client choisit « Carte »
**Alors** seul K-Pay est proposé (« Paiement traité par K-Pay ») ; Polar n'apparaît jamais, même si K-Pay carte est désactivé, auquel cas la carte est indisponible (règle 10, UX-DR36)

**Étant donné** l'adaptateur `kpay` en mode carte
**Quand** la Tentative est lancée
**Alors** le client passe par la page de paiement de K-Pay, revient par la route de retour (story 4.6), et seul `consulterStatut` fait foi pour le résultat
**Et** les montants, devises et codes suivent la documentation officielle de K-Pay

**Étant donné** une Commande payée qui contient des Produits physiques
**Quand** `confirmer_paiement` s'applique
**Alors** le stock des lignes d'origine `stock` est décompté, la Commande reste `payee` (elle avancera par l'admin à l'epic 6), l'email `commande_payee` est planifié, et les Kits d'un Panier mixte s'ouvrent aussitôt (FR-19)

**Étant donné** la fin de la story
**Quand** Jonathan teste sur son téléphone
**Alors** il paie un Panier mixte par carte (cartes de test de K-Pay si elles existent, sinon petit paiement réel remboursé et noté) : le Kit s'ouvre et l'Accessoire apparaît dans ses commandes
**Et** l'application KOMA SHOP est créée chez le Prestataire et ses clés sont dans `.env.local` (réglage manuel de Jonathan, definition of done)

### Story 5.6 : Paiement mobile money via MaishaPay

En tant que client,
je veux payer par mobile money via MaishaPay quand il couvre mon opérateur,
afin d'avoir une solution si K-Pay est en panne.

**Bloquée par :** Q-S1 (documentation officielle MaishaPay) ; Q-1 et Q-3 tirées de cette documentation.

**Critères d'acceptation :**

**Étant donné** la documentation officielle de MaishaPay
**Quand** l'adaptateur `maishapay` est écrit
**Alors** ses appels, sa vérification des notifications (signature ou contre-vérification, selon la documentation), `comparerMontant` et sa table des codes suivent cette documentation
**Et** l'adaptateur n'utilise que les clés et les adresses de notification de l'application KOMA SHOP, et envoie les adresses de KOMA SHOP avec chaque paiement si l'API le permet

**Étant donné** K-Pay et MaishaPay actifs sur le même couple
**Quand** K-Pay est confirmé en échec
**Alors** le repli vers MaishaPay est proposé au client (story 5.3), et la carte reste réservée à K-Pay (MaishaPay carte n'est pas branchée, règle 10)

**Étant donné** la fin de la story
**Quand** Jonathan teste sur son téléphone
**Alors** un paiement via MaishaPay aboutit (environnement de test ou petit paiement réel remboursé et noté)
**Et** l'application KOMA SHOP est créée chez le Prestataire et ses clés sont dans `.env.local` (réglage manuel de Jonathan, definition of done)

### Story 5.7 : Paiement mobile money via PawaPay

En tant que client,
je veux payer par mobile money via PawaPay quand il couvre mon opérateur,
afin d'élargir les pays et opérateurs acceptés.

**Bloquée par :** Q-1 (Couverture) et Q-3 (devise débitée, règle de comparaison).

**Critères d'acceptation :**

**Étant donné** la documentation de PawaPay (API v2)
**Quand** l'adaptateur `pawapay` est écrit
**Alors** les notifications sont vérifiées par signature RFC 9421 (rappels signés activés dans le tableau de bord de PawaPay) ; une signature invalide reçoit 401 (AD-5)
**Et** `comparerMontant` applique la règle tirée de la réponse à Q-3, sans tolérance inventée

**Étant donné** l'activation des rappels signés
**Quand** elle dépend d'un réglage global du compte PawaPay
**Alors** la story vérifie que ce compte ne sert qu'à KOMA SHOP avant tout changement, sinon elle s'arrête et le signale à Jonathan

**Étant donné** la fin de la story
**Quand** Jonathan teste sur son téléphone
**Alors** un paiement via PawaPay aboutit en environnement de test, ou par un petit paiement réel remboursé et noté

### Story 5.8 : Paiement mobile money via GeniusPay

En tant que client,
je veux payer via GeniusPay quand il couvre mon opérateur,
afin d'avoir un Agrégateur de plus en secours.

**Bloquée par :** Q-1, Q-2 (ce que permet l'API : notification vérifiable, remboursement, devise) et Q-3.

**Critères d'acceptation :**

**Étant donné** la documentation de GeniusPay (https://geniuspay.ci/docs/api)
**Quand** la story démarre
**Alors** elle vérifie d'abord que l'API permet une notification vérifiable ou une contre-vérification du statut ; sinon, elle s'arrête et le signale à Jonathan, sans adaptateur partiel (règles 2 et 15)

**Étant donné** l'adaptateur `geniuspay`
**Quand** il est écrit
**Alors** il suit les mêmes exigences que les autres adaptateurs (port commun, aucun accès à Supabase, adresses envoyées avec chaque paiement, codes inconnus classés `inconnu`)
**Et** la carte GeniusPay n'est pas branchée (règle 10)

**Étant donné** la fin de la story
**Quand** Jonathan teste sur son téléphone
**Alors** un paiement via GeniusPay aboutit en environnement de test, ou par un petit paiement réel remboursé et noté

## Epic 6 : Le suivi et l'après-vente des Produits physiques

Une cliente commande un cosplay sur mesure ; Jonathan vérifie les Mesures, fait avancer la Commande et elle reçoit un email à chaque étape ; le client peut annuler avant la fabrication ou réclamer sous 48 h ; Jonathan confirme les remboursements avec preuve.

**Tests (décision de Jonathan du 2026-10-21) :** les tests automatiques couvrent tout l'epic avec des données `TEST_` ; aucun script ne crée de Commande `TEST_` hors des tests automatiques (règle 13). Le test de Jonathan sur téléphone attend la story 5.5 (K-Pay carte) ; si elle est encore bloquée à la fin de l'epic 6, l'agent le signale à Jonathan.

### Story 6.1 : Mes commandes et suivi client

En tant que client,
je veux voir mes Commandes et où en est chacune,
afin de savoir quand je recevrai mon costume.

**Critères d'acceptation :**

**Étant donné** « Mon compte »
**Quand** le client ouvre « Mes commandes »
**Alors** il voit ses Commandes (numéro, date, statut réel, total USD), avec « Voir plus » par 12 ; une liste vide affiche « Aucune commande pour le moment. » avec un lien vers les catalogues (FR-22, UX-DR45)
**Et** la RLS ne lui montre que ses propres Commandes

**Étant donné** le détail d'une Commande
**Quand** il s'affiche
**Alors** la frise des statuts montre les statuts réels avec leurs dates, chaque étape avec icône et libellé (« Fait », « En cours », « À venir »), `aria-current="step"` sur l'étape courante, jamais de texte rouge (UX-DR38)
**Et** une Commande `offerte` porte « Offert », sans montant de paiement, Prestataire ni référence
**Et** une Commande `expediee` en retrait à Goma s'affiche « Prête à retirer », sans statut supplémentaire (E-25)
**Et** le numéro de suivi, s'il existe, s'affiche tel quel, en texte, jamais transformé en lien ; aucun état « en transit » n'est calculé (règle 12)
**Et** le bouton WhatsApp est présent

**Étant donné** une Commande `en_attente` ou `echouee`
**Quand** le client l'ouvre
**Alors** « Voir l'état du paiement » mène à l'état réel (story 4.6) ; une Commande `echouee` encore dans son Délai de paiement peut être repayée sans rien ressaisir (FR-19)
**Et** une Commande `expiree` propose « Reprendre mon panier » (E-35)

### Story 6.2 : Commandes dans l'admin

En tant que Jonathan,
je veux retrouver et filtrer toutes les Commandes, et voir le détail de chacune,
afin de préparer mes livraisons depuis mon téléphone.

**Critères d'acceptation :**

**Étant donné** la page admin Commandes
**Quand** Jonathan l'ouvre
**Alors** il filtre par Statut de commande, Famille, Prestataire et Zone de remise, avec « Effacer les filtres » et le nombre de résultats annoncé ; « Voir plus » par 12 ; tableau sur ordinateur, cartes sur mobile (FR-49, UX-DR43)

**Étant donné** le détail d'une Commande
**Quand** il s'affiche
**Alors** il montre les lignes, le Mode et la Zone de remise, le téléphone, l'adresse, la pastille de statut et la tâche liée
**Et** le bloc Paiement en lecture seule affiche Prestataire, moyen, Référence de transaction, montant, devise et date de confirmation, avec « Le statut « payée » ne se pose jamais à la main. » ; aucun champ n'y est modifiable (règle 2, UX-DR43)

**Étant donné** une adresse à corriger
**Quand** Jonathan la modifie
**Alors** la correction est enregistrée et journalisée avec son auteur (FR-24, NFR-9)

### Story 6.3 : Avancement manuel des Commandes et emails de statut

En tant que Jonathan,
je veux faire avancer une Commande d'un geste, avec l'email qui part tout seul au client,
afin de tenir mes clients informés sans écrire chaque message.

**Critères d'acceptation :**

**Étant donné** `avancer_statut` (AD-3)
**Quand** Jonathan ouvre une Commande
**Alors** seules les transitions autorisées sont proposées : `payee → en_fabrication`, `payee → expediee` (seulement si toutes les lignes physiques sont d'origine `stock`), `en_fabrication → expediee`, `expediee → livree` ; une transition interdite est **absente**, pas désactivée (UX-DR44, E-24)
**Et** aucun statut ne recule, et `payee`, `offerte`, `echouee`, `expiree` ne sont jamais proposés (règle 2, E-30)
**Et** des tests SQL prouvent que la fonction refuse toute autre transition (`KS_TRANSITION_INTERDITE`) et toute action sans droit admin

**Étant donné** le passage en `expediee`
**Quand** Jonathan saisit un numéro de suivi (texte libre, facultatif, Q-9)
**Alors** il est enregistré, journalisé et affiché au client tel quel (règle 12)

**Étant donné** un changement de statut
**Quand** il est enregistré
**Alors** l'email correspondant (`commande_en_fabrication`, `commande_expediee` avec le numéro de suivi s'il existe, `commande_livree`) est planifié dans la même transaction et part réellement par la boîte d'envoi (FR-24, FR-44, AD-9)
**Et** l'email `commande_livree` invite le client à envoyer sa photo par WhatsApp, avec le lien vers le numéro réglé ; le lien vers le site arrivera à l'epic 8 (décision du 2026-10-21)
**Et** une Commande 100 % numérique ne reçoit jamais `commande_livree`

### Story 6.4 : Saisie des Mesures du Sur-mesure

En tant que cliente,
je veux saisir mes mesures avec un schéma clair,
afin de recevoir un cosplay à ma taille.

**Bloquée par :** E-10 (liste des Mesures et bornes, fournies par Jonathan).

**Critères d'acceptation :**

**Étant donné** `schemaMesures` (schéma Zod versionné, centimètres entiers, liste et bornes fournies par Jonathan, AD-32)
**Quand** la cliente choisit Sur-mesure sur la fiche d'un cosplay
**Alors** le Schéma des Mesures s'affiche : illustration avec alt court renvoyant à la liste, champs numérotés avec unité (« 3. Tour de poitrine (cm) »), `inputmode="decimal"`, instructions en texte (UX-DR24)
**Et** une valeur hors bornes affiche un message clair relié au champ

**Étant donné** des Mesures incomplètes
**Quand** la cliente touche « Ajouter au panier »
**Alors** l'ajout est refusé, le bouton est en `aria-disabled` avec la raison, et le focus va à la première mesure manquante ; le serveur refuse aussi (FR-8)
**Et** avec des Mesures complètes, l'ajout réussit et les Mesures sont gardées dans `ligne_panier.mesures`

**Étant donné** l'étape de commande d'un Panier avec Sur-mesure
**Quand** la cliente valide
**Alors** une case confirme ses Mesures et le fait que l'annulation n'est plus possible après le début de la fabrication ; sans elle, `creer_commande` refuse (FR-13, AD-34)
**Et** `creer_commande` copie les Mesures dans `mesures` avec la version du schéma ; la ligne est toujours d'origine `fabrication` (AD-26)

**Étant donné** une Commande payée
**Quand** la cliente consulte ses Mesures
**Alors** elle les voit sans pouvoir les modifier (FR-8)

### Story 6.5 : Vérification des Mesures par Jonathan

En tant que Jonathan,
je veux vérifier et corriger les Mesures avant de couper le tissu,
afin de ne pas fabriquer un costume à la mauvaise taille.

**Bloquée par :** E-10 ; s'appuie sur la story 6.4.

**Critères d'acceptation :**

**Étant donné** une Commande Sur-mesure payée
**Quand** Jonathan ouvre ses tâches
**Alors** « Mesures à vérifier » apparaît avec un compteur réel et un lien vers la Commande (FR-23, UX-DR43)

**Étant donné** le détail de la Commande
**Quand** Jonathan corrige une Mesure après avoir contacté la cliente hors du site
**Alors** `corriger_mesures` enregistre la nouvelle valeur, validée par `schemaMesures`, et journalise l'ancienne et la nouvelle valeur
**Et** `valider_mesures` pose `valide_par` et `valide_le`

**Étant donné** une Commande Sur-mesure sans Mesures validées
**Quand** Jonathan ouvre la Commande
**Alors** « Passer en fabrication » est affiché en `aria-disabled` avec la raison « Valide d'abord les mesures. » ; `avancer_statut` refuse aussi côté serveur (FR-23, AD-32, UX-DR44)

### Story 6.6 : Annulation d'une Commande de Cosplay et remboursement

En tant que client,
je veux pouvoir annuler ma commande de cosplay tant que la fabrication n'a pas commencé,
afin de ne pas payer une pièce dont je ne veux plus.

**Critères d'acceptation :**

**Étant donné** la table `demande_client` (module `commande`) et la table `remboursement` (module `paiement`)
**Quand** la migration est appliquée
**Alors** une demande a un type, un statut (`ouverte`, `acceptee`, `refusee`, `close`) et avance seulement par `traiter_demande` (AD-31)

**Étant donné** une Commande `payee` qui contient un Cosplay et n'est pas `en_fabrication`
**Quand** le client touche « Demander l'annulation »
**Alors** une boîte de dialogue lui demande de confirmer, puis une demande `annulation_commande` est ouverte et apparaît dans les tâches de Jonathan
**Et** après `en_fabrication`, le bouton est absent (FR-25)

**Étant donné** une demande ouverte
**Quand** Jonathan l'accepte
**Alors** `annuler_commande` passe la Commande `annulee`, annule toutes ses lignes physiques ensemble, libère réservations, stock et place dans le Plafond, laisse les Kits dans la Bibliothèque, et fige dans un `remboursement` le montant à rendre : lignes physiques (prix figé moins réduction) + Forfait de livraison (AD-27)
**Et** l'email `commande_annulee` est planifié
**Et** s'il la refuse, la demande passe `refusee` et la Commande ne change pas

**Étant donné** un remboursement à faire
**Quand** Jonathan confirme qu'il a rendu l'argent
**Alors** `confirmer_remboursement` exige la preuve (référence du Prestataire ou du virement manuel) ; sans elle, un résumé d'erreur s'affiche et la Commande reste `annulee` (UX-DR44)
**Et** avec la preuve, la Commande passe `remboursee` et l'email `commande_remboursee` est planifié
**Et** la même fonction clôt un Trop-perçu remboursé (statut `rembourse`), avec preuve (AD-31)
**Et** aucun remboursement n'est lancé automatiquement chez un Prestataire (Q-4)

### Story 6.7 : Réclamation et remplacement

En tant que client,
je veux signaler une pièce abîmée ou différente de ma commande dans les 48 heures,
afin de recevoir une pièce de remplacement.

**Critères d'acceptation :**

**Étant donné** une Commande `livree` depuis moins de 48 heures (calcul en base avec `now()`, AD-23) qui contient un Accessoire ou un Cosplay en taille standard
**Quand** le client ouvre son détail
**Alors** « Signaler un problème » est proposé ; au-delà de 48 heures, ou pour une ligne Sur-mesure, il est absent (FR-26)

**Étant donné** le formulaire de réclamation
**Quand** le client l'envoie
**Alors** le champ « Décris le problème » est obligatoire, aucune photo n'est demandée, et un lien WhatsApp à côté permet d'envoyer des photos (décision du 2026-10-21)
**Et** une demande `reclamation` est ouverte et apparaît dans les tâches de Jonathan

**Étant donné** une réclamation
**Quand** Jonathan la traite
**Alors** elle suit `acceptee → article_rendu → remplacement_remis` (ou `refusee`), dans la même `demande_client` ; la Commande reste `livree` (AD-31)
**Et** un remplacement pris en stock décompte le stock par `catalogue_decrementer_stock`
**Et** aucun remboursement n'est proposé (FR-26)

**Étant donné** le suivi
**Quand** le client ouvre « Mes commandes »
**Alors** il voit l'état réel de sa réclamation ; aucun email de réclamation n'est envoyé au lancement (décision du 2026-10-21)

## Epic 7 : Le Festival, les Pass et le Scan

Une visiteuse trouve l'Événement, achète ses Pass nominatifs et les reçoit avec leur Code QR ; le jour J, un bénévole scanne, même hors ligne ; Jonathan crée l'Événement, l'Accès bénévole et traite les annulations. La rubrique s'appelle « Festival » (FR et EN), aux adresses `/fr/festival` et `/en/festival`, une page par Événement sous cette adresse ; le mot reste `evenement` dans le code et la base (décision du 2026-10-21).

**Tests (décision du 2026-10-21) :** comme à l'epic 6, les stories qui demandent un vrai paiement (7.4, 7.5, 7.9) sont couvertes d'abord par les tests automatiques ; le test de Jonathan sur téléphone a lieu après la story 5.4 ou 5.5.

### Story 7.1 : Créer un Événement et ses Types de pass

En tant que Jonathan,
je veux créer un Événement avec ses trois Types de pass,
afin d'annoncer la prochaine rencontre et d'en vendre l'entrée.

**Critères d'acceptation :**

**Étant donné** les tables `evenement` et `type_pass` (module `evenements`)
**Quand** la migration est appliquée
**Alors** la RLS ne donne à `anon` et `authenticated` qu'un `SELECT` sur les Événements publiés et leurs Types de pass (AD-30)

**Étant donné** l'admin
**Quand** Jonathan crée un Événement
**Alors** il saisit en FR et en EN le titre, le lieu (salle ou plein air) et le programme, puis la date et l'heure (fuseau `Africa/Lubumbashi`), la Capacité facultative et les photos (même envoi que la story 2.2, texte alternatif obligatoire) (FR-52)
**Et** il définit les Types de pass Standard, VIP et Stand avec prix USD et avantages en FR et en EN ; un Stand vaut deux Pass nominatifs (AD-7)
**Et** la publication est refusée avec la liste des manques (textes FR ou EN, date, lieu, photo avec texte alternatif, au moins un Type de pass avec prix) ; chaque action est journalisée et invalide le cache `evenements`

**Étant donné** la page Réglages
**Quand** Jonathan saisit le pourcentage de frais d'annulation des Pass
**Alors** il est enregistré et journalisé ; tant qu'il est vide, « Valeur à fixer » s'affiche et aucune annulation de Pass ne peut être acceptée (`KS_REGLAGE_MANQUANT`) (FR-51, règle 15)

**Étant donné** un Événement publié
**Quand** Jonathan ouvre son détail dans l'admin
**Alors** il voit les Pass vendus et scannés par Type de pass, en chiffres réels (FR-52)

### Story 7.2 : Pages Festival

En tant que visiteur,
je veux voir les prochains Événements et tout savoir sur chacun,
afin de décider d'y aller et avec quel Pass.

**Critères d'acceptation :**

**Étant donné** des Événements publiés
**Quand** le visiteur ouvre `/fr/festival` ou `/en/festival`
**Alors** il voit les Événements à venir puis les Événements passés, en cartes (photo, date, titre, lieu), avec « Voir plus » par 12 (FR-31, UX-DR19)
**Et** sans Événement à venir : « Aucun événement à venir pour le moment. », les passés restant affichés
**Et** la rubrique « Festival » apparaît dans l'en-tête et le menu ☰

**Étant donné** la page d'un Événement (`/fr/festival/[slug]`, `/en/festival/[slug]`)
**Quand** elle s'affiche
**Alors** elle montre date, lieu, programme, photos et les cartes des Types de pass (nom, prix USD, avantages), sans aucun compteur de places (UX-DR40)
**Et** un seul bouton « Acheter des pass » sous les cartes

**Étant donné** la Capacité réglée
**Quand** `places_evenement_utilisees(evenement)` (Pass `valide` ou `scanne` + places des Commandes `pass` `en_attente` ou `echouee`, Stand × 2) atteint la Capacité
**Alors** « Complet » s'affiche sur chaque carte, le bouton d'achat disparaît, « Me prévenir » reste (FR-31, AD-12)
**Et** cette donnée est rendue à chaque requête, jamais servie par un segment en cache (AD-17) ; sans Capacité, il n'y a pas de limite

**Étant donné** un Événement passé
**Quand** sa page s'affiche
**Alors** il est marqué comme passé et montre le lien de sa Galerie d'événement s'il est saisi

**Étant donné** le référencement et le partage
**Quand** la page est lue ou partagée
**Alors** elle a ses métadonnées, son image Open Graph, un JSON-LD `Event` et BreadcrumbList, et le bouton « Partager » (FR-56, FR-57)

**Étant donné** l'accueil
**Quand** un Événement à venir est publié
**Alors** le bloc 5 « Rendez-vous otaku » montre le prochain Événement ; sinon il est masqué (FR-2)

### Story 7.3 : « Me prévenir » (Alerte événement)

En tant que visiteur,
je veux être prévenu du prochain Événement par email ou par WhatsApp,
afin de ne pas le rater.

**Critères d'acceptation :**

**Étant donné** le formulaire « Me prévenir » (page Événement, liste Festival, bloc 5 de l'accueil)
**Quand** le visiteur l'ouvre
**Alors** il choisit entre « Par email », « Avec mon compte » (seulement s'il est connecté) et « Par WhatsApp », puis seul le champ correspondant s'affiche (E-12, décision du 2026-10-21)
**Et** une case de consentement, jamais pré-cochée, est obligatoire (UX-DR29)
**Et** l'envoi est limité par `consommer_essai` (AD-22) et confirmé seulement après l'enregistrement réel

**Étant donné** les tables `alerte_evenement` et `consentement`
**Quand** l'inscription est enregistrée
**Alors** le consentement est gardé avec sa version et sa date (AD-34)
**Et** une désinscription (lien dans chaque email, ou Préférences pour un Compte) prend effet immédiatement

**Étant donné** un nouvel Événement publié
**Quand** la publication est enregistrée
**Alors** l'email `alerte_evenement` (nouveau modèle ajouté par migration) est planifié pour chaque inscrit par email ou par Compte qui n'est pas désinscrit, et part par la boîte d'envoi (FR-32, AD-9)

**Étant donné** les inscrits par WhatsApp
**Quand** Jonathan ouvre la liste dans l'admin
**Alors** il exporte leurs numéros (fichier CSV), l'export est journalisé, et aucun message WhatsApp n'est envoyé par le site (FR-32)

### Story 7.4 : Achat de Pass

En tant que visiteuse,
je veux acheter en une fois des Pass pour moi et pour d'autres personnes,
afin d'entrer à l'Événement avec mon aide et ma sœur.

**Critères d'acceptation :**

**Étant donné** un visiteur non connecté
**Quand** il touche « Acheter des pass »
**Alors** il passe par la connexion puis revient à l'achat de Pass (FR-33)

**Étant donné** le sélecteur de Pass (UX-DR40)
**Quand** la cliente choisit des quantités par Type de pass
**Alors** chaque compteur −/+ fait 44 px et sa valeur est annoncée ; un champ de nom apparaît pour chaque autre personne ; un Pass Stand demande deux noms (titulaire et aide) ; son propre Pass reprend son Compte
**Et** aucun bouton d'ajout au Panier n'existe : l'achat de Pass ne passe jamais par le Panier (FR-11, AD-7)

**Étant donné** la mention sur la publication des photos et vidéos de l'Événement
**Quand** la cliente valide
**Alors** la case est obligatoire, jamais pré-cochée, et enregistrée avec sa version (AD-34)

**Étant donné** le Récapitulatif de Pass
**Quand** il s'affiche
**Alors** il montre Types, noms, prix USD et total calculés par le serveur (UX-DR32)

**Étant donné** la cliente qui confirme
**Quand** `creer_commande` crée une Commande de type `pass`
**Alors** chaque ligne porte un Type de pass, une quantité et les noms figés dans `ligne_commande.titulaires` ; les places sont comptées dans la Capacité tant que la Commande est `en_attente` ou `echouee` (AD-7, AD-12)
**Et** si la Capacité est atteinte avant le paiement, la vente est refusée avec « Complet » (`KS_COMPLET`)

**Étant donné** le choix du moyen de paiement
**Quand** il s'affiche
**Alors** l'aiguilleur propose le mobile money ou la carte via K-Pay, jamais Polar (règle 10, test)

### Story 7.5 : Émission des Pass et « Mes Pass »

En tant que cliente,
je veux recevoir aussitôt mes Pass nominatifs avec leur Code QR,
afin de les transmettre et d'entrer le jour J.

**Critères d'acceptation :**

**Étant donné** la table `pass` et la fonction interne `evenements_emettre_pass`
**Quand** `confirmer_paiement` (ou `offrir_commande`) valide une Commande `pass`
**Alors** un Pass est créé par personne, avec un jeton aléatoire de 128 bits (contenu du Code QR), un code court aléatoire de 8 caractères sans caractères ambigus, et `nom_titulaire` figé ; aucun des deux ne se déduit d'un autre Pass (FR-34, AD-12, tests)
**Et** un Stand produit deux Pass ; tous les Pass sont `valide`

**Étant donné** l'émission
**Quand** les Pass sont créés
**Alors** l'email `pass_emis` est planifié : chaque Pass avec son Code QR sur fond blanc, son code court en texte, son alt « Code QR du Pass {Type} de {Nom}, {Événement} » (UX-DR40)

**Étant donné** « Mon compte »
**Quand** la cliente ouvre « Mes Pass »
**Alors** elle voit chaque Pass (Code QR, nom, Type de pass, Événement, code court), avec « Agrandir » et le conseil d'augmenter la luminosité ; sans Pass : « Aucun pass pour le moment. » avec un lien vers le Festival
**Et** un Pass `offert` porte « Offert »

### Story 7.6 : Scan en ligne à l'entrée

En tant que Jonathan,
je veux scanner chaque Code QR à l'entrée et voir aussitôt le Type de pass,
afin de remettre le bon bracelet et de refuser les Pass déjà utilisés.

**Critères d'acceptation :**

**Étant donné** l'écran de Scan (`/[locale]/scan`, admin ou bénévole, AD-13)
**Quand** il s'ouvre sur un téléphone
**Alors** la caméra lit le Code QR dans la page : par l'API native `BarcodeDetector` quand le navigateur la propose, sinon par une bibliothèque de lecture maintenue, choisie au plan (date de dernière version vérifiée, licence notée dans `docs/licences/`, version figée, règles 6 et 14) (décision du 2026-10-21)
**Et** « Saisir le code à la main » est toujours disponible ; la saisie du code court est limitée par `consommer_essai` (AD-22)

**Étant donné** un Code QR ou un code court
**Quand** `scanner_pass` s'exécute
**Alors** en une seule transaction, il passe un Pass `valide` à `scanne` et l'écran affiche en très grand « VALIDE », le nom, l'Événement et le Type de pass (fond `success`, grande coche, mêmes couleurs dans les deux thèmes) (FR-35, UX-DR41)
**Et** un Pass déjà scanné, annulé, remboursé ou d'un autre Événement donne « REFUSÉ » et la raison (fond `danger`, grande croix)
**Et** deux scans simultanés du même Pass n'en valident qu'un (test SQL)

**Étant donné** le retour au bénévole
**Quand** le résultat s'affiche
**Alors** il est annoncé en `role="alert"`, sans son ; là où le téléphone le permet, une vibration courte signale VALIDE et deux vibrations longues signalent REFUSÉ ; sans vibration, l'affichage suffit (E-14, décision du 2026-10-21)
**Et** « Scanner le pass suivant » revient à la caméra

**Étant donné** la caméra refusée
**Quand** l'écran s'ouvre
**Alors** « Autorise l'accès à la caméra pour scanner les pass. » s'affiche avec les instructions en texte, et la saisie manuelle reste possible

### Story 7.7 : Accès bénévole

En tant que Jonathan,
je veux donner à un bénévole un accès limité au Scan, pour le jour de l'Événement seulement,
afin d'être aidé à l'entrée sans ouvrir le reste de l'admin.

**Critères d'acceptation :**

**Étant donné** l'admin d'un Événement
**Quand** Jonathan saisit l'email d'un bénévole
**Alors** le rôle `benevole` est attribué pour cet Événement au Compte de cet email, valable du début à la fin du jour de l'Événement (fuseau `Africa/Lubumbashi`) ; seul l'Admin peut le faire (FR-37, AD-13, décision du 2026-10-21)
**Et** si aucun Compte n'existe pour cet email, l'admin le dit ; le bénévole crée son Compte par code email (story 1.4)

**Étant donné** un bénévole connecté
**Quand** il ouvre le site
**Alors** il n'accède qu'à l'écran de Scan de son Événement ; Commandes, clients, Produits et réglages lui sont refusés côté serveur et en base (tests)

**Étant donné** le jour de l'Événement passé
**Quand** la tâche `supprimer_acces_benevoles_echus` tourne (pg_cron)
**Alors** le rôle est supprimé et le bénévole perd l'accès, même s'il est encore connecté (AD-10, AD-13)

### Story 7.8 : Scan hors ligne

En tant que bénévole,
je veux continuer à scanner quand le réseau coupe,
afin que l'entrée ne s'arrête pas.

**Critères d'acceptation :**

**Étant donné** un appareil connecté et la table `verrou_hors_ligne`
**Quand** le bénévole ou Jonathan prend le Verrou hors ligne de l'Événement
**Alors** un seul Verrou est actif par Événement (index unique partiel) et l'appareil télécharge la liste des Pass `valide` de cet Événement seulement : empreintes SHA-256 du jeton et du code court, `nom_titulaire`, Type de pass (FR-36, AD-12)
**Et** tant que le Verrou est tenu, les autres appareils affichent « Scan réservé à l'appareil hors ligne »

**Étant donné** le jour J
**Quand** le bénévole ouvre l'écran de Scan sans liste enregistrée
**Alors** l'écran lui rappelle de prendre le Verrou et de télécharger la liste avec du réseau, de préférence la veille (décision du 2026-10-21)
**Et** sans Verrou pris à l'avance, aucun Scan hors ligne n'est possible : message explicite

**Étant donné** l'appareil hors ligne
**Quand** il scanne
**Alors** la page, mise en cache par un service worker limité à la route de scan, compare l'empreinte à la liste locale, affiche le même résultat que la story 7.6, et garde chaque scan dans IndexedDB (AD-2, AD-12)
**Et** un même Pass scanné deux fois hors ligne est refusé la seconde fois

**Étant donné** le retour de la connexion
**Quand** l'appareil synchronise
**Alors** `synchroniser_scans` applique les scans, puis `liberer_verrou` rend le Verrou et la liste locale est effacée

**Étant donné** un appareil perdu
**Quand** Jonathan force la libération du Verrou dans l'admin
**Alors** les scans non synchronisés de cet appareil sont signalés par une `anomalie` `scans_non_synchronises` (FR-36, AD-21)

### Story 7.9 : Annulation et remboursement d'un Pass

En tant que cliente,
je veux annuler un Pass jusqu'à 48 heures avant l'Événement,
afin de récupérer une partie de mon argent si je ne peux plus venir.

**Critères d'acceptation :**

**Étant donné** un Pass `valide` et un Événement qui commence dans plus de 48 heures (calcul en base, AD-23)
**Quand** la cliente touche « Demander l'annulation » dans « Mes Pass »
**Alors** après confirmation, une `demande_client` `annulation_pass` est ouverte ; à moins de 48 heures, le bouton est absent (FR-38)

**Étant donné** une demande ouverte
**Quand** Jonathan l'accepte
**Alors** `annuler_pass` passe le Pass `annule` (refusé au Scan dès cet instant) et fige le montant à rendre : (prix figé − réduction) de la ligne ÷ nombre de Pass de la ligne × (1 − frais figés), arrondi au centime inférieur (AD-31)
**Et** les deux Pass d'un Stand s'annulent ensemble ; l'email `pass_annule` est planifié

**Étant donné** le remboursement fait par Jonathan
**Quand** il le confirme avec la preuve
**Alors** `confirmer_remboursement` passe le Pass `rembourse` et planifie l'email `pass_rembourse` ; sans preuve, rien ne change (UX-DR44)

### Story 7.10 : Galerie d'événement

En tant que détenteur de Pass,
je veux recevoir après l'Événement le lien vers ses photos,
afin de retrouver mes souvenirs et de les partager.

**Critères d'acceptation :**

**Étant donné** un Événement
**Quand** Jonathan saisit le lien public de sa Galerie d'événement (Google Drive ou Google Photos)
**Alors** le lien est enregistré, journalisé et affiché sur la page de l'Événement passé (FR-39)

**Étant donné** un Événement terminé dont le lien est saisi
**Quand** la tâche `/api/cron/galerie-evenement` tourne
**Alors** l'email `galerie_evenement` est planifié une seule fois pour chaque acheteur de Pass de l'Événement (AD-9, AD-10)
**Et** l'email rappelle qu'une demande de retrait de photo peut être faite par le formulaire de contact ; Jonathan retire la photo à la main

## Epic 8 : La communauté (Galerie « Ils le portent », Réalisations, Blog)

Le client envoie sa photo avec son accord, Jonathan la valide et elle apparaît sur le mur ; les 10 premières Réalisations gagnent un Pass ; Jonathan publie des guides.

**Règle propre à l'epic (décision du 2026-10-21) :** avant toute publication d'une photo de client, le serveur supprime toutes ses métadonnées (EXIF, et surtout la position GPS) ; un test le vérifie sur une photo qui contient une position.

### Story 8.1 : Envoyer sa photo depuis son Compte

En tant que client,
je veux envoyer la photo de moi dans mon costume,
afin d'apparaître sur le mur « Ils le portent ».

**Critères d'acceptation :**

**Étant donné** la table `photo_galerie` (module `communaute`) et le bucket privé `galerie-attente` (créé à la story 2.2)
**Quand** la migration est appliquée
**Alors** le bucket n'a aucune politique de lecture publique et la table aucune écriture pour `anon` ni `authenticated` (AD-2, AD-18)

**Étant donné** un Compte complet dans « Mon compte » › « Envoyer une photo »
**Quand** le client choisit une photo
**Alors** seuls JPEG, PNG et WebP de 15 Mo au plus sont acceptés, avec un message qui rappelle formats et limite en cas de refus ; la conversion des photos HEIC par Safari sur iPhone est vérifiée au plan de la story
**Et** la photo part dans `galerie-attente` sur autorisation signée, avec une barre de progression, reprise après coupure et « Annuler l'envoi » (UX-DR30)
**Et** l'envoi est limité par `consommer_essai` (AD-22)

**Étant donné** le formulaire d'envoi
**Quand** le client valide
**Alors** l'accord de publication est obligatoire (case jamais pré-cochée), enregistré dans `consentement` avec sa version et sa date (AD-34)
**Et** le client choisit d'afficher ou non son prénom (ou pseudo) et sa ville ; pour un Compte mineur (`est_mineur`), le choix de la ville n'est pas proposé et la ville n'est jamais affichée (FR-40)

**Étant donné** une photo envoyée
**Quand** le client revient sur la page
**Alors** il voit son statut réel : en attente, publiée ou retirée (FR-41)
**Et** il peut demander le retrait d'une photo publiée à tout moment

**Étant donné** l'email `commande_livree` (story 6.3)
**Quand** cette page existe
**Alors** l'email ajoute le lien vers « Envoyer une photo », à côté de l'invitation WhatsApp ; le gabarit est modifié et ses tests repassent

### Story 8.2 : Validation, dépôt WhatsApp et retrait des photos

En tant que Jonathan,
je veux valider chaque photo avant publication, déposer celles reçues par WhatsApp et retirer celles qu'on me demande d'enlever,
afin que le mur ne montre que des photos autorisées.

**Critères d'acceptation :**

**Étant donné** la file des photos en attente dans l'admin
**Quand** Jonathan valide une photo
**Alors** le serveur supprime toutes ses métadonnées (EXIF, position GPS), copie le résultat dans `produits-public`, publie la photo et journalise l'action ; un test prouve qu'une photo avec une position GPS est publiée sans elle
**Et** s'il la refuse, elle n'est jamais publiée
**Et** la tâche « Photos à valider » affiche un compteur réel (FR-41, AD-21)

**Étant donné** une photo reçue par WhatsApp
**Quand** Jonathan la dépose pour un client
**Alors** il rattache la photo au Compte du client s'il en a un, sinon il saisit le prénom (ou pseudo) et la ville acceptés ; il coche « Accord reçu par WhatsApp le [date] » et les choix d'affichage du client (FR-40, AD-34)
**Et** il peut joindre une capture de l'accord WhatsApp, rangée dans un stockage privé, jamais public, sans politique de lecture (décision du 2026-10-21)

**Étant donné** une demande de retrait (depuis le Compte, ou par le formulaire de contact, y compris celle d'un parent pour un mineur)
**Quand** Jonathan retire la photo
**Alors** elle disparaît aussitôt du mur et de `produits-public`, le cache `galerie` est invalidé, et l'action est journalisée (FR-41)

### Story 8.3 : Galerie « Ils le portent » sur l'accueil

En tant que visiteur,
je veux voir de vrais clients dans leur costume,
afin d'avoir envie d'être sur ce mur moi aussi.

**Critères d'acceptation :**

**Étant donné** au moins une photo publiée
**Quand** l'accueil s'affiche
**Alors** le bloc 4 « Ils le portent » (ancre `#galerie`) montre les photos publiées, avec prénom (ou pseudo) et ville seulement si le client l'a autorisé, jamais la ville d'un Compte mineur (FR-2, FR-40, UX-DR19)
**Et** une photo s'ouvre en grand dans une boîte de dialogue, au toucher ou au clavier
**Et** il n'existe pas de page Galerie dédiée

**Étant donné** aucune photo publiée
**Quand** l'accueil s'affiche
**Alors** le bloc 4 et les liens Galerie du pied de page et du menu ☰ sont masqués ; dès la première photo, ils apparaissent et mènent à `#galerie` (UX-DR13, UX-DR45)

### Story 8.4 : Réalisations

En tant que client qui a fabriqué son costume avec un Kit,
je veux montrer ma Réalisation,
afin de prouver que c'est moi qui l'ai fait et de tenter de gagner un Pass.

**Critères d'acceptation :**

**Étant donné** la table `realisation` (module `communaute`)
**Quand** un client ouvre « Envoyer une Réalisation »
**Alors** il choisit le Kit utilisé parmi ceux qu'il a **payés** (accès dont la Commande d'origine a un `paye_le` ; un Kit gratuit ne compte pas, AD-33), puis envoie sa photo comme à la story 8.1 (formats, progression, accord, choix d'affichage)

**Étant donné** l'admin
**Quand** Jonathan ouvre « Réalisations à valider »
**Alors** il voit le Kit déclaré et la preuve d'achat, puis valide ou refuse ; la validation est journalisée et horodatée, et fixe l'ordre des Réalisations validées (FR-42)

**Étant donné** une Réalisation validée avec l'accord de publication
**Quand** elle est publiée sur le mur « Ils le portent »
**Alors** ses métadonnées sont supprimées comme à la story 8.2 et elle porte la mention « Fait avec un kit KOMA » (décision du 2026-10-21)

### Story 8.5 : Opération « 10 pass gratuits »

En tant que client qui a envoyé une Réalisation,
je veux gagner un Pass gratuit si je fais partie des 10 premiers,
afin de venir au Festival dans mon costume.

**Critères d'acceptation :**

**Étant donné** une Réalisation validée
**Quand** Jonathan choisit d'attribuer un Pass offert
**Alors** il choisit l'Événement parmi ceux à venir qui ont encore de la place (décision du 2026-10-21)
**Et** `attribuer_pass_offert` verrouille l'Événement, vérifie que le Kit a été payé, qu'aucun Pass offert n'a déjà été attribué à ce Compte pour cet Événement, attribue le rang suivant (1 à 10, unique par Événement), puis appelle `offrir_commande` : une Commande `pass` `offerte` émet un Pass Standard comme un Pass normal (Code QR, email `pass_emis`, « Mes Pass », mention « Offert ») (FR-42, AD-33)

**Étant donné** deux attributions simultanées
**Quand** elles visent le dixième rang
**Alors** une seule réussit (test SQL)

**Étant donné** l'Événement complet au moment de l'attribution
**Quand** `offrir_commande` s'exécute
**Alors** elle refuse (`KS_COMPLET`) et une `anomalie` `pass_offert_impossible` est créée (AD-12)

**Étant donné** les 10 Pass attribués pour un Événement
**Quand** le client ouvre la page des Réalisations
**Alors** il lit que l'opération est terminée pour cet Événement, et peut toujours envoyer une Réalisation

**Étant donné** le règlement de l'opération
**Quand** Jonathan ne l'a pas encore fourni
**Alors** « [Texte à fournir] » s'affiche en développement et le build de production échoue (Q-5)

### Story 8.6 : Écrire et publier un Article

En tant que Jonathan,
je veux écrire des guides et des annonces avec des images,
afin de nourrir la communauté et d'être trouvé sur Google.

**Critères d'acceptation :**

**Étant donné** la table `article` (module `blog`)
**Quand** Jonathan écrit un Article
**Alors** il saisit en Markdown simple (titres, listes, liens, images) le titre et le texte français, obligatoires, et la version anglaise, facultative ; un aperçu montre le rendu (FR-43, décision du 2026-10-21)
**Et** il ajoute des images (même envoi que la story 2.2, texte alternatif obligatoire) et des liens vers des Produits et des Événements

**Étant donné** le rendu du Markdown
**Quand** il est affiché, dans l'aperçu comme sur le site
**Alors** le HTML brut est refusé et le rendu est nettoyé : aucun script, aucun gestionnaire d'événement ni lien `javascript:` ne peut s'exécuter (test avec un Article qui en contient)
**Et** la bibliothèque de rendu est choisie au plan : maintenue, licence notée dans `docs/licences/`, version figée (règles 6 et 14)

**Étant donné** un Article
**Quand** Jonathan le publie ou le dépublie
**Alors** `publie_le` change, l'action est journalisée et le cache `articles` est invalidé ; la publication est refusée sans titre ni texte français, ou avec une image sans texte alternatif

### Story 8.7 : Blog public

En tant que visiteur,
je veux lire les guides de fabrication et les annonces,
afin d'apprendre et de suivre la vie de KOMA SHOP.

**Critères d'acceptation :**

**Étant donné** des Articles publiés
**Quand** le visiteur ouvre `/fr/blog` ou `/en/blog`
**Alors** il voit les cartes d'Articles (vignette, titre, date), avec « Voir plus » par 12 ; sans Article : « Aucun article pour le moment. » avec un lien vers l'accueil (FR-43, UX-DR19, UX-DR45)
**Et** la rubrique Blog apparaît dans l'en-tête et le menu ☰

**Étant donné** un Article (`/fr/blog/[slug]`, `/en/blog/[slug]`)
**Quand** il s'affiche
**Alors** il est en colonne de lecture de 720 px sur ordinateur, avec fil d'Ariane, JSON-LD Article et BreadcrumbList, métadonnées et Open Graph (FR-56)
**Et** un Article sans version anglaise n'existe pas sous `/en` (404) et n'est pas listé dans le plan du site en anglais ; depuis cet Article en français, le sélecteur de langue mène à la liste `/en/blog`

**Étant donné** l'accueil
**Quand** un Article est publié
**Alors** le bloc 7 « Guides » montre les derniers Articles ; sinon il est masqué (FR-2)

## Epic 9 : La croissance, le pilotage et la mise en ligne

Jonathan crée des Codes promo pour ses Affiliés et suit leurs commissions ; les clients consentants reçoivent Relances et emails ciblés ; Jonathan ouvre chaque matin un tableau de bord aux vrais chiffres ; puis le site est mis en ligne sur son domaine.

**Règles propres à l'epic (décisions du 2026-10-21) :**

- Les emails liés à un achat (commande, paiement, statuts, Kit ouvert, Pass) partent toujours, sans consentement ; seuls les Emails commerciaux demandent un consentement.
- Au lancement, **aucun Email commercial n'est envoyé à un Compte mineur**, même s'il a coché la case ; le réglage `emails_commerciaux_mineurs` (désactivé au départ) permettra de les ouvrir si le juriste les valide (Q-5). L'email d'Alerte événement est traité comme un Email commercial (Glossaire : « tout email non indispensable à une Commande ou à un Pass »).
- Un client ne reçoit jamais plus d'un Email commercial tous les 2 jours, tous types confondus : c'est la limite absolue ; un envoi écarté passe `ignore` avec son motif (AD-9).

### Story 9.1 : Créer un Code promo

En tant que Jonathan,
je veux créer un Code promo pour chaque influenceur,
afin de suivre les ventes qu'il m'apporte.

**Critères d'acceptation :**

**Étant donné** la table `code_promo` (module `promo`)
**Quand** Jonathan crée un code
**Alors** il saisit le code, l'Affilié (nom, sans compte dans l'admin), le pourcentage de réduction, le taux de commission, le plafond d'utilisations (50 par défaut, modifiable) et l'état actif ou inactif (FR-46)
**Et** le code est unique sans distinction de majuscules ; aucune colonne ne compte les utilisations (AD-29)
**Et** chaque création ou modification est journalisée

### Story 9.2 : Appliquer un Code promo

En tant que client,
je veux saisir le code de mon influenceur avant de payer,
afin d'obtenir ma réduction sur mon premier achat.

**Critères d'acceptation :**

**Étant donné** l'étape de commande (story 4.3) et l'achat de Pass (story 7.4)
**Quand** le client saisit un code
**Alors** `creer_commande` (réécrite depuis sa dernière version, AD-1) l'accepte seulement s'il est actif, sous son plafond (`utilisations_code_promo`) et si `a_deja_achete` est faux ; une Commande `offerte` ne compte pas comme achat (FR-47, AD-29)
**Et** la réduction s'applique à tous les Produits et Pass mais jamais au Forfait de livraison ; elle est répartie et figée par ligne (`reduction_cents`, arrondie au centime inférieur, reste sur la dernière ligne) avec le taux de commission (AD-8)
**Et** l'utilisation est réservée dès la création de la Commande et libérée à son expiration ou à son annulation ; `confirmer_paiement` ne revérifie pas le code

**Étant donné** un code refusé
**Quand** le message s'affiche sous le champ (UX-DR27)
**Alors** il dit, selon le cas : « Ce code n'existe pas. Vérifie l'orthographe. » ; « Ce code n'est plus actif. » ; « Ce code a été utilisé le nombre maximal de fois. » ; « Ce code est réservé à un premier achat. » ; « Un seul code par achat. » (décision du 2026-10-21)
**Et** un second code est refusé si le Compte a déjà une autre Commande `en_attente` avec un code

**Étant donné** le Récapitulatif
**Quand** un code est accepté
**Alors** la réduction s'affiche en USD et le total est recalculé par le serveur (FR-14)
**Et** l'origine de la vente enregistre le Code promo (AD-19)

### Story 9.3 : Ventes et commissions par Code promo

En tant que Jonathan,
je veux voir ce que chaque Code promo a rapporté et ce que je dois à l'Affilié,
afin de le payer moi-même, sans erreur.

**Critères d'acceptation :**

**Étant donné** la vue `commission_code_promo`
**Quand** Jonathan ouvre la page Codes promo
**Alors** il voit pour chaque code le nombre de ventes, leur montant et la commission due, calculés seulement sur les Commandes ayant un `paye_le`, hors lignes annulées et hors Commandes remboursées en entier, sur le montant payé hors livraison, au taux figé de chaque Commande (FR-48, AD-27)
**Et** des tests SQL vérifient le calcul avec une annulation et un remboursement
**Et** aucun paiement de commission n'est fait par le site

### Story 9.4 : Consentements, Préférences et désinscription

En tant que client,
je veux choisir quels emails je reçois et pouvoir arrêter d'un geste,
afin de ne recevoir que ce qui m'intéresse.

**Critères d'acceptation :**

**Étant donné** la création de Compte (story 1.4) et l'étape de commande (story 4.3)
**Quand** elles s'affichent
**Alors** une case facultative, non cochée, propose de recevoir les Emails commerciaux ; le choix est enregistré dans `consentement` avec sa version et sa date (AD-34, décision du 2026-10-21)

**Étant donné** « Mon compte » › « Préférences »
**Quand** le client l'ouvre
**Alors** il voit trois interrupteurs : « Relances et rappels » (Relances, panier abandonné, rappels de Kit), « Nouveautés de mon univers » et « Alertes Festival », chacun avec le mot « Actif » ou « Désactivé » mis à jour après enregistrement réel (E-38, UX-DR43)
**Et** un Compte mineur voit que ces emails ne lui sont pas envoyés pour le moment

**Étant donné** un Email commercial
**Quand** le client touche son lien de désinscription
**Alors** la désinscription prend effet immédiatement, sans connexion, par un lien signé propre au destinataire ; elle est enregistrée dans `desinscription` et confirmée à l'écran (FR-45)

**Étant donné** la boîte d'envoi
**Quand** un Email commercial va partir
**Alors** il passe `ignore` (avec le motif) s'il manque le consentement, si le client s'est désinscrit, si le Compte est mineur et que `emails_commerciaux_mineurs` est désactivé, ou si un autre Email commercial est parti il y a moins de 2 jours (AD-9)
**Et** un email lié à un achat n'est jamais écarté pour ces raisons

### Story 9.5 : Relances

En tant que client qui a acheté,
je veux un rappel utile de temps en temps,
afin de continuer mon costume et de revenir au bon moment.

**Critères d'acceptation :**

**Étant donné** le réglage du rythme des Relances (AD-23)
**Quand** la migration est appliquée
**Alors** il est créé avec 3 jours comme valeur de départ, modifiable dans la page Réglages (décision du 2026-10-21)

**Étant donné** la tâche `/api/cron/relances` (CRON_SECRET)
**Quand** elle tourne
**Alors** elle ne vise que les Comptes dont le dernier `paye_le` date de moins de 90 jours (une Commande `offerte` n'ouvre pas de fenêtre) et qui acceptent « Relances et rappels » (FR-45, AD-23)
**Et** chaque Relance ne traite qu'un sujet, choisi dans cet ordre : (a) un Kit commencé et pas terminé → le chapitre suivant ; (b) un Événement Festival dans les 30 prochains jours → l'Événement ; (c) sinon → les nouveautés de son univers ; si aucun sujet ne s'applique, aucune Relance n'est envoyée
**Et** la limite d'un Email commercial tous les 2 jours et l'exclusion des Comptes mineurs s'appliquent (story 9.4)
**Et** le modèle `relance` est ajouté par migration ; chaque Relance contient le lien de désinscription
**Et** la tâche peut être rejouée sans envoyer deux fois la même Relance (tests)

### Story 9.6 : Emails ciblés

En tant que client,
je veux être prévenu au bon moment d'un panier oublié, d'un Kit pas encore commencé ou d'une nouveauté qui me plaît,
afin de ne pas passer à côté.

**Critères d'acceptation :**

**Étant donné** un Compte qui a quitté un Panier non payé et accepte « Relances et rappels »
**Quand** 1 heure puis 24 heures se sont écoulées depuis la dernière modification du Panier
**Alors** l'email `panier_abandonne` est planifié ; il n'est plus envoyé dès que le Panier est payé (FR-59)

**Étant donné** un Kit acheté
**Quand** 2 jours ont passé sans Vidéo de kit démarrée, ou 7 jours sans Vidéo terminée (90 % de la durée)
**Alors** l'email `rappel_kit` est planifié (« Commence le chapitre 1 » ou « Reprends au chapitre [n] ») pour un Compte qui accepte « Relances et rappels »

**Étant donné** un Produit publié dans un univers
**Quand** un Compte y a déjà acheté ou l'a déclaré préféré (story 1.6) et accepte « Nouveautés de mon univers »
**Alors** l'email `nouveau_produit` est planifié

**Étant donné** tous ces emails
**Quand** ils passent par la boîte d'envoi
**Alors** les règles de la story 9.4 s'appliquent (consentement, désinscription, Comptes mineurs, 2 jours) ; les modèles sont ajoutés par migration, dans la langue du client, avec le lien de désinscription

### Story 9.7 : Mesure d'audience maison

En tant que Jonathan,
je veux savoir d'où viennent mes visiteurs et où ils décrochent, sans les pister,
afin d'améliorer la boutique en respectant leur vie privée.

**Critères d'acceptation :**

**Étant donné** la table `evenement_mesure` (module `mesure`) et la route `POST /api/mesure`
**Quand** une action est mesurée
**Alors** seuls sont enregistrés l'action, la page, l'origine (UTM ou Code promo), l'heure et un identifiant de session aléatoire gardé en `sessionStorage` ; ni cookie, ni adresse IP, ni empreinte d'appareil, ni Compte (FR-54, AD-19)
**Et** aucun outil de mesure externe n'est chargé
**Et** la route valide l'action par Zod et limite les envois

**Étant donné** les actions de FR-54
**Quand** le visiteur agit
**Alors** sont mesurés : clic sur un bouton du héros, durée de chargement du héros, vue de fiche, ajout au Panier, création de Compte à l'étape de paiement, abandon à cette étape, partage d'une fiche, inscription à une Alerte événement, photo et Réalisation envoyées, Kit gratuit récupéré, Vidéo de kit démarrée et terminée
**Et** paiements réussis ou échoués par Prestataire, Pass vendus, ventes par Code promo et par origine, livraisons en retard, deuxièmes achats et désinscriptions sont calculés par des vues SQL sur les tables métier, jamais à partir des clics

**Étant donné** l'entonnoir vue de fiche → Panier → Commande → payée → livrée
**Quand** il est calculé
**Alors** il est fait en comptes agrégés par jour et par étape, sans jointure entre une session et une Commande (AD-19)

### Story 9.8 : Tableau de bord

En tant que Jonathan,
je veux voir chaque matin, d'abord, ce qui demande une action,
afin de faire l'essentiel avant d'ouvrir l'atelier.

**Critères d'acceptation :**

**Étant donné** l'ouverture de l'admin
**Quand** le tableau de bord s'affiche
**Alors** il montre d'abord les nouvelles Commandes payées, puis les graphiques de paiement (par Prestataire, par Famille, dans le temps), puis les cartes de tâche de `taches_admin` (Mesures, annulations, remboursements, remplacements, Trop-perçus, photos, Réalisations, messages de contact, anomalies), puis les indicateurs (FR-49, UX-DR43)
**Et** les indicateurs couvrent SM-1 à SM-10 et les signaux d'alerte SM-C1 à SM-C7 du PRD §7, calculés sur 7 et 30 jours
**Et** chaque graphique écrit sa valeur sur chaque barre et propose « Voir les données en tableau » ; aucune donnée fictive, aucune couleur par série (règle 13)
**Et** sans donnée : « Aucune nouvelle commande payée aujourd'hui. », « Aucune tâche en attente. », « Aucun paiement vérifié aujourd'hui. » avec un lien vers les 7 derniers jours (UX-DR44)
**Et** une carte de tâche à zéro reste affichée, en ton atténué

### Story 9.9 : Mise en ligne

En tant que Jonathan,
je veux mettre le site en ligne sur mon domaine, avec tous les réglages de production,
afin d'ouvrir les ventes.

**Bloquée par :** Q-D1 (domaine). À vérifier dans la même story : Q-N1 (nom affiché), Q-F1 (Sakura Town), Q-A2 (Hostinger), Q-5 (textes légaux validés), conditions d'ouverture du PRD §6.1.

**Critères d'acceptation :**

**Étant donné** le domaine acheté par Jonathan chez Hostinger
**Quand** la mise en ligne est préparée
**Alors** `NEXT_PUBLIC_SITE_URL` est réglée sur ce domaine en production ; aucun nom de domaine n'est écrit dans le code (test de la story 1.1)
**Et** le nom affiché définitif est saisi dans `nom_site` (Q-N1) ; Sakura Town n'est activée que si Q-F1 est réglée, sinon les titres restent en Barlow Condensed

**Étant donné** Supabase
**Quand** la production est créée
**Alors** le projet de production (Paris, offre Pro) reçoit les migrations par la Supabase CLI **avant** l'avance de la branche `production` ; `CRON_SECRET` est dans Vault ; les tâches pg_cron pointent vers le domaine (AD-20)

**Étant donné** les dépendances de `next-intl` (`@swc/core`, `@parcel/watcher`, qui ont des scripts d'installation)
**Quand** Jonathan prépare le déploiement sur Hostinger (Node.js 24)
**Alors** `npm ci` et `next build` y réussissent avec ces dépendances (point reporté de la story 1.2) ; sinon la story le signale avant l'ouverture des ventes

**Étant donné** hPanel
**Quand** Jonathan règle l'application
**Alors** l'application Node.js 24 déploie la branche `production`, avec `next build` puis `next start` (Q-A2 vérifiée), et les variables d'environnement de production sont saisies par Jonathan, jamais dans le dépôt (règle 4)

**Étant donné** les emails
**Quand** le domaine est vérifié chez Resend (SPF, DKIM, DMARC)
**Alors** les emails du site partent depuis ce domaine, et Supabase Auth envoie le code de connexion par le SMTP de Resend, avec une limite d'envoi relevée (AD-36)

**Étant donné** les services externes
**Quand** la production est branchée
**Alors** Google OAuth, les bibliothèques Bunny et les applications KOMA SHOP de chaque Prestataire reçoivent les adresses de production ; aucun tunnel n'est utilisé en production
**Et** les en-têtes de sécurité (CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`) sont vérifiés sur le domaine (AD-36)

**Étant donné** l'ouverture des ventes
**Quand** Jonathan coche la liste de vérification
**Alors** sont faits : au moins un Agrégateur couvrant la RDC testé avec de vrais petits paiements, K-Pay carte opérationnel, textes légaux validés et en ligne (aucun marqueur « [Texte à fournir] » : le build de production le garantit), au moins un Kit filmé et des Produits publiés (PRD §6.1)
**Et** les tests manuels TalkBack sur les parcours clés et le test dans le navigateur intégré d'Instagram (accueil et parcours d'achat) sont faits ; le test VoiceOver est fait par un testeur avant l'ouverture des ventes (UX-DR48)
**Et** Lighthouse mobile sur l'accueil du domaine donne ≥ 90 en performance, accessibilité et SEO (NFR-2)
**Et** le plan du site et `robots.txt` donnent les adresses du domaine ; le site est déclaré à Google Search Console
