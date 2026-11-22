---
title: 'Bug A3 : plantages insertBefore / removeChild avec la traduction automatique du navigateur'
type: 'bugfix'
created: '2026-11-22'
status: 'done'
baseline_commit: '48c4206d3ae2aef84223a61e3404f8b8b7f19666'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Journal du 2026-11-22, l. 18-89, 97, 98, 102, 133. La traduction automatique de Chrome (ou une extension) remplace les nœuds texte de la page par ses propres `<font>`. Ensuite, quand React insère ou retire un nœud à côté d'un texte qu'il croit encore en place, il plante : `NotFoundError: Failed to execute 'insertBefore' / 'removeChild' on 'Node'`. La page devient blanche (erreur non rattrapée). Le correctif `d879ee1` a protégé le `Bouton` (insertBefore de « Recevoir un code »), mais la cause est générale. Essai jsdom du 2026-11-22 : tout élément qui a **plusieurs** enfants texte (ex. `{"Envoyer à "}{email}` ou `{a}{" — "}{b}`) plante dès que React retire un de ces textes après la traduction. Le Bouton seul tient (texte unique, raison qui disparaît, libellé qui change : OK). Une règle « un seul texte par élément » ne peut pas être garantie à la main sur tout le site.

État des autres lignes du journal :
- « Hydration failed » (l. 37-89) : le HTML du serveur (ancien Bouton, sans `<span class="contents">`) ne correspondait pas au client recompilé pendant que le correctif était en cours. C'est un artefact du rechargement en développement, pas un bug du site. Une page traduite AVANT l'hydratation donne aussi « Hydration failed » : React le rattrape (erreur récupérable) et reconstruit l'arbre côté client, sans plantage (vérifié) ; Chrome retraduit ensuite.
- removeChild l. 97, 98, 102 (rechargements en développement) et l. 133 (navigation vers /fr/accueil-connecte, qui plantait au même moment sur « module factory is not available », l. 119) : non reproduits isolément dans jsdom, même mécanisme probable.

**Approach:** Une garde installée avant React, par le script inline déjà présent dans `<head>` (`ScriptTheme`), rend `Node.prototype.removeChild` et `Node.prototype.insertBefore` tolérants au seul cas « le nœud n'est pas (ou plus) enfant de ce parent ». Dans ce cas, la garde ne lève pas d'erreur. Dans tous les autres cas, elle appelle l'original sans rien changer. Le correctif `d879ee1` du Bouton est conservé.

**Décisions de Jonathan (2026-11-22) :**
- Insertion quand le nœud de référence a disparu : **option a)**, le nœud est inséré en fin de parent. Rien n'est perdu ; dans ce cas rare, un texte peut apparaître au mauvais endroit jusqu'au prochain rendu ou au rechargement.
- Journal : **chaque** cas rattrapé est journalisé (`console.warn`), **en développement seulement** ; rien n'est journalisé en production.
- Un test prouve que, sans traduction, `removeChild` et `insertBefore` se comportent exactement comme avant (mêmes résultats, mêmes erreurs).

## Boundaries & Constraints

**Always:** traduction automatique laissée possible partout ; comportement DOM strictement identique quand les nœuds sont à leur place ; garde idempotente (installée une seule fois, même si le script et l'effet client s'exécutent tous deux) ; aussi installée lors d'un rendu purement client (effet de `ScriptTheme`) ; journal (développement seulement) sans contenu de la page ni donnée personnelle : seulement l'opération (`removeChild` ou `insertBefore`) et le nom des balises concernées.

**Never:** `translate="no"` ou `<meta name="google" content="notranslate">` ; script tiers ; modifier la CSP (l'inline est couvert par `'unsafe-inline'` aujourd'hui ; noter pour la 9.9 que ce script fait partie de ceux qui recevront le nonce).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Texte retiré après traduction | `<p>{"x"}{" — "}{"y"}</p>` traduit, puis rendu `<p>{"x"}</p>` | aucune exception, l'application continue | `[dom]` journalisé en dév., rien en prod. |
| Insertion devant un texte remplacé | Bouton traduit, ancien Bouton sans indicateur fixe (cas `d879ee1`) | nœud inséré en fin de parent, aucune exception | `[dom]` journalisé en dév., rien en prod. |
| Nœuds à leur place | tout rendu normal, sans traduction | appel natif : même valeur renvoyée, même DOM qu'avant la garde, aucun journal | erreurs natives inchangées : `removeChild(null)`, `insertBefore(n, null)` (ajout en fin), insertion d'un ancêtre dans son descendant lèvent ou agissent comme l'original |
| Double installation | script `<head>` + effet client | une seule enveloppe | N/A |

</frozen-after-approval>

## Code Map

- `src/lib/theme/script.ts` -- `SCRIPT_THEME` (chaîne inline). Ajouter à côté une fonction `installerGardeTraduction()` dans un nouveau `src/lib/dom/garde-traduction.ts` (testable directement), puis sa forme inline concaténée au script de `<head>`, avec le mode passé en argument au moment du rendu serveur : `(${fn.toString()})(${process.env.NODE_ENV !== "production"})` (journal en développement seulement).
- `src/components/layout/ScriptTheme.tsx` -- rend le `<script>` côté serveur ; son `useLayoutEffect` couvre le rendu purement client : y appeler aussi `installerGardeTraduction()`.
- `src/components/ui/Bouton.tsx` -- correctif `d879ee1` : ne pas toucher.
- `tests/unit/bouton-traduction-navigateur.test.tsx:15` -- `traduireCommeLeNavigateur` : la reprendre (export depuis `tests/unit/aides-dom.tsx`, ou recopie locale).
- `src/lib/securite/entetes.ts:13-14` -- commentaire CSP / 9.9 : ajouter la mention du script de garde.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/dom/garde-traduction.ts` -- `installerGardeTraduction()` : paramètre `journaliser` (vrai en développement), drapeau d'installation, enveloppes de `removeChild`/`insertBefore` limitées au cas « pas enfant de ce parent » (`insertBefore` : insertion en fin de parent, décision a), à chaque cas rattrapé et seulement si `journaliser` : `console.warn("[dom] nœud déplacé par une traduction ou une extension :", opération, balise du parent)` -- protège tout le site.
- [x] `src/lib/theme/script.ts`, `src/components/layout/ScriptTheme.tsx` -- garde dans le script de `<head>` et dans l'effet client -- installée avant l'hydratation.
- [x] `tests/unit/garde-traduction.test.tsx` -- cas de la matrice dans jsdom : rouge sans la garde (NotFoundError, déjà constaté pour le texte retiré), vert avec ; un `console.warn` par cas rattrapé avec `journaliser` vrai, aucun avec `journaliser` faux ; **comportement inchangé sans traduction** : les mêmes opérations (retrait, insertion devant, insertion en fin, `removeChild(null)`, ancêtre inséré dans un descendant) donnent, avec et sans garde, le même résultat ou la même erreur, le même DOM et aucun journal ; originaux restaurés après chaque test.
- [x] `src/lib/securite/entetes.ts` -- commentaire 9.9.

**Acceptance Criteria:**
- Given une page traduite par la traduction simulée, when React retire ou insère un nœud à côté d'un texte remplacé, then la page reste utilisable, aucune `NotFoundError` n'est levée, et chaque cas est journalisé en développement mais pas dans un build de production.
- Given une page non traduite, when on parcourt connexion, panier et admin (e2e existants), then tous les e2e passent sans changement.

## Implementation Notes

- e2e local (`npm run test:e2e`, 2026-11-22) : 273 réussis, 2 échecs mobiles admin.spec.ts:229 et :373 (restauration après archivage) ; ils échouent aussi garde retirée (essai du même jour) : sans lien avec A3, à suivre.

## Spec Change Log

## Review Triage Log

| # | Source | Constat | Verdict | Route |
|---|--------|---------|---------|-------|
| 1 | vgap + blind | garde inline de `<head>` jamais vérifiée dans le HTML servi par Next (sortie SWC ; `try/catch` muet) | medium | patch (e2e gabarit.spec.ts, scripts Next bloqués) |
| 2 | vgap + blind | installation par l'effet de `ScriptTheme` (rendu purement client) non testée | low | patch (test unitaire) |
| 3 | blind + edge | removeChild rattrapé : le texte traduit (`<font>`) reste affiché | medium : réel, seule lecture possible de l'intention (rien n'est levé, on ne sait pas quel `<font>` retirer) | patch (commentaire + assertion) |
| 4 | blind | mise à jour de texte invisible sur page traduite | maybe-false, medium si vrai : antérieur à A3 | defer |
| 5 | blind + edge | en production, de vrais bugs DOM passent sans signal | false comme défaut : journal de production exclu par décision de Jonathan | rejet |
| 6 | blind | repli appendChild : un nœud déjà enfant peut changer d'ordre | low : conséquence de l'option a) | patch (commentaire) |
| 7 | blind | garde embarquée côté client, `toString()` au chargement, `suppressHydrationWarning` | low : refonte serveur seul = complexité | rejet |
| 8 | blind | test « originaux restaurés » dépendant de l'ordre | low | patch |
| 9 | blind + edge | `instanceof Node` faux pour un nœud d'une autre fenêtre | low, correction directe | patch (`nodeType`) |
| 10 | blind | spec absente du diff relu | false : exclue volontairement de la revue, commitée avec le code | rejet |
| 11 | edge | drapeau porté par l'enveloppe : perdu si un tiers réenveloppe removeChild | low, improbable | rejet |
| 12 | edge | insertBefore rattrapé + type de nœud invalide : HierarchyRequestError au lieu de NotFoundError | low, négligeable | rejet |

## Design Notes

Garde (forme visée, en JavaScript ES5 car inlinée telle quelle) :
```js
var r = Node.prototype.removeChild;
Node.prototype.removeChild = function (n) {
  if (n && n.parentNode !== this) { avertir("removeChild", this); return n; }
  return r.apply(this, arguments);
};
```
`insertBefore(n, ref)` : si `ref` est présent mais n'est pas enfant de `this`, alors `avertir("insertBefore", this)` puis `appendChild` d'origine (décision a). `avertir` ne fait rien quand `journaliser` est faux. C'est la parade connue du ticket React #11538 : elle ne masque que ce cas, et toute autre erreur DOM reste levée.

## Verification

**Commands:**
- `npm test -- tests/unit/garde-traduction.test.tsx tests/unit/bouton-traduction-navigateur.test.tsx` -- expected: verts.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` -- expected: code de sortie 0.

**Manual checks (if no CLI):**
- Chrome, /fr/connexion, clic droit › « Traduire en anglais », envoyer un email, revenir, aller au code, se connecter : aucune page blanche ; des `[dom]` dans la console (`npm run dev`) ; avec `npm run build` puis `npm start`, aucun.
