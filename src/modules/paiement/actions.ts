"use server";

import { dependancesAdminPaiement } from "./dependances";
import { changerEtatPrestataire, deplacerPrestataire, type ResultatPrestataire } from "./service";

// Le droit est revérifié dans le service ; le résultat n'est un succès qu'après la réponse réelle de la base (règle 13).
export async function changerEtatPrestataireAction(entree: { code: string; actif: boolean }): Promise<ResultatPrestataire> {
  return changerEtatPrestataire(dependancesAdminPaiement(), entree);
}

export async function deplacerPrestataireAction(entree: { code: string; sens: string }): Promise<ResultatPrestataire> {
  return deplacerPrestataire(dependancesAdminPaiement(), entree);
}
