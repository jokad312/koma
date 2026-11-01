"use server";

import { dependances } from "./dependances";
import type { EntreeCreerCommande, EntreeObtenirKitGratuit, EntreeRecapitulatif } from "./schemas";
import * as service from "./service";

export async function obtenirKitGratuit(entree: EntreeObtenirKitGratuit) {
  return service.obtenirKitGratuit(dependances(), entree);
}

// Récapitulatif recalculé par le serveur quand le client change de Zone ou de Mode (le total affiché ne vient jamais du navigateur).
export async function lireRecapitulatif(entree: EntreeRecapitulatif, langue: "fr" | "en") {
  return service.lireRecapitulatif(dependances(), entree, langue === "en" ? "en" : "fr");
}

// « Confirmer la commande » : crée la Commande en attente.
export async function creerCommande(entree: EntreeCreerCommande, langue: "fr" | "en") {
  return service.creerCommande(dependances(), entree, langue === "en" ? "en" : "fr");
}
