---
title: 'Story 7.1 : Créer un Événement et ses Types de pass'
type: 'feature'
created: '2026-11-10'
status: 'done'
route: 'dispatch'
---

## Intent

Jonathan crée, depuis l'admin, autant d'Événements qu'il veut, sans rien d'écrit en dur : textes FR/EN, dates, lieu, photos, Capacité, dates de vente, Types de pass libres (nom FR/EN, prix USD, quota facultatif, ce qui est inclus, case « Stand »). La publication est refusée avec la liste de ce qui manque. Décisions : `sprint-change-proposal-2026-11-10.md` (FR-33, FR-33b, FR-52, AD-37).

## Réalisé

- Migrations `20270103100000_evenements.sql` (tables `evenement` et `type_pass`, RLS lecture publique des seuls Événements publiés, fonctions `enregistrer_evenement`, `manques_publication_evenement`, `publier_evenement`, `depublier_evenement`, réglage `frais_annulation_pass` de 0 à 100) et `20270103110000_evenements_correctif_manques.sql` (correctif trouvé en essayant la migration sur koma-dev : `text[] || 'texte'` était lu comme un tableau). Appliquées sur koma-dev uniquement, types régénérés. Aucune donnée créée par la migration.
- Module `src/modules/evenements/` (types, schémas, service, queries, dépendances, actions), conforme au modèle des Articles.
- Admin : `/admin/evenements` (liste), `/nouveau`, `/[id]` (formulaire, Types de pass, photos, panneau de publication avec la liste des manques lue en base) ; entrée « Événements » dans la navigation ; droit `evenements.gerer` ; champ « Frais d'annulation des Pass » dans les Réglages (vide : « Valeur à fixer », règle 15).
- Dates saisies et affichées à l'heure de Goma (UTC+2), stockées en instants absolus.
- Tests : `evenements-service.test.ts` (34), `evenements-admin-ui.test.tsx` (11), pgTAP `evenement.test.sql` (27, exécuté par la CI) ; scénario SQL rejoué sur koma-dev dans une transaction annulée.

## Choix et limites

- Le retrait d'un Type de pass le supprime. La story 7.4 ajoutera la clé étrangère `ligne_commande.type_pass_id` et refusera le retrait d'un Type déjà commandé.
- « Pass vendus et scannés » du détail admin (FR-52) : les tables de Pass n'existent pas avant 7.4 et 7.5 ; le bloc est ajouté avec elles (noté dans `deferred-work.md`), aucun chiffre n'est inventé.
- Le bloc « Capacité » compte les Stands pour deux à partir de la 7.2 (`places_evenement_utilisees`).
- Le lieu est « salle » ou « plein air » plus un texte libre FR et EN.
