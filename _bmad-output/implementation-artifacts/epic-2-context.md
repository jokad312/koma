# Epic 2 Context : Le catalogue et la page d'accueil

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Jonathan crée et publie ses cosplays et accessoires depuis l'admin ; le visiteur parcourt des catalogues filtrables, ouvre des fiches complètes (prix, disponibilité, délai, remise à Goma et Bukavu) et découvre l'accueil avec son héros vidéo. Les Kits (fiche, catalogue, double option, blocs 1 et 3 de l'accueil) arrivent à l'epic 3.

## Stories

- Story 2.1 : Univers et création d'un produit physique
- Story 2.2 : Photos et publication d'un produit
- Story 2.3 : Réglages de remise et Plafond de fabrication
- Story 2.4 : Catalogues Cosplays et Accessoires
- Story 2.5 : Fiche d'un produit physique
- Story 2.6 : Héros vidéo de l'accueil
- Story 2.7 : Blocs de la page d'accueil

## Requirements & Constraints

- Un produit physique a une Famille (cosplay ou accessoire), des textes FR et EN, un univers, un prix en USD, des variantes (tailles XS à XXL ; Sur-mesure pour un cosplay), un stock, une option de Fabrication sur commande et un Délai de fabrication par produit ou par variante, affiché avant le paiement.
- Seuls les produits publiés (`publie_le` non nul et passé) existent côté public ; un brouillon est introuvable (catalogue, plan du site, URL directe). Publication refusée sans prix, photo, texte alternatif, textes FR et EN, variante.
- Univers : genres génériques saisis par Jonathan, aucune liste par défaut (E-29). Aucune donnée d'exemple, aucun prix inventé.
- Disponibilité : « En stock » ou « Fabrication sur commande » avec délai ; Plafond de fabrication atteint : « Commandes complètes pour le moment » (jamais « Épuisé »), articles en stock toujours vendables ; jamais de quantité affichée.
- Remise des produits physiques à Goma (retrait gratuit ou livraison) et Bukavu seulement, forfaits et lieu de retrait réglés dans l'admin, rien d'inventé si non réglé. Le bandeau de zone est visible par tous, sans détection de pays.
- Photos : JPEG, PNG, WebP, 15 Mo au plus, métadonnées (EXIF, GPS) supprimées, texte alternatif FR et EN obligatoire ; seulement les photos de Jonathan, aucune image de franchise (règle 6).
- Catalogues : « Voir plus » par 12 avec vrai lien à curseur ; filtres univers, prix (tranches réglées dans l'admin), disponibilité ; tri nouveauté et prix ; l'adresse reflète filtres et tri.

## Technical Decisions

- Module `catalogue` propriétaire de `univers`, `produit`, `variante` ; les autres modules passent par ses fonctions exportées (AD-1). Contenus traduits en colonnes `*_fr` et `*_en` (AD-16). Prix en centimes entiers USD, affichage par `src/lib/argent.ts` seulement (AD-8).
- Écritures par Server Action (Zod) puis fonction Postgres `SECURITY DEFINER` (`search_path = ''`, `p_auteur jsonb` en premier, `REVOKE` à `anon`/`authenticated`, `GRANT` à `service_role`, droit revérifié par `exiger_admin`, `ks.auteur` posé avant le DML, trigger `journaliser`). Le stock ne change que par ces fonctions (AD-3) ; l'admin lit par le client service après `droits.ts`.
- RLS : `anon` et `authenticated` n'ont qu'un `SELECT` sur les produits publiés et leurs variantes et sur les univers ; aucune colonne `prive`, `chemin` ou `note_admin` lisible par `anon` (AD-30).
- Disponibilité : `stock_disponible(variante)` et `places_fabrication_utilisees()` créées en 2.3 (lecture pure), remplacées à l'epic 4 pour compter les réservations ; le Sur-mesure est toujours en fabrication (AD-26).
- Cache public `'use cache'` + `cacheTag` (étiquettes de `src/lib/cache/etiquettes.ts`) invalidé à la publication ; toute donnée qui dépend des ventes (badge de disponibilité) est rendue à chaque requête (AD-17). Photos : bucket privé `galerie-attente` puis copie nettoyée vers `produits-public` (AD-18).

## UX & Interaction Patterns

- Admin : formulaires à libellé visible, erreur sous le champ reliée par `aria-describedby`, résumé `role="alert"`, rien n'est ressaisi après un échec ; listes en tableau (`<caption>`, `<th scope>`) sur ordinateur et en cartes sur mobile ; pastille de statut icône + mot ; une transition non autorisée est absente ; « Valeur à fixer » plutôt qu'une valeur inventée ; boutons Monter / Descendre de 44 px pour l'ordre des photos.
- Sélecteurs à options : radios natifs, aucune sélection ne déclenche d'action, choix = bordure rouge 2 px et coche.
- Catalogue : grille 2 colonnes à 375 px, 4 sur ordinateur, nombre de résultats annoncé, « Effacer les filtres » ; fiche : galerie accessible (« Photo 2 sur 5 »), prix, tailles, disponibilité, bandeau de zone, JSON-LD Product + Offer sans `aggregateRating` ni `review`.

## Cross-Story Dependencies

- 2.1 crée les tables, l'admin des produits (liste, formulaire) et les univers ; 2.2 y ajoute photos et publication ; 2.3 les réglages de remise et les deux fonctions de disponibilité ; 2.4 à 2.7 lisent le catalogue public.
- La question « univers » de l'étape « questions » de `/connexion` (1.6) arrive en 2.1 ; l'email « nouveau produit dans ton univers » (epic 9) lit la préférence de profil.
- L'epic 3 ajoute la Famille `kit` et le Kit lié ; l'epic 4 remplace `stock_disponible` et `places_fabrication_utilisees` ; l'epic 6 traite les Mesures du Sur-mesure (E-10 bloque seulement cette story).
