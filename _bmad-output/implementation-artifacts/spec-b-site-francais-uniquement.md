---
title: 'B : site en français uniquement'
type: 'feature'
created: '2026-11-22'
status: 'done'
baseline_commit: '76e4e1be54928442fa89fc8eae45b705e8064212'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Jonathan veut un site en français uniquement. Aujourd'hui tout est bilingue. Le site a des routes /fr et /en et un sélecteur de langue sur le site, la connexion et l'admin. Les hreflang, le sitemap et l'Open Graph sont en deux langues. La détection envoie tout navigateur non francophone vers /en. Les emails sont en deux langues. L'admin exige les textes anglais pour publier.

**Approach:** l'anglais est **désactivé mais conservé** pour un éventuel lancement international. Une seule liste des langues actives (`fr`) commande tout ce qui propose l'anglais. Le code anglais, `messages/en.json` et les colonnes `_en` restent : réactiver l'anglais = remettre `en` dans cette liste et rétablir les champs.

**Décisions de Jonathan (2026-11-22) :**
- Q1 a) masquer, ne pas supprimer.
- Q2 a) toute adresse /en… redirige de façon permanente (308) vers la page française équivalente (table `ADRESSES`) ; sans équivalent connu : /fr.
- Q3 a) les champs anglais disparaissent de **tous** les formulaires admin ; les colonnes `_en` restent en base, aucune donnée supprimée ; la nouvelle migration ne change que les contrôles de publication (plus d'exigence d'anglais).
- Q4 a) tous les emails en français, y compris l'email de code Supabase.
- Q5 a) colonnes anglaises obligatoires en base (`univers.nom_en`, `produit_photo.alt_en`, `tranche_prix.libelle_en`, `fichier_kit.nom_en`, `chapitre_kit.titre_en`, alt anglais du héros) : **copie du français à la création, valeur anglaise existante conservée à la modification** ; aucun changement de schéma.
- Spec gardée en un seul morceau. Livraison : revue BMad, captures (accueil, fiche, panier, admin produit) montrées à Jonathan avant la fusion, e2e des redirections /en → /fr.
- CLAUDE.md, PRD (FR-55) et architecture (AD-16) disent : « site en français uniquement ; anglais désactivé mais conservé pour un éventuel lancement international ».

## Boundaries & Constraints

**Always:**
- Aucun texte visible en dur hors des fichiers de traduction.
- Metadata, Open Graph et JSON-LD restent sur chaque page publique (règle 8), en `fr` seulement.
- La traduction du navigateur reste possible (A3).
- Une migration appliquée ne se modifie jamais : on en crée une nouvelle.
- Une valeur `_en` déjà en base n'est jamais effacée ni écrasée par une modification faite sans champ anglais.

**Never:**
- Supprimer `en.json`, une colonne `_en` ou une donnée.
- Toucher aux montants, au paiement ou aux règles 1 à 13.
- Retirer les sous-titres anglais des vidéos de kit : c'est du contenu, pas la langue du site.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Accueil | « / », navigateur en anglais ou cookie `NEXT_LOCALE=en` | /fr | N/A |
| Adresse anglaise | /en/accessories/x, /en/blog/y, /en/admin | 308 vers /fr/accessoires/x, /fr/blog/y, /fr/admin | sans équivalent : /fr |
| Sélecteur de langue | toute page (site, connexion, admin) | absent | N/A |
| SEO | toute page publique | aucun hreflang ni alternate `en`, `og:locale` fr_FR sans `alternateLocale`, sitemap sans /en, JSON-LD `inLanguage: fr` | N/A |
| Publication admin | produit, événement ou photo sans aucun texte anglais | publiable si le français est complet | manques en français inchangés |
| Email | Compte avec `profil.langue = 'en'` | email en français | N/A |

</frozen-after-approval>

## Code Map

- `src/i18n/routing.ts` : `locales`, `defaultLocale: "fr"`, `type Locale`. On y ajoute `LANGUES_ACTIVES = ["fr"]` ; `locales` reste `["fr","en"]` pour garder les types et les messages.
- `src/i18n/detection.ts` (`choisirLangue`) et `src/proxy.ts` : vers l. 165, « / » mène à la langue détectée ; vers l. 135, l'aiguillage de l'admin et de l'accueil connecté ; plus loin, la 404 des articles sans version anglaise. La redirection des adresses /en se place avant `createIntlMiddleware(routing)`.
- `src/i18n/adresses.ts` : `ADRESSES` et `cheminPublic(interne, langue)` font la correspondance. Le segment anglais devient le segment interne, puis le chemin français. Les règles de `redirectionsAdresses` et `reecrituresAdresses` sont lues par `next.config.ts`. Vérifier qu'aucune règle /en ne passe avant le proxy.
- Sélecteur : `src/components/layout/SelecteurLangue.tsx` et `LangueRepli.tsx` ne sont rendus que si `LANGUES_ACTIVES.length > 1`. Ils apparaissent dans `EnTete.tsx`, dans `connexion/EnTeteConnexion.tsx:16`, dans `admin/BandeauAdmin.tsx:38` et dans `NavigationAdmin.tsx:177`.
- SEO :
  - `src/lib/seo/url.ts` : `alternatives` et `x-default`.
  - `src/lib/seo/metadata.ts` : `construireMetadata`, `LOCALE_OG`, `alternateLocale` et `languesDisponibles`, limités aux langues actives.
  - Surcharges dans `blog/[slug]/page.tsx`, `festival/[slug]/page.tsx`, `PageFiche.tsx` et `PageFicheKit.tsx`.
  - `src/app/sitemap.ts`, `src/app/robots.ts` et `src/lib/seo/jsonld.ts`.
- Emails :
  - `src/modules/envois/modeles/commun.ts:7` (`TEXTES`) : toute langue inactive se replie sur `fr`.
  - `supabase/templates/code-connexion.html` passe en français seul. Jonathan devra recopier ce modèle sur koma-dev (Authentication › Email Templates).
  - Le paramètre `langue` des actions (`comptes/actions.ts:26`, contact, alertes, commande, événements, scan) vaut toujours `fr`.
- Admin, formulaires : produits, photos, variantes (couleur), univers, tranches de prix, fichiers et chapitres de kit, blog, événements et types de Pass, héros, réglages (`retrait_goma_en`), galerie (alt). Côté schémas :
  - `src/modules/blog/schemas.ts:8`, `src/modules/evenements/schemas.ts:20` et `src/modules/admin/schemas.ts:9` : champs `_en` facultatifs.
  - Colonnes `_en` facultatives absentes du formulaire : valeur existante inchangée ; colonnes obligatoires : décision Q5.
- Migration nouvelle : `manques_publication` (dernière version `20270119100000_familles_vetement_autre.sql:420`, exige `titre_en` l. 447, `description_en`, `couleur_en`, `materiel_en`) et `manques_publication_evenement` (`20270103110000_…:18-22`). Contrôles de l'alt EN des photos publiées : `20261231230000_mur_public_correctifs.sql:40` et la contrainte `photo_publiee_alt` (`20261231220000_mur_public.sql:15`).
- Tests :
  - 12 e2e visitent /en. Ils passent sur la redirection ou sur le seul /fr.
  - `tests/unit/messages-parite.test.ts` reste : `en.json` est conservé.
  - `adresses-langues.test.ts` et les tests de `detection`.
- Documents :
  - `CLAUDE.md:23` ;
  - `docs/guide-koma-shop.md:36,228,295` ;
  - le PRD, FR-55 (`prd.md:478`) ;
  - `EXPERIENCE.md:25-36,82` ;
  - `ARCHITECTURE-SPINE.md:182` (AD-16).

## Tasks & Acceptance

**Execution:**
- [x] `src/i18n/routing.ts`, `detection.ts`, `src/proxy.ts` : `LANGUES_ACTIVES`, « / » toujours vers /fr, redirection 308 des adresses /en, tests unitaires du proxy. Ce bloc ferme l'anglais.
- [x] Sélecteur et SEO (fichiers ci-dessus) : tout est limité aux langues actives, avec des tests unitaires de `construireMetadata`, du sitemap et de `alternatives`.
- [x] `src/modules/envois/…` et `supabase/templates/code-connexion.html` : tout passe en français, avec les tests des modèles.
- [x] `supabase/migrations/<nouvelle>.sql` : `manques_publication` et `manques_publication_evenement` sans exigence d'anglais. L'alt EN n'est plus exigé par les contrôles de publication (la contrainte `photo_publiee_alt` reste satisfaite par la copie du français, Q5). Ajouter un test SQL, un seul appel par commande.
- [x] Formulaires et actions admin : champs anglais retirés, schémas avec `_en` facultatif, valeurs existantes gardées, tests unitaires.
- [x] e2e : nouveau `tests/e2e/langue-francaise.spec.ts` (redirections /en → /fr de la matrice, « / » avec navigateur anglais, absence du sélecteur) ; les visites /en des 12 e2e existants passent au seul /fr ; suite complète.
- [x] Captures avant fusion : accueil, fiche produit, panier, formulaire admin produit (clair, 1366 et 390), dans `docs/captures-admin/b-francais/` (ignoré par Git), données TEST_ supprimées et comptées à 0.
- [x] `CLAUDE.md`, `docs/guide-koma-shop.md`, PRD (FR-55), `EXPERIENCE.md`, `ARCHITECTURE-SPINE.md` (AD-16) : y écrire la phrase de décision.

**Acceptance Criteria:**
- Given un visiteur, when il parcourt le site, la connexion ou l'admin, then aucune page n'est en anglais ni ne propose l'anglais.
- Given l'Admin, when il crée puis publie un produit, un événement, un article et une photo de galerie en ne remplissant que le français, then tout se publie et aucune valeur `_en` déjà en base n'a changé.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Constat | Verdict | Route |
|---|--------|---------|---------|-------|
| 1 | blind + edge + vgap | `copierRetraitAnglais` : échec seulement journalisé, `lireReglage` facultatif ; l'admin voit « enregistré » alors que le retrait à Goma peut disparaître | high | patch |
| 2 | edge | erreur serveur visant un champ anglais disparu (univers, tranches, galerie) jamais affichée | medium | patch |
| 3 | edge | héros : nouvelle image avec l'ancien alt anglais | low, correction directe (Q5 : copie à la création) | patch |
| 4 | blind + edge | `/EN/...` (majuscules) non redirigé | low, correction directe | patch |
| 5 | blind | libellés encore bilingues dans fr.json (« … en français », manques morts) | medium (visible par l'Admin) | patch |
| 6 | vgap | copie du français non testée côté service : images d'article et d'événement, fichier et chapitre de kit | medium | patch (tests) |
| 7 | blind | réactivation : migration non mentionnée | low | patch (commentaire de langues-actives.ts) + defer (CLAUDE.md, AD-16) |
| 8 | blind | champs supprimés plutôt que masqués derrière le drapeau | false comme défaut : décision Q3 a) (« les champs anglais disparaissent ») | rejet |
| 9 | blind | valeurs copiées indiscernables ; valeurs anglaises figées et invisibles | false comme défaut : décision Q5 a) | rejet |
| 10 | blind | lieu de retrait anglais impossible à modifier | false comme défaut : décision Q5 a) | rejet |
| 11 | blind | alt anglais invalide remplacé sans erreur par `valider_photo` | low : seulement avec un client trafiqué (le formulaire n'envoie plus d'anglais) | rejet |
| 12 | blind + edge | collision du nom français d'un univers avec le nom anglais d'un autre | low, rare ; le message s'affiche désormais sur le champ (n° 2) | rejet |
| 13 | blind | langue par défaut écrite à trois endroits | low | rejet |
| 14 | blind | cookie NEXT_LOCALE=en : double redirection | false : `localeCookie: false` dans routing.ts | rejet |
| 15 | blind | retour de paiement qui accepte encore `en` | low ; paiement exclu par la spec, le proxy redirige en 308 | rejet |
| 16 | edge | données existantes : `retrait_goma_en` vide | false comme défaut causé : avant B, un anglais vide désactivait déjà le retrait ; un nouvel enregistrement du français le copie | rejet |
| 17 | blind | modèle d'email de production | réel, mise en ligne | defer (9.9) |

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` : code de sortie 0 ; `npm run db:push` sur koma-dev puis `npm run types` ; `npm run test:sql` vert en CI.

**Manual checks (if no CLI):**
- Recopier `supabase/templates/code-connexion.html` dans koma-dev (Authentication › Email Templates), puis demander un code et lire l'email.
