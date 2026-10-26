import { CUMUL_MAX_CATALOGUE, TAILLE_PAGE_CATALOGUE, TRIS_CATALOGUE, TRI_PAR_DEFAUT, FILTRES_DISPONIBILITE } from "./types";
import type { CurseurCatalogue, FiltreDisponibilite, ParamsCatalogue, TriCatalogue } from "./types";

// Analyse et sérialisation de la requête d'un catalogue (?univers=&prix=&dispo=&tri=&curseur=). Fonctions pures.
// Un paramètre inconnu ou mal formé est ignoré : jamais d'erreur, jamais d'exception (une adresse partagée reste ouvrable).

export type RequeteBrute = Record<string, string | string[] | undefined> | URLSearchParams;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTIER_MAX = 2_147_483_647;
// Horodatage tel que Postgres le rend en texte (« 2026-10-26 10:00:00.123456+00 »).
const HORODATAGE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d{1,6})?([+-]\d{2}(:?\d{2})?|Z)$/;

function valeur(brut: RequeteBrute, cle: string): string | null {
  if (brut instanceof URLSearchParams) return brut.get(cle);
  const v = brut[cle];
  const premier = Array.isArray(v) ? v[0] : v;
  return typeof premier === "string" ? premier : null;
}

function entier(texte: string): number | null {
  if (!/^\d{1,10}$/.test(texte)) return null;
  const n = Number(texte);
  return Number.isSafeInteger(n) && n <= ENTIER_MAX ? n : null;
}

// « 1500-3000 » ou « 1500- » (tranche ouverte) ; bornes en centimes, haut strictement supérieur à bas.
function lirePrix(texte: string | null): { bas: number; haut: number | null } | null {
  if (texte === null) return null;
  const m = /^(\d{1,10})-(\d{0,10})$/.exec(texte);
  if (!m) return null;
  const bas = entier(m[1]);
  if (bas === null) return null;
  if (m[2] === "") return { bas, haut: null };
  const haut = entier(m[2]);
  if (haut === null || haut <= bas) return null;
  return { bas, haut };
}

function versBase64Url(texte: string): string {
  return Buffer.from(texte, "utf8").toString("base64url");
}

// Curseur opaque : le tri y est inscrit, un curseur d'un autre tri est refusé (retour à la première page).
export function encoderCurseur(tri: TriCatalogue, curseur: CurseurCatalogue): string {
  const cle = tri === "nouveautes" ? curseur.date : curseur.prix;
  return versBase64Url(JSON.stringify([tri, cle, curseur.id, curseur.n]));
}

export function decoderCurseur(texte: string | null, tri: TriCatalogue): CurseurCatalogue | null {
  if (!texte || texte.length > 200 || !/^[A-Za-z0-9_-]+$/.test(texte)) return null;
  try {
    const lu: unknown = JSON.parse(Buffer.from(texte, "base64url").toString("utf8"));
    if (!Array.isArray(lu) || lu.length !== 4) return null;
    const [triLu, cle, id, n] = lu as [unknown, unknown, unknown, unknown];
    if (triLu !== tri || typeof id !== "string" || !UUID.test(id)) return null;
    // n incohérent (pas un multiple de la taille de page, nul ou au-delà du plafond) : première page.
    if (typeof n !== "number" || !Number.isInteger(n) || n < TAILLE_PAGE_CATALOGUE || n > CUMUL_MAX_CATALOGUE || n % TAILLE_PAGE_CATALOGUE !== 0) return null;
    if (tri === "nouveautes") {
      if (typeof cle !== "string" || !HORODATAGE.test(cle)) return null;
      return { date: cle, prix: null, id, n };
    }
    if (typeof cle !== "number" || !Number.isInteger(cle) || cle < 0 || cle > ENTIER_MAX) return null;
    return { date: null, prix: cle, id, n };
  } catch {
    return null;
  }
}

export function analyserRequete(brut: RequeteBrute): ParamsCatalogue {
  const triBrut = valeur(brut, "tri");
  const tri = (TRIS_CATALOGUE as readonly string[]).includes(triBrut ?? "") ? (triBrut as TriCatalogue) : TRI_PAR_DEFAUT;
  const universBrut = valeur(brut, "univers");
  const dispoBrut = valeur(brut, "dispo");
  const prix = lirePrix(valeur(brut, "prix"));
  return {
    univers: universBrut && UUID.test(universBrut) ? universBrut.toLowerCase() : null,
    prixBas: prix ? prix.bas : null,
    prixHaut: prix ? prix.haut : null,
    dispo: (FILTRES_DISPONIBILITE as readonly string[]).includes(dispoBrut ?? "") ? (dispoBrut as FiltreDisponibilite) : null,
    tri,
    curseur: decoderCurseur(valeur(brut, "curseur"), tri),
  };
}

export function aUnPrix(p: Pick<ParamsCatalogue, "prixBas" | "prixHaut">): boolean {
  return p.prixBas !== null;
}

// Nombre de filtres actifs (univers, prix, disponibilité) : le tri n'en fait pas partie.
export function compterFiltres(p: ParamsCatalogue): number {
  return (p.univers ? 1 : 0) + (aUnPrix(p) ? 1 : 0) + (p.dispo ? 1 : 0);
}

// Un filtre ou un tri non par défaut est actif (le curseur n'en est pas un).
export function aFiltreOuTri(p: ParamsCatalogue): boolean {
  return compterFiltres(p) > 0 || p.tri !== TRI_PAR_DEFAUT;
}

// Requête de l'adresse, sans « ? » : seules les valeurs non par défaut y figurent, dans un ordre stable.
// `curseur` (déjà encodé) est ajouté en dernier quand il est fourni.
export function serialiserRequete(p: Omit<ParamsCatalogue, "curseur">, curseur: string | null = null): string {
  const q = new URLSearchParams();
  if (p.univers) q.set("univers", p.univers);
  if (p.prixBas !== null) q.set("prix", `${p.prixBas}-${p.prixHaut ?? ""}`);
  if (p.dispo) q.set("dispo", p.dispo);
  if (p.tri !== TRI_PAR_DEFAUT) q.set("tri", p.tri);
  if (curseur) q.set("curseur", curseur);
  return q.toString();
}

// Adresse relative (chemin interne + requête) : « /accessoires?tri=prix_asc ».
export function adresseAvecRequete(chemin: string, requete: string): string {
  return requete ? `${chemin}?${requete}` : chemin;
}

// Requête de la page suivante : celle des filtres et du tri (sans curseur) complétée par le curseur.
export function requeteAvecCurseur(requeteBase: string, curseur: string): string {
  const q = new URLSearchParams(requeteBase);
  q.set("curseur", curseur);
  return q.toString();
}

// Les paramètres sans le curseur (changer de filtre ou de tri ramène toujours à la première page).
export function sansCurseur(p: ParamsCatalogue): Omit<ParamsCatalogue, "curseur"> {
  return { univers: p.univers, prixBas: p.prixBas, prixHaut: p.prixHaut, dispo: p.dispo, tri: p.tri };
}
