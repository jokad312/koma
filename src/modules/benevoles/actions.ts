"use server";

import { dependancesBenevoles } from "./dependances";
import * as service from "./service";
import type { CodeErreurBenevole, StatutAttribution } from "./types";

// Résultats rendus à l'interface : le succès n'existe qu'après la réponse réelle de la base (règle 13). L'email revient toujours en cas d'échec.
export type EtatAttributionBenevole =
  | { statut: "succes"; resultat: StatutAttribution; email: string }
  | { statut: "erreur"; erreur: CodeErreurBenevole; email: string };
export type EtatRetraitBenevole = { statut: "succes"; retire: boolean } | { statut: "erreur"; erreur: CodeErreurBenevole };

export async function donnerAccesBenevoleAction(_etat: EtatAttributionBenevole | null, formData: FormData): Promise<EtatAttributionBenevole> {
  const email = String(formData.get("email") ?? "");
  try {
    const r = await service.attribuerAcces(dependancesBenevoles(), { evenementId: formData.get("evenementId"), email });
    return r.ok ? { statut: "succes", resultat: r.statut, email } : { statut: "erreur", erreur: r.erreur, email };
  } catch {
    console.error("[benevoles] attribution : exception inattendue");
    return { statut: "erreur", erreur: "generique", email };
  }
}

export async function retirerAccesBenevoleAction(entree: { evenementId: string; accesId: string }): Promise<EtatRetraitBenevole> {
  try {
    const r = await service.retirerAcces(dependancesBenevoles(), entree);
    return r.ok ? { statut: "succes", retire: r.retire } : { statut: "erreur", erreur: r.erreur };
  } catch {
    console.error("[benevoles] retrait : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}
