---
title: 'Story 1.5 : navigateurs intégrés et connexion Google'
type: 'feature'
created: '2026-10-21'
status: 'done'
baseline_commit: 'b2d978899616913dedb5e8e4cbd5b34e1096dbce'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un visiteur arrivé depuis Instagram, Facebook, TikTok ou WhatsApp tombe sur l'erreur Google « disallowed_useragent », et le site n'offre aucune connexion Google ailleurs.

**Approach:** Module unique de détection côté serveur ; bandeau non bloquant « Ouvrir dans mon navigateur » sur toutes les pages ; bouton « Continuer avec Google » sur `/connexion` (absent en navigateur intégré, le code email reste) ; flux OAuth PKCE de Supabase Auth par Server Action et route `/auth/callback`, puis même parcours qu'un Compte email (âge, Compte complet).

## Boundaries & Constraints

**Always:** Google passe par Supabase Auth seulement ; identifiant client et secret Google saisis par Jonathan seul dans le tableau de bord de `koma-dev` : jamais dans le code, `.env*`, `config.toml` en clair, chat ni journaux. Détection : un seul module (`src/lib/navigateur-integre.ts`) pour Instagram, Facebook (Messenger inclus), TikTok, WhatsApp, Snapchat, LinkedIn, X/Twitter, Telegram et les vues génériques (WebView Android `; wv)`, WKWebView iOS sans jeton `Safari/`), un test par agent plus des navigateurs normaux non détectés (décision du 2026-10-22) ; la Server Action Google refuse aussi un agent intégré (défense en profondeur). Bandeau : `role="region"` libellé, dans le flux de la page (jamais superposé, donc jamais sur un élément focalisé), fermeture 44 px, choix mémorisé (try/catch autour du stockage), rendu sous `Suspense` (cacheComponents). Bouton « Continuer avec Google » selon les règles de marque de Google (décision du 2026-10-21, remplace « texte seul » de E-37) : « G » officiel non modifié (fichier SVG « Light, Show text=No, Square » du lot signin-assets.zip de Google, copié tel quel dans `public/`), libellé localisé « Continuer avec Google » / « Continue with Google », fond blanc #FFFFFF, trait #747775, texte #1F1F1F, cible 44 px ; source et conditions notées dans `docs/licences/` (règle 6) ; la police Google Sans n'étant pas disponible, le texte reste en Barlow (écart noté). Bouton envoyé par `<form action>` (marche avant l'hydratation). Retour : même `cheminRetourValide` ; Compte Google sans âge = incomplet, la page `/connexion` reprend à l'étape « âge » (déjà en place) ; `exigerCompteComplet()` inchangé. `profil.langue` reçoit la langue de la route par la fonction SQL `definir_langue_profil(p_auteur, p_compte, p_langue)` : langues `fr` et `en` seulement, effective seulement tant que l'âge n'est pas déclaré, et réservée au profil de l'auteur (`p_auteur.id = p_compte`, sinon `KS_DROIT_REFUSE`). Suivant la convention AD-25 du dépôt (écriture par `service_role`, sans `auth.uid()`, droits retirés à `anon`/`authenticated`), `p_compte` vient de la session vérifiée par le serveur ; un test pgTAP prouve qu'on ne peut pas modifier le profil d'un autre ni appeler la fonction en `authenticated`. Textes dans `messages/*.json`, tutoiement, ton sobre. Nouvelle migration seulement ; erreur de retour Google : message clair sur `/connexion`, code email toujours disponible ; journaux sans jeton, code ni email.

**Never:** Aucune connexion Google simulée hors tests `TEST_` ; aucun autre fournisseur ; pas de questions d'accueil (1.6) ;  aucune clé Google dans le dépôt ; je ne lance pas `npm run dev`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Page dans Instagram/Facebook/TikTok/WhatsApp | agent intégré | bandeau « Ouvrir dans mon navigateur » ; fermé = mémorisé | N/A |
| Connexion en navigateur intégré | agent intégré | pas de bouton Google, message court, code email seul | action Google appelée quand même : refus serveur |
| Chrome ou Safari | agent normal | bouton « Continuer avec Google » | N/A |
| Google réussi, nouveau Compte | retour sur `/auth/callback` | session posée, profil créé, langue de la route, étape « âge » | N/A |
| Google réussi, Compte complet | idem | retour validé à la page quittée | retour hostile : accueil de la langue |
| Android, Chrome disponible | agent intégré Android | bouton ouvrant Chrome (`intent://`) ; « Copier le lien » + instruction si le lien ne fonctionne pas | N/A |
| iPhone | agent intégré iOS | bouton « Copier le lien » + instruction écrite (« touche ⋯ puis Ouvrir dans Safari ») ; aucun lien non documenté | copie impossible : instruction seule |
| Annulation ou échec Google | `error` ou code absent/invalide | `/connexion` avec message clair | rien de sensible journalisé |

</frozen-after-approval>

## Code Map

- `src/proxy.ts` -- laisse passer `/auth/*` (hors langue) ; ne pas modifier sauf test rouge.
- `src/app/[locale]/connexion/page.tsx`, `FormulaireConnexion.tsx` -- ajouter bouton Google (lecture de l'agent côté serveur, passée en prop) ; reprise à l'étape « âge » déjà faite par `lireEtatCompte`.
- `src/modules/comptes/actions.ts`, `service.ts`, `types.ts` -- ajouter `connecterAvecGoogle` (`signInWithOAuth`, `redirectTo` bâti sur `NEXT_PUBLIC_SITE_URL`) ; réutiliser `journaliser`.
- `src/app/[locale]/layout.tsx` -- monter le bandeau sous `Suspense` ; `src/components/layout/` -- nouveau `BandeauNavigateurIntegre` (+ partie client).
- `src/app/auth/callback/route.ts` (nouveau) -- `exchangeCodeForSession`, état du Compte, redirection.
- `src/lib/auth/retour.ts`, `compte.ts` -- réutiliser tels quels.
- `public/` + `docs/licences/` -- « G » Google officiel non modifié et fiche de licence.
- `src/app/robots.ts` -- exclure `/auth`.
- `supabase/migrations/` -- nouvelle `..._definir_langue_profil.sql` ; `supabase/tests/profil.test.sql` ; `supabase/config.toml` -- URL de redirection locale seulement, Google reste `enabled = false` sans valeur.
- `tests/unit/`, `tests/doubles/TEST_dependances-comptes.ts` -- agents utilisateurs, bandeau, action, route callback ; `tests/e2e/` -- bouton absent avec agent Instagram, présent sinon (le clic Google réel est manuel).

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/navigateur-integre.ts` -- détecter Instagram, FB (FBAN/FBAV/FB_IAB), TikTok (musical_ly, BytedanceWebview, TikTok), WhatsApp ; plateforme Android/iOS -- module unique
- [x] `tests/unit/navigateur-integre.test.ts` -- agents réels intégrés et Chrome/Safari/Firefox normaux
- [x] `BandeauNavigateurIntegre` + `messages/*.json` -- bandeau, fermeture 44 px mémorisée, ouverture Chrome par `intent://` (Android), « Copier le lien » + instruction écrite (iPhone, et Android en repli)
- [x] `src/modules/comptes/*` -- `connecterAvecGoogle` (refus si agent intégré, redirection vers l'URL renvoyée par Supabase)
- [x] `src/app/auth/callback/route.ts` + migration `definir_langue_profil` + test SQL -- échange du code, langue, redirection
- [x] `FormulaireConnexion` / page -- bouton Google, message en navigateur intégré, erreur Google claire
- [x] `tests/unit`, `tests/e2e`, `.env.example` (aucune variable ajoutée) -- couverture ; robots

**Acceptance Criteria:**
- Given un agent Instagram, when `/fr/connexion` s'affiche, then aucun bouton Google et le code email fonctionne
- Given un agent Chrome, when « Continuer avec Google » est choisi, then Supabase redirige vers Google puis `/auth/callback` ramène à la page quittée
- Given un Compte Google sans âge, when il arrive, then l'étape « âge » s'affiche et un achat est refusé côté serveur
- Given `lint`, `typecheck`, `test`, `build`, then tous passent ; `test:sql` en CI

## Implementation Notes

- Réalisé directement (sans sous-agent). Fichiers : `src/lib/navigateur-integre.ts`, `src/components/layout/BandeauNavigateurIntegre{,Client}.tsx`, `src/app/[locale]/connexion/BoutonGoogle.tsx`, `src/app/auth/callback/route.ts`, `src/modules/comptes/{dependances,google}.ts` (+ `actions`, `service`, `schemas`, `types`), migration `20261022120000_definir_langue_profil.sql` + test pgTAP, `public/google/google-g.svg` + `docs/licences/google-connexion.md`.
- `dependances()` sorti de `actions.ts` vers `dependances.ts` pour être partagé avec la route de retour.
- Redirection Google fixe (`/auth/callback`, sans paramètres) : langue et retour validés gardés dans le cookie httpOnly `ks_retour_google` (10 min, chemin `/auth`).
- `definir_langue_profil` suit la convention AD-25 (service_role, `p_auteur`, sans `auth.uid()`) plutôt que `auth.uid()` : l'identité vient de la session vérifiée et la fonction exige `p_auteur.id = p_compte`.
- `src/lib/supabase/types.ts` : entrée `definir_langue_profil` ajoutée à la main, au format du générateur ; à régénérer par `npm run types` après `npm run db:push` (non lancé : écriture sur `koma-dev`, à confirmer).
- Vérifié : lint, typecheck, 176 tests Vitest, build, e2e Playwright (64 réussis, 5 ignorés : boîte de test absente). `test:sql` non exécuté en local (pas de Docker) : CI.

## Spec Change Log

- 2026-10-22 (demande de Jonathan, hors boucle de revue) : la détection s'étend à Snapchat, LinkedIn, X/Twitter, Telegram et aux vues génériques Android/iOS, car Google bloque toutes ces vues. Remplace la limite aux quatre applications. KEEP : module unique, refus côté serveur dans l'action Google, Chrome et Safari normaux jamais détectés.

## Review Triage Log

| Constat | Verdict | Route | Évidence |
|---------|---------|-------|----------|
| `plan(11)` pour 10 assertions dans `definir_langue_profil.test.sql` | high | patch | recompté : 10 ; corrigé, ferait échouer `test:sql` en CI |
| Action `connecterAvecGoogle` (cookie, redirection, refus d'agent) sans test | medium | patch | `tests/unit/actions-google.test.ts` ajouté |
| Message `?erreur=google` non vérifié de bout en bout | medium | patch | test e2e ajouté |
| `prettier --write` a reformaté tout `FormulaireConnexion.tsx` | medium | patch | fichier restauré puis réédité a minima (24 lignes) |
| Redirections d'erreur du callback perdent le retour | medium | patch | `retour` gardé dans toutes les redirections vers la connexion |
| `retour` > 512 car. refuse Google au lieu de revenir à l'accueil | low | patch | `max(512)` retiré du schéma, `cheminRetourValide` borne déjà |
| `?erreur` en tableau ; erreur Google affichée à l'étape « âge » | low | patch | premier élément lu ; erreur limitée à l'étape de l'email |
| `lienChrome` perd le fragment `#` | low | patch | `url.hash` ajouté |
| Échantillon WhatsApp = agent HTTP, pas une vue intégrée réelle | low | patch | commentaire du test corrigé ; cas réel au test manuel |
| Navigateurs intégrés non listés (Snapchat, LinkedIn, Line, X, WeChat, `; wv)` générique) | medium (non vérifié) | defer | hors des quatre applications de l'intention ; à décider |
| Cookie `ks_retour_google` partagé entre onglets ; double appel du callback | low | defer | rare, repli = accueil `fr` |
| `definir_langue_profil` écrase la langue d'un Compte email incomplet qui passe par Google ; profil absent = succès silencieux | low | defer | rare ; le profil naît avec le Compte |
| Bandeau fermé : bref affichage avant lecture du stockage ; message « copié » jamais effacé | low | defer | cosmétique |
| Double soumission avant hydratation ; pas de `state`/nonce propre | low | rejeté | PKCE de Supabase protège l'échange ; repli sans danger |
| Couleurs Google en dur, bouton blanc en sombre, police Google Sans absente | false | rejeté | imposé par les règles de marque de Google, noté dans `docs/licences/` |
| `intent://` sans Chrome | false | rejeté | `S.browser_fallback_url` prévu ; fiabilité à confirmer sur téléphone |
| `p_auteur` non vérifié par `auth.uid()` | false | rejeté | convention AD-25 du dépôt ; fonction réservée à `service_role`, test pgTAP |
| Layout dynamique à cause de `headers()` | false | rejeté | sous `Suspense` (cacheComponents) ; build : pages en prérendu partiel |
| Entrées `redirect` de `config.toml` | low | rejeté | locales seulement ; le tableau de bord de `koma-dev` est réglé à la main |
| Mentions légales Google / liaison de Compte par email | low | defer | textes légaux : story 1.9 ; liaison par Supabase, à confirmer au test réel |

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- expected: aucune erreur
- `npm run test:sql` -- expected: message explicatif en local ; vert en CI

**Manual checks (if no CLI):**
- Réglage Google/Supabase par Jonathan (étapes fournies à l'arrêt), puis connexion réelle sur Chrome/Safari et test du bandeau dans Instagram sur téléphone
