---
title: 'Story 7.4 : Achat de Pass'
type: 'feature'
created: '2026-11-11'
status: 'done'
route: 'dispatch'
---

## Intent

Un client connecté achète des Pass nominatifs d'un Événement (hors Panier), pour lui et pour d'autres personnes. La Commande de type `pass` suit la même couche de paiement (mobile money ou MaishaPay, jamais Polar). Tout (prix, quotas, Capacité, dates de vente) est lu en base ; les Stands ne s'achètent pas ici (candidature : 7.11).

## Réalisé

Migrations `20270105100000_achat_pass.sql` (lignes de Pass sur `ligne_commande`, `places_evenement_utilisees`, `places_type_pass_utilisees`, `etat_vente_evenement`, `creer_commande_pass` ; `creer_commande` inchangée) et `20270105110000_enregistrer_evenement_type_vendu.sql` (un Type commandé ne peut plus être retiré, `KS_TYPE_PASS_VENDU`). Module `src/modules/evenements/achat*.ts`, page `/festival/[slug]/acheter`, boutons « Acheter des pass » / « Complet » / « Vente fermée » (composant dynamique sous Suspense), tests Vitest (service, interface, aiguillage : un Pass ne part jamais chez Polar) et pgTAP `achat_pass.test.sql` (60 assertions, rejouées sur koma-dev dans une transaction annulée ; balise `$$` corrigée après la revue).

## Choix à valider par Jonathan

- La mention photos/vidéos est enregistrée dans `commande.acceptations` (objet `pass_photos_video`, version `v0-provisoire`) ; son texte reste `[Texte à fournir]` (engagement légal). La version devra changer quand le texte est fourni.
- Les CGV ne sont pas exigées pour un Pass (l'epic ne cite que la mention).
- Plafond technique de 20 Pass par Commande.
- Une Commande en attente expirée ne compte plus dans les places.

## Limites connues

- Un Pass payé n'émet encore rien (ni email, ni Pass, ni QR) : c'est la 7.5. Ne pas ouvrir la vente en production avec la 7.4 seule.
- Les noms des titulaires (tiers) apparaissent en clair dans `journal_audit` (comme l'adresse de livraison) : à traiter dans la politique de conservation.
- `creer_commande_pass` duplique la logique Code promo / échéance / idempotence de `creer_commande`.
- Un Pass offert (8.5) ne compte pas encore dans la Capacité.
