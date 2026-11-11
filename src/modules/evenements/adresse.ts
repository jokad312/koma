import { CUMUL_MAX_EVENEMENTS, TAILLE_PAGE_EVENEMENTS } from "./types";

// Adresse de la liste du Festival : ?affiches=<n> (nombre d'Événements déjà montrés). Fonctions pures, sans exception :
// une valeur absente, illisible ou forgée ramène à la première page.

export type RequeteBrute = Record<string, string | string[] | undefined> | URLSearchParams;

function valeur(brut: RequeteBrute, cle: string): string | null {
  if (brut instanceof URLSearchParams) return brut.get(cle);
  const v = brut[cle];
  const premier = Array.isArray(v) ? v[0] : v;
  return typeof premier === "string" ? premier : null;
}

// Nombre déjà montré : multiple de la page, au moins une page, jamais au-delà du plafond ; sinon null (première page).
export function lireNombreAffiches(texte: string | null): number | null {
  if (!texte || !/^[0-9]{1,5}$/.test(texte)) return null;
  const n = Number(texte);
  if (n < TAILLE_PAGE_EVENEMENTS || n > CUMUL_MAX_EVENEMENTS || n % TAILLE_PAGE_EVENEMENTS !== 0) return null;
  return n;
}

export function analyserRequeteEvenements(brut: RequeteBrute): number | null {
  return lireNombreAffiches(valeur(brut, "affiches"));
}

// Adresse de la liste montrant déjà n Événements : « /fr/festival?affiches=12 » ou « /fr/festival ».
export function adresseAvecAffiches(locale: "fr" | "en", n: number | null): string {
  return n ? `/${locale}/festival?affiches=${n}` : `/${locale}/festival`;
}
