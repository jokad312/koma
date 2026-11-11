---
title: 'Story 7.11 : Candidature Stand'
type: 'feature'
created: '2026-11-11'
status: 'in-review'
route: 'dispatch'
---

## Intent

Toute personne ayant un Compte peut candidater pour un Stand d'un Événement publié tant qu'il reste des Stands. La candidature est **acceptée automatiquement** (décision de Jonathan du 2026-11-11, D6/D7/D9/D10 de `sprint-change-proposal-2026-11-10.md` mises à jour) : la place est réservée 48 h (réglage `delai_stand_heures`), le lien de paiement est affiché tout de suite et envoyé par email. Sans paiement dans ce délai, la place est libérée par simple calcul. Jonathan peut refuser après coup une candidature ou un Stand (contrefaçon, contenu inapproprié) : avant paiement le lien est annulé, après paiement le Stand et ses 2 Pass sont annulés et le remboursement passe par le circuit de la 7.9 (preuve obligatoire). FR-33b, AD-37, AD-7, AD-9, AD-12.

## Conformité aux règles de Jonathan (vérifiée avant de coder, 2026-11-11)

1. **Toute personne ayant un Compte candidate ; une candidature active par Compte et par Événement** : conforme (`deposer_candidature_stand`, refus `KS_CANDIDATURE_EXISTANTE`).
2. **Un Stand payé = 2 Pass nominatifs (exposant + aide) ; l'aide se nomme plus tard dans « Mes Pass », jusqu'au début de l'Événement** : la spec de départ (epics.md) demandait le nom de l'aide **avant** le paiement : **corrigé**. Le champ est facultatif au paiement ; sans nom, le Pass de l'aide porte un nom provisoire (`pass.nom_a_saisir`) que le Compte remplace une seule fois depuis « Mes Pass » (`nommer_aide_pass`).
3. **Les autres types (Standard, VIP…) s'achètent librement, sans candidature, y compris par un exposant** : conforme, `creer_commande_pass` (7.4) n'est pas modifiée (elle refuse toujours un Stand, `KS_STAND_SUR_CANDIDATURE`).
4. **Seul le type Stand exige une candidature** : conforme (`est_stand`).

## Décisions d'architecture

- Le Stand s'achète par une fonction séparée `creer_commande_stand` (candidature acceptée, non expirée, du Compte connecté). Aucune des fonctions de la 7.4 n'est réécrite : le chemin Pass libre reste fermé aux Stands.
- Statuts stockés : `validee` | `refusee`. « Payée » se déduit de la Commande liée (pas de réécriture de `confirmer_paiement`). Place occupée = candidature `validee` non expirée **sans Commande**, puis la Commande (en attente non échue, ou Pass émis) : jamais deux fois.
- La Commande reprend `expire_le` de la candidature. Un paiement tardif suit la règle du Trop-perçu (règle 2).
- Photos : bucket privé `candidatures-stand-private`, 3 objets exactement, envoi direct signé comme la 8.1, copie nettoyée (métadonnées retirées) ; jamais d'adresse publique ; l'admin les voit par lien signé de courte durée créé côté serveur.
- Refus après paiement : le montant rendu suit la formule de la 7.9 (frais d'annulation figés), ligne `remboursement` (cible `pass`, Pass de rang 1), confirmée avec preuve par `confirmer_remboursement` (inchangée). Frais à 100 % : pas de remboursement. **Décision à confirmer par Jonathan** (CGV §10 dit « sans remboursement » pour contrefaçon ; la demande du 2026-11-11 impose le circuit de la 7.9).
- Purge à 90 jours (photos et Instagram) : refusée ou expirée depuis 90 jours, ou Événement terminé depuis 90 jours ; tâche serveur `purger-candidatures-stand`.

## Critères d'acceptation (Given/When/Then, extraits de epics.md 7.11)

- Un exposant non connecté qui touche « Candidater » passe par la connexion puis revient au formulaire.
- Formulaire : description 20 à 1 000 caractères, Instagram (lien ou @pseudo, forme vérifiée), exactement 3 photos (JPEG, PNG, WebP, 15 Mo), case d'engagement obligatoire, jamais pré-cochée, enregistrée avec sa version ; textes FR/EN de l'epic.
- Envoi : candidature `validee`, place réservée, email `candidature_validee` (lien + heure limite), page de paiement atteignable tout de suite ; plus de Stand : « Complet » (`KS_COMPLET`), rien créé.
- Page de paiement : Compte du candidat seulement (sinon 404) ; mention photos et vidéos ; nom de l'aide facultatif ; mobile money ou MaishaPay, jamais Polar ; Code promo comme les autres Pass ; « Délai dépassé » après `expire_le`.
- Admin : liste et détail (description, photos signées, Instagram), « Refuser » (motif facultatif), journalisé ; avant paiement lien annulé et place libérée, après paiement Stand et 2 Pass annulés, remboursement avec preuve ; email `candidature_refusee`.
- Tests de non-contournement : un Stand ne se commande par aucun autre chemin ; un autre Compte ne peut ni lire ni payer la candidature ; deux candidatures simultanées pour la dernière place : une seule passe.

## Réalisation

- Base : migrations `20270112100000` à `20270112160000` ; `deposer_candidature_stand`, `candidature_stand_possible`, `creer_commande_stand`, `recapitulatif_commande_stand`, `nommer_aide_pass`, `refuser_candidature_stand`, `candidatures_stand_a_purger`, `marquer_candidature_stand_purgee` ; tests pgTAP `candidature_stand` (71) et `reglage_delai_stand` (8).
- Exposant : formulaire `/festival/<slug>/candidater` (3 photos en envoi direct signé vers le bucket privé, copies nettoyées), page de paiement `/festival/<slug>/stand/<id>` (Compte du candidat, sinon 404), nom de l'aide dans « Mes Pass ».
- Admin : bloc « Candidatures Stand » dans le détail de l'Événement (photos par lien signé de 5 minutes, refus), réglage `delai_stand_heures`, tâche de purge (POST, CRON_SECRET) non planifiée (Q-D1).
- Emails `candidature_validee` et `candidature_refusee`.

## Revue (deux sous-agents)

Aucun défaut bloquant. Corrigés : refus définitif, fenêtre de paiement, Stand remboursé qui bloquait, verrous, demandes d'annulation, pré-contrôle avant l'envoi des photos, émojis composés, délai d'abandon des envois (3 h), texte de l'email de refus. Ouverts : voir `deferred-work.md` (7.11).

## À tester à la main

Événement de test publié avec un Type Stand (quota 1) : candidater avec 3 photos (un Compte connecté) ; la page de paiement s'ouvre tout de suite et l'email arrive ; un second Compte voit « Complet » ; ouvrir le lien avec un autre Compte (404) ; payer en sandbox (mobile money ou MaishaPay, jamais Polar) : 2 Pass dans « Mes Pass », nommer l'aide ; admin : voir les photos, refuser avant paiement (lien annulé), refuser après paiement (Pass annulés, remboursement à confirmer avec preuve) ; laisser expirer 48 h : « Délai dépassé » et place libérée.

## Textes

FR/EN de l'epic (case d'engagement, mention de confidentialité). Autres textes (formulaire, états, admin, emails) écrits par Claude, à valider par Jonathan.
