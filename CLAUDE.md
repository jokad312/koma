# KOMA SHOP — instructions pour Claude Code

## Le produit
Boutique en ligne pour otakus, tenue par un seul créateur : Jonathan Manduara Tshimpaka, NATHANGROUP SARL, Goma, RDC.
Domaine : pas encore acheté (Q-D1) ; l'adresse du site est lue dans NEXT_PUBLIC_SITE_URL, jamais écrite en dur. Développement et tests en local d'abord. Cible : d'abord les otakus africains, l'international ensuite.
Trois familles de produits :
- cosplay : costume complet fait main, physique, en stock ou sur commande (tailles XS à XXL ou sur mesure)
- accessoire : perruque, arme factice, masque, armure, bijou ; physique
- kit : numérique = fichiers (PDF A4 et US Letter, SVG, STL) + tutoriel vidéo en chapitres, accès à vie
Un cosplay peut être lié à son kit : la fiche propose « Prêt à porter » et « Le fabriquer moi-même ».
Le site comprend aussi un blog et une section Événements, avec vente de pass nominatifs à code QR.

## Stack
Next.js (App Router, TypeScript, Server Components par défaut), Tailwind CSS, Supabase (Auth, Postgres avec RLS, Storage, Cron), vidéos de kit sur Bunny Stream (bibliothèque privée), hébergement Hostinger Business Web Hosting (application Node.js 24 reliée au dépôt GitHub jokad312/koma, déploiement automatique à chaque push), paiement : couche commune avec un adaptateur par prestataire. Mobile money via PawaPay, K-Pay, MaishaPay et GeniusPay ; carte via K-Pay pour les paniers avec produit physique, via Polar pour les paniers 100 % kits. Emails Resend.
Référence design : `_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/DESIGN.md` (apparence : thème Sumi & washi, crème par défaut et sombre au choix, un seul rouge #E3261C, Sakura Town pour les grands titres en majuscules sans accents, Barlow pour le texte) et `EXPERIENCE.md` (fonctionnement, états, parcours, accessibilité), dans le même dossier. Les maquettes de `mockups/` sont une inspiration ; en cas de conflit, les deux documents priment. Photos : [DOSSIER OU LIEN DES PHOTOS].

## Langues
Français et anglais, via /fr et /en. Aucun texte visible en dur hors des fichiers de traduction.

## Prix et livraison
Prix en USD, identique dans tous les pays, toujours affiché en USD. Chaque prix est fixé par l'admin, produit par produit. La conversion en devise locale est faite par l'agrégateur ; le site n'affiche que l'USD.
Livraison des produits physiques au lancement : Goma et Bukavu uniquement. Un forfait de livraison par ville, fixé dans l'admin. Goma est livrée en moins d'un jour, Bukavu (de l'autre côté du lac Kivu) en un jour au plus. À Goma, le client peut aussi retirer sa commande gratuitement.
Délai de fabrication propre à chaque produit ou variante, affiché avant le paiement.
Les kits n'ont pas de livraison et se vendent dans tous les pays.

## Règles absolues
1. Les fichiers des kits sont dans le bucket privé kits-private. Les vidéos complètes sont dans une bibliothèque Bunny Stream privée. Fichiers et vidéos ne s'ouvrent que par un lien ou un jeton signé de courte durée, créé côté serveur après vérification d'un accès payé. RLS sur toutes les tables.
2. Une commande ne passe en paid que côté serveur, et seulement si le serveur a obtenu une confirmation fiable du prestataire : soit une notification dont la signature est vérifiée (route serveur de notification, une par prestataire), soit une contre-vérification du statut auprès de l'API du prestataire (route de notification ou tâche serveur de contre-vérification). Pour K-Pay, la notification ne sert que de signal : c'est l'interrogation de son API qui fait foi. Jamais le navigateur. Une même référence de paiement ne valide jamais deux fois une commande. Chaque commande enregistre le prestataire, sa référence de transaction, le montant et la devise. Chaque tentative de paiement enregistre le montant attendu en centimes USD, et le montant et la devise réellement débités tels que l'agrégateur les renvoie. Une commande ne passe en paid que si le prestataire confirme le succès ET que le montant reçu correspond au montant attendu (conversion faite par l'agrégateur, selon sa documentation). Montant inférieur : la commande ne passe pas en paid et elle est signalée dans l'admin avec le montant reçu. Montant supérieur, ou paiement sur une commande déjà payée ou expirée : trop-perçu. Les trop-perçus se remboursent à la main depuis l'admin ; aucun remboursement automatique au lancement.
3. Prix, stock et frais de livraison sont toujours calculés côté serveur, depuis la base.
4. Les secrets sont dans les variables d'environnement (.env.local, variables d'environnement de l'application Node.js sur Hostinger), jamais dans le code commité. Tenir .env.example à jour. Le dépôt GitHub est public : aucun secret, aucune clé, aucun numéro de marchand, aucune donnée client, aucun export de base dans le dépôt, même dans les tests ou la documentation. Les fichiers .env*, les exports et les sauvegardes restent dans .gitignore.
5. Honnêteté : aucun avis, chiffre, logo ou témoignage inventé.
6. Propriété intellectuelle : aucune image ni aucun logo officiel d'une franchise ; seulement les photos du créateur. Aucune police, image ou fichier tiers n'entre dans le dépôt sans licence vérifiée et notée dans docs/licences/.
7. Mobile d'abord (375 px de large, sans défilement horizontal), contraste suffisant, texte alternatif sur chaque image, navigation au clavier.
8. SEO : metadata, Open Graph et données structurées JSON-LD sur chaque page publique.

## Paiement : qui encaisse quoi (règle stricte)
9. Mobile money : quatre agrégateurs en parallèle (PawaPay, K-Pay, MaishaPay, GeniusPay), chacun branché par son propre adaptateur. Le client choisit son pays et son opérateur ; le serveur choisit l'agrégateur actif qui couvre ce couple, selon l'ordre de priorité réglé dans l'admin. Si l'agrégateur prioritaire échoue ou est désactivé, il propose le suivant qui couvre le même couple. La couverture pays-opérateur de chaque agrégateur vient de sa documentation officielle et des contrats marchands : ne jamais la supposer.
10. Carte : un panier qui contient au moins un produit physique (cosplay ou accessoire) se paie par carte via K-Pay, jamais via Polar. Polar sert uniquement aux paniers 100 % numériques (kits) : dès qu'un produit physique entre dans le panier, Polar disparaît des choix. Ne jamais créer de produit Polar pour un article physique ni présenter un produit physique comme numérique. MaishaPay et GeniusPay acceptent aussi la carte : solutions de secours possibles pour plus tard, non branchées au lancement. Les pass d'événement se paient par mobile money (quatre agrégateurs) ou par carte via K-Pay, jamais via Polar sans accord écrit de Polar.
11. La route serveur qui choisit le prestataire vérifie en base la famille de chaque article, ainsi que le moyen de paiement, le pays et l'opérateur choisis. Des tests automatiques prouvent qu'un panier mixte ne part jamais chez Polar, qu'un pass ne part jamais chez Polar, que le repli passe bien à l'agrégateur suivant et qu'une référence déjà utilisée est refusée.

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
- `npm run dev` : serveur de développement (http://localhost:3000)
- `npm run lint` : ESLint
- `npm run typecheck` : types (`next typegen` puis `tsc --noEmit`)
- `npm test` : Vitest
- `npm run test:sql` : tests SQL (`supabase test db`, base locale Supabase, Docker requis)
- `npm run test:e2e` : Playwright (navigateur Chromium : `npx playwright install chromium`)
- `npm run build` : build de production
- `npm run types` : régénère `src/lib/supabase/types.ts` depuis la base locale ; `npm run db:link` puis `npm run db:push` pour relier et migrer `koma-dev`
- Aide BMad : `/bmad-help` (prérequis : `uv` installé)
