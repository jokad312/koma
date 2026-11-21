import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ readdir: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("node:fs/promises", () => ({ readdir: faux.readdir }));

import { lirePhotosConnexion } from "@/lib/vitrine/photos-connexion";

beforeEach(() => vi.clearAllMocks());

describe("photos du panneau de connexion (9.16, modèle F)", () => {
  it("garde les fichiers image seulement (pas les sous-dossiers), triés, en adresses publiques encodées", async () => {
    const entree = (name: string, fichier = true) => ({ name, isFile: () => fichier });
    faux.readdir.mockResolvedValue([entree("b.webp"), entree(".cache.jpg"), entree("LISEZMOI.txt"), entree("a photo.JPG"), entree("anciennes.jpg", false)]);
    await expect(lirePhotosConnexion()).resolves.toEqual(["/images/connexion/a%20photo.JPG", "/images/connexion/b.webp"]);
  });

  it("dossier absent ou vide : aucune photo (la page montre le visuel « COSPLAY »)", async () => {
    faux.readdir.mockRejectedValue(Object.assign(new Error("absent"), { code: "ENOENT" }));
    await expect(lirePhotosConnexion()).resolves.toEqual([]);
    faux.readdir.mockResolvedValue([]);
    await expect(lirePhotosConnexion()).resolves.toEqual([]);
  });
});
