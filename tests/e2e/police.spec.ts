import { expect, test, type Page } from "@playwright/test";
import { connecterCompteTest, etatTypo, lireEnv, violationsGraves } from "./police-outils";

// Story 9.16 a) : KOMA Chikara partout, aucun texte sous 16 px, 320 px sans défilement horizontal, axe-core sans violation grave.
// La fiche produit (avec un nom japonais et un emoji) est vérifiée dans police-secours.spec.ts. L'admin est ouvert par un Compte TEST_
// réel avec le rôle admin (API d'administration), supprimé à la fin.

const env = lireEnv();

async function verifier(page: Page, chemin: string) {
  await page.setViewportSize({ width: 375, height: 812 });
  const reponse = await page.goto(chemin, { waitUntil: "load" });
  expect(reponse?.status(), chemin).toBe(200);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);

  // Police chargée et pile calculée : KOMA Chikara (nom donné par next/font), ses replis réglés (Arial, Roboto), puis les polices système.
  expect(await page.evaluate(() => document.fonts.check('16px "komaChikara"')), "KOMA Chikara chargée").toBe(true);
  const { famille, petits } = await etatTypo(page);
  expect(famille).toMatch(/^"?komaChikara"?, "?KOMA Repli Arial"?, "?KOMA Repli Roboto"?, system-ui, sans-serif$/);
  expect(petits, `textes sous 16 px sur ${chemin}`).toEqual([]);

  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `320 px sur ${chemin}`).toBe(true);
  expect(await violationsGraves(page), `axe sur ${chemin}`).toEqual([]);
}

test.describe("police unique KOMA Chikara, 16 px minimum", () => {
  test.describe.configure({ timeout: 120_000 });

  for (const chemin of ["/fr", "/fr/kits", "/fr/connexion"]) {
    test(`${chemin} : KOMA Chikara, aucun texte sous 16 px, 320 px, axe`, async ({ page }) => {
      await verifier(page, chemin);
    });
  }

  test("/fr/admin (Compte TEST_ admin) : KOMA Chikara, aucun texte sous 16 px, 320 px, axe", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    const supprimer = await connecterCompteTest(page, env!, "test-e2e-916-police-", "admin");
    try {
      await verifier(page, "/fr/admin");
    } finally {
      await supprimer();
    }
  });

  test("la page précharge le woff2 de KOMA Chikara (en-tête Link ou balise <link>)", async ({ request }) => {
    const reponse = await request.get("/fr");
    const lien = reponse.headers()["link"] ?? "";
    const html = await reponse.text();
    const prechargeEnTete = /<[^>]*koma_chikara[^>]*\.woff2>;\s*rel=preload;\s*as="font"/i.test(lien);
    const prechargeBalise = /<link[^>]*rel="preload"[^>]*koma_chikara[^>]*\.woff2|<link[^>]*koma_chikara[^>]*\.woff2[^>]*rel="preload"/i.test(html);
    expect(prechargeEnTete || prechargeBalise).toBe(true);
  });
});
