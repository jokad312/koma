---
title: 'Story 2.4 : catalogues Cosplays et Accessoires'
type: 'feature'
created: '2026-10-26'
status: 'done'
baseline_commit: '4741056a404c82e98a1b1ecc656bff668bafbaa3'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les produits publiés (2.2) ne sont visibles nulle part : aucun catalogue public, aucun filtre, aucun tri, aucune pagination, aucune rubrique dans la navigation, aucune entrée au plan du site.

**Approach:** Deux pages publiques `/cosplays` et `/accessoires` (`/en/accessories` en anglais) qui lisent le catalogue par une fonction SQL de listage à curseur, avec filtres (univers, prix par tranches réglées, disponibilité), tri, « Voir plus » en vrai lien prolongé par JavaScript, annonce du nombre de résultats, métadonnées, BreadcrumbList, plan du site, rubriques de navigation et sélecteur de langue qui garde la requête.

## Boundaries & Constraints

**Always:** Nouvelles migrations seulement. Adresses publiques : `/fr/cosplays`, `/en/cosplays`, `/fr/accessoires`, `/en/accessories` ; l'adresse de l'autre langue (`/en/accessoires`, `/fr/accessories`) redirige (308) vers la bonne, les `hreflang`, le canonique, le plan du site et le sélecteur de langue utilisent toujours l'adresse propre à chaque langue. Mécanisme au choix du développeur (de préférence un réécriture interne dans `src/proxy.ts` plus une table unique d'adresses par langue), sans toucher aux pages existantes.
Lecture : fonction SQL `lister_catalogue(...)` en `security invoker`, `stable`, exécutable par `anon` et `authenticated` (ajoutée à la liste blanche de `garde_ecritures.test.sql`, comme `stock_disponible`), à curseur (jamais par décalage), 12 produits par page (13 lus pour savoir s'il en reste), tri `nouveautes` (publication décroissante puis identifiant), `prix_asc`, `prix_desc` (prix puis identifiant), filtres : famille, univers, tranche de prix (bornes en centimes), disponibilité `en_stock` ou `sur_commande`. La disponibilité d'un produit vient de `stock_disponible` et `places_fabrication_utilisees` (jamais d'un calcul dupliqué dans le code TypeScript) pour que l'epic 4 les remplace sans toucher au catalogue. Une fonction `capacite_fabrication_atteinte()` (`security definer`, `search_path = ''`, lecture pure, liste blanche) compare `places_fabrication_utilisees()` au `plafond_fabrication` (réglage privé) ; plafond non réglé = jamais atteinte. Renvoie par produit : identifiant, slug, famille, titre et texte alternatif de la première photo dans la langue demandée, fichier de la première photo, prix en centimes, univers, état de disponibilité. États : `en_stock` (au moins une variante avec stock disponible), sinon `sur_commande` (au moins une variante en fabrication sur commande et capacité non atteinte), sinon `complet` (fabrication possible mais capacité atteinte), sinon `indisponible`. Jamais de quantité dans le résultat. Seuls les produits publiés et passés, avec au moins une photo, sont listés (RLS).
Cache : la coque de page, les tranches de prix et la liste des univers peuvent être mis en cache (étiquettes `reglages` / `catalogue` ; l'étiquette `catalogue` est aussi invalidée à la création d'un univers) ; le listage, le badge et le filtre de disponibilité sont rendus à chaque requête (AD-17). Compatible `cacheComponents` (lecture de `searchParams` sous Suspense).
Adresse : `?univers=<id>&prix=<bas>-<haut>` (centimes, haut vide = tranche ouverte) `&dispo=en_stock|sur_commande&tri=nouveautes|prix_asc|prix_desc&curseur=<opaque>` ; paramètres inconnus ou mal formés ignorés (jamais d'erreur 500) ; un curseur invalide ou périmé ramène à la première page. Une adresse partagée ou rechargée affiche la même liste.
Page : grille de cartes (2 colonnes à 375 px, 4 sur ordinateur) : photo (`next/image`, texte alternatif de la photo), nom en `h3 > a` étendu à toute la carte (vers `/cosplays/<slug>` ou `/accessoires/<slug>`, pages de la 2.5), prix USD par `src/lib/argent.ts`, badge de disponibilité en icône + mot (« En stock », « Fabrication sur commande », « Commandes complètes pour le moment », « Indisponible pour le moment ») sans quantité ni mot « Épuisé ». Filtres en liens (pilules de 44 px, sans JavaScript, `aria-current` sur le choix actif), tranches réglées dans l'admin ; aucune tranche réglée : pas de filtre de prix ; aucun univers : pas de filtre d'univers. Mobile : filtres repliés sous « Filtrer (n) » (n = filtres actifs), `<details>` natif. Nombre de résultats (de la page affichée et total si connu) annoncé en `role="status"` ; « Effacer les filtres » dès qu'un filtre ou un tri non par défaut est actif. État vide / sans résultat : une phrase courte et « Effacer les filtres » (UX-DR45).
« Voir plus » : vrai lien `<a>` vers la même page avec le curseur de la suite ; avec JavaScript, les 12 suivants s'ajoutent sous la liste (Server Action, rendu à la requête), l'adresse est mise à jour (`history`), le focus va au premier produit ajouté ; sans JavaScript, le lien ouvre la liste prolongée.
Référencement : `generateMetadata` (titre, description, Open Graph, `hreflang`) ; page filtrée ou triée : `noindex, follow` avec canonique vers la page de base ; page à curseur sans filtre : indexable, canonique propre ; JSON-LD `BreadcrumbList` (Accueil › Cosplays / Accessoires) ; plan du site : les deux catalogues dans les deux langues, avec leur adresse propre ; `RUBRIQUES` ajoute Cosplays et Accessoires (en-tête et menu ☰) avec l'adresse de la langue courante.
Sélecteur de langue (1.3) : conserve le chemin ET la requête (`useSearchParams` sous Suspense), vers l'adresse propre de l'autre langue.
Textes dans `messages/{fr,en}.json` (`Catalogue.*`), tutoiement, sans emoji, aucun texte en dur. Tests : listage SQL (RLS brouillon/dépublié, tri, curseur sans doublon ni trou, filtres, états de disponibilité, aucune quantité), analyse de l'adresse, cartes, filtres, « Voir plus », sélecteur de langue, plan du site, redirections d'adresses, axe/clavier/375 px en e2e sur les pages sans simuler de produit.

**Never:** Pas de fiche produit (2.5), pas de panier, pas de recherche texte, pas de catalogue des Kits (epic 3), pas de héros ni de blocs d'accueil (2.6, 2.7), pas de produit ou de photo d'exemple dans le dépôt ou la base, aucune image tierce, pas d'avis ni de note, pas de modification d'une migration appliquée, pas de `npm run dev`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Aucun produit publié | `/fr/cosplays` | phrase courte, pas de filtre, pas d'erreur | N/A |
| Brouillon / dépublié | tout visiteur | absent de la liste et du plan du site | N/A |
| 30 publiés | première page | 12 cartes, lien « Voir plus » portant le curseur | N/A |
| Suite | `?curseur=…` | 12 suivants, sans doublon ni trou, quel que soit le tri | curseur invalide : première page |
| Voir plus avec JS | clic | 12 ajoutés, adresse mise à jour, focus sur le premier ajouté | échec réseau : message, lien reste utilisable |
| Filtre univers + prix + dispo | adresse | liste filtrée, nombre annoncé, « Effacer les filtres » | paramètre inconnu : ignoré |
| Aucun résultat | filtre trop strict | phrase + « Effacer les filtres » | N/A |
| Aucune tranche réglée | tranches vides | pas de filtre de prix | N/A |
| Disponibilité | stock > 0 / fabrication / capacité atteinte / rien | `en_stock` / `sur_commande` / `complet` / `indisponible`, jamais de quantité | N/A |
| Langue | `/fr/accessoires?tri=prix_asc` | bascule vers `/en/accessories?tri=prix_asc` | N/A |
| Mauvaise langue d'adresse | `/en/accessoires` | redirigé vers `/en/accessories` | N/A |
| Mobile 375 px | page | 2 colonnes, filtres repliés, pas de défilement horizontal | N/A |
| Base indisponible | lecture en erreur | message d'erreur sobre, jamais une liste vide inventée | `generique` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261025100000_reglages_remise_et_disponibilite.sql` (`stock_disponible`, `places_fabrication_utilisees`, tranches) et `20261024100000_photos_et_publication.sql` (`produit_photo`) : à utiliser, ne pas modifier. Nouvelle `supabase/migrations/20261026100000_listage_catalogue.sql` ; tests `supabase/tests/listage_catalogue.test.sql` ; liste blanche de `garde_ecritures.test.sql`.
- `src/proxy.ts`, `src/i18n/routing.ts`, `src/i18n/navigation.ts`, `src/components/layout/{SelecteurLangue,rubriques,EnTete,MenuPanneau}.tsx`, `src/app/sitemap.ts`, `src/lib/seo/{url,metadata,jsonld}.ts` : étendre pour les adresses par langue, la requête conservée, les rubriques, le plan du site, le fil d'Ariane.
- `src/modules/catalogue/{queries,types,schemas}.ts` : `listerCatalogue(params, locale)` (client public, sans cache), `lireUniversPublics` existant, `lireTranchesPrix` existant ; nouveau `src/modules/catalogue/adresse.ts` (analyse/sérialisation pures de la requête et du curseur) ; Server Action `chargerPlusProduits` pour « Voir plus » ; composants `src/components/catalogue/{GrilleProduits,CarteProduit,FiltresCatalogue,VoirPlus,BadgeDisponibilite}.tsx` ; pages `src/app/[locale]/cosplays/page.tsx` et `accessoires/page.tsx` (une seule implémentation partagée).
- `src/lib/argent.ts`, `src/lib/supabase/stockage.ts` (`urlPhotoPublique`), `src/lib/supabase/images-distantes.ts`, `src/lib/cache/etiquettes.ts`, `src/lib/supabase/types.ts` (régénéré après le push).
- `tests/unit/*`, `tests/e2e/*` (un fichier `catalogue.spec.ts`), `tests/unit/messages-parite.test.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] Migration + `listage_catalogue.test.sql` + liste blanche -- `lister_catalogue`, `capacite_fabrication_atteinte` -- AD-3, AD-17, AD-26
- [ ] Adresses par langue, redirections, sélecteur de langue avec requête, rubriques, plan du site -- AD-16
- [ ] Analyse d'adresse, listage, Server Action « Voir plus », composants, pages, métadonnées, JSON-LD, messages FR/EN -- UX-DR19 à UX-DR21, UX-DR45
- [ ] Tests unitaires et e2e ; `db:push` sur koma-dev uniquement après la revue, puis `npm run types`

**Acceptance Criteria:**
- Given des produits publiés, when un visiteur ouvre un catalogue, then il voit la grille avec photo, nom, prix USD et badge sans quantité, et un brouillon ou produit dépublié n'apparaît ni dans la liste ni dans le plan du site
- Given des filtres et un tri, when il en choisit, then l'adresse les reflète, le nombre est annoncé, « Effacer les filtres » apparaît, et sans tranche réglée le filtre de prix est absent
- Given plus de 12 produits, when il touche « Voir plus », then l'adresse contient le curseur, avec JavaScript les 12 suivants s'ajoutent et le focus va au premier ajouté, sans JavaScript le lien ouvre la liste prolongée
- Given une adresse filtrée, triée ou prolongée, when il change de langue, then il reste sur la même page avec la même requête, vers l'adresse propre de l'autre langue
- Given `lint`, `typecheck`, `test`, `build`, then tous passent ; `test:sql` en CI

## Implementation Notes

## Spec Change Log

- Revue : les phrases « les 12 suivants s'ajoutent » et « le lien ouvre la même liste prolongée » se concilient ainsi : avec JavaScript, 12 produits s'ajoutent ; une adresse à curseur (lien sans JavaScript, rechargement, partage) affiche la liste cumulée depuis le début jusqu'à ces 12 produits. Le curseur porte la clé de reprise et le nombre déjà affiché.

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Une adresse à curseur n'affiche que les 12 suivants, pas la liste prolongée | high | patch | texte figé : « liste prolongée », « même liste » ; curseur portant aussi le nombre déjà affiché |
| Curseur périmé : canonique auto-référent, état vide trompeur ; « Voir plus » sans nouveau produit réécrit l'adresse | medium | patch | repli silencieux non répercuté |
| Texte alternatif anglais sans repli français | medium | patch | règle 7 |
| `lister_catalogue` ne dépend que de la RLS pour « publié » | low | patch | défense en profondeur directe |
| Région de statut remontée avec la grille | medium | patch | annonce du nombre non garantie |
| Pas de `h2` avant les cartes | low | patch | ordre des titres |
| Tests : ouverture des filtres sur ordinateur, JSON-LD du fil d'Ariane, curseur avec filtres, invalidation d'étiquette | medium | patch | non couverts |
| Index et coût de `lister_catalogue` | medium (non vérifié) | defer | à mesurer quand le catalogue grandira |
| Filtre d'univers listant des univers sans produit dans la famille | low | defer | page vide possible |
| E2E qui passent sans produit | medium | defer | la spec interdit les produits d'exemple ; couvert en Vitest |
| `noindex, follow` avec canonique vers la page de base | low | rejeté | exigé par la spec |
| Filtre non reconnu, clé de grille, `Buffer` côté client, `priority`, séparateur « › », cartes vers des fiches absentes jusqu'à la 2.5, ancre perdue, curseur SQL nul | low | rejeté | cosmétique ou sans effet constaté |

## Design Notes

Dépasse largement 1600 jetons ; non scindée (liste SQL, adresses, pages et composants se testent ensemble). Choix du développeur : l'état `indisponible` (ni stock ni fabrication) s'affiche « Indisponible pour le moment » (jamais « Épuisé ») ; les fiches de la 2.5 n'existent pas encore, donc les liens des cartes mènent à une 404 jusqu'à la story suivante ; `capacite_fabrication_atteinte` est `security definer` pour lire le plafond privé sans l'exposer ; canonique des pages filtrées vers la page de base.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur
- `npm run test:e2e` -- parcours existants et catalogue verts
- `npm run test:sql` -- CI

**Manual checks:**
- Publier un produit complet (2.2), ouvrir `/fr/cosplays` et `/en/accessories`, filtrer, trier, « Voir plus » avec plus de 12 produits, changer de langue avec une requête, 375 px.
