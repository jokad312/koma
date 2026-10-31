// Sous-titres et chapitres d'un Kit : validation WebVTT et lecture des instants. Pur et testable (aucun accès réseau ni base).
import { SOUS_TITRES_TAILLE_MAX } from "./types";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

// Objet des sous-titres dans kits-private : <produit>/sous-titres/<uuid>.vtt (choisi par le serveur, jamais par le navigateur).
export function objetSousTitresValide(objet: string, produitId: string): boolean {
  return new RegExp(`^${produitId}/sous-titres/${UUID}[.]vtt$`).test(objet);
}

// Nom et taille annoncés avant l'envoi : extension .vtt, 1 Mo au plus. Le contenu réel est revérifié à la finalisation.
export function lireAnnonceSousTitres(nomFichier: string, taille: number): { ok: true } | { ok: false; erreur: "format_invalide" | "fichier_trop_lourd" } {
  if (!/[.]vtt$/i.test(nomFichier.trim())) return { ok: false, erreur: "format_invalide" };
  if (!Number.isInteger(taille) || taille < 1) return { ok: false, erreur: "format_invalide" };
  if (taille > SOUS_TITRES_TAILLE_MAX) return { ok: false, erreur: "fichier_trop_lourd" };
  return { ok: true };
}

// Instant WebVTT [hh:]mm:ss.mmm (norme WebVTT : heures facultatives, sur deux chiffres ou plus ; absentes = 0).
const INSTANT = "(?:([0-9]{2,}):)?([0-5][0-9]):([0-5][0-9])[.]([0-9]{3})";
const REPLIQUE = new RegExp(`^${INSTANT}[ \\t]+-->[ \\t]+${INSTANT}(?:[ \\t].*)?$`);

function millisecondes(h: string | undefined, m: string, s: string, ms: string): number {
  return ((Number(h ?? 0) * 60 + Number(m)) * 60 + Number(s)) * 1000 + Number(ms);
}

// Contenu WebVTT accepté :
//  - texte UTF-8 valide (BOM admis), sans octet nul ;
//  - première ligne « WEBVTT », seule ou suivie d'un espace ou d'une tabulation et d'un texte ;
//  - au moins une réplique au format [hh:]mm:ss.mmm --> [hh:]mm:ss.mmm, et chaque ligne de minutage (« --> ») de ce format, fin après début.
export function verifierWebVtt(octets: Uint8Array): boolean {
  if (octets.length === 0 || octets.length > SOUS_TITRES_TAILLE_MAX || octets.includes(0)) return false;
  let texte: string;
  try {
    texte = new TextDecoder("utf-8", { fatal: true }).decode(octets);
  } catch {
    return false;
  }
  if (texte.charCodeAt(0) === 0xfeff) texte = texte.slice(1);
  const lignes = texte.split(/\r\n|\r|\n/);
  if (!/^WEBVTT(?:[ \t].*)?$/.test(lignes[0] ?? "")) return false;
  let repliques = 0;
  for (const ligne of lignes.slice(1)) {
    if (!ligne.includes("-->")) continue;
    const m = REPLIQUE.exec(ligne.trim());
    if (!m) return false;
    const debut = millisecondes(m[1], m[2], m[3], m[4]);
    const fin = millisecondes(m[5], m[6], m[7], m[8]);
    if (fin <= debut) return false;
    repliques += 1;
  }
  return repliques > 0;
}

// Instant de début d'un chapitre saisi « mm:ss » ou « h:mm:ss » (secondes de 00 à 59) ; null si la saisie n'a pas cette forme.
export function lireInstant(saisie: string): number | null {
  const texte = saisie.trim();
  const court = /^([0-9]{1,3}):([0-5][0-9])$/.exec(texte);
  if (court) return Number(court[1]) * 60 + Number(court[2]);
  const long = /^([0-9]{1,2}):([0-5][0-9]):([0-5][0-9])$/.exec(texte);
  if (long) return (Number(long[1]) * 60 + Number(long[2])) * 60 + Number(long[3]);
  return null;
}

// Instant affiché : « m:ss » sous une heure, « h:mm:ss » au-delà.
export function formaterInstant(secondes: number): string {
  const total = Math.max(0, Math.floor(secondes));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const deux = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${deux(m)}:${deux(s)}` : `${m}:${deux(s)}`;
}
