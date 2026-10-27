import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));

const faux = vi.hoisted(() => ({
  resultat: { data: null as unknown, error: null as unknown },
  colonnes: [] as string[],
  tris: [] as string[],
  eq: [] as Array<[string, string, string]>,
  parTable: {} as Record<string, { data: unknown; error: unknown }>,
  // Résultats successifs d'une même table (deux lectures lancées ensemble), consommés dans l'ordre des appels.
  suite: {} as Record<string, Array<{ data: unknown; error: unknown }>>,
  in: [] as Array<[string, string, unknown]>,
  not: [] as Array<[string, string, string, unknown]>,
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
        order: () => Promise.resolve(faux.suite[table]?.shift() ?? faux.parTable[table] ?? faux.resultat),
        eq: (colonne: string, valeur: string) => {
          faux.eq.push([table, colonne, valeur]);
          return b;
        },
        in: (colonne: string, valeurs: unknown) => {
          faux.in.push([table, colonne, valeurs]);
          return b;
        },
        not: (colonne: string, operateur: string, valeur: unknown) => {
          faux.not.push([table, colonne, operateur, valeur]);
          return b;
        },
        maybeSingle: () => Promise.resolve(faux.parTable[table] ?? faux.resultat),
        then: (resolve: (v: unknown) => unknown) => resolve(faux.suite[table]?.shift() ?? faux.parTable[table] ?? faux.resultat),
      };
      return b;
    },
  }),
}));

import { lireProduitAdmin, lireProduitsAdmin, lireProduitsLiables, lireUniversAdmin, lireUniversPublics } from "@/modules/catalogue/queries";

beforeEach(() => {
  faux.resultat = { data: null, error: null };
  faux.colonnes = [];
  faux.tris = [];
  faux.eq = [];
  faux.parTable = {};
  faux.suite = {};
  faux.in = [];
  faux.not = [];
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
    materiel_fr: null,
    materiel_en: null,
    niveau: null,
    produit_lie_id: null,
  };

  it("produit et variantes : correspondance des colonnes, variantes filtrées par produit_id", async () => {
    faux.parTable = {
      produit: { data: ligne, error: null },
      variante: { data: [{ taille: "M", stock: 2, fabrication_sur_commande: true, delai_fabrication_jours: 20 }], error: null },
      produit_photo: { data: [{ id: "TEST_ph", fichier: "TEST_p/a.jpg", alt_fr: "Face", alt_en: "Front", position: 1 }], error: null },
      fichier_kit: { data: [], error: null },
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
      photos: [{ id: "TEST_ph", fichier: "TEST_p/a.jpg", altFr: "Face", altEn: "Front", position: 1 }],
      materielFr: null,
      materielEn: null,
      niveau: null,
      produitLieId: null,
      fichiers: [],
    });
    expect(faux.eq).toEqual([
      ["produit", "id", "TEST_p"],
      ["variante", "produit_id", "TEST_p"],
      ["produit_photo", "produit_id", "TEST_p"],
      ["fichier_kit", "produit_id", "TEST_p"],
    ]);
  });

  it("fichiers d'un Kit : chaque champ correspond, la taille est un nombre, aucun chemin n'est lu", async () => {
    const kit = { ...ligne, id: "TEST_k", famille: "kit", prix_cents: 0, niveau: "avance", materiel_fr: "TEST_mousse", materiel_en: "TEST_foam", produit_lie_id: "TEST_cos" };
    faux.parTable = {
      produit: { data: kit, error: null },
      variante: { data: [], error: null },
      produit_photo: { data: [], error: null },
      fichier_kit: {
        data: [
          { id: "TEST_f1", nom_fr: "TEST_Patron", nom_en: "TEST_Pattern", format: "pdf_letter", taille_octets: "3000000", ordre: 2, version: 3 },
          { id: "TEST_f2", nom_fr: "TEST_Motif", nom_en: "TEST_Motif en", format: "svg", taille_octets: 2048, ordre: 5, version: 1 },
        ],
        error: null,
      },
    };
    const produit = await lireProduitAdmin("TEST_k");
    expect(produit?.fichiers).toEqual([
      { id: "TEST_f1", nomFr: "TEST_Patron", nomEn: "TEST_Pattern", format: "pdf_letter", tailleOctets: 3_000_000, ordre: 2, version: 3 },
      { id: "TEST_f2", nomFr: "TEST_Motif", nomEn: "TEST_Motif en", format: "svg", tailleOctets: 2048, ordre: 5, version: 1 },
    ]);
    expect(typeof produit?.fichiers[0].tailleOctets).toBe("number");
    expect(Object.keys(produit?.fichiers[0] ?? {})).not.toContain("chemin");
    expect(JSON.stringify(produit?.fichiers)).not.toMatch(/chemin/i);
    expect(produit).toMatchObject({ famille: "kit", prixCents: 0, niveau: "avance", materielFr: "TEST_mousse", materielEn: "TEST_foam", produitLieId: "TEST_cos" });
    // La table privée n'est jamais lue pour l'admin : seule fichier_kit l'est, et sans colonne de chemin.
    expect(faux.eq.map(([table]) => table)).not.toContain("fichier_kit_prive");
    expect(faux.colonnes.join(" ")).not.toMatch(/chemin/);
  });

  it("produits à lier : filtres exacts (cosplay et accessoire, Kits liés) et exclusion des cibles déjà prises", async () => {
    faux.suite = {
      produit: [
        {
          data: [
            { id: "TEST_a", titre_fr: "TEST_A", famille: "cosplay" },
            { id: "TEST_b", titre_fr: "TEST_B", famille: "accessoire" },
            { id: "TEST_c", titre_fr: "TEST_C", famille: "cosplay" },
          ],
          error: null,
        },
        {
          data: [
            { id: "TEST_k1", produit_lie_id: "TEST_a" },
            { id: "TEST_k2", produit_lie_id: "TEST_b" },
          ],
          error: null,
        },
      ],
    };
    expect(await lireProduitsLiables(null)).toEqual([{ id: "TEST_c", titreFr: "TEST_C", famille: "cosplay" }]);
    expect(faux.in).toEqual([["produit", "famille", ["cosplay", "accessoire"]]]);
    expect(faux.eq).toEqual([["produit", "famille", "kit"]]);
    expect(faux.not).toEqual([["produit", "produit_lie_id", "is", null]]);
  });

  it("produits à lier : la cible du Kit édité reste proposée ; une erreur de lecture est relancée", async () => {
    faux.suite = {
      produit: [
        { data: [{ id: "TEST_a", titre_fr: "TEST_A", famille: "cosplay" }, { id: "TEST_b", titre_fr: "TEST_B", famille: "accessoire" }], error: null },
        { data: [{ id: "TEST_k1", produit_lie_id: "TEST_a" }, { id: "TEST_k2", produit_lie_id: "TEST_b" }], error: null },
      ],
    };
    expect((await lireProduitsLiables("TEST_k1")).map((c) => c.id)).toEqual(["TEST_a"]);
    faux.suite = { produit: [{ data: null, error: { message: "TEST" } }, { data: [], error: null }] };
    await expect(lireProduitsLiables(null)).rejects.toThrow();
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
    faux.parTable = { produit: { data: ligne, error: null }, variante: { data: [], error: null }, produit_photo: { data: null, error: { message: "TEST" } } };
    await expect(lireProduitAdmin("TEST_p")).rejects.toThrow();
  });
});
