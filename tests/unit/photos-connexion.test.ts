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

  it("fichiers hors liste : tri numérique, « 2- » avant « 10- »", async () => {
    const entree = (name: string) => ({ name, isFile: () => true });
    faux.readdir.mockResolvedValue([entree("10-c.webp"), entree("2-b.webp"), entree("1-a.webp")]);
    await expect(lirePhotosConnexion()).resolves.toEqual(["/images/connexion/1-a.webp", "/images/connexion/2-b.webp", "/images/connexion/10-c.webp"]);
  });

  it("ordre fixé explicitement : l'image en couleur (3-) d'abord, puis 1- et 2- ; un fichier hors liste passe après", async () => {
    const entree = (name: string) => ({ name, isFile: () => true });
    faux.readdir.mockResolvedValue([entree("1-illustration.webp"), entree("2-illustration.webp"), entree("0-nouvelle.webp"), entree("3-illustration.webp")]);
    await expect(lirePhotosConnexion()).resolves.toEqual([
      "/images/connexion/3-illustration.webp",
      "/images/connexion/1-illustration.webp",
      "/images/connexion/2-illustration.webp",
      "/images/connexion/0-nouvelle.webp",
    ]);
  });

  it("dossier absent ou vide : aucune photo (la page montre le visuel « COSPLAY »)", async () => {
    faux.readdir.mockRejectedValue(Object.assign(new Error("absent"), { code: "ENOENT" }));
    await expect(lirePhotosConnexion()).resolves.toEqual([]);
    faux.readdir.mockResolvedValue([]);
    await expect(lirePhotosConnexion()).resolves.toEqual([]);
  });
});
