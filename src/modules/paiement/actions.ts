"use server";

import { ajouterCouple, confirmerCouple, retirerCouple, type ResultatCouverture } from "./couverture";
import { dependancesAdminPaiement, dependancesCouverture, dependancesTentative } from "./dependances";
import { demarrerTentative, type ResultatTentative } from "./tentative";
import { changerEtatPrestataire, deplacerPrestataire, type ResultatPrestataire } from "./service";

// Le droit est revérifié dans le service ; le résultat n'est un succès qu'après la réponse réelle de la base (règle 13).
export async function changerEtatPrestataireAction(entree: { code: string; actif: boolean }): Promise<ResultatPrestataire> {
  return changerEtatPrestataire(dependancesAdminPaiement(), entree);
}

export async function deplacerPrestataireAction(entree: { code: string; sens: string }): Promise<ResultatPrestataire> {
  return deplacerPrestataire(dependancesAdminPaiement(), entree);
}

// Couverture des Agrégateurs (story 5.1) : le droit est revérifié dans le service ; la source est obligatoire.
export async function ajouterCoupleAction(entree: { prestataire: string; pays: string; operateur: string; source: string }): Promise<ResultatCouverture> {
  return ajouterCouple(dependancesCouverture(), entree);
}
export async function confirmerCoupleAction(id: string): Promise<ResultatCouverture> {
  return confirmerCouple(dependancesCouverture(), id);
}
export async function retirerCoupleAction(id: string): Promise<ResultatCouverture> {
  return retirerCouple(dependancesCouverture(), id);
}

// Lancement d'une Tentative (story 5.2) : le navigateur n'envoie que moyen, pays, opérateur et numéro ; le serveur choisit le Prestataire.
export async function demarrerTentativeAction(entree: { numero: string; moyen: string; pays: string | null; operateur: string | null; telephone: string | null }): Promise<ResultatTentative> {
  return demarrerTentative(dependancesTentative(), entree);
}
