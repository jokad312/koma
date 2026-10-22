"use server";

import { dependances } from "./dependances";
import { cleReglageSchema } from "./schemas";
import * as service from "./service";
import type { CodeErreurAdmin } from "./types";

// Résultat rendu par le formulaire : le succès n'existe qu'après la réponse réelle de la base. La saisie revient toujours,
// pour que rien ne soit ressaisi après un échec.
export type EtatReglage =
  | { statut: "succes"; cle: string; valeur: string }
  | { statut: "erreur"; cle: string; erreur: CodeErreurAdmin; valeur: string };

// Action de formulaire (état précédent, données du formulaire) : droit, validation, écriture, puis updateTag.
export async function enregistrerReglage(_etat: EtatReglage | null, formData: FormData): Promise<EtatReglage> {
  const cle = String(formData.get("cle") ?? "");
  const valeur = String(formData.get("valeur") ?? "");
  const cleLue = cleReglageSchema.safeParse(cle);
  if (!cleLue.success) return { statut: "erreur", cle, erreur: "generique", valeur };
  let resultat: Awaited<ReturnType<typeof service.enregistrerReglage>>;
  try {
    resultat = await service.enregistrerReglage(dependances(), { cle: cleLue.data, valeur });
  } catch {
    // Une exception ne doit jamais perdre la saisie : message générique, valeur rendue.
    console.error("[admin] réglage : exception inattendue");
    return { statut: "erreur", cle, erreur: "generique", valeur };
  }
  if (!resultat.ok) return { statut: "erreur", cle, erreur: resultat.erreur, valeur };
  return { statut: "succes", cle, valeur: resultat.valeur ?? "" };
}
