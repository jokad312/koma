"use server";

import { exigerDroit } from "@/lib/auth/droits";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import { corrigerAdresseCommande, type DependancesAdminCommande, type ResultatAdminCommande } from "./admin-service";

// Les vrais clients donnés au service ; le droit est revérifié dans le service et la fonction SQL relit le rôle en base.
function dependancesAdminCommande(): DependancesAdminCommande {
  const client = creerClientService();
  return {
    exigerDroit: (droit) => exigerDroit(droit),
    corrigerAdresse: async (auteur, numero, adresse) => {
      const { error } = await client.rpc("corriger_adresse_commande", { p_auteur: auteur as Json, p_numero: numero, p_adresse: adresse });
      return { erreur: error ? error.message : null };
    },
    avancerStatut: async () => ({ erreur: "KS_NON_DISPONIBLE" }),
    confirmerMesures: async () => ({ erreur: "KS_NON_DISPONIBLE" }),
    // Les pages admin des Commandes sont rendues à la demande : rien à invalider, le client rafraîchit la page.
    invalider: () => undefined,
  };
}

export async function corrigerAdresseCommandeAction(entree: { numero: string; adresse: string }): Promise<ResultatAdminCommande> {
  return corrigerAdresseCommande(dependancesAdminCommande(), entree);
}
