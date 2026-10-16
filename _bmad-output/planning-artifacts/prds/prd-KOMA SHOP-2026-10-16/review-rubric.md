# Revue qualité du PRD — KOMA SHOP

## Verdict global
Le PRD tient bien sur l'essentiel. La thèse est nette (« la fierté de devenir son personnage », deux options sur la même fiche). Le glossaire est sérieux, les parcours sont incarnés et chacun est lié à des indicateurs avec leurs contre-indicateurs. Les règles absolues (paiement, kits privés, honnêteté) sont traduites en exigences vérifiables. Trois points le fragilisent pour un lancement public réel :
- un conflit non résolu avec `CLAUDE.md` sur le rôle de Polar et de K-Pay au lancement ;
- un périmètre de lancement très large pour un créateur seul, sans seuil minimal de mise en ligne ;
- plusieurs FR critiques (repli de paiement, scan hors ligne, stock, Pass contre Commande, Kit gratuit) dont le « fini » reste ambigu, alors que le découpage en stories en dépendra directement.

## Décision — adequate
Les décisions sont énoncées comme des décisions, pas comme des « considérations ». Les exemples sont nombreux :
- §4.4 points 1 à 5 ;
- FR-16, qui donne une table de routage explicite ;
- FR-36 « un seul appareil désigné » ;
- §2.2, qui nomme les non-utilisateurs.

L'addendum documente honnêtement les alternatives écartées : Polar pour tout, présenter les billets comme des « pass », plusieurs appareils hors ligne. Les questions ouvertes (§10) sont de vraies questions, et Q-1 et Q-2 indiquent ce qu'elles bloquent.

En revanche, le document affirme être aligné avec `CLAUDE.md` alors qu'il ne l'est pas. Il ne dit pas non plus ce qu'il faut au minimum pour ouvrir la boutique. Enfin, le coût du choix à quatre Agrégateurs plus Polar n'est jamais mis en balance avec le bénéfice de résilience.

### Constats
- **[critical]** Contradiction avec `CLAUDE.md` sur le paiement (§0, §4.4 description, §6.1). Le PRD dit que les décisions du 2026-10-16 « figurent aussi dans `CLAUDE.md` » et que §4.4 « remplace les règles 9 à 11 d'origine ». Or `CLAUDE.md` dit toujours :
  - « Au lancement, K-Pay encaisse aussi les paniers de kits » ;
  - « Polar sert UNIQUEMENT [...] quand la phase Polar est demandée » ;
  - « paiement K-Pay » dans la Stack, sans PawaPay, MaishaPay ni GeniusPay.

  Le PRD met Polar et quatre Agrégateurs au lancement. `CLAUDE.md` interdit aux agents BMad de contredire les règles 1 à 15 « sans validation explicite de Jonathan ». Les agents Architecte et Dev recevront donc deux consignes opposées. *Correction :* mettre à jour `CLAUDE.md` (règles 9 à 11, Stack) avec la décision du 2026-10-16, ou retirer du PRD l'affirmation d'alignement et revenir à K-Pay seul au lancement.
- **[high]** Aucun seuil minimal de lancement pour le paiement (§6.1, §10 Q-1 et Q-2). §6.1 lance « MaishaPay et GeniusPay (les deux derniers dès que leur documentation est fournie) ». Q-1 « bloque FR-16 en production ». Rien ne dit si la boutique peut ouvrir avec PawaPay et K-Pay seuls, ni quelle Couverture minimale (au moins RDC + M-Pesa, Airtel Money et Orange Money ?) est exigée le jour J. *Correction :* écrire une condition de mise en ligne explicite, par exemple « au moins un Agrégateur actif couvre les opérateurs RDC X, Y, Z, et K-Pay carte est actif », et classer chaque Q comme bloquante ou non pour le lancement.
- **[medium]** Arbitrage multi-agrégateurs non chiffré (§1, §4.4 point 1). Le bénéfice est nommé (« qu'une panne n'arrête pas les ventes »). Le coût ne l'est pas : cinq Adaptateurs, cinq contrats, rapprochement des paiements par Prestataire, remboursements manuels multipliés (Q-4), tout cela pour un créateur seul. *Correction :* ajouter une ligne « ce que l'on accepte en échange », ou phaser (deux Agrégateurs au lancement, les autres en secours).
- **[medium]** Questions ouvertes sans statut de blocage (§10). Seules Q-1, Q-2 et Q-5 disent ce qu'elles bloquent. Or Q-4 (remboursement par API) conditionne FR-25 et FR-38. Q-3 (devise débitée) conditionne FR-14 et FR-19 (« montant compris »). Q-7 (PI et acceptation par K-Pay) peut bloquer le lancement entier. *Correction :* ajouter à chaque Q « Bloque : … / avant : lancement | +4 semaines ».

## Substance plutôt que façade — strong
La Vision est propre au produit. Elle s'appuie sur des chiffres (« 45 à 80 USD, 45 à 50 jours ») et sur une géographie (Goma, Bukavu, de l'autre côté du lac). Elle ne pourrait pas servir à un autre PRD. Les personas (Grâce, Patrick, Amina, Kevin, Divine, Jonathan) pilotent tous des décisions concrètes :
- Grâce : sur-mesure et forfait Bukavu ;
- Patrick : code par email, promo, 3G ;
- Amina : avertissement de zone et Polar ;
- Kevin : navigateur intégré ;
- Divine : Pass Stand à deux noms.

Il n'y a pas de différenciation de façade. La plupart des NFR ont des seuils. Il reste quelques adjectifs.

### Constats
- **[medium]** NFR-3 « contraste suffisant » (§5). C'est un adjectif, pas une borne. Il reprend la règle 7 sans la rendre vérifiable. *Correction :* « WCAG 2.2 AA : 4,5:1 pour le texte courant, 3:1 pour le grand texte et les composants ; focus visible ».
- **[low]** NFR-2 « Core Web Vitals au vert » (§5). C'est acceptable, mais ni l'outil ni le contexte de mesure ne sont précisés (terrain ou labo, quel appareil). *Correction :* fixer LCP ≤ 2,5 s, INP ≤ 200 ms et CLS ≤ 0,1 au 75ᵉ centile mobile, ou en labo sur un profil d'appareil nommé.

## Cohérence stratégique — adequate
La thèse est claire et le découpage en découle : double option Cosplay / Kit lié, Galerie comme moteur de fierté, Événements comme communauté réelle, paiement adapté au mobile money. Les indicateurs de succès (§7) valident la thèse : clics sur le héros, partages, Réalisations, passage du Kit gratuit au Kit payant. Leurs contre-indicateurs sont bien choisis et rattachés à une tension précise (SM-C1 contre SM-1, SM-C7 contre le Compte obligatoire). Le refus de fixer des objectifs avant d'avoir des données, avec une revue à 4 semaines, est honnête.

Le point faible est la logique du périmètre. §6.1 met presque tout au lancement : Événements, Scan hors ligne, Accès bénévole, Blog, Codes promo, Relances, opération « 10 pass gratuits », quatre Agrégateurs et Polar. Seuls le Kit gratuit et le rôle Assistant sont reportés. Pour un créateur seul, le PRD ne dit pas quel type de MVP il vise ni ce qui serait sacrifié en premier si la date glissait.

### Constats
- **[high]** Lancement sans ordre de priorité interne (§6.1). §2.1 JTBD Jonathan dit « vendre sans y passer ses nuits », mais le lancement additionne neuf blocs fonctionnels sans hiérarchie. Les Événements et le Scan hors ligne n'ont de valeur que lorsqu'un Événement est daté, ce que le PRD ne fixe pas. *Correction :* classer les blocs de §6.1 en « indispensable à la première vente » (vitrine, fiches, Panier, paiement, Bibliothèque, suivi manuel, emails transactionnels) et « indispensable avant le premier Événement » (Pass, Scan, Accès bénévole). Dire lequel glisse en premier.
- **[low]** SM-1 « Valide §4.2 à §4.7 » (§7). Un indicateur d'activité couvre six sections. Ce n'est pas faux, mais il ne permet pas de savoir ce qui marche. *Correction :* séparer les ventes de Cosplays et d'Accessoires, de Kits et de Pass, et rattacher chaque sous-indicateur à sa section.

## Clarté du « fini » — thin
Beaucoup de FR sont bien bornées : FR-8, FR-10, FR-16, FR-19, FR-20, FR-38 et FR-50 (refus de publication) se transforment presque directement en critères d'acceptation. Mais plusieurs FR à haut risque laissent l'ingénieur deviner le comportement exact, souvent sur des cas limites d'argent ou d'entrée à un événement. C'est sur cette dimension que le découpage en stories s'appuiera le plus.

### Constats
- **[high]** Double débit possible lors du repli entre Agrégateurs (FR-17, FR-19). FR-17 promet « Le repli ne crée jamais un deuxième débit pour la même Commande ». FR-19 ne protège que contre la réutilisation d'une même Référence de transaction. Scénario non traité : l'Agrégateur A expire (échec technique apparent), le client paie via B, puis A envoie une Notification de succès tardive avec une autre Référence. Résultat : deux encaissements réels pour une Commande. *Correction :* définir l'état d'une tentative (une Commande a plusieurs tentatives, une seule peut aboutir), ce que fait le système quand une deuxième Notification valide arrive (Commande déjà `payée` → tâche de remboursement pour l'Admin), et le test automatique correspondant dans FR-18.
- **[high]** Le Scan hors ligne n'est pas vérifiable tel qu'écrit (FR-36). « Tant qu'un appareil scanne hors ligne, aucun autre appareil ne peut scanner ». Un serveur ne peut pas savoir qu'un appareil est hors ligne : il faut un verrou pris en ligne avant la coupure. Le PRD ne dit pas comment un appareil devient « désigné », comment le verrou est pris et libéré, ni ce qui se passe s'il n'est jamais resynchronisé. *Correction :* décrire une bascule explicite (« Passer en mode hors ligne » en ligne → verrou serveur → les autres appareils voient « Scan verrouillé par X » → déverrouillage à la synchronisation ou par l'Admin).
- **[high]** Statut juridique et technique flou du Pass face à la Commande (FR-19, FR-33, FR-47, Glossaire « Commande », « Statut de commande »). FR-19 déclenche « émission des Pass » au passage d'une Commande en `payée`. Le Panier « ne contient jamais de Pass », et le cycle `en fabrication → expédiée → livrée` n'a pas de sens pour un Pass. FR-47 applique le Code promo « au premier achat payé du Compte » sur « Produits et Pass ». Un achat de Pass compte-t-il comme premier achat ? Un Pass a-t-il ses propres statuts (`valide`, `scanné`, `annulé`) ? *Correction :* ajouter au glossaire « Achat de pass » (ou dire que c'est une Commande d'un type distinct) avec ses statuts, et préciser son effet sur la règle du premier achat.
- **[high]** Kit gratuit et Pass offert contre la règle « seule la Notification passe en `payée` » (§6.2, FR-42, NFR-5). Un Kit à 0 USD ne passe par aucun Prestataire, donc aucune Notification de paiement n'arrive. Sous NFR-5, il ne peut jamais s'ouvrir dans la Bibliothèque. FR-42 émet un Pass gratuit « comme un Pass normal » sans dire quel chemin le crée. Aucune FR ne décrit l'obtention du Kit gratuit, alors que FR-54 mesure « Kit gratuit récupéré ». *Correction :* ajouter une FR « Obtenir le Kit gratuit » (Compte requis, accès accordé côté serveur sans Prestataire, une seule fois par Compte). Ajouter aussi une exception explicite et tracée (NFR-9) à NFR-5 pour les accès gratuits accordés par le serveur ou par l'Admin.
- **[medium]** Course entre stock et Plafond de fabrication (FR-10, FR-13). Le stock « diminue à chaque Commande payée ». FR-13 vérifie le stock à la création de la Commande `en attente`. Deux clients peuvent donc payer le dernier article. Le Plafond compte les Commandes « en cours de fabrication » : on ne sait pas si les Commandes `payée` pas encore `en fabrication` sont incluses. Si elles ne le sont pas, le plafond est dépassé, ce que SM-C1 cherche justement à éviter. *Correction :* décider entre une réservation à la création (avec une durée) et une vérification à la Notification avec annulation et remboursement. Définir le Plafond comme « Commandes `payée` + `en fabrication` de Produits physiques en Fabrication sur commande ».
- **[medium]** Annulation : périmètre et statut incohérents (FR-25, Glossaire « Statut de commande »).
  - Seule la Commande « de Cosplay » est annulable. Rien n'est dit pour un Accessoire en Fabrication sur commande, ni pour un Panier mixte Cosplay + Kit, où le Kit est non remboursable et déjà ouvert.
  - La Commande passe directement `remboursée` alors que le mécanisme est inconnu (Q-4) et que le statut `annulée` existe sans usage défini.

  *Correction :* étendre FR-25 aux Produits physiques en Fabrication sur commande. Définir le remboursement partiel d'un Panier mixte. Passer par `annulée` (validée) puis `remboursée` (remboursement confirmé par l'Admin).
- **[medium]** FR-37 et UJ-6 se contredisent sur la validité de l'Accès bénévole. UJ-6 : « La veille de l'événement, il crée l'accès d'une journée ». FR-37 : « valable le jour de l'Événement uniquement ». FR-36 exige de charger la liste des Pass « à l'avance », sans dire quand ni par qui. Le cas d'un Événement sur plusieurs jours n'est pas traité, ni le fuseau horaire. *Correction :* « valable de [heure] la veille jusqu'à la fin de l'Événement, heure de Goma » et préciser qui précharge la liste.
- **[medium]** FR-42 : quel Événement, et premiers à envoyer ou premiers validés ? « un Pass gratuit pour l'Événement organisé » ne désigne aucun Événement. UJ-2 dit « les 10 premiers comptes à le faire » (envoi), FR-42 « l'ordre des Réalisations validées ». On ne sait pas non plus si le compteur est global ou propre à un Événement. *Correction :* « le prochain Événement publié à la date de validation ; compteur unique pour l'opération ; ordre de validation », et aligner UJ-2.
- **[medium]** Seuils renvoyés à l'architecte ou laissés flous (FR-1, FR-29, FR-27, FR-30, FR-45) :
  - FR-1 « téléphone moyen, en 4G » sans profil ni métrique (LCP ?) ;
  - FR-29 « dans un délai que l'architecte fixe » : le PRD n'a pas de borne, donc pas de critère d'acceptation ;
  - FR-27 « avec leur progression » : progression non définie (chapitres vus ? pourcentage ?) ;
  - FR-30 « mises à jour comprises » : qu'est-ce qu'une mise à jour, et le client est-il prévenu ?
  - FR-45 « tous les 2 à 3 jours » : quelle règle, comment le consentement est recueilli, arrêt après un nouvel achat ?

  *Correction :* donner une borne ou une définition testable pour chacun, ou un `[NOTE FOR PM]` explicite si le seuil est volontairement reporté.
- **[medium]** Délai de remise par Zone absent des réglages (FR-6, FR-14, FR-51, §4.5). Le délai total « fabrication + remise » est affiché, et §0 dit que les délais sont « saisis dans l'admin ». Mais FR-51 ne liste que les Forfaits. §4.5 écrit en dur « Goma (moins d'un jour) ou Bukavu (un jour au plus) », alors que `CLAUDE.md` dit Bukavu « en moins d'un jour ». *Correction :* ajouter à FR-51 un « délai de remise par Zone et par Mode de remise » et retirer les valeurs de §4.5.
- **[low]** Parcours `retrait` non défini dans les statuts (FR-24, Glossaire « Statut de commande »). Une Commande en retrait à Goma passe-t-elle par `expédiée` ? Quel email reçoit le client quand l'article est prêt à retirer ? *Correction :* préciser le libellé (« prête au retrait ») ou le saut de statut.
- **[low]** FR-13 : on ne sait pas si le téléphone est demandé pour un Panier 100 % numérique. « Ces champs n'apparaissent pas pour un Panier 100 % numérique » peut inclure le téléphone ou non, alors que le mobile money a besoin d'un numéro (FR-16). *Correction :* lister les champs masqués.

## Honnêteté sur le périmètre — adequate
§8 (Non-objectifs) fait un vrai travail : pas de place de marché, pas de transporteur, pas d'affiliation automatisée, pas de forum, pas d'hébergement de la Galerie d'événement. §6.3 range honnêtement ce qui est reporté. §2.2 nomme les non-utilisateurs.

Les déductions sont signalées dans §11 et confirmées par Jonathan, mais sans marque inline. Certains manques restent à déduire :
- le Pass Stand annulable en partie ou non ;
- la capacité de la salle (« pas de quota par Type de pass » est une décision, mais le risque de surréservation n'est pas reconnu) ;
- la suppression de compte et les données personnelles des clients hors RDC (Amina) ;
- les Réalisations : apparaissent-elles dans la Galerie ?

La densité d'éléments ouverts (12 Q, dont au moins 5 bloquantes) est élevée pour un PRD destiné à lancer la construction. C'est acceptable seulement si le statut de blocage est explicite (voir Décision).

### Constats
- **[medium]** Les Articles en anglais facultatifs contredisent FR-55 (FR-43 contre FR-55). FR-55 : « Toutes les pages publiques existent en français et en anglais ». FR-43 : « la version anglaise est facultative ». Le SEO (FR-56 : URL canonique, hreflang) et le plan du site en dépendent. *Correction :* ajouter une exception à FR-55 : un Article sans version EN n'a pas de page /en, il n'est pas listé dans le sitemap EN et n'a pas de hreflang.
- **[low]** §4.4 point 5 répond à Q-3 avant qu'elle soit tranchée. « la conversion en devise locale est faite par le Prestataire » est posé comme un fait, alors que Q-3 demande justement si chaque Prestataire débite en USD ou convertit. *Correction :* marquer le point 5 comme une hypothèse liée à Q-3.
- **[low]** Capacité des Événements (FR-33). « Il n'y a pas de quota par Type de pass » est assumé, mais le risque (plus de Pass vendus que de places dans la salle) n'est pas nommé. *Correction :* ajouter « capacité maximale facultative par Événement » ou un `[NON-GOAL for MVP]` explicite.
- **[low]** Données personnelles et suppression de compte absentes. Le site collecte des mesures corporelles, des adresses, des numéros WhatsApp et des photos de personnes, et vend à l'international. Ni FR ni non-objectif sur l'export ou la suppression des données. *Correction :* ajouter une FR minimale (demande de suppression traitée par l'Admin) ou un non-objectif motivé, en lien avec Q-5.

## Utilisabilité en aval — adequate
Le glossaire est solide et largement respecté. Les capitales sur les termes définis (Commande, Kit lié, Zone de remise) facilitent l'extraction. Les identifiants FR-1 à FR-57 sont contigus et uniques, SM-1 à SM-7 et SM-C1 à SM-C7 aussi. Chaque FR importante renvoie à son parcours (« Réalise UJ-x »), et chaque indicateur de succès à ses FR.

Il reste trois problèmes :
- **Exigences d'implémentation.** Plusieurs exigences décrivent une implémentation plutôt qu'une capacité, ce qui préempte le travail de l'architecte.
- **Modèle Pass / Commande.** Le modèle de données reste ambigu (voir Clarté du « fini »).
- **Double sens de « admin ».** Le terme sert à la fois pour la personne et pour l'interface, ce qui gênera le mapping des droits de FR-53.

### Constats
- **[medium]** FR-15 décrit une architecture, pas une capacité (§4.4 FR-15). « couche de paiement commune, avec un Adaptateur par Prestataire », « PawaPay (API v2) » : c'est une décision d'architecture. La capacité produit est « l'Admin peut ajouter, activer ou retirer un Prestataire sans interruption du reste du site ». Même remarque, plus légère, pour FR-53 « (RLS) », FR-28 « lien signé de courte durée » (justifié par la règle 1 de `CLAUDE.md`, acceptable) et §4.10 « Envoi par Resend ». *Correction :* reformuler FR-15 en capacité et déplacer « Adaptateur » et « API v2 » dans l'addendum, section architecture. Garder les mentions qui découlent directement d'une règle absolue de `CLAUDE.md` en citant la règle.
- **[low]** « admin » désigne tantôt la personne, tantôt l'interface (FR-8, FR-23, FR-24, FR-41, contre le Glossaire « Admin — Jonathan »). « l'admin les corrige », « l'admin voit une tâche » (minuscule, la personne) côtoient « saisis dans l'admin » (l'interface). FR-53 autorise l'Assistant à faire une partie de ces actions. L'architecte doit donc savoir qui agit. *Correction :* réserver « Admin » (majuscule) à la personne et écrire « l'interface d'administration » ou « le back-office » pour l'outil. Pour les tâches partagées, écrire « l'Admin ou l'Assistant ».
- **[low]** Libellé de la double option instable (Glossaire « Kit lié », FR-7, UJ-1, `CLAUDE.md`). Le Glossaire et FR-7 écrivent « Le porter ». UJ-1 et `CLAUDE.md` écrivent « Prêt à porter ». FR-1 écrit « Le porter » et « option prêt à porter ». *Correction :* fixer le libellé dans le glossaire et l'utiliser partout. Le texte final ira dans les fichiers de traduction.

## Adéquation de forme — strong
C'est un produit grand public avec une vraie expérience (mobile, navigateur intégré, fierté, partage) : des parcours avec protagonistes nommés sont indispensables, et ils sont là. UJ-6 (Jonathan) couvre bien le côté opérateur sans multiplier les parcours d'admin. Le PRD est en tête de chaîne (UX, architecture, stories). Le niveau de traçabilité est donc justifié, et l'addendum décharge proprement le PRD de la matière d'architecture. Ni sur-formalisation ni sous-formalisation notable.

## Notes mécaniques
- **Protagonistes des parcours :** UJ-3b n'a pas de protagoniste nommé (« Un client de Goma »). Son identifiant « 3b » casse la numérotation (UJ-1 à UJ-6). Le renommer UJ-7 avec un prénom, ou le fusionner dans UJ-3 comme cas limite.
- **Index des hypothèses :** §0 annonce « Les déductions non confirmées portent la mention et sont reprises en §11 ». Aucune mention `[ASSUMPTION]` n'existe dans le corps, et §11 s'intitule « Hypothèses confirmées ». L'aller-retour est donc impossible à vérifier, mais toutes les entrées de §11 renvoient à une FR existante qui contient bien la règle. Corriger la phrase de §0, ou garder une marque inline « (confirmé le 2026-10-16) ».
- **§0 contre le corps :** « Les montants (prix, forfaits, frais) et les délais ne figurent jamais ici ». Pourtant, le corps contient « 48 h » (FR-26, FR-38), « 90 jours » et « 2 à 3 jours » (FR-45), « 50 par défaut » (FR-46), « 4 semaines » (§6.2) et « moins d'un jour / un jour au plus » (§4.5). Préciser que §0 vise les montants commerciaux et les délais de fabrication et de remise, et sortir les délais de §4.5 (voir Clarté du « fini »).
- **Termes hors glossaire :** « profil » (FR-34, UJ-5) pour le Compte ; « réclamation » et « remplacement » (FR-26) ; « Pass gratuit » ou « Pass offert » (FR-42). Les ajouter au glossaire ou les remplacer par les termes définis.
- **Renvois :** les renvois vers l'Assistant (« §4.12 », FR-53), vers la livraison (« FR-44 », FR-24) et vers les questions (« Q-4 », « Q-6 », « Q-9 ») résolvent tous. FR-12 renvoie à UJ-2 et UJ-4 mais pas à UJ-1, où Grâce crée aussi son Compte avant de payer.
- **Sections requises :** toutes présentes pour ce type de produit : vision, utilisateurs, parcours, glossaire, FR, NFR, périmètre, indicateurs, non-objectifs, questions ouvertes.
