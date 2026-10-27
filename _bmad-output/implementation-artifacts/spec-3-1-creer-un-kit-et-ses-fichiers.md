---
title: 'Story 3.1 : créer un Kit et ses fichiers'
type: 'feature'
created: '2026-10-27'
status: 'done'
baseline_commit: '3796b8dd0b2aed297eb5e9fe1d654b22ac18a853'
route: 'dispatch'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-3-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Le catalogue ne connaît que les produits physiques : Jonathan ne peut ni créer un Kit (patrons, fichiers 3D, version « Le fabriquer moi-même »), ni le relier à son cosplay, ni déposer ses fichiers de façon privée.

**Approach:** Famille `kit` dans `produit` (titre, description et matériel FR/EN, univers, prix dont 0 USD, niveau, lien un pour un vers un cosplay ou accessoire), tables `fichier_kit` (données publiables) et `fichier_kit_prive` (chemin, sans aucune lecture publique), bucket privé `kits-private`, envoi TUS direct sur autorisation signée, remplacement d'un fichier avec version et journal, formulaire admin étendu.

## Boundaries & Constraints

**Always:** Nouvelles migrations seulement. Mêmes règles d'écriture qu'aux epics précédents (`SECURITY DEFINER`, `search_path = ''`, `p_auteur jsonb` en premier, `exiger_admin`, `ks.auteur` avant le DML, `REVOKE`/`GRANT service_role`, trigger `journaliser('id')`, droit `produits.modifier`). Aucune donnée d'exemple, aucun prix par défaut.
Produit Kit : la contrainte de famille accepte `kit` ; colonnes ajoutées à `produit` : `materiel_fr`, `materiel_en` (0 à 5000 caractères), `niveau` (`debutant`, `intermediaire`, `avance` ; FR Débutant/Intermédiaire/Avancé, EN Beginner/Intermediate/Advanced), `produit_lie_id` (uuid, clé étrangère vers `produit`, UNIQUE quand non nul : un cosplay ou accessoire n'a qu'un Kit lié, un Kit n'en lie qu'un ; la cible doit être un cosplay ou un accessoire, jamais un Kit : `KS_KIT_LIE_INVALIDE`). Le prix d'un Kit peut valoir 0 (réservé au Kit gratuit, seul produit à 0 ; jamais pour un cosplay ou accessoire) et monte à 1 000 000 centimes comme les autres. Un Kit n'a ni variante, ni délai de fabrication, ni stock. La famille d'un produit ne passe jamais vers ou depuis `kit` (déclencheur : `KS_FAMILLE_INVALIDE`). `enregistrer_kit(p_auteur, p_id, p_kit jsonb) returns uuid` crée (p_id nul) ou modifie un brouillon de Kit : famille `kit`, `slug` (mêmes règles qu'aux produits), `titre_fr` obligatoire, `titre_en`, `description_fr/en`, `materiel_fr/en`, `univers_id`, `prix_cents` (0 à 1 000 000), `niveau`, `produit_lie_id` ; ne pose jamais `publie_le`. `enregistrer_produit` ne touche jamais un Kit. Un Kit ne peut pas être publié dans cette story : `manques_publication`/`publier_produit` le refusent tant que la 3.2 n'a pas défini la publication d'un Kit (test SQL).
Fichiers : `fichier_kit(id, produit_id on delete cascade, nom_fr, nom_en, format, taille_octets, ordre, version, cree_le)` avec `format` parmi `pdf_a4`, `pdf_letter`, `svg`, `stl`, `transcription` (noms de 1 à 120 caractères, taille > 0, `version` ≥ 1 démarrant à 1, `ordre` croissant à l'ajout) ; `fichier_kit_prive(fichier_id primary key references fichier_kit on delete cascade, chemin_stockage)` : aucune lecture ni écriture pour `anon`/`authenticated`, RLS active sans politique. `fichier_kit` : `SELECT` public seulement pour les fichiers d'un Kit publié et passé ; aucune colonne `prive`, `chemin` ni `note_admin` lisible par `anon` (le test `garde_colonnes_privees` passe). Fonctions (service seulement) : `ajouter_fichier_kit(p_auteur, p_produit_id, p_nom_fr, p_nom_en, p_format, p_taille, p_chemin)`, `remplacer_fichier_kit(p_auteur, p_fichier_id, p_taille, p_chemin)` (version + 1, nouveau chemin, renvoie l'ancien chemin pour effacement, journalisé avant/après), `supprimer_fichier_kit(p_auteur, p_fichier_id)` (renvoie le chemin à effacer). Le chemin respecte `<produit>/<uuid>.<extension du format>` en minuscules (`KS_CHEMIN_INVALIDE`).
Stockage : bucket privé `kits-private` créé par la migration (non public, sans aucune politique `storage.objects` pour `anon`/`authenticated`), limite 50 Mo (52 428 800 octets, compatible avec le plafond du plan Supabase gratuit ; constante nommée `TAILLE_MAX_FICHIER_KIT`, la transcription est limitée à 1 Mo). Formats acceptés affichés dans l'interface : PDF (A4 ou US Letter), SVG, STL, transcription texte (`.txt`). Envoi : l'action `demanderEnvoiFichierKit` vérifie le droit, le Kit, l'extension et la taille, puis signe un jeton (`createSignedUploadUrl`) pour `kits-private/<produit>/<uuid>.<ext>` choisi par le serveur ; le navigateur envoie en TUS (réutiliser `src/lib/supabase/envoi-tus.ts` en paramétrant le bucket) avec progression en texte, reprise et « Annuler l'envoi » ; `finaliserFichierKit` vérifie l'objet (existence, taille annoncée, contenu réel : en-tête `%PDF-`, texte SVG, STL ASCII `solid`/binaire de taille cohérente, texte UTF-8 pour la transcription), enregistre la ligne puis, en cas d'échec, efface l'objet. Un fichier SVG n'est jamais rendu en ligne par le site. Remplacement : même envoi, puis `remplacer_fichier_kit` (version + 1) et effacement de l'ancien objet APRÈS la base (un échec d'effacement est journalisé, jamais bloquant). Cache `catalogue` invalidé après chaque succès.
Interface (formulaire de produit, `Admin.kits.*`, tutoiement, sans emoji) : la Famille propose `kit` en plus des deux autres ; avec `kit` le formulaire montre titre/description/matériel FR et EN, univers, prix USD (0 admis, message « 0 USD est réservé au Kit gratuit »), niveau en radios natifs, et la liste déroulante du cosplay ou accessoire à lier (seulement ceux sans Kit, plus l'actuel) ; il masque tailles, délai et stock. La famille d'un produit existant n'est plus modifiable. La liste des produits affiche la Famille « Kit ». Sur la fiche d'édition d'un Kit : section « Fichiers » (liste avec format, taille lisible, version ; envoi avec progression et annulation ; « Remplacer » et « Supprimer » avec confirmation par la boîte de dialogue existante ; formats et taille maximale affichés), succès affiché seulement après la réponse réelle, erreurs liées aux champs (`aria-describedby`), saisie conservée, 375 px, cibles de 44 px.
Règle 1 : une adresse directe d'un fichier de `kits-private` sans lien signé (`/storage/v1/object/kits-private/…`, `/storage/v1/object/public/kits-private/…`, avec la clé publique ou sans) renvoie une erreur ; test automatique (pgTAP : bucket non public, aucune politique ouverte aux rôles publics ; plus un test réseau qui crée un objet nommé `TEST_` avec la clé de service, vérifie que l'accès anonyme échoue, puis l'efface).
Tests : SQL (famille kit, prix 0 réservé aux Kits, lien un pour un, cible non Kit, famille immuable, droits, journal, version, publication refusée, RLS des fichiers, aucune lecture des tables `_prive`) ; service/actions (droit, validations de format et taille, contenu réel, effacement après échec, ordre base puis fichier, version) ; UI (formulaire Kit, liste de fichiers, remplacement, suppression, progression/annulation) ; liste blanche des fonctions inchangée (aucune fonction publique nouvelle).

**Never:** Pas de vidéo, de chapitre, de sous-titre ni de publication de Kit (3.2) ; pas de catalogue ni de fiche Kit (3.3) ; pas de Kit lié sur les fiches physiques (3.4) ; pas d'accès, de commande ni de téléchargement (3.5, 3.6) ; pas de photo de Kit dans cette story ; pas de clé Bunny ; pas de filigrane ; pas de modification d'une migration appliquée ; pas de `npm run dev` à la main.

## I/O & Edge-Case Matrix

| Scénario | Entrée / état | Comportement attendu | Erreur |
|----------|---------------|----------------------|--------|
| Créer un Kit | famille `kit`, titre FR, prix `0` | brouillon enregistré, journalisé | N/A |
| Prix 0 sur un cosplay | appel direct | refusé | `KS_PRIX_INVALIDE` |
| Lier un Kit | cosplay sans Kit | `produit_lie_id` posé | N/A |
| Cosplay déjà lié | second Kit sur le même cosplay | refusé (contrainte) | `KS_KIT_LIE_INVALIDE` |
| Lier à un Kit | cible de famille `kit` | refusé | `KS_KIT_LIE_INVALIDE` |
| Changer la famille | produit existant | refusé | `KS_FAMILLE_INVALIDE` |
| Publier un Kit | brouillon de Kit | refusé | `KS_PUBLICATION_INCOMPLETE` |
| Envoyer un fichier | PDF de 3 Mo | TUS, ligne `fichier_kit` (version 1) + chemin privé | N/A |
| Format refusé | `.exe`, `.zip` | refusé avant l'envoi, formats rappelés | `format_invalide` |
| Trop lourd | 51 Mo | refusé avant l'envoi, limite rappelée | `fichier_trop_lourd` |
| Contenu qui ne correspond pas | `.pdf` contenant du texte | refusé, objet effacé | `format_invalide` |
| Remplacer un fichier | fichier de version 1 | version 2, ancien objet effacé, journalisé | N/A |
| Supprimer un fichier | fichier d'un brouillon | ligne et objet effacés | N/A |
| Lecture publique | `anon` sur `fichier_kit_prive`, ou adresse directe de l'objet | refusé | permission refusée / 4xx |
| Assistant / Compte simple | action | refus serveur | `non_autorise` |
| Échec serveur | stockage ou base en erreur | pas de succès, rien d'orphelin | `generique` |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20261023100000_creer_catalogue_physique.sql` (`produit`, contraintes, `enregistrer_produit`), `20261024100000_photos_et_publication.sql` (`manques_publication`, `publier_produit`, buckets), `20261029100000_stock_non_expose.sql` : à utiliser, ne pas modifier. Nouvelle `supabase/migrations/20261030100000_kits_et_fichiers.sql` ; tests `supabase/tests/kits_fichiers.test.sql` ; `garde_colonnes_privees` et `garde_ecritures` doivent rester verts.
- `src/modules/catalogue/{types,schemas,service,actions,dependances,queries}.ts` (étendre : famille `kit`, `enregistrerKit`, fichiers) ; nouveau `src/modules/catalogue/fichiers-kit.ts` (formats, extensions, tailles, vérification du contenu, pur et testable) ; `src/lib/supabase/{stockage,envoi-tus}.ts` (paramétrer le bucket) ; `src/components/admin/{FormulaireProduit,ListeProduits,PastilleStatut}.tsx`, nouveaux `src/components/admin/{FormulaireKit,FichiersKit,EnvoiFichierKit}.tsx`, `src/app/[locale]/admin/produits/{nouveau,[id]}/page.tsx`, `src/components/ui/Dialogue.tsx`.
- `messages/{fr,en}.json` (`Admin.kits.*`, `Admin.produits.famille.kit`), `tests/doubles/TEST_dependances-catalogue.ts`, `src/lib/supabase/types.ts` (régénéré après le push), `tests/unit/*`, `tests/e2e/*` (test réseau de l'accès direct à `kits-private`).

## Tasks & Acceptance

**Execution:**
- [ ] Migration + `kits_fichiers.test.sql` -- famille kit, colonnes, lien un pour un, tables de fichiers, bucket privé, fonctions -- AD-18, AD-30, règle 1
- [ ] Service, actions, dépendances, vérification du contenu, envoi TUS paramétré -- règle 13
- [ ] Formulaire Kit, liste de fichiers, remplacement/suppression, messages FR/EN, tests unitaires
- [ ] Test réseau de l'adresse directe ; `db:push` sur koma-dev après la revue, puis `npm run types`

**Acceptance Criteria:**
- Given la Famille `kit`, when Jonathan saisit titre, description et matériel FR/EN, univers, prix (0 admis) et niveau, then un brouillon de Kit est enregistré et journalisé ; relié à un cosplay ou accessoire il garantit la relation un pour un en base
- Given `fichier_kit` et `fichier_kit_prive`, then la première ne contient que des données publiables, la seconde n'est lisible par personne hors service, et le test des colonnes lisibles par `anon` passe
- Given un fichier PDF, SVG, STL ou transcription valide, when Jonathan l'envoie, then il part en TUS vers `kits-private` avec progression, reprise et annulation, formats et taille maximale affichés ; un fichier de mauvais format, trop lourd ou au contenu incohérent est refusé
- Given une adresse directe d'un fichier de `kits-private` sans lien signé, then l'accès est refusé (test automatique)
- Given un fichier envoyé, when Jonathan le remplace, then sa version augmente et l'action est journalisée
- Given `lint`, `typecheck`, `test`, `build`, then tous passent ; `test:sql` en CI

## Implementation Notes

## Spec Change Log

## Review Triage Log

| Constat | Verdict | Route | Preuve |
|---|---|---|---|
| Un objet déjà enregistré peut être effacé (double finalisation, remplacement par le même chemin, annulation d'un objet enregistré) | high | patch | fichier vivant sans objet |
| Jeton signé réutilisable : le fichier vérifié peut être réécrit ; limite de 1 Mo de la transcription non appliquée à la finalisation | high | patch | déplacement de l'objet vers un chemin serveur après vérification |
| Contrôle du contenu faible : SVG actif, STL « solid », PDF sur 5 octets | medium | patch | `fichiers-kit.ts` |
| `KS_CHEMIN_INVALIDE` en erreur générique ; publication d'un Kit sans message | medium | patch | mappage d'erreurs |
| Lecture par lien signé sans délai maximal ; bouton Annuler actif après l'envoi | low | patch | correction directe |
| Contrat réel du stockage (jeton, taille, lecture partielle) jamais éprouvé ; mapping des fichiers et filtres de liaison non testés | medium | patch | mocks seulement |
| Type de contenu choisi par le client, téléchargement en pièce jointe (3.6), objets jamais finalisés, modification d'un Kit publié, prix 0 en paiement, test de la page d'édition | medium | defer | entrées de `deferred-work.md` |
| Variantes sur un Kit par d'autres fonctions, course sur le lien, suppression du produit, ordre sans trous, lecture publique des métadonnées | low | rejeté | empêché par le déclencheur de famille ou exigé par la spec |

## Design Notes

Dépasse largement 1600 jetons ; non scindée. Choix du développeur : limite de 50 Mo par fichier (plan gratuit de Supabase ; à relever avec le plan) ; suppression d'un fichier incluse (une erreur d'envoi ne doit pas rester définitive) bien que non listée dans les critères ; pas de renommage (supprimer puis renvoyer) ; photos de Kit et publication reportées à la 3.2 ; les objets envoyés mais jamais finalisés (onglet fermé) restent à purger (reporté).

## Verification

**Commands:**
- `npm run lint && npm run typecheck && npm test && npm run build` -- aucune erreur
- `npm run test:e2e` -- parcours existants et accès direct à `kits-private` refusé
- `npm run test:sql` -- CI

**Manual checks:**
- Créer un Kit à 0 USD relié à un cosplay, envoyer un PDF, un SVG et un STL, remplacer un fichier (version 2), supprimer un fichier ; vérifier à 375 px.
