import { z } from "zod";
import type { Droit } from "@/lib/auth/matrice-droits";
import type { AuteurCompte } from "@/lib/auth/auteur";

export type ErreurGalerie = "non_autorise" | "entree_invalide" | "lien_invalide" | "evenement_introuvable" | "generique";
export type ResultatGalerie = { ok: true; lien: string | null } | { ok: false; erreur: ErreurGalerie };

export type DependancesGalerie = {
  exigerDroit(droit: Droit): Promise<{ auteur: AuteurCompte }>;
  enregistrer(args: { auteur: AuteurCompte; evenementId: string; lien: string }): Promise<{ erreur: string | null }>;
  // Étiquette « evenements » vidée après l'écriture : le public relit la base.
  invalider(): Promise<void>;
};

// Seuls les hôtes de Google Drive et de Google Photos, en https (même règle que la base, qui revérifie : galerie_url_valide).
const LIEN = /^https:\/\/(drive\.google\.com|photos\.google\.com|photos\.app\.goo\.gl)\/\S+$/;
export const LIEN_GALERIE_MAX = 600;

// Lien public de la Galerie d'événement (story 7.10, FR-39) : un texte vide efface le lien. La base revérifie le droit, le format et l'Événement.
export async function enregistrerGalerieEvenement(deps: DependancesGalerie, entree: { evenementId: unknown; lien: unknown }): Promise<ResultatGalerie> {
  const id = z.string().uuid().safeParse(entree.evenementId);
  if (!id.success || typeof entree.lien !== "string") return { ok: false, erreur: "entree_invalide" };
  const lien = entree.lien.trim();
  if (lien !== "" && (lien.length > LIEN_GALERIE_MAX || !LIEN.test(lien))) return { ok: false, erreur: "lien_invalide" };
  let auteur: AuteurCompte;
  try {
    ({ auteur } = await deps.exigerDroit("evenements.gerer"));
  } catch {
    return { ok: false, erreur: "non_autorise" };
  }
  try {
    const { erreur } = await deps.enregistrer({ auteur, evenementId: id.data, lien });
    if (erreur) {
      // Seule la cause est journalisée : jamais le lien saisi.
      console.error(`[galerie] enregistrement : ${/KS_[A-Z_]+/.exec(erreur)?.[0] ?? "inconnue"}`);
      if (erreur.includes("KS_LIEN_INVALIDE")) return { ok: false, erreur: "lien_invalide" };
      if (erreur.includes("KS_EVENEMENT_INTROUVABLE")) return { ok: false, erreur: "evenement_introuvable" };
      if (erreur.includes("KS_DROIT_REFUSE") || erreur.includes("KS_AUTEUR_MANQUANT")) return { ok: false, erreur: "non_autorise" };
      return { ok: false, erreur: "generique" };
    }
    await deps.invalider();
    return { ok: true, lien: lien === "" ? null : lien };
  } catch {
    console.error("[galerie] enregistrement : exception inattendue");
    return { ok: false, erreur: "generique" };
  }
}
