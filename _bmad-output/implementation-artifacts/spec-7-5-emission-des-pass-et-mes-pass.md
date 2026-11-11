---
title: 'Story 7.5 : Émission des Pass et « Mes Pass »'
type: 'feature'
created: '2026-11-11'
status: 'done'
route: 'dispatch'
---

## Intent

Dès le paiement vérifié d'une Commande de type pass, chaque titulaire reçoit un Pass nominatif avec un Code QR unique et non devinable, un code court, un email `pass_emis` et sa carte dans « Mes Pass ». Un Stand donne deux Pass.

## Réalisé

Migrations `20270106100000_modele_email_pass_emis.sql`, `20270106110000_emission_pass.sql` (table `pass`, jeton de 192 bits, code court de 8 caractères, `evenements_emettre_pass` appelée par `confirmer_paiement` dans la même transaction ; copie intégrale de la version précédente avec une seule branche ajoutée) et `20270106120000_emission_pass_correctifs_revue.sql` (les Pass d'une Commande non payée/offerte ne comptent plus dans les places). Page `/compte/pass`, Carte Pass (QR SVG sur fond blanc, zone de silence, code court, « Agrandir »), email avec QR en pièce jointe intégrée, bibliothèque `qrcode-generator` 2.0.4 (MIT, version figée, note dans `docs/licences/`). pgTAP `emission_pass.test.sql` (75 assertions, rejouées sur koma-dev en transaction annulée, ainsi que `achat_pass`, `envois` et `confirmer_paiement`). Revue indépendante : un bloquant (places non libérées) corrigé.

## Choix et limites

- La charge du QR est `KOMA:PASS:<jeton>` (pas une URL) ; le scan (7.6) devra aussi refuser un Pass dont la Commande n'est plus payée/offerte.
- Si l'émission échoue, tout le paiement est annulé et la notification est rejouée ; le code d'erreur est journalisé. Au-delà de l'échéance, un rejeu devient un trop-perçu à rembourser à la main.
- Rendu de l'email dans de vrais clients et lecture du QR par un téléphone : non testés.
- `pass_scanne_coherent` obligera la 7.9 à effacer `scanne_le` pour annuler un Pass déjà scanné, ou à revoir la contrainte.
