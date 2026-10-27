import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXTENSION_FORMAT,
  FORMATS_FICHIER_KIT,
  formatDepuisNom,
  lireAnnonceFichierKit,
  nomDepuisFichier,
  objetKitDuProduit,
  objetKitValide,
  octetsAVerifier,
  TAILLE_LECTURE_SVG,
  TAILLE_MAX_FICHIER_KIT,
  TAILLE_MAX_TRANSCRIPTION,
  tailleLisible,
  tailleMaxFormat,
  verifierContenuKit,
  analyserContenuKit,
} from "@/modules/catalogue/fichiers-kit";

const PRODUIT = "00000000-0000-4000-8000-0000000000bb";
const UUID = "11111111-1111-4111-8111-111111111111";
const octets = (texte: string) => new TextEncoder().encode(texte);

describe("constantes", () => {
  it("50 Mo et 1 Mo : miroir de la migration (colonne taille_octets et bucket kits-private)", () => {
    expect(TAILLE_MAX_FICHIER_KIT).toBe(52_428_800);
    expect(TAILLE_MAX_TRANSCRIPTION).toBe(1_048_576);
    const sql = readFileSync("supabase/migrations/20261030100000_kits_et_fichiers.sql", "utf8");
    expect(sql).toContain(`taille_octets <= ${TAILLE_MAX_FICHIER_KIT}`);
    expect(sql).toContain(`taille_octets <= ${TAILLE_MAX_TRANSCRIPTION}`);
    expect(sql).toContain(`('kits-private', 'kits-private', false, ${TAILLE_MAX_FICHIER_KIT})`);
  });

  it("une extension par format, cinq formats", () => {
    expect(FORMATS_FICHIER_KIT).toEqual(["pdf_a4", "pdf_letter", "svg", "stl", "transcription"]);
    expect(EXTENSION_FORMAT).toEqual({ pdf_a4: "pdf", pdf_letter: "pdf", svg: "svg", stl: "stl", transcription: "txt" });
    expect(tailleMaxFormat("transcription")).toBe(TAILLE_MAX_TRANSCRIPTION);
    expect(tailleMaxFormat("stl")).toBe(TAILLE_MAX_FICHIER_KIT);
    expect(tailleMaxFormat("svg")).toBe(TAILLE_LECTURE_SVG);
  });
});

describe("formatDepuisNom et nomDepuisFichier", () => {
  it.each([
    ["patron.pdf", "pdf_a4"],
    ["PATRON.PDF", "pdf_a4"],
    ["motif.svg", "svg"],
    ["piece.stl", "stl"],
    ["notes.txt", "transcription"],
    ["archive.zip", null],
    ["setup.exe", null],
    ["sans-extension", null],
  ])("%s -> %s", (nom, format) => expect(formatDepuisNom(nom)).toBe(format));

  it("nom proposé : sans extension, 120 caractères au plus", () => {
    expect(nomDepuisFichier("Patron casque.v2.pdf")).toBe("Patron casque.v2");
    expect(nomDepuisFichier("a".repeat(200) + ".pdf")).toHaveLength(120);
    expect(nomDepuisFichier(".pdf")).toBe(".pdf");
  });
});

describe("lireAnnonceFichierKit : refus avant tout envoi", () => {
  it("formats acceptés", () => {
    expect(lireAnnonceFichierKit("a.pdf", "pdf_a4", 10)).toEqual({ ok: true, format: "pdf_a4", ext: "pdf" });
    expect(lireAnnonceFichierKit("a.PDF", "pdf_letter", 10)).toEqual({ ok: true, format: "pdf_letter", ext: "pdf" });
    expect(lireAnnonceFichierKit("a.svg", "svg", 10)).toEqual({ ok: true, format: "svg", ext: "svg" });
    expect(lireAnnonceFichierKit("a.stl", "stl", 10)).toEqual({ ok: true, format: "stl", ext: "stl" });
    expect(lireAnnonceFichierKit("a.txt", "transcription", 10)).toEqual({ ok: true, format: "transcription", ext: "txt" });
  });

  it.each([
    ["a.exe", "pdf_a4"],
    ["a.zip", "svg"],
    ["a.pdf", "svg"],
    ["a.svg", "pdf_a4"],
    ["a.pdf", "exe"],
    ["a.pdf", ""],
    ["a", "pdf_a4"],
  ])("%s en %j : format_invalide", (nom, format) => {
    expect(lireAnnonceFichierKit(nom, format, 10)).toEqual({ ok: false, erreur: "format_invalide" });
  });

  it("50 Mo exactement : accepté ; 50 Mo + 1 : fichier_trop_lourd", () => {
    expect(lireAnnonceFichierKit("a.stl", "stl", TAILLE_MAX_FICHIER_KIT).ok).toBe(true);
    expect(lireAnnonceFichierKit("a.stl", "stl", TAILLE_MAX_FICHIER_KIT + 1)).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
  });

  it("transcription : 1 Mo exactement accepté, 1 Mo + 1 refusé", () => {
    expect(lireAnnonceFichierKit("a.txt", "transcription", TAILLE_MAX_TRANSCRIPTION).ok).toBe(true);
    expect(lireAnnonceFichierKit("a.txt", "transcription", TAILLE_MAX_TRANSCRIPTION + 1)).toEqual({ ok: false, erreur: "fichier_trop_lourd" });
  });

  it("taille nulle, négative ou non entière : format_invalide", () => {
    for (const taille of [0, -1, 1.5, Number.NaN]) {
      expect(lireAnnonceFichierKit("a.pdf", "pdf_a4", taille)).toEqual({ ok: false, erreur: "format_invalide" });
    }
  });
});

describe("objets de kits-private", () => {
  it("objetKitValide : dossier du produit, uuid en minuscules, extension du format", () => {
    expect(objetKitValide(`${PRODUIT}/${UUID}.pdf`, PRODUIT, "pdf_letter")).toBe(true);
    expect(objetKitValide(`${PRODUIT}/${UUID}.txt`, PRODUIT, "transcription")).toBe(true);
    expect(objetKitValide(`${PRODUIT}/${UUID}.svg`, PRODUIT, "pdf_a4")).toBe(false);
    expect(objetKitValide(`autre/${UUID}.pdf`, PRODUIT, "pdf_a4")).toBe(false);
    expect(objetKitValide(`${PRODUIT}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.pdf`, PRODUIT, "pdf_a4")).toBe(true);
    expect(objetKitValide(`${PRODUIT}/AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA.pdf`, PRODUIT, "pdf_a4")).toBe(false);
    expect(objetKitValide(`${PRODUIT}/../${UUID}.pdf`, PRODUIT, "pdf_a4")).toBe(false);
    expect(objetKitValide(`${PRODUIT}/${UUID}.pdf/x`, PRODUIT, "pdf_a4")).toBe(false);
  });

  it("objetKitDuProduit : toute extension de kit, jamais un autre dossier", () => {
    for (const ext of ["pdf", "svg", "stl", "txt"]) expect(objetKitDuProduit(`${PRODUIT}/${UUID}.${ext}`, PRODUIT)).toBe(true);
    expect(objetKitDuProduit(`${PRODUIT}/${UUID}.exe`, PRODUIT)).toBe(false);
    expect(objetKitDuProduit(`autre/${UUID}.pdf`, PRODUIT)).toBe(false);
  });

  it("octets lus : 8 pour un PDF, 64 Ko pour un SVG, 1 Ko pour un STL, tout pour une transcription", () => {
    expect(octetsAVerifier("pdf_a4", 999)).toBe(8);
    expect(octetsAVerifier("pdf_letter", 999)).toBe(8);
    expect(octetsAVerifier("svg", 999)).toBe(999);
    expect(octetsAVerifier("svg", 5_000_000)).toBe(1_048_576);
    expect(octetsAVerifier("stl", 999)).toBe(1024);
    expect(octetsAVerifier("transcription", 999)).toBe(999);
  });
});

function stlBinaire(triangles: number): { entete: Uint8Array; taille: number } {
  const entete = new Uint8Array(84);
  new DataView(entete.buffer).setUint32(80, triangles, true);
  return { entete, taille: 84 + 50 * triangles };
}

describe("verifierContenuKit : le contenu réel décide", () => {
  it("PDF : en-tête %PDF-", () => {
    expect(verifierContenuKit("pdf_a4", octets("%PDF-1.7\n"), 100)).toBe(true);
    expect(verifierContenuKit("pdf_letter", octets("%PDF-1.4"), 100)).toBe(true);
  });

  it("un .pdf qui contient du texte ou un autre fichier est refusé", () => {
    expect(verifierContenuKit("pdf_a4", octets("Bonjour"), 7)).toBe(false);
    expect(verifierContenuKit("pdf_a4", octets("<svg xmlns='http://www.w3.org/2000/svg'/>"), 40)).toBe(false);
    expect(verifierContenuKit("pdf_a4", octets("%PDF"), 4)).toBe(false);
    expect(verifierContenuKit("pdf_a4", new Uint8Array(0), 0)).toBe(false);
    expect(verifierContenuKit("pdf_a4", new Uint8Array([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0]), 8)).toBe(false);
  });

  it("SVG : texte qui commence par une balise et contient un élément svg", () => {
    expect(verifierContenuKit("svg", octets('<svg xmlns="http://www.w3.org/2000/svg" width="1"/>'), 60)).toBe(true);
    expect(verifierContenuKit("svg", octets('<?xml version="1.0"?>\n<svg viewBox="0 0 1 1"></svg>'), 60)).toBe(true);
    expect(verifierContenuKit("svg", octets('﻿  <!-- c --><svg/>'), 30)).toBe(true);
  });

  it("SVG : un autre texte, un binaire ou un HTML sans svg est refusé", () => {
    expect(verifierContenuKit("svg", octets("Bonjour"), 7)).toBe(false);
    expect(verifierContenuKit("svg", octets("<html><body>x</body></html>"), 27)).toBe(false);
    expect(verifierContenuKit("svg", octets("%PDF-1.7"), 8)).toBe(false);
    expect(verifierContenuKit("svg", new Uint8Array([60, 115, 118, 103, 0, 1]), 6)).toBe(false);
  });

  it("STL ASCII : commence par solid", () => {
    expect(verifierContenuKit("stl", octets("solid cube\nfacet normal 0 0 1\nendsolid"), 200)).toBe(true);
    expect(verifierContenuKit("stl", octets("hello"), 5)).toBe(false);
    expect(verifierContenuKit("stl", octets("solid\u0000binaire"), 200)).toBe(false);
  });

  it("STL binaire : la taille doit coller (84 + 50 par triangle)", () => {
    const { entete, taille } = stlBinaire(3);
    expect(verifierContenuKit("stl", entete, taille)).toBe(true);
    expect(verifierContenuKit("stl", entete, taille + 1)).toBe(false);
    expect(verifierContenuKit("stl", entete, taille - 1)).toBe(false);
    const vide = stlBinaire(0);
    expect(verifierContenuKit("stl", vide.entete, vide.taille)).toBe(false);
  });

  it("STL binaire dont l'en-tête commence par solid : accepté si la taille colle", () => {
    const { entete, taille } = stlBinaire(2);
    entete.set(octets("solid exporte"), 0);
    expect(verifierContenuKit("stl", entete, taille)).toBe(true);
  });

  it("transcription : UTF-8 valide, entièrement lu, sans octet nul", () => {
    const texte = octets("Bonjour, ceci est une transcription accentuée : été.");
    expect(verifierContenuKit("transcription", texte, texte.length)).toBe(true);
    expect(verifierContenuKit("transcription", texte, texte.length + 5)).toBe(false);
    expect(verifierContenuKit("transcription", new Uint8Array([0xff, 0xfe, 0xfd]), 3)).toBe(false);
    expect(verifierContenuKit("transcription", new Uint8Array([97, 0, 98]), 3)).toBe(false);
    expect(verifierContenuKit("transcription", octets("%PDF-1.7\u0000"), 9)).toBe(false);
  });
});

describe("contenus polyglottes et actifs", () => {
  const svg = (corps: string) => octets(`<svg xmlns="http://www.w3.org/2000/svg">${corps}</svg>`);

  it.each([
    ["script", "<script>alert(1)</script>"],
    ["script en majuscules", "<SCRIPT src='x.js'></SCRIPT>"],
    ["attribut onload", '<rect onload="x()"/>'],
    ["attribut onclick", "<rect onclick = 'x()'/>"],
    ["javascript:", '<a href="javascript:alert(1)"><rect/></a>'],
    ["foreignObject", "<foreignObject><div/></foreignObject>"],
    ["iframe", "<iframe src='x'></iframe>"],
    ["embed", "<embed src='x'/>"],
    ["href externe", '<image href="https://exemple.invalid/x.png"/>'],
    ["xlink:href externe", '<use xlink:href="http://exemple.invalid/x.svg#a"/>'],
    ["href sans protocole", '<image href="//exemple.invalid/x.png"/>'],
  ])("SVG avec %s : contenu_actif", (_nom, corps) => {
    const contenu = svg(corps);
    expect(analyserContenuKit("svg", contenu, contenu.length)).toBe("contenu_actif");
    expect(verifierContenuKit("svg", contenu, contenu.length)).toBe(false);
  });

  it("SVG sûr : une ancre interne et une couleur restent acceptées", () => {
    const contenu = svg('<defs><linearGradient id="a"/></defs><rect fill="url(#a)" width="1" height="1"/><use href="#a"/>');
    expect(analyserContenuKit("svg", contenu, contenu.length)).toBe("ok");
  });

  it("SVG en UTF-8 avec BOM : accepté ; BOM puis contenu actif : refusé", () => {
    const bom = [0xef, 0xbb, 0xbf];
    const propre = new Uint8Array([...bom, ...svg("<rect/>")]);
    expect(analyserContenuKit("svg", propre, propre.length)).toBe("ok");
    const actif = new Uint8Array([...bom, ...svg("<script/>")]);
    expect(analyserContenuKit("svg", actif, actif.length)).toBe("contenu_actif");
  });

  it("SVG dont l'en-tête n'est pas lisible : UTF-16, octets nuls, texte qui ne commence pas par une balise", () => {
    const utf16 = new Uint8Array([0xff, 0xfe, 0x3c, 0x00, 0x73, 0x00, 0x76, 0x00, 0x67, 0x00]);
    expect(analyserContenuKit("svg", utf16, utf16.length)).toBe("entete_illisible");
    const utf16be = new Uint8Array([0xfe, 0xff, 0x00, 0x3c]);
    expect(analyserContenuKit("svg", utf16be, utf16be.length)).toBe("entete_illisible");
    const nul = new Uint8Array([60, 115, 118, 103, 0]);
    expect(analyserContenuKit("svg", nul, nul.length)).toBe("entete_illisible");
    const texte = octets("Bonjour <svg/>");
    expect(analyserContenuKit("svg", texte, texte.length)).toBe("entete_illisible");
    const html = octets("<html><body>x</body></html>");
    expect(analyserContenuKit("svg", html, html.length)).toBe("invalide");
  });

  it("texte qui commence par « solid » sans facette : refusé comme STL ; avec facet normal ou endsolid : accepté", () => {
    for (const texte of ["solid je suis juste du texte", "solid\nbonjour tout le monde"]) {
      expect(analyserContenuKit("stl", octets(texte), 500)).toBe("invalide");
    }
    expect(analyserContenuKit("stl", octets("solid x\n facet normal 0 0 1\n"), 500)).toBe("ok");
    expect(analyserContenuKit("stl", octets("solid x\nendsolid x"), 500)).toBe("ok");
  });

  it("PDF tronqué à 5 octets : accepté par l'en-tête seul ; à 4 octets ou un faux en-tête : refusé", () => {
    expect(analyserContenuKit("pdf_a4", octets("%PDF-"), 5)).toBe("ok");
    expect(analyserContenuKit("pdf_a4", octets("%PDF"), 4)).toBe("invalide");
    expect(analyserContenuKit("pdf_a4", octets("%pdf-1.7"), 8)).toBe("invalide");
  });

  it("un SVG polyglotte déguisé en PDF ou en STL est refusé dans ces formats", () => {
    const contenu = svg("<rect/>");
    expect(analyserContenuKit("pdf_letter", contenu, contenu.length)).toBe("invalide");
    expect(analyserContenuKit("stl", contenu, contenu.length)).toBe("invalide");
  });
});

describe("tailleLisible", () => {
  it("octets, Ko et Mo selon la langue", () => {
    expect(tailleLisible(500, "fr")).toEqual({ valeur: "500", unite: "octets" });
    expect(tailleLisible(2048, "en")).toEqual({ valeur: "2", unite: "ko" });
    expect(tailleLisible(3_000_000, "en")).toEqual({ valeur: "2.9", unite: "mo" });
    expect(tailleLisible(3_000_000, "fr").valeur).toBe("2,9");
    expect(tailleLisible(TAILLE_MAX_FICHIER_KIT, "en")).toEqual({ valeur: "50", unite: "mo" });
  });
});
