import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MARQUEUR_TEXTE } from "@/lib/vitrine/marqueur";
import { decouperParagraphes, formaterVersion, PAGES_LEGALES } from "@/lib/vitrine/pages-legales";

describe("pages légales", () => {
  it("version ISO : date formatée selon la langue, avec l'attribut datetime", () => {
    expect(formaterVersion("2026-11-01", "fr")).toEqual({ texte: "1 novembre 2026", iso: "2026-11-01" });
    expect(formaterVersion("2026-11-01", "en")).toEqual({ texte: "1 November 2026", iso: "2026-11-01" });
  });

  it("marqueur ou date invalide : affiché tel quel, sans datetime", () => {
    expect(formaterVersion(MARQUEUR_TEXTE, "fr")).toEqual({ texte: MARQUEUR_TEXTE, iso: null });
    expect(formaterVersion("2026-02-30", "fr")).toEqual({ texte: "2026-02-30", iso: null });
  });

  it("le texte est découpé sur les lignes vides", () => {
    expect(decouperParagraphes("Un\nsuite\n\nDeux\r\n\r\n\n  \nTrois")).toEqual(["Un\nsuite", "Deux", "Trois"]);
    expect(decouperParagraphes(MARQUEUR_TEXTE)).toEqual([MARQUEUR_TEXTE]);
    expect(decouperParagraphes("  ")).toEqual([]);
  });

  it("quatre pages, et chaque page a ses clés dans les deux langues", () => {
    expect(PAGES_LEGALES.map((p) => p.chemin)).toEqual(["/mentions-legales", "/cgv", "/livraison-et-retours", "/confidentialite"]);
    for (const langue of ["fr", "en"]) {
      const m = JSON.parse(readFileSync(`messages/${langue}.json`, "utf8"));
      for (const { cle } of PAGES_LEGALES) {
        expect(m.Legal[cle].texte, `${langue} Legal.${cle}.texte`).toBeTruthy();
        expect(m.Legal[cle].version).toBeTruthy();
        expect(m.Metadata.legal[cle].titre).toBeTruthy();
        expect(m.Pied.legal[cle]).toBeTruthy();
      }
    }
  });
});
