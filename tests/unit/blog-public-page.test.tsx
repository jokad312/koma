import { NextIntlClientProvider } from "next-intl";
import { prerender } from "react-dom/static";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const faux = vi.hoisted(() => ({ lister: vi.fn(), article: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  notFound: () => {
    throw new Error("TEST_NOT_FOUND");
  },
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    setRequestLocale: () => undefined,
    getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) =>
      createTranslator({ locale, messages: locale === "fr" ? fr : en, namespace: namespace as never }),
  };
});
vi.mock("@/lib/reglages", () => ({ lireNomSite: async () => "TEST_Boutique" }));
vi.mock("@/modules/blog/queries", () => ({
  listerArticlesPublies: (...a: unknown[]) => faux.lister(...a),
  lireArticlePublie: (...a: unknown[]) => faux.article(...a),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));

import Blog, { generateMetadata as metadataBlog } from "@/app/[locale]/blog/page";
import Article, { generateMetadata as metadataArticle } from "@/app/[locale]/blog/[slug]/page";
import { encoderCurseurArticles } from "@/modules/blog/adresse";
import type { ArticlePublic, CarteArticle, PageArticles } from "@/modules/blog/types";

const DATE = "2026-10-26T10:00:00+00:00";
const CURSEUR = encoderCurseurArticles({ date: DATE, id: "00000000-0000-4000-8000-000000000012", n: 12 });

function carte(n: number, surcharge: Partial<CarteArticle> = {}): CarteArticle {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    slug: `test-article-${n}`,
    titre: `TEST_Titre ${n}`,
    publieLe: DATE,
    vignetteUrl: n % 2 === 0 ? `http://127.0.0.1:54321/storage/v1/object/public/produits-public/${n}.jpg` : null,
    vignetteAlt: n % 2 === 0 ? `TEST_Alt ${n}` : null,
    ...surcharge,
  };
}

function pageArticles(surcharge: Partial<PageArticles> = {}): PageArticles {
  return { articles: [carte(1), carte(2)], suite: null, ...surcharge };
}

function articlePublic(surcharge: Partial<ArticlePublic> = {}): ArticlePublic {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "test-article",
    titre: "TEST_Titre article",
    texte: "# Sous-titre\n\nUn **texte** de test avec [un lien](/blog) et une image ![Alt](https://exemple.test/a.jpg).",
    publieLe: DATE,
    modifieLe: DATE,
    images: [],
    produitLie: null,
    versionAnglaise: true,
    ...surcharge,
  };
}

async function html(element: ReactElement, locale: "fr" | "en" = "fr"): Promise<string> {
  const { prelude } = await prerender(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      {element}
    </NextIntlClientProvider>,
  );
  const lecteur = prelude.getReader();
  const morceaux: string[] = [];
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    morceaux.push(new TextDecoder().decode(value));
  }
  return morceaux.join("");
}

const params = (locale: "fr" | "en", slug = "test-article") => Promise.resolve({ locale, slug });
const recherche = (valeur: Record<string, string> = {}) => Promise.resolve(valeur);
// Les pages dynamiques reçoivent aussi searchParams (types générés) : un objet vide suffit ici.
const propsArticle = (locale: "fr" | "en", slug?: string) => ({ params: params(locale, slug), searchParams: recherche() }) as never;

beforeEach(() => {
  faux.lister.mockReset().mockResolvedValue(pageArticles());
  faux.article.mockReset().mockResolvedValue(articlePublic());
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle_publique";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("page /blog", () => {
  it("titre H1, liens vers les Articles, date et vignette avec texte alternatif", async () => {
    const page = await html(await Blog({ params: params("fr") as never, searchParams: recherche() as never }));
    expect((page.match(/<h1/g) ?? []).length).toBe(1);
    expect(page).toContain(">Blog<");
    expect(page).toContain('href="/fr/blog/test-article-1"');
    expect(page).toContain('href="/fr/blog/test-article-2"');
    expect(page).toContain('alt="TEST_Alt 2"');
    expect(page).toContain("26 octobre 2026");
  });

  it("aucun Article : message sobre et retour à l'accueil, jamais de liste vide sans explication", async () => {
    faux.lister.mockResolvedValue({ articles: [], suite: null });
    const page = await html(await Blog({ params: params("fr") as never, searchParams: recherche() as never }));
    expect(page).toContain("Aucun article pour le moment.");
    expect(page).toContain("Retour à l&#x27;accueil");
  });

  it("« Voir plus » : un vrai lien portant le curseur de la suite", async () => {
    faux.lister.mockResolvedValue(pageArticles({ suite: CURSEUR }));
    const page = await html(await Blog({ params: params("fr") as never, searchParams: recherche() as never }));
    expect(page).toContain(`href="/fr/blog?curseur=${CURSEUR}"`);
    expect(page).toContain("Voir plus");
  });

  it("curseur périmé : la première page est servie, avec la requête du curseur", async () => {
    faux.lister.mockResolvedValueOnce({ articles: [], suite: null }).mockResolvedValueOnce(pageArticles());
    const page = await html(await Blog({ params: params("fr") as never, searchParams: recherche({ curseur: CURSEUR }) as never }));
    expect(page).toContain("TEST_Titre 1");
    expect(faux.lister).toHaveBeenLastCalledWith("fr", null);
  });

  it("lecture impossible : message d'erreur, jamais une liste inventée", async () => {
    faux.lister.mockRejectedValue(new Error("TEST_panne"));
    const page = await html(await Blog({ params: params("fr") as never, searchParams: recherche() as never }));
    expect(page).toContain("Un problème est survenu.");
    expect(page).not.toContain("TEST_Titre");
  });

  it("métadonnées de la première page : indexable, canonique /fr/blog ; sous /en, adresse /en/blog", async () => {
    const meta = await metadataBlog({ params: params("fr") as never, searchParams: recherche() as never });
    expect(meta.title).toBe("Blog | TEST_Boutique");
    expect(meta.description).toBe("Guides de cosplay, tutoriels de fabrication et actualités, fait main à Goma.");
    expect(meta.alternates?.canonical).toBe("http://localhost:3000/fr/blog");
    expect(meta.robots).toBeUndefined();

    const metaEn = await metadataBlog({ params: params("en") as never, searchParams: recherche() as never });
    expect(metaEn.alternates?.canonical).toBe("http://localhost:3000/en/blog");
  });

  it("métadonnées d'une page à curseur : noindex, follow, sans canonique", async () => {
    faux.lister.mockResolvedValue(pageArticles());
    const meta = await metadataBlog({ params: params("fr") as never, searchParams: recherche({ curseur: CURSEUR }) as never });
    expect(meta.robots).toEqual({ index: false, follow: true });
    expect(meta.alternates).toBeUndefined();
  });
});

describe("page /blog/[slug]", () => {
  it("Article complet : H1, date, fil d'Ariane, texte rendu, galerie avec texte alternatif", async () => {
    faux.article.mockResolvedValue(
      articlePublic({ images: [{ url: "https://exemple.test/galerie.jpg", alt: "TEST_Alt galerie" }] }),
    );
    const page = await html(await Article(propsArticle("fr")));
    expect((page.match(/<h1/g) ?? []).length).toBe(1);
    expect(page).toContain("TEST_Titre article");
    expect(page).toContain("26 octobre 2026");
    expect(page).toContain('aria-label="Fil d&#x27;Ariane"');
    expect(page).toContain('href="/fr/blog"');
    expect(page).toContain("<h2>Sous-titre</h2>");
    expect(page).toContain("<strong>texte</strong>");
    expect(page).toContain('src="https://exemple.test/galerie.jpg"');
    expect(page).toContain('alt="TEST_Alt galerie"');
  });

  it("Produit lié : le lien porte le titre du Produit, à l'adresse propre de sa famille", async () => {
    faux.article.mockResolvedValue(articlePublic({ produitLie: { titre: "TEST_Produit lié", famille: "accessoire", slug: "test-lie" } }));
    const page = await html(await Article(propsArticle("en")), "en");
    expect(page).toContain('href="/en/accessories/test-lie"');
    expect(page).toContain("TEST_Produit lié");
  });

  it("Article inconnu ou sans version anglaise : 404", async () => {
    faux.article.mockResolvedValue(null);
    await expect(Article(propsArticle("en"))).rejects.toThrow("TEST_NOT_FOUND");
    await expect(metadataArticle(propsArticle("en"))).rejects.toThrow("TEST_NOT_FOUND");
  });

  it("métadonnées : description extraite du texte, première image en Open Graph, hreflang limité aux versions servies", async () => {
    const meta = await metadataArticle(propsArticle("fr"));
    expect(meta.title).toBe("TEST_Titre article | TEST_Boutique");
    expect(meta.description).toContain("Sous-titre");
    expect(meta.openGraph?.images).toBeUndefined();
    expect(meta.alternates?.languages).toEqual({
      fr: "http://localhost:3000/fr/blog/test-article",
      en: "http://localhost:3000/en/blog/test-article",
      "x-default": "http://localhost:3000/fr/blog/test-article",
    });

    faux.article.mockResolvedValue(articlePublic({ versionAnglaise: false, images: [{ url: "https://exemple.test/a.jpg", alt: "TEST_Alt" }] }));
    const seule = await metadataArticle(propsArticle("fr"));
    expect(seule.openGraph?.images).toEqual([{ url: "https://exemple.test/a.jpg", alt: "TEST_Alt" }]);
    expect(seule.alternates?.languages).toEqual({
      fr: "http://localhost:3000/fr/blog/test-article",
      "x-default": "http://localhost:3000/fr/blog/test-article",
    });
  });

  it("lecture impossible : page non indexée, puis message d'erreur sans contenu inventé", async () => {
    faux.article.mockRejectedValue(new Error("TEST_panne"));
    const meta = await metadataArticle(propsArticle("fr"));
    expect(meta.robots).toEqual({ index: false, follow: false });
    const page = await html(await Article(propsArticle("fr")));
    expect(page).toContain("Un problème est survenu.");
  });
});
