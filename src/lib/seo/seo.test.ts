import { beforeEach, describe, expect, it } from "vitest";
import { organisationJsonLd, serialiserJsonLd } from "./jsonld";
import { construireMetadata } from "./metadata";
import { alternatives } from "./url";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000/";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle_publique";
});

describe("SEO", () => {
  it("hreflang : fr, en et x-default vers /fr, depuis NEXT_PUBLIC_SITE_URL", () => {
    expect(alternatives("")).toEqual({
      fr: "http://localhost:3000/fr",
      en: "http://localhost:3000/en",
      "x-default": "http://localhost:3000/fr",
    });
    expect(alternatives("/faq")["x-default"]).toBe("http://localhost:3000/fr/faq");
  });
  it("metadata : titre, canonique et Open Graph", () => {
    const m = construireMetadata({ locale: "en", titre: "T", description: "D", nomSite: "TEST_SITE" });
    expect(m.title).toBe("T | TEST_SITE");
    expect(m.alternates?.canonical).toBe("http://localhost:3000/en");
    expect(m.openGraph).toMatchObject({ siteName: "TEST_SITE", url: "http://localhost:3000/en" });
  });
  it("JSON-LD : nom issu du réglage, aucune note ni avis", () => {
    const json = serialiserJsonLd(organisationJsonLd("TEST_SITE"));
    expect(json).toContain('"name":"TEST_SITE"');
    expect(json).toContain("NATHANGROUP SARL");
    expect(json).not.toMatch(/rating|review|aggregate/i);
  });
  it("JSON-LD : « < » est échappé", () => {
    expect(serialiserJsonLd({ a: "</script>" })).not.toContain("</script>");
  });
});
