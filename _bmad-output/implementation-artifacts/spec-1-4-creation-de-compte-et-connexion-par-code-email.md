---
title: 'Story 1.4 : création de compte et connexion par code email'
type: 'feature'
created: '2026-10-21'
status: 'done'
baseline_commit: '9ff444d750f7b009f5b8a79941235880738a685f'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le site n'a aucun Compte : pas de connexion, pas de table `profil`, pas de déconnexion, et le rafraîchissement des cookies de session par `proxy.ts` n'est prouvé par aucun test (point reporté de la 1.2).

**Approach:** Page `/[locale]/connexion` en trois étapes (email, code à 6 chiffres, âge si non déclaré) par Server Actions sur Supabase Auth ; table `profil` créée par déclencheur avec la langue de la route ; fonctions SQL `declarer_age`, `est_mineur`, `compte_complet` ; retour validé vers la page quittée ; déconnexion dans l'en-tête et le ☰ ; test du report des cookies rafraîchis.

## Boundaries & Constraints

**Always:** Code à 6 chiffres, valable 10 min (`otp_expiry = 600`), renvoi après 60 s (`max_frequency = "60s"`), écrits en texte sur la page. Un seul champ `one-time-code` (`inputmode="numeric"`, `pattern="[0-9]*"`, `maxlength="6"`), collage permis, pas de soumission automatique. « Un nouveau code a été envoyé à [email] » seulement après la réponse réelle de Supabase (règle 13). Messages exacts du code faux et expiré (epics 1.4), erreur reliée au champ par `aria-describedby`. Aide « email non reçu » : vérifier l'adresse et les courriers indésirables, renvoyer, changer d'adresse. Libellés seulement dans `messages/*.json`. Un Compte sans âge est incomplet ; `compte_complet()` et l'aide serveur `exigerCompteComplet()` refusent toute action d'achat, de Pass ou d'envoi de photo (AD-24). Âge < 13 : `declarer_age` refuse (`KS_AGE_MINIMUM`), le serveur supprime le Compte (`auth.admin.deleteUser`, `profil` en cascade), ferme la session et affiche un message clair ; rien n'est conservé. `est_mineur(compte)` : vrai de 13 à 17 ans, faux à 18 et plus, faux si l'âge n'est pas déclaré. Toute fonction d'écriture reçoit `p_auteur jsonb` (AD-25), construit par `src/lib/auth/auteur.ts` depuis la session vérifiée. Chemin de retour validé côté serveur : chemin interne commençant par `/fr` ou `/en`, jamais une adresse externe, ni `//`, ni `\`, ni `/connexion` (sinon accueil de la langue). Entrées validées par Zod. Nouvelle migration (jamais de modification d'une migration appliquée). RLS sur `profil` : lecture de sa propre ligne seulement, aucune écriture directe. Service role et clé secrète côté serveur seulement. Page de connexion : metadata, Open Graph, `noindex`, JSON-LD, 375 px sans défilement horizontal, clavier.

**Never:** Pas de Resend (story 9.9), pas de Google ni de détection de navigateur intégré (1.5), pas de questions d'accueil (1.6), pas de rôles ni d'admin (1.7), pas de mot de passe, pas de fusion de panier (4.2). Aucun code simulé dans le site ni dans l'interface : les faux clients ne vivent que dans les tests, nommés `TEST_`. Aucune connexion automatique après suppression d'un moins de 13 ans. Je ne lance pas `npm run dev`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Demande de code | email valide | Supabase envoie le code ; étape « code » ; message d'envoi après réponse réelle | email invalide : erreur sur le champ ; limite d'envoi Supabase : message de patience, rien affiché comme envoyé |
| Code correct, nouveau Compte | 6 chiffres | session posée dans les cookies, `profil` créé (langue de la route), étape « âge » | N/A |
| Code correct, Compte complet | 6 chiffres | retour à la page quittée (chemin validé) | N/A |
| Code faux | 6 chiffres inexacts | « Ce code n'est pas le bon… » relié au champ, saisie modifiable | N/A |
| Code expiré | code de plus de 10 min | « Ce code a expiré. », « Renvoyer le code » mis en avant | N/A |
| Renvoi | avant 60 s / après | bouton désactivé avec le délai en texte / nouveau code, ancien code invalide | échec d'envoi : erreur affichée |
| Âge ≥ 13 | 13 à 120, entier | `age_declare` enregistré, Compte complet, retour | hors bornes ou non entier : erreur sur le champ |
| Âge < 13 | 0 à 12 | Compte supprimé, session fermée, message clair | échec de suppression : erreur affichée, session fermée, journal sans donnée sensible |
| Retour hostile | `retour=https://x.fr`, `//x.fr`, `/\x.fr` | accueil de la langue | N/A |
| Cookies rafraîchis | `getClaims` pose de nouveaux cookies | présents sur la redirection de `/`, sur la réponse next-intl et dans les cookies de la requête transmise | N/A |
| Déconnexion | clic dans l'en-tête ou le ☰ | session fermée, retour à l'accueil de la langue | échec : message d'erreur |

</frozen-after-approval>

## Code Map

- `src/proxy.ts` -- enchaîne session puis langue ; test de report des cookies ajouté (le try/catch de `getClaims` est déjà traité, commit 6705f91). Le corriger seulement si le test échoue.
- `src/lib/supabase/session.ts` -- `creerClientSession()` pour les actions (`signInWithOtp`, `verifyOtp`, `getClaims`, `signOut`) ; `service.ts` pour la suppression et `declarer_age`.
- `src/lib/env.ts` -- aucune variable nouvelle.
- `src/components/layout/EnTete.tsx`, `MenuPanneau.tsx` -- ajouter `ZoneCompte` (async, sous `Suspense` : `cacheComponents` est actif, la session ne doit pas rendre l'en-tête dynamique ; repli = lien « Se connecter »).
- `src/components/ui/Bouton.tsx`, `MessageEtat.tsx`, `TitreVitrine.tsx` -- à réutiliser pour le formulaire.
- `src/lib/seo/metadata.ts`, `jsonld.ts` -- metadata de la page.
- `supabase/config.toml` -- `[auth.email]` : `otp_expiry = 600`, `max_frequency = "60s"` ; `[auth.rate_limit] email_sent` relevé pour la base locale de test ; modèles `magic_link` et `confirmation` pointant vers `supabase/templates/`.
- `supabase/migrations/` -- créer `..._creer_profil.sql` ; `supabase/tests/profil.test.sql` ; `tests/e2e/` ; `tests/unit/`.
- `src/modules/comptes/` (nouveau, AD-1) -- `actions.ts`, `service.ts`, `schemas.ts`, `types.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] `supabase/migrations/<horodatage>_creer_profil.sql` -- table `profil(id → auth.users cascade, langue fr|en, age_declare smallint 13..120 null, age_declare_le, cree_le)`, déclencheur sur `auth.users` (langue lue dans `raw_user_meta_data`, `fr` si absente ou invalide), RLS lecture propre, `declarer_age(p_auteur, p_compte, p_age)`, `est_mineur`, `compte_complet`, droits d'exécution réservés à `service_role` pour l'écriture -- AD-24, AD-25
- [ ] `supabase/tests/profil.test.sql` -- création du profil et de sa langue, `est_mineur` à 12/13/17/18 ans et âge non déclaré, vieillissement par `age_declare_le`, refus < 13, RLS (lecture d'un autre profil impossible, écriture directe impossible)
- [ ] `supabase/config.toml` et `supabase/templates/code-connexion.html` -- durée 600 s, délai 60 s, e-mail montrant `{{ .Token }}` en texte, FR et EN dans le même message (la langue par utilisateur n'est pas confirmée par la documentation Supabase, règle 15)
- [ ] `src/lib/auth/retour.ts`, `auteur.ts`, `compte.ts` -- validation du retour, auteur AD-25 (rôle `null` jusqu'à la 1.7), `exigerCompteComplet()`
- [ ] `src/modules/comptes/*` -- actions `demanderCode`, `verifierCode`, `declarerAge`, `deconnecter` ; schémas Zod ; suppression sous 13 ans
- [ ] `src/app/[locale]/connexion/page.tsx` et `FormulaireConnexion.tsx` -- trois étapes, états de l'UX, compte à rebours de renvoi en texte, focus déplacé à chaque étape
- [ ] `src/components/layout/ZoneCompte.tsx`, `EnTete.tsx`, `MenuPanneau` -- « Se connecter » / « Se déconnecter »
- [ ] `messages/fr.json`, `messages/en.json` -- tous les textes (parité testée)
- [ ] `tests/unit/` -- retour validé (hostiles), schémas, actions avec faux client `TEST_` (envoi, code faux, expiré, < 13), report des cookies par `proxy`, composant du formulaire
- [ ] `tests/e2e/connexion.spec.ts` -- création de Compte en lisant le code dans la boîte de test locale (Mailpit, port 54324, URL en variable d'environnement) ; ignoré avec raison écrite si la boîte est absente (cas de `koma-dev`)
- [ ] `deferred-work.md`, `.env.example` -- marquer le point des cookies traité ; déclarer l'URL de la boîte de test

**Acceptance Criteria:**
- Given la page de connexion, when le visiteur demande un code, then aucun message d'envoi n'apparaît avant la réponse de Supabase
- Given un Compte sans âge, when une action protégée appelle `exigerCompteComplet()`, then elle est refusée côté serveur
- Given `npm run lint`, `typecheck`, `test` et `build`, then tous passent ; `test:sql` et l'e2e passent en CI

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Constat | Verdict | Route | Évidence |
|---------|---------|-------|----------|
| Adulte au Compte complet qui déclare 5 ans : Compte supprimé (`p_age < 13` avant « déjà déclaré ») | high | patch | vérifié dans la migration : l'ordre des contrôles le permet ; le service supprime sur KS_AGE_MINIMUM |
| KS_AGE_DEJA_DECLARE / KS_PROFIL_INTROUVABLE en erreur générique | medium | patch | vérifié dans `service.ts` (double envoi, second onglet) |
| `signOut()` sans portée (global) et échec si session absente | medium | patch | portée par défaut de Supabase = global |
| /connexion sans reprise pour un Compte incomplet déjà connecté | medium | patch | la page ne lit pas la session |
| Compte à rebours qui tourne après 0 | low | patch | correction directe |
| Suppression d'un moins de 13 ans non prouvée (SQL cascade, e2e) ; lien de connexion et déconnexion non testés ; e2e sauté en silence en CI | medium | patch | rapport de vérification, preuves citées |
| `verifyOtp` : tout 403/422 vaut « code faux » | maybe-false | defer | codes d'erreur réels de Supabase non confirmés ; à vérifier avec un vrai code sur koma-dev |
| Retour sans query string (`usePathname`) | low | defer | rattaché à la story 2.4 comme le sélecteur de langue |
| Branches `verifierCode`/`declarerAge` sans test (429, erreur inconnue) | low | defer | messages seuls en jeu |
| Pas de CAPTCHA ni de limite par IP sur l'envoi de codes | medium (non vérifié) | defer | réglage Supabase / mise en ligne (9.9) |
| Âge déclaré une seule fois : une faute de frappe n'est pas corrigeable | medium | defer | ajout de l'implémentation hors spec ; décision de Jonathan demandée |
| `envoyeLe` fourni par le navigateur ; « expiré » jamais affiché après rechargement | low | rejeté | limite connue, choix documenté, message seul |
| `//` refusé dans la query du retour | low | rejeté | refus prudent, correction ajoute de la complexité |
| Focus en mode Strict (dev) ; focus par `setTimeout` | low | rejeté | dev seulement / négligeable |
| Déclencheur de profil sans gestion d'exception | false | rejeté | échouer fort est voulu |
| `signOut` après suppression de l'utilisateur | false | rejeté | supabase-js efface la session locale sur 401/403/404 |
| `p_auteur` non enregistré | low | rejeté | la spec demande le paramètre (AD-25), pas de journal du profil |
| Config Supabase en ligne (modèles, 600 s, SMTP) hors dépôt | false | rejeté | réglages faits par Jonathan, pas du code |
| Test du proxy sans changement de `proxy.ts` | false | rejeté | le test était le point reporté ; `proxy.ts` n'avait pas à changer |
| `limite` sans délai affiché ; JSON-LD sur page noindex ; `est_mineur(12)` en SQL | low | rejeté | négligeable, JSON-LD exigé par la règle 8 |

## Design Notes

**Âge :** `age_declare` + années entières écoulées depuis `age_declare_le` ; la date de naissance n'est pas demandée (consigne : champ numérique). **Suppression sous 13 ans :** la fonction SQL lève une erreur (sa transaction s'annule), donc c'est le serveur qui supprime via l'API d'administration. **Boîte de test :** seul le test lit le code ; le site ne le voit jamais.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- expected: aucune erreur
- `npm run test:sql` -- expected: en local, message explicatif sans erreur (pas de Docker) ; vert en CI

**Manual checks (if no CLI):**
- Après réglage du tableau de bord Supabase de `koma-dev` : connexion réelle depuis un navigateur, code lu dans l'email, Compte créé, âge, retour à la page quittée, déconnexion
