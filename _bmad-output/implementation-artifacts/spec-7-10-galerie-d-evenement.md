---
title: 'Story 7.10 : Galerie d''événement'
type: 'feature'
created: '2026-11-11'
status: 'done'
route: 'dispatch'
---

## Intent

Jonathan saisit le lien public de la Galerie d'un Événement (Google Drive ou Google Photos). Le lien est enregistré, journalisé et affiché sur la page de l'Événement passé ; une fois l'Événement terminé, chaque acheteur de Pass reçoit un email avec ce lien, une seule fois (FR-39, AD-9, AD-10). Le retrait d'une photo se demande par le contact : Jonathan la retire à la main. Les photos restent chez Google : aucune photo n'entre dans le dépôt ni dans le stockage du site.

## Réalisé

- Migrations `20270111100000_modele_email_galerie_evenement.sql` (valeur `galerie_evenement`, fichier séparé), `20270111110000_galerie_evenement.sql` et `20270111120000_galerie_url_valide_correctif.sql` (la limite des expressions régulières de PostgreSQL est de 255 répétitions : le correctif remplace `{1,500}` par `+` ; la migration précédente, déjà appliquée, n'est pas modifiée).
- Colonne `evenement.galerie_url` (600 caractères au plus), lisible par le public comme les autres colonnes de présentation (Événements publiés seulement, RLS). `galerie_url_valide` : https seulement, hôtes `drive.google.com`, `photos.google.com` et `photos.app.goo.gl`, sans espace.
- `enregistrer_galerie_evenement` (Admin ; texte vide = effacer ; journalisé par le déclencheur `evenement_journaliser` avec son auteur) : `enregistrer_evenement` n'est pas modifiée.
- `planifier_galeries_evenements` : pour chaque Événement publié, terminé (fin, ou début sans fin, dépassée) et dont le lien est saisi, un envoi par Compte acheteur (Commande de Pass payée ou offerte qui garde au moins un Pass `valide` ou `scanne`). Clé d'envoi Événement + Compte : une seule fois, même si le lien change ou que la tâche rejoue. Lot de 500. Tâche pg_cron `galerie-evenement` chaque heure vers `/api/cron/galerie-evenement` (secrets Vault `site_url` et `cron_secret`, comme les alertes).
- `galerie_evenement_pour_envoi` : ce que le rendu relit (lien, Événement, acheteur). L'envoi ne porte que l'identifiant de l'Événement.
- Route `/api/cron/galerie-evenement` (POST, `CRON_SECRET`) ; email `galerie_evenement` (FR/EN) : lien de la Galerie en bouton, rappel du retrait par la page Contact ; jamais envoyé si l'Événement n'est pas publié ni terminé, si le lien est effacé ou si le Compte ne garde plus de Pass.
- Admin : section « Galerie d'événement » sur la page de l'Événement (`SectionGalerie`, droit `evenements.gerer`). Public : bloc « Les photos de l'événement » (lien dans un nouvel onglet, rappel du retrait) sur la page d'un Événement passé dont le lien est saisi ; cache « evenements » vidé à l'enregistrement.
- Tests : pgTAP `galerie_evenement.test.sql` (34 assertions, rejouées sur koma-dev en transaction annulée), Vitest `galerie-evenement.test.ts` (service, route, gabarit, rendu).

## Décisions

- Hôtes acceptés : Google Drive, Google Photos et les liens courts Google Photos seulement (le lien est affiché publiquement et envoyé par email : un hôte quelconque serait un vecteur d'hameçonnage).
- « Événement passé » pour l'affichage : début dépassé (comme le marquage « Événement passé » existant) ; « terminé » pour l'email : fin dépassée, ou début sans fin.
- Un acheteur dont tous les Pass sont annulés ou remboursés ne reçoit rien ; un Pass offert compte (l'acheteur est la personne qui l'a reçu).
- Pas de séquence de relance : un seul email par acheteur et par Événement.

## Limites connues

- Les photos n'étant pas hébergées par le site, aucune vérification n'est faite sur le contenu ni sur l'accessibilité du lien : c'est le partage réglé chez Google par Jonathan.
- La tâche s'exécute chaque heure : l'email part dans l'heure qui suit la fin de l'Événement (et la saisie du lien), puis le passage de `/api/cron/envois`.
- Textes écrits par Claude (FR/EN, `Festival.galerie.*`, `Emails.galerie_evenement.*`, `Admin.evenements.galerie.*`) : à valider par Jonathan.

## À tester à la main

Admin : page d'un Événement → « Galerie d'événement » → coller un lien Drive, enregistrer ; un lien http ou d'un autre site est refusé avec un message relié au champ ; un champ vide efface le lien. Public : la page d'un Événement passé montre le bloc et le lien s'ouvre dans un nouvel onglet ; un Événement à venir ne le montre pas. Email : Événement de test terminé avec un acheteur de Pass, attendre `galerie-evenement` puis `envois` (secrets Vault et Resend requis) : un seul email reçu, rien de plus au passage suivant ni après un changement de lien.
