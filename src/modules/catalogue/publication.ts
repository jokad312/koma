import { MANQUES_PUBLICATION } from "./types";
import type { ManquePublication, ProduitPourPublication } from "./types";

// Ce qui manque à un produit pour être publié (la base fait le même contrôle : manques_publication).
// Le titre français est déjà obligatoire ; le texte alternatif de chaque photo l'est à l'ajout.
export function manquesPublication(p: Pick<ProduitPourPublication, "prixCents" | "titreEn" | "descriptionFr" | "descriptionEn" | "nbPhotos" | "nbVariantes">): ManquePublication[] {
  const vide = (t: string | null) => (t ?? "").trim() === "";
  const manque: Record<ManquePublication, boolean> = {
    prix: p.prixCents === null,
    photo: p.nbPhotos < 1,
    titre_en: vide(p.titreEn),
    description_fr: vide(p.descriptionFr),
    description_en: vide(p.descriptionEn),
    variante: p.nbVariantes < 1,
  };
  return MANQUES_PUBLICATION.filter((m) => manque[m]);
}
