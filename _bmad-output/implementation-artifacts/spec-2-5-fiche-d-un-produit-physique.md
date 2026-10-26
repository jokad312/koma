---
title: 'Story 2.5 : fiche d''un produit physique'
type: 'feature'
created: '2026-10-26'
status: 'done'
baseline_commit: '9f410a50a7dc25ef8c02e274444f2e9ab2044c82'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les cartes du catalogue (2.4) mènent à des pages qui n'existent pas : aucune fiche ne montre les photos, le prix, la disponibilité par taille, le délai, la remise à Goma et Bukavu, ni les données de partage et de référencement.

**Approach:** Page publique `/cosplays/[slug]` et `/accessoires/[slug]` (`/en/accessories/[slug]`) qui lit le produit publié, ses photos et la disponibilité de chaque variante par une fonction SQL sans quantité, avec galerie accessible, sélecteur de taille sur place, bandeau de zone, modes de remise, partage, métadonnées, JSON-LD Product + Offer et BreadcrumbList, et entrées au plan du site.

## Boundaries & Constraints

**Always:** Nouvelles migrations seulement. Un brouillon, un dépublié ou un produit d'une autre famille que celle de l'adresse : `notFound()` (404). Adresses par langue de la 2.4 (`src/i18n/adresses.ts`), `hreflang`, canonique et plan du site à l'adresse propre de chaque langue.
Disponibilité : fonction SQL `disponibilite_variantes(p_produit uuid)` en `security invoker`, `stable`, exécutable par `anon` et `authenticated` (liste blanche de `garde_ecritures.test.sql`), qui renvoie par taille un état (`en_stock`, `sur_commande`, `complet`, `indisponible`) et le délai de fabrication effectif (celui de la variante, sinon celui du produit), JAMAIS de quantité ; elle s'appuie sur `stock_disponible` et `capacite_fabrication_atteinte` (2.3, 2.4) pour que l'epic 4 les remplace sans toucher à la fiche. Disponibilité et prix sont lus à chaque requête (AD-17, règle 3) ; le reste peut être mis en cache avec l'étiquette `catalogue`.
Galerie (UX-DR22) : photos dans l'ordre, balayage tactile (défilement natif à accrochage) et boutons « Photo précédente / Photo suivante », vignettes atteignables au clavier, texte « Photo 2 sur 5 » annoncé en `role="status"`, texte alternatif FR/EN de chaque photo, bouton « Agrandir » qui ouvre la boîte de dialogue existante (`ui/Dialogue`) avec + et − ; le zoom natif du navigateur n'est jamais bloqué (pas de `user-scalable=no`). Sans photo valide : la fiche n'existe pas (un produit publié a toujours au moins une photo).
Titre en Sakura Town ou Barlow Condensed en entier (`TitreVitrine`, UX-DR4), prix par `src/lib/argent.ts`, description, fil d'Ariane (Accueil › Cosplays/Accessoires › produit) avec JSON-LD `BreadcrumbList`.
Tailles (UX-DR23) : radios natifs en groupe nommé, flèches, aucune sélection ne change de page ni ne déclenche d'action ; choisir une taille met à jour sur place son état et son délai (« En stock » ou « Fabrication sur commande » avec le délai de fabrication, « Sur mesure » pour la taille `sur_mesure`, sans schéma de mesures : epic 6). Capacité atteinte : la fabrication sur commande n'est plus proposée, la fiche affiche « Commandes complètes pour le moment » (jamais « Épuisé »), seules les tailles en stock restent, le sélecteur disparaît s'il n'y en a aucune. Aucune taille jamais présentée avec une quantité. Pas de bouton d'ajout au panier (epic 4), pas de Kit lié (epic 3).
Bandeau de zone « Remise uniquement à Goma et Bukavu » visible par tous, sans détection de pays, avant la zone d'achat, sans argot ni emoji. Modes de remise : Goma (retrait gratuit avec le lieu et les modalités lus du réglage `retrait_goma_*` dans la langue de la page, ou livraison au forfait de Goma), Bukavu (livraison au forfait de Bukavu), délai total exprimé en deux membres sans les additionner (fabrication éventuelle du produit ou de la taille choisie, puis délai de remise en texte fixe des fichiers de traduction : Goma moins d'un jour, Bukavu un jour au plus). Un forfait, un lieu ou des modalités non réglés ne sont pas affichés (rien d'inventé, règle 15) ; le retrait gratuit n'est affiché que si le lieu est réglé. Aucun montant calculé (frais, total) : l'epic 4 le fera.
Partage : bouton « Partager » qui ouvre le partage natif (`navigator.share`) ou copie le lien et annonce « Lien copié » en `role="status"` ; échec : message sobre. Référencement : titre et description uniques (description du produit tronquée proprement, jamais le marqueur « [Texte à fournir] »), Open Graph avec la première photo (URL absolue) et `twitter:card`, JSON-LD `Product` + `Offer` (prix USD lu en base, devise USD, disponibilité schema.org calculée à la requête : `InStock` / `MadeToOrder` / `OutOfStock`, URL de la fiche), jamais `aggregateRating` ni `review` ; `hreflang`. Plan du site : les fiches publiées dans les deux langues avec leur adresse propre (lecture publique ; en cas d'échec de lecture, le plan du site garde les pages statiques et le catalogue, et l'erreur est journalisée).
Textes dans `messages/{fr,en}.json` (`Fiche.*`), tutoiement, sans emoji, aucun texte en dur ; 375 px sans défilement horizontal, cibles de 44 px, contraste, clavier. Tests : disponibilité SQL (états, délai effectif, capacité, aucune quantité, brouillon invisible), page 404, sélecteur, galerie (boutons, annonce, dialogue), forfaits non réglés, JSON-LD, partage, plan du site, axe/clavier en e2e sur ce qui est atteignable sans simuler de produit.

**Never:** Pas d'ajout au panier ni de prix total (epic 4), pas de schéma des Mesures (epic 6), pas de Kit lié (epic 3), pas de produit, photo, avis ou note d'exemple dans le dépôt ou la base, aucune image tierce, pas d'`aggregateRating` ni de `review`, pas de modification d'une migration appliquée, pas de `npm run dev`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Produit publié | `/fr/cosplays/<slug>` | fiche complète | N/A |
| Brouillon / dépublié | même adresse | 404 | N/A |
| Mauvaise famille | cosplay ouvert sous `/accessoires/<slug>` | 404 | N/A |
| Autre langue d'adresse | `/en/cosplays/<slug>` | fiche en anglais ; `/en/accessoires/<slug>` redirige vers `/en/accessories/<slug>` | N/A |
| Taille en stock | choix « M » | « En stock » sur place, sans changement de page | N/A |
| Taille en fabrication | choix « L », délai de 12 jours | « Fabrication sur commande » + délai | N/A |
| Capacité atteinte | plafond atteint | message « Commandes complètes pour le moment », seules les tailles en stock, sélecteur absent s'il n'y en a aucune | N/A |
| Forfait non réglé | aucun forfait Bukavu | la ligne Bukavu n'affiche pas de montant | N/A |
| Retrait non réglé | lieu absent | pas de retrait gratuit affiché | N/A |
| Partage | navigateur sans `navigator.share` | lien copié, « Lien copié » annoncé | échec : message sobre |
| Une seule photo | 1 photo | pas de boutons précédent/suivant ni de vignettes superflues | N/A |
| Base indisponible | lecture en erreur | message d'erreur sobre, jamais de fiche inventée | `generique` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261025100000_reglages_remise_et_disponibilite.sql` (`stock_disponible`), `20261026100000_listage_catalogue.sql` (`capacite_fabrication_atteinte`, `lister_catalogue`), `20261024100000_photos_et_publication.sql` (`produit_photo`) : à utiliser, ne pas modifier. Nouvelle `supabase/migrations/20261027100000_disponibilite_variantes.sql` ; tests `supabase/tests/disponibilite_variantes.test.sql` ; liste blanche de `garde_ecritures.test.sql`.
- `src/i18n/adresses.ts`, `next.config.ts` (redirections et réécritures `/en/accessories` : étendre aux fiches `[slug]`), `src/app/sitemap.ts`, `src/lib/seo/{url,metadata,jsonld}.ts`, `src/components/catalogue/{CarteProduit,PageCatalogue}.tsx` (lien des cartes), `src/lib/reglages.ts` (`lireForfaitLivraison`, `lireRetraitGoma` existants), `src/lib/supabase/{stockage,images-distantes}.ts`.
- `src/modules/catalogue/{queries,types}.ts` : `lireFicheProduit(famille, slug, langue)` (client public) et `lireSlugsPublies()` ; composants `src/components/fiche/{GaleriePhotos,SelecteurTaille,BandeauZone,ModesRemise,BoutonPartager,FicheProduit}.tsx` ; pages `src/app/[locale]/cosplays/[slug]/page.tsx` et `accessoires/[slug]/page.tsx` (une seule implémentation partagée) ; `ui/Dialogue.tsx`, `ui/TitreVitrine.tsx`.
- `src/lib/supabase/types.ts` (régénéré après le push), `tests/unit/*`, `tests/e2e/fiche.spec.ts`, `tests/unit/messages-parite.test.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] Migration + `disponibilite_variantes.test.sql` + liste blanche -- AD-3, AD-17, AD-26
- [ ] Lectures, adresses `[slug]`, redirections, plan du site, lien des cartes -- règle 3, AD-16
- [ ] Composants et pages de la fiche, métadonnées, JSON-LD, messages FR/EN -- UX-DR17, UX-DR22, UX-DR23, UX-DR25
- [ ] Tests unitaires et e2e ; `db:push` sur koma-dev uniquement après la revue, puis `npm run types`

**Acceptance Criteria:**
- Given un produit publié, when un visiteur ouvre sa fiche, then il voit galerie, titre, prix USD, description, fil d'Ariane, bandeau de zone avant la zone d'achat et modes de remise sans valeur inventée
- Given des tailles, when il en choisit une, then la disponibilité et le délai de cette taille se mettent à jour sur place, sans quantité
- Given le Plafond de fabrication atteint, then « Commandes complètes pour le moment » s'affiche (jamais « Épuisé »), la fabrication sur commande n'est plus proposée et le sélecteur disparaît s'il ne reste aucune taille en stock
- Given la fiche lue par un robot ou partagée, then titre, description, image Open Graph, JSON-LD Product + Offer (sans note ni avis) et BreadcrumbList sont présents et le bouton Partager annonce « Lien copié »
- Given un brouillon ou un produit dépublié, when son adresse est ouverte, then la page 404 s'affiche
- Given `lint`, `typecheck`, `test`, `build`, then tous passent ; `test:sql` en CI

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Capacité nulle rendrait toutes les tailles sur commande « complet » | medium | patch | `not null` vaut nul |
| Avant le choix d'une taille, un produit tout sur commande n'affiche que la remise | medium | patch | délai de fabrication à connaître avant paiement |
| Annonce « Photo n sur m » qui clignote pendant le défilement lissé | medium | patch | `onScroll` recalcule l'index à chaque image |
| Partage : échec autre qu'Abort sans repli ; seconde copie non ré-annoncée | low | patch | correction directe |
| Titre/description anglais vides ou avec marqueur sans repli français | medium | patch | `??` n'attrape pas la chaîne vide |
| Plan du site : produits sans photo ni prix (404) ; plafond silencieux de 1000 | medium | patch | requête non filtrée |
| Câblage `famille` des deux routes, défilement de la galerie, test SQL du plafond : non couverts | medium | patch | aucun test |
| Fiche inconnue : 200 + noindex en production (coque prérendue) | medium | defer | piste : test d'adresse dans `proxy.ts` ; même famille que la note 1.7 |
| E2E de fiche sautés sans produit publié | medium | defer | la spec interdit les produits d'exemple |
| `og:type=product`, champs facultatifs de l'Offer | low | defer | non exigé |
| Constante indéfinie, types écrits à la main, image agrandie floue, clés de traduction en double, absence de cache de la partie statique, lectures multiples, publication programmée | false/low | rejeté | typecheck et build verts ; sans effet constaté |
| Page d'erreur à 200 sur panne de base, 404 silencieuse pour donnée incohérente, lettre isolée en troncature | low | rejeté | cas rares |

## Design Notes

Dépasse largement 1600 jetons ; non scindée (SQL, lecture, galerie et métadonnées se testent ensemble). Choix du développeur : le délai « total » est dit en deux membres (fabrication, puis remise) plutôt qu'additionné, car la remise est un texte fixe (« moins d'un jour ») ; `disponibilite_variantes` renvoie un délai effectif pour que la fiche ne lise jamais `variante` directement (le stock exact reste lisible par l'API tant que la décision de la 2.1 n'est pas prise) ; la disponibilité schema.org `MadeToOrder` est utilisée pour la fabrication sur commande.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur
- `npm run test:e2e` -- parcours existants verts
- `npm run test:sql` -- CI

**Manual checks:**
- Publier un produit complet (2.2) avec 2 ou 3 photos et deux tailles, ouvrir sa fiche en FR et EN : galerie (clavier, Agrandir, +/−), choix de taille, bandeau, modes de remise (après avoir réglé les forfaits), Partager, 375 px ; dépublier et vérifier la 404.
