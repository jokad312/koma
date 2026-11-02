"use server";

import { dependances } from "./dependances";
import { dependancesVideo } from "./dependances-video";
import * as service from "./service";
import { enregistrerPosition } from "./video";

// État du visiteur pour un Kit, lu au moment de la requête (la fiche elle-même reste publique et en cache).
export async function lireEtatKit(produitId: string) {
  return service.lireEtatKit(dependances(), produitId);
}

// Position de lecture (toutes les 15 secondes et à la pause) : l'accès est revérifié par la base à chaque appel.
export async function enregistrerProgression(produitId: string, positionSecondes: number) {
  return enregistrerPosition(dependancesVideo(), produitId, Math.floor(positionSecondes));
}
