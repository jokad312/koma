---
title: 'Story 3.6 : ma bibliothèque et téléchargement des fichiers'
type: 'feature'
created: '2026-11-02'
status: 'done'
route: 'dispatch'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problème :** un client doit retrouver ses Kits et télécharger ses patrons autant de fois qu'il veut, sur n'importe quel appareil, sans jamais ouvrir un fichier sans accès payé ou offert (FR-27, FR-28, FR-30, règle 1, AD-11).

**Approche :** « Mon compte » avec « Ma bibliothèque » (une ligne par Kit) et la page d'un Kit ; `GET /api/kits/fichier/[id]` vérifie l'accès (base), crée une URL signée de 60 secondes à chaque clic ; les PDF sont remis en copie filigranée (`@cantoo/pdf-lib`, police TTF OFL), créée à la première remise par Compte et par version, puis réutilisée ; SVG, STL et transcriptions sans filigrane.

## Décisions

- Filigrane : « Acheté par jo•••@gmail.com · Commande KS-AAAA-NNNNNN · {nom du site} » (2 premiers caractères, « ••• », domaine ; numéro de la Commande d'origine de l'accès ; nom lu dans `nom_site` à chaque nouvelle copie). Texte en français dans `Bibliotheque.filigrane.texte` (une copie par Compte et par version, pas par langue).
- Police : Barlow Regular TTF (OFL 1.1), `src/fonts/filigrane/`, licence notée dans `docs/licences/polices.md` ; embarquée en entier (le sous-ensemble échoue avec ce fichier).
- Compte sans accès, fichier inconnu ou identifiant invalide : même refus 403 (rien ne révèle ce qui existe) ; visiteur non connecté : 401.
- « Mon compte » n'affiche que « Ma bibliothèque » (seule entrée existante) ; le lien est ajouté à l'en-tête des Comptes connectés.

</frozen-after-approval>

## Réalisé

- Migration `20261124100000_bibliotheque_fichiers.sql` (appliquée sur koma-dev, types régénérés) : table privée `fichier_filigrane` (RLS sans politique, aucun droit) ; fonctions `bibliotheque_lister`, `bibliotheque_kit`, `bibliotheque_fichier_a_servir`, `bibliotheque_enregistrer_filigrane` (security definer, search_path vide, service seulement, accès vérifié dans chaque fonction).
- Modules : `src/modules/bibliotheque/{filigrane,telechargement,dependances-telechargement,queries}.ts` ; route `src/app/api/kits/fichier/[id]/route.ts` ; pages `src/app/[locale]/compte/{layout,page}.tsx`, `bibliotheque/page.tsx`, `bibliotheque/[slug]/page.tsx` ; composants `src/components/bibliotheque/*` ; textes `Bibliotheque` FR/EN.
- Tests : pgTAP `bibliotheque_fichiers.test.sql` (23), Vitest `bibliotheque-{filigrane,telechargement}.test.ts`, `bibliotheque-bouton-ui.test.tsx`.

## Écarts / dette

- « Le lien a expiré. Touche à nouveau Télécharger. » n'existe pas : le lien n'est jamais affiché ni conservé, le navigateur le suit aussitôt ; un lien expiré ne peut donc pas être détecté côté client. À vérifier au test manuel.
- Anciennes copies filigranées (versions remplacées) restent dans `kits-private/filigranes/` : purge à prévoir.
- Le nom proposé au navigateur est toujours le nom français du fichier (la route ne connaît pas la langue).
- L'expiration réelle à 60 s est assurée par Supabase : à vérifier à la main (un lien copié ne marche plus après 60 s).
- Le texte de la Licence de kit reste « [Texte à fournir] » (Q-5, story 3.5).
