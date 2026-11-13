---
title: '9.14 Déconnexion après 4 h d’inactivité'
type: 'feature'
created: '2026-11-12'
status: 'ready-for-dev'
route: 'dispatch'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** une session Supabase reste ouverte très longtemps ; sur un appareil partagé ou oublié, le Compte (et l'admin) reste accessible.

**Approche :** le proxy mémorise l'heure de la dernière requête dans un cookie. Passé 4 h sans requête, il ferme la session côté serveur et mène la personne à la connexion avec un message, puis la ramène à la page quittée.

## Boundaries & Constraints

**Always :**
- Tous les comptes connectés (clients, admin, bénévoles). Toute navigation ou action (requête reçue par le proxy) compte comme activité.
- Seuil : 4 h (constante unique, testable). Mesure côté serveur uniquement, aucun script navigateur.
- Après expiration : session fermée (`signOut` portée locale), puis redirection d'une navigation GET localisée vers `/{langue}/connexion?retour=<page quittée>&expiree=1`. `retour` passe par `cheminRetourValide` (déjà en place).
- Message sur la page de connexion, FR : « Ta session a expiré après une longue inactivité. Reconnecte-toi pour continuer. » ; EN : « Your session expired after a long period of inactivity. Sign in again to continue. » Dans `messages/{fr,en}.json`, annoncé aux lecteurs d'écran (`role="status"`).
- Le panier (cookie signé `panier`) n'est jamais touché : il est conservé.
- Cookie d'activité : httpOnly, sameSite lax, secure en production, ne contient que l'heure. Réécrit au plus une fois par minute.
- Requête sans session : le cookie d'activité est supprimé (une ancienne valeur ne doit pas expirer une nouvelle connexion).
- Session présente mais cookie absent (sessions ouvertes avant le déploiement) : le cookie est posé, pas de déconnexion.

**Never :**
- Pas de script côté navigateur, pas de nouvelle table, pas de migration, pas de changement de la durée de vie des jetons Supabase.
- Pas de redirection pour une requête non GET (action serveur), une route hors langue (api, webhooks, auth/callback) : la session est fermée, la requête continue.
- Ne pas afficher le message si la personne est déjà reconnectée.

## I/O & Edge-Case Matrix

| Scénario | État | Comportement | Erreur |
|----------|------|--------------|--------|
| Actif | session, dernière activité < 4 h | passe ; cookie rafraîchi si > 1 min | N/A |
| Expiré, page | session, > 4 h, GET `/fr/compte` | session fermée, 307 vers `/fr/connexion?retour=%2Ffr%2Fcompte&expiree=1`, cookie d'activité supprimé | `signOut` en échec : cookies de session supprimés quand même |
| Expiré, action ou api | session, > 4 h, POST ou `/api/...` | session fermée, pas de redirection | N/A |
| Anonyme | pas de session, vieux cookie | cookie supprimé | N/A |
| Valeur illisible | cookie d'activité non numérique ou dans le futur | traité comme absent (cookie reposé) | N/A |
| Supabase muet | `getClaims` en erreur | aucune déconnexion, requête continue | journal existant |
| Retour | reconnecté avec `retour` | redirigé vers la page quittée, panier intact | N/A |

## Décisions renégociées (Jonathan, 2026-11-12 et 2026-11-13) — elles priment sur le texte ci-dessus

1. **Durée réglable dans l'admin** : réglage `session_inactivite_heures` (Réglages), entier de 1 à 24, 4 h par défaut ; réglage absent ou illisible : 4 h. Une migration est donc nécessaire (`20270117100000_reglage_session_inactivite.sql`), ce qui remplace « pas de migration » et « constante unique ».
2. **Pas de redirection forcée sur les pages publiques** : la session est fermée et un bandeau discret (`role="status"`) prévient la personne, qui continue en visiteur. La redirection vers la connexion (avec `retour` et `expiree=1`) n'a lieu que pour une navigation GET vers Mon compte (/compte), commande et paiement (/commande, /commande/[numero]), admin (/admin) et scan (/scan).

</frozen-after-approval>

## Code Map

- `src/proxy.ts` -- point d'entrée de toutes les requêtes ; `getClaims` donne la session ; copie déjà les cookies de `reponseSession` sur les réponses (redirection « / », next-intl, rewrite 404). Brancher la logique après `getClaims`.
- `src/lib/auth/inactivite.ts` -- nouveau : constantes (4 h, nom du cookie, 60 s) et fonction pure `evaluerActivite(valeurCookie, maintenant, aSession)` → `ok | poser | expire | supprimer`.
- `src/app/[locale]/connexion/page.tsx` -- lit `searchParams` (déjà `retour`, `erreur`) ; ajouter `expiree` et un bloc `role="status"` sous le titre, masqué si déjà connecté.
- `src/lib/auth/retour.ts` -- `cheminRetourValide` à réutiliser ; ne pas changer.
- `src/lib/panier/cookie.ts` -- cookie panier : ne pas toucher.
- `tests/unit/proxy-cookies-rafraichis.test.ts` -- modèle du faux client Supabase (tests uniquement) ; le faux doit gagner `signOut` et un `getClaims` avec données.
- `messages/fr.json`, `messages/en.json` -- clé `Connexion.sessionExpiree`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/auth/inactivite.ts` -- constantes et décision pure -- testable sans réseau
- [ ] `src/proxy.ts` -- lire le cookie, décider, `signOut({scope:"local"})`, redirection GET localisée, poser/supprimer le cookie sur `reponseSession` -- règle 2 du proxy : jamais d'erreur 500 si Supabase est muet
- [ ] `src/app/[locale]/connexion/page.tsx` -- afficher le message quand `expiree=1` -- demande de Jonathan
- [ ] `messages/{fr,en}.json` -- texte du message -- règle « aucun texte en dur »
- [ ] `tests/unit/inactivite.test.ts`, `tests/unit/proxy-inactivite.test.ts`, test de la page de connexion -- chaque ligne de la matrice
- [ ] `EXPERIENCE.md` -- ajouter la règle de session (4 h) -- document de référence ; `sprint-status.yaml` : ajouter 9-14

**Acceptance Criteria:**
- Given un Compte inactif depuis plus de 4 h, when il ouvre une page, then il voit la connexion avec le message dans sa langue, et après reconnexion il revient à cette page.
- Given un panier rempli, when la session expire puis il se reconnecte, then le panier est identique.
- Given un visiteur anonyme, when il navigue, then aucun message ni redirection.
- Given un nouvel appareil ou une nouvelle connexion, when l'ancien cookie date de plus de 4 h, then pas de déconnexion immédiate.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- expected: sans erreur

**Manual checks (if no CLI):**
- En local, mettre temporairement le seuil à 1 minute via la constante, se connecter, attendre, naviguer : connexion + message + retour ; remettre 4 h.
