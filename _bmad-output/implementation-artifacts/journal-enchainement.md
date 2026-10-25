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

## Story 2.1 : univers et création d'un produit physique
- Commit : voir `git log` (message « Story 2.1 »). Migrations `20261023100000` et `20261023120000` appliquées sur koma-dev.
- À tester à la main : `/fr/admin/univers` (créer un univers FR/EN), `/fr/admin/produits/nouveau` (cosplay avec tailles, stock, délai ; prix en USD), liste `/fr/admin/produits` (cartes sur mobile 375 px, tableau sur ordinateur), barre d'onglets mobile de l'admin à quatre entrées (libellés sur deux lignes ?), nouveau Compte : la question « Quel univers préfères-tu ? » apparaît une seule fois, seulement s'il existe un univers.
- Points reportés : renommer ou masquer un univers avant la mise en ligne ; stock exact lisible par anon (à décider en 2.3).

## Story 2.2 : photos et publication d'un produit
- Commit : voir `git log` (message « Story 2.2 »). Migration `20261024100000` appliquée sur koma-dev, types régénérés. Deux buckets créés : `galerie-attente` (privé) et `produits-public` (public).
- Écart à la spec : avec le jeton signé, le point d'accès TUS qui marche est `/storage/v1/upload/resumable/sign` (essai réel sur koma-dev, l'autre répond 403). L'envoi TUS a été prouvé par un script Node (photo générée avec GPS ressortie sans métadonnées, objets de test effacés) ; le chemin dans le navigateur n'a pas été exécuté en vrai navigateur.
- À tester à la main : fiche d'édition d'un produit (`/fr/admin/produits/<id>`) : ajouter 2 photos avec textes alternatifs FR/EN (une photo prise au téléphone avec position), vérifier l'ordre avec Monter / Descendre au clavier, « Annuler l'envoi » en cours d'envoi, couper le réseau pendant un envoi (reprise), tenter « Publier » incomplet (liste des manques), compléter puis publier, dépublier ; liste des produits : pastille « Publié ».
- Points reportés (deferred-work.md) : suppression d'une photo et modification de son texte alternatif (aucun moyen de retirer une photo fautive pour l'instant), purge Cron de `galerie-attente`, fichiers publics encore lisibles par lien direct après dépublication.
