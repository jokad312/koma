import { describe, expect, it } from "vitest";
import { manquesPublication } from "@/modules/catalogue/publication";

const complet = { prixCents: 4990, titreEn: "T", descriptionFr: "D", descriptionEn: "E", nbPhotos: 1, nbVariantes: 1 };

describe("manquesPublication", () => {
  it("produit complet : rien ne manque", () => {
    expect(manquesPublication(complet)).toEqual([]);
  });

  it("brouillon vide : tout manque, dans l'ordre d'affichage", () => {
    expect(manquesPublication({ prixCents: null, titreEn: null, descriptionFr: null, descriptionEn: null, nbPhotos: 0, nbVariantes: 0 })).toEqual([
      "prix",
      "photo",
      "titre_en",
      "description_fr",
      "description_en",
      "variante",
    ]);
  });

  it.each([
    [{ prixCents: null }, ["prix"]],
    [{ nbPhotos: 0 }, ["photo"]],
    [{ titreEn: "   " }, ["titre_en"]],
    [{ descriptionFr: "" }, ["description_fr"]],
    [{ descriptionEn: null }, ["description_en"]],
    [{ nbVariantes: 0 }, ["variante"]],
  ])("un seul manque %#", (partiel, attendu) => {
    expect(manquesPublication({ ...complet, ...partiel })).toEqual(attendu);
  });
});
