import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const faux = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  exigerDroit: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/service", () => ({ creerClientService: () => ({ rpc: faux.rpc, from: faux.from }) }));
vi.mock("@/lib/auth/droits", () => {
  class DroitRefuseError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  }
  return { DroitRefuseError, exigerDroit: faux.exigerDroit };
});

import { DroitRefuseError } from "@/lib/auth/droits";
import { dependancesCodePromo } from "@/modules/promo/dependances";
import { lireCodesPromoAdmin } from "@/modules/promo/queries";

const VALEURS = { affilie: "TEST_Affilié", reductionPct: 20, commissionPct: 5, plafond: 50, actif: true };

beforeEach(() => {
  vi.clearAllMocks();
  faux.rpc.mockResolvedValue({ data: null, error: null });
});

describe("dependancesCodePromo : noms des fonctions et des paramètres", () => {
  it("creer appelle creer_code_promo avec les paramètres p_*", async () => {
    await expect(dependancesCodePromo().creer({ type: "TEST" }, "SOLDES10", VALEURS)).resolves.toEqual({ erreur: null });
    expect(faux.rpc).toHaveBeenCalledWith("creer_code_promo", {
      p_auteur: { type: "TEST" },
      p_code: "SOLDES10",
      p_affilie: "TEST_Affilié",
      p_reduction_pct: 20,
      p_commission_pct: 5,
      p_plafond: 50,
      p_actif: true,
    });
  });

  it("modifier appelle modifier_code_promo avec l'identifiant, sans code", async () => {
    await dependancesCodePromo().modifier({ type: "TEST" }, "id-1", { ...VALEURS, actif: false });
    expect(faux.rpc).toHaveBeenCalledWith("modifier_code_promo", {
      p_auteur: { type: "TEST" },
      p_id: "id-1",
      p_affilie: "TEST_Affilié",
      p_reduction_pct: 20,
      p_commission_pct: 5,
      p_plafond: 50,
      p_actif: false,
    });
  });

  it("l'erreur de la base est rendue en texte pour être traduite par le service", async () => {
    faux.rpc.mockResolvedValue({ data: null, error: { message: "KS_CODE_EXISTANT" } });
    await expect(dependancesCodePromo().creer({}, "X1Y", VALEURS)).resolves.toEqual({ erreur: "KS_CODE_EXISTANT" });
  });
});

describe("dependancesCodePromo : droit", () => {
  it("demande le droit codes_promo.gerer et rend l'auteur", async () => {
    faux.exigerDroit.mockResolvedValue({ compteId: "c", auteur: { type: "compte" } });
    await expect(dependancesCodePromo().exigerDroit()).resolves.toMatchObject({ auteur: { type: "compte" } });
    expect(faux.exigerDroit).toHaveBeenCalledWith("codes_promo.gerer");
  });

  it("droit refusé ou non connecté : null ; toute autre exception (panne) est relancée", async () => {
    faux.exigerDroit.mockRejectedValueOnce(new DroitRefuseError("KS_DROIT_REFUSE"));
    await expect(dependancesCodePromo().exigerDroit()).resolves.toBeNull();
    faux.exigerDroit.mockRejectedValueOnce(new DroitRefuseError("KS_NON_CONNECTE"));
    await expect(dependancesCodePromo().exigerDroit()).resolves.toBeNull();
    faux.exigerDroit.mockRejectedValueOnce(new Error("TEST_panne"));
    await expect(dependancesCodePromo().exigerDroit()).rejects.toThrow("TEST_panne");
  });
});

describe("lireCodesPromoAdmin", () => {
  const ligne = {
    id: "i1",
    code: "SOLDES10",
    affilie: "TEST_A",
    reduction_pct: "20.00",
    commission_pct: "5.50",
    plafond: 50,
    actif: true,
    cree_le: "2026-11-04T10:00:00Z",
    modifie_le: "2026-11-04T10:00:00Z",
  };
  function lecture(resultat: { data: unknown; error: { message: string } | null }) {
    const order = vi.fn(async () => resultat);
    faux.from.mockReturnValue({ select: () => ({ order }) });
    return order;
  }

  it("lit code_promo trié par code croissant et convertit les pourcentages en nombres", async () => {
    const order = lecture({ data: [ligne], error: null });
    await expect(lireCodesPromoAdmin()).resolves.toEqual([
      { id: "i1", code: "SOLDES10", affilie: "TEST_A", reductionPct: 20, commissionPct: 5.5, plafond: 50, actif: true, creeLe: ligne.cree_le, modifieLe: ligne.modifie_le },
    ]);
    expect(faux.from).toHaveBeenCalledWith("code_promo");
    expect(order).toHaveBeenCalledWith("code", { ascending: true });
  });

  it("aucune ligne : liste vide ; erreur de lecture : relancée, jamais une liste vide", async () => {
    lecture({ data: null, error: null });
    await expect(lireCodesPromoAdmin()).resolves.toEqual([]);
    lecture({ data: null, error: { message: "TEST" } });
    await expect(lireCodesPromoAdmin()).rejects.toThrow();
  });
});

describe("messages Admin.codesPromo", () => {
  const cles = (o: unknown, p = ""): string[] =>
    Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => (typeof v === "object" && v !== null ? cles(v, `${p}${k}.`) : [`${p}${k}`]));

  it("mêmes clés en français et en anglais", () => {
    expect(cles(en.Admin.codesPromo).sort()).toEqual(cles(fr.Admin.codesPromo).sort());
  });

  it("aucun texte à fournir ne reste dans les deux langues", () => {
    expect(JSON.stringify(fr.Admin.codesPromo)).not.toContain("[Texte à fournir]");
    expect(JSON.stringify(en.Admin.codesPromo)).not.toContain("[Texte à fournir]");
  });

  it("chaque erreur du module a son message", () => {
    for (const erreur of ["non_autorise", "code_invalide", "code_existant", "affilie_invalide", "reduction_invalide", "commission_invalide", "plafond_invalide", "introuvable", "generique"]) {
      expect(Object.keys(fr.Admin.codesPromo.erreurs)).toContain(erreur);
      expect(Object.keys(en.Admin.codesPromo.erreurs)).toContain(erreur);
    }
  });
});
