---
title: 'Story 2.7 : blocs de la page d''accueil'
type: 'feature'
created: '2026-10-26'
status: 'done'
baseline_commit: '192e164048f5bf5d608484c1a8f3f847db8d686a'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** L'accueil n'affiche qu'un titre : ni catégories, ni cosplays récents, ni présentation de Jonathan, ni FAQ courte, alors que le visiteur doit comprendre en quelques secondes ce que propose KOMA SHOP.

**Approach:** Page d'accueil composée de blocs dans l'ordre de FR-2 : tuiles de catégorie (Cosplays, Accessoires), bloc 2 « Fait main à Goma » (derniers cosplays publiés en cartes), bloc 6 « Jonathan en trois phrases », bloc 8 FAQ courte ; la place des blocs 1, 3, 4, 5 et 7 est réservée dans l'ordre sans rien afficher ; tout bloc sans contenu réel est masqué ; textes de Jonathan avec le marqueur « [Texte à fournir] » tant qu'ils manquent.

## Boundaries & Constraints

**Always:** Le héros vidéo (story 2.6, bloquée par les clés Bunny) n'existe pas : le H1 actuel de l'accueil est conservé tel quel ; un emplacement réservé et documenté dans le code (liste ordonnée des blocs) pour le héros et pour les blocs 1, 3, 4, 5, 7 (Kits, Galerie, Rendez-vous otaku, Guides) qui arrivent avec les epics 2.6, 3, 7 et 8. Un emplacement réservé n'affiche rien : ni espace, ni titre, ni texte.
Ordre affiché : tuiles de catégorie, bloc 2 « Fait main à Goma », bloc 6 « Jonathan en trois phrases », bloc 8 FAQ courte. Un `h2` par bloc (le H1 reste unique), titres de blocs en Sakura Town/Barlow Condensed via `TitreVitrine`, rédigés sans accent et en majuscules (UX-DR46).
Tuiles de catégorie : deux liens (Cosplays, Accessoires) vers `/cosplays` et l'adresse de l'accessoire de la langue courante (`src/i18n/adresses.ts`), texte seul sans photo (aucune image n'est ajoutée, règle 6), élévation au survol/focus coupée en mouvement réduit ; une colonne sous 360 px ou à 200 % de zoom sans coupure de texte (UX-DR19) ; toujours affichées (ce sont des liens vers des pages qui existent).
Bloc 2 : les 4 derniers cosplays publiés (lecture publique par `lister_catalogue`, famille cosplay, tri nouveautés) en cartes produit existantes (`CarteProduit`/`GrilleProduits` de la 2.4, badge de disponibilité rendu à chaque requête), avec un lien « Voir tous les cosplays » ; aucun cosplay publié ou lecture en erreur : bloc masqué sans espace (l'erreur est journalisée, jamais une carte inventée).
Bloc 6 : trois phrases dans `messages/{fr,en}.json` (`Accueil.jonathan.*`, tutoiement exclu : texte de présentation à la troisième personne ou « je » au choix de Jonathan, donc marqueur) valant « [Texte à fournir] » tant que Jonathan ne les a pas fournies ; aucun texte, chiffre, avis, client ni logo inventé (règle 5). Bloc 8 : FAQ courte (paiement, livraison, délais) construite à partir des entrées existantes de l'espace `Faq` (mêmes textes, pas de copie), avec le composant `QuestionsFaq` ; JSON-LD `FAQPage` des seules paires réelles (`faqJsonLd`), sans marqueur.
L'espace de messages `Accueil` rejoint la liste `ESPACES_PUBLICS` de `src/lib/vitrine/marqueur.ts` : le build de production échoue tant qu'un marqueur reste quand `KOMA_VERIFIER_TEXTES=true`, mais le titre actuel et les libellés des blocs ne contiennent jamais le marqueur ; en développement le marqueur s'affiche. Un bloc ne contenant que le marqueur reste affiché (c'est le rappel à Jonathan), jamais masqué en silence.
Contenu visible sans JavaScript, animations et apparitions coupées en `prefers-reduced-motion` (UX-DR47), `Accueil` en cache avec l'étiquette `catalogue` pour ce qui ne dépend pas des ventes, le bloc 2 rendu à la requête. Métadonnées de l'accueil inchangées en structure, JSON-LD Organization conservé.
Lighthouse mobile (performance, accessibilité, SEO ≥ 90, NFR-2) : mesure documentée dans la story (commande, version, scores) ; si l'outil ne peut pas tourner ici, le dire sans inventer de score.
Textes dans `messages/{fr,en}.json` (`Accueil.*`), aucun texte en dur. Tests : ordre et masquage des blocs, bloc 2 vide/erreur/plein, marqueur, FAQ courte et JSON-LD sans marqueur, tuiles (liens par langue), un seul H1, axe/clavier/375 px en e2e.

**Never:** Pas de héros, de vidéo ni de clés Bunny (2.6), pas de bloc Kits/Galerie/Rendez-vous/Guides, pas de photo ni de visuel ajouté au dépôt, aucun avis/chiffre/logo/témoignage inventé, pas de nouveau produit, de migration ni de réglage, pas de `npm run dev`.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Aucun cosplay publié | base sans produit | bloc 2 absent, pas d'espace vide | N/A |
| 6 cosplays publiés | base | 4 plus récents en cartes + lien vers le catalogue | N/A |
| Lecture du bloc 2 en erreur | base indisponible | bloc masqué, erreur journalisée, reste de la page intact | N/A |
| Textes de Jonathan absents | marqueur dans les messages | bloc 6 et FAQ affichent « [Texte à fournir] » en dev | build de production refusé si contrôle actif |
| FAQ sans paire réelle | toutes paires au marqueur | pas de JSON-LD FAQPage | N/A |
| Mouvement réduit | `prefers-reduced-motion` | aucune animation, contenu identique | N/A |
| 320 px / zoom 200 % | tuiles | une colonne, texte sans coupure | N/A |
| Langue | `/en` | titres, tuiles et liens en anglais (`/en/accessories`) | N/A |

</frozen-after-approval>

## Code Map

- `src/app/[locale]/page.tsx` (H1 actuel `Accueil.titre`, à conserver) ; nouveaux `src/components/accueil/{TuilesCategories,BlocCosplaysRecents,BlocJonathan,BlocFaqCourte}.tsx` et `src/modules/accueil/blocs.ts` (liste ordonnée des blocs, emplacements réservés).
- `src/components/catalogue/{CarteProduit,GrilleProduits,BadgeDisponibilite}.tsx`, `src/modules/catalogue/queries.ts` (`listerCatalogue`), `src/i18n/adresses.ts`, `src/components/vitrine/QuestionsFaq.tsx`, `src/app/[locale]/faq/page.tsx` (modèle d'assemblage des paires et du JSON-LD), `src/lib/seo/jsonld.ts` (`faqJsonLd`), `src/lib/vitrine/marqueur.ts` (`ESPACES_PUBLICS`), `scripts/verifier-marqueurs.mjs`, `src/components/ui/{TitreVitrine,MotifManga}.tsx`.
- `messages/{fr,en}.json` (`Accueil.*`), `tests/unit/*` (dont `messages-parite.test.ts`, `marqueur-texte.test.ts`), `tests/e2e/gabarit.spec.ts` ou nouveau `accueil.spec.ts`.

## Tasks & Acceptance

**Execution:**
- [ ] Liste ordonnée des blocs avec emplacements réservés ; tuiles de catégorie
- [ ] Bloc 2, bloc 6, bloc 8 (FAQ courte + JSON-LD), marqueur et contrôle de build
- [ ] Messages FR/EN, tests unitaires et e2e, mesure Lighthouse documentée

**Acceptance Criteria:**
- Given l'accueil, then les blocs suivent l'ordre de FR-2 avec un `h2` chacun, les emplacements réservés n'affichent rien et un bloc sans contenu réel est masqué sans espace
- Given des cosplays publiés, then le bloc « Fait main à Goma » montre les 4 plus récents en cartes avec badge à la requête ; sans cosplay, il disparaît
- Given les textes de Jonathan manquants, then « [Texte à fournir] » s'affiche en développement, le build de production échoue si le contrôle est actif, et le JSON-LD FAQPage ne contient que des paires réelles
- Given 360 px ou 200 % de zoom, then les tuiles passent sur une colonne sans coupure ; en mouvement réduit, aucune animation
- Given `lint`, `typecheck`, `test`, `build`, then tous passent

## Implementation Notes

- Liste ordonnée et emplacements réservés : `src/modules/accueil/blocs.ts` ; lecture du bloc 2 : `src/modules/accueil/cosplays-recents.ts` (erreur journalisée, liste vide) ; composants dans `src/components/accueil/`. `Accueil` ajouté à `ESPACES_PUBLICS` ; les trois phrases de Jonathan portent le marqueur, le build de production échoue donc tant que `KOMA_VERIFIER_TEXTES=true` et que Jonathan n'a pas fourni les textes (et les réponses de la FAQ, déjà dans ce cas).
- Vérifications : lint, typecheck, `npm test` (913 tests) et `npm run build` sans erreur ; e2e complet : 181 réussis, 14 ignorés, 1 échec (`gabarit.spec.ts` « le thème sombre est mémorisé… », échec identique sans les changements de cette story, course sur `waitUntil: "commit"` : hors périmètre).
- Lighthouse mobile : `npx lighthouse@12` (version 12.8.2), Chromium de Playwright, sur `next start` local (build de production, port 3200), base `koma-dev` sans cosplay publié (le bloc 2 n'était donc pas mesuré). `/fr` : performance 89, accessibilité 100, SEO 100 (deux mesures identiques, LCP 3,4 s, TBT 170-190 ms, CLS 0). `/en` : performance 89 puis 90, accessibilité 100, SEO 100. L'élément LCP est le H1 existant (non modifié) ; la performance reste à la limite du seuil de 90 (NFR-2) : non atteinte de façon stable, à revoir avec le héros (2.6) et les polices.

## Spec Change Log

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| `catch` nu qui avale les signaux de Next.js et perd la cause | medium | patch | `unstable_rethrow` + cause journalisée |
| Blocs 2 et 8 et tuiles non testés au niveau composant ; JSON-LD de l'accueil non vérifié sur la page | medium | patch | tests unitaires et e2e |
| E2E à attente conditionnée par la longueur, liste ciblée par `main ul` | medium | patch | masque un bloc disparu |
| Lighthouse performance 89-90 (seuil 90), bloc 2 jamais vu avec de vraies cartes, CLS du bloc 2 sous Suspense | medium (non vérifié) | defer | mesure à refaire avec le héros et des produits publiés |
| Tuiles : deux colonnes à 360 px exactement | false | rejeté | « moins de 360 px » : à 360 px deux colonnes est conforme |
| Étiquette de cache de l'accueil absente | low | rejeté | la coque est prérendue (cacheComponents), seul le bloc 2 est dynamique |
| Marqueur visible en production sans contrôle de build | low | rejeté | même convention que À propos et FAQ, contrôle posé sur Hostinger |
| FAQPage en double (accueil et /faq), lien /faq en dur, clés absentes d'une langue | low | rejeté | exigé par la spec ou couvert par le test de parité |
| Typage de `rendreBloc`, liste lue puis tronquée, wrappers `contents` | low | rejeté | sans effet constaté |

## Design Notes

Dépasse 1600 jetons ; non scindée. Choix du développeur : les tuiles de catégorie n'ont pas de photo (aucune photo de Jonathan n'est dans le dépôt, règle 6) ; la 2.6 (héros) reste en attente des clés et de la bibliothèque Bunny publique, le H1 actuel tient lieu d'accroche jusque-là ; le bloc 6 reste affiché avec le marqueur plutôt que masqué, comme À propos, pour rappeler à Jonathan de fournir le texte.

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur
- `npm run test:e2e` -- parcours existants verts

**Manual checks:**
- Ouvrir `/fr` et `/en` : ordre des blocs, tuiles, cosplays publiés, FAQ, 320 px, zoom 200 %, mouvement réduit.
