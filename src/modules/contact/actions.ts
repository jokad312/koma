"use server";

import { dependances } from "./dependances";
import { langueContactSchema } from "./schemas";
import * as service from "./service";
import type { ChampContact, CodeChampContact, CodeErreurContact } from "./types";

// Résultat rendu par le formulaire : le succès n'existe qu'après la réponse réelle de la base. La saisie revient toujours
// en cas d'échec, pour que rien ne soit ressaisi.
export type EtatContact =
  | { statut: "succes" }
  | {
      statut: "erreur";
      erreur: CodeErreurContact;
      champs: Partial<Record<ChampContact, CodeChampContact>>;
      valeurs: { nom: string; email: string; message: string };
    };

export async function envoyerMessageContact(_etat: EtatContact | null, formData: FormData): Promise<EtatContact> {
  const valeurs = {
    nom: String(formData.get("nom") ?? ""),
    email: String(formData.get("email") ?? ""),
    // Le multipart envoie les retours à la ligne en CRLF : on les ramène à LF (un seul caractère, comme maxLength et la base).
    message: String(formData.get("message") ?? "").replace(/\r\n?/g, "\n"),
  };
  const langue = langueContactSchema.catch("fr").parse(formData.get("langue"));
  try {
    const resultat = await service.envoyerMessageContact(dependances(), { ...valeurs, langue });
    if (resultat.ok) return { statut: "succes" };
    return { statut: "erreur", erreur: resultat.erreur, champs: resultat.champs, valeurs };
  } catch {
    // Une exception ne doit jamais perdre la saisie : message générique, valeurs rendues.
    console.error("[contact] exception inattendue");
    return { statut: "erreur", erreur: "generique", champs: {}, valeurs };
  }
}
