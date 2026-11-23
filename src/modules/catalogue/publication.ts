import { MANQUES_PUBLICATION } from "./types";
import type { ManquePublication, ProduitPourPublication } from "./types";

type ChampsPhysiques = "prixCents" | "titreEn" | "descriptionFr" | "descriptionEn" | "nbPhotos" | "nbVariantes";
type ChampsKit = "famille" | "titreFr" | "materielFr" | "materielEn" | "niveau" | "nbFichiers" | "videoPrete" | "sousTitresFr" | "extraitSansSousTitresFr" | "nbCouleursSansAnglais";

// Ce qui manque à un produit pour être publié (la base fait le même contrôle : manques_publication).
// Produit physique : le titre français est déjà obligatoire ; le texte alternatif de chaque photo l'est à l'ajout.
// Kit (story 3.2) : prix, photo, titre, description et matériel français, niveau, au moins un fichier, vidéo complète, sous-titres
// français. L'absence de sous-titres anglais et d'extrait ne bloque pas. Un champ de Kit absent compte comme manquant.
// Story 3.3 : un extrait parlé (case « Extrait sans parole » décochée) demande ses sous-titres français.
export function manquesPublication(p: Pick<ProduitPourPublication, ChampsPhysiques> & Partial<Pick<ProduitPourPublication, ChampsKit>>): ManquePublication[] {
  const vide = (t: string | null | undefined) => (t ?? "").trim() === "";
  const kit = p.famille === "kit";
  const manque: Record<ManquePublication, boolean> = {
    prix: p.prixCents === null,
    photo: p.nbPhotos < 1,
    titre_fr: kit && vide(p.titreFr),
    // Site en français uniquement (2026-11-22) : aucun texte anglais n'est exigé (la base fait de même, 20270126100000).
    titre_en: false,
    description_fr: vide(p.descriptionFr),
    description_en: false,
    materiel_fr: kit && vide(p.materielFr),
    materiel_en: false,
    niveau: kit && !p.niveau,
    variante: !kit && p.nbVariantes < 1,
    fichier: kit && (p.nbFichiers ?? 0) < 1,
    video: kit && !p.videoPrete,
    sous_titres_fr: kit && !p.sousTitresFr,
    sous_titres_extrait_fr: kit && Boolean(p.extraitSansSousTitresFr),
    // Story 9.15 : le nom anglais d'une couleur n'est plus exigé depuis le 2026-11-22 (site en français uniquement).
    couleurs: false,
  };
  return MANQUES_PUBLICATION.filter((m) => manque[m]);
}
