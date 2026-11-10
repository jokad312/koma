"use server";

import { dependances } from "./dependances";
import * as service from "./service";
import type { CodeErreurEvenement, EntreeEvenement, ImageEvenement } from "./types";

// Résultats rendus aux formulaires : le succès n'existe qu'après la réponse réelle de la base (règle 13).
export type EtatEvenement =
  | { statut: "succes"; id: string; cree: boolean }
  | { statut: "erreur"; erreur: CodeErreurEvenement; manques?: string[] };
export type EtatAutorisationImage = { statut: "succes"; objet: string; jeton: string } | { statut: "erreur"; erreur: CodeErreurEvenement };
export type EtatImage = { statut: "succes"; image: ImageEvenement } | { statut: "erreur"; erreur: CodeErreurEvenement };
export type EtatAction = { statut: "succes" } | { statut: "erreur"; erreur: CodeErreurEvenement };

export async function enregistrerEvenementAction(entree: { id: string | null; evenement: EntreeEvenement }): Promise<EtatEvenement> {
  try {
    const r = await service.enregistrerEvenement(dependances(), entree);
    return r.ok ? { statut: "succes", id: r.id, cree: r.cree } : { statut: "erreur", erreur: r.erreur };
  } catch {
    console.error("[evenements] enregistrement : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}

export async function publierEvenementAction(entree: { id: string; publier: boolean }): Promise<EtatEvenement> {
  try {
    const r = await service.changerPublication(dependances(), entree);
    if (r.ok) return { statut: "succes", id: r.id, cree: false };
    return { statut: "erreur", erreur: r.erreur, ...(r.manques ? { manques: r.manques } : {}) };
  } catch {
    console.error("[evenements] publication : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}

export async function demanderEnvoiImageEvenement(entree: { type: string; taille: number }): Promise<EtatAutorisationImage> {
  try {
    const r = await service.demanderEnvoiImage(dependances(), entree);
    return r.ok ? { statut: "succes", objet: r.objet, jeton: r.jeton } : { statut: "erreur", erreur: r.erreur };
  } catch {
    console.error("[evenements] image : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}

export async function finaliserImageEvenement(entree: { objet: string; altFr: string; altEn: string }): Promise<EtatImage> {
  try {
    const r = await service.finaliserImage(dependances(), entree);
    return r.ok ? { statut: "succes", image: { fichier: r.fichier, altFr: r.altFr, altEn: r.altEn } } : { statut: "erreur", erreur: r.erreur };
  } catch {
    console.error("[evenements] image : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}

export async function annulerEnvoiImageEvenement(entree: { objet: string }): Promise<EtatAction> {
  try {
    const r = await service.annulerEnvoiImage(dependances(), entree);
    return r.ok ? { statut: "succes" } : { statut: "erreur", erreur: r.erreur };
  } catch {
    console.error("[evenements] image : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}
