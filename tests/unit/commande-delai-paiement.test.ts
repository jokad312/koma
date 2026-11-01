import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formaterDateHeureBoutique, FUSEAU_BOUTIQUE } from "@/lib/dates";
import { enregistrerReglage } from "@/modules/admin/service";
import { statutEffectif } from "@/modules/commande/queries";
import { creerTestDependancesAdmin } from "../doubles/TEST_dependances-admin";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ creerClientService: () => ({}) }));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("réglage delai_paiement (Q-B4)", () => {
  it("un entier de 1 à 1440 minutes est enregistré tel quel", async () => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "delai_paiement", valeur: " 45 " })).toEqual({ ok: true, valeur: "45" });
    expect(appels.reglages).toMatchObject([{ cle: "delai_paiement", valeur: "45" }]);
    expect(await enregistrerReglage(deps, { cle: "delai_paiement", valeur: "1440" })).toEqual({ ok: true, valeur: "1440" });
  });

  it("vide : effacé (null), aucune valeur de repli", async () => {
    const { deps } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "delai_paiement", valeur: "  " })).toEqual({ ok: true, valeur: null });
  });

  it.each(["0", "1441", "-5", "12.5", "abc", "30 min"])("refuse %s", async (valeur) => {
    const { deps, appels } = creerTestDependancesAdmin();
    expect(await enregistrerReglage(deps, { cle: "delai_paiement", valeur })).toEqual({ ok: false, erreur: "delai_paiement_invalide" });
    expect(appels.reglages).toEqual([]);
  });
});

describe("heure de la boutique", () => {
  it("affiche l'heure de Goma (UTC+2) quel que soit l'appareil", () => {
    expect(FUSEAU_BOUTIQUE).toBe("Africa/Lubumbashi");
    expect(formaterDateHeureBoutique("2026-11-01T12:30:00Z", "fr")).toBe("01/11/2026 14:30");
    expect(formaterDateHeureBoutique(new Date("2026-11-01T22:30:00Z"), "en")).toBe("02/11/2026, 00:30");
  });
  it("une date absente ou invalide donne null", () => {
    expect(formaterDateHeureBoutique(null, "fr")).toBeNull();
    expect(formaterDateHeureBoutique("pas une date", "fr")).toBeNull();
  });
});

describe("statut affiché d'une Commande", () => {
  const maintenant = Date.parse("2026-11-01T12:00:00Z");
  it("en attente dont l'échéance est passée : expirée, même avant la tâche planifiée", () => {
    expect(statutEffectif("en_attente", "2026-11-01T11:59:59Z", maintenant)).toBe("expiree");
    expect(statutEffectif("echouee", "2026-11-01T11:00:00Z", maintenant)).toBe("expiree");
  });
  it("en attente avant l'échéance, ou payée : inchangé", () => {
    expect(statutEffectif("en_attente", "2026-11-01T12:30:00Z", maintenant)).toBe("en_attente");
    expect(statutEffectif("payee", "2026-11-01T11:00:00Z", maintenant)).toBe("payee");
    expect(statutEffectif("livree", null, maintenant)).toBe("livree");
  });
  it("un statut inconnu n'est jamais affiché", () => {
    expect(statutEffectif("magique", null, maintenant)).toBeNull();
  });
});
