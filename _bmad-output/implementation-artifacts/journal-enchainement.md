# Journal du mode enchaîné

## Story 1.7 : accès admin, rôles, journal et réglage WhatsApp
- Commit : voir `git log` (message « Story 1.7 »). Migration `20261022180000` appliquée sur koma-dev, types régénérés.
- À tester à la main : `npm run admin:attribuer -- <ton email>`, puis `/fr/admin/reglages` : enregistrer un numéro WhatsApp et un nom de site, vérifier la ligne dans `journal_audit` (numéro masqué).
- À tester aussi : avec un autre Compte sans rôle, `/fr/admin` doit afficher la 404 (vérifier le statut avec `curl -I`) ; visiteur : redirection vers la connexion ; clavier et 320 px sur la coquille admin.
