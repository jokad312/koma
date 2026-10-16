---
title: "Réconciliation brief → PRD — KOMA SHOP"
created: 2026-10-16
sources:
  - _bmad-output/planning-artifacts/briefs/brief-KOMA SHOP-2026-10-15/brief.md
  - _bmad-output/planning-artifacts/briefs/brief-KOMA SHOP-2026-10-15/addendum.md
cible:
  - prd.md, addendum.md, .memlog.md (même dossier)
---

# Réconciliation brief → PRD

Méthode : chaque idée du brief et de son addendum a été cherchée dans le PRD et son addendum. Les écarts expliqués par une décision du `.memlog.md` du 2026-10-16 (paiement à 4 agrégateurs + K-Pay carte + Polar pour les paniers 100 % kits, kit gratuit à +4 semaines, événements/pass/blog au lancement, codes promo, téléchargements illimités, publicité et affiliation, retrait à Goma, Bukavu en 1 jour max, indicateurs S/A validés…) **ne sont pas** listés comme écarts. Restent les pertes silencieuses et les contradictions sans décision, puis les chiffres du PRD sans source.

Priorité : **H** = à corriger avant de passer à l'UX et à l'architecture ; **M** = à corriger pendant la finalisation ; **B** = amélioration.

## Résumé

| # | Priorité | Écart |
| --- | --- | --- |
| 1 | H | Critères de succès du brief perdus : kit terminé + photo partagée, 2e achat, entonnoir hebdomadaire |
| 2 | H | Aucune section Risques : chemin critique du contenu, capacité d'un seul créateur (aggravée par le périmètre élargi), confirmation K-Pay |
| 3 | H | Communauté WhatsApp de 170+ membres et festival absents ; « pas encore de TikTok ni d'Instagram » contredit par UJ-1 et UJ-4 ; origine des ventes non mesurée |
| 4 | M | Le kit comme cœur stratégique du projet, et le principe « kit encore plus accessible » (repères de prix du festival) disparaissent |
| 5 | M | Aveu honnête sur la protection des vidéos (capture d'écran toujours possible) absent |
| 6 | M | Différenciation « patrons originaux, créateur qui montre tout » et rôle complet du créateur affaiblis |
| 7 | M | Problème « aucune offre locale » et vision long terme (référence en Afrique francophone) perdus |
| 8 | M | Points de l'addendum du brief non tranchés explicitement : tarif par famille, catalogue de lancement, vente séparée kit/vidéo, vidéo externe dans l'admin, « sans toucher au code » |
| 9 | B | Séquencement des cibles (Afrique d'abord) et esprit « le lancement est un test » |
| 10 | M | Chiffres et formules du PRD sans source |

---

## 1. Critères de succès du brief perdus (H)

- **Brief, « Comment on saura que ça marche »** : (a) « Le kit tient sa promesse : une part significative des acheteurs termine la vidéo et partage une photo de son costume fini » ; (b) « Les clients reviennent pour un deuxième achat » ; (c) « Les promesses de délai sont tenues » ; (d) « Les ratios hebdomadaires du guide (fiche → panier → payé → livré ou vidéo terminée → 2e achat) servent de tableau de bord » ; (e) « premières ventes venues de la communauté ».
- **PRD §7 / FR-54** : (c) est repris (SM-C1). (a) n'est repris qu'à moitié : SM-5 compte les photos envoyées, mais **la fin de la vidéo n'est ni mesurée (FR-54) ni suivie** — pourtant FR-27 stocke déjà une « progression ». (b) **le 2e achat** n'apparaît nulle part (seul SM-6 suit le passage kit gratuit → payé, après 4 semaines). (d) l'entonnoir hebdomadaire n'est pas décrit dans FR-49. (e) l'origine communautaire des ventes n'est pas mesurable (voir écart 3).
- Le memlog valide « S1-S7 et A1-A7 tels quels » mais ne dit pas que les critères du brief sont abandonnés : c'est une perte silencieuse, pas un arbitrage.
- **Correctif proposé** : ajouter à FR-54 « chapitre de Vidéo de kit terminé / vidéo terminée » et « deuxième Commande payée d'un même Compte » ; ajouter SM-8 « Part des acheteurs de Kit qui terminent la vidéo » (valide §4.6, c'est l'indicateur de la promesse centrale) et SM-9 « Part des clients qui font un 2e achat » ; ajouter à FR-49 un entonnoir hebdomadaire fiche → panier → payée → livrée / vidéo terminée → 2e achat. Faire confirmer par Jonathan.

## 2. Pas de section Risques ni d'inconnues (H)

- **Brief, « Inconnues et risques »** : contenu = chemin critique (« aucun kit n'est encore filmé ; sans vidéos et patrons prêts, le site n'a rien à vendre ») ; K-Pay à confirmer (carte activée, **vente d'objets physiques acceptée**, USD, pays) ; prix des kits ouvert ; propriété intellectuelle (catalogue dans la ligne « sûr », juriste) ; stockage vidéo ; domaine ; **capacité d'un seul créateur** (« fabrication, tournage, livraison et support reposent sur une personne »).
- **PRD** : la plupart des inconnues techniques sont devenues des questions ouvertes (Q-1, Q-3, Q-7, Q-8, Q-10, Q-12). Mais :
  - le **chemin critique du contenu** est réduit à une ligne de « ressources à fournir » (Q-10 « premiers Kits filmés ») ; rien ne dit que le lancement en dépend ni combien de Kits sont nécessaires ;
  - le **risque de capacité d'un seul créateur** a disparu, alors que le PRD **ajoute** au lancement événements, scan, bénévoles, blog, relances tous les 2-3 jours, codes promo, validation des photos, remboursements de pass. Le brief justifiait le kit précisément parce qu'il « ne dépend pas du temps de fabrication du créateur ». Le JTBD « vendre sans y passer ses nuits » et le Plafond de fabrication couvrent la fabrication, pas la charge totale ;
  - la question « K-Pay accepte-t-il la vente d'objets physiques ? » n'est reprise que sous l'angle propriété intellectuelle (Q-7), alors que tout le flux carte des Produits physiques et des Pass repose désormais sur K-Pay.
- **Correctif proposé** : ajouter une section « Risques » (ou §10 bis) : R-1 contenu = chemin critique, avec le nombre minimal de Kits filmés pour ouvrir (à demander à Jonathan) ; R-2 charge d'un seul créateur face au périmètre élargi, avec ce qui peut être différé si la charge déborde ; R-3 acceptation par K-Pay des produits physiques, des billets et de la carte en USD (compléter Q-1/Q-3). Ne pas inventer de chiffres.

## 3. Communauté WhatsApp, festival et canaux d'acquisition (H)

- **Brief, « Ce qui rend KOMA SHOP différent »** : « Jonathan anime un groupe WhatsApp de plus de 170 otakus actifs et a co-organisé un festival où il a vendu des cosplays ». **Addendum du brief, « Communauté et acquisition »** : le groupe est le « **premier canal de lancement et terrain de validation des prix** » ; « **Pas encore de présence sur TikTok ni Instagram** ».
- **PRD** : le groupe WhatsApp existant, sa taille et son rôle de premier canal ne sont jamais cités ; le festival déjà co-organisé non plus (les Événements apparaissent comme une nouveauté). UJ-1 fait arriver Grâce **par une vidéo TikTok**, UJ-4 Kevin **par une publicité Instagram de 6 s**, UJ-2 Patrick par une pub ou un influenceur : aucun parcours ne part du groupe WhatsApp, qui est pourtant le seul canal existant. Le memlog autorise publicités et affiliation, mais ne dit pas que la communauté cesse d'être le premier canal, ni que TikTok/Instagram existeront au lancement.
- Conséquence : FR-54 ne mesure pas l'**origine** d'une visite ou d'une vente (lien de partage WhatsApp, pub, code promo), donc le critère « premières ventes venues de la communauté » est invérifiable.
- **Correctif proposé** : mentionner dans la Vision ou §2 le groupe WhatsApp (170+ membres actifs, déclaré par Jonathan) et le festival déjà co-organisé comme point de départ ; ajouter un parcours (ou une variante d'UJ-2) « arrive par un lien partagé dans le groupe WhatsApp » ; ajouter à FR-54 la mesure de l'origine (paramètres de lien, référent) ; inscrire dans Q-10 « création des comptes TikTok et Instagram » comme prérequis des parcours UJ-1 et UJ-4.

## 4. Le kit comme cœur du projet et le positionnement prix (M)

- **Brief, « En bref »** : « **Le kit est le cœur du projet** : il répond au problème du prix, se vend sans limite et sans dépendre du temps de fabrication du créateur. » **« Ce qui rend KOMA SHOP différent » / addendum « Repères de prix »** : cosplay vendu au festival ≈ 30 USD, accessoires 1,5 à 2 USD, contre 45 à 80 USD importés ; « **Le kit doit être encore plus accessible** ».
- **PRD** : la Vision met sur le même plan « le porter » et « le fabriquer » puis pivote vers « la fierté » (décision memlog sur le message d'accueil, qui ne remet pas en cause la priorité stratégique du kit). La raison économique (kit scalable, indépendant du temps du créateur) n'apparaît nulle part. Les repères du festival et le principe « kit moins cher que le prêt-à-porter » sont absents, y compris de l'addendum du PRD. La règle « aucun montant dans le PRD » justifie de ne pas fixer de prix, pas d'effacer les repères de marché.
- **Correctif proposé** : ajouter à la Vision une phrase « Le Kit est le cœur économique : il répond au prix, se vend sans limite et ne consomme pas le temps de fabrication de Jonathan » ; reporter le tableau des repères de prix (AliExpress, festival, kit à fixer) dans l'addendum du PRD, avec la mention « déclarés par Jonathan », et le principe « le Kit se positionne sous le prix du prêt-à-porter » comme guide pour Jonathan (pas comme règle codée).

## 5. Aveu honnête sur la protection des vidéos (M)

- **Brief, « Ce qui rend KOMA SHOP différent »** : « aucune barrière technique n'empêche un concurrent de copier l'offre : ce qui protège KOMA SHOP, ce sont les patrons du créateur, la confiance de la communauté et la proximité locale. **Une vidéo peut toujours être filmée à l'écran ; le site empêche seulement le partage facile d'un lien.** »
- **PRD** : NFR-4 et FR-29 (« aucun bouton de téléchargement », liens signés) peuvent laisser croire à l'architecte ou à Jonathan qu'une protection anti-copie (DRM, filigrane) est attendue. Les vraies protections (patrons, confiance, proximité) ne sont pas nommées.
- **Correctif proposé** : ajouter à §8 Non-objectifs « Pas de DRM ni de promesse anti-capture : le site empêche le partage facile d'un lien, pas l'enregistrement d'écran » et rappeler en §1 ou §9 que l'avantage tient aux patrons originaux, à la confiance de la communauté et à la proximité.

## 6. Rôle du créateur et « patrons originaux » (M)

- **Brief, « En bref » et « Ce qui rend KOMA SHOP différent »** : Jonathan, **otaku lui-même**, « conçoit les patrons, fabrique les pièces, filme les tutoriels et livre à la main » ; « Des patrons originaux et un créateur qui montre tout : les gabarits sont conçus par Jonathan, et **le tutoriel suit la fabrication réelle de bout en bout** ».
- **PRD** : §9 garde « fait par un otaku, pour les otakus » et FR-2 « le créateur en trois phrases », mais le caractère **original** des patrons et la promesse « tutoriel de A à Z sur une vraie fabrication » ne sont ni dans la Vision, ni dans FR-9 (fiche Kit), ni dans le ton. Le contenu des trois phrases du bloc créateur n'est pas cadré.
- **Correctif proposé** : dans FR-9, exiger que la fiche Kit dise que les patrons sont conçus par Jonathan et que la vidéo suit une fabrication réelle complète ; dans §9, ajouter « montrer tout le processus » comme pilier de confiance ; pour FR-2 (6), indiquer que les trois phrases sont écrites par Jonathan (règle 5).

## 7. Problème « aucune offre locale » et vision long terme (M)

- **Brief, « Le problème »** : « **Aucune offre locale.** Il n'existe pas de boutique de cosplay à Goma ni à Bukavu. » **« Vision »** : « la référence du cosplay fait main en Afrique francophone : une bibliothèque de kits qui grandit à chaque nouvelle création, une communauté qui montre ses costumes, des livraisons étendues à toute la RDC puis au-delà ».
- **PRD** : la Vision reprend prix et délai d'AliExpress mais pas l'absence d'offre locale (qui fonde « Fait main à Goma »). L'ambition à terme se réduit à une ligne de §6.3 (« Remise hors de Goma et Bukavu »). La « bibliothèque de kits qui grandit » et l'échelle « Afrique francophone » ont disparu.
- **Correctif proposé** : ajouter la phrase sur l'absence de boutique locale en §1 ; ajouter un court paragraphe « À terme » reprenant la vision du brief (sans chiffres), en signalant que Polar, déjà actif au lancement, n'en fait plus partie.

## 8. Points de l'addendum du brief non tranchés explicitement (M)

| Brief (addendum) | PRD | Correctif |
| --- | --- | --- |
| « Tarif par famille (cosplay plus lourd qu'un bijou) : à garder ou non en plus du forfait par ville ; **à trancher dans le PRD** » | Le Glossaire définit un forfait « par Zone de remise », ce qui écarte implicitement le tarif par famille, sans le dire | Écrire la décision (forfait unique par ville, pas de tarif par famille) et la faire confirmer par Jonathan ; la noter dans l'addendum « Contradictions tranchées » |
| Catalogue de lancement (le guide propose 3 cosplays, 5 accessoires, 2 kits payants, 1 kit gratuit) ; catalogue choisi dans la ligne « sûr » | Absent ; Q-7 couvre seulement l'avis juridique | Ajouter une question ouverte « composition du catalogue de lancement », liée au risque contenu (écart 2), et rappeler la ligne « sûr » |
| « Le kit vendu comprend la vidéo complète et les fichiers ensemble ; **aucune vente séparée** » | Le Glossaire décrit le Kit comme un tout mais n'interdit pas la vente séparée | Ajouter à FR-50 ou au Glossaire : « Fichiers et Vidéo de kit ne se vendent jamais séparément » |
| Admin : « deux façons d'ajouter une vidéo : téléversement, ou **lien vers un stockage vidéo externe** protégé » | FR-50 dit seulement « Vidéo de kit » ; Q-8 laisse le choix à l'architecte | Préciser dans FR-50 que les deux modes doivent être possibles si l'architecture les retient, toujours sous NFR-4 ; ou noter que Q-8 peut n'en garder qu'un |
| Jonathan doit tout gérer « **sans toucher au code** » (brief, « Pour qui ») | Implicite dans §4.12 | Ajouter à §4.12 : « Tout réglage, contenu ou prix se fait dans l'admin, sans intervention dans le code » |
| User story du guide cochée `[x]` à tort | Non traité dans le PRD | Relève de la réconciliation avec le guide ; à signaler à reconcile-guide |

## 9. Séquencement des cibles et esprit de test (B)

- **Brief, « Pour qui »** : cible première = otaku africain qui fabrique ; « Le cosplayeur international (cible seconde, **plus tard**) » ; « Mobile money proposé **en premier** aux visiteurs africains ». **« Comment on saura »** : « le lancement entier est un test ».
- **PRD** : l'activation de Polar au lancement (memlog) rend l'international possible dès le jour 1, ce qui est un arbitrage valable ; mais la hiérarchie des cibles (Afrique d'abord) n'est plus écrite, et l'ordre mobile money d'abord est renvoyé en Q-11. L'esprit « lancement = test » est remplacé par « lancement grandiose » (memlog) ; le PRD garde la revue à 4 semaines, ce qui préserve l'essentiel.
- **Correctif proposé** : en §2, indiquer que l'otaku africain qui fabrique reste la cible prioritaire et l'international une cible secondaire ouverte par Polar ; dans Q-11, rappeler que le brief proposait mobile money en premier pour les visiteurs africains.

## 10. Chiffres et formules du PRD sans source (M)

| Passage du PRD | Élément | Source trouvée | Correctif |
| --- | --- | --- | --- |
| FR-1 | « en **4G** » | Aucune (memlog : « téléphone moyen, navigateur intégré d'Instagram » ; guide : « moins de 2,5 s sur mobile ») | Retirer « en 4G » ou le faire confirmer comme condition de mesure |
| UJ-4 | « une pub de **6 secondes** » | Aucune | Écrire « une courte pub » |
| UJ-4, UJ-5 | Kevin « **19 ans** », Divine « **23 ans** » | Aucune (les parcours A-C viennent de Jonathan ; UJ-4/UJ-5 n'ont pas d'âge sourcé) | Acceptable comme persona illustrative, à signaler comme telle ou à faire valider |
| §6.2 | Accroche « **Ton premier accessoire, offert.** » | Absente du brief, du guide et du memlog | Retirer, ou la marquer comme proposition à valider (le kit gratuit n'est pas forcément un accessoire) |
| UJ-4 | « animes de samouraïs et de **chasseurs de démons** » | Aucune | Sans impact sur le site, mais évoque une franchise précise ; préférer des archétypes neutres (règle 6, ligne « sûr ») |
| FR-29 / §11 | Démarrage vidéo en « **3G** » | Le memlog dit seulement « qualité adaptée au débit » ; listé en hypothèse confirmée | Acceptable (confirmé), à garder tel quel |
| Vision, JTBD | 45-80 USD, 45-50 jours, « 50 jours » | Brief (déclaré par Jonathan) | Conforme ; préciser « déclaré par Jonathan » comme dans l'addendum du brief |
| NFR-2 | Lighthouse ≥ 90, Core Web Vitals | Guide | Conforme |
| FR-53 | « jusqu'à deux comptes Assistant » | Memlog (« deux autres personnes ») | Conforme |

## Points vérifiés sans écart

Prix en USD identiques partout et fixés par produit ; délai de fabrication par produit ou variante affiché avant paiement ; Bukavu livrée en un jour au plus (memlog) ; vidéo complète publiée nulle part ailleurs (FR-29) ; accès à vie (FR-30) ; plafond de commandes physiques et renvoi vers le kit (FR-10) ; liens signés et `kits-private` (NFR-4) ; communauté seulement sur WhatsApp (§8) ; exclusion du transporteur (§8) ; domaine komashop.com à vérifier (Q-10) ; prix des kits laissé ouvert (Q-12) ; stockage vidéo à trancher (Q-8) ; avis juridique sur la propriété intellectuelle (Q-7) ; estimation « plus de 20 ventes le premier mois » présentée comme non engageante (§7).
