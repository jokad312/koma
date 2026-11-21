import "server-only";
import { DroitRefuseError, exigerDroit } from "@/lib/auth/droits";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import type { DependancesCodePromo } from "./types";

// Accès réels du module promo. `code_promo` n'est pas encore dans les types générés (fichier non modifiable ici) : le
// client est décrit localement, comme pour les autres tables récentes. Le droit est revérifié ici, jamais dans le navigateur.
type LignePromo = { affilie: string; reduction_pct: number | string; commission_pct: number | string; plafond: number; actif: boolean };
type ClientPromo = {
  rpc: (nom: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => {
    select: (colonnes: string) => { eq: (colonne: string, valeur: string) => { maybeSingle: () => PromiseLike<{ data: LignePromo | null; error: { message: string } | null }> } };
  };
};

export function dependancesCodePromo(): DependancesCodePromo {
  const client = creerClientService() as unknown as ClientPromo;
  return {
    exigerDroit: async () => {
      try {
        return await exigerDroit("codes_promo.gerer");
      } catch (e) {
        if (e instanceof DroitRefuseError) return null;
        throw e;
      }
    },
    creer: async (auteur, code, valeurs) => {
      const { error } = await client.rpc("creer_code_promo", {
        p_auteur: auteur as Json,
        p_code: code,
        p_affilie: valeurs.affilie,
        p_reduction_pct: valeurs.reductionPct,
        p_commission_pct: valeurs.commissionPct,
        p_plafond: valeurs.plafond,
        p_actif: valeurs.actif,
      });
      return { erreur: error ? error.message : null };
    },
    modifier: async (auteur, id, valeurs) => {
      const { error } = await client.rpc("modifier_code_promo", {
        p_auteur: auteur as Json,
        p_id: id,
        p_affilie: valeurs.affilie,
        p_reduction_pct: valeurs.reductionPct,
        p_commission_pct: valeurs.commissionPct,
        p_plafond: valeurs.plafond,
        p_actif: valeurs.actif,
      });
      return { erreur: error ? error.message : null };
    },
    // Lecture par le client service (table fermée aux rôles anon et authenticated) ; une erreur de lecture est une panne, jamais un « introuvable ».
    lire: async (id) => {
      const { data, error } = await client.from("code_promo").select("affilie, reduction_pct, commission_pct, plafond, actif").eq("id", id).maybeSingle();
      if (error) throw new Error("lecture du code promo impossible");
      if (!data) return null;
      return { affilie: data.affilie, reductionPct: Number(data.reduction_pct), commissionPct: Number(data.commission_pct), plafond: data.plafond, actif: data.actif };
    },
  };
}
