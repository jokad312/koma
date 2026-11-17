---
title: '9.16 h) — Étape 4, page 6 : nouvel et modifier article en fenêtre, extrait'
type: 'feature'
created: '2026-11-17'
status: 'in-review'
baseline_commit: '99378eb4ffa5cda0abf2f6c31878c2b9ed477399'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
  - '{project-root}/docs/design/admin/DECISIONS-NUIT.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-9-16-f-formulaire-produit.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/admin/blog/nouveau` et `/admin/blog/[id]` sont des pages de formulaire, alors que la maquette `docs/references/maquettes-admin/06-nouvel-article.png` (DA1 à DA7) montre une fenêtre avec TITRE, EXTRAIT (RÉSUMÉ COURT), CONTENU, image et menu STATUT.

**Approach:** Même habillage que le formulaire produit (page 4) avec `FenetreFormulaire`, et ajout du champ facultatif « Extrait » (Q28), FR et EN, utilisé par la carte de la liste (page 5) et par le blog public là où un résumé est déjà affiché. Consigne de la nuit (2026-11-17).

## Boundaries & Constraints

**Always :**
- Droit inchangé : `blog.gerer`.
- Ordre de la maquette : TITRE (FR et EN), EXTRAIT (FR et EN, facultatif, 300 caractères au plus, compteur), CONTENU (FR et EN, Markdown, aperçu gardé), image (vignette, CHOISIR UNE IMAGE, « JPG/PNG/WEBP — 15 Mo max »), STATUT (Brouillon / Publié / Archivé déclenchant les actions existantes et l'archivage de la page 5, mêmes vérifications). Puis tous les autres champs existants : adresse (slug), lien vers un produit, images multiples avec textes alternatifs.
- Extrait vide : la carte et le blog public utilisent les 160 premiers caractères du contenu sans Markdown (règle de la page 5). Extrait rempli : il est utilisé tel quel. Validation côté serveur (longueur), jamais seulement dans le navigateur.
- Nouvelle migration (colonnes `extrait_fr`, `extrait_en`, nulles par défaut), koma-dev, test SQL, notée dans DECISIONS-NUIT.md ; la fonction ou l'action d'enregistrement existante accepte les nouveaux champs.
- SEO : si une description de page est déjà tirée du contenu, l'extrait la remplace quand il existe.

**Never :** aucun champ retiré ; pas de changement du stockage des images, des droits ni de la RLS ; pas de nouvelle route.

</frozen-after-approval>

## Code Map

- `src/app/[locale]/admin/blog/nouveau/page.tsx`, `src/app/[locale]/admin/blog/[id]/page.tsx` -- pages à habiller.
- `src/components/admin/FormulaireArticle.tsx` (175 l.), `ImagesArticle.tsx`, `PublicationArticle.tsx`, `ChampTexte.tsx`.
- Module du blog (schémas zod, service, actions, requêtes publiques) : `grep -rl "FormulaireArticle\|titre_fr" src/modules`. Pages publiques du blog : `src/app/[locale]/blog/`.
- `src/components/admin/ui/FenetreFormulaire.tsx` (fond plein écran fait à la page 4).
- Nouvelle migration `20270124100000_article_extrait.sql` + test SQL.
- `messages/*.json` -- `Admin.blog.*`. Captures `docs/captures-admin/9-16-h/`.

## Tasks & Acceptance

**Execution :**
- [x] Migration + test SQL ; types régénérés.
- [x] Schéma, service, action, requêtes (+ tests) -- extrait.
- [x] Pages et `FormulaireArticle.tsx` -- fenêtre, ordre de la maquette, menu STATUT.
- [x] Carte de la liste et blog public -- extrait ou 160 caractères.
- [x] `messages/*.json` ; tests unitaires et e2e existants verts.
- [x] Captures 1366 × 768 sombre (côte à côte + superposées 50 %), clair, 390 px ; données TEST_ supprimées.

**Acceptance Criteria :**
- Given un extrait de 301 caractères, when Enregistrer, then refus côté serveur avec l'erreur reliée au champ.
- Given un article avec extrait, then sa carte admin et sa carte du blog public affichent l'extrait.

## Verification

**Commands :**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` -- tous à 0 ; `npm run test:sql` en CI.
- Si un `next dev` lancé hors de cette séance tourne déjà dans le dossier (Next en refuse un second), ne pas l'arrêter : laisser les e2e à la CI et le dire dans le rapport.

## Implementation Notes

- Migration `20270124100000_article_extrait.sql` : colonnes `extrait_fr` / `extrait_en` (1 à 300 caractères en base), `grant select` de ces deux colonnes à anon / authenticated (RLS inchangée), `enregistrer_article` recréée (KS_EXTRAIT_INVALIDE, `exiger_admin` inchangé). Test `supabase/tests/article_extrait.test.sql` (16/16 sur koma-dev dans une transaction annulée), migration poussée sur koma-dev, types régénérés.
- Module blog : `extraitFr` / `extraitEn` dans le schéma zod (300 caractères réels, code `extrait_invalide`), le service (`extrait_fr` / `extrait_en`), l'action, `Article`, `CarteArticle.extrait`, `ArticlePublic.extrait`. `extraitArticle(extrait, texte)` dans `texte.ts` : extrait saisi tel quel, sinon `extraitCarte` (160 caractères). Admin : `extrait_fr` ; public : extrait de la langue servie, sinon début du texte de la langue.
- SEO : page `/blog/[slug]` (description, Open Graph) et JSON-LD (`ArticleComplet`) : `article.extrait ?? extraireTexte(texte)`.
- Carte publique : `CarteArticle avecExtrait` dans la liste `/blog` seulement (accueil inchangé).
- Pages `nouveau` et `[id]` dans `FenetreFormulaire` (`formulaire-article`), lien « Retour aux articles » retiré. `FormulaireArticle` : un seul `<form>`, ordre de la maquette, compteurs d'extrait, `useEnregistrementFenetre`. `ImagesArticle partie="ajout" | "liste"` (vignette, « Choisir une image », « JPG/PNG/WEBP — 15 Mo max »). `PublicationArticle` réécrit en menu STATUT (+ `StatutCreationArticle`).
- Tests unitaires : menu STATUT, fenêtre (ordre, un seul formulaire, ENREGISTRER de l'en-tête), extrait (compteur, 301 refusé par le serveur avec erreur reliée au champ FR ou EN), service, requêtes admin et publiques, page publique (carte, description). E2E ajouté dans `tests/e2e/admin.spec.ts` (« fenêtre de l'article et extrait (9.16 h) »).
- Captures : `scripts/captures-admin.mjs` gagne `nouvel-article-saisi` et `modifier-article` (article TEST_ avec image et extrait) ; sortie `docs/captures-admin/9-16-h/` ; données TEST_ comptées à 0 après.

## Spec Change Log

## Review Triage Log

| # | Relecteur | Constat | Verdict | Preuve / route |
|---|---|---|---|---|
| 1 | Blind + Edge | STATUT publie la base, pas la saisie non enregistrée | low | Rejeté : même comportement que la page 4 et qu'avant (bouton séparé) |
| 2 | Blind + Edge | `champDe` suit la saisie ; un seul champ marqué | low | Patch |
| 3 | Blind | Accueil lit le texte entier sans l'afficher | medium | Patch (pas de texte pour l'accueil) |
| 4 | Blind + Edge + VerifGap | Envoi d'image : bouton du bas actif, Retirer actif, changement d'image non « modifié » | medium | Patch |
| 5 | Blind | Actions de statut non signalées à la fenêtre | low | Patch |
| 6 | Blind | Vignette annoncée deux fois | low | Patch (`alt=""`) |
| 7 | Blind | Menu STATUT : « Publié » cliquable, focus d'erreur perdu | medium | Régression d'accessibilité ; patch (navigation aux flèches rejetée) |
| 8 | Blind | Aides inexactes, 300 en dur | low | Patch |
| 9 | Blind | Trous du test SQL | low | Patch |
| 10 | Blind | Page publique /en non testée | medium | Patch |
| 11 | Blind | Deux boutons « Enregistrer » | low | Rejeté : même choix qu'à la page 4 |
| 12 | Blind | `extraitFr?` facultatif | low | Patch |
| 13 | Blind | Documents absents de la diff | false | Exclus volontairement de la diff de revue |
| 14 | VerifGap | Menu STATUT dans le formulaire ne doit pas l'enregistrer | medium | Patch (test) |
| 15 | VerifGap | Échap du menu dans la fenêtre | low | Patch (test) |
| 16 | VerifGap | « Modifié » après enregistrement réussi | medium | Patch (test) |
| 17 | VerifGap | Image retirée pendant un envoi | medium | Patch (test + correctif 4) |
| 18 | VerifGap | Double création pendant la redirection | low | Patch (test) |
| 19 | Edge | `redirige` bloqué si la navigation échoue | low | Rejeté : cas improbable |
| 20 | Edge | `statut` omis pour un article existant | low | Rejeté : les pages le passent toujours |
| 21 | Edge | Marqueur « [Texte à fournir] » dans l'extrait | low | Patch |
| 22 | Edge | Extrait ajouté sur la carte publique | low | Rejeté : Q28 (« la carte affiche l'extrait ») ; noté dans DECISIONS-NUIT.md |
| 23 | Tous | Assistant voit un menu STATUT que la base refuse | medium | Patch (comme la page 5) |
