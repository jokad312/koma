import "server-only";
import { lireSessionVerifiee } from "@/lib/auth/compte";
import { creerClientService } from "@/lib/supabase/service";
import type { DependancesBibliotheque } from "./types";

export function dependances(): DependancesBibliotheque {
  return {
    compteId: async () => (await lireSessionVerifiee())?.compteId ?? null,
    possedeKit: async (compteId, produitId) => {
      const { data, error } = await creerClientService().rpc("possede_kit", { p_compte: compteId, p_produit: produitId });
      if (error) throw new Error("possede_kit");
      return data === true;
    },
    compteComplet: async (compteId) => {
      const { data, error } = await creerClientService().rpc("compte_complet", { p_compte: compteId });
      if (error) throw new Error("compte_complet");
      return data === true;
    },
  };
}
