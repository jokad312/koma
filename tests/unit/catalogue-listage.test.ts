import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));

const faux = vi.hoisted(() => ({
  appels: [] as Array<{ nom: string; args: Record<string, unknown> }>,
  resultat: { data: null as unknown, error: null as unknown },
}));
vi.mock("@/lib/supabase/public", () => ({
  creerClientPublic: () => ({
    rpc: (nom: string, args: Record<string, unknown>) => {
      faux.appels.push({ nom, args });
      return Promise.resolve(faux.resultat);
    },
  }),
}));
vi.mock("@/lib/supabase/service", () => ({ creerClientService: () => ({}) }));

import { analyserRequete, decoderCurseur } from "@/modules/catalogue/adresse";
import { listerCatalogue } from "@/modules/catalogue/queries";
import { chargerPlusProduits } from "@/modules/catalogue/voir-plus";

const PARAMS_DEFAUT = analyserRequete({});

function ligne(n: number, surcharge: Record<string, unknown> = {}) {
  const id = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  return {
    id,
    slug: `test-produit-${n}`,
    famille: "cosplay",
    titre: `TEST_Titre ${n}`,
    photo_alt: `TEST_Alt ${n}`,
    photo_fichier: `${id}/a.jpg`,
    prix_cents: 1000 + n,
    univers_id: null,
    disponibilite: "disponible",
    curseur_date: `2026-10-26 10:00:${String(n).padStart(2, "0")}.5+00`,
    ...surcharge,
  };
}

beforeEach(() => {
  faux.appels = [];
  faux.resultat = { data: null, error: null };
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle_publique";
});

describe("listerCatalogue", () => {
  it("appelle lister_catalogue avec la famille, la langue et 13 lignes lues", async () => {
    faux.resultat = { data: [], error: null };
    await listerCatalogue("accessoire", PARAMS_DEFAUT, "en");
    expect(faux.appels).toHaveLength(1);
    expect(faux.appels[0].nom).toBe("lister_catalogue");
    expect(faux.appels[0].args).toMatchObject({ p_famille: "accessoire", p_langue: "en", p_tri: "nouveautes", p_limite: 13 });
  });

  it("transmet filtres, tri et curseur à la base (aucun calcul de prix ni de stock côté code)", async () => {
    faux.resultat = { data: [], error: null };
    const params = analyserRequete({ univers: "00000000-0000-4000-8000-0000000000aa", prix: "1500-3000", dispo: "sur_commande", tri: "prix_asc" });
    await listerCatalogue("cosplay", { ...params, curseur: { date: null, prix: 1500, id: "00000000-0000-4000-8000-000000000009", n: 12 } }, "fr");
    expect(faux.appels[0].args).toMatchObject({
      p_univers: "00000000-0000-4000-8000-0000000000aa",
      p_prix_bas: 1500,
      p_prix_haut: 3000,
      p_dispo: "sur_commande",
      p_tri: "prix_asc",
      p_curseur_prix: 1500,
      p_curseur_id: "00000000-0000-4000-8000-000000000009",
    });
  });

  it("12 produits et pas de suite quand la base en renvoie 12 ou moins", async () => {
    faux.resultat = { data: Array.from({ length: 12 }, (_, i) => ligne(i + 1)), error: null };
    const page = await listerCatalogue("cosplay", PARAMS_DEFAUT, "fr");
    expect(page.produits).toHaveLength(12);
    expect(page.suite).toBeNull();
  });

  it("13 lignes lues : 12 rendues, curseur construit sur la 12e (la 13e n'est pas rendue)", async () => {
    faux.resultat = { data: Array.from({ length: 13 }, (_, i) => ligne(i + 1)), error: null };
    const page = await listerCatalogue("cosplay", PARAMS_DEFAUT, "fr");
    expect(page.produits).toHaveLength(12);
    expect(page.produits.map((p) => p.slug)).not.toContain("test-produit-13");
    expect(decoderCurseur(page.suite, "nouveautes")).toEqual({
      date: "2026-10-26 10:00:12.5+00",
      prix: null,
      id: "00000000-0000-4000-8000-000000000012",
      n: 12,
    });
  });

  it("Server Action (clé de tri) : 12 suivants seulement, le curseur rendu cumule les produits déjà vus", async () => {
    faux.resultat = { data: Array.from({ length: 13 }, (_, i) => ligne(i + 13)), error: null };
    const params = { ...PARAMS_DEFAUT, curseur: { date: "2026-10-26 10:00:12.5+00", prix: null, id: "00000000-0000-4000-8000-000000000012", n: 12 } };
    const page = await listerCatalogue("cosplay", params, "fr");
    expect(faux.appels[0].args).toMatchObject({ p_curseur_id: "00000000-0000-4000-8000-000000000012", p_limite: 13 });
    expect(page.produits).toHaveLength(12);
    expect(decoderCurseur(page.suite, "nouveautes")).toMatchObject({ id: "00000000-0000-4000-8000-000000000024", n: 24 });
  });

  it("page à curseur (cumul) : relit depuis le début les n produits vus plus 12, sans clé de tri ni décalage", async () => {
    faux.resultat = { data: Array.from({ length: 37 }, (_, i) => ligne(i + 1)), error: null };
    const params = { ...PARAMS_DEFAUT, curseur: { date: "2026-10-26 10:00:24.5+00", prix: null, id: "00000000-0000-4000-8000-000000000024", n: 24 } };
    const page = await listerCatalogue("cosplay", params, "fr", { cumul: true });
    expect(faux.appels[0].args).toMatchObject({ p_limite: 37 });
    expect(faux.appels[0].args.p_curseur_id).toBeUndefined();
    expect(faux.appels[0].args.p_curseur_date).toBeUndefined();
    expect(faux.appels[0].args).not.toHaveProperty("offset");
    expect(page.produits).toHaveLength(36);
    expect(page.produits[0].slug).toBe("test-produit-1");
    expect(decoderCurseur(page.suite, "nouveautes")).toMatchObject({ id: "00000000-0000-4000-8000-000000000036", n: 36 });
  });

  it("cumul sans curseur : première page ordinaire", async () => {
    faux.resultat = { data: [], error: null };
    await listerCatalogue("cosplay", PARAMS_DEFAUT, "fr", { cumul: true });
    expect(faux.appels[0].args).toMatchObject({ p_limite: 13 });
  });

  it("cumul au plafond de 240 : plus de suite", async () => {
    faux.resultat = { data: Array.from({ length: 253 }, (_, i) => ligne(i + 1)), error: null };
    const params = { ...PARAMS_DEFAUT, curseur: { date: "2026-10-26 10:00:24.5+00", prix: null, id: "00000000-0000-4000-8000-000000000024", n: 240 } };
    const page = await listerCatalogue("cosplay", params, "fr", { cumul: true });
    expect(page.produits).toHaveLength(252);
    expect(page.suite).toBeNull();
  });

  it("curseur du tri par prix : porte le prix de la 12e ligne", async () => {
    faux.resultat = { data: Array.from({ length: 13 }, (_, i) => ligne(i + 1)), error: null };
    const page = await listerCatalogue("cosplay", analyserRequete({ tri: "prix_desc" }), "fr");
    expect(decoderCurseur(page.suite, "prix_desc")).toMatchObject({ prix: 1012, id: "00000000-0000-4000-8000-000000000012", n: 12 });
  });

  it("carte : titre, texte alternatif, adresse publique de la photo, prix, disponibilité, jamais de quantité", async () => {
    faux.resultat = { data: [ligne(1, { disponibilite: "complet" })], error: null };
    const { produits } = await listerCatalogue("cosplay", PARAMS_DEFAUT, "fr");
    expect(produits[0]).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      slug: "test-produit-1",
      famille: "cosplay",
      titre: "TEST_Titre 1",
      photoAlt: "TEST_Alt 1",
      photoUrl: "http://127.0.0.1:54321/storage/v1/object/public/produits-public/00000000-0000-4000-8000-000000000001/a.jpg",
      prixCents: 1001,
      disponibilite: "complet",
    });
    expect(JSON.stringify(produits)).not.toMatch(/stock|quantite/i);
  });

  it("lecture en erreur : relancée, jamais une liste vide inventée", async () => {
    faux.resultat = { data: null, error: { message: "TEST" } };
    await expect(listerCatalogue("cosplay", PARAMS_DEFAUT, "fr")).rejects.toThrow();
  });

  it("état de disponibilité inconnu : refusé", async () => {
    faux.resultat = { data: [ligne(1, { disponibilite: "etat_inconnu" })], error: null };
    await expect(listerCatalogue("cosplay", PARAMS_DEFAUT, "fr")).rejects.toThrow();
  });
});

describe("chargerPlusProduits (Server Action « Voir plus »)", () => {
  it("renvoie les produits suivants, la requête du navigateur étant analysée", async () => {
    faux.resultat = { data: [ligne(1)], error: null };
    const r = await chargerPlusProduits("cosplay", "tri=prix_asc&dispo=en_stock", "fr");
    expect(r.ok).toBe(true);
    expect(faux.appels[0].args).toMatchObject({ p_famille: "cosplay", p_tri: "prix_asc", p_dispo: "en_stock" });
  });

  it("refuse une famille ou une langue inconnue sans appeler la base", async () => {
    expect(await chargerPlusProduits("kit", "", "fr")).toEqual({ ok: false });
    expect(await chargerPlusProduits("cosplay", "", "de")).toEqual({ ok: false });
    expect(await chargerPlusProduits("cosplay", "x".repeat(1001), "fr")).toEqual({ ok: false });
    expect(faux.appels).toHaveLength(0);
  });

  it("une requête mal formée ne fait pas échouer l'action", async () => {
    faux.resultat = { data: [], error: null };
    expect((await chargerPlusProduits("accessoire", "tri=hasard&curseur=!!!&univers=x", "en")).ok).toBe(true);
  });

  it("base indisponible : { ok: false }, pas d'exception", async () => {
    faux.resultat = { data: null, error: { message: "TEST" } };
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await chargerPlusProduits("cosplay", "", "fr")).toEqual({ ok: false });
    erreur.mockRestore();
  });
});
