// Périodes du tableau de bord (story 9.8). Les jours sont ceux de Goma (Africa/Lubumbashi, UTC+2, sans heure d'été),
// comme dans les fonctions SQL de la partie 1 et les vues de la story 9.7.
export const FUSEAU_GOMA = "Africa/Lubumbashi";
const DECALAGE_MS = 2 * 60 * 60 * 1000;

export const PERIODES = [7, 30] as const;
export type Periode = (typeof PERIODES)[number];

// Seules les valeurs 7 et 30 sont permises ; toute autre valeur (ou aucune) donne 30.
export function lirePeriode(valeur: unknown): Periode {
  return valeur === "7" ? 7 : 30;
}

// Jour à Goma (AAAA-MM-JJ) d'un instant.
export function jourGoma(instant: Date): string {
  return new Date(instant.getTime() + DECALAGE_MS).toISOString().slice(0, 10);
}

// Minuit à Goma, il y a `joursAvant` jours (0 = aujourd'hui) : borne `p_depuis` des fonctions SQL.
export function minuitGoma(joursAvant: number, maintenant: Date): Date {
  const local = new Date(maintenant.getTime() + DECALAGE_MS);
  const minuitLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - joursAvant);
  return new Date(minuitLocal - DECALAGE_MS);
}

// Les `nombre` derniers jours pleins, aujourd'hui compris, du plus ancien au plus récent.
export function joursFenetre(nombre: number, maintenant: Date): string[] {
  const jours: string[] = [];
  for (let i = nombre - 1; i >= 0; i--) jours.push(jourGoma(minuitGoma(i, maintenant)));
  return jours;
}
