---
title: '9.15 Types d''article « Vêtement » et « Autre article »'
type: 'feature'
created: '2026-11-15'
status: 'done'
baseline_commit: '8b674265da7106f43241c4642902cea4edac6160'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/EXPERIENCE.md'
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** la boutique ne connaît que trois familles (Cosplay, Accessoire, Kit). Jonathan vend aussi des polos, t-shirts, sweats, et d'autres articles sans taille. Il n'a aucun moyen propre de les créer, de les vendre ni de les filtrer.

**Approche :** deux nouvelles familles physiques, sur le modèle des articles physiques existants (variantes, stock, réservation, livraison, MaishaPay pour la carte) :
- **Vêtement** : tailles XS à XXL × couleurs, stock par variante, photos, prix ;
- **Autre article** : une variante unique, stock, photos, prix.

L'admin, la boutique publique (catalogues, fiche, filtres, panier, commande) et les textes FR/EN sont mis à jour. Cette mini-story passe avant la refonte visuelle des Produits.

## Boundaries & Constraints

**Always :**
- **Physiques :** les deux nouvelles familles sont physiques partout.
  - Livraison Goma / Bukavu ou retrait ; délai de fabrication affiché avant paiement.
  - Carte via MaishaPay, **jamais Polar** (règle 10). Le panier qui en contient une n'est plus « 100 % numérique ».
- **Paiement :** l'aiguillage détermine « physique » par la négative (`famille <> 'kit'`), en SQL comme en TypeScript. Il ne repose plus sur une liste de familles physiques susceptible d'en oublier une.
- **Stock :** même modèle que l'existant.
  - Stock par variante, réservation à la création de la Commande en attente.
  - Libération à l'expiration ou à l'échec ; décompte au paiement confirmé côté serveur (règles 2 et 3).
  - « Fabrication sur commande » et délai par variante possibles.
- **Base :** prix, stock et frais toujours relus côté serveur. RLS sur toute nouvelle colonne ou table. Écritures admin par des fonctions SECURITY DEFINER avec `p_auteur` et journal d'audit.
- **Migration :** nouvelle, poussée sur koma-dev seulement ; aucune migration déjà appliquée n'est modifiée.
- **Existant :** Cosplay, Accessoire et Kit gardent exactement leur fonctionnement. Les variantes existantes (sans couleur) restent valides.
- **Textes :** FR et EN dans `messages/*.json`, aucun texte en dur.

**Never :** pas de suppression ni de renommage de famille existante ; pas de Kit lié à un Vêtement ou à un Autre article ; pas de sur-mesure pour ces familles ; pas de photo par couleur (voir Q-3) ; pas de nouveau prestataire.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Résultat attendu |
|---|---|---|
| Vêtement au panier | taille M, couleur Noir, nombre 2 | ligne liée à la variante (M, Noir) ; prix relu en base |
| Variante inconnue | taille M, couleur Rose (absente) | refus `KS_VARIANTE_INCONNUE`, panier inchangé |
| Couleur oubliée | Vêtement avec couleurs, sans couleur choisie | refus côté serveur ; la fiche exige le choix avant « Ajouter » |
| Autre article | sans taille ni couleur | variante unique ; ajout accepté |
| Stock épuisé | variante à 0, pas de fabrication sur commande | « Épuisé » sur la fiche ; ajout refusé |
| Réservation | 2 commandes en attente sur le dernier exemplaire | la seconde est refusée (stock disponible = stock − réservations actives) |
| Panier Vêtement + Kit, carte | — | MaishaPay ; Polar absent des choix |
| Panier Autre article seul, carte | — | MaishaPay ; Polar absent |
| Paiement confirmé | Commande payée | stock décompté une seule fois ; réservation close |
| Ancien accessoire | variantes sans couleur | inchangé (fiche, panier, commande) |

## Décisions de Jonathan (2026-11-15)

1. **Menu, option B.**
   - « Vêtements » est ajouté à l'en-tête ; « Autres articles » reste accessible par les tuiles de l'accueil et le pied de page.
   - Adresses : `/fr/vetements` · `/en/clothing` et `/fr/autres-articles` · `/en/other-items`.
   - Avec KOMA Chikara, aucun débordement de l'en-tête à 1024 px. S'il y en a un, le signaler à Jonathan : on passe alors à l'option C (menu « Boutique »).
2. **Couleurs, option A** : texte libre par variante (FR, EN, pastille facultative). Dans l'admin, le champ propose en autocomplétion les couleurs déjà utilisées (lecture des variantes existantes, sans nouvelle table).
3. **Photos par couleur** : story future, notée dans `deferred-work.md`.
4. **Une seule couleur, ou aucune** : autorisé. Le sélecteur n'apparaît qu'à partir de 2 couleurs ; avec une seule, son nom est écrit en texte.
5. **Autre article** : une variante « Taille unique », sans sélecteur sur la fiche.
6. **Accueil** : tuiles « Vêtements » et « Autres articles » ajoutées. Les 3 cartes du héros ne changent pas.
7. **Aiguillage en premier** : commit séparé, fait le 2026-11-15 (`8b67426`).
   - `estFamillePhysique` : seul le Kit est numérique, tout le reste est physique.
   - Un test parcourt toutes les familles, y compris une famille future.
   - Un panier mixte ne part jamais chez Polar.
8. **Familles écrites en dur** : tous les endroits listés dans « Inventaire des familles en dur » (Code Map) sont mis à jour.
9. **Textes légaux et d'aide** (CGV, Livraison et retours, FAQ, À propos) : seulement des **propositions**, sans les appliquer (voir « Propositions de textes »).

10. **Annulation, option B (2026-11-15)** : une Commande payée est annulable par le client, tant qu'elle n'est ni `en_fabrication` ni plus avancée, si elle contient un Cosplay (comme FR-25 aujourd'hui, en stock compris) **ou** au moins une ligne physique fabriquée sur commande (`origine = 'fabrication'`), quelle que soit sa famille (Accessoire, Vêtement, Autre article). Rien n'est retiré de FR-25. Le circuit reste celui de la 6.6 : `demander_annulation` (client) et `annuler_commande` (admin) acceptent la même condition, l'interface client (`annulable`) suit la même règle, et le remboursement porte sur toutes les lignes physiques et le Forfait.

</frozen-after-approval>

## Code Map

- **Base**
  - `supabase/migrations/20261030100000_kits_et_fichiers.sql:9` : contrainte `produit_famille_check` (cosplay, accessoire, kit) → nouvelle contrainte avec `vetement` et `autre`.
  - `20261023100000_creer_catalogue_physique.sql:40` : table `variante` (taille parmi XS à XXL ou `sur_mesure` ; unicité `(produit_id, taille)`).
  - `enregistrer_produit` (même fichier, l. 176) : refuse aujourd'hui toute famille hors cosplay et accessoire → recréée.
  - `lister_catalogue` (`20261103100000_catalogue_et_fiche_kit.sql:280`) : refuse une famille inconnue.
  - Panier : `ajouter_au_panier(p_auteur, p_panier, p_compte, p_produit, p_taille, p_nombre)` (`20261114100000`) choisit la variante par la taille → ajout de `p_couleur`.
  - Commande : `creer_commande` (`20261118100000`) calcule `v_physique` par la variante, ce qui convient tel quel ; à vérifier par les tests.
- **TypeScript**
  - `src/modules/catalogue/types.ts:8-11` : `FAMILLES_PHYSIQUES`, `FAMILLES_PRODUIT`, `TAILLES`.
  - `src/modules/paiement/aiguillage.ts:32` : `physique = cosplay || accessoire`, **à corriger en premier** (règle 10).
  - `src/modules/panier/service.ts:152` et `src/modules/commande/service.ts:110` : listes de familles en dur.
  - `src/modules/catalogue/existence.ts:8` : fiches par adresse.
  - `src/i18n/adresses.ts` : adresses FR/EN.
  - `src/components/admin/ChoixFamille.tsx`, `EditeurVariantes.tsx` (le sur-mesure y est réservé aux cosplays), `FormulaireProduit.tsx`.
  - Pages `src/app/[locale]/{cosplays,accessoires}` (modèle des nouvelles pages), sitemap, JSON-LD, `TuilesCategories`, `EnTete`, `PiedDePage`.
  - Tableau de bord (`familles.*`), filtres des Commandes admin, `heros-cartes.ts`, `envois/dependances.ts`, `blog` (lien vers un produit).


### Inventaire des familles en dur (à mettre à jour, sauf mention contraire)

**TypeScript**
- **Bloquant :** `src/modules/paiement/queries.ts:54` lève une erreur « Famille inconnue » : sans correction, un Vêtement ne peut pas être payé.
- **Types de familles :**
  - `src/modules/paiement/types.ts:7` (`FamilleProduit`), `src/modules/panier/types.ts:22`, `src/modules/commande/types.ts:36`, `src/modules/blog/types.ts:64` ;
  - `src/modules/catalogue/types.ts:8` (`FAMILLES_PHYSIQUES` : la remplacer par `FAMILLES_PRODUIT` + `estFamillePhysique`) et `:11`.
- **Familles filtrées à la main :** `src/modules/panier/service.ts:152`, `src/modules/commande/service.ts:110`, `src/modules/blog/queries.ts:207`.
- **Lectures limitées à cosplay et accessoire :**
  - `src/modules/catalogue/queries.ts:134` (produits liables à un Kit : **inchangé**, un Kit ne lie qu'un cosplay ou un accessoire) ;
  - `src/modules/catalogue/queries.ts:429` (plan du site : à étendre).
- **Adresses des fiches par famille :**
  - `src/app/sitemap.ts:11-14` ;
  - `src/modules/catalogue/existence.ts:8` ;
  - `src/components/catalogue/{CarteProduit,GrilleProduits,PageCatalogue}.tsx` ;
  - `src/components/fiche/FicheProduit.tsx:20` ;
  - `src/components/blog/ArticleComplet.tsx:17` ;
  - `src/modules/envois/dependances.ts:102,177` (liens des emails) ;
  - `src/components/accueil/HerosVisiteur.tsx:22` (le type de la carte suffit, les cartes ne changent pas).

  Les regrouper dans une seule table `DOSSIER_PAR_FAMILLE`.
- **Menu :** `src/components/layout/rubriques.ts:4` (ajouter « vetements »), pied de page, `TuilesCategories`.
- **Tableau de bord :** `src/app/[locale]/admin/page.tsx:24`, `src/components/admin/tableau/{CommandesPayees,Indicateurs}.tsx` (`FAMILLES` des libellés).
- **Filtre Famille des Commandes admin :** `src/modules/commande/admin-queries.ts:9`.
- **Sur-mesure, réservé aux cosplays :** `src/components/admin/EditeurVariantes.tsx:40`, `FormulaireProduit.tsx:101`, `src/modules/catalogue/schemas.ts:87`. **Inchangé**, avec en plus la taille `unique` pour `autre` et la couleur pour `vetement`.
- **Annulation (décision 10) :** `src/modules/commande/queries.ts:135` (`annulable`), et en SQL la condition de `demander_annulation` et de `annuler_commande` (version la plus récente : `20261217100000:208`, plus `20261216100000:234` et `20261214100000:65,98` pour l'historique). Nouvelle condition : un Cosplay OU une ligne physique à `origine = 'fabrication'`, toujours avant `en_fabrication`.
- **Accueil :** `src/modules/accueil/heros-cartes.ts`, `heros-queries.ts`, `cosplays-recents.ts`. **Inchangés** (décision 6).

**SQL (fonctions à recréer dans la nouvelle migration)**
- Familles autorisées :
  - contrainte `produit_famille_check` (`20261030100000:9`) ;
  - `enregistrer_produit` (`20261023100000:176`, version la plus récente à reprendre) ;
  - `lister_catalogue` (`20261103100000:280`).
- `lignes_reclamables` (`20261216100000:13`, `famille in ('accessoire', 'cosplay')`) : **à étendre** à `vetement` et `autre`, puisque les réclamations s'appliquent aussi aux articles physiques prêts à porter.
- `annuler_commande` et `demander_annulation` : recréées avec la condition de la décision 10, sans rien retirer de la règle actuelle.
- Le panier, la création de commande, la réservation et le décompte du stock passent par la variante (`famille <> 'kit'`) : il suffit d'ajouter la couleur, et les tests le prouvent.

**Textes FR/EN (à mettre à jour)**
- `Metadata.accueil.titre` et `.description` ; les métadonnées des nouveaux catalogues.
- `Admin.produits.intro` ; `Admin.prestataires.regleCarte.maishapay` (déjà générique : « produit physique »).
- `Panier.versCatalogues` (« Découvre nos cosplays, accessoires, vêtements et kits. ») ; les familles du tableau de bord et des filtres ; les tailles (`unique` = « Taille unique » / « One size ») ; les couleurs.

### Propositions de textes (non appliquées, à valider par Jonathan)

| Texte | Phrase actuelle | Proposition |
|---|---|---|
| CGV § articles | « Articles physiques : cosplays et accessoires faits main à Goma, en stock ou fabriqués sur commande, parfois sur mesure. » | « Articles physiques : cosplays et accessoires faits main à Goma, vêtements (polos, t-shirts, sweats) et autres articles, en stock ou fabriqués sur commande ; seuls les cosplays peuvent être faits sur mesure. » |
| CGV | « Chaque pièce étant faite à la main, de légères différences avec les photos sont possibles et ne constituent pas un défaut. » | « Les pièces faites à la main peuvent présenter de légères différences avec les photos, qui ne constituent pas un défaut. » (les vêtements ne sont peut-être pas faits main : à confirmer) |
| Livraison et retours § Retours | (rien sur les vêtements ni les autres articles) | Ajouter : « - Vêtement (polo, t-shirt, sweat) : même règle que l'article prêt à porter. » et « - Autre article : [Texte à fournir] (même règle que le prêt-à-porter, ou non repris selon l'article). » |
| À propos | « Chaque cosplay et chaque accessoire est créé à la main par Jonathan, à Goma. » | « Chaque cosplay et chaque accessoire est créé à la main par Jonathan, à Goma ; la boutique propose aussi des vêtements et d'autres articles. » (à préciser : vêtements faits main ou non ?) |
| FAQ (délais, mesures, hors zone, photo) | génériques ou propres aux cosplays | aucune modification nécessaire |

## Tasks & Acceptance

**Exécution :**
- [ ] `supabase/migrations/<nouvelle>_familles_vetement_autre.sql`
  - Famille : contrainte élargie à `vetement` et `autre`.
  - Variante :
    - colonnes `couleur_fr`, `couleur_en` (1 à 40 caractères) et `couleur_hex` (`#RRGGBB`), toutes facultatives ;
    - taille `unique` autorisée, seulement pour `autre` ;
    - unicité `(produit_id, taille, couleur_fr)`, valeurs nulles considérées comme égales (`nulls not distinct`).
  - Contrôles :
    - `autre` = une seule variante, de taille `unique` ;
    - `vetement` = tailles XS à XXL, sans sur-mesure ;
    - couleur interdite hors `vetement`.
  - Fonctions recréées :
    - `enregistrer_produit` et l'enregistrement des variantes (avec couleur) ;
    - `lister_catalogue`, qui accepte les nouvelles familles ;
    - fiche publique : variantes avec leur couleur ;
    - `ajouter_au_panier`, avec `p_couleur text default null` et l'ancienne signature retirée proprement ;
    - lecture du panier, avec couleur et taille ;
    - lignes de commande et emails : libellé « Taille M · Noir ».
  - Droits et RLS identiques à l'existant ; journal d'audit.
- [ ] `src/modules/paiement/aiguillage.ts`
  - `physique = familles.some(f => f !== "kit")`.
  - Revue de toutes les listes de familles en dur dans `src/`, remplacées par `FAMILLES_PRODUIT` et une fonction `estPhysique(famille)`.
- [ ] `src/modules/catalogue/types.ts` : familles, tailles (`unique`), types des variantes avec couleur, liste des manques à la publication (au moins une variante ; couleurs nommées en FR et EN).
- [ ] **Admin**
  - `ChoixFamille` : Vêtement et Autre article.
  - `EditeurVariantes` : grille tailles × couleurs pour un Vêtement (ajouter ou retirer une couleur : libellés FR/EN et pastille ; stock, fabrication sur commande et délai par case) ; une seule ligne « Taille unique » pour un Autre article.
  - Pastille de famille dans la grille Produits, filtre Famille des Commandes, libellés du tableau de bord.
- [ ] **Boutique**
  - Pages catalogue et fiche des deux familles (sur le modèle des accessoires), adresses FR/EN, filtres existants (disponibilité, prix, univers).
  - Sélecteur de couleur accessible (boutons radio, nom de la couleur toujours écrit, pas seulement la pastille).
  - Panier et récapitulatif de commande avec la couleur.
  - Sitemap, JSON-LD (`Product`, `color`), tuiles de l'accueil, en-tête et pied de page selon Q-1 et Q-6.
- [ ] `messages/fr.json`, `messages/en.json` : familles, couleurs, « Taille unique », titres et métadonnées des catalogues, messages d'erreur.
- [ ] **Tests** : voir Verification.

**Critères d'acceptation :**
- Étant donné un Vêtement publié en M et L, en Noir et Blanc, avec du stock en M Noir seulement, quand un visiteur choisit M puis Noir, alors « Ajouter » est possible ; avec L Blanc, l'article est « Épuisé » ou « Sur commande » selon la variante.
- Étant donné un panier qui contient un Vêtement ou un Autre article, quand on paie par carte, alors seul MaishaPay est proposé.
- Étant donné une Commande payée d'un Vêtement M Noir × 2, quand le paiement est confirmé, alors le stock de cette variante baisse de 2, une seule fois.
- Étant donné l'admin, quand il crée un Autre article sans taille, alors une variante « Taille unique » est créée et le produit peut être publié avec ses photos et son prix.

## Implementation Notes

- 2026-11-16 : migrations 20270117100000, 20270118100000 et 20270119100000 appliquées sur koma-dev ; types régénérés (`npm run types`). E2e `tests/e2e/familles-vetement-autre.spec.ts` (9 tests) : données TEST_ créées et supprimées par la Supabase CLI (`--linked` en local, `--local` en CI), contrôle final à 0. Textes légaux : `textes-9-15-a-reporter.md`, reportés par Jonathan dans « Textes du site ».

## Spec Change Log

- **2026-11-16 — Menu, option C (décision 1).** Mesuré sur le build : avec « Vêtements » dans l'en-tête, la page déborde à 1024 px (1 108 px en FR, 1 048 px en EN), et plus à 1280 px. Comme la décision 1 le prévoit (« s'il y en a, on passe à C »), les cinq types sont regroupés sous « Boutique » / « Shop » (bouton + panneau) ; Festival, Blog et À propos restent des liens directs. Plus de débordement à 1024 ni à 1280 px. À revérifier avec KOMA Chikara à l'étape 3.
- **2026-11-16 — « Épuisé ».** La matrice et le premier critère d'acceptation parlaient d'« Épuisé ». EXPERIENCE.md (C-4) l'interdit : une variante sans stock ni fabrication sur commande affiche « Commandes complètes pour le moment », pour toutes les familles, sur la fiche comme sur les cartes. KEEP : aucun texte visible « Épuisé ».
- **2026-11-16 — Code d'erreur.** Une variante inconnue renvoie le code existant `KS_VARIANTE_INTROUVABLE` (et non `KS_VARIANTE_INCONNUE`), avec un message qui parle de la combinaison taille × couleur quand une couleur est en jeu.

## Review Triage Log

Revue du 2026-11-16 (Blind Hunter, Edge Case Hunter, Verification Gap) sur le diff depuis `8b67426`.

| Constat | Verdict | Route |
|---|---|---|
| Renommer ou retirer une couleur : delete + insert, échec 23503 si la variante est commandée, paniers vidés | high | patch : mise à jour sur place, `KS_VARIANTE_COMMANDEE` |
| Couleur sans taille, nom FR vide, erreur globale invisible dans l'admin | medium | patch |
| Signature de couleur sans séparateur | low | patch |
| Autocomplétion coupée à 1 000 lignes ; échec qui bloque la création | medium | patch |
| Taille absente dans la couleur affichée comme « complète » | medium | patch |
| « Épuisé » encore sur les cartes (EXPERIENCE C-4) | medium | patch |
| Messages d'erreur de couleur parlant de « taille » | low | patch |
| Email : remplacement de texte sensible à `$&` | low | patch |
| Lien « Autres articles » non localisé, commentaire « option B » | low | patch |
| Titre « Boutique » en h3 sans h2 | low | patch |
| JSON-LD : plusieurs couleurs dans un seul `color` | low | patch |
| `Panier.versCatalogues` sans « autres articles » | low | patch |
| Unions de familles écrites à la main | low | patch |
| Tests manquants : `p_couleur`, `lireAchat`, couleurs de la fiche en anglais, email, `annulable`, `lignes_reclamables`, annulation, expiration, concurrence | medium | patch |
| Menu en option C sans trace | false | décision 1 (option C prévue en cas de débordement) ; consigné ci-dessus |
| « Épuisé » remplacé, contraire à la matrice | false | EXPERIENCE.md C-4 ; consigné ci-dessus |
| Documents de référence (« trois familles ») | medium | fait : CLAUDE.md, `docs/guide-koma-shop.md`, glossaire du PRD |
| Pas de tests e2e | medium | à faire après le push de la migration sur koma-dev |
| Email : taille affichée aussi pour les cosplays | low | rejeté : amélioration voulue, signalée à Jonathan |
| Couleurs non figées dans la commande | low | rejeté : comme les titres, les lignes lisent le produit (comportement existant) |
| Message `couleur_invalide` trop général | low | rejeté |

## Verification

**Unitaires (Vitest)**
- Aiguillage : Vêtement seul, Autre article seul, mixte avec un Kit, Pass → jamais Polar.
- `estPhysique` pour chaque famille.
- Service panier et service commande avec couleur.
- Liste des manques à la publication.
- `EditeurVariantes` (grille tailles × couleurs, Taille unique).
- Sélecteur de couleur de la fiche (clavier, nom accessible).
- Adresses FR/EN, existence des fiches, sitemap.

**pgTAP**
- Annulation (décision 10) : Cosplay en stock annulable ; Accessoire, Vêtement ou Autre article fabriqué sur commande annulable ; commande d'articles physiques en stock seuls (sans Cosplay) non annulable ; plus annulable une fois `en_fabrication` ; Kit jamais remboursé.
- Contraintes : famille ; taille `unique` réservée à `autre` ; couleur interdite hors Vêtement ; unicité taille × couleur ; une seule variante pour `autre`.
- `enregistrer_produit` : refus sans droit admin, journal d'audit.
- `ajouter_au_panier` : avec couleur, variante inconnue, compatibilité des appels sans couleur.
- Réservation et stock disponible avec des commandes concurrentes.
- Décompte au paiement confirmé (une seule fois), libération à l'expiration.
- RLS des nouvelles colonnes.

**e2e (Playwright)**
- Fiche d'un Vêtement TEST_ : choix de taille et de couleur, ajout au panier, récapitulatif avec la couleur, choix de paiement sans Polar.
- Catalogues `/fr/vetements` et `/en/clothing` filtrés ; Autre article sans sélecteur.
- Axe : aucune violation grave.
- Données TEST_ créées puis supprimées.

**Commandes** : `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` ; `npm run test:sql` et e2e en CI ; migration poussée sur koma-dev (`npm run db:push`) après validation.
