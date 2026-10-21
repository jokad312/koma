import { expect, test } from "@playwright/test";

test("l'accueil répond sans défilement horizontal à 375 px", async ({ page }) => {
  const reponse = await page.goto("/fr");
  expect(reponse?.status()).toBe(200);
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(deborde).toBe(false);
});

test("« / » suit la redirection jusqu'à une page de langue", async ({ page }) => {
  const reponse = await page.goto("/");
  expect(reponse?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toMatch(/^\/(fr|en)$/);
});

test.describe("redirection de /", () => {
  const cas = [
    { nom: "cookie en, navigateur fr", cookie: "en", langue: "fr", attendu: "/en" },
    { nom: "navigateur fr-CD", cookie: undefined, langue: "fr-CD", attendu: "/fr" },
    { nom: "navigateur en-US", cookie: undefined, langue: "en-US", attendu: "/en" },
    { nom: "navigateur de", cookie: undefined, langue: "de", attendu: "/en" },
    { nom: "cookie invalide", cookie: "xx", langue: "en-US", attendu: "/en" },
    { nom: "en-tête absent", cookie: undefined, langue: undefined, attendu: "/fr" },
  ];
  for (const c of cas) {
    test(c.nom, async ({ playwright, baseURL }) => {
      const headers: Record<string, string> = {};
      if (c.langue) headers["Accept-Language"] = c.langue;
      if (c.cookie) headers["Cookie"] = `NEXT_LOCALE=${c.cookie}`;
      const requete = await playwright.request.newContext({ baseURL, extraHTTPHeaders: headers });
      const reponse = await requete.get("/", { maxRedirects: 0 });
      expect(reponse.status()).toBe(307);
      expect(new URL(reponse.headers()["location"], "http://base.test").pathname).toBe(c.attendu);
      await requete.dispose();
    });
  }
});

for (const langue of ["fr", "en"] as const) {
  test(`/${langue} : lang, H1 unique, canonique et hreflang`, async ({ page }) => {
    await page.goto(`/${langue}`);
    await expect(page.locator("html")).toHaveAttribute("lang", langue);
    await expect(page.locator("h1")).toHaveCount(1);
    const base = new URL(page.url()).origin;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${base}/${langue}`);
    await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveAttribute("href", `${base}/fr`);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", `${base}/en`);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", `${base}/fr`);
  });

  test(`/${langue}/zzz : 404 traduite avec lien vers l'accueil`, async ({ page }) => {
    const reponse = await page.goto(`/${langue}/zzz`);
    expect(reponse?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", langue);
    await expect(page.locator("h1")).toHaveText(langue === "fr" ? "Page introuvable" : "Page not found");
    await expect(page.locator(`a[href="/${langue}"]`)).toBeVisible();
  });
}
