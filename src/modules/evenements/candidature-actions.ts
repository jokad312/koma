"use server";

import { annulerEnvoiCandidature, demanderEnvoiCandidature, finaliserCandidature } from "./candidature";
import { dependancesCandidature, dependancesNommerAide, dependancesPaiementStand } from "./candidature-dependances";
import { creerCommandeStand, lireRecapitulatifStand, nommerAide } from "./candidature-paiement";

// Server Actions de la candidature Stand : chaque entrée est vérifiée à l'exécution par le service (jamais crue sur parole).
export async function demanderEnvoiCandidatureAction(entree: unknown) {
  return demanderEnvoiCandidature(dependancesCandidature(), entree);
}

export async function finaliserCandidatureAction(entree: unknown) {
  return finaliserCandidature(dependancesCandidature(), entree);
}

export async function annulerEnvoiCandidatureAction(entree: unknown) {
  return annulerEnvoiCandidature(dependancesCandidature(), entree);
}

export async function lireRecapitulatifStandAction(entree: unknown, langue: "fr" | "en") {
  return lireRecapitulatifStand(dependancesPaiementStand(), entree, langue === "en" ? "en" : "fr");
}

export async function creerCommandeStandAction(entree: unknown, langue: "fr" | "en") {
  return creerCommandeStand(dependancesPaiementStand(), entree, langue === "en" ? "en" : "fr");
}

export async function nommerAideAction(entree: unknown) {
  return nommerAide(dependancesNommerAide(), entree);
}
