---
review: Paiement & confiance (adversarial)
cible: EXPERIENCE.md, DESIGN.md, .memlog.md (status draft, 2026-10-16)
référentiels: CLAUDE.md règles 1 à 15 ; PRD §3, §4.3 à §4.8, §6, §9, §11
date: 2026-10-16
---

# Revue Paiement & confiance — UX KOMA SHOP

## Verdict global

**NON PRÊT pour les stories de paiement, prêt pour le reste avec corrections.**

Les fondations sont saines : le serveur décide du Prestataire, Polar est explicitement exclu pour un Panier avec Produit physique, un Panier mixte et un Pass (EXPERIENCE § Component Patterns « Carte de moyen de paiement », § Paiement & confiance, UJ-3b, UJ-5) ; la page de retour lit l'état serveur ; « en cours de vérification » ne propose ni repli ni repaiement ; l'USD est le seul affichage ; urgence artificielle, avis et compteurs inventés sont interdits ; aucune image de franchise ; la Couverture vient de la base ; argot et emojis sont exclus du paiement.

Mais une faille critique (l'admin peut, tel que décrit, passer une Commande en `payée` à la main) et plusieurs trous d'états (Commande `offerte`, double soumission / onglet fermé / retour arrière, carte indisponible, Trop-perçu côté client) laissent au développeur la liberté d'inventer un comportement, ce qu'interdisent les règles 2, 13 et 15.

| Sévérité | Nombre |
|---|---|
| critical | 1 |
| high | 5 |
| medium | 12 |
| low | 7 |

---

## Findings

### CRITICAL

**C-1. L'admin peut passer une Commande en `payée` à la main : rien ne l'interdit dans l'UX.**
*Localisation* : EXPERIENCE § Admin, ligne « Commandes (liste + détail) … avancement manuel » ; UJ-6 étape 4 (« il passe la Commande `en fabrication` d'un geste »).
*Problème* : « avancement manuel » sans liste des transitions permises conduit naturellement à un sélecteur qui propose tous les Statuts de commande, `payée` et `offerte` compris. L'admin est un navigateur : la règle 2 (« Seules les routes serveur de notification… Jamais le navigateur ») et NFR-5 seraient violées, avec en prime un faux décompte de stock, une fausse ouverture de Kit et une fausse émission de Pass.
*Fix* : dans § Admin, ajouter une table « Transitions manuelles autorisées » : `payée → en fabrication → expédiée → livrée` (Produits physiques), `en attente → annulée` sur demande validée, `annulée → remboursée` **seulement avec saisie obligatoire de la preuve** (référence du Prestataire ou du virement, FR-25 et FR-38). États **jamais** proposés à l'admin : `payée`, `offerte`, `échouée`, `expirée` (posés par le serveur uniquement). Pas de passage `en fabrication` sans Mesures validées (FR-23). Ajouter à § State Patterns : « Admin : transition interdite → action absente, pas désactivée ».

### HIGH

**H-1. La Commande `offerte` (0 USD) n'a aucun état ni aucun libellé : risque d'affichage « Payée ».**
*Localisation* : EXPERIENCE § State Patterns (aucune ligne `offerte`) ; § Component Patterns « Frise des statuts » ; IA « Compte › Mes commandes » ; FR-58, FR-42.
*Problème* : le Kit gratuit (lancement + 4 semaines) et le Pass offert de l'opération « 10 pass » créent des Commandes `offerte`. Sans état dédié, la frise générique et la page de confirmation afficheront « Payée » (statut simulé, règle 13 ; FR-58 « jamais marquée `payée` »). Le flux « Obtenir le Kit gratuit d'un clic, sans Panier ni Prestataire » n'est pas décrit : un développeur le fera passer par le Panier et le Récapitulatif à 0 USD, voire par un Prestataire.
*Fix* : ajouter un état **Offerte** (Mes commandes, Frise, email, Mes Pass) avec libellé « Offert » distinct de « Payée », sans montant de paiement, sans Prestataire ni référence. Ajouter un composant « Bouton Obtenir le Kit gratuit » (fiche Kit gratuit, connexion requise, sans Panier ni Récapitulatif ni choix de paiement ; état « déjà obtenu » → « Ouvrir dans ma bibliothèque »). Préciser que le Kit gratuit ne compte pas comme premier achat (message Code promo).

**H-2. Double soumission, retour arrière, fermeture d'onglet, multi-onglets : non traités.**
*Localisation* : EXPERIENCE § Component Patterns « Bouton principal », « Écran d'attente de paiement » ; § State Patterns (aucune ligne).
*Problème* : seule la règle serveur « une Tentative à la fois » est citée. Rien ne dit que le bouton « Payer » se verrouille dès le premier toucher (Instagram in-app, réseau lent : double toucher très probable), ce que voit un client qui revient en arrière depuis la page carte de K-Pay/Polar, qui rouvre le site après avoir fermé l'onglet pendant la validation USSD, ou qui a deux onglets. Risque R-6 (double débit, perte de confiance) et tentation d'inventer un comportement (règle 15).
*Fix* : ajouter à § State Patterns :
- **Paiement lancé** : bouton « Payer » verrouillé au premier toucher, libellé « Paiement lancé… », tant que le serveur n'a pas répondu ; la requête porte une clé d'idempotence (à confirmer par l'architecte).
- **Tentative en cours retrouvée** (retour arrière, rechargement, second onglet, réouverture) : la page de paiement lit l'état serveur et affiche l'Écran d'attente ou « en cours de vérification » ; aucun nouveau choix de moyen de paiement, aucun bouton « Payer ».
- **Onglet fermé** : la Commande `en attente` apparaît dans Mes commandes avec son état réel et un lien « Voir l'état du paiement » ; l'email n'est cité que s'il part réellement (règle 13).
- Changement de moyen de paiement (mobile money ↔ carte) impossible tant qu'une Tentative est en cours.

**H-3. Aucun état « carte indisponible » : risque de Polar en repli ou de bouton carte mort.**
*Localisation* : EXPERIENCE § State Patterns (seul « Panier mixte + carte » est décrit) ; UJ-3 étape 4 et « Moment fort » ; PRD Q-13, §6.1 (« Polar s'ajoute dès qu'il est prêt »), FR-16.
*Problème* : au lancement, Polar peut ne pas être activé (Q-13) et K-Pay carte peut être désactivé. L'UX ne dit pas ce que voit le client : un développeur pourrait proposer Polar quand K-Pay carte est coupé (violation règle 10), ou K-Pay pour un Panier 100 % kits (non prévu par FR-16), ou une carte inerte. UJ-3 suppose Polar actif.
*Fix* : ajouter l'état **Carte indisponible pour ce panier** : l'option Carte n'apparaît pas (ou apparaît avec la raison « Paiement par carte indisponible pour le moment »), aucune substitution de Prestataire ; jamais Polar pour un Produit physique ou un Pass, même si K-Pay est coupé ; jamais MaishaPay/GeniusPay carte (non branchés). Signaler en question ouverte : Panier 100 % kits + Polar inactif → K-Pay carte autorisé ou non ? (décision de Jonathan, PRD muet). Annoter UJ-3 : « suppose Polar activé (Q-13) ».

**H-4. Logos d'opérateurs mobile money prévus en hypothèse : logos non contractualisés.**
*Localisation* : DESIGN § Components « Sélecteur pays + opérateur : logos d'opérateurs [HYPOTHÈSE, licence des logos à vérifier] » ; DESIGN D-9 (non bloquant).
*Problème* : les contrats de Jonathan sont avec les Agrégateurs, pas avec M-Pesa, Airtel, Orange, Africell. Afficher leurs logos = marques tierces non autorisées (règle 5 « aucun logo », esprit de la règle 6). Rien n'interdit non plus les logos Visa/Mastercard/K-Pay/Polar sur la carte de paiement ou le pied de page.
*Fix* : DESIGN : « Sélecteur pays + opérateur : noms d'opérateurs en texte. Logos seulement après autorisation écrite listée dans le Réglage admin ». Ajouter au Do's and Don'ts : « Logos de réseaux de carte, d'opérateurs ou de Prestataires sans autorisation écrite » à éviter. D-9 passe à **bloquant** pour la story de l'écran de paiement si des logos sont envisagés.

**H-5. Trop-perçu côté client classé non bloquant : le pire moment de confiance est laissé vide.**
*Localisation* : EXPERIENCE § State Patterns « Trop-perçu … question ouverte » ; E-13 « Non » ; PRD FR-19, R-6.
*Problème* : un client qui a validé sur son téléphone après l'échéance, ou dont deux Tentatives ont abouti chez deux Agrégateurs, voit « expirée » ou « échouée » alors qu'il a été débité. Sans écran défini, soit il ne voit rien (perte de confiance, appels), soit un développeur invente un message ou un remboursement automatique (règles 13, 15 ; Q-4).
*Fix* : E-13 devient **bloquant pour la story Page de retour / Mes commandes**. Proposition à valider par Jonathan : quand le serveur a enregistré un Trop-perçu pour cette Commande, afficher « Nous avons reçu un paiement pour cette commande alors qu'elle était [expirée / déjà payée]. Jonathan va te contacter pour le remboursement. » + Bouton WhatsApp ; aucune promesse de délai ni de mode de remboursement tant que Q-4 est ouverte.

### MEDIUM

**M-1. Page de retour : la lecture serveur est affirmée mais pas cadrée.**
*Localisation* : § Component Patterns (pas de composant « Page de retour ») ; § State Patterns « Payée ».
*Problème* : FR-20 cite trois états (payée, **en attente**, échouée) ; l'UX ne décrit pas « en attente » (retour carte avant Notification). Rien n'interdit de lire les paramètres de l'URL de redirection de K-Pay/Polar (`?status=success`).
*Fix* : ajouter : « La page de retour ignore tout paramètre de statut de l'URL de redirection ; elle interroge le serveur par numéro de Commande, vérifie que la Commande appartient au Compte connecté. Retour carte avant Notification = état "en cours de vérification", couleur `warning`, jamais `success`. »

**M-2. Origine de la liste des opérateurs non précisée ; épuisement des Agrégateurs non traité.**
*Localisation* : § Component Patterns « Sélecteur pays + opérateur » ; § State Patterns « Couple non couvert », « Échec confirmé ».
*Problème* : « seuls les couples couverts mènent au paiement ; sinon message » suppose que des opérateurs non couverts sont listés — d'où vient cette liste ? Une liste codée en dur serait une couverture supposée (règle 9). Rien sur le cas où **tous** les Agrégateurs du couple ont échoué ou sont désactivés.
*Fix* : « Pays et opérateurs listés = union des couples de la table Couverture (base) ; aucun pays ni opérateur codé en dur. » Ajouter l'état **Plus aucun service pour cet opérateur** : « Choisis un autre opérateur ou la carte » + WhatsApp, sans nouveau « Réessayer avec un autre service ».

**M-3. Classification « échec dû au client » vs « échec confirmé de l'Agrégateur » non sourcée.**
*Localisation* : § State Patterns, deux lignes d'échec.
*Problème* : les deux états mènent à des actions différentes (repli ou non), mais rien ne dit qui classe ni ce que devient un code d'erreur inconnu. La documentation MaishaPay/GeniusPay n'est pas vérifiée (Q-2). Le PRD range « annulation » côté Agrégateur et « abandon » côté client : ambiguïté.
*Fix* : « La classification vient du serveur, depuis une table de codes par Adaptateur tirée de la documentation. Code inconnu → "en cours de vérification", jamais repli. » Ajouter une question ouverte : annulation par le client sur son téléphone = échec client ou échec Agrégateur ?

**M-4. Repli : ce que voit le client n'est pas spécifié (E-6 ouvert).**
*Localisation* : § State Patterns « Échec confirmé … Nom de l'Agrégateur affiché : question ouverte » ; E-6.
*Problème* : au repli, une nouvelle demande arrive sur le téléphone, peut-être d'un autre émetteur ; sans le dire, le client croit à un double débit ou ignore la demande.
*Fix* : garder E-6 bloquant ; spécifier dès maintenant, quel que soit le nom affiché : « Une nouvelle demande de paiement va arriver sur ton téléphone. La première n'a pas été débitée. » (affiché seulement quand le serveur a confirmé l'échec de la première Tentative). Le bouton de repli redemande une action explicite (déjà dit, conserver).

**M-5. Zone sans argot ni emoji incomplète.**
*Localisation* : EXPERIENCE § Voice and Tone ; memlog (décision garde-fous) ; DESIGN § Brand & Style.
*Problème* : la liste (paiement, erreurs, Mesures, consentements, légal) ne couvre pas explicitement : page de retour « payée » (le « Moment fort » invite au ton festif), Panier, Récapitulatif, emails **transactionnels** (confirmation, statuts, Pass), Mes commandes / Frise, Mes Pass, Bandeau d'avertissement de zone, Badges de disponibilité, Écran de Scan, réclamation / annulation.
*Fix* : remplacer par une liste exhaustive : « Sans argot ni emoji : Panier, Étape de commande, Récapitulatif, paiement, attente, page de retour (succès compris), Mes commandes, Frise, Mes Pass, bibliothèque (accès), annulation, réclamation, emails transactionnels, bandeau de zone, badges, Mesures, consentements, Scan, erreurs, légal, admin. »

**M-6. Q-3 / E-7 peut faire entrer une devise locale à l'écran, contre CLAUDE.md.**
*Localisation* : § Paiement & confiance « montant débité en devise locale : Q-3 ouverte » ; E-7.
*Problème* : CLAUDE.md : « le site n'affiche que l'USD ». Si Q-3 conclut qu'il faut montrer le montant en CDF, il faut d'abord modifier CLAUDE.md avec Jonathan ; sinon le développeur affichera une conversion calculée par le site (règle 3 et 15).
*Fix* : écrire : « Tant que Q-3 n'est pas tranchée et CLAUDE.md modifié, aucun montant hors USD n'est affiché, aucune conversion n'est calculée par le site, aucune phrase sur la devise débitée n'est inventée. »

**M-7. Achat de Pass : récapitulatif, Code promo, connexion, Capacité au paiement non décrits ; « jamais dans le Panier » non énoncé.**
*Localisation* : IA « Achat de Pass » ; UJ-5 ; § State Patterns.
*Problème* : FR-33 exige un client connecté et une vérification serveur de la Capacité au paiement ; FR-47 applique le Code promo aux Pass. L'UX ne prévoit ni Récapitulatif USD de Pass, ni état « Capacité atteinte pendant le paiement », ni état « pas de bouton Ajouter au panier pour un Pass ».
*Fix* : ajouter : Récapitulatif de Pass (types, noms, prix USD, réduction, total USD, serveur) ; connexion requise avant l'Achat ; état **Événement complet entre-temps** (vente refusée avant paiement ; après paiement → Trop-perçu, voir H-5) ; règle « Aucun bouton d'ajout au Panier sur un Pass ; paiement toujours séparé ; carte = K-Pay seulement ».

**M-8. Panier sans Compte : prix potentiellement servis depuis le stockage du navigateur ; changement de prix et fusion non traités.**
*Localisation* : § State Patterns « Article devenu indisponible » ; § Component Patterns « Récapitulatif ».
*Problème* : seule l'indisponibilité est revérifiée. Rien n'impose que le Panier affiche des prix relus côté serveur à chaque affichage (règle 3), ni ce qui se passe si le prix ou le Forfait change entre Récapitulatif et paiement, ni si la fusion du Panier à la connexion révèle un Kit déjà possédé.
*Fix* : « Le Panier ne garde côté navigateur que des identifiants et quantités ; prix, forfait, délais et disponibilité sont relus sur le serveur à chaque affichage. » États : **Montant modifié** (« Le total a changé : [ancien] → [nouveau] USD », reconfirmation obligatoire avant paiement) ; **Kit déjà possédé après fusion** (retiré du Panier avec message).

**M-9. Remise : lieu de retrait, délai de livraison et statut `expédiée` en retrait non sourcés.**
*Localisation* : § State Patterns ; Récapitulatif « délai total (fabrication + livraison) » ; UJ-1 étape 5 ; FR-51.
*Problème* : FR-51 fixe forfaits et « lieu et modalités du retrait », mais aucun réglage de délai de livraison ; l'UX additionne un délai de livraison non défini (règle 15). Le lieu de retrait n'est pas affiché avant paiement. Pour un retrait, `expédiée` n'a pas de sens et aucun libellé n'est décidé.
*Fix* : afficher lieu et modalités de retrait (lus du Réglage) à l'étape de commande dès que « Retrait » est choisi. Question ouverte : source et format du délai de livraison par Zone (réglage admin ou texte fixe « moins d'un jour » / « un jour au plus » de CLAUDE.md ?). Question ouverte : libellé client de `expédiée` pour un retrait (sans créer de nouveau statut, règle 14).

**M-10. Pied de page « moyens de paiement (texte) » : risque de liste statique.**
*Localisation* : DESIGN § Components « Pied de page … moyens de paiement (texte) ».
*Problème* : une liste codée afficherait MaishaPay, GeniusPay ou Polar alors qu'ils ne sont pas branchés (PRD §6.1, Q-2, Q-13), ou des opérateurs non couverts.
*Fix* : « Liste lue côté serveur depuis les Prestataires actifs et la Couverture ; aucun nom de Prestataire inactif ; formulation générique (“Mobile money, carte”) si Jonathan préfère ne pas nommer. »

**M-11. Filtre « univers » et question d'accueil : noms de franchise.**
*Localisation* : IA Catalogues « filtres (univers…) » ; E-15 (non bloquant) ; PRD FR-5, FR-12 vs §9 et règle 6.
*Problème* : un univers s'appelle presque toujours comme une franchise ; le PRD §9 interdit « aucun nom de franchise » et l'UX dit « Aucun nom de franchise, même dans une description ». Contradiction non signalée.
*Fix* : signaler la contradiction en question ouverte **bloquante** pour la story Catalogue, liée à Q-7 (avis juridique) ; pas de liste d'univers saisie par défaut.

**M-12. Annulation d'une Commande mixte et preuve de remboursement non décrites.**
*Localisation* : § Component Patterns « Frise des statuts » ; § State Patterns « Annulation hors délai ».
*Problème* : une Commande mixte (Kit + Cosplay) : l'annulation porte-t-elle sur le Kit (non remboursable, déjà ouvert) ? Montant remboursé ? L'UX ne dit rien (règle 15). Le statut `remboursée` exige une preuve (FR-25) non reflétée côté admin.
*Fix* : question ouverte à Jonathan (annulation partielle, montant). Admin : passage `remboursée` impossible sans champ preuve rempli (voir C-1).

### LOW

**L-1. Compte à rebours du Délai de paiement laissé ouvert (E-9).**
*Localisation* : § State Patterns « Commande `expirée` » ; E-9.
*Fix* : trancher dès maintenant : pas de compte à rebours animé ; au besoin, texte statique « À payer avant [heure] » lu du serveur, sans couleur d'alerte.

**L-2. « Dernières places !! sans Capacité réelle » laisse entendre qu'avec Capacité ce serait permis.**
*Localisation* : § Voice and Tone, tableau À éviter.
*Fix* : « Aucun compteur de places ni de stock (“plus que X”), même réel : le PRD ne prévoit que “Complet” (FR-31) et les badges sans quantité (règle 14). »

**L-3. JSON-LD Product : interdiction d'`aggregateRating` / `review` non écrite.**
*Localisation* : EXPERIENCE (SEO non détaillé) ; règle 8 et règle 5.
*Fix* : « Données structurées Product/Offer : prix USD lu en base, `availability` réelle ; jamais `aggregateRating` ni `review`. »

**L-4. UJ-1 et UJ-2 citent M-Pesa et Airtel Money comme acquis.**
*Localisation* : UJ-1 étape 7, UJ-2 étape 5.
*Fix* : annoter « exemple ; couverture réelle selon Q-1 ».

**L-5. Référence de transaction déjà utilisée : aucun comportement client écrit.**
*Localisation* : § State Patterns.
*Fix* : « Aucun écran client ; la Commande garde son état ; aucune erreur technique ni identifiant de Prestataire affiché ; événement visible dans l'admin seulement. »

**L-6. Numéro de suivi : forme non cadrée.**
*Localisation* : § Component Patterns « Frise des statuts » ; Q-9.
*Fix* : « Texte libre saisi par l'admin, affiché tel quel, jamais transformé en lien de transporteur ; aucun état “en transit” calculé (règle 12). »

**L-7. Écran d'attente : bascule vers « en cours de vérification » et promesses non bornées.**
*Localisation* : § Component Patterns « Écran d'attente de paiement ».
*Fix* : renvoyer la durée à l'architecture (question ouverte) ; interdire « Tu vas recevoir un email/SMS » tant que l'envoi n'est pas réel ; afficher le montant USD et le numéro masqué lus du serveur.

---

## Points vérifiés conformes

- Polar jamais proposé pour Produit physique, Panier mixte ou Pass ; liste des Prestataires reçue du serveur (règles 10, 11).
- « Payée » seulement après Notification vérifiée ; « en cours de vérification » sans repli ni repaiement (FR-17, FR-20).
- Prix et Récapitulatif recalculés par le serveur (règle 3) ; USD partout.
- Interdits explicites : comptes à rebours d'urgence, faux stocks bas, « X vient d'acheter », avis, compteurs, logos de partenaires, blocs vides masqués (règle 5).
- Aucune image ni nom de franchise ; motifs manga jamais derrière un formulaire de paiement (règle 6).
- Couverture lue en base, jamais en code (règle 9).
- Kit déjà possédé, un Kit par Panier, Panier 100 % numérique sans remise (FR-9, FR-11, FR-13).
- Délai affiché sur fiche, Panier et Récapitulatif ; Retrait seulement à Goma ; Bukavu livraison obligatoire.
- Frise : statuts réels saisis par l'admin, pas de suivi automatique (règle 12).
- Lien signé à chaque téléchargement, aucun lien `kits-private` dans le HTML (règle 1).
- Pas de page Galerie dédiée, univers et produits liés non ajoutés (règle 14).
