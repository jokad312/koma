// Fuseau de la boutique (Goma et Bukavu) : toutes les heures affichées aux clients sont à cette heure, quel que soit leur appareil.
export const FUSEAU_BOUTIQUE = "Africa/Lubumbashi";

// Date et heure courtes à l'heure de la boutique, par exemple « 01/11/2026 14:30 ». Une date invalide donne null.
export function formaterDateHeureBoutique(date: string | Date | null | undefined, locale: "fr" | "en"): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { timeZone: FUSEAU_BOUTIQUE, dateStyle: "short", timeStyle: "short", hourCycle: "h23" }).format(d);
}

// Date seule à l'heure de la boutique, au format long de la langue, par exemple « 2 novembre 2026 ». Une date invalide donne null.
export function formaterDateBoutique(date: string | Date | null | undefined, locale: "fr" | "en"): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { timeZone: FUSEAU_BOUTIQUE, dateStyle: "long" }).format(d);
}
