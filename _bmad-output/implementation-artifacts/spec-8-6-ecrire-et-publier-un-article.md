---
title: 'Story 8.6 : Écrire et publier un Article'
type: 'feature'
created: '2026-11-01'
status: 'draft'
baseline_commit: 'd9b6294558b7dc5fe7e5c582e241faa7f988415b'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/prds/prd-KOMA SHOP-2026-10-16/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** La section « Blog » du site n'existe pas encore : les guides de fabrication et les annonces (FR-43) n'ont aucune source, la communauté n'a rien à lire ni à partager, et le site n'est pas encore trouvé sur Google par ce type de contenu.

**Approach:** Module `blog` (nouveau) : table `article` avec ses fonctions d'écriture ; l'Admin Jonathan rédige un Article en Markdown simple (titres, listes, liens, images), avec aperçu ; il ajoute des images (mêmes règles de l'envoi que la story 2.2, texte alternatif obligatoire) et des liens vers des Produits et des Événements ; il publie ou le dépublie.

## Boundaries & Constraints

**Always:**

- Nouvelle migration datée dans la plage de la voie 3 (`20261125…20261129`, ou `202612…` si besoin) ; jamais modifier une migration appliquée.
- Règles d'écriture des stories précédentes : RLS active sur la nouvelle table, écritures par Server Action / fonction Postgres avec `p_auteur` et `search_path = ''`, journalisation, cache avec étiquette `articles` invalidée à la publication.
- Aucune donnée d'exemple, aucun texte client inventé : les textes manquants passent par `[Texte à fournir]` (règle 15).
- Aucune dépendance sans licence notée dans `docs/licences/` ; aucune version de rendu non figée (règle 6 et NFR-8).

**Never:**

- Rendre du HTML brut, un script ou un lien `javascript:` via le rendu Markdown.
- Publier un Article sans titre ni texte français, ou avec une image sans texte alternatif.
- Simuler un rendu, un email ou un statut ; les tests automatiques utilisent des données `TEST_` (règle 13).

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Rédaction incomplète | Article sans titre ni texte FR | Publication refusée ; texte obligatoire FR | message d'erreur dédié |
| Version anglaise optionnelle | Article sans version EN | Article FR uniquement : invisible sous `/en` | 404 côté public |
| Image sans texte alternatif | Image ajoutée au texte | Publication refusée | garde image |
| Markdown avec HTML brut / script / `javascript:` | Contenu saisi | Rendu nettoyé : aucun script, aucun handler, aucun lien actif | rendu sans danger |
| Aperçu | Contenu + images | Aperçu fidèle au rendu final | N/A |
| Dépublication | Article publié | `publie_le` remis à NULL, journalisation, cache invalidé | N/A |
| Lien vers un Produit / Événement inexistant | Lien saisi | Lien ignoré ou refusé au moment de la publication ? | décision au plan |

## Code Map

- SQL : nouvelle migration module `blog` (`article`, fonctions d'écriture `enregistrer_article` / `modifier_article` / `publier_article`…), tests pgTAP dans `supabase/tests/article.test.sql` (écrits ; exécutés en CI).
- Module : `src/modules/blog/{types,queries,actions,service,schemas}.ts` (module nouveau, conforme à l'AD-1).
- Rendu : bibliothèque Markdown à choisir au plan (maintenue, licence notée, version figée) ; le rendu doit refuser le HTML brut et les liens `javascript:`.
- Admin : formulaire d'écriture + aperçu + upload images (règle de l'envoi TUS de la story 2.2, texte alternatif obligatoire) + liens Produits/Événements.
- Messages : ajouts dans `messages/fr.json` et `messages/en.json` (espaces de nom `Admin.blog.*`), sans réorganisation.
- Pages publiques : le module de lecture (`/fr/blog`, `/en/blog`, `/fr/blog/[slug]`) appartient à la story 8.7 — pas de duplication ici.

## Tasks & Acceptance

**Execution:**

- [ ] Migration + tests SQL -- table `article` module `blog`, fonctions d'écriture, RLS, journal.
- [ ] Rendu Markdown nettoyé (pas de HTML brut, pas de script, pas de `javascript:`), aperçu.
- [ ] Admin : rédaction (titre FR + texte FR obligatoires, EN facultative), images avec texte alternatif, liens Produits/Événements, publication / dépublication.
- [ ] Messages FR/EN ; tests unitaires ; `lint`, `typecheck`, `test`, `build` verts ; `test:sql` en CI.

**Acceptance Criteria:**

- Given Jonathan écrit un Article, when il soumet, then le titre et le texte français sont requis, la version anglaise est facultative, l'aperçu montre le rendu.
- Given le rendu Markdown, when il est affiché, then le HTML brut, les scripts et les liens `javascript:` ne peuvent pas s'exécuter (test).
- Given Jonathan publie, then `publie_le` change, l'action est journalisée et le cache `articles` est invalidé ; la publication est refusée sans titre ni texte français, ou avec une image sans texte alternatif.

## Spec Change Log

(niveau draft : rien changé depuis la version d'origine de la story — aucun amendement de revue à date.)

## Review Triage Log

(niveau draft : la boucle de revue n'a pas encore démarré.)

## Design Notes

- La bibliothèque de rendu Markdown est **à trancher au plan** (décision de Jonathan) : maintenue, licence notée dans `docs/licences/`, version figée (règles 6 et 14). Aucune dépendance n'est installée aujourd'hui ; ce sera une décision bloquante pour la story.
- Le Markdown supporté par la première version : titres, listes, liens, images (mêmes règles d'envoi que la story 2.2).
- L'aperçu est rendu par le même composant que le rendu final : un seul chemin de sanitisation.

## Verification

**Commands:**

- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur
- `npm run test:e2e` -- formulaire admin (état vide, validation, aperçu, refus), rendu sans script ; `npm run test:sql` -- CI

**Manual checks:**

- Rédiger un Article avec un contenu contenant HTML brut : le rendu ne l'exécute pas.
- Publier un Article incomplet : refus ; publier complet : publication + journalisation + cache.
- Ouverture des pages `/fr/blog` et `/en/blog` : réservée à la story 8.7 (aucun rendu public ici).

</frozen-after-approval>
