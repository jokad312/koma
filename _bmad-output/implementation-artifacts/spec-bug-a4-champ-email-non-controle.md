---
title: 'Bug A4 : champ email « non contrôlé puis contrôlé » sur la connexion'
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

**Problem:** Sur /fr/connexion (journal du 2026-11-22, l. 93, 112, 146), React avertit « A component is changing an uncontrolled input to be controlled » juste après l'envoi réussi de l'email. Cause reproduite (essai jsdom) : l'étape email et l'étape code ont la même forme (`div > form > … > div > input`). React réutilise donc le même `<input>` : le champ email non contrôlé (`defaultValue`) devient le champ code contrôlé (`value={code}`). Au retour par « Changer d'adresse », c'est l'inverse : « controlled to be uncontrolled ». Le même champ du DOM sert à deux saisies : l'autocomplétion du navigateur, une valeur restée affichée ou un gestionnaire de mots de passe peuvent se tromper de champ.

**Approach:** Monter chaque étape comme un arbre distinct (une `key` par étape sur l'élément racine rendu). Chaque champ naît et meurt avec son étape. Le champ email reste non contrôlé (`defaultValue`) : une saisie faite avant l'hydratation n'est jamais effacée.

## Boundaries & Constraints

**Always:** comportement visible inchangé (textes, focus déplacé à chaque changement d'étape, adresse gardée au retour par « Changer d'adresse », envoi sans JavaScript ou avant l'hydratation par l'action de formulaire) ; email toujours non contrôlé ; code et âge restent contrôlés.

**Never:** rendre le champ email contrôlé ; toucher aux actions serveur ou aux formulaires admin (leur limite d'hydratation est déjà notée dans deferred-work.md, sujet distinct).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Email → code | envoi réussi | champ code vide, nouveau nœud `<input name=code>` (≠ ancien champ email), aucun avertissement contrôlé/non contrôlé | N/A |
| Code → email | « Changer d'adresse » | nouveau champ email prérempli avec l'adresse saisie, aucun avertissement | N/A |
| Email invalide | erreur `email_invalide` | même champ email, saisie conservée, focus sur le champ | message sous le champ |
| Code → âge | code vérifié, âge à déclarer | champ âge vide, aucun avertissement | N/A |

</frozen-after-approval>

## Code Map

- `src/app/[locale]/connexion/FormulaireConnexion.tsx:225-420` -- 5 retours par étape (`moins13`, `questions`, `age`, `code`, email) ; ajouter `key={etape}` (ou une clé constante par branche) sur l'élément racine de chaque branche. Les refs et l'effet de focus (l. 77-84) restent valables : la ref est posée au montage, avant l'effet.
- `tests/unit/formulaire-connexion.test.tsx` -- `allerAuCode` (l. 42) : réutiliser pour les nouveaux tests ; `rendre` vient de `tests/unit/aides-dom.tsx`.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/[locale]/connexion/FormulaireConnexion.tsx` -- clé distincte par étape sur l'élément racine rendu, avec un commentaire qui dit pourquoi (un champ du DOM ne sert jamais à deux saisies) -- supprime la réutilisation de l'`<input>` entre les étapes.
- [x] `tests/unit/formulaire-connexion.test.tsx` -- tests de la matrice : `console.error` espionné, aucun message « uncontrolled »/« controlled » ; le champ code n'est pas le même nœud que l'ancien champ email ; le retour par « Changer d'adresse » préremplit l'adresse -- échouent sans le correctif (vérifié avant de corriger).

**Acceptance Criteria:**
- Given la page de connexion, when on va de l'email au code puis on revient à l'email, then la console ne contient aucun avertissement contrôlé/non contrôlé et les tests existants du formulaire passent tous.

## Implementation Notes

- Clés constantes par branche (`moins13`, `questions`, `age`, `code`, `email`) sur l'élément racine rendu. Tests rouges avant correctif : « email → code » et « code → email » (même nœud `<input>` réutilisé). « Email invalide » et « code → âge » passaient déjà (racines différentes, aucun changement d'étape) : ils servent de garde.

## Spec Change Log

## Review Triage Log

| # | Source | Constat | Verdict | Route |
|---|--------|---------|---------|-------|
| 1 | edge + blind | `renvoyerCode` → `email_invalide` focalise `refEmail` absent à l'étape du code ; message sous le champ code | medium : réel, mais antérieur (avant A4, la ref passait aussi à `refCode` sur le nœud réutilisé) | defer |
| 2 | edge | `changerAdresse` pendant une transition en cours : un résultat tardif change d'étape | low : antérieur à A4, la clé ne change rien ; correctif = jeton de transition (complexité) | rejet |
| 3 | edge | préremplissage = adresse normalisée par le serveur, pas le texte brut | false : comportement d'avant A4, l'adresse renvoyée est celle qui a reçu le code | rejet |
| 4 | blind + vgap | test « code → âge » passait déjà sans le correctif | low : titre trompeur | patch (renommé en garde) |
| 5 | blind | `espionnerConsole` fait taire tous les `console.error` | low | patch |
| 6 | blind | regex `/uncontrolled|controlled/i` redondante et large | low | patch |
| 7 | blind | focus après « Changer d'adresse » non vérifié | low | patch |
| 8 | blind | pas de test email → code → email → code ni d'`autoComplete` | low : couvert par l'identité des nœuds ; test en plus sans gain net | rejet |
| 9 | blind | commentaire loin des clés, phrase confuse | low | patch |
| 10 | blind | protection par convention (une clé par `return`) | low : refonte en `Fragment key={etape}` = complexité | rejet |
| 11 | blind | test « email invalide » sans espion console ; `mockResolvedValue` qui fuit | low | patch |
| 12 | vgap | aucun trou de vérification pour les clés `email`/`code` | false (constat nul) | — |

## Verification

**Commands:**
- `npm test -- tests/unit/formulaire-connexion.test.tsx` -- expected: tous verts, nouveaux tests rouges sans le correctif.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- expected: code de sortie 0.

**Manual checks (if no CLI):**
- `npm run dev`, /fr/connexion, console ouverte : envoyer un email, puis « Changer d'adresse » → aucun avertissement « uncontrolled ».
