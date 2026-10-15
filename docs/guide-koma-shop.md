# KOMA SHOP — boutique otaku (cosplays, kits, accessoires) — guide A→Z

Version du 15 octobre 2026 · Jonathan Manduara Tshimpaka

Une boutique en ligne pour les otakus, tenue par une seule personne : des cosplays et des accessoires prêts à porter, et des kits numériques pour les fabriquer soi-même. Paiement par mobile money ou par carte. Ce guide est écrit pour que n'importe quel développeur, et d'abord Claude Code, puisse construire la plateforme.

## Le projet en une page

Chaque costume existe en deux versions : prêt à porter, fabriqué et expédié par toi, ou en kit numérique pour le faire soi-même. Le client choisit sur la même fiche.

**La phrase de départ** (domaine 1 du guide SwitchPro) :

> Pour les **otakus et cosplayeurs** qui veulent incarner leurs personnages, **KOMA SHOP** propose **des cosplays et accessoires faits main, prêts à porter, ou des kits pour les fabriquer soi-même**, payables **par mobile money ou par carte**.

| Famille | Ce que c'est | Type | Après le paiement |
| --- | --- | --- | --- |
| Cosplay prêt à porter | Costume complet fait main, en tailles standard ou sur mesure | Physique | Fabrication ou préparation, puis expédition depuis Goma, avec suivi par email |
| Accessoire prêt à porter | Perruque, arme factice, masque, armure, bijou, objet de scène | Physique | Même chose |
| Kit de fabrication | Patrons PDF (A4 et US Letter), gabarits, fichiers 3D si besoin, liste du matériel, tutoriel vidéo en chapitres | Numérique | Débloqué aussitôt dans « Ma bibliothèque », à vie |

**Un seul créateur : toi.** Tu conçois, fabriques, filmes et expédies tout. Le site doit donc protéger ton temps :

- Les pièces physiques sont vendues « sur commande » avec un délai de fabrication affiché (par exemple 10 à 15 jours), sauf celles que tu as déjà en stock.
- Un réglage admin limite le nombre de commandes physiques en cours. Au-delà, la fiche affiche « Carnet de commandes complet » et propose le kit.
- Les kits numériques se vendent sans limite : c'est ta source de revenus qui ne dépend pas de ton temps.

**Modèle de vente :** un prix unique en dollars, identique dans tous les pays, comme pour SwitchPro. Les pièces physiques ajoutent des frais de livraison selon la zone. Paiement par mobile money ou par carte (détails dans la section Paiement et livraison).

**Questions ouvertes :**

- Nom de la boutique et nom de domaine.
- Langues : français seul, ou français et anglais ?
- Zones de livraison au départ : Goma, toute la RDC, l'Afrique, le monde ?
- Délai moyen de fabrication d'un cosplay complet et d'un accessoire.

## Ce qu'on garde du guide SwitchPro

On garde la chaîne du guide (idée → conception → construction → mesure → rétention → lancement → acquisition). Deux choses changent : on construit avec Claude Code au lieu de Lovable, et on vend aussi des objets physiques.

| Domaine du guide | Décision | Ce que ça devient ici |
| --- | --- | --- |
| 0 — Le seau percé | Gardé | Un client déçu (costume mal taillé, kit trop dur) ne rachète pas. La rétention, c'est le réachat |
| 1 — Problème, cible, solution | Gardé | La phrase de départ, validée auprès de 5 à 10 otakus et cosplayeurs |
| 2 — Conception et cahier pour l'IA | Gardé | Entités, règles, parcours, user stories : ils deviennent le fichier CLAUDE.md du projet |
| 3 — Construire avec l'IA | Changé | Claude Code dans un dépôt GitHub, avec Next.js et Supabase, phase par phase |
| 4 — Mesurer | Gardé, ratios changés | Fiche → panier → payé → livré ou vidéo regardée → 2e achat |
| 5 — Onboarding et emails | Gardé, adapté | Questions sur les univers préférés et le niveau ; emails de suivi de commande et de fabrication |
| 6 — Lancer et corriger | Gardé | Tester sur mobile, transformer chaque retour en user story |
| 7 — Acquisition | 7 techniques sur 17 + SEO poussé | Contenu court, kit gratuit, micro-influenceurs, pages par univers, affiliation |
| 8 — Affiliation et communauté | En partie | Affiliation dans l'acquisition ; communauté d'otakus après le lancement |
| 9 — Progresser en développement | Mis de côté | Ne sert pas ce projet |

**Aussi mis de côté :** tout ce qui était propre à SwitchPro (extension Chrome, mode « Native English ») ; les prompts Lovable ; parmi les 17 techniques, les webinaires, le démarchage à froid, la pub en newsletter, les offres à vie, le livre, et la publicité payante tant que les ratios ne sont pas bons.

## Le MVP : ce qu'on construit d'abord

La fonctionnalité cœur : trouver un costume, choisir « prêt à porter » ou « kit », payer, puis recevoir le kit tout de suite ou suivre la fabrication et la livraison du costume.

**Fonctionnalités secondaires, pas plus au lancement :** filtres du catalogue, panier, page de suivi de commande, espace admin.

### Les entités

| Entité | Champs principaux |
| --- | --- |
| Utilisateur | Nom, email, téléphone, pays, langue, univers préférés, rôle (client ou admin) |
| Produit | Famille (cosplay, accessoire, kit), titre, slug, description, univers, photos, prix en USD, kit lié (pour un cosplay), statut (brouillon ou publié) |
| Variante | Produit, taille (XS à XXL ou « sur mesure »), stock, mode (en stock ou sur commande), délai de fabrication en jours |
| Mesures | Client, commande, tour de poitrine, taille, hanches, hauteur, notes (pour le sur-mesure) |
| Fichier de kit | Produit, nom, format (PDF, SVG, STL), chemin dans le stockage privé, taille |
| Vidéo tutoriel | Produit, chemin dans le stockage privé, chapitres, durée |
| Panier et ligne de panier | Client ou visiteur, variante, quantité |
| Commande | Client, lignes, sous-total, frais de livraison, total, moyen de paiement, référence de paiement, statut |
| Adresse de livraison | Commande, nom, téléphone, pays, ville, adresse, point de repère |
| Zone de livraison | Nom (Goma, RDC, Afrique, monde), pays inclus, tarif, délai indicatif |
| Expédition | Commande, transporteur, numéro de suivi, date d'envoi |
| Accès | Client, kit, commande d'origine (pour les kits) |
| Téléchargement et progression vidéo | Client, fichier ou vidéo, date, position |

**Statuts d'une commande :** en attente de paiement → payée → en fabrication → expédiée → livrée. Plus : annulée, remboursée. Une commande 100 % numérique passe directement de « payée » à « livrée ».

### Les règles

1. Aucun fichier de kit ni aucune vidéo complète n'a de lien public : le serveur crée un lien signé qui expire, seulement si le client a acheté le kit.
2. Seul le serveur passe une commande en « payée », à la réception d'une confirmation signée du prestataire de paiement. Le navigateur ne peut jamais le faire.
3. Le serveur calcule le prix et les frais de livraison à partir de la base, jamais à partir de ce que le navigateur envoie.
4. Un kit acheté s'ouvre à vie, mises à jour comprises. Chaque fichier se télécharge 10 fois au plus par client.
5. Une pièce en stock retire une unité au paiement. Une pièce sur commande affiche son délai, et l'admin fixe un nombre maximal de commandes physiques en cours.
6. Le sur-mesure exige les mesures avant le paiement.
7. Panier mixte : les kits se débloquent tout de suite, les pièces physiques suivent leur propre statut.
8. Seul l'admin crée, modifie et publie les produits.

### Les user stories (ta checklist de test)

- [x] Un visiteur peut parcourir le catalogue et le filtrer par famille, univers, prix et disponibilité.
- [ ] Sur la fiche d'un cosplay, un visiteur voit les deux options « Prêt à porter » et « Le fabriquer moi-même (kit) ».
- [ ] Un visiteur peut choisir une taille ou « sur mesure » et saisir ses mesures.
- [ ] Un visiteur peut ajouter plusieurs produits au panier et voir le total, livraison comprise.
- [ ] Un visiteur peut payer par mobile money ou par carte ; un compte est créé avec son email s'il n'en a pas.
- [ ] Après paiement, un client voit ses kits dans « Ma bibliothèque » et peut télécharger les fichiers et regarder la vidéo.
- [ ] Un client suit sa commande physique sur une page dédiée et reçoit un email à chaque changement de statut.
- [ ] Un client ne peut ouvrir ni les fichiers ni la vidéo d'un kit qu'il n'a pas acheté, même en copiant un lien.
- [ ] Un admin peut créer un produit avec ses variantes, ses photos, ses fichiers et sa vidéo, puis le publier.
- [ ] Un admin fait avancer le statut d'une commande et saisit le numéro de suivi.
- [ ] Un admin règle le nombre maximal de commandes physiques en cours.

## La technique

Un site Next.js hébergé sur Vercel, branché à Supabase pour les comptes, la base de données et les fichiers privés. Next.js est choisi pour le référencement : chaque page arrive déjà remplie chez Google, contrairement à un site qui se construit dans le navigateur.

```text
Panier validé (prix + livraison calculés par le serveur)
  → Paiement K-Pay (mobile money ou carte Visa/Mastercard)
  → Notification serveur envoyée par K-Pay
  → Confirmation signée et vérifiée ?
       oui → Commande payée (email, stock mis à jour)
               → Kits numériques : débloqués tout de suite, liens signés qui expirent
               → Pièces physiques : fabrication puis expédition par le créateur, suivi par email
       non → Refusé : rien n'est validé
```

Le navigateur ne fait que lancer le paiement. La commande n'est validée que par la notification signée du prestataire ; ensuite les kits s'ouvrent tout de suite et les pièces physiques partent en fabrication.

| Brique | Outil | Rôle |
| --- | --- | --- |
| Code | Dépôt GitHub + Claude Code | Claude Code écrit le code phase par phase ; GitHub garde chaque version |
| Site | Next.js (App Router) + TypeScript | Pages rendues côté serveur, rapides et lisibles par Google |
| Style | Tailwind CSS + le dépôt de référence design que tu fourniras | Héros, cartes produits, thème clair et sombre |
| Comptes, base, fichiers | Supabase (Auth, Postgres avec RLS, Storage) | Chaque client ne voit que ses commandes ; fichiers des kits dans un stockage privé |
| Hébergement | Vercel | Mise en ligne automatique à chaque modification validée sur GitHub |
| Paiement | K-Pay et Polar | Voir la section Paiement et livraison |
| Emails | Resend (ou équivalent) | Confirmation, suivi de commande, relances |
| Images | Composant d'images de Next.js | Photos redimensionnées et compressées automatiquement |
| Mesure | PostHog ou Plausible | Les ratios de la section Plan et indicateurs |

**Les vidéos des kits** vont dans le stockage privé de Supabase et se lisent dans le lecteur du site via un lien signé. Si elles deviennent lourdes, passe à un hébergeur vidéo avec liens protégés (Bunny Stream, Cloudflare Stream ou Mux). Aucune protection n'empêche de filmer son écran : le but est de bloquer le partage facile d'un lien.

**Sécurité de base, non négociable :**

- RLS activée sur toutes les tables.
- Les clés secrètes (K-Pay, Polar, clé « service role » de Supabase, Resend) restent côté serveur, dans les variables d'environnement de Vercel, jamais dans le code envoyé au navigateur ni dans GitHub.
- Chaque notification de paiement est vérifiée (signature ou contre-vérification auprès du prestataire), et une même référence de paiement ne valide jamais deux commandes.
- Le prix, le stock et les frais de livraison sont lus dans la base par le serveur.

## Paiement et livraison

Au lancement, tout passe par K-Pay : il accepte à la fois le mobile money et les cartes Visa et Mastercard ([doc K-Pay](https://www.kpay.africa/docs/)). Polar ne peut pas servir pour les costumes et accessoires : il ne vend que des produits numériques ([politique Polar](https://docs.polar.sh/merchant-of-record/acceptable-use)).

### Qui encaisse quoi

| Panier | Mobile money | Carte bancaire |
| --- | --- | --- |
| Au moins une pièce physique | K-Pay | K-Pay |
| Uniquement des kits numériques | K-Pay | K-Pay au lancement ; Polar plus tard, quand les ventes de kits à l'international décollent (Polar gère alors les taxes étrangères à ta place) |

**À vérifier avec K-Pay avant de coder :** que le paiement par carte est activé sur ton compte marchand, que la vente d'objets physiques est acceptée, et quels pays et devises (USD) sont couverts. Si la carte n'est pas possible chez K-Pay, deux passerelles agréées en RDC font mobile money et carte : CinetPay et MaxiCash ([liste de la Banque centrale du Congo](https://www.bcc.cd/systemes-et-instruments-de-paiement/cartographie-des-systemes-de-paiement-en-rdc/les-prestataires-de-services-connexes-de-paiement-autorises-par-la-bcc/les-agregateurs-des-systemes-de-paiement)).

**Sur la page de paiement :** mobile money en premier pour les visiteurs africains, carte en premier pour les autres ; un numéro WhatsApp visible en cas de souci de paiement ; le montant affiché est exactement celui débité.

### Livraison depuis Goma

| Zone | Mode possible | Tarif |
| --- | --- | --- |
| Goma | Retrait en main propre ou livreur à moto | Forfait fixe, ou gratuit en retrait |
| Reste de la RDC | Agence de messagerie ou fret aérien | Forfait par zone |
| Afrique et monde | Transporteur international (DHL, Aramex ou la poste, à comparer depuis Goma) | Forfait par zone ; droits de douane à la charge du client, écrit clairement avant le paiement |

- L'admin fixe dans le site un tarif par zone et par famille (un cosplay complet pèse plus qu'un bijou).
- La fiche affiche le délai total : fabrication + livraison (par exemple « Expédié sous 12 jours, livré en 3 à 7 jours en RDC »).
- Chaque étape envoie un email : payée, en fabrication, expédiée (avec le numéro de suivi), livrée.
- Les kits numériques n'ont jamais de frais de livraison.

## Design et direction artistique

Le premier écran doit dire « fait par un otaku, pour les otakus » : tes vraies photos de costumes, en grand, dans des héros plein écran. Aucune image officielle d'anime ou de jeu : ce sont tes créations qui font l'univers.

**Ce que tu fourniras à Claude Code :**

- Tes photos : costumes portés, détails, coulisses de fabrication, portrait à l'atelier.
- Le dépôt GitHub de référence design : [LIEN DU DÉPÔT]. Claude Code le lit pour reprendre ses composants, ses espacements et son style, puis l'adapte à la boutique.

**La direction proposée** (à ajuster une fois le dépôt de référence vu) :

- Mode sombre par défaut, avec un mode clair ; une ou deux couleurs d'accent vives pour les boutons et les prix.
- Une police d'affichage expressive pour les titres, une police très lisible pour le texte.
- Des clins d'œil manga en décor léger (trames, cadres de cases, traits de vitesse), jamais par-dessus une photo produit.

### Les héros, page par page

| Page | Visuel | Titre et sous-titre (exemples) | Bouton |
| --- | --- | --- | --- |
| Accueil | Photo plein écran ou courte vidéo en boucle d'un de tes cosplays portés | « Deviens ton personnage. » — Cosplays faits main, prêts à porter ou à fabriquer toi-même. | Voir les cosplays · Découvrir les kits |
| Cosplays | Bandeau photo d'un costume complet | « Prêts à porter, faits main à Goma » | — |
| Kits | Photo de fabrication (mousse, patrons, outils) | « Fabrique-le toi-même, pas à pas » | Obtenir le kit gratuit |
| Accessoires | Gros plan d'un accessoire | « La pièce qui manquait à ton costume » | — |
| À propos | Ton portrait à l'atelier | « Un seul créateur. Chaque pièce faite main. » | Écrire sur WhatsApp |

Le ton des textes : tutoiement, phrases courtes, vocabulaire de la communauté (cosplay, con, WIP, props) sans jargon de vendeur.

### Règles pour les photos

- Pour chaque produit : de face, de dos, de profil, un détail, et une photo portée en action.
- Lumière naturelle ou douce, fond simple, même cadrage pour tout le catalogue.
- Photos envoyées en grand ; le site les compresse et les redimensionne tout seul.
- Chaque photo reçoit un texte alternatif qui décrit ce qu'on voit (utile aux malvoyants et à Google).

**Qualité attendue :** tout fonctionne sur un téléphone de 375 px de large, le texte reste lisible sur les photos (contraste suffisant), et l'image du héros s'affiche en moins de 2,5 secondes sur mobile.

## SEO et référencement poussé

Le référencement se construit dès la première ligne de code : une page par produit, par univers et par guide, chacune décrite à Google avec des données structurées. C'est la source de visiteurs gratuite qui grandit avec le catalogue.

### Le socle technique (à faire par Claude Code dès la phase 1)

- [ ] Pages rendues côté serveur par Next.js, adresses lisibles : /cosplays/[slug], /accessoires/[slug], /kits/[slug], /univers/[slug], /guides/[slug].
- [ ] Un titre et une description uniques par page, générés à partir du produit (« [Titre] — cosplay fait main, prêt à porter | KOMA SHOP »).
- [ ] Image et texte de partage (Open Graph) pour chaque page : l'aperçu est soigné sur WhatsApp, Facebook et X.
- [ ] Données structurées schema.org : Product avec Offer (prix, devise, disponibilité, livraison) sur chaque fiche, BreadcrumbList, Organization, FAQPage, VideoObject pour l'extrait vidéo.
- [ ] sitemap.xml et robots.txt générés automatiquement ; adresse canonique sur chaque page.
- [ ] Si le site est bilingue : /fr et /en, balises hreflang.
- [ ] Texte alternatif sur chaque image, une seule balise H1 par page.
- [ ] Vitesse : image du héros prioritaire, images compressées, scores Core Web Vitals au vert sur mobile.

### Ce que les gens cherchent, et la page qui répond

| Intention | Exemples de recherche | Page qui répond |
| --- | --- | --- |
| Acheter un costume prêt | « acheter cosplay fait main », « cosplay sur mesure » | Catalogue Cosplays et fiches |
| Le fabriquer soi-même | « patron cosplay armure mousse EVA », « tuto cosplay débutant » | Kits et pages guides |
| Compléter un costume | « perruque cosplay », « épée cosplay légère » | Catalogue Accessoires |
| Acheter près de chez soi | « cosplay Goma », « costume cosplay RDC » | Accueil + fiche Google Business Profile à Goma |

Les noms de personnages connus attirent beaucoup de recherches, mais les utiliser comporte un risque juridique : voir la section Légal avant d'en mettre dans les titres.

### Après la mise en ligne

1. Déclarer le site dans Google Search Console et Bing Webmaster Tools, y envoyer le sitemap.
2. Créer une fiche Google Business Profile à Goma (atelier, photos, horaires de retrait).
3. Publier une page guide par semaine (technique, matériau, entretien d'un costume), reliée aux produits.
4. Se faire citer dans des listes, blogs et forums de cosplay : c'est aussi ce qui pousse les assistants IA à recommander la boutique (le GEO du guide SwitchPro).
5. Chaque mois, regarder dans Search Console les recherches qui t'amènent des visiteurs, et créer la page ou le produit qui y répond mieux.

## Construire avec Claude Code

Claude Code travaille dans ton dépôt GitHub. Il lit d'abord le fichier CLAUDE.md (le cahier du projet, toujours à jour), puis on lui donne une phase à la fois. Neuf phases mènent de la page vide à la boutique complète.

### Avant de commencer

- [ ] Un dépôt GitHub vide pour la boutique, et le lien du dépôt de référence design.
- [ ] Claude Code installé et connecté à ce dépôt.
- [ ] Des comptes Supabase, Vercel et Resend ; l'accès marchand K-Pay (clés API et documentation).
- [ ] Tes photos rangées par produit, et les fichiers et vidéos des premiers kits.
- [ ] Les crochets `[…]` complétés partout dans ce guide : nom, domaine, langues, identifiants de NATHANGROUP SARL, emails, zones de livraison.

### Mode d'emploi

1. Copie le contenu CLAUDE.md ci-dessous dans un fichier `CLAUDE.md` à la racine du dépôt.
2. Pour chaque phase, ouvre une nouvelle session Claude Code, colle le texte de la phase, et demande d'abord un plan. Relis le plan, puis valide.
3. À la fin de la phase, fais les tests de validation toi-même, sur téléphone. Si un test échoue : « Le test X échoue : [ce que tu vois]. Corrige uniquement ce point. »
4. Quand tout passe, demande à Claude Code d'enregistrer (commit) et d'envoyer sur GitHub. Vercel publie alors une préversion à tester.
5. Les clés secrètes vont dans le fichier `.env.local` et dans les réglages de Vercel, jamais dans le chat ni dans GitHub.

### Le fichier CLAUDE.md

```markdown
# KOMA SHOP — instructions pour Claude Code

## Le produit
Boutique en ligne pour otakus, tenue par un seul créateur : Jonathan Manduara Tshimpaka, NATHANGROUP SARL, Goma, RDC.
Trois familles de produits :
- cosplay : costume complet fait main, physique, en stock ou sur commande (tailles XS à XXL ou sur mesure)
- accessoire : perruque, arme factice, masque, armure, bijou ; physique
- kit : numérique = fichiers (PDF A4 et US Letter, SVG, STL) + tutoriel vidéo en chapitres, accès à vie
Un cosplay peut être lié à son kit : la fiche propose « Prêt à porter » et « Le fabriquer moi-même ».

## Stack
Next.js (App Router, TypeScript, Server Components par défaut), Tailwind CSS, Supabase (Auth, Postgres avec RLS, Storage), hébergement Vercel, paiement K-Pay (mobile money et carte), emails Resend.
Référence design : [LIEN DU DÉPÔT DE RÉFÉRENCE]. Photos : [DOSSIER OU LIEN DES PHOTOS].

## Langues
[FRANÇAIS SEUL] ou [FRANÇAIS ET ANGLAIS, via /fr et /en]. Aucun texte visible en dur hors des fichiers de traduction.

## Prix et livraison
Prix en USD, identique dans tous les pays, toujours affiché en USD.
Frais de livraison par zone (Goma, RDC, Afrique, monde) et par famille, fixés dans l'admin. Les kits n'ont pas de livraison.

## Règles absolues
1. Les fichiers de kit et les vidéos complètes sont dans le bucket privé kits-private. Ils ne s'ouvrent que par un lien signé, créé côté serveur après vérification d'un accès payé. RLS sur toutes les tables.
2. Seule la route serveur de notification de paiement passe une commande en paid, après vérification auprès du prestataire. Jamais le navigateur.
3. Prix, stock et frais de livraison sont toujours calculés côté serveur, depuis la base.
4. Les secrets sont dans les variables d'environnement (.env.local, Vercel), jamais dans le code commité. Tenir .env.example à jour.
5. Honnêteté : aucun avis, chiffre, logo ou témoignage inventé.
6. Propriété intellectuelle : aucune image ni aucun logo officiel d'une franchise ; seulement les photos du créateur.
7. Mobile d'abord (375 px de large, sans défilement horizontal), contraste suffisant, texte alternatif sur chaque image, navigation au clavier.
8. SEO : metadata, Open Graph et données structurées JSON-LD sur chaque page publique.

## Paiement : qui encaisse quoi (règle stricte)
9. K-Pay encaisse tout panier qui contient au moins un produit physique (cosplay ou accessoire), par mobile money ou par carte. Au lancement, K-Pay encaisse aussi les paniers de kits.
10. Polar sert UNIQUEMENT aux paniers 100 % numériques (kits), et seulement quand la phase Polar est demandée. Ne jamais proposer Polar, créer un produit Polar ni envoyer une commande à Polar si le panier contient un produit physique, même un seul. Ne jamais présenter un produit physique comme numérique.
11. La route serveur qui choisit le prestataire vérifie la famille de chaque article en base ; un panier mixte part toujours chez K-Pay. Un test automatique doit le prouver.

## Livraison
12. La livraison des produits physiques est faite à la main par le créateur. Aucune intégration de transporteur, aucun suivi automatique : l'admin change le statut et saisit le numéro de suivi lui-même.

## Interdiction de simuler
13. Ne jamais simuler un paiement, une notification de prestataire, un statut de commande, une livraison, un email envoyé ou une réponse d'API pour faire « marcher » une fonctionnalité. Les faux paiements ne sont permis que dans les tests automatiques, avec des données de test clairement nommées, jamais dans le code de production ni dans une page visible.
14. Ne jamais ajouter de fonctionnalité, de page, de prestataire ou de traitement qui n'est pas demandé dans la phase en cours.
15. S'il manque une information (clé API, documentation K-Pay, texte légal, tarif), s'arrêter et la demander, sans inventer de valeur ni de comportement de remplacement.

## Façon de travailler
- Une phase à la fois. Proposer un plan avant de coder et attendre la validation.
- Avant de dire qu'une phase est finie : lint, vérification des types, tests et build sans erreur.
- À la fin : liste des fichiers changés, ce qu'il faut tester à la main, et un message de commit proposé.
- Ne jamais modifier une migration déjà appliquée : en créer une nouvelle.
- En cas de doute sur une règle métier, demander plutôt que deviner.
- Mettre à jour ce fichier quand une décision change.

## Commandes
(à compléter en phase 1 : dev, lint, typecheck, test, build)
```

### Phase 1 — Fondations

```markdown
OBJECTIF : un projet Next.js propre, relié à Supabase, avec la base de données, les comptes, le stockage et le socle SEO. Pas encore de vraies pages.

## A. Projet
1. Crée l'application Next.js (App Router, TypeScript, Tailwind CSS, ESLint) et des tests (Vitest pour la logique, Playwright pour les parcours).
2. Lis le dépôt de référence design et reprends ses couleurs, polices, espacements et composants de base dans la configuration Tailwind.
3. Complète la section Commandes de CLAUDE.md.

## B. Base de données (migrations Supabase)
- profiles : id, full_name, email, phone, country, language, favorite_universes, level, techniques, acquisition_source, role (customer par défaut, ou admin), marketing_consent, created_at
- products : id, family (cosplay, accessory, kit), slug unique, title, description, universe, images, price_usd, linked_kit_id, preview_video_path, status (draft, published), seo_title, seo_description, created_at, updated_at
- product_variants : id, product_id, size (XS à XXL ou custom), stock, mode (in_stock, made_to_order), lead_time_days
- kit_files : id, product_id, name, file_type (pdf, svg, stl, other), storage_path, size_bytes, sort_order
- kit_videos : id, product_id, storage_path, duration_seconds, chapters (JSON)
- carts, cart_items : id, user_id ou anonymous_id, variant_id, quantity
- orders : id, user_id, subtotal_usd, shipping_usd, total_usd, provider, provider_ref unique, status (pending, paid, in_production, shipped, delivered, cancelled, refunded), created_at, paid_at
- order_items : id, order_id, variant_id, unit_price_usd, quantity, measurements (JSON, pour le sur-mesure)
- shipping_addresses : order_id, name, phone, country, city, address, landmark
- shipping_zones : id, name, countries, price_cosplay_usd, price_accessory_usd, delay_text
- shipments : order_id, carrier, tracking_number, shipped_at
- entitlements : id, user_id, product_id (kit), order_id, granted_at, revoked_at ; unique (user_id, product_id)
- downloads, video_progress, events, settings (max_open_physical_orders)

## C. RLS
- Produits publiés et leurs variantes, fichiers (métadonnées seulement) et vidéos (métadonnées) : lecture publique. Brouillons et écriture : admin.
- Paniers, commandes, adresses, accès, téléchargements, progression : chaque utilisateur lit ses lignes. Aucune écriture du navigateur sur orders, order_items et entitlements.
- L'admin lit tout.

## D. Comptes et stockage
- Connexion par lien magique (email) et Google. Mon compte [EMAIL ADMIN] est admin.
- Buckets : kits-private (privé, aucune lecture publique), products-public (photos, extraits).

## E. Socle SEO
Metadata par défaut, robots.txt, sitemap.xml dynamique (produits publiés), page 404 soignée.

## TESTS DE VALIDATION
- npm run build passe sans erreur.
- Un client ne peut ni lire ni écrire les commandes ou accès d'un autre client.
- Un fichier de kits-private ouvert par son adresse directe renvoie une erreur.
- /sitemap.xml et /robots.txt répondent.
```

### Phase 2 — Mise en page, héros et pages vitrines

```markdown
OBJECTIF : la vitrine de la boutique, belle sur téléphone, avant même le catalogue.

## A. Mise en page commune
1. En-tête : logo KOMA SHOP, liens Cosplays, Accessoires, Kits, À propos, icône panier avec compteur, compte. Sur mobile : menu ☰ qui ouvre un panneau.
2. Pied de page : liens légaux, contact, WhatsApp [NUMÉRO], réseaux sociaux [LIENS], moyens de paiement acceptés.
3. Mode sombre par défaut, bouton pour le mode clair, choix mémorisé.

## B. Pages, avec les héros de la section Design du guide
1. Accueil : héros plein écran (photo ou vidéo courte de [PHOTO HÉROS]), « Deviens ton personnage. », deux boutons ; bloc « Prêt à porter ou fait par toi » qui explique les deux options ; 6 derniers produits ; trois étapes (Choisis → Paie par mobile money ou carte → Reçois ou fabrique) ; FAQ.
2. À propos : portrait, histoire du créateur, l'atelier à Goma.
3. FAQ, Contact (formulaire + WhatsApp), et les pages légales (contenu fourni en section Légal du guide).

## C. SEO de ces pages
Titre, description, Open Graph, JSON-LD Organization et FAQPage.

## TESTS DE VALIDATION
- À 375 px : aucun défilement horizontal, le menu ☰ s'ouvre et se ferme.
- Le texte du héros reste lisible sur la photo.
- Score Lighthouse mobile : 90 ou plus en performance, accessibilité et SEO sur l'accueil.
```

### Phase 3 — Catalogue et fiches produits

```markdown
OBJECTIF : un visiteur trouve un produit et comprend exactement ce qu'il achète.

## A. Catalogues
/cosplays, /accessoires, /kits et /univers/[slug] : grille de produits publiés, filtres (univers, prix, disponibilité, niveau pour les kits), tri par nouveauté et prix.

## B. Fiche produit (/cosplays/[slug], /accessoires/[slug], /kits/[slug])
1. Galerie de photos (zoom sur mobile), titre, prix en USD, description.
2. Cosplay et accessoire : choix de la taille ou « sur mesure » (formulaire de mesures avec un schéma explicatif) ; disponibilité : « En stock » ou « Sur commande, expédié sous X jours » ; frais et délais de livraison par zone.
3. Si le carnet de commandes est plein (réglage max_open_physical_orders atteint) : « Carnet de commandes complet » et lien vers le kit.
4. Cosplay avec un kit lié : deux options côte à côte, « Prêt à porter » et « Le fabriquer moi-même (kit) ».
5. Kit : contenu (fichiers, formats, tailles), plan des chapitres, extrait vidéo, niveau, matériel. Aucun lien vers kits-private.
6. Bouton « Ajouter au panier » ; si le kit est déjà acheté : « Ouvrir dans ma bibliothèque ».
7. Produits liés (même univers).

## C. SEO
Titre et description à partir de seo_title et seo_description (ou du produit), Open Graph avec la première photo, JSON-LD Product + Offer (prix, USD, disponibilité, livraison) + BreadcrumbList + VideoObject pour l'extrait.

## TESTS DE VALIDATION
- Un produit en brouillon est introuvable (catalogue, sitemap, adresse directe).
- Le test des résultats enrichis de Google valide le Product d'une fiche.
- Le code HTML d'une fiche kit ne contient aucune adresse de kits-private.
```

### Phase 4 — Espace admin

```markdown
OBJECTIF : gérer tout le catalogue et les commandes sans toucher au code. Réservé au rôle admin.

## A. Produits (/admin/produits)
1. Liste avec famille, statut, prix, stock total, ventes.
2. Formulaire : tous les champs de products, dont kit lié, titre et description SEO.
3. Variantes : tailles, stock, mode (en stock ou sur commande), délai.
4. Téléversement des photos (ordre par glisser-déposer, texte alternatif obligatoire) et de l'extrait vers products-public.
5. Pour un kit : fichiers et vidéo complète vers kits-private, avec barre de progression et reprise en cas de coupure ; éditeur de chapitres.
6. Publier / dépublier. Publication refusée sans prix, sans photo, sans texte alternatif, ou (kit) sans fichier.

## B. Commandes (/admin/commandes)
1. Liste filtrable par statut, famille et moyen de paiement ; détail avec adresse, mesures et téléphone.
2. Boutons pour avancer le statut : en fabrication → expédiée (saisie du transporteur et du numéro de suivi) → livrée. Chaque changement envoie l'email prévu.
3. Annuler ou marquer remboursé : retire les accès aux kits de la commande et remet le stock. Le remboursement d'argent se fait dans K-Pay.
4. Remettre à zéro les téléchargements d'un client pour un kit.

## C. Réglages (/admin/reglages)
Zones de livraison et tarifs, nombre maximal de commandes physiques en cours, numéro WhatsApp affiché.

## TESTS DE VALIDATION
- Un compte client qui ouvre /admin est redirigé.
- Je crée un cosplay avec 3 tailles et son kit lié, je les publie, les deux options apparaissent sur la fiche.
- Une photo sans texte alternatif bloque la publication.
```

### Phase 5 — Panier et commande

```markdown
OBJECTIF : passer du panier à une commande prête à payer, avec un total juste.

## A. Panier
1. Panier gardé pour un visiteur (anonymous_id) et fusionné avec son compte à la connexion.
2. Modifier les quantités, retirer un article. Un kit ne peut être qu'en un exemplaire, et pas du tout s'il est déjà acheté.
3. Stock vérifié à chaque affichage ; un article épuisé est signalé.

## B. Commande (/commande)
1. Email (création de compte automatique s'il n'en a pas), téléphone.
2. Adresse de livraison seulement s'il y a une pièce physique ; choix de la zone ou du retrait à Goma.
3. Mesures obligatoires pour chaque article sur mesure.
4. Cases : CGV acceptées ; pour un panier avec kit, « J'accepte l'accès immédiat au contenu numérique et je renonce à mon droit de rétractation » ; pour une pièce sur mesure, « Je comprends qu'une pièce faite sur mesure ne peut être ni reprise ni échangée ».
5. Une route serveur recalcule sous-total, livraison et total depuis la base, vérifie le stock et la capacité, puis crée la commande en pending.

## TESTS DE VALIDATION
- Modifier le prix dans le navigateur (outils de développement) ne change pas le total de la commande créée.
- Un panier 100 % kits ne demande pas d'adresse.
- Une commande sur mesure sans mesures est refusée.
```

### Phase 6 — Paiement K-Pay

Colle dans cette phase la documentation K-Pay de ton compte marchand, ou le code d'intégration déjà fait pour SwitchPro : Claude Code ne peut pas le deviner.

```markdown
OBJECTIF : payer par mobile money ou par carte via K-Pay, puis valider la commande uniquement quand K-Pay confirme.

Documentation K-Pay : https://www.kpay.africa/docs/ + [DOC OU CODE K-PAY DE SWITCHPRO].

## A. Lancer le paiement
1. Sur /commande, choix : « Mobile money » (opérateur + numéro) ou « Carte bancaire ». Mobile money en premier pour les pays africains, carte en premier ailleurs.
2. Une route serveur envoie la demande de paiement à K-Pay avec la référence de la commande, le total lu en base, l'email et le téléphone du client, et l'URL de notification (returl).
3. Carte : redirection vers la page sécurisée de K-Pay. Mobile money : message « Valide le paiement sur ton téléphone ».

## B. Notification K-Pay (route serveur)
1. À chaque notification, contre-vérifier le statut et le montant de la transaction auprès de K-Pay (selon la doc) avant de croire le message.
2. Paiement confirmé et montant exact : commande en paid, stock décrémenté, accès créés pour chaque kit, email de confirmation, événement payment_succeeded.
3. Une même référence K-Pay ne valide jamais deux fois.
4. Échec : commande en cancelled, stock inchangé.

## C. Page /merci
Vérifie le statut toutes les 3 secondes pendant 3 minutes. Payée : récapitulatif, lien vers la bibliothèque (kits) et la page de suivi (physique). En attente : « Valide sur ton téléphone ». Échec : bouton « Réessayer » et lien WhatsApp.

## TESTS DE VALIDATION
- Paiement de test par carte (cartes de test K-Pay) : la commande passe en paid et le kit apparaît dans la bibliothèque.
- Paiement mobile money réel de petit montant : même résultat.
- Une fausse notification envoyée à la route sans transaction réelle ne valide rien.
- La même notification reçue deux fois ne crée qu'un accès et ne retire le stock qu'une fois.
- Aucun code de cette phase n'appelle Polar, et aucun chemin ne passe une commande en paid sans confirmation réelle de K-Pay.
```

### Phase 7 — Ma bibliothèque et suivi de commande

```markdown
OBJECTIF : le client ouvre ses kits et suit ses pièces physiques, sur téléphone comme sur ordinateur.

## A. /compte/bibliotheque
Grille des kits achetés (accès non retirés) avec la progression du tutoriel.
/compte/bibliotheque/[slug] : fichiers avec un bouton « Télécharger », lecteur vidéo avec chapitres cliquables, reprise à la dernière position (enregistrée toutes les 15 secondes ; terminé à 90 %).

## B. Liens protégés (routes serveur)
1. Téléchargement : vérifie l'accès, refuse au-delà de 10 téléchargements du fichier par ce client, enregistre le téléchargement, renvoie un lien signé de 5 minutes.
2. Vidéo : même vérification, lien signé de 3 heures, lecteur sans bouton de téléchargement.

## C. /compte/commandes
Liste des commandes. Détail : articles, total, adresse, frise des statuts (payée → en fabrication → expédiée → livrée) avec dates, transporteur et numéro de suivi, bouton WhatsApp pour une question.

## TESTS DE VALIDATION
- Un lien de téléchargement copié ne marche plus après 5 minutes.
- Un client sans accès qui appelle les routes de téléchargement ou de vidéo est refusé.
- Quand l'admin passe une commande en « expédiée », le client voit le numéro de suivi et reçoit l'email.
```

### Phase 8 — Mesure, onboarding et emails

```markdown
OBJECTIF : savoir où les visiteurs décrochent, et faire revenir les clients.

## A. Événements (table events)
landing_view, product_viewed (famille), add_to_cart, checkout_started, payment_succeeded (montant, moyen, pays, familles), order_shipped, order_delivered, file_downloaded, video_started, video_completed, repeat_purchase.
/admin/tableau-de-bord sur 7 et 30 jours : entonnoir fiche → panier → commande → payée ; ventes par famille et par produit ; taux de réachat ; délais moyens de fabrication et de livraison ; réponses d'onboarding.

## B. Onboarding (après la première connexion, 3 questions à cocher)
1. « Comment nous as-tu connus ? » : TikTok, Instagram, YouTube, Facebook, WhatsApp, Google, ChatGPT ou autre IA, un ami, une convention, autre.
2. « Tes univers préférés ? » (plusieurs choix) : anime, manga, jeu vidéo, fantasy, science-fiction, personnages originaux.
3. « Tu préfères… » : acheter prêt à porter, fabriquer moi-même, les deux.

## C. Emails (un seul bouton par email ; les emails commerciaux seulement avec consentement, lien de désinscription)
- Commande payée ; en fabrication ; expédiée (avec suivi) ; livrée → « Montre-nous ton costume ».
- Kit acheté : lien bibliothèque ; 2 jours après sans vidéo commencée : « Commence par le chapitre 1 » ; 7 jours après sans fin : « Reprends au chapitre [n] ».
- Panier abandonné : 1 h puis 24 h après.
- Nouveau produit : aux clients qui ont coché le même univers.

## TESTS DE VALIDATION
- Un achat de test crée les événements dans l'ordre et envoie l'email de confirmation.
- Un panier abandonné reçoit la relance à 1 h, qui s'arrête si le client paie.
- Le tableau de bord est refusé à un compte client.
```

### Phase 9 — Acquisition

```markdown
OBJECTIF : attirer des otakus sans publicité payante.

## A. Kit gratuit
Un kit à 0 USD : bouton « Obtenir gratuitement », compte requis, accès créé sans paiement, événement free_kit_claimed, même séquence d'emails.

## B. Filigrane des patrons
Au téléchargement d'un PDF, ajouter en pied de page : « KOMA SHOP — [URL] — acheté par [email du client] ». Le fichier stocké ne change pas.

## C. Affiliation (/affiliation)
Lien personnel [URL]/?ref=CODE mémorisé 60 jours ; commission de [20] % (modifiable dans l'admin) sur chaque commande payée apportée, validée 14 jours après la livraison ; paiement manuel par mobile money depuis l'admin ; espace affilié dans le compte.

## D. Galerie « Réalisations »
Photos envoyées par les clients avec accord de publication, liées au produit, validées par l'admin avant affichage.

## E. Pages guides (/guides/[slug])
Modèle d'article (technique, matériau, entretien d'un costume) relié aux produits, JSON-LD Article ; crée les 5 premiers et ajoute-les au sitemap.

## TESTS DE VALIDATION
- Le kit gratuit apparaît dans la bibliothèque sans paiement.
- Un PDF téléchargé porte le filigrane avec l'email du client.
- Une commande passée via ?ref=CODE crée une commission.
- Une photo client n'apparaît qu'après validation.
```

**Plus tard :** une phase 10 pourra ajouter Polar pour le paiement par carte des paniers 100 % kits, quand les ventes numériques à l'international le justifieront. Cette phase devra respecter les règles 9 à 11 du CLAUDE.md : dès qu'un cosplay ou un accessoire est dans le panier, Polar disparaît du choix et seul K-Pay est proposé.

## Légal, confiance et support

Le plus gros risque reste la propriété intellectuelle des personnages, pour les costumes comme pour les kits. Un ayant droit peut faire retirer un produit, un prestataire de paiement peut fermer un compte, et une pièce portant un logo officiel peut être bloquée en douane comme contrefaçon.

| Niveau de risque | Exemples | Conseil |
| --- | --- | --- |
| Sûr | Tes personnages originaux ; archétypes génériques (chevalier, samouraï, magical girl, ninja, steampunk) ; pièces génériques (armure, cape, perruque d'une couleur) | Base du catalogue au lancement |
| Zone grise | Un costume fait main, inspiré d'un personnage connu, décrit sans son nom ni ses images officielles | Très répandu dans le cosplay, mais pas sans risque. À faire valider avant d'en vendre beaucoup |
| À éviter | Logos et symboles déposés reproduits, images officielles, nom de franchise dans le titre, copies du travail d'autres créateurs | Ne jamais publier |

Je ne suis pas juriste : fais valider cette ligne par un avocat en propriété intellectuelle avant de vendre des pièces inspirées de personnages connus, et confirme auprès de K-Pay que ce type de produit est accepté.

### Pages à publier avant la première vente

- **Mentions légales :** NATHANGROUP SARL, Goma, RCCM, Id. Nat., NIF, contact (comme pour SwitchPro).
- **CGV :** produits numériques (accès à vie, usage personnel, pas de revente ni de partage des fichiers) et produits physiques (fabrication sur commande, délais indicatifs, transfert des risques à la livraison).
- **Livraison :** zones, tarifs, délais, droits de douane à la charge du client hors RDC.
- **Retours et remboursements :** par exemple, pièce en stock retournable sous 14 jours, non portée, frais de retour à la charge du client ; pièce sur mesure ni reprise ni échangée, sauf défaut de fabrication ; kit remboursé si un fichier est illisible et non corrigé sous 7 jours.
- **Confidentialité et cookies.**

**Pourquoi ces cases au paiement :** dans l'Union européenne, un client peut se rétracter 14 jours sur un achat en ligne. Deux exceptions te concernent : le contenu numérique livré tout de suite, si le client l'accepte expressément, et les biens fabriqués selon ses mesures. D'où les deux cases de la phase 5.

**Taxes :** K-Pay encaisse mais ne déclare pas les taxes étrangères à ta place. Vérifie avec ton comptable la fiscalité de tes ventes en RDC et à l'étranger.

**Confiance, sans rien inventer :** tes vraies photos, ton portrait et ton atelier dans la page À propos, la galerie de vrais clients, un numéro WhatsApp visible, réponse sous 24 h, et le délai de fabrication annoncé avant le paiement.

## Lancement et acquisition

Ton atout, c'est toi : un créateur qui fabrique tout à la main. Montrer la fabrication fait vendre les costumes prêts à porter, et les mêmes vidéos font vendre les kits. Commence par les trois premières lignes, gratuites, et garde celles que la question « Comment nous as-tu connus ? » fait ressortir.

| Ordre | Technique (n° du guide) | Application à la boutique |
| --- | --- | --- |
| 1 | Contenu court (15) | Coulisses de fabrication, avant/après, essayage, « 1 costume en 60 secondes ». Chaque vidéo finit sur les deux options : l'acheter prêt ou le fabriquer. TikTok, Instagram Reels, YouTube Shorts, statuts WhatsApp |
| 2 | Outil gratuit (2) | Un kit gratuit simple (masque, couronne, bracelet d'armure) contre un email |
| 3 | Filigrane (4) | Le nom de la boutique sur chaque patron imprimé, une petite étiquette cousue dans chaque costume, une carte dans chaque colis avec un QR code vers la galerie |
| 4 | Micro-influenceurs (14) | Prêter ou offrir une pièce à des cosplayeurs de 5 000 à 50 000 abonnés, contre des photos honnêtes et leur lien d'affiliation |
| 5 | Affiliation (1) | [20] % par commande pour les cosplayeurs, clubs et créateurs qui recommandent la boutique |
| 6 | SEO programmatique (11) | Une page par univers et par guide, reliée aux produits (voir la section SEO) |
| 7 | Annuaires et comparatifs (9) + GEO | Être cité dans les listes, blogs et forums de cosplay, et sur Google Business Profile à Goma |

**Deux ajouts propres au cosplay :**

- **Les conventions et événements** (festivals manga, salons, événements locaux) : porter tes créations, un stand avec des pièces en stock, un QR code vers le kit gratuit.
- **Une communauté d'otakus** (domaine 8 du guide) sur Discord ou WhatsApp : entraide, photos de costumes finis, vote pour la prochaine création. À ouvrir après les 50 premiers clients.

La publicité payante attend que les ratios montrent que les clients sont satisfaits et rachètent.

## Plan de lancement et indicateurs

Sept semaines pour ouvrir avec un petit catalogue complet, puis une boucle hebdomadaire. Le rythme est indicatif : la fabrication des premières pièces peut prendre plus de temps.

### Semaine 1 — Valider et préparer

- [ ] Compléter la phrase de départ et tous les crochets du guide.
- [ ] Parler à 5 à 10 otakus et cosplayeurs : achètent-ils prêt à porter ou préfèrent-ils fabriquer ? À quel prix ?
- [ ] Choisir le catalogue de lancement, par exemple 3 cosplays, 5 accessoires, 2 kits payants et 1 kit gratuit, dans la ligne « sûr » côté droits.
- [ ] Confirmer avec K-Pay : carte activée, objets physiques acceptés, pays couverts.
- [ ] Fixer les zones et tarifs de livraison après avoir demandé les prix aux transporteurs depuis Goma.

### Semaine 2 — Produire le contenu

- [ ] Photos de chaque produit (5 angles) et portrait à l'atelier.
- [ ] Patrons, fichiers et tutoriels des kits, avec leurs extraits.
- [ ] Le dépôt de référence design et les photos de héros prêts pour Claude Code.

### Semaines 3 à 6 — Construire avec Claude Code

- [ ] Semaine 3 : phases 1 et 2 (fondations, vitrine).
- [ ] Semaine 4 : phases 3 et 4 (catalogue, admin) ; saisie des produits en brouillon.
- [ ] Semaine 5 : phases 5 et 6 (panier, paiement K-Pay) ; un vrai achat de test par mobile money et par carte.
- [ ] Semaine 6 : phases 7 et 8 (bibliothèque, suivi, mesure, emails) ; pages légales en ligne.
- [ ] Tester toutes les user stories sur téléphone, comme un inconnu.

### Semaine 7 — Lancer

- [ ] Publier le catalogue, déclarer le site dans Google Search Console, créer la fiche Google Business Profile.
- [ ] 5 vidéos courtes par produit phare.
- [ ] Corriger les premiers retours et le dire publiquement (« c'est ajouté »).

### Les ratios à lire chaque semaine

| Ratio | Ce qu'il te dit | Si c'est faible, regarde… |
| --- | --- | --- |
| Visiteurs → fiche produit vue | Le contenu et l'accueil mènent-ils aux produits ? | Héros, vidéos courtes, bonne cible |
| Fiche vue → ajout au panier | La fiche donne-t-elle envie ? | Photos, prix, délai, livraison affichée |
| Commande lancée → payée | Le paiement bloque-t-il ? | Moyens de paiement, relance de panier, WhatsApp |
| Payée → livrée dans le délai annoncé | Tiens-tu tes promesses de fabrication ? | Capacité maximale, délais affichés |
| Kit payé → vidéo terminée | Le tutoriel est-il clair ? | Chapitres, niveau annoncé |
| Clients avec 2 achats ou plus | Le seau tient-il ? | Emails après livraison, nouveaux produits |

### Chaque semaine ensuite — la boucle

1. Lire les ratios et les réponses d'onboarding.
2. Corriger la plus grosse fuite.
3. Ajouter un produit, dans l'univers le plus coché à l'onboarding ; quand un cosplay se vend bien prêt à porter, en tirer un kit.
4. Tester une technique d'acquisition ; garder celle que les clients citent.

Après 2 ou 3 mois : phase 9 (kit gratuit, affiliation, galerie, guides), micro-influenceurs et communauté.

## Lexique

Les mots techniques du guide, expliqués simplement.

| Mot | Ce que ça veut dire |
| --- | --- |
| Dépôt GitHub | Le dossier en ligne qui contient tout le code du site et garde chaque version |
| Claude Code | L'assistant qui écrit et modifie le code directement dans le dépôt |
| CLAUDE.md | Le fichier qui explique le projet à Claude Code ; il le relit à chaque session |
| Next.js | L'outil qui construit les pages du site, rapides et lisibles par Google |
| Supabase | Le service qui garde les comptes, la base de données et les fichiers |
| RLS | Règles de la base qui empêchent chaque client de voir les données des autres |
| Bucket privé | Un dossier de fichiers que personne ne peut ouvrir sans autorisation du serveur |
| Lien signé | Un lien temporaire vers un fichier privé, qui cesse de marcher après quelques minutes |
| Vercel | L'hébergeur qui met le site en ligne à chaque nouvelle version |
| Webhook ou notification de paiement | Le message que K-Pay envoie au site pour dire « ce paiement est réussi » |
| Variable d'environnement | Un réglage secret (clé API) stocké hors du code |
| SEO | Tout ce qui aide le site à apparaître dans Google |
| Données structurées (JSON-LD) | Une description du produit (prix, stock) écrite pour les moteurs de recherche |
| Héros | La grande image avec le titre principal en haut d'une page |
| Sur commande | Pièce fabriquée après le paiement, avec un délai annoncé |

### Sources

- [Guide A→Z SwitchPro (document d'origine)](https://claude.ai/code/artifact/001e256b-a9a8-46c5-befd-4cbf2a867c96)
- [K-Pay — documentation de l'API](https://www.kpay.africa/docs/)
- [Polar — produits acceptés](https://docs.polar.sh/merchant-of-record/acceptable-use)
- [Banque centrale du Congo — agrégateurs de paiement autorisés](https://www.bcc.cd/systemes-et-instruments-de-paiement/cartographie-des-systemes-de-paiement-en-rdc/les-prestataires-de-services-connexes-de-paiement-autorises-par-la-bcc/les-agregateurs-des-systemes-de-paiement)


---
Version en ligne (à jour) : https://claude.ai/code/artifact/8ae6ca57-03c1-4038-a9b7-5816ff7ad1d6
