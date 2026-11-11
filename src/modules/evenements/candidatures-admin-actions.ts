"use server";

import { updateTag } from "next/cache";
import { exigerDroit } from "@/lib/auth/droits";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import { refuserCandidatureStand, type ResultatRefusCandidature } from "./candidatures-admin";

// « Refuser » une candidature Stand (Admin) : le succès n'apparaît qu'après la réponse réelle de la base.
export async function refuserCandidatureStandAction(entree: { candidatureId: string; motif: string }): Promise<ResultatRefusCandidature> {
  return refuserCandidatureStand(
    {
      exigerDroit,
      refuser: async ({ auteur, candidatureId, motif }) => {
        const { data, error } = await creerClientService().rpc("refuser_candidature_stand", { p_auteur: auteur as unknown as Json, p_candidature: candidatureId, p_motif: motif as never });
        return { erreur: error ? error.message : null, montantCents: typeof data === "number" ? data : 0 };
      },
      invalider: async () => updateTag(ETIQUETTES.evenements),
    },
    entree,
  );
}
