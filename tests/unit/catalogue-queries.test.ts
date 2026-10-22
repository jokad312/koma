import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const faux = vi.hoisted(() => ({
  resultat: { data: null as unknown, error: null as unknown },
  colonnes: [] as string[],
  tris: [] as string[],
  eq: [] as Array<[string, string, string]>,
  parTable: {} as Record<string, { data: unknown; error: unknown }>,
}));
const requete = {
  select: (colonnes: string) => {
    faux.colonnes.push(colonnes);
    return requete;
  },
  order: (colonne: string) => {
    faux.tris.push(colonne);
    return Promise.resolve(faux.resultat);
  },
};
vi.mock("@/lib/supabase/public", () => ({ creerClientPublic: () => ({ from: () => requete }) }));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {
        select: () => b,
        order: () => Promise.resolve(faux.resultat),
        eq: (colonne: string, valeur: string) => {
          faux.eq.push([table, colonne, valeur]);
          return b;
        },
        maybeSingle: () => Promise.resolve(faux.parTable[table] ?? faux.resultat),
        then: (resolve: (v: unknown) => unknown) => resolve(faux.parTable[table] ?? faux.resultat),
      };
      return b;
    },
  }),
}));

import { lireProduitAdmin, lireProduitsAdmin, lireUniversAdmin, lireUniversPublics } from "@/modules/catalogue/queries";

beforeEach(() => {
  faux.resultat = { data: null, error: null };
  faux.colonnes = [];
  faux.tris = [];
  faux.eq = [];
  faux.parTable = {};
});

describe("lireUniversPublics", () => {
  it("noms dans la langue de la route, par le client public (jamais le client service)", async () => {
    faux.resultat = {
      data: [
        { id: "TEST_1", nom_fr: "Univers de test A" },
        { id: "TEST_2", nom_fr: "Univers de test B" },
      ],
      error: null,
    };
    expect(await lireUniversPublics("fr")).toEqual([
      { id: "TEST_1", nom: "Univers de test A" },
      { id: "TEST_2", nom: "Univers de test B" },
    ]);
    expect(faux.colonnes).toEqual(["id, nom_fr"]);
    expect(faux.tris).toEqual(["nom_fr"]);

    faux.resultat = { data: [{ id: "TEST_1", nom_en: "Test universe A" }], error: null };
    expect(await lireUniversPublics("en")).toEqual([{ id: "TEST_1", nom: "Test universe A" }]);
    expect(faux.colonnes[1]).toBe("id, nom_en");
  });

  it("aucun univers : liste vide, la question n'est pas affichée", async () => {
    faux.resultat = { data: [], error: null };
    expect(await lireUniversPublics("fr")).toEqual([]);
  });

  it("lecture impossible : relancé, jamais une liste inventée", async () => {
    faux.resultat = { data: null, error: { message: "TEST" } };
    await expect(lireUniversPublics("fr")).rejects.toThrow();
  });
});

describe("lectures admin", () => {
  it("univers et produits : correspondance des colonnes, erreur relancée", async () => {
    faux.resultat = { data: [{ id: "TEST_1", nom_fr: "A", nom_en: "B" }], error: null };
    expect(await lireUniversAdmin()).toEqual([{ id: "TEST_1", nomFr: "A", nomEn: "B" }]);
    faux.resultat = { data: [{ id: "TEST_p", famille: "cosplay", titre_fr: "T", slug: "t", prix_cents: null, publie_le: null }], error: null };
    expect(await lireProduitsAdmin()).toEqual([{ id: "TEST_p", famille: "cosplay", titreFr: "T", slug: "t", prixCents: null, publieLe: null }]);
    faux.resultat = { data: null, error: { message: "TEST" } };
    await expect(lireProduitsAdmin()).rejects.toThrow();
    await expect(lireUniversAdmin()).rejects.toThrow();
  });
});

describe("lireProduitAdmin", () => {
  const ligne = {
    id: "TEST_p",
    famille: "cosplay",
    slug: "t",
    titre_fr: "T",
    titre_en: null,
    description_fr: null,
    description_en: null,
    univers_id: null,
    prix_cents: 4990,
    delai_fabrication_jours: 14,
    publie_le: null,
  };

  it("produit et variantes : correspondance des colonnes, variantes filtrées par produit_id", async () => {
    faux.parTable = {
      produit: { data: ligne, error: null },
      variante: { data: [{ taille: "M", stock: 2, fabrication_sur_commande: true, delai_fabrication_jours: 20 }], error: null },
    };
    expect(await lireProduitAdmin("TEST_p")).toEqual({
      id: "TEST_p",
      famille: "cosplay",
      slug: "t",
      titreFr: "T",
      titreEn: null,
      descriptionFr: null,
      descriptionEn: null,
      universId: null,
      prixCents: 4990,
      delaiFabricationJours: 14,
      publieLe: null,
      variantes: [{ taille: "M", stock: 2, fabricationSurCommande: true, delaiFabricationJours: 20 }],
    });
    expect(faux.eq).toEqual([
      ["produit", "id", "TEST_p"],
      ["variante", "produit_id", "TEST_p"],
    ]);
  });

  it("produit absent : null (404)", async () => {
    faux.parTable = { produit: { data: null, error: null } };
    expect(await lireProduitAdmin("TEST_p")).toBeNull();
  });

  it("erreur de lecture du produit ou des variantes : relancée", async () => {
    faux.parTable = { produit: { data: null, error: { message: "TEST" } } };
    await expect(lireProduitAdmin("TEST_p")).rejects.toThrow();
    faux.parTable = { produit: { data: ligne, error: null }, variante: { data: null, error: { message: "TEST" } } };
    await expect(lireProduitAdmin("TEST_p")).rejects.toThrow();
  });
});
