import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import { deriverEtat, type EtatPaiement } from "./etat";

const NUMERO = /^KS-[0-9]{4}-[0-9]{6,}$/;

// État réel de la Commande d'un Compte, lu par la base (jamais le navigateur). Null : Commande inconnue ou d'un autre Compte (404).
// Une erreur de lecture est relancée : jamais un état inventé.
export async function lireEtatPaiement(compteId: string, numero: string): Promise<EtatPaiement | null> {
  if (!NUMERO.test(numero)) return null;
  const { data, error } = await creerClientService().rpc("etat_paiement_commande", { p_numero: numero, p_compte: compteId });
  if (error) throw new Error("Lecture de l'état du paiement impossible.");
  if (!data) return null;
  return deriverEtat(data, Date.now());
}
