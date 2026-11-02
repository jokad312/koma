import "server-only";
import { updateTag } from "next/cache";
import { exigerDroit } from "@/lib/auth/droits";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import { ADAPTATEURS_BRANCHES } from "./registre";
import { lireAchat, lireCouverture, lirePrestataires } from "./queries";
import type { DependancesAdminPaiement, DependancesOptions } from "./service";

export function dependancesOptions(): DependancesOptions {
  return { prestataires: lirePrestataires, achat: lireAchat, couverture: lireCouverture, adaptateursBranches: ADAPTATEURS_BRANCHES };
}

export function dependancesAdminPaiement(): DependancesAdminPaiement {
  const client = creerClientService();
  return {
    exigerDroit: () => exigerDroit("prestataires.gerer"),
    definirActif: async (auteur, code, actif) => {
      const { error } = await client.rpc("definir_prestataire_actif", { p_auteur: auteur as Json, p_code: code, p_actif: actif });
      return { erreur: error ? error.message : null };
    },
    deplacer: async (auteur, code, sens) => {
      const { error } = await client.rpc("deplacer_prestataire", { p_auteur: auteur as Json, p_code: code, p_sens: sens });
      return { erreur: error ? error.message : null };
    },
    invalider: async () => updateTag(ETIQUETTES.prestataires),
    adaptateursBranches: ADAPTATEURS_BRANCHES,
  };
}
