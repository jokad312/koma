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

// Instant (ISO) → valeur d'un champ « datetime-local » à l'heure de la boutique, « AAAA-MM-JJTHH:mm » ; vide si la date est absente ou invalide.
// Sert aux formulaires admin : la base garde un instant absolu, l'admin lit et saisit l'heure de Goma.
export function versSaisieBoutique(date: string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const parties = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU_BOUTIQUE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (type: string) => parties.find((p) => p.type === type)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}`;
}

// Instant (ISO) → date et heure ISO 8601 à l'heure de la boutique avec son décalage (« 2026-11-14T18:00:00+02:00 »), pour les données
// structurées. Goma est à UTC+2 toute l'année, sans heure d'été. Une date absente ou invalide donne null.
export function versIsoBoutique(date: string | null | undefined): string | null {
  const saisie = versSaisieBoutique(date);
  return saisie === "" ? null : `${saisie}:00+02:00`;
}
