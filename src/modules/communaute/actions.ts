"use server";

import { dependancesCommunaute } from "./dependances";
import * as service from "./service";

// Server Actions de « Mon compte › Envoyer une photo » : chaque entrée est vérifiée à l'exécution par le service.
export async function demanderEnvoiPhotoAction(entree: unknown) {
  return service.demanderEnvoiPhoto(dependancesCommunaute(), entree);
}

export async function finaliserPhotoAction(entree: unknown) {
  return service.finaliserPhoto(dependancesCommunaute(), entree);
}

export async function annulerEnvoiPhotoAction(entree: unknown) {
  return service.annulerEnvoiPhoto(dependancesCommunaute(), entree);
}

export async function retirerPhotoAction(entree: unknown) {
  return service.retirerPhoto(dependancesCommunaute(), entree);
}
