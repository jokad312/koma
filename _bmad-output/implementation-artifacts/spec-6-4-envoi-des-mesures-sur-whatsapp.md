# Spec 6.4 : Envoi des mesures du Sur-mesure sur WhatsApp

Source : `epics.md`, story 6.4 (FR-8, FR-13, AD-34, UX-DR24, règle 15). Décision du 2026-10-31 : le site ne collecte ni ne stocke aucune mesure.

## Déjà en place (stories 4.x)
Aucun champ de mesure sur la fiche, texte « tu enverras tes mesures sur WhatsApp », case d'engagement à la commande (`sur_mesure` exigé par `creer_commande`).

## Ajouts
- `EnvoiMesures` sur la page de la commande payée contenant une ligne Sur-mesure : bouton « Envoyer mes mesures sur WhatsApp » vers le numéro des réglages (`lienWhatsapp` accepte un message prérempli avec le numéro de commande), délai de fabrication écrit à côté. Numéro absent : message qui invite à écrire depuis la page Contact, aucun numéro de repli. Une commande sans ligne Sur-mesure n'affiche jamais ce bloc.
- Email de confirmation (`commande_payee`) : paragraphe avec le lien WhatsApp (ou l'invitation à contacter) pour une ligne Sur-mesure seulement.
- Admin : message d'attention dans le détail d'une commande Sur-mesure quand le numéro WhatsApp n'est pas réglé.
