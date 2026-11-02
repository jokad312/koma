import "server-only";
import { cacheTag } from "next/cache";
import { ETIQUETTES } from "@/lib/cache/etiquettes";
import { creerClientService } from "@/lib/supabase/service";
import { ADAPTATEURS_BRANCHES } from "./registre";
import { moyensActifs, type MoyensPrestataire } from "./service";
import { CODES_PRESTATAIRE, type Achat, type CodePrestataire, type Couverture, type FamilleProduit, type Prestataire } from "./types";

type LignePrestataire = { code: string; nom: string; type: string; mobile_money: boolean; carte: boolean; actif: boolean; ordre: number | null };

function versPrestataire(l: LignePrestataire): Prestataire | null {
  if (!(CODES_PRESTATAIRE as readonly string[]).includes(l.code) || (l.type !== "agregateur" && l.type !== "carte")) return null;
  return { code: l.code as CodePrestataire, nom: l.nom, type: l.type, mobileMoney: l.mobile_money, carte: l.carte, actif: l.actif, ordre: l.ordre };
}

// Tous les Prestataires, dans l'ordre de priorité (les Agrégateurs d'abord). Une erreur de lecture est relancée : jamais une liste inventée.
export async function lirePrestataires(): Promise<Prestataire[]> {
  const { data, error } = await creerClientService()
    .from("prestataire")
    .select("code, nom, type, mobile_money, carte, actif, ordre")
    .order("ordre", { ascending: true, nullsFirst: false });
  if (error) throw new Error("Lecture des Prestataires impossible.");
  return (data ?? []).map(versPrestataire).filter((p): p is Prestataire => p !== null);
}

// Moyens des Prestataires actifs, pour le pied de page (UX-DR13) : lus côté serveur, jamais un Prestataire inactif. L'erreur n'est jamais mise
// en cache (sinon une panne passagère masquerait la carte jusqu'à la prochaine invalidation) : la lecture mise en cache lève, l'appelant masque la carte.
async function lireMoyensEnCache(): Promise<MoyensPrestataire[]> {
  "use cache";
  cacheTag(ETIQUETTES.prestataires);
  return moyensActifs(await lirePrestataires(), ADAPTATEURS_BRANCHES);
}

export async function lireMoyensPaiementActifs(): Promise<MoyensPrestataire[]> {
  try {
    return await lireMoyensEnCache();
  } catch {
    console.error("[paiement] lecture des moyens de paiement impossible : carte du pied de page masquée");
    return [];
  }
}

// Familles et type de la Commande, relus en base pour le Compte propriétaire (règle 11).
export async function lireAchat(commandeId: string, compteId: string): Promise<Achat | null> {
  const client = creerClientService();
  const [familles, commande] = await Promise.all([
    client.rpc("familles_commande", { p_commande: commandeId, p_compte: compteId }),
    client.from("commande").select("type").eq("id", commandeId).eq("compte_id", compteId).maybeSingle(),
  ]);
  if (familles.error || commande.error) throw new Error("Lecture de l'achat impossible.");
  if (!familles.data || !commande.data) return null;
  // Une Famille inconnue fait échouer la lecture : jamais écartée en silence (un panier physique pourrait sinon partir chez Polar, règle 10).
  if (!familles.data.every((f) => f === "cosplay" || f === "accessoire" || f === "kit")) throw new Error("Famille inconnue dans la Commande.");
  return {
    familles: familles.data as FamilleProduit[],
    estPass: commande.data.type === "pass",
  };
}

// Couverture pays-opérateur : la table arrive avec la story 5.1 (saisie par Jonathan, tirée de la documentation de chaque Agrégateur).
// Tant qu'elle n'existe pas, aucune Couverture n'est connue : le mobile money n'est jamais proposé (règle 15, rien n'est supposé).
export async function lireCouverture(): Promise<Couverture> {
  return [];
}
