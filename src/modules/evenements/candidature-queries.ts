import "server-only";
import { creerClientService } from "@/lib/supabase/service";

export type EtatCandidature = "refusee" | "payee" | "a_payer" | "expiree" | "valide";

export type CandidatureDuCompte = {
  id: string;
  evenementSlug: string;
  expireLe: string;
  etat: EtatCandidature;
  // Commande à payer ou payée : la page y renvoie.
  numeroCommande: string | null;
};

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function un<T>(valeur: T | T[] | null): T | null {
  return Array.isArray(valeur) ? (valeur[0] ?? null) : valeur;
}

// La candidature d'un Compte (lue côté serveur par son identifiant, jamais par l'adresse seule) ; null si elle n'existe pas ou appartient à un autre
// Compte : la page rend alors un 404 sans rien révéler. Une erreur de lecture est relancée : jamais un état inventé.
export async function lireCandidatureDuCompte(compteId: string, candidatureId: string, maintenant: number = Date.now()): Promise<CandidatureDuCompte | null> {
  if (!ID.test(candidatureId)) return null;
  const { data, error } = await creerClientService()
    .from("candidature_stand")
    .select("id, statut, expire_le, compte_id, evenement:evenement_id(slug), commande:commande_id(numero, statut, expire_le)")
    .eq("id", candidatureId)
    .eq("compte_id", compteId)
    .maybeSingle();
  if (error) throw new Error("Lecture de la candidature impossible.");
  if (!data || data.compte_id !== compteId) return null;
  const evenement = un(data.evenement);
  const commande = un(data.commande);
  if (!evenement) return null;
  const expire = Date.parse(data.expire_le);
  let etat: EtatCandidature;
  let numeroCommande: string | null = null;
  if (data.statut === "refusee") etat = "refusee";
  else if (commande && (commande.statut === "payee" || commande.statut === "offerte")) {
    etat = "payee";
  } else if (commande && (commande.statut === "en_attente" || commande.statut === "echouee") && commande.expire_le && Date.parse(commande.expire_le) > maintenant) {
    etat = "a_payer";
    numeroCommande = commande.numero;
  } else if (expire <= maintenant) etat = "expiree";
  else etat = "valide";
  return { id: data.id, evenementSlug: evenement.slug, expireLe: data.expire_le, etat, numeroCommande };
}
