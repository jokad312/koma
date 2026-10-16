---
title: "Revue adversariale — PRD KOMA SHOP"
created: 2026-10-16
cible: prd.md, addendum.md (prd-KOMA SHOP-2026-10-16), confrontés à CLAUDE.md
posture: relecteur sceptique ; objectif = échouer en conception plutôt qu'en production
---

# Revue adversariale du PRD KOMA SHOP

## Verdict

**Non prêt pour l'architecture en l'état.** Le PRD est clair sur l'intention et solide sur plusieurs garde-fous (Polar jamais pour un produit physique, idempotence par Référence de transaction, interdiction de simuler). Mais :

1. il contredit `CLAUDE.md`, que tous les agents doivent traiter comme règle absolue, sans que `CLAUDE.md` ait été mis à jour ;
2. la machine d'états du paiement (tentatives, délais, repli, notifications tardives, remboursements) est sous-spécifiée alors que c'est là que se produisent les doubles débits ;
3. plusieurs dépendances bloquantes (couverture des agrégateurs, devise, remboursements, textes légaux, versements Polar vers la RDC) sont des questions ouvertes sans date ni plan B ;
4. la question des mineurs (consentement, photos, contrat, mobile money) n'est pas traitée ;
5. le périmètre du lancement est trop large pour une seule personne qui fabrique, livre jusqu'à Bukavu, organise des événements et rembourse à la main sur cinq prestataires.

Recommandation : résoudre les points **critiques** dans le PRD (et dans `CLAUDE.md`) avant `bmad-architecture`, puis réduire le périmètre de §6.1 (voir A-1).

**Décompte : 9 critiques, 17 hautes, 15 moyennes, 6 basses (47 constats).**

Format de chaque constat : sévérité · emplacement · constat · risque · résolution proposée dans le PRD. Aucune fonctionnalité nouvelle n'est proposée : seules des clarifications, des choix explicites ou des reports de phase.

---

## C. Critiques

### C-1 · PRD et CLAUDE.md se contredisent sur les règles de paiement
- **Emplacement :** PRD §0, §4.4 (préambule), §6.1 ; `CLAUDE.md` règles 9, 10, 11, 14.
- **Constat :** `CLAUDE.md` dit encore : « K-Pay encaisse tout panier qui contient au moins un produit physique… Au lancement, K-Pay encaisse aussi les paniers de kits » ; Polar « seulement quand la phase Polar est demandée » ; règle 11 : « un panier mixte part toujours chez K-Pay », avec un test automatique qui doit le prouver. Le PRD met Polar au lancement, ajoute PawaPay, MaishaPay et GeniusPay, et route un panier mixte payé en mobile money vers n'importe quel Agrégateur. Le §0 affirme que ces décisions « figurent aussi dans CLAUDE.md » : c'est faux pour la version actuelle, qui ne mentionne ni les quatre Agrégateurs, ni les Événements, ni le Blog, ni les Codes promo. Et la règle 14 interdit tout ce qui n'est pas demandé dans la phase en cours.
- **Risque :** un agent Dev qui respecte `CLAUDE.md` (« règles absolues ») refusera Polar et PawaPay, ou écrira le test de la règle 11 sur une règle fausse. À l'inverse, s'il suit le PRD, il viole une règle absolue sans validation tracée. Résultat : blocage ou dérive.
- **Résolution :** avant l'architecture, réécrire les règles 9 à 11 de `CLAUDE.md` (l'agent PM n'avait pas à le faire), en distinguant « carte » et « mobile money ». Reformuler la règle 11 en invariant testable : « un panier contenant un produit physique ne part jamais chez Polar ». Ajouter Événements, Pass, Blog, Codes promo et Relances au périmètre déclaré. Corriger la phrase du §0.

### C-2 · Le repli entre Agrégateurs peut produire un double débit
- **Emplacement :** FR-17, FR-18, FR-19, NFR-5, NFR-6.
- **Constat :** FR-17 déclenche le repli sur un « échec technique » sans le définir. En mobile money, un délai dépassé, une erreur HTTP 5xx ou une absence de réponse **ne veulent pas dire que le paiement a échoué** : le client a peut-être déjà validé sur son téléphone, et la notification arrive des minutes plus tard. « Le repli ne crée jamais un deuxième débit » est un résultat souhaité, pas une règle de conception. L'idempotence par Référence de transaction (FR-19) ne protège pas ici : deux Agrégateurs donnent **deux références différentes** pour la même Commande.
- **Risque :** le client est débité deux fois (Agrégateur A tardif + Agrégateur B). Il faut alors rembourser à la main, alors que Q-4 n'est pas résolue. Dans un marché où la confiance est l'argument principal, c'est le pire incident possible.
- **Résolution :** introduire dans le Glossaire une **Tentative de paiement** (Commande → n tentatives, chacune avec son Prestataire, sa référence et son état : `initiée`, `en attente de confirmation`, `réussie`, `échouée définitivement`, `inconnue`). Règles à écrire : (a) pas de repli tant qu'une tentative est `en attente` ou `inconnue`, sauf après une contre-vérification auprès du Prestataire qui confirme l'échec ; (b) liste fermée des codes d'échec, par Prestataire, qui autorisent le repli (à remplir avec Q-1/Q-2) ; (c) si deux tentatives réussissent pour une même Commande, la seconde est marquée « trop-perçu » et apparaît comme une tâche de remboursement dans le tableau de bord ; (d) un test automatique couvre le cas « A tardif + B réussi ».

### C-3 · Rien n'est dit sur la durée de vie d'une Commande `en attente` ni sur une notification qui arrive trop tard
- **Emplacement :** Glossaire « Statut de commande », FR-10, FR-13, FR-19, FR-20, FR-47.
- **Constat :** FR-13 crée une Commande `en attente` après avoir vérifié le stock, mais le stock ne diminue qu'au paiement (FR-10). Aucune durée d'expiration, aucune réservation. FR-20 affiche « échouée », un statut absent du Glossaire. On ne sait pas ce qui se passe quand une notification valide arrive pour une Commande dont : le dernier article a été vendu entre-temps, le Plafond de fabrication est atteint, le Code promo a atteint son plafond, l'Événement est passé, le prix a changé, ou le client a déjà payé une autre Commande identique.
- **Risque :** un article unique vendu deux fois, le Plafond de fabrication dépassé (SM-C1), un Pass vendu pour un événement terminé, ou un argent encaissé sans aucune règle qui dise quoi en faire.
- **Résolution :** ajouter au Glossaire les statuts `échouée` et `expirée`. Fixer une durée de validité de la Commande `en attente`, à régler dans l'admin. Choisir explicitement entre deux options : réserver le stock et le Plafond à la création de la Commande, ou accepter le risque de survente. Poser la règle : « une notification valide est **toujours** honorée (la Commande passe `payée`), même après expiration ; si elle n'est plus exécutable, une tâche “paiement à régulariser” apparaît pour l'Admin (rembourser ou fabriquer) ». Figer le prix, la réduction et le forfait dans la Commande au moment où elle est créée.

### C-4 · Devise et montant : le contrôle de FR-19 est impossible à spécifier
- **Emplacement :** §4.4 point 5, FR-19, FR-48, Q-3.
- **Constat :** FR-19 exige de vérifier le montant reçu. §4.4 dit que « la conversion en devise locale est faite par le Prestataire ». Si un Agrégateur débite en CDF, KES ou XAF, le montant de la notification ne peut pas être égal au montant en USD de la Commande. Rien n'est dit sur le taux à appliquer, la tolérance acceptée, ni sur qui paie les frais du Prestataire. La commission (FR-48) et le remboursement partiel d'un Pass (FR-38) se calculent sur un « montant payé » dont la devise n'est pas définie.
- **Risque :** soit chaque paiement converti est rejeté (la boutique ne vend rien), soit le développeur invente une tolérance, ce qui viole la règle 15.
- **Résolution :** Q-3 doit devenir bloquante pour FR-19, avec une réponse par Prestataire : devise débitée, et devise et montant présents dans la notification. Le PRD doit fixer ensuite : (a) la Commande est toujours créée en USD et transmise en USD au Prestataire, ou bien (b) le montant converti est figé avant la redirection et c'est lui qui est vérifié. Préciser aussi si les frais du Prestataire sont ajoutés au prix payé par le client (ce qui remet en cause le « prix identique partout ») ou retenus sur la part du marchand.

### C-5 · Le statut `remboursée` peut être posé sans que l'argent soit rendu
- **Emplacement :** FR-25, FR-26, FR-38, FR-48, Q-4 ; règle 13.
- **Constat :** FR-25 : « l'Admin valide, et la Commande passe `remboursée` ». Or le mécanisme de remboursement est inconnu pour les cinq Prestataires (Q-4). Le statut traduirait donc une décision, pas un fait. Rien n'est dit sur la retenue de frais quand le Pass a été payé avec un Code promo, ni sur le remboursement d'un Pass gratuit (FR-42).
- **Risque :** un statut qui ne reflète pas la réalité, ce que la règle 13 interdit. La commission d'affiliation est alors fausse, et le client reçoit l'email « remboursée » alors qu'il n'a rien reçu. Un litige en découle.
- **Résolution :** séparer `remboursement accordé` de `remboursée`. Le passage à `remboursée` exige une preuve : la réponse de l'API du Prestataire, ou une référence de remboursement manuel saisie par l'Admin (par exemple la référence d'un envoi mobile money), accompagnée de la date et du montant. Fixer dans quelle devise et par quel canal on rembourse quand l'API ne le permet pas. Préciser que les Pass gratuits ne sont pas remboursables. Rendre Q-4 bloquante pour FR-25 et FR-38.

### C-6 · Les mineurs ne sont pas traités : âge, consentement, photos, contrat
- **Emplacement :** §2.3 (UJ-4 « 19 ans »), FR-12, FR-33, FR-40, FR-42, FR-45, FR-32, FR-39, Q-5.
- **Constat :** la cible est jeune (lycée, étudiants) et le PRD ne fixe **aucun âge minimum**, ni pour le Compte, ni pour l'achat, ni pour les Relances, ni pour la publication d'une photo avec prénom et ville. Il n'existe aucune règle pour la photo d'un mineur dans la Galerie, pour les Mesures corporelles d'un mineur, pour un Pass au nom d'un mineur, ni pour l'opération « 10 pass gratuits » (un concours ouvert à des mineurs). Le mobile money est souvent au nom d'un parent.
- **Risque :** le droit à l'image et la protection des données des mineurs en RDC (Code du numérique, ordonnance-loi n° 23/010 de 2023, à faire confirmer par un juriste) et, pour les acheteurs de kits dans l'Union européenne, le RGPD (consentement des moins de 16 ans selon les États). Une photo d'adolescent publiée avec son prénom et sa ville pose aussi un problème de sécurité réel.
- **Résolution :** le PRD doit trancher : (a) un âge minimum pour créer un Compte (par exemple 18 ans, déclaré sur l'honneur), **ou** (b) un parcours mineur, avec l'interdiction de publier en Galerie la photo d'un mineur sans l'accord écrit d'un parent, l'interdiction des Relances aux mineurs et l'exclusion des mineurs de l'opération. À ajouter à Q-5, avec la mention « bloquant avant la première vente ».

### C-7 · Consentement à l'image donné pour d'autres personnes
- **Emplacement :** UJ-5, FR-33, FR-39.
- **Constat :** Divine « accepte la mention » sur la publication des photos pour elle-même, son aide et sa sœur. Ce sont des tiers, peut-être mineurs, qui ne consentent à rien. Une « mention » acceptée à l'achat n'est pas un consentement au sens où la Galerie (FR-40) l'exige. Les photos sont ensuite publiées sur un Google Drive ou un Google Photos public, et le retrait est fait à la main.
- **Risque :** on publie sans base légale l'image de personnes qui n'ont rien accepté. Le régime de la Galerie (accord explicite) et celui des Événements (mention) sont incohérents.
- **Résolution :** fixer un régime clair : information visible à l'entrée de l'Événement, plus un engagement de retrait dans un délai défini ; ou bien un consentement recueilli pour chaque titulaire de Pass (lien envoyé avec le Pass). Indiquer qui retire, dans quel délai, et si la Galerie d'événement est « publique » ou « accessible par lien ». À ajouter à Q-5.

### C-8 · Dépendances bloquantes sans plan B : couverture, documentation, textes légaux, domaine
- **Emplacement :** §6.1, §10 Q-1, Q-2, Q-5, Q-7, Q-10.
- **Constat :** Q-1 « bloque FR-16 en production ». Q-5 doit être fournie « avant la première vente ». Q-10 inclut la disponibilité de **komashop.com** et les premiers Kits filmés. Le §6.1 liste MaishaPay et GeniusPay « dès que leur documentation est fournie », donc dans une condition et sans échéance. Aucun critère de passage au lancement (*go / no-go*) n'est écrit.
- **Risque :** on lance avec un seul Agrégateur réellement branché, sans CGV ni mentions légales (avec RCCM, Id. Nat., NIF manquants), sur un domaine incertain. Ou bien le lancement glisse indéfiniment.
- **Résolution :** ajouter une section « Conditions de lancement » : liste minimale des Prestataires opérationnels (par exemple K-Pay + PawaPay, contrats signés et couverture saisie), textes légaux validés, domaine acquis, au moins N produits publiés. MaishaPay et GeniusPay passent explicitement en §6.3 tant que Q-2 n'est pas résolue.

### C-9 · Polar : versements au vendeur et acceptation du compte non vérifiés
- **Emplacement :** §4.4 point 3, FR-15, addendum « Documentation des prestataires ».
- **Constat :** l'addendum vérifie la politique d'usage de Polar (pas de produits physiques, billets soumis à examen). Il ne vérifie **ni** que Polar verse l'argent à un vendeur établi en RDC (les versements de Polar passent par un partenaire qui ne couvre qu'une liste limitée de pays, à confirmer), **ni** que Polar accepte des kits « inspirés de » franchises (Q-7 ne cite que K-Pay). Polar agit aussi comme marchand officiel : il encaisse les taxes, émet les factures à son nom et gère lui-même les remboursements et les contestations.
- **Risque :** Polar est développé puis inutilisable (aucun versement possible, ou compte refusé ou gelé). Ou bien un remboursement fait chez Polar n'est pas répercuté dans KOMA SHOP (le Kit reste ouvert).
- **Résolution :** ajouter une question Q-13 « Polar : versements possibles vers NATHANGROUP SARL (pays, banque), validation du compte avec ce catalogue », bloquante pour l'Adaptateur Polar. Étendre Q-7 à Polar. Ajouter une exigence : un remboursement ou une contestation reçus d'un Prestataire (notification) ferment l'accès au Kit et sont enregistrés.

---

## H. Hautes

### H-1 · Codes promo : « premier achat » contourné par des comptes multiples
- **Emplacement :** FR-12, FR-47, FR-48.
- **Constat :** le Compte se crée avec un simple code envoyé par email. Une même personne peut ouvrir un Compte par adresse et réutiliser le code à chaque fois. L'Affilié peut utiliser son propre code et toucher une commission sur ses achats. Rien n'est dit sur ce qui consomme le plafond (une Commande `en attente` ou seulement une Commande `payée`), ni sur les cas suivants : deux Commandes `en attente` du même Compte avec le même code, une Commande remboursée après le versement manuel de la commission, un pourcentage de 100 % (Commande à 0 USD, voir H-5).
- **Résolution :** définir « premier achat » (premier paiement validé du Compte, Pass compris ou non) et ce qui consomme le plafond (seulement le passage à `payée`, de façon atomique). Fixer un pourcentage maximal. Préciser si un Affilié peut utiliser son propre code. Dire si la commission d'une Commande remboursée après versement est reprise. Accepter et écrire le risque résiduel des comptes multiples, ou retenir le numéro de téléphone mobile money comme critère de « premier achat ».

### H-2 · Opération « 10 pass gratuits » : règles contradictoires et faciles à abuser
- **Emplacement :** UJ-2, FR-42, Glossaire « Réalisation », §6.2.
- **Constat :** UJ-2 parle des « 10 premiers comptes à le faire » (à envoyer), FR-42 des 10 premières Réalisations **validées**. Les deux ordres diffèrent. « L'Événement organisé » ne dit pas lequel. On ne sait pas si le Kit gratuit (§6.2) compte comme « Kit acheté », comment vérifier que la photo montre bien un costume fait avec le Kit (une photo prise sur Internet suffit à tricher), si l'offre est ouverte aux mineurs, si le Pass offert est cessible, ni ce qui arrive si l'Événement est annulé. Il n'existe aucun règlement (Q-5 le mentionne sans le rendre bloquant).
- **Résolution :** choisir un seul critère d'ordre. Lier l'opération à un Événement précis, saisi dans l'admin. Écrire « Kit payant uniquement » ou « Kit gratuit inclus ». Ajouter une limite d'un Pass offert par personne (Compte et numéro). Laisser l'Admin juge de l'authenticité de la photo (à écrire dans le règlement). Rendre le règlement bloquant avant d'ouvrir l'opération.

### H-3 · Pas de capacité maximale pour un Événement
- **Emplacement :** FR-33 (« Il n'y a pas de quota par Type de pass »), FR-52.
- **Constat :** il n'existe ni quota par Type de pass ni capacité totale. Un Pass Stand compte pour deux entrées et occupe un emplacement d'exposant.
- **Risque :** plus de Pass vendus que la salle n'en accueille (sécurité, assurance, autorisation administrative). Plus de Pass Stand vendus que d'emplacements disponibles, avec des remboursements à la chaîne.
- **Résolution :** confirmer explicitement avec Jonathan. Au minimum, une capacité totale par Événement (en personnes) et un nombre maximal de Pass Stand, réglés dans l'admin et vérifiés côté serveur au paiement (même logique que C-3).

### H-4 · QR partagé, Pass « nominatif » sans contrôle d'identité
- **Emplacement :** FR-34, FR-35, FR-36, UJ-5.
- **Constat :** l'acheteur transmet lui-même les Pass (une capture d'écran suffit). Le Scan affiche le nom, mais le PRD ne dit pas si le bénévole vérifie l'identité. Si ce n'est pas le cas, « nominatif » n'a aucun effet, et le premier qui présente le QR entre. Rien n'est dit sur la correction d'un nom mal saisi, sur la cession d'un Pass, ni sur le titulaire légitime qui arrive après une copie de son QR déjà scannée.
- **Résolution :** choisir : « nominatif = information seulement » (on accepte le risque de copie, le premier scan l'emporte) ou « contrôle d'identité à l'entrée » (à écrire dans les CGV et dans la consigne aux bénévoles). Préciser si l'acheteur peut modifier le nom d'un Pass avant l'Événement et jusqu'à quand.

### H-5 · Commandes et Pass à 0 USD : contradiction avec la règle 2
- **Emplacement :** Glossaire « Kit gratuit », §6.2, FR-42, FR-47 ; `CLAUDE.md` règle 2 ; FR-19, NFR-5.
- **Constat :** selon la règle 2, « seule la route serveur de notification de paiement passe une commande en `paid` ». Or un Kit gratuit, un Pass offert (FR-42) ou une Commande réduite à 0 USD par un code n'ont aucun Prestataire ni aucune notification.
- **Risque :** le développeur invente un faux statut `payée` (règle 13), ou envoie à un Prestataire un paiement à 0 USD que celui-ci refuse.
- **Résolution :** créer un chemin explicite « attribution gratuite » : une Commande ou un Pass à 0 USD, créé côté serveur par une règle vérifiée (produit à 0 USD en base, Réalisation validée par l'Admin), avec un statut distinct (par exemple `offerte`), jamais `payée`. Mettre à jour la règle 2 de `CLAUDE.md` en conséquence. Interdire un Code promo qui ramène un total payant à 0.

### H-6 · Le statut porté par la Commande ne convient pas à un Panier mixte
- **Emplacement :** Glossaire « Statut de commande », FR-19, FR-25, FR-26, UJ-3b.
- **Constat :** une Commande « 100 % numérique passe de `payée` à `livrée` », mais un Panier mixte (Kit + Cosplay) a un seul statut. Le Kit est ouvert tout de suite pendant que le Cosplay est `en fabrication`. FR-25 annule « une Commande de Cosplay » et rembourse tout, y compris le Kit déjà téléchargé et non remboursable. Le statut `expédiée` n'a pas de sens pour un retrait à Goma, et aucun statut « prêt à retirer » n'existe.
- **Résolution :** décider si le statut est porté par la Commande ou par chaque ligne (ou si l'on scinde la Commande au paiement). Pour l'annulation d'une Commande mixte, écrire « on rembourse la ligne physique, le Kit reste acquis ». Ajouter un statut, ou un libellé, pour le retrait. Préciser si un Accessoire peut être annulé (FR-25 ne vise que le Cosplay).

### H-7 · Plafond de fabrication : ce qu'on compte n'est pas défini
- **Emplacement :** Glossaire, FR-10, FR-51, SM-C1.
- **Constat :** « nombre maximal de Commandes de Produits physiques en cours de fabrication ». Le PRD ne précise pas si l'on compte les Commandes ou les articles (une Commande de 3 Cosplays), si les Commandes `payée` en attente de validation des Mesures entrent dans le compte, ni si les Commandes `en attente` y entrent. Il ne dit pas non plus si un Accessoire et un Cosplay pèsent pareil, ni quelle valeur s'applique si l'admin n'a rien saisi.
- **Risque :** le seul garde-fou contre la surcharge de Jonathan est mal implémenté, et SM-C1 explose.
- **Résolution :** « Plafond = nombre d'**articles** physiques dont la Commande est `payée` ou `en fabrication` (et non encore `expédiée` ou `livrée`) ». Vérification atomique au paiement. Sans valeur saisie, la Fabrication sur commande est fermée.

### H-8 · Le stock des variantes n'est pas modélisé
- **Emplacement :** FR-6, FR-10, FR-50.
- **Constat :** il existe un stock par Produit mais des tailles de XS à XXL, et un « Délai de fabrication par produit ou variante ». On ne sait pas si un XS en stock et un XL sur commande sont possibles sur la même fiche.
- **Résolution :** écrire que le stock et le délai sont portés par la variante (taille), que le Sur-mesure est toujours une Fabrication sur commande, et que l'Accessoire sans taille n'a qu'une seule variante.

### H-9 · Surcharge opérationnelle d'une personne seule
- **Emplacement :** §2.1 (« vendre sans y passer ses nuits »), §4.5, FR-23, FR-25, FR-32, FR-38, FR-39, FR-41, FR-42, FR-45, FR-48, §6.1, règle 12.
- **Constat :** au lancement, Jonathan doit à lui seul : fabriquer ; vérifier les Mesures par WhatsApp ; livrer à Goma **et à Bukavu** (de l'autre côté du lac) ; tenir le retrait ; valider les annulations, les remplacements et les photos ; rembourser à la main sur jusqu'à cinq Prestataires (Q-4) ; rapprocher cinq tableaux de bord ; payer les commissions ; envoyer les alertes WhatsApp à la main ; organiser un Événement avec scan ; écrire le Blog en deux langues ; nourrir des Relances tous les 2 à 3 jours. Le rôle Assistant est repoussé à « plus tard ».
- **Risque :** retards (SM-C1), réponses WhatsApp lentes, erreurs de remboursement. C'est l'échec de la promesse même du produit.
- **Résolution :** voir A-1. Le PRD doit aussi dire qui assure la remise à Bukavu (Jonathan en personne ? un tiers ? règle 12) et ce qui se passe en cas d'absence du client (deuxième tentative, frais, retour à l'atelier).

### H-10 · Relances : jusqu'à 45 emails, contenu et consentement flous
- **Emplacement :** FR-45, UJ-2, Glossaire « Relance ».
- **Constat :** tous les 2 à 3 jours pendant 90 jours, cela fait 30 à 45 emails. Qui en écrit le contenu (« chapitre suivant, nouveautés ») ? Est-il généré automatiquement ? Le moment et la forme du consentement ne sont pas précisés (une case non cochée par défaut à la création du Compte ?). On ne sait pas si un nouvel achat relance le compteur de 90 jours. Le cas des mineurs n'est pas traité (C-6).
- **Risque :** les emails partent en indésirables. Comme le **code de connexion** passe par le même domaine d'envoi (FR-12), une mauvaise réputation des Relances bloque **la connexion et donc le paiement**.
- **Résolution :** fixer le consentement (case distincte, non cochée), la séquence de contenus (écrite par Jonathan, en nombre limité), et si un nouvel achat relance le compteur. Séparer, côté exigence, la réputation d'envoi des emails transactionnels et celle des emails commerciaux (par exemple un sous-domaine distinct, choix laissé à l'architecte).

### H-11 · Partage des Fichiers de kit et de la Vidéo : risque accepté sans le dire
- **Emplacement :** FR-28, FR-29, NFR-4, addendum (« limite de 10 téléchargements remplacée »).
- **Constat :** des téléchargements illimités de PDF, SVG et STL, sans aucune mention de l'usage personnel. Un fichier téléchargé une fois circule librement sur WhatsApp. Un lien signé « de courte durée » se partage pendant sa durée de validité. La vidéo peut être enregistrée depuis l'écran.
- **Risque :** les attentes sont mal calibrées : le développeur pourrait ajouter de lui-même un filigrane ou une protection (règle 14) ; ou Jonathan découvre le piratage sans l'avoir accepté.
- **Résolution :** écrire dans le PRD que « le partage des fichiers téléchargés n'est pas empêché techniquement ; la licence d'usage personnel figure dans les CGV ». Fixer la durée de validité maximale d'un lien signé. Dire si un Compte qui abuse peut être suspendu par l'Admin.

### H-12 · « Accès à vie » sans définition
- **Emplacement :** Glossaire « Kit », FR-30.
- **Constat :** à vie de quoi : du Compte, du Produit, de la société ? Rien n'est dit sur le Kit retiré de la vente, sur la Vidéo remplacée, sur un Compte supprimé à la demande du client (droit à l'effacement), ni sur la fermeture du service. « Mises à jour comprises » peut faire naître une obligation de mettre à jour.
- **Résolution :** définir l'accès à vie comme « tant que le service existe et que le Compte est actif ». Préciser qu'un Kit dépublié reste accessible à ceux qui l'ont acheté. Dire que les mises à jour sont gratuites quand elles existent, sans obligation d'en produire. Renvoyer aux CGV.

### H-13 · Non-remboursement des Kits face aux acheteurs internationaux et aux contestations
- **Emplacement :** FR-13, FR-26, UJ-3, §4.4 point 3.
- **Constat :** « Les Kits ne sont jamais remboursables ». Pour un acheteur de l'Union européenne, la renonciation au droit de rétractation sur un contenu numérique demande un consentement exprès **et** la reconnaissance de la perte de ce droit avant l'accès. FR-13 s'en approche, mais la formulation doit être validée. Rien n'est prévu si le Kit est défectueux (fichier corrompu, vidéo illisible). Une contestation bancaire sur la carte (K-Pay ou Polar) passe outre la règle.
- **Résolution :** ajouter la formulation exacte à Q-5. Préciser « non remboursable sauf défaut non corrigé ». Dire ce qui arrive à l'accès en cas de contestation ou de remboursement côté Prestataire (voir C-9).

### H-14 · Noms de franchise : contradiction avec le filtre « univers »
- **Emplacement :** FR-5 (filtre « univers »), FR-4, FR-56, §8, Q-7 ; règle 6.
- **Constat :** le PRD dit « aucun nom de franchise sur tout le site », mais le catalogue se filtre par « univers ». Les titres de produits, les mots-clés SEO et les noms de personnages ne sont pas encadrés. Un « univers » appelé par le nom de l'anime **est** un nom de franchise. Un univers renommé de façon détournée (« samouraïs et démons ») ne sert à rien pour le SEO.
- **Résolution :** définir « univers » comme une liste de thèmes génériques saisie dans l'admin, sans nom de franchise ni de personnage. Écrire la même règle pour les titres, les descriptions, le texte alternatif et le JSON-LD. Garder Q-7 bloquante avant la première vente.

### H-15 · Scan hors ligne : verrou, changement d'appareil et données périmées non spécifiés
- **Emplacement :** FR-35, FR-36, FR-37, FR-38, addendum « Scan hors ligne ».
- **Constat :** comment le serveur sait-il qu'un appareil « scanne hors ligne » ? Il faut un verrou explicite, pris en ligne. Si cet appareil tombe en panne, se décharge ou est volé, rien ne permet de libérer le verrou. Les Pass vendus, annulés ou remboursés après le chargement de la liste ne sont pas pris en compte. Le Pass Stand n'a pas de traitement particulier, et la fin des ventes de Pass n'est pas fixée (ventes jusqu'à l'ouverture des portes ?).
- **Risque :** l'entrée est bloquée le jour J, ou un Pass annulé et remboursé laisse quand même entrer quelqu'un.
- **Résolution :** décrire le verrou (pris en ligne par l'Admin, ou par l'Accès bénévole désigné), sa libération forcée par l'Admin (en acceptant le risque de doublon), une heure de fin des ventes et des annulations qui précède le chargement de la liste, et la règle de résolution des conflits au moment de la synchronisation.

### H-16 · Annulation ou report d'un Événement par KOMA SHOP
- **Emplacement :** FR-38, FR-52, FR-42.
- **Constat :** seule l'annulation par le client est prévue. Rien n'est dit si Jonathan annule ou reporte (météo, sécurité à Goma, salle indisponible) : remboursement total sans frais ? Pass reportés ? Que deviennent les Pass offerts ?
- **Résolution :** fixer la règle (remboursement à 100 %, ou report au choix du client) et le statut correspondant du Pass et de l'Événement. À ajouter dans les CGV (Q-5).

### H-17 · Le compte Admin unique a tous les pouvoirs
- **Emplacement :** FR-21, FR-49 à FR-53, NFR-9.
- **Constat :** l'Admin, utilisé aussi sur téléphone, peut changer l'Ordre de priorité, la Couverture, l'activation des Prestataires, valider des remboursements et créer des accès. Il se connecte comme un client (code par email). Une boîte mail compromise, ou un téléphone perdu, livre la boutique entière.
- **Résolution :** exiger au PRD une authentification renforcée pour le rôle Admin (le moyen est laissé à l'architecte), une session courte, et que tout changement de Prestataire ou de Couverture soit journalisé (NFR-9) et signalé par email à l'Admin.

---

## M. Moyennes

### M-1 · Repli et panne de la carte
- **Emplacement :** §4.4 points 2 et 4, FR-16, NFR-6.
- **Constat :** la carte pour les Produits physiques et les Pass passe uniquement par K-Pay. NFR-6 ne couvre que le mobile money. Si K-Pay tombe, plus personne ne paie par carte, sauf les kits via Polar.
- **Résolution :** l'écrire comme risque accepté au lancement. FR-16 doit afficher un message dédié quand aucun moyen par carte n'est actif.

### M-2 · Le pays mobile money ne correspond pas à la zone de remise
- **Emplacement :** FR-13, FR-16, §2.2.
- **Constat :** pour un panier physique (remise à Goma ou Bukavu), le client peut choisir un pays et un opérateur étrangers (un proche qui paie depuis le Kenya). Faut-il l'autoriser ?
- **Résolution :** l'écrire explicitement (autorisé, ou mobile money restreint à la RDC pour les Produits physiques).

### M-3 · Couverture saisie à la main, erreur de routage
- **Emplacement :** FR-21, Q-1.
- **Constat :** l'Admin saisit les couples pays-opérateur. Une erreur envoie des paiements vers un Agrégateur sans contrat pour ce couple.
- **Résolution :** les échecs dus à la Couverture doivent apparaître dans le tableau de bord (SM-C2), et un Agrégateur ne doit être activé que si son contrat est déclaré dans l'admin.

### M-4 · Rapprochement des paiements
- **Emplacement :** FR-19, FR-21, FR-49.
- **Constat :** rien ne prévoit de comparer les Commandes `payée` aux relevés des Prestataires. Une notification perdue, ou un webhook mal configuré, laisse une Commande `en attente` alors que l'argent a été encaissé.
- **Résolution :** exiger une contre-vérification serveur des Commandes `en attente` au-delà d'un délai (interroger le Prestataire), ce qui reste conforme à la règle 2. L'Admin doit aussi voir les Commandes `en attente` anciennes.

### M-5 · Prix modifié pendant une Commande `en attente`
- **Emplacement :** FR-13, FR-50.
- **Constat :** aucune règle ne fixe le prix retenu.
- **Résolution :** le prix est figé à la création de la Commande (voir C-3).

### M-6 · Délai de 48 h : fuseau horaire et point de départ
- **Emplacement :** FR-26, FR-38.
- **Constat :** les 48 h comptent-elles à partir d'une date saisie à la main par l'Admin (`livrée`) ? Dans quel fuseau ? Si l'Admin passe la Commande à `livrée` avec un jour de retard, le client perd son délai.
- **Résolution :** fuseau de Goma (UTC+2). Point de départ : la date de remise réelle saisie par l'Admin. Délai de 48 h avant l'heure de **début** de l'Événement.

### M-7 · Réclamation sur un Cosplay Sur-mesure
- **Emplacement :** FR-26.
- **Constat :** seul le « Cosplay en taille standard » est mentionné. Un Sur-mesure abîmé ou mal fait ne peut-il pas faire l'objet d'une réclamation ?
- **Résolution :** l'écrire (réclamation possible pour un défaut, pas pour une Mesure fausse fournie par le client) et l'aligner sur Q-6.

### M-8 · Langue des Articles et FR-55
- **Emplacement :** FR-43, FR-55, FR-56.
- **Constat :** FR-55 : « toutes les pages publiques existent en FR et EN ». FR-43 : la version anglaise est facultative.
- **Résolution :** préciser ce qu'affiche /en pour un Article sans traduction (renvoi vers /fr, page absente du plan du site /en, balises hreflang).

### M-9 · « Ouvrir dans Chrome » sur iPhone
- **Emplacement :** FR-3, UJ-4.
- **Constat :** sur iOS, Chrome n'est pas le navigateur par défaut, et aucun site ne peut forcer la sortie du navigateur intégré.
- **Résolution :** formuler « ouvrir dans le navigateur du téléphone », avec une consigne manuelle (menu ⋯), sans promettre une redirection automatique.

### M-10 · Performance du héros : objectifs en tension
- **Emplacement :** FR-1, NFR-2, SM-C6.
- **Constat :** une vidéo plein écran, un affichage en moins de 2,5 s en 4G dans Instagram **et** Lighthouse ≥ 90 : ces objectifs sont difficiles à tenir ensemble. Le « téléphone moyen » et l'outil de mesure ne sont pas définis.
- **Résolution :** définir l'appareil de référence et la mesure (par exemple LCP mesuré sur le terrain, au 75ᵉ percentile). Écrire que la photo est affichée d'abord et que la vidéo vient ensuite.

### M-11 · Sécurité du code de connexion par email
- **Emplacement :** FR-12.
- **Constat :** un code à 6 chiffres sans limite de tentatives ni durée de validité est vulnérable aux essais en série. La livraison des emails vers les messageries africaines n'est pas garantie.
- **Résolution :** fixer la durée de validité, le nombre maximal d'essais et le délai avant de pouvoir redemander un code. Prévoir un message clair si l'email n'arrive pas (renvoyer le code, contact WhatsApp).

### M-12 · Données personnelles hors du site : alertes WhatsApp et Mesures
- **Emplacement :** FR-32, FR-8, FR-23.
- **Constat :** la liste des numéros WhatsApp est exportée sur le téléphone de Jonathan. Les Mesures corporelles sont des données personnelles. Rien n'est dit sur leur durée de conservation, ni sur la suppression d'un Compte.
- **Résolution :** ajouter à Q-5 une politique de conservation (Mesures, numéros, photos refusées) et le droit à l'effacement. Préciser si l'export WhatsApp doit être supprimé après l'envoi.

### M-13 · Mesure d'audience et consentement
- **Emplacement :** FR-54.
- **Constat :** « de préférence sans cookies » laisse un choix ouvert qui conditionne la présence d'une bannière de consentement (UX, performance).
- **Résolution :** trancher dans le PRD : mesure sans cookies et sans données personnelles, donc pas de bannière ; ou bien bannière obligatoire.

### M-14 · TVA et fiscalité des kits vendus à l'étranger hors Polar
- **Emplacement :** §4.4 points 1 et 3, UJ-2.
- **Constat :** un Kit payé en mobile money ou par carte via K-Pay par un acheteur étranger peut créer des obligations fiscales (TVA sur les services numériques). Polar, comme marchand officiel, s'en charge ; K-Pay non.
- **Résolution :** ajouter la question au juriste (Q-5) et, le cas échéant, restreindre les pays proposés en mobile money pour les Kits.

### M-15 · Accès bénévole : suppression et traçabilité
- **Emplacement :** FR-37, NFR-9.
- **Constat :** l'accès est « supprimé automatiquement », mais NFR-9 exige de garder l'auteur de chaque Scan. Un Événement de deux jours, ou qui finit après minuit, sort de « valable le jour de l'Événement ».
- **Résolution :** l'accès est désactivé, mais son identifiant est conservé dans le journal. La validité suit la plage de dates et d'heures de l'Événement, et non le « jour ».

---

## B. Basses

### B-1 · Délai de remise à Bukavu
- **Emplacement :** §4.5 (« un jour au plus ») ; `CLAUDE.md` (« moins d'un jour »).
- **Résolution :** harmoniser la formulation et mettre `CLAUDE.md` à jour.

### B-2 · Statut `échouée` employé sans définition
- **Emplacement :** FR-20, Glossaire.
- **Résolution :** l'ajouter au Glossaire (voir C-3).

### B-3 · Glossaire « Prestataire »
- **Emplacement :** Glossaire.
- **Constat :** la définition (« Agrégateur ou Polar ») oublie que K-Pay est aussi le prestataire de la carte, et elle cite des agrégateurs non branchés.
- **Résolution :** distinguer, pour chaque Prestataire, les moyens de paiement (mobile money, carte) et leur état (branché au lancement, ou en attente).

### B-4 · Fusion du Panier
- **Emplacement :** FR-11.
- **Constat :** les règles de fusion ne sont pas définies quand le Panier invité contient un Kit déjà possédé, ou en double avec le Panier du Compte.
- **Résolution :** ne garder qu'un exemplaire, retirer le Kit déjà possédé et en informer le client.

### B-5 · Ordre d'affichage des moyens de paiement
- **Emplacement :** Q-11.
- **Constat :** cette question n'est pas bloquante, mais elle conditionne l'UX.
- **Résolution :** la trancher avant `bmad-ux`.

### B-6 · Repère « 20 ventes » et indicateurs sans valeur de départ
- **Emplacement :** §7.
- **Constat :** c'est correct au regard de la règle 5, mais SM-C1 (« livraisons en retard ») suppose que la date promise est enregistrée dans chaque Commande.
- **Résolution :** l'écrire dans FR-14 et FR-19 : le délai total annoncé est figé dans la Commande.

---

## A. Recommandation de périmètre (lancement)

### A-1 · Périmètre §6.1 trop large pour un lancement à une personne
- **Sévérité :** haute (comptée dans les hautes ci-dessus avec H-9, non recomptée).
- **Emplacement :** §6.1, §6.3.
- **Constat :** le lancement cumule cinq Prestataires, une boutique physique et numérique bilingue, la Bibliothèque vidéo, les Événements avec scan hors ligne, l'Accès bénévole, la Galerie, une opération de concours, le Blog, les Relances, les Codes promo avec commission, le tableau de bord et ses graphiques, et la mesure d'audience. Chaque bloc a ses propres cas limites (voir ci-dessus).
- **Résolution (sans ajout de fonctionnalité, seulement un report de phase à décider par Jonathan) :** envisager un lancement en deux temps. **Lancement :** catalogue, Panier, Compte, paiement K-Pay et PawaPay (seuls les Prestataires dont le contrat et la documentation sont en main), Polar seulement si C-9 est levé, remise manuelle, Bibliothèque, Galerie, emails transactionnels, FR/EN, SEO. **Avant le premier Événement :** Événements, Pass, Scan hors ligne, Accès bénévole, opération « 10 pass gratuits ». **Plus tard :** Relances, Codes promo, MaishaPay et GeniusPay. Le PRD doit au minimum lier les Événements à la date du premier Événement réel plutôt qu'à la date de lancement.

---

## Questions à ajouter ou à rendre bloquantes en §10

| Question | Objet | Bloque |
|---|---|---|
| Q-3 (rendre bloquante) | Devise débitée et contenu des notifications, par Prestataire | FR-19 |
| Q-4 (rendre bloquante) | Remboursement par API, ou procédure manuelle et preuve | FR-25, FR-38 |
| Q-5 (compléter) | Âge minimum ou parcours mineur ; consentement à l'image des tiers ; règlement de l'opération ; rétractation pour les contenus numériques ; conservation des données ; TVA à l'international | Première vente |
| Q-7 (étendre) | Acceptation du catalogue par Polar et par chaque Agrégateur | Adaptateurs |
| Q-13 (nouvelle) | Versements Polar possibles vers NATHANGROUP SARL (RDC) | Adaptateur Polar |
| Q-14 (nouvelle) | Codes d'échec autorisant le repli, par Agrégateur | FR-17 |
| Q-15 (nouvelle) | Capacité de la salle et nombre d'emplacements de stand par Événement | FR-33 |
| Q-16 (nouvelle) | Qui remet à Bukavu, et que faire si le client est absent | §4.5 |
