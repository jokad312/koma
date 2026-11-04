---
title: 'Story 9.1 : Créer un Code promo'
type: 'feature'
created: '2026-11-03'
status: 'draft'
route: 'dispatch'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** aucun Code promo n'existe encore : Jonathan ne peut pas ouvrir un code à un influenceur, ni suivre ce que ce code rapportera (FR-46 à FR-48).

**Approche :** module `promo` (nouveau) : table `code_promo` réservée à l'admin, avec ses fonctions d'écriture (modèle de la Couverture, story 5.1). Jonathan crée un code en saisissant le code, l'Affilié (nom libre, sans compte admin), le pourcentage de réduction, le taux de commission, le plafond d'utilisations (50 par défaut) et l'état actif ; il peut ensuite modifier ces valeurs, le code lui-même restant immuable. Aucune colonne ne compte les utilisations (AD-29). Chaque création ou modification est journalisée.

## Boundaries & Constraints

**Always :**
- Table `code_promo` du module `promo`, RLS active, aucun accès direct pour `anon` ni `authenticated` (comme `couverture`) ; lecture admin par le client service après `exigerDroit("codes_promo.gerer")`.
- Écritures uniquement par des fonctions `security definer` recevant `p_auteur jsonb` en premier paramètre (AD-25), qui appellent `public.exiger_admin` puis `set_config('ks.auteur', …)` avant l'écriture.
- Unicité du code **sans distinction de majuscules** ; le code est normalisé en majuscules à l'enregistrement.
- **Aucune colonne compteur** sur `code_promo` (AD-29) : les utilisations se calculent, elles ne se stockent pas (9.2).
- Montants et pourcentages validés côté serveur (Zod puis fonctions SQL), jamais depuis le navigateur seul (règle 3).
- Journalisation par le déclencheur `public.journaliser('id')` déjà en place.

**Ask first :**
- Ajouter une fonction de bascule rapide actif/inactif dans la liste (sinon l'état se change par le formulaire de modification).
- Toute borne non fixée par FR-46 (longueur du code, longueur du nom d'Affilié, plafond maximal).

**Never :**
- Toucher à `creer_commande`, à la Commande, au Panier ou au calcul de réduction : c'est la story 9.2.
- Simuler un code, une utilisation ou une commission.
- Modifier une migration déjà appliquée, ni pousser la nouvelle (`db:push` interdit).
- Écrire un texte visible hors des messages FR/EN ; un libellé non sourcé reste `[Texte à fournir]` jusqu'à validation.

## Décisions proposées (à valider au plan)

- Migration `20261230100000_code_promo.sql` (l'epic 6 occupe déjà `20261210100000` à `20261215100000` ; dernière migration de `origin/main` : `20261215100000_reclamation.sql`).
- Code normalisé en majuscules, 3 à 24 caractères, `[A-Z0-9_-]` ; unicité par `unique (code)` une fois normalisé.
- `affilie` : 1 à 120 caractères, espaces de bord retirés.
- `reduction_pct` et `commission_pct` : `numeric(5,2)`, réduction `> 0` et `<= 100`, commission `>= 0` et `<= 100`.
- `plafond` : entier, défaut 50, `1` à `100000`.
- Création **et** modification (code immuable) ; l'état actif/inactif se règle dans les deux.
- Liste triée par `code` croissant.

## I/O & Edge-Case Matrix

| Cas | Entrée | Attendu | Vérification |
|---|---|---|---|
| Création valide | code, Affilié, 20 %, 5 %, plafond vide, actif | Ligne créée, plafond à 50, journal | test SQL + service |
| Code déjà pris, autre casse | `soldes10` puis `SOLDES10` | Deuxième création refusée (`code_existant`) | test SQL |
| Code vide ou caractères interdits | `""`, `été`, `a b` | Refusé avant l'écriture (Zod + CHECK) | test service |
| Pourcentage hors bornes | réduction 0 ou 101 ; commission -1 ou 101 | Refusé, champ concerné | test service |
| Plafond nul ou négatif | `0`, `-3` | Refusé | test service |
| Affilié vide | `""` | Refusé, champ concerné | test service |
| Modification | nouveau nom, taux, plafond, état | Ligne mise à jour, code inchangé, journal | test SQL + service |
| Modification sans le droit | session sans `codes_promo.gerer` | `non_autorise`, aucune écriture | test service |
| Code inexistant | id inconnu | `introuvable` | test SQL + service |
| Lecture directe par un client | `anon` / `authenticated` | Refusée (RLS + `revoke`) | test SQL |
| Aucune ligne par défaut | migration seule | Table vide | test SQL |

## Code Map

- **SQL** : `supabase/migrations/20261230100000_code_promo.sql` — table, index/contrainte d'unicité, RLS, `revoke`/`grant`, déclencheur de journal, `creer_code_promo`, `modifier_code_promo`.
- **Module** : `src/modules/promo/{types,codes,queries,dependances,actions}.ts` (validation pure dans `codes.ts`, modèle `couverture.ts`).
- **Pages** : `src/app/[locale]/admin/codes-promo/page.tsx` (Suspense, `exigerAdminPage(locale, CHEMIN, "codes_promo.gerer")`, `CoqueAdmin`, lecture service).
- **Composants** : `src/components/admin/FormulaireCodePromo.tsx`, `src/components/admin/ListeCodesPromo.tsx` (modèle `CouvertureAgregateur` / `FormulaireUnivers`).
- **Navigation** : entrée « Codes promo » dans `src/components/admin/NavigationAdmin.tsx` (texte déjà présent dans EXPERIENCE.md, l. 81).
- **Messages** : `messages/fr.json` et `messages/en.json`, espace `Admin.codesPromo` + libellé de navigation, en parité.
- **Tests** : `tests/unit/promo-codes.test.ts`, `tests/unit/promo-admin-ui.test.tsx`, `supabase/tests/code_promo.test.sql` (exécuté en CI).

## Tasks

1. Migration : table `code_promo`, contraintes, unicité, RLS, grants, journal, `creer_code_promo`, `modifier_code_promo` ; pgTAP.
2. Module `promo` : types et erreurs, validation Zod, services `creerCodePromo` / `modifierCodePromo`, lecture admin (cast local, `code_promo` absent de `types.ts`), dépendances et Server Actions.
3. Page et composants admin : liste, formulaire de création, formulaire de modification (code affiché, non modifiable), états de chargement/erreur, `aria-describedby` sous le champ fautif.
4. Navigation, métadonnées de page, messages FR/EN en parité ; textes non sourcés remplacés par `[Texte à fournir]` après validation.
5. Tests Vitest (service + interface) et pgTAP ; lint, typecheck, test, build.

## Verification

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` verts.
- `npm run test:sql` sort proprement en local (Docker absent) ; le pgTAP tourne en CI.
- Vérification manuelle : créer un code, le retrouver dans la liste, modifier son plafond et son état, vérifier que le code ne peut pas être changé et que la casse est refusée à la création.

</frozen-after-approval>
