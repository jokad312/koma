# Revue du spine d'architecture KOMA SHOP selon la grille

- Document relu : `ARCHITECTURE-SPINE.md` (statut draft, mis à jour le 2026-10-20)
- Sources croisées : PRD (`prd.md`), `CLAUDE.md`, `.memlog.md`, `docs/guide-koma-shop.md`
- Date : 2026-10-20 ; relecteur indépendant ; le spine n'a pas été modifié

## Verdict

Le spine est solide et rarement aussi précis sur le cœur transactionnel. Il n'est pourtant pas prêt à servir de contrat : deux failles du noyau de paiement peuvent rendre caduques les règles 2 et 3 de CLAUDE.md (fonctions `SECURITY DEFINER` exposées par PostgREST, rejeu de notification transformé en Trop-perçu), et l'enveloppe opérationnelle (sauvegardes et restauration, secrets, rétention et suppression, DNS email, en-têtes de sécurité, budgets de performance) n'est pas traitée.

---

## Critique

### C-1 — Les fonctions de transition sont appelables depuis le navigateur
- **Où :** AD-2, AD-3
- **Problème :** AD-3 impose des fonctions `SECURITY DEFINER` dans `supabase/migrations/`. Sur Supabase, toute fonction du schéma `public` est exposée par défaut via `POST /rest/v1/rpc/<nom>`, et `EXECUTE` est accordé à `anon` et à `authenticated`. Une story qui crée `confirmer_paiement` dans `public` sans révoquer ce droit permet à n'importe quel visiteur, avec la clé publishable, de passer une Commande en `payee` et de s'émettre des Pass ou des accès aux Kits. AD-2 interdit l'écriture dans les tables par RLS, mais ne dit rien de l'exécution des fonctions, qui contourne la RLS. La règle ne bloque donc pas la divergence la plus dangereuse.
- **Correction :** ajouter à AD-3 la règle suivante. « Les fonctions de transition et les fonctions internes vivent dans un schéma non exposé (`metier`, absent de `db.extra_search_path` et des schémas exposés de l'API). Chaque migration qui en crée une fait `REVOKE ALL ON FUNCTION … FROM public, anon, authenticated` et `GRANT EXECUTE … TO service_role`. Les seules fonctions appelables par `authenticated` sont les fonctions de lecture d'aide à la RLS (`a_le_role`, `est_mineur`). » Ajouter un test automatique qui appelle chaque fonction de transition avec la clé `anon` et attend un refus. Préciser aussi que `search_path` est fixé (`SET search_path = ''`) sur chaque fonction `SECURITY DEFINER`.

### C-2 — Une notification rejouée crée un Trop-perçu au lieu d'être ignorée
- **Où :** AD-4 (point 3), AD-5
- **Problème :** la contrainte `UNIQUE (prestataire, reference_transaction)` empêche seulement d'insérer deux Tentatives avec la même référence. Elle ne joue aucun rôle face à une notification rejouée, qui vise une Tentative déjà existante. AD-4 point 3 dit qu'un succès sur une Commande déjà `payee` crée un `trop_percu` : la deuxième livraison de la même notification (PawaPay, K-Pay et Polar renvoient tous en cas de délai) produirait donc un faux Trop-perçu, et l'Admin rembourserait de l'argent jamais reçu deux fois. Le test « notification rejouée » d'AD-6 n'a pas de règle qui le rende vrai. Autre ambiguïté : rien ne dit si `reference_transaction` est la référence que KOMA SHOP envoie (par exemple le `depositId` PawaPay, généré par le client) ou l'identifiant renvoyé par le Prestataire.
- **Correction :** dans AD-4, ajouter un point 0 : « Si la Tentative est déjà dans un état final (`reussie`, `echouee`), `confirmer_paiement` ne fait rien et renvoie le résultat précédent. Seule une Tentative `en_cours` peut produire un effet. » Dans AD-5 et AD-14, fixer deux colonnes :
  - `reference_interne` (uuid généré par KOMA SHOP, envoyé au Prestataire comme clé d'idempotence, unique) ;
  - `reference_transaction` (identifiant du Prestataire, `UNIQUE (prestataire, reference_transaction)` quand il n'est pas nul).

  Enregistrer chaque notification brute dans `notification_recue` avec `UNIQUE (prestataire, identifiant_notification)` quand le Prestataire en fournit un.

---

## Haute

### H-1 — AD-1 contredit les effets imposés par AD-3 et AD-4
- **Où :** AD-1, AD-4 point 1, tableau « Modules et tables »
- **Problème :** AD-1 dit que seul le module propriétaire écrit ses tables, avec une seule exception (`journal_audit`, `anomalie`). Or `confirmer_paiement` (rattachée à `paiement` ou à `commande`) écrit `acces_kit` (`bibliotheque`), `pass` (`evenements`), `code_promo` (`promo`) et `envoi` (`envois`). Les fonctions `offrir_commande` et `annuler_pass` posent le même problème. Un agent qui applique AD-1 à la lettre passera par les services TypeScript et cassera l'atomicité ; un autre écrira directement dans la fonction. Les deux stories divergeront.
- **Correction :** reformuler l'exception d'AD-1 : « Les fonctions Postgres de transition listées dans AD-3 peuvent écrire dans les tables des autres modules quand c'est un effet listé dans leur règle. Chaque table indique dans le tableau "Modules et tables" quelles fonctions peuvent l'écrire en plus de son module. » Ajouter une colonne « Écrite aussi par » au tableau (par exemple `acces_kit` : `confirmer_paiement`, `offrir_commande` ; `envoi` : toutes les transitions).

### H-2 — Les tests des règles de paiement ne peuvent pas tourner en CI
- **Où :** AD-6 (tests obligatoires), AD-20, Conventions « Tests »
- **Problème :** la moitié des tests imposés (référence déjà utilisée, notification rejouée, deux Tentatives réussies, notification tardive, montant insuffisant) portent sur des fonctions Postgres. La CI décrite (lint, typecheck, Vitest, build) n'a pas de base de données ; `koma-dev` est un projet partagé, pas une base jetable. Soit ces tests seront écrits comme des tests unitaires avec des doubles (ils ne prouvent alors rien sur le SQL), soit chaque story inventera sa propre façon de faire. C'est une divergence garantie, et la règle 11 de CLAUDE.md ne sera pas tenue réellement.
- **Correction :** fixer dans les conventions : « Les fonctions SQL sont testées contre une base Supabase locale lancée dans GitHub Actions (`supabase start`, Docker disponible sur les runners), migrations appliquées depuis zéro. Les tests sont en Vitest dans `tests/db/` avec des données préfixées `TEST_`, ou en pgTAP dans `supabase/tests/`. » Choisir l'un des deux. En local, ces tests visent `koma-dev`, ou sont lancés seulement en CI tant que Docker est absent du PC. Indiquer que le job CI s'appelle par exemple `db-tests` et qu'il figure parmi les contrôles requis de la branche `production`.

### H-3 — Enveloppe opérationnelle absente : sauvegardes, restauration, secrets, incidents
- **Où :** aucune section ; `.memlog.md` (M3) mentionne seulement « Supabase Pro, 7 j de sauvegardes »
- **Problème :** le spine ne fixe rien sur les points suivants :
  - **Sauvegardes et restauration.** Les sauvegardes Supabase Pro couvrent Postgres, pas les objets Storage : `kits-private`, les copies filigranées et les photos ne sont donc pas protégés. Le PITR n'est pas choisi, et personne ne sait qui restaure ni comment.
  - **Rotation des secrets.** Le dépôt est public, alors qu'il faut une procédure si une clé fuit (`CRON_SECRET` en double dans Vault et Hostinger, clés des Prestataires, service role, signature du cookie Panier).
  - **Gestion d'incident.** Rien ne dit quoi faire si un Prestataire envoie des notifications invalides en série, ni comment couper un Prestataire en urgence (l'interrupteur existe en admin, mais aucune règle ne dit que c'est la procédure).
  - **Hostinger.** La politique de redémarrage du processus Node n'est pas fixée.
- **Correction :** ajouter une AD-25 « Exploitation », avec quatre règles :
  - (a) Sauvegarde Postgres = Supabase Pro quotidienne, à l'ouverture des ventes (PITR différé, avec une date de revue). Sauvegarde hebdomadaire des buckets `kits-private` et `produits-public` hors Supabase par un script documenté, dont la cible est à préciser (question ouverte). Restauration testée une fois avant l'ouverture des ventes.
  - (b) Chaque secret a un seul nom dans `.env.example`. Rotation = nouvelle valeur en Hostinger et Vault, redéploiement, révocation de l'ancienne. Le secret du cookie Panier accepte deux valeurs pendant la transition.
  - (c) Désactiver un Prestataire dans l'admin est la procédure d'urgence. Une rafale d'anomalies (seuil à fixer) apparaît en tête du tableau de bord.
  - (d) Le processus ne garde aucun état en mémoire : tout état durable est en base.

  S'il manque une valeur (seuil, cible de sauvegarde), l'inscrire en question ouverte plutôt que l'inventer.

### H-4 — Rétention et suppression des données personnelles non décidées
- **Où :** aucune section
- **Problème :** les données sont traitées en France (Hostinger) et à Paris (Supabase), donc dans le périmètre du RGPD pour l'hébergement. Il y a des Comptes mineurs, des photos de personnes, des numéros WhatsApp exportés et des téléphones dans les notifications brutes. Le spine ne fixe ni la suppression d'un Compte (que deviennent `commande`, `acces_kit`, `pass` et `journal_audit` ?), ni la durée de conservation de `notification_recue`, `evenement_mesure`, `limite_essai` et `envoi` (qui contient des données d'email), ni l'effacement des photos retirées (FR-41) dans le stockage. Chaque story choisira donc entre suppression physique, anonymisation ou rien.
- **Correction :** ajouter une AD « Données personnelles » :
  - suppression d'un Compte = anonymisation de `profil` (email et nom remplacés) et conservation des Commandes pour la comptabilité, avec une durée légale à confirmer par le juriste (Q-5) ;
  - purge par une tâche pg_cron pour `limite_essai` (24 h), `evenement_mesure` (durée à fixer), `notification_recue` et `envoi` (corps effacé après N jours, métadonnées gardées) ;
  - une photo retirée est supprimée du bucket, pas seulement masquée ;
  - l'export WhatsApp est généré à la demande et jamais stocké.

  Les durées que le PRD ne donne pas vont en questions ouvertes.

### H-5 — Sécurité web non couverte : en-têtes, CSRF des routes, exposition des routes de notification
- **Où :** AD-2, AD-5, AD-19 ; aucune ligne de convention
- **Problème :** trois points ne sont pas décidés.
  - **En-têtes de sécurité.** Rien n'est fixé (CSP avec les domaines Bunny, Supabase et Prestataires, HSTS, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`). Le premier agent qui intègre le lecteur Bunny ou une redirection K-Pay posera un en-tête différent du suivant, ou aucun.
  - **CSRF.** Les Server Actions vérifient l'origine nativement, mais les routes `src/app/api` avec cookie de session (`/api/kits/fichier/[id]`, `/api/mesure`, ainsi que les autorisations de téléversement) n'ont aucune règle.
  - **Routes de notification.** Il n'y a de règle ni sur la lecture du corps brut avant parsing (nécessaire à la vérification de signature), ni sur le code de réponse (200 seulement après un traitement durable, sinon 5xx pour que le Prestataire réessaie), ni sur une limite de débit, ni sur le refus d'un `[prestataire]` inconnu. `/api/mesure` est ouverte et sans limitation (AD-22 ne la liste pas) : on peut y injecter des données qui fausseront les indicateurs du §7.
- **Correction :** ajouter une ligne de convention « Sécurité HTTP » :
  - en-têtes posés uniquement dans `next.config.ts` (`headers()`), avec une CSP en liste d'autorisation tenue dans `src/lib/securite/csp.ts` ;
  - toute route `api` à effet vérifie `Origin` contre l'URL du site, sauf les routes de notification et de cron.

  Compléter AD-5 : corps brut lu avant parsing ; `[prestataire]` validé contre l'enum ; notification enregistrée dans `notification_recue` avant traitement ; 200 seulement après commit. Ajouter `/api/mesure` à AD-22, avec une clé par session et par minute.

### H-6 — Email : domaine d'envoi et DNS non décidés
- **Où :** AD-9, Stack
- **Problème :** rien ne fixe le domaine d'envoi (`komashop.com` ou un sous-domaine comme `mail.komashop.com`), l'adresse d'expédition, ni SPF, DKIM, DMARC et le domaine de retour pour Resend. Le SMTP Supabase Auth (code de connexion) doit utiliser le même domaine vérifié. On ne sait pas non plus qui gère la zone DNS (Hostinger ou autre). Sans ces choix, les codes de connexion partiront en indésirables et le parcours de paiement sera bloqué. Deux stories (Auth et `envois`) peuvent aussi configurer deux expéditeurs différents.
- **Correction :** ajouter à AD-9 :
  - envoi depuis `<sous-domaine>.komashop.com`, vérifié dans Resend (SPF, DKIM et DMARC avec `p=none` au départ) ;
  - un seul expéditeur transactionnel et un seul expéditeur commercial, définis dans `src/lib/env.ts` ;
  - SMTP Supabase Auth sur le même domaine ;
  - la zone DNS est gérée chez [à confirmer, question ouverte].

### H-7 — Une annulation partielle ne peut pas s'exprimer avec un statut par Commande
- **Où :** AD-3 (matrice), FR-25 (« Commande mixte : seul le Cosplay est annulé ; le Kit reste »)
- **Problème :** la matrice ne porte qu'un statut par Commande. Une Commande mixte (Cosplay et Kit) dont on annule le Cosplay ne peut ni passer `annulee` (le Kit reste dû et livré), ni rester `payee` (le stock doit être libéré et le Forfait rendu). Le cas d'une Commande avec un article en stock et un article à fabriquer n'est pas réglé non plus (`payee → expediee` ou `en_fabrication` ?). Le passage `payee → livree` « automatique » d'une Commande 100 % numérique n'est rattaché à aucune fonction, et `offerte → livree` contredit la phrase « une Commande de type `pass` reste `payee` ou `offerte` ». Chaque story inventera sa solution.
- **Correction :** décider explicitement l'une des deux options.
  - (a) Une Commande `produits` ne contient qu'un seul Produit physique ou que des Kits, ce qui demande l'accord du PM.
  - (b) Un statut d'annulation et de remise au niveau de `ligne_commande` (`active`, `annulee`, `remboursee`), le statut de la Commande étant dérivé par une règle écrite.

  Indiquer que `confirmer_paiement` et `offrir_commande` passent elles-mêmes une Commande 100 % Kit à `livree`, et préciser que les Commandes `pass` sont exclues de ce passage.

### H-8 — Écart entre documents sources : le guide et le PRD contredisent le spine
- **Où :** `docs/guide-koma-shop.md` lignes 299 et 365 ; PRD NFR-4 ; spine AD-11 et AD-18
- **Problème :** le guide est la « source de vérité métier » selon CLAUDE.md. Or :
  - à la ligne 299, il dit encore « Les fichiers de kit et les vidéos complètes sont dans le bucket privé kits-private » ;
  - à la ligne 365, il nomme le bucket `products-public`, alors que le spine dit `produits-public` ;
  - la NFR-4 du PRD place aussi les vidéos dans `kits-private`.

  Un agent qui lit le guide ou le PRD créera le mauvais bucket ou rangera les vidéos dans Supabase.
- **Correction :** corriger les lignes 299 et 365 du guide et la NFR-4 du PRD (ou ajouter au PRD une note de changement qui renvoie à AD-11 et AD-18). Ajouter au spine une ligne « Ce spine remplace NFR-4 sur l'emplacement des vidéos ».

---

## Moyenne

### M-1 — Enums de Tentative, Envoi, Demande et Verrou non fixés
- **Où :** AD-14
- **Problème :** AD-14 fixe les statuts de Commande et de Pass. Il ne fixe pas ceux de `tentative_paiement` (AD-5 cite seulement `en_cours`), `envoi` (`envoye` et `echec` sont cités, mais pas l'état initial), `demande_client` (type et statut), `photo_galerie`, `trop_percu` et `anomalie`. Ce sont des points de divergence directs entre les stories `paiement`, `envois` et `admin`.
- **Correction :** lister les enums dans AD-14. Par exemple : Tentative `en_cours`, `reussie`, `echouee`, `abandonnee` ; Envoi `a_envoyer`, `envoye`, `echec`, `abandonne` ; Demande `annulation_commande`, `annulation_pass`, `reclamation` × `ouverte`, `acceptee`, `refusee` ; Photo `en_attente`, `publiee`, `retiree` ; Trop-perçu `a_rembourser`, `rembourse`.

### M-2 — Liste des fonctions « noms fixés » incomplète et incohérente
- **Où :** AD-3, AD-10, AD-12, AD-15, AD-22
- **Problème :** AD-3 nomme `expirer_commande`, alors qu'AD-10 nomme `expirer_commandes_echues`. Plusieurs fonctions ne figurent pas dans la liste : `supprimer_acces_benevoles_echus`, `fusionner_panier`, `consommer_essai` et `places_evenement_utilisees`. La réclamation et le remplacement (FR-26), la validation de photo et de Réalisation (FR-41, FR-42), la correction d'adresse (FR-24) et la libération forcée du verrou n'ont aucune fonction. Il n'existe pas non plus de fonction unique de disponibilité (stock et Plafond de fabrication), alors que la Capacité en a une.
- **Correction :** remplacer la liste par un tableau « Fonctions Postgres » (nom, module, appelant, effets). Ajouter `disponibilite_variante(variante)` comme seule source de « En stock / Fabrication sur commande / Commandes complètes », utilisée par la fiche, `creer_commande` et `confirmer_paiement`. Préciser si le Plafond de fabrication est global ou propre à chaque produit (FR-51 laisse entendre qu'il est global). Préciser aussi que `places_evenement_utilisees` compte les Pass émis plus les réservations des Commandes `pass` `en_attente`.

### M-3 — Identité d'appel des fonctions de transition non fixée
- **Où :** AD-2, AD-3
- **Problème :** le service appelle-t-il les fonctions avec le client service role, en passant `compte` en paramètre, ou avec le client de session, la fonction lisant `auth.uid()` ? Les deux styles coexisteront, ce qui produira des contrôles d'appartenance faits tantôt en SQL, tantôt en TypeScript.
- **Correction :** une seule règle : « Les fonctions de transition sont appelées par le client service role. L'auteur (`compte` ou `systeme:<tache>`) est passé en paramètre explicite et sert au `journal_audit`. Le contrôle "ce Compte possède cette Commande" est fait dans la fonction. »

### M-4 — Pagination par curseur décidée mais absente du spine
- **Où :** Deferred (« la pagination serveur par curseur est fixée (C5) ») ; Consistency Conventions
- **Problème :** la décision C5 du memlog n'apparaît que dans une colonne de justification du tableau Deferred. Un agent qui lit les conventions ne la trouvera pas.
- **Correction :** ajouter une ligne de convention « Listes : pagination par curseur (keyset sur `(cree_le, id)`), taille de page fixée par module ; jamais `OFFSET` ».

### M-5 — Variante de Kit et lien vers Polar non décidés
- **Où :** diagramme ER (`ligne_commande }o--o| variante`), AD-5, AD-6
- **Problème :** une ligne de commande pointe vers une `variante`, mais un Kit n'a pas de taille. Le Kit a-t-il une variante unique, ou la ligne pointe-t-elle vers `produit` ? Côté Polar, il faut savoir comment le paiement d'un Kit est représenté (produit Polar par Kit, prix ad hoc, checkout créé à la volée), et où est rangé l'identifiant Polar. Deux stories (catalogue et adaptateur Polar) peuvent diverger.
- **Correction :** « Tout Produit a au moins une Variante ; un Kit en a exactement une. » Ajouter à AD-5 : « La correspondance Kit ↔ objet Polar est stockée dans `variante.polar_produit_id` (rempli seulement pour un Kit, contrainte `CHECK` sur la Famille). » Si la doc Polar n'est pas encore lue, inscrire ce point en question ouverte.

### M-6 — Concurrence des tâches cron et idempotence des emails
- **Où :** AD-9, AD-10
- **Problème :** « rejouable sans double effet » ne couvre pas deux exécutions simultanées : un lot qui dure plus d'une minute alors que pg_cron relance le suivant. Côté Resend, si l'envoi réussit mais que la mise à jour de `envoi` échoue, l'email part deux fois.
- **Correction :** « Chaque route cron prend son lot avec `FOR UPDATE SKIP LOCKED` (ou un verrou consultatif par tâche). Chaque appel Resend porte la clé d'idempotence `envoi.id`. »

### M-7 — Envoi de photo par le client non couvert par la règle de téléversement
- **Où :** AD-2, AD-18 ; FR-40
- **Problème :** AD-18 ne décrit que les téléversements de l'admin. Pour une photo envoyée par un client depuis son Compte, rien ne dit si elle passe par le serveur Hostinger (RAM partagée) ou par une URL signée. Il n'y a pas non plus de contrôle de type, de poids ni de suppression des métadonnées EXIF (la géolocalisation est sensible pour un Compte mineur).
- **Correction :** étendre AD-18 : « Le client envoie sa photo par une URL de téléversement signée vers `galerie-attente`, créée par le serveur après `consommer_essai`. Types acceptés : JPEG, PNG et WebP ; taille maximale à fixer. Les métadonnées EXIF sont retirées à la validation, avant la copie vers `produits-public`. »

### M-8 — Budgets de performance absents
- **Où :** AD-17, AD-18 ; NFR-2
- **Problème :** NFR-2 (héros en moins de 2,5 s en 4G, Lighthouse mobile ≥ 90, Core Web Vitals au vert) n'est rattaché à aucune règle vérifiable. Rien ne limite le JavaScript client ni le poids des images, et aucune vérification n'est prévue en CI. Sur une instance unique avec 3 Go de RAM partagés, la génération de PDF filigranés et `sharp` ne sont bornés par rien.
- **Correction :** ajouter une convention « Performance » :
  - budget JS client par page publique, à fixer (par exemple 150 Ko gzip) ;
  - image du héros en `priority` et poster AVIF ou WebP ;
  - Lighthouse CI sur l'accueil en `/fr`, en contrôle non bloquant au départ ;
  - au plus N filigranes générés en parallèle (file en base), le reste servi au téléchargement suivant.

### M-9 — Contenu de la liste hors ligne incompatible avec FR-35
- **Où :** AD-12
- **Problème :** la liste hors ligne ne contient que des empreintes SHA-256, alors que FR-35 exige d'afficher le nom, l'Événement et le Type de pass au Scan, ce qui est impossible hors ligne avec des empreintes seules. Par ailleurs, l'empreinte d'un code court de 8 caractères pris dans un alphabet réduit se retrouve par force brute en peu de temps si l'appareil est perdu.
- **Correction :** préciser que la liste contient l'empreinte, le nom du titulaire et le Type de pass (et pas l'email ni le téléphone). Utiliser des empreintes HMAC avec une clé propre au Verrou, renvoyée par `prendre_verrou` et invalidée par `liberer_verrou`.

### M-10 — Ordre entre migration et déploiement non fixé
- **Où :** AD-20
- **Problème :** la règle « appliquée par la Supabase CLI » ne dit ni qui l'applique, ni quand par rapport à l'avance de `production`. Si Hostinger reconstruit le site avant que la migration soit appliquée, le site plante ; si c'est l'inverse avec une migration destructive, l'ancien code plante.
- **Correction :** « La migration est appliquée en production (`supabase db push`) avant l'avance rapide de `production`. Les migrations sont rétrocompatibles avec le code en ligne : une colonne n'est supprimée que dans une migration ultérieure, après déploiement. Les types de `src/lib/supabase/types.ts` sont générés depuis la base locale de la CI. »

### M-11 — Format des modèles d'email non choisi
- **Où :** AD-9, AD-16
- **Problème :** la technologie des modèles n'est pas choisie (React Email, HTML dans le dépôt, modèles Resend). On ne sait pas non plus où vivent les textes des emails (dans `messages/*.json` ou non).
- **Correction :** fixer « Modèles dans `src/modules/envois/modeles/<modele>.tsx` (React Email), textes dans `messages/*.json` sous la clé `emails.<modele>` ».

---

## Basse

- **B-1 — Coquille dans le diagramme de contexte.** Le nœud `H` porte « Hostinger : Next.js 24 (France) ». Correction : « Hostinger : Next.js 16, Node 24 (France) ».
- **B-2 — Diagramme d'états incohérent.** `offerte --> livree : automatique (Kit gratuit)` ne s'applique pas aux Commandes `pass` offertes (FR-42). Ajouter la condition « Commande `produits` uniquement ».
- **B-3 — Versions de la stack.**
  - `pdf-lib` 1.17.1 n'a plus de version publiée depuis 2021. Le choix reste plausible, mais il vaut mieux le noter comme dépendance figée ou évaluer `@cantoo/pdf-lib` (fork maintenu).
  - « TypeScript 5.x (version livrée par le starter) » n'est pas une version épinglée : l'épingler comme les autres.
  - Vitest 5 et Zod 4.6 sont cohérents avec le memlog (versions vérifiées le 2026-10-17) ; un autre relecteur vérifie les versions.
- **B-4 — Formulaire de contact sans destination.** FR-4 et AD-22 ne disent pas où va le message de contact : table `demande_client`, email à Jonathan via `envoi`, ou les deux. Le préciser.
- **B-5 — Questions d'accueil (FR-12) sans stockage.** Les trois réponses alimentent FR-54 et FR-59, mais aucune table n'est prévue. Indiquer `profil` (colonnes) ou `consentement`/`profil_preference`.
- **B-6 — « Le jour de l'Événement » sans fuseau.** Pour AD-13, préciser que le jour se calcule en `Africa/Lubumbashi` (de 00:00 à 23:59 heure de Goma) et le vérifier en base.
- **B-7 — Réponse des routes API non normalisée.** Les Server Actions ont un format de réponse, pas les routes `api`. Ajouter : « JSON `{ ok, code }` et code HTTP cohérent ; jamais de message d'erreur brut ».
- **B-8 — Frontmatter du memlog.** Le memlog indique `altitude: initiative` en tête, puis le corrige en `feature` à la fin. Aligner le frontmatter pour éviter toute confusion à la reprise.
- **B-9 — Diagrammes mermaid.** Ils sont tous syntaxiquement valides (`flowchart`, `stateDiagram-v2`, `erDiagram`). Le diagramme ER ne relie pas `commande` à `evenement` pour une Commande `pass` : ce n'est pas bloquant, mais cela aiderait.

---

## Points conformes

- La carte des capacités couvre les FR-1 à FR-59 et les NFR. FR-58, FR-59 et FR-3 sont bien rattachés.
- AD-6, avec sa fonction pure unique et sa matrice explicite, ferme bien les règles 10 et 11 de CLAUDE.md.
- AD-8 (centimes et montants figés), AD-15 (Panier en base) et AD-22 (une seule fonction de limitation) sont des règles applicables et efficaces.
- Le tableau Deferred ne contient pas de point de divergence réel. Seule la ligne « pagination » cache une décision prise (M-4), et la ligne « Supervision externe » est acceptable à condition que H-3 donne une procédure d'incident.
- Le document s'en tient aux décisions et contient peu de justifications. Les seules justifications se trouvent dans « Prevents » et dans la colonne « Pourquoi » de Deferred, ce qui est attendu.
