---
title: 'Story 7.7 : Accès bénévole'
type: 'feature'
created: '2026-11-11'
status: 'done'
route: 'dispatch'
---

## Intent

Jonathan donne à un bénévole un accès limité à l'écran de Scan d'UN Événement, pour la durée de cet Événement seulement. Le bénévole ne voit rien d'autre.

## Réalisé

Migrations `20270108100000_acces_benevole.sql` (table `acces_benevole`, fonctions `attribuer_/retirer_/lister_acces_benevoles`, `acces_scan_valide` calculée à chaque contrôle, `scan_exiger_acces` remplacée, tâche pg_cron `supprimer-acces-benevoles-echus`) et `20270108110000_acces_benevole_correctifs_revue.sql` (Compte à email confirmé seulement, fenêtre recalculée par trigger si les dates de l'Événement changent, fenêtre vide si la date est retirée). Module `src/modules/benevoles/`, section admin « Bénévoles à l'entrée », écran de Scan limité à l'Événement de l'accès. pgTAP `acces_benevole.test.sql` (96 assertions, rejouées sur koma-dev en transaction annulée) et Vitest. Revue indépendante : aucune élévation de privilège.

## Écarts avec l'epic

- Pas de rôle `benevole` dans la table des rôles : l'accès est une table dédiée par Événement (moindre privilège). Le bénévole n'a aucun droit de la matrice.
- Fenêtre : du minuit de Goma du jour de début au minuit qui suit le jour de fin ; sans heure de fin, jusqu'à minuit du jour de début (avertissement dans l'aide de la section).

## Limites connues

- Le test `commande-ui.test.tsx` (délais) reste instable sous charge (hors périmètre).
- Environ 5 allers-retours serveur par scan à l'entrée : à mesurer à l'essai terrain.
