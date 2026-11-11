"use server";

import { dependancesAlertes } from "./dependances";
import * as service from "./service";
import type { ChampAlerte, CodeChampAlerte, CodeErreurAlerte } from "./types";

// Résultat rendu au formulaire : le succès n'existe qu'après la réponse réelle de la base. La saisie revient toujours en cas d'échec.
export type EtatAlerte =
  | { statut: "succes" }
  | {
      statut: "erreur";
      erreur: CodeErreurAlerte;
      champs: Partial<Record<ChampAlerte, CodeChampAlerte>>;
      valeurs: { canal: string; email: string; whatsapp: string; consentement: boolean };
    };

export async function inscrireAlerteAction(_etat: EtatAlerte | null, formData: FormData): Promise<EtatAlerte> {
  const valeurs = {
    canal: String(formData.get("canal") ?? ""),
    email: String(formData.get("email") ?? ""),
    whatsapp: String(formData.get("whatsapp") ?? ""),
    // Une case cochée envoie « on » ; absente, elle n'est pas envoyée.
    consentement: formData.get("consentement") === "on",
  };
  try {
    const resultat = await service.inscrireAlerte(dependancesAlertes(), {
      evenementId: formData.get("evenementId"),
      langue: formData.get("langue"),
      ...valeurs,
    });
    if (resultat.ok) return { statut: "succes" };
    return { statut: "erreur", erreur: resultat.erreur, champs: resultat.champs, valeurs };
  } catch {
    console.error("[alertes] exception inattendue");
    return { statut: "erreur", erreur: "generique", champs: {}, valeurs };
  }
}
