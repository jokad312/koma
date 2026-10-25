import { describe, expect, it } from "vitest";
import { urlPhotoPublique } from "@/lib/supabase/stockage";

describe("urlPhotoPublique", () => {
  it("dérive l'adresse du projet Supabase, sans doublon de barre", () => {
    expect(urlPhotoPublique("p/u.jpg", "https://exemple.invalid/")).toBe("https://exemple.invalid/storage/v1/object/public/produits-public/p/u.jpg");
  });

  it("encode les segments du chemin", () => {
    expect(urlPhotoPublique("p/a b.jpg", "https://exemple.invalid")).toBe("https://exemple.invalid/storage/v1/object/public/produits-public/p/a%20b.jpg");
  });
});
