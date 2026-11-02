import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Reponse = { data: unknown; error: unknown };

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));

const faux = vi.hoisted(() => ({
  appels: [] as Array<{ table: string; etapes: Array<{ nom: string; args: unknown[] }> }>,
  parTable: {} as Record<string, Reponse[]>,
}));

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
      for (const nom of ["select", "order", "eq", "neq", "not", "or"]) {
        b[nom] = (...args: unknown[]) => {
          etapes.push({ nom, args });
          return b;
        };
      }
      b.limit = async (...args: unknown[]) => {
        etapes.push({ nom: "limit", args });
        return reponse();
      };
      b.range = async (...args: unknown[]) => {
        etapes.push({ nom: "range", args });
        return reponse();
      };
      b.maybeSingle = async () => reponse();
      return b;
    },
  }),
}));

import {
  lireArticlePublie,
  lireDerniersArticles,
  lireProduitLie,
  lireSlugsArticlesPublies,
  lireSlugsSansVersionAnglaise,
  listerArticlesPublies,
} from "@/modules/blog/queries";
import { decoderCurseurArticles } from "@/modules/blog/adresse";
import type { CarteArticle } from "@/modules/blog/types";

const DATE = "2026-10-26 10:00:00+00";

function ligne(id: string, surcharge: Record<string, unknown> = {}) {
  return {
    id,
    slug: `article-${id}`,
    titre_fr: `Titre FR ${id}`,
    titre_en: `Title EN ${id}`,
    texte_fr: `Texte français ${id}`,
    texte_en: `English text ${id}`,
    publie_le: DATE,
    modifie_le: DATE,
    images: [],
    lien_produit_id: null,
    ...surcharge,
  };
}

const etapes = (table: string) => faux.appels.filter((a) => a.table === table).at(-1)?.etapes ?? [];
const noms = (table: string) => etapes(table).map((e) => e.nom);

beforeEach(() => {
  faux.appels = [];
  faux.parTable = {};
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle_publique");
});

afterEach(() => vi.unstubAllEnvs());

describe("listerArticlesPublies", () => {
  it("cartes : titre de la langue, date de publication, première image en vignette avec son texte alternatif", async () => {
    faux.parTable.article = [
      {
        data: [
          ligne("1", { images: [{ fichier: "blog/a b.jpg", alt_fr: "Alt FR", alt_en: "Alt EN" }] }),
          ligne("2", { titre_en: null, texte_en: null }),
        ],
        error: null,
      },
    ];
    const page = await listerArticlesPublies("fr", null);
    expect(page.articles).toEqual<CarteArticle[]>([
      {
        id: "1",
        slug: "article-1",
        titre: "Titre FR 1",
        publieLe: DATE,
        vignetteUrl: "http://127.0.0.1:54321/storage/v1/object/public/produits-public/blog/a%20b.jpg",
        vignetteAlt: "Alt FR",
      },
      { id: "2", slug: "article-2", titre: "Titre FR 2", publieLe: DATE, vignetteUrl: null, vignetteAlt: null },
    ]);
    expect(page.suite).toBeNull();
    // Tri fixe : du plus récent au plus ancien, identifiant en second.
    expect(etapes("article").filter((e) => e.nom === "order").map((e) => e.args[0])).toEqual(["publie_le", "id"]);
    expect(noms("article")).not.toContain("or");
  });

  it("sous /en, la version anglaise est exigée en base et le titre anglais est servi", async () => {
    faux.parTable.article = [{ data: [ligne("1", { images: [{ fichier: "x.jpg", alt_fr: "Alt FR", alt_en: "Alt EN" }] })], error: null }];
    const page = await listerArticlesPublies("en", null);
    expect(page.articles[0]).toMatchObject({ titre: "Title EN 1", vignetteAlt: "Alt EN" });
    // Filtre posé en base pour que la pagination reste exacte.
    const filtres = etapes("article").filter((e) => e.nom === "not" || e.nom === "neq");
    expect(filtres.length).toBeGreaterThanOrEqual(6);
    expect(JSON.stringify(filtres)).toContain("[Texte à fournir]");
  });

  it("une page pleine ouvre un curseur ; la page à curseur relit en cumul, sans filtre de clé", async () => {
    const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    const pleine = Array.from({ length: 13 }, (_, i) => ligne(uuid(i + 1)));
    faux.parTable.article = [{ data: pleine, error: null }];
    const page = await listerArticlesPublies("fr", null);
    expect(page.articles).toHaveLength(12);
    const curseur = decoderCurseurArticles(page.suite);
    expect(curseur).toEqual({ date: DATE, id: uuid(12), n: 12 });
    expect(etapes("article").find((e) => e.nom === "range")?.args).toEqual([0, 12]);

    faux.parTable.article = [{ data: pleine, error: null }];
    const suivante = await listerArticlesPublies("fr", curseur, { cumul: true });
    expect(etapes("article").find((e) => e.nom === "range")?.args).toEqual([0, 24]);
    expect(noms("article")).not.toContain("or");
    expect(suivante.articles).toHaveLength(13);
    expect(suivante.suite).toBeNull();
  });

  it("sans cumul (Server Action), le curseur pose la clé de tri et ne renvoie que la suite", async () => {
    faux.parTable.article = [{ data: [ligne("13"), ligne("14")], error: null }];
    const page = await listerArticlesPublies("fr", { date: DATE, id: "00000000-0000-4000-8000-000000000012", n: 12 });
    const filtre = etapes("article").find((e) => e.nom === "or");
    expect(filtre?.args[0]).toBe(`publie_le.lt.${DATE},and(publie_le.eq.${DATE},id.lt.00000000-0000-4000-8000-000000000012)`);
    expect(page.articles.map((a) => a.id)).toEqual(["13", "14"]);
  });

  it("les lignes sans slug ou sans date de publication ne sortent jamais", async () => {
    faux.parTable.article = [{ data: [ligne("1", { slug: null }), ligne("2", { publie_le: null }), ligne("3")], error: null }];
    expect((await listerArticlesPublies("fr", null)).articles.map((a) => a.id)).toEqual(["3"]);
  });

  it("lecture en erreur : relancée, jamais une liste vide inventée", async () => {
    faux.parTable.article = [{ data: null, error: { message: "TEST_panne" } }];
    await expect(listerArticlesPublies("fr", null)).rejects.toThrow("Lecture du blog impossible.");
  });
});

describe("lireDerniersArticles", () => {
  it("rend au plus la limite demandée (3 par défaut), sous les mêmes filtres de langue", async () => {
    faux.parTable.article = [{ data: [ligne("1"), ligne("2"), ligne("3")], error: null }];
    expect((await lireDerniersArticles("fr")).map((a) => a.id)).toEqual(["1", "2", "3"]);
    expect(etapes("article").find((e) => e.nom === "limit")?.args).toEqual([3]);
  });
});

describe("lireArticlePublie", () => {
  it("article français : texte et images de la langue, version anglaise signalée", async () => {
    faux.parTable.article = [
      {
        data: ligne("1", { images: [{ fichier: "a.jpg", alt_fr: "Alt FR", alt_en: "Alt EN" }] }),
        error: null,
      },
    ];
    const article = await lireArticlePublie("fr", "article-1");
    expect(article).toMatchObject({
      id: "1",
      slug: "article-1",
      titre: "Titre FR 1",
      texte: "Texte français 1",
      versionAnglaise: true,
      produitLie: null,
      images: [{ url: "http://127.0.0.1:54321/storage/v1/object/public/produits-public/a.jpg", alt: "Alt FR" }],
    });
  });

  it("sous /en, un article sans version anglaise n'existe pas (null, donc 404)", async () => {
    faux.parTable.article = [{ data: ligne("1", { titre_en: "[Texte à fournir]", texte_en: "[Texte à fournir]" }), error: null }];
    expect(await lireArticlePublie("en", "article-1")).toBeNull();
    // Aucune lecture du Produit lié : la page s'arrête avant.
    expect(faux.appels.some((a) => a.table === "produit")).toBe(false);
  });

  it("vue anglaise : titre, texte et texte alternatif anglais", async () => {
    faux.parTable.article = [
      { data: ligne("1", { images: [{ fichier: "a.jpg", alt_fr: "Alt FR", alt_en: "Alt EN" }] }), error: null },
    ];
    const article = await lireArticlePublie("en", "article-1");
    expect(article).toMatchObject({ titre: "Title EN 1", texte: "English text 1", versionAnglaise: true });
    expect(article?.images[0].alt).toBe("Alt EN");
  });

  it("brouillon, dépublié ou inconnu : null (la RLS ne montre que les publiés)", async () => {
    faux.parTable.article = [{ data: null, error: null }];
    expect(await lireArticlePublie("fr", "inconnu")).toBeNull();
  });

  it("produit lié publié : titre de la langue et famille ; brouillon ou famille inconnue : aucun lien", async () => {
    faux.parTable.article = [{ data: ligne("1", { lien_produit_id: "P1" }), error: null }];
    faux.parTable.produit = [{ data: { titre_fr: "Cosplay lié", titre_en: "Linked cosplay", slug: "cosplay-lie", famille: "cosplay" }, error: null }];
    expect((await lireArticlePublie("fr", "article-1"))?.produitLie).toEqual({ titre: "Cosplay lié", famille: "cosplay", slug: "cosplay-lie" });

    faux.parTable.article = [{ data: ligne("1", { lien_produit_id: "P1" }), error: null }];
    faux.parTable.produit = [{ data: null, error: null }];
    expect((await lireArticlePublie("fr", "article-1"))?.produitLie).toBeNull();

    faux.parTable.produit = [{ data: { titre_fr: "Test", titre_en: null, slug: "test", famille: "autre" }, error: null }];
    expect(await lireProduitLie("P1", "fr")).toBeNull();
  });

  it("lecture en erreur : relancée, jamais une page inventée", async () => {
    faux.parTable.article = [{ data: null, error: { message: "TEST_panne" } }];
    await expect(lireArticlePublie("fr", "article-1")).rejects.toThrow("Lecture de l'article impossible.");
  });
});

describe("plan du site", () => {
  it("liste les adresses publiées avec la présence de la version anglaise", async () => {
    faux.parTable.article = [{ data: [ligne("1"), ligne("2", { titre_en: null })], error: null }];
    expect(await lireSlugsArticlesPublies()).toEqual([
      { slug: "article-1", versionAnglaise: true },
      { slug: "article-2", versionAnglaise: false },
    ]);
  });

  it("articles français sans version anglaise, pour le sélecteur de langue", async () => {
    faux.parTable.article = [{ data: [ligne("1"), ligne("2", { texte_en: "" })], error: null }];
    expect(await lireSlugsSansVersionAnglaise()).toEqual(["article-2"]);
  });
});
