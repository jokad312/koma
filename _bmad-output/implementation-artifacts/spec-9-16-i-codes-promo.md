---
title: '9.16 i) — Étape 4, page 7 : codes promo selon la maquette'
type: 'feature'
created: '2026-11-17'
status: 'done'
baseline_commit: '85132c29d2749e694a3b3158c527a2b766c6d884'
route: 'dispatch'
review_loop_iteration: 1
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
  - '{project-root}/docs/design/admin/DECISIONS-NUIT.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-9-16-d-commandes.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/admin/codes-promo` affiche le formulaire de création en haut de page et une liste de cartes, alors que la maquette `docs/references/maquettes-admin/07-codes-promo.png` (CP1 à CP9) montre un titre, « + NOUVEAU CODE », une recherche, un filtre en pastille et un tableau (N°, INFLUENCEUR, DATE, CODE, actions copier / modifier / corbeille) avec pagination ‹ ›.

**Approach:** Redessiner avec les composants de `src/components/admin/ui/`, selon Q29 (N° = position dans la liste, Date = `cree_le`), Q30 (Copier → presse-papiers, « Copié »), Q22 (corbeille = désactiver), Q18 (20 lignes par page). Consigne de la nuit (2026-11-17).

## Boundaries & Constraints

**Always :**
- Droit inchangé : `codes_promo.gerer` (Admin) ; le réglage des commissions garde son droit.
- Titre CODES PROMO (CP1). « + NOUVEAU CODE » ouvre le formulaire de création existant dans une `FenetreFormulaire` sur la même route (paramètre d'adresse, pas de nouvelle route) ; « Modifier » (crayon) ouvre de même la modification existante. Échap et × ramènent à la liste.
- Recherche dans la liste déjà lue (code, affilié), sans nouvelle requête. Filtres en pastilles TOUS, ACTIFS, INACTIFS.
- Colonnes : N° (position), INFLUENCEUR (`AvatarInitiale` + nom de l'affilié), DATE (création, à l'heure de Goma), CODE (pastille sombre), puis les colonnes existantes (réduction %, commission %, plafond, état Actif / Inactif, ventes : nombre, montant, commission), et ACTIONS : copier (« Copié » annoncé en statut), modifier, corbeille = désactiver avec confirmation (un code inactif propose « Réactiver » si l'action existe déjà ; sinon la modification le permet). Sous 1024 px : cartes, sans défilement horizontal à 390 px.
- Pagination ‹ › de 20 lignes, « page X / Y ».
- Les valeurs affichées restent celles de la base, relues après chaque réponse du serveur.

**Never :** aucune suppression de code promo ; pas de migration ; pas de changement des règles de code (le code d'un code existant ne se modifie jamais), des droits, du paiement ni de la RLS.

</frozen-after-approval>

## Code Map

- `src/app/[locale]/admin/codes-promo/page.tsx`, `src/components/admin/CodesPromoSelonDroit.tsx` (31 l.) -- page et droit.
- `src/components/admin/ListeCodesPromo.tsx` (79 l., client, `enEdition`), `FormulaireCodePromo.tsx` (208 l.) -- liste et formulaire (création et modification).
- `src/modules/promo/` -- `types.ts` (`CodePromo` : vérifier `cree_le` et l'affilié), `queries.ts` (`lireCodesPromoAdmin`), actions (activer / désactiver).
- `src/components/admin/ui/` -- `ChampRecherche`, `PastilleFiltre`, `EnTeteTableau`, `Pagination`, `AvatarInitiale`, `FenetreFormulaire`.
- `messages/*.json` -- `Admin.codesPromo.*`. Tests : `grep -l "codes-promo\|ListeCodesPromo" tests -r`. Captures `docs/captures-admin/9-16-i/`.

## Tasks & Acceptance

**Execution :**
- [ ] `CodesPromoSelonDroit.tsx`, `ListeCodesPromo.tsx`, `FormulaireCodePromo.tsx` -- mise en page CP1 à CP9, fenêtre de création et de modification.
- [ ] `messages/*.json` -- FR et EN.
- [ ] Tests unitaires (copier : presse-papiers et « Copié » ; filtres ; pagination ; corbeille demande confirmation puis désactive) et e2e existants verts.
- [ ] Captures 1366 × 768 sombre (côte à côte + superposées 50 %), clair, 390 px ; données TEST_ supprimées.

**Acceptance Criteria :**
- Given 25 codes, then 2 pages, N° 21 à 25 sur la deuxième.
- Given un clic sur Copier, then le code est dans le presse-papiers et « Copié » est annoncé.
- Given la corbeille confirmée, then le code passe Inactif (relu en base) et reste dans la liste sous INACTIFS.

## Verification

**Commands :**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` -- tous à 0.
- Si un `next dev` lancé hors de cette séance tourne déjà dans le dossier (Next en refuse un second), ne pas l'arrêter : laisser les e2e à la CI et le dire dans le rapport.

## Implementation Notes

## Spec Change Log

## Review Triage Log

Revue BMad du 2026-11-21 (4 relecteurs : Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor). Corrigé :
- haut : corbeille et Réactiver renvoyaient les valeurs affichées (écrasement d'une modification faite ailleurs) → `changerEtatCodePromoAction` ne change que l'état, valeurs relues en base côté serveur ; tests du service et de la dépendance ;
- moyen : annonce dans la ligne (perdue quand la ligne quitte la vue sous ACTIFS) et focus perdu → zone de statut unique (`AnnoncesCodesPromo`), focus au compteur ; plus de zone live par ligne ;
- moyen : page trop grande gardée dans les liens et le retour → page ramenée partout ;
- moyen : vérifications manquantes → test du bouton « Enregistrer » de l'en-tête et d'Échap après succès, pluriels ICU réels, e2e réel (route, fenêtre `?nouveau=1`, corbeille, Inactif relu en base, listé sous INACTIFS, 390 px) ;
- bas : liste rendue derrière la fenêtre, `onTermine` / « Annuler » morts, `dl` des conditions sans rôle, presse-papiers non restauré entre tests, libellé de recherche (code OU influenceur), commentaire `instant`.
Écarté : recherche faite de seuls signes combinants (improbable), date de création invalide (colonne `not null` en base), annulation dans la fenêtre de 1 ms avant `enCours`, double rendu tableau/cartes (même modèle que les commandes, annonces désormais communes), deux boutons Enregistrer (même choix que produits et articles). Choix non tranchés notés dans DECISIONS-NUIT.md.
