import { describe, expect, it } from "vitest";
import { produitsPourLien } from "@/modules/blog/produits-lien";

// Story 9.16 e) : le sélecteur « produit lié » d'un article ne propose pas les produits archivés, sauf celui déjà lié.
describe("produitsPourLien", () => {
  const produits = [
    { id: "TEST_a", titreFr: "TEST_Actif", archiveLe: null },
    { id: "TEST_b", titreFr: "TEST_Archive", archiveLe: "2026-11-10T00:00:00Z" },
    { id: "TEST_c", titreFr: "TEST_Archive lié", archiveLe: "2026-11-11T00:00:00Z" },
  ];

  it("nouvel article : produits archivés exclus", () => {
    expect(produitsPourLien(produits)).toEqual([{ id: "TEST_a", titreFr: "TEST_Actif" }]);
  });

  it("article existant : le produit archivé déjà lié est gardé, les autres archivés exclus", () => {
    expect(produitsPourLien(produits, "TEST_c")).toEqual([
      { id: "TEST_a", titreFr: "TEST_Actif" },
      { id: "TEST_c", titreFr: "TEST_Archive lié" },
    ]);
    expect(produitsPourLien(produits, null)).toEqual([{ id: "TEST_a", titreFr: "TEST_Actif" }]);
  });
});
