import { beforeEach, describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "TEST_cle_publique";
});

describe("robots", () => {
  it("exclut /api/, admin et compte dans les deux langues", () => {
    const regles = robots().rules;
    const disallow = (Array.isArray(regles) ? regles[0] : regles).disallow;
    expect(disallow).toEqual(
      expect.arrayContaining(["/api/", "/auth/", "/fr/admin", "/en/admin", "/fr/compte", "/en/compte"]),
    );
  });
  it("part de NEXT_PUBLIC_SITE_URL", () => {
    expect(robots().sitemap).toBe("http://localhost:3000/sitemap.xml");
  });
});

describe("sitemap", () => {
  it("liste les deux langues avec alternates, depuis NEXT_PUBLIC_SITE_URL", () => {
    const entrees = sitemap();
    expect(entrees.map((e) => e.url)).toEqual([
      "http://localhost:3000/fr",
      "http://localhost:3000/en",
      "http://localhost:3000/fr/a-propos",
      "http://localhost:3000/en/a-propos",
      "http://localhost:3000/fr/faq",
      "http://localhost:3000/en/faq",
      "http://localhost:3000/fr/contact",
      "http://localhost:3000/en/contact",
    ]);
    for (const chemin of ["", "/a-propos", "/faq", "/contact"]) {
      const e = entrees.find((x) => x.url === `http://localhost:3000/fr${chemin}`);
      expect(e?.alternates?.languages).toEqual({
        fr: `http://localhost:3000/fr${chemin}`,
        en: `http://localhost:3000/en${chemin}`,
        "x-default": `http://localhost:3000/fr${chemin}`,
      });
    }
  });
});
