"use server";

import { dependances } from "./dependances";
import * as service from "./service";
import type { ChampProduit, ChampTranche, ChampUnivers, CodeErreurCatalogue, EntreeKit, EntreeProduit, EntreeTranche, EntreeUnivers, ManquePublication, Taille } from "./types";

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

export type EtatPhoto<T extends object = object> = ({ statut: "succes" } & T) | { statut: "erreur"; erreur: CodeErreurCatalogue; manques?: ManquePublication[] };

type Retour<T extends object> = ({ ok: true } & T) | { ok: false; erreur: CodeErreurCatalogue; manques?: ManquePublication[] };

// Même schéma pour toutes les actions de photo et de publication : le droit est revérifié dans le service, le succès n'est rendu
// qu'après la réponse réelle de la base ou du stockage, et une exception ne devient jamais un succès.
async function envelopper<T extends object>(nom: string, appel: () => Promise<Retour<T>>): Promise<EtatPhoto<T>> {
  try {
    const r = await appel();
    if (!r.ok) return { statut: "erreur", erreur: r.erreur, manques: r.manques };
    const { ok, ...reste } = r;
    void ok;
    return { statut: "succes", ...(reste as unknown as T) };
  } catch {
    console.error(`[catalogue] ${nom} : exception inattendue`);
    return { statut: "erreur", erreur: "generique" };
  }
}

export async function demanderEnvoiPhoto(entree: { produitId: string; type: string; taille: number; altFr: string; altEn: string }) {
  return envelopper<{ objet: string; jeton: string }>("envoi de photo", () => service.demanderEnvoiPhoto(dependances(), entree));
}

export async function finaliserPhoto(entree: { produitId: string; objet: string; altFr: string; altEn: string }) {
  return envelopper<{ id: string }>("photo", () => service.finaliserPhoto(dependances(), entree));
}

export async function annulerEnvoiPhoto(entree: { produitId: string; objet: string }) {
  return envelopper<object>("annulation d'envoi", () => service.annulerEnvoiPhoto(dependances(), entree));
}

export async function deplacerPhoto(entree: { photoId: string; sens: string }) {
  return envelopper<object>("déplacement de photo", () => service.deplacerPhoto(dependances(), entree));
}

export async function supprimerPhoto(entree: { photoId: string }) {
  return envelopper<object>("suppression de photo", () => service.supprimerPhoto(dependances(), entree));
}

export async function modifierAltPhoto(entree: { photoId: string; altFr: string; altEn: string }) {
  return envelopper<object>("texte alternatif", () => service.modifierAltPhoto(dependances(), entree));
}

export async function publierProduit(entree: { id: string }) {
  return envelopper<object>("publication", () => service.publierProduit(dependances(), entree));
}

export async function depublierProduit(entree: { id: string }) {
  return envelopper<object>("dépublication", () => service.depublierProduit(dependances(), entree));
}

// Résultat rendu à l'éditeur de tranches : le succès n'existe qu'après la réponse réelle de la base ; la saisie reste côté formulaire.
export type EtatTranches =
  | { statut: "succes" }
  | { statut: "erreur"; erreur: CodeErreurCatalogue; ligne?: number; champ?: ChampTranche };

export async function enregistrerTranchesPrix(entree: EntreeTranche[]): Promise<EtatTranches> {
  try {
    const resultat = await service.enregistrerTranchesPrix(dependances(), entree);
    if (!resultat.ok) return { statut: "erreur", erreur: resultat.erreur, ligne: resultat.ligne, champ: resultat.champTranche };
    return { statut: "succes" };
  } catch {
    console.error("[catalogue] tranches : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}

// ---- Kits et leurs fichiers (story 3.1) ----

export async function enregistrerKit(entree: EntreeKit): Promise<EtatProduit> {
  try {
    const resultat = await service.enregistrerKit(dependances(), entree);
    if (!resultat.ok) {
      return { statut: "erreur", erreur: resultat.erreur, champ: resultat.champ as ChampProduit | undefined, slugPropose: resultat.slugPropose };
    }
    return { statut: "succes", id: resultat.id, cree: resultat.cree };
  } catch {
    console.error("[catalogue] kit : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}

export async function demanderEnvoiFichierKit(entree: { produitId: string; nomFichier: string; format: string; taille: number; fichierId?: string }) {
  return envelopper<{ objet: string; jeton: string; contentType: string }>("envoi de fichier", () => service.demanderEnvoiFichierKit(dependances(), entree));
}

export async function finaliserFichierKit(entree: { produitId: string; objet: string; format: string; taille: number; nomFr: string; nomEn: string; fichierId?: string }) {
  return envelopper<{ id: string }>("fichier de kit", () => service.finaliserFichierKit(dependances(), entree));
}

export async function annulerEnvoiFichierKit(entree: { produitId: string; objet: string }) {
  return envelopper<object>("annulation d'envoi de fichier", () => service.annulerEnvoiFichierKit(dependances(), entree));
}

export async function supprimerFichierKit(entree: { fichierId: string }) {
  return envelopper<object>("suppression de fichier", () => service.supprimerFichierKit(dependances(), entree));
}
