# KOMA SHOP

Boutique en ligne pour otakus, tenue par un seul créateur (NATHANGROUP SARL, Goma, RDC). Elle vend des cosplays faits main, des accessoires et des kits numériques (fichiers et tutoriels vidéo), avec un blog et une section Événements. Le site est bilingue : français (`/fr`) et anglais (`/en`). Les prix sont en USD.

Les règles du projet et la méthode de travail sont dans [`CLAUDE.md`](CLAUDE.md). La source de vérité métier est le [guide KOMA SHOP](docs/guide-koma-shop.md).

## Pile technique

Next.js 16 (App Router, TypeScript), Tailwind CSS, Supabase (Auth, Postgres avec RLS, Storage), next-intl, Zod. Tests : Vitest, Playwright, pgTAP.

## Prérequis

- Node.js 24 (`engines` : `>=24 <25`)
- Un projet Supabase de développement (`koma-dev`) et la CLI Supabase (installée par `npm install`)
- Docker n'est pas nécessaire en local : les tests SQL et les tests e2e de connexion tournent dans GitHub Actions

## Démarrage

```bash
npm install
cp .env.example .env.local   # puis remplir les valeurs (jamais commitées)
npm run dev                  # http://localhost:3000
```

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run lint` | ESLint |
| `npm run typecheck` | Types (`next typegen` puis `tsc --noEmit`) |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:sql` | Tests SQL (`supabase test db`) ; sans Docker, le script l'explique et sort sans erreur |
| `npm run test:e2e` | Tests de bout en bout (Playwright, Chromium : `npx playwright install chromium`) |
| `npm run build` | Build de production |
| `npm run db:link` puis `npm run db:push` | Relier et migrer `koma-dev` |
| `npm run types` | Génère `src/lib/supabase/types.ts` depuis le projet lié |
| `npm run admin:attribuer -- <email>` | Donne le rôle admin au Compte de cette adresse (voir ci-dessous) |

## Premier admin

Aucun écran ne crée d'admin. Le Compte doit exister (connexion une première fois sur le site), puis, depuis la racine du projet, avec `SUPABASE_SECRET_KEY` et `NEXT_PUBLIC_SUPABASE_URL` dans `.env.local` (ou déjà dans l'environnement) :

```bash
npm run admin:attribuer -- adresse@exemple.com
```

La commande cherche le Compte par son email, appelle `attribuer_role` (auteur `systeme`, journalisé) et s'arrête avec un code de sortie différent de 0 si l'adresse est inconnue. Elle ne s'utilise qu'en ligne de commande : l'adresse n'est jamais écrite dans le dépôt. Relancée, elle ne change rien. Le rôle prend effet tout de suite : l'admin s'ouvre sur `/fr/admin/reglages`.

## Variables d'environnement

Les noms sont dans [`.env.example`](.env.example), qui ne contient aucune valeur. Les valeurs vivent dans `.env.local` en local et dans les variables de l'application Node.js sur Hostinger en production. Aucun secret, aucune clé et aucune donnée client n'entrent dans ce dépôt public.

Variables utilisées aujourd'hui :

- `NEXT_PUBLIC_SITE_URL` : adresse publique du site
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` : projet Supabase, côté navigateur
- `SUPABASE_SECRET_KEY` : clé secrète, serveur seulement
- `NEXT_PUBLIC_TITRES_SAKURA` : option des titres en Sakura Town (éteinte par défaut, licence en attente)
- `MAILPIT_URL` : tests e2e de connexion seulement
- `KOMA_VERIFIER_TEXTES` : à poser à `true` (ou `1`, casse ignorée ; toute autre valeur non vide est signalée sur stderr) uniquement dans les variables de l'application Node.js sur Hostinger. Le build (`prebuild`, `scripts/verifier-marqueurs.mjs`) échoue alors en nommant les clés tant qu'un texte « [Texte à fournir] » reste dans une page publique (À propos, FAQ, Contact). Absente de la CI, du développement et du build local : le marqueur reste affiché.

Les autres variables du fichier (paiements, Bunny, Resend, tâches planifiées) arrivent avec leurs stories.

## Flux de travail : local → main → CI → production

1. Développement en local sur `koma-dev`, en ligne, sans Docker.
2. Commit directement sur `main` (pas de branche de travail).
3. GitHub Actions (`.github/workflows/ci.yml`) lance lint, types, tests, tests SQL sur une base Supabase locale jetable, build et tests e2e. La CI doit être verte.
4. La branche `production` avance seulement après une CI verte sur `main`, et après que les migrations ont été appliquées au projet Supabase de production avec la CLI. Hostinger déploie la branche `production`.
5. Une migration déjà appliquée n'est jamais modifiée : on en crée une nouvelle.

La partie Hostinger (application Node.js, variables de production, domaine) sera complétée à la story 9.9.

## Structure

- `src/app/` : pages et routes (`[locale]` pour `/fr` et `/en`)
- `src/modules/` : logique métier par domaine (aujourd'hui : `comptes`)
- `src/lib/` : aides communes (Supabase, session, SEO, environnement, sécurité)
- `src/components/` : composants (`layout`, `ui`)
- `messages/` : tous les textes visibles, en `fr.json` et `en.json`
- `supabase/` : migrations, tests SQL, modèle d'email, configuration locale
- `tests/` : tests unitaires et e2e
- `docs/` : guide métier et licences des polices et du logo
- `_bmad-output/` : documents de planification et d'implémentation (méthode BMad)

## Licences

Le code est sous la licence du fichier [`LICENSE`](LICENSE). Les polices et le logo ont leur propre licence, notée dans [`docs/licences/`](docs/licences/).
