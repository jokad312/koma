"use server";

import { creerCommandePass, lireRecapitulatifPass } from "./achat";
import { dependancesAchat } from "./achat-dependances";
import type { EntreeCreerCommandePass, EntreeRecapitulatifPass } from "./achat-schemas";

// Récapitulatif recalculé par le serveur à chaque changement (le total affiché ne vient jamais du navigateur).
export async function lireRecapitulatifPassAction(entree: EntreeRecapitulatifPass, langue: "fr" | "en") {
  return lireRecapitulatifPass(dependancesAchat(), entree, langue === "en" ? "en" : "fr");
}

// « Confirmer » : crée la Commande de Pass en attente ; le client passe ensuite au choix du moyen de paiement.
export async function creerCommandePassAction(entree: EntreeCreerCommandePass, langue: "fr" | "en") {
  return creerCommandePass(dependancesAchat(), entree, langue === "en" ? "en" : "fr");
}
