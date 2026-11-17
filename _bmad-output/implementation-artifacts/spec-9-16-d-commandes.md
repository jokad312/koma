---
title: '9.16 d) — Étape 4, page 2 : liste des commandes selon la maquette'
type: 'feature'
created: '2026-11-17'
status: 'done'
baseline_commit: '047cf767a2d2980bd41b2e4a3cbbcf33710c03da'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/docs/design/admin/INVENTAIRE.md'
  - '{project-root}/docs/design/admin/DECISIONS-NUIT.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-9-16-c-tableau-de-bord.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `/admin/commandes` garde la liste de la 6.2 (filtres en listes déroulantes, « Voir plus » par 12, sans client ni recherche) alors que la maquette `docs/references/maquettes-admin/02-commandes.png` (B1 à B11 d'INVENTAIRE.md) montre 4 cartes de chiffres, une recherche, des filtres en pastilles, une colonne Client et une pagination ‹ ›.

**Approach:** Redessiner la liste avec les composants de `src/components/admin/ui/` et ajouter les lectures autorisées par Jonathan (Q14 cartes, Q15 recherche, Q17 colonne Client, Q16 pastilles, Q18 pagination) par une nouvelle fonction SQL de lecture. Consigne de la nuit (2026-11-17) : pas de validation intermédiaire, choix notés dans DECISIONS-NUIT.md.

## Boundaries & Constraints

**Always :**
- Droits inchangés : la page reste ouverte à l'Admin et à l'Assistant (`commandes.voir`). La carte REVENU PAYÉ n'est rendue que pour qui a `chiffre_affaires.voir` (Admin) ; l'Assistant voit les 3 autres cartes.
- Cartes, toutes « depuis le début », mêmes règles que le tableau de bord (spec 9.16 c, décision 1) : REVENU PAYÉ = REVENU TOTAL du tableau ; COMMANDES AU TOTAL = commandes payées hors annulées et remboursées ; PAIEMENTS ABOUTIS (coche) = nombre de tentatives réussies ; EN ATTENTE (horloge) = commandes en attente de paiement non expirées.
- Recherche (B4) : par numéro (partiel, sans tenir compte de la casse) ou par client (nom des métadonnées de connexion ou email). La recherche sur l'email se fait en base ; l'écran n'affiche jamais un email complet (masqué comme `lister_utilisateurs_admin`).
- Colonne CLIENT (B7) : `AvatarInitiale` + nom, sinon email masqué ; jamais de nom inventé.
- Pastilles (B5, `PastilleFiltre`) : TOUTES, PAYÉES, ÉCHOUÉES, EN ATTENTE, REMBOURSÉES, mêmes règles que le filtre Statut actuel (en attente et échouée non expirées). Les autres statuts, Famille, Prestataire et Zone de remise restent, en listes déroulantes du même style. Filtres, recherche et page dans l'adresse (formulaire GET, fonctionne sans JavaScript), valeurs contrôlées contre des listes fermées.
- Colonnes : N° COMMANDE (lien vers le détail), CLIENT, DATE, PAIEMENT (prestataire, « Offerte » pour une commande offerte), MONTANT, STATUT (`PastilleStatut`), plus REMISE gardée (B11). Sous 1024 px : cartes, sans défilement horizontal à 390 px.
- Pagination ‹ › de 20 lignes, « page X / Y » (`Pagination`), au lieu de « Voir plus ».
- Nouvelle fonction `security definer`, `exiger_personnel(p_auteur)` (le revenu reste dans `tableau_chiffres`, Admin), exécutable par `service_role` seulement, test SQL ; nouvelle migration, koma-dev seulement, notée dans DECISIONS-NUIT.md.

**Never :** pas de changement de la page de détail (étape 8) ; pas d'écriture ; pas de changement de rôle, de RLS ni du paiement ; aucune donnée personnelle au-delà du nom et de l'email masqué.

</frozen-after-approval>

## Code Map

- `src/app/[locale]/admin/commandes/page.tsx` -- droit `commandes.voir`, lecture des filtres (`filtreValide`), paramètre `n` (à remplacer par `page`). Lire aussi le droit `chiffre_affaires.voir` sans redirection (voir `src/lib/auth/droits.ts` et `matrice-droits.ts`) pour la carte de revenu.
- `src/modules/commande/admin-queries.ts` -- `listerCommandesAdmin`, `STATUTS_FILTRE`, `statutEffectif` (dans `./queries`) : la logique d'expiration (en attente / échouée dont `expire_le` est passé = expirée) doit rester identique dans la nouvelle fonction SQL.
- `src/components/admin/ListeCommandesAdmin.tsx` (116 lignes) -- liste actuelle, à refaire.
- `src/components/admin/ui/` -- `CarteChiffre`, `Panneau`, `ChampRecherche`, `PastilleFiltre`, `EnTeteTableau`, `Pagination`, `AvatarInitiale`. `src/components/admin/PastilleStatut.tsx` pour le statut.
- `supabase/migrations/20270116100000_utilisateurs_admin.sql` -- modèle (nom depuis `raw_user_meta_data`, email masqué en base). Fonctions `exiger_personnel`, `tableau_chiffres` (page 1). Nouvelle migration `20270121100000_commandes_admin_liste.sql` + `supabase/tests/commandes_admin_liste.test.sql`.
- `messages/*.json` -- `Admin.commandes.*`.
- Tests : `tests/unit/commande-revue-epic6-ui.test.tsx`, `commande-ui.test.tsx` (vérifier ce qui cible la liste admin), `tests/e2e/` (grep `admin/commandes`). `scripts/captures-admin.mjs` pour les captures dans `docs/captures-admin/9-16-d/`.

## Tasks & Acceptance

**Execution :**
- [x] Migration + test SQL -- liste filtrée, recherchée et paginée avec client, total, et chiffres des cartes (sans revenu).
- [x] `src/lib/supabase/types.ts` -- régénéré (`npm run types` après `npm run db:push`).
- [x] `admin-queries.ts` (+ tests) -- lecture par la fonction ; filtres et page contrôlés.
- [x] `page.tsx`, `ListeCommandesAdmin.tsx` -- mise en page B1 à B11 ; cartes selon le droit.
- [x] `messages/*.json` -- FR et EN.
- [x] Tests unitaires (pastille active `aria-pressed`, pagination, client sans nom, carte de revenu absente pour l'Assistant) et e2e mis à jour.
- [x] Captures 1366 × 768 sombre (côte à côte + superposées 50 %), clair, 390 px ; Comptes et données TEST_ supprimés.

**Acceptance Criteria :**
- Given un Admin à 1366 × 768 en sombre, then titre, 4 cartes, recherche, pastilles, tableau et pagination occupent les places de la maquette.
- Given une recherche « ks-2026-0001 » ou une partie d'email, then seules les commandes correspondantes s'affichent, avec l'email masqué.
- Given un Assistant, then 3 cartes (pas de revenu) et la même liste.
- Given 45 commandes filtrées, then 3 pages, « page 1 / 3 », ‹ désactivé sur la première.

## Verification

**Commands :**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` -- tous à 0 ; `npm run test:sql` en CI.

## Implementation Notes

- Migration `20270121100000_commandes_admin_liste.sql` appliquée sur koma-dev (`supabase db push`) ; `commandes_admin_liste.test.sql` (26 assertions) exécuté sur koma-dev avant l'application, dans une transaction annulée (pgTAP créé puis annulé), tout vert. Types régénérés.
- `admin-queries.ts` : `TAILLE_PAGE_ADMIN` 12 → 20 ; `listerCommandesAdmin(auteur, filtres, page)` lit la fonction (statut effectif « expirée » toujours calculé par `statutEffectif`) ; page au-delà de la dernière → dernière page relue ; `lireRevenuPaye` (tableau_chiffres, appelée seulement avec `chiffre_affaires.voir`, null si illisible) ; `pageValide`, `rechercheValide` (100 caractères), `STATUTS_PASTILLES`. Le paramètre `n` (« Voir plus ») est remplacé par `page`.
- `ListeCommandesAdmin.tsx` : cartes (3 pour l'Assistant), `Panneau`, `ChampRecherche` relié au formulaire GET par l'attribut `form`, pastilles en liens (`aria-current`), listes déroulantes Statut / Famille / Prestataire / Zone, tableau à partir de 1024 px (cartes en dessous), `Pagination`. Formulaire et champ de recherche recréés (clé) quand les filtres changent : sinon, après un clic sur une pastille (navigation côté client), « Filtrer » renvoyait l'ancien statut vide (trouvé par l'e2e).
- Écarts notés dans DECISIONS-NUIT.md : statut en `Pastille` (pas `PastilleStatut`, dont les icônes publié / brouillon seraient fausses) ; pastilles `aria-current` (liens) au lieu de `aria-pressed` ; liste déroulante Statut gardée avec les 10 statuts.
- Captures (après revue des premières) : la carte REVENU PAYÉ écrit toujours son montant en t-h3 (« 0,00 $US » en t-h2 débordait de la carte de 255 px) ; à partir de 1280 px, recherche et 5 pastilles sur une ligne (la recherche rétrécit). `scripts/captures-admin.mjs` : les captures clair 1366 / 390 px sont faites pour chaque vue de `CAPTURES_VUES` (avant : tableau de bord seulement). Sortie `docs/captures-admin/9-16-d/` (ignoré par Git) ; aucun débordement de 320 à 1440 px ; Comptes TEST_ restants : 0. koma-dev n'a aucune Commande : le tableau rempli n'est pas capturé (couvert par les tests unitaires).
- Vérifications : lint, typecheck, `npm test` (3459), build à 0 ; `npm run test:e2e` complet : 237 réussis, 1 échec sans lien (`accueils.spec.ts`, `/fr/cosplays` en 500 sur le serveur de dev, réussi à la relance) ; `admin.spec.ts` relancé après les derniers changements : 19 réussis.
- Correctifs de revue : migration `20270121110000_commandes_admin_liste_correctifs.sql` (appliquée sur koma-dev) : email cherché seulement en entier, email d'un caractère masqué, `name` repris si `full_name` est vide, en attente sans échéance = non expirée ; test SQL porté à 33 assertions (prestataire, zone, valeurs hors liste), vert sur koma-dev. `lireRevenuPaye` journalise l'échec, la page ajoute `.catch(() => null)` ; `rechercheValide` coupe par caractère ; chiffres des cartes avec `Intl.NumberFormat` ; e2e : montant « $US » sur la carte du revenu, `?q=KS-TEST&page=2` lu.
- Clé `Admin.commandes.voirPlus` et colonnes `prestataire` / `total` retirées (plus utilisées) ; nouvelles clés `recherche`, `pastilles`, `chiffres`, `clientAbsent`, colonnes de la maquette.

## Spec Change Log

## Review Triage Log

| # | Relecteur | Constat | Verdict | Preuve / route |
|---|---|---|---|---|
| 1 | Blind + Edge | Recherche `ilike` sur l'email complet : adresse masquée reconstituable | medium | Assistant peut tester des fragments ; patch (email exact seulement, nouvelle migration) |
| 2 | Blind | Email à 1 caractère avant « @ » → « Client non renseigné » | low | Branche `< 2 → null` ; patch |
| 3 | Edge | `full_name` vide masque `name` | low | coalesce avant nullif ; patch |
| 4 | Blind + Edge | `expire_le` NULL : commande absente des filtres En attente / Expirée | low | Colonne nullable ; patch (aligné sur `statutEffectif`) |
| 5 | Blind + Edge + VerifGap | « Commandes au total » = payées | false | Décision 1 de Jonathan (option a), même définition que le tableau de bord |
| 6 | Blind | Pastille « Payées » ≠ chiffre de la carte | low | Rejeté : la carte compte les payées « depuis le début » quel que soit l'avancement ; libellés distincts |
| 7 | Blind | `lireRevenuPaye` sans journal | low | Patch (`console.error`) |
| 8 | Edge | Exception du revenu masque la liste | low | Patch (`.catch`) |
| 9 | Blind | Comptes recalculés à chaque page | low | Rejeté : volume actuel faible, pas de défaut observé |
| 10 | Blind + VerifGap | Filtres prestataire / zone non testés en SQL | medium | Patch (test SQL) |
| 11 | Blind | Cas unitaires et e2e manquants (page>1 sans résultat, client sans rôle, EN) | low | Rejeté : garde d'accès déjà testée ailleurs ; reste cosmétique |
| 12 | Blind | Chiffres des cartes sans séparateur de milliers | low | Patch (`Intl.NumberFormat`) |
| 13 | Blind | Paramètres vides dans l'adresse | low | Rejeté : sans effet fonctionnel |
| 14 | Blind | Revenu « depuis le début » non vérifié | false | `tableau_chiffres.revenu_cents` sans borne de date (migrations 20270120100000/110000, test SQL) |
| 15 | Blind | « En attente » en double (carte et pastille) | low | Rejeté : régions distinctes, nom accessible par région |
| 16 | Edge | Coupe de la recherche au milieu d'un emoji | low | Patch (coupe par caractères) |
| 17 | Edge | Statut inconnu supprimé sans trace | false | Contrainte `check` sur `commande.statut` |
| 18 | Edge | Ligne RPC mal typée non validée | low | Rejeté : types générés, forme fixée par la fonction |
| 19 | Edge | `aria-pressed` annoncé par la spec, `aria-current` codé | false | Écart volontaire noté dans DECISIONS-NUIT.md (liens GET sans JavaScript) |
| 20 | VerifGap | Lecture de `q` et `page` par la page non vérifiée | medium | Patch (e2e : champ pré-rempli, pagination) |
| 21 | VerifGap | Carte revenu « Illisible » non détectée par l'e2e | medium | Patch (e2e : montant attendu) |
