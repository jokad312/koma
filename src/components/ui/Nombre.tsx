import type { ReactNode } from "react";

// Nombre qui change (prix, total, quantité, remise, numéro de commande, code promo ou de Pass, compteur de l'admin) : exclu de la traduction
// automatique du navigateur (translate="no", et la classe notranslate pour les traducteurs qui ne lisent qu'elle). Sans ce marquage, le traducteur remplace le nœud texte par ses <font> et React met à jour l'ancien nœud, qui
// n'est plus affiché : l'ancien nombre resterait visible (A3-bis). Ne jamais envelopper une phrase ou un libellé : seulement le nombre.
export function Nombre({ children }: { children: ReactNode }) {
  return <span translate="no" className="notranslate">
      {children}
    </span>;
}

// Balise <nb> des messages : `t.rich("cle", { prix, nb })` enveloppe seulement le nombre, le reste du message reste traduisible.
export function nb(morceaux: ReactNode) {
  return <Nombre>{morceaux}</Nombre>;
}
