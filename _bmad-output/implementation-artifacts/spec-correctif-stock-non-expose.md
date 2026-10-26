---
title: 'Correctif 2.1/2.3 : le public ne voit jamais le stock exact'
type: 'bugfix'
created: '2026-10-27'
status: 'done'
baseline_commit: '9502986c3b8c3d0ed472bb5b4d828531091ab249'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-2-3-reglages-de-remise-et-plafond-de-fabrication.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Décision de Jonathan : le public ne voit jamais le stock exact. Aujourd'hui `variante.stock` est lisible par `anon` et `authenticated` (SELECT public sur la table) et `stock_disponible(variante)` est exécutable par eux : n'importe qui peut lire les quantités par l'API.

**Approach:** Retirer aux rôles publics la lecture de la colonne `stock` et l'exécution de `stock_disponible`, faire passer toute la lecture publique par des fonctions qui ne renvoient qu'un état (`disponible`, `dernieres_pieces`, `sur_commande`, `epuise`, plus l'état de capacité `complet`), avec un seuil « dernières pièces » en constante nommée (3 par défaut), et prouver par un test pgTAP que `anon` et `authenticated` ne lisent pas le stock.

## Boundaries & Constraints

**Always:** Nouvelle migration seulement. `anon` et `authenticated` : `SELECT` sur `variante` limité aux colonnes `id, produit_id, taille, fabrication_sur_commande, delai_fabrication_jours, cree_le` (jamais `stock`) ; la politique de lecture des variantes d'un produit publié reste. `stock_disponible(uuid)` : plus exécutable par `public`, `anon`, `authenticated` ; réservée à `service_role` (et aux fonctions internes) ; elle reste l'unique point que l'epic 4 remplacera par `create or replace`. Le seuil : fonction `seuil_dernieres_pieces()` (immutable, vaut 3) comme unique source SQL, plus une constante TypeScript nommée `SEUIL_DERNIERES_PIECES = 3` dans le module catalogue (documentée comme miroir, avec un test qui la compare à la base lorsque c'est possible ou à la valeur documentée).
États par variante : `disponible` (stock disponible > seuil), `dernieres_pieces` (de 1 au seuil inclus), `sur_commande` (aucun stock mais fabrication sur commande permise et capacité non atteinte), `complet` (fabrication permise mais capacité atteinte : message « Commandes complètes pour le moment »), `epuise` (aucun stock et pas de fabrication). État d'un produit : le meilleur de ses variantes (`disponible` > `dernieres_pieces` > `sur_commande` > `complet` > `epuise`). Remplace les états `en_stock` et `indisponible` de la 2.4/2.5 : le filtre d'adresse `dispo=en_stock` reste (il couvre `disponible` et `dernieres_pieces`), `dispo=sur_commande` inchangé.
`lister_catalogue` et `disponibilite_variantes` : passent en `security definer` (`search_path = ''`, lecture pure) avec le prédicat « publié et passé » écrit explicitement (déjà le cas) pour pouvoir appeler les fonctions internes sans donner la quantité aux rôles publics ; elles ne renvoient jamais de quantité. Les fonctions internes d'état ne sont exécutables que par `service_role`/propriétaire ; la liste blanche de `garde_ecritures.test.sql` perd `stock_disponible` et garde les fonctions publiques qui ne renvoient pas de stock.
Interface : badges et sélecteur de taille affichent « En stock » (`disponible`), « Dernières pièces » (`dernieres_pieces`, sans quantité), « Fabrication sur commande » (`sur_commande`), « Commandes complètes pour le moment » (`complet`) et « Épuisé » (`epuise`) ; la fiche, le catalogue, l'accueil, le JSON-LD (`InStock` pour `disponible` et `dernieres_pieces`, `MadeToOrder`, `OutOfStock` pour `complet` et `epuise`) et le filtre de disponibilité suivent. L'admin lit toujours le stock exact par le client service (formulaire de produit inchangé). Aucune quantité n'apparaît côté public ni dans la réponse d'une route publique.
Tests : pgTAP prouvant que `anon` et `authenticated` n'ont pas le privilège `select` sur `variante.stock` (`has_column_privilege`), que `select stock from variante` et `select * from variante` échouent pour eux (permission refusée), qu'ils n'ont pas `execute` sur `stock_disponible`, que `service_role` la lit, que les états sont corrects aux bornes (0, 1, seuil, seuil + 1, fabrication, capacité atteinte) et que `lister_catalogue` et `disponibilite_variantes` ne renvoient aucune colonne de quantité ; mise à jour des tests SQL existants qui appelaient `stock_disponible` comme `anon` ; tests Vitest des états, badges, fiche, filtres et JSON-LD ; vérification finale réelle, en lecture seule, de l'API de koma-dev avec la clé publique (la lecture de `variante?select=stock` et l'appel de `rpc/stock_disponible` sont refusés).

**Never:** Aucune quantité exposée, ni « plus que N », ni compteur ; pas de modification de l'admin ; pas de commande ni de réservation (epic 4) ; pas de modification d'une migration appliquée ; pas de `npm run dev`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Lire le stock par l'API | `anon` ou `authenticated`, `variante?select=stock` | refusé (permission) | 401/403 |
| Lire sans colonne | `variante?select=taille,fabrication_sur_commande` | autorisé pour un produit publié | N/A |
| `stock_disponible` par l'API | `anon`/`authenticated` | refusé | permission refusée |
| Stock 12 | variante | `disponible` | N/A |
| Stock 3 (seuil) | variante | `dernieres_pieces` | N/A |
| Stock 4 | variante | `disponible` | N/A |
| Stock 0, fabrication permise | capacité libre | `sur_commande` | N/A |
| Stock 0, fabrication permise | capacité atteinte | `complet` | N/A |
| Stock 0, pas de fabrication | variante | `epuise` | N/A |
| Admin | client service | lit le stock exact comme avant | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261023100000_creer_catalogue_physique.sql` (`variante`, politique de lecture, droits), `20261025100000_reglages_remise_et_disponibilite.sql` (`stock_disponible`), `20261026100000_listage_catalogue.sql` (`lister_catalogue`, `capacite_fabrication_atteinte`), `20261027100000_disponibilite_variantes.sql` (`disponibilite_variantes`) : à reprendre en `create or replace` dans une NOUVELLE migration `supabase/migrations/20261029100000_stock_non_expose.sql`, sans modifier les anciennes. Tests : nouveau `supabase/tests/stock_non_expose.test.sql` ; adapter `reglages_remise.test.sql`, `listage_catalogue.test.sql`, `disponibilite_variantes.test.sql`, `catalogue.test.sql` (s'il lit `stock` en `anon`), `garde_ecritures.test.sql`.
- `src/modules/catalogue/{types,queries,fiche}.ts` (`Disponibilite`, `DISPONIBILITES`, états), `src/components/catalogue/{BadgeDisponibilite,FiltresCatalogue}.tsx`, `src/components/fiche/{SelecteurTaille,ZoneAchat}.tsx`, `src/lib/seo/jsonld.ts`, `src/modules/accueil/*`, `messages/{fr,en}.json` (`Catalogue.disponibilite.*`, `Fiche.tailles.*`), `src/lib/supabase/types.ts` (régénéré après le push), `tests/unit/*` concernés, `tests/doubles/*`.
- `_bmad-output/implementation-artifacts/deferred-work.md` : marquer traités les constats « stock exact lisible par `anon` » (2.1 et 2.3).

## Tasks & Acceptance

**Execution:**
- [ ] Migration : droits par colonne, `stock_disponible` réservée, `seuil_dernieres_pieces`, états, `lister_catalogue` et `disponibilite_variantes` en `security definer`
- [ ] Tests pgTAP `stock_non_expose.test.sql` et adaptation des tests SQL existants
- [ ] TypeScript : états, badge « Dernières pièces » / « Épuisé », fiche, filtre, JSON-LD, messages FR/EN, tests
- [ ] `db:push` sur koma-dev après la revue, `npm run types`, puis vérification en lecture seule de l'API avec la clé publique

**Acceptance Criteria:**
- Given `anon` ou `authenticated`, when il lit `variante.stock` ou appelle `stock_disponible`, then c'est refusé (test pgTAP) et aucune réponse publique ne contient de quantité
- Given une variante, then son état public est `disponible`, `dernieres_pieces` (seuil 3 par défaut, constante nommée), `sur_commande`, `complet` ou `epuise` selon les bornes de la matrice
- Given le catalogue, la fiche et l'accueil, then badges, sélecteur, filtres et JSON-LD suivent ces états sans quantité
- Given l'admin, then le stock exact reste lisible et modifiable par le client service
- Given `lint`, `typecheck`, `test`, `build`, then tous passent ; `test:sql` en CI

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Realtime ignore les droits par colonne : `variante` pourrait être publiée | medium | patch | publication à vérifier et retirer |
| Preuve limitée à `variante.stock` : autres colonnes de quantité, `journal_audit`, privilèges insert/update/references, requêtes « oracle » (`where stock > 5`, `order by stock`) | medium | patch | tests SQL ajoutés |
| Visibilité des fonctions `security definer` à comparer à celle de `produit` pour `anon` | medium | patch | prédicat dupliqué |
| Comptes absolus du test SQL dépendant des données ; cas `dernieres_pieces` + capacité atteinte non prouvé | low | patch | test |
| Garde TypeScript du seuil limité à une migration ; gardes statiques fragiles | low | patch | test |
| `libelleEtat` : un état `complet`/`epuise` s'afficherait « Fabrication sur commande » | medium | patch | exhaustivité |
| Sondage répété révélant le passage du stock à 3 ; coût de l'état calculé avant LIMIT | low | defer | inhérent aux « dernières pièces » ; mesure déjà notée en 2.4 |
| Changement de `gabarit.spec.ts` hors périmètre | low | rejeté | correction d'un test instable, commit séparé |
| Produit sans variante, limitation de débit, contraste de l'icône, dates de la spec | low | rejeté | non publiable sans variante ; hors périmètre |

## Design Notes

Choix du développeur : l'état de capacité `complet` reste distinct de `epuise` parce que le message « Commandes complètes pour le moment » est exigé par l'epic (jamais « Épuisé » pour le Plafond) ; « Épuisé » ne s'affiche que pour un manque de stock sans fabrication possible ; `lister_catalogue` et `disponibilite_variantes` deviennent `security definer` car les rôles publics ne peuvent plus lire le stock ; le prédicat « publié et passé » y est explicite.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur
- `npm run test:sql` -- CI

**Manual checks:**
- Publier un produit à 2 pièces et un autre à 10 : badge « Dernières pièces » puis « En stock » ; vérifier que l'API publique ne renvoie aucun stock.
