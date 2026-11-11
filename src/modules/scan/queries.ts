import "server-only";
import { creerClientService } from "@/lib/supabase/service";
import { debutDuJourLubumbashi } from "./jour";
import type { EvenementScannable } from "./types";

// Événements publiés, à venir ou du jour (fuseau Africa/Lubumbashi), lus en base. Une erreur est relancée : jamais une liste vide inventée.
export async function lireEvenementsScannables(locale: "fr" | "en", maintenant: Date = new Date()): Promise<EvenementScannable[]> {
  const debut = debutDuJourLubumbashi(maintenant).toISOString();
  const { data, error } = await creerClientService()
    .from("evenement")
    .select("id, titre_fr, titre_en, debut_le, fin_le")
    .not("publie_le", "is", null)
    .lte("publie_le", maintenant.toISOString())
    .or(`fin_le.gte.${debut},and(fin_le.is.null,debut_le.gte.${debut})`)
    .order("debut_le", { ascending: true });
  if (error) throw new Error("Lecture des événements impossible.");
  return (data ?? []).map((e) => ({
    id: e.id,
    titre: (locale === "en" ? e.titre_en?.trim() : "") || e.titre_fr,
    debutLe: e.debut_le,
    finLe: e.fin_le,
  }));
}
