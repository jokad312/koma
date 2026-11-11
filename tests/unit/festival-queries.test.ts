import { beforeEach, describe, expect, it, vi } from "vitest";

type Reponse = { data?: unknown; count?: number | null; error: unknown };

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));

const faux = vi.hoisted(() => ({
  appels: [] as Array<{ table: string; etapes: Array<{ nom: string; args: unknown[] }> }>,
  parTable: {} as Record<string, Reponse[]>,
}));

// Client public FAUX : chaque requête rend, dans l'ordre, la réponse préparée pour sa table.
vi.mock("@/lib/supabase/public", () => ({
  creerClientPublic: () => ({
    from: (table: string) => {
      const etapes: Array<{ nom: string; args: unknown[] }> = [];
      faux.appels.push({ table, etapes });
      const reponse = (): Reponse => {
        const file = faux.parTable[table];
        return file && file.length > 0 ? file.shift()! : { data: null, error: null };
      };
      const b: Record<string, unknown> = {};
      for (const nom of ["select", "order", "eq", "neq", "not", "gte", "lt", "range", "limit"]) {
        b[nom] = (...args: unknown[]) => {
          etapes.push({ nom, args });
          return b;
        };
      }
      b.maybeSingle = async () => reponse();
      b.then = (resoudre: (r: Reponse) => unknown) => Promise.resolve(reponse()).then(resoudre);
      return b;
    },
  }),
}));

import { lireEvenementPublie, lireProchainEvenement, listerEvenementsPublies } from "@/modules/evenements/queries-publiques";

const FUTUR = "2099-05-01T08:00:00+00:00";
const PASSE = "2020-05-01T08:00:00+00:00";

function ligne(n: number, debut: string, surcharge: Record<string, unknown> = {}) {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    slug: `test-evenement-${n}`,
    titre_fr: `TEST_Titre FR ${n}`,
    titre_en: `TEST_Title EN ${n}`,
    lieu_fr: `TEST_Lieu FR ${n}`,
    lieu_en: `TEST_Venue EN ${n}`,
    debut_le: debut,
    images: [{ fichier: `evenements/00000000-0000-4000-8000-00000000000${n}.jpg`, alt_fr: "TEST_alt FR", alt_en: "TEST_alt EN" }],
    ...surcharge,
  };
}

const lignes = (debut: number, fin: number, date: string) => Array.from({ length: fin - debut }, (_, i) => ligne(debut + i + 1, date));
const etapesDe = (index: number) => faux.appels[index]?.etapes ?? [];
const noms = (index: number) => etapesDe(index).map((e) => e.nom);

beforeEach(() => {
  faux.appels = [];
  faux.parTable = {};
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle_publique");
});

describe("listerEvenementsPublies", () => {
  it("à venir d'abord puis passés, avec le texte de la langue et la photo", async () => {
    faux.parTable.evenement = [{ count: 1, error: null }, { data: [ligne(1, FUTUR)], error: null }, { data: [ligne(2, PASSE)], error: null }];
    const page = await listerEvenementsPublies("en", 0, { cumul: true });
    expect(page.nbAvenir).toBe(1);
    expect(page.evenements.map((e) => [e.id.slice(-1), e.passe])).toEqual([["1", false], ["2", true]]);
    expect(page.evenements[0]).toMatchObject({ titre: "TEST_Title EN 1", lieu: "TEST_Venue EN 1", vignetteAlt: "TEST_alt EN" });
    expect(page.evenements[0].vignetteUrl).toBe("http://127.0.0.1:54321/storage/v1/object/public/produits-public/evenements/00000000-0000-4000-8000-000000000001.jpg");
    expect(page.suite).toBeNull();
  });

  it("à venir par date croissante, passés par date décroissante, colonnes nommées (jamais « * », jamais auteur_id)", async () => {
    faux.parTable.evenement = [{ count: 1, error: null }, { data: [ligne(1, FUTUR)], error: null }, { data: [], error: null }];
    await listerEvenementsPublies("fr", 0, { cumul: true });
    const avenir = etapesDe(1);
    const passes = etapesDe(2);
    expect(avenir.find((e) => e.nom === "order" && e.args[0] === "debut_le")?.args[1]).toEqual({ ascending: true });
    expect(passes.find((e) => e.nom === "order" && e.args[0] === "debut_le")?.args[1]).toEqual({ ascending: false });
    for (const index of [0, 1, 2]) {
      const colonnes = String(etapesDe(index).find((e) => e.nom === "select")?.args[0]);
      expect(colonnes).not.toContain("*");
      expect(colonnes).not.toContain("auteur_id");
    }
  });

  it("12 par page : un 13e Événement donne une suite, jamais de suite devant rien", async () => {
    faux.parTable.evenement = [{ count: 0, error: null }, { data: lignes(0, 13, PASSE), error: null }];
    const page = await listerEvenementsPublies("fr", 0, { cumul: true });
    expect(page.evenements).toHaveLength(12);
    expect(page.suite).toBe(12);
    expect(page.evenements.every((e) => e.passe)).toBe(true);
    // Aucun Événement à venir : une seule lecture des passés, depuis le début.
    expect(etapesDe(1).find((e) => e.nom === "range")?.args).toEqual([0, 12]);

    faux.appels = [];
    faux.parTable.evenement = [{ count: 0, error: null }, { data: lignes(0, 12, PASSE), error: null }];
    expect((await listerEvenementsPublies("fr", 0, { cumul: true })).suite).toBeNull();
  });

  it("page suivante sans cumul : seulement les 12 suivants, lus à partir du bon rang dans les passés", async () => {
    faux.parTable.evenement = [{ count: 5, error: null }, { data: lignes(12, 14, PASSE), error: null }];
    const page = await listerEvenementsPublies("fr", 12);
    // Rang 12 : au-delà des 5 à venir, donc seulement la lecture des passés (rang 7 à 19 dans les passés).
    expect(faux.appels).toHaveLength(2);
    expect(etapesDe(1).find((e) => e.nom === "range")?.args).toEqual([7, 19]);
    expect(page.evenements).toHaveLength(2);
    expect(page.suite).toBeNull();
  });

  it("les Événements à venir qui chevauchent la page sont lus puis complétés par les passés", async () => {
    faux.parTable.evenement = [{ count: 10, error: null }, { data: lignes(0, 10, FUTUR), error: null }, { data: lignes(10, 13, PASSE), error: null }];
    const page = await listerEvenementsPublies("fr", 0, { cumul: true });
    expect(etapesDe(1).find((e) => e.nom === "range")?.args).toEqual([0, 9]);
    expect(etapesDe(2).find((e) => e.nom === "range")?.args).toEqual([0, 2]);
    expect(page.evenements).toHaveLength(12);
    expect(page.evenements.filter((e) => !e.passe)).toHaveLength(10);
    expect(page.suite).toBe(12);
  });

  it("une erreur de lecture est relancée, jamais une liste vide inventée", async () => {
    faux.parTable.evenement = [{ count: null, error: { message: "TEST_erreur" } }];
    await expect(listerEvenementsPublies("fr", 0, { cumul: true })).rejects.toThrow();
    faux.appels = [];
    faux.parTable.evenement = [{ count: 0, error: null }, { data: null, error: { message: "TEST_erreur" } }];
    await expect(listerEvenementsPublies("fr", 0, { cumul: true })).rejects.toThrow();
  });
});

describe("lireProchainEvenement", () => {
  it("le plus proche à venir, ou null quand il n'y en a aucun", async () => {
    faux.parTable.evenement = [{ data: [ligne(1, FUTUR)], error: null }];
    expect((await lireProchainEvenement("fr"))?.titre).toBe("TEST_Titre FR 1");
    expect(noms(0)).toContain("gte");
    faux.parTable.evenement = [{ data: [], error: null }];
    expect(await lireProchainEvenement("fr")).toBeNull();
  });

  it("une erreur de lecture est relancée (le bloc se masque)", async () => {
    faux.parTable.evenement = [{ data: null, error: { message: "TEST_erreur" } }];
    await expect(lireProchainEvenement("fr")).rejects.toThrow();
  });
});

describe("lireEvenementPublie", () => {
  const detail = {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "test-evenement-1",
    titre_fr: "TEST_Titre FR",
    titre_en: "TEST_Title EN",
    description_fr: "TEST_Programme FR",
    description_en: "TEST_Programme EN",
    lieu_fr: "TEST_Lieu FR",
    lieu_en: null,
    debut_le: PASSE,
    fin_le: null,
    images: [],
  };

  it("lit l'Événement et ses Types de pass dans l'ordre saisi, sans compteur ni quota", async () => {
    faux.parTable.evenement = [{ data: detail, error: null }];
    faux.parTable.type_pass = [
      {
        data: [
          { id: "t1", nom_fr: "TEST_Pass FR", nom_en: "TEST_Pass EN", prix_cents: 1500, inclus_fr: "TEST_a\nTEST_b", inclus_en: null, est_stand: false, ordre: 0 },
          { id: "t2", nom_fr: "TEST_Stand", nom_en: null, prix_cents: 5000, inclus_fr: null, inclus_en: null, est_stand: true, ordre: 1 },
        ],
        error: null,
      },
    ];
    const e = await lireEvenementPublie("en", "test-evenement-1");
    expect(e).toMatchObject({ titre: "TEST_Title EN", programme: "TEST_Programme EN", lieu: "TEST_Lieu FR", passe: true });
    expect(e?.types.map((t) => [t.nom, t.prixCents, t.inclus, t.estStand])).toEqual([
      ["TEST_Pass EN", 1500, "TEST_a\nTEST_b", false],
      ["TEST_Stand", 5000, null, true],
    ]);
    const colonnesTypes = String(faux.appels[1].etapes.find((x) => x.nom === "select")?.args[0]);
    expect(colonnesTypes).not.toContain("quota");
    expect(colonnesTypes).not.toContain("*");
    expect(String(faux.appels[0].etapes.find((x) => x.nom === "select")?.args[0])).not.toContain("auteur_id");
    expect(faux.appels[1].etapes.find((x) => x.nom === "order")?.args[0]).toBe("ordre");
  });

  it("inconnu ou non publié : null (404), sans lire les Types de pass", async () => {
    faux.parTable.evenement = [{ data: null, error: null }];
    expect(await lireEvenementPublie("fr", "inconnu")).toBeNull();
    expect(faux.appels).toHaveLength(1);
  });

  it("un Événement à venir n'est pas marqué passé", async () => {
    faux.parTable.evenement = [{ data: { ...detail, debut_le: FUTUR }, error: null }];
    faux.parTable.type_pass = [{ data: [], error: null }];
    expect((await lireEvenementPublie("fr", "test-evenement-1"))?.passe).toBe(false);
  });

  it("une erreur de lecture est relancée", async () => {
    faux.parTable.evenement = [{ data: null, error: { message: "TEST_erreur" } }];
    await expect(lireEvenementPublie("fr", "x")).rejects.toThrow();
    faux.parTable.evenement = [{ data: detail, error: null }];
    faux.parTable.type_pass = [{ data: null, error: { message: "TEST_erreur" } }];
    await expect(lireEvenementPublie("fr", "x")).rejects.toThrow();
  });
});
