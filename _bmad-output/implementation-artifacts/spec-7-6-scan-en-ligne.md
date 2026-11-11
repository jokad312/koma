---
title: 'Story 7.6 : Scan en ligne à l''entrée'
type: 'feature'
created: '2026-11-11'
status: 'done'
route: 'dispatch'
---

## Intent

L'Admin scanne le Code QR (ou saisit le code court) d'un Pass à l'entrée d'un Événement : `/fr|en/scan` affiche en grand VALIDE (nom, Événement, Type de pass) ou REFUSÉ et la raison. Deux scans simultanés du même Pass n'en valident qu'un.

## Réalisé

Migration `20270107100000_scanner_pass.sql` (`scanner_pass`, verrou `for update`, point d'extension `scan_exiger_acces` à remplacer par la 7.7), module `src/modules/scan/`, écran `src/components/scan/`, droit `pass.scanner` (Admin seul), lecteur QR : API native `BarcodeDetector` sinon `barcode-detector` 3.2.3 (MIT, `zxing-wasm` 3.1.6 figé, wasm servi par le site, notes dans `docs/licences/`), caméra ouverte seulement sur la route de Scan (Permissions-Policy `camera=(self)`, `wasm-unsafe-eval` pour cette page), lien « Scan » dans l'admin. pgTAP `scan_pass.test.sql` (44 assertions, rejouées sur koma-dev en transaction annulée). Revue indépendante : corrections (en-têtes des sous-chemins, dialogue modal et focus, pistes caméra, casse du jeton).

## Limites connues

- Pas d'Accès bénévole (7.7) ni de scan hors ligne (7.8) ; pas de borne de date côté base (la liste des événements est bornée par la date).
- Le lecteur de secours charge environ 0,9 Mo sur un navigateur sans API native. Cadence de lecture (200 ms) et temps mort (1,2 s) à régler après l'essai terrain.
- À tester sur téléphone réel : Chrome Android, Safari iOS, un navigateur sans `BarcodeDetector`, lumière faible, deux scans rapides, caméra refusée puis autorisée, HTTPS en production.
