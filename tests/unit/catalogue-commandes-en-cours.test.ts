import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({
  exigerDroit: vi.fn(),
  resultat: { count: 0 as number | null, error: null as { message: string } | null },
  appels: [] as unknown[][],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/droits", () => {
  class DroitRefuseError extends Error {
    constructor(code: string) {
      super(code);
    }
  }
  return { DroitRefuseError, exigerDroit: faux.exigerDroit };
});
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    from: (...a: unknown[]) => {
      faux.appels.push(["from", ...a]);
      const chaine = {
        select: (...b: unknown[]) => (faux.appels.push(["select", ...b]), chaine),
        eq: (...b: unknown[]) => (faux.appels.push(["eq", ...b]), chaine),
        not: (...b: unknown[]) => (faux.appels.push(["not", ...b]), chaine),
        or: (...b: unknown[]) => (faux.appels.push(["or", ...b]), Promise.resolve(faux.resultat)),
      };
      return chaine;
    },
  }),
}));

import { DroitRefuseError } from "@/lib/auth/droits";
import { filtreEnCours, lireCommandesEnCoursProduit } from "@/modules/catalogue/commandes-en-cours";

const ID = "00000000-0000-4000-8000-0000000000e1";

beforeEach(() => {
  vi.clearAllMocks();
  faux.appels.length = 0;
  faux.exigerDroit.mockResolvedValue({ auteur: {} });
  faux.resultat = { count: 0, error: null };
});

describe("commandes en cours d'un produit (point 4)", () => {
  it("filtre : payée, en fabrication, expédiée ; ou en attente / échouée avant l'échéance (sans échéance : non expirée)", () => {
    expect(filtreEnCours(new Date("2026-11-21T12:00:00Z"))).toBe(
      "statut.in.(payee,en_fabrication,expediee),and(statut.in.(en_attente,echouee),or(expire_le.is.null,expire_le.gt.2026-11-21T12:00:00.000Z))",
    );
  });

  it("compte fait par la base sur la table commande : lignes physiques non annulées du produit, une Commande comptée une fois", async () => {
    faux.resultat = { count: 3, error: null };
    await expect(lireCommandesEnCoursProduit(ID)).resolves.toEqual({ ok: true, nombre: 3 });
    expect(faux.exigerDroit).toHaveBeenCalledWith("produits.modifier");
    expect(faux.appels).toContainEqual(["from", "commande"]);
    expect(faux.appels).toContainEqual(["select", "id, ligne_commande!inner(id)", { count: "exact", head: true }]);
    expect(faux.appels).toContainEqual(["eq", "ligne_commande.produit_id", ID]);
    expect(faux.appels).toContainEqual(["eq", "ligne_commande.annulee", false]);
    // Lignes physiques seulement : une Commande de Kits reste « payée » pour toujours.
    expect(faux.appels).toContainEqual(["not", "ligne_commande.variante_id", "is", null]);
  });

  it("droit refusé : rien n'est lu ; identifiant invalide : introuvable ; erreur ou compte absent : générique (jamais 0)", async () => {
    faux.exigerDroit.mockRejectedValueOnce(new DroitRefuseError("KS_DROIT_REFUSE"));
    await expect(lireCommandesEnCoursProduit(ID)).resolves.toEqual({ ok: false, erreur: "non_autorise" });
    expect(faux.appels).toHaveLength(0);
    await expect(lireCommandesEnCoursProduit("x")).resolves.toEqual({ ok: false, erreur: "introuvable" });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    faux.resultat = { count: null, error: { message: "TEST_panne" } };
    await expect(lireCommandesEnCoursProduit(ID)).resolves.toEqual({ ok: false, erreur: "generique" });
    faux.resultat = { count: null, error: null };
    await expect(lireCommandesEnCoursProduit(ID)).resolves.toEqual({ ok: false, erreur: "generique" });
    spy.mockRestore();
  });
});
