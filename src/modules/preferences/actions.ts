"use server";

import { dependancesPreferences } from "./dependances";
import * as service from "./service";

// Server Action de la page Préférences : l'objet et l'état sont vérifiés à l'exécution par le service.
export async function reglerPreferenceAction(entree: unknown) {
  return service.reglerPreference(dependancesPreferences(), entree);
}
