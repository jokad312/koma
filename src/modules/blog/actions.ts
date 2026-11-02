"use server";

import { dependances } from "./dependances";
import * as service from "./service";
import type { ArticleImage, CodeErreurBlog } from "./types";

// Résultats rendus aux formulaires : le succès n'existe qu'après la réponse réelle de la base (règle 13).
export type EtatArticle =
  | { statut: "succes"; id: string; cree: boolean }
  | { statut: "erreur"; erreur: CodeErreurBlog };

export type EtatAutorisationImage = ({ statut: "succes"; objet: string; jeton: string } | { statut: "erreur"; erreur: CodeErreurBlog });
export type EtatImage = ({ statut: "succes"; image: ArticleImage } | { statut: "erreur"; erreur: CodeErreurBlog });
export type EtatAction = { statut: "succes" } | { statut: "erreur"; erreur: CodeErreurBlog };

// Le droit est revérifié dans le service ; l'entrée vient du formulaire admin, jamais d'une écriture directe.
export async function enregistrerArticleAction(entree: {
  id: string | null;
  article: {
    titreFr: string;
    texteFr: string;
    titreEn: string | null;
    texteEn: string | null;
    slug: string | null;
    lienProduitId: string | null;
    images: ArticleImage[];
  };
}): Promise<EtatArticle> {
  try {
    const resultat = await service.enregistrerArticle(dependances(), entree);
    if (!resultat.ok) return { statut: "erreur", erreur: resultat.erreur };
    return { statut: "succes", id: resultat.id, cree: resultat.cree };
  } catch {
    console.error("[blog] article : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}

export async function publierArticleAction(entree: { id: string; publier: boolean }): Promise<EtatArticle> {
  try {
    const resultat = await service.changerPublication(dependances(), entree);
    if (!resultat.ok) return { statut: "erreur", erreur: resultat.erreur };
    return { statut: "succes", id: resultat.id, cree: false };
  } catch {
    console.error("[blog] publication : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}

export async function demanderEnvoiImageArticle(entree: { type: string; taille: number }): Promise<EtatAutorisationImage> {
  try {
    const resultat = await service.demanderEnvoiImage(dependances(), entree);
    if (!resultat.ok) return { statut: "erreur", erreur: resultat.erreur };
    return { statut: "succes", objet: resultat.objet, jeton: resultat.jeton };
  } catch {
    console.error("[blog] image : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}

export async function finaliserImageArticle(entree: { objet: string; altFr: string; altEn: string }): Promise<EtatImage> {
  try {
    const resultat = await service.finaliserImage(dependances(), entree);
    if (!resultat.ok) return { statut: "erreur", erreur: resultat.erreur };
    return { statut: "succes", image: { fichier: resultat.fichier, altFr: resultat.altFr, altEn: resultat.altEn } };
  } catch {
    console.error("[blog] image : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}

export async function annulerEnvoiImageArticle(entree: { objet: string }): Promise<EtatAction> {
  try {
    const resultat = await service.annulerEnvoiImage(dependances(), entree);
    if (!resultat.ok) return { statut: "erreur", erreur: resultat.erreur };
    return { statut: "succes" };
  } catch {
    console.error("[blog] image : exception inattendue");
    return { statut: "erreur", erreur: "generique" };
  }
}
