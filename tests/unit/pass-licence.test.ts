// Story 7.5, règle 6 : la bibliothèque de Code QR a une licence permissive vérifiée et notée dans docs/licences/, une version figée et aucune
// dépendance cachée. Une mise à jour de version doit passer par une nouvelle vérification de la licence.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const lire = (chemin: string) => readFileSync(new URL(`../../${chemin}`, import.meta.url), "utf8");

describe("licence de qrcode-generator", () => {
  const paquet = JSON.parse(lire("package.json")) as { dependencies: Record<string, string> };
  const version = paquet.dependencies["qrcode-generator"];
  const note = lire("docs/licences/qrcode-generator.md");

  it("la version est figée, sans ^ ni ~", () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("la note de licence existe, nomme la licence MIT et la version exacte du paquet", () => {
    expect(note).toMatch(/\bMIT\b/);
    expect(note).toContain(version);
    expect(note).toMatch(/Date de vérification/);
  });

  it("le paquet installé est bien sous licence MIT, à la version notée", () => {
    const installe = JSON.parse(lire("node_modules/qrcode-generator/package.json")) as { license: string; version: string; dependencies?: Record<string, string> };
    expect(installe.license).toBe("MIT");
    expect(installe.version).toBe(version);
    expect(installe.dependencies ?? {}).toEqual({});
  });
});
