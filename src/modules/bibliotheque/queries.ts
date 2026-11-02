import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import { urlPhotoPublique } from "@/lib/supabase/stockage";
import type { FormatFichierKit } from "@/modules/catalogue/fichiers-kit";

export type KitBibliotheque = { produitId: string; slug: string; titre: { fr: string; en: string | null }; vignette: { url: string; alt: { fr: string; en: string } } | null };
export type FichierBibliotheque = { id: string; nom: { fr: string; en: string }; format: FormatFichierKit; tailleOctets: number; version: number };
export type ChapitreBibliotheque = { id: string; titre: { fr: string; en: string }; debutSecondes: number };
export type VideoBibliotheque = {
  dureeSecondes: number;
  chapitres: ChapitreBibliotheque[];
  sousTitres: Array<"fr" | "en">;
  positionSecondes: number;
  maxPositionSecondes: number;
  terminee: boolean;
};
export type DetailKitBibliotheque = { produitId: string; slug: string; titre: { fr: string; en: string | null }; fichiers: FichierBibliotheque[]; video: VideoBibliotheque | null };
export type ProgressionKit = { produitId: string; positionSecondes: number; maxPositionSecondes: number; terminee: boolean; debuts: number[] };

// Les Kits du Compte (accès vérifiés par la base). Une erreur de lecture est relancée : la page affiche un état d'erreur, jamais « vide ».
export async function lireBibliotheque(compteId: string): Promise<KitBibliotheque[]> {
  const { data, error } = await creerClientService().rpc("bibliotheque_lister", { p_compte: compteId });
  if (error) throw new Error("bibliotheque_lister");
  return (data ?? []).map((l) => ({
    produitId: l.produit_id,
    slug: l.slug,
    titre: { fr: l.titre_fr, en: l.titre_en },
    vignette: l.photo && l.alt_fr && l.alt_en ? { url: urlPhotoPublique(l.photo), alt: { fr: l.alt_fr, en: l.alt_en } } : null,
  }));
}

type LigneFichier = { id: string; nom_fr: string; nom_en: string; format: FormatFichierKit; taille_octets: number; version: number };

// Un Kit de la bibliothèque et ses fichiers actuels ; null si le Compte n'y a pas accès (ou si le Kit n'existe pas).
export async function lireKitBibliotheque(compteId: string, slug: string): Promise<DetailKitBibliotheque | null> {
  const { data, error } = await creerClientService().rpc("bibliotheque_kit", { p_compte: compteId, p_slug: slug });
  if (error) throw new Error("bibliotheque_kit");
  if (!data) return null;
  type LigneVideo = {
    duree_secondes: number;
    chapitres: Array<{ id: string; titre_fr: string; titre_en: string; debut_secondes: number }>;
    sous_titres: Array<"fr" | "en">;
    position_secondes: number;
    max_position_secondes: number;
    terminee: boolean;
  };
  const k = data as unknown as { produit_id: string; slug: string; titre_fr: string; titre_en: string | null; fichiers: LigneFichier[]; video: LigneVideo | null };
  return {
    produitId: k.produit_id,
    slug: k.slug,
    titre: { fr: k.titre_fr, en: k.titre_en },
    fichiers: k.fichiers.map((f) => ({ id: f.id, nom: { fr: f.nom_fr, en: f.nom_en }, format: f.format, tailleOctets: f.taille_octets, version: f.version })),
    video: k.video
      ? {
          dureeSecondes: k.video.duree_secondes,
          chapitres: k.video.chapitres.map((c) => ({ id: c.id, titre: { fr: c.titre_fr, en: c.titre_en }, debutSecondes: c.debut_secondes })),
          sousTitres: k.video.sous_titres,
          positionSecondes: k.video.position_secondes,
          maxPositionSecondes: k.video.max_position_secondes,
          terminee: k.video.terminee,
        }
      : null,
  };
}

// Progression de chaque Kit à vidéo (liste de la bibliothèque). Une erreur est relancée : la page affiche son état d'erreur.
export async function lireProgressions(compteId: string): Promise<ProgressionKit[]> {
  const { data, error } = await creerClientService().rpc("bibliotheque_progressions", { p_compte: compteId });
  if (error) throw new Error("bibliotheque_progressions");
  return (data ?? []).map((l) => ({
    produitId: l.produit_id,
    positionSecondes: l.position_secondes,
    maxPositionSecondes: l.max_position_secondes,
    terminee: l.terminee,
    debuts: l.debuts,
  }));
}
