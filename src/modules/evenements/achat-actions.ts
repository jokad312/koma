"use server";

import { creerCommandePass, lireRecapitulatifPass } from "./achat";
import { dependancesAchat } from "./achat-dependances";
import type { EntreeCreerCommandePass, EntreeRecapitulatifPass } from "./achat-schemas";
import { langueServie } from "@/i18n/routing";

// Récapitulatif recalculé par le serveur à chaque changement (le total affiché ne vient jamais du navigateur).
export async function lireRecapitulatifPassAction(entree: EntreeRecapitulatifPass, langue: "fr" | "en") {
  return lireRecapitulatifPass(dependancesAchat(), entree, langueServie(langue));
}

// « Confirmer » : crée la Commande de Pass en attente ; le client passe ensuite au choix du moyen de paiement.
export async function creerCommandePassAction(entree: EntreeCreerCommandePass, langue: "fr" | "en") {
  return creerCommandePass(dependancesAchat(), entree, langueServie(langue));
}
