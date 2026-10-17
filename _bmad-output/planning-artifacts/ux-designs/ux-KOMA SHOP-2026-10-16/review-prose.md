# Revue — lentille « prose » (bmad-review, doc_standards)

Contenu : `DESIGN.md` et `EXPERIENCE.md`, après la passe structure (`review-structure.md`). Lecteur : humains ; guide de style : Microsoft Writing Style Guide.

**Lecture du but** : ces deux documents aident les développeurs et les agents de stories à construire KOMA SHOP sans redécider l'aspect ni le comportement.

**Style à préserver** : français, phrases nominales et listes séparées par « ; » dans les tableaux ; termes du Glossaire du PRD avec majuscule (Kit, Pass, Panier, Agrégateur, Commande) ; titres de sections canoniques en anglais (Voice and Tone, Component Patterns…) ; libellés d'interface entre guillemets français ; marqueurs [HYPOTHÈSE] et renvois E-n / D-n / FR-n.

Toutes les lignes ci-dessous ont été **appliquées**. Aucune décision n'a été modifiée.

| Pass | Original Text | Revised Text | Changes |
|---|---|---|---|
| prose | « Les spines priment sur toute maquette, rendu ou import en cas de conflit. » (DESIGN) ; « Les spines priment sur toute maquette ou import. » (EXPERIENCE) ; « Les spines priment. » (EXPERIENCE › Accueil) | « En cas de conflit, ce document prime sur les maquettes. Il prime aussi sur les rendus et les imports. » (une fois par spine) | Anglicisme « spines » retiré ; phrase de primauté unique et explicite |
| prose | « Le DESIGN.md dit **à quoi ressemble** KOMA SHOP » | « DESIGN.md dit **à quoi ressemble** KOMA SHOP » | Nom de fichier sans article, comme `EXPERIENCE.md` dans la même phrase |
| prose | « Déclinaison selon le fond (fills vérifiés dans les SVG) » | Sous-puces « Crème : … » / « Sombre : … » (couleurs lues dans les SVG) | Anglicisme « fills » retiré ; une idée par ligne |
| prose | « La **structure** s'inspire des captures 1win importées : la structure seulement, jamais l'esthétique de casino ni ses mécaniques (référence de mise en page, pas de couleur). » | « La **mise en page** s'inspire des captures 1win importées, sans leur esthétique de casino, leurs couleurs ni leurs mécaniques. » | Répétition de « structure » et parenthèse redondante supprimées |
| prose | En-tête : « `{colors.surface-glass-strong}` (il passe au-dessus des photos au défilement). » | « Fond `{colors.surface-glass-strong}`, car il passe au-dessus des photos pendant le défilement. » | Lien de cause explicite ; antécédent de « il » clarifié |
| prose | « (rendu 13 px dans la maquette : ce document prime) » ; « (rendu 13 px : ce document prime) » | « (minimum 14 px ; la maquette rend 13 px) » | La règle vient d'abord, l'écart ensuite ; formulation identique aux deux endroits |
| prose | « Microcopy. La voix de marque est dans… » | « Microcopie. La voix de marque est dans… » | Terme français, cohérent avec le reste du document |
| prose | « Comportement. Visuels dans `DESIGN.md` › Components (mêmes noms). » | « Comportement seulement ; l'aspect est dans `DESIGN.md` › Components, sous les mêmes noms et dans les mêmes familles. » | Phrase complète ; annonce le regroupement par familles |
| prose | « Jamais un bouton muet. » (Bouton principal) | « Jamais un bouton désactivé sans explication. » | Métaphore ambiguë remplacée par la règle littérale |
| prose | UJ-4, variante : « 4. … ne compte pas).\nÉchecs : … » (la ligne « Échecs » était absorbée par l'élément 4 de la liste) | Ligne vide avant « Échecs : » | Rendu Markdown correct, identique aux autres parcours |
| prose | « E-15 | Échelle de niveau des Kits. (Liste des univers : E-29.) » | « E-15 | Échelle de niveau des Kits (rendu : Débutant, Intermédiaire, Avancé). » | Renvoi à une question tranchée retiré ; valeur rendue citée comme hypothèse |
| prose | « Liste des univers : E-29 (bloquant pour cette story). » ; « case d'acceptation : E-33. » ; « Transcription par chapitre : E-32. » ; « Relance : E-35. » ; « Annulation sur le téléphone : E-27. » ; « saisie manuelle d'un code : E-31. » ; « **Bloquant (E-13)** … [proposition à valider par Jonathan] » ; « [HYPOTHÈSE, E-24] » | Phrase qui énonce la décision, suivie du renvoi entre parenthèses (ex. « Univers : genres génériques, aucune liste saisie par défaut (E-29). ») | Le lecteur lit la règle sans ouvrir la liste des questions ; plus de « bloquant » ni de « à valider » sur des points tranchés |
| prose | Foundation › Langues : une phrase de 7 propositions séparées par « ; » | 4 sous-puces courtes | Phrases courtes ; une règle par ligne |

**Synthèse** : 13 corrections de prose appliquées (dont 1 regroupant 8 emplacements). Aucune reformulation de préférence ; voix et choix stylistiques conservés.
