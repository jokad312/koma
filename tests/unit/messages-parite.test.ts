import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function cles(objet: unknown, prefixe = ""): string[] {
  if (typeof objet !== "object" || objet === null) return [prefixe];
  return Object.entries(objet).flatMap(([k, v]) => cles(v, prefixe ? `${prefixe}.${k}` : k));
}

const lire = (langue: string) => JSON.parse(readFileSync(`messages/${langue}.json`, "utf8"));

describe("messages", () => {
  it("fr.json et en.json ont exactement les mêmes clés", () => {
    const fr = cles(lire("fr")).sort();
    const en = cles(lire("en")).sort();
    expect(fr.filter((c) => !en.includes(c))).toEqual([]);
    expect(en.filter((c) => !fr.includes(c))).toEqual([]);
  });
  it("aucune valeur n'est vide", () => {
    for (const langue of ["fr", "en"]) {
      expect(JSON.stringify(lire(langue))).not.toContain('""');
    }
  });
});
