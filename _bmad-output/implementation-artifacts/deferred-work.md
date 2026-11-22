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
  summary: Statut HTTP de la 404 des pages inconnues et des fiches sous Suspense (cacheComponents) pouvait être 200.
  evidence: le statut partait avant `notFound()` pour les fiches ; les pages inconnues répondaient déjà 404.
  statut: traité par le correctif `spec-correctif-statut-404.md` (proxy + test `test:e2e:prod`).
- source_spec: `_bmad-output/implementation-artifacts/spec-1-7-acces-admin-roles-journal-et-reglage-whatsapp.md`
  summary: Statut HTTP de la redirection admin sous Suspense (cacheComponents) : `/fr/admin` et `/admin/produits/<identifiant inconnu>` répondent encore 200 en production pour un visiteur non connecté. Gravité non vérifiée : moyenne.
  evidence: le contrôle de droit s'exécute dans un Suspense ; un correctif exigerait de vérifier le rôle dans le proxy sans révéler l'existence de la page ; le contenu et `noindex` sont corrects.
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
  summary: TRAITÉ par le correctif `spec-correctif-stock-non-expose.md` (migration 20261029100000 : `stock` retiré de la lecture publique, `stock_disponible` réservée au service_role, états seulement). Décision à prendre avec la 2.3 : la table `variante` est lisible par `anon` avec le stock exact et le délai ; exposer plutôt un état « en stock » (vue ou `stock_disponible`). Gravité non vérifiée : moyenne.
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
  statut: traité par le correctif `spec-correctif-statut-404.md` (proxy + test `test:e2e:prod`).

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-fiche-d-un-produit-physique.md`
  summary: Les e2e de la fiche (structure, JSON-LD, galerie au clavier, axe, 375 px) sont sautés tant qu'aucun produit publié n'existe dans la base de test.
  evidence: `tests/e2e/fiche.spec.ts` cherche une fiche depuis le catalogue et saute s'il n'y en a pas ; aucun produit n'est créé ni simulé.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-fiche-d-un-produit-physique.md`
  summary: Non faits : Open Graph `og:type=product` et champs facultatifs de l'Offer (sku, itemCondition).
  evidence: `construireMetadata` émet `og:type=website` ; `produitJsonLd` n'écrit que prix, devise, disponibilité et URL.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-5-fiche-d-un-produit-physique.md`
  summary: Test e2e intermittent `gabarit.spec.ts` « le thème sombre est mémorisé » : échoue parfois en suite complète (`document.documentElement` nul après `reload({ waitUntil: "commit" })`) et passe seul.
  evidence: constaté aux stories 2.4 et 2.5, vert en CI ; course de chargement dans le test, sans lien avec le thème lui-même. À stabiliser (attendre `domcontentloaded` ou `waitForFunction` tolérant).

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-blocs-de-la-page-d-accueil.md`
  summary: Lighthouse mobile de l'accueil à 89-90 en performance (seuil NFR-2 : 90) ; le LCP est le H1 (polices Barlow Condensed / Sakura).
  evidence: `lighthouse@12.8.2` sur `next start`, `/fr` 89 et 89, `/en` 89 et 90. À remesurer avec le héros (2.6) et avec des cosplays publiés : le bloc 2 apparaît sous Suspense sans repli, vérifier le CLS réel.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-blocs-de-la-page-d-accueil.md`
  summary: Le bloc 2 « Fait main à Goma » n'a jamais été vu avec de vraies cartes (aucun produit publié dans la base de test).
  evidence: seuls les tests unitaires (lecture et rendu avec données de test) le couvrent ; l'e2e n'a vu que le cas sans cosplay.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-7-blocs-de-la-page-d-accueil.md`
  summary: Les pages de catalogue écrivent `[catalogue] lecture impossible` dans les journaux du serveur (une fois par requête, constaté en `next start` et en développement) alors que la page affiche le bon état ; la cause est une lecture annulée (`AbortError`) pendant un passage de prérendu de Next.js (cacheComponents) que la page prend pour une panne.
  evidence: appel direct de `lister_catalogue` par supabase-js réussi ; trace temporaire : `AbortError: This operation was aborted` émis par le minuteur du prérendu. Le bloc 2 de l'accueil a été corrigé (`await connection()` avant la lecture). À traiter : faire de même (ou reconnaître l'annulation) dans `ContenuCatalogue` et vérifier avec de vrais produits publiés que le rendu de la requête est correct.

- source_spec: `_bmad-output/implementation-artifacts/spec-correctif-photos-suppression-et-alt.md`
  summary: Balayage des fichiers de `produits-public` sans ligne `produit_photo` : un échec d'effacement après la suppression en base laisse un fichier orphelin.
  evidence: choix assumé (un orphelin vaut mieux qu'une photo cassée) ; l'échec est seulement journalisé. À traiter avec les tâches Cron : lister le bucket, comparer à `produit_photo.fichier`, effacer les fichiers sans ligne et de plus de 24 h.

- source_spec: `_bmad-output/implementation-artifacts/spec-correctif-stock-non-expose.md`
  summary: Les états par seuil laissent deviner, par sondage répété du catalogue ou de la fiche, le moment où le stock d une taille passe à 3 (ou à 0). Accepté : c est le principe des « dernières pièces » décidé par Jonathan ; aucune quantité exacte n est exposée.
  evidence: décision de Jonathan ; seuil dans `seuil_dernieres_pieces()` (3).

- source_spec: `_bmad-output/implementation-artifacts/spec-correctif-stock-non-expose.md`
  summary: Coût de `lister_catalogue` : depuis ce correctif l état (stock via `stock_disponible`, capacité) est toujours calculé par variante avant le `LIMIT`, y compris sans filtre de disponibilité. À mesurer avec EXPLAIN en même temps que les index déjà notés en 2.4 (« Index et coût de `lister_catalogue` ») ; les deux constats se traitent ensemble.
  evidence: fonction en `security definer` qui appelle `stock_disponible` et `etat_disponibilite` pour chaque variante des produits candidats.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Téléchargement (3.6) : les liens signés doivent forcer `Content-Disposition: attachment` (option `download` de la signature), car le type de contenu d'un objet de `kits-private` vient du client (métadonnées TUS) et n'est pas contrôlé.
  evidence: le bucket n'a pas de liste de types MIME ; un SVG ou un texte pourrait sinon être affiché en ligne par le navigateur.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Purge des objets de `kits-private` jamais enregistrés (envois abandonnés, onglet fermé avant la finalisation).
  evidence: aucune ligne dans `fichier_kit_prive` pour ces objets ; à traiter avec les tâches Cron (lister le bucket, comparer à `fichier_kit_prive.chemin_stockage`, effacer les objets sans ligne et de plus de 24 h).

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Modifier ou supprimer un fichier d'un Kit publié casse les téléchargements des acheteurs : garde à définir en 3.2 / 3.6 (par exemple refuser la suppression d'un fichier d'un Kit publié, ou conserver l'ancienne version).
  evidence: `supprimer_fichier_kit` et `remplacer_fichier_kit` n'ont aucune garde sur la publication ; un Kit ne peut pas être publié en 3.1.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Prix 0 d'un Kit : aucun paiement ne doit être créé pour 0 USD ; l'accès du Kit gratuit passe par la Commande `offerte` (3.5) et l'epic 4 doit refuser un Kit à 0 dans un paiement.
  evidence: la base accepte `prix_cents = 0` pour la famille `kit` (Kit gratuit) ; rien n'empêche encore un futur paiement à 0.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Test de rendu de la page d'édition d'un Kit (branche Kit / physique de `produits/[id]/page.tsx`) à ajouter quand un harnais de test authentifié existera.
  evidence: la page exige un admin connecté ; la branche Kit n'est couverte que par les tests de composants.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-heros-video-de-l-accueil.md`
  summary: Vidéos orphelines dans la bibliothèque Bunny publique : un envoi abandonné (onglet fermé avant la fin ou la finalisation) laisse une vidéo `koma-heros-…` non rattachée au héros.
  evidence: l'annulation volontaire l'efface (`annulerEnvoiVideo`) ; un onglet fermé ne le peut pas. À traiter avec les tâches Cron : lister la bibliothèque, comparer à `heros_accueil.video_id`.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-heros-video-de-l-accueil.md`
  summary: Le Cosplay vedette dépublié disparaît du héros sans avertir l'admin (la page Réglages affiche « aucun » car il n'est plus dans la liste des publiés).
  evidence: la RLS cache le produit au public ; `lireHerosAdmin` ne propose que les cosplays publiés.

- source_spec: `_bmad-output/implementation-artifacts/spec-2-6-heros-video-de-l-accueil.md`
  summary: Parcours e2e avec une vraie vidéo encodée (affichage, Pause mémorisée, repli sur erreur) non automatisé : aucune vidéo de test encodable sans ffmpeg ni donnée de test publiée.
  evidence: couvert par les tests unitaires du service, le test réseau réel de la signature TUS et le test SQL ; essai manuel dans `journal-enchainement.md`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 1.2 — la liste des formats est écrite deux fois, sans test d'accord.
  evidence: migration `20261030100000_kits_et_fichiers.sql` (contrainte ligne 105, `extension_fichier_kit` lignes 149-162).

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 1.3 — `taille_octets` vient de l'appelant, la base ne vérifie pas l'objet.
  evidence: `service.ts:563` compare la taille réelle lue à l'annoncée ; le contrôle direct en base reste muet.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 1.4 — le test RLS positif pose `publie_le` à la main, un état que le trigger refuse.
  evidence: `supabase/tests/kits_fichiers.test.sql:577-593` (rollback rend l'état transitoire acceptable).

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 1.5 — l'assertion « aucune politique storage » est trop large.
  evidence: `supabase/tests/kits_fichiers.test.sql:19-24` compte toutes les politiques du schéma, pas seulement celles de `kits-private`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 1.6 — l'assertion « publier un Kit est refusé » ne prouve pas le refus dédié.
  evidence: `supabase/tests/kits_fichiers.test.sql:357-361`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 1.7 — aucune contrainte ne garantit qu'un Kit n'a ni variante, ni délai, ni stock.
  evidence: migration `20261030100000_kits_et_fichiers.sql` (contrainte `produit_kit_champs`) ; réserve sur le flux applicatif.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 2.3 — un STL ASCII exporté avec BOM ou espace en tête est refusé.
  evidence: `src/modules/catalogue/fichiers-kit.ts:154`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 2.4 — une lecture partielle devient « format_invalide » au lieu de « envoi_incomplet ».
  evidence: `src/modules/catalogue/fichiers-kit.ts:159` et `src/modules/catalogue/dependances.ts:133-147`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  statut: corrigé depuis la revue (constat 2.5) — l'objet envoyé est conservé en erreur de lecture, comme la branche exception.
  summary: Constat mineur 2.5 — une erreur de lecture réseau efface un envoi de 50 Mo.
  evidence: `src/modules/catalogue/service.ts:531-535` puis `:592-594`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  statut: corrigé depuis la revue (constat 2.6) — « kit » ajouté à `MANQUES_PUBLICATION`, court-circuit en place.
  summary: Constat mineur 2.6 — `MANQUES_PUBLICATION` ignore `kit`, que la base renvoie pourtant.
  evidence: `src/modules/catalogue/types.ts:75` et `src/modules/catalogue/publication.ts`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 2.7 — `lireProduitsLiables` charge tous les cosplays et accessoires sans limite.
  evidence: `src/modules/catalogue/queries.ts:92-101`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 2.8 — `annulerEnvoiFichierKit` renvoie `produit_introuvable` pour un chemin d'objet invalide.
  evidence: `src/modules/catalogue/service.ts:602`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 2.9 — un commentaire renvoie à la fonction des photos.
  evidence: `src/lib/supabase/envoi-tus.ts:67`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 2.10 — `KS_CHEMIN_INVALIDE` devient « fichier déjà enregistré », même pour un chemin mal formé.
  evidence: `src/modules/catalogue/service.ts:419`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.4 — l'aide du panneau de remplacement n'affiche pas la taille maximale.
  evidence: `src/components/admin/EnvoiFichierKit.tsx:244` et `messages/fr.json:873`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.5 — l'aide du groupe « Format de page du PDF » n'est pas reliée au group.
  evidence: `src/components/admin/EnvoiFichierKit.tsx:266-268`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.6 — les noms FR/EN restent modifiables pendant l'envoi et sont ignorés.
  evidence: `src/components/admin/EnvoiFichierKit.tsx:284-285`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.7 — aucun moyen de revenir à « aucun niveau ».
  evidence: `src/components/admin/FormulaireKit.tsx:205-224`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.8 — passer en famille « Kit » puis revenir efface la saisie du Kit.
  evidence: `src/components/admin/FormulaireProduit.tsx:137-146`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.9 — en mode fixe, l'erreur « famille » n'est plus affichée.
  evidence: `src/components/admin/ChoixFamille.tsx:23-31`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.10 — deux clés de traduction mortes.
  evidence: `messages/fr.json:733` et `messages/en.json:815`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.11 — le code d'erreur `kit_non_publiable` est inatteignable dans l'interface.
  evidence: `src/components/admin/PublicationProduit.tsx:81`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.12 — « Supprimer » reste actif pendant le remplacement du même fichier.
  evidence: `src/components/admin/FichiersKit.tsx:93-95`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  statut: corrigé depuis la revue (constat 3.13) — le repli `generique` est appliqué dans `FormulaireKit`.
  summary: Constat mineur 3.13 — `t()` sans repli sur un code d'erreur inconnu.
  evidence: `src/components/admin/FormulaireKit.tsx:111` et `src/components/admin/EnvoiFichierKit.tsx:71`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.14 — l'aide de « Matériel nécessaire en anglais » n'explique rien.
  evidence: `messages/fr.json:763` et `messages/en.json`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.15 — le titre d'un test ne correspond plus au code.
  evidence: `tests/unit/catalogue-fichiers-kit.test.ts:117`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.16 — aucun contrôle de parité des variables ICU entre les deux langues.
  evidence: `tests/unit/messages-parite.test.ts:12-22`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.17 — la fiche d'un Kit parle de « produit ».
  evidence: `src/app/[locale]/admin/produits/[id]/page.tsx:80` et `:86`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.18 — sous `/en`, la liste des cosplays à lier affiche des titres français.
  evidence: `src/components/admin/FormulaireKit.tsx:245`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  statut: corrigé depuis la revue (constat 3.19) — le focus après suppression/remplacement, comme `GaleriePhotos`.
  summary: Constat mineur 3.19 — après une suppression ou un remplacement, le focus tombe sur `<body>`.
  evidence: `src/components/admin/FichiersKit.tsx:41-63` et `:103-107`, `src/components/admin/EnvoiFichierKit.tsx:178`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.20 — les erreurs de champ du formulaire d'envoi ne sont pas annoncées.
  evidence: `src/components/admin/EnvoiFichierKit.tsx:258-262`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.21 — à zéro fichier, « Aucun fichier » s'affiche deux fois.
  evidence: `src/components/admin/FichiersKit.tsx:68-69`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.22 — un envoi TUS abandonné laisse un objet dans `kits-private`.
  evidence: `src/components/admin/EnvoiFichierKit.tsx:146-151`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.23 — un fichier de 0 octet est refusé avec le message « format_invalide ».
  evidence: `src/components/admin/EnvoiFichierKit.tsx:111`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.24 — le message de succès reste affiché quand on choisit un nouveau fichier.
  evidence: `src/components/admin/EnvoiFichierKit.tsx:82-88`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.25 — les contrôles avant envoi réimplémentent `lireAnnonceFichierKit`.
  evidence: `src/components/admin/EnvoiFichierKit.tsx:104-116` vs `src/modules/catalogue/fichiers-kit.ts:61-72`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-creer-un-kit-et-ses-fichiers.md`
  summary: Constat mineur 3.26 — `aria-expanded` sans `aria-controls` sur « Remplacer ».
  evidence: `src/components/admin/FichiersKit.tsx:85`.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-video-chapitres-sous-titres-et-publication-d-un-kit.md`
  summary: Vidéos Bunny orphelines (onglet fermé, rechargement pendant l'encodage, suivi dépassé, annulation échouée) : ni reprise ni tâche de nettoyage par titre `KIT_<id>` / `KIT_EXTRAIT_<id>`.
  evidence: `demanderEnvoiVideoKit` crée la vidéo chez Bunny avant l'envoi ; l'identifiant n'existe ensuite que dans le navigateur (`VideoKit.tsx`, `videoEnCours`). Même nature que la purge de `kits-private` déjà reportée.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-video-chapitres-sous-titres-et-publication-d-un-kit.md`
  summary: Remplacer la vidéo par une vidéo plus courte que le dernier chapitre : refus `KS_CHAPITRES_HORS_DUREE` après l'envoi et l'encodage complets, puis effacement chez Bunny, sans avertissement préalable.
  evidence: `enregistrer_video_kit` contrôle les chapitres après encodage ; la durée n'est connue qu'à ce moment. Piste : lire la durée locale du fichier (`<video>` metadata) avant l'envoi et prévenir.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-catalogue-kits-et-fiche-kit.md`
  summary: Sous-titres d'extrait remplacés : l'adresse CDN `/<extrait>/captions/<langue>.vtt` ne change pas ; vérifier que Bunny purge le cache au dépôt, sinon purger ou versionner l'adresse.
  evidence: non vérifié (maybe-false) : à régler par un essai réel sur un extrait de koma-public.

- source_spec: `_bmad-output/implementation-artifacts/spec-3-3-catalogue-kits-et-fiche-kit.md`
  summary: Rattrapage `extrait_le = now()` de la migration 20261103100000 non testé sur une ligne antérieure.
  evidence: aucune ligne `video_kit` sur koma-dev au moment de la migration ; pgTAP tourne sur un schéma déjà migré.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-2-appliquer-un-code-promo.md`
  summary: Un code valide dont la réduction arrondie vaut 0 centime consomme quand même une utilisation et le premier achat.
  evidence: floor(sous-total × pct / 100) = 0 seulement si le sous-total < 100/pct centimes (moins de 10 centimes à 10 %) ; irréaliste avec les prix actuels.
- source_spec: `_bmad-output/implementation-artifacts/spec-9-2-appliquer-un-code-promo.md`
  summary: Le reste de l'arrondi posé sur la dernière ligne peut dépasser le montant de cette ligne si elle ne coûte que quelques centimes.
  evidence: reste ≤ part exacte + (lignes − 1) centimes ; ne se produit qu'avec une dernière ligne de quelques centimes.
- source_spec: `_bmad-output/implementation-artifacts/spec-9-2-appliquer-un-code-promo.md`
  summary: Étape de commande : ignorer les réponses de recalcul arrivées hors ordre et désactiver « Confirmer » pendant un recalcul.
  evidence: le serveur rattrape par KS_TOTAL_CHANGE, mais le client fait un aller-retour inutile.
- source_spec: `_bmad-output/implementation-artifacts/spec-9-2-appliquer-un-code-promo.md`
  summary: Tests de rendu de la page Commande du client et du détail admin (ligne « Réduction », aucune fuite du taux de commission côté client).
  evidence: aucun test de PageDetailCommande ni de DetailCommandeAdmin n'existe (lacune antérieure à la 9.2).
- source_spec: `_bmad-output/implementation-artifacts/spec-9-4-consentements-preferences-et-desinscription.md`
  summary: En-têtes List-Unsubscribe et List-Unsubscribe-Post (RFC 8058) sur chaque Email commercial, avec un POST de désinscription en un clic.
  evidence: exigés par Gmail et Yahoo pour les envois commerciaux ; aucun Email commercial n'existe avant 9.5/9.6.
- source_spec: `_bmad-output/implementation-artifacts/spec-9-4-consentements-preferences-et-desinscription.md`
  summary: Écart de 2 jours sûr en cas de deux traitements simultanés ou d'un envoi accepté par Resend mais non marqué.
  evidence: email_commercial_autorise ne compte que les envois « envoye » ; aujourd'hui une seule tâche traite le lot en séquence.
- source_spec: `_bmad-output/implementation-artifacts/spec-9-4-consentements-preferences-et-desinscription.md`
  summary: Rotation de DESINSCRIPTION_SECRET (clé précédente acceptée en vérification) et test de cohérence entre MODELES_COMMERCIAUX (TS) et la liste SQL.
  evidence: changer la clé casse les liens déjà envoyés ; les deux listes sont recopiées à la main.
- source_spec: `_bmad-output/implementation-artifacts/spec-9-4-consentements-preferences-et-desinscription.md`
  summary: Tests des lectures de src/modules/preferences/dependances.ts et de autorisationCommerciale (faux client rpc).
  evidence: une faute de clé (alertes_festival, motif) ne ferait échouer aucun test.
- source_spec: `_bmad-output/implementation-artifacts/spec-8-1-envoyer-sa-photo-depuis-son-compte.md`
  summary: Deux finalisations simultanées du même envoi de photo (verrou sur l'objet) et annonces de progression espacées pour les lecteurs d'écran.
  evidence: le double clic est bloqué côté client ; la zone role="status" contient la barre et le pourcentage.
- source_spec: `_bmad-output/implementation-artifacts/spec-8-1-envoyer-sa-photo-depuis-son-compte.md`
  summary: Banc de test de `rendre` (src/modules/envois/dependances.ts) avec un faux client Supabase, pour les liens WhatsApp et « Envoyer une photo » des emails.
  evidence: aucun test n'exécute `rendre` ; seuls les gabarits sont testés.
- source_spec: `_bmad-output/implementation-artifacts/spec-8-2-validation-depot-whatsapp-et-retrait-des-photos.md`
  summary: Pagination de la file Galerie et tri des photos publiées de la plus récente à la plus ancienne (lister_photos_admin).
  evidence: la fonction renvoie toutes les photos publiées, triées par date d'envoi croissante.
- source_spec: `_bmad-output/implementation-artifacts/spec-8-2-validation-depot-whatsapp-et-retrait-des-photos.md`
  summary: Double dépôt WhatsApp simultané du même envoi, et test du filtre « en attente » de la purge (adaptateur de la route).
  evidence: aucun verrou sur l'objet d'envoi ; l'adaptateur réel de la purge n'a pas de banc de test.
- source_spec: `_bmad-output/implementation-artifacts/spec-8-4-realisations.md`
  summary: Pour la story 8.5 : décider si une Réalisation retirée du mur garde son rang, et ne compter qu'une Réalisation par Compte dans l'opération « 10 pass ».
  evidence: le rang est fixé à la validation et n'est pas effacé au retrait ; un Compte peut envoyer plusieurs Réalisations.
- source_spec: `_bmad-output/implementation-artifacts/spec-8-4-realisations.md`
  summary: Pour la story 8.3 : le mur doit afficher « Fait avec un kit KOMA » pour une photo reliée à une `realisation` validée.
  evidence: la page « Envoyer une Réalisation » annonce cette mention.

## Mur public (préparation 8.3, 2026-11-10)
- Compte supprimé : `photo_galerie.compte_id ... on delete cascade` efface la ligne, mais la copie publiée reste dans `produits-public/galerie/` (elle quitte le mur, son adresse reste lisible par qui l'a gardée). À traiter avec la suppression de Compte : effacer d'abord les copies publiques.
- `lister_mur_public` appelle `est_mineur` pour chaque photo publiée avant le tri : sans effet au volume actuel ; à remplacer par une jointure sur `profil` si le mur dépasse quelques milliers de photos.
- Types générés : `pseudo`, `kit_slug`, `kit_titre_fr`, `kit_titre_en` sont typés `string` mais valent souvent null : la page 8.3 doit les traiter comme nullables.

## Mesure d'audience (9.7, intégrée le 2026-11-10)
- À vérifier à la mise en ligne (9.9) : comment le proxy de Hostinger remplit X-Forwarded-For. La mesure retient la dernière adresse ; si Hostinger n'ajoute pas l'adresse réelle en dernier, la limite par IP vise la mauvaise adresse (le plafond global borne quand même l'écriture). Le formulaire de contact (src/modules/contact/dependances.ts) lit encore la première adresse : à aligner au même moment.
- À vérifier à la mise en ligne : NEXT_PUBLIC_SITE_URL doit être exactement l'adresse publique (même hôte, avec ou sans www), sinon tout Referer est refusé et la mesure reste muette.
- Phrase de confidentialité proposée par la voie 3 (voie-3-notes.md) : à valider par Jonathan avant d'être ajoutée à la page de confidentialité.
- Tests d'instrumentation des composants (mesure envoyée après un succès réel, rien après un échec) : non écrits ; seuls le module et la route sont testés.
- Actions hors périmètre de la 9.7 : Compte créé ou abandonné à l'étape de paiement (SM-C7, voie 1), Alertes et Pass (epic 7), livraisons en retard (SM-C1 : aucun délai promis stocké).
- Pas de purge d'evenement_mesure : à décider avec la 9.8 ou la 9.9 selon le volume.

## Formulaire de contact : adresse IP (à faire en 9.9)
- Aligner le formulaire de contact (src/modules/contact/dependances.ts, empreinteClient) sur la mesure : retenir la DERNIÈRE adresse de X-Forwarded-For (celle ajoutée par le proxy de Hostinger), jamais la première, que le client peut fixer. Décision de Jonathan du 2026-11-10.

## Story 9.8 partie 2 (tableau de bord) : points reportés, issus de la revue (2026-11-10)
- À vérifier : `tableau_paiements` somme les lignes non annulées, alors que `tableau_commandes_payees` et `vue_ventes_origine` utilisent `commande.total_cents`. Si `total_cents` n'est pas réduit à l'annulation d'une ligne, SM-1 et les graphiques divergent de la liste des Commandes. Ajouter un cas de ligne annulée dans `supabase/tests/tableau_de_bord.test.sql`. Le commentaire « la somme des montants d'un jour égale la somme des total_cents » de la migration appliquée n'est exact que sans ligne annulée (migration non modifiée).
- SM-C2 : une tentative `echouee` sans `cause` (colonne nullable) n'entre dans aucun compte ni dans le dénominateur ; ajouter une colonne `echouees_sans_cause` dans une nouvelle migration.
- SM-C3 : la moyenne ne porte que sur les mesures déjà reçues, donc biaisée à la baisse sur les périodes récentes (le nombre en attente est affiché).
- SM-9 : si `commande.compte_id` peut être nul (commande invité), tous les invités forment un seul client dans `vue_deuxiemes_achats` ; à vérifier.
- Navigation admin sur mobile : RÉSOLU le 2026-11-10 (menu ☰ « Plus », barre du bas à 3 entrées, cibles de 44 px). Reste : « Scan » et « Mesures » de UX-DR42 n'existent pas encore (à ajouter avec leurs pages) ; focus rendu au bouton ☰ après un choix de page (à noter, acceptable).
- Formulation des graphiques « Aucun paiement vérifié sur cette période. » : validée par Jonathan le 2026-11-10.
- Indicateurs « Pas encore mesuré » (sans source) : SM-4, SM-5, SM-6 (passage à un Kit payant), SM-8, SM-C1, SM-C4, SM-C6, SM-C7.
- Fins de ligne : RÉSOLU le 2026-11-10 (`.gitattributes` commit `1177fe1`, LF ; .ps1/.cmd/.bat en CRLF ; binaires protégés).

- `tests/unit/commande-ui.test.tsx` : 2 à 4 tests échouent par moments quand toute la suite tourne en parallèle (machine chargée), et passent seuls. À stabiliser (attentes trop courtes ?).
- 8.3 : la ville n'est pas affichée sur le mur : décision de Jonathan du 2026-11-10 (renoncement, pas de migration) ; notée dans la spec 8.3 et epics.md. Réglé.
- 8.3 : textes anglais du mur fournis par Jonathan le 2026-11-10 (« THEY WEAR IT », « Made with a kit {nomSite} », « Gallery »). Réglé.
- Admin : aucun lien « Administration » dans la vitrine (ni EXPERIENCE.md ni DESIGN.md n'en prévoient) ; l'admin ouvre /admin à la main. À décider si un lien discret pour le rôle Admin est voulu.
- Test `tests/unit/zone-compte.test.tsx` : le cas « session illisible → comme un visiteur » n'a pas pu être écrit (une exception levée par le double de test fait échouer le test malgré le try/catch de `ZoneCompte`) ; à comprendre avec la config Vitest.
- 5.7 PawaPay : écart ACCEPTÉ par Jonathan le 2026-11-10 avec le critère « rappels signés RFC 9421 » : la signature n'est pas vérifiée pour l'instant, la contre-vérification par l'API fait foi (règle 2 respectée). À reprendre si Jonathan veut les rappels signés. Décidés le même jour : pays hors RDC et Zimbabwe non couverts, échec sans cause précise = échec du prestataire. Restent ouvertes : devises activées sur le compte, adresse de rappel à déclarer, présence de `clientReferenceId` dans le rappel.
- Environnement : `.env.example` ne cite pas `NEXT_PUBLIC_UMAMI_WEBSITE_ID` ni `SUPABASE_JWKS_URL` présents dans `.env.local` (aucun code ne les lit) ; à documenter ou retirer.
- 7.1 : le bloc « Pass vendus et scannés » du détail admin d'un événement (FR-52) attend les tables de Pass (7.4 et 7.5). La 7.4 devra aussi poser la clé étrangère `ligne_commande.type_pass_id` et refuser dans `enregistrer_evenement` le retrait d'un Type déjà commandé (`KS_TYPE_PASS_VENDU`).
- 7.2 : le JSON-LD `Event` n'a pas d'`address` ni d'`eventStatus` (à ajouter si Jonathan saisit une adresse) ; le sitemap ne liste pas encore les pages Festival ; textes `[Texte à fournir]` de l'espace `Festival` à fournir (voir la spec 7.2). Boutons d'achat, « Complet » et Capacité : stories 7.4 et 7.5.
- Droits : `evenements.gerer` est retiré de l'Assistant (décision de Jonathan du 2026-11-10) : les Événements, Types de pass et Candidatures Stand sont Admin seulement ; la base le refuse déjà. FR-53 modifié en conséquence. À rouvrir quand les comptes Assistant seront créés.
- Textes de l'espace Festival fournis par Jonathan le 2026-11-10 (À venir / Passés / Programme / Pass / Événement passé, EN Upcoming / Past / Schedule / Pass / Past event, titre EN Festival, vide EN, bloc d'accueil EN « Otaku meetups ») : les `[Texte à fournir]` de la 7.2 sont remplacés.
- Bunny : compte en essai gratuit terminé, suspendu jusqu'au paiement (Jonathan, 2026-11-11) ; `bunny-public.spec.ts` répondait 401. Commit autorisé exceptionnellement malgré cet échec. Les tests qui appellent le vrai Bunny ne tournent plus que si `BUNNY_TESTS_REELS=1` (documenté dans `.env.example`). À régler avant la mise en ligne (9.9) : payer Bunny, puis relancer ce test avec la variable.
- Relecture de la 7.10 (sous-agent, 2026-11-11), aucun défaut bloquant. Corrigé : contrainte de colonne `evenement_galerie_url_hote` (migration 20270112140000). Restent ouverts : (a) si l'email de galerie est « ignoré » au rendu (lien effacé ou Pass annulé entre la planification et l'envoi), la clé d'envoi reste consommée : un lien ressaisi plus tard n'est pas renvoyé ; (b) la fin de l'Événement n'est pas définie pareil pour la page (début) et l'email (fin, sinon début) ; (c) l'email `pass_annule` ne dit pas que l'autre Pass du Stand est annulé aussi ; (d) EN « Pass already used or free » : préférer « complimentary » ; (e) revalider le lien à l'affichage et dans l'email (défense en profondeur).
- 7.11, ouverts (revue du 2026-11-11) : (a) une Commande de Stand en attente (jusqu'à 48 h) bloque les autres achats du Compte (règle « une seule Commande à payer ») ; (b) pas de limite de répétition (candidater, laisser expirer, recandidater) ; (c) le journal d'audit de `ligne_commande` garde les noms des titulaires (hérité de la 7.4) ; (d) `demarrer_tentative` n'interdit pas Polar pour une Commande de Pass côté base (seul l'aiguilleur le fait) ; (e) la suppression d'un Compte ne purge pas ses candidatures Stand avant les 90 jours ; (f) la page admin des candidatures lit au plus 200 lignes, sans pagination ; (g) la route de purge n'est pas planifiée (Q-D1) : la promesse « supprimés 90 jours après l'événement » ne tient qu'une fois planifiée (point de la 9.9) ; (h) les originaux d'envois abandonnés ne sont effacés que par cette même tâche.
- Fermeture sur place d'un Stand (2026-11-12, revue sous-agent) : décidé de ne pas ajouter d'état « fermé » côté exposant (`lireCandidatureDuCompte` le voit « payée » ; ses Pass apparaissent annulés dans « Mes Pass », aucun email n'est envoyé : fermeture sur place). À revoir si Jonathan veut un message pour l'exposant. Corrigés par la migration `20270113110000` : nouvelle candidature refusée après fermeture, date de fermeture dans le journal d'audit.
- Action 5 (revue 2026-11-12) : un envoi de Galerie « ignoré » pour un Compte sans adresse email est remis à envoyer chaque heure puis ignoré de nouveau (bruit seulement, aucun email). Accepté, cas rare.
- Relances (9.5, revue 2026-11-12) : un produit acheté entre la planification et l'envoi d'une Relance « nouveauté » est encore relancé (écart de quelques heures) ; une Relance ignorée compte pour le rythme. Acceptés.

- source_spec: `_bmad-output/implementation-artifacts/spec-refonte-haut-accueil.md`
  summary: Tester les variantes de `MediaHeros` (photo détourée, photo rectangulaire, vidéo) par un test de composant.
  evidence: Aucun test n'importe `MediaHeros` ; la vérification actuelle est visuelle (captures 1440 et 375 px) et les e2e ne couvrent la vidéo que si elle existe en base.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-12-accueils-selon-la-connexion.md`
  summary: Ajouter un champ « pseudo » au profil, modifiable dans Préférences, et l'utiliser pour « Bonjour [pseudo] » de l'espace personnel.
  evidence: Décision de Jonathan du 2026-11-13 (question 3 de la 9.12) : en attendant, nom Google sinon début de l'email.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-12-accueils-selon-la-connexion.md`
  summary: 9.14 — le cookie d'activité peut être supprimé ou forgé dans les outils du navigateur (ou absent pour des cookies de session rejoués) : la limite d'inactivité saute. Piste : cookie signé (HMAC, lié à session_id) et, cookie absent, comparaison à l'heure de connexion (claims amr).
  evidence: revue sécurité du 2026-11-13 ; l'intent 9.14 prévoit « cookie absent → posé, pas de déconnexion », d'où le report en attendant une décision.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-12-accueils-selon-la-connexion.md`
  summary: Rôle admin ou assistant retiré en base mais encore dans le jeton (≤ 1 h) : /fr et /compte mènent à /admin qui répond 404. Piste : fermer les sessions du Compte au retrait du rôle.
  evidence: revue sécurité et Edge Case Hunter du 2026-11-13.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-12-accueils-selon-la-connexion.md`
  summary: Redirections du proxy construites sur l'hôte reçu (request.nextUrl) ; vérifier derrière le proxy d'Hostinger ou passer par adresseSite() (story 9.9).
  evidence: revue sécurité du 2026-11-13 ; no-store déjà posé, pas d'exploitation directe.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-12-accueils-selon-la-connexion.md`
  summary: Accueil visiteur ≥ 1280 px : cadre de 900 px de haut avec overflow hidden, le texte peut être coupé si l'utilisateur augmente l'espacement ou la taille (WCAG 1.4.12).
  evidence: revue accessibilité du 2026-11-13.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-14-deconnexion-apres-inactivite.md`
  summary: Résolu le 2026-11-13 — le cookie d'activité est signé (HMAC, lié à la session) et un cookie absent ou fabriqué ne prolonge plus une session plus ancienne que le délai (entrée « cookie d'activité supprimable ou forgeable » de la 9.12).
  evidence: décision de Jonathan du 2026-11-13 ; tests tests/unit/activite-signee.test.ts et proxy-inactivite.test.ts (bloc « cookie d'activité signé »).

- source_spec: `_bmad-output/implementation-artifacts/spec-9-12-accueils-selon-la-connexion.md`
  summary: Résolu le 2026-11-13 — le « Voir le site » de l'admin laissait l'en-tête du site masqué après une navigation interne (règle body:has([data-coque-admin]) de la 9.10, page admin gardée en mémoire par Next.js) ; les liens rechargent maintenant la page. À surveiller : tout autre lien interne de l'admin vers le site public aurait le même effet.
  evidence: captures au clic du 2026-11-13 (docs/captures-accueil/journal-tout.txt).

- source_spec: `docs/design/admin/INVENTAIRE.md`
  summary: Story future « Profil » : changement de pseudo, changement d'email et suppression de compte depuis « Paramètres du profil » (menu du profil de l'admin et espace client).
  evidence: Décision de Jonathan du 2026-11-15 (Q8 de l'inventaire de la maquette admin) : ces fonctions n'existent pas dans le code et ne sont pas ajoutées pendant la refonte visuelle.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-15-types-vetement-et-autre-article.md`
  summary: Photos par couleur pour les Vêtements (la photo change quand on choisit une couleur sur la fiche).
  evidence: Décision de Jonathan du 2026-11-15 (Q-3 de la 9.15) : photos par produit pour l'instant.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-15-types-vetement-et-autre-article.md`
  summary: Admin, Vêtement : échanger les noms de deux couleurs dans un même enregistrement peut buter sur l'unicité (taille, couleur) au milieu de la mise à jour.
  evidence: Risque signalé par l'implémentation de la 9.15 (2026-11-16) ; cas rare, contournable en deux enregistrements.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-15-types-vetement-et-autre-article.md`
  summary: Test unitaire instable : tests/unit/evenements-admin-ui.test.tsx (PublicationEvenement, 2 cas) échoue parfois sous la charge de la suite complète, passe seul.
  evidence: Constaté le 2026-11-16 (échec puis succès à la relance de npm test, sans changement de code).

- source_spec: none
  summary: Bandeau « navigateur intégré » : rendu visible par le serveur puis masqué après l'hydratation quand le visiteur l'a déjà fermé (bref affichage inutile) ; mémoriser le choix dans un cookie lu côté serveur.
  evidence: Échec CI du run 43764987944 (commit 8b67426, 2026-11-15) à la ligne 37 : après `goto("/fr/connexion")`, le bandeau est encore présent au bout de 5 s ; passé au run suivant sans changement de code. Cause probable : le bandeau est rendu visible par le serveur et n'est masqué qu'après l'hydratation, par un `useEffect` qui lit `localStorage` (src/components/layout/BandeauNavigateurIntegreClient.tsx:30) ; si l'hydratation de /fr/connexion dépasse 5 s sur le runner, l'assertion échoue. Piste : mémoriser le choix dans un cookie lu côté serveur (plus de bandeau qui apparaît puis disparaît, aussi pour les vrais visiteurs) ou, à défaut, attendre explicitement l'hydratation dans le test. Test stabilisé le 2026-11-16 (commit fix(e2e) suivant 1006561) : attente explicite de l'hydratation au lieu d'une boucle de réessais ; 10 passages sur 10 en local. Reste le défaut côté visiteur ci-dessus.

- source_spec: none
  summary: Story 9.16, étape 3 b) — cadre A de l'admin (menu latéral, barre du haut, menu du profil) et composants communs, selon docs/design/admin/INVENTAIRE.md.
  evidence: Découpage décidé par Jonathan le 2026-11-16 : l'étape 3 commence par a) police KOMA Chikara + règle des 16 px ; le cadre A est la spec suivante.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-16-a-police-koma-chikara-et-16-px.md`
  statut: traité en 9.16 a) (décision de Jonathan du 2026-11-16 : liens et réglages de l'en-tête à partir de 1280 px, menu ☰ en dessous ; `src/components/layout/EnTete.tsx`)
  summary: PRIORITAIRE — L'en-tête déborde à 1024 px pour une personne connectée : panier d'un Compte admin à 1052 px de large sur `main` (017b58b), défaut antérieur à la 9.16 a ; avec KOMA Chikara et les 16 px, panier admin à 1215 px et `/compte` d'un client à 1075 px (nouveau).
  evidence: capture `docs/design/defauts/panier-1024-avant-9-16-a.jpg` (panier, Compte TEST_ admin, 1024 px, thème clair, code de `main`) ; mesures `document.documentElement.scrollWidth` par `scripts/captures-police.mjs` (`debordements-avant.json`, `debordements-apres.json`). Cause : barre de liens et réglages de l'en-tête (Administration, Mon compte, Se déconnecter) trop large entre 1024 et 1280 px.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-16-a-police-koma-chikara-et-16-px.md`
  statut: traité en 9.16 a) (2026-11-16, demande de Jonathan : maximum sous 0,05) : replis réglés « KOMA Repli Arial » et « KOMA Repli Roboto » (texte courant et majuscules, `src/app/globals.css`), hauteur du titre réservée et « FABRIQUE-LE. » insécable sur mobile ; 5 chargements en 4G lent : maximum 0,0052 (320 px), 0 (390 px), 0,0007 (1440 px) ; Android simulé (Arial retiré, Roboto servi) : 0,0007 (390 px), 0,0037 (1440 px). Reste à confirmer sur un vrai téléphone Android.
  summary: CLS de l'accueil à 390 px en 4G lent : 2 chargements sur 5 à 0,0551 (médiane 0, seuil 0,1) quand KOMA Chikara arrive après le premier affichage ; le titre et le surtitre en majuscules prennent une ligne de plus avec la police de repli et poussent la suite.
  evidence: mesure du 2026-11-16 (build de production local, Chromium sous Windows). La police de repli calculée par `next/font` (`adjustFontFallback: "Arial"`) est réglée sur les minuscules et reste environ 20 % trop large sur des majuscules espacées ; sur Android, sans Arial, ce réglage ne s'applique pas du tout. Piste : déclarer nous-mêmes la police de repli (local("Arial"), local("Roboto"), métriques réglées sur les majuscules) et remesurer sur un vrai téléphone Android. Accepté pour la 9.16 a par Jonathan (2026-11-16).

- source_spec: `_bmad-output/implementation-artifacts/spec-9-16-a-police-koma-chikara-et-16-px.md`
  summary: Cadre A (9.16 étape 3 b) — Admin sur ordinateur : l'encart « Besoin d'aide ? » du menu latéral passe sous le bas de la fenêtre (fenêtre de 900 px de haut) ; il n'est visible qu'en faisant défiler le menu.
  evidence: Constaté sur les captures 9.16 a du 2026-11-16 (admin, 1440 × 900). Cause antérieure à la 9.16 a : `src/components/admin/NavigationAdmin.tsx:87`, menu fixe sur toute la hauteur (`md:inset-y-0`) avec son propre défilement (`md:overflow-y-auto`) ; sur `main` (017b58b), le bas de l'encart arrivait déjà vers 905 px. Le passage à 16 px allonge le menu d'environ 60 px et cache davantage l'encart. Le fond du menu qui « s'arrête » avant le bas de page sur les captures vient de la capture pleine page (un élément fixe n'y est dessiné qu'à la hauteur de la fenêtre), pas du site. Piste pour le cadre A : encart compact ou fixé en bas du menu, liens resserrés.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-16-a-police-koma-chikara-et-16-px.md`
  summary: Les e2e ne détectent pas un débordement horizontal à 320 px : sur `main` (017b58b), l'en-tête dépassait de 5 px à 320 px sur toutes les pages publiques, et `tests/e2e/police.spec.ts` (contrôle `scrollWidth <= innerWidth` à 320 px) passait.
  evidence: Constaté le 2026-11-16 avec Chromium sans émulation mobile (325 px pour 320). Cause probable : le projet Playwright émule un Pixel 5 (`isMobile`), où la fenêtre s'élargit au contenu, si bien que `innerWidth` suit `scrollWidth`. Corrigé côté site en 9.16 a (logo et bouton Menu resserrés sous 360 px) ; reste à rendre le contrôle fiable (contexte sans `isMobile`, ou comparaison avec `document.documentElement.clientWidth` / largeur demandée).

- source_spec: none (mise à jour de sécurité Next.js 16.4.6, commit f2a986c)
  summary: À STABILISER (pas de simple relance) — 3 e2e du projet mobile dépassent leur délai de 5 s quand toute la suite `npm run test:e2e` tourne, et passent seuls : `tests/e2e/accueils.spec.ts:77` (clic de l'accueil vers la connexion à 1440 px, `toHaveURL(/\/fr\/connexion$/)` reste sur `/fr`), `tests/e2e/accueils.spec.ts:136` (connexion admin sans retour vers /fr/admin, navigation « Administration » non attachée), `tests/e2e/familles-vetement-autre.spec.ts:212` (fiche du Vêtement, `main` sans le titre du polo).
  evidence: Suite complète locale du 2026-11-16 sur next 16.4.6 : 226 réussis, 3 échoués (mobile) ; relance de ces deux fichiers seuls en mobile : 15/15. Serveur de dev sous charge (premières compilations à la demande). Pistes : attendre un état de la page plutôt qu'un délai fixe, préchauffer les routes, ou lancer ces fichiers en série.

- source_spec: `_bmad-output/implementation-artifacts/spec-9-16-b-cadre-admin-et-composants.md`
  summary: e2e instable (même famille que les 3 e2e mobiles ci-dessus) — `tests/e2e/catalogue.spec.ts:33` (/fr/cosplays, projet mobile, « un seul H1… aucune erreur serveur ») reçoit une erreur 500 au lieu de 200 pendant la suite complète `npm run test:e2e`, et passe seul.
  evidence: Suite complète locale du 2026-11-17 (9.16 b) : 233 réussis, 16 ignorés, 1 échoué ; relance de `npm run test:e2e -- tests/e2e/catalogue.spec.ts` : 27/27. Page publique non touchée par la 9.16 b. Serveur de dev sous charge (compilation à la demande) ; cause de la 500 non relevée (journal du serveur à capturer à la prochaine occurrence). Mêmes pistes : attendre un état, préchauffer les routes, lancer en série.

## Deferred from: code review of spec-9-16-b-cadre-admin-et-composants (2026-11-17)

- Critères de mise en page de l'admin (surtitre sur une ligne à 1024 px, aucun chevauchement ni défilement à 320 px, menu sans défilement à 1366 × 768) vérifiés seulement par `scripts/captures-admin.mjs` (à la main, hors CI). Ajouter un e2e à 320, 1024 et 1366 px dans un contexte sans `isMobile`, avec la correction du contrôle 320 px déjà notée plus haut.
- `FenetreFormulaire` : le fond flouté ne couvre que le bloc de contenu et n'a rien à flouter derrière (maquette D1 : page assombrie et floutée en plein écran). À trancher avec la page « Nouveau produit » de l'étape 4, premier usage du composant.
- `Pagination` affiche « Page X / Y » en casse normale : à comparer aux maquettes B10 et CP9 à l'étape 4.- source_spec: `_bmad-output/implementation-artifacts/spec-9-16-e-produits.md`
  summary: Archiver un produit présent dans des commandes en attente ou en fabrication (ou un Kit lié à des cosplays publiés) ne déclenche ni alerte ni refus.
  evidence: Revue 9.16 e ; la commande reste valide et doit être honorée, mais l'Admin n'est pas prévenu. Décision produit à prendre par Jonathan.
- source_spec: `_bmad-output/implementation-artifacts/spec-9-16-e-produits.md`
  summary: La carte produit de l'admin en anglais affiche le titre, l'univers et le texte alternatif en français.
  evidence: Revue 9.16 e ; défaut antérieur à la refonte (grille 9.10).

## Saisie avant l'hydratation dans les formulaires admin (noté le 2026-11-21)
- Les champs des formulaires admin (article, produit…) sont contrôlés par React : un texte tapé avant l'hydratation reste dans le champ mais pas dans l'état (compteur de l'extrait à 0, valeur non envoyée). Vu en CI sur 85132c2 (admin.spec.ts 9.16 h, mobile). Le test attend désormais l'hydratation ; le formulaire lui-même n'a pas été changé (refonte des champs hors de la nuit). Piste : champs non contrôlés (defaultValue) comme FormulaireConnexion, ou relecture des valeurs du DOM au montage.

- source_spec: `_bmad-output/implementation-artifacts/spec-bug-a2-filtre-univers.md`
  summary: e2e du filtre univers par le contrôle visible (choix à la souris et au clavier, liste des univers à jour malgré le cache `catalogue`), en `/en`, et combiné à une tranche de prix ou une taille.
  evidence: revue A2 (2026-11-22) : l'e2e A2 ne passe que `?univers=` dans l'adresse ; `lireUniversPublics` est en cache `catalogue`, qu'un semis SQL direct ne vide pas.

- source_spec: `_bmad-output/implementation-artifacts/spec-bug-a2-filtre-univers.md`
  summary: journal A2 : garder le code système d'un échec réseau (ECONNRESET, ENOTFOUND, délai) quand Supabase renvoie « fetch failed », sans jamais journaliser `details`.
  evidence: revue 2 d'A2 (2026-11-22), non vérifié (medium) : à trancher en provoquant une coupure réseau vers Supabase et en lisant l'erreur renvoyée par supabase-js.

- source_spec: `_bmad-output/implementation-artifacts/spec-bug-a2-filtre-univers.md`
  summary: e2e catalogue : vider l'étiquette de cache `catalogue` après le semis et le nettoyage SQL directs, pour qu'un serveur de dev déjà ouvert ne garde pas les univers TEST_ dans le filtre.
  evidence: revue 2 d'A2 (2026-11-22) : `lireUniversPublics` est en cache `catalogue`, que le SQL direct n'invalide pas.

- source_spec: `_bmad-output/implementation-artifacts/spec-bug-a4-champ-email-non-controle.md`
  summary: Connexion, étape du code : si le renvoi du code répond `email_invalide`, `renvoyerCode` donne le focus à `refEmail` (absent à cette étape) et le message « Saisis une adresse email valide. » s'affiche sous le champ du code (`aria-invalid` sur ce champ).
  evidence: revue d'A4 (2026-11-22), défaut antérieur à A4 (FormulaireConnexion.tsx, `renvoyerCode`) ; peu probable (l'adresse a déjà été acceptée au premier envoi). Piste : revenir à l'étape email avec l'erreur, ou erreur générale à l'étape du code.

- source_spec: `_bmad-output/implementation-artifacts/spec-bug-a3-traduction-navigateur-dom.md`
  statut: traité en A3-bis (décision de Jonathan du 2026-11-22 : translate="no" sur les seuls nombres qui changent, composant `src/components/ui/Nombre.tsx` ; spec `spec-a3-bis-nombres-non-traduits.md`, e2e `tests/e2e/panier-traduit.spec.ts`)
  summary: Page traduite par le navigateur : une mise à jour de texte faite par React (prix, total du Panier, stock, message d'état) n'apparaît plus, car le <font> du traducteur garde l'ancien texte ; à trancher par Jonathan (par exemple translate="no" local sur les montants, alors que la spec A3 l'exclut au niveau de la page).
  evidence: revue d'A3 (2026-11-22), non vérifié en navigateur (medium) ; limite connue de la traduction de Chrome, antérieure à A3 (la garde ne touche que removeChild/insertBefore). À trancher par un essai Chrome : traduire /fr/panier, changer une quantité, lire le total affiché.

- source_spec: `_bmad-output/implementation-artifacts/spec-a3-bis-nombres-non-traduits.md`
  summary: Tests instables (décision de Jonathan du 2026-11-22) — `tests/e2e/admin.spec.ts:229` et `tests/e2e/admin.spec.ts:373` (projet mobile, « Restaurer » après archivage) échouent en local contre koma-dev et sont verts en CI ; `tests/unit/blog-admin-liste.test.tsx` (« annonce… focus inchangé après Dépublier ») a échoué une fois sur main en CI.
  evidence: e2e admin : échecs locaux contre koma-dev (`--linked`), verts en CI (`--local`). Test unitaire du blog : rouge une fois sur main en CI le 2026-11-22 (run 45049866106), 6/6 verts en local. À stabiliser, pas à relancer en boucle.

- source_spec: `_bmad-output/implementation-artifacts/spec-a3-bis-nombres-non-traduits.md`
  summary: Nombres qui changent côté client mais HORS de la liste de Jonathan (non marqués translate="no", donc figés sur une page traduite) : progression de l'envoi de photo côté client (EnvoiPhotoClient), temps du lecteur vidéo de kit (LecteurVideoKit `duree`), dates et heures, délais de fabrication. (Compte à rebours de la connexion et progression des envois admin : ajoutés à A3-bis le 2026-11-22.)
  evidence: revue d'A3-bis (2026-11-22) ; exclus par la décision « UNIQUEMENT sur les nombres qui changent : prix, totaux… » ; à trancher par Jonathan s'il veut élargir la liste.

- source_spec: `_bmad-output/implementation-artifacts/spec-a3-bis-nombres-non-traduits.md`
  summary: Limites connues sur page traduite : les mots autour d'un nombre (pluriel « 1 jour » → « 2 jours », statuts de SuiviPaiement) restent figés, et un passage texte → montant (RecapCommande « à choisir » → montant, ListeCommandes « offert », PerformanceJour « au moins ») laisse le texte traduit affiché à côté du nouveau montant (garde removeChild d'A3).
  evidence: revue d'A3-bis (2026-11-22), mécanisme du traducteur (les <font> remplacent les nœuds que React met à jour) ; non vérifié dans un vrai Chrome (medium) : traduire /fr/commande, changer de zone, lire le récapitulatif.
