---
title: 'Story 9.7 : Mesure d''audience maison'
type: 'feature'
created: '2026-11-10'
status: 'draft'
route: 'dispatch'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** Jonathan ne sait pas d'où viennent ses visiteurs ni où ils décrochent ; il veut le savoir sans les pister (FR-54).

**Approche (décision de Jonathan du 2026-11-10, qui remplace l'essai Umami) :** mesure **maison**, exactement comme `epics.md` (story 9.7) et AD-19. Aucun outil externe, aucun script tiers, aucune modification de la CSP. Une table `evenement_mesure` reçoit des actions d'interface par `POST /api/mesure` ; les indicateurs de vente, de paiement, de livraison et de Code promo sont des vues SQL sur les tables métier ; l'entonnoir se calcule en comptes agrégés par jour et par étape, sans jamais joindre une session à une Commande.

## Boundaries & Constraints

**Toujours :**
- Aucune donnée personnelle stockée : ni IP en clair, ni email, ni identifiant de Compte, ni numéro de Commande, ni chaîne de requête (jetons, `?curseur`, `?c`/`?s` de désinscription, `?retour`). Seuls : le **chemin** sans paramètres, le **référent réduit à son domaine**, la **langue** (`fr`/`en`), le **type d'appareil**, un **nom d'événement pris dans une liste fermée**, l'**origine** normalisée (valeur d'un paramètre `origine` ou `utm_source`, jamais l'adresse), l'heure et un **identifiant de session aléatoire** (`crypto.randomUUID()` en `sessionStorage`). L'identifiant de session vient de l'epic 9.7 ; il est aléatoire, propre à un onglet et jamais relié à un Compte.
- Aucun envoi depuis `/admin`, `/compte`, `/connexion` (et l'administration des mots de passe), `/commande`, `/checkout` (prévu, pas encore créé), `/desinscription` : garde côté client **et** côté serveur, comparaison par segment entier (donc `/administration` n'est pas exclu par `/admin`).
- `POST /api/mesure` seulement : `Content-Type: application/json` exigé, corps ≤ 1 024 octets, Zod `.strict()` (tout champ inconnu → 400), limitation de débit par session et par empreinte d'IP (AD-22, `consommer_essai`), réponses sans détail, `Cache-Control: no-store`.
- Table `evenement_mesure` : RLS active, **aucune politique**, aucun droit pour `public`, `anon`, `authenticated` ; écriture uniquement par une fonction `security definer` appelée par `service_role` (AD-25). Écritures visiteur avec `AUTEUR_VISITEUR` (`{"type":"visiteur"}`), jamais un Compte.
- Vues SQL en lecture `service_role` seule (`revoke` pour `anon`/`authenticated`) : chaque vue est un agrégat, jamais une ligne nominative.
- Migration strictement postérieure à la dernière de `origin/main` ; aucune migration existante modifiée.
- Aucun texte visible nouveau. La phrase de confidentialité reste une **proposition** dans `voie-3-notes.md`, jamais dans `messages/`.

**À demander avant :**
- **Durée de chargement du héros** (FR-54 : « chargement du héros (durée) ») : impossible avec la liste de colonnes ci-dessus. Sans accord explicite pour une colonne `duree_ms`, la story enregistre seulement l'événement `chargement_heros` (le héros a été chargé), pas sa durée. **Proposition par défaut : ne pas ajouter la colonne.**
- **Empreinte d'IP pour la limitation de débit** : seul moyen efficace de freiner un visiteur qui invente des identifiants de session. Comme le formulaire de contact (story 1.8), la clé est un **HMAC** de l'IP (`SUPABASE_SECRET_KEY`), rangée dans `limite_essai` (compteurs techniques), jamais dans `evenement_mesure`, jamais en clair, jamais journalisée. Si Jonathan refuse, repli sur la limite par session seule + plafond global (protection plus faible).
- **Actions situées dans l'espace privé** (voir « Écarts bloqués ») : photo et Réalisation envoyées, Kit gratuit récupéré côté bibliothèque, Vidéo de kit démarrée et terminée se passent sous `/compte`, exclu par la consigne. **Proposition par défaut : ne pas les mesurer en 9.7** et les noter pour un arbitrage (dérogation limitée à ces événements, sans aucune donnée de Compte, ou report).

**Jamais :**
- Modifier `.env.example`, `.env.local`, `src/lib/supabase/types.ts`, `sprint-status.yaml`, `journal-enchainement.md`, `CLAUDE.md`, `epics.md`, la CSP.
- Toucher à l'authentification, à la Commande, au Panier, aux paiements, aux accès aux kits : la route **lit** `evenement_mesure` et **écrit** une ligne par événement, rien d'autre.
- Lire un cookie, une adresse IP pour la stocker, le `User-Agent` brut, `navigator.platform`, ou toute empreinte d'appareil. La largeur d'écran ne sert qu'à choisir `mobile`/`tablette`/`ordinateur` localement.
- Pousser, fusionner, rebaser sur `main`, écrire dans Supabase (`db:push` interdit).
- Simuler une visite, un paiement ou un événement pour « faire marcher » la mesure (règle 13).

## Écarts bloqués (impossibles sans sortir du périmètre)

| Action de FR-54 / story 9.7 | Pourquoi | Suite |
|---|---|---|
| Création de Compte à l'étape de paiement, abandon à cette étape | touche l'authentification et le paiement (voie 1) | noté, non traité |
| Inscription à une Alerte événement | epic 7 absent (aucune table `alerte`) | noté, non traité |
| Pass vendus | epic 7 absent (aucune table `pass`) | noté, non traité |
| Livraisons en retard | aucun délai promis n'est stocké (SM-C1 : fabrication + livraison par ville) | noté, non traité |
| Photo et Réalisation envoyées, Kit gratuit récupéré côté bibliothèque, Vidéo de kit démarrée et terminée | se passent sous `/compte`, exclu par la consigne | noté, arbitrage demandé |

## Décisions proposées (à valider au plan)

- **Migration** `supabase/migrations/20270101100000_mesure.sql` (dernière de `origin/main` : `20261231210000_emails_cibles_correctifs.sql`).
- **Table `evenement_mesure`** : `id bigint generated always as identity`, `action text` (liste fermée par `check`), `page text` (1 à 200, commence par `/`, sans `?`, `#`, espace ni caractère de contrôle), `origine text null` (`^[a-z0-9_-]{1,40}$`, même forme que `commande.origine`), `referent_domaine text null` (`^[a-z0-9.-]{1,100}$`), `langue text` (`fr`/`en`), `appareil text` (`mobile`/`tablette`/`ordinateur`/`inconnu`), `session_id uuid`, `cree_le timestamptz default now()`. Index `(cree_le)` et `(action, cree_le)`.
- **Liste fermée d'actions** (une seule source TypeScript et le `check` SQL) : `clic_heros`, `chargement_heros`, `vue_fiche`, `ajout_panier`, `partage_fiche`, `kit_gratuit_recupere`. Toute autre valeur est refusée par Zod **et** par la base.
- **Chemin** : stocké **sans préfixe de langue** (`/cosplays/mon-slug`), la langue étant une colonne à part. Le slug anglais peut différer du français (`/accessoires` ↔ `/accessories`) : c'est voulu, la colonne `langue` désambiguïse.
- **Origine** : lue une fois par onglet au premier chargement (`?origine=` prioritaire, sinon `utm_source`), normalisée en minuscules, gardée seulement si elle correspond à `^[a-z0-9_-]{1,40}$`, rangée en `sessionStorage` avec l'identifiant de session. L'adresse complète ne quitte jamais le navigateur.
- **Serveur, garde de page** : le chemin est **recalculé côté serveur** depuis l'en-tête `Referer` (même origine) quand il est présent — on n'en garde que `pathname`, jamais la requête — sinon depuis le champ `page` validé. Le chemin obtenu est dé-exclu : page exclue → **204 sans écriture**. Un client bricolé ne peut donc pas écrire une page interdite.
- **Limites** (AD-22, `consommer_essai`) : 300 événements par session et par heure ; 1 200 par empreinte d'IP et par heure (large, car les opérateurs mobiles et les cybercafés partagent une adresse). Session vérifiée d'abord, IP ensuite.
- **Pas de journalisation** de `evenement_mesure` : ce n'est pas une table métier (aucun état, aucun droit admin, aucune donnée personnelle) et un déclencheur `journaliser()` par vue de page noierait `journal_audit`. Divergence assumée avec AD-21, à acter.
- **Vues** (toutes `service_role` uniquement) :
  1. `vue_visites_jour` : jour × action × langue × appareil (nombre d'événements, sessions distinctes).
  2. `vue_origines_jour` : jour × origine × action (sessions distinctes) — d'où viennent les visiteurs.
  3. `vue_entonnoir_jour` : jour × étape (fiches vues, paniers touchés, commandes créées, payées, livrées) en comptes agrégés, **sans jointure** session ↔ Commande.
  4. `vue_paiements_jour` : jour × Prestataire × statut de `tentative_paiement`.
  5. `vue_ventes_code_promo` : Code × Commandes payées × montant, depuis `commande_code_promo` et `commande`.
  6. `vue_ventes_origine` : origine × Commandes payées × montant, depuis `commande.origine`.
  7. `vue_deuxiemes_achats` : Comptes ayant au moins deux Commandes payées sur la période.
  8. `vue_desinscriptions_jour` : désinscriptions par jour (`desinscription`).
- **Client** : un seul module `src/modules/mesure/client.ts` (fonctions `demarrerMesure`, `mesurer`) appelé par les composants clients qui connaissent le **résultat réel** de l'action (succès du serveur, jamais un simple clic quand le succès est incertain). Les clics purs (bouton du héros) passent par `data-mesure` et une délégation d'événements au niveau du layout, pour ne pas convertir des composants serveur en composants clients.
- **Aucune donnée publiée** : ni page admin, ni graphique, ni export dans cette story (c'est la 9.8).

## I/O & Edge-Case Matrix

| Cas | Entrée | Attendu | Vérification |
|---|---|---|---|
| Événement valide | action de la liste, page publique, langue, appareil, session uuid | 204, une ligne écrite | pgTAP + Vitest route |
| Action inconnue | `action: "achat"` | 400, aucune écriture | Vitest |
| Champ inconnu | `{ …, email: "a@b.c" }` | 400, aucune écriture (Zod strict) | Vitest |
| Chaîne de requête dans `page` | `/cosplays/x?c=secret` | 400, aucune écriture | Vitest |
| Numéro de Commande | `/commande/KS-2026-000001` | 204 **sans écriture** (page exclue) | Vitest |
| Page admin | `/admin/commandes`, `/fr/admin/…` via Referer | 204 sans écriture | Vitest |
| Préfixe trompeur | `/administration`, `/comptes`, `/commandes` | mesuré (comparaison par segment) | test unitaire |
| Corps trop gros | 2 000 octets | 413, aucune écriture | Vitest |
| Type de contenu | `text/plain` | 415, aucune écriture | Vitest |
| Méthode | GET, PUT | 405 | Vitest |
| Débit dépassé | 301e événement de la session en une heure | 429, aucune écriture | test unitaire (dépendance factice) |
| Referer absent | pas d'en-tête | chemin du corps, validé et dé-exclu | Vitest |
| Referer d'une autre origine | `https://exemple.test/admin` | ignoré (chemin du corps) | Vitest |
| Base indisponible | fonction en erreur | 500 générique, rien de journalisé du corps | Vitest |
| Lecture directe | `anon` / `authenticated` sur la table et les vues | refusée | pgTAP |
| Écriture directe | `anon` / `authenticated` sur la table | refusée | pgTAP |

## Code Map

- **SQL** : `supabase/migrations/20270101100000_mesure.sql` — table, contraintes, index, RLS, `revoke`, `enregistrer_evenement_mesure(p_auteur jsonb, p_action, p_page, p_origine, p_referent, p_langue, p_appareil, p_session uuid)`, huit vues et leurs droits.
- **Module** : `src/modules/mesure/{actions,schemas,chemins,types,service,dependances}.ts` (modules purs testables) et `src/modules/mesure/client.ts` (navigateur seulement).
- **Route** : `src/app/api/mesure/route.ts` (`POST`, `connection()`, `no-store`).
- **Composant de branchement** : `src/components/mesure/EnvoiMesure.tsx` (client, monté une fois dans `src/app/[locale]/layout.tsx`), plus `MesureVueFiche.tsx`.
- **Points d'instrumentation** : `src/components/fiche/PageFiche.tsx` et `PageFicheKit.tsx` (vue de fiche), `BoutonAjouterPanier.tsx` (succès), `BoutonPartager.tsx` (partage ou copie réussis), `ObtentionKit.tsx` (kit gratuit obtenu), `HerosAccueil.tsx` + `MediaHeros.tsx` (clic et chargement du héros, par `data-mesure`).
- **Types** : `evenement_mesure` et la fonction sont absentes de `src/lib/supabase/types.ts` (fichier interdit) — client structurel local dans `dependances.ts`, comme `src/modules/promo/queries.ts`.
- **Tests** : `tests/unit/mesure-chemins.test.ts` (exclusions, normalisation, origine, appareil, domaine), `tests/unit/mesure-route.test.ts` (Zod strict, tailles, méthodes, débit, pages exclues, aucune donnée personnelle dans ce qui part), `tests/unit/mesure-client.test.ts` (session, déduplication, aucun envoi depuis une page exclue), `supabase/tests/mesure.test.sql` (pgTAP).

## Tasks

1. Migration : table, contraintes, index, RLS sans politique, `revoke`, fonction `security definer` (`search_path` vide, auteur visiteur, `service_role` seul), huit vues et leurs droits.
2. Module : liste fermée d'actions, schémas Zod stricts, fonctions pures (chemin, exclusions, origine, domaine, appareil), service (limites puis écriture), dépendances (client service, HMAC d'IP, `Referer`).
3. Route `POST /api/mesure` : type de contenu, taille, Zod, chemin recalculé, exclusions, limites, codes 204/400/405/413/415/429/500, `no-store`.
4. Client : session et origine en `sessionStorage` (repli mémoire), `mesurer()` avec `fetch` `keepalive`, déduplication de `vue_fiche` par onglet, délégation `data-mesure`, exclusions côté client.
5. Instrumentation des six actions retenues, sans toucher aux composants serveur au-delà de l'ajout d'un attribut ou d'un enfant client.
6. Tests Vitest et pgTAP ; `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
7. Notes d'intégration dans `voie-3-notes.md` : écarts bloqués, phrases de confidentialité proposées, vérifications.

## Verification

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` verts (build local : l'échec préexistant de `/fr/a-propos` sur la clé de service de `.env.local` reste signalé, `.env*` non modifié).
- `npm run test:sql` sort proprement en local (Docker absent) ; le pgTAP tourne en CI.
- Vérification manuelle : naviguer sur l'accueil et une fiche, vérifier dans l'onglet Réseau qu'un seul `POST /api/mesure` part par action, sans chaîne de requête ; ouvrir `/fr/admin` et `/fr/compte` et constater **aucune** requête ; forcer un envoi à la main depuis `/fr/admin` (console) et constater un 204 sans ligne ; vérifier qu'aucun cookie n'est créé et qu'aucune requête ne part vers un domaine tiers.

</frozen-after-approval>
