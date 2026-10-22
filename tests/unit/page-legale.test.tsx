// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rendre } from "./aides-dom";

const etat = vi.hoisted(() => ({ version: "2026-11-01", texte: "Premier paragraphe.\nLigne suivante.\n\nSecond paragraphe." }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/seo/url", () => ({ urlLocalisee: (l: string, c: string) => `http://test/${l}${c}` }));
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: async ({ locale, namespace }: { locale: string; namespace: string }) => {
      const messages = {
        Legal: { versionDu: "Version du", cgv: { titre: "CGV test", get texte() { return etat.texte; }, get version() { return etat.version; } } },
        Metadata: { legal: { cgv: { titre: "Meta", description: "Desc" } } },
      };
      return createTranslator({ locale, messages, namespace: namespace as never });
    },
  };
});

import { PageLegale } from "@/components/vitrine/PageLegale";

describe("PageLegale", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "TEST_cle_publique");
  });

  it("version ISO : un seul time datetime formaté, deux paragraphes", async () => {
    etat.version = "2026-11-01";
    etat.texte = "Premier paragraphe.\nLigne suivante.\n\nSecond paragraphe.";
    const { container } = rendre(await PageLegale({ locale: "fr", cle: "cgv" }));
    const temps = container.querySelectorAll('time[datetime="2026-11-01"]');
    expect(temps).toHaveLength(1);
    expect(temps[0].textContent).toBe("1 novembre 2026");
    expect(container.querySelectorAll("article p")).toHaveLength(3); // version + 2 paragraphes
    expect(container.querySelectorAll("article > div > p")).toHaveLength(2);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("CGV test");
  });

  it("marqueur : version affichée telle quelle, sans time", async () => {
    etat.version = "[Texte à fournir]";
    etat.texte = "[Texte à fournir]";
    const { container } = rendre(await PageLegale({ locale: "fr", cle: "cgv" }));
    expect(container.querySelector("time")).toBeNull();
    expect(container.textContent).toContain("Version du [Texte à fournir]");
  });
});
