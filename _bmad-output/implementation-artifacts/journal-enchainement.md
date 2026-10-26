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

## Story 2.3 : réglages de remise et Plafond de fabrication
- Commit : voir `git log` (message « Story 2.3 »). Migration `20261025100000` appliquée sur koma-dev, types régénérés.
- À tester à la main : `/fr/admin/reglages` : saisir les forfaits de Goma et Bukavu (USD), le retrait à Goma (FR et EN), le Plafond de fabrication, deux ou trois tranches de prix (Monter / Descendre, Retirer, focus au clavier), recharger, vérifier « Valeur à fixer » pour une valeur effacée et les lignes de `journal_audit`.
- À fournir : les montants réels des forfaits, le lieu et les modalités de retrait, le Plafond, les tranches de prix (aucune valeur par défaut n'existe).
- Reporté : `stock_disponible` renvoie le stock exact (lisible par n'importe qui via l'API) ; décision à prendre avant la mise en ligne si l'on veut exposer seulement « en stock » (voir deferred-work.md).

## Story 2.4 : catalogues Cosplays et Accessoires
- Commit : voir `git log` (message « Story 2.4 »). Migration `20261026100000` appliquée sur koma-dev, types régénérés.
- Adresses : `/fr/cosplays`, `/en/cosplays`, `/fr/accessoires`, `/en/accessories` ; l'adresse de l'autre langue redirige en 308 (règles dans `next.config.ts`, table `src/i18n/adresses.ts`).
- À tester à la main (il faut au moins un produit publié, donc la 2.2 et vos photos) : publier 2 ou 3 produits complets, ouvrir les catalogues, filtrer (univers, prix si des tranches sont réglées, disponibilité), trier, « Voir plus » avec plus de 12 produits (adresse mise à jour, focus, rechargement = même liste cumulée), changer de langue avec une requête, 375 px, clavier ; les liens des cartes mènent à une 404 jusqu'à la story 2.5.
- Choix à connaître : l'état « ni en stock ni fabricable » s'affiche « Indisponible pour le moment » (jamais « Épuisé ») ; borne basse d'une tranche incluse, haute exclue ; au-delà de 240 produits affichés d'un coup, plus de « Voir plus » cumulé.
- Reporté (deferred-work.md) : index de `lister_catalogue` à mesurer quand le catalogue grandira ; le filtre d'univers liste tous les univers.

## Story 2.5 : fiche d'un produit physique
- Commit : voir `git log` (message « Story 2.5 »). Migration `20261027100000` appliquée sur koma-dev, types régénérés.
- Adresses : `/fr/cosplays/<adresse>`, `/fr/accessoires/<adresse>`, `/en/cosplays/<adresse>`, `/en/accessories/<adresse>`.
- À tester à la main (il faut un produit publié complet, donc vos photos) : galerie (balayage, boutons, vignettes au clavier, « Agrandir » avec + et −), choix d'une taille (état et délai changent sur place), bandeau « Remise uniquement à Goma et Bukavu », modes de remise (réglez d'abord les forfaits et le retrait dans `/admin/reglages`), Partager (partage natif sur mobile, « Lien copié » sur ordinateur), 375 px ; dépublier le produit : la page doit afficher la 404.
- Limite connue : en production, l'adresse d'une fiche inconnue ou dépubliée affiche la page 404 mais répond encore avec le statut HTTP 200 (+ noindex) ; piste notée dans deferred-work.md.
- Pas encore de bouton d'ajout au panier (epic 4), ni de Kit lié (epic 3), ni de schéma des mesures (epic 6).

## Fin de l'epic 2 (stories 2.1 à 2.5 livrées ; 2.6 héros vidéo et 2.7 blocs d'accueil restantes)

## Story 2.7 : blocs de la page d'accueil
- Commit : voir `git log` (message « Story 2.7 »). Aucune migration.
- Ce qui est affiché : le H1 actuel, deux tuiles de catégorie (texte seul, aucune photo), « Fait main à Goma » (4 derniers cosplays publiés, masqué s'il n'y en a pas), « Jonathan en trois phrases » et la FAQ courte (paiement, livraison, délais) ; les places du héros et des blocs Kits, Galerie, Rendez-vous, Guides sont réservées sans rien afficher.
- À fournir : les trois phrases du bloc « Jonathan » (`Accueil.jonathan.*` dans `messages/fr.json` et `en.json`) et les réponses de la FAQ ; tant que le marqueur « [Texte à fournir] » reste, le build de production échoue si `KOMA_VERIFIER_TEXTES=true`.
- À tester à la main : `/fr` et `/en` (ordre des blocs, 320 px, zoom 200 %, mouvement réduit) ; publier un cosplay complet puis recharger l'accueil pour voir le bloc « Fait main à Goma ».
- Mesure Lighthouse mobile (sans cosplay publié) : accessibilité 100, SEO 100, performance 89 à 90 (seuil visé 90) ; à remesurer avec le héros et des produits publiés.
- Correctif trouvé en chemin : la lecture du bloc 2 était annulée pendant le prérendu de Next.js et aurait masqué le bloc en permanence ; elle attend maintenant la requête (`connection()`).

## Epic 2 : état
- Livrées : 2.1, 2.2, 2.3, 2.4, 2.5, 2.7. **2.6 (héros vidéo) reste en backlog** : elle exige la bibliothèque Bunny Stream publique et ses clés (`BUNNY_PUBLIC_*`, réglage manuel chez Bunny) ; l'epic 2 n'est donc pas terminé.

## Correctif 2.2 : suppression d'une photo, texte alternatif modifiable, purge de galerie-attente
- Migration `20261028100000_supprimer_et_corriger_photo.sql` (`supprimer_photo_produit`, `modifier_alt_photo`, déclencheur différé `produit_photo_publie_complet`), à appliquer avec `npm run db:push` après la revue, puis `npm run types`. Test SQL : `supabase/tests/photo_suppression_alt.test.sql` (36 vérifications, exécutées dans une transaction annulée sur koma-dev, tout passe ; la CI les rejoue).
- Fiche d'édition d'un produit : bouton « Supprimer la photo N » (confirmation Annuler / Supprimer), formulaire « Modifier le texte alternatif de la photo N ». La dernière photo d'un produit publié ne se supprime pas : dépublier d'abord.
- La suppression du fichier public suit la base ; si elle échoue, l'erreur est journalisée et la photo reste supprimée (un fichier orphelin est possible, jamais une photo cassée).
- Route de purge `POST /api/cron/purger-galerie-attente` (en-tête `Authorization: Bearer <CRON_SECRET>`, 401 sinon ; POST seulement car l'action est destructrice) : efface les originaux de `galerie-attente` de plus de 24 h (dernière modification, sinon création) et répond `{ ok, effaces, echecs }` ; un échec partiel répond `ok: false` avec le statut 500. **Pas planifiée** (aucun domaine, Q-D1). À faire quand le domaine existera : définir `CRON_SECRET` dans les variables d'environnement de l'application Hostinger (valeur longue et aléatoire, jamais dans le dépôt), puis planifier l'appel en POST, soit par un Cron Hostinger (`curl -X POST -H @fichier-entetes https://<domaine>/api/cron/purger-galerie-attente`, une fois par jour, où `fichier-entetes` est un fichier hors dépôt, lisible par vous seul, contenant la ligne `Authorization: Bearer <secret>`, pour ne pas écrire le secret dans la ligne de commande), soit par Supabase pg_cron + pg_net avec le secret dans Vault (comme les autres tâches `/api/cron/*`, AD-10).
