import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ resultat: { data: null as unknown, error: null as unknown }, cles: [] as string[] }));
const etiquettes = vi.hoisted(() => [] as string[]);
vi.mock("next/cache", () => ({ cacheTag: (e: string) => etiquettes.push(e) }));
vi.mock("@/lib/supabase/public", () => ({
  creerClientPublic: () => ({
    from: () => ({
      select: () => ({
        eq: (_colonne: string, cle: string) => {
          faux.cles.push(cle);
          return { maybeSingle: async () => faux.resultat };
        },
      }),
    }),
  }),
}));

import { lireForfaitLivraison, lireRetraitGoma } from "@/lib/reglages";

beforeEach(() => {
  faux.cles = [];
  etiquettes.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("lireForfaitLivraison", () => {
  it("lit la bonne clé et renvoie des centimes", async () => {
    faux.resultat = { data: { valeur: "550" }, error: null };
    expect(await lireForfaitLivraison("goma")).toBe(550);
    expect(await lireForfaitLivraison("bukavu")).toBe(550);
    expect(faux.cles).toEqual(["forfait_livraison_goma_cents", "forfait_livraison_bukavu_cents"]);
  });
  it("zéro (livraison gratuite) reste zéro, jamais null", async () => {
    faux.resultat = { data: { valeur: "0" }, error: null };
    expect(await lireForfaitLivraison("goma")).toBe(0);
  });
  it("jamais saisi, vide ou illisible : null, aucun forfait inventé", async () => {
    for (const data of [null, { valeur: null }, { valeur: " " }, { valeur: "abc" }]) {
      faux.resultat = { data, error: null };
      expect(await lireForfaitLivraison("goma")).toBeNull();
    }
  });
  it("erreur de lecture : relancée", async () => {
    faux.resultat = { data: null, error: { message: "boum" } };
    await expect(lireForfaitLivraison("goma")).rejects.toThrow();
  });
});

describe("étiquette de cache", () => {
  it("les deux lecteurs sont étiquetés « reglages »", async () => {
    faux.resultat = { data: { valeur: "1" }, error: null };
    await lireForfaitLivraison("goma");
    await lireRetraitGoma("fr");
    expect(etiquettes).toEqual(["reglages", "reglages"]);
  });
  it("forfait au-dessus de 100 000 centimes : null (plafond de la base)", async () => {
    faux.resultat = { data: { valeur: "100001" }, error: null };
    expect(await lireForfaitLivraison("goma")).toBeNull();
    faux.resultat = { data: { valeur: "100000" }, error: null };
    expect(await lireForfaitLivraison("goma")).toBe(100000);
  });
});

describe("lireRetraitGoma", () => {
  it("lit la clé de la langue demandée", async () => {
    faux.resultat = { data: { valeur: "Texte de test" }, error: null };
    expect(await lireRetraitGoma("fr")).toBe("Texte de test");
    expect(await lireRetraitGoma("en")).toBe("Texte de test");
    expect(faux.cles).toEqual(["retrait_goma_fr", "retrait_goma_en"]);
  });
  it("jamais saisi : null, aucun texte de repli", async () => {
    faux.resultat = { data: null, error: null };
    expect(await lireRetraitGoma("fr")).toBeNull();
  });
  it("erreur de lecture : relancée", async () => {
    faux.resultat = { data: null, error: { message: "boum" } };
    await expect(lireRetraitGoma("en")).rejects.toThrow();
  });
});
