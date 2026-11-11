import { expect, test, type Page } from "@playwright/test";

// Story 7.2 : pages Festival. Aucune donnée de test n'est créée en base : le test s'adapte aux Événements publiés (ou à leur absence).
const LANGUES = ["fr", "en"] as const;

const sansDebordement = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const langue of LANGUES) {
  test.describe(`/${langue}/festival`, () => {
    test.use({ viewport: { width: 375, height: 800 } });

    test("la liste répond, un seul H1, sans défilement horizontal à 375 px, sans marqueur dans les JSON-LD", async ({ page }) => {
      const reponse = await page.goto(`/${langue}/festival`, { waitUntil: "networkidle" });
      expect(reponse?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(await sansDebordement(page)).toBe(true);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${langue}/festival$`));
      const jsonld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
      expect(jsonld).not.toContain("[Texte à fournir]");
    });

    test("la page d'un Événement publié (s'il y en a) a son JSON-LD Event ; un slug inconnu donne une 404", async ({ page }) => {
      const inconnu = await page.goto(`/${langue}/festival/slug-qui-n-existe-pas`);
      expect(inconnu?.status()).toBe(404);

      await page.goto(`/${langue}/festival`, { waitUntil: "networkidle" });
      const liens = page.locator(`main a[href^="/${langue}/festival/"]`);
      if ((await liens.count()) === 0) {
        test.info().annotations.push({ type: "info", description: "Aucun Événement publié en base : seule la liste vide est vérifiée." });
        return;
      }
      const href = await liens.first().getAttribute("href");
      const reponse = await page.goto(href!, { waitUntil: "networkidle" });
      expect(reponse?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(await sansDebordement(page)).toBe(true);
      const jsonld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
      expect(jsonld).toContain('"@type":"Event"');
      expect(jsonld).toContain('"@type":"BreadcrumbList"');
      expect(jsonld).toContain("+02:00");
      expect(jsonld).not.toContain("[Texte à fournir]");
      await expect(page.getByRole("button", { name: langue === "fr" ? "Partager" : /Share/i })).toHaveCount(1);
    });
  });
}
