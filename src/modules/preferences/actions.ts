"use server";

import { dependancesPreferences } from "./dependances";
import * as service from "./service";

// Server Action de la page Préférences : l'objet et l'état sont vérifiés à l'exécution par le service.
export async function reglerPreferenceAction(entree: unknown) {
  return service.reglerPreference(dependancesPreferences(), entree);
}

// Bouton « Me désinscrire » de la page de confirmation (POST) : la signature est revérifiée par le service avant tout appel à la base.
// Appelable avec n'importe quelle valeur : l'entrée est contrôlée à l'exécution.
export async function desinscrireAction(entree: unknown) {
  const e = typeof entree === "object" && entree !== null ? (entree as Record<string, unknown>) : {};
  return service.desinscrireParLien(dependancesPreferences(), { c: e.c, s: e.s });
}
