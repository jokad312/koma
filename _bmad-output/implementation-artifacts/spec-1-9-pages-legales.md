---
title: 'Story 1.9 : pages légales'
type: 'feature'
created: '2026-10-22'
status: 'done'
baseline_commit: '7fcbc897f2d37a60f5eec024e45b669380d86fcc'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le visiteur ne peut pas lire les mentions légales, les CGV, la politique de livraison et de retours ni la politique de confidentialité ; le pied de page n'a pas de carte Infos légales et le formulaire de contact collecte des données personnelles sans lien vers la confidentialité (déféré par la 1.8).

**Approach:** Quatre pages `/[locale]/{mentions-legales,cgv,livraison-et-retours,confidentialite}` réutilisant la structure de la 1.8 ; corps de texte et date de version viennent de `messages/*.json` et valent « [Texte à fournir] » tant que Jonathan ne les fournit pas ; `ESPACES_PUBLICS` est complété pour que le build de production échoue tant qu'il en reste.

## Boundaries & Constraints

**Always:** Réutiliser le marqueur (`src/lib/vitrine/marqueur.ts`), `verifier-marqueurs.mjs` (inchangé hors liste), `TitreVitrine`, `construireMetadata`, `JsonLd`, `pageWebJsonLd`, le sitemap et le pied de page de la 1.8. Aucun texte légal rédigé ni complété par le code (règle 15) : le corps de chaque page (`Legal.<page>.texte`) et sa date de version (`Legal.<page>.version`) sont au marqueur dans `fr.json` et `en.json`. Libellés d'interface écrits normalement : H1 « Mentions légales », « Conditions générales de vente », « Livraison et retours », « Politique de confidentialité » (EN traduits), « Version du », titre de la carte « Infos légales », liens, tutoiement non requis (ton neutre, sobre, sans emoji). Une clé de version par texte, une seule source ; la date de version affichée sur la page sous le titre, `<time datetime>` formatée selon la langue si la valeur est une date ISO `AAAA-MM-JJ`, sinon (marqueur) affichée telle quelle. Paragraphes : le texte est découpé sur les lignes vides. Metadata, Open Graph, canonique/hreflang et JSON-LD `WebPage` par page ; les quatre chemins au sitemap. Pied de page : carte « Infos légales » avec quatre liens de 44 px de haut (`min-h-touch`), les quatre cartes tiennent à 375 px sans défilement horizontal. `ESPACES_PUBLICS` reçoit `Legal`. Lint, types, tests, build verts ; axe sans violation, clavier, 375 px.

Lien « Politique de confidentialité » sous le bouton du formulaire de contact (`Contact.confidentialite`), vers `/confidentialite`, sans phrase de consentement ni texte juridique.

**Never:** Aucun texte légal, aucune date de version inventés ; aucune table ni fonction d'acceptation (commandes, plus tard, AD-34, règle 14) ; aucune migration ; aucune case à cocher ; aucun bandeau de cookies ; aucune page Compte ni mention d'usage des réponses d'accueil (reporté à Jonathan et aux pages Compte) ; aucune modification de la limite de contact ni de la rétention (Q-5) ; je ne lance ni `db:push` ni `npm run dev`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Texte absent | `texte` et `version` au marqueur | page rendue avec le marqueur, H1 et pied normaux | N/A |
| Version fournie | `version` = `2026-11-01` | « Version du 1 novembre 2026 » (FR) dans `<time>` | N/A |
| Production avec marqueur | `KOMA_VERIFIER_TEXTES=true`, un marqueur dans `Legal.*` | build en échec nommant `Legal.cgv.texte`, etc. | exit 1 |
| Sans la variable | dev, CI | build passe | N/A |
| Contact | page Contact | lien vers `/confidentialite` dans la langue de la route, 44 px | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/vitrine/marqueur.ts` -- ajouter `"Legal"` à `ESPACES_PUBLICS` ; `scripts/verifier-marqueurs.mjs` le lit déjà, ne pas le modifier ; `tests/unit/marqueur-texte.test.ts` -- cas `Legal`.
- `src/app/[locale]/a-propos/page.tsx` -- modèle (generateMetadata, `JsonLd`, `TitreVitrine`) ; créer `src/app/[locale]/{mentions-legales,cgv,livraison-et-retours,confidentialite}/page.tsx` minces, partageant `src/components/vitrine/PageLegale.tsx` (H1, version, paragraphes) et une liste unique `src/lib/vitrine/pages-legales.ts` (clé, chemin) utilisée par pages, pied et sitemap.
- `src/components/layout/PiedDePage.tsx` -- carte `pied-legal` après Aide, liens `LIEN` ; grille `lg:grid-cols-4` déjà prévue.
- `src/app/sitemap.ts` -- `PAGES_PUBLIQUES` + quatre chemins ; `tests/unit/robots-sitemap.test.ts` à étendre.
- `src/components/vitrine/FormulaireContact.tsx` -- lien sous `Bouton` (`Link` de `@/i18n/navigation`, classe `LIEN` du pied).
- `messages/{fr,en}.json` -- `Legal.<page>.{titre,texte,version}`, `Legal.versionDu`, `Metadata.legal.<page>.{titre,description}`, `Pied.legal.{titre,mentions,cgv,livraison,confidentialite}`, `Contact.confidentialite`.
- `tests/e2e/vitrine.spec.ts` -- quatre pages (axe, clavier, 375 px), lien du pied et du contact.
- `_bmad-output/implementation-artifacts/deferred-work.md` -- marquer « traité » l'entrée 1.8 sur le lien vie privée ; ne pas toucher aux autres.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/vitrine/pages-legales.ts`, `PageLegale.tsx`, quatre `page.tsx` -- pages, metadata, JSON-LD, date de version -- structure indépendante des textes
- [ ] `messages/*.json` -- clés `Legal`, `Metadata.legal`, `Pied.legal`, `Contact.confidentialite` (corps et versions au marqueur)
- [ ] `marqueur.ts`, `PiedDePage.tsx`, `sitemap.ts`, `FormulaireContact.tsx` -- espace public, carte Infos légales, sitemap, lien de confidentialité
- [ ] tests Vitest (formatage de version ISO ou marqueur, découpe en paragraphes, `trouverMarqueurs` sur `Legal`, sitemap, pied) et e2e axe/clavier/375 px

**Acceptance Criteria:**
- Given `KOMA_VERIFIER_TEXTES=true` et `Legal.*` au marqueur, when `npm run build`, then échec nommant les clés ; sans la variable, la CI reste verte
- Given les quatre pages en `/fr` et `/en`, when elles s'affichent, then le corps et la version viennent de `messages/*.json`, sans texte légal dans le code
- Given le pied de page, when il s'affiche à 375 px, then la carte Infos légales mène aux quatre pages, chaque lien de 44 px

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| `PageLegale` jamais rendu en test (`<time>`, découpe en paragraphes, bonne clé) | medium | patch | seuls les helpers sont testés ; les vrais textes sont au marqueur |
| Retours à la ligne simples écrasés dans un paragraphe (adresses, listes) | low | patch | classe `whitespace-pre-line`, correction directe |
| Lien de confidentialité du contact quitte le formulaire, saisie perdue | low | patch | ouvrir dans un nouvel onglet avec `rel="noopener"` |
| `});});` sur une ligne, ordre d'import | low | patch | formatage/lint |
| Version non ISO affichée sans `trim` | low | patch | correction directe |
| Phrase de consentement avant l'envoi du formulaire de contact | low | defer | texte légal : à fournir par Jonathan (règle 15, Q-5) |
| Pages indexables avec marqueur, sans `noindex` | low | rejeté | le build de production échoue tant que le marqueur reste (garde de la 1.8) |
| Version fr/en pouvant diverger, date future acceptée | low | rejeté | valeurs fournies par Jonathan |
| Clé de traduction absente : erreur au rendu | low | rejeté | tests de clés et de parité déjà en place |
| Triplement des titres, `dateModified`, fil d'Ariane, mention des sous-traitants, axe, liens depuis paiement | low | rejeté | hors périmètre ou aucun dommage (règle 14) |
| Test pied de page faible | low | rejeté | redondant mais inoffensif |

## Design Notes

Choix sans impact visible laissés tranchés ici : chemins identiques en FR et EN (comme `/a-propos`) ; un seul champ `texte` par page, mis en forme par lignes vides, car la structure des textes de Jonathan (titres, articles) n'est pas connue ; si elle l'exige, une story ultérieure ajoutera des sections. La clé `version` contient une date ISO ; le même identifiant servira plus tard à `commande.acceptations` (AD-34), sans rien enregistrer ici. Les dates sont celles que Jonathan fournit : le code n'en calcule aucune.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- expected: aucune erreur
- `KOMA_VERIFIER_TEXTES=true npm run build` -- expected: échec nommant les clés `Legal.*` tant que les marqueurs restent
- `npm run test:e2e` -- expected: vert

**Manual checks (if no CLI):**
- Ouvrir les quatre pages en `/fr` et `/en` à 375 px, au clavier, depuis le pied de page et depuis Contact
