import "server-only";
import { exigerCompteComplet } from "@/lib/auth/compte";
import { creerClientService } from "@/lib/supabase/service";
import { panierIdPourCompte } from "@/modules/panier/queries";
import type { DependancesCommande, RecapBrut } from "./types";

// Les vrais accès donnés au service (en test, des faux nommés TEST_ les remplacent).
export function dependances(): DependancesCommande {
  return {
    exigerCompte: exigerCompteComplet,
    panierDuCompte: panierIdPourCompte,
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
    recapitulatif: async ({ compteId, panierId, zone, mode }) => {
      const { data, error } = await creerClientService().rpc("recapitulatif_commande", {
        p_compte: compteId,
        p_panier: panierId,
        p_zone: zone as never,
        p_mode: mode as never,
      });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return { erreur: error?.message ?? "recapitulatif_commande" };
      return { recap: data as unknown as RecapBrut };
    },
    creerCommande: async ({ auteur, panierId, zone, mode, telephone, adresse, acceptations, origine, totalAttenduCents, cleIdempotence }) => {
      const { data, error } = await creerClientService().rpc("creer_commande", {
        p_auteur: auteur as never,
        p_panier: panierId,
        p_zone: zone as never,
        p_mode: mode as never,
        p_telephone: telephone as never,
        p_adresse: adresse as never,
        p_acceptations: acceptations as never,
        p_origine: origine as never,
        p_total_attendu_cents: totalAttenduCents,
        p_cle_idempotence: cleIdempotence,
      });
      if (error || !data || typeof data !== "object" || Array.isArray(data)) return { erreur: error?.message ?? "creer_commande" };
      const r = data as Record<string, unknown>;
      return typeof r.numero === "string" && typeof r.expire_le === "string" ? { numero: r.numero, expireLe: r.expire_le } : { erreur: "creer_commande" };
    },
  };
}
