import { CUMUL_MAX_ARTICLES, TAILLE_PAGE_ARTICLES, type CurseurArticles } from "./types";

// Adresse de la liste du Blog : ?curseur=<opaque>&… (un seul paramètre ici). Fonctions pures, sans exception :
// un curseur absent, illisible ou forgé ramène à la première page, jamais à une erreur.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Horodatage tel que Postgres le rend en texte (« 2026-10-26 10:00:00.123456+00 »).
const HORODATAGE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}(:?\d{2})?|Z)$/;

export type RequeteBrute = Record<string, string | string[] | undefined> | URLSearchParams;

function valeur(brut: RequeteBrute, cle: string): string | null {
  if (brut instanceof URLSearchParams) return brut.get(cle);
  const v = brut[cle];
  const premier = Array.isArray(v) ? v[0] : v;
  return typeof premier === "string" ? premier : null;
}

// Curseur opaque : [date du dernier Article affiché, son identifiant, nombre déjà affiché].
export function encoderCurseurArticles(curseur: CurseurArticles): string {
  return Buffer.from(JSON.stringify([curseur.date, curseur.id, curseur.n]), "utf8").toString("base64url");
}

export function decoderCurseurArticles(texte: string | null): CurseurArticles | null {
  if (!texte || texte.length > 200 || !/^[A-Za-z0-9_-]+$/.test(texte)) return null;
  try {
    const lu: unknown = JSON.parse(Buffer.from(texte, "base64url").toString("utf8"));
    if (!Array.isArray(lu) || lu.length !== 3) return null;
    const [date, id, n] = lu as [unknown, unknown, unknown];
    if (typeof date !== "string" || !HORODATAGE.test(date)) return null;
    if (typeof id !== "string" || !UUID.test(id)) return null;
    // Nombre déjà affiché : multiple de la page, au moins une page, jamais au-delà du plafond.
    if (typeof n !== "number" || !Number.isInteger(n) || n < TAILLE_PAGE_ARTICLES || n > CUMUL_MAX_ARTICLES || n % TAILLE_PAGE_ARTICLES !== 0) return null;
    return { date, id, n };
  } catch {
    return null;
  }
}

// Curseur lu dans la requête de la page : null (première page) si absent ou invalide.
export function analyserRequeteArticles(brut: RequeteBrute): CurseurArticles | null {
  return decoderCurseurArticles(valeur(brut, "curseur"));
}

// Requête (sans « ? ») de la page suivante ; vide s'il n'y a plus rien.
export function serialiserCurseur(curseur: string | null): string {
  return curseur ? `curseur=${curseur}` : "";
}

// Adresse de la liste pour un curseur donné : « /fr/blog?curseur=… » ou « /fr/blog ».
export function adresseAvecCurseur(locale: "fr" | "en", curseur: string | null): string {
  const requete = serialiserCurseur(curseur);
  return requete ? `/${locale}/blog?${requete}` : `/${locale}/blog`;
}
