---
title: 'Story 4.4 : boîte d''envoi et premiers emails'
type: 'feature'
created: '2026-11-02'
status: 'done'
route: 'dispatch'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

En tant que client, je veux recevoir un vrai email quand ma commande est payée ou mon Kit ouvert, afin d'avoir une trace et de retrouver mon achat (epics.md, story 4.4 ; AD-1, AD-9, AD-10, AD-21).

Décisions prises à l'implémentation (Jonathan : mode enchaîné du 2026-11-02, « continue la voie 1 ») :
- Gabarits en fonctions TypeScript pures (pas de React Email) : HTML en chaîne échappée, polices système, bouton rouge #E3261C à texte blanc, lien aussi écrit en texte, aucun logo (aucun fichier de logo validé pour les emails). Textes dans `messages/*.json` (espace `Emails`).
- Expéditeur : variable `EMAIL_EXPEDITEUR` (déjà dans `.env.example`) ; sans elle ou sans `RESEND_API_KEY`, la route répond 503 avant de réserver un envoi (règles 13 et 15).
- Déclenchement : `pg_cron` appelle chaque minute `envois_declencher()`, qui appelle la route par `pg_net` avec le secret Vault `cron_secret` sur l'adresse du secret Vault `site_url`. Tant que ces deux secrets n'existent pas (aucun domaine : Q-D1), la fonction ne fait rien.
- Aucun déclencheur ne planifie `commande_payee` : le paiement arrive aux stories 5.x ; le gabarit, la route et les tests existent déjà. Seul `offrir_commande` planifie `kit_ouvert`.

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261121100000_boite_d_envoi.sql` : types `envoi_modele`, `envoi_statut`, `anomalie_type` ; tables `envoi` (identifiants seulement, clé d'idempotence unique) et `anomalie` ; vue `taches_admin` ; fonctions `envois_planifier` (interne), `envois_reserver_lot` (SKIP LOCKED, bail 10 min), `envois_marquer_envoye`, `envois_marquer_echec` (5 essais puis `abandonne` + anomalie), `envois_ignorer`, `envois_declencher` ; planification `envoyer-emails` ; `offrir_commande` réécrite depuis `20261112100000`.
- `src/modules/envois/` : `types.ts`, `service.ts` (`traiterLot`), `dependances.ts` (Supabase service + Resend, clé d'idempotence = identifiant de l'envoi), `modeles/{commun,commande-payee,kit-ouvert}.ts`.
- `src/app/api/cron/envois/route.ts` (POST, secret via `src/lib/auth/secret-cron.ts`, partagé avec la purge de galerie).
- Admin : `/admin/taches` (`ListeTaches`, `lireTachesAdmin`), entrée de navigation « Tâches », droit `admin.acceder`.
- Tests : `supabase/tests/envois.test.sql` (41), `tests/unit/envois-{service,modeles,route}.test.ts`, double `tests/doubles/TEST_dependances-envois.ts`.
- Licence du SDK : `docs/licences/resend.md`.

## Tasks & Acceptance

- [x] Table `envoi`, `anomalie` (type `envoi_echec_definitif`), `modele` fermé à `commande_payee` et `kit_ouvert`, `donnees` limitées à des identifiants, `langue` figée depuis `profil.langue`.
- [x] Route `/api/cron/envois` : lot borné, relecture en base au rendu, `envoye` seulement avec l'identifiant de Resend, réessais bornés puis `abandonne` + anomalie visible dans les tâches admin, refus sans le bon secret, second appel sans renvoi.
- [x] Gabarits `commande_payee` et `kit_ouvert` : langue du client, sans argot ni emoji, nom lu dans `nom_site`, montants en USD, liens en texte.
- [x] `offrir_commande` planifie `kit_ouvert` ; tests de la 3.5 inchangés.
- [ ] À faire par Jonathan : compte Resend, `RESEND_API_KEY` et `EMAIL_EXPEDITEUR` dans `.env.local`, secrets Vault `site_url` et `cron_secret` après le choix du domaine ; essai réel (voir le journal).

## Spec Change Log

- 2026-11-02 : création en même temps que l'implémentation (mode enchaîné).
