import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Story 2.5 : fiche d'un produit physique. Aucun produit n'est simulé ni créé : la base lue est celle de .env.local.
// Les adresses inconnues prouvent la 404 ; les tests de la fiche elle-même valent seulement si un produit est déjà publié (sinon ils sont sautés).

const INCONNUES = [
  "/fr/cosplays/ks-test-inconnu",
  "/en/cosplays/ks-test-inconnu",
  "/fr/accessoires/ks-test-inconnu",
  "/en/accessories/ks-test-inconnu",
] as const;

async function violationsGraves(page: Page) {
  const resultat = await new AxeBuilder({ page }).analyze();
  return resultat.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const url of INCONNUES) {
  test.describe(`adresse inconnue ${url}`, () => {
    test("404 : page non trouvée traduite, statut 404", async ({ page }) => {
      const reponse = await page.goto(url, { waitUntil: "networkidle" });
      expect(reponse?.status()).toBe(404);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThanOrEqual(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    test("axe : aucune violation grave sur la 404", async ({ page }) => {
      await page.goto(url, { waitUntil: "networkidle" });
      expect(await violationsGraves(page)).toEqual([]);
    });
  });
}

test("l'adresse française d'accessoire en anglais redirige vers l'adresse anglaise propre", async ({ page }) => {
  await page.goto("/en/accessoires/ks-test-inconnu", { waitUntil: "networkidle" });
  expect(new URL(page.url()).pathname).toBe("/en/accessories/ks-test-inconnu");
});

test("plan du site : pages statiques et catalogues présents", async ({ request }) => {
  const reponse = await request.get("/sitemap.xml");
  expect(reponse.status()).toBe(200);
  const xml = await reponse.text();
  expect(xml).toContain("/fr/cosplays</loc>");
  expect(xml).toContain("/en/accessories</loc>");
});

// Première fiche publiée trouvée dans le catalogue, ou null (aucun produit publié dans la base lue).
async function ouvrirPremiereFiche(page: Page, catalogue: string): Promise<boolean> {
  await page.goto(catalogue, { waitUntil: "networkidle" });
  const lien = page.locator("main article h3 a").first();
  if ((await lien.count()) === 0) return false;
  await lien.click();
  await page.waitForLoadState("networkidle");
  return true;
}

for (const catalogue of ["/fr/cosplays", "/en/accessories"] as const) {
  test.describe(`fiche depuis ${catalogue}`, () => {
    test("structure, métadonnées, JSON-LD, bandeau avant la zone d'achat, 375 px, axe", async ({ page }) => {
      test.skip(!(await ouvrirPremiereFiche(page, catalogue)), "aucun produit publié dans la base lue");
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${new URL(page.url()).pathname}$`));
      await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveCount(1);
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(1);
      await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
      const jsonld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
      expect(jsonld).toContain('"Product"');
      expect(jsonld).toContain('"BreadcrumbList"');
      expect(jsonld).not.toMatch(/rating|review|aggregate/i);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.getByText(/Remise uniquement à Goma et Bukavu|Handover only in Goma and Bukavu/)).toBeVisible();
      expect(await violationsGraves(page)).toEqual([]);
    });

    test("galerie au clavier : Agrandir ouvre la boîte de dialogue, Échap la ferme", async ({ page }) => {
      test.skip(!(await ouvrirPremiereFiche(page, catalogue)), "aucun produit publié dans la base lue");
      await expect(page.locator("main [role=status]").first()).toContainText(/\d/);
      const agrandir = page.getByRole("button", { name: /Agrandir|Enlarge/ });
      await agrandir.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    });

    test("le zoom du navigateur n'est pas bloqué", async ({ page }) => {
      test.skip(!(await ouvrirPremiereFiche(page, catalogue)), "aucun produit publié dans la base lue");
      const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
      expect(viewport ?? "").not.toMatch(/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/);
    });
  });
}
