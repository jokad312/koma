import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Story 9.16 g) : lecture de la liste admin du blog (vignette, extrait de 160 caractères sans Markdown, archivage) et extrait de la carte.
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));

const faux = vi.hoisted(() => ({ select: "", reponse: { data: null as unknown, error: null as unknown } }));
vi.mock("@/lib/supabase/service", () => ({
  creerClientService: () => ({
    from: () => {
      const b = {
        select: (colonnes: string) => {
          faux.select = colonnes;
          return b;
        },
        order: async () => faux.reponse,
        eq: () => b,
        maybeSingle: async () => faux.reponse,
      };
      return b;
    },
  }),
}));

import { lireArticleAdmin, lireArticlesAdmin } from "@/modules/blog/queries";
import { extraitCarte } from "@/modules/blog/texte";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle_publique");
});
afterEach(() => vi.unstubAllEnvs());

// Texte Markdown de 400 caractères : titre, gras, lien, puce, image.
const MOT = "otaku ";
const MARKDOWN = `# Titre\n\n**Gras** et [lien](https://test.invalid) puis ![image](a.jpg)\n\n- ${MOT.repeat(80)}`.slice(0, 400);

describe("extraitCarte (Q28)", () => {
  it("contenu Markdown de 400 caractères : 160 caractères de texte, sans syntaxe Markdown, puis « … »", () => {
    expect(MARKDOWN.length).toBe(400);
    const extrait = extraitCarte(MARKDOWN)!;
    expect(extrait.endsWith("…")).toBe(true);
    const texte = extrait.slice(0, -1);
    expect(Array.from(texte).length).toBeLessThanOrEqual(160);
    expect(Array.from(texte).length).toBeGreaterThanOrEqual(159);
    expect(texte).not.toMatch(/[#*[\]()!]|https?:/);
    expect(texte.startsWith("Titre Gras et lien puis otaku")).toBe(true);
  });

  it("texte court : rendu entier ; vide ou marqueur : null", () => {
    expect(extraitCarte("Un **court** texte")).toBe("Un court texte");
    expect(extraitCarte(null)).toBeNull();
    expect(extraitCarte("   ")).toBeNull();
    expect(extraitCarte("[Texte à fournir]")).toBeNull();
  });
});

describe("lireArticlesAdmin (9.16 g)", () => {
  it("lit l'archivage, la première image et l'extrait ; jamais le texte entier", async () => {
    faux.reponse = {
      data: [
        {
          id: "TEST_1",
          titre_fr: "TEST_ titre",
          slug: "test-1",
          publie_le: null,
          modifie_le: "2026-11-10T00:00:00Z",
          archive_le: "2026-11-11T00:00:00Z",
          images: [{ fichier: "articles/a.jpg", alt_fr: "TEST_ alt", alt_en: "TEST_ alt en" }, { fichier: "articles/b.jpg", alt_fr: "TEST_ b", alt_en: "TEST_ b" }],
          texte_fr: MARKDOWN,
        },
        // Brouillon dont la première image n'a pas encore de texte alternatif : l'image est montrée, avec le titre comme texte alternatif.
        {
          id: "TEST_3",
          titre_fr: "TEST_ titre 3",
          slug: "test-3",
          publie_le: null,
          modifie_le: "2026-11-10T00:00:00Z",
          archive_le: null,
          images: [{ fichier: "articles/sans-alt.jpg", alt_fr: "  " }, { fichier: "articles/c.jpg", alt_fr: "TEST_ c", alt_en: "TEST_ c" }],
          texte_fr: null,
        },
        { id: "TEST_2", titre_fr: "TEST_ 2", slug: "test-2", publie_le: null, modifie_le: "2026-11-10T00:00:00Z", archive_le: null, images: [], texte_fr: null },
      ],
      error: null,
    };
    const [a, c, b] = await lireArticlesAdmin();
    expect(faux.select).toContain("archive_le");
    expect(a.archiveLe).toBe("2026-11-11T00:00:00Z");
    expect(a.vignette).toEqual({ url: expect.stringContaining("articles/a.jpg"), alt: "TEST_ alt" });
    expect(a.extrait).toBe(extraitCarte(MARKDOWN));
    expect(a).not.toHaveProperty("texteFr");
    expect(c.vignette).toEqual({ url: expect.stringContaining("articles/sans-alt.jpg"), alt: "TEST_ titre 3" });
    expect(b.vignette).toBeNull();
    expect(b.extrait).toBeNull();
  });

  it("erreur de lecture : relancée, jamais une liste vide inventée", async () => {
    faux.reponse = { data: null, error: { message: "TEST_panne" } };
    await expect(lireArticlesAdmin()).rejects.toThrow();
  });

  // Story 9.16 h) : l'extrait saisi est utilisé tel quel ; vide, les 160 premiers caractères du texte.
  it("extrait rempli : utilisé tel quel sur la carte ; vide : début du texte", async () => {
    const base = { titre_fr: "TEST_", slug: null, publie_le: null, modifie_le: "2026-11-10T00:00:00Z", archive_le: null, images: [], texte_fr: MARKDOWN };
    faux.reponse = {
      data: [
        { ...base, id: "TEST_e1", extrait_fr: "  TEST_ résumé saisi  " },
        { ...base, id: "TEST_e2", extrait_fr: null },
      ],
      error: null,
    };
    const [avec, sans] = await lireArticlesAdmin();
    expect(faux.select).toContain("extrait_fr");
    expect(avec.extrait).toBe("TEST_ résumé saisi");
    expect(sans.extrait).toBe(extraitCarte(MARKDOWN));
  });
});

describe("lireArticleAdmin (9.16 g)", () => {
  it("lit archiveLe depuis archive_le (null si non archivé)", async () => {
    const ligne = {
      id: "TEST_1",
      auteur_id: "TEST_auteur",
      titre_fr: "TEST_ titre",
      titre_en: null,
      texte_fr: "TEST_ texte",
      texte_en: null,
      slug: "test-1",
      lien_produit_id: null,
      images: [],
      publie_le: null,
      cree_le: "2026-11-01T00:00:00Z",
      modifie_le: "2026-11-10T00:00:00Z",
      archive_le: "2026-11-11T00:00:00Z",
    };
    faux.reponse = { data: ligne, error: null };
    expect((await lireArticleAdmin("TEST_1"))?.archiveLe).toBe("2026-11-11T00:00:00Z");
    expect(faux.select).toContain("archive_le");
    faux.reponse = { data: { ...ligne, archive_le: null }, error: null };
    expect((await lireArticleAdmin("TEST_1"))?.archiveLe).toBeNull();
  });
});
