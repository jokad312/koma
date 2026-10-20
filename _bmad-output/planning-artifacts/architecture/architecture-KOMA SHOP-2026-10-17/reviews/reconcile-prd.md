---
title: 'Réconciliation spine ↔ PRD — KOMA SHOP'
spine: '../ARCHITECTURE-SPINE.md (updated 2026-10-20)'
prd: '_bmad-output/planning-artifacts/prds/prd-KOMA SHOP-2026-10-16/prd.md (+ addendum.md)'
arbitre: '.memlog.md (décisions de Jonathan postérieures au PRD : Hostinger, Bunny Stream, contrôle du montant, M1-M5, C1-C7)'
date: '2026-10-20'
---

# Réconciliation du spine avec le PRD

## Verdict

Le spine couvre bien le cœur risqué (paiement, idempotence, aiguillage, contenus signés, Pass/QR, rôles, boîte d'envoi). Aucune contradiction bloquante avec une règle 1-15. Il reste **3 critiques/hautes de modèle de données** qui feraient diverger deux epics (Capacité du Pass Stand, Commande multi-lignes et annulation partielle, Plafond de fabrication), plus une série de règles « silencieuses » du PRD (consentements, Compte mineur sans âge, valeurs figées, 10 pass gratuits, scan hors ligne) qui doivent entrer dans des AD existantes. Les écarts dus à Hostinger et Bunny Stream sont couverts par le memlog et ne sont pas signalés comme contradictions.

Chaque constat : sévérité, référence PRD, écart, correction proposée (texte d'AD).

---

## Critique

### R-1 — Capacité : « un Pass Stand compte pour deux » sera compté deux fois
- **PRD :** Glossaire « Capacité » (un Pass Stand compte pour deux), « Type de pass » (Stand donne deux Pass nominatifs), FR-33.
- **Écart :** AD-12 dit « un Pass Stand compte pour deux » dans `places_evenement_utilisees`, alors que le modèle émet **deux lignes `pass`** par achat Stand. Un builder qui compte 2 par ligne Stand compte 4 personnes ; un autre compte 1 par ligne. Le « Complet » (FR-31) et la vérification au paiement divergent.
- **Correction (AD-12) :** remplacer « (`places_evenement_utilisees`, un Pass Stand compte pour deux) » par : « (`places_evenement_utilisees`) : chaque ligne `pass` est une personne et compte pour 1 ; un achat Stand émet deux lignes `pass` (titulaire + aide) et consomme donc 2 places. Comptent : Pass `valide` et `scanne` (Commandes `payee` ou `offerte`) + places réservées par les Commandes `pass` `en_attente`/`echouee` non expirées ; ne comptent pas : `annule`, `rembourse`. »

---

## Haute

### R-2 — Annulation d'une Commande mixte : le statut est porté par la Commande entière
- **PRD :** FR-25 (« Commande mixte (Cosplay et Kit) : seul le Cosplay est annulé ; le Kit reste dans la Bibliothèque et n'est pas remboursé ; le Forfait de livraison est rendu »), FR-48 (commission sur Commandes « payées et non remboursées »).
- **Écart :** AD-3 fait passer toute la Commande `payee → annulee → remboursee`. Rien ne fixe : le montant à rendre (ligne Cosplay après réduction + Forfait), le sort d'un Accessoire présent dans la même Commande (FR-25 ne vise que le Cosplay), ni l'effet sur la commission. Deux stories (annulation, commission/tableau de bord) calculeront différemment.
- **Correction (AD-3, AD-8) :** ajouter : « `annuler_commande` porte sur la Commande entière ; elle n'est permise que si toutes ses lignes physiques sont annulables (Cosplay non `en_fabrication`) ; les lignes Kit restent acquises (`acces_kit` conservé). Le montant à rembourser est calculé et figé par `annuler_commande` dans `commande.montant_a_rembourser_cents` = lignes physiques après réduction + Forfait de livraison ; les Kits ne sont jamais remboursés. Une Commande `annulee` ou `remboursee` sort de la commission pour sa part remboursée (vue SQL `commission_code_promo`). » Si Jonathan veut annuler un Cosplay en gardant un Accessoire de la même Commande, il faut un statut par ligne : question à lui poser (nouvelle Q-A4).

### R-3 — Plafond de fabrication : aucune fonction de comptage unique
- **PRD :** Glossaire « Plafond de fabrication », FR-10, FR-13 (réservation de la place pendant le Délai de paiement), FR-25 (libération à l'annulation).
- **Écart :** AD-12 impose une fonction unique pour la Capacité, mais rien d'équivalent pour le Plafond. La fiche (« Commandes complètes pour le moment »), `creer_commande` et `confirmer_paiement` compteront chacune à leur façon (par Commande ou par ligne ? `payee` en attente de fabrication compris ? jusqu'à `expediee` ?).
- **Correction (AD-3 ou nouvelle AD) :** « Le Plafond se compte par une seule fonction SQL `places_fabrication_utilisees()` : nombre de Commandes contenant au moins une ligne en Fabrication sur commande (Sur-mesure compris) dont le statut est `en_attente` ou `echouee` non expirée, `payee` ou `en_fabrication`. Une Commande libère sa place en passant `expediee`, `expiree` ou `annulee`. Utilisée par la fiche, `creer_commande` et `confirmer_paiement`. »

### R-4 — Ligne en stock ou en Fabrication sur commande : décidée où, et quel statut pour une Commande hétérogène
- **PRD :** FR-10, FR-24 (« en stock passe directement de payée à expédiée »), Glossaire « Statut de commande ».
- **Écart :** AD-3 a des transitions « (en stock) » et « (Mesures validées si Sur-mesure) » au niveau Commande, sans dire qui décide qu'une ligne est en stock, ni ce qui se passe pour une Commande avec une ligne en stock et une ligne à fabriquer, ou deux lignes Sur-mesure.
- **Correction (AD-3) :** « `creer_commande` fixe pour chaque ligne physique `mode_obtention` ∈ `stock`, `fabrication` (stock réservé disponible → `stock`, sinon `fabrication` si le Plafond le permet, sinon refus `KS_PLAFOND_ATTEINT`). Une Commande dont au moins une ligne est `fabrication` doit passer par `en_fabrication` ; `payee → expediee` n'est permis que si toutes les lignes physiques sont `stock`. `payee → en_fabrication` exige que toutes les lignes Sur-mesure aient des Mesures validées. »

### R-5 — Valeurs à figer à la création manquantes (délai annoncé, échéance, frais, commission)
- **PRD :** FR-6, FR-14 (délai total affiché avant paiement), §7 SM-C1 et FR-54 (« livraisons en retard », « remises après le délai annoncé »), FR-38 (pourcentage de frais réglé dans l'admin), FR-46/FR-48 (taux de commission), FR-13 (Délai de paiement).
- **Écart :** AD-8 ne fige que montants, Forfaits et pourcentage de réduction. Si l'Admin change un réglage, le retard (SM-C1), la commission due, les frais d'annulation de Pass et l'échéance d'une Commande en cours changeront rétroactivement, selon le builder.
- **Correction (AD-8) :** ajouter : « `creer_commande` fige aussi : `ligne_commande.delai_fabrication_jours` et `commande.remise_prevue_le` (délai total annoncé), `commande.expire_le` (maintenant + Délai de paiement), `commande.taux_commission` du Code promo, et pour une Commande `pass` le `pourcentage_frais_annulation` en vigueur. Aucune règle ultérieure ne relit ces valeurs dans `reglage`. »

### R-6 — Consentements et acceptations à l'achat : non enregistrés, non vérifiés côté serveur
- **PRD :** FR-13 (CGV ; pour un Kit : accès immédiat + renonciation au droit de rétractation + Licence ; Sur-mesure : confirmation des Mesures et de la non-annulation), FR-33 (mention photos/vidéos de l'Événement), FR-58 (Licence du Kit gratuit), FR-40 (accord de publication, affichage prénom/ville), FR-32/FR-45/FR-59 (consentement commercial).
- **Écart :** le spine ne mentionne que le consentement commercial (AD-9, table `consentement`). La renonciation au droit de rétractation est la base légale du « Kits non remboursables » ; si elle n'est cochée que dans l'interface, elle n'a ni preuve ni contrôle serveur, et chaque parcours (Panier, Pass, Kit gratuit, Galerie) inventera son stockage.
- **Correction (AD-2 ou nouvelle AD « Acceptations ») :** « Toute acceptation exigée par le PRD est un champ du schéma Zod de l'action concernée, refusée côté serveur si absente, et enregistrée avec horodatage et version du texte : `commande.acceptations` (cgv, renonciation_retractation_kit, licence_kit, confirmation_sur_mesure, mention_photos_evenement) écrit par `creer_commande` / `offrir_commande` ; `photo_galerie` porte `accord_publication`, `afficher_prenom`, `afficher_ville` ; `consentement` ne sert qu'aux Emails commerciaux et Alertes. »

### R-7 — Compte sans âge déclaré (Google) et refus des moins de 13 ans
- **PRD :** FR-12 (âge déclaré à la création ; < 13 ans refusé ; 13-17 Compte mineur), Glossaire « Compte ».
- **Écart :** AD-24 fixe `est_mineur(compte)` mais pas ce qui se passe quand Supabase Auth crée l'utilisateur avant la déclaration d'âge (connexion Google ou code OTP sur un email inconnu). Un builder laissera payer un Compte sans âge, un autre bloquera.
- **Correction (AD-24) :** « Un Compte n'est utilisable pour payer, obtenir un Kit gratuit ou un Pass, ou envoyer une photo qu'une fois `profil.age_declare` saisi (vérifié dans `creer_commande`, `offrir_commande` et l'action d'envoi de photo : `KS_AGE_REQUIS`). Une déclaration < 13 ans refuse la création et supprime l'utilisateur Auth. `est_mineur` se calcule depuis l'âge déclaré et sa date de déclaration (ou l'année de naissance), pas depuis un booléen figé. La règle « jamais la ville » d'un Compte mineur est appliquée en base (contrainte ou fonction de publication), pas seulement dans l'écran. »

### R-8 — Scan hors ligne : la liste d'empreintes ne permet pas d'afficher nom et Type de pass
- **PRD :** FR-35 (le Scan affiche le nom, l'Événement et le Type de pass pour remettre le bon bracelet), FR-36.
- **Écart :** AD-12 fait télécharger « des empreintes SHA-256 des jetons et codes courts ». Hors ligne, l'appareil ne pourra afficher ni le Type de pass (bracelet Stand/VIP/Standard) ni le nom. Un builder ajoutera ces données, un autre non.
- **Correction (AD-12) :** « La liste hors ligne contient, par Pass `valide` : empreinte du jeton, empreinte du code court, Type de pass et nom du titulaire (données minimales, effacées de l'IndexedDB à `liberer_verrou` ou à la fin du jour de l'Événement). Les Pass émis ou annulés après la prise du Verrou ne sont pas connus de l'appareil : un Pass émis après est refusé hors ligne (« inconnu »), un Pass annulé après et scanné hors ligne crée une `anomalie` à `synchroniser_scans`. »

### R-9 — Paiement réussi qui arrive après la fin du Délai de paiement ou sur une Commande `echouee`
- **PRD :** FR-17 (« le système interroge l'Agrégateur » sans limite), FR-19 (Trop-perçu, Commande `echouee` que le client peut repayer), §8 R-6 (paiement perdu).
- **Écart :** (a) AD-10 arrête la réconciliation à la fin du Délai de paiement : une Tentative `inconnu` dont la notification n'arrive jamais restera indéfiniment `en_cours`, et un débit réel ne deviendra jamais Trop-perçu. (b) AD-4 cas 1 exige une Commande `en_attente` ; le cas 3 liste `payee`, `expiree`, `annulee` mais pas `echouee` : une réussite tardive d'une Tentative déclarée en échec n'a pas de règle. (c) Rien ne dit si `expirer_commande` attend la fin d'une Tentative `en_cours`.
- **Correction (AD-4, AD-10) :** « `confirmer_paiement` traite une Commande `echouee` non expirée comme `en_attente` (cas 1). `expirer_commande` expire même avec une Tentative `en_cours` ; la Tentative reste `en_cours`. `reconcilier-tentatives` continue d'interroger toute Tentative `en_cours` au-delà du Délai de paiement, chaque minute pendant 1 h puis toutes les heures pendant N jours (valeur dans `reglage`), puis crée une `anomalie` « Tentative sans état final ». » (Durée N à faire confirmer par Jonathan.)

---

## Moyenne

### R-10 — Opération « 10 pass gratuits » : compteur, éligibilité et Capacité non fixés
- **PRD :** FR-42, UJ-2, FR-12 (mineurs éligibles), Q-5.
- **Écart :** le spine ne cite FR-42 que via `offrir_commande`. Non fixé : compteur atomique (deux validations simultanées → 11 Pass), « Kit acheté » (un Kit gratuit `offerte` compte-t-il ? le PRD dit « acheté »), une seule récompense par Compte, quel Événement, effet si la Capacité est atteinte.
- **Correction (AD-3/AD-12) :** « La validation d'une Réalisation éligible appelle `offrir_pass_realisation(realisation, evenement)` qui, sous verrou, refuse si 10 Pass de l'opération existent déjà, si le Compte en a déjà un, si l'`acces_kit` du Kit de la Réalisation ne vient pas d'une Commande `payee` (Kit gratuit exclu), ou si la Capacité est atteinte ; sinon `offrir_commande` (type `pass`, Pass Standard). L'ordre est celui des validations. »

### R-11 — Kit gratuit : unicité, et Kit à 0 USD hors Panier
- **PRD :** FR-58, Glossaire « Kit gratuit », §6.2, FR-11.
- **Écart :** AD-11 crée `acces_kit` sans contrainte d'unicité explicite. Si elle existe, `confirmer_paiement` qui crée un accès déjà présent (Kit acheté deux fois via deux Commandes `en_attente`) lèvera une exception et annulera la validation d'un paiement réel. Rien n'interdit non plus de mettre un Kit à 0 USD dans le Panier (Prestataire avec 0 USD).
- **Correction (AD-11, AD-15) :** « `acces_kit` : `UNIQUE (compte, produit)` ; `confirmer_paiement` crée l'accès par `ON CONFLICT DO NOTHING` (le doublon payé devient une `anomalie` à rembourser à la main, jamais une erreur qui bloque `payee`). `offrir_commande` refuse un Kit déjà possédé. Un Kit à 0 USD ne peut ni entrer dans un Panier ni passer par `creer_commande` ; seul `offrir_commande` le délivre. »

### R-12 — Panier après `creer_commande`, et une seule Commande `en_attente` par Panier
- **PRD :** FR-13 (« le client qui revient est ramené à son Panier, avec les champs déjà saisis, et repart sur une nouvelle Commande »), FR-59 (panier abandonné, « arrêt dès le paiement »).
- **Écart :** non fixé : qui vide le Panier (`creer_commande` ou `confirmer_paiement`) ; que deviennent la réservation et la Commande `en_attente` précédente si le client modifie son Panier et recommence (double réservation du stock et du Plafond).
- **Correction (AD-15) :** « Le Panier reste intact jusqu'à `confirmer_paiement`, qui le vide. `creer_commande` à partir d'un Panier qui a déjà une Commande `en_attente`/`echouee` sans Tentative `en_cours` expire d'abord celle-ci (libère ses réservations) ; avec une Tentative `en_cours`, elle refuse (`KS_PAIEMENT_EN_COURS`). Les champs de remise saisis sont gardés sur le Panier. »

### R-13 — Commande déjà impossible à honorer : liste incomplète
- **PRD :** FR-19 (« article vendu entre-temps, Événement passé, Code promo épuisé »).
- **Écart :** AD-4 cas 1 liste stock, Capacité, Code promo ; il manque « Événement passé » (et, par cohérence, Produit dépublié).
- **Correction (AD-4) :** dans la parenthèse du cas 1, ajouter « Événement non commencé pour une Commande `pass` ».

### R-14 — Origine des ventes impossible à relier à une Commande
- **PRD :** FR-54 (« origine de la visite et de la vente »), SM-7 (ventes par origine), FR-12 (questions d'accueil).
- **Écart :** AD-19 stocke l'origine dans `evenement_mesure`, sans identifiant de Compte ni session persistante : « ventes par origine » ne peut pas se calculer depuis les tables métier, et chaque builder inventera son rattachement.
- **Correction (AD-19) :** « L'origine (UTM, Code promo, référent) captée à l'arrivée est rangée sur le `panier` (déjà identifié par son cookie fonctionnel, AD-15), puis copiée par `creer_commande` dans `commande.origine`. Les ventes par origine se calculent depuis `commande`. Aucun autre cookie. »

### R-15 — Remplacement (FR-26) sans modèle d'état
- **PRD :** FR-26 (réclamation sous 48 h, validation, retour, remplacement refabriqué si besoin), FR-49 (tâches), NFR-9.
- **Écart :** la Commande est `livree` et ne recule pas ; le spine ne dit pas comment un remplacement est suivi ni s'il consomme stock ou Plafond. Un builder créera une nouvelle Commande, un autre un statut sur `demande_client`.
- **Correction (AD-3) :** « Une réclamation est une `demande_client` (type `remplacement`) avec ses propres statuts (`demandee`, `validee`, `refusee`, `article_rendu`, `remplace`) changés par une fonction de transition journalisée ; la Commande reste `livree`. La date de livraison utilisée pour les 48 h est l'horodatage de la transition vers `livree` (`commande.livree_le`). »

### R-16 — Annulation et remboursement d'un Pass : montant, Stand, Commande offerte
- **PRD :** FR-38, FR-47 (réduction sur les Pass), FR-48.
- **Écart :** non fixé : base du remboursement (prix du Pass après réduction), un Stand s'annule-t-il par ses deux Pass ensemble, un Pass offert est-il annulable/remboursable, l'effet sur la commission. Pas de fonction `confirmer_remboursement_pass`.
- **Correction (AD-12/AD-3) :** « `annuler_pass` calcule et fige le montant à rendre = part payée du Pass (après réduction) × (1 − pourcentage figé, R-5) ; les deux Pass d'un achat Stand s'annulent ensemble ; un Pass d'une Commande `offerte` s'annule sans remboursement. `confirmer_remboursement` accepte une Commande ou un Pass (preuve obligatoire). Les Pass `annule`/`rembourse` sortent de la commission. »

### R-17 — Jour de l'Accès bénévole et « 48 h avant l'Événement » : fuseau et horaire
- **PRD :** FR-37 (« ne fonctionne que le jour de l'Événement »), FR-38.
- **Écart :** AD-23 compare en UTC avec `now()` ; « le jour » doit se calculer en heure de Goma, et l'Événement doit avoir une heure de début (`timestamptz`) pour les 48 h.
- **Correction (AD-23/AD-13) :** « `evenement.debut_le` et `fin_le` sont des `timestamptz`. L'Accès bénévole est valable de 00:00 à 23:59 `Africa/Lubumbashi` du jour de `debut_le` (`valide_du`/`valide_au` calculés ainsi à la création). La limite d'annulation de Pass est `debut_le − 48 h`. »

### R-18 — Statuts non nommés pour les autres tables à états
- **PRD :** FR-17/FR-19 (Tentative), FR-44 (envoi), FR-25/FR-26/FR-38 (demandes), FR-41 (photos), Trop-perçu (Glossaire).
- **Écart :** AD-14 fixe les statuts de Commande et de Pass mais pas ceux de `tentative_paiement`, `envoi`, `demande_client`, `photo_galerie`, `trop_percu`, `anomalie`. AD-5 utilise `en_cours`, AD-9 `envoye`/`echec` : orthographes à fixer avant que plusieurs stories les écrivent.
- **Correction (AD-14) :** ajouter les enums : Tentative `en_cours`, `reussie`, `echouee_client`, `echouee_prestataire` ; Envoi `a_envoyer`, `envoye`, `echec`, `abandonne` ; `trop_percu` `a_rembourser`, `rembourse` (preuve) ; `photo_galerie` `en_attente`, `publiee`, `refusee`, `retiree` ; `demande_client` cf. R-15.

### R-19 — `commande` doit porter le Prestataire et la Référence retenus
- **PRD :** FR-19 (« Chaque Commande enregistre le Prestataire, la Référence de transaction, le montant et la devise effectivement encaissés »), CLAUDE.md règle 2.
- **Écart :** AD-4/AD-8 les rangent seulement dans `tentative_paiement`. Les vues (filtre par Prestataire, FR-49) joindront de façons différentes.
- **Correction (AD-4) :** « `confirmer_paiement` écrit `commande.tentative_reussie_id` (unique), d'où se lisent prestataire, référence, montant et devise reçus. »

### R-20 — Sous-titres et transcriptions : emplacement et garde de publication
- **PRD :** FR-29 (WebVTT FR, EN si vendu sur /en ; transcription téléchargeable avec les Fichiers de kit), FR-50 (publication refusée sans sous-titres), Q-15.
- **Écart :** AD-11 dit « servis par le même contrôle » sans dire où ils vivent (pistes de la bibliothèque Bunny privée ou `kits-private`) ; la garde de publication n'est pas posée ; Q-15 absente des Questions ouvertes du spine alors qu'elle conditionne cette garde.
- **Correction (AD-11) :** « Les sous-titres WebVTT sont des pistes de la vidéo dans la bibliothèque Bunny privée (lues sous le même jeton) ; la transcription de chaque chapitre est un `fichier_kit` de type `transcription` dans `kits-private`. La publication d'un Kit est refusée en base sans Fichier de kit, sans vidéo, ou sans piste `fr` (et `en` selon Q-15). » Ajouter Q-15 au tableau des Questions ouvertes (bloque la story Vidéo de kit).

### R-21 — Remise : contrôle serveur du couple Zone / Mode
- **PRD :** FR-13, Glossaire « Mode de remise » (retrait à Goma uniquement ; Bukavu livraison obligatoire ; aucun champ pour un Panier 100 % numérique).
- **Écart :** AD-8 fige le Forfait mais ne dit pas que `creer_commande` refuse un retrait à Bukavu ou une remise sur un Panier 100 % numérique.
- **Correction (AD-8) :** « `creer_commande` refuse (`KS_REMISE_INVALIDE`) : remise absente avec un Produit physique, remise présente sur un Panier 100 % numérique, `retrait` hors Goma ; Forfait = 0 pour `retrait`. »

---

## Basse

### R-22 — « Aucun statut ne recule » vs `echouee → en_attente`
- **PRD :** Glossaire « Statut de commande », FR-24. AD-3 écrit les deux. Préciser : « aucune transition manuelle de l'Admin ne recule ; `echouee → en_attente` est la seule boucle, par `demarrer_tentative` ». Idem : `offerte → livree` « automatique » doit être faite par `offrir_commande` (nommer la fonction).

### R-23 — Trop-perçu et anomalie sans fonction de transition
- AD-3 ne nomme pas la fonction qui passe un `trop_percu` à `rembourse` avec preuve (FR-49 « Trop-perçus à rembourser »). Ajouter `confirmer_remboursement_trop_percu` (ou étendre `confirmer_remboursement`) et `traiter_anomalie`.

### R-24 — Photos envoyées par les clients : chemin de téléversement
- **PRD :** FR-40. AD-18 ne règle que les téléversements admin. Préciser : « le client téléverse vers `galerie-attente` par autorisation signée serveur (même mécanisme qu'AD-18, taille et type limités, `consommer_essai`) ; à la validation, copie vers `produits-public` ; au retrait, suppression + `revalidateTag('accueil')`. » Ajouter cette dérogation à la liste d'AD-2.

### R-25 — Alerte événement : langue et limite des Emails commerciaux
- **PRD :** FR-32, FR-59. Dire si l'annonce d'un Événement aux inscrits compte comme Email commercial (limite de 2 jours) et quelle langue pour un inscrit sans Compte (`alerte_evenement.langue` à l'inscription).

### R-26 — « Vidéo terminée » à définir une fois
- **PRD :** FR-59 (rappels de Kit), SM-8, FR-54. Fixer dans le module `bibliotheque` une seule fonction `kit_demarre`/`kit_termine` (ex. dernier chapitre vu à ≥ 90 %) utilisée par les Relances et les indicateurs.

### R-27 — Polar : montant reçu et produits Polar
- **PRD :** §4.4 point 3, CLAUDE.md règle 10, Q-3. Ajouter à AD-5 : « l'adaptateur Polar ne crée ni ne référence que des produits Polar de Famille `kit` ; le montant est celui de `commande.total_cents` ». À traiter dans Q-A3 : Polar (marchand officiel) peut ajouter des taxes au montant débité ; la règle de comparaison ne doit pas en faire un Trop-perçu systématique.

### R-28 — Nom du bucket public et documents amont à aligner (pas une contradiction du spine)
- `docs/guide-koma-shop.md` l. 365 nomme le bucket `products-public`, le spine `produits-public` (AD-14 donne raison au spine : le guide est à corriger). La copie de CLAUDE.md dans le guide (l. 286, 299) et le PRD (NFR-4, Q-8) décrivent encore les vidéos dans `kits-private` : décision Bunny Stream actée au memlog ; à propager au PRD par un correct-course.

---

## Vérifié sans écart (pour mémoire)

Règles 1-3, 9-11, 13 ; idempotence par référence ; une Tentative en cours ; `inconnu` jamais échec ; Polar exclu des Paniers mixtes et des Pass ; « Carte indisponible » ; Code promo (premier achat, `offerte` exclue, hors livraison, un seul) ; Email commercial (consentement, désinscription, 2 jours) ; Accès bénévole limité au Scan ; droits Assistant en RLS dès le lancement ; Verrou hors ligne unique et libération forcée ; QR non devinable ; filigrane PDF ; liens signés ; Article sans EN absent de /en ; brouillons introuvables ; mesure sans cookie ; textes hors code. Écarts dus au memlog (Hostinger, Bunny Stream, branche `production`, contrôle du montant, montant insuffisant) : acceptés.
