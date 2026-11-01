# Notes Voie 3 — Contenu & Blog

## Story 8.6 : Écrire et publier un Article (Blog)

### Implémentation réalisée
- **Dépendances ajoutées** : `react-markdown` (10.1.0), `remark-gfm` (4.0.1), `rehype-sanitize` (6.0.0). Licences notées dans `docs/licences/markdown.md`. Aucune utilisation de `rehype-raw` (conformité sécurité HTML brut & NFR-8).
- **Migration SQL** : `supabase/migrations/20261125120000_article.sql`
  - Table `article` créée avec contraintes et RLS strictes (seuls les articles publiés sont visbiles au public).
  - Fonctions `enregistrer_article`, `publier_article`, `depublier_article` sous droit `blog.gerer`.
  - Triggers de mise à jour du timestamp `mis_a_jour_le` et journalisation d'audit automatique.
- **Socle Module TS** : `src/modules/blog/{types,schemas,dependances,service,actions}.ts`
  - Types métier, validation Zod des articles (`schemaArticle`).
  - Implémentation sécurisée des dépendances et actions serveur vérifiant `blog.gerer`.
- **Vérifications** :
  - `npm run lint` : Vert (0 erreur)
  - `npm run typecheck` : Vert
  - `npm test` : 118 fichiers, 1536 tests passés
  - `npm run build` : Vert
