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

// Écran de Scan d'un bénévole (story 7.7) : seulement les Événements pour lesquels la BASE lui reconnaît un accès valable maintenant (validité
// calculée par lire_acces_benevole_compte). « accesConnus » : le Compte a au moins un accès, valable ou non (sinon la page rend 404, comme pour tout
// Compte sans droit). Une erreur est relancée : jamais une liste vide inventée.
export async function lireEvenementsDeLAccesBenevole(locale: "fr" | "en", compteId: string): Promise<{ evenements: EvenementScannable[]; accesConnus: boolean }> {
  const client = creerClientService();
  const { data: acces, error } = await client.rpc("lire_acces_benevole_compte", { p_compte: compteId });
  if (error || !Array.isArray(acces)) throw new Error("Lecture des accès impossible.");
  const valides = acces.filter((a) => a.valide === true).map((a) => a.evenement_id);
  if (valides.length === 0) return { evenements: [], accesConnus: acces.length > 0 };
  const { data, error: erreurEvenements } = await client.from("evenement").select("id, titre_fr, titre_en, debut_le, fin_le").in("id", valides).order("debut_le", { ascending: true });
  if (erreurEvenements) throw new Error("Lecture des événements impossible.");
  return {
    accesConnus: true,
    evenements: (data ?? []).map((e) => ({ id: e.id, titre: (locale === "en" ? e.titre_en?.trim() : "") || e.titre_fr, debutLe: e.debut_le, finLe: e.fin_le })),
  };
}
