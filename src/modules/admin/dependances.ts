import "server-only";
import { updateTag } from "next/cache";
import { exigerDroit } from "@/lib/auth/droits";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientService } from "@/lib/supabase/service";
import type { DependancesAdmin } from "./types";

// Les vrais clients donnés au service (en test, des faux nommés TEST_ les remplacent).
export function dependances(): DependancesAdmin {
  const admin = creerClientService();
  return {
    exigerDroit,
    ecrireReglage: async ({ auteur, cle, valeur }) => {
      const { error } = await admin.rpc("enregistrer_reglage", { p_auteur: auteur as never, p_cle: cle, p_valeur: valeur as never });
      return { erreur: error ? error.message : null };
    },
    invalider: () => updateTag(ETIQUETTES.reglages),
    corrigerAge: async ({ auteur, compteId, age, raison }) => {
      const { data, error } = await admin.rpc("corriger_age", { p_auteur: auteur as never, p_compte: compteId, p_age: age, p_raison: raison });
      return { erreur: error ? error.message : null, supprimer: data === true };
    },
    supprimerCompte: async (compteId) => {
      const { error } = await admin.auth.admin.deleteUser(compteId);
      return { erreur: error !== null };
    },
  };
}
