---
review: versions-et-realite
cible: ARCHITECTURE-SPINE.md (updated 2026-10-20)
date: 2026-10-20
lentille: "Chaque décision engagée a-t-elle été vérifiée sur le web / la réalité (versions, existence, starter) plutôt qu'affirmée de mémoire ?"
methode: npm view (2026-10-20), lecture directe des fichiers du starter sur GitHub (branche canary), docs officielles Next.js, next-intl, Supabase, Bunny, Hostinger, Polar, pawaPay, K-Pay
---

# Revue « versions et réalité » du spine KOMA SHOP

## Verdict

**Globalement solide, mais trois écarts réels à corriger avant la première story :**

1. **Le starter `with-supabase` contredit le spine** : il livre **Tailwind 3.4** (pas 4.3.3), **pas de dossier `src/`**, `cacheComponents: true`, `eslint-config-next 15.3.1`, et un `proxy.ts` qui redirige tout visiteur non connecté vers `/auth/login` (incompatible avec une boutique publique).
2. **`revalidateTag` a changé de signature en Next 16** : la forme à un argument d'AD-17 est **dépréciée** ; et avec `cacheComponents: true` (activé par le starter), le cache passe par `'use cache'` + `cacheTag`, ce que le spine ne dit pas.
3. **K-Pay : aucune signature de notification dans sa doc publique** ; `verifierNotification` ne peut reposer que sur la contre-vérification `checkstatus`. La doc publique ne cite que le RWF (« USD in future »).

Toutes les versions npm du tableau Stack sont **encore les dernières aujourd'hui** (aucune n'a bougé depuis le 2026-10-17).

Légende : **Confirmé** = vérifié aujourd'hui contre une source primaire ; **Périmé / contredit** = la réalité diffère du spine ; **Non vérifié** = pas de source primaire trouvée, à confirmer.

---

## 1. Versions du tableau Stack contre npm (2026-10-20)

| Paquet | Spine | npm `latest` aujourd'hui | Date de publication | Statut |
| --- | --- | --- | --- | --- |
| next | 16.4.2 | 16.4.2 | 2026-10-15 | Confirmé |
| react / react-dom | 19.3.1 | 19.3.1 | — | Confirmé |
| @supabase/supabase-js | 2.118.0 | 2.118.0 | — | Confirmé (`next` = 3.0.0-next.29 : une v3 se prépare, voir plus bas) |
| @supabase/ssr | 0.12.7 | 0.12.7 | 2026-09-08 | Confirmé |
| supabase (CLI) | 2.121.0 | 2.121.0 | — | Confirmé |
| next-intl | 4.14.9 | 4.14.9 | 2026-10-02 | Confirmé ; peer `next ^16.0.0` OK |
| tailwindcss | 4.3.3 | 4.3.3 | — | Confirmé côté npm, **mais contredit par le starter** (voir §2) |
| zod | 4.6.7 | 4.6.7 | — | Confirmé |
| pdf-lib | 1.17.1 | 1.17.1 | **2021-11-06** | Version exacte, mais **paquet non maintenu** (voir ci-dessous) |
| qrcode | 1.5.4 | 1.5.4 | 2024-08-05 | Confirmé (stable, peu actif ; acceptable pour un usage simple) |
| resend | 6.34.1 | 6.34.1 | — | Confirmé |
| vitest | 5.0.5 | 5.0.5 | — | Confirmé |
| @playwright/test | 1.64.1 | 1.64.1 | — | Confirmé ; peer de next `^1.51.1` OK |
| typescript | « 5.x (version livrée par le starter) » | **7.0.2** (latest) ; 6.0.3 ; 5.9.3 | 7.0.2 : 2026-07-08 | **Imprécis** (voir ci-dessous) |

Commande : `npm view <pkg> version` + `npm view <pkg> time --json`, exécutées le 2026-10-20.

Points de vigilance :

- **Supabase JS v3 en préparation** (`@supabase/supabase-js@next` = 3.0.0-next.29). Rien à changer, mais épingler `2.118.0` (exact, sans `^`) et ne pas suivre le tag `next`.
- **Le starter déclare `"next": "latest"`, `"@supabase/ssr": "latest"`, `"@supabase/supabase-js": "latest"`**. Un `npm install` plus tard tirera autre chose que le spine. **Correctif** : remplacer `latest` par les versions exactes du spine dès la création, et committer `package-lock.json` (Hostinger détecte le gestionnaire par le fichier de verrouillage).

### pdf-lib : non maintenu → **Périmé**

- Dernière version 1.17.1 publiée le **2021-11-06** ; dernier push du dépôt `Hopding/pdf-lib` en **juillet 2024** ; **318 tickets ouverts** (API GitHub, 2026-10-20).
- Fork maintenu : **`@cantoo/pdf-lib` 2.11.1** (publié le 2026-09-15, dernier push 2026-09-11, 25 tickets ouverts, même API, dépôt `cantoo-scribe/pdf-lib`).
- Adéquation au filigrane : pdf-lib (et son fork) sait dessiner du texte sur chaque page d'un PDF existant, donc **le besoin est couvert**. Deux limites réelles à noter dans la story :
  - les polices standard (`StandardFonts`) ne couvrent que WinAnsi : un nom d'acheteur avec des caractères hors Latin-1 échoue → embarquer une police TTF via `@pdf-lib/fontkit` (lui aussi figé en 2022) ou via le fork ;
  - les PDF chiffrés ne se modifient pas avec pdf-lib d'origine ; les fichiers de kit étant produits par Jonathan, il suffit de les fournir non chiffrés.
- **Correctif** : remplacer la ligne Stack par `@cantoo/pdf-lib 2.11.1` (ou garder `pdf-lib 1.17.1` en l'assumant explicitement comme gelé) et ajouter « police TTF embarquée pour le filigrane » à AD-11.
- Sources : https://www.npmjs.com/package/pdf-lib , https://github.com/Hopding/pdf-lib , https://www.npmjs.com/package/@cantoo/pdf-lib , https://github.com/cantoo-scribe/pdf-lib

### TypeScript : ligne acceptable mais à préciser → **Imprécis**

- `typescript@latest` est aujourd'hui **7.0.2** (port natif en Go, publié le 2026-07-08). Le starter déclare `"typescript": "^5"` → installe **5.9.3**.
- La doc Next.js confirme que **TypeScript 7 est pris en charge par `next build`** via le CLI `tsc` local (la v7 n'expose pas l'API compilateur JS) ; contrepartie : diagnostics sans les cadres d'erreur propres à Next. Source : https://nextjs.org/docs/app/api-reference/config/typescript
- « 5.x » n'est pas une version : deux postes peuvent diverger.
- **Correctif** : écrire `TypeScript 5.9.3 (épinglé)` ; passage à 7.x = décision séparée, après vérification que typescript-eslint et l'outillage suivent.

### Autres paquets que le spine utilise sans les nommer

- `sharp` : dépendance **optionnelle** de `next@16.4.2` (`^0.35.5`, dernière 0.35.5, engines `node >=20.9.0`). Voir §6.
- `eslint-config-next` : **16.4.2** sur npm, alors que le starter épingle **15.3.1** → à aligner.
- Polar SDK : `@polar-sh/sdk` 1.0.2 (le helper de vérification exige ≥ 1.0.0-alpha.19, voir §7). Envoi TUS côté navigateur : `tus-js-client` 4.3.1. Ces paquets n'apparaissent pas dans le tableau Stack ; les ajouter quand la story les introduit.

---

## 2. Starter `with-supabase` : réglages réels contre le spine

Lu directement sur https://github.com/vercel/next.js/tree/canary/examples/with-supabase (dernier commit touchant l'exemple : 2026-10-19 ; migration Next 16 : PR #86105, 2025-11-18).

| Point | Starter aujourd'hui | Spine | Statut |
| --- | --- | --- | --- |
| Fichier proxy | `proxy.ts` **à la racine**, `export async function proxy` → `updateSession` | `src/proxy.ts` | Confirmé pour le nom ; **emplacement différent** |
| @supabase/ssr | `createServerClient` + `cookies.getAll/setAll`, `supabase.auth.getClaims()` dans le proxy | `@supabase/ssr` (cookies) | Confirmé |
| Variables d'env | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`.env.example`) | idem (memlog) | Confirmé |
| **Tailwind** | **`tailwindcss ^3.4.1`**, `tailwind.config.ts`, `postcss.config.mjs` avec `tailwindcss` + `autoprefixer`, `tailwindcss-animate` (figé 2023), shadcn (`components.json`) | **Tailwind 4.3.3** | **Contredit** |
| Arborescence | **aucun `src/`** ; alias `@/*` → `./*` ; `app/`, `lib/`, `components/` à la racine | `src/app`, `src/modules`, `src/lib`, `src/proxy.ts` | **Contredit** |
| next.config | **`cacheComponents: true`** | non mentionné | **Manquant dans le spine** (voir §3) |
| Lint | `eslint ^9`, **`eslint-config-next 15.3.1`** | « lint » | **Périmé** dans le starter |
| Auth fournie | pages mot de passe : `sign-up`, `forgot-password`, `update-password`, `confirm` (verifyOtp par `token_hash`) | OTP 6 chiffres par email (AD-24) | **Divergent** : pages à remplacer |
| Garde d'accès | le proxy **redirige vers `/auth/login` toute route ≠ `/` sans session** | boutique publique | **Incompatible tel quel** |

Correctifs concrets (à écrire dans le spine ou dans la story 1 « socle ») :

1. **Tailwind** : soit lancer `npx @tailwindcss/upgrade` juste après le clonage (passe à v4 : `@tailwindcss/postcss` 4.3.3, configuration CSS `@theme`, retrait d'`autoprefixer`, remplacement de `tailwindcss-animate` par `tw-animate-css` 1.4.0), soit créer le projet avec `create-next-app` standard (qui livre Tailwind 4) et recopier seulement `lib/supabase/*` + `proxy.ts` du starter. La ligne « Starter » du spine doit dire laquelle des deux.
2. **`src/`** : déplacer `app/`, `lib/`, `components/`, `proxy.ts` sous `src/` et changer l'alias en `"@/*": ["./src/*"]` (la doc Next accepte `proxy.ts` « in the project root, or inside `src` »).
3. **Garde d'accès du proxy** : supprimer la redirection générale ; garder seulement le rafraîchissement de session (`getClaims`) et la langue (next-intl). Les droits restent vérifiés côté serveur (AD-13), ce que la doc Next recommande aussi (« Always verify authentication and authorization inside each Server Function rather than relying on Proxy alone »).
4. **Pages d'auth** : remplacer les pages mot de passe par le parcours OTP code (AD-24).
5. **eslint-config-next** : aligner sur 16.4.2.

---

## 3. Next.js 16 sur serveur Node simple

### revalidateTag → **Périmé dans AD-17**

- Signature actuelle : `revalidateTag(tag: string, profile: string | { expire?: number })`. **La forme à un argument est dépréciée** (« It currently works if TypeScript errors are suppressed, but this behavior may be removed ») — donc une erreur TypeScript en pratique. Source : https://nextjs.org/docs/app/api-reference/functions/revalidateTag (lastUpdated 2026-08-25).
- Nouveau `updateTag(tag)` : **uniquement dans les Server Actions**, expiration immédiate (« read-your-own-writes »). Source : https://nextjs.org/docs/app/api-reference/functions/updateTag
- Avec `cacheComponents: true` (activé par le starter), les étiquettes se posent par `'use cache'` + `cacheTag(...)` ; et `generateMetadata` qui lit des données non mises en cache déclenche une erreur de prérendu si le reste de la page est statique.
- **Correctif AD-17** : « Les lectures publiques mises en cache sont des fonctions `'use cache'` qui posent `cacheTag('produit:<id>')`… ; une mutation admin faite par Server Action appelle `updateTag(tag)` ; une invalidation depuis une route (`/api/cron/*`, notification) appelle `revalidateTag(tag, { expire: 0 })` ou `revalidateTag(tag, 'max')` selon le besoin. » Et ajouter une ligne : « `cacheComponents: true` (réglage du starter) conservé / retiré » — à trancher. Ajouter aussi : une fonction `'use cache'` ne lit pas `cookies()` → les lectures publiques mises en cache utilisent un client Supabase **sans session** (clé publishable), jamais celui du proxy.

### proxy.ts → **Confirmé**

- « The `middleware` file convention is deprecated and has been renamed to `proxy` » ; v16.0.0 : « Proxy defaults to the Node.js runtime » ; l'option `runtime` y est interdite ; Node.js server : supporté. Source : https://nextjs.org/docs/app/api-reference/file-conventions/proxy (lastUpdated 2026-09-04).

### generateMetadata → **Confirmé, avec réserve**

- Toujours supporté ; `params` est une `Promise`. Avec Cache Components : utiliser `'use cache'` dans `generateMetadata` si les données ne dépendent pas de la requête, et rendre `metadataBase` en **chaîne** (un `URL` n'est pas sérialisable dans `'use cache'`). Source : https://nextjs.org/docs/app/api-reference/functions/generate-metadata

### next-intl 4 avec Next 16 → **Confirmé, avec réserve**

- La doc next-intl utilise `src/proxy.ts` et précise que `proxy.ts` « was called `middleware.ts` up until Next.js 16 ». La composition avec un autre traitement (ici la session Supabase) se fait en enveloppant `createMiddleware` dans sa propre fonction `proxy`. Source : https://next-intl.dev/docs/routing/middleware
- La configuration recommandée lit la langue via **`next/root-params`** (disponible par défaut depuis Next 16.3) ; `setRequestLocale` est désormais « legacy ». Source : https://next-intl.dev/docs/routing/setup
- **Non vérifié** (sources tierces seulement) : comportement exact de next-intl sous `cacheComponents` (le `Link` de next-intl pendant le prérendu, `setRequestLocale` qui rendrait la page dynamique). **Correctif** : la story socle doit prouver par un build qu'une fiche produit sous `/fr` et `/en` est bien prérendue avec `cacheComponents` actif, avant d'écrire les autres pages.
- Piège à documenter : **le proxy doit recopier les cookies Supabase** sur la réponse produite par next-intl (le starter l'explique en commentaire : « copy over the cookies… If this is not done… terminate the user's session prematurely »).

### Node 24 → **Confirmé**

- `next@16.4.2` : `engines.node >=20.9.0` ; Hostinger propose 24. OK.

---

## 4. Supabase

| Affirmation du spine | Statut | Source / précision |
| --- | --- | --- |
| pg_cron chaque minute + pg_net qui appelle une URL externe, secret lu dans Vault | **Confirmé** | Le guide officiel montre `cron.schedule('* * * * *', …)` + `net.http_post` avec `(select decrypted_secret from vault.decrypted_secrets where name = …)`. https://supabase.com/docs/guides/functions/schedule-functions . Le même schéma marche pour `Authorization: Bearer <CRON_SECRET>` vers le site. Rappel : pg_net est asynchrone (la réponse arrive dans `net._http_response`), d'où l'idempotence exigée par AD-10, déjà prévue. |
| OTP email 6 chiffres | **Confirmé, à régler explicitement** | Le guide parle d'un « six-digit code » ; la référence de config CLI indique `auth.email.otp_length` réglable de **6 à 10** (défaut 6). Un retour de terrain (non officiel) signale des projets qui émettent 8 chiffres. **Correctif** : fixer la longueur à 6 dans le tableau de bord des deux projets et ne pas coder `^\d{6}$` sans lire ce réglage. https://supabase.com/docs/guides/auth/auth-email-passwordless , https://supabase.com/docs/guides/local-development/cli/config |
| Validité 10 min | **Confirmé** | « Email OTP expiration » réglable (défaut 1 h) → 600 s. Attention : ce réglage s'applique aussi aux liens de confirmation, récupération, changement d'email et invitation. Même source. |
| Renvoi après 60 s | **Confirmé** | « By default, a user can only request an OTP once every 60 seconds. » Même source. Le modèle d'email doit contenir `{{ .Token }}`. |
| SMTP Resend pour les emails d'auth | **Confirmé** | Resend est cité comme service compatible. **Point manquant** : avec un SMTP personnalisé, limite par défaut **30 emails/heure**, à relever dans Rate Limits avant l'ouverture. https://supabase.com/docs/guides/auth/auth-smtp |
| Téléversement TUS avec reprise sur autorisation signée | **Confirmé** | Le jeton d'une URL d'envoi signée se passe dans l'en-tête `x-signature` de l'envoi TUS ; morceaux de **6 Mo obligatoires** ; utiliser l'hôte direct `https://<projet>.storage.supabase.co`. La taille maximale par fichier n'est pas indiquée sur cette page (elle dépend du plan et du réglage global) → à vérifier pour les STL lourds. https://supabase.com/docs/guides/storage/uploads/resumable-uploads |
| Région eu-west-3 Paris | **Confirmé** | Listée « West EU (Paris) eu-west-3 ». https://supabase.com/docs/guides/platform/regions |

---

## 5. Bunny Stream

| Affirmation | Statut | Précision |
| --- | --- | --- |
| Jeton de lecture signé, court, créé côté serveur | **Confirmé (faisable)**, mais **le spine ne dit pas lequel** | Bunny a **deux** mécanismes distincts : (a) **Embed View Token** : `SHA256_HEX(token_security_key + video_id + expiration)`, paramètres `token` et `expires` (secondes Unix) sur l'URL de l'iframe `player.mediadelivery.net/embed/<lib>/<video>` ; il protège l'iframe **mais pas les URL directes**. (b) **CDN Token Authentication** (zone de diffusion) : couvre « all direct URLs », dont playlists HLS, segments, MP4 de secours, miniatures. Pour HLS, la méthode avancée HMAC-SHA256 avec **jeton de répertoire** (`token_path`) placé **dans le chemin** (`/bcdn_token=…&expires=…&token_path=…/playlist.m3u8`) est requise pour que les segments soient couverts. https://bunny.net/docs/stream-security , https://bunny.net/docs/stream/token-authentication , https://bunny.net/docs/cdn/security/token-authentication/advanced |
| Envoi TUS avec signature pré-calculée | **Confirmé** | `SHA256(library_id + api_key + expiration_time + video_id)` calculé côté serveur ; en-têtes `AuthorizationSignature`, `AuthorizationExpire`, `LibraryId`, `VideoId` ; point d'entrée `https://video.bunnycdn.com/tusupload` ; la vidéo doit être créée avant (API). https://bunny.net/docs/reference/tus-resumable-uploads |
| Bibliothèque publique pour héros et extraits | **Confirmé** (une bibliothèque sans token auth est publique par défaut) | — |
| Tarifs | **Non vérifié** (déjà Q-A1) | — |

**Correctif AD-11** : écrire explicitement « bibliothèque privée : **Embed View Token ET CDN Token Authentication activés** ; lecteur = iframe Bunny avec jeton embed (ou lecteur maison hls.js avec jeton CDN de répertoire) ; durée de validité du jeton = X min ». Sans le jeton CDN, les URL HLS directes d'une vidéo privée restent lisibles par quiconque les obtient. Noter aussi que **l'IPv6 est désactivé** sur une zone où la token auth est active (doc Bunny), sans impact attendu.

---

## 6. Hostinger Business Web Hosting (application Node.js)

| Affirmation | Statut | Précision |
| --- | --- | --- |
| Choix de la branche de déploiement | **Confirmé** | « Branch — The branch that triggers deployments (defaults to the repo's default branch) ». https://docs.hostinger.com/node.js/github |
| Node 24 | **Confirmé** | « 18, 20, 22, or 24 ». Même source + https://www.hostinger.com/support/?p=6553 |
| Déploiement auto à chaque push | **Confirmé** | `npm install` (ou yarn/pnpm détecté par fichier de verrouillage), build, redémarrage ; un déploiement à la fois, les suivants en file. Variables d'env injectées au build **et** à l'exécution. |
| `next build` puis `next start` | **Partiellement vérifié** | La doc décrit « Build command » (script npm) et un « Entry file » pour les applis serveur, **pas de champ « start command »** ; la détection Next.js est annoncée automatique. Que Hostinger lance bien `npm start` / `next start` n'est **pas écrit noir sur blanc**. **Correctif** : vérifier dans hPanel lors du premier déploiement ; prévoir sinon un `server.js` minimal (serveur personnalisé Next) comme fichier d'entrée. |
| Modèle officiel Hostinger | **Périmé** | La doc Next.js liste encore `github.com/hostinger/deploy-nextjs`, mais ce dépôt renvoie **404** (vérifié le 2026-10-20). La preuve « Hostinger listé dans les templates officiels » du memlog ne tient plus ; la retirer. |
| `sharp` / `next/image` | **Non vérifié** | `sharp ^0.35.5` est une dépendance optionnelle de Next 16.4.2 et s'installe avec des binaires précompilés sur Linux x64 ; Next.js dit qu'un serveur Node gère toutes les fonctions. Aucune doc Hostinger sur les modules natifs. Le build se fait **sur le serveur partagé** (3 Go RAM partagés entre tous les sites du compte). **Correctif** : story socle = déploiement « hello world » avec une image `next/image` et vérifier `/_next/image` en production ; repli documenté : `images.unoptimized` ou loader Supabase Storage (transformation d'images Supabase, plan Pro). |

---

## 7. Vérification des notifications de paiement (`verifierNotification`)

| Prestataire | Statut | Ce qui est confirmé |
| --- | --- | --- |
| **Polar** | **Confirmé** | Signature **Standard Webhooks** (en-têtes `webhook-id`, `webhook-timestamp`, `webhook-signature`) pour les secrets créés depuis le 2026-09-08 ; ancien format « Polar HMAC » pour les secrets antérieurs. Helper `validateEvent` du SDK TS (≥ 1.0.0-alpha.19 essaie les deux). https://polar.sh/docs/integrate/webhooks/delivery |
| **pawaPay v2** | **Confirmé, option à activer** | Rappels signés selon **RFC 9421** (`Signature`, `Signature-Input`, `Signature-Date`, `Content-Digest`, `Content-Type`), ex. `ecdsa-p256-sha256` ; clé publique via l'endpoint Public Keys (`/v2/public-key/http`) ; **les rappels signés doivent être activés dans le tableau de bord pawaPay** (sinon les en-têtes sont absents). Exemple Node : github.com/PawaPay/signatures-node-example. https://docs.pawapay.io/v2/docs/signatures . **Correctif** : ajouter « rappels signés activés » à la liste de mise en service, et combiner avec `consulterStatut` (la doc ne dit rien sur les renvois de rappels). |
| **K-Pay** | **Contredit / partiellement non vérifié** | La doc publique (https://www.kpay.africa/docs/) décrit un rappel vers `returl` (réponse attendue `"reply":"OK"`) et une contre-vérification `POST https://pay.esicia.com/` avec `"action":"checkstatus"` + `refid`, mais **aucune signature** (seulement `Kpay-Key` et Basic Auth pour les appels sortants ; l'exemple curl utilise même `secret_key`, incohérent avec le tableau). Devise : « RWF and USD in future » ; aucun pays listé. **Correctif** : AD-5 doit dire que, pour K-Pay, `verifierNotification` = **ignorer le contenu du rappel et appeler `checkstatus`** (statut + montant), ce que la règle 2 de CLAUDE.md autorise (« contre-vérification ») et ce que le guide prévoit déjà (ligne 495). La couverture RDC / USD reste une question pour K-Pay (Q-1/Q-3/Q-14 ; le guide mentionne une doc « SWITCHPRO » non fournie). |
| MaishaPay, GeniusPay | Non examinés | Déjà en Q-2, hors lancement. |

---

## Correctifs à reporter dans le spine (récapitulatif)

1. **Stack / Starter** : préciser la stratégie Tailwind 4 (upgrade du starter ou `create-next-app` + copie de `lib/supabase`), le passage sous `src/`, la suppression de la redirection globale du proxy, le remplacement des pages mot de passe par l'OTP, `eslint-config-next 16.4.2`, et le remplacement des `latest` par des versions exactes.
2. **AD-17** : `'use cache'` + `cacheTag` ; `updateTag` dans les Server Actions admin ; `revalidateTag(tag, profil)` à deux arguments dans les routes ; décider `cacheComponents` ; client Supabase sans session pour les lectures mises en cache.
3. **TypeScript** : `5.9.3` épinglé (TS 7 = décision séparée).
4. **pdf-lib** : `@cantoo/pdf-lib 2.11.1` (ou gel assumé de 1.17.1) + police TTF embarquée.
5. **AD-11** : nommer les deux jetons Bunny (embed + CDN répertoire) et leur durée.
6. **AD-5** : K-Pay = contre-vérification `checkstatus` seulement ; pawaPay = rappels signés à activer + clé publique.
7. **AD-9 / AD-24** : relever la limite SMTP de 30/h ; fixer `otp_length = 6` et l'expiration à 600 s dans les deux projets (noter l'effet sur les autres liens d'auth).
8. **AD-20 / memlog** : retirer la preuve « modèle Hostinger officiel » (404) ; story socle = premier déploiement qui prouve `next start` + `next/image` + prérendu next-intl sur Hostinger.
