"use server";

import { lireSessionVerifiee } from "@/lib/auth/compte";
import { creerClientService } from "@/lib/supabase/service";
import { demanderAnnulation, type ResultatAnnulation } from "./annulation";

// Le Compte vient de la session vérifiée côté serveur ; la base relit la Commande et refuse tout ce qui n'est pas annulable.
export async function demanderAnnulationAction(entree: { numero: string }): Promise<ResultatAnnulation> {
  return demanderAnnulation(
    {
      compteId: async () => (await lireSessionVerifiee())?.compteId ?? null,
      demander: async (compteId, numero) => {
        const { error } = await creerClientService().rpc("demander_annulation", { p_compte: compteId, p_numero: numero });
        return { erreur: error ? error.message : null };
      },
    },
    entree,
  );
}
