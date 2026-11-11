"use server";

import { updateTag } from "next/cache";
import { exigerDroit } from "@/lib/auth/droits";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import { enregistrerGalerieEvenement, type ResultatGalerie } from "./galerie";

// « Enregistrer » le lien de la Galerie d'un Événement (Admin) : le succès n'apparaît qu'après la réponse réelle de la base.
export async function enregistrerGalerieEvenementAction(entree: { evenementId: string; lien: string }): Promise<ResultatGalerie> {
  return enregistrerGalerieEvenement(
    {
      exigerDroit,
      enregistrer: async ({ auteur, evenementId, lien }) => {
        const { error } = await creerClientService().rpc("enregistrer_galerie_evenement", { p_auteur: auteur as unknown as Json, p_evenement: evenementId, p_lien: lien });
        return { erreur: error ? error.message : null };
      },
      invalider: async () => updateTag(ETIQUETTES.evenements),
    },
    entree,
  );
}
