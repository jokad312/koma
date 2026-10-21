import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin];
  });
}

// Le nom du site vient du réglage nom_site seulement (valeur de départ dans la migration).
describe("nom du site", () => {
  it("n'est écrit en dur ni dans src/ ni dans messages/", () => {
    const nom = /koma\s*(shop|fest)/i;
    const fautifs = [...fichiers("src"), ...fichiers("messages")]
      .filter((f) => !f.endsWith(".test.ts") && !f.endsWith("types.ts"))
      .filter((f) => nom.test(readFileSync(f, "utf8")));
    expect(fautifs).toEqual([]);
  });
});
