# Proposition de changement de sprint : Candidature Stand et événements configurables (Q-C1)

Date : 2026-11-10. Demandeur : Jonathan. Auteur : Claude Code (correct-course BMad). Statut : **à valider par Jonathan** (aucun autre document n'est modifié avant sa validation).

## 1. Résumé du problème

- **Déclencheur** : Q-C1 (21 octobre 2026), à traiter avant l'epic 7. Un Pass Stand s'achète aujourd'hui comme les autres Pass (FR-33, AD-7). Jonathan veut que le Stand passe par une candidature validée à la main.
- **Principe général ajouté le 2026-11-10** : rien n'est écrit en dur. Depuis l'admin, Jonathan crée autant d'événements qu'il veut, chacun avec ses textes FR/EN, ses dates, son lieu, ses photos, sa capacité, ses Types de pass (nom, prix, quota, ce qu'ils incluent) et son nombre de Stands avec leur prix. Le site public affiche les événements publiés ; la vente s'ouvre et se ferme selon les dates et les quotas.
- **Premier événement** : 2027, Goma, en plein air.
- **Deux écarts avec les documents actuels** :
  1. FR-33 dit « pas de quota par Type de pass, seulement la Capacité facultative ». Jonathan veut un quota par Type.
  2. Story 7.1 fige trois Types (Standard, VIP, Stand). Jonathan veut des Types libres.

## 2. Décisions déjà prises par Jonathan (non rediscutées)

- Un exposant candidate pour un Stand d'un événement : description de ce qu'il vend, 3 photos, lien Instagram, case d'engagement « mes propres créations, aucune contrefaçon ».
- Jonathan valide ou refuse depuis l'admin.
- Validé : lien de paiement valable 48 h. Sans paiement dans ce délai, la place est libérée.
- Un Stand payé donne 2 Pass nominatifs (titulaire et aide), comme FR-33 et AD-7.
- Prix et nombre de Stands se règlent par événement dans l'admin.
- Pas de transfert de Pass au lancement (FR-34 inchangé).

## 3. Analyse d'impact

| Document | Impact |
|---|---|
| PRD | FR-33 : quota par Type de pass autorisé (facultatif) ; Stand vendu seulement sur candidature validée. FR-52 (admin des événements) : Types libres, quota, dates de vente. Nouvelle exigence « Candidature Stand » (FR-33b). Glossaire : « Candidature Stand ». |
| Architecture | AD-7 complétée : `type_pass.est_stand` (2 Pass par unité), un Stand ne s'achète que par `candidature_stand` validée. Nouveau module de données `candidature_stand` (dans `evenements`). Modèles d'email ajoutés à l'énumération fermée (AD-9). Photos de candidature en bucket privé. |
| UX | Formulaire de candidature, page de paiement d'un Stand validé, écran admin de traitement : états à ajouter dans EXPERIENCE.md au moment de la story 7.11 (pas avant). |
| Epics | 7.1 modifiée, 7.2 et 7.4 ajustées, **7.11 nouvelle**. 8.5 et 9.5 inchangées. |
| Code | Aucun : l'epic 7 n'est pas commencé. Aucun retour en arrière. |

## 4. Approche recommandée : ajustement direct (portée moyenne)

Les décisions de Jonathan sont intégrées à l'epic 7 avant son démarrage. Aucune story terminée n'est touchée. Risque faible : le Stand réutilise la Commande de type `pass`, la couche de paiement et la boîte d'envoi déjà construites.

## 5. Détail des changements proposés

### 5.1 PRD : FR-33 (texte actuel → nouveau)

- Ancien : « Il n'y a pas de quota par Type de pass, seulement la Capacité facultative de l'Événement, vérifiée côté serveur au paiement. »
- Nouveau : « Chaque Type de pass peut avoir un quota facultatif ; l'Événement peut avoir une Capacité facultative. Les deux sont vérifiés côté serveur au paiement. Un Stand compte pour deux personnes dans la Capacité. Les Pass Stand ne s'achètent que sur Candidature Stand validée. »

### 5.2 PRD : nouvelle exigence FR-33b « Candidature Stand »

Voir les décisions D1 à D12 ci-dessous.

### 5.3 Architecture : AD-7 (ajout)

`type_pass.est_stand` (booléen) : un Type de ce genre vaut 2 Pass par unité et ne peut être commandé que par une Candidature validée et non expirée. `creer_commande` refuse sinon (`KS_STAND_SUR_CANDIDATURE`). Le nouvel AD de la candidature décrit la table et ses statuts.

### 5.4 Epics

- **7.1** : Types de pass libres (nom FR/EN, prix USD, quota facultatif, « ce qui est inclus » FR/EN, case « Stand »). Dates d'ouverture et de fermeture de la vente (facultatives). Le nombre de Stands = le quota du Type marqué « Stand ». Publication refusée si un manque (déjà prévu).
- **7.2** : sur la page d'un événement, un Type « Stand » affiche « Candidater » à la place de « Acheter ».
- **7.4** : le sélecteur de Pass exclut les Stands ; le quota de chaque Type s'ajoute à la Capacité (`KS_COMPLET` par Type) ; la vente respecte les dates d'ouverture et de fermeture.
- **7.11 (nouvelle) : Candidature Stand.** Dépend de 7.1, 7.4, 7.5 et de la boîte d'envoi (4.4). Critères d'acceptation, à écrire dans la spec de la story, couvrent : formulaire, photos privées, validation et refus dans l'admin, emails, lien de paiement de 48 h, libération de la place, 2 Pass nominatifs, tests de non-contournement.

## 6. Décisions proposées (les plus simples, tout réglable dans l'admin) : à valider

- **D1** Il faut un Compte (connexion par code email) pour candidater. L'email du Compte reçoit toutes les décisions.
- **D2** Une candidature active par Compte et par événement. Après un refus ou une expiration, on peut candidater de nouveau.
- **D3** Formulaire : description de ce qu'il vend (20 à 1 000 caractères), lien ou @pseudo Instagram (obligatoire, forme vérifiée), 3 photos exactement (JPEG, PNG ou WebP, mêmes limites de taille que les photos de produit), case « mes propres créations, aucune contrefaçon » obligatoire, jamais pré-cochée, enregistrée avec sa version.
- **D4** Les photos sont privées : seul Jonathan les voit, dans l'admin. Aucune n'apparaît sur le site public.
- **D5** Conservation des photos : supprimées 90 jours après la fin de l'événement, ou 90 jours après un refus ou une expiration. **Cette durée est une valeur proposée par moi** : à confirmer ou à remplacer.
- **D6** Une candidature en attente ne réserve aucune place. La place est réservée à la validation (et jusqu'à l'expiration de 48 h ou jusqu'au paiement). Valider au-delà du nombre de Stands est refusé (« Complet »).
- **D7** Admin : liste « Candidatures à traiter » dans les Tâches, détail avec description, photos, Instagram. Boutons « Valider » et « Refuser » (motif facultatif, envoyé au candidat). Un refus est définitif pour cette candidature ; une candidature expirée peut être « Revalidée » (nouveau délai de 48 h) si une place reste.
- **D8** Délai de paiement : 48 h, enregistré comme réglage (valeur initiale 48), journalisé.
- **D9** Emails via la boîte d'envoi : « candidature reçue », « candidature validée » (avec le lien et l'heure limite), « candidature refusée ». Pas d'email d'expiration (la page indique l'état).
- **D10** Le lien de paiement mène à une page protégée par le Compte du candidat : il ne contient aucun secret et ne marche que connecté avec ce Compte. Le candidat y saisit le nom de son aide, accepte la mention photos et vidéos, puis paie comme pour un autre Pass (mobile money ou MaishaPay, jamais Polar). Le Code promo s'applique comme pour les autres Pass.
- **D11** La Commande de Stand reprend l'échéance de la candidature. À l'expiration, la place est libérée automatiquement (calcul à la lecture, aucune tâche supplémentaire). Un paiement tardif suit la règle existante du Trop-perçu, remboursé à la main.
- **D12** Types de pass libres, ventes ouvertes selon les dates de l'événement : sans date d'ouverture, la vente s'ouvre à la publication ; sans date de fermeture, elle se ferme au début de l'événement. Le quota et la Capacité sont facultatifs et se cumulent.
- **D13** Texte de la case d'engagement : le texte FR/EN vient de vous ; en attendant, `[Texte à fournir]` (règle 15). Texte de confidentialité sur les photos d'exposants : idem, à fournir.

## 7. Remise de la proposition

- Portée : **moyenne** (réorganisation de l'epic 7, PRD et architecture). Aucun code à défaire.
- Après validation : Claude met à jour `prd.md`, `ARCHITECTURE-SPINE.md` et `epics.md`, puis ajoute 7.11 à `sprint-status.yaml` (backlog).
- Réussite : l'epic 7 démarre avec des Types libres et des quotas ; la 7.11 est écrite et ordonnée après 7.4 et 7.5.
