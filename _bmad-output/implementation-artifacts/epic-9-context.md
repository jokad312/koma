# Epic 9 Context: La croissance, le pilotage et la mise en ligne

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Donner à Jonathan les outils de croissance et de pilotage (Codes promo et commissions d'Affiliés, Relances et Emails ciblés avec consentement, mesure d'audience maison, tableau de bord aux vrais chiffres), puis mettre le site en ligne sur son domaine. L'epic accueille aussi des stories ajoutées après le découpage initial (refonte de l'admin, accueils, inactivité, nouveaux types d'article, performance). Les stories 9.1 à 9.8, 9.10, 9.12, 9.14 et 9.15 sont faites. Restent la refonte de l'admin (9.16 : étapes 3 a et 3 b faites, prochaine étape 4, les 7 pages des maquettes), la performance (9.11) et la mise en ligne (9.9, en dernier). La 9.16 a pour source `docs/design/admin/INVENTAIRE.md` (décisions § 5, bilan de l'étape 3 a § 6) et ses specs `spec-9-16-*`, pas le fichier des epics.

## Stories

- Story 9.1 : Créer un Code promo
- Story 9.2 : Appliquer un Code promo
- Story 9.3 : Ventes et commissions par Code promo
- Story 9.4 : Consentements, Préférences et désinscription
- Story 9.5 : Relances
- Story 9.6 : Emails ciblés
- Story 9.7 : Mesure d'audience maison
- Story 9.8 : Tableau de bord
- Story 9.10 : Mise en page de l'admin (hors fichier des epics)
- Story 9.12 : Accueils selon la connexion
- Story 9.14 : Déconnexion après inactivité
- Story 9.15 : Types d'article « Vêtement » et « Autre article »
- Story 9.16 : Refonte de l'admin selon la maquette et police unique (hors fichier des epics, par étapes)
- Story 9.11 : Performance avant mise en ligne
- Story 9.9 : Mise en ligne (dernière, bloquée par le domaine)

## Requirements & Constraints

- Terminé = lint, types, tests (Vitest, SQL, Playwright) et build verts en local, puis CI GitHub verte sur le dernier commit.
- Écran : axe-core sans violation, clavier, 320 px, zoom 200 %, `prefers-reduced-motion`, `forced-colors`, aucun défilement horizontal à 375 px ; textes uniquement dans `messages/fr.json` et `messages/en.json`.
- Aucune donnée, statut, email ou réponse d'API simulés hors tests ; doubles dans `tests/doubles/`, préfixés `TEST_`. Aucun chiffre fictif dans le tableau de bord.
- Emails : ceux liés à un achat partent toujours ; les Emails commerciaux exigent consentement, respectent la désinscription, ne vont jamais à un Compte mineur au lancement (réglage `emails_commerciaux_mineurs`), et au plus un tous les 2 jours tous types confondus (sinon `ignore` avec motif).
- Refonte admin (9.16) : apparence seulement, sauf ajouts autorisés par Jonathan (cartes de chiffres en lecture seule, recherche et colonne Client des commandes, archivage au lieu de suppression, pastille Téléchargements/Vendus, Extrait du blog…) : lectures serveur réservées à l'admin, écritures par fonctions SECURITY DEFINER avec `p_auteur` et journal d'audit, tests pour chaque ajout. Ce qui retirerait de l'existant se demande.
- Performance (9.11) : ≥ 90 en performance mobile Lighthouse sur accueil, fiche produit, catalogue et festival, mesuré sur build de production ; rapport avant/après ; toute correction qui retire un élément du design ou ajoute une dépendance est proposée, jamais appliquée seule.
- Mise en ligne (9.9) : domaine lu dans `NEXT_PUBLIC_SITE_URL`, variables de production saisies par Jonathan dans hPanel (jamais dans le dépôt), CSP stricte, HSTS, Resend sur le domaine, tâches de purge planifiées, liste d'ouverture des ventes cochée.

## Technical Decisions

- Toute modification de schéma par nouvelle migration ; RLS sur toute table ; écritures par Server Action ou route validée par Zod. Variable d'environnement ajoutée : `.env.example` sans valeur et `src/lib/env.ts`.
- Code promo : une seule définition, aucun compteur d'utilisations en colonne ; réduction figée par ligne, jamais sur la livraison ; commission calculée par vue sur les Commandes payées, hors annulations et remboursements complets.
- Effets externes (emails) toujours via la boîte d'envoi ; mesure d'audience sans cookie, IP, empreinte ni Compte, indicateurs métier calculés par vues SQL.
- Typographie : police unique KOMA Chikara (`src/fonts/koma-chikara/`, `next/font/local` dans `src/lib/fonts.ts`), un seul poids (`font-synthesis: none`, aucune classe de gras), repli Arial ajusté puis `system-ui`. Rôles `t-*` dans `src/app/globals.css`. Barlow ne subsiste que pour le filigrane PDF ; Sakura et `NEXT_PUBLIC_TITRES_SAKURA` sont retirés (la mention Sakura de la 9.9 est caduque).
- Règle des 16 px gardée par `tests/unit/taille-minimale-texte.test.ts` et `tests/e2e/police.spec.ts` ; police unique par `tests/unit/police-unique.test.ts` ; caractères absents par `tests/e2e/police-secours.spec.ts`.
- Admin : couleurs par jetons `--ks-admin-*` de `globals.css` (classes `bg-admin-*`), sombre et clair, contraste AA vérifié ; icônes `lucide-react` (licence notée dans `docs/licences/`). Les pages de l'étape 4 réutilisent les composants communs de `src/components/admin/ui/` (carte de chiffre, panneau, champ de recherche, pastille d'info, pastille de filtre, en-tête de tableau, pagination, avatar à l'initiale, fenêtre de formulaire) au lieu d'en recréer. `scripts/captures-admin.mjs` compare aux maquettes (`docs/references/maquettes-admin/`).

## UX & Interaction Patterns

- Thème Sumi & washi, crème par défaut, sombre au choix, un seul rouge #D7261E ; rouge en texte seulement à ≥ 24 px sur fond uni, jamais sur dégradé, verre, photo ou vidéo ; texte blanc sur bouton rouge. Les maquettes montrent les anciennes polices : DESIGN.md prime (et sur la spec 9.10, qui cite encore Barlow et un autre rouge).
- 16 px minimum partout (site, admin, `/scan`, connexion), hiérarchie par taille, couleur et majuscules (`text-transform`, jamais en dur dans les traductions).
- Palette admin sombre : fond #16130F, menu et barre #211C17, bord #3A322A, cartes de chiffres #2E2923, grand panneau #322F2B, pastilles et champs #181512, en-tête de tableau et recherche #201E1B, fenêtre #24211C, filtre actif #861E1B, avatar de liste #762E27, bouton « Univers » #8C514E (texte blanc sur les trois). Clair : mêmes formes, surfaces #FBF8F2 / #F3EEE4, contour #E0D6C5 autour des cartes et panneaux, filtre et avatar en rose pâle à texte encre.
- Cadre A : menu latéral de 240 px à partir de 1024 px (groupes dans l'ordre de la maquette : principal, Communauté, Réglages avec Prestataires, Codes promo, Réglages ; entrées de 44 px ; entrée courante en bloc collé au bord droit avec trait rouge 4 px et `aria-current`) ; sous 1024 px, barre du bas (Tableau de bord, Commandes, Tâches, « Plus » plein écran), trait rouge 4 px en haut. Barre du haut 68 px : « ESPACE ADMINISTRATEUR » jamais coupé en plein mot, titre de page, ronds thème et langue de 44 px, avatar rouge de 48 px qui ouvre le menu du profil (Mon profil, Paramètres du profil, Aide en petite fenêtre, Voir le site, Se déconnecter ; flèches, Échap rend le focus à l'avatar). Plus d'encart « Besoin d'aide ? ».
- Formulaires : restent des pages sur les mêmes routes, dessinées en fenêtre de 670 px sur fond assombri ; Échap et croix ramènent à la liste, après « Quitter sans enregistrer ? » si un champ a changé. Pagination ‹ › de 20 lignes avec « Page X / Y » ; filtres en pastilles (`aria-pressed` ou `aria-current`).
- Tableau de bord : graphique 30 jours en rouge ; « Performance du jour » à l'heure de Goma ; autres graphiques en barres avec valeur écrite et « Voir les données en tableau », sans couleur par série ; cartes de tâche à zéro gardées, en ton atténué. Interrupteurs avec le mot « Actif » / « Désactivé ».
- `/scan` reste plein écran sans cadre admin ; image de connexion masquée sous 768 px. En-tête public : liens à partir de 1280 px, menu ☰ en dessous.

## Cross-Story Dependencies

- 9.16 suit un ordre validé étape par étape, un commit par étape et CI verte : police, 9.15, 3 a (police partout et 16 px), 3 b (cadre A et composants communs, faite quand la CI de `main` est verte après fusion), puis étape 4 : les 7 pages des maquettes, une spec et un commit par page (page 1 = tableau de bord), avec captures ; enfin les autres pages et la connexion.
- 9.11 mesure en local ; la mesure sur le domaine réel est refaite dans 9.9.
- 9.9 dépend du domaine (Q-D1) et de toutes les autres stories ; elle active en production le crochet de jeton `public.crochet_role_jeton` de la 9.12 et pose `ACTIVITE_COOKIE_SECRET` (9.14).
