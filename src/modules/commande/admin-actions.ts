"use server";

import { exigerDroit } from "@/lib/auth/droits";
import { creerClientService } from "@/lib/supabase/service";
import type { Json } from "@/lib/supabase/types";
import { avancerStatutCommande, confirmerMesuresRecues, corrigerAdresseCommande, type DependancesAdminCommande, type ResultatAdminCommande } from "./admin-service";

// Les vrais clients donnés au service ; le droit est revérifié dans le service et la fonction SQL relit le rôle en base.
function dependancesAdminCommande(): DependancesAdminCommande {
  const client = creerClientService();
  return {
    exigerDroit: (droit) => exigerDroit(droit),
    corrigerAdresse: async (auteur, numero, adresse) => {
      const { error } = await client.rpc("corriger_adresse_commande", { p_auteur: auteur as Json, p_numero: numero, p_adresse: adresse });
      return { erreur: error ? error.message : null };
    },
    avancerStatut: async (auteur, numero, vers, numeroSuivi) => {
      const { error } = await client.rpc("avancer_statut", { p_auteur: auteur as Json, p_numero: numero, p_vers: vers, ...(numeroSuivi ? { p_numero_suivi: numeroSuivi } : {}) });
      return { erreur: error ? error.message : null };
    },
    confirmerMesures: async (auteur, ligneId) => {
      const { error } = await client.rpc("confirmer_mesures_recues", { p_auteur: auteur as Json, p_ligne: ligneId });
      return { erreur: error ? error.message : null };
    },
    // Les pages admin des Commandes sont rendues à la demande : rien à invalider, le client rafraîchit la page.
    invalider: () => undefined,
  };
}

export async function corrigerAdresseCommandeAction(entree: { numero: string; adresse: string }): Promise<ResultatAdminCommande> {
  return corrigerAdresseCommande(dependancesAdminCommande(), entree);
}

export async function avancerStatutCommandeAction(entree: { numero: string; vers: string; numeroSuivi?: string | null }): Promise<ResultatAdminCommande> {
  return avancerStatutCommande(dependancesAdminCommande(), entree);
}

export async function confirmerMesuresRecuesAction(entree: { ligneId: string }): Promise<ResultatAdminCommande> {
  return confirmerMesuresRecues(dependancesAdminCommande(), entree);
}
