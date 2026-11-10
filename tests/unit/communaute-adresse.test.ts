import { describe, expect, it } from "vitest";
import { adresseAvecCurseurMurs, analyserRequeteMurs, decoderCurseurMurs, encoderCurseurMurs, serialiserCurseurMurs } from "@/modules/communaute/adresse";
import { CUMUL_MAX_MURS, TAILLE_PAGE_MURS } from "@/modules/communaute/types";

const ID = "00000000-0000-4000-8000-000000000001";
const DATE = "2026-11-10 08:15:30.123456+00";

const faux = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8").toString("base64url");

describe("curseur des Murs", () => {
  it("aller-retour : date, identifiant et nombre déjà affichés", () => {
    expect(decoderCurseurMurs(encoderCurseurMurs({ date: DATE, id: ID, n: 24 }))).toEqual({ date: DATE, id: ID, n: 24 });
  });

  it("opaque : ni l'identifiant ni la date n'apparaissent en clair", () => {
    const c = encoderCurseurMurs({ date: DATE, id: ID, n: TAILLE_PAGE_MURS });
    expect(c).not.toContain(ID);
    expect(c).not.toContain("2026-11-10");
    expect(c).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("absent, illisible ou forgé : première page, sans exception", () => {
    for (const texte of [
      null,
      "",
      "a".repeat(201),
      "!!!",
      Buffer.from("pas du json").toString("base64url"),
      faux(["pas une date", ID, 24]),
      faux([DATE, "pas-un-uuid", 24]),
      faux([DATE, ID]),
      faux([DATE, ID, 24, 1]),
      faux({ date: DATE, id: ID, n: 24 }),
    ]) {
      expect(decoderCurseurMurs(texte)).toBeNull();
    }
  });

  it("le nombre déjà affiché est une page entière, au moins 24, au plus le plafond", () => {
    const e = (n: number) => encoderCurseurMurs({ date: DATE, id: ID, n });
    expect(decoderCurseurMurs(e(TAILLE_PAGE_MURS))?.n).toBe(TAILLE_PAGE_MURS);
    expect(decoderCurseurMurs(e(CUMUL_MAX_MURS))?.n).toBe(CUMUL_MAX_MURS);
    expect(decoderCurseurMurs(e(48))?.n).toBe(48);
    for (const n of [0, 12, 30, CUMUL_MAX_MURS + TAILLE_PAGE_MURS, 24.5, -24]) {
      expect(decoderCurseurMurs(e(n))).toBeNull();
    }
  });
});

describe("analyserRequeteMurs", () => {
  it("lit le curseur de l'adresse (objet de recherche ou URLSearchParams)", () => {
    const c = encoderCurseurMurs({ date: DATE, id: ID, n: TAILLE_PAGE_MURS });
    expect(analyserRequeteMurs({ curseur: c })).toEqual({ date: DATE, id: ID, n: TAILLE_PAGE_MURS });
    expect(analyserRequeteMurs(new URLSearchParams(`curseur=${c}`))).toEqual({ date: DATE, id: ID, n: TAILLE_PAGE_MURS });
  });

  it("première valeur d'un paramètre répété, inconnus ignorés", () => {
    const c = encoderCurseurMurs({ date: DATE, id: ID, n: TAILLE_PAGE_MURS });
    expect(analyserRequeteMurs({ curseur: [c, "autre"], foo: "bar" })).toEqual({ date: DATE, id: ID, n: TAILLE_PAGE_MURS });
    expect(analyserRequeteMurs({})).toBeNull();
  });
});

describe("adresses du mur", () => {
  it("requête et adresse de la suite", () => {
    expect(serialiserCurseurMurs(null)).toBe("");
    expect(serialiserCurseurMurs("CUR")).toBe("curseur=CUR");
    expect(adresseAvecCurseurMurs("fr", null)).toBe("/fr");
    expect(adresseAvecCurseurMurs("en", "CUR")).toBe("/en?curseur=CUR");
  });
});
