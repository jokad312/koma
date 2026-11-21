"use server";

import { changerEtatCodePromo, creerCodePromo, modifierCodePromo } from "./codes";
import { dependancesCodePromo } from "./dependances";
import type { EntreeCodePromo, EntreeModificationCodePromo, ResultatCodePromo } from "./types";

// Le droit est revérifié dans le service ; le résultat n'est un succès qu'après la réponse réelle de la base (règle 13).
export async function creerCodePromoAction(entree: EntreeCodePromo): Promise<ResultatCodePromo> {
  return creerCodePromo(dependancesCodePromo(), entree);
}

// Story 9.16 i : corbeille (désactiver) et « Réactiver » ; seul l'état change, le reste est relu en base par le service.
export async function changerEtatCodePromoAction(id: string, actif: boolean): Promise<ResultatCodePromo> {
  return changerEtatCodePromo(dependancesCodePromo(), id, actif);
}

export async function modifierCodePromoAction(id: string, entree: EntreeModificationCodePromo): Promise<ResultatCodePromo> {
  return modifierCodePromo(dependancesCodePromo(), id, entree);
}
