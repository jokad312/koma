---
title: 'Story 5.1 : saisie de la Couverture des Agrégateurs'
type: 'feature'
created: '2026-11-02'
status: 'done'
route: 'dispatch'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** le site ne doit proposer que des couples pays-opérateur réellement encaissables ; la couverture vient de la documentation officielle et des contrats de chaque Agrégateur, jamais d'une supposition (règle 9, Q-1).

**Approche :** table `couverture` sans aucune ligne par défaut ; Jonathan saisit, depuis la page admin Prestataires, chaque couple d'un Agrégateur avec sa **source obligatoire** ; un couple reste « À vérifier » tant qu'il n'est pas confirmé ; le service ne passe à `choisirPrestataire` que les couples **confirmés**.

## Décisions

- Aucun pays ni aucun opérateur n'est écrit dans une migration ni dans le code : le pays se saisit par son code à 2 lettres (ISO 3166-1) et son nom s'affiche par la bibliothèque d'internationalisation du navigateur (`Intl.DisplayNames`) ; l'opérateur est un texte libre de 1 à 40 caractères.
- Seuls les Agrégateurs (PawaPay, K-Pay, MaishaPay) ont une Couverture ; Polar, qui ne fait que de la carte, n'en a pas.
- Un couple est unique par Agrégateur (même couple permis chez deux Agrégateurs différents). Ajout, confirmation et retrait sont journalisés (auteur compris).
- Le contrôle « seul un couple confirmé d'un Agrégateur **actif** sert » est double : `lireCouverture` ne lit que les couples confirmés, et l'aiguilleur ne retient que les Agrégateurs actifs (tests de la 4.5 inchangés et repassés).

</frozen-after-approval>

## Réalisé

- Migration `20261201100000_couverture.sql` (appliquée sur koma-dev, types régénérés) : table `couverture` (service seulement), fonctions `ajouter_couverture`, `confirmer_couverture`, `retirer_couverture` (security definer, Admin seulement), trigger de journal.
- `src/modules/paiement/couverture.ts` (validation, service), `queries.ts` (`lireCouvertureAdmin`, `lireCouverture` : confirmés), `dependances.ts`, `actions.ts`, `src/components/admin/CouvertureAgregateur.tsx` intégré à `/admin/prestataires` ; textes `Admin.prestataires.couverture`.
- Tests : Vitest `paiement-couverture` (service, validation, lien avec l'aiguilleur), `paiement-couverture-ui` (erreurs reliées aux champs par `aria-describedby`) ; pgTAP `couverture.test.sql` (30), exécuté en CI seulement (aucune exécution sur koma-dev).

## Écarts / dette

- La liste des pays et des opérateurs n'est volontairement pas proposée en menu : elle viendrait d'une supposition. Jonathan saisit ce que la documentation de l'Agrégateur énonce.
- Le choix du pays et de l'opérateur par le client (listes issues de ces couples) est l'objet de la 5.2.
