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
| Commandes (9.16 d) | `20270121100000_commandes_admin_liste.sql` | `commandes_admin_liste(p_auteur, statut, famille, prestataire, zone, recherche, page, taille)` : liste filtrée, recherchée et paginée avec le client (nom, email masqué en base), total et chiffres des cartes sans revenu (lecture seule, Admin et Assistant, service_role) | appliquée le 2026-11-17 |
| Commandes (9.16 d), correctifs de revue | `20270121110000_commandes_admin_liste_correctifs.sql` | `commandes_admin_liste` : email cherché seulement en entier, email d'un caractère masqué, nom repris de `name` si `full_name` est vide, en attente sans échéance = non expirée | appliquée le 2026-11-17 |
| Produits (9.16 e) | `20270122100000_produits_archivage.sql` | Colonne `produit.archive_le` ; déclencheur `produit_archive_non_publie` (archivé jamais publié, KS_PRODUIT_ARCHIVE) ; `publier_produit` recréée (refus d'un archivé avant la complétude) ; `archiver_produit` / `restaurer_produit(p_auteur, p_id)` (Admin, journal, service_role) ; `produits_admin_compteurs(p_auteur)` (lecture seule, Admin, service_role) | appliquée le 2026-11-17 (test SQL 30/30 sur koma-dev avant, transaction annulée) |
| Produits (9.16 e), correctifs de revue | `20270122110000_produits_archivage_correctifs.sql` | `produits_admin_compteurs` : TÉLÉCHARGEMENTS ne compte que les accès dont la Commande d'origine est payée (non offerte) ; mêmes droits | appliquée le 2026-11-17 (test SQL 34/34 sur koma-dev avant, transaction annulée) |

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
| Commandes | Recherche par email (revue) | Email trouvé seulement s'il est saisi en entier (sans casse) ; numéro et nom restent en recherche partielle | Une recherche partielle permettait de reconstituer caractère par caractère une adresse que l'écran masque |
| Produits | Archivage (Q22) | Archiver = dépublier + marquer archivé ; filtre « Archivés » ; « Restaurer » ramène en brouillon ; un produit archivé ne peut pas être publié | Q22 : retiré de la boutique et des listes, récupérable ; aucune lecture publique à changer |
| Produits | VENDUS : N | Nombre d'articles (quantités) dans les commandes payées, hors lignes annulées et commandes annulées ou remboursées | Même règle d'argent que SM-1 |
| Produits | TÉLÉCHARGEMENTS : N | Nombre d'acheteurs du Kit : accès (`acces_kit`) dont la Commande d'origine est payée ; un Kit offert (Commande offerte) n'est pas compté | Q20 : « acheteurs qui ont l'accès » (correctif de revue ; la première version comptait aussi les Kits offerts) |
| Produits | Bouton « Catégories » (C3) | « UNIVERS » (#8C514E, jeton `admin-univers`) vers `/admin/univers` ; le menu latéral a aussi « Univers » (même destination) | Q19 |
| Produits | Filtre « Archivés » | Deux pastilles TOUS / ARCHIVÉS (boutons `aria-pressed`, état local) ; « Tous » = tous les non archivés | La liste entière est déjà lue (recherche locale de la 9.10) : aucune nouvelle requête |
| Produits | Carte de grille (C6 #1D1B1A) | Nouveau jeton `admin-grille` (#1D1B1A sombre, #F3EEE4 clair) ; vignette et nom sur `admin-champ` | Aucun jeton existant ne valait #1D1B1A ; le panneau #322F2B porte les cartes |
| Produits | Statut (C16) | `Pastille` avec icône (coche, crayon, archive) + mot PUBLIÉ / BROUILLON / ARCHIVÉ | Jamais la couleur seule ; « Archivé » n'existait pas dans `PastilleStatut` |
| Produits | Clic sur la carte | Plus de carte entièrement cliquable : le crayon « Modifier X » est le lien vers la fiche | La maquette porte des actions distinctes (crayon, corbeille, Publier) ; un lien étendu les aurait recouvertes |
| Produits | « Restaurer » | Sans confirmation (action sans perte, réversible par l'archivage) | Q22 n'exige la confirmation que pour la corbeille |
| Produits | Après archivage ou restauration | Annonce en statut (« Produit archivé. » / « Produit restauré… ») et focus sur le compteur « N PRODUITS » | La carte quitte la vue : le focus ne doit pas tomber sur la page entière |
| Produits | Liens de produit du blog | Le sélecteur « produit lié » (nouvel article, modification) ne propose plus les produits archivés, sauf celui déjà lié à l'article | Correctif de revue : un archivé est retiré des listes ; la valeur actuelle d'un article n'est jamais cassée |
| Produits | Fiche d'un produit archivé (page 4) | Le panneau Publication affiche « Archivé » et « Restaurer » (sans confirmation, comme la carte) à la place de Publier ; refus `produit_archive` avec son message dédié ; le formulaire lui-même n'est pas changé | Correctif de revue : la fiche ne doit pas présenter un archivé comme un brouillon publiable |
| Formulaire produit | Fond de la fenêtre (D1) | Plein écran assombri et flouté, sans la liste derrière | Q23 option (a) ; note de revue 9.16 b |
| Formulaire produit | Photos et fichiers à la création | Disponibles après le premier enregistrement, comme aujourd'hui, avec un texte qui le dit | Ne rien changer au stockage ; Q23 garde les routes |
| Formulaire produit | Ce que couvre le fond plein écran | Tout l'écran, menu latéral et barre du haut compris ; le cadre recouvert devient inerte (clavier, lecteurs d'écran) et la page derrière ne défile plus ; la fenêtre défile à l'intérieur, son en-tête (titre, ENREGISTRER, ×) reste visible ; à 390 px, toute la largeur et toute la hauteur, sans coins arrondis | « Plein écran » (Q23 a) ; sans inertie, Tab menait à des liens cachés sous le fond |
| Formulaire produit | Place de la famille | Après les zones de la maquette (ordre de la spec : maquette en tête, puis famille, adresse…) ; la saisie déjà faite (titres, descriptions, adresse, univers, prix) est reprise quand on choisit Kit, et rendue quand on revient à une autre famille | Le formulaire du Kit est un autre composant : sans reprise, choisir Kit après avoir tapé le nom aurait tout effacé |
| Formulaire produit | Un formulaire coupé en deux | Deux `<form>` qui envoient la même saisie : le premier (nom → univers) porte l'identifiant soumis par ENREGISTRER ; le second (famille → fin) garde la touche Entrée et le bouton « Enregistrer » du bas | Les zones fichiers, image et statut ont leurs propres formulaires, qui ne peuvent pas être imbriqués |
| Formulaire produit | Menu STATUT (Q26) | Bouton qui ouvre une liste Brouillon / Publié / Archivé (statut actuel marqué), pas une liste déroulante native ; Publié → publication (même contrôle, liste des manques, le statut reste Brouillon) ; Brouillon → dépublication ou restauration ; Archivé → confirmation puis archivage de la page 3 ; Publié indisponible pour un archivé | Avec une liste native, une flèche du clavier aurait publié le produit ; « Archivé » ajouté par Q26 |
| Formulaire produit | Lien « Retour aux produits » | Retiré : la croix (« Fermer et revenir à la liste ») mène au même endroit, Échap aussi | Fenêtre de la maquette (D5) ; même destination, aucune action perdue |
| Formulaire produit | Zone de fichiers du Kit (D12) | Le champ de fichier natif, invisible, couvre toute la zone : un clic ouvre le choix, un fichier glissé y est déposé ; « TÉLÉVERSER » est la pastille de la zone ; l'envoi reste « Ajouter le fichier » (nom FR et EN, format A4 / Letter) ; la liste des fichiers (remplacer, supprimer) reste plus bas | Aucun changement d'envoi (TUS, bucket privé) ; le glisser-déposer natif évite tout code d'envoi en plus |
| Formulaire produit | Image (D13) | Vignette = photo principale (sinon une icône, jamais une image inventée), pastille « CHOISIR UNE IMAGE », « JPG/PNG/WEBP — 15 Mo max » (Q25), nom du fichier choisi ; textes alternatifs FR et EN et « Ajouter la photo » gardés ; la galerie (plusieurs photos, ordre, textes) reste plus bas | La maquette ne montre qu'une image ; le code en accepte 10 |
| Formulaire produit | Type de fichier (Q24) | Texte en lecture seule : formats distincts des fichiers joints (PDF A4, PDF US Letter, SVG, STL, transcription) et « Vidéo » si la vidéo complète existe ; « Aucun fichier joint pour le moment » sinon ; jamais un champ | Q24 : pas de nouveau champ |
| Formulaire produit | « Mesures » et « tranches de prix » de la spec | Rien à déplacer : ils ne sont pas dans le formulaire produit (mesures : commandes Sur mesure ; tranches de prix : Réglages) | Aucun champ inventé |
| Formulaire produit | Bordure des champs sombres | Gardée (#181512 sur #24211C ne se voit presque pas) | Contraste du contour d'un champ |
| Formulaire produit | Après un enregistrement réussi | Échap et la croix ne demandent plus « Quitter sans enregistrer ? » ; un échec garde la protection | Pas de confirmation inutile après une saisie enregistrée |
| Blog | Extrait sur la carte avant la page 6 | 160 premiers caractères du contenu sans Markdown ; le champ Extrait (page 6) prend le dessus quand il est rempli | Q28 |
| Blog | Date de la carte | Date de publication, sinon de modification | La maquette montre une seule date courte |
| Nouvel article | Longueur de l'extrait | 300 caractères au plus, FR et EN, facultatif | « Résumé court » ; la carte en montre 160 sans extrait |
| Codes promo | Filtres | TOUS, ACTIFS, INACTIFS | La corbeille désactive (Q22) : il faut retrouver les codes inactifs |
| Codes promo | « + NOUVEAU CODE » et crayon | Formulaires existants dans une fenêtre sur la même route (paramètre d'adresse) | Q23 sans nouvelle route |
| Codes promo | Recherche | Dans la liste déjà lue (code, affilié), sans nouvelle requête | Q15 n'autorise une nouvelle requête que pour les commandes |
| Commandes | Statut dans la liste (B9) | Pastille d'information (`Pastille`), pas `PastilleStatut` | `PastilleStatut` dessine une coche (publié) ou un crayon (brouillon) : un crayon sur « Échouée » ou « Remboursée » serait faux ; le mot reste écrit en entier |
| Commandes | Pastilles de statut : `aria-current` au lieu de `aria-pressed` | Liens (`PastilleFiltre` avec `href`) qui gardent la recherche et les autres filtres | Le filtre est porté par l'adresse et doit marcher sans JavaScript ; des boutons d'envoi dans le formulaire GET rendaient la touche Entrée de la recherche ambiguë (le premier bouton d'envoi, « Toutes », aurait effacé le statut) |
| Commandes | Liste déroulante « Statut » | Gardée avec les 10 statuts (les 4 des pastilles compris) | Rien retiré ; « Filtrer » ne perd jamais le statut choisi par une pastille |
| Commandes | Colonne Client | Avatar et nom s'il existe ; sinon l'email masqué seul, sans avatar | Une initiale tirée d'un email n'est pas un nom (jamais de nom inventé) |
| Commandes | Colonne Paiement | Nom du prestataire écrit comme sur la maquette (PawaPay, MaishaPay, Polar), « Offerte » pour une commande offerte | Maquette B8 ; avant, le code technique (`pawapay`) était affiché |
| Commandes | Page au-delà de la dernière (adresse modifiée) | La dernière page est affichée | Jamais une page vide avec « page 9 / 3 » |
| Commandes | Montant de REVENU PAYÉ | Toujours écrit en t-h3 (le tableau de bord ne passe en t-h3 qu'à partir de 1 000 USD) | « 0,00 $US » en t-h2 déborde de la carte de 255 px à 1366 px (espace insécable) |
| Commandes | Recherche et pastilles | Sur une ligne à partir de 1280 px (la recherche rétrécit sous 360 px) ; en dessous, les pastilles passent à la ligne | Maquette B4/B5 ; aucun défilement horizontal |
| Commandes | Carte REVENU PAYÉ illisible | « Illisible » dans la carte, le reste de la page s'affiche | Jamais un faux zéro |
| Commandes | Page de détail d'une commande | Redessinée avec les « autres pages et leurs détails » (étape 8), pas avec la liste | Une page par commit ; la maquette ne montre que la liste |

## CI

| Page | Commit | Résultat | Remarque |
|---|---|---|---|
| Tableau de bord | 047cf76 | verte (run 43985989411) | — |
| Commandes | e9103ee | verte (run 43992273472) | — |
| Produits | fac8d61 | verte (run 44017492095) | — |
