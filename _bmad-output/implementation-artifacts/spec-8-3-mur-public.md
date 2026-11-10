---
title: 'Story 8.3 : Mur public'
type: 'feature'
created: '2026-11-10'
status: 'done'
baseline_commit: '11eab8b'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/epics.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le mur "Ils le portent" n'est pas encore rendu cote public. Les stories 8.1 (envoi), 8.2 (validation / depot WhatsApp / retrait) et 8.4 (Realisation) ont construit le circuit : accord, validation, publication, retrait, declaration de Kit. La preparation de la story 8.3 a pose public.lister_mur_public (SECURITY DEFINER, execute anonyme et authenticated), les textes alternatifs FR/EN obligatoires a la validation, et la garde AD-3 (liste blanche des lectures publiques). Il manque l'affichage : le visiteur n'a rien a regarder.

**Approach:** Le bloc 4 "Ils le portent" de l'accueil (#galerie) devient le mur : lecture via lister_mur_public sur le client public, cache ETIQUETTES.galerie, grille de photos avec mention "Fait avec un kit KOMA" et lien Kit, pagination "Voir plus" (modele blog 8.7). Les liens "Galerie" du pied de page et du menu burger naissent des le moment ou une photo est publiee et menent a l'ancre #galerie.

## Boundaries et contraintes

**Toujours:**

- Seules les photos publiees et non retirees sont rendues : statut = 'publiee', fichier_public not null, publiee_le not null, retiree_le null, retrait_demande_le null, alt_fr et alt_en presents (contraignant de la base), Compte majeur (ou sans Compte) et accord de publication actif. Une photo en attente, refusee ou retiree n'est jamais mise en avant ; une photo dont le retrait est demande quitte le mur aussitot.
- Une Realisation est une photo dont la ligne realisation.validee_le est non nulle ; fait_avec_kit vaut vrai et la mention "Fait avec un kit KOMA" s'affiche. Le lien vers le Kit est pose seulement si kit_slug est non nul (Kit publie verifie en base ; sinon mention sans lien).
- Colonnes rendues par lister_mur_public : id, fichier, alt_fr, alt_en, pseudo, valide_le, type ('photo' | 'realisation'), fait_avec_kit, kit_slug, kit_titre_fr, kit_titre_en, curseur_date. Colonne fermee : jamais Compte, email, age, commande ni fichier original.
- pseudo peut etre null : sans pseudo, rien n'est affiche (pas de repli).
- kit_titre_en peut etre null : le titre FR est affiche.
- Limite de la page : bornee de 1 a 24 (le serveur borne deja) ; tri valide_le desc, id desc ; curseur de la page suivante = (valide_le, id) de la derniere ligne vue, curseur_date en ISO UTC (microsecondes) ; curseur absent/invalide/incomplet -> premiere page ; suite null quand il n'y a plus de page.
- Cache : la lecture publique s'abonne a cacheTag(ETIQUETTES.galerie) (src/lib/cache/etiquettes.ts) ; l'admin invalide deja ce tag a chaque validation et retrait.
- Image : urlPhotoPublique(fichier) (src/lib/supabase/stockage.ts) — adresse du bucket public produits-public (galerie/<uuid>.<ext>). Rien d'autre.
- Texte alternatif : dans la langue de la page (FR -> alt_fr, EN -> alt_en, repli sur l'autre en cas de vide). Microcopie : aucun texte visible en dur hors des fichiers de traduction.

**Jamais:**

- Nouvelle migration, nouvelle fonction SQL, nouvelle vue ou nouvelle policy RLS pour la lecture du mur : utiliser uniquement public.lister_mur_public.
- Page Galerie dediee : le mur est le bloc 4 de l'accueil, ancre #galerie, avec liens en pied de page + entree secondaire du menu. Masques tant qu'aucune photo n'est publiee.
- Affichage d'un fichier original, d'un Compte, d'un email, d'un age, d'une commande, d'une photo en attente / refusee / retiree, ou d'un Kit non publie.

## Matrice I/O et cas limites

| Scenario | Entree / Etat | Sortie attendue | Traitement erreur |
|---|---|---|---|
| Aucune photo publiee | mur vide | Bloc 4 et liens Galerie masques | N/A |
| Une ou N photos publiees | page 1 de lister_mur_public | Grille, mentions, lien Kit | erreur de lecture -> bloc masque (jamais liste vide inventee) |
| Pagination | suite non nulle | "Voir plus" charge la suite ; adresse /<locale>?curseur=... | curseur invalide -> premiere page |
| Pagination | suite null | Plus de "Voir plus" | N/A |
| Realisation validee, Kit publie | fait_avec_kit = true, kit_slug non nul | Mention + lien Kit | N/A |
| Realisation validee, Kit non publie | fait_avec_kit = true, kit_slug null | Mention seule, pas de lien | N/A |
| Retrait / accord retire / mineur | photo retiree ou accord ferme | Disparaît du mur (cache galerie) | N/A |

## Cartographie du code

- supabase/migrations/20261231220000_mur_public.sql + 20261231230000_mur_public_correctifs.sql : lister_mur_public (ready).
- src/modules/communaute/queries.ts (nouveau) : lecture publique listerMurs.
- src/modules/communaute/adresse.ts (nouveau) : curseur mur.
- src/modules/communaute/voir-plus.ts (nouveau) : action chargerPlusMurs.
- src/modules/communaute/types.ts : types MurPublic, PageMur.
- src/components/accueil/BlocMur.tsx (+ liste client + Voir plus) ; rendu via src/modules/accueil/blocs.ts et src/app/[locale]/page.tsx.
- src/components/layout/PiedDePage.tsx, navigation : liens #galerie conditionnels.
- messages/fr.json, messages/en.json : cles Accueil.mur.*.
- tests/unit/*, tests/e2e/accueil.spec.ts.

## Taches et criteres d'acceptation

**Execution:**

- [ ] Lecture publique branchee sur lister_mur_public (client public), cacheTag(ETIQUETTES.galerie), curseur conforme.
- [ ] Bloc 4 "Ils le portent" : grille, photos, mention, lien Kit, "Voir plus", etats vides.
- [ ] Liens "Galerie" (pied + menu) masques sans photo publiee.
- [ ] Messages FR/EN des nouveaux textes.
- [ ] Tests unitaires + e2e.

**Criteres d'acceptation:**

- Given au moins une photo publiee, when l'accueil s'affiche, then le bloc 4 "Ils le portent" (ancre #galerie) montre les photos publiees (FR-2, FR-40, UX-DR19).
- Given aucune photo publiee, then le bloc 4 et les liens Galerie du pied de page et du menu sont masques ; des le moment ou une premiere photo existe, ils apparaissent et mènent a #galerie.
- Given une Realisation validee, then la mention "Fait avec un kit KOMA" est affichee et le lien vers le Kit n'est pose que si le Kit est publie.

## Notes d'implementation

- La fonction a ete choisie plutot qu'une vue : photo_galerie n'a aucun droit client (RLS sans politique) ; une vue ouverte a anon devrait tourner avec les droits de son proprietaire (security definer view rejetee par le controle de securite de Supabase) et ne pourrait ni plafonner la limite ni porter la pagination.
- Le curseur du mur suit le meme format que le blog (valide_le ISO UTC horodatage + identifiant + nombre affiche), validation identique : un curseur invalide renvoie a la premiere page.
- "Voir plus" : meme composant VoirPlus (catalogue) avec textes propres (Accueil.voirPlus) ; Server Action qui recharge la suite ; replaceState pour refleter l'adresse ; focus sur la premiere carte ajoutee.

## Spec Change Log

- 2026-11-10 : reprise par Claude sur `main` (OpenCode n'a plus de crédits ; le travail non commité du worktree voie 2 a été repris).
- Corrections par rapport au travail d'OpenCode : import par défaut de `next/image` (EnTete) ; « Voir plus » : la fonction plafonne la page à 24 lignes, une page pleine est donc suivie d'une lecture d'une ligne pour savoir si une suite existe (jamais de « Voir plus » devant une liste vide) ; curseur construit sur `curseur_date` ; le lien « Voir plus » suit l'état (disparaît après la dernière page) ; ancre `section#galerie` ; liens « Galerie » du pied de page et du ☰ vers `/#galerie` (`Link` i18n, valables depuis toute page) ; mention « Fait avec un kit {nomSite} » aussi sur la tuile ; focus rendu à la tuile ouverte ; textes de « Voir plus » = ceux du catalogue (déjà approuvés) ; textes EN sans source (titre du mur, mention, « Galerie ») = `[Texte à fournir]` (FR sourcés : EXPERIENCE.md:75, 79, 103, 241 ; epics.md:2323).
- Revue (sous-agent) : `BlocMur` capte l'erreur de lecture (bloc masqué, accueil jamais en erreur) ; seule la première page (sans curseur) est en cache (`listerMurs`), tout curseur venu du navigateur passe par `lireMurs` sans cache (un curseur forgé ne gonfle pas le cache) ; `?curseur=` est lu par `BlocMur` (sous Suspense) et montre les entrées qui suivent le curseur ; « Voir plus » avec JavaScript ajoute sur place sans réécrire l'adresse (recharger montre la première page) ; `alt=""` sur l'image du dialogue (le titre porte déjà le texte) ; `sizes="50vw"`. Plafond de 1 200 entrées cumulées par curseur : au-delà, plus de « Voir plus » (noté).
- Non fait, noté dans deferred-work : la ville n'est pas affichée (epics.md 8.3 la prévoit si autorisée, jamais pour un mineur) car `lister_mur_public` ne la renvoie pas et la spec interdit une nouvelle migration.

## Review Triage Log

## Verification

**Commands:**

- npm run lint, npm run typecheck, npm test, npm run build -- sans erreur ; CI (pgTAP, e2e) verte
</frozen-after-approval>
