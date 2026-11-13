---
title: '9.12 Accueils selon la connexion'
type: 'feature'
created: '2026-11-13'
status: 'done'
baseline_commit: 'd5e4e9e9697a74349a227c9602e47121f80e6261'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-KOMA SHOP-2026-10-16/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** tout le monde arrive sur le même accueil. Le visiteur doit voir la maquette « fusion » à l'image près ; le client connecté doit retrouver ses commandes, kits et Pass ; l'admin doit arriver directement sur l'admin.

**Approche :** trois arrivées. (1) Visiteur sur /fr et /en : la maquette `docs/design/maquette-accueil/` (fusion-creme.png, fusion-sombre.png, fusion.html), en Barlow / Barlow Condensed, en-tête compris. (2) Client connecté : son espace personnel /[locale]/compte, avec en dessous « Découvrir la boutique » (l'ancien accueil sans son grand héros). (3) Admin : /[locale]/admin. Le proxy redirige depuis /fr, /en (et /compte pour l'admin) selon le rôle lu dans le jeton ; la connexion sans retour précis mène au même endroit.

## Boundaries & Constraints

**Always :**
- Visiteur : positions, tailles, marges, couleurs, ordre et textes de fusion.html à 1440 px ; images et cartes lues en base ; 375 px en une colonne sans défilement horizontal ; sans produit publié, centrage de la partie B. Polices : Barlow et Barlow Condensed uniquement.
- Espace personnel : a. « Bonjour [pseudo] » et initiales ; b. Mes commandes (numéro, date, montant, statut, lien) ; c. Mes kits (image, titre, « Reprendre » au bon chapitre via progression_video, « Télécharger les fichiers ») ; d. Mes Pass (événement, type, date, QR code, statut) ; e. Mes événements à venir puis passés (lien galerie quand elle existe) ; f. accès rapides Envoyer une photo, Préférences, Se déconnecter ; g. « Découvrir la boutique » (blocs de BlocsAccueil, sans héros). Blocs en tableau ou grille de cartes ; bloc vide = message simple et lien utile. Lecture serveur à chaque requête, données de la personne seulement, aucun cache partagé. 375 px : blocs empilés.
- Admin connecté : /fr, /en, /compte → /[locale]/admin. Le lien « Voir le site » de la barre latérale reste et mène aux pages publiques (pas de boucle).
- Retour précis (panier, commande, etc.) prioritaire sur l'arrivée par défaut ; chemin de retour toujours validé par `cheminRetourValide`.
- Les vraies barrières restent côté serveur (`exigerAdminPage`, `exigerConnectePage`) : la redirection du proxy n'est qu'un aiguillage.
- Textes en fr et en dans messages/*.json ; metadata non indexable sur /compte.

**Never :** aucune police, image ou logo de la maquette ajouté au dépôt ; aucune donnée TEST_ laissée sur koma-dev ; aucune requête base par page dans le proxy pour le rôle ; aucune redirection d'une personne déconnectée vers la connexion depuis une page publique.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Résultat attendu |
|---|---|---|
| Visiteur | GET /fr | Accueil maquette, 200 |
| Client | GET /fr ou / | 307 → /fr/compte, no-store |
| Admin | GET /en ou /en/compte | 307 → /en/admin |
| Admin | GET /fr/cosplays (via « Voir le site ») | 200, pas de redirection |
| Connexion sans retour | client / admin | /[l]/compte / /[l]/admin |
| Connexion avec retour=/fr/panier | tout rôle | /fr/panier |
| Jeton sans revendication de rôle (crochet absent) | admin | traité comme client : /compte ; l'admin reste joignable |
| Session expirée (9.14) | GET /fr | page visiteur, aucune redirection |
| Lecture d'un bloc en erreur | base muette | message d'erreur du bloc, les autres blocs s'affichent |

## Décisions (Jonathan, 2026-11-13)

1. **Rôle dans le proxy :** crochet Supabase « Custom Access Token » qui ajoute `koma_role` (admin | assistant) au jeton. Le jeton ne sert qu'à rediriger : admin, scan et compte gardent leur vérification serveur. Crochet non activé (revendication absente) : le proxy ne redirige pas selon le rôle, sans erreur. Étapes d'activation koma-dev données à Jonathan ; étapes production notées dans la story 9.9.
2. **Assistant :** arrive sur /[l]/admin/commandes et est traité comme l'admin par le proxy. **Bénévole :** à la connexion sans retour, /[l]/scan s'il a un accès de scan valide maintenant, sinon /[l]/compte ; pas de redirection par le proxy ; carte « Scanner les Pass » dans ses accès rapides tant que l'accès est valide.
3. **Pseudo :** nom Google (métadonnées full_name / name) s'il existe, sinon la partie avant @ de l'email. Futur champ pseudo noté dans deferred-work.md.
4. **En-tête visiteur :** à droite du Panier, un bouton rond « compte » (icône personne ; nom accessible « Se connecter » pour un visiteur, « Mon compte » pour un connecté) qui ouvre un petit menu : Se connecter (ou Mon espace / Se déconnecter), Thème sombre, English. Cible 44 px, clavier, Échap ferme et rend le focus. L'en-tête reste sinon identique à la maquette.
5. **Lectures :** réutiliser les lectures existantes de Mon compte (session vérifiée, filtrées par l'identifiant du Compte), rendu à la demande, sans cache partagé.

</frozen-after-approval>

## Code Map

- `src/proxy.ts` -- `getClaims()` déjà appelé ; bloc « Personne connectée sur l'accueil public » qui envoie aujourd'hui vers `/accueil` : à remplacer par l'aiguillage selon le rôle (+ /compte pour l'admin).
- `src/app/[locale]/accueil/page.tsx` -- accueil des connectés de la décision du 2026-11-12, rendu caduc : à supprimer (et son test, sa mention dans EXPERIENCE.md).
- `src/app/[locale]/page.tsx`, `src/components/accueil/BlocsAccueil.tsx`, `HerosAccueil.tsx`, `hero-visiteur.css` -- page visiteur déjà proche de la maquette ; polices remises à `--font-corps` / `--font-condensee`. `BlocsAccueil` gagne une variante « boutique » (sans héros) ; `HerosAccueilAncien`, `MediaHerosAncien` sont supprimés s'ils ne servent plus.
- `src/components/layout/EnTete.tsx` (modifié) -- en-tête de la maquette sur la page visiteur.
- `src/app/[locale]/compte/page.tsx` -- aujourd'hui redirige vers la bibliothèque ; devient l'espace personnel. `compte/layout.tsx` : la navigation et le H1 « Mon compte » restent pour les sous-pages, pas sur l'espace personnel (H1 = « Bonjour … »).
- Lectures à réutiliser : `lireBibliotheque`, `lireProgressions` (`src/modules/bibliotheque/queries.ts`), `listerMesPass` (`src/modules/evenements/pass-queries.ts`), `ListeCommandes` (`src/components/commande/ListeCommandes.tsx`), `CodeQrPass`, `lienGalerieAffichable`, `BoutonDeconnexion`, `lireSessionVerifiee`.
- `src/lib/auth/retour.ts` -- `cheminRetourValide` : renvoie aujourd'hui `/${locale}` par défaut ; ajouter un indicateur « par défaut » pour que la connexion (`connexion/page.tsx`, `FormulaireConnexion`, `auth/callback/route.ts`) choisisse /compte ou /admin.
- `src/lib/auth/droits.ts` -- `lireRole` (base, source de vérité) inchangé.

## Tasks & Acceptance

**Exécution :**
- [x] `supabase/migrations/<nouvelle>_crochet_role_jeton.sql` -- fonction du crochet (lecture de `role_utilisateur`, admin puis assistant), droits limités à `supabase_auth_admin` ; test SQL. Étapes d'activation dans la 9.9 (epics.md).
- [x] `src/lib/auth/arrivee.ts` -- fonction pure `arriveeParDefaut(role, locale)` et lecture de `koma_role` dans les revendications ; tests unitaires.
- [x] `src/proxy.ts` -- aiguillage selon le rôle ; tests de `tests/unit/proxy-*.test.ts` mis à jour.
- [x] connexion (page, formulaire, callback Google) -- destination par défaut selon le rôle.
- [x] `src/app/[locale]/compte/page.tsx` + `src/components/compte/espace/*` -- les blocs a à g, états vides et états d'erreur ; messages fr/en.
- [x] `src/components/accueil/*`, `EnTete.tsx`, `hero-visiteur.css` -- fidélité à la maquette en Barlow ; suppression de /accueil.
- [x] `tests/e2e/accueils.spec.ts` -- captures 1440 clair/sombre, côte à côte avec la maquette, dans `docs/captures-accueil/` ; espace personnel 1440 et 375 ; arrivée admin.
- [x] Docs : EXPERIENCE.md, epics.md (story 9.12), sprint-status.yaml.

**Critères d'acceptation :**
- Étant donné les captures 1440 px clair et sombre, quand on les place à côté de fusion-creme.png et fusion-sombre.png, alors il ne reste aucun écart visible autre que les polices Barlow et les vraies images.
- Étant donné un client connecté avec une commande, un kit et un Pass TEST_, quand il ouvre /fr, alors il voit son espace personnel avec les blocs remplis ; sans données, chaque bloc affiche son message et son lien.
- Étant donné un admin, quand il se connecte sans retour, alors il arrive sur /fr/admin.
- Étant donné les données TEST_ créées pour les captures, quand les captures sont faites, alors elles sont supprimées de koma-dev.

## Spec Change Log

## Review Triage Log

Revue du 2026-11-13 (diff 9.12 + 9.14 depuis d5e4e9e) : Blind Hunter, Edge Case Hunter, Verification Gap, sécurité des redirections, accessibilité, fidélité visuelle.

| Constat | Verdict | Preuve / route |
|---|---|---|
| Liens de l'en-tête et Panier en Barlow alors que la maquette est en `.cond` | medium | fusion.html l. 97 `<ul class="cond">` ; patch (Barlow Condensed 400) |
| Double espacement Panier / bouton rond (25 px) | low | margin-left + gap ; patch |
| `--hv-gris` non redéfini en sombre (≈3:1) | high | règle 7 ; patch #a39c90 |
| Petit texte rouge 11 px (< 4,5:1) | high | règle 7 et DESIGN.md « rouge en texte : grands textes seulement » ; patch : couleur du texte |
| En-tête absolu recouvre les bandeaux (focus masqué) | high | layout : bandeaux avant l'en-tête ; patch position relative |
| Cibles < 44 px (liens, Panier, « Voir le kit ») | medium | DESIGN.md touch-target ; patch zone étendue sans changer le rendu |
| « Voir le site » renvoyé vers /admin par le proxy | high | NavigationAdmin href="/" ; patch `/?vue=site` |
| /en/checkout non protégé après expiration (9.14) | high | adresses.ts en `/checkout` ; patch |
| Expiration jusqu'à 60 s trop tôt | low | cookie réécrit 1×/min ; patch |
| Cookie d'activité 30 j : au-delà, session « reposée » | medium | maxAge ; patch 400 j |
| signOut en échec : requête en cours encore authentifiée | medium | NextResponse.next figé avant suppression ; patch |
| Test « / » avec accept-language en cookie | low | test mal construit ; patch |
| reglage.test.sql rouge (nouvelle clé publique) | high | CI SQL ; patch |
| Réglage 1–24 sans test (zod, SQL) | medium | patch |
| `avecArrivee` sans test ; locale prise de `entree.langue` | medium | patch |
| Messages d'expiration (connexion, bandeau) sans test ; message affiché à une personne connectée | medium | patch |
| Bandeau : région live montée avec le texte, focus perdu à la fermeture | medium | WCAG 4.1.3, 2.4.3 ; patch |
| galerieUrl sans test | low | patch |
| AccesRapidesEspace sans try/catch | medium | une erreur casse la page ; patch |
| « Reprendre » : texte visible absent du nom accessible ; lang manquant | low | 2.5.3, 3.1.2 ; patch |
| Hiérarchie des titres sous « Découvrir la boutique » | medium | 1.3.1 ; patch |
| Déconnexion dans le panneau rond : focus perdu ; Échap global | medium | 2.4.3 ; patch |
| Étiquette des cartes du héros hors du nom accessible | low | 2.5.3 ; patch |
| Navigation des rubriques sans 44 px | low | patch |
| Commentaire périmé page.tsx | low | patch |
| Crochet : `usage on schema public` manquant | false | `has_schema_privilege('supabase_auth_admin','public','usage')` = true sur koma-dev |
| Nom « Se connecter » du bouton rond ambigu | false | nom décidé par Jonathan (décision 4) |
| Étiquettes des cartes en blanc + ombre (maquette : encre) | false | écart volontaire : lisibilité sur vraie photo (règle 7) |
| Mot géant, H1, surtitre plus étroits | false | police Barlow, écart accepté |
| Toute requête compte comme activité (préchargements) | false | intent 9.14 « toute requête reçue compte comme activité » |
| Compte incomplet renvoyé de / vers /compte puis la connexion | low | rejeté : la personne doit finir son profil ; aucune boucle |
| Session lue trois fois sur /compte | low | rejeté : coût négligeable |
| Cookie d'activité supprimable ou forgeable (contournement) | medium | defer : l'intent 9.14 pose le cookie quand il manque ; signature HMAC + heure de connexion à décider |
| Rôle retiré mais encore dans le jeton : 404 sur /admin ≤ 1 h | low | defer |
| Redirections du proxy fondées sur l'en-tête Host | low | defer (vérifier derrière Hostinger, 9.9) |
| Cadre de 900 px à hauteur fixe, texte coupé si espacement augmenté | low | defer (1.4.12) |
| Rouge #D7261E de la maquette au lieu de #E3261C | maybe-false | décision citée dans le CSS (2026-11-12) mais absente de DESIGN.md : à confirmer par Jonathan |

## Verification

**Commandes :** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` (succès), `npm run test:e2e -- accueils` (succès) ; CI verte après le push.

**Vérifications à la main :** comparer les images de `docs/captures-accueil/` ; navigation au clavier sur l'espace personnel.
