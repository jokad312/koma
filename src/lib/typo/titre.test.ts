import { describe, expect, it } from "vitest";
import { choisirPoliceTitre, preparerTitre, retirerAccents, GLYPHES_SAKURA, sakuraCouvre } from "./titre";

describe("glyphes de Sakura Town", () => {
  it("couvre les caractères ASCII imprimables (95 caractères, sans accent)", () => {
    expect(GLYPHES_SAKURA).toHaveLength(95);
    expect(GLYPHES_SAKURA).toContain("-");
    expect(GLYPHES_SAKURA).toContain("'");
    expect(GLYPHES_SAKURA).not.toMatch(/[éèàç’«»]/);
  });

  it("accepte « KOMA » et refuse « Accès »", () => {
    expect(sakuraCouvre("KOMA")).toBe(true);
    expect(sakuraCouvre("Porte-le ou fabrique-le")).toBe(true);
    expect(sakuraCouvre("Accès")).toBe(false);
    expect(sakuraCouvre("Guerrière du désert")).toBe(false);
    expect(sakuraCouvre("L’atelier")).toBe(false);
  });
});

describe("choisirPoliceTitre", () => {
  it("option éteinte : toujours Barlow Condensed", () => {
    expect(choisirPoliceTitre("KOMA", false)).toBe("condensee");
  });
  it("option active : Sakura seulement si tout le titre est couvert (bascule entière)", () => {
    expect(choisirPoliceTitre("KOMA", true)).toBe("sakura");
    expect(choisirPoliceTitre("Accès", true)).toBe("condensee");
  });
});

describe("preparerTitre", () => {
  it("garde les accents avec Barlow (Sakura éteinte)", () => {
    expect(preparerTitre("CATÉGORIES", false)).toEqual({ texte: "CATÉGORIES", police: "condensee" });
  });
  it("retire les accents seulement quand Sakura est active et couvre le titre", () => {
    expect(preparerTitre("CATÉGORIES", true)).toEqual({ texte: "CATEGORIES", police: "sakura" });
    expect(retirerAccents("RÉPONSES À GOMA")).toBe("REPONSES A GOMA");
  });
  it("garde le titre d'origine en Barlow si Sakura ne le couvre pas même sans accents", () => {
    expect(preparerTitre("L’ÉCOLE", true)).toEqual({ texte: "L’ÉCOLE", police: "condensee" });
  });
});
