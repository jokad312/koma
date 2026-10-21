---
title: 'Story 1.3 : identité visuelle et gabarit commun'
type: 'feature'
created: '2026-10-21'
status: 'done'
baseline_commit: '01ecdb078e0f65187979f5e0fd04f4cc4062fdb6'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le site n'a ni thème, ni polices, ni en-tête, ni pied de page, ni composants de base : `globals.css` ne contient qu'un `@import`, et la règle ESLint laisse passer du texte en dur dans `alt`, `aria-label`, `title`, `placeholder` (`ignoreProps: true`).

**Approach:** Thème Sumi & washi (crème par défaut, sombre au choix) déclaré dans Tailwind avec les valeurs exactes de DESIGN.md, polices Barlow et Barlow Condensed auto-hébergées, gabarit commun (lien d'évitement, en-tête collant, menu ☰, sélecteur de langue, pied de page) et composants de base testés. Sakura Town reste derrière une option de configuration : repli Barlow Condensed tant que Q-F1 est ouverte.

## Boundaries & Constraints

**Always:** Valeurs de DESIGN.md telles quelles (couleurs des deux thèmes, rayons 10/14/18/20/22/9999, espacements, rôles typographiques). Un seul rouge `#E3261C`, texte des boutons rouges `#FFFFFF`. Libellés seulement dans `messages/*.json`. Composants serveur par défaut, composants client seulement pour thème, menu et sélecteur de langue. Thème posé par un script inline dans `<head>` avant le premier rendu, mémorisé en localStorage (try/catch). Anneau de focus double sur `:focus-visible`, `scroll-padding-top` pour l'en-tête collant. Cibles tactiles ≥ 44 px, 375 px sans défilement horizontal. Animations coupées en `prefers-reduced-motion`, contenu visible sans JavaScript. `forced-colors: active` : verre remplacé par `Canvas`. Rubrique dont la page n'existe pas : non affichée. Licence Barlow notée dans `docs/licences/`. Règle ESLint étendue à `alt`, `aria-label`, `title`, `placeholder` (point reporté de la 1.2, à marquer traité dans `deferred-work.md`).

**Décisions de Jonathan (2026-10-21) :** (1) Icône panier non affichée avant la story 4.1. (2) Ajout de `jsdom`, `@testing-library/react`, `@testing-library/user-event` en devDependencies, versions figées sans `^`. (3) Sakura Town : aucun fichier ajouté avant la version complète et l'accord écrit (Q-F1) ; option `NEXT_PUBLIC_TITRES_SAKURA` éteinte par défaut. (4) Logo : le fichier « principale logo.svg » est la création de NATHANGROUP SARL ; copié sans modification dans `public/logo/logo-principal.svg` après vérification (ni script, ni image, ni police embarquée) ; licence notée « propriété de NATHANGROUP SARL ». L'en-tête l'affiche, texte alternatif tiré de `nom_site`, lien vers l'accueil de la langue en cours. Je ne crée aucune variante : si le contraste manque sur un thème, je le signale. La version PNG reste dans `imports/`, non utilisée ici. (5) Spec gardée entière.

**Never:** Aucun fichier Sakura Town dans le dépôt (licence non confirmée, dépôt public, règle 6). Aucune image ni logo officiel de franchise. Aucune page nouvelle (Cosplays, Kits, Compte, Panier…), aucune carte de pied de page Aide, Infos légales ou Paiement. Pas de modification de migration. Pas de `npm run dev` lancé par moi sur le port 3000.

## I/O & Edge-Case Matrix

| Scénario | Entrée | Comportement | Erreur |
|----------|--------|--------------|--------|
| Premier rendu sombre | localStorage = sombre | attribut de thème posé avant le rendu, sans flash | stockage inaccessible : crème |
| Bascule | clic sur « Thème sombre » | thème inversé, `aria-pressed` change, choix mémorisé | N/A |
| Titre avec accent | Sakura actif, titre « Accès » | tout le titre en Barlow Condensed | N/A |
| Titre sans accent | Sakura actif, « KOMA » | Sakura Town | N/A |
| Option Sakura éteinte | par défaut | tous les titres en Barlow Condensed | N/A |
| Menu ☰ | ouverture au clavier | dialog, focus au 1er élément, reste `inert` ; Échap ferme, focus rendu au bouton | N/A |
| Langue | `/fr/x` → « English » | `/en/x`, cookie `NEXT_LOCALE` écrit | N/A |
| Bouton secondaire désactivé | `aria-disabled` + raison | raison reliée par `aria-describedby`, jamais d'opacité | N/A |

</frozen-after-approval>

## Code Map

- `src/app/globals.css` -- une ligne ; y déclarer `@theme` (couleurs en variables CSS par thème, rayons, polices), focus, verre, `forced-colors`, `prefers-reduced-motion`. Tailwind 4.3.3, pas de `tailwind.config`.
- `src/app/[locale]/layout.tsx`, `page.tsx` -- `<html lang>` ; ajouter script de thème dans `<head>`, `suppressHydrationWarning`, lien d'évitement, en-tête, `<main id="contenu" tabindex="-1">`, pied. `lireNomSite()` fournit le nom.
- `src/app/[locale]/not-found.tsx` -- reprendre le gabarit (404 = vitrine, Sakura autorisé).
- `eslint.config.mjs` l.19-22 -- `react/jsx-no-literals` avec `ignoreProps: true` à corriger ; `src/**/*.test.tsx` est ignoré.
- `vitest.config.mts` -- include `.ts` seulement, env node ; ajouter `.tsx` et jsdom.
- `messages/{fr,en}.json` -- pas de clés Navigation/En-tête/Pied ; test de parité existant `tests/unit/messages-parite.test.ts`.
- `src/i18n/routing.ts` -- locales, cookie `NEXT_LOCALE` ; `src/i18n/navigation.ts` à créer pour `Link`/`usePathname`.
- Logo : `_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/imports/logos/SVG/principale logo.svg` (1431 octets, viewBox `0 0 630 220`, contrôlé : aucun script, image ni police). À copier tel quel vers `public/logo/logo-principal.svg`. Traits `#16130F` (encre) et `#E3261C` : l'encre est invisible sur le fond sombre `#16130F` -- à signaler, pas de variante créée.
- `docs/licences/polices.md` -- Sakura Town seulement, champs `[À COMPLÉTER]` ; y ajouter Barlow (SIL OFL 1.1). Ne pas renseigner l'accord de l'éditeur.
- Sakura Town : `imports/fonts/Sakura Town.otf` (98 glyphes sans accents ; `READ THIS.txt` dit « démo, usage personnel »). Ne pas copier.
- À créer : `src/components/{layout,ui}/`, `src/lib/theme/`, `src/lib/typo/titre.ts` (liste des glyphes, choix Sakura ou Barlow Condensed), `src/fonts/` (Barlow 400/500/600, Barlow Condensed 600/700/800 + 800 italique, `.woff2`).

## Tasks & Acceptance

**Execution:**
- [ ] `src/fonts/*`, `src/lib/fonts.ts`, `docs/licences/polices.md` -- Barlow et Barlow Condensed par `next/font/local`, swap ; licence OFL notée -- AC polices, règle 6
- [ ] `src/app/globals.css` -- tokens des deux thèmes, rayons, espacements, rôles typographiques, focus double, verre et repli, `forced-colors`, mouvement réduit -- UX-DR1, 3, 5, 6, 7
- [ ] `src/lib/typo/titre.ts`, option `NEXT_PUBLIC_TITRES_SAKURA` (défaut éteinte, dans `src/lib/env.ts` et `.env.example`) -- bascule entière vers Barlow Condensed si un caractère manque ; Sakura chargée par `@font-face` vers un fichier non versionné (`public/fonts/` dans `.gitignore`) seulement si l'option est active -- UX-DR4, Q-F1
- [ ] `src/lib/theme/`, `src/components/layout/BasculeTheme.tsx` -- script de `<head>` et bouton `aria-pressed` -- UX-DR7
- [ ] `public/logo/logo-principal.svg`, `docs/licences/logo.md` -- copie intacte du logo, propriété NATHANGROUP SARL -- décision 4
- [ ] `src/components/layout/{LienEvitement,EnTete,MenuPanneau,SelecteurLangue,PiedDePage}.tsx`, `src/i18n/navigation.ts` -- gabarit, menu dialog `inert`, langue sur la même page, carte identité -- UX-DR8, 10 à 14
- [ ] `src/components/ui/{Bouton,BoutonSecondaire,Dialogue,Squelette,MessageEtat,MotifManga}.tsx` -- composants de base -- UX-DR6, 9, 15, 16, 30
- [ ] `eslint.config.mjs` -- `ignoreProps: false` ou règle ciblée sur `alt`, `aria-label`, `title`, `placeholder` ; `deferred-work.md` : statut « traité » -- point reporté 1.2
- [ ] `messages/{fr,en}.json` -- clés En-tête, Menu, Thème, Langue, Pied, composants
- [ ] Tests : rouge unique `#E3261C` et `#FFFFFF` sur bouton rouge ; glyphes Sakura (côté serveur) ; ESLint refuse `alt="x"` en dur ; composants (bouton, dialogue, menu, bascule) ; e2e : Tab → « Aller au contenu », 375 px sans défilement, `lang`, thème mémorisé, langue conservant la page

**Acceptance Criteria:**
- Given un rechargement après choix du thème sombre, when la page s'affiche, then le thème est sombre dès le premier rendu, sans flash.
- Given `forced-colors: active`, when l'en-tête s'affiche, then le verre est `Canvas` et la sélection reste visible.
- Given un titre contenant un caractère absent de Sakura Town, when il est rendu côté serveur, then il est entièrement en Barlow Condensed.
- Given l'en-tête collant, when Tab atteint un élément, then l'anneau de focus n'est pas masqué.
- Given JavaScript désactivé, when la page se charge, then le contenu est visible et le thème crème s'applique.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| `Bouton` : `enCours` laisse cliquer, branche `href` perd onClick/aria/`enCours`, `desactive` sans `raison` | medium | patch | `Bouton.tsx` : le clic n'est bloqué que par `desactive` ; le lien ne reçoit pas `...reste` |
| Garde « un seul dialogue » (UX-DR15) sans test | medium | patch | aucun test n'ouvre deux `Dialogue` (grep `dialogueOuvert`) |
| Menu ☰ resté ouvert au passage ≥ lg ; `aria-controls` vers un id absent ; clic Ctrl/Meta ferme le menu | medium | patch | `MenuPanneau.tsx` : pas d'écoute de largeur, id monté seulement ouvert |
| Titres Sakura sans `text-transform: uppercase` | low | patch | règle `.titre-vitrine[data-police="sakura"]` dans `globals.css` |
| Regex `\s` dans un gabarit (`rouge-unique.test.ts`) | low | patch | `\s` devient `s` ; passe par hasard |
| E2E : port en dur, clic avant hydratation, forced-colors/focus/en-tête court non assertés | medium | patch | `gabarit.spec.ts` ; supprimer ces blocs CSS ne ferait échouer aucun test |
| Logo `#16130F` invisible sur fond sombre | medium | defer | connu et annoncé à Jonathan ; il fournit la variante (pas de variante créée) |
| `SelecteurLangue` perd query et hash | low | defer | `useSearchParams` impose un Suspense sous `cacheComponents` ; aucune page n'a de query aujourd'hui |
| Variable `NEXT_PUBLIC_TITRES_SAKURA` et branche du layout sans test | low | defer | impact nul tant que le fichier n'existe pas ; à tester quand Jonathan fournit la police |
| `jsdom` 30 exige Node ^24.15 | maybe-false | defer | à confirmer par la CI (version de Node) |
| axe-core, 320 px, zoom 200 % absents des e2e | medium | defer | non demandés par la spec (vérification manuelle listée) |
| Liste de glyphes Sakura « non vérifiée » | false | rejeté | le cmap du .otf a été lu : U+0020–U+007E, soit 95 glyphes + 3 de contrôle = 98 |
| `epic-1-context.md` réécrit, exigences perdues | false | rejeté | régénéré par le flux (contexte périmé) ; distillation voulue, les stories lisent `epics.md` |
| `NextIntlClientProvider` sans `messages` | low | rejeté | coût marginal aujourd'hui, fichiers petits |
| `testTimeout` global 30 s | low | rejeté | cause connue (tests ESLint en parallèle) |
| Menu et thème inaccessibles sans JS | low | rejeté | la spec demande le contenu visible sans JS, pas la navigation |
| ESLint : autres props `aria-*`, ternaires, gabarits | low | rejeté | hors des 4 props du point reporté ; ajout spéculatif |
| `Bouton` avec lien externe/mailto/ancre | low | rejeté | aucun usage ; la locale ne doit être préfixée que pour les pages internes |
| Option Sakura active sans fichier : 404 de la police | low | rejeté | option manuelle ; le repli Barlow Condensed s'affiche |
| Valeur `TRUE`/`1` de l'option fait planter | low | rejeté | échec bruyant voulu sur une valeur invalide |
| `MessageEtat` : région déjà remplie, `<p>` | low | rejeté | usage futur ; pas de défaut démontré |
| Piège de focus sur éléments cachés ; synchro du thème entre onglets ; cookie sans `Secure` ; test « sans flash » | low | rejeté | cas rares sans effet démontré |

## Design Notes

Sakura Town n'entre pas dans le dépôt : le fichier fourni est une démo « usage personnel » et l'accord écrit manque (Q-F1). La logique (liste des 98 glyphes, bascule entière, option) est livrée et testée avec le repli par défaut ; Jonathan ajoutera le fichier sous licence plus tard sans changer le code.

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- expected: sans erreur
- `npm run test:e2e` -- expected: sans erreur (Playwright démarre son propre serveur sur le port 3100 ; le port 3000 de Jonathan n'est pas touché)

**Manual checks (if no CLI):**
- Thèmes crème et sombre à 375 px et 1280 px, menu ☰ au clavier, mode contraste forcé.
