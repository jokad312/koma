import type { StatutAffiche } from "./queries";

// Transitions que l'admin peut proposer (story 6.3, UX-DR44). Miroir de avancer_statut, qui refuse de toute façon côté base.
// Une transition interdite est ABSENTE (jamais désactivée) ; « payee », « offerte », « echouee » et « expiree » ne sont jamais proposés (règle 2).
export type TransitionCommande = "en_fabrication" | "expediee" | "livree";

export function transitionsPossibles(entree: { statut: StatutAffiche; offerte: boolean; lignesPhysiques: number; lignesFabriquees: number }): TransitionCommande[] {
  if (entree.offerte || entree.lignesPhysiques === 0) return [];
  switch (entree.statut) {
    case "payee":
      // Une pièce à fabriquer passe par la fabrication ; une Commande entièrement prise en stock part directement en expédition.
      return entree.lignesFabriquees === 0 ? ["expediee"] : ["en_fabrication"];
    case "en_fabrication":
      return ["expediee"];
    case "expediee":
      return ["livree"];
    default:
      return [];
  }
}
