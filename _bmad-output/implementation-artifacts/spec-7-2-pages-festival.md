---
title: 'Story 7.2 : Pages Festival'
type: 'feature'
created: '2026-11-11'
status: 'done'
route: 'dispatch'
---

## Intent

Le visiteur voit les prochains Événements et tout sur chacun : liste `/fr|en/festival` (à venir puis passés, 12 par page, « Voir plus »), page `/festival/[slug]` (date et heure de Goma, lieu, programme, photos, cartes des Types de pass sans compteur), SEO (métadonnées, Open Graph, JSON-LD `Event` et `BreadcrumbList`, Partager), rubrique « Festival » dans l'en-tête et le menu ☰, bloc 5 « Rendez-vous otaku » de l'accueil.

## Réalisé

Module `src/modules/evenements/` (queries-publiques, images, adresse, voir-plus), `src/components/festival/`, `BlocRendezVous`, pages, JSON-LD `evenementJsonLd`, tests unitaires (festival-*), e2e `festival.spec.ts`. Lecture anon sur colonnes nommées (jamais `auteur_id`), cache `evenements`. Revue indépendante : aucun bloquant de sécurité ; adresse mal formée refusée avant le cache.

## Écarts avec les critères (volontaires, règle 14)

Reportés aux stories dont les tables n'existent pas encore : bouton « Acheter des pass », « Candidater » (Stand), « Complet » et « Vente fermée », `places_evenement_utilisees` et Capacité (7.4 et 7.5), « Me prévenir » (7.3), lien de Galerie d'événement (7.10).

## Textes à fournir (`[Texte à fournir]`, règle 15)

FR, espace `Festival` : `avenir`, `passes`, `passe`, `programme`, `pass`. EN : les mêmes plus `titre` et `vide`, et `Accueil.rendezVous.titre`. Le build de production avec `KOMA_VERIFIER_TEXTES` refuse la mise en ligne tant qu'il en reste.

## Limites connues

JSON-LD sans `address` (aucune adresse n'est saisie : rien d'inventé) ni `eventStatus` ; un événement « à venir » peut rester classé tel pendant la durée du cache (quelques minutes) ; sitemap non modifié.
