import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Le clic sur « Continuer avec Google » n'est jamais automatisé (aucune connexion Google simulée) : il est testé à la main.
const INSTAGRAM_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21C62 Instagram 315.1.2.30.114 (iPhone14,5; iOS 17_2; fr_FR; fr-FR; scale=3.00; 1170x2532; 560280631)";
const INSTAGRAM_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-A135F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.144 Mobile Safari/537.36 Instagram 315.0.0.29.109 Android (33/13; 450dpi; 1080x2159; samsung; SM-A135F; a13; exynos850; fr_FR; 560180679)";

test.describe("navigateur intégré", () => {
  test.use({ userAgent: INSTAGRAM_IPHONE, viewport: { width: 375, height: 812 } });

  test("Instagram iPhone : bandeau, pas de bouton Google, code email disponible, 375 px sans défilement horizontal", async ({ page }) => {
    await page.goto("/fr/connexion");
    const bandeau = page.getByRole("region", { name: "Ouvrir dans ton navigateur" });
    await expect(bandeau).toBeVisible();
    await expect(bandeau.getByRole("button", { name: "Copier le lien" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Google/ })).toHaveCount(0);
    await expect(page.getByLabel("Adresse email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Recevoir un code" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const violations = (await new AxeBuilder({ page }).analyze()).violations;
    expect(violations).toEqual([]);
  });

  test("le bandeau se ferme et le choix est mémorisé sur une autre page", async ({ page }) => {
    await page.goto("/fr");
    await page.getByRole("button", { name: "Fermer l'avis" }).click();
    await expect(page.getByRole("region", { name: "Ouvrir dans ton navigateur" })).toHaveCount(0);
    await page.goto("/fr/connexion");
    await expect(page.getByRole("region", { name: "Ouvrir dans ton navigateur" })).toHaveCount(0);
  });
});

test.describe("Instagram Android", () => {
  test.use({ userAgent: INSTAGRAM_ANDROID, viewport: { width: 375, height: 812 } });

  test("le bouton « Ouvrir dans mon navigateur » mène vers Chrome", async ({ page }) => {
    await page.goto("/en/connexion");
    const lien = page.getByRole("link", { name: "Open in my browser" });
    await expect(lien).toHaveAttribute("href", /^intent:\/\/.*package=com\.android\.chrome/);
    await expect(page.getByRole("button", { name: /Google/ })).toHaveCount(0);
  });
});

test.describe("retour de Google en échec", () => {
  test("la page de connexion explique l'échec et garde le code email", async ({ page }) => {
    await page.goto("/fr/connexion?erreur=google");
    await expect(page.getByRole("alert").filter({ hasText: "La connexion avec Google n'a pas abouti" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Recevoir un code" })).toBeVisible();
  });
});

test.describe("navigateur normal", () => {
  test("Chrome : bouton « Continuer avec Google » et aucun bandeau", async ({ page }) => {
    await page.goto("/fr/connexion");
    await expect(page.getByRole("button", { name: "Continuer avec Google" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Ouvrir dans ton navigateur" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Recevoir un code" })).toBeVisible();
  });
});
