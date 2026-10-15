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

## Méthode de travail : BMad Method (parcours standard greenfield)
Le projet suit la méthode BMad v6, installée dans `_bmad/` et `.claude/skills/bmad-*`.
- Source de vérité métier : `docs/guide-koma-shop.md`. Les agents BMad (Analyste, PM, UX, Architecte, Dev) s'en servent comme matière première et ne contredisent jamais les règles 1 à 15 ci-dessus sans validation explicite de Jonathan.
- Documents de planification : `_bmad-output/planning-artifacts/` (brief, PRD, UX, architecture, epics). Documents d'implémentation : `_bmad-output/implementation-artifacts/` (sprint, stories, revues).
- Une story à la fois, dans une nouvelle session pour chaque workflow. Proposer un plan avant de coder et attendre la validation.
- Avant de déclarer une story terminée : lint, vérification des types, tests et build sans erreur.
- À la fin : liste des fichiers changés, ce qu'il faut tester à la main, et un message de commit proposé.
- Ne jamais modifier une migration déjà appliquée : en créer une nouvelle.
- En cas de doute sur une règle métier, demander plutôt que deviner.
- Mettre à jour ce fichier quand une décision change. Ne pas modifier `_bmad/config.toml` ni `_bmad/config.user.toml` (gérés par l'installateur) : passer par `_bmad/custom/`.

## Commandes
(à compléter quand le projet Next.js sera créé : dev, lint, typecheck, test, build)
- Aide BMad : `/bmad-help` (prérequis : `uv` installé)
