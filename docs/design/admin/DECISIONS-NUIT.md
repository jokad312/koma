# Refonte admin — décisions de la nuit du 2026-11-17

Consigne de Jonathan (2026-11-17) : enchaîner toutes les pages de la refonte admin sans attendre sa validation ; il valide tout ensemble le lendemain. Ce fichier note chaque choix fait sans lui, les migrations et les incidents de CI.

## Règles de la nuit (rappel pour chaque page)

- Sources : `docs/references/maquettes-admin/`, `docs/design/admin/INVENTAIRE.md` (réponses Q1 à Q32), DESIGN.md, composants de `src/components/admin/ui/` (3 b), KOMA Chikara, 16 px minimum, un seul rouge #D7261E.
- On garde TOUT l'existant : chaque champ, filtre, action, réglage et droit par rôle. Ce qui manque sur la maquette est ajouté dans le même style.
- Par page : courte spec dans `_bmad-output/implementation-artifacts/`, code, tests, captures (côte à côte + superposées à 50 % avec la maquette quand elle existe, 1366 × 768 sombre, plus clair et 390 px), revue de code BMad, puis un commit par page, poussé sur la branche `9-16-pages-admin` (une seule PR, rien fusionné dans main).
- Question sans réponse : option la plus fidèle à la maquette et aux décisions de Jonathan, sans rien retirer ; notée ici (page, question, option, raison).
- Migrations : seulement si nécessaire ; nouvelles ; koma-dev seulement ; listées ici.
- Interdit : paiement (aiguillage, confirmer_paiement, adaptateurs), droits d'accès (RLS, rôles), suppression de données réelles, push --force, test sauté ou désactivé.
- Données TEST_ supprimées après chaque page ; contrôle final à 0.
- CI rouge : corriger avant la page suivante ; après 2 tentatives sans succès, le noter ici et passer à la suite.
- `npm run test:e2e` (jamais `npx playwright test`).

## Migrations

| Page | Migration | Objet | koma-dev |
|---|---|---|---|
| Tableau de bord (9.16 c) | `20270120100000_tableau_chiffres.sql` | `tableau_chiffres(p_auteur)` : cartes de chiffres, Événements à venir, Pass vendus 7 / 30 jours (lecture seule, Admin, service_role) | appliquée le 2026-11-17 |
| Tableau de bord (9.16 c), correctif de revue | `20270120110000_tableau_chiffres_publie.sql` | `tableau_chiffres` : « Produits publiés » exclut la publication programmée (`publie_le <= now()`) | appliquée le 2026-11-17 |

## Décisions

| Page | Question | Option choisie | Raison |
|---|---|---|---|
| Tableau de bord | Q9 cartes, Q13 SM-4, tâches | Réponses de Jonathan du 2026-11-17 (spec 9.16 c, décisions 1 à 3) | Décidé par Jonathan avant la nuit |
| Tableau de bord | Graphique « Par jour » (barres horizontales, 7 ou 30 jours selon le sélecteur) | Remplacé par le graphique vertical des 30 jours de la maquette (Q10) ; prestataire et famille gardent le sélecteur | Même donnée, les 7 derniers jours restent visibles dans les 30 |
| Tableau de bord | Dates sous l'axe à 390 px | Une date tous les 10 jours sous 640 px (tous les 5 jours au-delà) | À 5 jours, les dates de 16 px se chevauchent sur ~240 px de graphique |
| Tableau de bord | Axe sans aucune vente | Échelle de 0 à 5 $, barres à zéro | Une échelle n'est pas une donnée ; jamais de barre inventée |
| Tableau de bord | Titre de niveau 1 et intro | Titre « Tableau de bord » gardé pour les lecteurs d'écran (le nom est dans la barre du haut) ; intro déplacée sous la partie de la maquette | Rien retiré, maquette respectée |
| Tableau de bord | Titres des listes du bas | « Toutes les tâches » (décision 3) et « Tous les indicateurs » (même logique, ancre #indicateurs) | Deux sections « À faire » / « Indicateurs » auraient le même nom |
| Tableau de bord | Carte SM-1 | Montant total payé sur 7 et 30 jours ; le détail par famille reste dans la liste complète | Carte étroite de la maquette |
| Tableau de bord | Revenu total long | Écrit plus petit à partir de 1 000 USD (seuil sur la valeur), jamais abrégé | Reste dans la carte de 255 px |
| Tableau de bord | Taux de paiements réussis | Arrondi à l'inférieur | Jamais 100 % s'il y a eu un échec |
| Tableau de bord | Performance du jour au plafond de 200 commandes | « au moins N » | Proposition Q11 de l'inventaire |
| Commandes | Cartes (Q14) | Mêmes définitions que le tableau de bord, « depuis le début » ; PAIEMENTS ABOUTIS = nombre de tentatives réussies (icône coche, pas %) ; EN ATTENTE = commandes en attente de paiement non expirées | Q14 = « mêmes options que Q9 », Jonathan a choisi (a) pour Q9 |
| Commandes | Carte REVENU PAYÉ pour l'Assistant | Masquée (droit `chiffre_affaires.voir` réservé à l'Admin) | Garder les droits par rôle |
| Commandes | Recherche par client | Nom (métadonnées de connexion) ou email, recherche faite en base ; email toujours masqué à l'écran | Q15/Q17 autorisés ; même masquage que la page Utilisateurs |
| Produits | Archivage (Q22) | Archiver = dépublier + marquer archivé ; filtre « Archivés » ; « Restaurer » ramène en brouillon ; un produit archivé ne peut pas être publié | Q22 : retiré de la boutique et des listes, récupérable ; aucune lecture publique à changer |
| Produits | VENDUS : N | Nombre d'articles (quantités) dans les commandes payées, hors lignes annulées et commandes annulées ou remboursées | Même règle d'argent que SM-1 |
| Formulaire produit | Fond de la fenêtre (D1) | Plein écran assombri et flouté, sans la liste derrière | Q23 option (a) ; note de revue 9.16 b |
| Formulaire produit | Photos et fichiers à la création | Disponibles après le premier enregistrement, comme aujourd'hui, avec un texte qui le dit | Ne rien changer au stockage ; Q23 garde les routes |
| Blog | Extrait sur la carte avant la page 6 | 160 premiers caractères du contenu sans Markdown ; le champ Extrait (page 6) prend le dessus quand il est rempli | Q28 |
| Blog | Date de la carte | Date de publication, sinon de modification | La maquette montre une seule date courte |
| Nouvel article | Longueur de l'extrait | 300 caractères au plus, FR et EN, facultatif | « Résumé court » ; la carte en montre 160 sans extrait |
| Codes promo | Filtres | TOUS, ACTIFS, INACTIFS | La corbeille désactive (Q22) : il faut retrouver les codes inactifs |
| Codes promo | « + NOUVEAU CODE » et crayon | Formulaires existants dans une fenêtre sur la même route (paramètre d'adresse) | Q23 sans nouvelle route |
| Codes promo | Recherche | Dans la liste déjà lue (code, affilié), sans nouvelle requête | Q15 n'autorise une nouvelle requête que pour les commandes |
| Commandes | Page de détail d'une commande | Redessinée avec les « autres pages et leurs détails » (étape 8), pas avec la liste | Une page par commit ; la maquette ne montre que la liste |

## CI

| Page | Commit | Résultat | Remarque |
|---|---|---|---|
