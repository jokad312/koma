# Journal du mode enchaîné

## Story 1.7 : accès admin, rôles, journal et réglage WhatsApp
- Commit : voir `git log` (message « Story 1.7 »). Migration `20261022180000` appliquée sur koma-dev, types régénérés.
- À tester à la main : `npm run admin:attribuer -- <ton email>`, puis `/fr/admin/reglages` : enregistrer un numéro WhatsApp et un nom de site, vérifier la ligne dans `journal_audit` (numéro masqué).
- À tester aussi : avec un autre Compte sans rôle, `/fr/admin` doit afficher la 404 (vérifier le statut avec `curl -I`) ; visiteur : redirection vers la connexion ; clavier et 320 px sur la coquille admin.

## Story 1.8 : pages À propos, FAQ et Contact
- Commit : voir `git log` (message « Story 1.8 »). Migration `20261022200000` appliquée sur koma-dev.
- À tester à la main : envoyer un message sur `/fr/contact`, le voir dans `/fr/admin/messages` avec le compteur, le marquer traité ; régler le numéro WhatsApp dans les réglages et voir le bouton sur À propos, Contact et le pied de page.
- À fournir : textes À propos, FAQ (paiement, livraison, délais) : ils restent « [Texte à fournir] ». Sur Hostinger, poser `KOMA_VERIFIER_TEXTES=true` seulement quand les textes sont prêts ; vérifier aussi l'en-tête IP du proxy (limite d'envois).

## Correctif 1.8 : limites de contact
- Commit : `31c220f`. 30 messages par heure et par IP, 3 par heure et par email (constantes `LIMITE_CONTACT_PAR_IP_PAR_HEURE` et `LIMITE_CONTACT_PAR_EMAIL_PAR_HEURE`, `src/modules/contact/service.ts`).
- À tester à la main : envoyer 4 messages avec le même email depuis `/fr/contact` : le 4e affiche « Trop de messages envoyés, réessaie dans un moment. ».

## Story 1.9 : pages légales
- Commit : voir `git log` (message « Story 1.9 »). Aucune migration.
- À tester à la main : ouvrir `/fr/mentions-legales`, `/cgv`, `/livraison-et-retours`, `/confidentialite` (et `/en`) ; carte « Infos légales » du pied de page ; lien de confidentialité sous le formulaire de contact (nouvel onglet).
- À fournir : les quatre textes légaux et leurs dates de version (clés `Legal.<page>.texte` et `.version` dans `messages/fr.json` et `en.json`). Tant qu'ils manquent, le build de production échoue si `KOMA_VERIFIER_TEXTES=true`.
