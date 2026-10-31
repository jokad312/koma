import { MANQUES_PUBLICATION } from "./types";
import type { ManquePublication, ProduitPourPublication } from "./types";

type ChampsPhysiques = "prixCents" | "titreEn" | "descriptionFr" | "descriptionEn" | "nbPhotos" | "nbVariantes";
type ChampsKit = "famille" | "titreFr" | "materielFr" | "materielEn" | "niveau" | "nbFichiers" | "videoPrete" | "sousTitresFr";

// Ce qui manque à un produit pour être publié (la base fait le même contrôle : manques_publication).
// Produit physique : le titre français est déjà obligatoire ; le texte alternatif de chaque photo l'est à l'ajout.
// Kit (story 3.2) : prix, photo, titres, descriptions et matériel FR et EN, niveau, au moins un fichier, vidéo complète, sous-titres
// français. L'absence de sous-titres anglais et d'extrait ne bloque pas. Un champ de Kit absent compte comme manquant.
export function manquesPublication(p: Pick<ProduitPourPublication, ChampsPhysiques> & Partial<Pick<ProduitPourPublication, ChampsKit>>): ManquePublication[] {
  const vide = (t: string | null | undefined) => (t ?? "").trim() === "";
  const kit = p.famille === "kit";
  const manque: Record<ManquePublication, boolean> = {
    prix: p.prixCents === null,
    photo: p.nbPhotos < 1,
    titre_fr: kit && vide(p.titreFr),
    titre_en: vide(p.titreEn),
    description_fr: vide(p.descriptionFr),
    description_en: vide(p.descriptionEn),
    materiel_fr: kit && vide(p.materielFr),
    materiel_en: kit && vide(p.materielEn),
    niveau: kit && !p.niveau,
    variante: !kit && p.nbVariantes < 1,
    fichier: kit && (p.nbFichiers ?? 0) < 1,
    video: kit && !p.videoPrete,
    sous_titres_fr: kit && !p.sousTitresFr,
  };
  return MANQUES_PUBLICATION.filter((m) => manque[m]);
}
