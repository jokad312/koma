// Story 9.3 : lireCodesPromoAdmin joint la vue commission_code_promo ; un code absent de la vue vaut 0 ; une erreur de lecture n'est jamais masquée.
import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ codes: { data: [] as unknown[], error: null as unknown }, ventes: { data: [] as unknown[], error: null as unknown } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    from: (table: string) =>
      table === "code_promo"
        ? { select: () => ({ order: async () => faux.codes }) }
        : { select: async () => (table === "commission_code_promo" ? faux.ventes : { data: null, error: { message: "table inattendue" } }) },
  }),
}));

import { lireCodesPromoAdmin } from "@/modules/promo/queries";

const ligne = (id: string, code: string) => ({
  id,
  code,
  affilie: "TEST_Affilie",
  reduction_pct: "10.00",
  commission_pct: "5.00",
  plafond: 50,
  actif: true,
  cree_le: "2026-11-08T10:00:00Z",
  modifie_le: "2026-11-08T10:00:00Z",
});

beforeEach(() => {
  faux.codes = { data: [ligne("TEST_id1", "AAA"), ligne("TEST_id2", "BBB")], error: null };
  faux.ventes = { data: [{ code_promo_id: "TEST_id1", ventes: 2, montant_cents: "10782", commission_cents: "538" }], error: null };
});

describe("lireCodesPromoAdmin (story 9.3)", () => {
  it("reprend ventes, montant et commission de la vue (bigint lus en texte)", async () => {
    const [a, b] = await lireCodesPromoAdmin();
    expect(a).toMatchObject({ code: "AAA", ventes: 2, montantCents: 10782, commissionCents: 538 });
    expect(b).toMatchObject({ code: "BBB", ventes: 0, montantCents: 0, commissionCents: 0 });
  });

  it("une erreur de lecture de la vue est relancée, jamais remplacée par des zéros", async () => {
    faux.ventes = { data: [], error: { message: "panne" } };
    await expect(lireCodesPromoAdmin()).rejects.toThrow();
  });
});
