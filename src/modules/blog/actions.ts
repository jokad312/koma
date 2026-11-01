"use server";

import { dependances } from "./dependances";
import * as service from "./service";
import type { CodeErreurBlog } from "./types";

import type { ArticleImage } from "./types";

// Résultats rendus aux formulaires : le succès n'existe qu'après la réponse réelle de la base (règle 13).
export type EtatArticle =
  | { statut: "succes"; id: string; cree: boolean }
  | { statut: "erreur"; erreur: CodeErreurBlog };

export async function enregistrerArticleAction(entree: { id: string | null; article: { titreFr: string; texteFr: string; titreEn: string | null; texteEn: string | null; slug: string | null; lienProduitId: string | null; images: ArticleImage[] } }): Promise<EtatArticle> {
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