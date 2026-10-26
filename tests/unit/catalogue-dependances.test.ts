import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const tags = vi.hoisted(() => ({ updateTag: vi.fn() }));
vi.mock("next/cache", () => ({ updateTag: tags.updateTag, cacheTag: vi.fn() }));

const faux = vi.hoisted(() => ({
  rpc: vi.fn(),
  lignes: { data: [] as unknown[], error: null as unknown },
  filtres: [] as unknown[],
}));
vi.mock("@/lib/auth/droits", () => ({ exigerDroit: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => {
    const requete: Record<string, unknown> = {
      select: () => requete,
      like: (colonne: string, motif: string) => {
        faux.filtres.push(["like", colonne, motif]);
        return requete;
      },
      neq: (colonne: string, valeur: string) => {
        faux.filtres.push(["neq", colonne, valeur]);
        return requete;
      },
      then: (resolve: (v: unknown) => unknown) => resolve(faux.lignes),
    };
    return { rpc: faux.rpc, from: () => requete };
  },
}));

import { dependances } from "@/modules/catalogue/dependances";
import { premierSlugLibre } from "@/modules/catalogue/queries";

const AUTEUR = { type: "compte" as const, id: "TEST_admin", role: "admin" as const };

beforeEach(() => {
  vi.clearAllMocks();
  faux.filtres = [];
  faux.lignes = { data: [], error: null };
});

describe("câblage réel de modules/catalogue", () => {
  it("ecrireUnivers appelle creer_univers avec l'auteur et les deux noms", async () => {
    faux.rpc.mockResolvedValue({ data: "TEST_id", error: null });
    expect(await dependances().ecrireUnivers({ auteur: AUTEUR, nomFr: "A", nomEn: "B" })).toEqual({ erreur: null, id: "TEST_id" });
    expect(faux.rpc).toHaveBeenCalledWith("creer_univers", { p_auteur: AUTEUR, p_nom_fr: "A", p_nom_en: "B" });
  });

  it("ecrireUnivers renvoie le message d'erreur de la base, sans identifiant", async () => {
    faux.rpc.mockResolvedValue({ data: null, error: { message: "KS_UNIVERS_EXISTE" } });
    expect(await dependances().ecrireUnivers({ auteur: AUTEUR, nomFr: "A", nomEn: "B" })).toEqual({ erreur: "KS_UNIVERS_EXISTE", id: null });
  });

  it("ecrireProduit appelle enregistrer_produit : produit et variantes en JSON, identifiant nul pour une création", async () => {
    faux.rpc.mockResolvedValue({ data: "TEST_produit", error: null });
    const produit = {
      famille: "cosplay" as const,
      slug: "x",
      titre_fr: "X",
      titre_en: null,
      description_fr: null,
      description_en: null,
      univers_id: null,
      prix_cents: 4990,
      delai_fabrication_jours: null,
    };
    const variantes = [{ taille: "M" as const, stock: 2, fabrication_sur_commande: false, delai_fabrication_jours: null }];
    expect(await dependances().ecrireProduit({ auteur: AUTEUR, id: null, produit, variantes })).toEqual({ erreur: null, id: "TEST_produit" });
    expect(faux.rpc).toHaveBeenCalledWith("enregistrer_produit", { p_auteur: AUTEUR, p_id: null, p_produit: produit, p_variantes: variantes });
  });

  it("ecrireProduit renvoie le message d'erreur de la base", async () => {
    faux.rpc.mockResolvedValue({ data: null, error: { message: "KS_SLUG_PRIS" } });
    const r = await dependances().ecrireProduit({ auteur: AUTEUR, id: "TEST_p", produit: {} as never, variantes: [] });
    expect(r).toEqual({ erreur: "KS_SLUG_PRIS", id: null });
  });
});

describe("premierSlugLibre", () => {
  it("cherche les adresses qui commencent par la base et exclut le produit modifié", async () => {
    faux.lignes = { data: [{ slug: "cosplay" }, { slug: "cosplay-2" }], error: null };
    expect(await premierSlugLibre("cosplay", "TEST_p")).toBe("cosplay-3");
    expect(faux.filtres).toEqual([
      ["like", "slug", "cosplay%"],
      ["neq", "id", "TEST_p"],
    ]);
  });

  it("création : aucune exclusion", async () => {
    expect(await premierSlugLibre("cosplay", null)).toBe("cosplay");
    expect(faux.filtres).toEqual([["like", "slug", "cosplay%"]]);
  });

  it("base invalide ou lecture impossible : relancé, jamais une adresse inventée", async () => {
    await expect(premierSlugLibre("Pas Bon", null)).rejects.toThrow();
    faux.lignes = { data: [], error: { message: "TEST" } };
    await expect(premierSlugLibre("cosplay", null)).rejects.toThrow();
  });

  it("invaliderCatalogue() vide l'étiquette « catalogue »", async () => {
    await dependances().invaliderCatalogue();
    expect(tags.updateTag).toHaveBeenCalledWith("catalogue");
  });

  it("creerUnivers réussi (service + câblage réel) : l'étiquette « catalogue » est vidée ; refusé : elle ne l'est pas", async () => {
    const { exigerDroit } = await import("@/lib/auth/droits");
    vi.mocked(exigerDroit).mockResolvedValue({ auteur: AUTEUR } as never);
    const { creerUnivers } = await import("@/modules/catalogue/service");
    faux.rpc.mockResolvedValue({ data: "TEST_id", error: null });
    expect(await creerUnivers(dependances(), { nomFr: "A", nomEn: "B" })).toEqual({ ok: true, id: "TEST_id" });
    expect(tags.updateTag).toHaveBeenCalledWith("catalogue");
    tags.updateTag.mockClear();
    faux.rpc.mockResolvedValue({ data: null, error: { message: "KS_UNIVERS_EXISTE" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await creerUnivers(dependances(), { nomFr: "A", nomEn: "B" })).ok).toBe(false);
    expect(tags.updateTag).not.toHaveBeenCalled();
  });

  it("invaliderReglages() vide l'étiquette « reglages »", async () => {
    await dependances().invaliderReglages();
    expect(tags.updateTag).toHaveBeenCalledWith("reglages");
  });

  it("ecrireTranches appelle enregistrer_tranches_prix avec l'auteur et la liste", async () => {
    faux.rpc.mockResolvedValue({ error: null });
    const tranches = [{ libelle_fr: "A", libelle_en: "B", bas_cents: 0, haut_cents: null }];
    expect(await dependances().ecrireTranches({ auteur: AUTEUR, tranches })).toEqual({ erreur: null });
    expect(faux.rpc).toHaveBeenCalledWith("enregistrer_tranches_prix", { p_auteur: AUTEUR, p_tranches: tranches });
    faux.rpc.mockResolvedValue({ error: { message: "KS_TRANCHE_INVALIDE" } });
    expect(await dependances().ecrireTranches({ auteur: AUTEUR, tranches })).toEqual({ erreur: "KS_TRANCHE_INVALIDE" });
  });
});
