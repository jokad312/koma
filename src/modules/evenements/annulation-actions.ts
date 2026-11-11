"use server";

import { lireSessionVerifiee } from "@/lib/auth/compte";
import { creerClientService } from "@/lib/supabase/service";
import { demanderAnnulationPass, type ResultatAnnulationPass } from "./annulation";

// « Demander l'annulation » d'un Pass de « Mes Pass » : la base refuse tout Pass qui n'est pas au Compte connecté.
export async function demanderAnnulationPassAction(entree: { passId: string }): Promise<ResultatAnnulationPass> {
  return demanderAnnulationPass(
    {
      session: lireSessionVerifiee,
      demander: async (compteId, passId) => {
        const { error } = await creerClientService().rpc("demander_annulation_pass", { p_compte: compteId, p_pass: passId });
        return { erreur: error ? error.message : null };
      },
    },
    entree,
  );
}
