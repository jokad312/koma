import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enregistrerTranchesPrix } from "@/modules/catalogue/service";
import { lireTranches } from "@/modules/catalogue/tranches";
import type { EntreeTranche } from "@/modules/catalogue/types";
import { creerTestDependancesCatalogue, TEST_ADMIN_ID } from "../doubles/TEST_dependances-catalogue";

vi.mock("server-only", () => ({}));

const faux = vi.hoisted(() => ({
  courant: null as unknown,
  public: { data: null as unknown, error: null as unknown },
  service: { data: null as unknown, error: null as unknown },
  tris: [] as string[],
  etiquettes: [] as string[],
}));
vi.mock("next/cache", () => ({ cacheTag: (e: string) => faux.etiquettes.push(e), updateTag: vi.fn() }));
vi.mock("@/lib/auth/droits", () => ({ exigerDroit: vi.fn() }));
vi.mock("@/lib/supabase/public", () => ({
  creerClientPublic: () => ({
    from: () => ({
      select: () => ({
        order: (colonne: string) => {
          faux.tris.push(colonne);
          return Promise.resolve(faux.public);
        },
      }),
    }),
  }),
}));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    from: () => ({ select: () => ({ order: () => Promise.resolve(faux.service) }) }),
  }),
}));
vi.mock("@/modules/catalogue/dependances", () => ({
  dependances: () => {
    if (faux.courant instanceof Error) throw faux.courant;
    return faux.courant;
  },
}));

import { enregistrerTranchesPrix as actionTranches } from "@/modules/catalogue/actions";
import { lireTranchesPrix, lireTranchesPrixAdmin } from "@/modules/catalogue/queries";

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  faux.tris = [];
  faux.etiquettes = [];
});
afterEach(() => vi.restoreAllMocks());

function tranche(partiel: Partial<EntreeTranche> = {}): EntreeTranche {
  return { libelleFr: "Petit", libelleEn: "Small", bas: "0", haut: "20", ...partiel };
}

describe("lireTranches (validation)", () => {
  it("convertit en centimes, garde l'ordre, borne haute vide = tranche ouverte", () => {
    expect(lireTranches([tranche(), tranche({ libelleFr: " Grand ", libelleEn: "Large", bas: "20,50", haut: "" })])).toEqual({
      ok: true,
      tranches: [
        { libelle_fr: "Petit", libelle_en: "Small", bas_cents: 0, haut_cents: 2000 },
        { libelle_fr: "Grand", libelle_en: "Large", bas_cents: 2050, haut_cents: null },
      ],
    });
  });

  it("liste vide : acceptée (plus de tranche)", () => {
    expect(lireTranches([])).toEqual({ ok: true, tranches: [] });
  });

  it("haut égal ou inférieur au bas : refusé, rang et champ indiqués", () => {
    expect(lireTranches([tranche(), tranche({ bas: "10", haut: "10" })])).toEqual({ ok: false, erreur: "tranche_bornes_invalides", ligne: 2, champTranche: "haut" });
    expect(lireTranches([tranche({ bas: "10", haut: "5" })])).toMatchObject({ ok: false, ligne: 1, champTranche: "haut" });
  });

  it("borne basse absente ou mal écrite : refusée", () => {
    expect(lireTranches([tranche({ bas: "" })])).toMatchObject({ ok: false, erreur: "tranche_bornes_invalides", champTranche: "bas" });
    expect(lireTranches([tranche({ bas: "-1" })])).toMatchObject({ ok: false, champTranche: "bas" });
    expect(lireTranches([tranche({ bas: "1,234" })])).toMatchObject({ ok: false, champTranche: "bas" });
  });

  it("libellé vide ou de plus de 40 caractères : refusé, par langue", () => {
    expect(lireTranches([tranche({ libelleFr: "  " })])).toEqual({ ok: false, erreur: "tranche_libelle_invalide", ligne: 1, champTranche: "libelle_fr" });
    expect(lireTranches([tranche({ libelleEn: "x".repeat(41) })])).toMatchObject({ ok: false, champTranche: "libelle_en" });
    expect(lireTranches([tranche({ libelleFr: "x".repeat(40) })]).ok).toBe(true);
  });

  it("neuf tranches : refusé ; huit : accepté", () => {
    expect(lireTranches(Array.from({ length: 9 }, (_, i) => tranche({ bas: String(i * 10), haut: String(i * 10 + 5) })))).toEqual({ ok: false, erreur: "tranches_trop_nombreuses" });
    expect(lireTranches(Array.from({ length: 8 }, (_, i) => tranche({ bas: String(i * 10), haut: String(i * 10 + 5) }))).ok).toBe(true);
  });
});

describe("enregistrerTranchesPrix (service)", () => {
  it("droit reglages.modifier, écriture, puis invalidation du cache reglages, dans cet ordre", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await enregistrerTranchesPrix(deps, [tranche()])).toEqual({ ok: true });
    expect(appels.ordre).toEqual(["droit", "tranches", "invalidationReglages"]);
    expect(appels.droits).toEqual(["reglages.modifier"]);
    expect(appels.tranches).toEqual([{ auteur: { type: "compte", id: TEST_ADMIN_ID, role: "admin" }, tranches: [{ libelle_fr: "Petit", libelle_en: "Small", bas_cents: 0, haut_cents: 2000 }] }]);
  });

  it("liste vide : écrite (remplace tout), succès", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await enregistrerTranchesPrix(deps, [])).toEqual({ ok: true });
    expect(appels.tranches).toMatchObject([{ tranches: [] }]);
  });

  it("saisie invalide : rien n'est écrit ni invalidé", async () => {
    const { deps, appels } = creerTestDependancesCatalogue();
    expect(await enregistrerTranchesPrix(deps, [tranche({ bas: "5", haut: "5" })])).toMatchObject({ ok: false, erreur: "tranche_bornes_invalides", ligne: 1 });
    expect(appels.tranches).toEqual([]);
    expect(appels.invalidationsReglages).toBe(0);
  });

  it("droit refusé (Assistant, Compte simple) : non_autorise, droit seul appelé", async () => {
    for (const droit of ["KS_NON_CONNECTE", "KS_DROIT_REFUSE"] as const) {
      const { deps, appels } = creerTestDependancesCatalogue({ droit });
      expect(await enregistrerTranchesPrix(deps, [tranche()])).toEqual({ ok: false, erreur: "non_autorise" });
      expect(appels.ordre).toEqual(["droit"]);
    }
  });

  it("la base refuse : pas de succès, cache intact", async () => {
    const { deps, appels } = creerTestDependancesCatalogue({ erreurTranches: "KS_TRANCHE_INVALIDE" });
    expect(await enregistrerTranchesPrix(deps, [tranche()])).toEqual({ ok: false, erreur: "tranche_bornes_invalides" });
    expect(appels.invalidationsReglages).toBe(0);
    const autre = creerTestDependancesCatalogue({ erreurTranches: "boum" });
    expect(await enregistrerTranchesPrix(autre.deps, [tranche()])).toEqual({ ok: false, erreur: "generique" });
    const perdu = creerTestDependancesCatalogue({ erreurTranches: "KS_DROIT_REFUSE" });
    expect(await enregistrerTranchesPrix(perdu.deps, [tranche()])).toEqual({ ok: false, erreur: "non_autorise" });
  });

  it("invalidation en échec après l'écriture : le succès reste, la cause est journalisée", async () => {
    const { deps } = creerTestDependancesCatalogue({ invalidationReglagesEnEchec: true });
    expect(await enregistrerTranchesPrix(deps, [tranche()])).toEqual({ ok: true });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("Server Action enregistrerTranchesPrix", () => {
  it("succès rendu seulement après la réponse", async () => {
    const { deps } = creerTestDependancesCatalogue();
    faux.courant = deps;
    expect(await actionTranches([tranche()])).toEqual({ statut: "succes" });
  });
  it("erreur de tranche : rang et champ rendus", async () => {
    faux.courant = creerTestDependancesCatalogue().deps;
    expect(await actionTranches([tranche({ libelleFr: "" })])).toEqual({ statut: "erreur", erreur: "tranche_libelle_invalide", ligne: 1, champ: "libelle_fr" });
  });
  it("exception : erreur générique, jamais un succès", async () => {
    faux.courant = new Error("TEST_coupure");
    expect(await actionTranches([tranche()])).toEqual({ statut: "erreur", erreur: "generique" });
  });
});

describe("lectures des tranches", () => {
  const lignes = [{ ordre: 1, libelle_fr: "Petit", libelle_en: "Small", bas_cents: 0, haut_cents: 2000 }];

  it("publique : triée par ordre, étiquette reglages, convertie", async () => {
    faux.public = { data: lignes, error: null };
    expect(await lireTranchesPrix()).toEqual([{ ordre: 1, libelleFr: "Petit", libelleEn: "Small", basCents: 0, hautCents: 2000 }]);
    expect(faux.tris).toEqual(["ordre"]);
    expect(faux.etiquettes).toEqual(["reglages"]);
  });

  it("aucune tranche réglée : liste vide, jamais une tranche inventée", async () => {
    faux.public = { data: [], error: null };
    expect(await lireTranchesPrix()).toEqual([]);
    faux.public = { data: null, error: null };
    expect(await lireTranchesPrix()).toEqual([]);
  });

  it("erreur de lecture : relancée", async () => {
    faux.public = { data: null, error: { message: "boum" } };
    await expect(lireTranchesPrix()).rejects.toThrow();
    faux.service = { data: null, error: { message: "boum" } };
    await expect(lireTranchesPrixAdmin()).rejects.toThrow();
  });

  it("admin : par le client service", async () => {
    faux.service = { data: lignes, error: null };
    expect(await lireTranchesPrixAdmin()).toHaveLength(1);
  });
});
