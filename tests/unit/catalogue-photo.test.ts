import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { LIMITE_PIXELS, nettoyerPhoto } from "@/modules/catalogue/photo";

// Images générées par les tests (règle 6 : jamais une image tierce). Pixels unis, aucune photo réelle.
const base = () => sharp({ create: { width: 40, height: 20, channels: 3, background: { r: 200, g: 30, b: 30 } } });

async function jpegAvecGps(): Promise<Buffer> {
  return base()
    .jpeg()
    .withExif({
      IFD0: { Make: "TEST_Appareil" },
      IFD3: { GPSLatitudeRef: "N", GPSLatitude: "48/1 51/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "2/1 21/1 0/1" },
    })
    .withMetadata({ orientation: 6 })
    .toBuffer();
}

describe("nettoyerPhoto", () => {
  it("la photo de départ porte bien une position GPS (le test prouve ce qu'il retire)", async () => {
    const depart = await jpegAvecGps();
    const meta = await sharp(depart).metadata();
    expect(meta.exif).toBeTruthy();
    expect(meta.orientation).toBe(6);
    expect(depart.includes(Buffer.from("TEST_Appareil"))).toBe(true);
  });

  it("JPEG avec GPS : ressort sans aucune métadonnée, orientation appliquée", async () => {
    const r = await nettoyerPhoto(await jpegAvecGps());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ext).toBe("jpg");
    expect(r.contentType).toBe("image/jpeg");
    const meta = await sharp(r.octets).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(r.octets.includes(Buffer.from("Exif"))).toBe(false);
    expect(r.octets.includes(Buffer.from("TEST_Appareil"))).toBe(false);
    // Orientation 6 (rotation de 90 degrés) appliquée aux pixels : 40x20 devient 20x40.
    expect([meta.width, meta.height]).toEqual([20, 40]);
  });

  it.each([
    ["png", "png", "image/png"],
    ["webp", "webp", "image/webp"],
  ] as const)("%s : accepté, format réel conservé", async (format, ext, contentType) => {
    const entree = await base()[format]().toBuffer();
    const r = await nettoyerPhoto(entree);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ext).toBe(ext);
      expect(r.contentType).toBe(contentType);
      expect((await sharp(r.octets).metadata()).format).toBe(format);
    }
  });

  it("GIF : refusé (le format réel compte)", async () => {
    const gif = await base().gif().toBuffer();
    expect(await nettoyerPhoto(gif)).toEqual({ ok: false });
  });

  it("faux .jpg (contenu texte) : refusé", async () => {
    expect(await nettoyerPhoto(new TextEncoder().encode("ceci n'est pas une image"))).toEqual({ ok: false });
  });

  it("PDF : refusé", async () => {
    expect(await nettoyerPhoto(new TextEncoder().encode("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"))).toEqual({ ok: false });
  });

  it("JPEG tronqué ou vide : refusé sans lever", async () => {
    const entier = await base().jpeg().toBuffer();
    expect(await nettoyerPhoto(entier.subarray(0, 30))).toEqual({ ok: false });
    expect(await nettoyerPhoto(new Uint8Array())).toEqual({ ok: false });
  });

  it("plafond de pixels : une image au-delà est refusée comme un format invalide", async () => {
    const entree = await base().png().toBuffer();
    expect((await nettoyerPhoto(entree, 800)).ok).toBe(true);
    expect(await nettoyerPhoto(entree, 799)).toEqual({ ok: false });
    expect(LIMITE_PIXELS).toBe(100_000_000);
  });
});
