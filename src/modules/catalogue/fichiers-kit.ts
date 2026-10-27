// Fichiers d'un Kit : formats, extensions, tailles et vérification du contenu réel. Pur et testable (aucun accès réseau ni base).

// Plafond d'un fichier : 50 Mo (52 428 800 octets), compatible avec le plafond du plan Supabase gratuit (à relever avec le plan).
// MIROIR de la migration 20261030100000 (fichier_kit.taille_octets et bucket kits-private). Une transcription est limitée à 1 Mo.
export const TAILLE_MAX_FICHIER_KIT = 52_428_800;
export const TAILLE_MAX_TRANSCRIPTION = 1_048_576;

export const FORMATS_FICHIER_KIT = ["pdf_a4", "pdf_letter", "svg", "stl", "transcription"] as const;
export type FormatFichierKit = (typeof FORMATS_FICHIER_KIT)[number];

export const EXTENSION_FORMAT: Readonly<Record<FormatFichierKit, "pdf" | "svg" | "stl" | "txt">> = {
  pdf_a4: "pdf",
  pdf_letter: "pdf",
  svg: "svg",
  stl: "stl",
  transcription: "txt",
};

// Type de contenu écrit avec l'objet (choisi par le serveur, jamais par le navigateur).
export const TYPE_CONTENU_EXTENSION: Readonly<Record<"pdf" | "svg" | "stl" | "txt", string>> = {
  pdf: "application/pdf",
  svg: "image/svg+xml",
  stl: "model/stl",
  txt: "text/plain",
};

// Extensions proposées par format, pour le sélecteur de fichier (attribut accept).
export const EXTENSIONS_ACCEPTEES = ".pdf,.svg,.stl,.txt";

export function estFormatFichierKit(valeur: unknown): valeur is FormatFichierKit {
  return typeof valeur === "string" && (FORMATS_FICHIER_KIT as readonly string[]).includes(valeur);
}

export function tailleMaxFormat(format: FormatFichierKit): number {
  // Une transcription est limitée à 1 Mo ; un SVG est limité à ce que l'on lit pour contrôler tout son contenu.
  if (format === "transcription") return TAILLE_MAX_TRANSCRIPTION;
  if (format === "svg") return TAILLE_LECTURE_SVG;
  return TAILLE_MAX_FICHIER_KIT;
}

// Format proposé d'après l'extension d'un nom de fichier (PDF : A4 par défaut ; le choix A4 / US Letter reste à l'admin).
export function formatDepuisNom(nomFichier: string): FormatFichierKit | null {
  const ext = extensionDe(nomFichier);
  if (ext === "pdf") return "pdf_a4";
  if (ext === "svg") return "svg";
  if (ext === "stl") return "stl";
  if (ext === "txt") return "transcription";
  return null;
}

function extensionDe(nomFichier: string): string {
  const point = nomFichier.lastIndexOf(".");
  return point < 0 ? "" : nomFichier.slice(point + 1).toLowerCase();
}

// Nom d'affichage proposé d'après le nom du fichier : sans extension, 120 caractères au plus.
export function nomDepuisFichier(nomFichier: string): string {
  const point = nomFichier.lastIndexOf(".");
  const base = (point > 0 ? nomFichier.slice(0, point) : nomFichier).trim();
  return base.slice(0, 120);
}

// Nom, format et taille annoncés avant l'envoi : refus avant tout envoi. Le contenu réel est revérifié à la finalisation.
export function lireAnnonceFichierKit(
  nomFichier: string,
  format: string,
  taille: number,
): { ok: true; format: FormatFichierKit; ext: "pdf" | "svg" | "stl" | "txt" } | { ok: false; erreur: "format_invalide" | "fichier_trop_lourd" } {
  if (!estFormatFichierKit(format)) return { ok: false, erreur: "format_invalide" };
  const ext = EXTENSION_FORMAT[format];
  if (extensionDe(nomFichier) !== ext) return { ok: false, erreur: "format_invalide" };
  if (!Number.isInteger(taille) || taille < 1) return { ok: false, erreur: "format_invalide" };
  if (taille > tailleMaxFormat(format)) return { ok: false, erreur: "fichier_trop_lourd" };
  return { ok: true, format, ext };
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

// Objet <produit>/<uuid>.<extension du format> en minuscules : le navigateur n'envoie que ce que le jeton du serveur autorise.
export function objetKitValide(objet: string, produitId: string, format: FormatFichierKit): boolean {
  return new RegExp(`^${produitId}/${UUID}[.]${EXTENSION_FORMAT[format]}$`).test(objet);
}

// Objet de ce produit, quel que soit son format (annulation d'un envoi : seul le dossier du produit est touché).
export function objetKitDuProduit(objet: string, produitId: string): boolean {
  return new RegExp(`^${produitId}/${UUID}[.](pdf|svg|stl|txt)$`).test(objet);
}

// Un SVG est lu jusqu'à 1 Mo pour y chercher du contenu actif (au-delà, seul ce début est contrôlé).
export const TAILLE_LECTURE_SVG = 1_048_576;

// Nombre d'octets à lire au début de l'objet pour en vérifier le contenu.
export function octetsAVerifier(format: FormatFichierKit, tailleTotale: number): number {
  switch (format) {
    case "pdf_a4":
    case "pdf_letter":
      return 8;
    case "svg":
      return Math.min(tailleTotale, TAILLE_LECTURE_SVG);
    case "stl":
      return 1024;
    case "transcription":
      return tailleTotale;
  }
}

const contient = (octets: Uint8Array, mot: string, depart = 0) => {
  for (let i = 0; i < mot.length; i++) if (octets[depart + i] !== mot.charCodeAt(i)) return false;
  return true;
};

const sansNul = (octets: Uint8Array) => !octets.includes(0);

export type AnalyseContenu = "ok" | "invalide" | "contenu_actif" | "entete_illisible";

// Contenu actif d'un SVG : scripts, gestionnaires d'événements, javascript:, objets embarqués, références externes.
const SVG_ACTIF = [
  /<\s*script/i,
  /[\s"'/]on[a-z]+\s*=/i,
  /javascript\s*:/i,
  /<\s*foreignObject/i,
  /<\s*iframe/i,
  /<\s*embed/i,
  /href\s*=\s*["']?\s*(https?:|\/\/)/i,
];

// Le contenu réel décide : l'extension et le type annoncés par le navigateur ne suffisent pas.
//  - PDF : en-tête « %PDF- » ;
//  - SVG : UTF-8 (BOM admis), commence par une balise, contient un élément <svg>, aucun contenu actif ;
//  - STL : binaire (en-tête de 80 octets, nombre de triangles, 50 octets par triangle : la taille doit coller) ou ASCII
//    (« solid » puis « facet normal » ou « endsolid » dans le début lu) ;
//  - transcription : texte UTF-8 valide, sans octet nul.
// `debut` : les premiers octets lus ; `tailleTotale` : la taille réelle de l'objet.
export function analyserContenuKit(format: FormatFichierKit, debut: Uint8Array, tailleTotale: number): AnalyseContenu {
  if (debut.length === 0 || tailleTotale < 1) return "invalide";
  switch (format) {
    case "pdf_a4":
    case "pdf_letter":
      return debut.length >= 5 && contient(debut, "%PDF-") ? "ok" : "invalide";
    case "svg": {
      // UTF-16 (avec BOM) ou octets nuls : l'en-tête n'est pas lisible comme du texte UTF-8.
      const utf16 = debut.length >= 2 && ((debut[0] === 0xff && debut[1] === 0xfe) || (debut[0] === 0xfe && debut[1] === 0xff));
      if (utf16 || !sansNul(debut)) return "entete_illisible";
      // BOM UTF-8 (EF BB BF) retiré explicitement.
      const sansBom = debut[0] === 0xef && debut[1] === 0xbb && debut[2] === 0xbf ? debut.subarray(3) : debut;
      const texte = new TextDecoder("utf-8").decode(sansBom).trimStart();
      if (!texte.startsWith("<")) return "entete_illisible";
      if (!/<svg[\s>/]/i.test(texte)) return "invalide";
      return SVG_ACTIF.some((motif) => motif.test(texte)) ? "contenu_actif" : "ok";
    }
    case "stl": {
      if (debut.length >= 84) {
        const vue = new DataView(debut.buffer, debut.byteOffset, debut.byteLength);
        const triangles = vue.getUint32(80, true);
        if (triangles >= 1 && tailleTotale === 84 + 50 * triangles) return "ok";
      }
      if (debut.length < 5 || !contient(debut, "solid") || !sansNul(debut)) return "invalide";
      const texte = new TextDecoder("latin1").decode(debut);
      return /facet\s+normal|endsolid/.test(texte) ? "ok" : "invalide";
    }
    case "transcription": {
      if (debut.length !== tailleTotale || !sansNul(debut)) return "invalide";
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(debut);
        return "ok";
      } catch {
        return "invalide";
      }
    }
  }
}

export function verifierContenuKit(format: FormatFichierKit, debut: Uint8Array, tailleTotale: number): boolean {
  return analyserContenuKit(format, debut, tailleTotale) === "ok";
}

// Taille lisible : valeur formatée selon la langue et unité (le libellé de l'unité vient des fichiers de traduction).
export function tailleLisible(octets: number, langue: "fr" | "en"): { valeur: string; unite: "octets" | "ko" | "mo" } {
  const nombre = (n: number) => new Intl.NumberFormat(langue === "en" ? "en-US" : "fr-FR", { maximumFractionDigits: 1 }).format(n);
  if (octets < 1024) return { valeur: nombre(octets), unite: "octets" };
  if (octets < 1024 * 1024) return { valeur: nombre(octets / 1024), unite: "ko" };
  return { valeur: nombre(octets / (1024 * 1024)), unite: "mo" };
}
