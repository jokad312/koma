import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const etat = vi.hoisted(() => ({
  sub: null as string | null,
  complet: false as boolean,
  erreurRpc: false,
}));

vi.mock("@/lib/supabase/session", () => ({
  creerClientSession: async () => ({
    auth: { getClaims: async () => ({ data: etat.sub ? { claims: { sub: etat.sub } } : null, error: etat.sub ? null : { name: "AuthSessionMissingError" } }) },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    rpc: async () => (etat.erreurRpc ? { data: null, error: { message: "x" } } : { data: etat.complet, error: null }),
  }),
}));

import { CompteRefuseError, exigerCompteComplet } from "@/lib/auth/compte";

beforeEach(() => {
  etat.sub = null;
  etat.complet = false;
  etat.erreurRpc = false;
});

describe("exigerCompteComplet", () => {
  it("refuse sans session", async () => {
    await expect(exigerCompteComplet()).rejects.toMatchObject({ code: "KS_NON_CONNECTE" });
  });
  it("refuse un Compte sans âge déclaré", async () => {
    etat.sub = "TEST_compte";
    await expect(exigerCompteComplet()).rejects.toBeInstanceOf(CompteRefuseError);
    await expect(exigerCompteComplet()).rejects.toMatchObject({ code: "KS_COMPTE_INCOMPLET" });
  });
  it("refuse quand la vérification est impossible", async () => {
    etat.sub = "TEST_compte";
    etat.erreurRpc = true;
    await expect(exigerCompteComplet()).rejects.toMatchObject({ code: "KS_VERIFICATION_IMPOSSIBLE" });
  });
  it("accepte un Compte complet et donne l'auteur", async () => {
    etat.sub = "TEST_compte";
    etat.complet = true;
    await expect(exigerCompteComplet()).resolves.toEqual({
      compteId: "TEST_compte",
      auteur: { type: "compte", id: "TEST_compte", role: null },
    });
  });
});
