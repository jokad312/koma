---
title: "Extrait des sources pour le PRD — KOMA SHOP"
created: 2026-10-16
sources:
  - docs/guide-koma-shop.md (G)
  - _bmad-output/planning-artifacts/briefs/brief-KOMA SHOP-2026-10-15/brief.md (B)
  - _bmad-output/planning-artifacts/briefs/brief-KOMA SHOP-2026-10-15/addendum.md (A)
  - CLAUDE.md (C)
---

# Extrait des sources pour le PRD

Abréviations : G = guide, B = brief, A = addendum, C = CLAUDE.md. « § » = section.

## 1. Problème, cible, positionnement

- **Problème** (B § Le problème) : costume importé AliExpress/Alibaba à **45 à 80 USD**, **45 à 50 jours** d'attente (« souvent trop tard pour un festival ») ; aucune boutique de cosplay à Goma ni à Bukavu ; fabriquer soi-même est difficile sans patrons ni méthode.
- **Phrase de départ** (G § Le projet en une page) : « Pour les otakus et cosplayeurs qui veulent incarner leurs personnages, KOMA SHOP propose des cosplays et accessoires faits main, prêts à porter, ou des kits pour les fabriquer soi-même, payables par mobile money ou par carte. » À valider auprès de 5 à 10 otakus (G § SwitchPro, domaine 1).
- **Cibles** (B § Pour qui) : 1) otaku africain qui fabrique (cible première des kits ; jeune, budget serré, mobile money) ; 2) otaku de Goma/Bukavu qui achète prêt à porter ; 3) cosplayeur international (cible seconde, plus tard ; kits, carte, anglais) ; 4) Jonathan, admin seul. C § Le produit : « d'abord les otakus africains, l'international ensuite ».
- **Positionnement** (B § Ce qui rend KOMA SHOP différent) : patrons originaux + créateur qui montre tout ; prix local (costume vendu « autour de 30 USD » au festival, accessoires « 1,5 à 2 USD ») ; mobile money en premier ; communauté existante (groupe WhatsApp « de plus de 170 otakus actifs », festival co-organisé). Le kit est « le cœur du projet » (B § En bref).
- **Aucune barrière technique** : la protection = patrons, confiance, proximité (B § Ce qui rend…).
- **Vision** (B § Vision) : « la référence du cosplay fait main en Afrique francophone » ; livraison étendue à toute la RDC puis au-delà ; Polar pour les paniers 100 % kits à l'international.
- **Repères de prix** (A § Repères de prix) : AliExpress 45–80 USD / 45–50 j ; festival ~30 USD (cosplay), 1,5–2 USD (accessoire) ; kit « à fixer par Jonathan », accès immédiat.

## 2. Produits et familles

| Famille | Nature | Contenu | Variantes / tailles | Après paiement |
| --- | --- | --- | --- | --- |
| cosplay | physique | costume complet fait main | XS à XXL ou « sur mesure » ; mode en stock ou sur commande | fabrication/préparation, livraison Goma ou Bukavu par le créateur |
| accessoire | physique | perruque, arme factice, masque, armure, bijou, objet de scène (G) | taille ou sur mesure proposés aussi sur la fiche accessoire (G Phase 3 B.2) | idem |
| kit | numérique | fichiers + tutoriel vidéo en chapitres, accès à vie | 1 exemplaire max par panier ; pas de taille | débloqué tout de suite dans « Ma bibliothèque » |

- **Contenu d'un kit** : C : PDF A4 et US Letter, SVG, STL + vidéo en chapitres. G : patrons PDF (A4 et US Letter), gabarits, fichiers 3D si besoin, liste du matériel, tutoriel vidéo. B/A : PDF imprimables, STL, « ou les deux ». A : vidéo + fichiers vendus ensemble, aucune vente séparée. Fiche kit : fichiers, formats, tailles, plan des chapitres, extrait vidéo, niveau, matériel (G Phase 3 B.5).
- **Vidéo complète** : n'existe que sur la plateforme, ni YouTube ni ailleurs (B § La solution). Mises à jour comprises dans l'accès à vie (G règle 4).
- **Délai de fabrication** : par produit ou variante (`lead_time_days`), affiché avant paiement (C, A § Délais, G § Décisions). Exemple « 10 à 15 jours » (G).
- **Stock** : pièce en stock = -1 unité au paiement ; sur commande = délai affiché (G règle 5).
- **Lien cosplay ↔ kit** : `linked_kit_id` ; fiche à deux options « Prêt à porter » / « Le fabriquer moi-même (kit) » (C, G Phase 3 B.4). Carnet plein → « Carnet de commandes complet » + lien vers le kit (G).
- **Sur mesure** : mesures (poitrine, taille, hanches, hauteur, notes) obligatoires avant paiement (G entités + règle 6) ; non repris ni échangé (case à cocher, G Phase 5).
- **Kit gratuit** : kit à 0 USD (G Phase 9 A).
- **Catalogue de lancement proposé** : 3 cosplays, 5 accessoires, 2 kits payants, 1 kit gratuit, ligne « sûr » côté droits (G § Semaine 1 ; A § Points à reprendre).

## 3. Capacités demandées

**Catalogue**
- Catalogues /cosplays, /accessoires, /kits, /univers/[slug] (G Phase 3 A).
- Filtres univers, prix, disponibilité, niveau (kits) ; famille (G user stories) ; tri nouveauté et prix (G Phase 3 A).
- Brouillons introuvables (catalogue, sitemap, URL directe) (G Phase 3 tests).
- Accueil : héros, bloc « Prêt à porter ou fait par toi », 6 derniers produits, 3 étapes, FAQ (G Phase 2 B.1).
- Pages À propos, FAQ, Contact (formulaire + WhatsApp), pages légales (G Phase 2 B).

**Fiche produit**
- Galerie (zoom mobile), titre, prix USD, description (G Phase 3 B.1).
- Choix taille / sur mesure avec formulaire et schéma de mesures (G Phase 3 B.2).
- Disponibilité « En stock » ou « Sur commande, expédié sous X jours » ; forfait et délai Goma/Bukavu ; délai total fabrication + livraison (G Phase 3 B.2, § Livraison).
- Double option cosplay/kit ; « Carnet de commandes complet » (G Phase 3 B.3–4).
- Kit : contenu, chapitres, extrait vidéo, niveau, matériel, aucun lien kits-private (G Phase 3 B.5).
- « Ajouter au panier » ou « Ouvrir dans ma bibliothèque » si déjà acheté ; produits liés même univers (G Phase 3 B.6–7).

**Panier / checkout**
- Panier visiteur (anonymous_id) fusionné à la connexion (G Phase 5 A.1).
- Quantités, retrait ; kit 1 ex. max, interdit si déjà acheté ; stock vérifié à l'affichage (G Phase 5 A).
- /commande : email (compte créé automatiquement), téléphone ; adresse seulement si article physique ; ville Goma/Bukavu ou retrait à Goma ; mesures obligatoires (G Phase 5 B).
- Cases : CGV ; renonciation rétractation pour kit ; sur mesure non repris (G Phase 5 B.4, § Légal).
- Route serveur : recalcul sous-total/livraison/total, vérif stock et capacité, commande `pending` (G Phase 5 B.5).

**Paiement**
- K-Pay : mobile money (opérateur + numéro) ou carte (redirection page K-Pay) pour tous les paniers au lancement (C règle 9, G Phase 6, B § Périmètre).
- Ordre : mobile money en premier pour les visiteurs africains, carte en premier ailleurs (G § Paiement, Phase 6 A.1).
- Notification serveur : contre-vérification statut + montant auprès de K-Pay ; paid → stock, accès kits, email, événement ; idempotence par référence ; échec → cancelled (G Phase 6 B).
- Page /merci : polling 3 s pendant 3 min ; états payé / en attente / échec avec « Réessayer » + WhatsApp (G Phase 6 C).
- Numéro WhatsApp visible en cas de souci ; montant affiché = montant débité (G § Paiement).
- Polar : plus tard (phase 10), paniers 100 % kits uniquement ; test automatique du routage (C règles 10–11, G § Plus tard).

**Livraison**
- Forfait par ville (Goma, Bukavu) saisi dans l'admin ; kits sans frais (C, G § Livraison).
- Statut et n° de suivi saisis à la main par l'admin, aucune intégration transporteur (C règle 12).

**Compte client**
- Connexion lien magique + Google (G Phase 1 D).
- /compte/commandes : liste, détail, frise des statuts avec dates, transporteur, n° de suivi, bouton WhatsApp (G Phase 7 C).
- Onboarding 3 questions (source, univers, préférence prêt/fabriquer) (G Phase 8 B).

**Accès kits / vidéos**
- /compte/bibliotheque : kits achetés avec progression ; page kit : téléchargements, lecteur à chapitres, reprise (sauvegarde 15 s, terminé à 90 %) (G Phase 7 A).
- Téléchargement : vérif accès, max 10 par fichier et par client, lien signé 5 min (G Phase 7 B.1, règle 4).
- Vidéo : lien signé 3 h, pas de bouton de téléchargement (G Phase 7 B.2).
- Vidéo téléversée OU lien vers stockage externe protégé (Bunny Stream, Cloudflare Stream, Mux) ; Drive/YouTube non répertorié interdits (A § Vidéos, B § Pour qui).

**Admin**
- /admin/produits : liste (famille, statut, prix, stock, ventes), formulaire complet, variantes, photos (ordre, alt obligatoire), extrait, fichiers et vidéo vers kits-private avec progression et reprise, éditeur de chapitres (G Phase 4 A).
- Publication refusée sans prix, photo, texte alternatif, ou fichier (kit) (G Phase 4 A.6).
- /admin/commandes : filtres statut/famille/moyen ; détail adresse, mesures, téléphone ; avancer le statut ; annuler/rembourser (retire accès, remet stock ; argent remboursé dans K-Pay) ; remise à zéro des téléchargements (G Phase 4 B).
- /admin/reglages : forfaits Goma/Bukavu, max commandes physiques en cours, numéro WhatsApp (G Phase 4 C).
- /admin/tableau-de-bord 7/30 j : entonnoir, ventes par famille/produit, réachat, délais moyens, réponses onboarding (G Phase 8 A).
- Client sur /admin → redirigé (G Phase 4 tests).

**Emails** (Resend ; G § Technique dit « ou équivalent »)
- Payée, en fabrication, expédiée (avec suivi), livrée → « Montre-nous ton costume » (G § Livraison, Phase 8 C).
- Kit acheté ; relance J+2 sans vidéo ; J+7 sans fin (G Phase 8 C).
- Panier abandonné 1 h puis 24 h, arrêt si payé (G Phase 8 C).
- Nouveau produit aux clients du même univers ; emails commerciaux avec consentement + désinscription ; un bouton par email (G Phase 8 C).

**i18n**
- FR + EN via /fr et /en, hreflang, aucun texte en dur hors fichiers de traduction (C § Langues, G § SEO, B § Périmètre).

**SEO**
- URLs /cosplays|accessoires|kits|univers|guides/[slug] ; titre/description uniques ; Open Graph ; JSON-LD Product+Offer, BreadcrumbList, Organization, FAQPage, VideoObject ; sitemap, robots, canonical ; un H1 ; Core Web Vitals verts (G § SEO, C règle 8).
- Hors produit : Search Console, Bing, Google Business Profile Goma (G § Après la mise en ligne).

**Mesure**
- Table `events` : landing_view, product_viewed, add_to_cart, checkout_started, payment_succeeded, order_shipped, order_delivered, file_downloaded, video_started, video_completed, repeat_purchase (G Phase 8 A). Outil : PostHog ou Plausible (G § Technique).

## 4. Règles métier et contraintes dures

- **C règles 1–15** (verbatim dans C) : bucket privé `kits-private` + lien signé serveur après accès payé ; RLS partout ; seule la route de notification passe en `paid` ; prix/stock/livraison calculés serveur ; secrets en variables d'env + `.env.example` ; honnêteté (aucun avis/chiffre/logo/témoignage inventé) ; aucune image/logo officiel de franchise ; mobile d'abord 375 px, contraste, alt, clavier ; SEO JSON-LD sur toute page publique ; K-Pay pour tout panier avec ≥ 1 physique ; Polar uniquement 100 % kits et seulement en phase Polar ; routage vérifié en base + test auto ; livraison manuelle ; interdiction de simuler ; rien hors phase ; s'arrêter si info manquante.
- **G § Les règles 1–8** : lien signé qui expire ; confirmation signée ; prix serveur ; accès à vie + 10 téléchargements/fichier ; stock et capacité max ; mesures avant paiement ; panier mixte (kits débloqués tout de suite, physiques suivent leur statut) ; seul l'admin gère les produits.
- **Sécurité** (G § Technique) : clés K-Pay, Polar, service role, Resend côté serveur ; une référence de paiement ne valide jamais deux commandes ; RLS : lecture publique des produits publiés et métadonnées ; aucune écriture navigateur sur orders, order_items, entitlements (G Phase 1 C).
- **Statuts** : pending → paid → in_production → shipped → delivered ; + cancelled, refunded ; 100 % numérique : paid → delivered (G § Entités).
- **Prix** : USD, identique partout, toujours affiché en USD, fixé par produit dans l'admin (C, B).
- **Zones** : Goma et Bukavu uniquement pour le physique ; kits vendus dans tous les pays (C). Bukavu < 1 jour (C, B, G).
- **Légal** (G § Légal) : mentions légales, CGV, livraison, retours (exemple non arrêté), confidentialité/cookies avant la 1re vente ; droit de rétractation UE et ses 2 exceptions.
- **Qualité** : héros < 2,5 s sur mobile (G § Design) ; Lighthouse mobile ≥ 90 perf/accessibilité/SEO sur l'accueil (G Phase 2 tests).
- **Méthode** (C § BMad) : une story à la fois, plan validé avant code, lint/types/tests/build, ne jamais modifier une migration appliquée.

## 5. Phases et périmètre

- **Lancement = phases 1 à 8 du guide** (B § Périmètre) : fondations, vitrine, catalogue/fiches, admin, panier/commande, paiement K-Pay, bibliothèque/suivi, mesure/onboarding/emails. Planning indicatif 7 semaines (G § Plan de lancement).
- **Plus tard** : phase 9 après 2–3 mois (kit gratuit, filigrane PDF, affiliation [20] % / 60 j / validation 14 j après livraison, galerie « Réalisations », pages guides) (G Phase 9, § Semaine 7) ; phase 10 Polar (G § Plus tard) ; livraison reste RDC/Afrique/monde (G § Livraison, B § Vision) ; communauté Discord/WhatsApp après 50 clients (G § Lancement).
- **Exclu explicitement** (B § Périmètre) : livraison hors Goma/Bukavu ; intégration transporteur ; Polar ; phase 9 ; communauté hors WhatsApp ; publicité payante. G écarte aussi webinaires, démarchage à froid, pub newsletter, offres à vie, livre (G § SwitchPro).

## 6. Objectifs et indicateurs

- **> 20 ventes le premier mois**, kits et pièces confondus ; « estimation de Jonathan, pas un engagement » (B § Comment on saura).
- Une « part significative » des acheteurs de kit termine la vidéo et partage une photo (non chiffré) (B).
- Pièces livrées dans le délai affiché ; clients qui reviennent pour un 2e achat (B).
- Ratios hebdomadaires : visiteurs → fiche ; fiche → panier ; commande → payée ; payée → livrée dans le délai ; kit payé → vidéo terminée ; clients ≥ 2 achats (G § Ratios). Aucun seuil chiffré.

## 7. Questions ouvertes, informations manquantes, contradictions

**Informations manquantes**
- Documentation et clés K-Pay ; confirmation carte activée, objets physiques acceptés, USD et pays couverts (B § Inconnues, G § Paiement). Si pas de carte : CinetPay ou MaxiCash cités (G) mais non décidés.
- Montants des forfaits Goma et Bukavu ; délai de livraison Goma « À préciser par Jonathan » (G § Livraison).
- Prix des kits (B, A) ; tarif par famille en plus du forfait ville : « à trancher dans le PRD » (G, A).
- Placeholders : lien du dépôt de référence design, dossier photos, photo héros, [EMAIL ADMIN], numéro WhatsApp, liens réseaux, RCCM / Id. Nat. / NIF, textes légaux, URL (C, G).
- Disponibilité de komashop.com non vérifiée (B, G).
- Choix stockage vidéo Supabase vs hébergeur externe : « à trancher dans l'architecture » (B).
- Outil de mesure : PostHog ou Plausible, et articulation avec la table `events` (G).
- Détection « visiteur africain » pour l'ordre des moyens de paiement : non spécifiée.
- Avis juriste PI et acceptation K-Pay des pièces inspirées (G § Légal).
- Politique de retours donnée « par exemple » seulement (G § Légal). Aucun kit encore filmé : chemin critique (B).

**Contradictions et incohérences**
- **Kit gratuit** : exclu du lancement (B § Périmètre, phase 9) mais présent dans le catalogue de lancement (G Semaine 1, A § Points), dans le héros Kits « Obtenir le kit gratuit » (G § Héros, phase 2) et parmi les 3 premières techniques d'acquisition (G § Lancement).
- **Formats de kit** : SVG cité par C et G (`kit_files`) mais absent de B/A (PDF et STL « ou les deux »).
- **Retrait à Goma** (gratuit, G § Livraison et Phase 5 B.2) absent de C et B, qui ne parlent que d'un forfait par ville.
- **Vidéo externe** : B/A veulent un lien vers stockage externe dans l'admin ; le schéma G (`kit_videos.storage_path`) ne le prévoit pas.
- **Niveau du kit** : filtre et affichage (G Phase 3) sans champ correspondant dans `products` ; « matériel » non plus. `level` n'existe que dans `profiles`.
- **Tailles des accessoires** : C ne donne des tailles qu'au cosplay ; G Phase 3 B.2 propose taille/sur mesure aussi pour l'accessoire.
- **Transporteur** : G garde `shipments.carrier` et l'affiche au client, alors que la livraison est faite à la main par le créateur (C règle 12) ; à clarifier (texte libre ?).
- **Coche erronée** : user story catalogue cochée `[x]` alors que rien n'est construit (G § User stories ; signalé par A).
- **Date** : G « Version du 15 octobre 2026, alignée sur le brief produit le 16 octobre 2026 » et « brief produit du 16 octobre 2026 », alors que le brief est créé le 15 et mis à jour le 16.
- **Addendum périmé** : A décrit C comme ayant encore 4 zones et un choix de langue ouvert ; A précise que C et G ont été alignés le 16/10, ce que confirme la lecture actuelle (plus de contradiction réelle, mais tableau obsolète).
- **Méthode** : G « une phase à la fois » vs C « une story à la fois » (C fait foi depuis BMad).
- **Communauté** : G « Discord ou WhatsApp » après 50 clients vs B qui exclut toute autre plateforme que WhatsApp au lancement.
- **Emails** : C impose Resend ; G « Resend (ou équivalent) ».
- **Kits à l'international** : C « se vendent dans tous les pays » alors que la couverture pays de K-Pay (seul prestataire au lancement) n'est pas confirmée.
- **Monnaie** : prix toujours en USD ; aucune source ne dit si K-Pay débite en USD ou convertit (lié à « montant affiché = montant débité »).

## 8. Intentions qualitatives

- **Promesse** : « fait par un otaku, pour les otakus » ; vraies photos du créateur, en grand, héros plein écran ; aucune image officielle (G § Design).
- **Direction proposée** (à ajuster après le dépôt de référence) : sombre par défaut + mode clair mémorisé ; 1–2 accents vifs pour boutons et prix ; police d'affichage expressive + police de texte très lisible ; clins d'œil manga légers (trames, cases, traits de vitesse), jamais sur une photo produit (G § Design, Phase 2 A.3).
- **Héros** : Accueil « Deviens ton personnage. » ; Cosplays « Prêts à porter, faits main à Goma » ; Kits « Fabrique-le toi-même, pas à pas » ; Accessoires « La pièce qui manquait à ton costume » ; À propos « Un seul créateur. Chaque pièce faite main. » (exemples, G § Héros).
- **Ton** : tutoiement, phrases courtes, vocabulaire de la communauté (cosplay, con, WIP, props), sans jargon de vendeur (G § Design).
- **Photos** : 5 angles par produit (face, dos, profil, détail, portée), lumière douce, fond simple, cadrage uniforme, alt descriptif (G § Règles photos).
- **Confiance sans rien inventer** : photos réelles, portrait/atelier, WhatsApp visible, réponse sous 24 h, délai annoncé avant paiement (G § Légal).
- **Esprit** : projet passion, lancement entier présenté comme un test ; le site protège le temps du créateur unique (B § En bref, G § Le projet).
