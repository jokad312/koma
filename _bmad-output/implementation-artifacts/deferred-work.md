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

