import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// UX-DR48 (version allégée) : axe-core, 320 px, zoom 200 %, mouvement réduit, couleurs forcées, sur /fr et /en,
// en thème crème et en thème sombre.
// Seule exception : la règle color-contrast est désactivée dans le test « couleurs forcées » (voir plus bas).

const langues = ["fr", "en"] as const;
const themes = ["light", "dark"] as const;

async function ouvrir(page: Page, langue: string, theme: string) {
  // Le thème est posé avant le chargement, comme le ferait un visiteur qui l'a déjà choisi.
  await page.addInitScript((t) => {
    if (t === "dark") window.localStorage.setItem("ks-theme", "dark");
  }, theme);
  await page.goto(`/${langue}`, { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("lang", langue);
}

async function violationsGraves(page: Page, regles: { sansContraste?: boolean } = {}) {
  const axe = new AxeBuilder({ page });
  if (regles.sansContraste) axe.disableRules(["color-contrast"]);
  const resultat = await axe.analyze();
  return resultat.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

const sansDebordement = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

for (const langue of langues) {
  for (const theme of themes) {
    test.describe(`/${langue}, thème ${theme}`, () => {
      test("axe : aucune violation serious ou critical", async ({ page }) => {
        await ouvrir(page, langue, theme);
        expect(await violationsGraves(page)).toEqual([]);
      });

      test("axe : le menu ☰ ouvert n'a aucune violation serious ou critical", async ({ page }) => {
        await ouvrir(page, langue, theme);
        const bouton = page.getByRole("button", { name: "Menu", exact: true });
        const dialogue = page.getByRole("dialog");
        await expect(async () => {
          await bouton.click();
          await expect(dialogue).toBeVisible({ timeout: 1000 });
        }).toPass();
        expect(await violationsGraves(page)).toEqual([]);
      });

      test("320 px : aucun défilement horizontal", async ({ page }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await ouvrir(page, langue, theme);
        expect(await sansDebordement(page)).toBe(true);
      });

      // Zoom 200 % émulé par un viewport deux fois plus petit en pixels CSS (640 x 400, soit un écran de 1280 x 800 à 200 %)
      // avec deviceScaleFactor 2 : le navigateur ne propose pas de zoom piloté, et cette émulation donne la même mise en page.
      test("zoom 200 % : pas de défilement horizontal, en-tête non collant, contenu lisible", async ({ browser, baseURL }) => {
        const contexte = await browser.newContext({ baseURL, viewport: { width: 640, height: 400 }, deviceScaleFactor: 2 });
        const page = await contexte.newPage();
        await ouvrir(page, langue, theme);
        expect(await sansDebordement(page)).toBe(true);
        expect(await page.locator("header").evaluate((el) => getComputedStyle(el).position)).toBe("static");
        await expect(page.locator("h1")).toBeVisible();
        expect(await violationsGraves(page)).toEqual([]);
        await contexte.close();
      });

      test("mouvement réduit : aucune animation ni transition", async ({ page }) => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await ouvrir(page, langue, theme);
        const animations = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
        expect(animations).toBe(0);
        expect(await violationsGraves(page)).toEqual([]);
      });

      test("couleurs forcées : contenu visible, axe sans violation grave", async ({ page }) => {
        await page.emulateMedia({ forcedColors: "active" });
        await ouvrir(page, langue, theme);
        await expect(page.locator("h1")).toBeVisible();
        await expect(page.locator("header img:visible")).toHaveCount(1);
        // En contraste forcé le navigateur impose lui-même les couleurs (mesuré : texte noir sur fond blanc, ratio 21:1).
        // Axe lit alors à tort les couleurs de l'auteur en thème sombre (faux positif sur color-contrast) : cette règle seule est
        // écartée ici ; elle reste active dans tous les autres tests.
        expect(await violationsGraves(page, { sansContraste: true })).toEqual([]);
      });
    });
  }
}
