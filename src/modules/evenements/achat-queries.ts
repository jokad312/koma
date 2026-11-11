import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import type { EtatVente } from "./achat-types";

const ETATS: readonly EtatVente["etat"][] = ["a_venir", "fermee", "complet", "aucun", "ouverte"];

// État de la vente d'un Événement publié, relu en base à CHAQUE requête (Capacité et quotas : jamais en cache, AD-17). Null : Événement
// inconnu ou non publié. Une erreur de lecture est relancée : l'appelant n'affiche alors aucun bouton (jamais un bouton inventé).
export async function lireEtatVente(evenementId: string): Promise<EtatVente | null> {
  const { data, error } = await creerClientService().rpc("etat_vente_evenement", { p_evenement: evenementId });
  if (error) throw new Error("Lecture de l'état de la vente impossible.");
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null;
  const brut = data as { etat?: unknown; types?: unknown };
  const etat = ETATS.find((e) => e === brut.etat);
  if (!etat || !Array.isArray(brut.types)) throw new Error("État de la vente illisible.");
  const types = brut.types.flatMap((t) => {
    const x = t as { id?: unknown; complet?: unknown };
    return typeof x.id === "string" && typeof x.complet === "boolean" ? [{ id: x.id, complet: x.complet }] : [];
  });
  return { etat, types };
}
