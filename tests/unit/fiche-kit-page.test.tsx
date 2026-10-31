import { NextIntlClientProvider } from "next-intl";
import { prerender } from "react-dom/static";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fr from "../../messages/fr.json";
import en from "../../messages/en.json";

const faux = vi.hoisted(() => ({ fiche: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("TEST_NOT_FOUND");
  },
}));
vi.mock("@/modules/catalogue/queries", () => ({ lireFicheKit: (...a: unknown[]) => faux.fiche(...a) }));
vi.mock("@/lib/reglages", () => ({ lireNomSite: async () => "TEST_Boutique" }));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ href, children, ...reste }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...reste}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} />
  ),
}));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) =>
      createTranslator({ locale, messages: locale === "fr" ? fr : en, namespace: namespace as never }),
  };
});

import { metadataFicheKit, PageFicheKit } from "@/components/fiche/PageFicheKit";
import type { FicheKit } from "@/modules/catalogue/types";

const EXTRAIT = "00000000-0000-4000-8000-0000000000e9";

function fiche(surcharge: Partial<FicheKit> = {}): FicheKit {
  return {
    id: "TEST_k1",
    slug: "test-kit",
    titre: "TEST_Kit",
    description: "TEST_Description du kit.",
    materiel: "TEST_Mousse",
    prixCents: 990,
    niveau: "debutant",
    photos: [
      { url: "http://127.0.0.1:54321/storage/v1/object/public/produits-public/k1/a.jpg", alt: "TEST_Alt 1" },
      { url: "http://127.0.0.1:54321/storage/v1/object/public/produits-public/k1/b.jpg", alt: "TEST_Alt 2" },
    ],
    fichiers: [],
    chapitres: [],
    sousTitres: ["fr"],
    dureeSecondes: 600,
    extrait: { id: EXTRAIT, sousTitres: ["fr"], sansParole: false, enregistreLe: "2026-10-31T10:00:00Z" },
    ...surcharge,
  };
}

async function html(element: ReactElement, locale: "fr" | "en" = "fr"): Promise<string> {
  const { prelude } = await prerender(
    <NextIntlClientProvider locale={locale} timeZone="UTC" messages={locale === "fr" ? fr : en}>
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

beforeEach(() => {
  faux.fiche.mockReset();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle_publique");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("metadataFicheKit", () => {
  it("canonique et hreflang /kits/<slug>, og:image = première photo, titre et description", async () => {
    faux.fiche.mockResolvedValue(fiche());
    const m = await metadataFicheKit({ locale: "en", slug: "test-kit" });
    expect(m.title).toBe("TEST_Kit | TEST_Boutique");
    expect(m.description).toBe("TEST_Description du kit.");
    expect(m.alternates?.canonical).toBe("http://localhost:3000/en/kits/test-kit");
    expect(m.alternates?.languages).toMatchObject({
      fr: "http://localhost:3000/fr/kits/test-kit",
      en: "http://localhost:3000/en/kits/test-kit",
      "x-default": "http://localhost:3000/fr/kits/test-kit",
    });
    expect(m.openGraph?.images).toEqual([{ url: fiche().photos[0].url, alt: "TEST_Alt 1" }]);
    expect(faux.fiche).toHaveBeenCalledWith("test-kit", "en");
  });

  it("Kit introuvable : notFound ; lecture impossible : noindex", async () => {
    faux.fiche.mockResolvedValue(null);
    await expect(metadataFicheKit({ locale: "fr", slug: "absent" })).rejects.toThrow("TEST_NOT_FOUND");
    faux.fiche.mockRejectedValue(new Error("TEST_panne"));
    expect((await metadataFicheKit({ locale: "fr", slug: "test-kit" })).robots).toEqual({ index: false, follow: false });
  });
});

describe("PageFicheKit", () => {
  it("Kit introuvable : notFound ; lecture impossible : message d'erreur, jamais une fiche inventée", async () => {
    faux.fiche.mockResolvedValue(null);
    await expect(PageFicheKit({ locale: "fr", slug: "absent" })).rejects.toThrow("TEST_NOT_FOUND");
    faux.fiche.mockRejectedValue(new Error("TEST_panne"));
    const rendu = await html(await PageFicheKit({ locale: "fr", slug: "test-kit" }));
    expect(rendu).toContain(fr.Fiche.erreur.replace(/'/g, "&#x27;"));
    expect(rendu).not.toContain("TEST_Kit");
  });

  it("lecteur rendu quand NEXT_PUBLIC_BUNNY_PUBLIC_CDN_HOSTNAME est réglé ; absent sinon", async () => {
    faux.fiche.mockResolvedValue(fiche());
    vi.stubEnv("NEXT_PUBLIC_BUNNY_PUBLIC_CDN_HOSTNAME", "vz-test.b-cdn.net");
    let rendu = await html(await PageFicheKit({ locale: "fr", slug: "test-kit" }));
    expect(rendu).toContain("<video");
    expect(rendu).toContain(`poster="https://vz-test.b-cdn.net/${EXTRAIT}/thumbnail.jpg"`);
    vi.stubEnv("NEXT_PUBLIC_BUNNY_PUBLIC_CDN_HOSTNAME", "");
    rendu = await html(await PageFicheKit({ locale: "fr", slug: "test-kit" }));
    expect(rendu).not.toContain("<video");
    expect(rendu).toContain("TEST_Kit");
  });
});
