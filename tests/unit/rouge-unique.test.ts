import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CLASSES_PRINCIPAL } from "@/components/ui/classes";

const css = readFileSync("src/app/globals.css", "utf8");

// Valeur d'une variable dans un bloc donné (:root ou :root[data-theme="dark"]).
function variable(bloc: "creme" | "sombre", nom: string): string | undefined {
  const debut = bloc === "creme" ? css.indexOf(":root {") : css.indexOf(':root[data-theme="dark"] {');
  const fin = css.indexOf("}", debut);
  return css.slice(debut, fin).match(new RegExp(`--ks-${nom}:\\s*([^;]+);`))?.[1].trim();
}

describe("rouge unique (DESIGN.md › règle du rouge)", () => {
  it("le rouge primaire est #E3261C dans les deux thèmes, texte sur rouge #FFFFFF", () => {
    for (const bloc of ["creme", "sombre"] as const) {
      expect(variable(bloc, "primary")?.toLowerCase()).toBe("#e3261c");
      expect(variable(bloc, "on-primary")?.toLowerCase()).toBe("#ffffff");
    }
  });

  it("le bouton principal utilise ces deux rôles et rien d'autre pour ses couleurs", () => {
    expect(CLASSES_PRINCIPAL).toContain("bg-primary");
    expect(CLASSES_PRINCIPAL).toContain("text-on-primary");
    expect(css).toMatch(/--color-primary:\s*var\(--ks-primary\)/);
    expect(css).toMatch(/--color-on-primary:\s*var\(--ks-on-primary\)/);
  });

  it("aucun second rouge : toute teinte rouge de la feuille est une valeur de DESIGN.md", () => {
    // Teintes dont le rouge domine nettement : seuls #E3261C et les extrémités de dégradé / erreur / verre de DESIGN.md sont permis.
    const permis = new Set(["#e3261c", "#9e1a12", "#7a1a12", "#b01b13", "#f2766b"]);
    const hex = [...css.matchAll(/#([0-9a-f]{6})(?:[0-9a-f]{2})?\b/gi)].map((m) => m[1].toLowerCase());
    const rouges = hex.filter((h) => {
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      return r > 150 && r - Math.max(g, b) > 90;
    });
    for (const h of rouges) expect(permis.has(`#${h}`)).toBe(true);
    // Le rouge de marque n'est jamais modifié.
    expect(variable("creme", "brand-red")?.toLowerCase()).toBe("#e3261c");
  });
});
