// Pistes d'un fichier MP4, lues dans sa structure (boîtes ISO) : le héros doit être sans piste audio (FR-1).
// Seules les boîtes nécessaires sont lues par intervalles d'octets : le fichier n'est jamais chargé en entier.

export type PistesMp4 = { audio: boolean; video: boolean };

export type LecteurIntervalle = {
  // Taille totale du fichier, en octets.
  taille: number;
  // Octets [debut, fin) ; null si la lecture a échoué.
  lire(debut: number, fin: number): Promise<Uint8Array | null>;
};

// Plafond de la boîte « moov » lue (elle ne contient que des tables) : au-delà, le fichier est jugé illisible.
export const MOOV_MAX = 8 * 1024 * 1024;
const BOITES_MAX = 64;

const texte = (o: Uint8Array, i: number) => String.fromCharCode(o[i], o[i + 1], o[i + 2], o[i + 3]);
const u32 = (o: Uint8Array, i: number) => ((o[i] << 24) | (o[i + 1] << 16) | (o[i + 2] << 8) | o[i + 3]) >>> 0;

// Boîtes enfants d'un contenu : [type, début du contenu, fin]. Null si la structure est incohérente.
function enfants(o: Uint8Array): Array<[string, number, number]> | null {
  const sortie: Array<[string, number, number]> = [];
  let i = 0;
  while (i + 8 <= o.length) {
    let taille = u32(o, i);
    let entete = 8;
    if (taille === 1) {
      if (i + 16 > o.length) return null;
      if (u32(o, i + 8) !== 0) return null;
      taille = u32(o, i + 12);
      entete = 16;
    } else if (taille === 0) {
      taille = o.length - i;
    }
    if (taille < entete || i + taille > o.length) return null;
    sortie.push([texte(o, i + 4), i + entete, i + taille]);
    i += taille;
  }
  return sortie;
}

function pistesDeMoov(moov: Uint8Array): PistesMp4 | null {
  const racine = enfants(moov);
  if (!racine) return null;
  const pistes: PistesMp4 = { audio: false, video: false };
  for (const [type, debut, fin] of racine) {
    if (type !== "trak") continue;
    const trak = enfants(moov.subarray(debut, fin));
    const mdia = trak?.find(([t]) => t === "mdia");
    if (!trak || !mdia) return null;
    const base = moov.subarray(debut, fin);
    const medias = enfants(base.subarray(mdia[1], mdia[2]));
    const hdlr = medias?.find(([t]) => t === "hdlr");
    if (!medias || !hdlr) return null;
    const contenu = base.subarray(mdia[1], mdia[2]).subarray(hdlr[1], hdlr[2]);
    // hdlr : version et drapeaux (4), pré-défini (4), puis le type de gestionnaire (4).
    if (contenu.length < 12) return null;
    const gestionnaire = texte(contenu, 8);
    if (gestionnaire === "soun") pistes.audio = true;
    if (gestionnaire === "vide") pistes.video = true;
  }
  return pistes;
}

// Null : structure illisible ou lecture impossible (jamais « sans audio » par défaut : le serveur refuse ce qu'il ne peut pas vérifier).
export async function analyserPistesMp4(lecteur: LecteurIntervalle): Promise<PistesMp4 | null> {
  let decalage = 0;
  for (let n = 0; n < BOITES_MAX && decalage + 8 <= lecteur.taille; n++) {
    const entete = await lecteur.lire(decalage, Math.min(decalage + 16, lecteur.taille));
    if (!entete || entete.length < 8) return null;
    let taille = u32(entete, 0);
    let longueurEntete = 8;
    if (taille === 1) {
      if (entete.length < 16 || u32(entete, 8) !== 0) return null;
      taille = u32(entete, 12);
      longueurEntete = 16;
    } else if (taille === 0) {
      taille = lecteur.taille - decalage;
    }
    if (taille < longueurEntete || decalage + taille > lecteur.taille) return null;
    if (texte(entete, 4) === "moov") {
      if (taille > MOOV_MAX) return null;
      const contenu = await lecteur.lire(decalage + longueurEntete, decalage + taille);
      if (!contenu || contenu.length !== taille - longueurEntete) return null;
      return pistesDeMoov(contenu);
    }
    decalage += taille;
  }
  return null;
}
