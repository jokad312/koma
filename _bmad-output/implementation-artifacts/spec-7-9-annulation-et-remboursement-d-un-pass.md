---
title: 'Story 7.9 : Annulation et remboursement d''un Pass'
type: 'feature'
created: '2026-11-11'
status: 'done'
route: 'dispatch'
---

## Intent

Une cliente annule un de ses Pass jusqu'à 48 heures avant l'Événement : elle demande l'annulation depuis « Mes Pass », Jonathan l'accepte ou la refuse, puis rend l'argent à la main et le confirme avec une preuve (FR-38, AD-8, AD-23, AD-31). Aucun remboursement automatique chez un Prestataire (Q-4).

## Réalisé

- Migrations `20270110100000_modeles_email_pass_annule.sql` (valeurs `pass_annule` et `pass_rembourse`, fichier séparé), `20270110110000_annulation_pass.sql` et `20270110120000_annulation_pass_unite.sql` (correctif de l'unité d'annulation, trouvé par le test pgTAP : une ligne de plusieurs Pass non-Stand mettait tous ses Pass dans la même unité ; la migration précédente, déjà appliquée, n'est pas modifiée).
- Frais figés (AD-8) : colonne `commande.frais_annulation_pass`, posée à l'insertion d'une Commande de Pass par un déclencheur (`creer_commande_pass` n'est pas modifiée). Une Commande passée sans réglage garde NULL : le réglage du jour s'applique alors ; sans réglage, la demande est refusée (`KS_REGLAGE_MANQUANT`, règle 15).
- `demande_client.pass_id` (obligatoire pour `annulation_pass`, interdit sinon), une demande ouverte ou acceptée par unité.
- Fonctions : `demander_annulation_pass` (Compte de la session ; Pass valide, Commande payée et non offerte, Événement daté à plus de 48 h calculé avec `now()`, aucune demande en cours sur l'unité), `pass_annulables` (affichage du bouton), `annuler_pass` (Admin ; Pass `annule` donc refusé au Scan, montant figé = (prix × nombre − réduction) de la ligne ÷ nombre de Pass × (1 − frais) arrondi au centime inférieur, email `pass_annule` planifié une fois), `traiter_demande` et `confirmer_remboursement` étendues (cible `pass`, preuve obligatoire, email `pass_rembourse`).
- Stand : l'unité est la paire de titulaires (rangs 1-2, 3-4…) ; un seul remboursement, rattaché au Pass de la demande ; la paire passe `annule` puis `rembourse` ensemble.
- Les places se libèrent d'elles-mêmes : les compteurs ne comptent pas les Pass `annule` ni `rembourse`.
- Client : bouton « Demander l'annulation » sur la carte Pass (`DemanderAnnulationPass`), confirmation avec rappel des frais et mention du Stand, état « demande en cours », message si refusée ; action serveur `demanderAnnulationPassAction` (Compte lu dans la session).
- Admin : bloc « Annulations de Pass » dans le détail de la Commande (accepter, refuser, formulaire de preuve) ; tâches « Demande d'annulation d'un Pass » et « Remboursement de Pass à confirmer » dans « Argent à traiter ».
- Emails `pass_annule` et `pass_rembourse` (FR/EN, `Emails.*`) : relus en base au moment du rendu, jamais envoyés si le Pass n'est pas dans l'état annoncé ou si le remboursement n'est pas en USD ; aucun jeton ni code court.
- Tests : pgTAP `annulation_pass.test.sql` (55 assertions, rejouées sur koma-dev en transaction annulée), Vitest `annulation-pass.test.ts` et `annulation-pass-ui.test.tsx`.

## Décisions

- Les frais figés avec la Commande (AD-8) n'étaient pas encore posés par la 7.4 : déclencheur d'insertion plutôt que réécriture de `creer_commande_pass`.
- Un Pass offert (Commande `offerte`) ne s'annule pas par cette voie : rien n'a été payé, donc rien à rembourser.
- Frais à 100 % : montant nul, l'acceptation est refusée (`KS_REMBOURSEMENT_NUL`), comme à la 6.6.
- L'acceptation reste possible après le délai de 48 h si la demande a été faite à temps (FR-38 : le délai vise la demande du client) ; elle échoue si le Pass a été scanné entre-temps.

## Revue (sous-agent)

Aucun défaut bloquant. Corrigé : deux demandes simultanées sur les deux cartes d'un Stand (migration `20270110130000_annulation_pass_verrou_unite.sql` : verrou de toute l'unité, ordre des identifiants). Reste : `annuler_pass` et `synchroniser_scans` peuvent s'interbloquer si un lot hors ligne contient les deux titulaires d'un Stand en même temps que l'acceptation (risque faible ; Postgres annule une des deux transactions, la synchronisation se rejoue, l'acceptation se refait).

## Limites connues

- Un Stand dont un seul titulaire a demandé l'annulation : l'autre carte n'affiche ni bouton ni « demande en cours » (la demande couvre la paire, la base refuse une seconde demande).
- Les Pass annulés après le téléchargement de la liste hors ligne ne sont pas connus de l'appareil qui tient le Verrou (limite déjà notée à la 7.8).
- Textes écrits par Claude (FR/EN, `Pass.carte.annulation.*`, `Emails.pass_annule`, `Emails.pass_rembourse`, `Admin.commandes.annulationPass.*`, tâches) : à valider par Jonathan.

## À tester à la main

Événement de test publié à plus de 48 h, Commande de Pass payée en sandbox : `/fr/compte/pass` → « Demander l'annulation » (frais rappelés) ; admin : tâche « Demande d'annulation d'un Pass » → Accepter (le Pass devient Annulé et le QR disparaît) ; confirmer le remboursement avec une preuve ; emails reçus une seule fois ; Événement dans moins de 48 h : aucun bouton ; Stand : les deux titulaires s'annulent ensemble ; frais d'annulation vides dans les Réglages : demande refusée avec un message clair.
