# Proposition de changement de sprint — 2026-10-31

Décisions de Jonathan, appliquées aux documents. Aucun code des stories faites (1.1 à 3.3) n'est touché.

## 1. GeniusPay abandonné
- Mobile money : PawaPay, K-Pay, MaishaPay uniquement (trois agrégateurs).
- Story 5.8 retirée (numéro non réutilisé). Q-2 abandonnée. Q-1 et Q-3 inchangées pour les trois restants.
- Documents mis à jour : CLAUDE.md, PRD, architecture (AD-5, risques, questions ouvertes), epics.md, EXPERIENCE.md (sans objet), `.env.example`, `docs/guide-koma-shop.md`, sprint-status.yaml.

## 2. E-10 abandonné : aucune mesure collectée ni stockée
- Story 6.4 redéfinie : bouton « Envoyer mes mesures sur WhatsApp » (page de commande + email de confirmation) vers le numéro des réglages, message pré-rempli avec le numéro de commande ; le délai de fabrication court à partir de la réception des mesures, affiché clairement.
- Retiré : table `mesures`, `ligne_panier.mesures`, `schemaMesures`, `corriger_mesures`, `valider_mesures`, Schéma des Mesures (UX-DR24 remplacé), blocage de l'ajout au panier.
- **Point à valider par Jonathan** : story 6.5 redéfinie en « Réception des mesures confirmée » : Jonathan touche « Mesures reçues » ; le site enregistre seulement une date (`ligne_commande.mesures_recues_le`, aucune mesure) ; elle sert de point de départ du délai et de condition pour passer `en fabrication`.
- Aucune migration existante ne contient de table de mesures (vérifié).

## 3. Domaine acheté
- Q-D1 non touchée en attendant le nom du domaine donné par Jonathan.
