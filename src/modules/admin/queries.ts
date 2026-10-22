import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import type { ReglagesAdmin } from "./types";

// Lecture admin des réglages par le client service : jamais le cache public, jamais de valeur de repli (règle 15).
// Une valeur absente reste null : l'écran affiche « Valeur à fixer ».
export async function lireReglagesAdmin(): Promise<ReglagesAdmin> {
  const { data, error } = await creerClientService().from("reglage").select("cle, valeur").in("cle", ["nom_site", "numero_whatsapp"]);
  if (error) throw new Error("Lecture des réglages impossible.");
  const valeur = (cle: string) => data?.find((ligne) => ligne.cle === cle)?.valeur?.trim() || null;
  return { nomSite: valeur("nom_site"), numeroWhatsapp: valeur("numero_whatsapp") };
}
