---
type: review
lens: adversarial (paires d'unités incompatibles)
target: '../ARCHITECTURE-SPINE.md'
date: '2026-10-20'
verdict: 'Spine solide sur le paiement et l''aiguillage, mais pas encore constructible story par story : 5 trous critiques et 8 hauts à fermer avant la création des epics.'
---

# Revue adverse — ARCHITECTURE-SPINE KOMA SHOP

## Méthode

Pour chaque trou : deux unités (stories construites séparément, une par session, par un agent Dev), chacune respectant **toutes** les AD à la lettre, qui produisent pourtant un système incohérent (forme de données différente, deux propriétaires, deux chemins de mutation, deux définitions d'un même compteur). Chaque trou se ferme par une AD nouvelle ou resserrée, dont le texte est proposé tel quel. Le spine n'a pas été modifié.

## Verdict

Les AD-4 à AD-6 (porte unique vers `payee`, port sans état, aiguilleur pur) sont bonnes et ferment déjà les incompatibilités les plus coûteuses. Les trous restants viennent de quatre motifs récurrents :

1. **Compteurs nommés mais non définis** (Plafond de fabrication, stock disponible, Capacité, premier achat, plafond du Code promo) : AD-12 a résolu la Capacité par une fonction SQL unique ; le même traitement manque partout ailleurs, et même la Capacité laisse ouverte la question des Commandes `en_attente`.
2. **Statut au niveau Commande alors que la réalité est au niveau ligne** (Commande mixte, annulation partielle, remboursement partiel, commission).
3. **Contradiction AD-1 / AD-3** : `confirmer_paiement` écrit dans six tables de cinq modules, alors qu'AD-1 dit « seul le propriétaire écrit ».
4. **Énumérations et formes laissées implicites** (statuts de Tentative, d'Envoi, de `demande_client`, modèles d'email, `journal_audit`, `anomalie`, Mesures).

Il faut aussi noter un trou de sécurité qui est aussi un trou de cohérence : rien ne dit qui a le droit d'**exécuter** les fonctions `SECURITY DEFINER`, ni comment elles connaissent leur auteur.

## Tableau de synthèse

| # | Gravité | Trou | Unités en conflit | AD à créer ou resserrer |
| --- | --- | --- | --- | --- |
| C-1 | critique | Droit d'exécuter les fonctions de transition et identité de l'auteur | Tableau de bord admin ↔ Remise et suivi (et toute story admin) | AD-3 resserrée + AD-25 |
| C-2 | critique | Stock disponible, réservation et Plafond de fabrication : aucun compteur défini | Fiche produit + disponibilité ↔ Création de commande ↔ Notification PawaPay | AD-26 |
| C-3 | critique | Commande mixte : statut, annulation, montant remboursé, commission | Annulation cosplay ↔ Codes promo + commission ↔ Remise et suivi | AD-27 |
| C-4 | critique | `acces_kit` en double fait échouer `confirmer_paiement` | Kit gratuit ↔ Notification PawaPay ↔ Bibliothèque | AD-11 resserrée |
| C-5 | critique | Expiration contre paiement tardif, réponse de la route de notification, statuts de Tentative | Notification PawaPay ↔ Tâche d'expiration ↔ Réconciliation | AD-5 resserrée + AD-28 |
| H-1 | haute | « Premier achat » et plafond du Code promo comptés deux fois différemment | Création de commande ↔ Notification PawaPay ↔ Codes promo + commission | AD-29 |
| H-2 | haute | Capacité : Commandes `en_attente`, Pass annulés, Pass offerts | Achat de pass ↔ 10 pass gratuits ↔ Annulation de pass | AD-12 resserrée |
| H-3 | haute | Qui pose `livree` pour une Commande numérique, et quels emails partent | Notification PawaPay ↔ Kit gratuit ↔ Emails | AD-3 resserrée |
| H-4 | haute | RLS de lecture publique, brouillons, colonnes privées et client utilisé par le cache | Fiche produit ↔ Admin catalogue ↔ Bibliothèque | AD-30 |
| H-5 | haute | Annulation de Pass : propriétaire de la demande, fonction de remboursement, forme de la preuve | Annulation de pass ↔ Annulation cosplay ↔ Trop-perçus | AD-31 |
| H-6 | haute | Journalisation des écritures admin qui ne sont pas des transitions | Remise et suivi (adresse, suivi) ↔ Admin catalogue (prix) ↔ Mesures | AD-3 / AD-13 resserrées |
| H-7 | haute | AD-1 contredit AD-3 : qui possède et modifie `confirmer_paiement` | Bibliothèque ↔ Achat de pass ↔ Codes promo (chacun « étend » la même fonction) | AD-1 resserrée |
| H-8 | haute | Données liées aux ventes dans des pages en cache ; aucun `revalidateTag` possible depuis la base | Catalogue (liste) ↔ Notification PawaPay ↔ Événements | AD-17 resserrée |
| M-1 | moyenne | Boîte d'envoi : liste des modèles, langue, données figées, statuts | Remise et suivi ↔ Emails ↔ Relances | AD-9 resserrée |
| M-2 | moyenne | Forme des Mesures, copie Panier → Commande, correction et validation | Fiche Sur-mesure ↔ Création de commande ↔ Vérification des Mesures | AD-32 |
| M-3 | moyenne | Formes de `journal_audit`, `anomalie`, `trop_percu` et vue des tâches | Tableau de bord admin ↔ toutes les stories qui signalent | AD-21 resserrée |
| M-4 | moyenne | Ligne de Commande d'un Pass et Pass Stand | Achat de pass ↔ Création de commande ↔ Scan | AD-7 resserrée |
| M-5 | moyenne | Compteur « 10 pass gratuits » | Réalisations ↔ 10 pass gratuits | AD-33 |
| M-6 | moyenne | Réclamation et remplacement sans statut | Réclamation ↔ Remise et suivi | AD-34 |
| M-7 | moyenne | Liste fermée des étiquettes de cache | Admin catalogue ↔ Galerie ↔ Réglages | AD-17 resserrée |
| M-8 | moyenne | Kit gratuit : marqueur et accès au Panier | Kit gratuit ↔ Panier | AD-15 resserrée |
| B-1 | basse | `evenement_mesure` : identifiant de session et origine de la vente | Mesure ↔ Création de commande ↔ Tableau de bord | AD-19 resserrée |
| B-2 | basse | Point de départ des 90 jours de Relances | Relances ↔ Kit gratuit | AD-23 resserrée |
| B-3 | basse | Nom figé sur le Pass | Achat de pass ↔ Comptes | AD-12 resserrée |

---

## Critiques

### C-1 — Qui exécute les fonctions de transition, et au nom de qui

**Unités :** « Remise et suivi » (l'Admin fait avancer une Commande) et « Tableau de bord admin » / « Annulation cosplay » (validation d'une demande).

- **Unité A** appelle `avancer_statut` depuis une Server Action avec le client Supabase **de session** (AD-2 : « le client des Server Components lit avec la session de l'utilisateur ») ; la fonction lit `auth.uid()` pour l'auteur et `a_le_role('admin', null)` pour le droit. Pour que l'appel passe, la migration de A laisse `EXECUTE` à `authenticated` (valeur par défaut de Postgres : `PUBLIC`).
- **Unité B** appelle `annuler_commande` avec le client **service role** (AD-2 l'autorise côté serveur) ; `auth.uid()` vaut alors `NULL`, donc B ajoute un paramètre `p_auteur`. B révoque `EXECUTE` à `authenticated` sur « ses » fonctions.
- **Conflit :** deux conventions d'auteur dans `journal_audit` (une ligne sur deux sans auteur, NFR-9 cassée) ; surtout, avec la convention de A, **n'importe quel navigateur connecté peut appeler `supabase.rpc('confirmer_paiement', …)`** via PostgREST, car une fonction `SECURITY DEFINER` contourne la RLS. AD-2 interdit l'écriture par le navigateur dans les tables, pas l'exécution des fonctions : la règle 2 de CLAUDE.md tombe sans qu'aucune AD soit violée.

**AD-3 resserrée (ajout) :**
> Chaque fonction de transition et chaque fonction SQL qui écrit est créée avec `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` puis `GRANT EXECUTE … TO service_role`, dans la même migration. Elle n'est appelée que par le client service role (`src/lib/supabase/service.ts`) ou par pg_cron. Un test SQL (pgTAP ou script CI) liste toutes les fonctions du schéma `public` exécutables par `anon` ou `authenticated` et échoue si l'une d'elles écrit. Seules les fonctions de lecture pure (`a_le_role`, `est_mineur`, `places_evenement_utilisees`, `stock_disponible`, `places_fabrication_utilisees`) restent exécutables par `authenticated`.

**AD-25 — Auteur explicite :**
> Toute fonction de transition reçoit en premier paramètre `p_auteur jsonb` de forme `{ "type": "compte" | "systeme" | "prestataire" | "cron", "id": uuid | null, "role": "admin" | "assistant" | "benevole" | "client" | null }`, construit uniquement par `src/lib/auth/auteur.ts` à partir de la session vérifiée côté serveur. La fonction ne lit jamais `auth.uid()`. Quand l'action exige un rôle, la fonction revérifie `a_le_role` pour `p_auteur.id` (deuxième vérification d'AD-13) et lève `KS_DROIT_REFUSE` sinon.

---

### C-2 — Stock disponible, réservation et Plafond de fabrication

**Unités :** « Fiche produit + disponibilité », « Création de commande », « Notification PawaPay » (via `confirmer_paiement`), « Annulation cosplay ».

Le spine dit seulement : `creer_commande` « vérifie le stock et le Plafond », `confirmer_paiement` « convertit les réservations en décompte de stock » et vérifie que la Commande est « encore honorable ». Aucun compteur n'est défini.

- **Unité A (Fiche)** affiche « En stock » si `variante.stock > 0`, et « Commandes complètes » si `count(commande WHERE statut = 'en_fabrication') >= plafond` (lecture littérale du Glossaire : « Commandes en cours de fabrication »).
- **Unité B (Création de commande)** calcule `stock - sum(reservation actives)` et compte le Plafond comme « Commandes `en_attente` avec réservation de fabrication + `payee` sur commande + `en_fabrication` », **par ligne** (deux Cosplays sur commande = deux places).
- **Unité C (`confirmer_paiement`)** revérifie l'honorabilité en recalculant `stock - sum(reservation actives)` **sans exclure la réservation de la Commande elle-même** : la dernière pièce, réservée par cette Commande, apparaît indisponible → **Trop-perçu sur un paiement légitime**.
- **Unité D (Annulation)** « libère le stock » en faisant `stock = stock + 1`, alors que la ligne avait été vendue en Fabrication sur commande et n'avait jamais décrémenté le stock → stock fantôme.
- **Conflits :** la fiche affiche « En stock » alors que tout est réservé ; la fiche propose la Fabrication sur commande alors que `creer_commande` la refuse ; ordre `en_attente` « en stock » qui passe payé après qu'un autre a pris la pièce ; Plafond par Commande ou par ligne selon la story ; le mode (stock ou fabrication) d'une ligne n'est figé nulle part, donc `avancer_statut` ne sait pas s'il doit autoriser `payee → expediee` ou exiger `en_fabrication`.

**AD-26 — Disponibilité physique : trois fonctions, un mode figé par ligne :**
> 1. `creer_commande` fige pour chaque ligne physique `ligne_commande.origine` ∈ {`stock`, `fabrication`} : `stock` si `stock_disponible(variante) >= quantite` au moment de la création, sinon `fabrication` si la variante l'autorise et si `places_fabrication_utilisees() + quantite <= reglage.plafond_fabrication`, sinon `KS_INDISPONIBLE`. Sur-mesure est toujours `fabrication`. Cette origine ne change plus jamais.
> 2. `reservation(commande, ligne_commande, variante, quantite, origine, expire_le)` est créée par `creer_commande` pour chaque ligne physique et supprimée (ou marquée `liberee`) par `expirer_commande`, `annuler_commande`, ou convertie par `confirmer_paiement`.
> 3. `stock_disponible(variante) = variante.stock − Σ reservation actives d'origine stock`. `variante.stock` n'est décrémenté que par `confirmer_paiement` (lignes d'origine `stock`) et n'est réincrémenté que par `annuler_commande` pour les lignes d'origine `stock` encore non remises. Une ligne d'origine `fabrication` ne touche jamais `variante.stock`.
> 4. `places_fabrication_utilisees()` = Σ des quantités des lignes d'origine `fabrication` dont la Commande est `en_attente` ou `echouee` (réservation active), `payee` ou `en_fabrication`. Le Plafond se compte **en pièces**, pas en Commandes. Une Commande `expediee`, `livree`, `annulee`, `expiree` ne compte plus.
> 5. La fiche, `creer_commande` et `confirmer_paiement` n'utilisent que ces fonctions. Dans `confirmer_paiement`, une Commande dont les réservations sont actives est honorable par construction : l'honorabilité n'est recalculée (en excluant sa propre Commande) que si ses réservations ont été libérées.
> 6. `avancer_statut` autorise `payee → expediee` seulement si toutes les lignes physiques sont d'origine `stock` ; sinon `payee → en_fabrication` est obligatoire.

---

### C-3 — Commande mixte : statut unique, annulation partielle, montant remboursé, commission

**Unités :** « Annulation cosplay », « Codes promo + commission », « Remise et suivi ».

Le Glossaire n'a qu'un statut par Commande ; FR-25 annule « seul le Cosplay » d'une Commande mixte, rend le Forfait et garde le Kit ; FR-48 compte les Commandes « payées et non remboursées » ; la réduction du Code promo porte sur toute la Commande hors livraison.

- **Unité A (Annulation)** passe la Commande entière à `annulee` puis `remboursee`, et calcule le montant à rendre = `prix_cosplay_cents + livraison_cents` (prix catalogue figé, **sans** déduire la part de réduction du Code promo).
- **Unité B (Commission)** exclut toute Commande `remboursee` → commission perdue sur le Kit pourtant vendu et non remboursé. Une autre lecture de B garde la Commande mais calcule la commission sur `total − livraison` entier → commission payée sur un Cosplay remboursé.
- **Unité C (Remise et suivi)** voit une Commande mixte `annulee` alors que le Kit reste dans la Bibliothèque ; ou, si A n'a annulé qu'en surface, une Commande Cosplay + Accessoire dont l'Accessoire est déjà en stock : A permet d'annuler « une Commande de Cosplay » ; une autre story Annulation refuse si une ligne Accessoire existe, une troisième annule les deux.
- **Conflits :** montant remboursé différent selon la story (avec ou sans la part de réduction), commission différente, statut `annulee` qui ment pour le Kit, aucune règle pour l'Accessoire de la même Commande.

**AD-27 — Annulation par Commande, montant calculé une seule fois :**
> 1. Le statut reste porté par la Commande (aucun statut de ligne). Une Commande `produits` est « physique » si elle contient au moins une ligne `cosplay` ou `accessoire`, sinon « numérique ».
> 2. L'annulation (FR-25) s'applique à **toutes les lignes physiques** de la Commande, jamais à une partie d'entre elles, et seulement si la Commande contient au moins un Cosplay et est `payee`. `annuler_commande` passe la Commande `annulee` ; les lignes `kit` gardent leurs `acces_kit` ; `ligne_commande.annulee = true` est posé sur les lignes physiques.
> 3. Le montant à rendre est calculé une seule fois, par `annuler_commande`, et figé dans `commande.montant_a_rembourser_cents` : Σ (prix figé des lignes physiques − part de réduction de ces lignes) + `livraison_cents`. La part de réduction d'une ligne = réduction totale × prix de la ligne / sous-total, arrondie au centime inférieur, le reste étant attribué à la dernière ligne. `creer_commande` fige cette part dans `ligne_commande.reduction_cents` pour que personne ne la recalcule.
> 4. La commission (FR-48) se calcule par la vue `commission_code_promo` = Σ, sur les Commandes ayant atteint `payee`, de (`prix_cents − reduction_cents`) des lignes **non annulées**, × taux figé dans `commande.taux_commission` par `creer_commande`. Aucune autre requête ne calcule une commission.

---

### C-4 — `acces_kit` en double fait échouer le paiement

**Unités :** « Bibliothèque », « Kit gratuit », « Notification PawaPay ».

- **Unité A (Bibliothèque)** pose, à juste titre, `UNIQUE (compte, produit)` sur `acces_kit`.
- **Unité B (Kit gratuit)** insère avec `ON CONFLICT DO NOTHING`.
- **Unité C (`confirmer_paiement`)** insère sans clause de conflit. Cas réel : un Compte a deux Commandes `en_attente` contenant le même Kit (AD-15 empêche un Kit possédé dans le Panier, pas deux Commandes en attente créées depuis deux appareils, ni le Kit gratuit obtenu entre la création et le paiement). Le second paiement réussi lève une violation d'unicité, **toute la transaction de `confirmer_paiement` est annulée** : argent encaissé, Commande toujours `en_attente`, ni Trop-perçu ni anomalie. La notification est rejouée et échoue à chaque fois.
- Variante : A ajoute `commande_id NOT NULL` pour la traçabilité ; B (Kit gratuit) le remplit avec la Commande `offerte` ; C le remplit avec la Commande payée ; un accès déjà existant garde l'ancienne Commande et la nouvelle n'a aucune trace d'accès.

**AD-11 resserrée (ajout) :**
> `acces_kit` a une contrainte `UNIQUE (compte, produit)` et une colonne `commande_origine` (première Commande ayant ouvert l'accès). Toute création d'accès se fait par `INSERT … ON CONFLICT (compte, produit) DO NOTHING`, dans `confirmer_paiement` comme dans `offrir_commande`. `creer_commande` refuse (`KS_KIT_DEJA_POSSEDE`) une ligne Kit déjà possédée ou présente dans une autre Commande `en_attente` du même Compte. Si `confirmer_paiement` constate qu'un Kit d'une Commande 100 % numérique est déjà possédé, la Commande est payée normalement et une `anomalie` `kit_deja_possede` est créée pour un remboursement manuel ; une erreur d'unicité ne doit jamais annuler la transaction de paiement.

---

### C-5 — Expiration contre paiement tardif, réponse de la route de notification, statuts de Tentative

**Unités :** « Notification PawaPay » (route + `confirmer_paiement` / `echouer_tentative`), tâche `expirer_commandes_echues`, tâche `reconcilier-tentatives`.

- **Unité A (expiration)** passe `expiree` toute Commande `en_attente` ou `echouee` dont le Délai est dépassé, même si une Tentative est `en_cours` (AD-10 dit que la réconciliation s'arrête « à la fin du Délai de paiement »).
- **Unité B (réconciliation)** filtre `tentative.statut = 'en_cours'` ; mais la story PawaPay, lisant AD-5 (« résultat `inconnu` »), a stocké `statut = 'inconnu'` pour une réponse ambiguë → la Tentative n'est plus jamais réconciliée.
- **Unité C (route de notification)** reçoit un échec tardif pour une Commande `expiree` : `echouer_tentative` lève `KS_TRANSITION_INTERDITE` (expiree → echouee n'existe pas), la route renvoie 500, **PawaPay rejoue indéfiniment**. Pour un succès tardif, `confirmer_paiement` crée bien un Trop-perçu, mais la Tentative reste `en_cours` car personne n'a dit qu'elle devait passer `reussie` hors du cas nominal ; l'index unique partiel « une seule `en_cours` par Commande » bloque alors toute nouvelle Tentative si la Commande renaît.
- **Conflits :** paiement réel pendant l'agonie de la Commande → Trop-perçu évitable ; Tentatives orphelines ; tempête de rejeux.

**AD-28 — Énumération et cycle de la Tentative :**
> `tentative_paiement.statut` ∈ {`en_cours`, `reussie`, `echouee`, `abandonnee`}. Les résultats d'adaptateur (`succes`, `echec_client`, `echec_prestataire`, `inconnu`) ne sont jamais stockés comme statut : `inconnu` laisse `en_cours`. Une Tentative passe `reussie` dès qu'un succès est vérifié, **quel que soit le sort de la Commande** (payée ou Trop-perçu) ; `echouee` sur échec vérifié ; `abandonnee` quand la Commande expire alors qu'elle est encore `en_cours`, la réconciliation continuant malgré tout sur les Tentatives `abandonnee` pendant 72 h pour détecter un succès tardif (→ Trop-perçu).

**AD-5 resserrée (ajout) :**
> `expirer_commande` n'expire pas une Commande qui a une Tentative `en_cours` démarrée depuis moins de `reglage.grace_tentative` (valeur en base, à fixer par Jonathan) : l'expiration attend la fin de cette grâce. `echouer_tentative` sur une Commande qui n'est plus `en_attente` met seulement la Tentative à jour, sans toucher la Commande ni lever d'erreur. La route de notification enregistre d'abord la notification dans `notification_recue` (`UNIQUE (prestataire, id_notification)`), puis appelle le service ; elle répond 200 dès que la notification est vérifiée et enregistrée, même si la transition est refusée (le refus devient une `anomalie`), et 401 seulement si la vérification échoue.

---

## Hautes

### H-1 — « Premier achat » et plafond du Code promo

**Unités :** « Création de commande », « Notification PawaPay », « Codes promo + commission ».

- **A (`creer_commande`)** définit « premier achat » comme « aucune Commande du Compte en statut `payee` ».
- **B (`confirmer_paiement`)** le redéfinit comme « aucune Commande ayant **jamais** été payée » (statuts `payee`, `en_fabrication`, `expediee`, `livree`, `annulee`, `remboursee`) — plus juste, mais différent : une cliente dont la première Commande est `livree` passe le contrôle de A et échoue en B → paiement encaissé et **Commande entière en Trop-perçu** à cause d'une réduction de quelques dollars.
- **Plafond :** A compte les utilisations comme Commandes `en_attente` + payées ; B (« Code promo compté » à la confirmation) incrémente une colonne `code_promo.utilisations`. 50 Commandes `en_attente` peuvent naître sous le plafond, la 51ᵉ payée part en Trop-perçu. Deux Commandes `en_attente` du même Compte avec le même code : la seconde payée devient un Trop-perçu complet.
- **C (Commission)** compte les ventes par `commande.code_promo_id` sur les statuts `payee` seulement.

**AD-29 — Une définition pour le Code promo :**
> `a_deja_achete(compte, sauf_commande)` est vraie s'il existe une Commande de ce Compte, autre que `sauf_commande`, dont `paye_le` n'est pas nul (colonne posée par `confirmer_paiement`, jamais effacée). `utilisations_code_promo(code)` = nombre de Commandes avec ce code dont `paye_le` n'est pas nul, + Commandes `en_attente`/`echouee` avec ce code. `creer_commande` applique le code si actif, `utilisations_code_promo < plafond` et `NOT a_deja_achete` ; elle refuse un code si le Compte a déjà une autre Commande `en_attente` avec un code (`KS_CODE_PROMO_EN_COURS`). `confirmer_paiement` ne revérifie **pas** le Code promo : une Commande `en_attente` a réservé son utilisation comme elle a réservé son stock. Aucune colonne compteur sur `code_promo`. Une Commande `offerte` n'a jamais de `paye_le`.

### H-2 — Capacité : Commandes en attente, Pass annulés, Pass offerts

**Unités :** « Achat de pass », « 10 pass gratuits », « Annulation de pass ».

AD-12 fixe une fonction unique `places_evenement_utilisees`, mais pas ce qu'elle compte.

- **A (Achat)** compte les Pass existants (`valide`, `scanne`) ; or les Pass n'existent qu'après paiement → pas de réservation de place pendant le Délai de paiement, survente, Trop-perçus en série le jour où l'Événement se remplit.
- **B (10 pass gratuits)** appelle `offrir_commande` sans vérifier la Capacité (« Pass gratuit promis ») ; A le refuse à `creer_commande` pour un Événement complet.
- **C (Annulation)** suppose qu'un Pass `annule` libère sa place ; A le compte encore (filtre `statut <> 'rembourse'`).

**AD-12 resserrée (ajout) :**
> `places_evenement_utilisees(evenement)` = Σ des places des lignes de Commandes `pass` `en_attente` ou `echouee` (réservation pendant le Délai de paiement, un Stand = 2) + nombre de Pass `valide` ou `scanne` de l'Événement. Un Pass `annule` ou `rembourse` ne compte plus. Les Pass offerts comptent et sont soumis à la Capacité : si l'Événement est complet, `offrir_commande` lève `KS_COMPLET` et la Réalisation reste validée sans Pass, avec une `anomalie`. `confirmer_paiement` ne revérifie la Capacité que si la Commande n'est plus `en_attente`/`echouee`.

### H-3 — Qui pose `livree` pour une Commande numérique, et combien d'emails partent

**Unités :** « Notification PawaPay », « Kit gratuit », « Emails ».

La matrice dit `payee → livree : avancer_statut (100 % numérique, automatique)` et `offerte → livree : automatique (Kit gratuit)`, sans nommer l'appelant.

- **A (`confirmer_paiement`)** laisse `payee` ; la story « Bibliothèque » appelle `avancer_statut` à la première ouverture du Kit ; une autre story le fait par une tâche cron ; une troisième ne le fait jamais.
- **B (Kit gratuit)** fait passer `offrir_commande` directement à `livree` (aucune ligne `offerte` dans le journal), alors que la story « 10 pass gratuits » laisse ses Commandes `offerte` (AD-3 : « une Commande `pass` reste `payee` ou `offerte` »).
- **C (Emails)** : `confirmer_paiement` insère un envoi « payée », puis `avancer_statut` un envoi « livrée » (avec invitation à envoyer une photo de costume, sans objet pour un Kit), plus « Kit ouvert » : trois emails dans la même minute ; or un seul est utile.
- Effet métier : SM-10 (entonnoir « payée → livrée dans le délai ») compte faux selon la story.

**AD-3 resserrée (ajout) :**
> Une Commande `produits` 100 % numérique passe `payee` puis `livree` **dans la même transaction de `confirmer_paiement`** (deux lignes de journal), et une Commande `offerte` de Kit passe `livree` dans la transaction d'`offrir_commande`. Une Commande `pass` ne quitte jamais `payee` ou `offerte`. Emails : une Commande 100 % numérique produit un seul envoi `kit_ouvert` ; une Commande avec Produit physique produit `commande_payee`, puis un envoi par transition ; l'envoi `commande_livree` (invitation photo) n'existe que pour une Commande physique.

### H-4 — Lecture publique, brouillons, colonnes privées et cache

**Unités :** « Fiche produit » (page publique en cache), « Admin catalogue », « Bibliothèque ».

- **A (Fiche)** lit avec le client de session dans une fonction mise en cache (AD-17 : « mises en cache » ; AD-2 : « lit avec la session ») : soit Next refuse les cookies dans un segment en cache, soit la réponse d'un Admin (qui voit les brouillons) est mise en cache pour tout le monde.
- **B (Admin)** écrit une politique RLS `SELECT` sur `produit` : `statut = 'publie' OR a_le_role('admin')`. **C (Bibliothèque)** ajoute à `video_kit` la colonne `bunny_video_id_prive` et `fichier_kit.chemin_stockage` ; la politique de lecture publique de A sur ces tables (pour afficher la durée et le nombre de chapitres) expose ces identifiants à `anon` : AD-11 (« aucune page publique ne contient un identifiant de vidéo privée ») est violée par la base, pas par la page.
- Variante : `variante` exposée à `anon` avec un futur `cout_fabrication_cents`.

**AD-30 — Lecture publique :**
> Les pages publiques en cache lisent avec un client sans cookie (`src/lib/supabase/public.ts`, rôle `anon`) ; jamais le client de session dans un segment en cache. La RLS donne à `anon` et `authenticated` un `SELECT` limité aux lignes publiées (`publie_le IS NOT NULL AND publie_le <= now()`), Admin et Assistant passant par le client service role après vérification de `droits.ts`. Les champs privés (identifiants Bunny privés, chemins `kits-private`, coûts, notes admin) vivent dans des tables séparées sans aucune politique de lecture (`video_kit_prive`, `fichier_kit_prive`) ; une table lisible par `anon` ne contient aucune colonne privée. Un test liste les colonnes lisibles par `anon` et échoue sur un nom contenant `prive`, `chemin`, `cout` ou `note_admin`.

### H-5 — Annulation de Pass : demande, fonction de remboursement, forme de la preuve

**Unités :** « Annulation de pass », « Annulation cosplay », « Trop-perçus ».

- `demande_client` appartient à `commande` ; le statut du Pass appartient à `evenements` (`annuler_pass`). Aucune fonction n'est nommée pour `annule → rembourse` (`confirmer_remboursement` est décrite pour `annulee → remboursee` d'une Commande).
- **A (Annulation de pass)** crée `confirmer_remboursement_pass` dans le module `evenements`, avec `preuve text` et le montant = prix du Type de pass × (1 − frais %), lu au moment de la validation (prix actuel, pas figé).
- **B (Annulation cosplay)** stocke la preuve dans `commande.preuve_remboursement` et le montant dans `commande.montant_a_rembourser_cents`.
- **C (Trop-perçus)** stocke `trop_percu.rembourse_le`, `trop_percu.reference`.
- **Conflits :** trois formes de remboursement, impossible d'avoir une vue « Remboursements » cohérente ni un total remboursé ; montant de Pass recalculé au prix courant au lieu du prix figé (AD-8) ; on ne sait pas si annuler un des deux Pass d'un Stand est permis.

**AD-31 — Une table des remboursements :**
> `remboursement(id, cible_type ∈ {commande, pass, trop_percu}, cible_id, montant_cents, devise, calcule_par, preuve_reference, preuve_fichier, valide_par, valide_le)` appartient au module `paiement`. Les montants sont calculés par la fonction de transition qui crée la demande et figés : Commande (AD-27), Pass = (prix figé de la ligne − part de réduction) / nombre de Pass de la ligne × (1 − `reglage.frais_annulation_pass`), arrondi au centime inférieur, Trop-perçu = montant reçu. `confirmer_remboursement(p_auteur, remboursement, preuve)` est la seule fonction qui passe `annulee → remboursee`, `annule → rembourse` ou clôt un Trop-perçu. `demande_client` (module `commande`) a `type ∈ {annulation_commande, annulation_pass, reclamation}` et `statut ∈ {ouverte, acceptee, refusee, close}` ; l'acceptation d'une `annulation_pass` appelle `annuler_pass` via le service `evenements`. Un Pass Stand s'annule avec son second Pass (les deux ensemble).

### H-6 — Journalisation des écritures admin qui ne sont pas des transitions

**Unités :** « Remise et suivi » (corriger l'adresse, saisir le numéro de suivi), « Admin catalogue » (changer un prix), « Vérification des Mesures » (corriger une Mesure).

AD-13 : « toute action d'un Admin, d'un Assistant ou d'un bénévole sur une donnée métier est journalisée (AD-3) ». AD-3 ne journalise que les fonctions de transition ; AD-1 dit que seules les fonctions Postgres écrivent `journal_audit`.

- **A** fait un `update adresse_remise` depuis `service.ts` : pas de journal (aucune AD violée : ce n'est pas un statut).
- **B** écrit `journal_audit` depuis TypeScript : interdit par AD-1 (exception réservée aux fonctions Postgres) — mais c'est la seule façon de respecter AD-13 sans créer une fonction par champ.
- **C** crée `corriger_mesures` comme fonction SQL hors de la liste fermée d'AD-3 (« Noms fixés »).

**AD-3 / AD-13 resserrées :**
> Les écritures qui ne changent pas un statut (contenu, prix, adresse, Mesures, réglages, Code promo, rôles) sont journalisées par un **trigger générique** `journaliser()` posé sur chaque table métier, qui lit l'auteur dans `current_setting('ks.auteur', true)` ; le service pose ce réglage par `set_config('ks.auteur', …, true)` dans la même transaction, via une fonction `executer_en_tant_que(p_auteur, …)` ou une RPC dédiée. Un trigger refuse toute écriture sur une table journalisée quand `ks.auteur` est absent. La liste de noms d'AD-3 est la liste des fonctions de **transition** ; d'autres fonctions d'écriture sont permises si elles suivent C-1.

### H-7 — AD-1 contredit AD-3 : qui possède `confirmer_paiement`

**Unités :** « Bibliothèque » (création d'`acces_kit`), « Achat de pass » (émission des Pass), « Codes promo », « Emails ».

AD-1 : seul le module propriétaire écrit sa table. AD-4 : `confirmer_paiement` écrit `commande`, `reservation`, `variante.stock` (catalogue), `acces_kit` (bibliotheque), `pass` (evenements), `envoi` (envois). Chaque story de domaine veut « brancher » son effet.

- **A (Bibliothèque)** crée une migration qui remplace `confirmer_paiement` par une version avec l'insertion d'`acces_kit`.
- **B (Achat de pass)**, construite plus tard dans une autre session, remplace à son tour `confirmer_paiement` à partir de la version initiale de la story Paiement, **effaçant l'effet de A** (`CREATE OR REPLACE` sans relire la dernière version).
- Variante : B ajoute un trigger `AFTER UPDATE ON commande` pour émettre les Pass ; A a mis l'effet dans la fonction : deux mécanismes, ordre d'exécution incertain, et les triggers ne voient pas le contexte (auteur, Tentative).

**AD-1 resserrée :**
> Les fonctions de transition appartiennent au module `commande` (Commandes) ou `evenements` (Pass, scan, verrou) ou `paiement` (Tentatives, remboursements). Elles peuvent écrire dans les tables d'autres modules, mais **uniquement en appelant une fonction SQL interne du module propriétaire** (`bibliotheque_ouvrir_acces(compte, produit, commande)`, `evenements_emettre_pass(commande)`, `catalogue_decrementer_stock(variante, qte)`, `envois_planifier(modele, …)`), non exécutable hors du schéma. Une story de domaine ajoute un effet en créant ou modifiant **sa** fonction interne, jamais en réécrivant la fonction de transition d'un autre module. Aucun trigger métier entre modules. Toute migration qui fait `CREATE OR REPLACE` d'une fonction existante part de la dernière version appliquée (copiée depuis `supabase/migrations/`) et un test vérifie les effets de toutes les stories déjà livrées.

### H-8 — Données liées aux ventes dans des pages en cache

**Unités :** « Catalogue (liste) », « Notification PawaPay », « Événements ».

AD-17 rend « à chaque requête » ce qui dépend des ventes, mais les listes (catalogue, accueil, carte d'Événement) sont des pages publiques « mises en cache » ; seules les mutations admin revalident.

- **A (Catalogue)** met sur chaque carte un badge « En stock » / « Fabrication sur commande » / « Commandes complètes », calculé dans la page en cache (la carte n'est pas une « fiche », donc A pense être dans le cadre).
- **B (`confirmer_paiement`)** vend la dernière pièce en SQL : il ne peut pas appeler `revalidateTag`. La liste affiche « En stock » pendant des heures ; l'accueil affiche des places restantes ou « Complet » périmés.

**AD-17 resserrée :**
> Aucun segment en cache n'affiche une donnée dépendant des ventes (stock, disponibilité, Plafond, places, « Complet ») : ces éléments sont des îlots rendus à la requête (Suspense / rendu dynamique) ou lus par une route non mise en cache, sur les fiches **comme sur les listes, cartes et l'accueil**. La base n'a jamais à invalider le cache ; seules les mutations admin appellent `revalidateTag`.

---

## Moyennes

### M-1 — Boîte d'envoi : modèles, langue, données, statuts

**Unités :** « Remise et suivi » (insère `envoi`), « Emails » (route `/api/cron/envois`), « Relances ».

- A insère `modele = 'commande_expediee'` avec `donnees = {numero_suivi, adresse, nom}` (copie figée, avec données personnelles) ; la story Emails attend `modele = 'expedition'` et `donnees = {commande_id}` (relecture à l'envoi). La langue : A lit `profil.langue` au moment de la transition ; la route la relit à l'envoi.
- Relances insère trois Emails commerciaux le même jour (panier abandonné, rappel de Kit, nouveau produit) ; la route envoie le premier et met les autres en `echec` (règle des 2 jours) → nouvel essai borné → `anomalie` « envoi en échec définitif » pour un comportement voulu.

**AD-9 resserrée :**
> `envoi.modele` est une énumération Postgres fermée, définie dans une migration et complétée par chaque story qui ajoute un email : `code_connexion` exclu (Supabase), `commande_payee`, `commande_en_fabrication`, `commande_expediee`, `commande_prete_a_retirer`, `commande_livree`, `commande_annulee`, `commande_remboursee`, `kit_ouvert`, `pass_emis`, `pass_annule`, `pass_rembourse`, `galerie_evenement`, `relance`, `panier_abandonne`, `rappel_kit`, `nouveau_produit`, `alerte_evenement`. `envoi.donnees` ne contient que des identifiants ; le rendu relit la base au moment de l'envoi. `envoi.langue` est figée à l'insertion depuis `profil.langue` (ou `fr` à défaut). `envoi.statut` ∈ {`a_envoyer`, `envoye`, `echec`, `abandonne`, `ignore`} ; `ignore` (avec motif : consentement, désinscription, écart de 2 jours) est final et ne crée pas d'anomalie. Les gabarits vivent dans `src/modules/envois/modeles/<modele>.tsx`, textes dans `messages/*.json`.

### M-2 — Mesures : forme, copie et validation

**Unités :** « Fiche Sur-mesure » (saisie), « Création de commande », « Vérification des Mesures ».

- A stocke les Mesures dans `ligne_panier.mesures jsonb` avec des clés en anglais (`chest`, `waist`) issues du schéma d'aide ; B crée la table `mesures(ligne_commande, tour_poitrine_cm numeric, …)` en colonnes ; C attend un booléen `commande.mesures_validees`. La liste est différée (E-10) mais pas la forme.
- La correction par l'Admin : un `update` (C) ou une nouvelle version (journal) ?

**AD-32 — Mesures :**
> Les Mesures sont un objet `jsonb` dont les clés et bornes sont définies par un seul schéma Zod `schemaMesures` (`src/modules/commande/schemas.ts`), versionné (`version`), en centimètres entiers. Elles vivent dans `ligne_panier.mesures` puis sont copiées par `creer_commande` dans `mesures(ligne_commande, valeurs jsonb, version_schema, valide_par, valide_le)`. Le client ne les modifie plus après création de la Commande ; l'Admin les corrige par la fonction `corriger_mesures` (journalisée, garde l'ancienne valeur dans le journal) et les valide par `valider_mesures`, qui pose `valide_le`. `avancer_statut` vers `en_fabrication` exige `valide_le` non nul pour chaque ligne Sur-mesure. La tâche « Mesures à vérifier » = vue sur `valide_le IS NULL` et Commande `payee`.

### M-3 — Formes de `journal_audit`, `anomalie`, `trop_percu`

**Unités :** « Tableau de bord admin » et toutes les stories qui signalent.

- AD-21 : « crée une ligne `anomalie` ou `trop_percu` ». La story Paiement crée un `trop_percu` **et** une `anomalie` « trop-perçu » pour qu'il apparaisse dans les tâches ; la story Tableau de bord fait l'union des deux tables → doublon.
- `anomalie.type` texte libre : `'MONTANT_INSUFFISANT'`, `'montant insuffisant'`, `'paiement_partiel'` selon la story. `journal_audit` : `avant`/`apres` en ligne complète (avec données personnelles) dans une story, en différence dans une autre.

**AD-21 resserrée :**
> `trop_percu(commande, tentative, montant_recu, devise_recue, motif ∈ {deja_payee, expiree, annulee, impossible, montant_superieur}, statut ∈ {a_rembourser, rembourse})` est la seule trace d'un Trop-perçu ; aucune `anomalie` ne le duplique. `anomalie(type, gravite, cible_type, cible_id, details jsonb, resolue_par, resolue_le)` avec `type` en énumération Postgres fermée (`montant_insuffisant`, `notification_invalide`, `envoi_echec_definitif`, `scans_non_synchronises`, `kit_deja_possede`, `pass_offert_impossible`, `transition_refusee`), étendue seulement par migration. `journal_audit(auteur jsonb (AD-25), action, cible_table, cible_id, avant jsonb, apres jsonb, cree_le)` où `avant`/`apres` ne contiennent que les colonnes modifiées, emails et téléphones masqués. La vue `taches_admin` est la seule source de la liste des tâches et fait l'union des anomalies non résolues, des Trop-perçus `a_rembourser`, des demandes `ouverte`, des Mesures à valider et des photos/Réalisations en attente.

### M-4 — Ligne de Commande d'un Pass et Pass Stand

**Unités :** « Achat de pass », « Création de commande », « Scan ».

- L'ER dit `ligne_commande }o--o| variante`. A ajoute `ligne_commande.type_pass_id` et une ligne par Pass (un Stand = 2 lignes à moitié prix ?) ; B garde `variante_id` et crée une « variante » fictive par Type de pass dans le catalogue (AD-7 dit pourtant qu'aucun Pass n'est un Produit). Les noms des titulaires : `ligne_commande.donnees jsonb` (A) ou une table `pass_brouillon` (autre story). Le Scan affiche le titulaire depuis `pass.nom` ou depuis `profil`.

**AD-7 resserrée :**
> `ligne_commande` porte exactement un de `variante_id` (Commande `produits`) ou `type_pass_id` (Commande `pass`), contrainte `CHECK`. Une ligne de Pass = un Type de pass × une quantité ; un Stand produit 2 Pass par unité. Les noms des titulaires sont saisis à l'achat et figés dans `ligne_commande.titulaires jsonb` (tableau de noms, longueur = nombre de Pass), copiés tels quels dans `pass.nom_titulaire` par `confirmer_paiement` / `offrir_commande`. Aucune variante de catalogue ne représente un Pass.

### M-5 — Compteur « 10 pass gratuits »

**Unités :** « Réalisations » (validation, module `communaute`), « 10 pass gratuits ».

- A valide la Réalisation et met `realisation.statut = 'validee'` ; B compte « les 10 premières validées » par `count(*) WHERE statut = 'validee'`, sans verrou : deux validations concurrentes (Admin et futur Assistant) donnent 11 Pass. Le compteur est global ou par Événement ? Le Compte qui envoie deux Réalisations gagne-t-il deux Pass ?

**AD-33 — Pass gratuits :**
> `realisation.rang_pass_offert` (1 à 10, `UNIQUE (evenement, rang_pass_offert)`) est attribué par la fonction `attribuer_pass_offert(p_auteur, realisation, evenement)`, qui verrouille l'Événement, vérifie l'achat du Kit (`acces_kit` dont la `commande_origine` a un `paye_le`), un seul Pass offert par Compte et par Événement, puis appelle `offrir_commande` (type `pass`, Type Standard). Le compteur est par Événement. La validation d'une Réalisation et l'attribution du Pass sont deux actions distinctes.

### M-6 — Réclamation et remplacement

**Unités :** « Réclamation », « Remise et suivi ».

- A crée une nouvelle Commande `offerte` contenant le Produit de remplacement pour le faire suivre (fabrication, remise) ; mais la matrice n'autorise `offerte → livree` que pour un Kit gratuit, et `offrir_commande` serait alors utilisée pour un Produit physique. B garde la Commande `livree` et note le remplacement en texte libre. Stock du remplacement pris en stock : décrémenté ou non ?

**AD-34 — Remplacement :**
> Un remplacement n'est jamais une nouvelle Commande. Il est porté par `demande_client` (type `reclamation`) avec ses propres étapes `ouverte → acceptee → article_rendu → remplacement_remis | refusee`, avancées par une fonction journalisée. Si le remplacement est pris en stock, la même fonction décrémente `variante.stock` via `catalogue_decrementer_stock`. Une Commande `livree` ne change plus de statut.

### M-7 — Étiquettes de cache

**Unités :** « Admin catalogue », « Galerie », « Réglages ».

- AD-17 donne quatre exemples (`produit:<id>`, `evenement:<id>`, `article:<id>`, `accueil`). Publier un produit doit aussi rafraîchir la liste du catalogue et l'univers ; valider une photo de Galerie rafraîchit l'accueil ; changer un Forfait de livraison (affiché sur chaque fiche) rafraîchit toutes les fiches. Chaque story invente : `produits`, `catalogue`, `catalogue:cosplay`, `reglages`…

**AD-17 resserrée (ajout) :**
> Les étiquettes sont produites uniquement par `src/lib/cache/etiquettes.ts` : `produit:<id>`, `produits` (toutes les listes de Produits), `univers:<id>`, `evenement:<id>`, `evenements`, `article:<id>`, `articles`, `galerie`, `accueil`, `reglages`. Chaque fonction de lecture en cache déclare toutes les étiquettes dont elle dépend ; chaque mutation admin appelle `revalider(...)` de ce même fichier avec la liste correspondante.

### M-8 — Kit gratuit : marqueur et Panier

**Unités :** « Kit gratuit », « Panier ».

- A marque le Kit gratuit par `prix_cents = 0` ; le Panier accepte ce Kit (rien ne l'interdit) → Commande à 0 USD envoyée à l'aiguilleur → Polar pour 0 USD, ou division par zéro dans la répartition de la réduction. B marque par `produit.gratuit = true` avec un prix non nul « barré ».

**AD-15 resserrée (ajout) :**
> Un Kit gratuit est un Produit `kit` avec `prix_cents = 0` ; c'est le seul Produit qui peut avoir un prix nul. Il ne s'obtient que par `offrir_commande` ; `ajouter_au_panier` et `creer_commande` refusent toute ligne à 0 USD (`KS_PRODUIT_GRATUIT`). `creer_commande` refuse une Commande dont le total est 0.

---

## Basses

### B-1 — `evenement_mesure` : session et origine de la vente

- La story Mesure génère l'identifiant de session en mémoire à chaque chargement de page → l'entonnoir vue de fiche → Panier casse à chaque navigation. La story Tableau de bord veut joindre la session aux Commandes pour « origine de la vente », ce qu'AD-19 interdit (aucun identifiant de Compte) et qu'aucune AD ne permet par une autre voie.

**AD-19 resserrée :**
> L'identifiant de session est un UUID aléatoire gardé en `sessionStorage` (jamais en cookie, perdu à la fermeture de l'onglet). L'entonnoir se calcule en comptes agrégés par jour et par étape, jamais par jointure session ↔ Commande. L'origine d'une vente est figée dans `commande.origine jsonb` (UTM, Code promo), transmise par le formulaire de commande depuis `sessionStorage` et validée par Zod dans `creer_commande`.

### B-2 — Point de départ des 90 jours de Relances

- Relances part de `commande.cree_le` de la première Commande ; une autre story part du dernier `paye_le` ; le Kit gratuit (`offerte`) déclenche-t-il des Relances ?

**AD-23 resserrée (ajout) :**
> La fenêtre de Relances part du dernier `paye_le` ou `offerte_le` du Compte et dure 90 jours ; le rythme (2 à 3 jours) est réglé dans `reglage`.

### B-3 — Nom figé sur le Pass

- Le Pass de l'acheteur « reprend les informations de son Compte » : lecture en direct de `profil` (le nom au Scan change si le profil change) ou copie à l'émission ?

**AD-12 resserrée (ajout) :**
> Tout Pass porte `nom_titulaire` figé à l'émission (copié du profil pour l'acheteur) ; le Scan et l'email n'affichent que ce champ.

---

## Questions à poser à Jonathan (règle 15)

Ces fermetures supposent des décisions métier que le spine ne peut pas prendre seul :

1. Plafond de fabrication compté **en pièces** (proposé) ou en Commandes ?
2. Durée de grâce avant d'expirer une Commande qui a une Tentative en cours (C-5) ?
3. Annulation d'une Commande Cosplay + Accessoire : tout le physique (proposé) ou le Cosplay seul ?
4. Un Code promo réservé dès la Commande `en_attente` (proposé) ou seulement au paiement ?
5. Pass offerts soumis à la Capacité (proposé) ou hors Capacité ?
6. Compteur « 10 pass gratuits » par Événement (proposé) ou global ?
