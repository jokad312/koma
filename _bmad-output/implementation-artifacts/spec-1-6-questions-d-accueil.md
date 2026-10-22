---
title: 'Story 1.6 : questions d''accueil'
type: 'feature'
created: '2026-10-22'
status: 'done'
baseline_commit: '7643e09328daa19178fc6810f94a793757828d46'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un nouveau Compte, une fois son âge déclaré, ne peut pas dire d'où il vient ni ce qu'il préfère ; KOMA SHOP n'a donc rien pour mesurer l'origine des ventes (FR-54) ni cibler l'email « nouveau produit dans ton univers » (FR-59).

**Approach:** Nouvelle étape « questions » de `/connexion`, après l'âge (Compte email comme Compte Google), affichée une seule fois : trois questions facultatives, « Passer » ou « Continuer » ramènent au même endroit. Les réponses sont validées par Zod côté serveur et enregistrées dans `profil` par une fonction SQL qui marque aussi les questions comme vues.

## Boundaries & Constraints

**Always:** Écriture seulement par Server Action puis fonction `SECURITY DEFINER` `enregistrer_questions_accueil(p_auteur, p_compte, p_origine, p_preference)`, convention AD-25 (service_role, `p_compte` issu de la session vérifiée, `p_auteur.id = p_compte` sinon `KS_DROIT_REFUSE`, droits retirés à `anon`/`authenticated`, test pgTAP). Refus si l'âge n'est pas déclaré (`KS_AGE_NON_DECLARE`). Une seule fois : une seconde écriture est refusée (`KS_QUESTIONS_DEJA_VUES`) et l'action la traite comme un succès, sans rien modifier. « Passer » et un envoi vide enregistrent « vues » sans réponse. Colonnes de `profil` (nouvelle migration seulement) : `origine` (TikTok, Instagram, Facebook, YouTube, WhatsApp, Google, ChatGPT ou une autre IA, un ami, un festival ou un événement KOMA, autre : valeurs fixes `tiktok|instagram|facebook|youtube|whatsapp|google|ia|ami|evenement|autre`), `preference_creation` (`porter|fabriquer`), `questions_accueil_le`, chacune bornée par un `check` ; mêmes valeurs dans l'enum Zod. Réponse inconnue : refus, rien d'enregistré. « Origine » : une seule réponse, facultative, liste native `<select>` avec choix vide. « Porter ou fabriquer » : deux radios natifs dans un `fieldset`, sans action au choix (UX-DR23), sélection = bordure rouge 2 px et coche, facultatif. « Quel univers » : non affichée tant qu'aucun univers n'existe en base ; il n'existe aucune table d'univers avant l'epic 2, donc la question n'est pas affichée et aucune colonne ni liste n'est ajoutée (E-29) ; l'epic 2 l'ajoutera. Étape déterminée côté serveur : après `verifierCode` ou `declarerAge`, `etape` vaut `age`, `questions` ou `termine` ; `/connexion` d'un Compte complet dont les questions ne sont pas vues s'ouvre sur l'étape « questions », sinon redirige comme aujourd'hui. Retour : même `cheminRetourValide`. Textes dans `messages/*.json`, tutoiement, sobre ; focus déplacé sur le titre de l'étape ; boutons de 44 px ; erreurs sans journaliser de réponse. Nouvelle migration seulement ; `src/lib/supabase/types.ts` complété à la main au format du générateur.

**Never:** Pas de question « univers » codée en dur ni de table `univers` (epic 2) ; aucun suivi d'audience (FR-54, epic 9) ni email (FR-59) ; pas de questions pour un Compte sans âge déclaré ; aucune réponse simulée hors tests `TEST_` ; je ne lance pas `npm run dev` ni `db:push`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Nouveau Compte (email ou Google) | âge déclaré, questions non vues | étape « questions », puis retour à la page quittée | N/A |
| Passer | clic sur « Passer » | « vues » enregistré sans réponse, retour immédiat | échec serveur : message, reste sur l'étape |
| Répondre | origine et/ou préférence | réponses enregistrées, retour au même endroit | valeur hors liste : `generique`, rien d'enregistré |
| Retour sur `/connexion` | Compte complet, questions vues | redirection vers le retour, sans questions | N/A |
| Double envoi / second onglet | questions déjà vues | succès, réponses d'origine conservées | N/A |
| Compte sans âge ou session perdue | `KS_AGE_NON_DECLARE` / pas de session | `non_connecte` ou reprise à l'étape âge | message clair |

</frozen-after-approval>

## Code Map

- `supabase/migrations/` -- nouvelle `..._ajouter_questions_accueil.sql` : colonnes, `enregistrer_questions_accueil`, `questions_accueil_vues(p_compte)` ; ne pas modifier `20261021160000_creer_profil.sql`.
- `supabase/tests/questions_accueil.test.sql` -- modèle : `definir_langue_profil.test.sql` (droits, autre profil, double appel, âge manquant).
- `src/modules/comptes/{types,schemas,service,actions,dependances}.ts` -- `EtapeApresCode` gagne `questions` ; `DependancesComptes` gagne `questionsVues` et `enregistrerQuestions` ; schéma Zod `questionsAccueilSchema` ; service `enregistrerQuestionsAccueil` sur le modèle de `declarerAge`.
- `src/lib/auth/compte.ts` -- `lireEtatCompte` : ajouter l'état `questions` (complet, non vu) ; `exigerCompteComplet` inchangé.
- `src/app/[locale]/connexion/{page,FormulaireConnexion}.tsx` -- étape `questions` ; `etapeInitiale` accepte `questions` ; `declarerAge`/`verifierCode` aiguillent selon `etape`.
- `messages/{fr,en}.json` -- namespace `Connexion.questions` (titre, texte facultatif, libellés, options, « Passer », « Continuer »).
- `tests/doubles/TEST_dependances-comptes.ts`, `tests/unit/`, `tests/e2e/connexion.spec.ts` -- doubles, service, formulaire, e2e (le flux existant passe désormais par l'étape).

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/..._ajouter_questions_accueil.sql` + `supabase/tests/questions_accueil.test.sql` -- colonnes, fonctions, droits `service_role`, tests pgTAP -- stockage dans le profil (AD-2, AD-25)
- [x] `src/modules/comptes/{types,schemas,service,actions,dependances}.ts` + `src/lib/supabase/types.ts` -- enum Zod, `enregistrerQuestionsAccueil`, aiguillage `questions` -- écriture serveur
- [x] `src/lib/auth/compte.ts` + `connexion/page.tsx` -- état « questions » et étape initiale -- une seule fois
- [x] `FormulaireConnexion.tsx` (ou composant `QuestionsAccueil.tsx` à côté) + `messages/*.json` -- étape, `select`, radios, « Passer » -- UX-DR23
- [x] `tests/doubles`, `tests/unit`, `tests/e2e` -- couverture de la matrice ; flux e2e existants mis à jour

**Acceptance Criteria:**
- Given un Compte dont l'âge vient d'être déclaré, when il continue, then les trois questions sont proposées sauf « univers » (aucun univers) et « Passer » ramène à la page quittée
- Given des réponses valides, when il valide, then `profil` contient origine, préférence et `questions_accueil_le`, et un second envoi ne change rien
- Given `lint`, `typecheck`, `test`, `build`, then tous passent ; `test:sql` en CI

## Review Triage Log

Revue complète du 2026-10-22 : Blind Hunter, Edge Case Hunter, Verification Gap (sous-agents), plus l'auto-revue de la première passe.

| Constat | Verdict | Route | Évidence |
|---------|---------|-------|----------|
| `KS_AGE_NON_DECLARE` renvoie `generique` au lieu de `non_connecte` (matrice) | medium | patch | mappé sur `non_connecte` ; test mis à jour |
| Boutons « Continuer » / « Passer » / Entrée non verrouillés pendant l'envoi | medium | patch | verrou par `useRef` dans `envoyer` ; test d'un seul appel (`Bouton` est `type="button"` par défaut : pas de double soumission par « Passer ») |
| Message « session perdue » sans sortie | medium | patch | bouton « Se reconnecter » vers l'étape de l'email ; test |
| Appel de l'action rejeté (réseau) : exception non gérée | medium | patch | `try/catch/finally` ; test |
| `lireEtatCompte` / branche `verifierCode`→« questions » sans test | medium | patch | `etat-compte.test.ts`, test du formulaire, étape e2e (rouvrir `/connexion` sans répondre) |
| Valeurs permises écrites en trois endroits sans test de cohérence | medium | patch | `questions-accueil-valeurs.test.ts` (Zod = check SQL = fonction SQL) |
| pgTAP : `anon` et lecture `questions_accueil_vues` non testés | low | patch | 3 assertions ajoutées (plan 19) |
| `etapeApresConnexion` avale l'erreur sans journal ; deux clients et deux appels | low | patch | `journaliser` ajouté ; un seul client de service |
| « Facultatif. » du groupe radios non relié au `fieldset` | low | patch | `aria-describedby` |
| Mention d'usage, consultation, correction et suppression des réponses | medium | defer | page Compte et textes légaux (1.9 et suivantes) ; entrée dans `deferred-work.md` |
| Test clavier dédié, thème sombre / contraste forcé de la coche | low | defer | radios natifs ; entrée dans `deferred-work.md` |
| Question « univers » non reprise par une story de l'epic 2 | medium | defer | rattachée à la story 2.1 (critère d'acceptation ajouté dans `epics.md`) |
| Préférence « porter / fabriquer » impossible à effacer | low | rejeté | sélecteur à deux options (UX-DR23) ; « Passer » et l'absence de choix restent possibles |
| Comptes existants (sans `questions_accueil_le`) voient les questions | false | rejeté | voulu par Jonathan (une fois, puis jamais) |
| Statut de la spec ≠ `sprint-status.yaml` | false | rejeté | aligné à la fin de la story |
| Divergence page / service si la lecture des questions échoue | low | rejeté | voulu : un doute ne bloque jamais |

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- expected: aucune erreur
- `npm run test:e2e` -- expected: connexion et Google verts
- `npm run test:sql` -- expected: message explicatif en local ; vert en CI

**Manual checks (if no CLI):**
- `npm run db:push` sur `koma-dev` (à confirmer par Jonathan), puis création d'un Compte réel : questions affichées une fois, « Passer » et réponses ramènent à la page quittée
