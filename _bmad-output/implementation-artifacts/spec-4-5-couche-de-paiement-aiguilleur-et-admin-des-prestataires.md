---
title: 'Story 4.5 : couche de paiement, aiguilleur et admin des Prestataires'
type: 'feature'
created: '2026-11-02'
status: 'done'
route: 'dispatch'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** un client ne doit voir que les moyens de paiement réellement possibles pour son achat, et jamais un choix qui échoue ; un panier mixte ou un Pass ne doit jamais partir chez Polar (règles 9 à 11).

**Approche :** tables `prestataire`, `tentative_paiement`, `notification_recue`, `trop_percu` (AD-4, AD-28) ; port `PrestatairePaiement` (AD-5) ; `choisirPrestataire`, fonction pure et seule source du choix (AD-6) ; moyens affichés sur la Commande à payer ; page admin « Prestataires » (activer, Monter / Descendre) ; carte « Paiement » du pied de page.

## Décisions

- **Aucun Prestataire ne s'active sans adaptateur branché** (`ADAPTATEURS_BRANCHES`, vide aujourd'hui) : sans cela, le site annoncerait « Paiement traité par K-Pay » sans aucun moyen de payer (règles 13 et 14). Refus côté serveur (`adaptateur_absent`) et bouton bloqué avec sa raison. Chaque story d'adaptateur (4.7, 5.4 à 5.7) ajoute son code au registre.
- Les quatre Prestataires démarrent **désactivés** ; Ordre de priorité initial des Agrégateurs : PawaPay, K-Pay, MaishaPay (ordre de CLAUDE.md, réglable dans l'admin). Les moyens de chacun sont fixes en base (règle 10).
- **Couverture pays-opérateur** : sa table et sa saisie arrivent à la 5.1 ; `lireCouverture()` renvoie une liste vide (rien n'est supposé, règle 15) : le mobile money n'est donc jamais proposé, avec « Le mobile money n'est pas encore disponible dans ton pays. ».
- **Aucun bouton de paiement** n'existe dans cette story : il arrive avec les adaptateurs (rien n'est simulé, règle 13). « Paiement traité par {Prestataire} » est déjà écrit en texte quand la carte est autorisée.
- Aucun contenu brut de notification n'est conservé (numéros de téléphone) : `notification_recue` ne garde que l'identifiant, le Prestataire, la validité de la signature et la Tentative.
- Règle de lint : un fichier de `src/modules/paiement/adaptateurs/` ne peut importer ni Supabase, ni un module du site, ni `server-only` / `next/*` (AD-5).

</frozen-after-approval>

## Réalisé

- Migration `20261128100000_couche_paiement.sql` (appliquée sur koma-dev, types régénérés) : quatre tables sans politique ni droit (service seulement), index unique partiel « une Tentative en cours par Commande », unicité `(prestataire, reference_transaction)`, quatre anomalies, fonctions `definir_prestataire_actif`, `deplacer_prestataire`, `familles_commande` (security definer, service seulement) ; trigger de journal sur `prestataire`. Logique vérifiée sur koma-dev dans une transaction annulée.
- Module `src/modules/paiement/{types,aiguillage,adaptateurs,service,queries,dependances,actions}.ts` ; `src/components/commande/MoyensPaiement.tsx` (page de la Commande `en_attente`) ; `src/components/admin/ListePrestataires.tsx` et `/admin/prestataires` ; carte « Paiement » du pied de page (cache étiqueté `prestataires`) ; textes `Paiement`, `Admin.prestataires`, `Pied.paiement`.
- Tests : Vitest `paiement-aiguillage` (21), `paiement-service`, `paiement-ui`, `paiement-adaptateurs-lint`, pied de page ; pgTAP `couche_paiement.test.sql` (39).

## Écarts / dette

- `confirmer_paiement`, les routes de notification, `reconcilier-tentatives` et la page de retour viennent avec les stories 4.6 et 5.x ; les tables sont prêtes.
- Texte E-13 du Trop-perçu : à la 4.6.
