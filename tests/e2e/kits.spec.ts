import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Story 3.3 : catalogue Kits et fiche Kit. Aucun Kit n'est simulé ni créé : la base lue est celle de .env.local. Sans Kit publié, le
// catalogue montre l'état vide ; les tests de la fiche elle-même sont alors sautés. Les adresses inconnues prouvent la 404.

// Identifiant de la bibliothèque Bunny privée, quand il est réglé dans l'environnement des tests : il ne doit jamais apparaître dans le HTML.
const BIBLIOTHEQUE_PRIVEE = process.env.BUNNY_PRIVE_LIBRARY_ID?.trim() || null;

function sansElementPrive(html: string) {
  expect(html).not.toContain("kits-private");
  expect(html).not.toMatch(/video_kit_prive|bunny_video_id_prive|BUNNY_PRIVE/);
  // Identifiant numérique : cherché comme nombre entier (pas à l'intérieur d'un autre nombre ou d'une empreinte).
  if (BIBLIOTHEQUE_PRIVEE) expect(html).not.toMatch(new RegExp(`(?<![0-9A-Za-z])${BIBLIOTHEQUE_PRIVEE}(?![0-9A-Za-z])`));
}

async function violationsGraves(page: Page) {
  const resultat = await new AxeBuilder({ page }).analyze();
  return resultat.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

for (const langue of ["fr", "en"] as const) {
  const url = `/${langue}/kits`;
  test.describe(url, () => {
    test("un seul H1, canonique, hreflang, BreadcrumbList, 375 px, état vide ou grille, axe", async ({ page }) => {
      const reponse = await page.goto(url, { waitUntil: "networkidle" });
      expect(reponse?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveText("Kits");
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${url}$`));
      await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveAttribute("href", /\/fr\/kits$/);
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", /\/en\/kits$/);
      const jsonld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
      expect(jsonld).toContain('"BreadcrumbList"');
      expect(jsonld).not.toMatch(/rating|review|aggregate/i);
      sansElementPrive(await page.content());
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const grille = page.locator('main ul[aria-labelledby="catalogue-liste"]');
      if ((await grille.count()) === 0) {
        // Aucun Kit publié : une phrase courte, aucun filtre ; jamais une erreur.
        await expect(page.locator("main details")).toHaveCount(0);
        await expect(page.locator("main [role=alert]")).toHaveCount(0);
      }
      expect(await violationsGraves(page)).toEqual([]);
    });

    test("filtre niveau : noindex, follow, canonique vers la page de base ; niveau inconnu ignoré", async ({ page }) => {
      await page.goto(`${url}?niveau=debutant`, { waitUntil: "networkidle" });
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /follow/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${url}$`));
      const reponse = await page.goto(`${url}?niveau=xyz`, { waitUntil: "networkidle" });
      expect(reponse?.status()).toBe(200);
      await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    });

    test("404 : fiche inconnue traduite, statut 404", async ({ page }) => {
      const reponse = await page.goto(`${url}/ks-test-absent`, { waitUntil: "networkidle" });
      expect(reponse?.status()).toBe(404);
      await expect(page.locator("h1")).toHaveCount(1);
    });
  });
}

test("la rubrique Kits est dans l'en-tête ou le menu, dans les deux langues", async ({ page }) => {
  for (const langue of ["fr", "en"] as const) {
    await page.goto(`/${langue}`, { waitUntil: "networkidle" });
    const bouton = page.getByRole("button", { name: "Menu", exact: true });
    const dialogue = page.getByRole("dialog", { name: "Menu" });
    await expect(async () => {
      await bouton.click();
      await expect(dialogue).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(dialogue.getByRole("link", { name: "Kits" })).toHaveAttribute("href", `/${langue}/kits`);
    await page.keyboard.press("Escape");
  }
});

test("plan du site : /kits dans les deux langues", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  expect(xml).toContain("/fr/kits</loc>");
  expect(xml).toContain("/en/kits</loc>");
});

test("fiche d'un Kit publié : métadonnées, JSON-LD, HTML sans élément privé, 375 px, axe", async ({ page }) => {
  await page.goto("/fr/kits", { waitUntil: "networkidle" });
  const lien = page.locator("main article h3 a").first();
  test.skip((await lien.count()) === 0, "aucun Kit publié dans la base lue");
  await lien.click();
  await page.waitForLoadState("networkidle");
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);
  const jsonld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
  expect(jsonld).toContain('"Product"');
  expect(jsonld).toContain('"InStock"');
  expect(jsonld).toContain('"BreadcrumbList"');
  expect(jsonld).not.toMatch(/rating|review|aggregate/i);
  sansElementPrive(await page.content());
  await expect(page.getByRole("heading", { name: "Licence de kit" })).toBeVisible();
  await expect(page.locator("video[autoplay]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await violationsGraves(page)).toEqual([]);
});
