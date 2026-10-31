import { describe, expect, it, vi } from "vitest";
import { lireEtatKit } from "@/modules/bibliotheque/service";
import type { DependancesBibliotheque } from "@/modules/bibliotheque/types";

const PRODUIT = "00000000-0000-4000-8000-0000000000aa";

function faux(s: Partial<DependancesBibliotheque> = {}): DependancesBibliotheque {
  return {
    compteId: vi.fn(async () => "TEST_compte"),
    possedeKit: vi.fn(async () => false),
    compteComplet: vi.fn(async () => true),
    ...s,
  };
}

describe("lireEtatKit", () => {
  it("anonyme sans session, sans interroger la base", async () => {
    const deps = faux({ compteId: vi.fn(async () => null) });
    await expect(lireEtatKit(deps, PRODUIT)).resolves.toBe("anonyme");
    expect(deps.possedeKit).not.toHaveBeenCalled();
  });
  it("possede quand l'accès existe, même pour un Kit payant", async () => {
    await expect(lireEtatKit(faux({ possedeKit: vi.fn(async () => true) }), PRODUIT)).resolves.toBe("possede");
  });
  it("pret pour un Compte complet qui n'a pas le Kit", async () => {
    await expect(lireEtatKit(faux(), PRODUIT)).resolves.toBe("pret");
  });
  it("incomplet pour un Compte sans âge déclaré", async () => {
    await expect(lireEtatKit(faux({ compteComplet: vi.fn(async () => false) }), PRODUIT)).resolves.toBe("incomplet");
  });
  it("anonyme (rien promis) si la lecture échoue, et un identifiant invalide n'interroge rien", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(lireEtatKit(faux({ possedeKit: vi.fn(async () => { throw new Error("x"); }) }), PRODUIT)).resolves.toBe("anonyme");
    const deps = faux();
    await expect(lireEtatKit(deps, "pas-un-uuid")).resolves.toBe("anonyme");
    expect(deps.compteId).not.toHaveBeenCalled();
  });
});
