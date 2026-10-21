import { describe, expect, it } from "vitest";
import { lireReglagePublic, ReglageManquantError } from "./reglages";

// Faux client nommé comme tel (règle 13) : jamais utilisé hors des tests.
function TEST_fauxClient(reponse: { data: { valeur: string | null } | null; error: { message: string } | null }) {
  return {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => reponse }) }) }),
  };
}

describe("lireReglagePublic", () => {
  it("renvoie la valeur du réglage", async () => {
    const client = TEST_fauxClient({ data: { valeur: "TEST_NOM" }, error: null });
    await expect(lireReglagePublic(client, "nom_site")).resolves.toBe("TEST_NOM");
  });
  it("lève KS_REGLAGE_MANQUANT si la ligne est absente", async () => {
    const client = TEST_fauxClient({ data: null, error: null });
    await expect(lireReglagePublic(client, "nom_site")).rejects.toMatchObject({ code: "KS_REGLAGE_MANQUANT" });
  });
  it("lève KS_REGLAGE_MANQUANT si la valeur est vide, sans valeur de repli", async () => {
    const client = TEST_fauxClient({ data: { valeur: "  " }, error: null });
    await expect(lireReglagePublic(client, "nom_site")).rejects.toBeInstanceOf(ReglageManquantError);
  });
  it("propage une erreur de lecture", async () => {
    const client = TEST_fauxClient({ data: null, error: { message: "boom" } });
    await expect(lireReglagePublic(client, "nom_site")).rejects.toThrow(/boom/);
  });
});
