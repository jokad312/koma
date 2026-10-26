import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));

type Reponse = { data: unknown; error: unknown };
const faux = vi.hoisted(() => ({
  produit: { data: null, error: null } as Reponse,
  photos: { data: [], error: null } as Reponse,
  dispo: { data: [], error: null } as Reponse,
  publies: [] as Reponse[],
  selections: [] as string[],
  filtres: [] as Array<[string, string, unknown]>,
  plages: [] as Array<[number, number]>,
  eq: [] as Array<[string, string]>,
  rpc: [] as Array<[string, unknown]>,
  tables: [] as string[],
}));

vi.mock("@/lib/supabase/public", () => ({
  creerClientPublic: () => ({
    from: (table: string) => {
      faux.tables.push(table);
      const b: Record<string, unknown> = {
        select: (colonnes: string) => {
          faux.selections.push(colonnes);
          return b;
        },
        not: (colonne: string, operateur: string, valeur: unknown) => {
          faux.filtres.push([colonne, operateur, valeur]);
          return b;
        },
        eq: (colonne: string, valeur: string) => {
          faux.eq.push([colonne, valeur]);
          return b;
        },
        order: () => (table === "produit_photo" ? Promise.resolve(faux.photos) : b),
        range: (debut: number, fin: number) => {
          faux.plages.push([debut, fin]);
          return Promise.resolve(faux.publies.shift() ?? { data: [], error: null });
        },
        maybeSingle: () => Promise.resolve(faux.produit),
      };
      return b;
    },
    rpc: (nom: string, args: unknown) => {
      faux.rpc.push([nom, args]);
      return Promise.resolve(faux.dispo);
    },
  }),
}));

import { lireFicheProduit, lireSlugsPublies } from "@/modules/catalogue/queries";

const PRODUIT = {
  id: "TEST_p1",
  slug: "test-produit",
  famille: "cosplay",
  titre_fr: "TEST_Titre",
  titre_en: "TEST_Title",
  description_fr: "TEST_Desc fr",
  description_en: "TEST_Desc en",
  prix_cents: 4990,
};

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle_publique";
  faux.produit = { data: PRODUIT, error: null };
  faux.photos = {
    data: [
      { fichier: "p1/a.jpg", alt_fr: "Alt fr 1", alt_en: "Alt en 1", position: 1 },
      { fichier: "p1/b.jpg", alt_fr: "Alt fr 2", alt_en: "  ", position: 2 },
    ],
    error: null,
  };
  faux.dispo = {
    data: [
      { taille: "M", etat: "en_stock", delai_jours: 14 },
      { taille: "L", etat: "sur_commande", delai_jours: 21 },
    ],
    error: null,
  };
  faux.publies = [];
  faux.selections = [];
  faux.filtres = [];
  faux.plages = [];
  faux.eq = [];
  faux.rpc = [];
  faux.tables = [];
});

describe("lireFicheProduit", () => {
  it("lit par le client public, filtre par adresse et par famille, appelle disponibilite_variantes", async () => {
    const fiche = await lireFicheProduit("cosplay", "test-produit", "fr");
    expect(faux.eq).toEqual(expect.arrayContaining([["slug", "test-produit"], ["famille", "cosplay"]]));
    expect(faux.rpc).toEqual([["disponibilite_variantes", { p_produit: "TEST_p1" }]]);
    expect(fiche).toMatchObject({ titre: "TEST_Titre", description: "TEST_Desc fr", prixCents: 4990 });
    expect(fiche?.photos.map((p) => p.url)).toEqual([
      "http://127.0.0.1:54321/storage/v1/object/public/produits-public/p1/a.jpg",
      "http://127.0.0.1:54321/storage/v1/object/public/produits-public/p1/b.jpg",
    ]);
    expect(fiche?.tailles).toEqual([
      { taille: "M", etat: "en_stock", delaiJours: 14 },
      { taille: "L", etat: "sur_commande", delaiJours: 21 },
    ]);
  });

  it("jamais de quantité dans la fiche", async () => {
    const fiche = await lireFicheProduit("cosplay", "test-produit", "fr");
    const cles = JSON.stringify(fiche).match(/"[A-Za-z_]+":/g) ?? [];
    expect(cles.filter((c) => /stock|quantite|quantity|nombre/i.test(c))).toEqual([]);
  });

  it("anglais : titre, description et texte alternatif anglais, repli sur le français si le texte alternatif est vide", async () => {
    const fiche = await lireFicheProduit("cosplay", "test-produit", "en");
    expect(fiche).toMatchObject({ titre: "TEST_Title", description: "TEST_Desc en" });
    expect(fiche?.photos.map((p) => p.alt)).toEqual(["Alt en 1", "Alt fr 2"]);
  });

  it("anglais : titre et description absents en anglais, repli sur le français", async () => {
    faux.produit = { data: { ...PRODUIT, titre_en: null, description_en: null }, error: null };
    expect(await lireFicheProduit("cosplay", "test-produit", "en")).toMatchObject({ titre: "TEST_Titre", description: "TEST_Desc fr" });
  });

  it("anglais : titre ou description vides, ou description avec le marqueur : repli sur le français", async () => {
    faux.produit = { data: { ...PRODUIT, titre_en: "  ", description_en: "  " }, error: null };
    expect(await lireFicheProduit("cosplay", "test-produit", "en")).toMatchObject({ titre: "TEST_Titre", description: "TEST_Desc fr" });
    faux.produit = { data: { ...PRODUIT, description_en: "Début [Texte à fournir]" }, error: null };
    expect((await lireFicheProduit("cosplay", "test-produit", "en"))?.description).toBe("TEST_Desc fr");
  });

  it("produit introuvable (brouillon, dépublié, autre famille : la RLS et le filtre ne renvoient rien) : null", async () => {
    faux.produit = { data: null, error: null };
    expect(await lireFicheProduit("accessoire", "test-produit", "fr")).toBeNull();
  });

  it("sans photo : la fiche n'existe pas", async () => {
    faux.photos = { data: [], error: null };
    expect(await lireFicheProduit("cosplay", "test-produit", "fr")).toBeNull();
  });

  it("sans prix : la fiche n'existe pas", async () => {
    faux.produit = { data: { ...PRODUIT, prix_cents: null }, error: null };
    expect(await lireFicheProduit("cosplay", "test-produit", "fr")).toBeNull();
  });

  it("erreur de lecture : relancée, jamais une fiche inventée", async () => {
    faux.produit = { data: null, error: { message: "TEST" } };
    await expect(lireFicheProduit("cosplay", "test-produit", "fr")).rejects.toThrow();
    faux.produit = { data: PRODUIT, error: null };
    faux.dispo = { data: null, error: { message: "TEST" } };
    await expect(lireFicheProduit("cosplay", "test-produit", "fr")).rejects.toThrow();
    faux.dispo = { data: [], error: null };
    faux.photos = { data: null, error: { message: "TEST" } };
    await expect(lireFicheProduit("cosplay", "test-produit", "fr")).rejects.toThrow();
  });

  it("état ou taille inconnus renvoyés par la base : erreur", async () => {
    faux.dispo = { data: [{ taille: "M", etat: "epuise", delai_jours: null }], error: null };
    await expect(lireFicheProduit("cosplay", "test-produit", "fr")).rejects.toThrow();
    faux.dispo = { data: [{ taille: "XXXL", etat: "en_stock", delai_jours: null }], error: null };
    await expect(lireFicheProduit("cosplay", "test-produit", "fr")).rejects.toThrow();
  });
});

describe("lireSlugsPublies", () => {
  it("famille et adresse de chaque produit publié avec photo et prix, par le client public", async () => {
    faux.publies = [{ data: [{ famille: "cosplay", slug: "a" }, { famille: "accessoire", slug: "b" }], error: null }];
    expect(await lireSlugsPublies()).toEqual([
      { famille: "cosplay", slug: "a" },
      { famille: "accessoire", slug: "b" },
    ]);
    expect(faux.tables).toEqual(["produit"]);
    expect(faux.selections[0]).toContain("produit_photo!inner");
    expect(faux.filtres).toContainEqual(["prix_cents", "is", null]);
  });

  it("pagine par range() jusqu'à épuisement", async () => {
    const page = (n: number, depart: number) => Array.from({ length: n }, (_, i) => ({ famille: "cosplay", slug: `p-${depart + i}` }));
    faux.publies = [
      { data: page(1000, 0), error: null },
      { data: page(3, 1000), error: null },
    ];
    expect(await lireSlugsPublies()).toHaveLength(1003);
    expect(faux.plages).toEqual([[0, 999], [1000, 1999]]);
  });

  it("erreur de lecture relancée", async () => {
    faux.publies = [{ data: null, error: { message: "TEST" } }];
    await expect(lireSlugsPublies()).rejects.toThrow();
  });
});
