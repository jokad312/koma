# Epic 9 Context: La croissance, le pilotage et la mise en ligne

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Donner à Jonathan les outils de croissance et de pilotage (Codes promo et commissions d'Affiliés, Relances et Emails ciblés avec consentement, mesure d'audience maison, tableau de bord aux vrais chiffres), puis mettre le site en ligne sur son domaine. L'epic accueille aussi des stories ajoutées après le découpage initial (refonte de l'admin, accueils, inactivité, nouveaux types d'article, performance). Les stories 9.1 à 9.8, 9.10, 9.12, 9.14 et 9.15 sont faites ; restent la refonte de l'admin (9.16, à partir de l'étape 3 b), la performance (9.11) et la mise en ligne (9.9, en dernier). La 9.16 a pour source `docs/design/admin/INVENTAIRE.md` (décisions § 5, bilan de l'étape 3 a § 6), pas le fichier des epics.

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
- Typographie : police unique KOMA Chikara (`src/fonts/koma-chikara/`, `next/font/local` dans `src/lib/fonts.ts`), un seul poids (`font-synthesis: none`, aucune classe de gras), repli Arial ajusté puis `system-ui`. Rôles `t-*` dans `src/app/globals.css`. Barlow ne subsiste que pour le filigrane PDF ; Sakura et l'option `NEXT_PUBLIC_TITRES_SAKURA` sont retirées (la mention Sakura de la 9.9 est caduque).
- Règle des 16 px gardée par `tests/unit/taille-minimale-texte.test.ts` et `tests/e2e/police.spec.ts` ; police unique par `tests/unit/police-unique.test.ts` ; caractères absents par `tests/e2e/police-secours.spec.ts`.
- Icônes de l'admin : `lucide-react`.

## UX & Interaction Patterns

- Thème Sumi & washi, crème par défaut, sombre au choix, un seul rouge #D7261E ; rouge en texte seulement à ≥ 24 px sur fond uni, jamais sur dégradé, verre, photo ou vidéo ; texte blanc sur bouton rouge. Les maquettes montrent les anciennes polices : DESIGN.md prime (et sur la spec 9.10, qui cite encore Barlow et un autre rouge).
- 16 px minimum partout (site, admin, `/scan`, connexion), hiérarchie par taille, couleur et majuscules (`text-transform`, jamais en dur dans les traductions).
- Admin : barre latérale sur ordinateur (entrées 44 px, entrée courante avec trait rouge 4 px), barre de 4 onglets en bas sur mobile. Interrupteurs avec le mot « Actif » / « Désactivé ». Graphiques en barres avec valeur écrite et « Voir les données en tableau », sans couleur par série. Cartes de tâche à zéro gardées, en ton atténué.
- Décisions 9.16 : menu dans l'ordre de la maquette (groupe Réglages : Prestataires, Codes promo, Réglages) ; menu du profil (Mon profil, Paramètres du profil, Aide, Voir le site, Se déconnecter) ; graphique 30 jours en rouge ; « Performance du jour » à l'heure de Goma ; filtres en pastilles ; pagination ‹ › de 20 lignes avec « page X / Y » ; formulaires restant des pages sur les mêmes routes mais dessinés en fenêtre (Échap et croix ramènent à la liste) ; `/scan` reste plein écran sans cadre admin ; image de connexion masquée sous 768 px. Couleurs sombres relevées : cartes #2E2923, grand panneau #322F2B, pastilles et champs #181512, bouton « Univers » #8C514E.
- En-tête public : liens à partir de 1280 px, menu ☰ en dessous. À corriger à l'étape 3 b : « ESPACE ADMINISTRATEUR » coupé en plein mot à 1024 px.

## Cross-Story Dependencies

- 9.16 suit un ordre validé étape par étape, un commit par étape et CI verte : police (fait), 9.15 (fait), 3 a police partout et 16 px (fait), 3 b cadre A et composants communs, puis les 7 pages des maquettes et leurs captures, puis les autres pages et la connexion.
- 9.11 mesure en local ; la mesure sur le domaine réel est refaite dans 9.9.
- 9.9 dépend du domaine (Q-D1) et de toutes les autres stories ; elle active en production le crochet de jeton `public.crochet_role_jeton` de la 9.12 et pose `ACTIVITE_COOKIE_SECRET` (9.14).
