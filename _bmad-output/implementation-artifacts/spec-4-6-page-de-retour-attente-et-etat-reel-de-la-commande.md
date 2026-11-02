---
title: 'Story 4.6 : page de retour, attente et état réel de la Commande'
type: 'feature'
created: '2026-11-02'
status: 'done'
route: 'dispatch'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** un client qui vient de payer doit voir l'état réel de son paiement, jamais une fausse confirmation, pour savoir s'il doit attendre, réessayer ou écrire sur WhatsApp (FR-20, AD-35).

**Approche :** fonction SQL `etat_paiement_commande` (propriétaire seulement) ; `GET /api/commande/[numero]/etat` ; `GET`/`POST /api/paiement/retour/[prestataire]` qui redirigent vers la page de la Commande en ignorant tout paramètre de statut ; composant `SuiviPaiement` (sondage toutes les 3 s, vérification après 2 minutes, états finals).

## Décisions

- La page ne lit **jamais** un paramètre d'adresse pour décider d'un état : la route de retour ne lit que le numéro de Commande (que nous mettons nous-mêmes dans l'adresse de retour, `adresseRetourPrestataire`), le revalide, et la page vérifie qu'il est au Compte connecté.
- « Payée » exige un statut payé en base (`payee`, `en_fabrication`, `expediee`, `livree`) ; une Commande `offerte`, `annulee` ou `remboursee` n'est jamais « payée ».
- Une Tentative `en_cours` est retrouvée sur tout onglet ou rechargement : attente ou vérification, aucun choix de moyen, aucun bouton « Payer ». La durée de la vérification part de l'ancienneté de la Tentative lue au serveur.
- Texte du Trop-perçu : E-13 de EXPERIENCE.md, repris tel quel (trois motifs : expirée, déjà payée, impossible à honorer). Les motifs `montant_superieur`, `annulee` et `reservations_liberees` sont tous présentés comme « impossible à honorer ».
- « Réessayer » mène au bloc des moyens de paiement de la même page (rien à ressaisir). Le repli entre Agrégateurs (« Réessayer avec {Agrégateur suivant} ? ») est l'objet de la 5.3.
- Le texte de l'attente générique (« Nous attendons la confirmation de ton paiement. ») est écrit pour cette story ; « Valide le paiement sur ton téléphone. » (mobile money) vient avec la 5.3.

</frozen-after-approval>

## Réalisé

- Migration `20261130100000_etat_paiement.sql` (appliquée sur koma-dev, types régénérés) : `etat_paiement_commande(numéro, compte)`, service seulement, ni référence de transaction ni montant reçu.
- `src/modules/paiement/{etat,etat-queries}.ts`, routes `src/app/api/commande/[numero]/etat/route.ts` et `src/app/api/paiement/retour/[prestataire]/route.ts`, `src/components/commande/SuiviPaiement.tsx`, intégration dans `PageDetailCommande` ; textes `Paiement.suivi`.
- Tests : Vitest `paiement-etat`, `paiement-routes`, `paiement-suivi-ui` ; pgTAP `etat_paiement.test.sql` (19, états posés par des données `TEST_`). Le test pgTAP n'a pas été exécuté sur koma-dev (refus de Jonathan) : il tourne dans la CI.
- Correctif : l'assertion de `envois.test.sql` sur l'énumération des anomalies tient compte des quatre valeurs ajoutées par la 4.5.

## Écarts / dette

- La page de retour d'un vrai Prestataire n'est pas éprouvée (aucun adaptateur) : les routes sont testées avec des requêtes `TEST_`.
- L'échec « côté Prestataire » affiche le même message que l'échec client jusqu'à la 5.3.
