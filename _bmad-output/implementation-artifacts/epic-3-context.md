# Epic 3 Context : Les Kits et la bibliothèque

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Jonathan crée ses Kits (fichiers, vidéo, chapitres, sous-titres) et les relie à ses cosplays ; le visiteur découvre les Kits (catalogue, fiche, double option, accueil) ; le visiteur connecté obtient le Kit gratuit, télécharge ses patrons filigranés et regarde le tutoriel chapitre par chapitre, avec reprise sur un autre appareil. Aucun paiement dans cet epic : l'accès passe par une Commande `offerte`, ce qui éprouve les règles 1 et 13 avant tout Prestataire.

## Stories

- Story 3.1 : Créer un Kit et ses fichiers
- Story 3.2 : Vidéo, chapitres, sous-titres et publication d'un Kit
- Story 3.3 : Catalogue Kits et fiche Kit
- Story 3.4 : Double option et Kit lié dans toute la boutique
- Story 3.5 : Obtenir le Kit gratuit
- Story 3.6 : Ma bibliothèque et téléchargement des fichiers
- Story 3.7 : Lecteur vidéo à chapitres

## Requirements & Constraints

- Un Kit (Famille `kit`) a titre, description et matériel nécessaire en FR et EN, un univers, un prix USD, un niveau (Débutant / Intermédiaire / Avancé ; Beginner / Intermediate / Advanced). Le prix 0 USD est réservé au Kit gratuit, seul produit à 0. Un Kit se lie à au plus un cosplay ou accessoire, et inversement (un pour un, contrainte en base).
- Fichiers de kit : PDF A4, PDF US Letter, SVG, STL, transcriptions texte. Remplacer un fichier augmente sa version et est journalisé. Un fichier ajouté ou remplacé après l'achat est disponible sans rachat.
- Vidéo complète en bibliothèque privée, extrait public en bibliothèque publique, chapitres (titre FR/EN, instant de début, ordre Monter / Descendre), sous-titres WebVTT (français obligatoire, anglais facultatif ; sous `/en`, l'absence de sous-titres anglais est signalée).
- Publication refusée avec la liste des manques : prix, photo, texte alternatif, textes FR et EN, niveau, au moins un fichier, vidéo complète, sous-titres français. L'absence de sous-titres anglais ne bloque pas.
- Fiche Kit : photos, prix USD, niveau, matériel, liste des fichiers (format, taille), plan des chapitres, résumé de la Licence de kit (usage personnel, ni revente ni partage), extrait lisible au clavier avec sous-titres, métadonnées, Open Graph, JSON-LD Product + Offer (sans `aggregateRating` ni `review`), VideoObject, BreadcrumbList, bouton Partager. Le HTML ne contient jamais de chemin `kits-private` ni d'identifiant de la bibliothèque Bunny privée.
- Catalogue Kits : même fonctionnement que celui des produits physiques (filtres univers et prix, tri, « Voir plus » par 12, adresse fidèle) plus le filtre de niveau ; rubrique Kits dans l'en-tête et le menu.
- Kit gratuit : visiteur non connecté renvoyé vers la connexion puis revenu sur la fiche ; Compte complet (âge déclaré) ; acceptation de la Licence de kit (sans renonciation au droit de rétractation) enregistrée avec version du texte et heure, sinon refus (`KS_ACCEPTATION_MANQUANTE`). Une Commande `offerte` n'est jamais `payee`, sans `paye_le`, sans Prestataire ni référence. Un second essai pour le même Kit est refusé. Texte de la licence absent : « [Texte à fournir] » en développement, échec du build de production. Jonathan ne publie le Kit gratuit qu'à partir de la 5e semaine.
- Téléchargement : lien signé de 60 secondes, un nouveau lien à chaque clic, aucune limite de téléchargements, accès vérifié à chaque fois. PDF filigrané à la première remise par Compte et par version, copie réutilisée ensuite ; SVG, STL et transcriptions sans filigrane. Filigrane : « Acheté par jo•••@gmail.com · Commande KS-AAAA-NNNNNN · {nom du site} » (2 premiers caractères de l'email, numéro de la Commande d'origine de l'accès, nom lu dans le réglage `nom_site`).
- Vidéo : jeton Bunny de courte durée créé seulement après vérification de l'accès ; première image en moins de 5 s sur 3G simulée, qualité adaptative, rendu 360p ; aucun bouton de téléchargement ; position enregistrée toutes les 15 s et à la pause ; « terminée » à 90 % ; reprise sur un autre appareil ; progression en texte dans la bibliothèque (« Chapitre 3 sur 8 · 2 chapitres terminés »).
- Aucune image ni police tierce sans licence notée dans `docs/licences/` (police TTF du filigrane comprise).

## Technical Decisions

- Module `catalogue` : tables `fichier_kit` (données publiables seulement : noms FR/EN, format, taille, ordre, version) et `fichier_kit_prive` (chemin dans `kits-private`), `video_kit`, `video_kit_prive` (identifiant Bunny privé), `chapitre_kit`. Les tables `_prive` n'ont aucune politique de lecture ; un test CI vérifie les colonnes lisibles par `anon` (AD-30).
- Module `commande` : `commande` (numéro `KS-AAAA-NNNNNN` par séquence, type `produits` ou `pass`, statut parmi les valeurs d'AD-14, `acceptations`) et `ligne_commande`. Module `bibliotheque` : `acces_kit` unique par (Compte, produit), `progression_video`. RLS : le client lit seulement ses Commandes et accès, aucune écriture (AD-2).
- Écritures par fonctions Postgres `SECURITY DEFINER` : `offrir_commande` (Commande `offerte` puis `livree` dans la même transaction, deux lignes de journal) et `bibliotheque_ouvrir_acces`. Même schéma de sécurité qu'à l'epic 2 (`exiger_admin`, `ks.auteur`, journal, `REVOKE`/`GRANT`). Tests SQL pour les refus.
- Envois de gros fichiers : le serveur vérifie le rôle et signe une autorisation, le client envoie en TUS directement vers `kits-private` (fichiers) ou la bibliothèque Bunny privée (vidéo), avec progression, reprise et annulation (AD-18). Clés Bunny côté serveur uniquement ; variables dans `.env.example` sans valeur.
- Téléchargement : `GET /api/kits/fichier/[id]` vérifie `acces_kit`, renvoie une URL signée 60 s. Filigrane avec `@cantoo/pdf-lib`, copies rangées dans `kits-private/filigranes/<compte>/…`. Lecture vidéo : `hls.js`, jeton CDN Token Auth Bunny de répertoire (playlist et segments), durée à fixer au plan de la story (AD-11).
- Contenus traduits en colonnes `*_fr` / `*_en` ; prix en centimes entiers, affichage par `src/lib/argent.ts` ; cache public `'use cache'` invalidé à la publication ; l'email « Kit ouvert » sera planifié à partir de l'epic 4 par `envois_planifier`.
- Réglages manuels de la definition of done : Jonathan crée les deux bibliothèques Bunny (privée avec CDN Token Auth, publique), active le rendu 360p, saisit les clés dans `.env.local` ; test manuel sur téléphone qu'une adresse de vidéo privée sans jeton valide est refusée.

## UX & Interaction Patterns

- Formulaires admin : libellé visible, erreur sous le champ reliée par `aria-describedby`, résumé `role="alert"`, Monter / Descendre pour l'ordre ; envoi de fichier avec progression, reprise et « Annuler l'envoi ».
- Fiche d'un cosplay avec Kit lié publié : sélecteur à deux options (radios natifs) « Prêt à porter » (défaut) / « Le fabriquer moi-même » ; le second affiche sur place un panneau « Kit lié » (prix, accès immédiat, lien « Voir le kit ») et masque tailles, délai, bandeau et zone d'achat, sans changer de page. Le bandeau de zone propose aussi le Kit lié ; si le Plafond de fabrication est atteint, « Commandes complètes pour le moment » s'accompagne du Kit lié.
- Accueil : le héros mène au Kit lié du Cosplay vedette (tuile avec prix sur ordinateur) ; bloc 1 « Porte-le ou fabrique-le » seulement si le Kit lié est publié ; bloc 3 « Kits » avec le Kit gratuit en évidence (« Ton premier accessoire, offert. ») ; tuile de catégorie Kits ; un bloc sans contenu reste masqué.
- Bibliothèque : une ligne par Kit (vignette, titre, lien étendu à la ligne) ; vide : « Aucun kit dans ta bibliothèque. » avec lien vers le catalogue Kits. Téléchargement : « Préparation du lien… » annoncé, messages « Le lien a expiré. Touche à nouveau Télécharger. » et « Le téléchargement n'a pas abouti. Réessaie. ». Bouton « Ouvrir dans ma bibliothèque » si le Kit est déjà possédé.
- Lecteur : tout au clavier (lecture/pause, piste temporelle en slider ARIA avec valeur en texte, chapitres en `<button>` avec `aria-current`, sous-titres, plein écran) ; sous-titres par défaut dans la langue de l'interface ; erreur de chargement avec message et « Réessayer », reprise à la dernière position connue.

## Cross-Story Dependencies

- 3.1 étend le formulaire de produit de l'epic 2 (Famille `kit`, Kit lié) ; 3.2 y ajoute vidéo et publication ; 3.3 réutilise le catalogue de la story 2.4 ; 3.4 modifie la fiche physique (2.5), le héros (2.6) et l'accueil (2.7).
- 3.5 crée les tables de commande et d'accès dont dépendent 3.6 et 3.7 ; la version des fichiers (3.1) sert aux copies filigranées (3.6) ; les chapitres et la vidéo (3.2) alimentent le lecteur (3.7).
- Dépend du réglage `nom_site` (story 1.2) et de la connexion avec âge déclaré (epic 1). L'epic 4 ajoute l'achat des Kits payants, le panier et les Prestataires, et réutilise `commande`, `ligne_commande` et `acces_kit`.
