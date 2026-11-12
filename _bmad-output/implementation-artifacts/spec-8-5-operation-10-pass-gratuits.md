---
title: 'Story 8.5 : opération « 10 Pass gratuits »'
type: 'feature'
created: '2026-11-12'
status: 'done'
route: 'plan'
---

## Intent

Jonathan offre un Pass Standard à l'auteur d'une Réalisation validée (Kit payé), pour un Événement à venir qui a encore de la place, dans la limite de 10 Pass offerts par Événement (FR-42, AD-33, AD-12). Mode enchaîné : plan approuvé par l'agent (aucun cas d'arrêt hors le règlement, qui suit la règle « [Texte à fournir] »).

## Décisions

1. **Fonction SQL propre** `attribuer_pass_offert(p_auteur, p_realisation, p_type, p_titulaire)` : `offrir_commande` existante ne sait offrir que des Kits gratuits (Commande `produits`) ; elle n'est pas modifiée. La nouvelle fonction crée une Commande `pass` `offerte` à 0 USD (contrainte `commande_offerte_coherente`), une ligne, puis appelle `evenements_emettre_pass` (Pass, Code QR, email `pass_emis`). « Offert » s'affiche déjà dans Mes Pass (`commande.offerte`).
2. **Table `pass_offert`** : rang 1 à 10 unique par Événement, un Pass offert par Compte et par Événement, une Réalisation donne au plus un Pass. Le rang est calculé sous le verrou de l'Événement (`for update`) : deux attributions simultanées s'attendent, une seule obtient le dixième rang.
3. **Choix de l'Admin** : Événement à venir (publié, début futur) avec de la place et moins de 10 Pass offerts, puis un Type de pass non Stand (le « Standard » : plusieurs Types possibles, l'Admin choisit). Droit `evenements.gerer` (Admin seulement), revérifié par `exiger_admin`.
4. **Titulaire** : nom du Compte, sinon pseudo de la Réalisation ; sans l'un ni l'autre, refus `nom_requis` (jamais un nom inventé).
5. **Événement complet** (capacité ou quota) : rien n'est attribué, une anomalie `pass_offert_impossible` est créée (la fonction rend `KS_COMPLET` au lieu de lever, pour que l'anomalie soit enregistrée).
6. **Page des Réalisations du client** : texte de l'opération, message « terminée » listant les Événements dont les 10 Pass sont attribués (envoi de Réalisation toujours possible), règlement `[Texte à fournir]` (clé `Communaute.realisation.operation.reglement`). `Communaute` rejoint les espaces contrôlés par `verifier-marqueurs` : le build de production échoue tant que le règlement n'est pas fourni (Q-5).
7. **Interface Admin** : sur la page Galerie, carte d'une Réalisation publiée : sélecteur « Événement · Type (n/10) » et bouton « Attribuer un Pass offert » ; si déjà attribué, le rang et l'Événement. Succès annoncé seulement après la réponse du serveur.

## Fichiers

Migrations `20270114100000` (énumération), `20270114110000` (table et fonctions), `20270114120000` (lecture par photo) ; `supabase/tests/pass_offerts.test.sql` (24 assertions) ; `src/modules/communaute/pass-offert*.ts` ; `src/components/admin/AttributionPassOffert.tsx` ; `FilePhotos.tsx`, page `admin/galerie`, page `compte/realisation` ; `messages/{fr,en}.json` ; `src/lib/vitrine/marqueur.ts` ; `tests/unit/pass-offert.test.ts`.

## À tester à la main

Événement de test publié à venir avec un Type Standard ; deux Comptes ayant payé un Kit et envoyé une Réalisation validée ; page Galerie (Admin) : attribuer un Pass offert → le Compte reçoit l'email « Pass émis » et voit « Offert » dans Mes Pass ; un second Pass pour le même Compte et le même Événement est refusé ; Événement rempli : anomalie dans les tâches ; page « Envoyer une Réalisation » : texte de l'opération et `[Texte à fournir]` pour le règlement.
