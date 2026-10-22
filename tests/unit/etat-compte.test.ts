import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));

const etat = vi.hoisted(() => ({
  sub: null as string | null,
  complet: false as boolean,
  vues: false as boolean,
  erreurComplet: false,
  erreurVues: false,
}));

vi.mock("@/lib/supabase/session", () => ({
  creerClientSession: async () => ({
    auth: { getClaims: async () => ({ data: etat.sub ? { claims: { sub: etat.sub } } : null, error: etat.sub ? null : { name: "AuthSessionMissingError" } }) },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    rpc: async (nom: string) => {
      if (nom === "compte_complet") return etat.erreurComplet ? { data: null, error: { message: "x" } } : { data: etat.complet, error: null };
      if (nom === "questions_accueil_vues") return etat.erreurVues ? { data: null, error: { message: "x" } } : { data: etat.vues, error: null };
      throw new Error(`TEST_rpc inattendue : ${nom}`);
    },
  }),
}));

import { lireEtatCompte } from "@/lib/auth/compte";

beforeEach(() => {
  etat.sub = "TEST_compte";
  etat.complet = false;
  etat.vues = false;
  etat.erreurComplet = false;
  etat.erreurVues = false;
});

describe("lireEtatCompte", () => {
  it("sans session : anonyme", async () => {
    etat.sub = null;
    expect(await lireEtatCompte()).toBe("anonyme");
  });
  it("âge non déclaré : incomplet", async () => {
    expect(await lireEtatCompte()).toBe("incomplet");
  });
  it("Compte complet qui n'a jamais vu les questions : questions", async () => {
    etat.complet = true;
    expect(await lireEtatCompte()).toBe("questions");
  });
  it("Compte complet, questions vues : complet", async () => {
    etat.complet = true;
    etat.vues = true;
    expect(await lireEtatCompte()).toBe("complet");
  });
  it("erreur de lecture des questions : complet, jamais bloqué", async () => {
    etat.complet = true;
    etat.erreurVues = true;
    expect(await lireEtatCompte()).toBe("complet");
  });
  it("erreur de lecture de l'âge : anonyme (la page reste utilisable)", async () => {
    etat.erreurComplet = true;
    expect(await lireEtatCompte()).toBe("anonyme");
  });
});
