"use server";

import { dependancesHorsLigne } from "./hors-ligne-dependances";
import * as service from "./hors-ligne-service";
import type { ResultatEtat, ResultatForcage, ResultatLiberation, ResultatPrise, ResultatSynchroServeur } from "./hors-ligne-types";

// Points d'entrée serveur du Scan hors ligne (story 7.8). Aucun jeton ni code court ne passe ici : seulement des empreintes. Rien n'est gardé ni journalisé.
export async function prendreVerrouAction(entree: { evenementId: string; appareil: string }): Promise<ResultatPrise> {
  try {
    return await service.prendreEtTelecharger(dependancesHorsLigne(), { evenementId: entree?.evenementId, appareil: entree?.appareil });
  } catch {
    console.error("[scan-hors-ligne] prise : exception inattendue");
    return { ok: false, erreur: "generique" };
  }
}

export async function synchroniserScansAction(entree: { evenementId: string; appareil: string; scans: unknown[] }): Promise<ResultatSynchroServeur> {
  try {
    return await service.synchroniserScans(dependancesHorsLigne(), { evenementId: entree?.evenementId, appareil: entree?.appareil, scans: entree?.scans });
  } catch {
    console.error("[scan-hors-ligne] synchronisation : exception inattendue");
    return { ok: false, erreur: "generique" };
  }
}

export async function libererVerrouAction(entree: { evenementId: string; appareil: string }): Promise<ResultatLiberation> {
  try {
    return await service.libererVerrou(dependancesHorsLigne(), { evenementId: entree?.evenementId, appareil: entree?.appareil });
  } catch {
    console.error("[scan-hors-ligne] libération : exception inattendue");
    return { ok: false, erreur: "generique" };
  }
}

export async function lireEtatVerrouAction(entree: { evenementId: string; appareil: string }): Promise<ResultatEtat> {
  try {
    return await service.lireEtatVerrou(dependancesHorsLigne(), { evenementId: entree?.evenementId, appareil: entree?.appareil });
  } catch {
    console.error("[scan-hors-ligne] état : exception inattendue");
    return { ok: false, erreur: "generique" };
  }
}

export async function forcerLiberationVerrouAction(entree: { evenementId: string }): Promise<ResultatForcage> {
  try {
    return await service.forcerLiberation(dependancesHorsLigne(), { evenementId: entree?.evenementId });
  } catch {
    console.error("[scan-hors-ligne] libération forcée : exception inattendue");
    return { ok: false, erreur: "generique" };
  }
}
