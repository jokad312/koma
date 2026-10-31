import "server-only";
import { exigerCompteComplet } from "@/lib/auth/compte";
import { creerClientService } from "@/lib/supabase/service";
import type { DependancesCommande } from "./types";

// Les vrais accès donnés au service (en test, des faux nommés TEST_ les remplacent).
export function dependances(): DependancesCommande {
  return {
    exigerCompte: exigerCompteComplet,
    offrirCommande: async ({ auteur, produitId, acceptations, cleIdempotence }) => {
      const { data, error } = await creerClientService().rpc("offrir_commande", {
        p_auteur: auteur as never,
        p_produit: produitId,
        p_acceptations: acceptations as never,
        p_cle_idempotence: cleIdempotence,
      });
      if (error) return { erreur: error.message };
      const numero = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>).numero : undefined;
      return { erreur: null, numero: typeof numero === "string" ? numero : undefined };
    },
  };
}
