---
title: 'Story 3.4 : Double option et Kit lié dans toute la boutique'
type: 'feature'
created: '2026-11-01'
status: 'ready-for-dev'
baseline_commit: 'e573f4cc14bd3981bf8cab8efc4f86c0e8fb0d36'
route: 'dispatch'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un Cosplay lié à un Kit publié (relation un pour un, colonne `produit_lie_id`) n'offre au visiteur qu'une seule option : « Prêt à porter » (cosplay physique, rendu par la Zone d'achat et le bandeau de zone). Le visiteur qui veut fabriquer n'a pas d'option claire, et le Kit lié n'est jamais proposé sur la fiche ni sur l'accueil (héros, bloc 1, tuiles). Les FR-7, FR-6, FR-10, FR-1 et FR-2 de l'epic 3 restent partiellement non implémentées côté public.

**Approach:** Double option sur la fiche d'un produit physique publié avec un Kit lié : un sélecteur à deux options « Prêt à porter » / « Le fabriquer moi-même » (radios natifs, « Prêt à porter » par défaut) ; le choix « fabriquer » affiche sur place le panneau « Kit lié » (prix du Kit, accès immédiat, lien « Voir le kit ») et masque tailles, délai, bandeau et zone d'achat, sans changement de page (UX-DR23). Le bandeau de zone propose aussi le Kit lié avec un lien vers sa fiche (FR-6, UX-DR25). Si le Plafond de fabrication est atteint, « Commandes complètes pour le moment » est accompagné du Kit lié (FR-10). Sur l'accueil : bouton « Le fabricher moi-même » du héros vers la fiche du Kit, tuile affichant le prix du Kit (FR-1) ; bloc 1 « Porte-le ou fabrique-le » en deux colonnes (porté : prix et délai ; pièces : prix du Kit), seulement si le Cosplay vedette a un Kit lié publié ; bloc 3 « Kits » avec le Kit gratuit en évidence (FR-2).

## Boundaries & Constraints

**Always:** Nouvelle migration datée dans la plage de la voie 2 (20261120… à 20261124…), par exemple `20261122100000_double_option_et_kit_lie.sql` — en fait aucun écrit côté base n'est nécessaire (le lien existe déjà via `produit_lie_id`, `20261030100000_kits_et_fichiers.sql:21,25-26`) ; si un type manquant était nécessaire côté lecture publique, il est écrit à la main dans le module (l'intégrateur régénère les types après `db:push`). Aucune donnée d'exemple, aucun texte en dur hors `messages/{fr,en}.json` (« [Texte à fournir] » si Jonathan ne l'a pas fourni). Les sous-titres et la vidéo complète sont déjà traités par la 3.2 et ne sont pas re-rendus ici.

**Never:** Paiement (epic 4), accès aux kits payés (3.5 / voie 1), RLS des tables `commandes` / `acces_kit`, fonctions `SECURITY DEFINER` sensibles, authentification, bucket `kits-private`, bibliothèque Bunny privée, lecteur à chapitres / jeton CDN privé (3.7), refactor hors périmètre de la story (règle 14).

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Fiche d'un Cosplay avec un Kit lié publié | fiche physique, `produit_lie_id` non nul, Kit publié | sélecteur à deux options présent, « Prêt à porter » par défaut ; « Le fabriquer moi-même » affiche sur place le panneau « Kit lié » (prix du Kit, accès immédiat, lien « Voir le kit ») et masque tailles, délai, bandeau et zone d'achat, sans changement de page | N/A |
| Fiche d'un produit physique sans Kit lié | fiche physique, `produit_lie_id` null | aucun sélecteur, comportement actuel (Zone d'achat / bandeau de zone), aucun panneau | N/A |
| Fiche d'un produit physique avec un Kit lié publié, Plafond de fabrication atteint | quantité saisie, fabrication sur commande | « Commandes complètes pour le moment » accompagné du Kit lié ; les articles en stock restent vendables | N/A |
| Héros de l'accueil, Cosplay vedette avec un Kit lié publié | `heros_accueil.produit_id` = cosplay publié | bouton « Le fabriquer moi-même » mène à la fiche du Kit ; tuile (desktop) affiche le prix du Kit | N/A |
| Accueil, bloc 1 « Porte-le ou fabrique-le » | Cosplay vedette avec un Kit lié publié | deux colonnes (porté : prix et délai ; pièces : prix du Kit), seulement si le Kit lié est publié | N/A |
| Accueil, bloc 3 « Kits » | Kits publiés | affiche les Kits publiés, Kit gratuit en évidence (« Ton premier accessoire, offert. ») quand il existe et est publié ; tuile de catégorie Kits ; bloc sans contenu masqué | N/A |

## Code Map

- SQL : lien déjà posé (`20261030100000_kits_et_fichiers.sql:21,25-26`) ; la lecture publique `lireFicheProduit` (`src/modules/catalogue/queries.ts:339-376`) doit porter `produit_lie_id` et renvoyer le Kit lié (prix, slug) au composant public. Type `FicheProduit` enrichi côté voie (écrit à la main ; l'intégrateur régénère après `db:push`).
- Fiche : `src/components/fiche/FicheProduit.tsx` (rendu du sélecteur + panneau « Kit lié »), `src/components/fiche/ZoneAchat.tsx` (masquage conditionnel), `src/components/fiche/BandeauZone.tsx` (proposition du Kit lié), `SelecteurTaille.tsx`, `BoutonAjouterPanier.tsx`, `ModesRemise.tsx`.
- Accueil : `src/components/accueil/HerosAccueil.tsx`, `src/components/accueil/MediaHeros.tsx`, `src/modules/accueil/heros-queries.ts` (`VedetteHeros.href` vers le Kit quand le Cosplay a un Kit lié), `src/modules/accueil/blocs.ts`, `src/app/[locale]/page.tsx`.
- Catalogue : `src/components/catalogue/CarteProduit.tsx`, `src/modules/catalogue/queries.ts` (`lireProduitsLiables`, `listerCatalogue`).

## Tasks & Acceptance

**Execution:**
- [ ] Fiche : sélecteur « Prêt à porter » / « Le fabriquer moi-même » + panneau « Kit lié » (prix, accès immédiat, « Voir le kit »), masquage des tailles/délai/bandeau/zone, sans changement de page (FR-7, UX-DR23).
- [ ] Fiche : bandeau de zone propose le Kit lié avec lien (FR-6, UX-DR25) ; Plafond atteint + Kit lié (FR-10).
- [ ] Héros : bouton / tuile vers le Kit lié (FR-1).
- [ ] Accueil : bloc 1 deux colonnes, bloc 3 Kits / tuile catégorie (FR-2).
- [ ] Messages FR/EN ajoutés (`Fiche`, `Accueil.heros`, `Accueil.cosplaysRecents`, `Accueil.categories`, `Catalogue.titre.kit`, panier) ; aucune clé réorganisée.
- [ ] Tests : unitaires et e2e ; HTML public sans élément privé.

**Acceptance Criteria:**
- Given une fiche d'un Cosplay dont le Kit lié est publié, when elle s'affiche, then un sélecteur à deux options est présent, « Prêt à porter » par défaut (FR-7) ; « Le fabriquer moi-même » affiche sur place le panneau « Kit lié » (prix, accès immédiat, « Voir le kit ») et masque tailles, délai, bandeau et zone d'achat, sans changer de page (UX-DR23).
- Given une fiche d'un produit physique dont le Kit lié est publié, when le bandeau de zone s'affiche, then il propose aussi le Kit lié avec un lien vers sa fiche (FR-6, UX-DR25) ; si le Plafond est atteint, « Commandes complètes pour le moment » est accompagné du Kit lié (FR-10).
- Given le héros de l'accueil et le Cosplay vedette a un Kit lié publié, then le bouton « Le fabricher moi-même » mène à la fiche du Kit, et sur ordinateur la tuile correspondante affiche son prix (FR-1).
- Given l'accueil, when il s'affiche, then le bloc 1 « Porte-le ou fabrique-le » montre le Cosplay vedette sur deux colonnes (porté : prix et délai ; en pièces : prix du Kit), seulement s'il a un Kit lié publié ; le bloc 3 « Kits » montre les Kits publiés, avec le Kit gratuit en évidence (« Ton premier accessoire, offert. ») quand il existe et est publié ; la tuile de catégorie Kits apparaît ; un bloc sans contenu reste masqué (FR-2).

## Spec Change Log

- 2026-11-01, création (draft) : double option FR-7, bandeau/Plafond FR-6/FR-10, héros FR-1, accueil FR-2.

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Le sélecteur « fabriquer » masque le bandeau de zone : ordre visuel attendu | high | à trancher au plan | UX-DR23 |
| Le type public `FicheProduit` ne porte pas le Kit lié : l'option ne peut pas s'afficher | high | code (voie) | `src/modules/catalogue/types.ts:487` |
| La lecture publique de la fiche ne sélectionne pas `produit_lie_id` | high | code (voie) | `src/modules/catalogue/queries.ts:339-376` |

## Design Notes

UX-DR23 : radios natifs ou `radiogroup`, flèches, aucune sélection ne change de page ni n'entame d'action ; double option : « Le fabriquer moi-même » affiche sur place un panneau « Kit lié » (prix, accès immédiat, lien « Voir le kit ») et masque tailles, délai, bandeau et bouton d'ajout ; Retrait / Livraison seulement si Zone = Goma, avec lieu et modalités du Réglage ; sélecteur de tailles (XS à XXL, Sur-mesure ; Plafond atteint : seules les tailles en stock restent, sinon le sélecteur disparaît) ; sélection = bordure rouge 2 px **et** coche.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur
- `npm run test:e2e` -- fiches cosplays / kits
- `npm run test:sql` -- en CI (voie 2 : pas de Docker local)

**Manual checks:**
- Fiche cosplay avec Kit lié publié : choix par défaut, panneau, masquage, lien « Voir le kit ».
- Bandeau de zone / Plafond.
- Héros et bloc 1 accueil.
