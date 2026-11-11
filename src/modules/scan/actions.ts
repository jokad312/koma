"use server";

import { getLocale } from "next-intl/server";
import { dependancesScan } from "./dependances";
import * as service from "./service";
import type { ResultatScan } from "./types";

// Un seul point d'entrée serveur : le jeton ou le code court n'est ni écrit dans une adresse, ni gardé par le serveur, ni journalisé.
export async function scannerPassAction(entree: { evenementId: string; charge?: string; code?: string }): Promise<ResultatScan> {
  try {
    const langue = await getLocale();
    return await service.scannerPass(dependancesScan(), { evenementId: entree?.evenementId, langue, charge: entree?.charge, code: entree?.code });
  } catch {
    console.error("[scan] exception inattendue");
    return { ok: false, erreur: "generique" };
  }
}
