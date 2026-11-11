---
title: 'Story 7.3 : « Me prévenir » (Alerte événement)'
type: 'feature'
created: '2026-11-11'
status: 'done'
route: 'dispatch'
---

## Intent

Un visiteur s'inscrit, pour un Événement, à un email envoyé à l'ouverture de la vente de ses Pass : par email, avec son Compte, ou par WhatsApp (liste exportée par Jonathan, aucun message WhatsApp envoyé par le site). Consentement obligatoire, versionné, désinscription immédiate.

## Décision de Jonathan (2026-11-11) qui remplace l'epic

Le texte de consentement fourni promet « un email quand la vente des Pass de cet événement ouvre » : l'inscription est donc PAR ÉVÉNEMENT et l'email part à l'ouverture de la vente de cet événement (`vente_ouvre_le`). L'annonce générique « nouvel événement publié » de l'epic et du PRD (FR-32) n'est pas faite (règle 14). Le bouton n'apparaît que tant que la vente n'est pas ouverte. Les Préférences de la 9.4 (interrupteur « Alertes Festival ») s'appliquent aux inscrits par Compte.

## Réalisé

Migrations `20270104100000_alerte_evenement.sql`, `20270104110000_*` (sources de consentement), `20270104120000_*` (correctifs de revue : l'alerte échappe à la règle des 2 jours, une adresse désinscrite n'est jamais réactivée par un tiers, un seul email par adresse et par événement, événement commencé refusé). Module `src/modules/alertes/`, routes `/api/cron/alertes-evenements` et export CSV `/api/admin/evenements/[id]/alertes-whatsapp`, formulaire `FormulairePrevenir`, section admin `SectionAlertes`, gabarit d'email, désinscription sans Compte signée (contexte distinct). pgTAP `alerte_evenement.test.sql` (53 assertions, rejouées sur koma-dev dans une transaction annulée), tests Vitest.

## Limites connues

- Aucun libre-service pour retirer un numéro WhatsApp (renvoi vers la page Contact) ; aucun écran admin pour le retirer.
- La page d'un événement est en cache de quelques minutes : le bouton peut rester visible juste après l'ouverture ; le serveur refuse alors avec un message clair.
- Les jobs pg_cron ne font rien sans les secrets Vault `site_url` et `cron_secret`, ni sans `RESEND_API_KEY` et `EMAIL_EXPEDITEUR`.
