import { describe, expect, it } from "vitest";
import { analyserPistesMp4, type LecteurIntervalle } from "@/modules/accueil/heros-mp4";

// Fichiers MP4 synthétiques (TEST_) : seules les boîtes lues par l'analyse sont construites.
function boite(type: string, ...contenu: Uint8Array[]): Uint8Array {
  const taille = 8 + contenu.reduce((n, c) => n + c.length, 0);
  const sortie = new Uint8Array(taille);
  new DataView(sortie.buffer).setUint32(0, taille);
  sortie.set(new TextEncoder().encode(type), 4);
  let i = 8;
  for (const c of contenu) {
    sortie.set(c, i);
    i += c.length;
  }
  return sortie;
}
const hdlr = (gestionnaire: string) => boite("hdlr", new Uint8Array(8), new TextEncoder().encode(gestionnaire), new Uint8Array(12));
const piste = (gestionnaire: string) => boite("trak", boite("mdia", hdlr(gestionnaire)));
function fichier(...boites: Uint8Array[]): Uint8Array {
  const total = boites.reduce((n, b) => n + b.length, 0);
  const sortie = new Uint8Array(total);
  let i = 0;
  for (const b of boites) {
    sortie.set(b, i);
    i += b.length;
  }
  return sortie;
}
function lecteur(octets: Uint8Array): LecteurIntervalle {
  return { taille: octets.length, lire: async (d, f) => octets.slice(d, f) };
}

describe("analyserPistesMp4", () => {
  const ftyp = boite("ftyp", new TextEncoder().encode("isom0000"));
  const mdat = boite("mdat", new Uint8Array(1000));

  it("TEST_ vidéo seule : pas d'audio (moov après les données)", async () => {
    const r = await analyserPistesMp4(lecteur(fichier(ftyp, mdat, boite("moov", piste("vide")))));
    expect(r).toEqual({ audio: false, video: true });
  });

  it("TEST_ vidéo et audio : audio détecté (moov avant les données)", async () => {
    const r = await analyserPistesMp4(lecteur(fichier(ftyp, boite("moov", piste("vide"), piste("soun")), mdat)));
    expect(r).toEqual({ audio: true, video: true });
  });

  it("TEST_ sans boîte moov : illisible (jamais « sans audio » par défaut)", async () => {
    expect(await analyserPistesMp4(lecteur(fichier(ftyp, mdat)))).toBeNull();
  });

  it("TEST_ boîte plus grande que le fichier : illisible", async () => {
    const trop = fichier(ftyp, mdat);
    new DataView(trop.buffer).setUint32(ftyp.length, 999_999);
    expect(await analyserPistesMp4(lecteur(trop))).toBeNull();
  });

  it("TEST_ lecture en échec : illisible", async () => {
    expect(await analyserPistesMp4({ taille: 100, lire: async () => null })).toBeNull();
  });

  it("TEST_ piste sans gestionnaire : illisible", async () => {
    expect(await analyserPistesMp4(lecteur(fichier(ftyp, boite("moov", boite("trak", boite("mdia"))))))).toBeNull();
  });
});
