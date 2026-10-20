---
type: review
target: ARCHITECTURE-SPINE.md (architecture-KOMA SHOP-2026-10-17, updated 2026-10-20)
lens: réconciliation spine ↔ EXPERIENCE.md / DESIGN.md / CLAUDE.md règles 1-15
date: 2026-10-20
sources:
  - ../ARCHITECTURE-SPINE.md
  - ../.memlog.md
  - ../../../ux-designs/ux-KOMA SHOP-2026-10-16/EXPERIENCE.md
  - ../../../ux-designs/ux-KOMA SHOP-2026-10-16/DESIGN.md
  - CLAUDE.md (version de travail non commitée : Hostinger, Bunny Stream)
---

# Réconciliation spine ↔ UX et règles du projet

## Verdict

**Le spine n'est pas prêt à servir de socle aux stories sans retouches.** Le noyau transactionnel (AD-3 à AD-8) est solide et fidèle aux règles 2, 3, 9, 10 et 11. En revanche :

- **1 contradiction critique** avec la règle 2 de `CLAUDE.md` : la réconciliation planifiée peut, telle qu'écrite, passer une Commande en `payee` sans Notification.
- **2 contradictions hautes** avec des décisions UX tranchées : l'annulation partielle d'une Commande mixte (E-28) et le repli, qui doit être déclenché par le client.
- **Une dizaine d'exigences techniques** posées par EXPERIENCE.md et DESIGN.md ne sont pas fixées. Sur ces points, deux équipes pourraient construire des solutions différentes. Les plus risqués : le thème appliqué avant le premier rendu alors que les pages sont en cache, la page de retour après paiement, la clé d'idempotence, la lecture vidéo HLS sur Android et la police Sakura Town (fichier de démo déjà commité dans un dépôt public).

Échelle : **Critique** = contredit une règle 1-15 ; **Haute** = contredit une décision UX tranchée, ou deux équipes divergeraient sur un point de sécurité, d'argent ou de confiance ; **Moyenne** = divergence probable avec un coût de reprise ; **Basse** = précision utile.

## Synthèse

| # | Sév. | Sujet | AD touchée |
|---|---|---|---|
| R-1 | Critique | La réconciliation planifiée peut poser `payee` sans Notification (règle 2, FR-20) | AD-4, AD-5, AD-10 |
| R-2 | Haute | Commande mixte : annulation du Cosplay seul (E-28) non modélisée | AD-3 |
| R-3 | Haute | Le repli doit être une action explicite du client et exclure les Agrégateurs déjà en échec | AD-5, AD-6 |
| R-4 | Haute | Page de retour après paiement : ignorer `?status=`, vérifier le propriétaire, gérer un retour en POST ou sans session | absent |
| R-5 | Haute | Clé d'idempotence du lancement de paiement et « Tentative en cours retrouvée » | AD-5 |
| R-6 | Haute | Pages en cache, contenu propre à chaque visiteur (thème, bandeau, Kit possédé) et JSON-LD `availability` : mécanisme non fixé | AD-17 |
| R-7 | Haute | Thème appliqué avant le premier rendu, et préférences du visiteur | absent |
| R-8 | Haute | Lecture HLS (héros public, lecteur de kit privé) : lecteur propre ou lecteur Bunny, Android sans HLS natif | AD-11, AD-18 |
| R-9 | Haute | Sakura Town : licence, hébergement, repli ; fichier de démo déjà dans le dépôt public | absent |
| R-10 | Moyenne | Sondage de l'Écran d'attente : point d'accès, annonces, arrêt, hors ligne | AD-10 |
| R-11 | Moyenne | « Montant modifié » : reconfirmation imposée par le serveur | AD-8 |
| R-12 | Moyenne | Commande expirée et « rien n'est ressaisi » : sort du Panier et des champs saisis | AD-15 |
| R-13 | Moyenne | Transitions admin : une seule source (actions absentes, désactivées avec leur raison) | AD-3 |
| R-14 | Moyenne | Libellés client des statuts (« Prête à retirer », « Offert ») : une seule correspondance | AD-14 |
| R-15 | Moyenne | Couverture : statut « À vérifier », source, et usage par l'aiguillage | AD-6 |
| R-16 | Moyenne | Téléversement de photos par les clients : dérogation AD-2, limites, reprise | AD-2, AD-18 |
| R-17 | Moyenne | Réglage sans valeur : blocage, jamais de valeur par défaut | Conventions |
| R-18 | Moyenne | États client hors ligne (hors Scan) | absent |
| R-19 | Moyenne | Scan : décodage du QR non choisi | AD-12, Stack |
| R-20 | Moyenne | Code QR dans l'email du Pass : image jointe ou URL | AD-9, AD-12 |
| R-21 | Basse | Pass : nom de la transition `annule → rembourse` absent | AD-3 |
| R-22 | Basse | K-Pay carte coupé : cas absent de la matrice de l'aiguillage | AD-6 |
| R-23 | Basse | Performance du héros (< 2,5 s) et détection du réseau lent | AD-18 |
| R-24 | Basse | Échéance « À payer avant [heure] » : colonne figée et fuseau affiché | AD-23 |
| R-25 | Basse | axe-core absent de la Stack ; vérification publication centralisée ; message admin « email en file » | Stack, AD-9 |

---

## Détail

### R-1 — Critique — La réconciliation peut poser `payee` sans Notification

- **Sources :** CLAUDE.md règle 2 (« Seules les routes serveur de notification de paiement […] passent une commande en paid ») ; EXPERIENCE.md State Patterns › Paiement « Payée : affichée seulement après Notification de paiement vérifiée (FR-20) » ; spine AD-5 (« la tâche `reconcilier-tentatives` interroge `consulterStatut` chaque minute »), AD-10 et memlog E.
- **Écart :** le spine ne dit pas ce que fait `/api/cron/reconcilier-tentatives` quand `consulterStatut` renvoie `succes`. Un développeur appellera naturellement `confirmer_paiement` : une Commande deviendrait `payee` par une route de tâche planifiée, pas par la route de notification. La règle 2 ne le permet pas aujourd'hui, même si elle parle de « contre-vérification auprès du prestataire ».
- **Proposition, au choix de Jonathan (règle 15 : demander) :**
  - (a) **Strict.** La réconciliation ne pose jamais `payee`. Sur `succes`, elle crée une `anomalie` « succès sans notification » visible dans l'admin, et la Tentative reste `en_cours`. Sur `echec_*` confirmé ou à la fin du Délai de paiement, elle peut appeler `echouer_tentative` ou `expirer_commande`.
  - (b) **Assoupli.** La réconciliation peut appeler `confirmer_paiement`. Il faut alors **réécrire la règle 2 de `CLAUDE.md`**, avec l'accord écrit de Jonathan, et mettre à jour FR-20 et la phrase « Payée… seulement après Notification ».
  - Dans les deux cas, ajouter à AD-4 : « `confirmer_paiement` n'est appelée que par `POST /api/paiement/notification/[prestataire]`[, et par `reconcilier-tentatives` si (b)] ». Ajouter aussi un test Vitest qui vérifie qu'aucun autre appelant n'existe (recherche dans le code ou liste d'appelants autorisés).

### R-2 — Haute — Commande mixte : annulation partielle (E-28)

- **Sources :** EXPERIENCE.md Tranchées E-28 (« Commande mixte : seul le Cosplay est annulé ; Kit conservé et non remboursé ; Forfait rendu ») ; Transitions manuelles `payée → annulée` ; spine AD-3 (`payee --> annulee : annuler_commande (Cosplay non commencé)`) et AD-8.
- **Écart :** dans AD-3, le statut et l'annulation portent sur toute la Commande. Pour une Commande mixte, passer `annulee` puis `remboursee` contredit E-28 : le Kit reste ouvert (AD-11 garde l'`acces_kit`), mais le montant à rembourser n'est pas le total. Rien ne fixe non plus le montant remboursé (prix du Cosplay + Forfait, moins une part de la réduction ?). Deux équipes divergeraient sur le statut d'une Commande mixte annulée et sur le calcul du remboursement.
- **Proposition :** compléter AD-3 et AD-8.
  - `annuler_commande` porte sur les **lignes physiques non commencées**. Une Commande mixte annulée passe `annulee` avec un `montant_a_rembourser_cents` figé : lignes annulées + Forfait, avec une règle de répartition de la réduction **à faire trancher par Jonathan**.
  - La ligne Kit garde son `acces_kit` et `ligne_commande.annulee = false`.
  - Ou bien : un statut par ligne (`ligne_commande.statut`). À décider explicitement.
  - Ajouter un test : « Commande mixte annulée → Kit toujours accessible, remboursement = lignes physiques + Forfait ».

### R-3 — Haute — Repli : action du client, Agrégateurs déjà en échec exclus

- **Sources :** EXPERIENCE.md Paiement & confiance (« Repli : proposé, jamais automatique sans action du client ») ; State Patterns « Échec confirmé… Réessayer avec {Agrégateur suivant} ? » et « Plus aucun service pour cet opérateur » ; spine AD-5 et AD-6.
- **Écart :**
  - AD-5 dit « Repli vers l'Agrégateur suivant seulement sur `echec_prestataire` », sans préciser que le repli **attend un toucher du client**. Un développeur pourrait relancer `initier` automatiquement dans la route de notification.
  - La signature `choisirPrestataire(achat, moyen, pays, operateur, prestatairesActifs, couverture, ordre)` ne reçoit pas les **Agrégateurs déjà en échec pour cette Commande**. Elle ne peut donc ni proposer « le suivant » ni détecter « plus aucun service ».
- **Proposition :**
  - Ajouter le paramètre `exclus: Prestataire[]` (Agrégateurs dont une Tentative de cette Commande a fini en `echec_prestataire`).
  - Résultat : `{ prestataire } | { aucun: 'non_couvert' | 'tous_en_echec' | 'carte_indisponible' }`.
  - Règle : « aucune route serveur n'appelle `initier` sans une action explicite du client (Server Action de lancement) ; la notification et la réconciliation ne relancent jamais ».
  - Tests : « repli non déclenché sans action du client » ; « `tous_en_echec` quand tous les Agrégateurs du couple ont échoué ».

### R-4 — Haute — Page de retour après paiement

- **Sources :** EXPERIENCE.md Component « Page de retour après paiement » (ignorer `?status=…`, lire le serveur par numéro de Commande, vérifier que la Commande appartient au Compte connecté) ; Paiement & confiance ; CLAUDE.md règle 2.
- **Écart :** le spine ne fixe ni la route, ni le paramètre, ni le contrôle d'appartenance. Il ne dit pas non plus quoi faire quand :
  - le Prestataire revient en **POST** : le cookie de session `SameSite=Lax` n'est pas envoyé sur un POST venu d'un autre site, donc le client paraît déconnecté ;
  - le paiement par carte s'ouvre dans un **autre navigateur** que le navigateur intégré, où le client n'a pas de session.
- **Proposition :** ajouter une AD ou une ligne de convention.
  - Route `app/[locale]/commande/[numero]/retour/page.tsx`, rendue à chaque requête. Elle lit `commande`, la dernière `tentative_paiement` et un éventuel `trop_percu` par `queries.ts`, avec la session de l'utilisateur (la RLS fait le contrôle d'appartenance). Les paramètres de recherche sont ignorés.
  - URL de retour transmise au Prestataire : `/{locale}/commande/{numero}/retour`, sans statut.
  - Si un Prestataire revient en POST : une route `app/api/paiement/retour/[prestataire]/route.ts` répond `303` vers la page en GET et ne lit aucun statut.
  - Sans session : connexion, puis retour validé (AD-24). Aucun état n'est révélé avant la connexion.
  - Commande d'un autre Compte : 404.

### R-5 — Haute — Clé d'idempotence et Tentative retrouvée

- **Sources :** EXPERIENCE.md State Patterns « Paiement lancé » (« La requête porte une clé d'idempotence (à confirmer par l'architecte) »), « Tentative en cours retrouvée », « Changement de moyen pendant une Tentative » ; spine AD-5 (index unique partiel).
- **Écart :** l'index unique empêche deux Tentatives en base. Rien ne dit en revanche :
  - comment un double toucher, ou un second onglet, retrouve la Tentative existante au lieu de recevoir une erreur ;
  - quelle clé est transmise au Prestataire pour qu'une relance réseau n'envoie pas **deux demandes de paiement** au téléphone (PawaPay, par exemple, utilise un identifiant de dépôt fourni par le marchand).
- **Proposition :** compléter AD-5.
  1. La Server Action `lancerPaiement` reçoit une `cle_idempotence` (UUID généré au rendu du Récapitulatif).
  2. `demarrer_tentative` est idempotente sur `(commande, cle_idempotence)`. Si une Tentative `en_cours` existe déjà, elle renvoie cette Tentative (code `KS_TENTATIVE_EN_COURS` + identifiant), jamais une seconde.
  3. `tentative_paiement.id` sert d'identifiant ou de référence marchande transmis à `initier`, quand le Prestataire le permet (d'après sa documentation).
  4. Toute page de paiement lit d'abord la Tentative `en_cours` côté serveur. Si elle existe, la page affiche l'Écran d'attente et ne rend pas les Cartes de moyen de paiement.

### R-6 — Haute — Cache des pages publiques, contenu propre au visiteur, JSON-LD

- **Sources :** spine AD-17 (« pages publiques […] mises en cache » ; disponibilité, Panier, Compte « rendus à chaque requête ») ; EXPERIENCE.md Foundation (JSON-LD Product/Offer avec `availability` réelle), « Kit déjà possédé » sur la Fiche Kit, pied de page « liste lue côté serveur (Prestataires actifs) », Filtres reflétés dans l'URL, Badge de disponibilité sur les cartes.
- **Écart :** le spine ne dit pas **comment** une page en cache contient des parties calculées à chaque requête. Avec Next 16, plusieurs options existent : Cache Components (`"use cache"` + `cacheTag` + `<Suspense>`), `unstable_cache`, `dynamic = 'force-dynamic'`, ou une lecture côté client. Les équipes vont se disperser, et une seule lecture de `cookies()` ou `headers()` dans un layout rend tout le site dynamique. Autres manques :
  - le **JSON-LD `availability`** se retrouve dans le HTML en cache, donc périmé ;
  - les étiquettes ne couvrent ni les Prestataires (pied de page), ni les Réglages (WhatsApp, héros), ni le stock modifié par `confirmer_paiement` ;
  - `revalidateTag` est appelé depuis une fonction Postgres, qui ne peut pas le faire.
- **Proposition :** préciser AD-17.
  - Mécanisme unique : Cache Components de Next 16 (`cacheComponents: true`). Les données publiques passent par des fonctions `queries.ts` marquées `"use cache"` + `cacheTag(...)`. Tout ce qui est propre au visiteur ou aux ventes vit dans un composant serveur sous `<Suspense>` (squelette), sans lecture de `cookies()` ou `headers()` hors de ces îlots.
  - Le JSON-LD Product/Offer est rendu **dans l'îlot dynamique**, ou bien l'étiquette `produit:<id>` est invalidée après chaque `confirmer_paiement`, annulation ou expiration qui change la disponibilité.
  - Étiquettes supplémentaires : `prestataires`, `reglages`, `galerie`.
  - Règle : « le service TypeScript qui appelle une fonction de transition invalide les étiquettes concernées après le `COMMIT` ; une tâche pg_cron qui change la disponibilité (`expirer_commandes_echues`) passe par une route `/api/cron/*` qui invalide ».
  - Vérifier la signature de `revalidateTag` et `updateTag` dans Next 16.4 et la noter dans la convention.

### R-7 — Haute — Thème avant le premier rendu et préférences du visiteur

- **Sources :** EXPERIENCE.md Foundation et Bascule de thème (« choix mémorisé, appliqué avant le premier rendu ») ; Bouton Pause du héros (« choix mémorisé ») ; Bandeau navigateur intégré (« choix mémorisé ») ; spine AD-17 (cache) et AD-24 (navigateur intégré détecté côté serveur).
- **Écart :** absent du spine. Un développeur lira le thème dans un cookie côté serveur, ce qui casse le cache (R-6). Un autre utilisera `localStorage` après l'hydratation, ce qui provoque un flash. Même risque pour la détection du navigateur intégré, utile au **bandeau** sur des pages en cache : AD-24 la place côté serveur, mais seulement pour le bouton Google.
- **Proposition :** ajouter une convention « Préférences d'affichage ».
  - Thème : `localStorage` `koma-theme` (`clair` | `sombre`), lu par un **script en ligne bloquant dans `<head>`** du layout racine. Il pose `data-theme` sur `<html>` avant l'affichage, avec `suppressHydrationWarning` sur `<html>`. Défaut : crème, sans suivre `prefers-color-scheme`, puisque EXPERIENCE fixe la crème par défaut.
  - Pause du héros et fermeture du bandeau : `localStorage`, lus côté client.
  - Bandeau « Ouvrir dans Chrome » : détection **côté client** par l'agent utilisateur, sur pages en cache. La détection côté serveur reste réservée à la page de connexion, qui n'est pas en cache (bouton Google, AD-24).
  - Une fonction unique `estNavigateurIntegre(ua)` dans `src/lib/`, partagée par les deux usages.
  - Aucun cookie de préférence lu par le serveur sur une page en cache.

### R-8 — Haute — Lecture vidéo HLS (héros et kits)

- **Sources :** EXPERIENCE.md Lecteur vidéo à chapitres (lecteur **entièrement au clavier**, piste temporelle en slider ARIA, chapitres en `<button aria-current>`, sous-titres WebVTT réglés sur la langue de l'interface, aucun bouton de téléchargement, reprise de position) ; Héros vidéo (`muted playsinline aria-hidden`, boucle, pas chargé en mouvement réduit) ; spine AD-11 et AD-18 (Bunny Stream, HLS, jeton signé).
- **Écart :** le spine ne choisit pas le lecteur. Le lecteur intégré de Bunny (iframe) ne garantit pas les exigences d'accessibilité et de chapitres d'EXPERIENCE. Chrome sur Android ne lit pas le HLS nativement, il faut donc une bibliothèque (hls.js), absente de la Stack. Le jeton Bunny doit aussi couvrir les playlists et les segments, ce qui demande une signature par répertoire. Pour le héros, une boucle courte en HLS + hls.js alourdit l'objectif de 2,5 s, alors qu'un rendu MP4 suffirait.
- **Proposition :** ajouter à AD-11 et AD-18.
  - Lecteur de kit : composant propre sur `<video>` + **hls.js** (version épinglée dans la Stack), HLS natif quand le navigateur le prend en charge. Jeton Bunny à signature de répertoire, renouvelé par `GET /api/kits/video/[id]/jeton` avant expiration. Pistes WebVTT servies par le même contrôle. Progression enregistrée par Server Action, avec un rythme fixé (par exemple toutes les 15 s et à la pause).
  - Héros : rendu **MP4 progressif** de la bibliothèque publique, sans hls.js. La photo de repli est rendue côté serveur (`next/image` prioritaire). La `<video>` n'est insérée côté client que si `prefers-reduced-motion` ne vaut pas `reduce` et que le réseau le permet (R-23).
  - Vérifier sur la documentation Bunny que les rendus MP4 et la signature de répertoire sont disponibles. Sinon, demander à Jonathan (règle 15).

### R-9 — Haute — Sakura Town : licence, hébergement, repli

- **Sources :** DESIGN.md Typography (fichier local servi par le site, `font-display: swap` avec repli métrique Barlow Condensed, bascule entière si le texte contient un caractère absent de la police, test au rendu côté serveur, licence D-1 requise avant la mise en ligne, sinon `{typography.display}` partout) ; `imports/fonts/READ THIS.txt` (« demo font is for PERSONAL USE ONLY ») ; spine AD-20 (dépôt **public**).
- **Constat :** `_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/imports/fonts/Sakura Town.otf` est **déjà suivi par git** dans `jokad312/koma`, un dépôt public. C'est une redistribution d'une police de démo. À signaler à Jonathan.
- **Écart :** le spine ne fixe ni le chargement des polices (`next/font/local` ou `@font-face`, `next/font/google` ou lien Google), ni le comportement sans licence, ni l'endroit du test de bascule.
- **Proposition :** ajouter une convention « Polices ».
  - Barlow et Barlow Condensed par `next/font/google`, auto-hébergées au build : aucun appel à Google au moment de la visite, cohérent avec AD-19.
  - Sakura Town par `next/font/local` (WOFF2 sous licence webfont), **ajoutée au dépôt seulement après l'achat de la licence D-1**. D'ici là, le rôle `display-brush` est relié à `display` (Barlow Condensed).
  - Une fonction unique `src/lib/typo/peut-utiliser-sakura.ts` (liste des 98 glyphes) est appelée au rendu serveur par le composant `TitreVitrine`.
  - Retirer le fichier de démo de l'historique, ou rendre ce dossier privé : décision de Jonathan.

### R-10 — Moyenne — Sondage de l'Écran d'attente

- **Sources :** EXPERIENCE.md Écran d'attente (une seule annonce `role="status"` par changement réel d'état, `<title>` mis à jour, indicateur statique en mouvement réduit) ; Accessibility Floor › Annonces ; spine AD-10 (3 s, bascule après 2 min).
- **Écart :** ni le point d'accès (Server Action ou route GET), ni la forme de la réponse, ni l'arrêt du sondage ne sont fixés.
- **Proposition :** ajouter à AD-10.
  - `GET /api/commande/[numero]/etat`, sans cache, avec contrôle d'appartenance (RLS). Réponse `{ etat: 'attente' | 'verification' | 'payee' | 'echec_client' | 'echec_prestataire' | 'expiree' | 'trop_percu', suivant?: nomAgregateur, version }`.
  - Le client n'annonce et ne met à jour `<title>` que lorsque `etat` change. Le sondage s'arrête sur un état final.
  - Onglet masqué : sondage suspendu, puis relecture immédiate au retour (`visibilitychange`). Hors ligne : suspendu, puis relecture à l'événement `online`.
  - La bascule en « vérification » après 2 min est **calculée par le serveur** (depuis `tentative.cree_le`), pas par une minuterie du navigateur.

### R-11 — Moyenne — « Montant modifié » et reconfirmation

- **Sources :** EXPERIENCE.md « Montant modifié » (« Le total a changé : [ancien] → [nouveau] USD », reconfirmation obligatoire) ; CLAUDE.md règle 3 ; spine AD-8.
- **Écart :** le spine ne dit pas comment le serveur détecte que le client a validé un total périmé.
- **Proposition :** dans AD-8, `creer_commande` et la Server Action de lancement reçoivent `total_affiche_cents`. Si le total recalculé diffère, l'action refuse avec `KS_TOTAL_MODIFIE` + ancien et nouveau total, sans créer de Commande ni de Tentative. Le client affiche le message et redemande la confirmation.

### R-12 — Moyenne — Commande expirée, Panier et champs conservés

- **Sources :** EXPERIENCE.md E-35 (« Reprendre mon panier : retour au Panier, champs repris, nouvelle Commande ») ; Champ de formulaire (« Rien n'est ressaisi » après un échec, une expiration ou une connexion : téléphone, opérateur, Zone, adresse) ; spine AD-15.
- **Écart :** le spine ne dit pas si `creer_commande` vide le Panier, ni où sont gardés les champs de l'Étape de commande. Sans règle, « Reprendre mon panier » ne sait pas d'où repartir.
- **Proposition :** ajouter à AD-15.
  - Le Panier est vidé **au passage `payee` ou `offerte`** (dans `confirmer_paiement`), pas à `creer_commande`. « Reprendre mon panier » reconstitue le Panier à partir des `ligne_commande` de la Commande expirée, sans aucun prix figé (AD-8).
  - Téléphone, opérateur, pays, Zone et adresse sont lus sur la dernière Commande du Compte (`adresse_remise`, `tentative_paiement`), jamais dans `localStorage`.

### R-13 — Moyenne — Transitions admin : une seule source

- **Sources :** EXPERIENCE.md Admin › Transitions manuelles autorisées (action absente si la transition n'est pas listée, `aria-disabled` + raison si elle est listée mais que la condition manque) ; State Patterns admin ; spine AD-3.
- **Écart :** la matrice existe en SQL (refus dans les fonctions). Mais l'interface doit savoir à l'avance quelles actions afficher et pourquoi certaines sont désactivées. Sans source commune, la matrice sera recopiée en TypeScript et divergera.
- **Proposition :** ajouter à AD-3 une fonction SQL `transitions_possibles(commande)`, qui renvoie `(action, autorisee, raison_code)`. Les fonctions de transition l'utilisent pour refuser, et la page admin pour n'afficher que les actions renvoyées. Même chose pour les Pass.

### R-14 — Moyenne — Libellés client des statuts

- **Sources :** EXPERIENCE.md Frise des statuts (« Retrait à Goma : `expédiée` s'affiche "Prête à retirer" » E-25 ; `offerte` → « Offert » ; étapes « Fait / En cours / À venir ») ; spine AD-14.
- **Écart :** l'affichage dépend du statut **et** du mode de remise. Le spine ne fixe ni la colonne `mode_remise` sur la Commande, ni l'endroit de la correspondance, qui est aussi utilisée par les emails (AD-9) et par l'admin.
- **Proposition :** `commande.mode_remise` (`retrait` | `livraison` | `aucun`) est figé par `creer_commande`. Une fonction unique `cleLibelleStatut(statut, mode_remise, type)` dans `modules/commande/types.ts` renvoie une clé `messages/*.json`, partagée par la Frise, Mes commandes et les modèles d'email. Aucun nouveau statut (E-25).

### R-15 — Moyenne — Couverture « À vérifier » et source

- **Sources :** EXPERIENCE.md State Patterns « Admin : Couverture non saisie » (chaque couple porte « À vérifier » et une source) ; CLAUDE.md règle 9 (« ne jamais la supposer ») ; spine AD-6.
- **Écart :** la table `couverture` n'a ni statut de vérification ni source. L'aiguillage pourrait utiliser un couple non vérifié.
- **Proposition :** `couverture(prestataire, pays, operateur, verifiee boolean, source text)`. Seuls les couples `verifiee = true` servent à `choisirPrestataire` et au sélecteur pays-opérateur. Ajouter un test.

### R-16 — Moyenne — Photos envoyées par les clients

- **Sources :** EXPERIENCE.md « Téléversement client en cours / échoué » (progression, reprise après coupure, limite et formats « fixés par l'architecture ») ; spine AD-2 (dérogations limitées à l'admin et au Scan) et AD-18 (`galerie-attente` privé ; TUS pour l'admin seulement).
- **Écart :** l'envoi de photo par un client n'entre dans aucune dérogation d'AD-2. Le faire passer par Hostinger va contre l'esprit d'AD-18 (RAM partagée). La taille maximale et les formats ne sont pas fixés.
- **Proposition :** étendre la dérogation (a) d'AD-2 au téléversement client en TUS vers `galerie-attente/<compte>/…`, sur autorisation signée créée par le serveur après `consommer_essai`. La ligne `photo_galerie` est créée par une Server Action après l'envoi. Faire fixer par Jonathan la taille maximale et les formats (règle 15). Proposer aussi de retirer les métadonnées EXIF (position GPS) avant publication, ce qui touche les Comptes mineurs (FR-40) ; à confirmer.

### R-17 — Moyenne — Réglage sans valeur

- **Sources :** EXPERIENCE.md « Admin : valeur de Réglage non fournie » (« Valeur à fixer », aucune valeur par défaut) ; CLAUDE.md règle 15 ; spine Conventions › Configuration.
- **Écart :** le spine place les Réglages en base, sans dire ce qui se passe quand l'un d'eux est vide (Délai de paiement, Forfait, frais d'annulation de Pass).
- **Proposition :** ajouter une convention. Les colonnes de `reglage` sont `NULL` par défaut, sans `DEFAULT` inventé. Toute fonction qui a besoin d'une valeur absente refuse avec `KS_REGLAGE_MANQUANT`. L'interface désactive la vente concernée avec un message, et l'admin voit « Valeur à fixer ».

### R-18 — Moyenne — États client hors ligne

- **Sources :** EXPERIENCE.md « Hors ligne » (« Pas de connexion. » ; aucune action envoyée en silence ; pendant un paiement, relecture du serveur à la reconnexion) ; spine AD-12 (le hors ligne ne concerne que le Scan).
- **Proposition :** convention « Hors ligne (hors Scan) ».
  - Un seul composant client lit `navigator.onLine` et les événements `online`/`offline`, et affiche le Message d'état.
  - Les Server Actions ne sont pas mises en file : bouton refusé avec la raison tant que l'appareil est hors ligne.
  - Aucun service worker hors de la route de Scan (déjà dans AD-12).
  - Relecture serveur à la reconnexion (R-10).

### R-19 — Moyenne — Décodage du QR au Scan

- **Sources :** EXPERIENCE.md Écran de Scan et Scan caméra refusée ; spine AD-12, Stack.
- **Écart :** aucune bibliothèque de décodage n'est choisie. `BarcodeDetector` n'existe pas sur Safari iOS. Deux équipes choisiront deux bibliothèques, ou une seule plateforme.
- **Proposition :** épingler une bibliothèque de décodage JavaScript (par exemple `jsQR` ou `@zxing/browser`, version vérifiée sur npm) dans la Stack, et la mettre dans le cache du service worker de scan.

### R-20 — Moyenne — Code QR dans l'email du Pass

- **Sources :** EXPERIENCE.md Pass (« même alt dans l'email ») ; UJ-5 (Pass par email) ; spine AD-9, AD-12 (jeton de 128 bits = secret).
- **Écart :** si le QR est servi par une URL publique contenant le jeton, le secret fuit dans les journaux et les caches. Les images en `data:` sont bloquées par Gmail.
- **Proposition :** générer le QR en PNG (`qrcode`) au moment de l'envoi et le **joindre en pièce jointe en ligne** (CID) par Resend. Ne jamais l'exposer par une URL. Vérifier la prise en charge du CID dans le SDK Resend 6.x.

### R-21 — Basse — Pass : transition `annule → rembourse`

- **Sources :** EXPERIENCE.md Admin › Pass (`valide → annulé` avec frais retenus, `annulé → remboursé` avec preuve obligatoire) ; spine AD-3 (liste des noms).
- **Proposition :** ajouter `confirmer_remboursement_pass(pass, preuve)` à la liste, ou étendre explicitement `confirmer_remboursement`. Les frais retenus sont lus dans `reglage` et figés sur le Pass.

### R-22 — Basse — K-Pay carte coupé dans la matrice

- **Sources :** EXPERIENCE.md « Carte indisponible pour ce panier » (aucune substitution, même si K-Pay est coupé) ; CLAUDE.md règle 10 ; spine AD-6.
- **Proposition :** écrire dans la matrice « carte + Pass, ou au moins un Produit physique : K-Pay **s'il est actif**, sinon `carte_indisponible` ; jamais Polar ». Ajouter le test « K-Pay inactif + Panier mixte → aucune carte ».

### R-23 — Basse — Performance du héros et réseau lent

- **Sources :** EXPERIENCE.md Héros (affiché en < 2,5 s, photo de repli), Interaction Primitives (critère de réseau lent [HYPOTHÈSE]) ; NFR-2 ; spine AD-18.
- **Proposition :** la photo du héros est rendue côté serveur par `next/image` avec `priority` (préchargée, `fetchPriority="high"`). La vidéo n'est jamais préchargée. Critère de réseau lent : `navigator.connection.saveData` ou `effectiveType` dans `slow-2g | 2g | 3g`, sinon vidéo autorisée (l'API est absente sur Safari). Mesure `chargement_heros` envoyée par AD-19.

### R-24 — Basse — Échéance de paiement et fuseau

- **Sources :** EXPERIENCE.md « À payer avant [heure] » (texte statique lu du serveur) ; spine AD-23.
- **Proposition :** `commande.echeance_paiement timestamptz` est figée par `creer_commande` depuis le Réglage. L'affichage précise le fuseau (« heure de Goma ») pour les clients à l'étranger (UJ-3).

### R-25 — Basse — Divers

- **Accessibility Floor :** « axe-core sans violation (tests e2e) ». Ajouter `@axe-core/playwright` (version vérifiée) à la Stack.
- **Publication refusée (liste des manques) :** une seule fonction `manques_publication(produit)` en SQL ou dans `service.ts`, qui vérifie prix, photo, alt, fichier de Kit, sous-titres FR et EN si le Kit est vendu sur `/en`, et `*_fr`/`*_en`. Elle sert au refus et à l'affichage.
- **Message après une transition admin :** l'écran dit « email programmé » tant que `envoi.statut` ne vaut pas `envoye`, jamais « email envoyé » au moment de la transition (règle 13, AD-9).

## Points vérifiés sans écart

- Aiguillage carte/Polar (AD-6) conforme aux règles 10 et 11 ; il est même plus strict pour les Pass (jamais Polar, accord écrit absent).
- Une seule porte vers `payee`, `UNIQUE (prestataire, reference)`, Trop-perçu et montant insuffisant (AD-4) : conformes à la règle 2 et aux États Paiement d'EXPERIENCE.
- `inconnu` n'est jamais un échec, et il n'y a pas de repli sur délai (AD-5) : conforme à FR-17 et FR-20.
- Contenus payants (AD-11) : conformes à la règle 1, version réécrite pour Bunny.
- Valeurs E-9 (3 s, 2 min) et E-34 (10 min, 60 s) fixées par AD-10 et AD-24.
- E-30 (aucun recul de statut) : conforme à AD-3.
- Mesure maison (AD-19) : aucun outil tiers, conforme à la règle 14.
- MaishaPay et GeniusPay renvoyés en Deferred jusqu'à la lecture de leur documentation : conforme à la règle 15, sans contredire la règle 9.
