import { describe, expect, it } from "vitest";
import { choisirSlugLibre, proposerSlug, SLUG_REGEX } from "@/modules/catalogue/slug";

describe("proposerSlug", () => {
  it("minuscules, sans accent, tirets", () => {
    expect(proposerSlug("Costume d'Été — Héroïne n°2 !")).toBe("costume-d-ete-heroine-n-2");
    expect(proposerSlug("  Perruque   ROSE  ")).toBe("perruque-rose");
  });

  it("vide quand le titre n'a aucun caractère utilisable", () => {
    expect(proposerSlug("")).toBe("");
    expect(proposerSlug("!!! ???")).toBe("");
  });

  it("80 caractères au plus, sans tiret final, toujours valide", () => {
    const slug = proposerSlug(`${"abcdefghi ".repeat(20)}fin`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
    expect(SLUG_REGEX.test(slug)).toBe(true);
  });
});

describe("choisirSlugLibre", () => {
  it("la base si elle est libre", () => {
    expect(choisirSlugLibre("cosplay", new Set(["autre"]))).toBe("cosplay");
  });

  it("sinon la première adresse libre avec un suffixe", () => {
    expect(choisirSlugLibre("cosplay", new Set(["cosplay"]))).toBe("cosplay-2");
    expect(choisirSlugLibre("cosplay", new Set(["cosplay", "cosplay-2", "cosplay-3"]))).toBe("cosplay-4");
  });

  it("garde 80 caractères au plus, suffixe compris", () => {
    const base = "a".repeat(80);
    const libre = choisirSlugLibre(base, new Set([base]));
    expect(libre.length).toBeLessThanOrEqual(80);
    expect(libre.endsWith("-2")).toBe(true);
    expect(SLUG_REGEX.test(libre)).toBe(true);
  });
});
