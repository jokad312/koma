---
title: "Réconciliation guide + CLAUDE.md → PRD — KOMA SHOP"
created: 2026-10-16
sources:
  - docs/guide-koma-shop.md (G)
  - CLAUDE.md, version mise à jour le 2026-10-16 (C)
cible:
  - prd.md, addendum.md (même dossier)
  - .memlog.md (décisions de Jonathan du 2026-10-16)
---

# Réconciliation : guide et CLAUDE.md face au PRD

**Méthode.** Chaque capacité, règle, contrainte, exigence légale, élément SEO, email, fonction admin, statut, règle de design ou de photo et intention qualitative du guide (G) et de CLAUDE.md (C) a été cherchée dans le PRD et l'addendum. Ce qui est remplacé par une décision du `.memlog.md` n'est **pas** compté comme un écart. Il figure dans la liste « Écarts volontaires » (§1) pour traçabilité, et dans la liste des passages du guide à mettre à jour (§5).

Niveaux : **[Haut]** = touche une règle, le légal, l'argent ou la rétention ; **[Moyen]** = capacité utile perdue ; **[Bas]** = précision ou formulation.

---

## 1. Écarts volontaires (décisions du memlog, pas des trous)

À ne pas rouvrir. Pour mémoire seulement :

- Paiement : 4 agrégateurs mobile money, K-Pay carte (produit physique), Polar carte (100 % kits) dès le lancement (memlog l.16-19).
- Kit gratuit : absent au lancement, ajouté 4 semaines après (l.49).
- Téléchargements illimités, à la place de la limite de 10 par fichier (l.54). Conséquence : la fonction admin « Remettre à zéro les téléchargements » (G Phase 4 B.4) n'a plus d'objet.
- Affiliation par codes promo, à la place du lien `?ref=` avec 60 jours et 20 % (G Phase 9 C) (l.50-53).
- Galerie, blog, Événements, Pass et billetterie au lancement (l.30, 33-45).
- Retrait gratuit à Goma seulement ; Bukavu en livraison seule (l.26-27).
- Connexion par code à 6 chiffres + Google, à la place du lien magique (G Phase 1 D) (l.64).
- Compte obligatoire avant paiement, mais panier possible sans compte (l.65), à la place de la création automatique de compte à l'achat (G user stories, Phase 5 B.1).
- Politique de retours : annulation du cosplay avant fabrication, kits non remboursables, réclamation sous 48 h avec remplacement (l.88-92). Remplace l'exemple de G § Légal (retour sous 14 jours, etc.).
- Publicité payante dès le lancement (l.46), à la place de « la publicité payante attend que les ratios soient bons » (G § Lancement).
- Accueil : ordre des blocs (l.60), à la place de « 6 derniers produits » et « trois étapes » (G Phase 2 B.1).
- Plafond atteint : « Épuisé » + kit (l.94-96), à la place de « Carnet de commandes complet ».
- Transporteur supprimé ; numéro de suivi libre et facultatif (l.24).

---

## 2. Écarts réels : ce que le PRD laisse tomber ou contredit sans décision

### 2.1 Onboarding et connaissance du client

**G-1 [Haut] Questions d'onboarding supprimées.**
- *Source :* G § Ce qu'on garde (domaine 5 « Questions sur les univers préférés et le niveau ») ; G Phase 8 B (3 questions : « Comment nous as-tu connus ? », « Tes univers préférés ? », « Tu préfères… prêt à porter / fabriquer / les deux ») ; G entité Utilisateur (univers préférés) ; G Phase 1 B `profiles.favorite_universes, level, techniques, acquisition_source` ; G § Lancement (« garde celles que la question “Comment nous as-tu connus ?” fait ressortir ») ; G § Boucle hebdo, points 1 et 3 (« ajouter un produit dans l'univers le plus coché à l'onboarding »).
- *PRD :* aucune mention. Le glossaire ne connaît ni l'univers préféré ni la source d'acquisition. FR-54 ne mesure pas la source.
- *Conséquence :* la boucle d'amélioration du guide (choisir la technique d'acquisition et le prochain produit) n'a plus de données. L'email « nouveau produit dans ton univers » devient impossible.
- *Correction proposée :* ajouter une FR « Questions d'accueil » (après la création du Compte, 3 questions facultatives, modifiables dans le profil) dans §4.3. Ajouter « réponses d'accueil » à FR-49 et FR-54. Sinon, faire acter par Jonathan leur suppression dans le memlog.

### 2.2 Emails

**G-2 [Haut] Relance de panier abandonné supprimée.**
- *Source :* G Phase 8 C (« Panier abandonné : 1 h puis 24 h après ») et son test (« s'arrête si le client paie ») ; G § Ratios (« Commande lancée → payée… regarde : relance de panier »).
- *PRD :* FR-45 ne couvre que les relances **après achat** (90 jours). Le memlog (l.46, 48) parle de relances « pour faire revenir le client », sans trancher le panier abandonné. SM-C7 mesure l'abandon à l'étape compte sans action corrective.
- *Remarque :* le compte étant obligatoire avant paiement (FR-12), l'adresse email est connue au moment où le panier est abandonné, ce qui rend cette relance faisable.
- *Correction proposée :* ajouter à §4.10 une FR « Relance de panier abandonné » (1 h puis 24 h, arrêt dès paiement, consentement selon la règle des emails commerciaux), ou faire acter son exclusion.

**G-3 [Moyen] Emails de progression du kit dilués.**
- *Source :* G Phase 8 C (« 2 jours après sans vidéo commencée : “Commence par le chapitre 1” ; 7 jours après sans fin : “Reprends au chapitre [n]” »).
- *PRD :* FR-45 cite « chapitre suivant » parmi les thèmes de relance commerciale, tous les 2 à 3 jours, avec consentement. Les déclencheurs comportementaux (J+2 sans démarrage, J+7 sans fin) ont disparu.
- *Correction proposée :* préciser dans FR-45 que les relances de kit sont déclenchées par la progression (pas de vidéo commencée à J+2, pas finie à J+7), et dire si elles relèvent du transactionnel (sans consentement) ou du commercial.

**G-4 [Moyen] Email « nouveau produit dans ton univers » supprimé.**
- *Source :* G Phase 8 C (« Nouveau produit : aux clients qui ont coché le même univers »).
- *PRD :* absent (dépend de G-1).
- *Correction proposée :* l'ajouter à FR-45 (ciblage par univers) si G-1 est retenu.

**G-5 [Bas] Règles de forme des emails.**
- *Source :* G Phase 8 C (« un seul bouton par email »). G entité Utilisateur et `profiles.language`.
- *PRD :* rien sur le bouton unique ni sur la **langue** des emails (FR ou EN selon le Compte).
- *Correction proposée :* ajouter à FR-44 : « chaque email est envoyé dans la langue du Compte, avec une seule action principale ».

### 2.3 Légal et confiance

**G-6 [Haut] Cases légales du checkout incomplètes.**
- *Source :* G Phase 5 B.4. Trois cases : (1) CGV ; (2) pour un kit, « J'accepte l'accès immédiat au contenu numérique et je renonce à mon droit de rétractation » ; (3) pour le sur-mesure, « Je comprends qu'une pièce faite sur mesure ne peut être ni reprise ni échangée ». Justification dans G § Légal : ce sont les deux exceptions au droit de rétractation de 14 jours dans l'UE.
- *PRD :* FR-13 ne garde que les CGV et « les Kits ne sont pas remboursables ». Or Amina (UJ-3) achète depuis l'étranger, peut-être depuis l'UE, et « non remboursable » ne suffit pas sans **consentement exprès à l'exécution immédiate** et **reconnaissance de la perte du droit de rétractation**. La case sur-mesure a disparu.
- *Correction proposée :* reprendre les deux formulations du guide dans FR-13 (en plus de la mention « non remboursable ») et ajouter la case sur-mesure. Ajouter à Q-5 la validation de ces formulations par un juriste.

**G-7 [Haut] Licence des kits non définie.**
- *Source :* G § Pages à publier, CGV (« accès à vie, usage personnel, pas de revente ni de partage des fichiers ») ; G § Technique (« le but est de bloquer le partage facile d'un lien »).
- *PRD :* FR-30 parle d'accès à vie, mais nulle part d'usage personnel ni d'interdiction de revendre ou de partager les fichiers ou de vendre des costumes faits avec les patrons.
- *Correction proposée :* ajouter à FR-30 (ou au glossaire « Kit ») la règle d'usage personnel, et l'ajouter au contenu attendu des CGV dans Q-5.

**G-8 [Moyen] Fiscalité absente des questions ouvertes.**
- *Source :* G § Légal, Taxes (« K-Pay encaisse mais ne déclare pas les taxes étrangères… vérifie avec ton comptable »).
- *PRD :* Q-1 à Q-12 n'en parlent pas. Polar est marchand de référence pour les kits par carte, mais les kits payés par mobile money à l'étranger et les Pass ne le sont pas.
- *Correction proposée :* ajouter Q-13 « Fiscalité des ventes en RDC et à l'étranger, par Prestataire (comptable) ».

**G-9 [Moyen] Vérifications K-Pay du guide non reprises.**
- *Source :* G § Paiement (« vérifier que le paiement par carte est activé, que la vente d'objets physiques est acceptée, pays et devises USD ») ; G Semaine 1.
- *PRD :* Q-1 (couverture mobile money) et Q-3 (devise) couvrent une partie ; Q-7 (pièces inspirées) aussi. Rien sur **carte activée sur le compte marchand** et **objets physiques acceptés** chez K-Pay, alors que K-Pay est le seul encaisseur carte des produits physiques et des Pass. Rien non plus sur l'acceptation des **Pass** par K-Pay.
- *Correction proposée :* compléter Q-1 ou créer Q-14 : « K-Pay confirme : carte activée, produits physiques acceptés, billetterie acceptée, USD ».

**G-10 [Bas] Promesse « réponse sous 24 h ».**
- *Source :* G § Légal, Confiance (« un numéro WhatsApp visible, réponse sous 24 h »).
- *PRD :* §9 reprend tout sauf le délai de réponse.
- *Correction proposée :* demander à Jonathan s'il tient cette promesse (règle 5 : pas de promesse inventée), puis l'ajouter à §9 ou l'écarter dans le memlog.

### 2.4 Fonctions admin

**G-11 [Moyen] Liste et filtres des commandes.**
- *Source :* G Phase 4 B.1 (« liste filtrable par statut, famille et moyen de paiement ; détail avec adresse, mesures et téléphone ») ; G Phase 4 A.1 (liste produits : famille, statut, prix, stock total, ventes).
- *PRD :* FR-24 et FR-49 ne décrivent ni la liste des Commandes ni ses filtres (statut, Famille, Prestataire / moyen de paiement, Zone, Mode de remise) ni le contenu du détail. FR-50 ne décrit pas la liste des Produits.
- *Correction proposée :* ajouter à FR-24 : « liste des Commandes filtrable par Statut, Famille, Prestataire et Zone de remise ; détail avec articles, adresse, Mesures, téléphone, Prestataire et Référence de transaction ». Ajouter à FR-50 la liste des Produits.

**G-12 [Haut] Effets d'une annulation sur le stock et les accès.**
- *Source :* G Phase 4 B.3 (« Annuler ou marquer remboursé : retire les accès aux kits de la commande et remet le stock ») ; G Phase 1 B `entitlements.revoked_at`.
- *PRD :* FR-25 et FR-38 disent seulement que la Commande passe `remboursée` ou que le Pass est refusé au Scan. Rien ne dit que le stock est remis ni que le Plafond de fabrication est libéré. Pour une Commande mixte annulée (cosplay + kit), rien ne dit si le Kit reste ouvert (les Kits sont non remboursables) ou est retiré.
- *Correction proposée :* ajouter à FR-25 : « l'annulation remet le stock et libère une place dans le Plafond ; dans une Commande mixte, le Kit reste acquis (non remboursable) sauf décision contraire de Jonathan ». Faire trancher ce dernier point.

**G-13 [Moyen] Téléversement robuste des fichiers et vidéos de kit.**
- *Source :* G Phase 4 A.5 (« barre de progression et reprise en cas de coupure »).
- *PRD :* FR-50 cite les Fichiers et la Vidéo de kit sans exigence de reprise. Or Jonathan téléverse depuis Goma, sur une connexion instable, des vidéos lourdes.
- *Correction proposée :* ajouter à FR-50 : « téléversement avec progression et reprise après coupure ».

**G-14 [Bas] Redirection d'un client hors de l'admin.**
- *Source :* G Phase 4, test (« un compte client qui ouvre /admin est redirigé ») ; G Phase 8, test (« tableau de bord refusé à un compte client »).
- *PRD :* FR-53 contrôle les droits de l'Assistant, et FR-37 ceux du bénévole, mais aucune FR ne dit explicitement qu'un Compte client n'accède à rien de l'admin.
- *Correction proposée :* une phrase dans §4.12 : « un Compte client n'a accès à aucune page ni donnée de l'admin (contrôle serveur + RLS) ».

**G-15 [Bas] Délai de remise par Zone dans les réglages.**
- *Source :* G entité Zone de livraison (« forfait, délai indicatif ») ; G Phase 1 B `shipping_zones.delay_text`.
- *PRD :* FR-6 et FR-14 affichent un « délai total (fabrication + remise) », mais FR-51 ne règle que les Forfaits, pas le délai de remise par Zone (Goma moins d'un jour, Bukavu un jour au plus selon le memlog l.23).
- *Correction proposée :* ajouter à FR-51 « délai de remise par Zone » (et de retrait).

**G-16 [Bas] Forfait selon la Famille : question laissée ouverte par le guide.**
- *Source :* G § Livraison (« un tarif différent selon la famille… reste à trancher dans le PRD »).
- *PRD :* le glossaire tranche implicitement (« montant fixe par Zone de remise »), sans décision dans le memlog.
- *Correction proposée :* faire confirmer par Jonathan « un forfait par Zone, quelle que soit la Famille et le nombre d'articles », puis le noter dans le memlog et dans §11.

### 2.5 Mesure et rétention

**G-17 [Haut] Le réachat et la fin de vidéo ne sont plus mesurés.**
- *Source :* G § Ce qu'on garde, domaine 0 (« La rétention, c'est le réachat ») et domaine 4 (« … livré ou vidéo regardée → 2e achat ») ; G Phase 8 A (`video_started`, `video_completed`, `repeat_purchase`, `file_downloaded`, `order_shipped`, `order_delivered`, `checkout_started`) ; G Phase 8 A tableau de bord (entonnoir fiche → panier → commande → payée, taux de réachat, délais moyens de fabrication et de livraison, réponses d'onboarding, périodes 7 et 30 jours) ; G § Ratios (6 ratios hebdomadaires) ; G Phase 7 A (vidéo « terminée à 90 % »).
- *PRD :* FR-54 et §7 ne mesurent ni le **2e achat**, ni la **vidéo commencée ou terminée**, ni les téléchargements, ni l'entonnoir complet, ni les délais moyens réels. SM-1 à SM-7 sont orientés acquisition et lancement ; aucun indicateur ne garde « le seau percé ». La notion de vidéo « terminée » n'est pas définie.
- *Correction proposée :* ajouter à FR-54 : vidéo commencée et terminée (seuil à définir, 90 % dans le guide), fichier téléchargé, commande commencée, 2e achat. Ajouter à §7 : « SM-8 Clients avec 2 achats ou plus » et « SM-9 Kits payés dont la vidéo est terminée ». Ajouter à FR-49 l'entonnoir, les périodes 7 et 30 jours et les délais moyens réels.

### 2.6 Catalogue, fiches et SEO

**G-18 [Moyen] Pages par univers supprimées.**
- *Source :* G § SEO, socle (`/univers/[slug]`) ; G Phase 3 A ; G § Lancement, technique 6 « SEO programmatique : une page par univers et par guide » ; G § SEO (« une page par produit, par univers et par guide »).
- *PRD :* FR-5 garde le filtre univers, mais pas de page d'univers indexable. FR-56 ne cite pas ce type de page.
- *Correction proposée :* ajouter à FR-5 « une page publique par univers, avec ses Produits, ses Articles et ses données structurées », ou faire acter l'abandon. Vérifier avec la règle 6 que le nom d'un univers ne nomme pas une franchise (par exemple « samouraï », « magical girl »).

**G-19 [Bas] Produits liés supprimés.**
- *Source :* G Phase 3 B.7 (« Produits liés (même univers) »).
- *PRD :* absent.
- *Correction proposée :* l'ajouter à FR-6 et FR-9, ou l'écarter explicitement.

**G-20 [Moyen] Détails SEO perdus.**
- *Source :* G § SEO, socle : balises **hreflang**, **robots.txt**, **un seul H1 par page**, Offer avec **livraison** dans le JSON-LD, gabarit de titre (« [Titre] — cosplay fait main, prêt à porter | KOMA SHOP »), champs `seo_title` / `seo_description` éditables ; G Phase 3 test (« le test des résultats enrichis de Google valide le Product ») ; G Phase 1 E (« page 404 soignée »).
- *PRD :* FR-56 cite titre, description, URL, Open Graph, JSON-LD, plan du site et canonique. Il manque hreflang, robots.txt, H1 unique, données de livraison dans Offer, champs SEO éditables dans FR-50 et la page 404.
- *Correction proposée :* compléter FR-56 avec ces éléments, et FR-50 avec « titre et description SEO (FR et EN) ».

**G-21 [Moyen] Incohérence de langue des Articles (interne au PRD).**
- *Source :* C § Langues (« Français et anglais, via /fr et /en ») ; G § SEO (« Site bilingue : /fr et /en, balises hreflang »).
- *PRD :* FR-55 dit « toutes les pages publiques existent en français et en anglais », mais FR-43 (hypothèse confirmée) rend la version anglaise des Articles facultative. Ce n'est pas un écart avec la décision, mais les deux FR se contredisent et le comportement de `/en` pour un Article sans traduction n'est pas défini (404 ? version FR ? hreflang absent ?).
- *Correction proposée :* ajouter à FR-55 une exception explicite pour les Articles, et dire ce que montre `/en/…` d'un Article sans traduction (absent du plan du site EN, sans hreflang EN).

### 2.7 Règles de design et de photo

**G-22 [Moyen] Règles photo abandonnées.**
- *Source :* G § Règles pour les photos (5 angles par produit : face, dos, profil, détail, portée ; lumière naturelle ou douce ; fond simple ; même cadrage pour tout le catalogue ; photos envoyées en grand, compressées par le site) ; G Semaine 2.
- *PRD :* seul le texte alternatif obligatoire est repris (FR-50). §9 ne dit rien des angles ni du cadrage. La compression et le redimensionnement automatiques ne sont pas exigés.
- *Correction proposée :* ajouter à §9 les règles photo (comme guide pour Jonathan) et à FR-50 « images téléversées en grand, redimensionnées et compressées automatiquement ».

**G-23 [Bas] Héros des autres pages et structure commune.**
- *Source :* G § Héros page par page (Cosplays « Prêts à porter, faits main à Goma » ; Kits « Fabrique-le toi-même, pas à pas » ; Accessoires « La pièce qui manquait à ton costume » ; À propos « Un seul créateur. Chaque pièce faite main. », avec « Écrire sur WhatsApp ») ; G Phase 2 A (en-tête : liens, panier avec compteur, compte, menu ☰ ; pied de page : liens légaux, contact, WhatsApp, réseaux sociaux, moyens de paiement acceptés).
- *PRD :* FR-4 renvoie à « la direction du guide (§9) », mais §9 ne reprend pas ces héros. L'en-tête et le pied de page ne sont décrits nulle part (le lien Événements et Blog n'y figure donc pas non plus).
- *Correction proposée :* dans FR-4, renvoyer explicitement à G § Héros page par page, et décrire l'en-tête (avec Événements et Blog) et le pied de page. Les logos des moyens de paiement ne doivent montrer que les Prestataires réellement actifs (règle 5).

**G-24 [Bas] Limite de la protection vidéo.**
- *Source :* G § Technique (« Aucune protection n'empêche de filmer son écran : le but est de bloquer le partage facile d'un lien »).
- *PRD :* NFR-4 et FR-29 ne disent pas jusqu'où va la protection. Cela laisse la porte ouverte à une DRM coûteuse.
- *Correction proposée :* ajouter cette phrase à NFR-4 comme limite assumée.

### 2.8 Panier, paiement et statuts

**G-25 [Moyen] Échec de paiement : statut non défini.**
- *Source :* G Phase 6 B.4 (« Échec : commande en cancelled, stock inchangé ») ; G Phase 6 C (page /merci : « Valide sur ton téléphone » en attente de mobile money ; vérification toutes les 3 s pendant 3 min).
- *PRD :* FR-20 affiche « échouée », mais ce statut n'existe pas dans le glossaire. Avec le repli FR-17, on ne sait pas si la Commande reste `en attente` (nouvel essai) ou passe `annulée`, ni quand une Commande `en attente` expire et libère le stock et le Plafond.
- *Correction proposée :* ajouter au glossaire et à FR-17 / FR-20 : statut d'une tentative échouée, durée d'expiration d'une Commande `en attente` (valeur à demander à Jonathan, règle 15) et libération du stock à l'expiration.

**G-26 [Moyen] Commande mixte : statuts séparés.**
- *Source :* G § Les règles, règle 7 (« Panier mixte : les kits se débloquent tout de suite, les pièces physiques suivent leur propre statut »).
- *PRD :* FR-19 ouvre les Kits au paiement, mais le Statut est porté par la Commande entière. Le PRD ne dit pas comment une Commande mixte affiche « livrée » pour le Kit et « en fabrication » pour le cosplay.
- *Correction proposée :* préciser dans le glossaire (Statut de commande) que, dans une Commande mixte, le Statut suit les Produits physiques et que les Kits sont livrés dès `payée`.

**G-27 [Bas] Stock vérifié à l'affichage du panier.**
- *Source :* G Phase 5 A.3 (« Stock vérifié à chaque affichage ; un article épuisé est signalé »).
- *PRD :* FR-10 vérifie au paiement seulement.
- *Correction proposée :* ajouter à FR-11 : « le Panier signale un article devenu indisponible ou dont le Plafond est atteint ».

**G-28 [Moyen] Définition du Plafond de fabrication modifiée.**
- *Source :* G § Le projet et règle 5 (« nombre de commandes **physiques en cours** ») ; G Phase 1 B `max_open_physical_orders`.
- *PRD :* glossaire « Commandes de Produits physiques **en cours de fabrication** ». Une Commande `payée` pas encore `en fabrication` (Mesures à vérifier), ou `expédiée` pas encore livrée, compte-t-elle ? Le memlog (l.94) dit « conservé », sans changer la définition.
- *Correction proposée :* fixer la définition : « Commandes de Produits physiques Sur commande au statut `payée` ou `en fabrication` » (à confirmer par Jonathan).

**G-29 [Moyen] WhatsApp visible pendant le paiement, montant affiché = débité.**
- *Source :* G § Paiement (« un numéro WhatsApp visible en cas de souci de paiement ; le montant affiché est exactement celui débité »).
- *PRD :* FR-20 propose WhatsApp seulement après un échec ; Q-3 pose la question de la devise, sans poser l'exigence.
- *Correction proposée :* ajouter à FR-14 / FR-16 : « le bouton WhatsApp est visible pendant tout le paiement » et « le client voit, avant de valider, le montant qui sera réellement débité (dans la devise du Prestataire si elle diffère de l'USD) », sous réserve de Q-3.

**G-30 [Moyen] Recette avec un vrai paiement par Prestataire.**
- *Source :* G Phase 6, tests (« paiement de test par carte » et « paiement mobile money réel de petit montant ») ; G Semaine 5 (« un vrai achat de test par mobile money et par carte »).
- *PRD :* aucune condition de mise en service d'un Adaptateur.
- *Correction proposée :* ajouter à FR-21 : « un Prestataire ne peut être activé en production qu'après un paiement réel de petit montant réussi, de bout en bout (Notification vérifiée comprise) ». Cela respecte la règle 13.

### 2.9 Croissance (phase 9 du guide) non tranchée

**G-31 [Moyen] Filigrane des patrons supprimé sans décision.**
- *Source :* G Phase 9 B (« pied de page du PDF : “KOMA SHOP — [URL] — acheté par [email du client]”, fichier stocké inchangé ») ; G § Lancement, technique 3 (filigrane, étiquette cousue, carte avec QR code dans chaque colis).
- *PRD :* absent du lancement, de §6.2 et de §6.3. Le memlog a tranché le kit gratuit, l'affiliation, la galerie et les guides de la phase 9, mais pas le filigrane. Avec des téléchargements illimités, ce filigrane devient le principal frein au partage de fichiers.
- *Correction proposée :* demander à Jonathan de placer le filigrane (lancement, +4 semaines ou plus tard) et l'inscrire dans §6. L'étiquette et la carte QR sont hors logiciel, mais la cible du QR (Galerie) existe.

**G-32 [Moyen] Kit gratuit : aucune FR pour son parcours.**
- *Source :* G Phase 9 A (« bouton “Obtenir gratuitement”, compte requis, accès créé sans paiement, événement `free_kit_claimed`, même séquence d'emails ») ; G § Héros Kits (« Obtenir le kit gratuit »).
- *PRD :* glossaire, §6.2 et SM-6 seulement ; aucune FR ne décrit comment l'accès est créé **sans** Notification de paiement (FR-19 est le seul chemin d'ouverture d'un Kit).
- *Correction proposée :* ajouter une FR en §6.2 : « Kit gratuit : compte requis, accès créé par le serveur sans Commande payée ni Prestataire, une fois par Compte, mesuré ». Voir aussi C-2 plus bas.

**G-33 [Bas] Lien photo ↔ produit dans la Galerie.**
- *Source :* G Phase 9 D (« photos… liées au produit »).
- *PRD :* FR-40 ne relie pas une photo à un Produit, alors que FR-42 relie une Réalisation à un Kit acheté.
- *Correction proposée :* ajouter à FR-40 « la photo est reliée au Produit concerné et peut s'afficher sur sa fiche ».

### 2.10 Points mineurs

- **G-34 [Bas]** Champs de mesures (poitrine, taille, hanches, hauteur, notes : G entité Mesures) non listés dans FR-8 : à fournir à l'UX.
- **G-35 [Bas]** Progression vidéo : fréquence de sauvegarde (15 s) et seuil « terminé » (90 %) du guide non repris (G Phase 7 A) ; à laisser à l'architecte, mais le seuil « terminé » est nécessaire à G-17.
- **G-36 [Bas]** Durées des liens signés (5 min pour un fichier, 3 h pour la vidéo, G Phase 7 B) remplacées par « courte durée » : acceptable, à fixer par l'architecte.
- **G-37 [Bas]** Collision de nom pour l'architecture : la table d'analytique `events` du guide (G Phase 1 B, Phase 8 A) et l'entité métier « Événement » du PRD. Le signaler à l'architecte.

---

## 3. Respect des règles 1 à 15 de CLAUDE.md par le PRD

| Règle | Verdict | Où dans le PRD | Remarque |
| --- | --- | --- | --- |
| 1 Bucket privé, lien signé, RLS | Respectée | NFR-4, FR-9, FR-28 | — |
| 2 Seule la notification vérifiée passe en `paid` | Respectée, avec un risque | FR-19, FR-20, NFR-5 | Voir C-2 : Pass gratuit (FR-42) et Kit gratuit (§6.2) |
| 3 Prix, stock, livraison côté serveur | Respectée | FR-10, FR-13, NFR-5 | Le PRD l'étend aux réductions ; à reporter dans C (C-3) |
| 4 Secrets en variables d'environnement | Respectée | §4.4, NFR-7 | — |
| 5 Honnêteté | Respectée | FR-2, NFR-8 | Voir G-10 (24 h) et G-23 (logos de paiement) |
| 6 Propriété intellectuelle | Respectée | FR-4, §8, memlog l.61 | Voir G-18 (noms d'univers) |
| 7 Mobile, contraste, alt, clavier | Respectée | NFR-1, NFR-3 | — |
| 8 SEO sur chaque page publique | Partielle | FR-56 | Voir G-20 (hreflang, robots, H1) et G-21 |
| 9 Mobile money, 4 agrégateurs | Respectée | §4.4.1, FR-15 à FR-17 | — |
| 10 Carte : K-Pay si physique, Polar si 100 % kits | Respectée | §4.4.2-3, FR-16 | — |
| 11 Route de choix vérifiée en base + tests | Respectée | FR-18 | Le PRD ajoute le test Pass ; C ne le mentionne pas (C-1) |
| 12 Livraison manuelle | Respectée | §4.5, FR-24, §8 | — |
| 13 Interdiction de simuler | Respectée, avec un risque | §4.4, FR-44, NFR-8 | Voir C-2 |
| 14 Rien hors phase | Respectée | §8 | Le périmètre de lancement est large mais décidé par Jonathan |
| 15 S'arrêter s'il manque une info | Respectée dans l'ensemble | §10 | Voir C-4 |

**C-1 [Haut] CLAUDE.md ne connaît pas encore les Pass.** Les règles 9 à 11 ne parlent ni des Pass (mobile money via les 4 agrégateurs, carte via K-Pay, jamais Polar sans accord écrit, achat séparé du panier), ni de la règle « un Panier ne contient jamais de Pass ». Un agent de développement qui ne lit que CLAUDE.md pourrait router un Pass vers Polar. *Correction :* ajouter une phrase à la règle 10 et le test « un Pass ne part jamais chez Polar » à la règle 11 (avec l'accord de Jonathan, comme pour les règles 9 à 11).

**C-2 [Haut] Pass gratuit et Kit gratuit, face aux règles 2 et 13.** FR-42 émet le Pass gratuit « comme un Pass normal », et le Kit gratuit (§6.2) ouvre un accès. Or FR-19 réserve l'émission des Pass et l'ouverture des Kits au passage en `payée`. La tentation sera de créer une Commande à 0 USD marquée `payée`, avec une fausse référence : c'est exactement ce que les règles 2 et 13 interdisent. *Correction :* écrire dans FR-42 et dans la FR du Kit gratuit (G-32) que l'émission se fait par un chemin serveur distinct, sans Commande `payée`, sans Prestataire et sans Référence de transaction, tracé par l'auteur de la validation (NFR-9).

**C-3 [Moyen] Autres décalages entre CLAUDE.md et le PRD.**
- « Prix et livraison » : « Bukavu… livrée en moins d'un jour ». Le memlog (l.23) et le PRD §4.5 disent « un jour au plus », et Goma « moins d'un jour ». Le retrait gratuit à Goma est absent de CLAUDE.md.
- Règle 3 : ajouter « réductions des codes promo et frais d'annulation des Pass ».
- « Le produit » et « Stack » : rien sur les Événements, les Pass, le blog ni les codes promo ; un agent pourrait les juger « hors phase » (règle 14).
- Règle 12 : « saisit le numéro de suivi lui-même ». Le PRD le rend facultatif (memlog l.24) ; la règle reste vraie, mais préciser « s'il existe ».

**C-4 [Bas] Règle 15 : une déduction à confirmer.** FR-47 applique le Code promo « à tout le catalogue (Produits **et Pass**) ». Le memlog (l.51) dit « tout le catalogue » sans citer les Pass, et §11 ne liste pas ce point. À faire confirmer.

---

## 4. Synthèse des corrections proposées au PRD

1. Ajouter : questions d'accueil (G-1) ; relance de panier abandonné (G-2) ; Kit gratuit sans paiement (G-32, C-2) ; pages d'univers (G-18).
2. Compléter FR-13 avec les cases légales du guide (G-6) ; FR-30 avec la licence d'usage personnel (G-7) ; §10 avec la fiscalité et les vérifications K-Pay (G-8, G-9).
3. Compléter FR-54, FR-49 et §7 avec le réachat, la vidéo terminée, l'entonnoir et les délais réels (G-17).
4. Compléter FR-24, FR-25, FR-50 et FR-51 : liste et filtres des commandes, effets d'une annulation, téléversement avec reprise, délai par Zone (G-11 à G-15).
5. Définir l'échec et l'expiration d'une Commande, les statuts d'une Commande mixte et le Plafond (G-25, G-26, G-28).
6. Demander à Jonathan : filigrane (G-31), forfait par Famille (G-16), réponse sous 24 h (G-10), Kit d'une Commande mixte annulée (G-12), Code promo sur les Pass (C-4).

---

## 5. Passages à mettre à jour hors du PRD

### 5.1 Dans `docs/guide-koma-shop.md` (décrivent encore l'ancienne règle ou une décision dépassée)

Le bandeau ajouté en tête de « Paiement et livraison » (l.148) ne couvre que cette section. Les passages suivants restent faux :

| Lignes (env.) | Passage | Ce qui est dépassé |
| --- | --- | --- |
| 51-52 | Tableau SwitchPro, domaines 7 et 8 | « kit gratuit, affiliation » → codes promo ; kit gratuit à +4 semaines |
| 55, 627 | « publicité payante tant que les ratios ne sont pas bons » | Publicité dès le lancement (memlog l.46) |
| 61 | « Fonctionnalités secondaires, pas plus au lancement » | Lancement avec Événements, Pass, blog, galerie, codes promo |
| 81 | Statuts | Inchangés, mais pas de statut des Pass |
| 88 | Règle 4 « 10 fois au plus » | Téléchargements illimités |
| 100 | User story « un compte est créé avec son email » | Compte obligatoire avant paiement, panier sans compte |
| 112-123 | Schéma technique « Paiement K-Pay » | Couche à adaptateurs, une route de notification par prestataire |
| 142 | Secrets : « K-Pay, Polar… » | Ajouter PawaPay, MaishaPay, GeniusPay |
| 169-172 | Livraison : Goma « À préciser », forfait par famille « à trancher » | Goma < 1 jour, Bukavu ≤ 1 jour ; point famille à trancher (G-16) |
| 198 | Héros Kits « Obtenir le kit gratuit » | Pas au lancement |
| 255 | Avant de commencer : « l'accès marchand K-Pay » | Accès des 4 agrégateurs + Polar |
| **269-327** | **Copie intégrée de CLAUDE.md** | Stack « paiement K-Pay (mobile money et carte) » ; règle 2 à une seule route ; règles 9-11 d'origine (K-Pay encaisse tout, Polar « seulement quand la phase Polar est demandée ») ; pas de conversion de devise ; « Une phase à la fois » au lieu d'« une story à la fois ». À remplacer par la version actuelle de CLAUDE.md ou par un renvoi |
| 340-352 | Phase 1 B, schéma | `orders.provider` sans montant ni devise encaissés ; aucune table pour Événements, Pass, Scans, Codes promo, Articles, Galerie, Prestataires et couverture ; `profiles` sans consentement par canal |
| 360 | Phase 1 D « lien magique (email) et Google » | Code à 6 chiffres + Google (masqué dans les navigateurs intégrés) |
| 379-386 | Phase 2 : en-tête, accueil | Ordre des blocs de l'accueil (memlog l.60) ; liens Événements et Blog |
| 439, 440 | Phase 4 B.3 « remboursement d'argent dans K-Pay » ; B.4 remise à zéro des téléchargements | Remboursement par Prestataire (Q-4) ; B.4 sans objet |
| 461-465 | Phase 5 B.1 et B.4 | Compte avant paiement ; cases légales à revoir avec G-6 |
| **474-503** | **Phase 6 « Paiement K-Pay »** | Tout K-Pay ; test « Aucun code de cette phase n'appelle Polar » ; échec → cancelled. À réécrire selon §4.4 du PRD |
| 515 | Phase 7 B.1 « refuse au-delà de 10 téléchargements » | Illimité |
| 541-545 | Phase 8 C, emails | Relances 2-3 jours pendant 90 jours (memlog l.46-48) |
| 553-578 | Phase 9 | Kit gratuit à +4 semaines ; affiliation → codes promo ; galerie et guides au lancement ; filigrane non tranché |
| 580 | « Plus tard : une phase 10 pourra ajouter Polar » | Polar actif dès le lancement |
| 592, 638 | « confirme auprès de K-Pay », Semaine 1 | Étendre aux autres prestataires |
| 599 | Exemple de politique de retours | Remplacé par memlog l.88-92 |
| 604 | « K-Pay encaisse mais ne déclare pas les taxes » | À généraliser à tous les prestataires |
| 618 | Affiliation « [20] % par commande » | Codes promo, taux par code |
| 625 | Communauté « Discord ou WhatsApp » après 50 clients | Communauté sur WhatsApp et aux Événements (PRD §8) |
| 651 | Semaine 5 « paiement K-Pay » | Tous les prestataires |
| 679 | « Après 2 ou 3 mois : phase 9 » | Calendrier remplacé |
| 696 | Lexique : « le message que K-Pay envoie » | « que le prestataire envoie » |
| 706-707 | Sources | Ajouter PawaPay ; Polar : polar.sh/docs et polar.sh/legal/acceptable-use-policy |

### 5.2 Dans `CLAUDE.md`

Voir C-1 (Pass dans les règles 9 à 11), C-3 (délais Goma et Bukavu, retrait, règle 3, nouvelles familles de fonctions). Toute modification de ces règles demande l'accord explicite de Jonathan.
