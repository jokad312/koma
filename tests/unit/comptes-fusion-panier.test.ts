import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { terminerGoogle, verifierCode } from "@/modules/comptes/service";
import { creerTestDependances, TEST_COMPTE_ID } from "../doubles/TEST_dependances-comptes";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const code = { email: "a@b.cd", code: "123456", langue: "fr" as const };

// Story 4.2 : le Panier du visiteur suit le Compte, sans jamais bloquer ni retarder à tort la connexion.
describe("fusion du Panier à la connexion", () => {
  it("code email : fusion demandée pour le Compte connecté, après la vérification réussie", async () => {
    const { deps } = creerTestDependances({ complet: true, questionsVues: true });
    const fusion = vi.fn(async () => {});
    deps.fusionnerPanier = fusion;
    await expect(verifierCode(deps, code)).resolves.toMatchObject({ ok: true });
    expect(fusion).toHaveBeenCalledWith(TEST_COMPTE_ID);
  });

  it("code faux : aucune fusion", async () => {
    const { deps } = creerTestDependances({ verification: { name: "AuthApiError", status: 403, code: "otp_expired" } });
    const fusion = vi.fn(async () => {});
    deps.fusionnerPanier = fusion;
    await verifierCode(deps, code);
    expect(fusion).not.toHaveBeenCalled();
  });

  it("Google : fusion demandée aussi", async () => {
    const { deps } = creerTestDependances({ complet: true, questionsVues: true });
    const fusion = vi.fn(async () => {});
    deps.fusionnerPanier = fusion;
    await expect(terminerGoogle(deps, { code: "TEST_code", langue: "fr", retour: "/fr" })).resolves.toMatchObject({ ok: true });
    expect(fusion).toHaveBeenCalledWith(TEST_COMPTE_ID);
  });

  it("une fusion qui échoue ne bloque jamais la connexion", async () => {
    const { deps } = creerTestDependances({ complet: true, questionsVues: true });
    deps.fusionnerPanier = vi.fn(async () => {
      throw new Error("base indisponible");
    });
    await expect(verifierCode(deps, code)).resolves.toEqual({ ok: true, etape: "termine", retour: "/fr" });
    await expect(terminerGoogle(deps, { code: "TEST_code", langue: "fr", retour: "/fr" })).resolves.toMatchObject({ ok: true });
  });

  it("sans fusion fournie, la connexion se fait comme avant", async () => {
    const { deps } = creerTestDependances({ complet: true, questionsVues: true });
    await expect(verifierCode(deps, code)).resolves.toMatchObject({ ok: true });
  });
});
