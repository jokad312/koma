---
title: 'Bug A1 : fusion du Panier impossible à la connexion'
type: 'bugfix'
created: '2026-11-22'
status: 'done'
baseline_commit: 'd879ee196ba7aa32747beb916629b3b53be1de47'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** À la connexion par code (journal du 2026-11-22, l. 113), `[panier] fusion du Panier impossible` : l'appel `fusionner_panier` répond 500. Cause relevée dans les journaux de koma-dev (07:17:19 UTC) : `55000 record "v_source" is not assigned yet`. Reproduite : la fonction plante chaque fois qu'elle reçoit `p_panier = null` (aucun Panier lisible dans le cookie), car le test `v_source_ok and v_source.compte_id = p_compte` lit le champ d'un enregistrement jamais rempli (PL/pgSQL n'arrête pas l'évaluation au premier `false`). Le test SQL qui couvre ce cas passe dans la CI (Postgres local), pas sur koma-dev. Le code attrape l'erreur sans en donner la cause.

**Approach:** Nouvelle migration qui redéfinit `fusionner_panier` sans jamais lire un enregistrement non rempli (identifiant et Compte du Panier source dans deux variables simples). Journaliser le code et le message de l'erreur Supabase (jamais les détails, l'email ni les identifiants). Prouver le parcours complet par un e2e : panier invité, connexion par code, articles conservés.

## Boundaries & Constraints

**Always:** comportement de la fusion inchangé (rattachement, réunion des lignes plafonnée à 10 et au stock, Kit déjà possédé retiré, Panier d'un autre Compte ignoré, verrou consultatif) ; la connexion n'est jamais bloquée par une fusion ratée ; données TEST_ supprimées et comptées à 0 en fin d'e2e.

**Never:** modifier une migration appliquée ; journaliser `details`, `hint`, l'email ou un identifiant ; envoyer un vrai code depuis koma-dev (l'e2e du code passe par la boîte de test Mailpit, comme `connexion.spec.ts`, et saute en local sans Mailpit).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Sans cookie | `p_panier` null, Compte sans Panier | `{panier_id: null}`, pas d'erreur | N/A |
| Sans cookie, Compte avec Panier | `p_panier` null | Panier du Compte renvoyé | N/A |
| Panier invité | cookie signé, 1 article | Panier rattaché au Compte, article visible dans /fr/panier | N/A |
| Échec Supabase | erreur RPC | `[panier] fusion du Panier impossible : code=… message=…` | connexion poursuivie |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261116100000_fusion_panier_correctifs.sql` -- définition actuelle de `fusionner_panier` (à recopier dans la nouvelle migration, sans toucher celle-ci).
- `src/modules/panier/dependances.ts:64-69` -- `fusionner` : renvoie `error.message` seul ; à faire renvoyer code + message.
- `src/modules/panier/service.ts:9-11, 218-231` -- `journaliser(contexte)` sans cause ; `fusionner`.
- `src/modules/comptes/service.ts:26-33` -- `catch` muet autour de `deps.fusionnerPanier` : y journaliser le nom de l'erreur.
- `supabase/tests/fusion_panier.test.sql:96` -- cas « sans cookie » déjà couvert (passe en CI) : ajouter le cas « sans cookie, Compte sans Panier ».
- `tests/e2e/connexion.spec.ts:5-30` -- `boiteJoignable`, `lireCode` (Mailpit) à réutiliser ; `tests/e2e/familles-vetement-autre.spec.ts:80-120` -- modèle de semis et nettoyage TEST_ (produit, variante, photo, comptage).

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/20270125100000_fusion_panier_sans_source.sql` -- `create or replace function public.fusionner_panier` : variables `v_source_id uuid`, `v_source_compte uuid` remplies par `select … into`, conditions écrites sur elles ; mêmes droits (`revoke`/`grant`) que l'original -- corrige le 55000.
- [ ] `supabase/tests/fusion_panier.test.sql` -- ajouter : `p_panier` null pour un Compte sans Panier renvoie `panier_id` null sans erreur -- garde-fou.
- [ ] `src/modules/panier/dependances.ts`, `src/modules/panier/service.ts` -- erreur `{ code, message }` ; journal `[panier] fusion du Panier impossible : code=55000 message=…` -- cause visible.
- [ ] `src/modules/comptes/service.ts` -- `catch (e)` journalise le nom de l'erreur -- plus de silence.
- [ ] `tests/unit/panier-service.test.ts` (ou le fichier existant du service panier) -- le journal contient code et message, jamais `details` ni email.
- [ ] `tests/e2e/panier-fusion.spec.ts` -- produit TEST_ publié ; visiteur : ajout au panier ; connexion par code (Mailpit) d'un Compte TEST_ neuf (âge, questions d'accueil si demandés) ; `/fr/panier` montre l'article ; second cas : connexion sans panier, aucune erreur ; nettoyage et comptage à 0.
- [ ] `npm run db:push` sur koma-dev, `npm run types` si les types changent, puis reproduction refaite (appel `p_panier` null : plus d'erreur).

**Acceptance Criteria:**
- Given koma-dev migré, when `fusionner_panier` est appelé avec `p_panier` null, then aucune erreur et le Panier du Compte (ou null) est renvoyé.
- Given un visiteur avec un article au panier, when il se connecte par code, then `/fr/panier` montre cet article et le journal ne contient pas « fusion du Panier impossible ».

## Implementation Notes

- Dérive koma-dev / CI (demande de Jonathan, en lecture seule) : AUCUNE. Postgres 17.11 des deux côtés (CI : image 17.11.0.004, koma-dev : 17.11.0.003), mêmes réglages plpgsql ; 134 migrations identiques (`supabase migration list --linked`) ; les 257 fonctions de `public` sur koma-dev ont exactement le corps de leur dernière migration (paiement, réservations et stock compris). Cause de l'écart : le cache des plans PL/pgSQL par session. Dans `fusion_panier.test.sql`, des appels précédents de la même session avaient préparé l'expression avec un `v_source` rempli, donc le cas `null` (l. 96) passait ; via PostgREST (session neuve, premier appel avec `null`) il échoue. Vérifié sur koma-dev dans une transaction annulée : `null` seul échoue, `null` après un appel qui remplit `v_source` passe.
- Recherche du même défaut dans les autres fonctions (enregistrement lu hors du bloc qui le remplit) : seul `fusionner_panier`. `ajouter_au_panier` remplit `v_ligne` dans ses deux branches.
- `npm run test:sql:linked` (nouveau, `scripts/test-sql-linked.mjs`) : lance un test pgTAP sur koma-dev dans une transaction annulée (pgTAP créé dans la transaction, `finish(true)` échoue au premier test raté ; vérifié avec un test faux exprès). `fusion_panier_quatre_cas.test.sql` : ÉCHEC sur koma-dev avant la migration (55000), OK après ; `fusion_panier.test.sql` OK.
- Migration appliquée sur koma-dev (`db push`). Types inchangés (même signature).
- L'e2e ne tourne qu'en CI (Mailpit) ; ses captures sont publiées par l'artefact `captures-e2e` (nouvelle étape `if: always()` de la CI). En local, le serveur de dev de Jonathan occupe le port 3000 : e2e non lancé.

## Spec Change Log

## Review Triage Log

Revue BMad du 2026-11-22 (adversarial, edge-case-hunter, verification-gap).

| Constat | Verdict | Suite |
|---|---|---|
| e2e « sans Panier » : appel préalable de fusionner_panier qui « réchauffe » la session ; l'e2e ne prouve pas la non-régression | high | rattachement par SQL direct ; garde dédiée `fusion_panier_premier_appel.test.sql` (seul appel de sa session) ; en-tête de l'e2e explicite |
| beforeAll sème sur koma-dev même sans Mailpit | high | rien n'est semé ni nettoyé sans Mailpit |
| test:sql:linked : commit/end/instructions avant begin non refusés ; détection trop large ; fichier illisible ; chemin sans guillemets | high | garde stricte (begin premier, rollback dernier, aucun commit/end), `not ok`/`ERROR:` seulement, lecture protégée, guillemets ; vérifié : test faux, commit et fichier absent → ÉCHEC |
| message Supabase pouvant citer une valeur ou contenir un saut de ligne ; code vide | medium | valeur après « : » masquée, sauts de ligne retirés, `?` si code vide ; test unitaire |
| cas « Panier d'un autre Compte » absent du fichier des 4 cas | medium | ajouté (2 tests) |
| nom du cookie en dur dans l'e2e | medium | constante `NOM_COOKIE_PANIER` ; présence du cookie vérifiée dans le 1er cas |
| afterAll : erreur de nettoyage masquée | low | erreur d'origine relancée après comptage |
| journal côté comptes : absence du message non vérifiée ; commentaire du service obsolète | low | assertion ajoutée ; commentaire mis à jour |
| captures publiques en artefact | low | en-tête masqué (`mask`) ; données TEST_ de la base locale de CI seulement |
| commentaire de la migration imprécis sur la cause | low | migration déjà appliquée sur koma-dev : non modifiée ; explication exacte dans `fusion_panier_premier_appel.test.sql` et ci-dessus |
| même défaut ailleurs ? | false | recherche faite (Implementation Notes) : seul fusionner_panier |
| listUsers limité à 1000 | low, gardé | même modèle que les autres e2e ; base de CI neuve |

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- sans erreur.
- `npm run test:sql` (CI) et `npm run test:e2e` (CI, Mailpit) -- verts.

**Manual checks:**
- En local : panier invité avec un article, connexion par code, l'article est toujours là ; aucun `[panier] fusion…` dans le terminal.
