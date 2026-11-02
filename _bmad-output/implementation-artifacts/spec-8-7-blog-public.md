---
title: 'Story 8.7 : Blog public'
type: 'feature'
created: '2026-11-02'
status: 'draft'
baseline_commit: 'f1065cf90866c00cc80368062eb2d669a1537525'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-KOMA SHOP-2026-10-16/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Les Articles écrits et publiés en 8.6 sont invisibles : aucun visiteur ne peut les lire, Google ne les trouve pas, le bloc 7 de l'accueil reste vide et l'en-tête n'a pas d'entrée « Blog ». La promesse FR-43 (guides de fabrication et annonces) ne tient pas encore.

**Approach:** Brancher la lecture publique du module `blog` sur les pages `/fr/blog`, `/en/blog`, `/fr/blog/[slug]` et `/en/blog/[slug]` : cartes (vignette, titre, date), « Voir plus » par 12, colonne de lecture de 720 px, fil d'Ariane, JSON-LD Article et BreadcrumbList, métadonnées et Open Graph. L'Article sans version anglaise n'existe pas sous `/en` (404) et n'entre pas dans le plan du site anglais ; le sélecteur de langue mène alors à la liste `/en/blog`. L'en-tête, le menu ☰ et le bloc 7 « Guides » de l'accueil sont complétés. Aucune écriture, aucune migration : la lecture passe par le client public et la RLS de 8.6.

## Boundaries & Constraints

**Always:**

- **Aucune migration.** Le schéma de 8.6 suffit (adresse obligatoire et unique, RLS des seuls Articles publiés). Ne pas toucher aux migrations appliquées.
- Lecture publique par `creerClientPublic()` (clé publique, RLS), jamais le client service ; cache `"use cache"` avec l'étiquette `articles` déjà invalidée à l'enregistrement et à la publication.
- « Version anglaise » = `titre_en` **et** `texte_en` renseignés, non vides et sans marqueur `[Texte à fournir]`. Un Article qui n'a qu'un titre anglais reste absent de `/en` (404) et du plan du site anglais.
- Textes visibles tirés de `EXPERIENCE.md` / `DESIGN.md` ou déjà approuvés ailleurs ; sinon marqueur `[Texte à fournir]`. Aucun texte, prix, date ou avis inventé.
- Mobile d'abord (375 px, aucun défilement horizontal), navigation au clavier, `alt` sur chaque image, `aria-current="page"` sur le fil d'Ariane.
- Le rendu du texte passe par `ContenuArticle` (8.6), seul chemin de sanitisation, à l'identique de l'aperçu admin.

**Never:**

- Créer un Article, une date, une vignette ou un extrait d'exemple ; les tests utilisent des données `TEST_` (règle 13).
- Exposer la clé de service, un brouillon ou un Article sans version anglaise sous `/en`.
- Ajouter une dépendance, modifier `src/lib/supabase/types.ts`, `sprint-status.yaml`, `journal-enchainement.md`, `CLAUDE.md` ou les fichiers `.env*`.
- Toucher aux modules paiement, commande, accès aux Kits payés, RLS, `SECURITY DEFINER` ou auth.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Blog vide | Aucun Article publié | « Aucun article pour le moment. » + lien vers l'accueil ; aucun titre de section vide | N/A |
| 12 Articles ou moins | Articles publiés | Toutes les cartes, pas de « Voir plus » | N/A |
| Plus de 12 Articles | Articles publiés | 12 cartes, puis « Voir plus » ; curseur dans l'adresse ; recharger l'adresse affiche la même liste | N/A |
| Curseur invalide ou périmé | `?curseur=` illisible ou plus rien après | Première page, jamais une erreur | N/A |
| Article sans vignette | `images = []` | Carte sans image (pas d'image inventée), pas d'image Open Graph | N/A |
| Article publié FR | `/fr/blog/<slug>` | Page complète : fil d'Ariane, titre, date, Markdown, images (alt FR), lien Produit publié | N/A |
| Article publié avec EN | `/en/blog/<slug>` | Titre, texte et alt anglais ; `hreflang` fr/en | N/A |
| Article sans EN | `/en/blog/<slug>` | 404 avant le flux, absent du plan du site anglais | 404 |
| Article en brouillon ou adresse inconnue | `/fr/blog/<slug>` ou `/en/blog/<slug>` | 404 avant le flux | 404 |
| Sélecteur de langue sur un Article FR sans EN | `/fr/blog/<slug>` | Mène à `/en/blog` (la liste) | N/A |
| Sélecteur de langue sur un Article traduit | `/fr/blog/<slug>` | Mène à `/en/blog/<slug>` | N/A |
| Produit lié non publié ou supprimé | `lien_produit_id` posé | Aucun lien affiché | N/A |
| Lecture en erreur | Base indisponible | Message sobre, jamais une liste ou une page inventée | message dédié |
| Plan du site | Articles publiés | `/blog` dans les deux langues ; chaque Article FR ; l'EN seulement s'il a une version anglaise | N/A |

## Code Map

- **Lecture publique** : `src/modules/blog/queries.ts` (ajout, sans toucher aux lectures admin) — `listerArticlesPublies`, `lireArticlePublie`, `lireDerniersArticles`, `lireSlugsArticlesPublies`, `lireSlugsSansVersionAnglaise`, `lireProduitLie`.
- **Types** : `src/modules/blog/types.ts` — `CarteArticle`, `ArticlePublic`, `PageArticles`, `CurseurArticles`.
- **Adresse et curseur** : `src/modules/blog/adresse.ts` (fonctions pures, testées) — lecture/écriture de `?curseur=`, 12 par page, cumul.
- **« Voir plus »** : `src/modules/blog/voir-plus.ts` (Server Action : 12 suivants, arguments revalidés).
- **Existence pour le proxy** : `src/modules/blog/existence.ts` (client public, délai court, aucune donnée journalisée) et branchement dans `src/proxy.ts`.
- **Pages** : `src/app/[locale]/blog/page.tsx` et `src/app/[locale]/blog/[slug]/page.tsx` (`instant = false`, `notFound()` réel).
- **Composants** : `src/components/blog/CarteArticle.tsx`, `src/components/blog/ListeArticles.tsx` (client, « Voir plus »), `src/components/blog/ArticleComplet.tsx` (serveur), `src/components/accueil/BlocGuides.tsx`.
- **SEO** : `src/lib/seo/jsonld.ts` (`articleJsonLd`), `src/lib/seo/metadata.ts` (langues disponibles pour `hreflang`), `src/lib/seo/url.ts` (`alternatives` limité aux langues disponibles), `src/app/sitemap.ts`.
- **Accueil** : `src/modules/accueil/blocs.ts` (bloc 7 « Guides » affiché), `src/app/[locale]/page.tsx` (`BlocGuides`).
- **En-tête** : `src/components/layout/rubriques.ts` (Blog après Kits), `src/components/layout/SelecteurLangue.tsx` (prop `sansTraduction`), `src/components/layout/EnTete.tsx` et `src/app/[locale]/layout.tsx` (liste mise en cache).
- **Date** : `src/lib/dates.ts` — `formaterDateBoutique` (date seule, fuseau de la boutique).
- **Messages** : `messages/fr.json` et `messages/en.json` — espaces `Blog`, `Metadata.blog`, `Accueil.bloc7` ; aucune réorganisation.
- **Tests** : `tests/unit/blog-public-page.test.tsx`, `blog-queries.test.ts`, `blog-adresse.test.ts`, `blog-voir-plus-ui.test.tsx`, `proxy-article-404.test.ts`, mis à jour de `robots-sitemap.test.ts`, `selecteur-langue-requete.test.tsx`, `accueil-blocs.test.ts`, `jsonld-vitrine.test.ts`.

## Tasks & Acceptance

**Execution:**

- [ ] Lecture publique mise en cache (`articles`), filtres FR/EN, curseur de 12, lecture du Produit lié publié.
- [ ] Pages liste et Article : cartes, état vide, « Voir plus », colonne 720 px, fil d'Ariane, images avec alt de la langue, lien Produit.
- [ ] 404 réelle : Article absent, en brouillon ou sans version anglaise (page + proxy), plan du site anglais filtré.
- [ ] JSON-LD Article + BreadcrumbList, métadonnées, Open Graph (première image), `hreflang` limité aux versions qui existent.
- [ ] En-tête et menu ☰ : entrée « Blog » ; sélecteur de langue : liste `/en/blog` depuis un Article FR sans EN.
- [ ] Accueil : bloc 7 « Guides » avec les derniers Articles, masqué sans Article.
- [ ] Messages FR/EN ; tests unitaires ; `lint`, `typecheck`, `test`, `build` verts ; `test:sql` inchangé.

**Acceptance Criteria:**

- Given des Articles publiés, when le visiteur ouvre `/fr/blog` ou `/en/blog`, then il voit les cartes (vignette, titre, date), avec « Voir plus » par 12 ; sans Article : « Aucun article pour le moment. » et un lien vers l'accueil.
- Given la rubrique Blog, then elle apparaît dans l'en-tête et le menu ☰.
- Given un Article, when il s'affiche, then la colonne de lecture fait 720 px sur ordinateur, avec fil d'Ariane, JSON-LD Article et BreadcrumbList, métadonnées et Open Graph.
- Given un Article sans version anglaise, then `/en/blog/<slug>` renvoie 404, il est absent du plan du site anglais, et le sélecteur de langue de la page FR mène à `/en/blog`.
- Given l'accueil, when un Article est publié, then le bloc 7 « Guides » montre les derniers Articles ; sinon il est masqué.

## Spec Change Log

- 2026-11-02 (validation de Jonathan) : `Metadata.blog.description` est fournie (FR et EN) au lieu du marqueur ; `Blog` et `Metadata` ne sont pas ajoutés à `ESPACES_PUBLICS`. Les pages à curseur sont `noindex, follow` **sans canonique** (pas de canonique vers `/blog`). Le reste du plan est inchangé.

## Review Triage Log

(niveau draft : la boucle de revue n'a pas encore démarré.)

## Design Notes

- **Version anglaise** : `titre_en` et `texte_en` doivent être tous deux présents, non vides et sans marqueur. La publication en base n'exige que le français ; c'est la lecture qui décide de l'existence sous `/en`.
- **Pagination** : même principe que les catalogues (E-36) — curseur opaque `[publie_le, id, n]` en base64url, vrai lien, Server Action quand JavaScript est là, focus sur la première carte ajoutée. Les pages à curseur sont `noindex, follow`, **sans canonique** (jamais une canonique vers `/blog`, qui contredirait le `noindex`) : les Articles restent découvrables par le plan du site.
- **Liste** : deux colonnes sur ordinateur (DESIGN, `article-card`), une sur mobile. La date est un `<time datetime>` à l'heure de la boutique, au format long de la langue.
- **Vignette** : première image de l'Article, en 4/3 ; sans image, carte sans vignette. La même première image sert d'image Open Graph et de `image` JSON-LD.
- **Article** : H1 = titre (Sakura Town avec repli Barlow Condensed), corps via `ContenuArticle`, puis galerie des images avec le texte alternatif de la langue. Le Produit lié est proposé par un lien dont le nom accessible est son titre, sans nouveau libellé ; un Produit non publié ne rend rien.
- **Fil d'Ariane** : Accueil › Blog › titre, en `aria-current="page"` sur le dernier maillon ; JSON-LD BreadcrumbList identique.
- **Sélecteur de langue** : la liste des adresses FR sans version anglaise est lue une fois (cache `articles`) par le layout et passée à `SelecteurLangue`, qui reste déterministe au rendu serveur. Limite assumée : dans un onglet déjà ouvert, un Article publié après le chargement n'entre dans cette liste qu'au prochain chargement complet ; la page et le proxy, eux, sont toujours exacts.
- **Accueil** : le bloc 7 (aujourd'hui `bloc7` réservé) devient « Guides » et affiche les 3 derniers Articles ; sans Article, il ne rend rien. L'emplacement `guides` numéro 5 (marqué epic 7 par erreur) est supprimé : FR-2 place les Guides au bloc 7.
- **Description de la page liste** : fournie par Jonathan le 2026-11-02 — FR « Guides de cosplay, tutoriels de fabrication et actualités, fait main à Goma. », EN « Cosplay guides, crafting tutorials and news, handmade in Goma. ». Aucun marqueur, et `Blog` / `Metadata` n'entrent pas dans `ESPACES_PUBLICS` pour cette clé. Le nom du site n'est jamais écrit en dur. Les autres textes sont des reprises de libellés déjà approuvés (« Blog », « Accueil », « Fil d'Ariane », « Voir plus », « Chargement… », « Aucun article pour le moment. », « Retour à l'accueil », « Un problème est survenu. Réessaie dans un instant. »).
- **Erreur de lecture** : message sobre « Un problème est survenu. Réessaie dans un instant. » (texte d'erreur serveur déjà approuvé dans EXPERIENCE.md), jamais une page ou une liste inventée ; le proxy reste « incertain » et laisse le chemin normal décider.
- **Aucune migration** : la lecture publique utilise la RLS et les index déjà posés en 8.6.

## Verification

**Commands:**

- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur introduite ; les 8 échecs préexistants de `main` restent identifiés.
- `npm run test:sql` -- inchangé (aucune migration ; sort sans erreur sans Docker).

**Manual checks:**

- `/fr/blog` et `/en/blog` : cartes, état vide, « Voir plus » (clic simple et lien sans JavaScript), rechargement de l'adresse avec curseur.
- `/fr/blog/<slug>` : colonne 720 px, fil d'Ariane, date, images, lien Produit ; `/en/blog/<slug>` d'un Article sans EN : 404 ; sélecteur de langue : `/en/blog`.
- Accueil : bloc 7 présent avec des Articles publiés, absent après dépublication du dernier.
- Vérifier le HTML : JSON-LD Article et BreadcrumbList valides, Open Graph avec la première image, `alt` de la langue.

</frozen-after-approval>
