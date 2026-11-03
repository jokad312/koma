---
title: 'Stories 5.2 et 5.3 : choix du mobile money, attente et repli entre Agrégateurs'
type: 'feature'
created: '2026-11-03'
status: 'done'
route: 'dispatch'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème (5.2) :** le client choisit son pays, son opérateur et son numéro pour payer en mobile money, sans qu'aucun moyen inventé ne lui soit proposé.
**Problème (5.3) :** pendant qu'il valide sur son téléphone, il sait quoi faire ; si un Agrégateur tombe en panne, il peut réessayer avec le suivant du même couple, sans que rien ne parte dans son dos (FR-16, FR-17, FR-18, FR-19).

**Approche :** `demarrer_tentative` / `enregistrer_initiation` / `echouer_tentative` en base ; service `demarrerTentative` où le **serveur** choisit le Prestataire par l'aiguilleur pur (le navigateur n'envoie que moyen, pays, opérateur, numéro) ; formulaire `ChoixPaiement` (listes natives, aide à l'indicatif, erreurs reliées aux champs) ; écran d'attente enrichi (montant, numéro masqué, « À payer avant ») ; proposition de repli calculée par le serveur (`proposerRepli`), jamais exécutée sans toucher du client.

## Décisions

- **Aucun adaptateur n'existe** : le registre `src/modules/paiement/registre.ts` est vide, donc aucun Prestataire ne peut être actif ni aucun bouton de paiement apparaître en production. Toute la logique (démarrage, échec, repli) est prouvée par des **doubles `TEST_`** (`tests/doubles/TEST_prestataire.ts`), jamais par du code du site (règle 13).
- Limite des lancements (AD-22) : **10 par fenêtre de 10 minutes et par Compte** (valeur de départ, `tentative.ts`).
- Le numéro de téléphone n'est **jamais conservé en clair** : la base ne garde que sa forme masquée (`+255••••••678`) ; le numéro complet passe à l'adaptateur et reste, pour « Réessayer », dans le stockage de l'onglet du client. Le pays et l'opérateur de la Tentative échouée viennent de la base.
- Un échec de l'**appel** au Prestataire (délai, coupure) n'est pas un échec de paiement : la Tentative reste `en_cours` (AD-28) ; seul un refus confirmé l'échoue. Une référence de transaction déjà utilisée est refusée et fait échouer la Tentative côté Prestataire.
- Repli seulement sur échec **confirmé côté Prestataire** d'un mobile money ; jamais sur un échec client (E-27), jamais sur un état inconnu. Tous les Agrégateurs du couple épuisés : « Choisis un autre opérateur ou la carte. ».
- La liste des pays est l'union des couples **confirmés** des Agrégateurs **actifs** et branchés ; « Autre pays » mène à « Le mobile money n'est pas encore disponible dans ton pays. ».
- Alignement sur l'architecture (AD-27) : statuts du Trop-perçu `a_rembourser` / `rembourse` / `honore` (migration `20261203100000`).

</frozen-after-approval>

## Réalisé

- Migrations `20261203100000_trop_percu_statuts.sql` et `20261204100000_tentative_fonctions.sql` (appliquées sur koma-dev, types régénérés) : colonne `telephone_masque`, `demarrer_tentative`, `enregistrer_initiation`, `echouer_tentative`, `etat_paiement_commande` enrichi (montant, Prestataire, numéro masqué, dernière Tentative échouée, Agrégateurs exclus).
- `src/modules/paiement/{tentative,registre,etat,service,queries,dependances,actions}.ts`, `src/components/commande/{ChoixPaiement,MoyensPaiement,SuiviPaiement}.tsx` ; textes `Paiement.choix` et `Paiement.suivi`.
- Tests : Vitest `paiement-tentative` (aiguillage serveur, repli, délai sans repli, référence déjà utilisée, Panier mixte et Pass jamais chez Polar), `paiement-choix-ui`, `paiement-suivi-ui`, `paiement-service` ; pgTAP `tentative_paiement.test.sql` (24), exécuté en CI seulement.

## Écarts / dette

- Aucun test d'intégration avec un vrai Prestataire (aucun adaptateur) : à faire avec les stories 4.7 et 5.4 à 5.7.
- `confirmer_paiement`, les routes de notification et la tâche `reconcilier-tentatives` ne sont pas dans ces stories : une Tentative `en_cours` ne devient `reussie` que par elles.
- Le texte « Nous attendons la confirmation de ton paiement. » (carte) et le libellé du bouton « Payer par carte » sont écrits pour ces stories.
