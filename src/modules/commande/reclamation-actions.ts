"use server";

import { lireSessionVerifiee } from "@/lib/auth/compte";
import { creerClientService } from "@/lib/supabase/service";
import { signalerProbleme, type ResultatReclamation } from "./reclamation";

// Le Compte vient de la session vérifiée côté serveur ; la base refuse tout ce qui n'est pas réclamable (48 h, famille, taille).
export async function signalerProblemeAction(entree: { numero: string; ligneId: string; description: string }): Promise<ResultatReclamation> {
  return signalerProbleme(
    {
      compteId: async () => (await lireSessionVerifiee())?.compteId ?? null,
      signaler: async (compteId, numero, ligneId, description) => {
        const { error } = await creerClientService().rpc("signaler_probleme", { p_compte: compteId, p_numero: numero, p_ligne: ligneId, p_description: description });
        return { erreur: error ? error.message : null };
      },
    },
    entree,
  );
}
