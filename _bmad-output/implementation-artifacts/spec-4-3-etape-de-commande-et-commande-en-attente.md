---
title: 'Story 4.3 : étape de commande et Commande en attente'
type: 'feature'
created: '2026-11-01'
status: 'review'
route: 'dispatch'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** le client doit indiquer comment il reçoit sa commande, vérifier un total calculé par le serveur et réserver ses articles avant de payer (FR-13, FR-14, AD-8, AD-26).

**Approche :** `creer_commande` relit tout en base et fige prix, Forfait, total, délai annoncé, origine (stock ou fabrication), échéance et réservations ; `recapitulatif_commande` calcule le même Récapitulatif sans écrire ; page `/commande` (`/checkout`) et détail `/commande/[numero]` ; `delai_paiement` réglable ; `expirer_commandes_echues` planifiée par pg_cron chaque minute.

## Décisions

- Origine de la vente (`commande.origine`) : texte court en minuscules (`^[a-z0-9_-]{1,40}$`), repris du paramètre `?origine=` de l'étape de commande ; aucune liste fermée n'existe dans les documents, aucun cookie de mesure.
- Quantité d'un produit physique figée par ligne ; si le stock couvre la ligne, origine « stock », sinon « fabrication » sous le Plafond (réglage vide : pas de plafond, comme à la 2.3), sinon `KS_INDISPONIBLE`.
- Textes des cases (CGV, accès immédiat du Kit, engagement sur mesure) écrits d'après les critères d'acceptation, versions `v0-provisoire` ; le texte légal des CGV et de la Licence reste à valider par Jonathan (Q-5).
- Les moyens de paiement arrivent à la 4.5 : la page de la Commande en attente n'en propose aucun et n'en annonce aucun.
- Si pg_cron manque sur une base, la migration continue ; le stock se libère de toute façon à l'échéance et l'état « expirée » est calculé à la lecture.

</frozen-after-approval>

## Réalisé

- Migrations `20261117100000_commande_en_attente_schema.sql` (colonnes, `reservation`, `stock_disponible` et `places_fabrication_utilisees` qui comptent les réservations, `delai_paiement` à 30, `enregistrer_reglage`, `expirer_commandes_echues`, pg_cron) et `20261118100000_creer_commande.sql`, essayées dans une transaction annulée sur koma-dev puis appliquées ; le job pg_cron `expirer-commandes` est actif.
- Module commande (service, actions, queries), pages `/commande` et `/commande/[numero]`, composants `FormulaireCommande`, `RecapCommande`, réglage `delai_paiement` dans l'admin, `src/lib/dates.ts` (heure de Goma).
- Tests : pgTAP `commande_en_attente.test.sql` (47, en CI), Vitest (service, formulaire, délai et dates).

## Reporté / dette

- Pas de test e2e navigateur de l'étape de commande (connexion réelle) : à faire à la main.
- Le téléphone et l'adresse sont gardés dans la Commande (journal masqué) sans purge prévue.
- Les Commandes offertes (Kit gratuit) n'ont ni échéance ni réservation : inchangé.
