---
title: 'Story 9.8 : Tableau de bord'
type: 'feature'
created: '2026-11-10'
status: 'done'
route: 'dispatch'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** Jonathan veut voir chaque matin, d'abord, ce qui demande une action, avant d'ouvrir l'atelier (FR-49, `epics.md` story 9.8).

**Approche (décision de Jonathan du 2026-11-10, deux parties, toutes deux faites par Claude) :**
- **Partie 1 : LIVRÉE** (commit `7bb5670`, migration `20270102100000_tableau_de_bord.sql`, test `supabase/tests/tableau_de_bord.test.sql`) : cinq fonctions d'agrégats réservées à l'Admin, exécutables par `service_role` seulement.
- **Partie 2 : la page.** `/admin` devient le tableau de bord. Elle ne lit que ces cinq fonctions et les vues de la story 9.7, plus les compteurs de tâches qui existent déjà. Aucune donnée personnelle.

## Boundaries & Constraints

**Toujours :**
- Page réservée à l'Admin : `exigerAdminPage(locale, "/admin", "admin.acceder")` ; les lectures demandent `chiffre_affaires.voir` et `paiements.graphiques` (`exigerDroit`), et chaque fonction SQL revérifie l'Admin en base (`exiger_admin`). Visiteur : connexion avec retour ; Compte sans droit : 404.
- Lectures par le client service, côté serveur seulement (`import "server-only"`). Fonctions : `tableau_commandes_payees`, `tableau_paiements`, `tableau_echecs_paiement`, `tableau_delai_mesures`, `tableau_trop_percus`. Vues 9.7 : `vue_visites_jour`, `vue_origines_jour`, `vue_entonnoir_jour`, `vue_ventes_code_promo`, `vue_ventes_origine`, `vue_deuxiemes_achats`, `vue_desinscriptions_jour`.
- Aucune donnée personnelle affichée : ni nom, ni email, ni téléphone, ni adresse, ni identifiant de Compte. Les numéros de Commande (`KS-…`) sont permis (aucune donnée de client).
- Ordre d'affichage (AC) : 1) nouvelles Commandes payées, 2) graphiques de paiement (par Prestataire, par Famille, dans le temps), 3) cartes de tâche, 4) indicateurs sur 7 et 30 jours.
- Graphiques : valeur écrite sur chaque barre, « Voir les données en tableau » (`<details>` avec `<caption>` et `<th scope>`), aucune couleur par série (une seule teinte), aucune donnée fictive. Montants en USD (centimes → dollars), jamais en devise locale.
- Jours calculés à Goma (UTC+2) ; fenêtres de 7 et 30 jours **pleins** (aujourd'hui compris), bornes passées à `p_depuis` par `minuit_goma`-équivalent côté TypeScript (`Africa/Lubumbashi`).
- Un indicateur sans source de données affiche « Pas encore mesuré » avec la raison, jamais un zéro (règle 13). Une lecture qui échoue affiche un message d'erreur, jamais un faux zéro.
- États vides (UX-DR44) : « Aucune nouvelle commande payée aujourd'hui. », « Aucune tâche en attente. », « Aucun paiement vérifié aujourd'hui. » avec lien vers les 7 derniers jours (`?periode=7`). Une carte de tâche à zéro reste affichée, en ton atténué.
- Tous les textes dans `messages/fr.json` et `messages/en.json` (espace `Admin.tableau`). Rouge #E3261C réservé aux éléments déjà prévus par DESIGN.md ; pas de texte rouge ; mobile 375 px sans défilement horizontal ; navigation au clavier ; `<h1>` unique.
- Page non indexée (`indexable: false`), comme les autres pages admin.

**À valider par Jonathan (propositions par défaut appliquées) :**
- Indicateurs **sans source** à ce jour, affichés « Pas encore mesuré » : SM-5 (photos et Réalisations envoyées : pas de vue agrégée en 9.7), SM-6 (passage d'un Kit gratuit à un Kit payant), SM-8 (Vidéo de kit terminée : événement non mesuré, se passe sous `/compte`), SM-C6 (durée du héros : colonne `duree_ms` non ajoutée). Hors périmètre déjà décidé en partie 1 : SM-4 et SM-C4 (Pass, epic 7), SM-C1 (aucun délai promis stocké), SM-C7 (voie 1). Ces six restent **notés**, non traités.
- Cartes de tâche : **compteurs seulement**, avec lien vers la page existante (`/admin/taches`, `/admin/commandes`, `/admin/galerie`, `/admin/messages`), sans lister de Commandes dans le tableau de bord. Les compteurs réutilisent les lectures existantes (stories 6.5, 6.6, 8.2, 1.8) et `tableau_trop_percus`.

**Jamais :**
- Lire une table de Commande, de Compte ou de client directement depuis la page ; écrire en base ; ajouter une migration (la partie 2 n'en a pas besoin) ; modifier une migration appliquée.
- Simuler un chiffre, un paiement ou un statut (règle 13) ; additionner la colonne `commandes` de `tableau_paiements` entre Familles (une Commande mixte compte dans chacune).
- Afficher un montant reçu en devise locale (règle 2 : le détail d'un trop-perçu se lit dans les Commandes).
- Modifier `.env.example`, `CLAUDE.md`, `epics.md`, la CSP.

## Code Map

- `src/modules/tableau-de-bord/{types,periode,calculs,queries}.ts` + `calculs.test.ts`
- `src/components/admin/tableau/` : `CommandesPayees`, `GraphiqueBarres`, `CartesTaches`, `Indicateurs`
- `src/app/[locale]/admin/page.tsx` (remplace la redirection vers Réglages)
- `src/components/admin/NavigationAdmin.tsx` (entrée « Tableau de bord » en tête) ; `messages/{fr,en}.json`

## Critères d'acceptation

1. **Étant donné** un Admin connecté **Quand** il ouvre `/admin` **Alors** il voit, dans cet ordre, les Commandes payées, les graphiques, les cartes de tâche, les indicateurs.
2. **Étant donné** un visiteur, un Assistant ou un Client **Quand** il ouvre `/admin` **Alors** connexion avec retour (visiteur) ou 404 ; aucune donnée n'est lue.
3. **Étant donné** des paiements vérifiés **Quand** les graphiques s'affichent **Alors** chaque barre porte sa valeur en USD, le tableau équivalent est disponible, et la somme par Famille (livraison comprise) égale la somme par Prestataire.
4. **Étant donné** aucune donnée **Quand** la page s'affiche **Alors** les phrases d'état vide ci-dessus apparaissent, et la carte de tâche à zéro reste visible, atténuée.
5. **Étant donné** une lecture en échec **Quand** la page s'affiche **Alors** la zone concernée montre une erreur, les autres zones restent lisibles, aucun zéro inventé.
6. **Étant donné** un indicateur sans source **Alors** « Pas encore mesuré » et sa raison s'affichent.
7. Les périodes 7 et 30 jours sont calculées à Goma ; `?periode=7` ou `30` seulement (toute autre valeur : 30).

## Suivi

- Partie 1 : `done` (commit `7bb5670`, CI verte).
- Partie 2 : `done` (commit `fd8b9a9`, CI verte du 2026-11-10 : pgTAP dont `tableau_de_bord.test.sql`, e2e, build).

</frozen-after-approval>
