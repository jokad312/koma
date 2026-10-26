- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-site-bilingue-et-socle-seo.md`
  statut: traité (commit 6705f91)
  summary: Le proxy plante en 500 si `supabase.auth.getClaims()` échoue (réseau, jeton invalide), y compris pour la redirection de `/`.
  evidence: comportement hérité de la story 1.1 ; à entourer d'un try/catch quand l'authentification arrive (1.4).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-site-bilingue-et-socle-seo.md`
  statut: traité (commit 6705f91)
  summary: Lancer Playwright en CI (`ci.yml` n'a pas de job e2e).
  evidence: redirections, hreflang et 404 ne sont vérifiés que par un lancement manuel ; il faudrait appliquer la migration sur la base locale de `supabase start`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-site-bilingue-et-socle-seo.md`
  statut: traité (story 1.3 : règle `no-restricted-syntax` sur `alt`, `aria-label`, `title`, `placeholder`, testée dans `tests/unit/lint-texte-en-dur.test.ts`)
  summary: Étendre la règle ESLint `react/jsx-no-literals` aux props `alt`, `aria-label`, `title`, `placeholder` (`ignoreProps` est à true).
  evidence: du texte visible ou accessible écrit en dur passerait le lint ; à faire avec les premiers composants (1.3).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-site-bilingue-et-socle-seo.md`
  summary: Tester `masquer_donnee_personnelle` et `journaliser()` (masquage, colonnes modifiées, DELETE) et remplacer l'heuristique par valeur, qui masque aussi les réglages numériques.
  evidence: `supabase/tests/reglage.test.sql` ne lit jamais `avant` ni `apres` ; `journal_audit` est redéfini en 1.7 (utiliser `create or replace` dans une nouvelle migration).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-site-bilingue-et-socle-seo.md`
  statut: traité (story 1.4 : `tests/unit/proxy-cookies-rafraichis.test.ts`, cookies présents sur la redirection de `/`, sur la réponse next-intl et dans les cookies de la requête transmise ; `proxy.ts` n'a pas eu besoin de correction)
  summary: Tester que les cookies de session Supabase rafraîchis atteignent la réponse de redirection et celle de next-intl, et aussi les composants serveur de la même requête.
  evidence: (non vérifié, effet possible : déconnexions silencieuses) aucun test n'importe `proxy` ; à régler avec un faux client nommé TEST_ en 1.4.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-site-bilingue-et-socle-seo.md`
  statut: reporté en 9.9 (critère ajouté à la story 9.9, commit 6705f91)
  summary: Vérifier que `npm ci` et le build passent sur Hostinger (Node 24) avec `@swc/core` et `@parcel/watcher`, dépendances de `next-intl` qui ont des scripts d'installation.
  evidence: (non vérifié, gravité possible : medium) à trancher par un déploiement de test sur Hostinger.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-2-site-bilingue-et-socle-seo.md`
  summary: Prévoir `error.tsx` pour le cas où `nom_site` est absent ou la base injoignable.
  evidence: l'erreur `KS_REGLAGE_MANQUANT` est levée dans le layout et fait tomber toutes les pages ; voulu par la spec, mais sans page d'erreur dédiée.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-identite-visuelle-et-gabarit-commun.md`
  statut : traité (version inverse `KOMA_horizontal_inverse.svg` fournie par Jonathan, utilisée sur le thème sombre)
  summary: Fournir une variante du logo pour le thème sombre (les lettres K, M, A sont en `#16130F`, invisibles sur le fond sombre).
  evidence: `public/logo/logo-principal.svg` ; Jonathan fournit la variante (`KOMA_horizontal_inverse.svg` existe dans `imports/logos/SVG/`) ; aucune variante créée.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-identite-visuelle-et-gabarit-commun.md`
  summary: Le sélecteur de langue perd la query et le hash de l'URL.
  evidence: `SelecteurLangue.tsx` utilise le seul `pathname` ; statut : rattaché à la story 2.4 (critère d'acceptation ajouté dans `epics.md`, décision de Jonathan du 2026-10-21) ; `useSearchParams` sous Suspense.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-identite-visuelle-et-gabarit-commun.md`
  summary: Tester le parsing de `NEXT_PUBLIC_TITRES_SAKURA` et l'injection du `@font-face` dans le layout.
  evidence: aucun test d'`env.ts` ni du layout pour cette option ; à faire quand Jonathan fournit la police (Q-F1).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-identite-visuelle-et-gabarit-commun.md`
  summary: (non vérifié, gravité possible : medium) `jsdom` 30 exige Node ^22.22.2 ou ^24.15.0 ; vérifier la version de Node de la CI et de Hostinger.
  evidence: la CI dira si les tests passent ; sinon figer la version de Node.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-3-identite-visuelle-et-gabarit-commun.md`
  summary: Les pages 404 (`[locale]/[...rest]`) sont servies en coquille HTML vide, rendue ensuite par le navigateur : rien d'affiché sans JavaScript, un clignotement crème possible en thème sombre avant le script, et le message de développement « Could not validate `instant` » persiste.
  evidence: Next 16 n'effectue pas le rendu serveur d'une page qui appelle `notFound()` ici ; mesuré en `npm run dev` et en `next build` + `next start` ; à traiter dans une story dédiée (règles 7 et 8).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-creation-de-compte-et-connexion-par-code-email.md`
  summary: `verifierCode` traite tout 403/422 comme « code faux » ; (non vérifié, gravité possible : medium) une mauvaise configuration serveur (inscription ou OTP désactivés) s'afficherait comme un code faux.
  evidence: les codes d'erreur réels de Supabase pour un code faux et un code expiré ne sont pas confirmés ; à régler avec un vrai code sur `koma-dev` (vérification manuelle de la 1.4).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-creation-de-compte-et-connexion-par-code-email.md`
  summary: Le lien « Se connecter » de l'en-tête ne garde pas la query string de la page quittée (`usePathname`).
  evidence: après connexion, filtres et variantes sont perdus ; à traiter avec le critère de la story 2.4 (comme le sélecteur de langue), `useSearchParams` sous Suspense.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-creation-de-compte-et-connexion-par-code-email.md`
  summary: Tester les branches restantes de `verifierCode` et `declarerAge` (429, erreur SQL inconnue, identifiant absent) et le compte à rebours de renvoi avec des minuteries simulées.
  evidence: seule la branche KS_AGE_MINIMUM est couverte ; le défaut serait un mauvais message, sans enjeu de sécurité.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-creation-de-compte-et-connexion-par-code-email.md`
  summary: Protection contre l'abus de l'envoi de codes (CAPTCHA Supabase, limite par IP) et de la force brute sur les 6 chiffres.
  evidence: (non vérifié, gravité possible : medium) `signInWithOtp` avec `shouldCreateUser: true` peut envoyer des emails à des tiers ; à régler dans les réglages Auth de Supabase, à vérifier dans la story 9.9.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-4-creation-de-compte-et-connexion-par-code-email.md`
  summary: Décision de Jonathan : `declarer_age` refuse toute seconde déclaration (`KS_AGE_DEJA_DECLARE`), ajout de l'implémentation hors spec ; une faute de frappe (18 au lieu de 81) ou un mineur déclaré par erreur ne peut pas être corrigé.
  evidence: empêche un mineur de changer son âge ; une voie de correction (par l'admin, story 1.7 ou plus tard) reste à décider.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-navigateurs-integres-et-connexion-google.md`
  summary: Rendre le retour de Google robuste aux onglets parallèles et au double appel du callback (cookie par tentative).
  evidence: un seul cookie `ks_retour_google` (chemin `/auth`) ; un deuxième onglet l'écrase, un second appel du callback retombe sur l'accueil `fr`.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-5-navigateurs-integres-et-connexion-google.md`
  summary: `definir_langue_profil` écrase la langue choisie d'un Compte email incomplet qui se connecte ensuite par Google ; un profil absent n'est pas signalé.
  evidence: la fonction met à jour tant que l'âge n'est pas déclaré, sans distinguer un Compte tout juste créé ; 0 ligne modifiée vaut succès.


- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-questions-d-accueil.md`
  summary: Question « Quel univers préfères-tu ? » des questions d'accueil : à ajouter quand les univers existent (colonne de préférence sur `profil` liée à `univers`, affichage seulement s'il existe au moins un univers publié, E-29).
  evidence: aucune table `univers` avant la story 2.1, et aucune story de l'epic 2 ne mentionne cette question (2.1 crée seulement les univers) ; l'email « nouveau produit dans ton univers » (epic 9, FR-59) lit « acheté ou déclaré préféré » et attend cette colonne. Rattaché à la story 2.1 (critère d'acceptation ajouté dans epics.md le 2026-10-22).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-questions-d-accueil.md`
  summary: Les réponses d'accueil (origine, préférence) n'ont ni mention d'usage détaillée, ni écran pour les consulter, corriger ou supprimer.
  evidence: (medium) données personnelles stockées dans `profil` ; le texte de l'étape dit seulement « pour te proposer ce qui te correspond » ; à traiter avec les textes légaux (1.9) et la page Compte, la suppression du Compte les emporte déjà (cascade du profil).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-6-questions-d-accueil.md`
  summary: Test clavier dédié et rendu en thème sombre / contraste forcé de l'étape « questions » (coche des radios).
  evidence: (low) radios natifs, bordure rouge 2 px et coche ; non vérifiés automatiquement car l'étape n'est atteignable en e2e qu'avec la boîte de test.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-acces-admin-roles-journal-et-reglage-whatsapp.md`
  summary: `a_le_role` reste exécutable par anon/authenticated : n'importe qui peut sonder le rôle d'un identifiant de Compte connu.
  evidence: exigé par la spec (AD-13, exception unique de lecture) ; à réexaminer quand les politiques RLS qui l'utilisent existent (epic 7) ; restreindre à `auth.uid()` ou révoquer si aucune politique ne l'appelle.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-acces-admin-roles-journal-et-reglage-whatsapp.md`
  summary: Statut HTTP de la 404 et de la redirection admin sous Suspense (cacheComponents) peut être 200. Gravité non vérifiée : moyenne.
  evidence: le contrôle de droit s'exécute dans un Suspense ; à régler par `curl -I` sur `/fr/admin` ; le contenu et `noindex` sont corrects.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-acces-admin-roles-journal-et-reglage-whatsapp.md`
  summary: Pas de `retirer_role`, pas de protection du dernier admin (y compris par `corriger_age` sous 13 ans), trigger de suppression en cascade qui écrase `ks.auteur` quand la profondeur dépasse 1.
  evidence: hors périmètre de la 1.7 ; à traiter avec l'écran des rôles (epic 7) ; la correction d'âge n'a aucun écran pour l'instant.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-8-pages-a-propos-faq-et-contact.md`
  summary: Limite de contact par IP : `x-forwarded-for` (premier élément) peut être falsifié, et sans IP tous les visiteurs partagent un seau commun. Gravité non vérifiée : moyenne.
  evidence: dépend de l'en-tête réellement posé par le proxy Hostinger ; à vérifier au premier déploiement, puis choisir l'en-tête fiable.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-8-pages-a-propos-faq-et-contact.md`
  summary: La table `limite_essai` n'est jamais purgée ; prévoir une tâche Cron qui supprime les fenêtres de plus d'un jour.
  evidence: une ligne par clé et par fenêtre ; croissance non bornée.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-8-pages-a-propos-faq-et-contact.md`
  summary: Le formulaire de contact collecte nom, email et message sans mention de vie privée ; ajouter le lien vers la politique de confidentialité quand elle existe (story 1.9).
  evidence: pages légales prévues en 1.9 ; texte juridique à fournir par Jonathan.
  statut: traité (story 1.9 : lien « Politique de confidentialité » sous le bouton du formulaire de contact).

- source_spec: `_bmad-output/implementation-artifacts/spec-1-9-pages-legales.md`
  summary: Le formulaire de contact n'a qu'un lien vers la confidentialité, sans phrase de consentement avant l'envoi.
  evidence: la formulation relève du texte légal (règle 15, Q-5) ; à ajouter quand Jonathan et son juriste l'auront validée.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-univers-et-creation-d-un-produit-physique.md`
  summary: À traiter avant la mise en ligne (epic 9) : pouvoir renommer ou masquer un univers (faute de frappe, univers de test). La 2.1 ne permet que d'en créer.
  evidence: aucune story des epics 2 à 9 ne prévoit renommage, masquage ni suppression d'univers (recherche dans epics.md). Sans cela, une faute de frappe reste visible dans les filtres du catalogue et dans la question d'accueil. Prévoir une fonction d'écriture journalisée (admin), et le masquage sans casser les produits ni les réponses de profil déjà liés.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-univers-et-creation-d-un-produit-physique.md`
  summary: À traiter avec les commandes (epic 4) : écrasement du stock par un formulaire périmé (ajouter une version/`modifie_le` vérifié sous verrou) et suppression d'une taille déjà commandée (clé étrangère `restrict`, avertissement dans le formulaire).
  evidence: `enregistrer_produit` remplace stock et variantes par les valeurs saisies ; sans commandes cela reste inoffensif.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-univers-et-creation-d-un-produit-physique.md`
  summary: À traiter avec la 2.2 (publication) : verrouiller ou avertir sur slug et famille d'un produit publié ; état « Programmé » quand `publie_le` est dans le futur ; trigger `modifie_le` ; tests SQL des bornes de `enregistrer_produit` (prix 1000001, délai 0/366, titre vide ou trop long, description > 5000).
  evidence: constats de revue 2.1, tous liés à un produit publié ou à la publication.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-univers-et-creation-d-un-produit-physique.md`
  summary: Décision à prendre avec la 2.3 : la table `variante` est lisible par `anon` avec le stock exact et le délai ; exposer plutôt un état « en stock » (vue ou `stock_disponible`). Gravité non vérifiée : moyenne.
  evidence: l'epic donne un SELECT public sur les variantes ; les quantités exactes deviennent lisibles par n'importe qui via l'API REST.
- source_spec: `_bmad-output/implementation-artifacts/spec-2-1-univers-et-creation-d-un-produit-physique.md`
  summary: Toutes les pages admin partagent le même `<title>` « Administration » (WCAG 2.4.2) ; prévoir un titre par page (réglages, messages, produits, univers).
  evidence: `Metadata.admin` unique ; touche les pages des stories 1.7, 1.8 et 2.1.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-photos-et-publication-d-un-produit.md`
  summary: Supprimer une photo et modifier son texte alternatif (FR/EN) depuis la fiche d'édition ; la 2.2 ne permet que d'ajouter et de réordonner.
  evidence: hors critères d'acceptation de la 2.2. À prévoir : fonctions d'écriture journalisées (suppression avec effacement de l'objet de `produits-public`, mise à jour des textes), la future story de suppression devra ajouter un déclencheur différé sur `produit_photo` (aucun n'existe aujourd'hui) pour refuser de supprimer la dernière photo d'un produit publié.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-photos-et-publication-d-un-produit.md`
  summary: Les fichiers de `produits-public` d'un produit dépublié restent lisibles par leur adresse directe (bucket public) ; seuls la ligne `produit_photo` et le produit sont masqués.
  evidence: le bucket public sert les objets sans passer par la RLS de `produit_photo`. Les noms sont des UUID non devinables et rien ne les liste, mais un lien déjà partagé continue de répondre. Décider avant la mise en ligne si c'est acceptable.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-2-photos-et-publication-d-un-produit.md`
  summary: Purger par une tâche Cron les objets de `galerie-attente` plus vieux que N heures (envoi abandonné, onglet fermé, coupure avant la finalisation).
  evidence: l'original d'attente n'est effacé que par la finalisation ou l'annulation ; un envoi TUS interrompu sans retour au serveur laisse un objet privé. Choisir N (par exemple 24) avec Jonathan.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-catalogues-cosplays-et-accessoires.md`
  summary: Index et coût de `lister_catalogue` : `stock_disponible` est évalué par variante avant le `LIMIT`. Ajouter les index `produit (famille, publie_le desc, id desc)` et `produit (famille, prix_cents, id)` et mesurer avec EXPLAIN quand le catalogue dépassera quelques centaines de produits.
  evidence: la migration 20261026100000 ne crée aucun index au-delà de ceux de la 2.1 ; la page à curseur relit jusqu'à 252 lignes depuis le début.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-4-catalogues-cosplays-et-accessoires.md`
  summary: Le filtre d'univers liste tous les univers, même ceux qui n'ont aucun produit publié dans la famille affichée (un choix peut mener à « aucun résultat »).
  evidence: `lireUniversPublics` ne dépend pas de la famille ; filtrer demanderait une lecture par famille (cache `catalogue`).

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-fiche-d-un-produit-physique.md`
  summary: Une fiche inconnue ou dépubliée répond 200 + noindex en production (le texte 404 s'affiche, pas le statut HTTP).
  evidence: la route `[slug]` est prérendue en coque partielle ; le statut part avant `notFound()`. Piste : tester l'adresse dans `proxy.ts` avant le rendu (lecture rapide) puis réécrire vers la 404.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-fiche-d-un-produit-physique.md`
  summary: Les e2e de la fiche (structure, JSON-LD, galerie au clavier, axe, 375 px) sont sautés tant qu'aucun produit publié n'existe dans la base de test.
  evidence: `tests/e2e/fiche.spec.ts` cherche une fiche depuis le catalogue et saute s'il n'y en a pas ; aucun produit n'est créé ni simulé.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-fiche-d-un-produit-physique.md`
  summary: Non faits : Open Graph `og:type=product` et champs facultatifs de l'Offer (sku, itemCondition).
  evidence: `construireMetadata` émet `og:type=website` ; `produitJsonLd` n'écrit que prix, devise, disponibilité et URL.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-fiche-d-un-produit-physique.md`
  summary: Test e2e intermittent `gabarit.spec.ts` « le thème sombre est mémorisé » : échoue parfois en suite complète (`document.documentElement` nul après `reload({ waitUntil: "commit" })`) et passe seul.
  evidence: constaté aux stories 2.4 et 2.5, vert en CI ; course de chargement dans le test, sans lien avec le thème lui-même. À stabiliser (attendre `domcontentloaded` ou `waitForFunction` tolérant).
