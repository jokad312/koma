import type { CodePromo } from "./types";

// Liste des Codes promo de l'admin (story 9.16 i, maquette 07-codes-promo) : filtre, recherche et page lus dans l'adresse, appliqués à la liste déjà lue
// (lireCodesPromoAdmin, aucune nouvelle requête : décision de la nuit, Q15 ne l'autorise que pour les commandes). Fonctions pures, testées seules.

export const FILTRES_CODES = ["tous", "actifs", "inactifs"] as const;
export type FiltreCodes = (typeof FILTRES_CODES)[number];

export const CODES_PAR_PAGE = 20;
export const RECHERCHE_CODES_MAX = 100;
const PAGE_MAX = 100_000;

export type ParametresCodes = { filtre: FiltreCodes; q?: string; page: number };

function premiere(valeur: unknown): unknown {
  return Array.isArray(valeur) ? valeur[0] : valeur;
}

export function filtreCodesValide(valeur: unknown): FiltreCodes {
  const v = premiere(valeur);
  return FILTRES_CODES.find((f) => f === v) ?? "tous";
}

// Texte libre, espaces retirés aux bords, coupé à 100 caractères (par caractère : jamais un emoji coupé en deux) ; vide → aucune recherche.
export function rechercheCodesValide(valeur: unknown): string | undefined {
  const v = premiere(valeur);
  if (typeof v !== "string") return undefined;
  const texte = Array.from(v.trim()).slice(0, RECHERCHE_CODES_MAX).join("").trim();
  return texte === "" ? undefined : texte;
}

export function pageCodesValide(valeur: unknown): number {
  const v = premiere(valeur);
  if (typeof v !== "string" || !/^[0-9]{1,6}$/.test(v)) return 1;
  const n = Number(v);
  return n >= 1 && n <= PAGE_MAX ? n : 1;
}

// Identifiant d'un code à modifier (fenêtre) : un UUID seulement, sinon rien.
export function idCodeValide(valeur: unknown): string | undefined {
  const v = premiere(valeur);
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v.toLowerCase() : undefined;
}

// Comparaison sans casse ni accents (« Affilié » est trouvé par « affilie »).
function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr");
}

export function filtrerCodes(codes: readonly CodePromo[], filtre: FiltreCodes, q?: string): CodePromo[] {
  const cherche = q ? normaliser(q) : null;
  return codes.filter((c) => {
    if (filtre === "actifs" && !c.actif) return false;
    if (filtre === "inactifs" && c.actif) return false;
    if (cherche && !normaliser(c.code).includes(cherche) && !normaliser(c.affilie).includes(cherche)) return false;
    return true;
  });
}

// Page demandée ramenée à la dernière page existante (jamais une page vide avec « page 9 / 3 »). debut : rang (0) de la première ligne, pour N°.
export function paginerCodes<T>(lignes: readonly T[], page: number): { lignes: T[]; page: number; pages: number; debut: number } {
  const pages = Math.max(1, Math.ceil(lignes.length / CODES_PAR_PAGE));
  const courante = Math.min(Math.max(1, page), pages);
  const debut = (courante - 1) * CODES_PAR_PAGE;
  return { lignes: lignes.slice(debut, debut + CODES_PAR_PAGE), page: courante, pages, debut };
}

// Adresse de la liste (page 1 et filtre « tous » omis) ; « nouveau » ou « modifier » ouvrent la fenêtre sur la même route (Q23).
export function adresseCodes(p: ParametresCodes, fenetre?: { nouveau: true } | { modifier: string }): string {
  const s = new URLSearchParams();
  if (p.q) s.set("q", p.q);
  if (p.filtre !== "tous") s.set("filtre", p.filtre);
  if (p.page > 1) s.set("page", String(p.page));
  if (fenetre && "nouveau" in fenetre) s.set("nouveau", "1");
  if (fenetre && "modifier" in fenetre) s.set("modifier", fenetre.modifier);
  const texte = s.toString();
  return texte ? `/admin/codes-promo?${texte}` : "/admin/codes-promo";
}
