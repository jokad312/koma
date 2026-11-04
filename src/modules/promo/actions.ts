"use server";

import { creerCodePromo, modifierCodePromo } from "./codes";
import { dependancesCodePromo } from "./dependances";
import type { EntreeCodePromo, EntreeModificationCodePromo, ResultatCodePromo } from "./types";

// Le droit est revérifié dans le service ; le résultat n'est un succès qu'après la réponse réelle de la base (règle 13).
export async function creerCodePromoAction(entree: EntreeCodePromo): Promise<ResultatCodePromo> {
  return creerCodePromo(dependancesCodePromo(), entree);
}

export async function modifierCodePromoAction(id: string, entree: EntreeModificationCodePromo): Promise<ResultatCodePromo> {
  return modifierCodePromo(dependancesCodePromo(), id, entree);
}
