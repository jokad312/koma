---
title: "Addendum au PRD — KOMA SHOP"
created: 2026-10-16
updated: 2026-10-16
---

# Addendum au PRD : KOMA SHOP

Ce document rassemble ce qui sert aux étapes suivantes (UX, architecture) mais n'a pas sa place dans le PRD.

## Paiement : alternatives écartées et raisons

- **K-Pay seul (décision d'origine de CLAUDE.md)** : remplacé le 2026-10-16 par plusieurs Agrégateurs. But : couvrir plus de pays et d'opérateurs, et avoir un secours en cas de panne.
- **Polar pour la carte de tous les Paniers** : impossible. La politique d'usage de Polar (https://polar.sh/legal/acceptable-use-policy, consultée le 2026-10-16) interdit les « Physical products ».
- **Présenter les billets comme des « pass » pour obtenir l'accord de Polar** : non retenu. Polar classe « Ticket sales » parmi les activités restreintes, soumises à examen. Changer le nom pour éviter cet examen reviendrait à tromper le Prestataire. Le risque : un gel du compte, qui encaisse aussi les Kits. Le mot « Pass » reste un choix de marque sur le site.
- **Trois Prestataires (MaishaPay pour le mobile money, K-Pay pour la carte des Produits physiques, Polar pour la carte des Kits)** : étape intermédiaire du 2026-10-16. Remplacée le même jour par la décision à quatre Agrégateurs.

## Documentation des Prestataires (fournie par Jonathan)

- K-Pay : https://www.kpay.africa/docs/ (mobile money, Visa et Mastercard ; cartes de test dans la documentation).
- PawaPay : https://docs.pawapay.io/ (API v2 ; mobile money uniquement).
- Polar : https://polar.sh/docs (produits numériques uniquement).
- MaishaPay : https://www.maishapay.net/api_docs/ (transmis le 2026-10-16).
- GeniusPay : https://geniuspay.ci/docs/api (transmis le 2026-10-16).

## Connexion dans les navigateurs intégrés

Google refuse sa connexion OAuth dans les navigateurs intégrés aux applications (erreur `disallowed_useragent`). Conséquences : le bouton Google est masqué dans ces navigateurs, le site invite à « Ouvrir dans Chrome », et le code à 6 chiffres par email marche partout. Le code a été préféré au lien magique : ce lien fait sortir l'utilisateur d'Instagram vers son application mail.

## Scan hors ligne : options étudiées

- **Un seul appareil hors ligne (retenu)** : aucun doublon possible.
- **Plusieurs appareils hors ligne** : écarté. Un même Code QR, copié, pourrait entrer deux fois. Personne ne le saurait avant le retour du réseau.

## Alertes WhatsApp

L'API WhatsApp Business (Meta ou Twilio) est écartée au lancement. Raisons : un nouveau fournisseur, des modèles de messages à faire valider par Meta, un coût par message. Au lancement, l'envoi est manuel, à partir de la liste exportée de l'admin.

## Vidéos de kit : pistes pour l'architecture

Le brief cite des services vidéo externes protégés (Bunny Stream, Cloudflare Stream, Mux) comme alternative à Supabase Storage. Google Drive et YouTube non répertorié sont exclus. Exigences du PRD : lecture en ligne uniquement, qualité adaptée au débit, reprise de lecture, aucun lien public.

## Contradictions des sources tranchées le 2026-10-16

- **Kit gratuit** : absent au lancement, ajouté 4 semaines après (le brief l'excluait, le guide l'incluait).
- **Retrait à Goma** : gardé, gratuit, à Goma seulement (il n'apparaissait que dans le guide).
- **Limite de 10 téléchargements par Fichier de kit (guide)** : remplacée par des téléchargements illimités.
- **Affiliation à commission automatique (phase 9 du guide)** : remplacée par des Codes promo. Le site calcule la commission ; Jonathan la paie à la main.
- **Zones de livraison (ancienne version de CLAUDE.md : Goma, RDC, Afrique, monde)** : seulement Goma et Bukavu.
