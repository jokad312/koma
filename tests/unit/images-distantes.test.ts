import { matchRemotePattern } from "next/dist/shared/lib/match-remote-pattern";
import { describe, expect, it } from "vitest";
import { photosAutorisees } from "@/lib/supabase/images-distantes";
import { urlPhotoPublique } from "@/lib/supabase/stockage";

const accepte = (base: string, url: string) => photosAutorisees(base).some((m) => matchRemotePattern(m, new URL(url)));

describe("images.remotePatterns (photosAutorisees)", () => {
  it.each(["https://exemple.invalid", "http://localhost:54321"])("accepte l'adresse produite par urlPhotoPublique (%s)", (base) => {
    expect(accepte(base, urlPhotoPublique("p/u.jpg", base))).toBe(true);
  });

  it("refuse un autre chemin, un autre bucket, un autre hôte ou un autre port", () => {
    const base = "http://localhost:54321";
    expect(accepte(base, "http://localhost:54321/storage/v1/object/public/autre-bucket/p/u.jpg")).toBe(false);
    expect(accepte(base, "http://localhost:54321/storage/v1/object/sign/produits-public/p/u.jpg")).toBe(false);
    expect(accepte(base, "http://localhost:54321/autre")).toBe(false);
    expect(accepte(base, "http://autre.invalid:54321/storage/v1/object/public/produits-public/p/u.jpg")).toBe(false);
    expect(accepte(base, "http://localhost:9999/storage/v1/object/public/produits-public/p/u.jpg")).toBe(false);
    expect(accepte("https://exemple.invalid", "http://exemple.invalid/storage/v1/object/public/produits-public/p/u.jpg")).toBe(false);
  });

  it("adresse absente ou invalide : aucune image distante", () => {
    expect(photosAutorisees(undefined)).toEqual([]);
    expect(photosAutorisees("pas une adresse")).toEqual([]);
  });
});
