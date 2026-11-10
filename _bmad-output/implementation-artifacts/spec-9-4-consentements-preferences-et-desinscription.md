---
title: 'Story 9.4 : Consentements, Préférences et désinscription'
type: 'feature'
created: '2026-11-08'
status: 'done'
baseline_commit: '0af258c'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le client ne peut ni consentir aux Emails commerciaux, ni choisir lesquels il reçoit, ni se désinscrire d'un geste ; la boîte d'envoi n'a aucune règle pour ces emails (FR-45, AD-9, AD-34).

**Approach:** Table `consentement` (objet, version, date, retrait) et `desinscription` ; case facultative à la création de Compte et à l'étape de commande ; page « Préférences » à trois interrupteurs ; lien de désinscription signé ; règle unique `email_commercial_autorise` dans la boîte d'envoi.

## Boundaries & Constraints

**Always:**
- Décision de Jonathan (2026-11-08) : la case unique active « Relances et rappels » et « Nouveautés de mon univers » ; « Alertes Festival » se règle dans Préférences (et par « Me prévenir », 7.3).
- Texte de la case (fourni par Jonathan, 2026-11-08) : FR « Recevoir par email les nouveautés de mes univers et les rappels utiles. Tu peux te désabonner à tout moment. » ; EN « Email me new arrivals from my universes and helpful reminders. You can unsubscribe at any time. »
- Lien de désinscription signé HMAC avec `DESINSCRIPTION_SECRET` (généré dans `.env.local`, accord de Jonathan, à ajouter dans Hostinger en 9.9).
- Décision de Jonathan (2026-11-10) : l'ouverture du lien ne désinscrit jamais (antivirus et aperçus ouvrent les liens seuls) ; le lien ouvre une page de confirmation avec le bouton « Me désinscrire » (POST signé). Les Emails commerciaux portent `List-Unsubscribe` et `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058) vers une route POST signée.
- Case jamais pré-cochée, facultative, jamais bloquante ; consentement enregistré avec version et date ; retrait = `retire_le`, jamais de suppression.
- « Actif » / « Désactivé » mis à jour après l'enregistrement réel.
- Email commercial `ignore` avec motif : sans consentement, désinscription, Compte mineur (`emails_commerciaux_mineurs` désactivé), autre Email commercial parti il y a moins de 2 jours. Un email lié à un achat n'y passe jamais.

**Never:** aucun gabarit ni déclencheur d'Email commercial (9.5, 9.6, 7.3) ; aucun écran admin pour `emails_commerciaux_mineurs`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Case cochée | création de Compte ou Commande | relances + nouveautés actifs, version et source | échec journalisé, jamais bloquant |
| Interrupteur | bascule | état relu en base | échec : état précédent + message |
| Lien valide | c + s signés, ouverture (GET) | page de confirmation, RIEN ne change | N/A |
| Bouton ou un clic | POST signé (bouton, ou List-Unsubscribe-Post RFC 8058) | désinscription, consentements retirés | jeton altéré : refusé ; panne : message d'erreur |
| Lien invalide | signature fausse ou absente | « lien non valide », base jamais appelée | N/A |
| Mineur | âge < 18, réglage désactivé | `compte_mineur`, message dans Préférences | N/A |
| 2 jours | autre Email commercial envoyé < 2 j | `ecart_2_jours` | N/A |
| Achat | email lié à un achat | toujours envoyé | N/A |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261231140000_consentements_et_desinscription.sql`, `20261231150000_envoi_modeles_commerciaux.sql` (valeurs d'énumération AD-9, sans gabarit).
- `src/modules/preferences/*` (types, lien signé, service, dépendances, action), `src/components/compte/InterrupteursPreferences.tsx`, pages `compte/preferences` et `desinscription`.
- Case : `connexion/QuestionsAccueil.tsx` + module `comptes` ; `FormulaireCommande.tsx` + module `commande`.
- Boîte d'envoi : `envois/{types,service,dependances}.ts`.

## Tasks & Acceptance

**Execution:**
- [x] Migrations, module, pages, cases, boîte d'envoi, messages, `.env.example`.
- [x] Tests : `supabase/tests/consentements.test.sql` (30), Vitest `preferences-service`, `preferences-ui`, `envois-commerciaux`, comptes et commande.

**Acceptance Criteria:**
- Given un Email commercial planifié, when la boîte d'envoi le traite, then il n'est rendu que si `email_commercial_autorise` l'autorise.

## Implementation Notes

- Les cinq valeurs commerciales de l'énumération sont ajoutées maintenant (AD-9 les liste) pour que la règle soit testée en base ; elles n'ont ni gabarit ni déclencheur.
- Vérifié sur koma-dev : `anon` refusé (42501) sur `desinscrire` et `consentement`. Page de désinscription vérifiée en `next start` (lien invalide FR/EN, aucun faux succès, noindex).
- Limite connue : un lien de désinscription ouvert par un logiciel de prévisualisation d'emails désinscrit aussi (effet immédiat exigé par la story).

## Spec Change Log

- 2026-11-10, décision de Jonathan : la désinscription à l'ouverture du lien est remplacée par une confirmation (POST signé) et par la désinscription en un clic RFC 8058 (`POST /api/desinscription`). Évite : un client désinscrit par un antivirus ou un aperçu de lien. À garder : signature HMAC vérifiée avant tout appel à la base, désinscription idempotente.

## Review Triage Log

| Constat (relecteur) | Verdict | Preuve / suite |
|---|---|---|
| `emails_commerciaux_bloques_mineur` ouverte à service_role par défaut (EC) | high | droits par défaut de Supabase ; corrigé (`20261231160000`), vérifié sur koma-dev (42501) |
| Désinscription non idempotente : lignes et journal à chaque rechargement (BH, EC) | medium | corrigé (même migration), test |
| Confirmation muette sur les Alertes Festival (BH) | medium | `desinscrire` retire tout ; textes FR/EN corrigés |
| « Passer » efface la case cochée (BH, EC) | medium | corrigé, test |
| Consentement qui lèverait après une Commande créée (BH) | medium | try/catch local, test |
| Focus clavier perdu (`disabled`) (BH, EC) | medium | `aria-disabled`, test |
| Session expirée : message générique (EC) | low | message `erreurSession` |
| Tests UI : case cochée jamais envoyée (VG) | medium | tests commande et connexion ajoutés |
| Réactivation après désinscription non testée (BH) | low | assertion pgTAP ajoutée (33) |
| Constantes dupliquées (BH) | low | `OBJETS_CASE_EMAILS` utilisé ; liste SQL/TS des modèles commerciaux : reportée |
| Lien construit avec un identifiant invalide (EC) | low | erreur levée |
| GET qui désinscrit (scanners de liens) (BH, EC) | maybe-false | effet immédiat exigé par la story ; limite notée, à valider par Jonathan |
| En-tête List-Unsubscribe (BH) | defer | aucun Email commercial avant 9.5/9.6 |
| Écart de 2 jours sous concurrence / envoi non marqué (BH, EC) | low | lot traité en séquence par une seule tâche ; reporté |
| Rotation de la clé de désinscription (BH) | defer | reportée |
| Lectures `dependances.ts` non testées (VG) | defer | aucun test de `dependances.ts` dans le dépôt ; à faire avec 9.5/9.6 |
| Identifiant du Compte dans l'URL (BH) | low | rejeté (lien signé, page noindex) |
| `versConnexion` importé de `commande` (BH) | low | rejeté (même usage que « Mes commandes ») |
| Échec silencieux du consentement (EC) | low | journalisé ; la case est facultative ; rejeté |

## Verification

**Commands:**
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` -- sans erreur ; CI (pgTAP) verte

### Revue du changement du 2026-11-10 (désinscription par POST signé)

| Constat (relecteur) | Verdict | Preuve / suite |
|---|---|---|
| Rendu de la page non testé : « ouvrir le lien ne change rien » non protégé (BH, VG) | high | contenu extrait dans `ResultatDesinscription`, test de rendu serveur : jamais d'appel à la base |
| En-têtes vérifiés pour le panier seulement (BH, VG) | medium | tests pour les trois modèles |
| Réponse 500 de la route non testée (BH, VG) | medium | test ajouté |
| Corps `List-Unsubscribe=One-Click` non exigé (BH, EC) | medium | exigé (400 sinon) ; test |
| Exception de configuration hors du contrôle de la route (EC) | low | `try/catch`, 500 sans cache |
| Résultat hors zone d'état, focus perdu (BH) | low | zone `role="status"` stable |
| Clé absente affichée comme « non enregistrée », sans journal (BH) | low | message `indisponible` et journal |
| Construction des deux liens dupliquée (BH) | low | fonction commune |
| `desinscrireAction` mal typée (BH) | low | entrée `unknown`, contrôlée à l'exécution |
| Composant rangé dans `compte/` (BH) | low | déplacé dans `components/preferences/` |
| Appels répétés écrivent à chaque fois (BH) | false | `desinscrire` est idempotent depuis `20261231160000` |
| Texte anglais du rappel de Kit modifié (BH, VG) | false | demandé par Jonathan (point 3 du 2026-11-10) |
| Compte disparu : bouton puis « lien non valide » (EC) | low | cas rarissime ; rejeté |
