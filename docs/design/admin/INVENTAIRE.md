# Inventaire — maquette de l'admin et de la connexion (étape 0)

Date : 2026-11-15. Aucun code modifié. Sources : `docs/references/maquettes-admin/` (ignoré par git) et le code de `main` (commit `1d015c0`).
Les textes des maquettes sont donnés **corrigés** (accents rétablis, fautes corrigées). Positions et tailles en pixels sur 1366 × 768.
Colonne « Code » : **oui** = existe déjà dans le code ; **non** = n'existe pas ; **partiel** = existe sous une autre forme (détail en note).

---

## 0. Préalables (bloquants)

### 0.1 Police 851 Chikara Dzuyoku : licence introuvable

- `docs/references/polices/` ne contient que deux fichiers : `851CHIKARA-DZUYOKU_kanaA_004.ttf` et `851CHIKARA-DZUYOKU_kanaB_004.ttf`. **Ni zip, ni readme.**
- Les polices n'embarquent aucun texte de licence : la table `name` n'a ni description (champ 13) ni adresse de licence (champ 14). On y lit seulement : nom « 851CHIKARA-DZUYOKU-KANA-A », version 0.04.
- **Je ne peux donc pas confirmer ce que la licence autorise** (usage commercial, modification, redistribution d'une version dérivée, mention obligatoire). Règle 6 : rien n'entre dans le dépôt sans licence vérifiée. → **Question Q1.**
- Constat technique (rendu fait, rien d'installé dans le projet) :
  - les lettres accentuées sont **déclarées mais vides** : é, è, ê, à, ç, ô, É, È, À, Ç…, ainsi que —, « », œ et æ ;
  - « … » et « ’ » existent ;
  - les signes de base existent : ` ^ ' , . ¨ ~ ´.

  La version dérivée « KOMA Chikara » est donc techniquement faisable, à partir des propres signes de la police, une fois la licence confirmée.
- Différence entre les deux fichiers (`kanaA` / `kanaB`) : seulement les kana japonais, a priori. → **Question Q2.**

### 0.2 Fichiers de maquette

| Fichier attendu | Fichier présent | Remarque |
|---|---|---|
| 01-tableau-de-bord.png | `Admin · Tableau de bord.png` | Même contenu, autre nom. |
| 02 à 07 | présents | — |
| — | `04-nouveau-produit 1.png`, `04-nouveau-produit 2.png` | Style violet d'une autre application (date du 12/11). On y voit en plus : « Coller un lien », « Tags (séparés par virgules) », « Annuler », « Prix (USD) — 0 pour gratuit ». → **Question Q3.** |
| connexion.mp4 | présent | 15 s, 1920 × 1112. Analysé image par image (voir F). |

### 0.3 Icônes

Le projet n'a **aucune bibliothèque d'icônes** : pas de lucide-react, heroicons, react-icons…, toutes les icônes sont des SVG écrits à la main. → **Question Q4.**

### 0.4 Couleurs relevées sur les maquettes (pixels)

| Élément | Valeur relevée | Votre palette | Remarque |
|---|---|---|---|
| Fond de page | #16130F (tableau de bord) | #1B1713 | proche |
| Menu latéral, barre du haut | #211C17 | #211C17 | identique |
| Bordure droite du menu | #3A322A | #3A322A | identique |
| Cartes de chiffres | #1E1A14 (tableau de bord) / #2E2923 (commandes) | #2E2923 | **les deux maquettes diffèrent** → Q5 |
| Grand panneau | #1E1A14 (tableau de bord) / #34312D (commandes) | #322F2B | **idem** → Q5 |
| Carte de grille | #1D1B1A | #1D1B1A | identique |
| Vignette, pastille du nom, pastille du code | #11100F / #0C0A08 | « #161310 à #201E1B, une seule valeur » | plus sombre que la fourchette → Q5 |
| Recherche, en-tête de tableau | #201E1B | idem | — |
| Entrée active | #16130F | #16130F | identique |
| Rouge (+ Nouveau) | #D7261E | #D7261E | identique |
| Filtre bordeaux | #861E1B ; « TOUTES » des codes promo #740C09 | #861E1B | légère variation |
| Pastille d'info, statut « Publié » des produits | #432322 | #432322 | identique |
| Bouton « Catégories » | #712826 | #8C514E | différent → Q5 |
| Avatar client | #762E27 | — | à ajouter à la palette |
| Fenêtre (formulaire) | #24211C ; champs #151311 | — | à ajouter |
| Enregistrer | #83120F | #861511 | proche |
| Barres du graphique | #4A7FF7 (bleu) | « bleu comme la maquette » | — |
| Trait des cartes | #FFFFFF | blanc | — |

---

## 1. Inventaire par maquette

### Cadre commun (modèle A), présent sur toutes les maquettes

| # | Élément | Texte (corrigé) | Couleur | Forme, icône, taille | Position | Code |
|---|---|---|---|---|---|---|
| A1 | Menu latéral | — | #211C17, bord droit #3A322A ~4 px | pleine hauteur, ~215 px de large | gauche | **oui** (barre latérale 9.10, 256 px) |
| A2 | Logo KOMA | KOMA + kana | blanc et rouge | ~165 × 40 | haut du menu, x 20–185, y 15–55 | **oui** |
| A3 | Sous-titre | ADMINISTRATION | crème | majuscules espacées ~16 px | sous le logo, y ~78 | **partiel** (« Administration » existe dans les textes, pas affiché ainsi) |
| A4 | Trait sous la marque | — | gris #3A322A | 2–3 px, sur toute la largeur | y ~95 | **non** (style seulement) |
| A5 | Entrées du groupe 1 | TABLEAU DE BORD, COMMANDES, TÂCHES, PRODUITS, UNIVERS, UTILISATEURS | crème | majuscules espacées ~14 px | x ~35 | **oui** (toutes ces pages existent ; Utilisateurs réservé à l'Admin) |
| A6 | Titre de groupe | COMMUNAUTÉ | gris clair | ~14 px, décalé à gauche (x ~20) | — | **oui** (« Communauté ») |
| A7 | Entrées du groupe 2 | ÉVÉNEMENTS, SCAN, GALERIE, BLOG, MESSAGES | crème | idem A5 | — | **oui** (Scan mène à `/scan`) |
| A8 | Titre de groupe | RÉGLAGES | gris clair | idem A6 | — | **oui** |
| A9 | Entrées du groupe 3 | PRESTATAIRES, CODES PROMO, RÉGLAGES | crème | idem A5 | — | **oui**, mais l'ordre du code est Codes promo, Prestataires, Réglages → Q6 |
| A10 | Entrée active | (nom de la page) | fond #16130F, texte crème plus grand (~18 px) | bloc ~165 × 45, collé au bord droit, texte décalé à droite | — | **partiel** (aujourd'hui : fond + barre rouge de 4 px) |
| A11 | Compteur de messages | — | — | — | — | **oui dans le code, absent de la maquette** → gardé (§3) |
| A12 | « Besoin d'aide ? » + « Voir le site » | — | — | encart en bas du menu | — | **oui dans le code, absent de la maquette** → Q7 |
| A13 | Barre du haut | — | #211C17, trait fin dessous | ~68 px de haut | haut, à droite du menu | **oui** (bandeau 9.10) |
| A14 | Surtitre | ESPACE ADMINISTRATEUR | gris clair | majuscules espacées ~16 px | x ~225, y ~18 | **oui** (« Espace administrateur ») |
| A15 | Nom de la page | ex. Tableau de bord | crème | ~22 px, casse normale | sous A14 | **oui** |
| A16 | Bouton clair/sombre | (icône soleil) | rond blanc, icône noire | Ø ~38 | x ~1075 | **oui** (bascule de thème) |
| A17 | Langue | Fr | rond à contour gris | Ø ~44 | x ~1125 | **oui** (sélecteur de langue) |
| A18 | Nom et rôle | vrai nom ; vrai rôle (Administrateur, Assistant…) | crème / gris | 2 lignes, ~18 et ~16 px, alignés à droite | x ~1165–1295 | **oui** (bandeau : nom et rôle) |
| A19 | Avatar | initiales | rond rouge #D7261E, texte blanc | Ø ~48 | x ~1310–1358 | **oui** (avatar à initiales) |
| A20 | Menu du profil (clic sur l'avatar) | Mon profil, Paramètres du profil, Voir le site, Se déconnecter | fond sombre, coins arrondis | menu déroulant | sous l'avatar | **non**, et ses cibles sont incomplètes → Q8 |
| A21 | Navigation mobile (< 1024 px) | — | couleurs de la maquette | barre du bas et « Plus » (9.8b) | — | **oui** |

### E. Tableau de bord (`Admin · Tableau de bord.png`)

| # | Élément | Texte (corrigé) | Couleur | Forme, taille | Position | Code |
|---|---|---|---|---|---|---|
| E1 | Carte 1 | icône carton ; « 0 » ; PRODUITS PUBLIÉS | carte #1E1A14 | 255 × 125, coins ~20 | x 237, y 82 | **non** : aucun compteur de produits publiés dans le tableau de bord → Q9 |
| E2 | Carte 2 | icône panier ; COMMANDES AU TOTAL | idem | idem | x 518 | **non** : pas de total des commandes → Q9 |
| E3 | Carte 3 | icône $ ; REVENU TOTAL | idem | idem | x 798 | **partiel** : montants des paiements vérifiés sur 7 ou 30 jours, pas « depuis le début » → Q9 |
| E4 | Carte 4 | icône % ; PAIEMENTS RÉUSSIS | idem | idem | x 1080 | **partiel** : paiements vérifiés par jour ; taux d'échec (SM-C2) ; pas de nombre total → Q9 |
| E5 | Grande carte du graphique | PERFORMANCE DES VENTES ; « 30 DERNIERS JOURS » à droite ; légende ● REVENUS | panneau #1E1A14, barres bleues #4A7FF7 | ~660 × 350, coins ~30 | x 238, y 217 | **partiel** : « Paiements vérifiés » par jour, par prestataire et par famille, avec choix 7 / 30 jours et tableau de données accessible |
| E6 | Axe et libellés | 0 à 70K ; Lundi… Dimanche | crème | — | — | **non** : la maquette montre 7 jours de la semaine sous « 30 derniers jours » → Q10 |
| E7 | Performance du jour | PERFORMANCE DU JOUR ; « Ventes du JJ/MM/AAAA : » ; Nombre de ventes : 00 ; Montant : 00 | panneau #1E1A14 | ~420 × 350 | x 916, y 217 | **partiel** : « Nouvelles commandes payées » aujourd'hui (liste, plafonnée) ; nombre et montant calculables depuis cette liste → Q11 |
| E8 | Titre | À FAIRE | crème, ~26 px | — | x 245, y 590 | **oui** (« À faire ») |
| E9 | Petite carte | Mesures à recevoir ; 0 ; Ouvrir | carte #1E1A14 | 200 × 120 | x 270, y 612 | **oui** |
| E10 | Petite carte | Demandes d'annulation ; 0 ; Ouvrir | idem | idem | x 490 | **oui** |
| E11 | Lien | VOIR PLUS → | crème, souligné | — | x 530, y 750 | **non** : le code affiche les 11 tâches d'un coup, page `/admin/taches` existante → Q12 |
| E12 | Titre | INDICATEURS | crème | — | x 755, y 590 | **oui** |
| E13 | Petite carte | SM-1 · Ventes payées ; 7 jours / 30 jours ; « Aucune donnée sur la période » | idem | ~240 × 125 | x 778 | **oui** (SM-1 : ventes payées sur 7 et 30 jours, montant et détail par famille) → Q13 |
| E14 | Petite carte | Événements et Pass vendus ; Événements : ; Pass vendus : | idem | ~250 × 125 | x 1047 | **partiel** : SM-4 « Alertes événement et Pass vendus » existe ; à vérifier s'il est calculé ou « Pas encore mesuré » → Q13 |
| E15 | Lien | VOIR PLUS → | — | — | x 1090, y 750 | **non** : 15 autres indicateurs existent (SM-2 à SM-10, SM-C1 à SM-C7), sans page à part → Q12 |
| E16 | Intro, sélecteur 7 / 30 jours, graphiques par prestataire et par famille, autres tâches, autres indicateurs | — | — | — | — | **oui dans le code, absent de la maquette** → gardés (§3) |

### B. Commandes (`02-commandes.png`)

| # | Élément | Texte (corrigé) | Couleur | Forme, taille | Position | Code |
|---|---|---|---|---|---|---|
| B1 | Grand titre | COMMANDES | crème | ~44 px | x 245, y 85 | **oui** |
| B2 | 4 cartes | REVENU PAYÉ ($) · COMMANDES AU TOTAL (panier) · PAIEMENTS ABOUTIS (coche) · EN ATTENTE (horloge) ; chiffre centré | #2E2923 | 255 × 120, coins ~16 | y 143 | **non** : la page Commandes ne calcule aucun de ces chiffres. Seul le nombre de résultats existe (selon les filtres) → Q14 |
| B3 | Grand panneau | — | #34312D | ~1100 × 475, coins ~20 | x 243, y 278 | **non** (style) |
| B4 | Recherche | loupe ; « Rechercher par numéro ou client » | pastille #201E1B | 360 × 50 | x 252, y 297 | **non** : aucune recherche dans la liste des commandes → Q15 |
| B5 | Filtres | TOUTES, PAYÉES, ÉCHOUÉES, EN ATTENTE, REMBOURSÉES | pastilles #861E1B, texte blanc | ~90 × 50 chacune | droite, y 298 | **partiel** : filtres en listes déroulantes — Statut (10 statuts), Famille, Prestataire, Zone de remise — avec un bouton « Filtrer » → Q16 |
| B6 | En-tête du tableau | N° COMMANDE, CLIENT, DATE, PAIEMENT, MONTANT, STATUT | barre #201E1B, coins ~16 | 1075 × 50 | y 366 | **partiel** : colonnes du code : Numéro, Date, Statut, Remise, Prestataire, Total |
| B7 | Colonne Client | avatar carré bordeaux #762E27 avec l'initiale + nom | — | 52 × 52 | x 462 | **non** : la liste ne lit ni le nom ni l'email du client (requête à changer) → Q17 |
| B8 | Colonne Paiement | prestataire (Gratuit, PawaPay, Polar, MaishaPay) | crème | — | — | **oui** (« Prestataire » ; « Offerte » pour une commande gratuite) |
| B9 | Statut | en français | crème | — | — | **oui** (pastille de statut) |
| B10 | Pagination | ‹ › | gris | centrée en bas | y 725 | **partiel** : bouton « Voir plus » qui allonge la liste → Q18 |
| B11 | Colonne « Remise » (zone et mode) | — | — | — | — | **oui dans le code, absente de la maquette** → gardée (§3) |

### C. Produits (`03-produits.png`)

| # | Élément | Texte (corrigé) | Couleur | Forme, taille | Position | Code |
|---|---|---|---|---|---|---|
| C1 | Recherche | loupe ; « Rechercher un produit… » | pastille #11100F | 360 × 50 | x 233, y 80 | **oui** (recherche de la grille) |
| C2 | Compteur | « N PRODUITS » | crème | — | x 608 | **oui** |
| C3 | Bouton | CATÉGORIES | #712826 | pastille 120 × 45 | x 1017 | **non** : la boutique n'a pas de « catégories » ; elle a les Univers (page `/admin/univers`) et les Familles → Q19 |
| C4 | Bouton | + NOUVEAU PRODUIT | #D7261E | 200 × 45 | x 1152 | **oui** |
| C5 | Grand panneau | — | #2B2826 environ | coins ~20 | x 232, y 145 | **non** (style) |
| C6 | Carte (grille de 2) | — | #1D1B1A | ~520 × 290, coins ~16 | — | **oui** (la grille existe déjà, 9.10) |
| C7 | Vignette | icône image si pas de photo | #11100F | 148 × 140 | haut gauche | **oui** (photo ou « Pas de photo ») |
| C8 | Nom | ex. titre réel | pastille #11100F | ~305 × 50 | droite de la vignette | **oui** |
| C9 | Pastille | PRIX : … (Gratuit si 0) | #432322 | — | sous le nom | **oui** (prix ; « Prix à fixer » si vide) |
| C10 | Pastille | TÉLÉCHARGEMENTS : … | #432322 | — | bas gauche | **non** : aucun compteur de téléchargements par produit → Q20 |
| C11 | Pastille | CATÉGORIE : … | #432322 | — | bas droite | **partiel** : Univers du produit → Q19 |
| C12 | Pastille ajoutée (votre demande) | type d'article : Cosplay, Accessoire, Kit | #432322 | — | — | **oui** (famille) ; « Polo » n'existe pas → Q21 |
| C13 | Trait blanc | — | #FFFFFF | 2 px | — | **non** (style) |
| C14 | Crayon | (Modifier) | gris | 32 × 32 | bas gauche | **oui** (lien Modifier) |
| C15 | Corbeille | (Supprimer) | rouge | 32 × 32 | — | **non** : aucune suppression de produit dans le code (publier / dépublier seulement) → Q22 |
| C16 | Statut | PUBLIÉ / BROUILLON | pastille #432322 | 100 × 45 | bas droite | **oui** |
| C17 | État du stock (Numérique, En stock, Sur commande, Épuisé) | — | — | — | — | **oui dans le code, absent de la maquette** → gardé (§3) |

### D. Nouveau produit (`04-nouveau-produit.png`)

| # | Élément | Texte (corrigé) | Couleur | Forme, taille | Position | Code |
|---|---|---|---|---|---|---|
| D1 | Fond | page assombrie, floutée, grain | — | plein écran | — | **non** : « Nouveau produit » est aujourd'hui une **page** (`/admin/produits/nouveau`), pas une fenêtre → Q23 |
| D2 | Fenêtre | — | #24211C, coins ~20 | 670 × 755 | x 275–945 | **non** |
| D3 | Titre | NOUVEAU PRODUIT, sur 2 lignes | crème, ~22 px | — | haut gauche | **oui** (« Nouveau produit ») |
| D4 | Bouton | ENREGISTRER | #83120F, texte crème | pastille 175 × 50 | haut droite | **partiel** : bouton en bas du formulaire |
| D5 | Croix | × | gris | 30 × 30 | haut droite | **non** (fenêtre) |
| D6 | Trait blanc | — | blanc | 3 px | sous l'en-tête | **non** (style) |
| D7 | Champ | NOM | champ #151311, coins ~16 | 635 × 60 | — | **partiel** : « Titre en français » et « Titre en anglais » |
| D8 | Champ | DESCRIPTION | idem | 635 × 90 | — | **partiel** : description en français et en anglais |
| D9 | Champ | PRIX | idem | 295 × 60 | gauche | **oui** (prix en USD) |
| D10 | Champ | TYPE DE FICHIER | idem | 295 × 60 | droite | **non** → Q24 |
| D11 | Champ | CATÉGORIES | idem | 635 × 40 | — | **partiel** : Univers → Q19 |
| D12 | Zone | « FICHIER NUMÉRIQUE — PATRON COSPLAY (PDF) » ; TÉLÉVERSER (nuage) ; icône document ; « Cliquez ou glissez votre fichier ici » | #151311 | 635 × 105 | — | **partiel** : fichiers du Kit (PDF A4 / Letter, SVG, STL) envoyés sur la page d'**édition** d'un Kit, après sa création |
| D13 | Image | vignette ; CHOISIR UNE IMAGE ; « JPG/PNG/WEBP — 5 Mo max » | — | 80 × 80 + pastille | — | **partiel** : photos du produit (plusieurs, texte alternatif FR et EN) sur la page d'édition ; limite réelle 15 Mo → Q25 |
| D14 | Menu | STATUT : BROUILLON (chevron) | — | 560 × 40 | bas | **partiel** : un produit est créé en brouillon et publié par un bouton, après contrôle des champs obligatoires → Q26 |
| D15 | Champs du code absents de la maquette | Famille, adresse du produit (slug), Univers, délai de fabrication, tailles et stock (XS à XXL, sur mesure), fabrication sur commande, délai par taille, mesures, niveau et matériel du Kit, fichiers, vidéo, chapitres, sous-titres, extrait sans parole, Kit lié… | — | — | — | **oui** → gardés (§3) |

### C. Blog (`05-blog.png`)

| # | Élément | Texte (corrigé) | Couleur | Forme, taille | Position | Code |
|---|---|---|---|---|---|---|
| CB1 | Bouton | ÉCRIRE UN ARTICLE | #D7261E | 195 × 45 | haut droite | **oui** |
| CB2 | Panneau | — | #2B2826 | coins ~20 | x 232, y 157 | **non** (style) |
| CB3 | Compteur | « N ARTICLES » | crème | — | haut gauche du panneau | **oui** |
| CB4 | Filtres | PUBLIÉS, BROUILLONS | #7A3634 | pastilles | haut droite du panneau | **non** : la liste du blog n'a pas de filtre → Q27 |
| CB5 | Carte | image en haut (515 × 260) | #1D1B1A | ~540 × 510 | grille de 2 | **partiel** : la liste du blog est aujourd'hui une liste ou un tableau (titre, statut, date de modification) ; images de l'article oui |
| CB6 | Badge | PUBLIÉ | #D7261E | pastille 110 × 45 | sous l'image | **oui** (statut) |
| CB7 | Date | « 14 nov. » | crème, ~22 px | — | à droite du badge | **partiel** : « Modifié le … » |
| CB8 | Titre puis extrait | — | crème | 2 à 4 lignes | — | **partiel** : titre oui ; extrait non (pas de champ) → Q28 |
| CB9 | Trait blanc | — | blanc | — | — | **non** (style) |
| CB10 | Icônes | crayon, cercle barré (dépublier), corbeille rouge | — | — | bas | crayon **oui** ; dépublier **oui** ; corbeille **non** (aucune suppression d'article dans le code) → Q22 |

### D. Nouvel article (`06-nouvel-article.png`)

| # | Élément | Texte (corrigé) | Code |
|---|---|---|---|
| DA1 | Fenêtre, fond flouté, titre NOUVEL ARTICLE (2 lignes), ENREGISTRER, ×, trait | — | **non** : page `/admin/blog/nouveau` → Q23 |
| DA2 | Champ TITRE | — | **partiel** : titre en français et en anglais |
| DA3 | Champ « EXTRAIT (RÉSUMÉ COURT) » | — | **non** → Q28 |
| DA4 | Champ CONTENU | — | **partiel** : texte en français et en anglais (Markdown), avec aperçu |
| DA5 | Image : vignette, CHOISIR UNE IMAGE, « JPG/PNG/WEBP — 5 Mo max » | — | **partiel** : plusieurs images, après création, avec textes alternatifs ; limite réelle 15 Mo → Q25 |
| DA6 | Menu STATUT : BROUILLON (chevron) | — | **partiel** : publier / dépublier par bouton → Q26 |
| DA7 | Champs du code absents de la maquette : adresse (slug), lien vers un produit, version anglaise, images avec textes alternatifs, aperçu | — | **oui** → gardés |

### B. Codes promo (`07-codes-promo.png`)

| # | Élément | Texte (corrigé) | Couleur | Code |
|---|---|---|---|---|
| CP1 | Titre | CODES PROMO (la maquette dit « Créer un code promo ») | crème | **oui** |
| CP2 | Bouton | + NOUVEAU CODE | #D7261E | **partiel** : le formulaire de création est aujourd'hui sur la page |
| CP3 | Recherche | « Rechercher un code promo » | #201E1B | **non** → Q15 |
| CP4 | Filtre | TOUS | #740C09 | **non** (aucun filtre ; état Actif / Inactif existant) → Q16 |
| CP5 | Colonnes | N°, INFLUENCEUR, DATE, CODE, ACTIONS | barre #201E1B | **partiel** : Code, Affilié (= influenceur), réduction %, commission %, plafond, Actif, ventes (nombre, montant, commission). « N° » et « Date » → Q29 |
| CP6 | Avatar | carré bordeaux avec l'initiale de l'affilié | #762E27 | **non** (style, calculé depuis le nom de l'affilié qui existe) |
| CP7 | Code | dans une pastille sombre | #0C0A08 | **oui** |
| CP8 | Actions | copier, modifier (crayon), supprimer (corbeille rouge) | — | modifier **oui** ; copier **non** (copie dans le presse-papiers) ; supprimer **non** (désactiver oui) → Q22, Q30 |
| CP9 | Pagination | ‹ › | gris | **non** → Q18 |

### F. Connexion (`connexion.mp4`)

| # | Élément | Constat | Code |
|---|---|---|---|
| F1 | En-tête réduit | logo à gauche ; soleil (rond blanc) et « Fr » (rond à contour) à droite ; trait fin dessous ; ~40 px de haut | **partiel** : l'en-tête complet du site s'affiche aujourd'hui |
| F2 | Panneau image | x 30 à 475 sur 960, soit ~46 % de la largeur, coins arrondis ~10 px, image recadrée « cover » | **non** |
| F3 | Fondu | dans la vidéo, deux images, changement vers 6 s | **non** ; dossier `public/images/connexion/` absent aujourd'hui → panneau vide aux couleurs du site |
| F4 | Carte CONNEXION | fond ~#1F1B17, coins ~12, ~370 px de large ; titre CONNEXION ; « Entre ton adresse email : nous t'envoyons un code à 6 chiffres. Pas de mot de passe à retenir. » ; Adresse email ; champ ; RECEVOIR UN CODE (rouge) ; « ou » ; CONTINUER AVEC GOOGLE (bouton blanc, logo G) | **oui** (mêmes textes, même fonctionnement) |
| F5 | Police de la vidéo | Barlow / Barlow Condensed (pas Chikara) | → la police unique s'appliquera aussi ici, après validation |

---

## 2. Pages admin réelles et modèle suivi

| Route | Page | Modèle | Remarque |
|---|---|---|---|
| `/admin` | Tableau de bord | E | Admin seulement |
| `/admin/commandes` | Commandes | B | — |
| `/admin/commandes/[numero]` | Détail d'une commande | panneaux (A + C sans grille) | avancement, paiement, adresse, remboursement, annulation… |
| `/admin/taches` | Tâches | B (liste) | — |
| `/admin/produits` | Produits | C | — |
| `/admin/produits/nouveau` | Nouveau produit | D | page, Q23 |
| `/admin/produits/[id]` | Modifier un produit (photos, variantes, Kit : fichiers, vidéo, chapitres, sous-titres) | D | formulaire long |
| `/admin/univers` | Univers | C | — |
| `/admin/utilisateurs` | Utilisateurs | C | Admin seulement |
| `/admin/evenements` | Événements | C | — |
| `/admin/evenements/nouveau` | Nouvel événement | D | — |
| `/admin/evenements/[id]` | Modifier un événement (types de Pass, alertes, bénévoles, candidatures, galerie, verrou) | D + panneaux | — |
| `/scan` | Scan | hors cadre | plein écran sur téléphone, à garder tel quel ? → Q31 |
| `/admin/galerie` | Galerie (photos à valider, dépôt WhatsApp) | C | — |
| `/admin/blog` | Blog | C | — |
| `/admin/blog/nouveau` | Nouvel article | D | page, Q23 |
| `/admin/blog/[id]` | Modifier un article (images) | D | — |
| `/admin/messages` | Messages | B | — |
| `/admin/codes-promo` | Codes promo | B | — |
| `/admin/prestataires` | Prestataires (couverture des agrégateurs) | B | — |
| `/admin/reglages` | Réglages (dont « Déconnexion après inactivité », tranches de prix…) | panneaux + D | — |
| `/[l]/connexion` | Connexion | F | publique |
| `/[l]/compte`, `/[l]/compte/preferences` | Espace personnel, préférences | A (cadre admin pour l'admin ?) | Q8 |

Toutes les entrées du menu de la maquette ont leur page dans le code, et toutes les pages du menu du code sont dans la maquette. Seule différence : l'ordre du groupe Réglages (Q6).

---

## 3. Ajouts au-delà de la maquette, pour garder l'existant

Dans le même style que la maquette :

1. **Cadre** : compteur de messages nouveaux sur « Messages » ; encart « Besoin d'aide ? / Voir le site » (Q7) ; lien d'évitement « Aller au contenu » ; barre du bas et « Plus » sur mobile.
2. **Tableau de bord** : intro ; sélecteur 7 / 30 jours ; graphiques par prestataire et par famille, tableau de données accessible sous chaque graphique ; « Nouvelles commandes payées » (liste) ; les 9 autres tâches ; les 15 autres indicateurs (Q12).
3. **Commandes** : filtres Famille, Prestataire, Zone de remise et les 10 statuts ; colonne « Remise » ; « Voir plus » (Q18) ; page de détail complète.
4. **Produits** : pastille de famille (Cosplay, Accessoire, Kit) ; état du stock ; « Prix à fixer » ; formulaire complet (famille, titres et descriptions FR et EN, adresse, Univers, prix, délai, tailles et stock, sur commande, délai par taille, niveau et matériel, photos avec textes alternatifs, fichiers du Kit, vidéo, chapitres, sous-titres, extrait sans parole, publication avec la liste des manques).
5. **Blog** : version anglaise, adresse, lien vers un produit, images avec textes alternatifs, aperçu Markdown, publication / dépublication.
6. **Codes promo** : réduction %, commission %, plafond, actif / inactif, ventes du code (nombre, montant, commission due).
7. **Réglages** : tous les réglages existants (nom du site, WhatsApp, forfaits, retrait FR / EN, plafond de fabrication, délai de paiement, frais d'annulation des Pass, délai des Stands, rythme des relances, déconnexion après inactivité, tranches de prix).
8. **Toutes les autres pages** (Tâches, Univers, Utilisateurs, Événements et leurs sections, Galerie, Messages, Prestataires, détail d'une commande) : contenu inchangé, habillé des modèles A à D.

---

## 4. Questions

**Police et fichiers**
- **Q1** — Licence de 851 Chikara Dzuyoku : le zip et le readme ne sont pas dans `docs/references/polices/`. Pouvez-vous les déposer (ou coller le texte de la licence) ? Sans eux, je ne crée ni n'installe la version dérivée (règle 6).
- **Q2** — `kanaA` ou `kanaB` : laquelle sert de base ? Les lettres latines sont a priori identiques ; la différence porte sur les kana.
- **Q3** — `04-nouveau-produit 1.png` et `04-nouveau-produit 2.png` (style violet) : sont-ils des références, ou seulement des captures d'inspiration à ignorer ? Ils montrent « Coller un lien », « Tags » et « Annuler », qui n'existent pas dans le code.
- **Q4** — Icônes : pas de bibliothèque dans le projet. (a) J'écris les SVG nécessaires dans un seul composant commun (aucune dépendance) ; ou (b) on ajoute `lucide-react` (licence ISC, à noter dans `docs/licences/`).

**Couleurs**
- **Q5** — Les maquettes ne concordent pas entre elles. Quelle valeur unique pour chacun de ces éléments ?
  - cartes de chiffres : #1E1A14 ou #2E2923 ;
  - grand panneau : #1E1A14, #34312D ou #322F2B ;
  - pastilles très sombres (nom, vignette, code) : #11100F ou la valeur unique des champs (#161310 à #201E1B) ;
  - bouton « Catégories » : #712826 ou #8C514E.

**Cadre**
- **Q6** — Ordre du groupe Réglages : celui de la maquette (Prestataires, Codes promo, Réglages) ?
- **Q7** — L'encart « Besoin d'aide ? » avec « Voir le site » n'est pas sur la maquette. On le retire, puisque « Voir le site » passe dans le menu du profil, ou on le garde en bas du menu ?
- **Q8** — Menu du profil. Côté code, il existe seulement :
  - `/compte` : espace personnel ;
  - `/compte/preferences` : préférences des emails (relances, nouveautés, alertes) ;
  - la déconnexion.

  Il n'existe **ni pseudo, ni changement d'email, ni réglage de langue du compte, ni suppression de compte**. Proposition : « Mon profil » mène à `/compte` et « Paramètres du profil » à `/compte/preferences`, les deux redessinés dans le cadre admin quand la personne est admin ou assistant. D'accord ? Les fonctions absentes ne seront pas créées sans votre demande.

**Tableau de bord**
- **Q9** — Les 4 cartes (produits publiés, commandes au total, revenu total, paiements réussis) ne sont pas calculées aujourd'hui. Les afficher demande de nouvelles lectures en base, ce qui est interdit par « apparence seulement ». (a) J'autorise ces lectures, en réutilisant les données existantes. (b) Les cartes affichent ce qui existe déjà : par exemple le revenu et le nombre de paiements vérifiés sur la période choisie (7 ou 30 jours), avec le libellé adapté. (c) Autre.
- **Q10** — Graphique : (a) les 30 jours, un par barre (données existantes) ; (b) 7 jours de la semaine, du lundi au dimanche (cumul ou 7 derniers jours ?) ; (c) les deux, selon le sélecteur 7 / 30 jours qui existe déjà.
- **Q11** — « Performance du jour » : nombre et montant calculés à partir des commandes payées aujourd'hui (liste plafonnée aux plus récentes). D'accord ? Si le plafond est atteint, j'affiche « au moins N ».
- **Q12** — « VOIR PLUS → » : pour À faire, le lien vers `/admin/taches` (page existante) ? Pour Indicateurs, il n'y a pas de page : (a) le lien déplie les 15 autres indicateurs sur la même page ; (b) nouvelle page `/admin/indicateurs` (nouvelle route, pas permise sans accord).
- **Q13** — « SM-1 » est le premier indicateur de succès du PRD : **ventes payées sur 7 et 30 jours** (montant et détail par famille). Je garde « SM-1 · Ventes payées » ou je retire « SM-1 » ? « Événements et Pass vendus » correspond à SM-4 (« Alertes événement et Pass vendus ») : il est actuellement « Pas encore mesuré », la raison affichée datant d'avant l'epic 7. Je l'affiche tel quel ?

**Commandes et codes promo**
- **Q14** — Les 4 cartes de Commandes (revenu payé, commandes au total, paiements aboutis, en attente) ne sont pas calculées : mêmes options que Q9.
- **Q15** — La recherche (par numéro ou client, ou code promo) n'existe pas. On la crée (nouvelle fonction et nouvelle requête), ou on n'affiche pas de recherche ?
- **Q16** — Filtres en pastilles : les 5 pastilles de la maquette remplacent le filtre Statut (Payées = payée, Échouées = échouée, En attente, Remboursées), et les autres filtres (Famille, Prestataire, Zone, les autres statuts) restent en listes déroulantes, dans le même style ? Pour les codes promo, « TOUS » seul, ou Tous / Actifs / Inactifs ?
- **Q17** — Colonne Client : afficher le nom ou l'email du client demande de changer la requête de la liste. On l'ajoute, ou la colonne reste absente ?
- **Q18** — Pagination ‹ › à la place de « Voir plus » : changement de fonctionnement (pages numérotées). On garde « Voir plus » stylé, ou on passe à ‹ › ?
- **Q29** — Codes promo, « N° » et « Date » : le numéro d'ordre est-il seulement la position dans la liste ? Et la date, celle de création (à vérifier si elle est lue aujourd'hui) ?
- **Q30** — Bouton « copier » : copie du code dans le presse-papiers, côté navigateur seulement. D'accord ?

**Produits et blog**
- **Q19** — « CATÉGORIES » : le code n'a pas de catégories. Il a les **Univers** (Naruto…, page existante) et les **Familles**. Le bouton mène à `/admin/univers` avec le libellé « UNIVERS », et la pastille affiche « UNIVERS : … » ?
- **Q20** — « TÉLÉCHARGEMENTS » : aucun compteur n'existe. On retire la pastille, ou on la remplace par autre chose (stock, ou nombre de fichiers du Kit) ?
- **Q21** — « Polo » et « autres articles » : la base n'a que trois familles (Cosplay, Accessoire, Kit). Un polo serait aujourd'hui un Accessoire. Ajouter une famille demande une migration et des règles de paiement : hors de cette tâche, sauf demande.
- **Q22** — Corbeilles : la suppression d'un produit, d'un code promo et d'un article n'existe pas (il n'y a que dépublier ou désactiver). La corbeille (a) disparaît ; (b) déclenche l'action existante (dépublier, désactiver) avec une icône adaptée ; (c) on crée la suppression (nouvelle fonction, avec ses règles : commandes liées, journal).
- **Q23** — Fenêtres : « Nouveau produit » et « Nouvel article » sont aujourd'hui des **pages** (et la photo, les fichiers et les images ne s'ajoutent qu'après création). (a) Garder les routes et dessiner ces pages comme une fenêtre posée sur un fond flouté, sans la liste derrière. (b) Vraie fenêtre au-dessus de la liste : cela change le routage, ce qui n'est pas permis sans accord.
- **Q24** — « TYPE DE FICHIER » n'existe pas. Le formats des fichiers de Kit est déduit de chaque fichier (PDF A4, PDF Letter, SVG, STL). On n'affiche pas ce champ ?
- **Q25** — Limites d'image : la maquette dit 5 Mo, le code accepte 15 Mo pour les photos de produit, les images d'article et d'événement. Je garde les limites du code et j'affiche la vraie valeur ?
- **Q26** — Menu « STATUT » (Brouillon / Publié) : aujourd'hui, on publie par un bouton, après vérification des champs obligatoires. Le menu déclenche les mêmes actions (Publier / Dépublier), avec la même vérification. D'accord ?
- **Q27** — Filtres « PUBLIÉS / BROUILLONS » du blog : filtrage côté navigateur sur la liste déjà chargée (pas de nouvelle requête). D'accord ?
- **Q28** — « EXTRAIT (RÉSUMÉ COURT) » n'existe pas. On n'affiche pas ce champ, et la carte montre le début du texte, ou on le crée (migration) ?

**Autres**
- **Q31** — `/scan` (plein écran, hors du dossier admin) : garder son apparence actuelle ou lui appliquer les couleurs de la maquette ?
- **Q32** — Connexion sur mobile : (a) l'image passe au-dessus en bandeau de 160 px ; (b) elle est masquée. Ma proposition : (b), pour que le champ email soit visible tout de suite sur un petit écran.

---

## 5. Décisions de Jonathan (2026-11-15)

**Police**
- **Q1** — Licence vérifiée par Jonathan sur https://pm85122.onamae.jp/851fontTerm.html :
  - usage commercial, police web pour son propre site, modification et redistribution autorisés ;
  - crédit facultatif ;
  - interdit : vendre la police seule, ou un fichier modifié sans contacter l'auteur.

  Version dérivée « KOMA Chikara » créée, script `scripts/polices/creer-koma-chikara.py` ; planche validée le 2026-11-15. Depuis 9.16 a) : fichiers sous `src/fonts/koma-chikara/` (voir § 6).
- **Q2** — kanaA : lettres latines identiques dans les deux fichiers.
- **Q3** — Les deux captures violettes sont ignorées et supprimées du dossier.
- **Q4** — Icônes : `lucide-react`.

**Couleurs**
- **Q5** — Une seule valeur par élément :
  - cartes de chiffres #2E2923 ;
  - grand panneau #322F2B ;
  - pastilles et champs sombres #181512 ;
  - bouton « Univers » (ex-« Catégories ») #8C514E.

**Ajouts autorisés en dérogation à « apparence seulement »**

Conditions :
- lectures côté serveur, réservées à l'admin, avec le RLS existant ;
- écritures par des fonctions SECURITY DEFINER, avec `p_auteur` et le journal d'audit ;
- toute migration est nouvelle et appliquée sur koma-dev seulement ;
- chaque ajout a ses tests.

Les ajouts :
- **Cartes de chiffres** du tableau de bord et des commandes : lecture seule (Q9, Q14).
- **Commandes** : recherche par numéro ou client, et colonne Client, en lecture seule (Q15, Q17).
- **Corbeilles = archivage**, jamais de suppression définitive (Q22) :
  - produits et articles : archivés, c'est-à-dire retirés de la boutique et des listes, et récupérables par un filtre « Archivés » ;
  - codes promo : désactivés ;
  - confirmation avant l'action, et entrée dans le journal d'audit.
- **Pastille « Téléchargements »** (Q20) : pour un Kit, le nombre d'acheteurs qui ont l'accès ; pour un article physique, « VENDUS : N ».
- **« Extrait » du blog** (Q28) : nouveau champ facultatif. S'il est vide, la carte affiche les 160 premiers caractères du contenu.
- **« Type de fichier »** (Q24) : pas de nouveau champ. Pour un Kit, il est déduit des fichiers joints (PDF, SVG, STL, vidéo) ; masqué pour les autres types.
- **« Catégories »** (Q19) : on garde les Univers. Le bouton s'appelle « UNIVERS » et ouvre la gestion existante. Sur chaque carte : une pastille « UNIVERS : … » et une pastille du type d'article.
- **Nouveaux types d'article** (Q21) :
  - « Vêtement » (polos, t-shirts, sweats) : tailles XS à XXL, couleurs, stock, photos ;
  - « Autre article » : photos, prix, stock.

  Avec affichage et filtre dans la boutique publique. Mini-story séparée (spec, tests, commit), **avant** la refonte des Produits.

**Autres réponses**

(Numérotation de cet inventaire.)

**Cadre et menu du profil**
- **Q6** — Ordre du menu de la maquette, groupe Réglages compris : Prestataires, Codes promo, Réglages.
- **Q7** — L'encart « Besoin d'aide ? » est retiré du menu ; son lien passe dans le menu du profil, sous « Aide ».
- **Q8** — Menu du profil :
  - MON PROFIL (`/compte`) ;
  - PARAMÈTRES DU PROFIL (`/compte/preferences`) ;
  - AIDE ;
  - VOIR LE SITE (rechargement complet) ;
  - SE DÉCONNECTER.

  Changement de pseudo, changement d'email et suppression de compte : story future, notée dans `deferred-work.md`.

**Tableau de bord**
- **Q10** — Graphique : les 30 derniers jours, une barre par jour en rouge #D7261E, une date tous les 5 jours sous l'axe.
- **Q11** — « Performance du jour » : nombre et montant des ventes payées aujourd'hui, à l'heure de Goma (Africa/Lubumbashi).
- **Q12** — « Voir plus » : celui de « À faire » mène à `/admin/taches` ; celui de « Indicateurs » mène à la section des indicateurs qui existe déjà.
- **Q13** — Libellé « VENTES PAYÉES (SM-1) », sur 7 et 30 jours.

**Listes et filtres**
- **Q16** — Filtres en pastilles (les autres filtres existants restent, dans le même style).
- **Q18** — Pagination ‹ ›, 20 lignes par page, avec « page X / Y ».
- **Q26 / Q27** — Filtres du blog : TOUS, PUBLIÉS, BROUILLONS, ARCHIVÉS.
- **Q30** — « Copier » met le code dans le presse-papiers et affiche « Copié ».

**Formulaires**
- **Q23** — Les pages restent des pages, sur les mêmes routes, mais dessinées comme une fenêtre. Une adresse ouverte directement fonctionne ; Échap et la croix ramènent à la liste.
- **Q25** — Limite d'image : celle du code, et le texte affiché dit « 15 Mo max ».
- **Q26** — Le menu STATUT reprend les statuts existants, plus « Archivé ».

**Scan et connexion**
- **Q31** — `/scan` garde son écran plein écran, sans le cadre admin ; seules les couleurs et la police changent.
- **Q32** — Sur la page de connexion, l'image est masquée sous 768 px.

**Questions non tranchées** (Q29 et les options proposées) : ma proposition s'applique seulement si elle ne retire rien de l'existant ; sinon, je pose la question.
- **Q29** — Codes promo : « N° » = position dans la liste ; « Date » = date de création (`cree_le`, déjà lue).

**Ordre de travail**
1. Police et planche d'essai, puis validation.
2. Mini-story « Vêtement / Autre article ».
3. Cadre A et composants.
4. Les 7 pages des maquettes et leurs captures, puis validation.
5. Les autres pages, puis la connexion.

Un commit par étape validée, CI verte.

---

## 6. Étape 3 a) faite : police unique KOMA Chikara et règle des 16 px (story 9.16 a, 2026-11-16)

Spec : `_bmad-output/implementation-artifacts/spec-9-16-a-police-koma-chikara-et-16-px.md`. Le cadre A et les composants (étape 3 b) restent à faire.

**Police**
- `src/fonts/koma-chikara/` : `koma-chikara.woff2` (18 Ko), `LICENCE.txt`, `couverture.txt` (175 caractères). Le fichier n'est plus dans `public/fonts/`.
- Signes composés en plus : • ‹ › → − ⋯, et le point médian · (vide dans la police d'origine, comme ses accents). Les signes vides de l'original (¥ © ®) sont retirés de la table des caractères : la police système les dessine.
- Drapeau USE_TYPO_METRICS : Windows mesure la ligne comme Android, Linux et macOS (sans lui, la ligne de base sautait de 12 % du corps quand la police remplaçait le repli).
- `src/lib/fonts.ts` : `komaChikara` seul (`next/font/local`), préchargé, `swap`, repli Arial aux métriques ajustées puis `system-ui, sans-serif`. Nom de famille CSS « komaChikara » imposé par Next (Turbopack ne reprend pas un nom choisi).
- Retirés : `src/fonts/barlow-*.woff2`, l'option `NEXT_PUBLIC_TITRES_SAKURA` (`src/lib/env.ts`, `.env.example`, README), `src/lib/typo/titre.ts` et son test, le `@font-face` Sakura du layout, les règles `.titre-vitrine[data-police="sakura"]`. Gardé : `src/fonts/filigrane/Barlow-Regular.ttf` (filigrane PDF).

**Endroits touchés (16 px et poids)**
- Rôles de `src/app/globals.css` : `t-small` 14 → 16 px (interligne 20 → 24), `t-label` 14 → 16 px (18 → 20) ; poids et italique retirés de tous les rôles ; `font-synthesis: none` sur `body` ; `--font-corps` et `--font-condensee` → KOMA Chikara.
- `src/components/accueil/heros-visiteur.css` : surtitre 12, colonnes 14, bouton 13, étiquette de carte 11, phrase du kit 13, signature 12 → 16 px ; titres rouges des colonnes et étiquette du kit 19 px gras → 24 px (seuil « grand texte » sans gras, contraste inchangé) ; titre du héros 58 → 48 px à partir de 1280 px (KOMA Chikara est plus large : à 58 px, « OU FABRIQUE-LE. » passait sur les boutons).
- Classes `font-bold` / `font-semibold` retirées (sans effet avec un seul poids) : connexion (`FormulaireConnexion`, `QuestionsAccueil`), admin (`BandeauAdmin`, `DepotPhotoWhatsapp`, `ListeArticles`, `SectionAlertes`, `SectionBenevoles`), blog (`ArticleComplet`, `ContenuArticle`), catalogue (`FiltresCatalogue` : le filtre courant reste marqué par sa bordure rouge de 2 px), compte (`EnvoiPhotoClient`), fiche (`BandeauZone`, `DoubleOption`, `SelecteurCouleur`, `SelecteurTaille`, `ZoneAchat`), bandeau navigateur intégré, `/scan` (`EcranScan`, `PanneauHorsLigne`, `ResultatPlein`).
- `TitreVitrine` : même API, rend le rôle `t-*` avec les accents.
- Mot géant « Cosplay » du héros : taille × 0,74 (440 → 326 px à partir de 1280 px) pour garder la largeur d'avant, et ancré à gauche (position calculée pour que le bord droit reste à sa place) : ancré à droite, il bougeait de plusieurs centaines de pixels à l'arrivée de la police (CLS 0,158).
- En-tête : liens et réglages à partir de 1280 px (`xl`), menu ☰ en dessous (`EnTete.tsx`, `MenuPanneau.tsx`) ; à 1024 px, l'en-tête d'une personne connectée débordait (panier admin 1215 px, `/compte` client 1075 px). Décision de Jonathan du 2026-11-16.

**Tests**
- `tests/unit/taille-minimale-texte.test.ts` (feuilles CSS et composants, fichier et ligne en cas d'échec), `tests/unit/police-unique.test.ts` (ni Barlow hors filigrane ni Sakura, `fonts.ts`, aucun poids demandé, couverture des traductions).
- `tests/e2e/police.spec.ts` (/fr, /en/kits, /fr/connexion, /fr/admin : police chargée, aucun texte calculé sous 16 px, 320 px, axe ; préchargement), `tests/e2e/police-secours.spec.ts` (« TEST_ 鬼滅の刃 cosplay 🔥 » sans carré vide sur la fiche et le catalogue).

**CLS de l'accueil `/fr`** (build de production local, Chromium sous Windows, cache vide ; `scripts/captures-police.mjs cls`, médiane de 3 chargements, puis séries complémentaires)

| Mesure | Avant (`main` 017b58b) | Après (état final) |
|---|---|---|
| Réseau direct, 390 et 1440 px | 0 | 0 |
| 4G lent émulé, 320 px | non mesuré | 0 ou 0,0052 (5 chargements) |
| 4G lent émulé, 390 px | 0,0094 (10 sur 10) | 0 (5 sur 5) ; Android simulé : 0,0007 |
| 4G lent émulé, 1440 px | 0 (5 sur 5) | 0 ou 0,0007 ; Android simulé : 0,0037 |

Étapes : le mot géant ancré à droite bougeait à l'arrivée de la police (0,158 à 1440 px) ; le titre et le surtitre en majuscules prenaient une ligne de plus avec le repli automatique de Next (Arial seul, réglé sur les minuscules : 0,0551 à 390 px). Corrigé par nos propres replis (`globals.css` : Arial puis Roboto, réglages distincts pour le texte courant et les majuscules, pile `--font-capitales` sur les rôles en capitales), « FABRIQUE-LE. » insécable, taille du titre calculée pour trois lignes de 320 à 700 px et hauteur réservée. « Android simulé » : la sonde retire Arial et sert le fichier Roboto de Google Fonts (mesure locale, rien dans le dépôt) ; à confirmer sur un vrai téléphone. `font-display: optional` supprimerait tout décalage mais afficherait la première visite lente sans KOMA Chikara (essayé, écarté).

Constat APRÈS dans l'admin à 1024 px : « ESPACE ADMINISTRATEUR » se coupe en plein mot dans la barre du haut (cadre : étape 3 b).

**Captures** : `docs/captures-police/index.html` (ignoré par Git), 9 pages × clair/sombre × 1440/1024/390 px, avant et après ; `/compte` pris avec un Compte client (un admin y est renvoyé vers `/admin`), avant refait sur un build de `main`. Plus aucun débordement horizontal APRÈS (le panier à 1024 px débordait AVANT : capture `docs/design/defauts/panier-1024-avant-9-16-a.jpg`).
