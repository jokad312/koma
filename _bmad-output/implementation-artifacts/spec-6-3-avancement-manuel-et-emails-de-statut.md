# Spec 6.3 : Avancement manuel des Commandes et emails de statut

Source : `epics.md`, story 6.3 (FR-24, FR-44, AD-3, AD-9, UX-DR44, E-24, E-30, règles 2 et 12).

## Plan (approuvé par l'agent, mode enchaîné)
- Migration `20261212100000_avancer_statut.sql` : trois valeurs de `envoi_modele` (`commande_en_fabrication`, `commande_expediee`, `commande_livree`) et `avancer_statut(auteur, numero, vers, suivi)` : seules `payee→en_fabrication`, `payee→expediee` (lignes toutes en stock), `en_fabrication→expediee`, `expediee→livree` ; sinon `KS_TRANSITION_INTERDITE`. Jamais « payee » (règle 2). Numéro de suivi libre, 100 caractères, seulement à l'expédition. Dates posées. Email planifié dans la même transaction (clé unique par Commande et statut). Une ligne Sur-mesure sans réception des mesures bloque le passage en fabrication (`KS_MESURES_NON_RECUES`, utilisé par la 6.5).
- `transitionsPossibles` (pur) : une transition interdite est absente de l'écran, pas désactivée ; sauf « Passer en fabrication » inactif avec sa raison tant que les mesures manquent (6.5).
- Emails : trois modèles rendus par la boîte d'envoi existante, relus en base au moment du rendu ; `commande_livree` invite à envoyer la photo par WhatsApp avec le numéro des réglages (aucune invitation s'il est absent) ; un Kit seul ne reçoit jamais `commande_livree` (aucune transition possible).
- Admin : bloc « Avancement » du détail avec champ de suivi facultatif.
