---
title: 'Correctif de design 9.10 : mise en page de l''admin (disposition en L, grilles Produits et Utilisateurs)'
type: 'feature'
created: '2026-11-12'
status: 'draft'
route: 'plan'
---

## Intent

**Demande de Jonathan (2026-11-12) :** refondre la mise en page de l'admin d'après 6 captures d'un autre projet (`docs/references/maquettes-admin/`, ignoré par git, jamais commité). On reprend la **disposition** seulement ; l'identité reste KOMA (DESIGN.md : crème, noir, rouge #E3261C, Barlow, thème sombre existant). Ni violet, ni « Otaku Mania », ni icônes ou textes des captures.

**Constat :** `CoqueAdmin` (20 pages l'utilisent) place une barre latérale de 14 rem sous l'en-tête et au-dessus du pied du site ; la 9.8b a déjà une barre du bas et un panneau « Plus » sur mobile (à garder).

## Décisions

1. **Disposition en L (ordinateur, `md` et plus)** : barre latérale fixe à gauche (pleine hauteur) et bandeau en haut du contenu. L'en-tête et le pied du site sont masqués dans l'admin (`display: none` par `body:has([data-coque-admin])`, donc retirés des lecteurs d'écran), la page admin n'a donc qu'une chrome. Le lien « Voir le site » ramène au site.
2. **Barre latérale** : bloc de marque (logo lu dans les réglages s'il existe, sinon les initiales du nom ; nom du site lu par `lireNomSite`), groupes avec titres, page active surlignée (`aria-current`), encart « Besoin d'aide ? » avec « Voir le site » en bas. Groupes (seules les pages existantes) :
   - **Navigation** : Tableau de bord, Commandes, Tâches, Produits, Univers, Utilisateurs (nouvelle, Admin seulement).
   - **Communauté** : Événements, Scan, Galerie, Blog, Messages.
   - **Réglages** : Codes promo, Prestataires, Réglages.
   « Kits » n'a pas de page propre (les Kits sont une famille de Produits) : non ajouté (« sans en inventer »).
3. **Bandeau** : sur-titre « Espace administrateur », titre de la page (libellé de la section, lu depuis la navigation ; les `h1` des pages restent), à droite nom (ou email partiellement masqué) et rôle de l'utilisateur connecté, avec ses initiales. Le rôle vient de la base (`lireRole`).
4. **Mobile** : barre du bas et panneau « Plus » de la 9.8b inchangés dans leur comportement ; le bandeau s'affiche aussi (compact). Aucune barre latérale.
5. **Produits en grille** (1 colonne sur téléphone, 2 à 4 selon la largeur) : carte = image (photo principale ; sans photo, un bloc neutre avec le nom, jamais une image inventée), nom, famille et univers, prix, statut (Publié / Brouillon), état du stock, actions **Modifier** et **Publier / Dépublier** (actions existantes de `PublicationProduit`). Recherche en haut (filtre sur le nom, famille, univers, côté client sur la liste déjà chargée) et compteur « N produits ». Carte entière cliquable par **un seul lien** (le lien du nom, étendu par `::after`) ; les boutons d'action restent des contrôles distincts au-dessus du lien étendu.
6. **Utilisateurs (nouvelle page, Admin seulement, lecture seule)** : grille de cartes : initiales, pseudo ou email partiellement masqué (`ab***@gmail.com`), date d'inscription, rôle, nombre de Commandes et de Pass. Aucun changement de rôle depuis l'interface. Lecture serveur seulement : fonction SQL `lister_utilisateurs_admin(p_auteur)` (security definer, `exiger_admin`), exécutable par `service_role` seulement, test pgTAP ; l'email complet ne quitte jamais la base ; le masquage est fait en SQL. Recherche (sur l'email masqué, les initiales et le rôle) et compteur « N utilisateurs ».
7. **Accessibilité** : cibles de 44 px, clavier, focus visible, landmarks (`nav`, `header`, `main`, une seule `main` : celle du site est conservée, l'admin n'en ajoute pas), `aria-current`, une seule `h1` par page.
8. **Textes** FR et EN dans `Admin.*` ; aucun texte en dur. Droit de la page Utilisateurs : `roles.gerer` (Admin seulement ; à confirmer dans la matrice).

## Critères d'acceptation

1. Ordinateur : barre latérale fixe + bandeau ; l'en-tête et le pied du site ne sont pas visibles dans l'admin ; mobile : barre du bas et « Plus » comme avant (tests de la 9.8b verts).
2. Toutes les entrées de navigation existantes sont présentes une seule fois ; « Utilisateurs » n'apparaît que pour l'Admin ; l'Assistant ne voit pas l'entrée et la page lui est refusée.
3. Bandeau : nom ou email masqué, rôle et initiales du compte connecté.
4. Grille Produits : carte (image, nom, famille, univers, prix, statut, stock, actions) ; recherche ; compteur ; un seul lien par carte.
5. Page Utilisateurs : cartes, données masquées, lecture seule ; `anon` et `authenticated` n'exécutent pas la fonction (pgTAP) ; refus sans droit d'Admin.
6. Axe : aucune violation sérieuse ; 375 px sans défilement horizontal ; clavier et focus visible.
7. Captures Playwright avant et après (1280 px et 375 px) dans `docs/captures-admin/` (ignoré par git), pour comparaison par Jonathan.
8. Lint, types, tests, build, e2e et CI verts ; revue par sous-agents (design, accessibilité).

## Fichiers (prévus)

`src/components/admin/CoqueAdmin.tsx`, `NavigationAdmin.tsx`, `BandeauAdmin.tsx`, `ListeProduits.tsx` (grille), `GrilleUtilisateurs.tsx`, `src/app/[locale]/admin/utilisateurs/page.tsx`, `src/modules/admin/utilisateurs.ts`, `supabase/migrations/2027011310*.sql`, `supabase/tests/utilisateurs_admin.test.sql`, `src/app/globals.css`, `messages/{fr,en}.json`, tests Vitest et e2e.
