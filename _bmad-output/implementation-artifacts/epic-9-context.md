# Epic 9 Context: La croissance, le pilotage et la mise en ligne

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Donner à Jonathan les outils de croissance et de pilotage (Codes promo et commissions d'Affiliés, Relances et Emails ciblés avec consentement, mesure d'audience maison, tableau de bord aux vrais chiffres), puis mettre le site en ligne sur son domaine. L'epic accueille aussi des stories ajoutées après le découpage initial (9.10 à 9.16 : refontes visuelles, accueils, inactivité, nouveaux types d'article), dont la source est un document de conception propre (par exemple `docs/design/admin/INVENTAIRE.md` pour la 9.16) et non le fichier des epics.

## Stories

- Story 9.1 : Créer un Code promo
- Story 9.2 : Appliquer un Code promo
- Story 9.3 : Ventes et commissions par Code promo
- Story 9.4 : Consentements, Préférences et désinscription
- Story 9.5 : Relances
- Story 9.6 : Emails ciblés
- Story 9.7 : Mesure d'audience maison
- Story 9.8 : Tableau de bord
- Story 9.10 : Refonte de la mise en page de l'admin (hors epics.md)
- Story 9.11 : Performance avant mise en ligne
- Story 9.12 : Accueils selon la connexion
- Story 9.14 : Déconnexion après inactivité
- Story 9.15 : Types d'article « Vêtement » et « Autre article »
- Story 9.16 : Refonte de l'admin selon la maquette et police unique (hors epics.md, en étapes)
- Story 9.9 : Mise en ligne (dernière, bloquée par le domaine)

## Requirements & Constraints

- Une story est terminée quand lint, types, tests (Vitest, SQL, Playwright) et build passent en local ET quand la CI GitHub de son dernier commit est verte.
- Story avec un écran : axe-core sans violation, clavier, 320 px, zoom 200 %, `prefers-reduced-motion`, `forced-colors`, aucun défilement horizontal à 375 px ; tous les textes visibles dans `messages/fr.json` et `messages/en.json`.
- Aucune donnée, aucun email ni statut simulé hors des tests ; doubles de test préfixés `TEST_`.
- Aucune police, image ou fichier tiers sans licence vérifiée et notée dans `docs/licences/`.
- Emails commerciaux : consentement, jamais à un Compte mineur au lancement, au plus un tous les 2 jours.

## Technical Decisions

- Nouvelle migration pour tout changement de schéma, RLS sur toute table ; écritures par Server Action ou route validée par Zod, ou fonctions SECURITY DEFINER avec `p_auteur` et journal d'audit.
- Variables d'environnement ajoutées : `.env.example` sans valeur et `src/lib/env.ts`.
- Typographie : rôles `t-*` définis comme utilitaires dans `src/app/globals.css` (variables `--font-corps`, `--font-condensee`) ; polices chargées par `next/font/local` (`src/lib/fonts.ts`) dans `src/app/[locale]/layout.tsx`.

## UX & Interaction Patterns

- Thème Sumi & washi, crème par défaut et sombre au choix, un seul rouge #D7261E (DESIGN.md, EXPERIENCE.md).
- Refonte de l'admin (9.16) : décisions de Jonathan du 2026-11-15 dans `docs/design/admin/INVENTAIRE.md` § 5 (police KOMA Chikara unique, 16 px minimum, couleurs, cadre A, lucide-react).

## Cross-Story Dependencies

- 9.16 se fait par étapes validées une à une (police, puis 9.15, puis cadre A et composants, puis pages), un commit par étape, CI verte.
- 9.9 dépend du domaine (Q-D1) et de toutes les autres stories.
