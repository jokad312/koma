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
