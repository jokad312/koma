import type { ImageEvenement } from "./types";

// Photos d'un Événement : seules les entrées complètes sont rendues, jamais une valeur brute de la base.
export function lireImages(brut: unknown): ImageEvenement[] {
  if (!Array.isArray(brut)) return [];
  const images: ImageEvenement[] = [];
  for (const item of brut) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    if (typeof o.fichier !== "string" || typeof o.alt_fr !== "string" || typeof o.alt_en !== "string") continue;
    images.push({ fichier: o.fichier, altFr: o.alt_fr, altEn: o.alt_en });
  }
  return images;
}
