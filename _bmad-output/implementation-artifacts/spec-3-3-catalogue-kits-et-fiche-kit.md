---
title: 'Story 3.3 : catalogue Kits et fiche Kit'
type: 'feature'
created: '2026-10-31'
status: 'done'
baseline_commit: '0df345ef41e494db0bf58705372355d63c241ac1'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Un Kit publié (3.2) n'est visible nulle part : ni catalogue, ni fiche, ni plan du site ; le visiteur ne peut pas savoir ce que contient un Kit ni s'il saura le fabriquer.

**Approach:** Catalogue `/kits` (fonctionnement de la 2.4 + filtre de niveau), rubrique Kits dans l'en-tête et le menu, fiche `/kits/[slug]` (photos, prix, niveau, matériel, fichiers, plan des chapitres, résumé de la Licence de kit, extrait public lisible au clavier et sous-titré), SEO complet. Côté admin, l'extrait reçoit ses propres sous-titres (décision de Jonathan du 2026-10-31).

## Boundaries & Constraints

**Always:** Nouvelle migration datée après `20261102100000` ; règles d'écriture des stories précédentes. Aucune donnée d'exemple. Aucun texte en dur hors `messages/{fr,en}.json`.
Sous-titres de l'extrait (décision de Jonathan) : sur la fiche d'édition, sous l'extrait, une case « Extrait sans parole » (décochée par défaut). Décochée : un `.vtt` FR est obligatoire pour publier un Kit qui a un extrait, l'EN est facultatif ; cochée : aucun sous-titre d'extrait exigé. Les sous-titres FR de la vidéo complète restent obligatoires dans tous les cas. Envoi : fichier `.vtt` de 512 Ko au plus transmis au serveur (Server Action, sous la limite de corps par défaut), vérifié par `verifierWebVtt`, puis déposé dans les sous-titres de la vidéo d'extrait chez Bunny (bibliothèque publique, API captions documentée par Bunny : `POST /library/{bibliotheque}/videos/{video}/captions/{langue}` avec le fichier en base64 ; suppression par `DELETE` sur la même adresse), enfin enregistré en base. Colonnes ajoutées à `video_kit` : `extrait_sans_parole boolean not null default false`, `extrait_sous_titres text[]` (langues `fr`/`en` déposées chez Bunny), `extrait_le timestamptz` (posé à l'enregistrement de l'extrait). Remplacer ou retirer l'extrait vide ses sous-titres. `manques_publication` ajoute `sous_titres_extrait_fr` quand un extrait existe, n'est pas « sans parole » et n'a pas de FR ; la garde différée existante couvre la mise à jour de `video_kit`. Fonctions : `enregistrer_sous_titres_extrait_kit(p_auteur, p_produit_id, p_langue)`, `supprimer_sous_titres_extrait_kit(…)`, `definir_extrait_sans_parole(p_auteur, p_produit_id, p_valeur boolean)`.
Catalogue : `lister_catalogue` recréée (drop + nouveau grant) avec `p_niveau` ; famille inconnue refusée (`KS_FAMILLE_INVALIDE`) ; pour un Kit, pas de filtre de disponibilité et disponibilité `disponible`. Adresse `/kits` identique en FR et EN (`ADRESSES`), paramètres `?univers&prix&niveau&tri&curseur`, cartes avec prix USD et niveau, « Voir plus » par 12, noindex avec filtre, canonique, BreadcrumbList. Rubrique Kits dans `rubriques.ts` (en-tête et menu ☰). Sitemap : `/kits` et les fiches de Kits publiés ; le proxy 404 reconnaît `/kits/<slug>`.
Fiche Kit : lecture publique (client public, RLS) de `produit`, photos, `fichier_kit` (nom dans la langue, format, taille lisible), `chapitre_kit` (ordre, titre dans la langue, instant), langues de `sous_titre_kit`, `video_kit` (extrait, sous-titres d'extrait, sans parole) ; jamais une table `_prive`. Sous `/en`, si la vidéo complète n'a pas de sous-titres anglais : mention « English subtitles are not available for this kit ». Résumé de la Licence de kit (d'après la définition du PRD : usage personnel ; ni revente, ni partage, ni diffusion des fichiers ou de la vidéo). Extrait : HLS `https://<NEXT_PUBLIC_BUNNY_PUBLIC_CDN_HOSTNAME>/<extrait>/playlist.m3u8` par `hls.js` (version exacte épinglée ; lecture native si le navigateur sait lire le HLS), contrôles natifs (clavier), `<track>` par langue d'extrait (`/<extrait>/captions/<langue>.vtt`), piste par défaut dans la langue de l'interface, affiche `thumbnail.jpg`, aucune lecture automatique ; CSP `connect-src` élargie à l'hôte CDN public (et `blob:` pour `media-src` si nécessaire). Pas de bouton d'achat (epic 4) ni d'obtention (3.5). Métadonnées, Open Graph (1re photo), JSON-LD Product + Offer (prix USD, InStock, sans `aggregateRating` ni `review`), VideoObject quand un extrait existe (nom, description, `thumbnailUrl`, `uploadDate` = `extrait_le`, `contentUrl`), BreadcrumbList, bouton Partager existant. 375 px, contraste, alt sur chaque image.

**Never:** Pas de lecteur à chapitres ni de jeton CDN privé (3.7) ; pas de double option, de Kit lié sur les fiches physiques ni de tuile Kits à l'accueil (3.4) ; pas d'obtention ni d'accès (3.5) ; pas d'achat ; aucune lecture des tables `_prive` ni de `BUNNY_PRIVE_*` par les pages publiques ; pas de modification d'une migration appliquée.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Catalogue | 13 Kits publiés | 12 cartes, « Voir plus » | N/A |
| Filtre niveau | `?niveau=debutant` | Kits Débutant seulement, adresse conservée, noindex | N/A |
| Niveau inconnu | `?niveau=xyz` | paramètre ignoré | N/A |
| Fiche inconnue | `/fr/kits/absent` | 404 traduite | N/A |
| Kit sans extrait | fiche | pas de lecteur, pas de VideoObject | N/A |
| Sans EN sous `/en` | vidéo complète sans `.vtt` EN | mention affichée | N/A |
| Extrait parlé sans FR | publier | refusé, manque `sous_titres_extrait_fr` | `KS_PUBLICATION_INCOMPLETE` |
| Extrait sans parole | case cochée, aucun `.vtt` d'extrait | publiable | N/A |
| `.vtt` d'extrait invalide | sans `WEBVTT` | refusé, rien chez Bunny | `format_invalide` |
| Bunny indisponible | dépôt du `.vtt` | rien enregistré | `bunny_indisponible` |
| HTML de la fiche | rendu | aucun `kits-private`, aucun identifiant de bibliothèque ou vidéo privée | N/A |

</frozen-after-approval>

## Code Map

- SQL : `lister_catalogue` en vigueur `supabase/migrations/20261029100000_stock_non_expose.sql:78-171` (11 paramètres, grant l.170) ; `video_kit`, `manques_publication`, `enregistrer_extrait_kit` dans `20261102100000_kits_video_et_publication.sql` (ne pas modifier). Nouvelle `20261103100000_catalogue_et_fiche_kit.sql`, tests `supabase/tests/catalogue_kits.test.sql` ; `listage_catalogue.test.sql`, `garde_*` verts.
- Catalogue : `src/modules/catalogue/{queries.ts (listerCatalogue l.256, lireSlugsPublies l.359 qui exclut les Kits l.368, lireFicheProduit l.317), adresse.ts, types.ts (FamillePhysique l.9, NIVEAUX_KIT l.15), voir-plus.ts:13, existence.ts:8}`, `src/components/catalogue/{PageCatalogue (CATALOGUES l.22),FiltresCatalogue,CarteProduit (DOSSIER l.10),GrilleProduits}.tsx`, pages `src/app/[locale]/cosplays/**` (modèle) → nouvelles `src/app/[locale]/kits/{page,[slug]/page}.tsx`.
- Adresses et navigation : `src/i18n/adresses.ts:9`, `src/proxy.ts:52`, `src/components/layout/rubriques.ts:7` (`Navigation.rubriques.kits` existe), `src/app/sitemap.ts`.
- Fiche : modèle `src/components/fiche/{PageFiche,FicheProduit}.tsx`, réutiliser `GaleriePhotos`, `BoutonPartager`, `src/lib/seo/{jsonld,metadata,url,balise-jsonld}`, `src/lib/argent.ts:formaterUsd`, `fichiers-kit.ts:tailleLisible` ; nouveaux `src/components/fiche/{FicheKit,LecteurExtrait}.tsx` (`'use client'` pour le lecteur), `lireFicheKit`.
- Bunny : `src/lib/bunny/api.ts` (helper `appeler` l.79 : ajouter `deposerSousTitresBunny`, `supprimerSousTitresBunny`), `config.ts:lireHoteCdnPublic` ; CSP `src/lib/securite/entetes.ts:15`.
- Admin : `src/components/admin/VideoKit.tsx` (genre `extrait`), nouveau `SousTitresExtraitKit.tsx`, `src/modules/catalogue/{medias-kit,actions,dependances,types}.ts`, `sous-titres.ts:verifierWebVtt`, page `src/app/[locale]/admin/produits/[id]/page.tsx:111-120`, `PublicationProduit` (manque traduit).
- Tests : `tests/e2e/{catalogue,fiche}.spec.ts` (modèles), unitaires `catalogue-adresse`, `catalogue-listage`, `existence-fiche`, `proxy-fiche-404`, `robots-sitemap`, `fiche-page`, `jsonld-vitrine`, `catalogue-medias-kit`.

## Tasks & Acceptance

**Execution:**
- [x] Migration + tests SQL -- `lister_catalogue` (niveau, famille kit), colonnes et fonctions des sous-titres d'extrait, `manques_publication`
- [x] Bunny captions, service et UI admin des sous-titres d'extrait et de la case « Extrait sans parole »
- [x] Catalogue Kits, adresses, rubrique, proxy 404, sitemap
- [x] Fiche Kit, lecteur d'extrait (`hls.js`), CSP, SEO ; messages FR/EN ; tests unitaires et e2e (matrice, HTML sans élément privé)
- [x] `db:push` sur koma-dev après la revue, puis `npm run types`

**Acceptance Criteria:**
- Given des Kits publiés, when le visiteur ouvre `/fr/kits` ou `/en/kits`, then il retrouve cartes, filtres univers, prix et niveau, tri, « Voir plus » par 12, adresse fidèle ; la rubrique Kits est dans l'en-tête et le menu
- Given la fiche d'un Kit publié, then photos, titre, prix USD, description, niveau, matériel, fichiers (format, taille), plan des chapitres et résumé de la Licence s'affichent ; l'extrait se lit au clavier avec sous-titres
- Given la fiche, then métadonnées, Open Graph, JSON-LD Product + Offer, VideoObject (si extrait) et BreadcrumbList sont présents, et le bouton Partager fonctionne
- Given `lint`, `typecheck`, `test`, `build`, `test:e2e`, then tous passent ; `test:sql` en CI

## Spec Change Log

- 2026-10-31, revue 1 (corrections en patch, sans boucle) : la phrase « la garde différée existante couvre la mise à jour de `video_kit` » rendait impossible l'ajout ou le remplacement d'un extrait parlé sur un Kit publié (sous-titres vidés, garde `KS_PUBLICATION_INCOMPLETE`). Amendement : `sous_titres_extrait_fr` reste exigé par `publier_produit` (décision de Jonathan), mais la garde différée ne le compte pas ; sur un Kit publié, un extrait parlé sans `.vtt` FR n'est pas montré au public (ni lecteur ni VideoObject) jusqu'au dépôt du FR. Remplacer l'extrait remet aussi « Extrait sans parole » à faux. État évité : extrait bloqué ou nouvel extrait parlé publié sans sous-titres. KEEP : tout le reste du code.

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Ajouter/remplacer un extrait parlé sur un Kit publié est refusé par la garde | high | patch (amendement au Change Log) | déclencheur `video_kit_extrait_change` + `video_kit_publie_complet` |
| « Sans parole » hérité par un nouvel extrait | medium | patch | le déclencheur ne remet pas la case à faux |
| `.vtt` déposé chez Bunny puis base en échec : sous-titres orphelins publics | medium | patch | `deposerSousTitresExtrait` sans compensation |
| hls.js charge manifeste et segments sans lecture (`preload="none"` ignoré) | medium | patch | `autoStartLoad` par défaut |
| CSP sans `worker-src blob:` pour le worker de hls.js | medium | patch | `entetes.ts` |
| Test « HTML sans identifiant privé » ne cherche pas la valeur réelle | medium | patch | chaînes fixes seulement |
| Calcul de `extraitSansSousTitresFr` non testé | medium | patch | faux client sans ligne `video_kit` |
| Câblage des 3 RPC et Server Action FormData non testés | medium | patch | `supprimer_sous_titres_kit` interchangeable au typecheck |
| Branches Kit de `FiltresCatalogue` et `CarteProduit` non testées | medium | patch | aucun cas `famille: "kit"` |
| `metadataFicheKit` / `PageFicheKit` non testés (e2e sauté) | medium | patch | aucun test hors e2e conditionnel |
| `LecteurExtrait` et `SousTitresExtraitKit` sans test | medium | patch | aucun fichier de test |
| `kits_video.test.sql` passé en « sans parole » : défaut parlé non testé | low | patch | rétabli avec le nouveau comportement |
| `KS_VALEUR_INVALIDE` non traduit | low | patch | absent de `ERREURS_BASE` |
| Case « sans parole » non resynchronisée après rafraîchissement | low | patch | état initial seulement |
| Aide du lecteur trompeuse ; pas de mention quand l'extrait n'a pas d'EN | low | patch | texte `Kit.extrait.aide` |
| Licence de hls.js non notée | low | patch | code tiers servi au public (règle 6) |
| Kits publiés avant la migration : migration en échec | low | rejeté | vérifié : aucun Kit ni `video_kit` sur koma-dev |
| Rattrapage `extrait_le` non testé | low | defer | à vérifier à la main après `db:push` (aucune ligne aujourd'hui) |
| Cache CDN des sous-titres remplacés (même adresse) | maybe-false | defer | à vérifier : Bunny purge-t-il l'adresse au dépôt ? |
| Échec du DELETE Bunny après la base | low | rejeté | journalisé ; contenu déjà public par nature |
| Course entre lecture et écriture de l'extrait | low | rejeté | deux onglets admin simultanés ; garde en plus |
| Libellé Bunny « fr »/« en » | low | rejeté | le site utilise ses propres `<track>` traduits |
| `lister_catalogue` calcule les variantes pour un Kit | low | rejeté | aucune variante pour un Kit, coût nul |
| `LecteurExtrait` : état d'erreur non remis à zéro | low | rejeté | la source ne change pas sur une fiche |
| `lireFicheKit` lève sur un format inconnu | false | rejeté | contrainte CHECK sur `fichier_kit.format` |
| `types.ts` écrit à la main | false | rejeté | régénéré après `db:push` |
| Case cachée sans extrait | false | rejeté | inutile avec l'amendement |

## Design Notes

Dépasse 1600 jetons ; non scindée (mode enchaîné). Les sous-titres de l'extrait vont chez Bunny (public par nature, horaires propres à l'extrait), pas dans `kits-private`. Contrôles natifs du `<video>` pour l'extrait (clavier natif) ; le lecteur personnalisé à chapitres est la 3.7. La mention « pas de sous-titres anglais » porte sur la vidéo complète (FR-29). La licence n'est que résumée ici ; son texte complet versionné arrive avec la 3.5.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur
- `npm run test:e2e` -- catalogue Kits (sans Kit publié : état vide), 404, sitemap, HTML sans élément privé
- `npm run test:sql` -- CI

**Manual checks:**
- Publier un Kit avec extrait parlé (refus sans `.vtt` FR, puis accepté), ouvrir `/fr/kits` et sa fiche à 375 px, lire l'extrait au clavier avec sous-titres FR puis `/en`.
