import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ session: vi.fn(), role: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/compte", () => ({ lireSessionVerifiee: () => faux.session() }));
vi.mock("@/lib/auth/droits", () => ({ lireRole: (id: string) => faux.role(id) }));

import { estAdminConnecte } from "@/lib/auth/est-admin";

beforeEach(() => {
  faux.session.mockReset();
  faux.role.mockReset();
});

describe("estAdminConnecte (lien « Administration » du menu public)", () => {
  it("rôle admin : oui", async () => {
    faux.session.mockResolvedValue({ compteId: "TEST-ADMIN" });
    faux.role.mockResolvedValue("admin");
    expect(await estAdminConnecte()).toBe(true);
    expect(faux.role).toHaveBeenCalledWith("TEST-ADMIN");
  });

  it.each(["assistant", "benevole", null])("rôle %s (ou client sans rôle) : non", async (role) => {
    faux.session.mockResolvedValue({ compteId: "TEST" });
    faux.role.mockResolvedValue(role);
    expect(await estAdminConnecte()).toBe(false);
  });

  it("visiteur sans session : non, le rôle n'est même pas lu", async () => {
    faux.session.mockResolvedValue(null);
    expect(await estAdminConnecte()).toBe(false);
    expect(faux.role).not.toHaveBeenCalled();
  });

  it("lecture du rôle impossible : non (jamais un faux oui)", async () => {
    faux.session.mockResolvedValue({ compteId: "TEST" });
    faux.role.mockRejectedValue(new Error("KS_VERIFICATION_IMPOSSIBLE"));
    expect(await estAdminConnecte()).toBe(false);
  });

  it("session illisible : non", async () => {
    faux.session.mockRejectedValue(new Error("supabase indisponible"));
    expect(await estAdminConnecte()).toBe(false);
  });
});
