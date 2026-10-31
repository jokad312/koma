import { z } from "zod";
import type { DependancesBibliotheque, EtatKit } from "./types";

const produitIdSchema = z.uuid();

// Où en est le visiteur pour ce Kit ? Toute erreur de lecture vaut « anonyme » : le bouton ne promet alors rien (la base refuse de toute façon).
export async function lireEtatKit(deps: DependancesBibliotheque, produitId: string): Promise<EtatKit> {
  if (!produitIdSchema.safeParse(produitId).success) return "anonyme";
  try {
    const compte = await deps.compteId();
    if (!compte) return "anonyme";
    if (await deps.possedeKit(compte, produitId)) return "possede";
    return (await deps.compteComplet(compte)) ? "pret" : "incomplet";
  } catch {
    console.error("[bibliotheque] lecture de l'état d'un Kit impossible");
    return "anonyme";
  }
}
