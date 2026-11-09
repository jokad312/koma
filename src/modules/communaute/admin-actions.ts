"use server";

import { dependancesGalerie } from "./admin-dependances";
import * as service from "./admin-service";

// Server Actions de la page admin « Galerie » : droit galerie.valider vérifié par le service, puis par chaque fonction SQL.
export async function validerPhotoAction(entree: unknown) {
  return service.validerPhoto(dependancesGalerie(), entree);
}

export async function refuserPhotoAction(entree: unknown) {
  return service.refuserPhoto(dependancesGalerie(), entree);
}

export async function retirerPhotoAdminAction(entree: unknown) {
  return service.retirerPhotoAdmin(dependancesGalerie(), entree);
}

export async function demanderEnvoiDepotAction(entree: unknown) {
  return service.demanderEnvoiDepot(dependancesGalerie(), entree);
}

export async function deposerPhotoWhatsappAction(entree: unknown) {
  return service.deposerPhotoWhatsapp(dependancesGalerie(), entree);
}
