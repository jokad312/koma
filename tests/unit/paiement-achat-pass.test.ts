// Story 7.4, règle 11 : une Commande de Pass ne part JAMAIS chez Polar (carte comme mobile money), même si MaishaPay est désactivé
// (alors « carte indisponible »), et le mobile money suit le repli entre Agrégateurs. Le type de la Commande est relu en base (lireAchat).
import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ rpc: vi.fn(), type: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    rpc: (...a: unknown[]) => faux.rpc(...a),
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => faux.type() }) }) }) }),
  }),
}));

import { choisirPrestataire, type EntreeAiguillage } from "@/modules/paiement/aiguillage";
import { lireAchat } from "@/modules/paiement/queries";
import { lireOptionsPaiement, type DependancesOptions } from "@/modules/paiement/service";
import type { Achat, CodePrestataire, Couverture, Prestataire } from "@/modules/paiement/types";

const TOUS: CodePrestataire[] = ["pawapay", "maishapay", "polar"];
const ORDRE: CodePrestataire[] = ["pawapay", "maishapay"];
const COUVERTURE: Couverture = [
  { prestataire: "pawapay", pays: "CD", operateur: "TEST_op_a" },
  { prestataire: "maishapay", pays: "CD", operateur: "TEST_op_a" },
];
const pass: Achat = { familles: [], estPass: true };

function entree(s: Partial<EntreeAiguillage>): EntreeAiguillage {
  return { achat: pass, moyen: "carte", pays: null, operateur: null, prestatairesActifs: TOUS, couverture: COUVERTURE, ordre: ORDRE, exclus: [], ...s };
}

function sousEnsembles<T>(liste: readonly T[]): T[][] {
  return liste.reduce<T[][]>((acc, x) => [...acc, ...acc.map((s) => [...s, x])], [[]]);
}

describe("aiguillage d'une Commande de Pass", () => {
  it("carte : MaishaPay s'il est actif, sinon « carte indisponible » ; jamais Polar, pour toute combinaison de Prestataires actifs", () => {
    for (const actifs of sousEnsembles(TOUS)) {
      const choix = choisirPrestataire(entree({ prestatairesActifs: actifs }));
      if (actifs.includes("maishapay")) expect(choix).toEqual({ statut: "ok", prestataire: "maishapay" });
      else expect(choix).toEqual({ statut: "indisponible", raison: "carte_indisponible" });
    }
  });

  it("MaishaPay désactivé, Polar actif : « carte indisponible », sans remplaçant", () => {
    expect(choisirPrestataire(entree({ prestatairesActifs: ["pawapay", "polar"] }))).toEqual({ statut: "indisponible", raison: "carte_indisponible" });
    expect(choisirPrestataire(entree({ prestatairesActifs: ["polar"] }))).toEqual({ statut: "indisponible", raison: "carte_indisponible" });
  });

  it("mobile money : Polar n'est jamais choisi, quel que soit l'ordre, la Couverture ou les Prestataires actifs", () => {
    const couverture: Couverture = [...COUVERTURE, { prestataire: "polar", pays: "CD", operateur: "TEST_op_a" }];
    for (const actifs of sousEnsembles(TOUS)) {
      const choix = choisirPrestataire(entree({ moyen: "mobile_money", pays: "CD", operateur: "TEST_op_a", prestatairesActifs: actifs, couverture, ordre: ["polar", ...ORDRE] }));
      expect(choix.statut === "ok" ? choix.prestataire : null).not.toBe("polar");
    }
  });

  it("repli : l'Agrégateur en échec côté Prestataire est exclu, le suivant du même couple est proposé ; tous exclus : indisponible", () => {
    const mm = (exclus: CodePrestataire[]) => choisirPrestataire(entree({ moyen: "mobile_money", pays: "CD", operateur: "TEST_op_a", exclus }));
    expect(mm([])).toEqual({ statut: "ok", prestataire: "pawapay" });
    expect(mm(["pawapay"])).toEqual({ statut: "ok", prestataire: "maishapay" });
    expect(mm(["pawapay", "maishapay"])).toEqual({ statut: "indisponible", raison: "mobile_money_indisponible" });
  });

  it("Agrégateur prioritaire désactivé : le suivant du même couple", () => {
    expect(choisirPrestataire(entree({ moyen: "mobile_money", pays: "CD", operateur: "TEST_op_a", prestatairesActifs: ["maishapay", "polar"] }))).toEqual({ statut: "ok", prestataire: "maishapay" });
  });
});

function p(code: CodePrestataire, s: Partial<Prestataire> = {}): Prestataire {
  const base: Record<CodePrestataire, Prestataire> = {
    pawapay: { code: "pawapay", nom: "TEST_PawaPay", type: "agregateur", mobileMoney: true, carte: false, actif: true, ordre: 1 },
    maishapay: { code: "maishapay", nom: "TEST_MaishaPay", type: "agregateur", mobileMoney: true, carte: true, actif: true, ordre: 2 },
    polar: { code: "polar", nom: "TEST_Polar", type: "carte", mobileMoney: false, carte: true, actif: true, ordre: null },
  };
  return { ...base[code], ...s };
}

function deps(prestataires: Prestataire[]): DependancesOptions {
  return {
    prestataires: vi.fn(async () => prestataires),
    achat: vi.fn(async (): Promise<Achat | null> => pass),
    couverture: vi.fn(async () => COUVERTURE),
    exclus: vi.fn(async () => []),
    adaptateursBranches: new Set<CodePrestataire>(["pawapay", "maishapay", "polar"]),
  };
}

describe("écran de choix du moyen de paiement d'une Commande de Pass", () => {
  it("carte via MaishaPay, mobile money via les Agrégateurs", async () => {
    const o = await lireOptionsPaiement(deps(TOUS.map((c) => p(c))), { commandeId: "00000000-0000-4000-8000-0000000000e1", compteId: "TEST_compte" });
    expect(o?.carte).toMatchObject({ disponible: true, prestataire: { code: "maishapay" } });
    expect(o?.mobileMoney.disponible).toBe(true);
  });

  it("MaishaPay désactivé : carte indisponible (jamais Polar) ; le mobile money reste proposé par PawaPay", async () => {
    const o = await lireOptionsPaiement(deps([p("pawapay"), p("maishapay", { actif: false }), p("polar")]), { commandeId: "00000000-0000-4000-8000-0000000000e1", compteId: "TEST_compte" });
    expect(o?.carte).toEqual({ disponible: false });
    expect(o?.mobileMoney.pays[0].operateurs.map((x) => x.agregateur)).toEqual(["TEST_PawaPay"]);
  });
});

describe("lireAchat : le type de la Commande vient de la base", () => {
  beforeEach(() => {
    faux.rpc.mockReset();
    faux.type.mockReset();
  });

  it("une Commande de type pass est un Pass, même sans aucune ligne de produit", async () => {
    faux.rpc.mockResolvedValue({ data: [], error: null });
    faux.type.mockResolvedValue({ data: { type: "pass" }, error: null });
    expect(await lireAchat("c", "compte")).toEqual({ familles: [], estPass: true });
  });

  it("une Commande de produits n'est pas un Pass", async () => {
    faux.rpc.mockResolvedValue({ data: ["cosplay"], error: null });
    faux.type.mockResolvedValue({ data: { type: "produits" }, error: null });
    expect(await lireAchat("c", "compte")).toEqual({ familles: ["cosplay"], estPass: false });
  });

  it("Commande d'un autre Compte : null (jamais d'achat inventé)", async () => {
    faux.rpc.mockResolvedValue({ data: null, error: null });
    faux.type.mockResolvedValue({ data: null, error: null });
    expect(await lireAchat("c", "autre")).toBeNull();
  });
});
