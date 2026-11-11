---
title: 'Story 7.8 : Scan hors ligne'
type: 'feature'
created: '2026-11-11'
status: 'review'
route: 'dispatch'
---

## Intent

Un appareil connecté prend le Verrou hors ligne d'un Événement et télécharge la liste de ses Pass `valide` ; il peut alors scanner sans réseau, avec le même écran VALIDE / REFUSÉ que la story 7.6. Au retour du réseau, les scans sont appliqués, le Verrou est rendu et la liste locale est effacée. Tant que le Verrou est tenu, aucun autre appareil ne scanne. L'Admin peut libérer un Verrou de force (appareil perdu) : une anomalie le signale.

## Réalisé

- Migrations `20270109100000_anomalie_scan_hors_ligne.sql` (types d'anomalie `scans_non_synchronises` et `scan_conflit`, fichier séparé car une valeur d'énumération ne s'emploie pas dans la transaction qui l'ajoute) et `20270109110000_scan_hors_ligne.sql` : tables `verrou_hors_ligne` (index unique partiel : un Verrou actif par Événement) et `scan_hors_ligne` (mémoire d'idempotence), RLS sans aucun droit client ; fonctions `prendre_verrou`, `telecharger_liste_hors_ligne`, `synchroniser_scans`, `liberer_verrou`, `forcer_liberation_verrou`, `lire_etat_verrou`, `lire_verrou_evenement` (security definer, search_path vide, service_role seulement) ; `scanner_pass` recréée (même signature) pour refuser un autre appareil (`KS_SCAN_VERROUILLE`) et ne jamais journaliser l'identifiant d'appareil.
- Module `src/modules/scan/` : service serveur (`hors-ligne-service.ts`, dépendances injectées), actions, empreintes Web Crypto (`empreintes.ts`), stockage IndexedDB (`stockage-hors-ligne.ts`), comparaison locale (`comparaison-locale.ts`), synchronisation (`synchronisation.ts`).
- Écran : `PanneauHorsLigne`, hook `useScanHorsLigne`, `EcranScan` adapté ; service worker `public/sw-scan.js` (portée `/fr/scan`, `/en/scan`) ; en-têtes (CSP `worker-src 'self'` sur la route de Scan seulement, `Cache-Control` du fichier du service worker, aucun `Service-Worker-Allowed`).
- Admin : `SectionVerrou` sur la page de l'Événement (« Libérer le Verrou », confirmation) ; tâches `scans_non_synchronises` et `scan_conflit` lisibles.
- pgTAP `scan_hors_ligne.test.sql` (86 assertions, rejouées sur koma-dev en transaction annulée) et Vitest.

## Protection des secrets sur l'appareil (point de sécurité)

Le jeton du Code QR (192 bits) n'a aucune force brute possible : la liste porte son SHA-256, comme l'epic. Le code court (32^8, environ 1,1e12 valeurs) se casserait en quelques minutes sur un GPU avec un SHA-256 simple. Choix retenu : la liste porte un HMAC-SHA-256 du code court, avec une clé aléatoire de 256 bits propre au Verrou, remise une seule fois à l'appareil qui le tient. L'appareil l'importe en `CryptoKey` non extractible (IndexedDB) ; ses octets ne sont pas gardés. Saisie à la main hors ligne limitée à 10 essais par 10 minutes.

- Protégé : une liste copiée sans la clé (trace réseau, copie de la base, journal) ne permet aucune attaque ; la clé n'est jamais journalisée ni rendue à un autre appareil.
- Non protégé : un appareil perdu dont le stockage serait lu hors du navigateur (clé + liste ensemble) permettrait une force brute hors ligne des codes courts. Une dérivation lente (PBKDF2, scrypt) est impossible côté base sans lui faire manipuler les codes en clair (pgcrypto n'a pas de PBKDF2 ; une boucle plpgsql sur des milliers de Pass est hors de portée). Le nom des titulaires est en clair sur l'appareil (il doit s'afficher hors ligne, AD-12). Parade : libérer le Verrou de force (les Pass restent valables en ligne), et préférer le Code QR au code court.
- Alternative non retenue : ne pas comparer le code court hors ligne (le Code QR seul). Plus sûre, mais le bénévole serait bloqué si le Code QR ne se lit pas.

## Écarts avec l'epic

- Code court : HMAC-SHA-256 à clé de Verrou et non SHA-256 simple (voir ci-dessus). Jeton : SHA-256 simple, conforme.
- Table `scan_hors_ligne` en plus de `verrou_hors_ligne` : sans elle, rejouer une synchronisation ne serait pas idempotent de façon sûre (horloge de l'appareil).
- Types d'anomalie `scan_conflit` (conflit à la synchronisation) en plus de `scans_non_synchronises`.
- Retour du réseau : la synchronisation et la libération sont automatiques seulement s'il y a des scans hors ligne en attente. Sans scan en attente, une coupure brève ne rend pas le Verrou toute seule (le bouton « Synchroniser et rendre le Verrou » reste).
- « De préférence la veille » : un bénévole ne peut prendre le Verrou qu'à partir de l'ouverture de son accès (minuit de Goma du jour de l'Événement, story 7.7) ; l'Admin le peut avant.
- Le scan en ligne de l'appareil qui tient le Verrou reste permis (FR-36 : « en ligne comme hors ligne ») ; le Pass accepté est alors noté localement pour que la liste ne l'accepte plus hors ligne.
- Serveur muet : avec une liste locale, un serveur qui ne répond pas en 8 s fait juger le scan sur la liste locale. Si le serveur avait en fait traité le scan, la synchronisation signale un conflit (le premier scan est conservé).

## Limites connues

- Un bénévole dont l'accès a pris fin avec des scans non synchronisés ne peut plus ouvrir l'écran (la base accepte pourtant la synchronisation) : l'Admin libère le Verrou et l'anomalie le signale.
- Un Verrou échu non libéré ne crée pas d'anomalie tout seul (aucune tâche planifiée) ; il passe à `expire` à la prochaine prise ou lecture. Un appareil dont le navigateur a effacé ses données garde le Verrou jusqu'à la fin de la fenêtre ou la libération forcée.
- Les Pass vendus, annulés ou scannés ailleurs après le téléchargement de la liste ne sont pas connus hors ligne (REFUSÉ « inconnu »).
- Le service worker garde la dernière page de Scan servie (titres des Événements du Compte seulement) ; il n'est pas vidé à la déconnexion.
- À tester sur téléphone réel : mode avion, perte de connexion en plein scan, deux appareils, Verrou perdu, Chrome Android et Safari iOS (IndexedDB et service worker).

## Correctifs de revue (migration `20270109120000_scan_hors_ligne_correctifs_revue.sql`, pgTAP 102 assertions)

1. Scans perdus : `EcranScan` ne juge aucun scan pendant la synchronisation (message « Synchronisation en cours », rien n'est affiché VALIDE). `synchroniserEtLiberer` fait jusqu'à 4 passes, relit `compterEnAttente` avant de rendre le Verrou (sinon `echec`, rien n'est rendu), et `effacerEvenement` ne supprime jamais un scan VALIDE hors ligne non envoyé (il reste, statut `perdu`).
2. Faux conflits : un Pass déjà scanné par le même Compte depuis la prise du Verrou (seul l'appareil qui le tient pouvait scanner) est un « doublon » côté base (`scan_hors_ligne.resultat = doublon`), sans anomalie `scan_conflit`.
3. Caméra : l'attente de `lireEtatVerrouAction` est plafonnée à `DELAI_SERVEUR_MS` ; ensuite la caméra et le mode local démarrent.
4. Accès bénévole retiré ou raccourci : `retirer_acces_benevole` et le déclencheur de fenêtre passent le Verrou actif du Compte à `force` (anomalie `scans_non_synchronises` si la liste avait été téléchargée) ou raccourcissent `expire_le`.
5. Verrou forcé : choix retenu, accepter la synchronisation en mode « conflits seulement » plutôt qu'exporter à la main. Un scan est appliqué seulement si le Pass est valide, payé, non scanné et daté d'avant la libération (`apres_liberation` sinon) ; jamais d'écrasement. C'est plus sûr que l'effacement manuel : aucun scan réel n'est perdu et la base garde la maîtrise. L'appareil qui synchronise apprend la libération (`liberer_verrou` répond `force`) puis efface sa liste. Valable aussi après un retrait d'accès.
6. « Scan réservé » : bouton « Réessayer » et sondage toutes les 20 s tant que l'écran est visible et en ligne.
- Mineurs : listes effacées quand un autre Compte ouvre l'écran sur le même appareil (les scans en attente sont gardés) avec purge de la copie de la page dans le cache du service worker (pas de purge à la déconnexion elle-même : elle n'ouvre pas l'écran) ; `scan_horodatage` stable ; `/logo/` en copie rafraîchie en arrière-plan ; version du service worker = identifiant du déploiement (`?v=`), anciens caches purgés à l'activation ; le service worker n'intercepte que les adresses exactes `/fr/scan` et `/en/scan` ; limite de débit (`consommer_essai`) : 20 prises de Verrou et 100 lots de synchronisation par Compte et par 10 minutes ; réponses de la base bornées en taille.
