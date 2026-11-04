import { describe, expect, it, vi } from "vitest";
import {
  creerCodePromo,
  modifierCodePromo,
  validerCodePromo,
  validerModificationCodePromo,
} from "@/modules/promo/codes";
import type { DependancesCodePromo } from "@/modules/promo/types";

const ID = "00000000-0000-4000-8000-0000000000d1";
const ENTREE = {
  code: " soldes10 ",
  affilie: " TEST_Affilié ",
  reductionPct: "20",
  commissionPct: "5",
  plafond: "",
  actif: true,
};

function deps(s: Partial<DependancesCodePromo> = {}): DependancesCodePromo {
  return {
    exigerDroit: vi.fn(async () => ({ auteur: "TEST_auteur" })),
    creer: vi.fn(async () => ({ erreur: null })),
    modifier: vi.fn(async () => ({ erreur: null })),
    ...s,
  };
}

describe("validerCodePromo : code normalisé, plafond par défaut à 50", () => {
  it("met le code en majuscules, nettoie l'Affilié et applique le plafond de 50", () => {
    expect(validerCodePromo(ENTREE)).toEqual({
      ok: true,
      code: "SOLDES10",
      valeurs: { affilie: "TEST_Affilié", reductionPct: 20, commissionPct: 5, plafond: 50, actif: true },
    });
  });

  it("accepte la virgule décimale et les pourcentages à deux décimales", () => {
    const v = validerCodePromo({ ...ENTREE, reductionPct: "12,5", commissionPct: "0.75", plafond: "100000" });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.valeurs).toMatchObject({ reductionPct: 12.5, commissionPct: 0.75, plafond: 100000 });
  });

  it("refuse un code vide, trop court, trop long, accentué ou avec un espace", () => {
    for (const code of ["", "ab", "a".repeat(25), "été", "a b", "code!", "SOLDES 10"]) {
      expect(validerCodePromo({ ...ENTREE, code })).toEqual({ ok: false, erreur: "code_invalide" });
    }
  });

  it("accepte les tirets et les soulignés dans le code", () => {
    for (const code of ["abc", "SOLDES-10", "TEST_2026", "a1_-b2"]) {
      expect(validerCodePromo({ ...ENTREE, code }).ok).toBe(true);
    }
  });

  it("refuse un Affilié vide, fait d'espaces ou trop long", () => {
    for (const affilie of ["", "   ", "a".repeat(121)]) {
      expect(validerCodePromo({ ...ENTREE, affilie })).toEqual({ ok: false, erreur: "affilie_invalide" });
    }
  });

  it("refuse une réduction nulle, négative, au-delà de 100 ou à plus de deux décimales", () => {
    for (const reductionPct of ["0", "-1", "101", "12.345", "", "abc", "1e2"]) {
      expect(validerCodePromo({ ...ENTREE, reductionPct })).toEqual({ ok: false, erreur: "reduction_invalide" });
    }
    expect(validerCodePromo({ ...ENTREE, reductionPct: "100" }).ok).toBe(true);
  });

  it("refuse une commission négative, au-delà de 100 ou à plus de deux décimales ; 0 est permis", () => {
    for (const commissionPct of ["-1", "101", "5.555", "", "abc"]) {
      expect(validerCodePromo({ ...ENTREE, commissionPct })).toEqual({ ok: false, erreur: "commission_invalide" });
    }
    expect(validerCodePromo({ ...ENTREE, commissionPct: "0" }).ok).toBe(true);
  });

  it("refuse un plafond hors bornes ou non entier", () => {
    for (const plafond of ["0", "-3", "100001", "1.5", "abc"]) {
      expect(validerCodePromo({ ...ENTREE, plafond })).toEqual({ ok: false, erreur: "plafond_invalide" });
    }
    expect(validerCodePromo({ ...ENTREE, plafond: "1" }).ok).toBe(true);
  });
});

describe("validerModificationCodePromo : le code ne fait pas partie de la saisie", () => {
  it("valide les mêmes valeurs sans code", () => {
    const v = validerModificationCodePromo({ affilie: " TEST ", reductionPct: "10", commissionPct: "2", plafond: "3", actif: false });
    expect(v).toEqual({ ok: true, valeurs: { affilie: "TEST", reductionPct: 10, commissionPct: 2, plafond: 3, actif: false } });
  });

  it("n'applique pas le plafond par défaut à une modification : vide est refusé", () => {
    expect(validerModificationCodePromo({ affilie: "TEST", reductionPct: "10", commissionPct: "2", plafond: "", actif: true })).toEqual({
      ok: false,
      erreur: "plafond_invalide",
    });
  });
});

describe("creerCodePromo", () => {
  it("une saisie invalide est refusée avant de vérifier le droit", async () => {
    const d = deps();
    await expect(creerCodePromo(d, { ...ENTREE, code: "ab" })).resolves.toEqual({ ok: false, erreur: "code_invalide" });
    expect(d.exigerDroit).not.toHaveBeenCalled();
    expect(d.creer).not.toHaveBeenCalled();
  });

  it("droit refusé : non_autorise, aucune écriture", async () => {
    const d = deps({ exigerDroit: vi.fn(async () => Promise.reject(new Error("TEST_refus"))) });
    await expect(creerCodePromo(d, ENTREE)).resolves.toEqual({ ok: false, erreur: "non_autorise" });
    expect(d.creer).not.toHaveBeenCalled();
  });

  it("transmet l'auteur, le code normalisé et les valeurs validées", async () => {
    const d = deps();
    await expect(creerCodePromo(d, ENTREE)).resolves.toEqual({ ok: true });
    expect(d.creer).toHaveBeenCalledWith("TEST_auteur", "SOLDES10", {
      affilie: "TEST_Affilié",
      reductionPct: 20,
      commissionPct: 5,
      plafond: 50,
      actif: true,
    });
  });

  it("code déjà pris, casse comprise : code_existant", async () => {
    const d = deps({ creer: vi.fn(async () => ({ erreur: "KS_CODE_EXISTANT" })) });
    await expect(creerCodePromo(d, ENTREE)).resolves.toEqual({ ok: false, erreur: "code_existant" });
  });

  it("chaque erreur de la base trouve son message", async () => {
    const cas: Array<[string, string]> = [
      ["KS_DROIT_REFUSE", "non_autorise"],
      ["KS_AUTEUR_MANQUANT", "non_autorise"],
      ["KS_CODE_INVALIDE", "code_invalide"],
      ["KS_AFFILIE_INVALIDE", "affilie_invalide"],
      ["KS_REDUCTION_INVALIDE", "reduction_invalide"],
      ["KS_COMMISSION_INVALIDE", "commission_invalide"],
      ["KS_PLAFOND_INVALIDE", "plafond_invalide"],
      ["KS_INCONNU", "generique"],
    ];
    for (const [base, attendu] of cas) {
      const d = deps({ creer: vi.fn(async () => ({ erreur: base })) });
      await expect(creerCodePromo(d, ENTREE)).resolves.toEqual({ ok: false, erreur: attendu });
    }
  });

  it("exception inattendue : erreur générique, aucune donnée dans le journal", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d = deps({ creer: vi.fn(async () => Promise.reject(new Error("TEST_secret"))) });
    await expect(creerCodePromo(d, ENTREE)).resolves.toEqual({ ok: false, erreur: "generique" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("TEST_secret");
    spy.mockRestore();
  });
});

describe("modifierCodePromo", () => {
  const MODIF = { affilie: "TEST_nouveau", reductionPct: "15", commissionPct: "3", plafond: "80", actif: false };

  it("identifiant invalide : introuvable, sans écrire", async () => {
    const d = deps();
    await expect(modifierCodePromo(d, "pas-un-uuid", MODIF)).resolves.toEqual({ ok: false, erreur: "introuvable" });
    expect(d.modifier).not.toHaveBeenCalled();
  });

  it("transmet l'auteur, l'identifiant et les valeurs validées", async () => {
    const d = deps();
    await expect(modifierCodePromo(d, ID, MODIF)).resolves.toEqual({ ok: true });
    expect(d.modifier).toHaveBeenCalledWith("TEST_auteur", ID, {
      affilie: "TEST_nouveau",
      reductionPct: 15,
      commissionPct: 3,
      plafond: 80,
      actif: false,
    });
  });

  it("droit refusé ou code introuvable", async () => {
    const refuse = deps({ exigerDroit: vi.fn(async () => Promise.reject(new Error("TEST_refus"))) });
    await expect(modifierCodePromo(refuse, ID, MODIF)).resolves.toEqual({ ok: false, erreur: "non_autorise" });
    const absent = deps({ modifier: vi.fn(async () => ({ erreur: "KS_CODE_PROMO_INTROUVABLE" })) });
    await expect(modifierCodePromo(absent, ID, MODIF)).resolves.toEqual({ ok: false, erreur: "introuvable" });
  });

  it("exception inattendue : erreur générique", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d = deps({ modifier: vi.fn(async () => Promise.reject(new Error("TEST_secret"))) });
    await expect(modifierCodePromo(d, ID, MODIF)).resolves.toEqual({ ok: false, erreur: "generique" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("TEST_secret");
    spy.mockRestore();
  });
});
