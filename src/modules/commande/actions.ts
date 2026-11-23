"use server";

import { dependances } from "./dependances";
import type { EntreeCreerCommande, EntreeObtenirKitGratuit, EntreeRecapitulatif } from "./schemas";
import * as service from "./service";
import { langueServie } from "@/i18n/routing";

export async function obtenirKitGratuit(entree: EntreeObtenirKitGratuit) {
  return service.obtenirKitGratuit(dependances(), entree);
}

// Récapitulatif recalculé par le serveur quand le client change de Zone ou de Mode (le total affiché ne vient jamais du navigateur).
export async function lireRecapitulatif(entree: EntreeRecapitulatif, langue: "fr" | "en") {
  return service.lireRecapitulatif(dependances(), entree, langueServie(langue));
}

// « Confirmer la commande » : crée la Commande en attente.
export async function creerCommande(entree: EntreeCreerCommande, langue: "fr" | "en") {
  return service.creerCommande(dependances(), entree, langueServie(langue));
}
