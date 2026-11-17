import { tronquerDescription } from "@/modules/catalogue/fiche";

// Extrait lisible du texte d'un Article, pour la description des métadonnées et du JSON-LD : le Markdown est retiré
// (blocs de code, images, liens, balises, titres, puces, emphases), les espaces sont simplifiés, puis le texte est coupé
// à la fin d'un mot. Aucun texte inventé : vide ou marqueur « [Texte à fournir] » donne null.
export function extraireTexte(markdown: string, max = 160): string | null {
  const sansBlocs = markdown.replace(/```[\s\S]*?```/g, " ").replace(/`[^`]*`/g, " ");
  const sansImages = sansBlocs.replace(/!\[[^\]]*\]\([^)]*\)/g, " ");
  const avecLiens = sansImages.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  const sansBalises = avecLiens.replace(/<[^>]*>/g, " ");
  const sansTitres = sansBalises.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  const sansPuces = sansTitres.replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, "");
  const sansEmphase = sansPuces.replace(/[*_~>#]/g, " ");
  return tronquerDescription(sansEmphase, max);
}

// Story 9.16 g) (Q28) : extrait de la carte de la liste admin = les 160 premiers caractères du texte sans Markdown (mêmes règles de nettoyage
// que extraireTexte), suivis de « … » quand le texte est plus long. Compté en caractères réels (un emoji compte pour un). Vide : null.
export const LONGUEUR_EXTRAIT_CARTE = 160;

export function extraitCarte(markdown: string | null, max = LONGUEUR_EXTRAIT_CARTE): string | null {
  if (!markdown) return null;
  const propre = extraireTexte(markdown, Number.MAX_SAFE_INTEGER);
  if (!propre) return null;
  const caracteres = Array.from(propre);
  if (caracteres.length <= max) return propre;
  return `${caracteres.slice(0, max).join("").trimEnd()}…`;
}

// Story 9.16 h) (Q28) : extrait d'un article pour les cartes (admin et blog public). Un extrait saisi est utilisé tel quel (espaces retirés) ;
// vide, les 160 premiers caractères du texte sans Markdown (extraitCarte). Aucun texte inventé : ni extrait ni texte donne null.
export function extraitArticle(extrait: string | null | undefined, markdown: string | null): string | null {
  const saisi = extrait?.trim();
  if (saisi) return saisi;
  return extraitCarte(markdown);
}
