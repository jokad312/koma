"use server";

import { dependances } from "./dependances";
import type { EntreeObtenirKitGratuit } from "./schemas";
import * as service from "./service";

export async function obtenirKitGratuit(entree: EntreeObtenirKitGratuit) {
  return service.obtenirKitGratuit(dependances(), entree);
}
