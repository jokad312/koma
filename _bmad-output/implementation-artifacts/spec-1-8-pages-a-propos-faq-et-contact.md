---
title: 'Story 1.8 : pages À propos, FAQ et Contact'
type: 'feature'
created: '2026-10-22'
status: 'done'
baseline_commit: '0b6a76723ebd87d828f669633e857ae4fc712be5'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le visiteur ne peut ni découvrir Jonathan, ni lire une FAQ, ni lui écrire : aucune page vitrine, aucun message de contact, aucun bouton WhatsApp (le numéro réglé en 1.7 n'est pas lisible du public), et rien n'empêche un texte « [Texte à fournir] » d'être publié.

**Approach:** Pages `/[locale]/a-propos`, `/faq`, `/contact` dont tous les textes viennent de `messages/*.json` (textes de Jonathan manquants = « [Texte à fournir] »), contrôle de build contre ce marqueur déclenché par une variable d'environnement de déploiement, formulaire de contact enregistré dans `message_contact` par une fonction d'écriture limitée par `consommer_essai` (créée ici : elle n'existe pas encore), liste des messages dans l'admin avec compteur de tâches, lecture publique de `numero_whatsapp`, liens dans l'en-tête et le pied de page.

## Boundaries & Constraints

**Always:** Migration nouvelle seulement. Règles de fonction d'écriture de la 1.7 : `SECURITY DEFINER`, `search_path = ''`, `p_auteur jsonb` en premier, `REVOKE` public/anon/authenticated, `GRANT` service_role, droit revérifié par `exiger_admin` (réutilisée), `ks.auteur` posé avant le DML. Marqueur exact « [Texte à fournir] », une seule source dans le code (`src/lib/vitrine/marqueur.ts`), jamais dans un texte inventé : À propos (portrait, histoire, atelier) et chaque question et réponse de la FAQ (clés `paiement`, `livraison`, `delais`, thèmes de l'epic) restent au marqueur ; libellés d'interface (boutons, champs, erreurs, titres), tutoiement, sobres, ni emoji, écrits normalement. Aucune photo, aucun chiffre, aucun témoignage. H1 : « Jonathan et son atelier », « FAQ », « Contact » (EN traduits). Metadata, Open Graph, canonique/hreflang et JSON-LD par `construireMetadata` : `WebPage` (À propos), `ContactPage` (Contact), `FAQPage` (FAQ) ne listant que les paires dont ni la question ni la réponse ne contient le marqueur (aucune paire réelle : pas de `FAQPage`, `WebPage` à la place) ; les trois pages au sitemap.
Contrôle de build : `scripts/verifier-marqueurs.mjs` lancé par `prebuild`, actif seulement si `KOMA_VERIFIER_TEXTES=true` (posée uniquement sur Hostinger ; absente de la CI, du dev et du build local ; déclarée dans `.env.example` avec ce commentaire, hors `env.ts`) ; il lit `fr.json` et `en.json` pour les espaces de noms des pages publiques (liste unique, à compléter par la 1.9) et sort en erreur en nommant les clés. FAQ : `<details>/<summary>` natifs indépendants (plusieurs ouverts), 1 colonne mobile, 2 à `lg`, cartes `rounded-lg`.
WhatsApp : `lireNumeroWhatsapp()` (cache `reglages`, `null` si absent, sans repli) ; la politique RLS `reglage_lecture_publique` est recréée pour `nom_site` et `numero_whatsapp` ; bouton secondaire « Écrire sur WhatsApp » vers `https://wa.me/<chiffres>`, nouvel onglet, `rel="noopener noreferrer"`, sans message prérempli (hypothèse non validée) ; absent si pas de numéro (À propos, Contact, carte Aide).
Contact : nom (1 à 80), email (valide, ≤ 254), message (10 à 2000) ; libellés visibles, erreur sous le champ liée par `aria-describedby`, résumé `role="alert"` ; Server Action : Zod, `consommer_essai` deux fois, fenêtre fixe d'une heure : d'abord par email saisi (clé `contact:email:` + empreinte HMAC de l'email normalisé trim + minuscules ; `LIMITE_CONTACT_PAR_EMAIL_PAR_HEURE = 3`, contre le harcèlement), puis par IP (clé `contact:` + empreinte de l'IP ; `LIMITE_CONTACT_PAR_IP_PAR_HEURE = 30`, large car en RDC le CGNAT des opérateurs mobiles et les cybercafés placent beaucoup d'utilisateurs derrière une même IP ; IP absente = seau commun) ; email d'abord pour qu'un email à sa limite ne consomme pas l'essai de l'IP ; jamais d'email brut dans `limite_essai` ni dans les logs, puis `enregistrer_message_contact` (auteur `{"type":"visiteur"}`, statut `nouveau`, langue de la route) ; « Message envoyé » seulement après la réponse réelle, sinon la saisie reste ; limite atteinte : message clair de réessai plus tard. `message_contact` et `limite_essai` : RLS sans politique ni droit pour anon/authenticated ; l'insertion n'est pas journalisée (données personnelles), le passage à `traite` l'est (trigger `journaliser` sur update).
Admin : nouveau droit `messages.traiter`, Admin seulement ; page `/admin/messages` (droit vérifié sur la page, `noindex`, coquille de la 1.7) listant les messages `nouveau` (nom, email en `mailto:`, message, date) avec « Marquer comme traité » (action : droit, rpc `marquer_message_traite`, succès après réponse) et état vide ; entrée « Messages » dans `NavigationAdmin` avec compteur lu par client service (erreur : pas de compteur, jamais de faux zéro). En-tête : rubrique À propos ; pied : carte Aide (FAQ, Contact, WhatsApp si réglé).
Lint, types, tests, build verts ; axe sans violation, clavier, 375 px.

**Never:** Aucun email envoyé, aucune purge ni durée de conservation (Q-5 ouverte), aucun CAPTCHA, aucune pièce jointe, aucune page légale ni lien légal (1.9), aucune photo ni image, aucun texte d'À propos ou de FAQ rédigé, aucun faux succès hors tests `TEST_`, pas de lecture publique d'un autre réglage, pas de modification d'une migration appliquée ; je ne lance ni `db:push` ni `npm run dev`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Envoi valide | champs valides, sous la limite | ligne `nouveau`, « Message envoyé », champs vidés | N/A |
| Champ invalide | nom vide, email faux, message court | erreur sous le champ, rien d'enregistré | codes de champ |
| Limite dépassée | 4e envoi en 1 h avec le même email, ou 31e depuis la même IP | rien d'enregistré, saisie gardée, message de réessai | `trop_d_essais` |
| Échec base | rpc en erreur | pas de succès, saisie gardée | `generique` |
| Sans numéro WhatsApp | réglage absent | aucun bouton, aucun lien Aide WhatsApp | N/A |
| Production avec marqueur | `KOMA_VERIFIER_TEXTES=true`, marqueur présent | build en échec, clés nommées | exit 1 |
| Sans la variable | dev, CI | build passe, marqueur affiché | N/A |
| FAQ sans paire réelle | tout au marqueur | pas de JSON-LD `FAQPage` | N/A |
| Messages admin | admin | liste, compteur, marquer traité journalisé | non-admin : 404 |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261022180000_creer_roles_et_admin.sql` -- modèle (`exiger_admin`, `enregistrer_reglage`) ; ne pas modifier. Nouvelle migration `..._creer_contact_et_limite_essai.sql` : `limite_essai`, `consommer_essai(p_cle, p_fenetre_secondes, p_maximum) returns boolean`, `message_contact`, `enregistrer_message_contact`, `marquer_message_traite`, politique `reglage_lecture_publique` recréée.
- `supabase/tests/reglage.test.sql` (« anon ne lit que nom_site », 1 ligne) et `reglage_admin.test.sql` (l. 55 « anon ne lit pas le numéro ») -- à adapter : le numéro devient public ; autres tests intacts. `garde_ecritures.test.sql` doit rester vert sans liste blanche. Nouveaux `contact.test.sql`, `limite_essai.test.sql`.
- `src/lib/reglages.ts`, `src/lib/cache/etiquettes.ts` -- ajouter `lireNumeroWhatsapp` (même `'use cache'`, `cacheTag(reglages)`), réutiliser `lireReglagePublic` sans dupliquer.
- `src/lib/auth/matrice-droits.ts`, `tests/unit/droits.test.ts` -- droit `messages.traiter` (refusé à l'Assistant ; ajouter aux interdits testés).
- `src/modules/contact/{actions,service,schemas,types,dependances}.ts`, `tests/doubles/TEST_dependances-contact.ts` -- calqués sur `src/modules/admin/`. Messages admin : `src/modules/admin/` (`queries.ts`, `actions.ts`, `service.ts`).
- `src/app/[locale]/{a-propos,faq,contact}/page.tsx` -- modèle `connexion/page.tsx` (`construireMetadata`, `JsonLd`, `TitreVitrine` pour les H1) ; `src/components/vitrine/{BoutonWhatsApp,FormulaireContact,QuestionsFaq}.tsx`.
- `src/app/[locale]/admin/messages/page.tsx`, `src/components/admin/{CoqueAdmin,NavigationAdmin}.tsx` -- CoqueAdmin devient asynchrone et passe le compteur ; modèle `reglages/page.tsx`.
- `src/components/layout/{PiedDePage,rubriques}.ts(x)`, `src/app/[locale]/layout.tsx` -- carte Aide (prop `numeroWhatsapp`), rubrique `aPropos` (`href: "/a-propos"`) ; `src/app/sitemap.ts` -- trois chemins ; `src/lib/seo/jsonld.ts` -- `faqJsonLd`, `pageContactJsonLd`.
- `scripts/verifier-marqueurs.mjs`, `package.json` (`prebuild`), `.env.example`, `README.md` (variable de déploiement), `src/lib/supabase/types.ts` (à la main), `messages/{fr,en}.json` (`APropos`, `Faq`, `Contact`, `Pied.aide`, `Admin.messages`, `Admin.nav`, `Metadata.*`, `Navigation.rubriques.aPropos`).
- `tests/unit/`, `tests/e2e/vitrine.spec.ts` -- l'envoi réel seulement si `MAILPIT_URL` ou base jetable (comme les tests de connexion), sinon noté.

## Tasks & Acceptance

**Execution:**
- [ ] migration + `supabase/tests/*.test.sql` -- tables, fonctions, politique ; RLS fermée, limite, journal du `traite`, refus sans droit, adaptation des deux tests existants -- AD-3, AD-22, AD-30
- [ ] `src/lib/vitrine/marqueur.ts`, `scripts/verifier-marqueurs.mjs`, `package.json`, `.env.example`, `README.md` -- contrôle de build à déclencheur explicite + tests (avec et sans variable)
- [ ] `src/lib/reglages.ts`, `matrice-droits.ts`, `src/modules/contact/*`, `src/modules/admin/*` + types -- numéro public, droit, envoi, liste, marquage, mappage d'erreurs sans donnée personnelle
- [ ] pages, composants vitrine et admin, en-tête, pied, sitemap, JSON-LD, `messages/*.json` -- règles ci-dessus
- [ ] tests Vitest (service, actions, formulaire, bouton absent sans numéro, FAQ, JSON-LD sans marqueur, compteur, pied) et e2e axe/clavier/375 px

**Acceptance Criteria:**
- Given `KOMA_VERIFIER_TEXTES=true` et un marqueur dans un espace de noms public, when `npm run build`, then échec nommant les clés ; sans la variable, la CI reste verte
- Given un visiteur ou un connecté (anon/authenticated), when il lit ou écrit `message_contact` ou `limite_essai` par l'API, then refusé ; seul le serveur écrit
- Given un message envoyé, when l'admin ouvre `/admin/messages`, then le message et le compteur apparaissent ; marqué traité, il disparaît et `journal_audit` porte l'auteur

## Implementation Notes

## Spec Change Log

- 2026-10-22 (demande de Jonathan, bloc frozen modifié explicitement) : limite de contact 5 par heure et par IP remplacée par 30 par IP et 3 par email saisi (CGNAT et cybercafés en RDC) ; message `trop_d_essais` : « Trop de messages envoyés, réessaie dans un moment. » ; aucune migration (`consommer_essai` prenait déjà la limite en paramètre).

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| `ListeMessages` / `BoutonMarquerTraite` sans test de rendu (refresh, mapping d'erreurs) | medium | patch | aucun test ne les importe |
| `lireNumeroWhatsapp` sans test (null si absent, relance sinon) | medium | patch | aucun test |
| `lireNumeroWhatsapp` relance une erreur de lecture : toutes les pages publiques tombent pour un réglage facultatif | medium | patch | appelé dans le layout de langue ; masquer le lien et journaliser |
| Retours à la ligne CRLF comptés double : message accepté par le navigateur, refusé par le serveur | low | patch | normaliser avant validation, correction directe |
| `message_introuvable` : liste obsolète à l'écran | low | patch | ajouter `router.refresh()` |
| `KOMA_VERIFIER_TEXTES` = `TRUE`/`1` : contrôle ignoré en silence | medium | patch | accepter `true`/`1` sans casse |
| `ESPACES_PUBLICS` ne couvre pas `Metadata.*` ni `Navigation` | maybe-false | patch (vérifier) | à vérifier : si ces textes portent le marqueur, les ajouter |
| IP : premier `x-forwarded-for` falsifiable, ou seau commun sans IP | maybe-false (medium) | defer | dépend du proxy Hostinger, à vérifier au déploiement |
| `limite_essai` jamais purgée | low | defer | tâche Cron à prévoir |
| Mention vie privée / consentement sur le formulaire | low | defer | pages légales en 1.9 ; ajouter le lien alors |
| Fenêtre fixe (jusqu'à 10 envois à cheval) | low | rejeté | « fenêtre fixe » voulu par la spec |
| Honeypot, email à Jonathan, vue des messages traités, conservation | low | rejeté | hors périmètre (règle 14, Q-5) |
| Numéro WhatsApp invisible s'il contient tirets | false | rejeté | le schéma admin (1.7) impose déjà `+` et 8 à 15 chiffres |
| Troncature `maxLength`, date invalide, regex email SQL plus lâche, textes d'état, `AboutPage`, OG | low | rejeté | pas de dommage constaté |
| `CoqueAdmin` asynchrone hors Suspense | false | rejeté | build et e2e verts |
| Migration `drop policy` sans `if exists` | false | rejeté | migration exécutée une seule fois |
| `consommer_essai` sans `ks.auteur` | maybe-false | rejeté | table non journalisée ; la CI l'établit par `limite_essai.test.sql` |
| 404 d'un connecté non admin sur `/admin/messages` | low | rejeté | même mécanisme que 1.7 |

## Design Notes

`consommer_essai` n'existe pas encore (AD-22 la prévoit pour toutes les limitations) : cette story la crée, fenêtre fixe, comptage atomique par `insert … on conflict`, sans nettoyage planifié. Le numéro WhatsApp devient lisible par anon : il est affiché publiquement, la lecture est limitée à cette clé ; `a_le_role` (report de la 1.7) n'est pas concernée. Détails au développeur : noms des clés de messages, forme des cartes, empreinte de l'IP (hachage sans stockage de l'adresse brute).

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- expected: aucune erreur
- `KOMA_VERIFIER_TEXTES=true npm run build` -- expected: échec tant que des marqueurs restent
- `npm run test:sql` -- expected: explication en local, vert en CI ; `npm run test:e2e` -- vert

**Manual checks (if no CLI):**
- Après `db:push` confirmé par Jonathan : envoyer un message, le voir dans `/fr/admin/messages`, le marquer traité, régler le numéro WhatsApp et voir le bouton apparaître
