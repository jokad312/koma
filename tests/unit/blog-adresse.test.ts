import { describe, expect, it } from "vitest";
import {
  adresseAvecCurseur,
  analyserRequeteArticles,
  decoderCurseurArticles,
  encoderCurseurArticles,
  serialiserCurseur,
} from "@/modules/blog/adresse";
import { CUMUL_MAX_ARTICLES, TAILLE_PAGE_ARTICLES } from "@/modules/blog/types";

const ID = "00000000-0000-4000-8000-000000000001";
const DATE = "2026-10-26 10:00:00.123456+00";

const faux = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8").toString("base64url");

describe("curseur des Articles", () => {
  it("aller-retour : date, identifiant et nombre déjà affiché", () => {
    expect(decoderCurseurArticles(encoderCurseurArticles({ date: DATE, id: ID, n: 24 }))).toEqual({ date: DATE, id: ID, n: 24 });
  });

  it("opaque : ni l'identifiant ni la date n'apparaissent en clair", () => {
    const c = encoderCurseurArticles({ date: DATE, id: ID, n: 12 });
    expect(c).not.toContain(ID);
    expect(c).not.toContain("2026-10-26");
    expect(c).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("absent, illisible ou forgé : première page, sans exception", () => {
    for (const texte of [
      null,
      "",
      "a".repeat(201),
      "!!!",
      Buffer.from("pas du json").toString("base64url"),
      faux(["pas une date", ID, 12]),
      faux([DATE, "pas-un-uuid", 12]),
      faux([DATE, ID]),
      faux([DATE, ID, 12, 1]),
      faux({ date: DATE, id: ID, n: 12 }),
    ]) {
      expect(decoderCurseurArticles(texte)).toBeNull();
    }
  });

  it("le nombre déjà affiché est une page entière, au moins 12, au plus le plafond", () => {
    const e = (n: number) => encoderCurseurArticles({ date: DATE, id: ID, n });
    expect(decoderCurseurArticles(e(TAILLE_PAGE_ARTICLES))?.n).toBe(TAILLE_PAGE_ARTICLES);
    expect(decoderCurseurArticles(e(CUMUL_MAX_ARTICLES))?.n).toBe(CUMUL_MAX_ARTICLES);
    for (const n of [0, 6, 18, CUMUL_MAX_ARTICLES + TAILLE_PAGE_ARTICLES, 24.5, -12]) {
      expect(decoderCurseurArticles(e(n))).toBeNull();
    }
  });
});

describe("analyserRequeteArticles", () => {
  it("lit le curseur de l'adresse (objet de recherche ou URLSearchParams)", () => {
    const c = encoderCurseurArticles({ date: DATE, id: ID, n: 12 });
    expect(analyserRequeteArticles({ curseur: c })).toEqual({ date: DATE, id: ID, n: 12 });
    expect(analyserRequeteArticles(new URLSearchParams(`curseur=${c}`))).toEqual({ date: DATE, id: ID, n: 12 });
  });

  it("première valeur d'un paramètre répété, inconnus ignorés", () => {
    const c = encoderCurseurArticles({ date: DATE, id: ID, n: 12 });
    expect(analyserRequeteArticles({ curseur: [c, "autre"], foo: "bar" })).toEqual({ date: DATE, id: ID, n: 12 });
    expect(analyserRequeteArticles({})).toBeNull();
  });
});

describe("adresses de la liste", () => {
  it("requête et adresse de la suite", () => {
    expect(serialiserCurseur(null)).toBe("");
    expect(serialiserCurseur("CUR")).toBe("curseur=CUR");
    expect(adresseAvecCurseur("fr", null)).toBe("/fr/blog");
    expect(adresseAvecCurseur("en", "CUR")).toBe("/en/blog?curseur=CUR");
  });
});
