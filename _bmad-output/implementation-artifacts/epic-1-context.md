# Epic 1 Context : Le site en ligne, les comptes et l'accès admin

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Poser le socle vérifié du site : un visiteur lit KOMA SHOP en français ou en anglais, en thème crème ou sombre, avec en-tête, pied de page, pages À propos, FAQ, Contact, légales et 404. Il crée son Compte avec un code reçu par email (ou Google hors navigateur intégré) et déclare son âge. Jonathan accède à une admin réservée à son rôle, journalisée, où il règle son numéro WhatsApp et traite les messages de contact. Toutes les epics suivantes s'appuient sur ce socle (CI, i18n, SEO, tokens, comptes, droits, journal d'audit).

## Stories

- Story 1.1 : Socle du projet, tests et intégration continue
- Story 1.2 : Site bilingue et socle SEO
- Story 1.3 : Identité visuelle et gabarit commun
- Story 1.4 : Création de compte et connexion par code email
- Story 1.5 : Navigateurs intégrés et connexion Google
- Story 1.6 : Questions d'accueil
- Story 1.7 : Accès admin, rôles, journal et réglage WhatsApp
- Story 1.8 : Pages À propos, FAQ et Contact
- Story 1.9 : Pages légales

## Requirements & Constraints

- Mobile d'abord (375 px, aucun défilement horizontal), WCAG 2.2 AA, texte alternatif partout, navigation au clavier, un seul H1 par page.
- Aucun texte visible en dur : tout vient de `messages/fr.json` et `messages/en.json` (un test échoue si une clé manque d'un côté ; lint contre le texte en dur). Routes `/fr` et `/en`.
- Chaque page publique : metadata unique, canonique, hreflang `fr`/`en`/`x-default` (vers `/fr`), Open Graph, JSON-LD. Jamais de note, avis ni chiffre inventé. Pas de `aggregateRating` ni `review`.
- Le nom du site vient du seul réglage `nom_site` (départ « KOMA SHOP », nom définitif en suspens) ; jamais écrit en dur dans `src/` ni dans les traductions. L'adresse du site vient de `NEXT_PUBLIC_SITE_URL` uniquement (domaine non acheté).
- Secrets uniquement en variables d'environnement ; `.env.example` à jour sans valeur ; dépôt public sans secret, email, identifiant de Compte ni donnée client. Police ou fichier tiers : licence notée dans `docs/licences/`.
- Compte : code à 6 chiffres valable 10 min, renvoi après 60 s ; Compte incomplet tant que l'âge n'est pas déclaré (actions réservées refusées côté serveur) ; moins de 13 ans : Compte supprimé, rien conservé ; 13 à 17 ans : mineur (`est_mineur`). Retour post-connexion vers un chemin interne validé.
- Aucune simulation : le message « code envoyé » n'apparaît qu'après la réponse réelle de Supabase ; les tests e2e lisent le code dans la boîte de test locale.
- Textes légaux, À propos, FAQ : fournis par Jonathan ; marqueur « [Texte à fournir] » en développement, build de production en échec s'il reste dans une page publique ; ne jamais rédiger de texte légal (information manquante : demander).
- Contact : message enregistré comme tâche admin (statut `nouveau`, puis `traite`), sans email au lancement, lecture réservée à l'Admin, limitation des envois, rien de saisi n'est perdu en cas d'erreur.
- Ton : tutoiement ; aucun argot ni emoji dans les zones transactionnelles (connexion, consentements, erreurs, légal, admin).
- Fin de chaque story : lint, types, tests (Vitest, SQL, Playwright) et build verts en local et en CI. Story avec écran : axe-core sans violation, clavier, 320 px, zoom 200 %, `prefers-reduced-motion`, `forced-colors`.

## Technical Decisions

- Versions figées : Node 24.x, Next 16.4.2 (`cacheComponents: true`), React 19.3.1, TypeScript 5.9.3, Tailwind 4.3.3, supabase-js 2.118.0, `@supabase/ssr` 0.12.7, Supabase CLI 2.121.0, next-intl 4.14.9, Zod 4.6.7, Vitest 5.0.5, Playwright 1.64.1.
- Structure : `src/app/[locale]/…`, `src/modules/<module>/` (`actions.ts`, `service.ts`, `queries.ts`, `schemas.ts`, `types.ts`), `src/lib/` (supabase, auth, cache, seo, env, journal), `supabase/migrations/` (nommées `AAAAMMJJHHMMSS_verbe_objet.sql`, jamais modifier une migration appliquée), `supabase/tests/`, `tests/e2e/`, `tests/doubles/` (préfixe `TEST_`, jamais importés par `src/`, règle de lint).
- Trois clients Supabase seulement : `public.ts`, `session.ts`, `service.ts` (`server-only`). Le navigateur n'écrit jamais dans une table métier : Server Action ou route API validée par Zod. `src/proxy.ts` rafraîchit la session sans jamais rediriger une page publique.
- Variables d'environnement lues par `src/lib/env.ts` (Zod, arrêt au démarrage avec le nom de la variable, sans valeur).
- Écritures et statuts par fonctions Postgres `SECURITY DEFINER` (`search_path = ''`, `REVOKE` à `anon`/`authenticated`) ; test CI qui échoue si une fonction exécutable par ces rôles écrit. Chaque fonction d'écriture reçoit `p_auteur jsonb` construit par `src/lib/auth/auteur.ts`, sans `auth.uid()`.
- Rôles : `role_utilisateur` (`admin`, `assistant`, `benevole`), `a_le_role` seule source de vérité, vérifiée par `src/lib/auth/droits.ts` et par chaque fonction d'écriture (`KS_DROIT_REFUSE`). Droits Assistant écrits et testés, sans écran de création. Premier admin : commande documentée prenant l'email en argument, rien dans le dépôt.
- Journal : `journal_audit` alimenté par le trigger générique `journaliser()` (colonnes modifiées, emails et téléphones masqués, auteur obligatoire). Limitation des essais via `consommer_essai(cle, fenetre, maximum)`.
- RLS active sur toute nouvelle table ; lecture publique limitée aux lignes publiées ; test CI qui échoue sur une colonne lisible par `anon` nommée `prive`, `chemin` ou `note_admin`.
- Table `reglage` (module `admin`) : `nom_site`, numéro WhatsApp ; lecture par client public en cache (étiquette `reglages`, `'use cache'`, invalidation `updateTag`) ; valeur absente : « Valeur à fixer » et `KS_REGLAGE_MANQUANT`.
- Langue à l'ouverture de `/` : cookie de choix, sinon langue du navigateur (`fr*` vers `/fr`, autre langue connue vers `/en`, illisible vers `/fr`). `profil.langue` reçoit la langue de la route.
- SEO via `src/lib/seo/` (metadata, hreflang, JSON-LD `Organization`, sitemap, `robots.txt` excluant admin, compte et `/api`). Pages admin en `noindex`.
- Polices Barlow et Barlow Condensed auto-hébergées (`next/font/local`). Sakura Town : fichier local, `font-display: swap`, repli métrique Barlow Condensed ; un titre avec un glyphe absent bascule en entier en Barlow Condensed ; une option de configuration bascule tous les titres si la licence n'est pas confirmée. Jamais sur lien, bouton, prix, écran transactionnel ni admin.
- Connexion Google : bouton absent dans les navigateurs intégrés (agent détecté côté serveur par un seul module testé) ; identifiants OAuth saisis par Jonathan dans Supabase, jamais dans le dépôt.
- Environnement : développement sur `koma-dev` en ligne, sans Docker ; tests SQL exécutés par la CI GitHub Actions (aucun secret dans le workflow) ; branche `production` créée depuis un commit vert de `main` ; protection GitHub de `production` réglée à la main par Jonathan. Réglage hPanel, domaine, Resend et SMTP de Supabase Auth : story de mise en ligne (epic 9). En développement, le code de connexion part par le service par défaut de Supabase.

## UX & Interaction Patterns

- Thème « Sumi & washi » : crème par défaut, sombre par bascule `<button aria-pressed>`, choix mémorisé et appliqué par un script dans `<head>` (aucun flash) ; `forced-colors` : verre remplacé par `Canvas`. Un seul rouge #E3261C, texte blanc sur bouton rouge ; rouge en texte seulement à grande taille sur fond uni ; aucun autre rouge. Rayons, espacements (pas de 4 px, marge mobile 16 px, cible tactile 44 px) selon DESIGN.md.
- Logo : horizontal à gauche (couleur en crème, inverse en sombre), alt « KOMA SHOP », 156 px à 375 px, jamais recoloré ; les JPG d'`imports/` ne sont pas utilisés.
- En-tête mobile 64 px (logo, panier, ☰) ; ordinateur avec rubriques, thème, langue, compte. Une rubrique n'apparaît qu'avec la story qui crée sa page. Panneau ☰ opaque en `role="dialog"`, focus piégé, reste `inert`, fermeture par Échap, « Fermer le menu » ou choix d'une rubrique, focus rendu au ☰.
- Lien « Aller au contenu » en premier focalisable vers `<main id="contenu">` ; anneau de focus double, jamais masqué par l'en-tête collant.
- Pied de page : carte identité (« Fait main à Goma, RDC. NATHANGROUP SARL. ») ; Aide (FAQ, Contact, WhatsApp si réglé) et Infos légales (liens de 44 px) apparaissent avec leurs pages.
- Sélecteur FR/EN garde la même page. Composants de base à livrer : bouton principal et secondaire (`aria-disabled` focalisable avec raison reliée, jamais d'opacité réduite), boîte de dialogue, squelette, message d'état, motif manga (≤ 6 %, jamais sur photo ni formulaire). Animations coupées en `prefers-reduced-motion`, contenu visible sans JavaScript.
- Formulaires : libellé visible, erreur sous le champ reliée par `aria-describedby`, résumé `role="alert"`, rien n'est ressaisi après un échec. Champ de code unique `one-time-code` (collage permis, validité et délai de renvoi écrits, états code faux, expiré, email non reçu avec « Changer d'adresse email »).
- Bandeau navigateur intégré « Ouvrir dans Chrome » : non bloquant, `role="region"` libellé, fermeture 44 px mémorisée. Libellé « Continuer avec Google » en texte seul.
- Questions d'accueil facultatives, affichées une fois, « Passer » ramène à la page quittée ; la question sur l'univers est masquée tant qu'aucun univers n'existe ; sélecteur à deux options sans action au choix.
- Admin : barre latérale sur ordinateur, onglets en bas sur mobile, sans Sakura Town ni motif manga, seulement les entrées existantes ; compteur de tâches dans la navigation ; un non-admin voit la 404, un visiteur non connecté est envoyé vers la connexion.
- Page 404 soignée : H1 « Page introuvable », lien vers l'accueil, en `/fr` et `/en`. FAQ : accordéons indépendants avec JSON-LD `FAQPage` des seules vraies questions.

## Cross-Story Dependencies

- 1.1 précède tout (CI, clients Supabase, env, tests). 1.2 crée `reglage` et `nom_site`, utilisés par 1.3 (pied de page), 1.7 (écran de réglage) et 1.8. 1.3 fournit le sélecteur de langue demandé par 1.2 et les composants de base réutilisés partout.
- 1.4 crée `profil`, l'âge et `est_mineur` ; 1.5 et 1.6 en dépendent. 1.6 enregistre des réponses utilisées plus tard pour l'origine des ventes et l'email « nouveau produit dans ton univers » (epic 9) et attend les univers de l'epic 2 (la story 2.1 ajoute alors la question sur l'univers à l'étape « questions »).
- 1.7 pose `a_le_role`, `journal_audit`, `journaliser()` et la coquille admin ; 1.8 en dépend (liste des messages, tâche admin, WhatsApp). 1.8 et 1.9 ajoutent leurs liens au pied de page et leurs rubriques à l'en-tête.
- Hors epic : les textes légaux, À propos et FAQ dépendent de Jonathan (textes fournis et validés juridiquement) ; la licence Sakura Town, le nom définitif du site et le domaine ne bloquent que la mise en ligne (epic 9). Les epics 2 à 9 réutilisent i18n, SEO, tokens, rôles, journal et `reglage`.
