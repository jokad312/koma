import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const faux = vi.hoisted(() => ({
  updateTag: vi.fn(),
  rpc: vi.fn(),
  deleteUser: vi.fn(),
}));
vi.mock("next/cache", () => ({ updateTag: faux.updateTag }));
vi.mock("@/lib/auth/droits", () => ({ exigerDroit: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({ rpc: faux.rpc, auth: { admin: { deleteUser: faux.deleteUser } } }),
}));

import { dependances } from "@/modules/admin/dependances";

const AUTEUR = { type: "compte" as const, id: "TEST_admin", role: "admin" as const };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("câblage réel de modules/admin", () => {
  it("invalider() vide l'étiquette « reglages »", () => {
    dependances().invalider();
    expect(faux.updateTag).toHaveBeenCalledWith("reglages");
  });

  it("ecrireReglage appelle enregistrer_reglage avec auteur, clé et valeur", async () => {
    faux.rpc.mockResolvedValue({ error: null });
    expect(await dependances().ecrireReglage({ auteur: AUTEUR, cle: "numero_whatsapp", valeur: "+243970000000" })).toEqual({ erreur: null });
    expect(faux.rpc).toHaveBeenCalledWith("enregistrer_reglage", { p_auteur: AUTEUR, p_cle: "numero_whatsapp", p_valeur: "+243970000000" });
  });

  it("ecrireReglage renvoie le message d'erreur de la base", async () => {
    faux.rpc.mockResolvedValue({ error: { message: "KS_DROIT_REFUSE" } });
    expect(await dependances().ecrireReglage({ auteur: AUTEUR, cle: "nom_site", valeur: "x" })).toEqual({ erreur: "KS_DROIT_REFUSE" });
  });

  it("corrigerAge : data === true devient supprimer", async () => {
    const deps = dependances();
    faux.rpc.mockResolvedValue({ data: true, error: null });
    expect(await deps.corrigerAge({ auteur: AUTEUR, compteId: "TEST_c", age: 12, raison: "raison" })).toEqual({ erreur: null, supprimer: true });
    expect(faux.rpc).toHaveBeenCalledWith("corriger_age", { p_auteur: AUTEUR, p_compte: "TEST_c", p_age: 12, p_raison: "raison" });
    faux.rpc.mockResolvedValue({ data: false, error: null });
    expect((await deps.corrigerAge({ auteur: AUTEUR, compteId: "TEST_c", age: 20, raison: "raison" })).supprimer).toBe(false);
    faux.rpc.mockResolvedValue({ data: null, error: { message: "KS_AGE_NON_DECLARE" } });
    expect(await deps.corrigerAge({ auteur: AUTEUR, compteId: "TEST_c", age: 20, raison: "raison" })).toEqual({ erreur: "KS_AGE_NON_DECLARE", supprimer: false });
  });
});
