import "server-only";
import { exigerCompteComplet } from "@/lib/auth/compte";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import type { DependancesAchat, RecapPassBrut } from "./achat-types";

// Les vrais accès donnés au service d'achat de Pass (en test, des faux nommés TEST_ les remplacent).
export function dependancesAchat(): DependancesAchat {
  return {
    exigerCompte: exigerCompteComplet,
    nomDuCompte: async (compteId) => {
      const utilisateur = await creerClientService().auth.admin.getUserById(compteId);
      const meta = utilisateur.data.user?.user_metadata as { full_name?: unknown; name?: unknown } | undefined;
      return [meta?.full_name, meta?.name].find((n): n is string => typeof n === "string" && n.trim().length > 0)?.trim() ?? null;
    },
    recapitulatif: async ({ compteId, evenementId, lignes, code }) => {
      const { data, error } = await creerClientService().rpc("recapitulatif_commande_pass", {
        p_compte: compteId,
        p_evenement: evenementId,
        p_lignes: lignes as unknown as Json,
        p_code: code as never,
      });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return { erreur: error?.message ?? "recapitulatif_commande_pass" };
      return { recap: data as unknown as RecapPassBrut };
    },
    creerCommande: async ({ auteur, evenementId, lignes, acceptations, totalAttenduCents, cleIdempotence, code }) => {
      const { data, error } = await creerClientService().rpc("creer_commande_pass", {
        p_auteur: auteur as unknown as Json,
        p_evenement: evenementId,
        p_lignes: lignes as unknown as Json,
        p_acceptations: acceptations as unknown as Json,
        p_total_attendu_cents: totalAttenduCents,
        p_cle_idempotence: cleIdempotence,
        p_code: code as never,
      });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return { erreur: error?.message ?? "creer_commande_pass" };
      const r = data as Record<string, unknown>;
      return typeof r.numero === "string" && typeof r.expire_le === "string" ? { numero: r.numero, expireLe: r.expire_le } : { erreur: "creer_commande_pass" };
    },
  };
}
