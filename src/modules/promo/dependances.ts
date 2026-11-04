import "server-only";
import { exigerDroit } from "@/lib/auth/droits";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import type { DependancesCodePromo } from "./types";

// Accès réels du module promo. `code_promo` n'est pas encore dans les types générés (fichier non modifiable ici) : le
// client est décrit localement, comme pour les autres tables récentes. Le droit est revérifié ici, jamais dans le navigateur.
type ClientPromo = {
  rpc: (nom: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export function dependancesCodePromo(): DependancesCodePromo {
  const client = creerClientService() as unknown as ClientPromo;
  return {
    exigerDroit: () => exigerDroit("codes_promo.gerer"),
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
  };
}
