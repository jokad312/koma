import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ ordre: [] as string[] }));
vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({
  connection: async () => {
    faux.ordre.push("connection");
  },
}));
vi.mock("@/modules/panier/dependances", () => ({
  dependances: () => {
    faux.ordre.push("dependances");
    return {};
  },
}));
vi.mock("@/modules/panier/service", () => ({
  lire: async () => {
    faux.ordre.push("lire");
    return null;
  },
  compter: async () => {
    faux.ordre.push("compter");
    return 0;
  },
}));

import { compterPanier, lirePanier } from "@/modules/panier/queries";

beforeEach(() => {
  faux.ordre = [];
});

// Sans connection() d'abord, le service attraperait le signal de pré-rendu de Next et la page figerait un état d'erreur.
describe("lectures du Panier", () => {
  it("la lecture est déclarée dynamique avant tout accès au cookie", async () => {
    await lirePanier("fr");
    expect(faux.ordre[0]).toBe("connection");
    expect(faux.ordre).toEqual(["connection", "dependances", "lire"]);
  });
  it("le compteur de l'en-tête aussi", async () => {
    await compterPanier();
    expect(faux.ordre).toEqual(["connection", "dependances", "compter"]);
  });
});
