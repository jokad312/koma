import { beforeEach, describe, expect, it, vi } from "vitest";

const faux = vi.hoisted(() => ({ page: vi.fn(), meta: vi.fn() }));
vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("@/components/fiche/PageFiche", () => ({
  PageFiche: (props: unknown) => faux.page(props),
  metadataFiche: (props: unknown) => faux.meta(props),
}));

import { generateMetadata as metaAccessoire } from "@/app/[locale]/accessoires/[slug]/page";
import FicheAccessoire from "@/app/[locale]/accessoires/[slug]/page";
import { generateMetadata as metaCosplay } from "@/app/[locale]/cosplays/[slug]/page";
import FicheCosplay from "@/app/[locale]/cosplays/[slug]/page";

beforeEach(() => {
  faux.page.mockReset().mockReturnValue(null);
  faux.meta.mockReset().mockResolvedValue({});
});

const params = (locale: string) => ({ params: Promise.resolve({ locale, slug: "test-slug" }) }) as never;

describe("routes de fiche : la famille vient du dossier de la route", () => {
  it("cosplays/[slug] : cosplay, pour la page et pour generateMetadata", async () => {
    const page = (await FicheCosplay(params("fr"))) as { props: unknown };
    await metaCosplay(params("en"));
    expect(page.props).toMatchObject({ famille: "cosplay", locale: "fr", slug: "test-slug" });
    expect(faux.meta.mock.calls[0][0]).toMatchObject({ famille: "cosplay", locale: "en", slug: "test-slug" });
  });

  it("accessoires/[slug] : accessoire, pour la page et pour generateMetadata", async () => {
    const page = (await FicheAccessoire(params("en"))) as { props: unknown };
    await metaAccessoire(params("fr"));
    expect(page.props).toMatchObject({ famille: "accessoire", locale: "en", slug: "test-slug" });
    expect(faux.meta.mock.calls[0][0]).toMatchObject({ famille: "accessoire", locale: "fr", slug: "test-slug" });
  });
});
