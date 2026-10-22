import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ connection: async () => {} }));

// redirect() et notFound() de Next interrompent le rendu en levant une erreur : on les imite pour lire leur destination.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`TEST_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("TEST_NOT_FOUND");
  },
}));

const etat = vi.hoisted(() => ({
  sub: null as string | null,
  roles: [] as string[],
  erreurRpc: false,
}));

vi.mock("@/lib/supabase/session", () => ({
  creerClientSession: async () => ({
    auth: { getClaims: async () => ({ data: etat.sub ? { claims: { sub: etat.sub } } : null, error: etat.sub ? null : { name: "AuthSessionMissingError" } }) },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    rpc: async (_nom: string, args: { p_role: string }) =>
      etat.erreurRpc ? { data: null, error: { message: "x" } } : { data: etat.roles.includes(args.p_role), error: null },
  }),
}));

import { DroitRefuseError, exigerAdminPage, exigerDroit } from "@/lib/auth/droits";

beforeEach(() => {
  etat.sub = null;
  etat.roles = [];
  etat.erreurRpc = false;
});

describe("exigerDroit", () => {
  it("refuse un visiteur", async () => {
    await expect(exigerDroit("reglages.modifier")).rejects.toMatchObject({ code: "KS_NON_CONNECTE" });
  });
  it("refuse un Compte sans rôle", async () => {
    etat.sub = "TEST_compte";
    await expect(exigerDroit("reglages.modifier")).rejects.toBeInstanceOf(DroitRefuseError);
    await expect(exigerDroit("reglages.modifier")).rejects.toMatchObject({ code: "KS_DROIT_REFUSE" });
  });
  it("refuse un bénévole", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["benevole"];
    await expect(exigerDroit("commandes.voir")).rejects.toMatchObject({ code: "KS_DROIT_REFUSE" });
  });
  it("accorde à l'assistant les droits de FR-53 seulement", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["assistant"];
    await expect(exigerDroit("commandes.voir")).resolves.toMatchObject({ auteur: { type: "compte", id: "TEST_compte", role: "assistant" } });
    await expect(exigerDroit("reglages.modifier")).rejects.toMatchObject({ code: "KS_DROIT_REFUSE" });
  });
  it("priorité de rôle : admin avant assistant, assistant avant bénévole", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["assistant", "admin"];
    await expect(exigerDroit("reglages.modifier")).resolves.toMatchObject({ auteur: { role: "admin" } });
    etat.roles = ["benevole", "assistant"];
    await expect(exigerDroit("commandes.voir")).resolves.toMatchObject({ auteur: { role: "assistant" } });
  });
  it("accorde tout à l'admin et met son rôle dans l'auteur", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["admin"];
    await expect(exigerDroit("reglages.modifier")).resolves.toEqual({
      compteId: "TEST_compte",
      auteur: { type: "compte", id: "TEST_compte", role: "admin" },
    });
  });
  it("refuse quand la vérification est impossible (jamais d'ouverture par défaut)", async () => {
    etat.sub = "TEST_compte";
    etat.erreurRpc = true;
    await expect(exigerDroit("reglages.modifier")).rejects.toMatchObject({ code: "KS_VERIFICATION_IMPOSSIBLE" });
  });
});

describe("exigerAdminPage", () => {
  it("visiteur : redirection vers la connexion avec le chemin de retour", async () => {
    await expect(exigerAdminPage("fr", "/admin/reglages")).rejects.toThrow("TEST_REDIRECT:/fr/connexion?retour=%2Ffr%2Fadmin%2Freglages");
  });
  it("Compte sans rôle : 404", async () => {
    etat.sub = "TEST_compte";
    await expect(exigerAdminPage("en", "/admin")).rejects.toThrow("TEST_NOT_FOUND");
  });
  it("assistant : 404 (aucun écran admin au lancement)", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["assistant"];
    await expect(exigerAdminPage("fr", "/admin")).rejects.toThrow("TEST_NOT_FOUND");
  });
  it("admin : accès", async () => {
    etat.sub = "TEST_compte";
    etat.roles = ["admin"];
    await expect(exigerAdminPage("fr", "/admin")).resolves.toMatchObject({ compteId: "TEST_compte" });
  });
  it("vérification impossible : l'erreur remonte, ni 404 ni accès", async () => {
    etat.sub = "TEST_compte";
    etat.erreurRpc = true;
    await expect(exigerAdminPage("fr", "/admin")).rejects.toMatchObject({ code: "KS_VERIFICATION_IMPOSSIBLE" });
  });
});
