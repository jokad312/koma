import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ resultat: { data: null as unknown, error: null as unknown } }));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({
  creerClientPublic: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => faux.resultat }) }) }) }),
}));

import { lireNumeroWhatsapp, lireNumeroWhatsappOuNull } from "@/lib/reglages";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("lireNumeroWhatsapp", () => {
  it("absent, vide ou espaces : null, sans repli", async () => {
    for (const data of [null, { valeur: null }, { valeur: "  " }]) {
      faux.resultat = { data, error: null };
      expect(await lireNumeroWhatsapp()).toBeNull();
    }
  });
  it("présent : la valeur rognée", async () => {
    faux.resultat = { data: { valeur: " +243970000000 " }, error: null };
    expect(await lireNumeroWhatsapp()).toBe("+243970000000");
  });
  it("autre erreur : relancée", async () => {
    faux.resultat = { data: null, error: { message: "boum" } };
    await expect(lireNumeroWhatsapp()).rejects.toThrow();
  });
});

describe("lireNumeroWhatsappOuNull (appelants : layout, à propos, contact)", () => {
  it("erreur de lecture : null (lien masqué) et cause journalisée, les pages ne tombent pas", async () => {
    faux.resultat = { data: null, error: { message: "boum" } };
    expect(await lireNumeroWhatsappOuNull()).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
  it("numéro présent : transmis", async () => {
    faux.resultat = { data: { valeur: "+243970000000" }, error: null };
    expect(await lireNumeroWhatsappOuNull()).toBe("+243970000000");
  });
});
