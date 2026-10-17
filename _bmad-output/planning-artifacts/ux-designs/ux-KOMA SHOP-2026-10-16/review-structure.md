# Revue — lentille « structure » (bmad-review, doc_standards)

Contenu : `DESIGN.md` et `EXPERIENCE.md` (documents, lecteur : humains — `reader_type = humans` ; guide de style : Microsoft Writing Style Guide). Revue faite au Finalize, après l'extraction des maquettes.

**Lecture du but** : ces deux documents existent pour aider les développeurs, l'architecte et les agents de stories à construire KOMA SHOP sans redécider l'aspect (DESIGN.md) ni le comportement (EXPERIENCE.md), avec un accès direct à un composant, un état ou une règle.

**Modèle retenu** : Reference/Database (accès direct, schéma constant par entrée, MECE). L'ordre canonique des sections est conservé dans les deux spines (`design-md-spec.md` ; spine EXPERIENCE du skill `bmad-ux`).

Toutes les lignes ci-dessous ont été **appliquées**. Aucune décision n'a été modifiée.

| Pass | Original Text | Revised Text | Changes |
|---|---|---|---|
| structure | DESIGN › Components — un seul tableau de 61 lignes, ordre d'ajout (~2 300 mots) | MOVE : 8 sous-sections par famille (Structure et navigation, Actions, Accueil et catalogues, Fiche produit, Formulaires/messages/emails, Panier et paiement, Compte/bibliothèque/Pass/Scan, Admin) | Accès direct par famille ; 0 mot retiré, +40 mots de titres |
| structure | EXPERIENCE › Component Patterns — un seul tableau de 62 lignes (~3 600 mots) | MOVE : mêmes 8 familles, même ordre que DESIGN.md | Les deux spines se lisent en parallèle ; noms identiques vérifiés (62 = 62) |
| structure | DESIGN « Bascule de thème / Sélecteur de langue » (une ligne) face à deux lignes dans EXPERIENCE | MERGE inverse : deux lignes « Bascule de thème » et « Sélecteur de langue » | Schéma constant : un composant = une ligne dans chaque spine |
| structure | EXPERIENCE › Questions ouvertes — 36 lignes mêlant ouvertes et tranchées, avec 12 fois « ✅ Décidé — recommandation retenue par Jonathan (2026-10-16) » et la recommandation complète (~1 480 mots) | CONDENSE : tableau « Questions ouvertes » (20 lignes) + tableau « Tranchées » (une décision par ligne, renvoi au memlog) | Les questions vraiment ouvertes passent en tête ; environ −260 mots |
| structure | DESIGN › Questions ouvertes — lignes barrées D-4, D-5, D-14 | CONDENSE : une ligne « Tranchées : D-4… D-5… D-14… » sous le tableau | Le tableau ne contient plus que l'ouvert |
| structure | DESIGN › Logo › puce « En-tête » (~120 mots, une phrase-bloc) ; même logo redécrit dans Layout › En-tête et Components › En-tête | CONDENSE : sous-puces (crème, sombre, largeur, alt) dans Logo ; Layout garde les dimensions de barre ; Components renvoie à Brand & Style › Logo | Une seule source par fait (fichiers et couleurs du logo) ; environ −45 mots |
| structure | DESIGN › Typography — cellule « Règles » de `display-brush` qui répétait la puce « Sakura Town, police principale… » | CONDENSE : la cellule liste les usages ; toutes les interdictions vivent dans la puce (lien, bouton, prix, étiquette, information indispensable conservés) | Fin de la redite tableau / puce |
| structure | DESIGN › Typography › puce « Hors vitrine » qui finissait sur la licence de Sakura Town | MOVE : puce dédiée « Licence de Sakura Town » (renvoi D-1) | Information bloquante pour la mise en ligne rendue visible |
| structure | EXPERIENCE › State Patterns — lignes « Bloc vide » et « Galerie vide » | MERGE en une ligne « Bloc vide » (liens Galerie compris) | Redite supprimée |
| structure | EXPERIENCE › Arborescence — ligne Galerie qui redisait la règle des liens (pied de page, ☰) | CONDENSE : renvoi à Navigation | Une seule source pour la règle |
| structure | EXPERIENCE › Inspiration & Anti-patterns — noms de fichiers des captures 1win, déjà listés dans DESIGN › Brand & Style | CONDENSE : renvoi à `DESIGN.md` › Brand & Style | Hors portée comportementale ; environ −15 mots |
| structure | EXPERIENCE › Accueil — paragraphe « Références visuelles » (palette, typo, captures, « Les spines priment ») | CUT + remplacé par le lien vers la maquette d'accueil | Redite des sources et de la phrase de primauté (gardée une seule fois en tête) |
| structure | EXPERIENCE — renvois en ligne à des questions **déjà tranchées** présentées comme ouvertes : E-13 « Bloquant » + « proposition à valider » (Trop-perçu), E-24 « [HYPOTHÈSE] », E-29 « bloquant pour cette story », E-27, E-32, E-33, E-35, E-31 | QUESTION → appliqué : chaque renvoi porte la décision du memlog ; E-25 « Prête à retirer » ajouté à la Frise des statuts | Cohérence interne ; aucune décision nouvelle |
| structure | EXPERIENCE › Foundation › puce « Langues » (une phrase de 7 propositions) | CONDENSE : 4 sous-puces ; règle Sakura Town renvoyée à Voice and Tone et DESIGN | Lisibilité ; environ −30 mots |
| structure | DESIGN › Contrastes de référence (tableau de 30 lignes, ligne barrée « verre discret sur média ») | PRESERVE | Preuve chiffrée des choix d'accessibilité ; la ligne barrée explique pourquoi le verre renforcé existe |
| structure | EXPERIENCE › Paiement & confiance (rappel des règles 2, 3, 9, 10, 13) | PRESERVE | Redite assumée : section la plus lue par les stories de paiement |
| structure | DESIGN › Do's and Don'ts (reprend la règle du rouge et du verre) | PRESERVE | Récapitulatif de contrôle, utile à la relecture d'une story |

**Synthèse** : 17 recommandations (14 appliquées en changement, 3 PRESERVE). Volume : DESIGN.md 8 458 mots (stable : condensations compensées par les titres de familles), EXPERIENCE.md 13 651 → 13 395 mots (−256, −1,9 %). Pas de cible de longueur fournie. Aucun sacrifice de compréhension : les décisions condensées restent dans le memlog et dans les sections concernées.
