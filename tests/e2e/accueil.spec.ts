import { expect, test } from "@playwright/test";

test("l'accueil répond sans défilement horizontal à 375 px", async ({ page }) => {
  const reponse = await page.goto("/");
  expect(reponse?.status()).toBe(200);
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(deborde).toBe(false);
});
