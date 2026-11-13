import { beforeEach, describe, expect, it, vi } from "vitest";
import { arriveeParDefaut, estAccueilDeLangue, roleDuJeton } from "@/lib/auth/arrivee";

vi.mock("server-only", () => ({}));

// Faux rôle, fausse session et faux accès bénévole (tests uniquement, règle 13).
const faux = vi.hoisted(() => ({
  role: null as string | null,
  roleErreur: false,
  session: "TEST_compte" as string | null,
  acces: [] as { valide: boolean }[],
  accesErreur: false,
}));
vi.mock("@/lib/auth/droits", () => ({
  lireRole: async () => {
    if (faux.roleErreur) throw new Error("TEST_role");
    return faux.role;
  },
}));
vi.mock("@/lib/auth/compte", () => ({ lireSessionVerifiee: async () => (faux.session ? { compteId: faux.session } : null) }));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    rpc: async () => (faux.accesErreur ? { data: null, error: { message: "TEST" } } : { data: faux.acces, error: null }),
  }),
}));

import { destinationApresConnexion } from "@/lib/auth/arrivee-serveur";

describe("arriveeParDefaut", () => {
  it("admin, assistant, bénévole avec accès, client", () => {
    expect(arriveeParDefaut("admin", "fr")).toBe("/fr/admin");
    expect(arriveeParDefaut("assistant", "en")).toBe("/en/admin/commandes");
    expect(arriveeParDefaut("benevole", "fr")).toBe("/fr/scan");
    expect(arriveeParDefaut(null, "en")).toBe("/en/compte");
  });
});

describe("roleDuJeton", () => {
  it("lit koma_role admin ou assistant, ignore tout le reste", () => {
    expect(roleDuJeton({ sub: "x", koma_role: "admin" })).toBe("admin");
    expect(roleDuJeton({ sub: "x", koma_role: "assistant" })).toBe("assistant");
    expect(roleDuJeton({ sub: "x", koma_role: "benevole" })).toBeNull();
    expect(roleDuJeton({ sub: "x", koma_role: ["admin"] })).toBeNull();
    expect(roleDuJeton({ sub: "x" })).toBeNull();
    expect(roleDuJeton(null)).toBeNull();
    expect(roleDuJeton(undefined)).toBeNull();
  });
});

describe("estAccueilDeLangue", () => {
  it("seul l'accueil de la langue n'est pas un retour précis", () => {
    expect(estAccueilDeLangue("/fr", "fr")).toBe(true);
    expect(estAccueilDeLangue("/fr/", "fr")).toBe(true);
    expect(estAccueilDeLangue("/fr?x=1", "fr")).toBe(true);
    expect(estAccueilDeLangue("/fr/panier", "fr")).toBe(false);
    expect(estAccueilDeLangue("/en", "fr")).toBe(false);
  });
});

describe("destinationApresConnexion", () => {
  beforeEach(() => Object.assign(faux, { role: null, roleErreur: false, session: "TEST_compte", acces: [], accesErreur: false }));

  it("un retour précis passe toujours avant, quel que soit le rôle", async () => {
    faux.role = "admin";
    expect(await destinationApresConnexion("/fr/panier", "fr")).toBe("/fr/panier");
  });

  it("sans retour précis : admin → /admin, assistant → Commandes, client → /compte", async () => {
    faux.role = "admin";
    expect(await destinationApresConnexion("/fr", "fr")).toBe("/fr/admin");
    faux.role = "assistant";
    expect(await destinationApresConnexion("/en", "en")).toBe("/en/admin/commandes");
    faux.role = null;
    expect(await destinationApresConnexion("/fr", "fr")).toBe("/fr/compte");
  });

  it("bénévole : Scan seulement avec un accès valide maintenant, sinon espace personnel", async () => {
    faux.role = null;
    faux.acces = [{ valide: false }, { valide: true }];
    expect(await destinationApresConnexion("/fr", "fr")).toBe("/fr/scan");
    faux.acces = [{ valide: false }];
    expect(await destinationApresConnexion("/fr", "fr")).toBe("/fr/compte");
    faux.accesErreur = true;
    expect(await destinationApresConnexion("/fr", "fr")).toBe("/fr/compte");
  });

  it("lecture du rôle impossible : espace personnel, jamais l'admin", async () => {
    faux.roleErreur = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await destinationApresConnexion("/fr", "fr")).toBe("/fr/compte");
  });

  it("sans session vérifiée : le retour tel quel", async () => {
    faux.session = null;
    expect(await destinationApresConnexion("/fr", "fr")).toBe("/fr");
  });
});
