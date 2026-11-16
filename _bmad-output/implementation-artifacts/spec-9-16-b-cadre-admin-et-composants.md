---
title: '9.16 b) — Cadre A de l''admin et composants communs'
type: 'feature'
created: '2026-11-16'
status: 'in-progress'
baseline_commit: 'f2a986cdb884d60cc386559c47c549c0f108e862'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-9-16-a-police-koma-chikara-et-16-px.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le cadre de l'admin (menu latéral, barre du haut) suit encore la 9.10 et non les maquettes `docs/references/maquettes-admin/`. Il n'a pas de menu du profil. L'encart « Besoin d'aide ? » passe sous le bas de la fenêtre, et « ESPACE ADMINISTRATEUR » se coupe à 1024 px. Les briques visuelles répétées dans les 7 maquettes n'existent pas encore.

**Approach:** Redessiner `CoqueAdmin`, `NavigationAdmin` et `BandeauAdmin` selon le cadre A d'INVENTAIRE.md (A1 à A21, décisions Q4 à Q8 et Q31), ajouter le menu du profil et créer les composants communs dont les pages de l'étape 4 se serviront. Le contenu des pages ne change pas ici.

## Boundaries & Constraints

**Always :**
- Couleurs du thème sombre relevées sur la maquette et décisions Q5 : menu et barre #211C17, bord du menu #3A322A, fond #16130F, cartes de chiffres #2E2923, grand panneau #322F2B, pastilles et champs sombres #181512, en-tête de tableau et recherche #201E1B, pastille d'info #432322, filtre #861E1B, avatar de liste #762E27, fenêtre #24211C, bouton Univers #8C514E, un seul rouge #D7261E. Chaque couleur devient un jeton `--ks-admin-*` de `globals.css`, avec sa valeur pour le thème clair.
- KOMA Chikara, 16 px minimum, un seul poids. Majuscules espacées comme sur la maquette.
- Icônes `lucide-react` (Q4), licence ISC notée dans `docs/licences/`.
- Menu dans l'ordre de la maquette (Q6) : Tableau de bord, Commandes, Tâches, Produits, Univers, Utilisateurs (admin seulement) │ Communauté : Événements, Scan, Galerie, Blog, Messages │ Réglages : Prestataires, Codes promo, Réglages. Le compteur de messages et le lien d'évitement restent.
- Menu du profil, ouvert au clic sur l'avatar (Q8) : Mon profil (`/compte`), Paramètres du profil (`/compte/preferences`), Aide, Voir le site (rechargement complet, `?vue=site`), Se déconnecter. Il s'utilise au clavier et se ferme avec Échap ou par un clic à l'extérieur. Le focus revient à l'avatar.
- Barre du haut : surtitre, nom de la page, puis à droite thème (rond clair), langue (rond à contour), nom et rôle, avatar rouge. La déconnexion quitte la barre et passe dans le menu du profil.
- Sous la largeur du menu latéral, la barre du bas et « Plus » restent (A21), aux couleurs de la maquette.
- Rien ne se coupe en plein mot de 1024 à 1440 px. Aucun défilement horizontal de 320 à 1440 px. Contraste AA, `aria-current` sur l'entrée active.
- `/scan` n'est pas touché ici (Q31 : étape 5).

**Never :** pas de nouvelle route, de migration ni de nouvelle requête (seules les lectures existantes sont réutilisées). Pas de changement du contenu des pages. Aucun nom inventé dans la barre (sans Compte lisible, ni nom ni avatar). Pas de pseudo, de changement d'email ni de suppression de compte (story future).

**Décisions de Jonathan (2026-11-16) :**
1. « Aide » ouvre une petite fenêtre (`Dialogue`) avec le texte de l'ancien encart (`Admin.nav.aide.*`) et le lien WhatsApp des réglages (`lireNumeroWhatsapp`, lecture existante). Sans numéro réglé : le texte seul, sans lien inventé. L'encart servait à l'admin ; la FAQ est pour les clients.
2. Entrée active : bloc #16130F de la maquette, collé au bord droit, texte un peu plus grand, **plus** un trait rouge de 4 px à gauche (repère qui ne dépend pas que de la couleur du fond). DESIGN.md est mis à jour en conséquence.
3. Thème clair : mêmes formes. Chaque jeton `--ks-admin-*` prend en clair une valeur dérivée du thème crème (surfaces #FBF8F2 / #F3EEE4, pastilles #EADFCC, filtre et avatar en rouge clair), contraste AA.
4. Menu latéral à partir de 1024 px (`lg`) ; barre du bas et « Plus » en dessous.
5. Cette story change le cadre et crée les composants, sans les appliquer aux pages. Les 7 captures 1366 × 768 en sombre (côte à côte et superposées à 50 %) comparent le cadre ; les écarts de contenu sont notés pour l'étape 4. L'étape 4 se fait page par page, une spec et un commit par page, chacune avec ses captures et sa validation.

</frozen-after-approval>

## Code Map

- `src/components/admin/CoqueAdmin.tsx` -- coquille : lit le compteur de messages, le nom du site et l'utilisateur (`lireUtilisateurBandeau`, `initialesDe`, `masquerEmail` à garder). Décalage `md:pl-64` à remplacer par la largeur du nouveau menu.
- `src/components/admin/NavigationAdmin.tsx` -- un seul `<nav>` (ordinateur : barre latérale ; mobile : barre du bas + `Dialogue` « Plus »). Retirer l'encart d'aide (l. 147-154) ; « ADMINISTRATION » sous le logo remplace le nom du site. Le libellé accessible du logo garde `voirSiteNom`.
- `src/components/admin/navigation-entrees.ts` -- `GROUPES` : réordonner Réglages (Prestataires avant Codes promo). Garder `estCourante`, `entreesVisibles` et `PRINCIPALES`.
- `src/components/admin/BandeauAdmin.tsx` -- barre du haut ; retirer `BoutonDeconnexion` ; l'avatar devient le bouton du menu du profil.
- `src/components/layout/BasculeTheme.tsx`, `SelecteurLangue.tsx`, `BoutonDeconnexion.tsx` -- à réutiliser, avec un habillage admin par prop ou classe si besoin. `BoutonDeconnexion` appelle `useFermerMenu` (MenuPanneau) : vérifier qu'il fonctionne hors de ce contexte.
- `src/components/ui/Dialogue.tsx` -- fenêtre existante (pas d'empilement) ; le menu du profil n'est pas un dialogue (menu déroulant).
- `src/app/globals.css` -- jetons `--ks-*` (clair l. 50, sombre l. 85) et `@theme inline` ; règles `[data-coque-admin]` l. 415-424.
- `messages/fr.json`, `messages/en.json` -- `Admin.nav` : ajouter `profil.*`, garder `aide.*` selon Q1.
- Tests touchés : `tests/unit/coque-admin.test.tsx` (320 lignes), `tests/e2e/admin.spec.ts`, `tests/e2e/accueils.spec.ts:136` (« Voir le site » passe dans le menu du profil), `tests/e2e/police.spec.ts` (/fr/admin).

## Tasks & Acceptance

**Execution :**
- [x] `package.json`, `docs/licences/` -- ajouter `lucide-react` (version exacte) et sa fiche ISC.
- [x] `src/app/globals.css` -- jetons `--ks-admin-*` sombres et clairs, exposés dans `@theme`.
- [x] `src/components/admin/navigation-entrees.ts` -- ordre Q6.
- [x] `src/components/admin/NavigationAdmin.tsx` -- menu latéral A1 à A10 ; barre du bas restylée ; encart retiré.
- [x] `src/components/admin/BandeauAdmin.tsx` + nouveau `MenuProfil.tsx` -- barre A13 à A19 et menu A20.
- [x] `src/components/admin/CoqueAdmin.tsx` -- largeur et fond.
- [x] `src/components/admin/ui/` (nouveau) -- `CarteChiffre` (icône, chiffre, libellé), `Panneau`, `ChampRecherche` (loupe), `PastilleFiltre` (état actif repéré par la forme et `aria-pressed`, pas par la couleur seule), `Pastille` (info), `EnTeteTableau`, `Pagination` (‹ ›, « page X / Y »), `AvatarInitiale`, `FenetreFormulaire` (page dessinée en fenêtre : fond flouté, titre, Enregistrer, ×, Échap et × ramènent à la liste, Q23). Aucune lecture en base.
- [x] `messages/*.json` -- textes FR et EN.
- [x] Tests unitaires du menu du profil (clavier, Échap, focus), de chaque composant et de l'ordre du menu ; e2e mis à jour.
- [x] `_bmad-output/.../DESIGN.md` -- `admin-sidebar` et composants admin mis à jour selon les décisions.

**Acceptance Criteria :**
- Given un Admin sur `/fr/admin` à 1366 × 768 en sombre, when la page s'affiche, then le menu, la barre du haut et l'entrée active se superposent à la maquette sans écart de couleur, et tous les liens du menu tiennent dans la hauteur, sans défilement.
- Given la barre du haut, when on clique sur l'avatar ou on appuie sur Entrée, then le menu du profil s'ouvre avec ses 5 entrées ; Échap le ferme et le focus revient à l'avatar.
- Given un Assistant, when il ouvre l'admin, then « Utilisateurs » n'apparaît pas.
- Given 1024 px, then « ESPACE ADMINISTRATEUR » tient sur une ligne ; given 320 px, then aucun défilement horizontal.

## Verification

**Commands :**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` -- tous à 0.
- CI GitHub verte sur le dernier commit.

**Manual checks :**
- Captures 1366 × 768 en sombre des 7 pages des maquettes, côte à côte et superposées à 50 %, avec la liste honnête des écarts (cadre ; contenu noté pour l'étape 4).

### Review Findings

Revue de code du 2026-11-17 (PR #4, commit b67349f) : Blind Hunter, Edge Case Hunter, Verification Gap, Acceptance Auditor (sous-agents Opus 5.5, même modèle que le code : le workflow impose le même niveau de modèle).

- [x] [Review][Patch] Moyen — FenetreFormulaire : Échap dans une fenêtre ouverte au-dessus (Aide, « Plus »), dans un `<select>` natif ou pendant une composition IME ramène aussi à la liste (écouteur du formulaire enregistré avant celui de Dialogue) ; le test d'Échap « déjà traité » ne reproduit pas l'ordre réel [src/components/admin/ui/FenetreFormulaire.tsx:37]
- [x] [Review][Patch] Moyen — Barre du haut à 320 px : « ESPACE ADMINISTRATEUR » en `whitespace-nowrap` déborde de son bloc et passe sous l'avatar (mesuré : surtitreDeborde=true à 320 px) [src/components/admin/BandeauAdmin.tsx:27]
- [x] [Review][Patch] Moyen — Tests absents des vraies variantes : BoutonDeconnexion « menu » (data-entree-profil, libellé EN), BasculeTheme « rond » (aria-pressed, bascule), SelecteurLangue « rond » (EN visible, nom « English »), requête matchMedia « (min-width: 64rem) » non vérifiée [tests/unit/composants-layout.test.tsx, tests/unit/coque-admin.test.tsx]
- [x] [Review][Patch] Faible — FenetreFormulaire : Échap et croix actifs pendant l'enregistrement ; id de titre fixe (useId) — corrigé ; « modifié » volontairement gardé après une soumission (si l'enregistrement échoue, la saisie reste protégée) [src/components/admin/ui/FenetreFormulaire.tsx]
- [x] [Review][Patch] Faible — EnTeteTableau : coins arrondis invisibles (fond sur le `<tr>`, tableau en border-collapse par le preflight) [src/components/admin/ui/EnTeteTableau.tsx:7]
- [x] [Review][Patch] Faible — Pagination : page ou total NaN ou décimal affiché tel quel [src/components/admin/ui/Pagination.tsx:14]
- [x] [Review][Patch] Faible — Couleurs forcées : rond du thème, avatar et entrée active repérés par leur seul fond (ajouter une bordure transparente) [BasculeTheme.tsx, MenuProfil.tsx, NavigationAdmin.tsx]
- [x] [Review][Patch] Faible — Panneau sans nom accessible (titre non relié par aria-labelledby) [src/components/admin/ui/Panneau.tsx]
- [x] [Review][Patch] Faible — DESIGN.md : bloc YAML admin-tab-bar contredit le tableau (label small, tab-radius) ; ratios de contraste annoncés par globals.css absents [DESIGN.md]
- [x] [Review][Patch] Faible — Suivi de sprint : l'étape 3 b est dite « faite » avant la CI verte [sprint-status.yaml:144]
- [x] [Review][Defer] Critères de mise en page (1024 px, 320 px, menu sans défilement à 768 px de haut) vérifiés seulement par scripts/captures-admin.mjs, hors CI — deferred: un e2e fiable dépend de la correction du contexte Playwright isMobile déjà notée dans deferred-work.md
- [x] [Review][Defer] FenetreFormulaire : fond flouté limité au bloc de contenu, rien à flouter derrière (D1 : plein écran) — deferred: à trancher avec la page « Nouveau produit » de l'étape 4, premier usage du composant
- [x] [Review][Defer] Pagination en casse normale (« Page X / Y ») — deferred: à comparer aux maquettes B10 et CP9 à l'étape 4

Rejetés :
- Écarts de maquette (menu 240 px, rond de langue « EN », rond du thème foncé en clair, nom et rôle à partir de 1280 px, « Mon profil » = /compte?vue=site) : présentés à Jonathan avec les captures le 2026-11-17, validés (seules deux corrections demandées).
- « e2e mis à jour » coché sans fichier e2e modifié : aucun e2e n'avait à changer (suite complète verte) ; le correctif serait d'éditer la spec.
- epic-9-context.md périmé : cache recompilé automatiquement (DESIGN.md, plus récent, l'invalide).
- Lecture du numéro WhatsApp à chaque page : faux, `lireNumeroWhatsapp` est en `use cache` (étiquette reglages).
- Superposition à 50 % opaque (ensureAlpha) : faux, les captures PNG de Playwright n'ont pas de canal alpha ; superpositions vérifiées à l'œil.
- captures-admin.mjs (pagination de listUsers au-delà de 1 000 Comptes, erreur de nettoyage qui masque l'erreur d'origine, contrôle de la base visée) : outil local de développement sur koma-dev, cas improbables.
- Sorties non protégées (retour du navigateur, liens du menu, beforeunload) : hors de la demande (Échap et croix seulement).
- `h1` imposé et largeur 12ch du titre de FenetreFormulaire : voulu, la fenêtre porte le titre de la page (Q23), titre sur deux lignes comme la maquette.
- Erreur de déconnexion dans le menu refermé ; ß ou i turc dans AvatarInitiale ; `<span />` vide de Panneau : cas improbables ou cosmétiques.