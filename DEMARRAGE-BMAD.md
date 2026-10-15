# KOMA SHOP — démarrer avec la méthode BMad

Ce dossier suit la méthode BMad v6.12.4 pour Claude Code, en français, avec le parcours **standard greenfield** (projet neuf). Ce fichier dit quoi faire, dans quel ordre.

## Ce qui est déjà dans le dossier

| Élément | Rôle |
| --- | --- |
| `docs/guide-koma-shop.md` | Le guide A→Z de la boutique : la matière première de tous les agents |
| `CLAUDE.md` | Les règles absolues que Claude Code relit à chaque session (paiement, sécurité, interdiction de simuler) |
| `.gitignore` | Empêche d'envoyer les secrets et les fichiers lourds sur GitHub |
| `DEMARRAGE-BMAD.md` | Ce mode d'emploi |

## Ce que la commande d'installation va ajouter

| Élément | Rôle |
| --- | --- |
| `_bmad/` | Le moteur BMad : configuration, agents, workflows, scripts |
| `.claude/skills/bmad-*` | Les 29 commandes BMad utilisables dans Claude Code (`/bmad-help`, `/bmad-prd`…) |
| `_bmad-output/` | Où BMad range tout ce qu'il produit (brief, PRD, architecture, stories) |

## Étape 0 — Prérequis et installation (une seule fois)

Ouvre PowerShell dans le dossier `KOMA SHOP` (clic droit dans le dossier → « Ouvrir dans le terminal »).

1. **Installer `uv`** (obligatoire : chaque commande BMad lance un petit script Python avec `uv`) :
   ```powershell
   winget install --id=astral-sh.uv -e
   ```
   Ferme puis rouvre PowerShell, et vérifie : `uv --version`.
2. **Vérifier Node.js et Git** : `node -v` (version 20 ou plus) et `git --version`.
3. **Installer BMad** (copie-colle la commande en entier, sur une seule ligne) :
   ```powershell
   npx -y bmad-method@6.12.4 install --directory . --modules bmm --tools claude-code --user-name "Jonathan" --communication-language "French" --document-output-language "French" --set core.project_name="KOMA SHOP" --set bmm.user_skill_level=intermediate --yes
   ```
   À la fin, tu dois voir « BMAD is ready to use! » et « claude-code (29 skills → .claude/skills) ». La commande ne touche pas à `CLAUDE.md`, `.gitignore` ni `docs/`.
4. **Créer le dépôt Git** :
   ```powershell
   git init
   git add .
   git commit -m "Installation de BMad Method et du guide KOMA SHOP"
   ```
   Puis crée un dépôt vide sur GitHub et relie-le (`git remote add origin …`, `git push -u origin main`).
5. **Lancer Claude Code** dans le dossier : `claude`, puis tape `/bmad-help` pour vérifier que tout répond.

## Étape 1 — Planification (dans l'ordre)

Règle d'or : **une nouvelle session Claude Code pour chaque commande** (tape `/clear` ou relance `claude`). Cela évite que l'IA mélange les étapes ou invente.

| # | Commande | Agent | Ce qu'elle produit | Obligatoire |
| --- | --- | --- | --- | --- |
| 1 | `/bmad-product-brief` | Mary, analyste | Le brief produit | Recommandé |
| 2 | `/bmad-prd` | John, chef de produit | Le PRD : toutes les exigences | Oui |
| 3 | `/bmad-ux` | Designer UX | La spécification UX : héros, pages, parcours | Recommandé (le design compte beaucoup ici) |
| 4 | `/bmad-architecture` | Architecte | L'architecture technique | Oui |
| 5 | `/bmad-create-epics-and-stories` | Chef de produit | Les epics et les stories | Oui |
| 6 | `/bmad-sprint-planning` | — | Le plan de sprint et le suivi des stories | Oui |

**Phrase à donner au premier agent** (et à réutiliser si un agent te demande le contexte) :

> Le projet est KOMA SHOP. Toute la vision, les règles métier, la technique, le paiement, le design, le SEO et les phases sont dans `docs/guide-koma-shop.md`. Lis-le en entier avant de commencer. Les règles de `CLAUDE.md` sont non négociables, en particulier : K-Pay pour tout panier avec un produit physique, Polar uniquement pour les kits numériques, livraison faite à la main par le créateur, et interdiction de simuler un paiement ou une fonctionnalité.

Ce que tu dois apporter pendant ces étapes : le nom de domaine, les langues du site, les zones de livraison, le lien du dépôt de référence design, et tes photos (à mettre dans un dossier `assets/photos/` le moment venu).

## Étape 2 — Construction (en boucle, story par story)

| # | Commande | Quand |
| --- | --- | --- |
| 7 | `/bmad-build` | Pour chaque story : elle la prépare, la code, la vérifie |
| 8 | `/bmad-code-review` | Après chaque story, dans une nouvelle session |
| 9 | `/bmad-qa-generate-e2e-tests` | Quand un parcours complet est prêt (achat, bibliothèque…) |
| 10 | `/bmad-retrospective` | À la fin de chaque epic |

Après chaque story validée : teste toi-même sur ton téléphone, puis `git add .`, `git commit`, `git push`.

## À tout moment

| Commande | Usage |
| --- | --- |
| `/bmad-help` | « Où j'en suis, et quelle est la prochaine étape ? » |
| `/bmad-correct-course` | Un changement important en cours de route (nouvelle famille de produits, autre prestataire de paiement…) |
| `/bmad-project-context` | Plus tard, pour générer `AGENTS.md`. Si elle propose de déplacer les règles de `CLAUDE.md`, vérifie qu'aucune des règles 1 à 15 ne disparaît |
| `/bmad-brainstorming`, `/bmad-party-mode` | Réfléchir à une idée, ou faire débattre plusieurs agents |

## Bon à savoir

- Ne modifie pas `_bmad/config.toml` à la main : l'installateur le réécrit. Pour changer un réglage, relance l'installation ou utilise `/bmad-customize`.
- Mettre à jour BMad plus tard : `npx bmad-method@latest install` dans ce dossier, puis choisis « update ».
- Les clés secrètes (K-Pay, Supabase, Resend) vont dans `.env.local`, jamais dans le chat ni sur GitHub.
