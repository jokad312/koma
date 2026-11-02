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
