import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import type { MessageContactAdmin, ReglagesAdmin } from "./types";

// Lecture admin des réglages par le client service : jamais le cache public, jamais de valeur de repli (règle 15).
// Une valeur absente reste null : l'écran affiche « Valeur à fixer ».
export async function lireReglagesAdmin(): Promise<ReglagesAdmin> {
  const { data, error } = await creerClientService()
    .from("reglage")
    .select("cle, valeur")
    .in("cle", [
      "nom_site",
      "numero_whatsapp",
      "forfait_livraison_goma_cents",
      "forfait_livraison_bukavu_cents",
      "retrait_goma_fr",
      "retrait_goma_en",
      "plafond_fabrication",
    ]);
  if (error) throw new Error("Lecture des réglages impossible.");
  const valeur = (cle: string) => data?.find((ligne) => ligne.cle === cle)?.valeur?.trim() || null;
  return {
    nomSite: valeur("nom_site"),
    numeroWhatsapp: valeur("numero_whatsapp"),
    forfaitLivraisonGomaCents: valeur("forfait_livraison_goma_cents"),
    forfaitLivraisonBukavuCents: valeur("forfait_livraison_bukavu_cents"),
    retraitGomaFr: valeur("retrait_goma_fr"),
    retraitGomaEn: valeur("retrait_goma_en"),
    plafondFabrication: valeur("plafond_fabrication"),
  };
}

// Messages de contact à traiter (statut « nouveau »), les plus récents d'abord. Une erreur de lecture est relancée : jamais une liste vide inventée.
export async function lireMessagesNouveaux(): Promise<MessageContactAdmin[]> {
  const { data, error } = await creerClientService()
    .from("message_contact")
    .select("id, nom, email, message, langue, cree_le")
    .eq("statut", "nouveau")
    .order("cree_le", { ascending: false });
  if (error) throw new Error("Lecture des messages impossible.");
  return (data ?? []).map((m) => ({ id: m.id, nom: m.nom, email: m.email, message: m.message, langue: m.langue, creeLe: m.cree_le }));
}

// Compteur de la navigation admin : null si la lecture échoue (pas de compteur, jamais un faux zéro).
export async function compterMessagesNouveaux(): Promise<number | null> {
  try {
    const { count, error } = await creerClientService().from("message_contact").select("id", { count: "exact", head: true }).eq("statut", "nouveau");
    if (error || count === null) return null;
    return count;
  } catch {
    return null;
  }
}
