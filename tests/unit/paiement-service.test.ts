import { describe, expect, it, vi } from "vitest";
import { ADAPTATEURS_BRANCHES, adaptateurBranche } from "@/modules/paiement/registre";
import {
  changerEtatPrestataire,
  deplacerPrestataire,
  lireOptionsPaiement,
  moyensActifs,
  type DependancesAdminPaiement,
  type DependancesOptions,
} from "@/modules/paiement/service";
import type { Achat, CodePrestataire, Prestataire } from "@/modules/paiement/types";

const COMMANDE = "00000000-0000-4000-8000-0000000000e1";

function p(code: CodePrestataire, s: Partial<Prestataire> = {}): Prestataire {
  const base: Record<CodePrestataire, Prestataire> = {
    pawapay: { code: "pawapay", nom: "TEST_PawaPay", type: "agregateur", mobileMoney: true, carte: false, actif: true, ordre: 1 },
    kpay: { code: "kpay", nom: "TEST_K-Pay", type: "agregateur", mobileMoney: true, carte: true, actif: true, ordre: 2 },
    maishapay: { code: "maishapay", nom: "TEST_MaishaPay", type: "agregateur", mobileMoney: true, carte: false, actif: true, ordre: 3 },
    polar: { code: "polar", nom: "TEST_Polar", type: "carte", mobileMoney: false, carte: true, actif: true, ordre: null },
  };
  return { ...base[code], ...s };
}
const TOUS = (s: Partial<Prestataire> = {}) => (["pawapay", "kpay", "maishapay", "polar"] as const).map((c) => p(c, s));
const BRANCHES = new Set<CodePrestataire>(["pawapay", "kpay", "maishapay", "polar"]);

function depsOptions(s: Partial<DependancesOptions> = {}): DependancesOptions {
  return {
    prestataires: vi.fn(async () => TOUS()),
    achat: vi.fn(async (): Promise<Achat | null> => ({ familles: ["cosplay"], estPass: false })),
    couverture: vi.fn(async () => []),
    exclus: vi.fn(async () => []),
    adaptateursBranches: BRANCHES,
    ...s,
  };
}

describe("lireOptionsPaiement", () => {
  it("lit l'achat en base pour ce Compte : jamais ce que le navigateur annonce (règle 11)", async () => {
    const deps = depsOptions();
    await lireOptionsPaiement(deps, { commandeId: COMMANDE, compteId: "TEST_compte" });
    expect(deps.achat).toHaveBeenCalledWith(COMMANDE, "TEST_compte");
  });
  it("Famille envoyée par le navigateur ignorée : une Commande de cosplay reste chez K-Pay même si l'appelant parle de Kits", async () => {
    // L'entrée n'a aucun champ de Famille : seule la base décide.
    const deps = depsOptions({ achat: vi.fn(async () => ({ familles: ["cosplay", "kit"] as const, estPass: false })) });
    const r = await lireOptionsPaiement(deps, { commandeId: COMMANDE, compteId: "TEST_compte", familles: ["kit"] } as never);
    expect(r?.carte).toEqual({ disponible: true, prestataire: { code: "kpay", nom: "TEST_K-Pay" } });
  });
  it("Panier 100 % Kits : carte chez Polar ; mixte ou physique : K-Pay", async () => {
    const kits = depsOptions({ achat: vi.fn(async () => ({ familles: ["kit"] as const, estPass: false })) });
    expect((await lireOptionsPaiement(kits, { commandeId: COMMANDE, compteId: "c" }))?.carte).toEqual({ disponible: true, prestataire: { code: "polar", nom: "TEST_Polar" } });
    const mixte = depsOptions({ achat: vi.fn(async () => ({ familles: ["kit", "accessoire"] as const, estPass: false })) });
    expect((await lireOptionsPaiement(mixte, { commandeId: COMMANDE, compteId: "c" }))?.carte).toMatchObject({ prestataire: { code: "kpay" } });
  });
  it("Pass : K-Pay, jamais Polar", async () => {
    const deps = depsOptions({ achat: vi.fn(async () => ({ familles: [] as const, estPass: true })) });
    expect((await lireOptionsPaiement(deps, { commandeId: COMMANDE, compteId: "c" }))?.carte).toMatchObject({ prestataire: { code: "kpay" } });
  });
  it("Polar actif seul pour un Panier mixte : carte indisponible, sans substitution", async () => {
    const deps = depsOptions({ prestataires: vi.fn(async () => TOUS().map((x) => ({ ...x, actif: x.code === "polar" }))), achat: vi.fn(async () => ({ familles: ["cosplay", "kit"] as const, estPass: false })) });
    expect((await lireOptionsPaiement(deps, { commandeId: COMMANDE, compteId: "c" }))?.carte).toEqual({ disponible: false });
  });
  it("sans Couverture saisie, le mobile money n'est jamais proposé", async () => {
    const r = await lireOptionsPaiement(depsOptions(), { commandeId: COMMANDE, compteId: "c" });
    expect(r?.mobileMoney).toEqual({ disponible: false, pays: [] });
  });
  it("avec une Couverture d'un Agrégateur actif, le mobile money est proposé ; désactivé, il ne l'est plus", async () => {
    const couverture = vi.fn(async () => [{ prestataire: "pawapay" as const, pays: "TZ", operateur: "TEST_op" }]);
    expect((await lireOptionsPaiement(depsOptions({ couverture }), { commandeId: COMMANDE, compteId: "c" }))?.mobileMoney).toEqual({ disponible: true, pays: [{ code: "TZ", operateurs: [{ nom: "TEST_op", agregateur: "TEST_PawaPay" }] }] });
    const inactif = depsOptions({ couverture, prestataires: vi.fn(async () => TOUS().map((x) => ({ ...x, actif: x.code !== "pawapay" }))) });
    expect((await lireOptionsPaiement(inactif, { commandeId: COMMANDE, compteId: "c" }))?.mobileMoney).toEqual({ disponible: false, pays: [] });
  });
  it("un Prestataire actif en base dont l'adaptateur n'est pas branché n'est jamais proposé", async () => {
    const deps = depsOptions({ adaptateursBranches: new Set<CodePrestataire>() });
    const r = await lireOptionsPaiement(deps, { commandeId: COMMANDE, compteId: "c" });
    expect(r?.carte).toEqual({ disponible: false });
  });
  it("Commande d'un autre Compte, inconnue ou identifiant invalide : null, rien n'est révélé", async () => {
    expect(await lireOptionsPaiement(depsOptions({ achat: vi.fn(async () => null) }), { commandeId: COMMANDE, compteId: "c" })).toBeNull();
    const deps = depsOptions();
    expect(await lireOptionsPaiement(deps, { commandeId: "pas-un-uuid", compteId: "c" })).toBeNull();
    expect(deps.achat).not.toHaveBeenCalled();
  });
});

describe("lireOptionsPaiement : pays et opérateurs du mobile money", () => {
  const couverture = vi.fn(async () => [
    { prestataire: "pawapay" as const, pays: "TZ", operateur: "TEST_b" },
    { prestataire: "kpay" as const, pays: "TZ", operateur: "TEST_b" },
    { prestataire: "kpay" as const, pays: "TZ", operateur: "test_B" },
    { prestataire: "kpay" as const, pays: "KE", operateur: "TEST_a" },
    { prestataire: "maishapay" as const, pays: "UG", operateur: "TEST_c" },
  ]);
  it("l'union des couples des Agrégateurs actifs, un opérateur une seule fois (sans distinction de casse), triés, avec l'Agrégateur que le serveur retiendra", async () => {
    const r = await lireOptionsPaiement(depsOptions({ couverture }), { commandeId: COMMANDE, compteId: "c" });
    expect(r?.mobileMoney.pays).toEqual([
      { code: "KE", operateurs: [{ nom: "TEST_a", agregateur: "TEST_K-Pay" }] },
      { code: "TZ", operateurs: [{ nom: "TEST_b", agregateur: "TEST_PawaPay" }] },
      { code: "UG", operateurs: [{ nom: "TEST_c", agregateur: "TEST_MaishaPay" }] },
    ]);
  });
  it("un Agrégateur désactivé disparaît : son pays n'est plus proposé", async () => {
    const d = depsOptions({ couverture, prestataires: vi.fn(async () => TOUS().map((x) => ({ ...x, actif: x.code !== "maishapay" }))) });
    expect((await lireOptionsPaiement(d, { commandeId: COMMANDE, compteId: "c" }))?.mobileMoney.pays.map((x) => x.code)).toEqual(["KE", "TZ"]);
  });
  it("après un échec de PawaPay, le Prestataire affiché est le suivant du même couple", async () => {
    const d = depsOptions({ couverture, exclus: vi.fn(async () => ["pawapay" as const]) });
    const tz = (await lireOptionsPaiement(d, { commandeId: COMMANDE, compteId: "c" }))?.mobileMoney.pays.find((x) => x.code === "TZ");
    expect(tz?.operateurs[0].agregateur).toBe("TEST_K-Pay");
  });
});

describe("moyensActifs (pied de page)", () => {
  it("liste les moyens des Prestataires actifs seulement, dans l'ordre de priorité", () => {
    const r = moyensActifs([p("polar"), p("kpay"), p("maishapay", { actif: false }), p("pawapay")], BRANCHES);
    expect(r.map((x) => x.code)).toEqual(["pawapay", "kpay", "polar"]);
    expect(r.find((x) => x.code === "kpay")?.moyens).toEqual(["mobile_money", "carte"]);
    expect(r.find((x) => x.code === "polar")?.moyens).toEqual(["carte"]);
  });
  it("aucun Prestataire inactif ni sans adaptateur", () => {
    expect(moyensActifs(TOUS({ actif: false }), BRANCHES)).toEqual([]);
    expect(moyensActifs(TOUS(), new Set())).toEqual([]);
  });
});

describe("registre des adaptateurs", () => {
  it("aucun adaptateur n'est branché avant les stories des adaptateurs (rien n'est simulé)", () => {
    expect(ADAPTATEURS_BRANCHES.size).toBe(0);
    expect(adaptateurBranche("kpay")).toBe(false);
  });
});

function depsAdmin(s: Partial<DependancesAdminPaiement> = {}): DependancesAdminPaiement {
  return {
    exigerDroit: vi.fn(async () => ({ auteur: "TEST_auteur" })),
    definirActif: vi.fn(async () => ({ erreur: null })),
    deplacer: vi.fn(async () => ({ erreur: null })),
    invalider: vi.fn(async () => undefined),
    adaptateursBranches: BRANCHES,
    ...s,
  };
}

describe("changerEtatPrestataire", () => {
  it("active un Prestataire dont l'adaptateur est branché, journalisé par la base, puis invalide le cache", async () => {
    const deps = depsAdmin();
    await expect(changerEtatPrestataire(deps, { code: "kpay", actif: true })).resolves.toEqual({ ok: true });
    expect(deps.definirActif).toHaveBeenCalledWith("TEST_auteur", "kpay", true);
    expect(deps.invalider).toHaveBeenCalledTimes(1);
  });
  it("refuse d'activer un Prestataire sans adaptateur (rien n'est écrit)", async () => {
    const deps = depsAdmin({ adaptateursBranches: new Set() });
    await expect(changerEtatPrestataire(deps, { code: "kpay", actif: true })).resolves.toEqual({ ok: false, erreur: "adaptateur_absent" });
    expect(deps.definirActif).not.toHaveBeenCalled();
  });
  it("désactiver est toujours permis, même sans adaptateur", async () => {
    const deps = depsAdmin({ adaptateursBranches: new Set() });
    await expect(changerEtatPrestataire(deps, { code: "kpay", actif: false })).resolves.toEqual({ ok: true });
  });
  it("sans droit : refus, rien n'est écrit", async () => {
    const deps = depsAdmin({ exigerDroit: vi.fn(async () => Promise.reject(new Error("KS_DROIT_REFUSE"))) });
    await expect(changerEtatPrestataire(deps, { code: "kpay", actif: true })).resolves.toEqual({ ok: false, erreur: "non_autorise" });
    expect(deps.definirActif).not.toHaveBeenCalled();
  });
  it("code inconnu ou état invalide : refusé avant tout appel", async () => {
    const deps = depsAdmin();
    await expect(changerEtatPrestataire(deps, { code: "geniuspay", actif: true })).resolves.toEqual({ ok: false, erreur: "prestataire_inconnu" });
    await expect(changerEtatPrestataire(deps, { code: "kpay", actif: "oui" as never })).resolves.toEqual({ ok: false, erreur: "prestataire_inconnu" });
    expect(deps.exigerDroit).not.toHaveBeenCalled();
  });
  it("erreur de la base : pas de succès annoncé, cache non invalidé", async () => {
    const deps = depsAdmin({ definirActif: vi.fn(async () => ({ erreur: "KS_DROIT_REFUSE" })) });
    await expect(changerEtatPrestataire(deps, { code: "kpay", actif: true })).resolves.toEqual({ ok: false, erreur: "non_autorise" });
    expect(deps.invalider).not.toHaveBeenCalled();
  });
  it("exception inattendue : erreur générique, journal sans donnée", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const deps = depsAdmin({ definirActif: vi.fn(async () => Promise.reject(new Error("TEST_secret"))) });
    await expect(changerEtatPrestataire(deps, { code: "kpay", actif: true })).resolves.toEqual({ ok: false, erreur: "generique" });
    expect(JSON.stringify(spy.mock.calls)).not.toContain("TEST_secret");
    spy.mockRestore();
  });
});

describe("deplacerPrestataire", () => {
  it("monte ou descend un Agrégateur, puis invalide le cache", async () => {
    const deps = depsAdmin();
    await expect(deplacerPrestataire(deps, { code: "maishapay", sens: "monter" })).resolves.toEqual({ ok: true });
    expect(deps.deplacer).toHaveBeenCalledWith("TEST_auteur", "maishapay", "monter");
    expect(deps.invalider).toHaveBeenCalledTimes(1);
  });
  it("sens ou code invalide : refusé avant tout appel", async () => {
    const deps = depsAdmin();
    await expect(deplacerPrestataire(deps, { code: "maishapay", sens: "gauche" })).resolves.toEqual({ ok: false, erreur: "sens_invalide" });
    await expect(deplacerPrestataire(deps, { code: "x", sens: "monter" })).resolves.toEqual({ ok: false, erreur: "prestataire_inconnu" });
    expect(deps.deplacer).not.toHaveBeenCalled();
  });
  it("sans droit : refus", async () => {
    const deps = depsAdmin({ exigerDroit: vi.fn(async () => Promise.reject(new Error("KS_DROIT_REFUSE"))) });
    await expect(deplacerPrestataire(deps, { code: "kpay", sens: "monter" })).resolves.toEqual({ ok: false, erreur: "non_autorise" });
  });
});
