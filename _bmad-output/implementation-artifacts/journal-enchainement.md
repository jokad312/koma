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
- Livrées : 2.1, 2.2, 2.3, 2.4, 2.5, 2.7. **2.6 (héros vidéo) livrée** : commits 92f5d2c et 4fc7be6, CI verte, Bunny publiques réglées (MP4 Fallback activé, référents ouverts). L'epic 2 est donc terminé.

## Correctif 2.2 : suppression d'une photo, texte alternatif modifiable, purge de galerie-attente
- Migration `20261028100000_supprimer_et_corriger_photo.sql` (`supprimer_photo_produit`, `modifier_alt_photo`, déclencheur différé `produit_photo_publie_complet`), à appliquer avec `npm run db:push` après la revue, puis `npm run types`. Test SQL : `supabase/tests/photo_suppression_alt.test.sql` (36 vérifications, exécutées dans une transaction annulée sur koma-dev, tout passe ; la CI les rejoue).
- Fiche d'édition d'un produit : bouton « Supprimer la photo N » (confirmation Annuler / Supprimer), formulaire « Modifier le texte alternatif de la photo N ». La dernière photo d'un produit publié ne se supprime pas : dépublier d'abord.
- La suppression du fichier public suit la base ; si elle échoue, l'erreur est journalisée et la photo reste supprimée (un fichier orphelin est possible, jamais une photo cassée).
- Route de purge `POST /api/cron/purger-galerie-attente` (en-tête `Authorization: Bearer <CRON_SECRET>`, 401 sinon ; POST seulement car l'action est destructrice) : efface les originaux de `galerie-attente` de plus de 24 h (dernière modification, sinon création) et répond `{ ok, effaces, echecs }` ; un échec partiel répond `ok: false` avec le statut 500. **Pas planifiée** (aucun domaine, Q-D1). À faire quand le domaine existera : définir `CRON_SECRET` dans les variables d'environnement de l'application Hostinger (valeur longue et aléatoire, jamais dans le dépôt), puis planifier l'appel en POST, soit par un Cron Hostinger (`curl -X POST -H @fichier-entetes https://<domaine>/api/cron/purger-galerie-attente`, une fois par jour, où `fichier-entetes` est un fichier hors dépôt, lisible par vous seul, contenant la ligne `Authorization: Bearer <secret>`, pour ne pas écrire le secret dans la ligne de commande), soit par Supabase pg_cron + pg_net avec le secret dans Vault (comme les autres tâches `/api/cron/*`, AD-10).

## Correctif stock : le public ne voit jamais le stock exact
- Commit : voir `git log` (message « Correctif stock »). Migration `20261029100000` appliquée sur koma-dev, types régénérés.
- Vérifié en lecture seule sur l'API publique de koma-dev avec la clé publique : `variante?select=stock`, `select=*`, `stock=gt.5` et `rpc/stock_disponible` répondent 401 ; les colonnes autorisées (`taille`, `fabrication_sur_commande`…) et `rpc/lister_catalogue` répondent 200.
- États publics : « En stock » (disponible), « Dernières pièces » (de 1 à 3, seuil dans `seuil_dernieres_pieces()` en SQL et `SEUIL_DERNIERES_PIECES` en TypeScript), « Fabrication sur commande », « Commandes complètes pour le moment » (Plafond atteint) et « Épuisé » (aucun stock, pas de fabrication possible).
- À tester à la main : un produit à 2 pièces affiche « Dernières pièces », un produit à 10 « En stock ». L'admin continue de lire et de modifier le stock exact.

## Correctif : toute page introuvable répond en HTTP 404 en production
- Constat sur `next build` + `next start` : les adresses inconnues (`/fr/zzz`, `/zzz`, `/fr/zzz/aaa`) répondaient déjà 404 ; seules les fiches `/{cosplays|accessoires|accessories}/<adresse>` répondaient 200 (coque prérendue, statut parti avant `notFound()`).
- Solution : `src/proxy.ts` reconnaît l'adresse propre d'une fiche (`src/modules/catalogue/existence.ts`), vérifie en base (clé publique et RLS, requête légère : slug, famille, prix fixé, au moins une photo, délai de 2 s, sans cache) et, si la fiche n'existe pas, réécrit vers `/{langue}/introuvable` avec le statut 404 : la route attrape-tout rend la page traduite (`NonTrouve.*`, noindex). Base muette ou en erreur : « incertain », la fiche suit le chemin normal (jamais de 404 à tort ni de 500). Une adresse de forme impossible (hors `^[a-z0-9]+(-[a-z0-9]+)*$`) est 404 sans lecture.
- Test : `npm run test:e2e:prod` (`scripts/test-e2e-prod.mjs`) démarre `next start` sur un port libre, vérifie les statuts réels (200, 308, 404) et arrête le serveur ; il suppose `npm run build` fait ; étape ajoutée à la CI après le build. Unitaires : `tests/unit/existence-fiche.test.ts`.
- Limites : le cas « produit publié répond 200 » n'est pas couvert (aucun produit `TEST_` créé, règle de la session) ; chaque requête vers une fiche coûte une lecture de plus en base (pas de cache, pour ne jamais renvoyer 404 à un produit tout juste publié) ; `/admin/produits/<identifiant inconnu>` reste à 200 : y répondre 404 dans le proxy exigerait de vérifier le rôle admin avant le rendu (risque de fuite d'information), non fait ; `/fr/admin` répond aussi 200 en production pour un visiteur non connecté (même cause, Suspense), non modifié.

## Story 3.1 : créer un Kit et ses fichiers
- Commit : voir `git log` (message « Story 3.1 »). Migration `20261030100000` appliquée sur koma-dev, types régénérés. Bucket privé `kits-private` créé (50 Mo par fichier, constante `TAILLE_MAX_FICHIER_KIT`).
- Éprouvé en réel sur koma-dev (objets `TEST_` créés puis effacés) : adresse directe d'un objet de `kits-private` refusée (4xx) avec ou sans clé publique ; dépôt signé, taille (`info`), lecture partielle (`Range`) et déplacement fonctionnent.
- Pas essayé dans un vrai navigateur : le formulaire Kit, la liste de fichiers et l'envoi TUS réel vers `kits-private`.
- À tester à la main (`/fr/admin/produits/nouveau`, Famille « Kit ») : créer un Kit à 0 USD relié à un cosplay (un second Kit sur le même cosplay doit être refusé), envoyer un PDF, un SVG et un STL (formats et taille maximale affichés, progression, « Annuler l'envoi », coupure réseau), remplacer un fichier (version 2), en supprimer un, à 375 px. Un Kit ne peut pas encore être publié (story 3.2).
- Choix à connaître : un fichier envoyé est déplacé par le serveur vers un nouveau chemin après vérification (le jeton d'envoi ne peut plus le réécrire) ; un SVG contenant du script ou une référence externe est refusé ; la suppression d'un fichier a été ajoutée (une erreur d'envoi ne doit pas rester définitive).
- Reporté (deferred-work.md) : purge des envois jamais finalisés dans `kits-private`, téléchargements en pièce jointe forcée (3.6), garde sur les fichiers d'un Kit publié, prix 0 et paiement.

## Story 2.6 : héros vidéo de l'accueil
- Commit : voir `git log` (message « Story 2.6 »). Migration `20261031100000_heros_accueil.sql` appliquée sur koma-dev, types régénérés. Spec : `spec-2-6-heros-video-de-l-accueil.md`.
- **Solution : aucun lecteur intégré Bunny, donc ni Embed token ni domaine autorisé.** Le héros lit `https://<NEXT_PUBLIC_BUNNY_PUBLIC_CDN_HOSTNAME>/<vidéo>/play_720p.mp4` (ou la plus grande résolution en dessous) dans une balise `<video>`. L'API Bunny n'est appelée que par le serveur (clé en en-tête, jamais renvoyée) ; l'envoi TUS du navigateur utilise une signature SHA-256 limitée à une vidéo et à 6 h.
- **Réglages manuels chez Bunny (non vérifiables par API)** : dans la bibliothèque PUBLIQUE, activer **MP4 Fallback** (sans lui, `play_720p.mp4` n'existe pas : le réglage affiche « Le fichier MP4 n'est pas lisible depuis le CDN ») ; ne pas limiter les référents (« Allowed referrers ») ou y inscrire le domaine du site quand il existera, et ne pas bloquer les requêtes sans référent (le serveur envoie `NEXT_PUBLIC_SITE_URL` comme référent) ; « Block direct URL file access » éteint. Laisser « Embed view token authentication » éteint est sans effet ici.
- **Le MP4 doit être exporté sans piste audio** : le serveur lit la structure du fichier rendu par Bunny et refuse une piste audio (« Cette vidéo contient une piste audio »).
- À tester à la main : `/fr/admin/reglages`, section « Héros de l'accueil » : (1) choisir un cosplay publié comme vedette ; (2) envoyer la photo de repli avec ses textes FR/EN, la remplacer, corriger les textes seuls ; (3) envoyer un MP4 court sans son : progression, « Encodage en cours… », puis « La vidéo est prête » ; (4) `/fr` sur téléphone : photo puis vidéo en fondu, bouton Pause (clavier, `aria-pressed`), choix mémorisé après rechargement ; (5) réglage système « réduire les animations » : photo seule, pas de bouton ; (6) mesurer le héros en moins de 2,5 s sur 4G dans le navigateur intégré d'Instagram (non automatisable) ; (7) dépublier la vedette : la tuile disparaît.
- À fournir par Jonathan : le Cosplay vedette (publié), la vidéo MP4 sans piste audio, la photo de repli et ses textes alternatifs FR/EN.
- Variables d'environnement : `.env.local` est désormais corrigé (`BUNNY_PRIVE_API_KEY` présent et valide) et les 21 migrations sont appliquées sur koma-dev.

## Correctif revue 3.1 : types MIME du bucket kits-private (fait sous OpenCode)
- Migration `20261101100000_kits_allowed_mime_types.sql` (commit 53a2a5a « Correctifs revue 3.1 »), appliquée sur koma-dev (`supabase migration list` : local = distant pour les 20 migrations). Toute nouvelle migration doit être datée après `20261101100000`.
- Relue le 2026-10-31 : correcte (nouvelle migration, l'ancienne n'est pas modifiée ; pas de table ni de fonction, donc ni RLS ni AD-25 concernés). Deux écarts, reportés à la story 3.2 (nouvelle migration) : `application/octet-stream` est dans la liste alors que le client envoie toujours le type exact (`TYPE_CONTENU_EXTENSION`), ce qui affaiblit la restriction sans être dangereux (le serveur vérifie le contenu de chaque fichier) ; aucun test pgTAP ne vérifie `allowed_mime_types` (`kits_fichiers.test.sql` ne teste que `file_size_limit`).

## Story 3.2 : vidéo, chapitres, sous-titres et publication d'un Kit
- Commit : voir `git log` (message « Story 3.2 »). Migration `20261102100000_kits_video_et_publication.sql` appliquée sur koma-dev, types régénérés. Spec : `spec-3-2-video-chapitres-sous-titres-et-publication-d-un-kit.md`.
- Inclus : correctif de `kits_allowed_mime_types` (`application/octet-stream` retiré, `text/vtt` ajouté, égalité exacte testée en pgTAP).
- Vidéo complète en TUS vers la bibliothèque Bunny privée, extrait facultatif vers la publique ; enregistrée seulement quand Bunny dit « terminé », durée lue chez Bunny. L'identifiant privé de la vidéo en cours d'envoi passe par le navigateur de l'admin (exigé par TUS Bunny), jamais par la base ni le HTML. Aucun Embed token ni domaine autorisé.
- Chapitres FR/EN (50 au plus, instants distincts, Monter / Descendre), sous-titres WebVTT FR obligatoire / EN facultatif dans `kits-private` (heures facultatives, comme la norme).
- Publication d'un Kit : manques `prix`, `photo`, titres, descriptions et matériel FR/EN, `niveau`, `fichier`, `video`, `sous_titres_fr`. Un Kit publié n'apparaît encore ni dans les catalogues ni dans `sitemap.xml` (fiche Kit : 3.3).
- Revue (3 relecteurs) : 10 correctifs appliqués ; reportés dans deferred-work.md : nettoyage des vidéos Bunny orphelines, avertissement avant une vidéo plus courte que les chapitres.
- À tester à la main (`/fr/admin/produits/<Kit>`, à 375 px) : photo ; vidéo complète (progression, « Annuler l'envoi », encodage, prête) ; quitter la page pendant l'envoi (avertissement du navigateur) ; extrait public ; 3 chapitres ajoutés, modifiés, réordonnés, supprimés ; sous-titres FR puis EN (un `.vtt` invalide refusé) ; « Publier » refusé avec la liste des manques, puis accepté sans sous-titres anglais ; sur le Kit publié, retirer la vidéo ou les sous-titres FR est refusé.

## Story 3.3 : catalogue Kits et fiche Kit
- Commit : voir `git log` (message « Story 3.3 »). Migration `20261103100000_catalogue_et_fiche_kit.sql` appliquée sur koma-dev, types régénérés. Spec : `spec-3-3-catalogue-kits-et-fiche-kit.md`.
- Catalogue `/kits` (même adresse FR/EN, filtre de niveau à la place de la disponibilité), rubrique Kits dans l'en-tête et le menu, fiche `/kits/[slug]` (photos, prix, niveau, matériel, fichiers, chapitres, résumé de la Licence), JSON-LD Product + Offer, VideoObject, BreadcrumbList, plan du site et 404.
- Extrait : HLS par `hls.js` 1.7.3 (licence notée dans `docs/licences/hls-js.md`), contrôles natifs, chargement seulement au premier « lecture », sous-titres d'extrait déposés chez Bunny (bibliothèque publique).
- Décision de Jonathan (2026-10-31) : case « Extrait sans parole » ; décochée, un `.vtt` FR d'extrait est exigé pour publier. Sur un Kit déjà publié, un extrait parlé sans FR reste caché du public jusqu'au dépôt du FR (la garde ne bloque pas le remplacement). Remplacer l'extrait décoche la case.
- Revue : 16 correctifs ; reportés : cache CDN des sous-titres remplacés (à vérifier), rattrapage `extrait_le` (aucune ligne existante).
- E2E : 197 passés ; 2 échecs du test d'accès admin sous charge, verts quand le fichier tourne seul (instabilité préexistante).
- À tester à la main (375 px) : sur un Kit, envoyer un extrait parlé ; « Publier » refusé sans `.vtt` FR d'extrait ; déposer le FR (et l'EN), publier ; `/fr/kits` (filtre de niveau, « Voir plus »), fiche : extrait lu au clavier avec sous-titres FR, puis `/en` (sous-titres EN ou mention) ; vérifier dans l'onglet Réseau qu'aucun segment ne se charge avant « lecture » ; cocher « Extrait sans parole » ; remplacer l'extrait sur le Kit publié : il disparaît de la fiche jusqu'au dépôt du FR. Vérifier que les sous-titres s'affichent bien (CORS du CDN Bunny) et qu'un remplacement de `.vtt` est visible (cache CDN).

## Story 3.5 : obtenir le Kit gratuit (voie 1, Claude Code)
- Commit : voir `git log` (message « Story 3.5 »). Migrations `20261110100000_commande_offerte_et_acces_kit.sql` et `20261111100000_offrir_commande_cle_et_verrous.sql` appliquées sur koma-dev (après essai dans une transaction annulée), types régénérés. Spec : `spec-3-5-obtenir-le-kit-gratuit.md`.
- Inclus : tables `commande`, `ligne_commande`, `acces_kit` (RLS lecture seule), numéro `KS-AAAA-NNNNNN`, `offrir_commande` (rejeu par clé, Licence exigée, Kit gratuit publié seulement, deux lignes de journal), `bibliotheque_ouvrir_acces`, zone « Obtenir » de la fiche Kit (connexion puis retour, case de Licence, un geste, « Ouvrir dans ma bibliothèque »).
- Revue (1 relecteur) : 0 grave ; correctifs appliqués : clé d'idempotence liée au Kit, verrou Compte-clé, focus au succès, retour au lien de connexion si la session expire, tests SQL renforcés (49) et tests d'interface.
- À fournir par Jonathan : le texte de la case « Licence de kit » (Q-5, marqueur visible, le build de production le refuse).
- À tester à la main : publier un Kit à 0 USD (admin), puis sur `/fr/kits/<slug>` à 375 px : non connecté, « Obtenir le kit gratuit » mène à la connexion puis revient ; connecté avec âge déclaré, case à cocher puis bouton ; message avec le numéro de Commande ; recharger la fiche : « Ouvrir dans ma bibliothèque » (404 jusqu'à la 3.6). Le Kit gratuit ne se publie qu'à partir de la 5e semaine (PRD §6.2).
- CI : le garde de stock refuse toute colonne « quantite » lisible par un client ; `ligne_commande.quantite` renommée `nombre` par `20261112100000_ligne_commande_nombre.sql`.

## Story 4.1 : panier sans compte (voie 1, Claude Code)
- Commit : voir `git log` (message « Story 4.1 »). Migrations `20261113100000_panier.sql` et `20261114100000_panier_stock_et_modification.sql` appliquées sur koma-dev (essai préalable dans une transaction annulée), types régénérés. Spec : `spec-4-1-panier-sans-compte.md`.
- Inclus : cookie signé HMAC, `creer_panier`, `ajouter_au_panier`, `modifier_ligne_panier`, `retirer_ligne_panier`, `lire_panier`, `compter_panier` (service seulement), bouton d'ajout (fiches physiques et Kit payant), compteur de l'en-tête, page `/panier` (`/cart`).
- Revue (1 relecteur) : 2 graves corrigés (paramètres RPC `undefined` supprimés par PostgREST, vérifié par un appel réel ; page non relue après une action de formulaire : `refresh()`), quantité bornée par le stock, lien vers produit dépublié, annonce persistante après changement de taille.
- À tester à la main (375 px) : sur une fiche cosplay, « Ajouter au panier » bloqué sans taille ; avec une taille, « Ajouté au panier » et le compteur de l'en-tête passe à 1 ; sur mesure : le texte WhatsApp s'affiche, aucun champ de mesure ; sur un Kit payant, un seul exemplaire ; `/fr/panier` : modifier la quantité, retirer, vide ; dépublier le produit dans l'admin : « Plus disponible » et « Passer la commande » bloqué ; « Passer la commande » mène à une 404 jusqu'à la 4.3.

## Story 4.2 : fusion du panier à la connexion (voie 1, Claude Code)
- Commit : voir `git log` (message « Story 4.2 »). Migration `20261115100000_fusion_panier.sql` appliquée sur koma-dev (essai préalable annulé), types régénérés. Spec : `spec-4-2-fusion-du-panier-a-la-connexion.md`.
- Inclus : `fusionner_panier`, annonce « Kit déjà possédé », appel après connexion par code email et par Google (sans jamais bloquer la connexion), cookie repointé sur le Panier du Compte.
- À tester à la main (375 px, vrai compte) : sans être connecté, ajouter un cosplay et un Kit au panier, puis se connecter par code email : le panier est intact ; se connecter sur un autre navigateur déjà rempli : les deux paniers sont réunis (quantités additionnées, un Kit une fois) ; ouvrir le Kit gratuit puis ajouter un Kit possédé dans un navigateur anonyme et se connecter : le Kit disparaît avec l'annonce.

## Story 4.3 : étape de commande et Commande en attente (voie 1, Claude Code)
- Commit : voir `git log` (message « Story 4.3 »). Migrations `20261117100000_commande_en_attente_schema.sql` et `20261118100000_creer_commande.sql` appliquées sur koma-dev (essai préalable annulé), types régénérés, job pg_cron `expirer-commandes` créé. Spec : `spec-4-3-etape-de-commande-et-commande-en-attente.md`.
- Inclus : `creer_commande`, `recapitulatif_commande`, réservations, `delai_paiement` (30 min, réglable dans l'admin), `expirer_commandes_echues`, pages `/commande` et `/commande/[numero]`.
- À tester à la main (375 px, vrai compte) : ajouter un cosplay (taille en stock) et un Kit au panier, « Passer la commande » (déconnecté : connexion puis retour à l'étape) ; choisir Goma/retrait puis Bukavu (livraison imposée, adresse), le total change à chaque choix ; cases jamais pré-cochées ; « Confirmer » : page de la commande avec « À payer avant [heure de Goma] » ; modifier le prix du produit dans l'admin pendant l'étape : « Le total a changé » ; laisser passer le délai : statut « Expirée » et « Reprendre mon panier » (téléphone, zone, mode repris) ; réglage « Délai de paiement » dans l'admin.
- **4.3 : CI rouge après 2 essais (arrêt prévu).** Reste un seul échec : `supabase/tests/reglages_remise.test.sql:125` (test de la 2.3) appelle `places_fabrication_utilisees()` en `anon` et exige une fonction « security invoker » ; elle lit maintenant `reservation`/`commande`, que `anon` ne peut pas lire. Trois issues, à choisir : (A) fonction « invoker » + lecture accordée à `anon` sur les trois tables (RLS sans politique = zéro ligne) ; ça casse l'assertion « anon ne lit rien » de `kit_gratuit.test.sql` ; (B) une fonction interne « definer » appelée par la fonction publique « invoker » : tests de la 2.3 inchangés, mais n'importe quel visiteur peut lire le nombre de pièces sur commande ; (C, recommandée) retirer l'exécution de `places_fabrication_utilisees` à `anon`/`authenticated` (seules des fonctions « definer » l'appellent) et adapter les trois tests qui supposaient son ouverture (`reglages_remise.test.sql`, `garde_ecritures.test.sql`, `commande_en_attente.test.sql`). Le reste de la 4.3 est vert (Vitest 1536, build, tests SQL de la story).
- **4.3 : issue C appliquée (décision de Jonathan, 2026-11-02), CI verte, statut done.** Migration `20261120100000_places_fabrication_interne.sql` (exécution retirée à anon/authenticated, réservée à service_role), appliquée sur koma-dev. Les pages publiques gardent « Commandes complètes pour le moment » par `capacite_fabrication_atteinte()` (booléen seul). Tests pgTAP : anon obtient l'état (non atteint, puis atteint), l'appel au nombre est refusé (42501), le type renvoyé est `boolean`, le Plafond reste illisible. Critère de la 2.3 modifié avec l'accord de Jonathan.

## Story 4.4 : boîte d'envoi et premiers emails (voie 1, Claude Code)
- Commits : voir `git log` (messages « Story 4.4 »), CI verte. Migrations `20261121100000_boite_d_envoi.sql`, `20261122100000_boite_d_envoi_correctifs.sql`, `20261123100000_donnees_envoi_valides_interne.sql` appliquées sur koma-dev, types régénérés. Spec : `spec-4-4-boite-d-envoi-et-premiers-emails.md`.
- Inclus : tables `envoi` et `anomalie`, vue `taches_admin`, route `/api/cron/envois` (lot de 10, 5 essais puis abandon + anomalie, bail de 10 min, clé d'idempotence Resend), gabarits `commande_payee` et `kit_ouvert` (FR/EN, USD, liens en texte), `offrir_commande` planifie `kit_ouvert`, page admin `/admin/taches`.
- Revue (1 relecteur) : `envois_planifier` aussi fermée à `service_role`, abandon d'un envoi dont le worker plante en boucle (bail expiré), lien du Kit vers la fiche du Kit (la bibliothèque n'existe qu'à la 3.6), `donnees_envoi_valides` durcie et fermée aux clients. Limite connue : l'idempotence de Resend dure 24 h.
- **Statut `review`, pas `done` : il reste à faire par Jonathan** (critère de clôture de la story) : créer le compte Resend ; mettre `RESEND_API_KEY` et `EMAIL_EXPEDITEUR` dans `.env.local` ; sans domaine, Resend n'envoie qu'à l'adresse du titulaire du compte.
- Non planifié (aucun domaine, Q-D1) : le déclenchement par pg_cron existe (`envoyer-emails`, chaque minute) mais ne fait rien tant que les secrets Vault `site_url` et `cron_secret` n'existent pas. Pas de déclencheur pour `commande_payee` avant les stories 5.x.
- À tester à la main : en local, `RESEND_API_KEY` et `EMAIL_EXPEDITEUR` renseignés, obtenir un Kit gratuit avec un Compte dont l'email est celui du titulaire Resend, puis `curl -X POST http://localhost:3000/api/cron/envois -H "Authorization: Bearer $CRON_SECRET"` : l'email « Ton kit est ouvert » arrive ; un second appel n'en renvoie pas. Sans clé : réponse 503. Page `/fr/admin/tâches` : vide.

## Story 3.4 : double option et Kit lié (voie 2, intégrée par la voie 1)
- Branche `feat/voie-2-kits` rebasée sur main puis fusionnée en avance rapide. Détails de la revue, du bug du Kit lié, du texte du bloc 1 et des textes sans source exacte : `voie-2-notes.md` (section « Intégration sur main »).
- À tester à la main (375 px) : sur un cosplay avec un Kit lié publié (le lien se règle sur le Kit, pas sur le cosplay), sélecteur « Prêt à porter » / « Le fabriquer moi-même » ; l'accueil (bloc « Porte-le ou fabrique-le », héros à deux options, bloc Kits) ; au Plafond atteint, le Kit est proposé.

## Story 3.6 : ma bibliothèque et téléchargement des fichiers (voie 1, Claude Code)
- Commit `6bfc1f5`. Migration `20261124100000_bibliotheque_fichiers.sql` appliquée sur koma-dev, types régénérés. Spec : `spec-3-6-ma-bibliotheque-et-telechargement-des-fichiers.md`.
- Inclus : « Mon compte » et « Ma bibliothèque » (une ligne par Kit), page d'un Kit avec ses fichiers actuels, route `GET /api/kits/fichier/[id]` (accès vérifié en base, lien signé 60 s, `no-store`), PDF remis en copie filigranée (`@cantoo/pdf-lib`, Barlow Regular TTF, OFL 1.1, licence dans `docs/licences/polices.md`), copie réutilisée par Compte et par version ; SVG, STL, transcriptions sans filigrane. Lien « Ma bibliothèque » dans l'en-tête des Comptes connectés.
- Revue (2 relecteurs, sécurité et qualité) : l'email complet était écrit dans le PDF (masquage jamais appelé) : corrigé, test sur le texte produit. Clés mortes retirées.
- Écarts : pas de message « Le lien a expiré » (le lien n'est jamais affiché, l'expiration n'est pas détectable côté client) ; nom de téléchargement toujours en français ; anciennes copies filigranées jamais purgées.
- À tester à la main (375 px, vrai compte) : obtenir le Kit gratuit, ouvrir « Ma bibliothèque », télécharger un PDF (le filigrane « Acheté par jo•••@… · Commande KS-… · nom du site » est en bas de chaque page, sans gêner l'impression), télécharger un SVG/STL (sans filigrane) ; un deuxième clic donne un nouveau lien ; un lien copié ne marche plus après 60 s ; un autre Compte ne peut pas ouvrir l'adresse `/api/kits/fichier/<id>` (403) ; remplacer un fichier dans l'admin : la nouvelle version est téléchargeable et refiligranée. Changer `nom_site` : les nouvelles copies portent le nouveau nom.

## Stories 8.6 et 8.7 : blog (voie 3, intégrée par la voie 1)
- Branche `feat/voie-3-contenu` rebasée sur main (3.6 comprise) puis fusionnée en avance rapide. Conflits résolus : `package.json` et `package-lock.json` (resend + paquets Markdown), `messages/*.json` (Admin.nav `blog` et `taches` ; Metadata `bibliotheque` et `blog`), `tests/unit/coque-admin.test.tsx` (six entrées), `accueil-blocs.test.ts`, `src/app/[locale]/page.tsx`. `blocs.ts` et `proxy.ts` ont fusionné sans conflit.
- Migrations `20261125120000_article.sql` et `20261125130000_article_slug_obligatoire.sql` (voie 3, horodatages après la 3.6, conservés) appliquées sur koma-dev, puis `20261126100000_article_correctifs.sql` (correctifs de revue). Types régénérés ; les casts locaux du module blog (`queries.ts`, `existence.ts`, `dependances.ts`) sont remplacés par les types générés (reste un seul cast documenté : `p_id` nul à la création).
- Revue (2 relecteurs, sécurité et intégration). Rendu Markdown : rien d'exécutable (pas de `rehype-raw`, protocoles limités à http(s), image sans texte alternatif refusée) ; tests ajoutés (`iframe`, `style`, `JaVaScRiPt:`, tabulation, lien de référence). Corrigé : `auteur_id` n'est plus lisible par `anon`/`authenticated` (droit de lecture par colonnes) ; un article publié ne peut plus être vidé de son texte français, perdre un texte alternatif d'image, ni changer d'adresse (`KS_SLUG_PUBLIE`, messages FR/EN) ; l'emplacement `guides` (nº 5, sans objet) est supprimé, le bloc 7 « Guides » reste. Tests pgTAP : 62 assertions dans `article.test.sql`.
- Reste ouvert (mineur, non traité) : images externes http(s) acceptées dans le Markdown (fuite d'IP des lecteurs, risque limité à l'admin) ; `lireImages` ne revérifie pas le chemin des images ; taille de l'objet contrôlée après téléchargement dans `lireObjetAttente` ; deux onglets admin qui enregistrent en même temps peuvent effacer une image. Droit : le TypeScript accepte l'Assistant (`blog.gerer`), la base exige l'Admin (écart assumé par la voie 3, à trancher).
- Tests : aide `aides-dom.tsx` : délai des attentes asynchrones porté à 8 s (échecs aléatoires de `commande-ui` sous charge).
- À tester à la main : `/fr/admin/blog` (écrire un article avec titre, texte, image + textes alternatifs, aperçu, publier, dépublier, essayer de vider le texte d'un article publié, de changer son adresse) ; `/fr/blog` et `/en/blog` (cartes, « Voir plus », article sans version anglaise : 404 sous `/en`, sélecteur de langue vers `/en/blog`) ; accueil : bloc « Guides » avec au moins un article publié ; coller `<script>`, `<img onerror>`, `[x](javascript:...)` dans un article : rien ne s'exécute.

## Story 3.7 : lecteur vidéo à chapitres (voie 1, Claude Code)
- Migration `20261127100000_progression_video.sql` appliquée sur koma-dev, types régénérés ; logique SQL vérifiée sur koma-dev dans une transaction annulée. Spec : `spec-3-7-lecteur-video-a-chapitres.md`.
- Inclus : jeton Bunny de répertoire (HMAC-SHA256, style chemin, **4 heures**, décision de la story) signé seulement après vérification de `acces_kit` ; route `GET /api/kits/video/[slug]` (`no-store`) ; lecteur `hls.js` à commandes faites à la main (lecture/pause, piste temporelle ARIA avec valeur en texte, chapitres en boutons `aria-current`, sous-titres français/anglais, plein écran, aucun téléchargement) ; position enregistrée toutes les 15 s, à la pause, au masquage de la page et au départ ; reprise sur un autre appareil ; texte de progression dans la bibliothèque (« Chapitre 3 sur 8 · 2 chapitres terminés », « Reprendre au chapitre 3 »).
- Revue (2 relecteurs) : aucun bloquant. Corrigé : la position reprise n'est plus écrasée par 0 si la page est masquée avant la lecture ; une vidéo regardée jusqu'au bout repart du début ; plein écran de repli sur iPhone ; l'enregistrement s'arrête sur erreur ; chapitre courant indépendant de l'ordre d'affichage.
- **Réglages à faire par Jonathan** : créer la bibliothèque Bunny privée, activer sur sa zone CDN « Token Authentication » en mode **Advanced** ; `BUNNY_PRIVE_TOKEN_KEY` et `BUNNY_PRIVE_CDN_HOSTNAME` dans `.env.local` (et plus tard dans l'application Hostinger) ; vérifier que la zone autorise le CORS (sous-titres en `crossOrigin`).
- Non vérifié contre une vraie zone Bunny : le format exact du jeton vient de la documentation. Si Bunny répond 403 à une lecture légitime, corriger `src/lib/bunny/jeton.ts`.
- À tester à la main (téléphone) : lecture d'un Kit possédé ; **une adresse de vidéo privée copiée sans jeton valide est refusée par Bunny** ; première image en moins de 5 s en 3G simulée, rendu 360p ; reprise sur un autre appareil connecté au même Compte ; sous-titres par défaut dans la langue de l'interface ; chapitres au clavier ; « Réessayer » après une coupure réseau ; texte de progression dans la bibliothèque. Risque accepté : un jeton émis reste valable 4 h même si l'accès est retiré ensuite.
- Fin de l'epic 3 (3.1 à 3.7). Essais manuels cumulés : ceux de la 2.6 (vidéo du cosplay vedette), de la 3.4, de la 3.6 et de la 3.7 ci-dessus.

## Story 4.5 : couche de paiement, aiguilleur et admin des Prestataires (voie 1, Claude Code)
- Migrations `20261128100000_couche_paiement.sql` et `20261129100000_couche_paiement_correctifs.sql` appliquées sur koma-dev, types régénérés ; logique SQL vérifiée sur koma-dev dans une transaction annulée. Spec : `spec-4-5-couche-de-paiement-aiguilleur-et-admin-des-prestataires.md`.
- Inclus : tables `prestataire` (4 lignes, tous désactivés), `tentative_paiement`, `notification_recue`, `trop_percu` (service seulement) ; port `PrestatairePaiement` ; `choisirPrestataire` (fonction pure, seule source du choix) ; Familles relues en base pour le Compte propriétaire ; moyens affichés sur la Commande à payer (texte, sans logo) ; page `/admin/prestataires` (activer, Monter / Descendre, règle carte verrouillée, journal) ; carte « Paiement » du pied de page ; règle de lint pour les adaptateurs.
- **Choix de la story : un Prestataire ne peut pas être activé tant que son adaptateur n'est pas branché** (`src/modules/paiement/registre.ts`, vide aujourd'hui). Chaque story d'adaptateur (4.7, 5.4 à 5.7) y ajoute son code. Aucun bouton de paiement n'existe avant les adaptateurs ; rien n'est simulé.
- Revue (2 relecteurs) : aucun bloquant. Corrigé : erreur réseau de l'admin, état annoncé (`role="status"`), lint contournable par des imports relatifs (`../queries`, `../../../lib/...`), liste vide mise en cache dans le pied de page, famille inconnue qui faisait échouer en silence la décision, contrainte montant/devise (les deux ou aucun), Monter / Descendre bloqués aux bords.
- Reste ouvert (non traité) : rien n'empêche en base deux Tentatives `reussie` sur une Commande, volontairement (AD-4 : deux paiements réussis sur deux Agrégateurs donnent un Trop-perçu) ; la 4.6 et les 5.x portent `confirmer_paiement`.
- À tester à la main : `/fr/admin/prestataires` (quatre prestataires « Désactivé », Activer bloqué avec « Adaptateur pas encore branché », Monter / Descendre MaishaPay change l'ordre et reste après rechargement) ; `/fr/commande/KS-…` d'une Commande à payer : « Le mobile money n'est pas encore disponible dans ton pays. » et « Le paiement par carte n'est pas disponible pour le moment. » ; pied de page sans carte « Paiement ».

## Story 4.6 : page de retour, attente et état réel de la Commande (voie 1, Claude Code)
- Migration `20261130100000_etat_paiement.sql` appliquée sur koma-dev, types régénérés. Spec : `spec-4-6-page-de-retour-attente-et-etat-reel-de-la-commande.md`.
- Inclus : `etat_paiement_commande` (propriétaire seulement, sans référence de transaction ni montant) ; `GET /api/commande/[numero]/etat` (401 sans session, 404 pour une autre Commande, `no-store`) ; `GET`/`POST /api/paiement/retour/[prestataire]` qui redirige (303) vers la page de la Commande en ignorant tout paramètre de statut, adresse prise dans `NEXT_PUBLIC_SITE_URL` ; `SuiviPaiement` (sondage toutes les 3 s, « Paiement en cours de vérification. » après 2 minutes sans repayer, annonce `role="status"` seulement au changement réel, focus sur le titre d'un état final, titre d'onglet, « Ouvrir dans ma bibliothèque » pour un Kit, texte E-13 du Trop-perçu avec WhatsApp).
- Revue (1 relecteur) : aucun bloquant. Corrigé : délai de vérification compté deux fois, moyens de paiement qui réapparaissaient si l'état ne pouvait pas être lu (risque de double paiement), redirection prise sur l'hôte de la requête, sondage qui insistait après 401/404, titre d'onglet non restauré.
- Correctif de CI : l'assertion de `envois.test.sql` (4.4) sur l'énumération des anomalies tient compte des quatre valeurs ajoutées par la 4.5 (la CI de `448e745` était rouge pour cette seule raison).
- Le test pgTAP `etat_paiement.test.sql` n'a **pas** été exécuté sur koma-dev (Jonathan a refusé le script, à raison : il contenait deux UPDATE sans WHERE) ; il tourne dans la CI.
- À tester à la main : ouvrir la page d'une Commande à payer (aucun suivi, moyens indisponibles) ; en base de dev, poser une Tentative `en_cours` et recharger : « Paiement en attente », aucun choix ; la passer `echouee` : message d'échec, « Réessayer », WhatsApp ; statut `payee` avec un Kit : « Payée » et « Ouvrir dans ma bibliothèque » ; `/api/paiement/retour/kpay?numero=KS-…&status=success` : redirige vers la page sans rien afficher de plus.

## Story 5.1 : saisie de la Couverture des Agrégateurs (voie 1, Claude Code)
- Migrations `20261201100000_couverture.sql` et `20261202100000_couverture_casse.sql` appliquées sur koma-dev, types régénérés. Spec : `spec-5-1-saisie-de-la-couverture-des-agregateurs.md`.
- Inclus : table `couverture` **sans aucune ligne** (aucun pays ni opérateur en dur), fonctions Admin `ajouter_couverture` (source obligatoire), `confirmer_couverture`, `retirer_couverture`, journal ; section « Couverture » par Agrégateur dans `/admin/prestataires` (couple « À vérifier » / « Confirmé », erreurs reliées au champ) ; `lireCouverture` ne passe à l'aiguilleur que les couples **confirmés** ; l'aiguilleur n'y retient que les Agrégateurs actifs.
- Revue (1 relecteur) : aucun bloquant. Corrigé : unicité insensible à la casse (« MTN » = « mtn »), erreurs de champ annoncées (`role="alert"`) avec l'aide de la source toujours lue.
- Le test pgTAP `couverture.test.sql` n'a pas été exécuté sur koma-dev ; il tourne en CI.
- **À faire par Jonathan quand il aura la documentation des Agrégateurs** (Q-1) : saisir les couples réels, avec leur source, puis les confirmer. Aucun n'est inventé.
- À tester à la main : `/fr/admin/prestataires` : ajouter un couple sans source (erreur sous le champ), puis avec ; le confirmer, le retirer ; ajouter deux fois le même couple en casse différente (refusé).

## Stories 5.2 et 5.3 : choix du mobile money, attente et repli (voie 1, Claude Code)
- Migrations `20261203100000_trop_percu_statuts.sql` (alignement AD-27 : `a_rembourser` / `rembourse` / `honore`), `20261204100000_tentative_fonctions.sql` et `20261205100000_tentative_correctifs.sql` appliquées sur koma-dev, types régénérés. Spec : `spec-5-2-5-3-choix-du-mobile-money-attente-et-repli.md`.
- Inclus : `demarrer_tentative`, `enregistrer_initiation`, `echouer_tentative` ; service `demarrerTentative` où **le serveur choisit le Prestataire** (le navigateur n'envoie que moyen, pays, opérateur, numéro), limité par `consommer_essai` (10 par 10 min et par Compte) ; formulaire `ChoixPaiement` (pays d'abord, « Autre pays », opérateur réinitialisé et annoncé, numéro avec indicatif en aide, « Paiement traité par {Agrégateur} », bouton verrouillé au premier toucher, saisie gardée dans l'onglet) ; écran d'attente mobile money (« Valide le paiement sur ton téléphone. », montant USD, numéro masqué, « À payer avant ») ; repli proposé par le serveur après un échec confirmé côté Prestataire, jamais sans toucher du client, jamais sur un échec client.
- **Aucun adaptateur n'existe** : le registre est vide, donc aucun Prestataire n'est activable et aucun bouton de paiement n'apparaît en production. Le cycle complet (démarrage, refus, délai sans repli, référence déjà utilisée, repli, Panier mixte et Pass jamais chez Polar) est prouvé avec des doubles `TEST_` (`tests/doubles/TEST_prestataire.ts`).
- Le numéro de téléphone n'est jamais conservé en clair (masque imposé par une contrainte de la table) ; il reste dans le stockage de l'onglet pour « Réessayer », purgé à la fin.
- Revue (1 relecteur) : aucun bloquant. Corrigé : masque imposé en base et test qui le prouve, impasse de « Réessayer » sans numéro dans l'onglet, purge du stockage, `enregistrer_initiation` silencieux, paiement déjà en cours qui relit la page.
- Reste ouvert : délai maximal de l'appel au Prestataire (`AbortSignal`) à imposer dans les stories d'adaptateurs ; `confirmer_paiement`, routes de notification et tâche de réconciliation (stories 4.7 et 5.4 à 5.7).
- Le test pgTAP `tentative_paiement.test.sql` (24) n'a pas été exécuté sur koma-dev ; il tourne en CI.
- À tester à la main : rien de visible tant qu'aucun adaptateur n'existe (les moyens de paiement d'une Commande à payer affichent les messages d'indisponibilité) ; saisir un couple confirmé dans `/admin/prestataires` ne suffit pas à faire apparaître le mobile money tant qu'un Agrégateur n'est pas activable.

## Fin de la série demandée (3.6 → 3.7 → 4.5 → 4.6 → 5.1 → 5.2 → 5.3)
- Stories terminées dans l'ordre : 3.6, 3.7, 4.5, 4.6, 5.1, 5.2, 5.3, plus l'intégration des stories 8.6 et 8.7 de la voie 3 avant la 3.7.


## 2026-11-03 : K-Pay abandonné, socle de confirmation (4.8), adaptateur MaishaPay (5.6 et 5.9 en revue)
- **Correct-course** : `sprint-change-proposal-2026-11-03.md`. K-Pay retiré partout (CLAUDE.md, PRD, architecture, epics, EXPERIENCE, `.env.example`, sprint-status), migration `20261206100000_retrait_kpay.sql` appliquée sur koma-dev (MaishaPay propose la carte, rang 2). Stories 5.4 et 5.5 retirées (numéros non réutilisés), 5.9 (carte MaishaPay) et 4.8 (socle) créées.
- **Documentation MaishaPay** : résumé dans `docs/references/paiements/maishapay.md` (dossier ajouté à `.gitignore`, hors dépôt). Les deux sources s'affichent (la page Postman via l'API publique du documenteur, la page Checkout par téléchargement direct). Aucun cas d'arrêt : la carte est documentée (CyberSource, USD et EURO).
- **4.8, socle** : migrations `20261207100000`, `20261208100000`, `20261209100000` (appliquées sur koma-dev) : `confirmer_paiement` (seule porte vers « payee »), notifications, lot de réconciliation, abandon, signalement de montant indéterminé ; `confirmation.ts`, routes `POST|GET /api/paiement/notification/[prestataire]` et `POST /api/cron/reconcilier-tentatives` ; tâche pg_cron `reconcilier-tentatives`. Revue (1 relecteur) : 6 points importants corrigés (référence de transaction exigée et comparée, succès tardif d'une Tentative échouée, stock qui ne bloque plus un paiement encaissé, Panier vidé ligne par ligne, lot de réconciliation qui ne s'affame pas, redirection depuis NEXT_PUBLIC_SITE_URL) et mineurs (500 pour rejeu, taille annoncée, auteur vide, Pass jamais livré).
- **5.6 et 5.9, adaptateur MaishaPay** (`adaptateurs/maishapay.ts`, enregistré dans le registre) : mobile money v2, carte v2, consultation par référence marchand ; délai maximal de 10 s par appel ; le rappel (non signé) n'est qu'un signal, la consultation fait foi. **Reste non activable** (`questionsOuvertes` non vide) : devise réellement débitée, règle de comparaison du montant, couverture réelle, noms de `provider` (M-Pesa n'est documenté qu'en v1), cause d'un FAILED, carte (réseau, nom et téléphone du payeur), durée de vie d'un PENDING. `comparerMontant` répond « indéterminé » : aucune Commande ne peut passer payée avant ces décisions.
- Les pgTAP `confirmer_paiement.test.sql` (62), `couche_paiement`, `couverture`, `etat_paiement`, `tentative_paiement` tournent en CI seulement.
- À faire par Jonathan : créer l'application « KOMA SHOP » chez MaishaPay ; variables `MAISHAPAY_PUBLIC_KEY`, `MAISHAPAY_SECRET_KEY`, `MAISHAPAY_GATEWAY_MODE` (0 sandbox, 1 live) ; répondre aux questions ouvertes ; adresse de notification envoyée avec chaque paiement : `<NEXT_PUBLIC_SITE_URL>/api/paiement/notification/maishapay` (en développement, via le tunnel `cloudflared`).


## 2026-11-03 (suite) : décisions MaishaPay, story 5.7 PawaPay (review)
- MaishaPay : comparaison sur `amount` en USD (frais absorbés par KOMA SHOP) ; carte : réseau Visa/Mastercard choisi par le client, nom et téléphone du payeur collectés pour la carte MaishaPay seulement, validés côté serveur, téléphone gardé masqué. Reste non activable : Q1 devise, couverture, M-Pesa v2, durée de PENDING, contradiction v3 (questions posées à MaishaPay par Jonathan). Politique de confidentialité : texte toujours « [Texte à fournir] » ; elle devra citer nom et téléphone du payeur transmis à MaishaPay pour la carte.
- 5.7 PawaPay : `adaptateurs/pawapay.ts` (dépôts v2, identifiant de dépôt dérivé de notre référence, consultation de statut qui fait foi, USD pour RDC et Zimbabwe seulement). Résumé de doc : `docs/references/paiements/pawapay.md`. Variables `PAWAPAY_API_TOKEN`, `PAWAPAY_MODE`. Non activable tant que 5 questions restent ouvertes (voir le résumé).


## Story 6.1 : mes commandes et suivi client (voie 1, fork epic 6)
- Migration `20261210100000_commande_suivi_colonnes.sql` (colonnes de dates, numero_suivi, mesures_recues_le), appliquée sur koma-dev, types régénérés. Page `/compte/commandes` (12 par page), frise des statuts accessible, « Offert », « Prête à retirer » (retrait Goma), numéro de suivi en texte, bouton WhatsApp.
- Revue par un autre sous-agent impossible dans ce fork (interdiction de lancer des sous-agents) : auto-revue. Aucun test pgTAP (colonnes seulement).
- À tester à la main : `/fr/compte/commandes` (liste vide, avec commandes, « Voir plus »), détail d'une commande payée physique (frise), commande en retrait à Goma expédiée.


## Story 6.2 : commandes dans l'admin (fork epic 6)
- Migration `20261211100000_commandes_admin.sql` appliquée sur koma-dev, types régénérés. Pages `/admin/commandes` (filtres, 12 par page, tableau/cartes) et `/admin/commandes/[numero]` (détail, correction d'adresse journalisée, bloc Paiement en lecture seule). Entrée « Commandes » dans la navigation admin.
- Correction d'un défaut de 6.1 : le lien « Mes commandes » du compte lisait une clé de message inexistante (`Bibliotheque.commandes` au lieu de `Bibliotheque.compte.commandes`).
- Pas de sous-agent possible dans ce fork : auto-revue. pgTAP `commandes_admin.test.sql` (11) : CI seulement. « Tâche liée » non affichée (voir la spec).
- À tester à la main : `/fr/admin/commandes` avec chaque filtre, détail d'une commande en livraison (corriger l'adresse), d'une commande en retrait (pas de formulaire), d'une commande offerte.


## Story 6.3 : avancement manuel et emails de statut (fork epic 6)
- Migration `20261212100000_avancer_statut.sql` appliquée sur koma-dev. `avancer_statut` (transitions autorisées seulement, suivi, email dans la même transaction), trois modèles d'email via la boîte d'envoi, bloc « Avancement » dans le détail admin.
- pgTAP `avancer_statut.test.sql` (22) et `envois.test.sql` (énumération à 5 modèles) : CI seulement. Auto-revue (pas de sous-agent possible dans ce fork).
- À tester à la main : avancer une vraie commande payée de bout en bout (fabrication, expédition avec et sans suivi, livraison) et vérifier chaque email reçu ; la configuration Resend doit être réelle.


## Stories 6.4 et 6.5 : mesures sur WhatsApp et réception confirmée (fork epic 6)
- 6.4 : bloc `EnvoiMesures` (bouton WhatsApp avec le numéro de commande, délai écrit à côté, message si le numéro est absent), paragraphe dans l'email `commande_payee`, alerte admin si le numéro n'est pas réglé. Aucune mesure collectée ni stockée.
- 6.5 : migration `20261213100000_confirmer_mesures_recues.sql` appliquée sur koma-dev ; `confirmer_mesures_recues`, tâche « Mesures à recevoir » (compteur réel), bouton « Mesures reçues », date affichée au client. pgTAP `confirmer_mesures.test.sql` (11) : CI seulement.
- 6.3, 6.4 et 6.5 ont été poussées dans un seul commit (fichiers de messages et page de détail communs) ; une seule CI les couvre. Auto-revue (pas de sous-agent possible dans ce fork).
- À tester à la main : commander un cosplay sur mesure (carte ou mobile money quand un prestataire sera activable), vérifier le bouton WhatsApp sur la commande et dans l'email, confirmer « Mesures reçues » côté admin, puis « Passer en fabrication ».


## Stories 6.6 et 6.7 : annulation, remboursement, réclamation (fork epic 6)
- Migrations `20261214100000_annulation_et_remboursement.sql` et `20261215100000_reclamation.sql` appliquées sur koma-dev, types régénérés. Annulation demandée par le client, acceptée ou refusée par l'admin, montant à rendre figé, remboursement confirmé avec preuve (Commande et Trop-perçu), emails `commande_annulee` et `commande_remboursee`. Réclamation sous 48 h (calcul en base), étapes acceptée → article rendu → remplacement remis, stock décompté, aucun email, aucun remboursement.
- pgTAP `annulation_remboursement.test.sql` (30), `reclamation.test.sql` (23) et `envois.test.sql` : CI seulement. Auto-revue (pas de sous-agent possible dans ce fork).
- Hypothèse à confirmer par Jonathan : `reduction_cents` = réduction totale de la ligne. Écart : `catalogue_decrementer_stock` créée (absente jusque-là).
- À tester à la main : annuler une commande payée contenant un cosplay (côté client puis côté admin), confirmer le remboursement avec et sans preuve, vérifier les deux emails ; livrer une commande puis signaler un problème dans les 48 h, parcourir les étapes côté admin.


## Revue croisée de l'epic 6 : correctifs (fork)
- Trois revues par sous-agents (Blind Hunter, Edge Case Hunter, Verification Gap) lancées par la session principale ; correctifs justifiés appliqués dans la migration `20261216100000_epic6_correctifs_revue.sql` (appliquée sur koma-dev, types régénérés) ; le numéro `20261230100000` reste réservé à la voie 3.
- Corrigé (SQL) : `catalogue_decrementer_stock` tient compte des réservations actives (`stock_disponible`) ; une seule réclamation par ligne, refusée ou remplacée comprises ; `traiter_reclamation` (étape inconnue, « depuis le stock » seulement pour le remplacement remis, ligne relue sous verrou) ; `avancer_statut` (refuse d'office les demandes d'annulation ouvertes vers fabrication/expédition, fabrication exigeant une pièce à fabriquer, pas de suivi pour un retrait) ; `annuler_commande` (montant borné par le total payé, refus d'un montant nul, variantes verrouillées dans l'ordre, demandes ouvertes closes) ; `remboursement.montant_cents` en bigint ; `confirmer_remboursement` (montant nul refusé) ; `confirmer_mesures_recues` (Commande verrouillée avant la ligne, Commande « payee » seulement, ligne non annulée). AD-32 aligné sur la matrice : « Mesures reçues » ouvert à l'admin et à l'assistant.
- Corrigé (TS/UI) : filtre « Offerte » sur `offerte = true` ; formulaire « Signaler un problème » resynchronisé après envoi ; bouton d'annulation de nouveau proposé après un refus ; champ de suivi masqué pour un retrait ; table d'erreurs complétée (FR/EN) ; noms de prestataires dans les messages.
- Tests : pgTAP `epic6_revue.test.sql` (56, CI seulement), Vitest `commande-revue-epic6.test.ts` et `commande-revue-epic6-ui.test.tsx`, test des transitions et des emails mis à jour.
- Limite connue (stock rendu à l'annulation) : l'anomalie `stock_insuffisant` ne donne que le total des pièces manquantes de la Commande. Avec une seule variante en stock concernée, la quantité rendue est exacte (total moins manquantes) ; avec plusieurs variantes, aucun stock n'est rendu automatiquement (à corriger à la main) plutôt que d'en inventer la répartition.
- Écarts connus non traités (hors périmètre de la revue) : « tâche liée » du détail admin (6.2), signal global quand le numéro WhatsApp n'est pas réglé (6.4), e2e Playwright, plafonds de volume des listes, rattrapage de `livree_le` des anciennes commandes, quantité partielle d'un remplacement, tests RTL de la page de détail client (bouton d'annulation absent après fabrication, « Signaler » absent après 48 h) et de la liste « Mes commandes » (état vide, « Offert »).


## Epic 6 : clôture (décisions de Jonathan du 2026-11-04)
- Validé : `reduction_cents` = réduction totale de la ligne ; « Mesures reçues » ouvert à l'admin et à l'assistant (AD-32 corrigé) ; annulation et remboursement réservés à l'admin.
- Ajouts après la revue croisée : quantité réellement retirée du stock enregistrée au paiement et rendue exactement à l'annulation (tâche admin « Vérifier le stock » si elle est introuvable) ; quantité à remplacer choisie pour un remplacement ; colonnes de stock internes retirées de la lecture des clients connectés (commits `ee58e17`, `3d82125`).
- Stories 6.1 à 6.7 : `done` après CI verte sur `3d82125`.


## Story 9.1 : Code promo (voie 3, intégrée)
- Revue croisée par trois sous-agents (Blind Hunter, Edge Case Hunter, Verification Gap) ; correctifs dans `20261230110000_code_promo_correctifs_revue.sql` (caractères de contrôle refusés, code immuable en base, modification sans changement non journalisée) et dans le module `promo` (types vérifiés à l'exécution, droit avant validation, code testé avant mise en majuscules, accessibilité). Les 16 textes FR/EN de l'admin sont appliqués après corrections ; plus aucun « [Texte à fournir] » dans `Admin.codesPromo`.
- Migrations `20261230100000` et `20261230110000` appliquées sur koma-dev, types régénérés (commit `6b83b85`), CI verte avec pgTAP. Build vérifié avec les vraies variables : l'échec de la voie venait de sa fausse clé de service.
- Pour la 9.2 : la Commande doit copier le code, le taux de réduction et le taux de commission au paiement (une modification de taux ne doit pas recalculer les commissions passées) ; prévoir le cas « utilisations > plafond ».
- Limites connues : entrée de menu « Codes promo » non filtrée par droit (l'assistant voit le lien, la page le refuse) ; liste sans pagination.


## Story 9.2 : appliquer un Code promo (reprise du 2026-11-08 après coupure)
- Travail du 2026-11-04 retrouvé non commité ; migration `20261231100000_appliquer_code_promo.sql` déjà appliquée sur koma-dev (non modifiée). Spec remise au format BMad.
- Figé avec la Commande par `creer_commande` (AD-8) dans `commande_code_promo` (service seulement) : code, taux de réduction, taux de commission, réduction ; réduction par ligne dans `ligne_commande.reduction_cents`. La Commande payée porte ces valeurs ; une modification du code ne les change jamais (test pgTAP). `confirmer_paiement` ne relit pas le code.
- Plafond sans compteur (`utilisations_code_promo`), ligne du code verrouillée avant le comptage ; prix, réduction et total calculés en base.
- Revue par trois sous-agents ; correctifs : migration `20261231110000_code_promo_echeance.sql` (utilisation libérée dès l'échéance, sans attendre la tâche d'expiration ; « un seul code » aligné), réduction dans l'email `commande_payee`, pourcentage localisé, tests UI et email. Reports dans `deferred-work.md`.
- À valider par Jonathan : texte `code_total_nul` (« Ce code rendrait ta commande gratuite : il ne peut pas être appliqué ici. ») et textes EN.
- À tester à la main : appliquer un code (minuscules, espaces), changer de Zone, retirer le code, code inconnu/inactif ; confirmer et vérifier la page Commande, le détail admin et l'email de paiement (quand un prestataire sera activable).
- Bunny : clés remises à leur place par Jonathan ; essai réel 13/13 (200 signé ; 403 sans jeton, altéré, expiré), vidéo de test supprimée ; documenté dans `docs/bunny-stream-prive.md` et `.env.example`.
- CI verte sur `2f81ece` (pgTAP compris ; le premier passage sur `7ad3d3c` avait échoué sur un test SQL jamais exécuté jusque-là, corrigé). Story 9.2 : `done`.


## Story 9.3 : ventes et commissions par Code promo
- Vue `commission_code_promo` (migrations `20261231120000` et `20261231130000`, appliquées sur koma-dev), seule source du calcul (AD-27) : Commandes avec `paye_le`, montant hors livraison et hors lignes annulées, commission au taux figé de chaque Commande, arrondie au centime inférieur par Commande. Une Commande dont toutes les lignes sont annulées n'est plus une vente. Lecture serveur seulement (anon : 42501, vérifié sur koma-dev).
- Page `/fr/admin/codes-promo` : ventes payées, montant, commission due par code. Aucun paiement de commission par le site.
- Revue (3 sous-agents) : vente à 0 USD comptée, test rouge corrigé, tests pgTAP complétés (19).
- À tester à la main (après un paiement réel) : payer une Commande avec un code, voir la vente et la commission ; annuler une Commande mixte (le Kit reste compté) ; changer le taux du code : la commission due ne bouge pas.
- CI verte sur `a51d6d7` (pgTAP compris). Story 9.3 : `done`.


## Story 9.4 : consentements, Préférences et désinscription
- Décisions de Jonathan (2026-11-08) : la case unique active « Relances et rappels » et « Nouveautés de mon univers » ; texte FR/EN fourni ; `DESINSCRIPTION_SECRET` généré dans `.env.local` (à ajouter dans Hostinger en 9.9).
- Migrations `20261231140000`, `20261231150000` (valeurs commerciales de l'énumération AD-9, sans gabarit) et `20261231160000` (correctifs de revue), appliquées sur koma-dev, types régénérés.
- Inclus : tables `consentement` et `desinscription`, case facultative (création de Compte, étape de commande), page « Mon compte › Préférences » (trois interrupteurs), page `/desinscription` (lien signé, sans connexion), règle `email_commercial_autorise` dans la boîte d'envoi (sans consentement, désinscription, Compte mineur, 2 jours), réglage `emails_commerciaux_mineurs` désactivé (pas d'écran admin).
- Revue (3 sous-agents) : 9 correctifs. À valider : la désinscription a lieu à l'ouverture du lien (effet immédiat exigé) ; un logiciel qui prévisualise les liens d'un email peut donc désinscrire.
- À tester à la main : créer un Compte en cochant la case, puis « Mon compte › Préférences » (deux interrupteurs actifs, Alertes Festival désactivé) ; basculer au clavier ; passer une Commande avec la case ; Compte de 15 ans : message « Ces emails ne te sont pas envoyés pour le moment. ». Le lien de désinscription ne sera visible qu'avec les emails des stories 9.5 et 9.6.
- CI : deux échecs (test SQL d'une fonction STABLE dans la même instruction, puis test e2e qui cherchait « univers », présent dans le texte de la case), corrigés avec l'accord de Jonathan ; CI verte sur `da6d770`. Story 9.4 : `done`.


## Story 8.1 : envoyer sa photo depuis son Compte
- Texte de l'accord et règles fournis par Jonathan (2026-11-08). Décision d'application : un Compte qui a déclaré moins de 18 ans ne peut pas envoyer de photo (elle ne serait jamais publiée), avec un message.
- Migration `20261231170000_photo_galerie.sql` (appliquée sur koma-dev, types régénérés) : `photo_galerie`, accord de publication par photo dans `consentement` (`cible_id`), `deposer_photo_galerie`, `lister_mes_photos`, `retirer_photo` ; `desinscrire` ne retire plus que les consentements aux emails.
- Page « Mon compte › Envoyer une photo » : envoi TUS signé (chemin lié au Compte), contrôle et nettoyage par le serveur (EXIF et GPS retirés dès l'envoi), choix d'afficher pseudo et ville, état réel, retrait (immédiat en attente, demande si publiée). Email `commande_livree` : lien vers la page (jamais pour un mineur). Purge : `photos-clients/` nettoyé seulement de ses fichiers sans photo vivante.
- Revue (3 sous-agents) : 10 correctifs (dont l'envoi lié au Compte et les fichiers orphelins).
- Question à Jonathan : l'accord dit « avec mon pseudo », mais le client peut choisir de ne pas afficher son pseudo.
- À tester à la main : sur iPhone (Safari), envoyer une photo HEIC prise par l'appareil : elle doit partir en JPEG ; une photo avec position GPS ; « Annuler l'envoi » ; couper le réseau pendant l'envoi ; retirer une photo en attente ; Compte de 16 ans : message, pas de formulaire.
- CI verte sur `39f513e` (pgTAP et e2e compris). Story 8.1 : `done`.


## Story 8.2 : validation, dépôt WhatsApp et retrait des photos
- Décisions de Jonathan (2026-11-08) : case « La personne m'a confirmé avoir 18 ans ou plus » obligatoire au dépôt WhatsApp ; dépôt refusé pour un Compte mineur ; accord de 8.1 précisé (« avec mon pseudo si je choisis de l'afficher », version 2026-11-08-v2).
- Migration `20261231180000_galerie_validation.sql` (appliquée sur koma-dev, types régénérés) : statut `refusee`, copie publique `galerie/` dans `produits-public`, bucket privé `accords-whatsapp` sans politique, fonctions de validation, refus, retrait, dépôt, recherche de Compte par email, compteurs ; `retirer_photo` (client) réécrite.
- Page `/admin/galerie` (droit `galerie.valider`, Admin et Assistant) : à valider, retraits demandés, publiées, dépôt WhatsApp ; tâche « Photos » dans `/admin/taches` ; cache `galerie` invalidé à chaque publication ou retrait.
- Revue (3 sous-agents) : 16 correctifs, dont la copie publique jamais effacée après publication et le retrait qui efface la copie publique avant la base.
- À tester à la main : valider une photo envoyée depuis un Compte (vérifier l'adresse publique, puis l'absence de position GPS dans le fichier téléchargé) ; refuser ; demander le retrait depuis le Compte puis retirer depuis l'admin (l'adresse publique doit répondre 404 ou 400) ; déposer une photo WhatsApp sans Compte, avec capture ; essayer sans la case 18+ ; avec l'email d'un Compte de 15 ans ; avec un Compte Assistant.
- CI : un échec (test SQL de la 8.1 qui publiait une photo sans copie publique, interdit par la nouvelle contrainte), corrigé ; CI verte sur `c66d513`. Story 8.2 : `done`.


## Story 8.4 : Réalisations
- Migration `20261231190000_realisations.sql` (appliquée sur koma-dev, types régénérés) : table `realisation` (Kit déclaré, preuve d'achat, date et rang de validation), `kits_payes`, `deposer_realisation` ; `valider_photo`, `lister_photos_admin`, `lister_mes_photos`, `compter_photos_a_traiter` réécrites.
- Page « Mon compte › Envoyer une Réalisation » (choix parmi les Kits payés ; un Kit gratuit ne compte pas), section « Réalisations à valider » dans `/admin/galerie` avec le Kit et la preuve d'achat, compteur dans la tâche Photos.
- Revue (3 sous-agents) : Kit vérifié avant l'envoi, tests complétés ; deux constats écartés (un Kit n'est jamais remboursé ; un Kit possédé ne se rachète pas). Notes pour 8.3 et 8.5 dans `deferred-work.md`.
- À tester à la main (après un paiement réel de Kit) : envoyer une Réalisation, la voir dans la Galerie admin avec sa commande, la valider (rang 1), en valider une seconde (rang 2) ; un Compte avec seulement le Kit gratuit voit « Une Réalisation se fait avec un kit acheté ».
- CI verte sur `ff1377c` (pgTAP et e2e compris). Story 8.4 : `done`.


## Story 9.6 : emails ciblés
- Textes validés par Jonathan (2026-11-10) ; traductions anglaises faites ici, à relire.
- Migrations `20261231200000_emails_cibles.sql` (planification + tâche pg_cron `planifier-emails-cibles` toutes les 15 min) et `20261231210000_emails_cibles_correctifs.sql`, appliquées sur koma-dev. Gabarits `panier_abandonne`, `rappel_kit`, `nouveau_produit` avec lien de désinscription en pied ; le rendu relit la base (Panier vidé, Kit terminé ou sans accès, produit dépublié : jamais envoyé).
- À valider par Jonathan : la limite absolue d'un Email commercial tous les 2 jours (règle de l'epic) fait que le panier oublié part une seule fois par modification (1 h, ou 24 h si le Panier est plus ancien) ; jamais les deux.
- Revue (3 sous-agents) : 9 correctifs, banc de test du rendu commercial.
- À tester à la main (Resend configuré) : Compte avec la case cochée, ajouter au panier puis attendre 1 h (ou reculer `mis_a_jour_le` en base de dev), lancer `select public.planifier_emails_cibles()` puis `POST /api/cron/envois` : l'email « Ton panier t'attend » arrive avec le lien « Me désinscrire » ; cliquer le lien ; aucun email suivant.
- CI verte sur `e6d1909` (pgTAP et e2e compris). Story 9.6 : `done`.

## Fin de la série (2026-11-10)
- Stories terminées dans l'ordre : 9.2, 9.3, 9.4, 8.1, 8.2, 8.4, 9.6. Restent hors série : 8.3, 9.7, 9.8 (OpenCode possible), 9.5 (dépend de l'epic 7 pour un sujet), 8.5 et l'epic 7 (correct-course Q-C1), 4.4, 4.7, 5.6, 5.7, 5.9 (prestataires, Resend), 9.9 (domaine).


## 2026-11-10 : désinscription par POST signé (décision de Jonathan)
- Ouvrir le lien de désinscription ne change plus rien : page de confirmation avec le bouton « Me désinscrire » (POST signé, Server Action). Emails commerciaux : `List-Unsubscribe` et `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058) vers `POST /api/desinscription` (signature vérifiée, corps One-Click exigé, aucun GET).
- Panier oublié : un seul email par modification (1 h ou 24 h) validé. Texte anglais du rappel de Kit : « Continue with chapter {n} of {kit}. »
- Revue (3 sous-agents) : 10 correctifs. 8.3 : faite par la voie 2 (OpenCode), à intégrer quand elle sera prête.
- À tester à la main : ouvrir un lien de désinscription (rien ne change dans Préférences), cliquer « Me désinscrire » (Préférences : tout désactivé) ; avec Resend, vérifier dans Gmail le lien « Se désabonner » de l'en-tête.

## 2026-11-10 : préparation de la 8.3 (lecture publique du mur), demandée par Jonathan
- Migrations `20261231220000_mur_public.sql` et `20261231230000_mur_public_correctifs.sql` (appliquées sur koma-dev) : `lister_mur_public(p_curseur_date timestamptz, p_curseur_id uuid, p_limite integer)` (SECURITY DEFINER, search_path vide, anon et authenticated, 24 au plus, curseur ISO UTC).
- Décision de Jonathan (2026-11-10) : le texte alternatif des photos de la galerie est saisi par l'admin à la validation (FR et EN obligatoires) ; `valider_photo` prend deux arguments de plus, formulaire de la page Galerie adapté.
- Revue (3 sous-agents) : test `photo_galerie.test.sql` qui aurait cassé (publication sans alt) corrigé ; curseur ISO UTC ; comparaison de lignes et index ; mêmes règles d'alt en SQL et TS ; droit vérifié avant l'alt ; tests ajoutés (dates distinctes, accord retiré, Kit futur, alt invisible ou trop long, alt EN vide). Notés dans deferred-work : copie publique après suppression de Compte, coût d'est_mineur, nullabilité des types.
- À tester à la main : page admin Galerie, valider une photo sans alt (champ signalé), puis avec les deux alts (publiée).

## 2026-11-10 : intégration de la 9.7 (voie 3, OpenCode)
- Branche feat/voie-3-contenu rebasée sur main (sans conflit), migration 20270101100000_mesure.sql après 20261231230000 ; appliquée sur koma-dev, types régénérés.
- Revue (3 sous-agents) : deux failles de débit (session choisie par le client, IP prise en tête de X-Forwarded-For), hôte falsifiable, corps lu en entier, vue nominative (vue_deuxiemes_achats), fuseau UTC, ventes remboursées comptées. Tout corrigé avant db:push (migration jamais appliquée auparavant, donc modifiée sur la branche). Détail dans la spec 9.7.
- Garde AD-3 : aucune fonction de la 9.7 n'est exécutable par anon ; liste blanche inchangée.
- 9.7 en done. Réponse à Jonathan sur la 9.8 : elle lit des Commandes et des paiements ; à couper (agrégats serveur par Claude, page par OpenCode).

## 2026-11-10 : 9.8 partie 1 (agrégats du tableau de bord), décision de Jonathan
- Migration 20270102100000_tableau_de_bord.sql (appliquée sur koma-dev) : tableau_commandes_payees, tableau_paiements, tableau_echecs_paiement, tableau_delai_mesures, tableau_trop_percus ; droit Admin revérifié en base (exiger_admin), service_role seulement ; minuit_goma (interne).
- Revue (3 sous-agents) : forfait de livraison ajouté (Famille « livraison »), échecs séparés par cause (client, Prestataire), multiplication en bigint, index sur paye_le et cree_le, minuit à Goma par défaut, test du fuseau à date fixe, anon testé avec un jsonb littéral.
- Phrase de confidentialité de Jonathan ajoutée (Legal.confidentialite.texte, FR et EN), après le marqueur « [Texte à fournir] » : la politique complète reste à fournir.
- deferred-work : formulaire de contact à aligner sur la dernière adresse de X-Forwarded-For (9.9).
- 9.8 en in-progress : la partie 2 (page) revient à OpenCode.

## 2026-11-10 : 9.8 partie 2 (page du tableau de bord), faite par Claude sur demande de Jonathan
- Incident : à 17:23:27, six fichiers de suivi (sprint-status, journal, deferred-work, messages fr/en, types.ts) ont été réécrits à leur état de `d2a82e4` (avant la partie 1) et `tableau_de_bord.test.sql` supprimé, par une opération unique. Cause non trouvée : hook `relais-export.ps1` (n'écrit que `.relais/`), scripts claude-free et claude-ci, `opencode.json` et `.claude/settings.local.json` ne copient rien depuis un commit ; aucun hook git. Jonathan a restauré à HEAD (`git restore`) ; `types.ts` vérifié identique à `npm run types` sur koma-dev (fins de ligne mises à part).
- `/admin` devient le tableau de bord (remplace la redirection vers Réglages) : Commandes payées, graphiques (Prestataire, Famille, jour), cartes de tâche, indicateurs SM-1 à SM-10 et SM-C1 à SM-C7 sur 7 et 30 jours. Lit seulement les cinq fonctions de la partie 1, les vues de la 9.7 et les compteurs de tâches existants ; test de garde sur les sources. Aucune migration.
- Revue (3 sous-agents) : lectures de vues paginées (plafond de 1 000 lignes), nombres stricts (jamais de zéro silencieux), SM-2 en sessions, SM-3 et SM-6 « Pas encore mesuré » sans aucune ligne de mesure, pluriels ICU, listes par `Intl.ListFormat`, test de garde étendu à la page. Points reportés dans deferred-work.
- CI verte sur `fd8b9a9` (pgTAP 55 fichiers dont tableau_de_bord.test.sql, e2e, build). 9.8 en done.


## 2026-11-10 : décisions de Jonathan sur la 9.8, correctif de la navigation admin mobile
- Formulation des graphiques validée. `.gitattributes` ajouté (`* text=auto eol=lf`, scripts Windows en CRLF, binaires protégés) en commit séparé `1177fe1` ; `git add --renormalize .` n'a changé aucun fichier suivi (dépôt déjà en LF).
- Correctif UX-DR42 (spec-9-8b-navigation-admin-mobile.md) : barre du bas = Tableau de bord, Commandes, Tâches + bouton ☰ « Plus » (dialogue plein écran avec les 8 autres pages, cibles de 44 px, Échap, piège de focus, onglet actif annoncé, compteur de messages annoncé) ; barre latérale inchangée sur ordinateur. Revue d'accessibilité (sous-agent) : panneau fermé au passage à md+, `scroll-padding-bottom` sous la barre fixe.

## 2026-11-10 : 8.3 (mur public) reprise par Claude sur main, menu ☰ et formulaire imbriqué
- Nouvelle organisation : OpenCode n'a plus de crédits, Claude reprend tout, y compris les voies. 8.3 reprise sur `main` (fichiers non commités du worktree `KOMA-SHOP-voie-2-kits` copiés ; le worktree et la branche `feat/voie-2-kits` ne sont pas modifiés, la préparation 8.3 — `lister_mur_public`, garde AD-3 — était déjà dans `main`).
- 8.3 : bloc 4 « Ils le portent » (ancre `#galerie`), lecture par `lister_mur_public` seulement, cache `ETIQUETTES.galerie`, liens « Galerie » du pied de page et du ☰ seulement s'il y a une photo (EXPERIENCE.md:75, 79, 139, 241), bloc masqué sans photo, nom du site lu dans les réglages. Détail : spec-8-3-mur-public.md (Spec Change Log).
- Bug corrigé : `ImagesArticle` rendait un `<form>` dans le `<form>` de `FormulaireArticle` ; garde automatique `tests/unit/formulaires-imbriques.test.ts` sur tout `src/`.
- Menu ☰ connecté : « Mon compte » (vers la Navigation du compte : bibliothèque, commandes, photos, Réalisation, préférences) remplace « Ma bibliothèque » (EXPERIENCE.md:60, 74, 80 ; UX-DR37) ; pas de lien « Administration » dans les docs. Titre « Menu » du panneau plein : titre h2 discret, jamais un lien.


## 2026-11-10 : correct-course Stand (Q-C1) et début de l'epic 7
- Correct-course approuvé : `sprint-change-proposal-2026-11-10.md` ; PRD (FR-33, FR-33b, FR-52, glossaire), architecture (AD-37) et epics.md (7.1, 7.2, 7.4, nouvelle 7.11) mis à jour ; 7.11 ajoutée en backlog.
- Décisions de Jonathan : 90 jours de conservation des photos d'exposants, textes FR/EN de la case d'engagement et de la mention de confidentialité (dans la 7.11). PawaPay 5.7 : écart accepté (pas de signature RFC 9421), pays hors RDC et Zimbabwe non couverts, échec sans cause = échec du prestataire.
- Story 7.1 faite : voir `spec-7-1-creer-un-evenement-et-ses-types-de-pass.md`. Essai manuel : `/fr/admin/evenements` : créer un événement, ajouter deux Types de pass dont un Stand, essayer de publier (liste des manques), compléter, publier ; `/fr/admin/reglages` : frais d'annulation des Pass.
