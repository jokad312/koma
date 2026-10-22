"use server";

import { dependances } from "./dependances";
import * as service from "./service";
import type { ChampProduit, ChampUnivers, CodeErreurCatalogue, EntreeProduit, EntreeUnivers, Taille } from "./types";

// Résultats rendus aux formulaires : le succès n'existe qu'après la réponse réelle de la base (règle 13).
// Les écritures passent toujours par ces actions (jamais depuis le navigateur) ; le droit est revérifié dans le service.
export type EtatUnivers =
  | { statut: "succes" }
  | { statut: "erreur"; erreur: CodeErreurCatalogue; champ?: ChampUnivers };

export type EtatProduit =
  | { statut: "succes"; id: string; cree: boolean }
  | { statut: "erreur"; erreur: CodeErreurCatalogue; champ?: ChampProduit; taille?: Taille; slugPropose?: string };

export async function creerUnivers(entree: EntreeUnivers): Promise<EtatUnivers> {
  try {
    const resultat = await service.creerUnivers(dependances(), entree);
    if (!resultat.ok) return { statut: "erreur", erreur: resultat.erreur, champ: resultat.champ as ChampUnivers | undefined };
    return { statut: "succes" };
  } catch {
    // Une exception ne doit jamais faire croire à un succès : message générique, saisie conservée côté formulaire.
    console.error("[catalogue] univers : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}

export async function enregistrerProduit(entree: EntreeProduit): Promise<EtatProduit> {
  try {
    const resultat = await service.enregistrerProduit(dependances(), entree);
    if (!resultat.ok) {
      return { statut: "erreur", erreur: resultat.erreur, champ: resultat.champ as ChampProduit | undefined, taille: resultat.taille, slugPropose: resultat.slugPropose };
    }
    return { statut: "succes", id: resultat.id, cree: resultat.cree };
  } catch {
    console.error("[catalogue] produit : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}
