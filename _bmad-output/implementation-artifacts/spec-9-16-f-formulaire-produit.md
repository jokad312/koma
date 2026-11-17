---
title: '9.16 f) — Étape 4, page 4 : nouveau et modifier produit en fenêtre'
type: 'feature'
created: '2026-11-17'
status: 'done'
baseline_commit: 'fac8d61372baae257a32c7bd43d8a91aae3e4283'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
  - '{project-root}/docs/design/admin/DECISIONS-NUIT.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-9-16-e-produits.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/admin/produits/nouveau` et `/admin/produits/[id]` sont des pages de formulaire de la 9.10, alors que la maquette `docs/references/maquettes-admin/04-nouveau-produit.png` (D1 à D15 d'INVENTAIRE.md) montre une fenêtre (titre sur 2 lignes, ENREGISTRER, ×, trait) aux champs sombres, avec zone de fichier, image et menu STATUT.

**Approach:** Habiller les deux pages avec `FenetreFormulaire` (Q23 : mêmes routes, Échap et × ramènent à la liste, confirmation « Quitter sans enregistrer ? ») et le style de champ de la maquette, en gardant TOUS les champs et toutes les sections existants, pour les 5 familles (Cosplay, Accessoire, Vêtement, Autre article, Kit). Consigne de la nuit (2026-11-17) : pas de validation intermédiaire, choix notés dans DECISIONS-NUIT.md.

## Boundaries & Constraints

**Always :**
- Droit inchangé (`produits.modifier`, et `prix.modifier` là où il s'applique).
- Fond : plein écran assombri et flouté, sans la liste derrière (Q23 option a). La fenêtre défile à l'intérieur ; à 390 px elle occupe la largeur, sans défilement horizontal.
- Ordre de la maquette en tête : NOM (titres FR et EN), DESCRIPTION (FR et EN), PRIX (USD), TYPE DE FICHIER (Q24 : pas de nouveau champ ; pour un Kit, liste en lecture seule des formats déduits des fichiers joints ; masqué sinon), UNIVERS (Q19, à la place de « Catégories »), zone de fichiers du Kit (« Cliquez ou glissez votre fichier ici », bouton Téléverser) quand la famille est Kit, image (vignette, CHOISIR UNE IMAGE, « JPG/PNG/WEBP — 15 Mo max », Q25), STATUT (Q26 : menu Brouillon / Publié / Archivé qui déclenche les actions existantes — publication avec la même vérification des champs obligatoires et la liste des manques, dépublication, archivage de la page 3 avec confirmation).
- Puis, dans le même style, tous les autres champs et sections existants : famille, adresse (slug), délai de fabrication, variantes (tailles XS à XXL, sur mesure, couleurs et stock par taille et couleur pour Vêtement, « Taille unique » pour Autre article), sur commande et délai par taille, mesures, tranches de prix, niveau et matériel du Kit, fichiers, vidéo, chapitres, sous-titres, extrait sans parole, Kit lié, photos multiples avec textes alternatifs FR et EN et ordre.
- Sur la création, ce qui exige un produit existant (photos, fichiers, vidéo) reste disponible après le premier enregistrement, comme aujourd'hui, avec un texte qui le dit.
- ENREGISTRER en haut soumet le formulaire principal ; les sections qui ont leur propre bouton le gardent.
- Champs : jetons `--ks-admin-*` (champ sombre), étiquettes visibles en majuscules espacées, erreurs reliées au champ, 16 px minimum, clavier complet.

**Never :** aucun champ, contrôle ou action retiré ; pas de changement des validations serveur, du stockage des fichiers (bucket privé, Bunny), des droits ni de la RLS ; pas de nouvelle route.

</frozen-after-approval>

## Code Map

- `src/app/[locale]/admin/produits/nouveau/page.tsx` (73 l.), `src/app/[locale]/admin/produits/[id]/page.tsx` (166 l.) -- pages à habiller.
- `src/components/admin/FormulaireProduit.tsx` (359 l.), `FormulaireKit.tsx` (265 l.), `ChoixFamille.tsx`, `EditeurVariantes.tsx`, `EditeurCouleurs.tsx`, `EditeurTranchesPrix.tsx`, `EnvoiPhoto.tsx`, `FilePhotos.tsx`, `FichiersKit.tsx`, `EnvoiFichierKit.tsx`, `ChapitresKit.tsx`, `SousTitresKit.tsx`, `SousTitresExtraitKit.tsx`, `PublicationProduit.tsx`, `ChampTexte.tsx` -- à restyler sans changer leur fonctionnement.
- `src/components/admin/ui/FenetreFormulaire.tsx` -- `idFormulaire`, `enregistrementEnCours`, `retour`. Note de revue 9.16 b : fond flouté limité au bloc de contenu → à passer en plein écran ici.
- Archivage : actions et service de la page 3 (`src/modules/catalogue/`).
- Tests existants du formulaire : `grep -l "FormulaireProduit\|FormulaireKit" tests/unit`, e2e `grep -l "produits/nouveau" tests/e2e`.
- Captures dans `docs/captures-admin/9-16-f/` (création d'un Kit et d'un Vêtement TEST_).

## Tasks & Acceptance

**Execution :**
- [x] `FenetreFormulaire.tsx` -- fond plein écran (et test).
- [x] Pages `nouveau` et `[id]` + composants du formulaire -- ordre et style de la maquette, menu STATUT, type de fichier en lecture seule.
- [x] `messages/*.json` -- FR et EN.
- [x] Tests unitaires (menu STATUT : publication refusée avec la liste des manques ; type de fichier affiché seulement pour un Kit ; champs Vêtement) et e2e existants verts.
- [x] Captures 1366 × 768 sombre (côte à côte + superposées 50 %), clair, 390 px ; données TEST_ supprimées.

**Acceptance Criteria :**
- Given un Admin sur `/fr/admin/produits/nouveau`, when il choisit Vêtement, then tailles XS à XXL, couleurs et stock par taille et couleur sont proposés ; pour Kit, les sections du Kit.
- Given un produit incomplet, when STATUT passe à Publié, then refus avec la liste des manques et le statut reste Brouillon.
- Given une saisie modifiée, when Échap, then « Quitter sans enregistrer ? ».

## Verification

**Commands :**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` -- tous à 0.

## Implementation Notes

- `FenetreFormulaire` : fond `fixed inset-0` (scrim + flou) sur tout l'écran ; le cadre admin recouvert (menu, barre, lien d'évitement) devient `inert` et le `body` ne défile plus ; en-tête fixe, contenu défilant (`data-defilement-fenetre`), pleine largeur et pleine hauteur sous 768 px. Contexte : `useDansFenetre()` (style des champs), `useEnregistrementFenetre(enCours)` (ENREGISTRER occupé pendant l'envoi ; « modifié » remis à zéro après un succès).
- Style des champs : `useClassesChamp()` dans `ChampTexte.tsx` (champ `bg-admin-champ` arrondi, bordure gardée, étiquette en majuscules espacées, options et blocs) ; hors fenêtre, classes d'avant. Appliqué à `ChampTexte`, `ChoixFamille`, `EditeurVariantes`, `EditeurCouleurs`, `FormulaireProduit`, `FormulaireKit`, `EnvoiFichierKit`, `FichiersKit`, `GaleriePhotos`, `ChapitresKit`, `SousTitresKit`, `SousTitresExtraitKit`, `VideoKit`.
- `FormulaireProduit` / `FormulaireKit` : deux `<form>` (nom → univers, avec l'`id` soumis par ENREGISTRER ; famille → fin, avec Entrée et le bouton du bas), et entre les deux la prop `milieu` (zones de la maquette) ; à la création, `ZonesEnTete produit={null}` (textes « après le premier enregistrement », statut Brouillon). Le Kit reprend et rend la saisie commune (`initial`, `onCommun`). TYPE DE FICHIER en lecture seule dans `FormulaireKit`.
- Nouveau `ZonesEnTete.tsx` : zone de fichiers du Kit (`EnvoiFichierKit`, zone de dépôt), image (`EnvoiPhoto` avec vignette), STATUT (`PublicationProduit`). `FichiersKit` prend `ajout={false}` sur la fiche (la zone d'ajout est en tête).
- `PublicationProduit` réécrit en menu STATUT (bouton + liste, Échap referme sans quitter la fenêtre, archivage avec la confirmation et les textes de la page 3) ; `StatutCreation` pour la création.
- Pages : `nouveau` et `[id]` dans `FenetreFormulaire` (titre en h1 dans la fenêtre, intro et « Produit créé » gardés, lien « Retour aux produits » remplacé par la croix, clé `pageEdition.retour` retirée). Rien de changé côté serveur (actions, validations, stockage, droits, RLS) ; aucune migration.
- Tests : `tests/unit/formulaire-produit-fenetre.test.tsx` (fond plein écran et inertie, ordre de la maquette, Vêtement, Kit avec saisie gardée et type de fichier, Échap et ENREGISTRER, type de fichier déduit) ; tests de `PublicationProduit` réécrits pour le menu (refus avec la liste des manques et statut resté Brouillon, archivage avec confirmation, archivé) ; libellé « Choisir une image ».
- Captures : `scripts/captures-admin.mjs` gagne les vues `nouveau-vetement`, `nouveau-kit` (saisie à l'écran, rien d'enregistré), `modifier-vetement`, `modifier-kit` (produits TEST_ semés puis supprimés) et la suite de la fenêtre défilée (`-suite-N`).

## Spec Change Log

## Review Triage Log

| # | Relecteur | Constat | Verdict | Preuve / route |
|---|---|---|---|---|
| 1 | Blind + Edge | Envoi de photo / fichier non protégé dans la fenêtre ; succès laisse « modifié » | medium | Pas d'appel à `useEnregistrementFenetre` ; patch |
| 2 | Blind + Edge | `marquerEnregistre` efface la saisie non envoyée des zones | medium | État « modifié » unique ; patch (par source) |
| 3 | Edge | Famille modifiable pendant une création, `enCoursEnfant` partagé | medium | Double création possible ; patch |
| 4 | Blind + Edge | Matériel, niveau et Kit lié perdus au retour du Kit | low | Patch : commentaire corrigé (comportement inchangé) |
| 5 | Blind + Edge | ENREGISTRER inerte dans les branches d'erreur | low | Patch |
| 6 | Blind + Edge | Menu STATUT : choix perdu au clic sous Safari | medium | `relatedTarget` nul ; patch |
| 7 | Edge | Publication avec des modifications non enregistrées | low | Rejeté : même comportement qu'avant (bouton séparé) |
| 8 | Edge | Dépôt sur zone désactivée ouvre le fichier | low | Patch |
| 9 | Edge | Pastille d'image active pendant l'envoi | low | Rejeté : cosmétique |
| 10 | Edge | Éléments focalisables hors `[data-coque-admin]` | low | Rejeté : lien d'évitement seulement, hors fenêtre visible |
| 11 | Blind + Edge | Succès effacé par un changement dans les zones | low | Patch |
| 12 | Blind | STATUT au milieu, manques renvoient plus bas | low | Rejeté : ordre de la maquette (D14) |
| 13 | Blind | « Téléverser » ne téléverse pas | low | Rejeté : libellé de la maquette (D12), envoi par bouton explicite |
| 14 | Blind | Vouvoiement isolé | low | Patch |
| 15 | Blind | « 15 Mo » en dur, deux formulations | low | Patch |
| 16 | Blind | Valeurs en lecture seule stylées comme des commandes | low | Patch |
| 17 | Blind | Titre de confirmation en français sur /en | low | Patch |
| 18 | Blind | Prix seul dans une grille de 2 | low | Rejeté : cosmétique, même place que la maquette |
| 19 | VerifGap | ENREGISTRER de l'en-tête non testé pour un Kit | medium | Patch (tests) |
| 20 | VerifGap | `ZonesEnTete` et `FichiersKit ajout={false}` non testés | medium | Patch (tests) |
| 21 | VerifGap + Blind | Échap du menu STATUT non testé dans la fenêtre | low | Patch (test) |
| 22 | VerifGap | `KIT.id` n'est pas un UUID | low | Patch |
