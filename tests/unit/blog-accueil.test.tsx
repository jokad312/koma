import { NextIntlClientProvider } from "next-intl";
import { prerender } from "react-dom/static";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

const faux = vi.hoisted(() => ({ derniers: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ cacheTag: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => undefined }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: "fr" | "en"; namespace: string }) =>
      createTranslator({ locale, messages: locale === "fr" ? fr : en, namespace: namespace as never }),
  };
});
vi.mock("@/modules/blog/queries", () => ({ lireDerniersArticles: (...a: unknown[]) => faux.derniers(...a) }));
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

import { BlocGuides } from "@/components/accueil/BlocGuides";

function carte(n: number) {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    slug: `test-article-${n}`,
    titre: `TEST_Titre ${n}`,
    publieLe: "2026-10-26T10:00:00+00:00",
    vignetteUrl: null,
    vignetteAlt: null,
  };
}

async function html(element: ReactElement | null, locale: "fr" | "en" = "fr"): Promise<string> {
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

beforeEach(() => {
  faux.derniers.mockReset();
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle_publique";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("bloc 7 « Guides » de l'accueil", () => {
  it("trois Articles au plus, en h3 sous le H2 « GUIDES », sans lien « Voir tous »", async () => {
    faux.derniers.mockResolvedValue([carte(1), carte(2), carte(3)]);
    const page = await html(await BlocGuides({ locale: "fr" }));
    expect(faux.derniers).toHaveBeenCalledWith("fr", 3);
    expect(page).toContain(">GUIDES<");
    expect((page.match(/<h2/g) ?? []).length).toBe(1);
    expect((page.match(/<h3/g) ?? []).length).toBe(3);
    expect(page).toContain('href="/blog/test-article-1"');
    expect(page).not.toMatch(/Voir tous les articles/i);
  });

  it("aucun Article publié : le bloc ne rend rien du tout", async () => {
    faux.derniers.mockResolvedValue([]);
    expect(await BlocGuides({ locale: "fr" })).toBeNull();
  });

  it("lecture en erreur : bloc masqué, erreur journalisée", async () => {
    faux.derniers.mockRejectedValue(new Error("TEST_panne"));
    expect(await BlocGuides({ locale: "fr" })).toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
