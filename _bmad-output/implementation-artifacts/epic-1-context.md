# Epic 1 Context: Le site en ligne, les comptes et l'accès admin

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Poser le socle vérifié de KOMA SHOP : le visiteur découvre le site en français ou en anglais, en thème crème ou sombre, avec en-tête, pied de page, pages À propos, FAQ, Contact, légales et 404. Il crée son Compte avec un code reçu par email (ou Google hors navigateur intégré) et déclare son âge. Jonathan accède à une admin réservée à son rôle, journalisée, où il règle son numéro WhatsApp et traite les messages de contact. Tous les epics suivants s'appuient sur ce socle.

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

- Routes sous `/fr` et `/en` ; la langue de `/` vient d'abord du cookie du sélecteur, puis de la langue du navigateur (`fr*` vers `/fr`, autre langue connue vers `/en`, absente vers `/fr`). Aucun texte visible en dur hors de `messages/fr.json` et `messages/en.json` ; clés identiques dans les deux langues (test et lint).
- Le nom du site vient uniquement du réglage `nom_site` (valeur de départ « KOMA SHOP », nom non définitif). L'adresse du site vient uniquement de `NEXT_PUBLIC_SITE_URL` (domaine non acheté).
- Chaque page publique : titre et description uniques, canonique, hreflang `fr`/`en`/`x-default` (vers `/fr`), Open Graph, un seul H1, JSON-LD adapté (Organization sans note ni avis ; FAQPage avec seulement de vraies questions). Plan du site et `robots.txt` (admin, compte et `/api` exclus). 404 en `/fr` et `/en`.
- Connexion : code à 6 chiffres par email, valable 10 min, renvoi après 60 s, sans mot de passe ; en développement, envoi par le service par défaut de Supabase sur `koma-dev`. Message de succès seulement après réponse réelle (règle 13).
- Un Compte reste incomplet tant que l'âge n'est pas déclaré : actions réservées refusées côté serveur. Moins de 13 ans : refus et suppression du Compte ; 13 à 17 ans : `est_mineur` vrai. Chemin de retour après connexion validé côté serveur (adresse externe refusée).
- Navigateur intégré (Instagram, Facebook, TikTok) : bandeau non bloquant « Ouvrir dans Chrome », bouton Google masqué, détection serveur par un seul module. Les identifiants Google OAuth sont saisis par Jonathan dans Supabase, jamais dans le dépôt.
- Textes que Jonathan n'a pas fournis (À propos, FAQ, légal : Q-5, Q-10) : « [Texte à fournir] » en développement, build de production en échec s'il reste dans une page publique. Aucun texte légal rédigé par le code. Aucune photo, chiffre ni témoignage inventé.
- Polices : Barlow et Barlow Condensed auto-hébergées, licences notées dans `docs/licences/` ; Sakura Town avec repli, mise en ligne bloquée par Q-F1.
- Mobile d'abord (375 px sans défilement horizontal), WCAG 2.2 AA, texte alternatif sur chaque image, clavier. Règle commune des stories avec écran : Playwright vérifie axe-core, clavier, 320 px, zoom 200 %, `prefers-reduced-motion`, `forced-colors`.
- Admin : numéro WhatsApp et `nom_site` réglables ; un réglage sans valeur affiche « Valeur à fixer » et la fonction qui en dépend renvoie `KS_REGLAGE_MANQUANT`. Messages de contact enregistrés comme tâche admin, sans envoi d'email au lancement, conservation ouverte (Q-5).

## Technical Decisions

- Next.js 16.4.2 App Router, `cacheComponents: true`, React 19, TypeScript, Tailwind 4.3.3, next-intl 4.14.9, Zod 4, Node 24 ; versions figées. Monolithe modulaire : modules dans `src/modules/<module>/` (`actions.ts`, `service.ts`, `queries.ts`, `schemas.ts`), chaque table appartient à un seul module.
- Trois clients Supabase seulement, dans `src/lib/supabase/` : `public.ts` (anon, lectures en cache), `session.ts`, `service.ts` (`server-only`). Le navigateur n'écrit jamais dans une table métier : toute écriture passe par Server Action ou route API validée par Zod, avec auteur construit par `src/lib/auth/auteur.ts` (`p_auteur`).
- Résultat de Server Action : `{ ok: true, donnees }` ou `{ ok: false, code, message }` ; erreurs SQL métier `KS_*`.
- Écritures sensibles en fonctions Postgres `SECURITY DEFINER` (`search_path = ''`), exécution réservée au `service_role` ; un test CI échoue si une fonction exécutable par `anon` ou `authenticated` écrit, ou si une colonne lisible par `anon` se nomme `prive`, `chemin` ou `note_admin`. RLS sur toutes les tables ; migrations jamais modifiées une fois appliquées.
- Variables d'environnement lues seulement par `src/lib/env.ts` (Zod, échec au démarrage nommant la variable sans valeur) ; `.env.example` sans valeur ; dépôt public sans secret.
- Rôles : `role_utilisateur` et `a_le_role` ; `src/lib/auth/droits.ts` vérifie côté serveur, chaque fonction d'écriture revérifie. Droits et interdits de l'Assistant écrits et testés dès maintenant, sans écran. Premier admin attribué par commande documentée prenant l'email en argument.
- Journal : `journal_audit` alimenté par le trigger générique `journaliser()` (emails et téléphones masqués, refus d'écriture sans auteur). Limitation des essais par `consommer_essai` et `limite_essai`.
- Réglages dans la table `reglage`, lus par le client public avec l'étiquette de cache `reglages` (étiquettes via `src/lib/cache/etiquettes.ts`, `updateTag` à chaque mutation admin). SEO centralisé dans `src/lib/seo/`.
- Thème : script dans `<head>` posant l'attribut avant le premier rendu (pas de flash). Nommage : termes français du glossaire sans accents, `snake_case` en base.
- Tests : Vitest (`*.test.ts`), tests SQL dans `supabase/tests/`, Playwright dans `tests/e2e/`, doubles dans `tests/doubles/` préfixés `TEST_` (jamais importés depuis `src/`). CI GitHub Actions sans secret ; branche `production` protégée ; en local on développe sur `koma-dev` sans Docker.

## UX & Interaction Patterns

- Thème Sumi & washi : crème par défaut, sombre au choix, un seul rouge `#E3261C` (texte des boutons rouges `#FFFFFF`), Sakura Town pour les grands titres (repli Barlow Condensed si caractère absent), Barlow pour le texte. Valeurs exactes dans DESIGN.md.
- En-tête : logo horizontal à gauche (couleur en crème, inverse en sombre), panier et bouton ☰ à droite ; rubriques non encore créées non affichées. Menu ☰ en dialogue modal (focus piégé, reste de la page `inert`, Échap ferme, focus rendu au bouton).
- Lien « Aller au contenu » en premier, `<main id="contenu">`, anneau de focus double jamais masqué par l'en-tête collant. Sélecteur de langue conservant la page. Pied de page : carte identité (« Fait main à Goma, RDC. NATHANGROUP SARL. »), cartes Aide et Infos légales ajoutées par les stories 1.8 et 1.9.
- Champ de code unique `one-time-code` avec messages d'erreur reliés et aide « email non reçu ». Questions d'accueil facultatives, une seule fois, avec « Passer » (la question « univers » est masquée tant qu'aucun univers n'existe).
- FAQ en accordéons indépendants au clavier. Admin : barre latérale sur ordinateur, onglets en bas sur mobile, sans Sakura Town ni motif manga, pages `noindex`, entrées seulement pour ce qui existe.

## Cross-Story Dependencies

- 1.1 précède tout. 1.2 crée la table `reglage` et `nom_site`, utilisés par 1.3 (pied de page) et 1.7 (page Réglages). 1.3 fournit le sélecteur de langue attendu par 1.2 et les composants de base réutilisés par toutes les stories.
- 1.4 (Compte, profil, âge) est requise par 1.5, 1.6 et 1.7. 1.7 fournit rôles, journal et `droits.ts` dont 1.8 dépend (liste des messages de contact, tâche admin, réglage WhatsApp). 1.9 alimente le pied de page de 1.3.
- Hors epic : Q-5 (textes légaux et contact), Q-10 et Q-F1 (police) bloquent le contenu ou la mise en ligne, pas la structure. Les epics 2 à 9 reposent sur ce socle (comptes, rôles, journal, réglages, gabarit).
