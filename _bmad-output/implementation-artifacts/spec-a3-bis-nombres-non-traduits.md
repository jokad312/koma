---
title: 'A3-bis : nombres qui changent protégés de la traduction du navigateur (translate="no")'
type: 'bugfix'
created: '2026-11-22'
status: 'done'
baseline_commit: 'f21e9ef38aa97424b4c3342293687478064aef28'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sur une page traduite par le navigateur, le traducteur remplace chaque nœud texte par ses propres `<font>`. Quand React met ensuite un nombre à jour, il écrit dans le nœud texte d'origine, qui n'est plus affiché. L'ancien nombre reste donc visible : un total de Panier faux après un changement de quantité, par exemple. C'est le point reporté de la revue d'A3.

**Approach:** décision de Jonathan (2026-11-22). Le marquage `translate="no"` porte UNIQUEMENT sur les nombres qui changent :
- prix ;
- totaux et sous-totaux du Panier et des commandes ;
- quantités ;
- stocks affichés ;
- montants des remises ;
- numéros de commande ;
- codes promo et codes de Pass ;
- compteurs de l'admin.

Le reste du texte reste traduisible. Quand un nombre est inséré dans une phrase traduite, seul le nombre est enveloppé, jamais la phrase. Un e2e simule une page Panier traduite, change la quantité et vérifie que le total affiché est le bon.

## Boundaries & Constraints

**Always:**
- Un seul petit composant (ex. `src/components/ui/Nombre.tsx` : `<span translate="no">`) sert à tous les marquages.
- Dans un message, le nombre passe par `t.rich` avec une balise (ex. `<n>{prix}</n>`), dans `fr.json` ET `en.json`, et le libellé reste traduisible.
- Le rendu visible et les noms accessibles ne changent pas.

**Never:**
- `translate="no"` sur une phrase, un libellé, un bouton, une page ou `<html>`.
- `<meta name="google" content="notranslate">`.
- Toucher au calcul des montants (règle 3).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Panier traduit | /fr/panier, traduction simulée, quantité 1 → 2 | total de ligne et sous-total affichés = 2 × prix | N/A |
| Phrase avec nombre | « Prix unitaire : 12,00 $US » traduite | le libellé est traduit, le montant est intact dans un `[translate="no"]` | N/A |
| Texte sans nombre | titre, description, bouton | traduisible (aucun ancêtre `translate="no"`) | N/A |

</frozen-after-approval>

## Code Map

Il n'y a pas de composant de prix central. `formaterUsd(cents, locale)` (`src/lib/argent.ts:42`) renvoie une chaîne. Sa copie admin est `src/modules/tableau-de-bord/calculs.ts:97,130`. Les marquages se font donc aux points d'affichage (chemins relatifs à `src/components/` sauf indication) :
- **Prix seuls :**
  - `catalogue/CarteProduit.tsx:35` ;
  - `fiche/FicheProduit.tsx:85`, `fiche/FicheKit.tsx:104`, `fiche/ZoneAchat.tsx:79`, `fiche/DoubleOption.tsx:95` ;
  - `accueil/HerosAccueil.tsx:106`, `accueil/BlocPorteOuFabrique.tsx:31,41` ;
  - `festival/EvenementComplet.tsx:133`, `festival/FormulaireAchatPass.tsx:234`.
- **Prix dans un message :** `fiche/ModesRemise.tsx:37,44`, `accueil/HerosVisiteur.tsx:70,78`.
- **Panier :**
  - `panier/PagePanier.tsx` : prix unitaire l. 98 (message), délai l. 97, total de ligne l. 122 (message), sous-total l. 140 ;
  - `layout/ZonePanier.tsx:26` : pastille du nombre d'articles.
- **Commande :**
  - `commande/RecapCommande.tsx:42,61,66,73,79` ;
  - `commande/FormulaireCommande.tsx:211`, et le code promo appliqué l. 338-340 ;
  - `commande/PageDetailCommande.tsx:87,146,161,166,172,177` ;
  - `commande/SuiviPaiement.tsx:155` ;
  - `commande/ListeCommandes.tsx:48,53`.
- **Espace client :** `compte/espace/BlocsEspace.tsx:57,60`.
- **Pass et stand :**
  - `festival/FormulaireAchatPass.tsx` : compteur `<output>` l. 254-256, récapitulatif l. 380-399, l. 216 ;
  - `festival/FormulairePaiementStand.tsx:156,253,258,263` ;
  - `compte/CartePass.tsx:43`, `compte/AgrandirCodeQr.tsx:25`.
- **Admin :**
  - `admin/ui/CarteChiffre.tsx:13`. Ne marquer que si le chiffre n'est pas une phrase : avec `texte=true`, il vaut par exemple « Aucune donnée ».
  - `admin/ui/Pastille.tsx` : ne marquer qu'aux appels qui portent un nombre.
  - `admin/NavigationAdmin.tsx:76`.
  - `admin/ListeProduits.tsx:140`.
  - `ListeCommandesAdmin.tsx:248,271`, `DetailCommandeAdmin.tsx:28,126,185`, `ListeCodesPromo.tsx:52-53,81,105,112`.
  - `tableau/` : `CommandesPayees.tsx:30,34`, `PerformanceJour.tsx:24,30`, `Indicateurs.tsx:22,212`, `GraphiqueJours.tsx:17,94`.
  - `TacheMesuresARecevoir.tsx:30`, `TachesArgent.tsx:31`.
  - `admin/ui/Pagination.tsx:39`.
- **Stocks :** aucun stock chiffré n'est affiché côté client (`fiche/SelecteurTaille.tsx` n'affiche que des états). Côté admin, seul le champ `EditeurVariantes.tsx:98` en montre un, et la valeur d'un `<input>` n'est pas traduite. Rien à marquer.
- **Tests :**
  - `tests/unit/aides-dom.tsx:24` `traduireCommeLeNavigateur` : doit sauter les nœuds dont un ancêtre a `translate="no"`, comme le fait le navigateur. Les tests qui l'utilisent restent verts.
  - Pour l'e2e, partir de `tests/e2e/panier-fusion.spec.ts` (`semer()` l. 104, `sqlBloc` l. 49, ajout au Panier l. 207-211). Le Panier du visiteur suffit, sans Mailpit. Nettoyer les données TEST_ à la fin, puis vérifier qu'il en reste 0.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/ui/Nombre.tsx` : composant `<Nombre>` (`span translate="no"`), avec un test unitaire.
- [x] Fichiers du Code Map, ainsi que `messages/fr.json` et `messages/en.json` : marquer chaque nombre qui change, avec `t.rich` dans les messages. Ce point couvre toute la liste de Jonathan.
- [x] `tests/unit/aides-dom.tsx` : la traduction simulée respecte `translate="no"`.
- [x] `tests/unit/nombres-non-traduits.test.tsx` : ajouter des cas pour les lignes 2 et 3 de la matrice (PagePanier et RecapCommande traduits ; libellé traduit ; montant intact).
- [x] `tests/e2e/panier-traduit.spec.ts` (nouveau) : couvre la ligne 1 de la matrice. Le produit TEST_ est semé puis ajouté au Panier du visiteur. Sur /fr/panier, la traduction est simulée en JS dans la page (TreeWalker qui saute `[translate="no"]`, `<font>`). Ensuite, la quantité passe de 1 à 2, et le test vérifie le total de ligne et le sous-total affichés. Un contrôle confirme qu'il ne reste aucune donnée TEST_.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` : décision de Jonathan. Ajouter aux tests instables `admin.spec.ts:229` et `:373` (mobile, « Restaurer » après archivage, échecs locaux contre koma-dev, verts en CI), ainsi que `tests/unit/blog-admin-liste.test.tsx` (« annonce… focus inchangé après Dépublier », rouge une fois sur main en CI le 2026-11-22, run 45049866106, 6/6 verts en local).

**Acceptance Criteria:**
- Given une page traduite, when un nombre de la liste change, then le nouveau nombre est affiché.
- Given la même page, when on la parcourt, then aucun texte hors nombres n'a d'ancêtre `translate="no"`.

## Implementation Notes

- Ajout demandé par Jonathan après la revue (2026-11-22) : translate="no" aussi sur le compte à rebours « renvoyer le code » de la connexion (Connexion.code.delaiRenvoi, `raison` du Bouton élargie à ReactNode) et sur la progression des envois de fichiers de l'admin (9 clés Admin.*.progression, 8 composants ; aria-label par t.markup). L'envoi de photo côté client (Communaute.progression) reste traduisible. Dates et mots autour des nombres : reportés (deferred-work.md).

## Spec Change Log

## Review Triage Log

| # | Source | Constat | Verdict | Route |
|---|--------|---------|---------|-------|
| 1 | edge | montants de remboursement, d'annulation de Pass, de trop-perçu (DetailCommandeAdmin) non enveloppés | medium (dans la liste : montants) | patch |
| 2 | edge + blind | compteurs admin oubliés (mesures.compteur, photos, résultats, nombres de produits et de codes, galerie) | medium (compteurs admin) | patch |
| 3 | edge + blind | numéro de commande d'ObtentionKit non enveloppé | low (numéros de commande) | patch |
| 4 | blind | prix de FormulaireCandidature et « prix » de la grille admin non enveloppés | low (prix) | patch |
| 5 | edge + blind | délais de fabrication : enveloppés dans le Panier, pas ailleurs | low : hors de la liste de Jonathan | patch (enveloppe du Panier retirée) |
| 6 | blind | compte à rebours, progression des envois, temps vidéo, dates non protégés | réel, hors de la liste | defer (à trancher) |
| 7 | blind | passage texte → montant, et mots autour d'un nombre figés | maybe-false, medium si vrai | defer |
| 8 | blind | aucune garde automatique contre un nouveau `{prix}` sans `<nb>` | low : heuristique fragile | rejet |
| 9 | blind + vgap | `<detail></detail>` / `liste()` de SM-1 non vérifiés | medium | patch (test) |
| 10 | blind + vgap | FormulaireAchatPass (compteur, total) non couvert par un test de traduction | medium | patch (test) |
| 11 | blind | tests qui prouvent leur simulateur | low : limite de jsdom | rejet (contrôle Chrome à la main) |
| 12 | blind | classe `notranslate` absente | low, correction directe | patch |
| 13 | blind | ZonePanier hors de `<main>` non atteint par l'e2e | low | rejet |
| 14 | blind | e2e en français seulement | false : le site passe en français seul (B) | rejet |
| 15 | blind | code redondant dans ListeCommandesAdmin | low, correction directe | patch |

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` : code de sortie 0.
- `npm run test:e2e -- tests/e2e/panier-traduit.spec.ts`, puis la suite complète : vert. Seuls les instables connus peuvent échouer, et ils sont alors notés.
