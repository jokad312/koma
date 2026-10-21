# Epic 1 Context: Le site en ligne, les comptes et l'accès admin

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Le visiteur découvre la boutique en français ou en anglais, en thème crème ou sombre, avec en-tête, pied de page et pages À propos, FAQ, Contact et légales. Il crée son Compte avec un code reçu par email (ou Google hors navigateur intégré) et déclare son âge. Jonathan se connecte à une admin réservée à son rôle, règle son numéro WhatsApp et traite les messages de contact. L'epic pose le socle technique, visuel et de droits dont tous les suivants dépendent.

## Stories

- Story 1.1: Socle du projet, tests et intégration continue
- Story 1.2: Site bilingue et socle SEO
- Story 1.3: Identité visuelle et gabarit commun
- Story 1.4: Création de compte et connexion par code email
- Story 1.5: Navigateurs intégrés et connexion Google
- Story 1.6: Questions d'accueil
- Story 1.7: Accès admin, rôles, journal et réglage WhatsApp
- Story 1.8: Pages À propos, FAQ et Contact
- Story 1.9: Pages légales

## Requirements & Constraints

- Site en /fr et /en ; aucun texte visible en dur hors de messages/fr.json et messages/en.json (clés identiques dans les deux langues, vérifié par test et lint).
- Langue de `/` : cookie du sélecteur d'abord, sinon langue du navigateur (fr* vers /fr, autre langue connue vers /en, absente vers /fr).
- Chaque page publique : titre et description uniques, canonical, hreflang fr/en/x-default (vers /fr), Open Graph, un seul H1, JSON-LD (Organization ; FAQPage avec questions réelles seulement). Sitemap et robots (exclure admin, compte, /api). Page 404 en deux langues. Aucun avis, chiffre ni témoignage inventé.
- Le nom du site vient uniquement du réglage `nom_site` (jamais en dur). L'adresse du site vient uniquement de NEXT_PUBLIC_SITE_URL.
- Textes non fournis par Jonathan (À propos, FAQ, légal) : « [Texte à fournir] » en développement, le build de production échoue s'il reste dans une page publique. Aucun texte légal rédigé par le code.
- Connexion par code email à 6 chiffres (10 min, renvoi après 60 s), sans mot de passe ; Google absent dans les navigateurs intégrés (Instagram, Facebook, TikTok) avec bandeau « Ouvrir dans Chrome ». Âge obligatoire : Compte incomplet tant que non déclaré ; moins de 13 ans, Compte supprimé ; 13 à 17 ans, mineur. Retour à la page quittée, chemin validé côté serveur.
- Questions d'accueil facultatives, une seule fois, avec « Passer ». La question « univers » est masquée tant qu'aucun univers n'existe.
- Admin : 404 pour tout Compte sans rôle `admin`, noindex, rôle `assistant` défini et testé sans écran de création. Réglages : WhatsApp et `nom_site`, succès affiché seulement après écriture réelle, « Valeur à fixer » si vide.
- Contact : message enregistré (statut `nouveau`), sans email au lancement, limité par `consommer_essai`, marquage `traite` journalisé, compteur dans la navigation admin. Bouton WhatsApp masqué si aucun numéro.
- Transverse : mobile d'abord (375 px, sans défilement horizontal), axe-core sans violation, clavier, 320 px, zoom 200 %, reduced-motion, forced-colors ; aucun secret ni donnée client dans le dépôt ; aucune simulation hors tests.

## Technical Decisions

- Next.js 16 (App Router, cacheComponents), TypeScript, Tailwind 4, next-intl, Supabase ; versions figées dans package.json, Node 24.
- Trois clients Supabase exactement dans `src/lib/supabase/` (public, session, service ; service importe `server-only`). `src/proxy.ts` rafraîchit la session sans rediriger les pages publiques.
- `src/lib/env.ts` (Zod) arrête le démarrage si une variable obligatoire manque, sans afficher de valeur ; `.env.example` à jour, sans valeur.
- Toute écriture passe par Server Action ou route API validée par Zod. Chaque story crée ses tables par nouvelle migration (jamais modifier une migration appliquée), RLS sur toute table.
- Table `reglage` lue via le client public mis en cache, étiquette `reglages`. Modèle de droits : `role_utilisateur`, `a_le_role`, `src/lib/auth/droits.ts`, `auteur.ts` (p_auteur depuis la session), trigger `journaliser()` vers `journal_audit` (emails et téléphones masqués), écriture refusée sans auteur, erreurs `KS_DROIT_REFUSE` et `KS_REGLAGE_MANQUANT`.
- Tests SQL en CI : aucune fonction exécutable par anon/authenticated n'écrit ; aucune colonne lisible par anon nommée `prive`, `chemin` ou `note_admin`. Doubles de test dans `tests/doubles/` préfixés `TEST_`, jamais importés depuis `src/`.
- Polices : Barlow et Barlow Condensed auto-hébergées (`next/font/local`, licences dans `docs/licences/`) ; Sakura Town locale avec repli Barlow Condensed (une option de configuration bascule les titres) ; mise en ligne avec Sakura Town bloquée par Q-F1.
- CI GitHub Actions (lint, typecheck, Vitest, tests SQL, build) sans secret ; branche `production` protégée.

## UX & Interaction Patterns

- Tokens exacts de DESIGN.md pour les deux thèmes ; un seul rouge #E3261C, texte des boutons rouges #FFFFFF. Thème mémorisé, appliqué avant le premier rendu (script dans head, sans flash) ; aria-pressed sur la bascule.
- En-tête : logo horizontal à gauche (couleur en crème, inverse en sombre), panier et ☰ à droite ; rubriques dont la page n'existe pas masquées. Menu ☰ en dialog opaque, focus géré, reste de la page inert, Échap ferme.
- Lien « Aller au contenu » vers `main#contenu`, double anneau de focus jamais masqué par l'en-tête collant. Le sélecteur de langue garde la page.
- Pied de page : carte identité « Fait main à Goma, RDC. NATHANGROUP SARL. » ; cartes Aide et Infos légales apparaissent avec leurs pages.
- Composants de base : boutons (secondaire avec aria-disabled et raison reliée), dialogue, squelette, message d'état, motif manga (6 % max, jamais sur photo). Champ de code unique one-time-code. FAQ en accordéons indépendants. Libellés de formulaire visibles. Admin : barre latérale sur ordinateur, onglets en bas sur mobile, sans Sakura Town ni motif.

## Cross-Story Dependencies

- 1.1 précède tout ; 1.2 crée `reglage` et `nom_site`, utilisés par 1.3 (pied de page) et 1.7 (réglages).
- 1.3 fournit gabarit et composants à 1.4 à 1.9 ; le sélecteur de langue de 1.3 alimente le cookie de 1.2.
- 1.4 (profil, âge) précède 1.5 (Google, même règle d'âge) et 1.6 (réponses dans le profil).
- 1.7 (rôles, journal, admin, WhatsApp) précède 1.8 (liste admin des messages, bouton WhatsApp) ; 1.8 et 1.9 ajoutent leurs liens dans en-tête et pied de page.
- Vers les autres epics : les questions d'accueil servent l'origine des ventes et les emails ciblés (epic 9) ; l'univers est créé dans l'admin à l'epic 2 ; la date de version des textes légaux sera enregistrée par les commandes (epic 4) ; la configuration de production (hPanel, Resend, SMTP Supabase Auth) est faite en epic 9.
- Contenus dépendants de Jonathan : textes (Q-5, Q-10), licence Sakura Town (Q-F1), nom définitif (Q-N1), domaine (Q-D1).
