// Seul endroit qui convertit et formate les prix (AD-8) : centimes entiers USD en base, USD seulement à l'écran.
// Aucune conversion de devise ici : le prix est identique dans tous les pays (la conversion locale est faite par l'agrégateur).

export const PRIX_MAX_CENTS = 1_000_000;

export type PrixAnalyse = { ok: true; cents: number } | { ok: false; raison: "vide" | "invalide" };

// Saisie en USD décimal : point ou virgule, deux décimales au plus. Résultat : centimes entiers, > 0 et <= 1 000 000.
// Vide : raison « vide » (prix non fixé, permis pour un brouillon). Tout le reste (0, -3, 12,345, abc) : « invalide ».
export function analyserPrixUsd(texte: string): PrixAnalyse {
  const saisie = texte.trim();
  if (saisie === "") return { ok: false, raison: "vide" };
  const m = /^([0-9]{1,7})(?:[.,]([0-9]{1,2}))?$/.exec(saisie);
  if (!m) return { ok: false, raison: "invalide" };
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  if (cents < 1 || cents > PRIX_MAX_CENTS) return { ok: false, raison: "invalide" };
  return { ok: true, cents };
}

export const FORFAIT_MAX_CENTS = 100_000;

// Saisie en USD décimal (point ou virgule, deux décimales au plus) bornée en centimes, zéro permis (forfait gratuit, borne basse 0).
// Vide : « vide » ; tout le reste hors bornes ou mal écrit (-1, abc, 5,555) : « invalide ».
export function analyserMontantUsd(texte: string, maxCents: number): PrixAnalyse {
  const saisie = texte.trim();
  if (saisie === "") return { ok: false, raison: "vide" };
  const m = /^([0-9]{1,7})(?:[.,]([0-9]{1,2}))?$/.exec(saisie);
  if (!m) return { ok: false, raison: "invalide" };
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
  if (cents > maxCents) return { ok: false, raison: "invalide" };
  return { ok: true, cents };
}

// Forfait de livraison : 0 à 1 000 USD.
export function analyserForfaitUsd(texte: string): PrixAnalyse {
  return analyserMontantUsd(texte, FORFAIT_MAX_CENTS);
}

const LOCALES_AFFICHAGE = { fr: "fr-FR", en: "en-US" } as const;

// Affichage d'un prix en USD, selon la langue de la route (« 49,90 $US » en français, « $49.90 » en anglais).
export function formaterUsd(cents: number, locale: "fr" | "en"): string {
  return new Intl.NumberFormat(LOCALES_AFFICHAGE[locale], { style: "currency", currency: "USD" }).format(cents / 100);
}

// Valeur d'un champ de saisie (« 49.90 ») pour afficher un prix déjà enregistré dans un formulaire.
export function prixPourSaisie(cents: number | null): string {
  if (cents === null) return "";
  const entier = Math.floor(cents / 100);
  const reste = cents % 100;
  return reste === 0 ? String(entier) : `${entier}.${String(reste).padStart(2, "0")}`;
}
