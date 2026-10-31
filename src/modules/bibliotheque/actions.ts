"use server";

import { dependances } from "./dependances";
import * as service from "./service";

// État du visiteur pour un Kit, lu au moment de la requête (la fiche elle-même reste publique et en cache).
export async function lireEtatKit(produitId: string) {
  return service.lireEtatKit(dependances(), produitId);
}
