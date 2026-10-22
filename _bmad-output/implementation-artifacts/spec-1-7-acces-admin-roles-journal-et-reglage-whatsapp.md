---
title: 'Story 1.7 : accès admin, rôles, journal et réglage WhatsApp'
type: 'feature'
created: '2026-10-22'
status: 'done'
baseline_commit: 'bf81c8a9e63daefdedd71b8a3e79e34fe1065990'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Aucune zone réservée à Jonathan n'existe : pas de rôle en base, pas de coquille admin, aucune écriture admin ne passe par un auteur vérifié, le numéro WhatsApp et le nom du site ne se règlent pas, et rien ne prouve que la base n'expose pas de fonction d'écriture ou de colonne privée.

**Approach:** Table `role_utilisateur` + `a_le_role` (AD-13), `src/lib/auth/droits.ts` (vérification serveur, matrice Admin/Assistant écrite et testée), auteur avec rôle (`auteur.ts`), coquille `/[locale]/admin` (404 pour un non-admin, connexion pour un visiteur) avec page Réglages (WhatsApp, nom du site) journalisée par le trigger `journaliser()`, fonction `corriger_age` réservée à l'admin, commande documentée pour le premier admin, deux tests SQL de garde (AD-3, AD-30).

## Boundaries & Constraints

**Always:** Migrations nouvelles seulement (aucune ancienne modifiée). Chaque fonction d'écriture : `SECURITY DEFINER`, `search_path = ''`, `p_auteur jsonb` en premier, `REVOKE` à `public/anon/authenticated`, `GRANT` à `service_role`, droit `admin` revérifié en base par `a_le_role` sur `p_auteur.id` (`KS_DROIT_REFUSE`), jamais `auth.uid()`. Les écritures de table métier posent `ks.auteur` (`set_config(..., true)`) avant le DML pour le trigger. `role_utilisateur(compte → auth.users on delete cascade, role ∈ admin|assistant|benevole, evenement uuid sans clé étrangère jusqu'à l'epic 7, valide_du, valide_au)`, RLS sans politique ni droit pour `anon`/`authenticated`, trigger `journaliser('compte')` ; `a_le_role(compte, role, evenement default null)` lisible par `anon`/`authenticated`, seule exception de lecture pure. `attribuer_role(p_auteur, p_compte, p_role, ...)` : auteur `compte` admin ou `systeme` (commande seulement). Premier admin : `npm run admin:attribuer -- <email>` (script lisant `SUPABASE_SECRET_KEY` de l'environnement, cherche le Compte par email via l'API admin, appelle `attribuer_role`, n'écrit aucun email ni identifiant dans le dépôt ; usage dans le README). `droits.ts` : refus par défaut ; `admin` a tout ; `assistant` a seulement les droits de FR-53 (commandes voir et changer le statut, mesures vérifier, galerie valider, blog gérer, événements gérer, remboursement préparer, activité propre) et aucun de ses interdits (produits et prix, codes promo et commissions, prestataires, chiffre d'affaires et graphiques de paiement, accès bénévoles, validation de remboursement, réglages, rôles) ; `benevole` n'a aucun droit admin ; aucun écran ne crée un Assistant. Accès : toute page `/admin` et chaque action appellent `droits.ts` (le layout ne suffit pas) ; non-admin connecté → `notFound()` ; visiteur → redirection vers `/connexion?retour=<chemin admin>` ; pages `noindex`. Coquille : barre latérale (`nav aria-label="Administration"`, entrée courante barre rouge 4 px) sur ordinateur, barre d'onglets fixe en bas (58 px) sur mobile, seulement l'entrée Réglages (`/admin` y redirige), ni Sakura Town ni motif manga ; l'en-tête et le pied du site restent. Réglages : clés `nom_site` (1 à 60 caractères, jamais vide) et `numero_whatsapp` (format international `+` et 8 à 15 chiffres, espaces retirés ; vide = effacé) ; `enregistrer_reglage(p_auteur, p_cle, p_valeur)` n'accepte que ces clés (`KS_REGLAGE_INCONNU`) ; Server Action : droit, Zod, rpc, puis `updateTag(ETIQUETTES.reglages)` ; le message de succès n'apparaît qu'après la réponse réelle ; valeur absente affichée « Valeur à fixer » (UX-DR44) ; aucune valeur de repli (règle 15). `corriger_age(p_auteur, p_compte, p_age, p_raison)` : admin, raison de 3 à 500 caractères (`KS_RAISON_MANQUANTE`), âge déjà déclaré (`KS_AGE_NON_DECLARE`), 0 à 120 ; journalise avant, après, raison, auteur (action `age_corrige`) ; sous 13 ans elle journalise puis renvoie `true` sans changer l'âge et le service supprime le Compte comme `declarer_age` ; sinon met `age_declare`/`age_declare_le`. Service TypeScript seulement, aucun écran ni route. Tests SQL de garde : toute fonction de `public` exécutable par `anon`/`authenticated` hors liste blanche (`a_le_role`) fait échouer ; toute colonne lisible par `anon` dont le nom contient `prive`, `chemin` ou `note_admin` fait échouer. Textes dans `messages/fr.json` et `en.json` (namespace `Admin`, `Metadata.admin`), tutoiement, sobre, ni argot ni emoji. Lint, types, tests et build verts.

**Never:** Pas de tableau de bord, de liste de commandes ni d'entrée de navigation vers une page absente ; pas d'écran de création d'Assistant ni de correction d'âge ; pas de lecture publique de `numero_whatsapp` (story 1.8) ; pas de message de contact (1.8) ; pas d'email ou d'identifiant de Compte dans une migration, un test ou la documentation ; pas de rôle lu depuis le navigateur ou les métadonnées de session ; aucun succès simulé hors tests `TEST_` ; je ne lance pas `npm run dev` ni `db:push`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Admin ouvre `/admin/reglages` | rôle `admin` | page Réglages, `noindex` | N/A |
| Client connecté sans rôle | `/admin/...` | 404 | N/A |
| Visiteur non connecté | `/admin/...` | redirection vers la connexion avec retour | N/A |
| Assistant | `/admin/...` ou action d'écriture | aucun écran admin au lancement : 404 ; `droits.ts` refuse hors FR-53 | `KS_DROIT_REFUSE` |
| Enregistrer un numéro valide | `+243 970 000 000` | enregistré, journalisé (numéro masqué), cache invalidé, succès affiché | N/A |
| Numéro ou nom invalide | `abc`, nom vide | erreur sous le champ, rien d'enregistré | erreur de validation |
| Échec serveur ou droit perdu | rpc refuse | message d'erreur, aucune réussite affichée, saisie conservée | `generique` / 404 |
| Écriture sans auteur | DML direct sur `reglage` | refusée par le trigger | `KS_AUTEUR_MANQUANT` |
| Correction d'âge | admin, raison, âge ≥ 13 | âge changé, journal avec raison | `KS_RAISON_MANQUANTE`, `KS_DROIT_REFUSE` |
| Correction sous 13 ans | admin, raison | journalisée, Compte supprimé | échec de suppression : erreur, âge inchangé |
| Premier admin | `npm run admin:attribuer -- <email>` | rôle posé, journalisé (auteur `systeme`) | email inconnu : message, code de sortie ≠ 0 |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261021140000_creer_reglage.sql` -- `journal_audit`, `journaliser()` (lit `ks.auteur`), `reglage` + trigger, politique de lecture `nom_site` ; ne pas modifier.
- `supabase/migrations/20261022160000_assurer_profil.sql` et `20261021160000_creer_profil.sql` -- modèle de fonction d'écriture et de `declarer_age` (journal direct) ; nouvelle migration `..._creer_roles_et_admin.sql` : `role_utilisateur`, `a_le_role`, `attribuer_role`, `enregistrer_reglage`, `corriger_age`.
- `supabase/tests/` -- modèle `definir_langue_profil.test.sql` ; nouveaux `roles.test.sql`, `reglage_admin.test.sql`, `corriger_age.test.sql`, `garde_ecritures.test.sql` (AD-3), `garde_colonnes_privees.test.sql` (AD-30).
- `src/lib/auth/auteur.ts` -- `Auteur` gagne `role` (`admin|assistant|benevole|null`) et le type `systeme` ; `construireAuteur` inchangé pour les Comptes simples.
- `src/lib/auth/compte.ts` -- `lireSessionVerifiee` à réutiliser ; `src/lib/auth/droits.ts` (nouveau) -- matrice des droits, `exigerDroit`, `exigerAdminPage`.
- `src/modules/admin/{actions,service,schemas,types}.ts` (nouveau) -- réglages et `corrigerAgeParAdmin` ; suivre `src/modules/comptes/` (dépendances injectées, faux `TEST_`).
- `src/app/[locale]/admin/{layout,page,reglages/page}.tsx` + composants `src/components/admin/` -- coquille, formulaire ; modèle de page de service : `connexion/page.tsx` (Suspense, `indexable: false`, `construireMetadata`).
- `src/lib/reglages.ts`, `src/lib/cache/etiquettes.ts` -- `updateTag(ETIQUETTES.reglages)` ; lecture admin par client service (jamais le cache public).
- `src/lib/supabase/types.ts` -- à compléter à la main au format du générateur ; `scripts/attribuer-admin.mjs`, `package.json` (`admin:attribuer`), `README.md`.
- `messages/{fr,en}.json` -- `Admin`, `Metadata.admin` ; `tests/unit/messages-parite.test.ts` impose la parité. `robots.ts` exclut déjà `/admin`.
- `tests/unit/`, `tests/e2e/` -- `droits`, service, actions, formulaire, coquille ; e2e : visiteur redirigé, client 404 si faisable sans simuler (sinon noté).

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/..._creer_roles_et_admin.sql` -- table, `a_le_role`, `attribuer_role`, `enregistrer_reglage`, `corriger_age`, droits -- AD-13, AD-21, AD-25
- [ ] `supabase/tests/*.test.sql` (cinq fichiers) -- rôles, journal avant/après et masquage, refus sans auteur, droits `service_role`, gardes AD-3 et AD-30 -- preuves CI
- [ ] `src/lib/auth/{auteur,droits}.ts` + `tests/unit/droits.test.ts` -- matrice Admin/Assistant exhaustive, refus par défaut -- AD-13, FR-53
- [ ] `src/modules/admin/*` + `src/lib/supabase/types.ts` -- réglages, correction d'âge, mapping d'erreurs sans donnée personnelle -- règle 3
- [ ] `src/app/[locale]/admin/**` + `src/components/admin/**` + `messages/*.json` -- coquille, Réglages, `noindex`, états -- UX-DR42, UX-DR44
- [ ] `scripts/attribuer-admin.mjs` + `package.json` + `README.md` -- commande du premier admin -- règle 4
- [ ] `tests/unit/*`, `tests/e2e/admin.spec.ts` -- matrice d'E/S, formulaire (succès seulement après réponse), axe sur la coquille accessible -- règle 13

**Acceptance Criteria:**
- Given un Compte sans rôle `admin`, when il ouvre `/fr/admin` ou `/en/admin/reglages`, then il voit la 404 ; un visiteur est envoyé vers la connexion avec retour
- Given un admin, when il enregistre son numéro WhatsApp ou le nom du site, then `reglage` est mis à jour, `journal_audit` porte l'auteur et les colonnes modifiées (numéro masqué), le cache `reglages` est invalidé et le succès n'apparaît qu'après
- Given la CI, when les tests SQL tournent, then une fonction d'écriture exécutable par `anon`/`authenticated` ou une colonne `prive`/`chemin`/`note_admin` lisible par `anon` fait échouer
- Given `lint`, `typecheck`, `test`, `build`, then tous passent ; `test:sql` en CI

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Câblage réel de `dependances()` jamais testé (tag, rpc, mapping `supprimer`) | medium | patch | aucun test n'importe `dependances.ts` |
| Priorité de rôle dans `lireRole` non testée (plusieurs rôles) | medium | patch | tests à rôle unique seulement |
| `lireReglagesAdmin` sans test (inversion de clés possible) | low | patch | petit test à client simulé |
| `attribuer_role` : rôle existant expiré ou futur, retour silencieux, `a_le_role` reste faux | medium | patch | migration non appliquée, modifiable ; mise à jour des dates |
| `FormulaireReglage` : `key` change, remontage, focus perdu après envoi | medium | patch | règle 7, navigation au clavier |
| Action : `dependances()` peut lever hors try, saisie perdue | low | patch | try/catch direct vers `generique` |
| `a_le_role` lisible par anon (sondage de rôles) | low | defer | exigé par la spec (AD-13, exception unique), garde SQL le prévoit ; à reconsidérer en 1.8 ou epic 7 |
| 404 / 307 réels sous Suspense (statut HTTP possible 200) | maybe-false (medium) | defer | à vérifier à la main (curl -I) ; même schéma que `/connexion` |
| Cascade `ks.auteur` : profondeur > 1 écrase l'auteur, réglage persistant dans la transaction | low | defer | `set_config` local à la transaction, effet limité aux suppressions de Compte |
| `corriger_age` < 13 : journal sans suppression si `deleteUser` échoue ; dernier admin supprimable | low | defer | comportement décidé par la spec, aucun écran ne l'appelle |
| Pas de `retirer_role` ni protection du dernier admin | low | defer | hors spec 1.7 |
| `invalider()` lève après l'écriture : message « non enregistré » | low | rejeté | `updateTag` ne lève pas en usage normal ; garde ajouterait de la complexité |
| Concurrence `attribuer_role` (23505) | low | rejeté | commande manuelle unique |
| Zod : 200 caractères → `generique`, points de code UTF-16 vs Postgres | low | rejeté | cas rares, correction non triviale |
| Script : email non confirmé, pagination `perPage`, confirmation masquée | low | rejeté | commande lancée par Jonathan sur son propre Compte |
| `?retour=` redirection ouverte | false | rejeté | `src/lib/auth/retour.ts` valide déjà le chemin (story 1.4) |
| Assistant / bénévole 404 partout | false | rejeté | voulu par la spec (aucun écran admin au lancement) |
| `corrigerAgeParAdmin` sans appelant | false | rejeté | exigé par la spec |
| Barre mobile : contenu derrière la barre | false | rejeté | le pied de page reçoit la marge, le contenu précède le pied |
| `as never`, `KS_REGLAGE_INCONNU` non mappé, rôle d'événement | low | rejeté | aucun effet constaté |

## Design Notes

Détails laissés au développeur (non visibles pour Jonathan) : nom des droits dans `droits.ts` (`commandes.voir`, `produits.modifier`, etc.), forme exacte du formulaire, nom des fichiers de test SQL.

L'en-tête et le pied du site restent autour de l'admin (le layout de langue les rend ; les retirer demanderait de scinder les groupes de routes). Le pied reçoit une marge basse pour la barre d'onglets mobile.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- expected: aucune erreur
- `npm run test:e2e` -- expected: connexion, Google et admin verts
- `npm run test:sql` -- expected: message explicatif en local ; vert en CI

**Manual checks (if no CLI):**
- `npm run db:push` sur `koma-dev` (à confirmer par Jonathan), `npm run admin:attribuer -- <ton email>`, puis `/fr/admin/reglages` : enregistrer un numéro, vérifier la ligne dans `journal_audit` ; avec un autre Compte : 404
