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

  test(`/${langue}/ : blocs dans l'ordre, tuiles vers les catalogues, FAQ courte, un seul H1`, async ({ page }) => {
    await page.goto(`/${langue}`);
    await expect(page.locator("h1")).toHaveCount(1);
    const titres = langue === "fr"
      ? { categories: "CATEGORIES", kits: "KITS", cosplays: "FAIT MAIN A GOMA", jonathan: "JONATHAN EN TROIS PHRASES", faq: "REPONSES RAPIDES" }
      : { categories: "CATEGORIES", kits: "KITS", cosplays: "HANDMADE IN GOMA", jonathan: "JONATHAN IN THREE SENTENCES", faq: "QUICK ANSWERS" };
    const h2 = page.locator("main h2");
    // « Fait main à Goma » et le bloc Kits n'existent que si leurs sections portent des éléments : le nombre de `li` de la section en décide, sans tolérance.
    const sectionCosplays = page.locator('main section[aria-labelledby="accueil-cosplays-recents"]');
    const avecCartes = (await sectionCosplays.count()) === 1;
    if (avecCartes) expect(await sectionCosplays.locator("li").count()).toBeGreaterThan(0);
    const sectionKits = page.locator('main section[aria-labelledby="accueil-kits"]');
    const avecKits = (await sectionKits.count()) === 1;
    if (avecKits) expect(await sectionKits.locator("li").count()).toBeGreaterThan(0);
    const attentesH2: string[] = [titres.categories];
    const sectionPorteOuFabrique = page.locator('main section[aria-labelledby="accueil-porte-ou-fabrique"]');
    const avecPorteOuFabrique = (await sectionPorteOuFabrique.count()) === 1;
    const titrePorteOuFabrique = langue === "fr" ? "PORTE-LE OU FABRIQUE-LE" : "WEAR IT OR MAKE IT";
    if (avecPorteOuFabrique) attentesH2.push(titrePorteOuFabrique);
    if (avecKits) attentesH2.push(titres.kits);
    if (avecCartes) attentesH2.push(titres.cosplays);
    // Bloc 4 « Ils le portent » : n'existe que si une photo est publiée ; alors les liens « Galerie » du pied de page existent aussi, sinon aucun des deux.
    const sectionMur = page.locator("main section#galerie");
    const avecMur = (await sectionMur.count()) === 1;
    if (avecMur) {
      expect(await sectionMur.locator("li").count()).toBeGreaterThan(0);
      attentesH2.push(langue === "fr" ? "ILS LE PORTENT" : "THEY WEAR IT");
    }
    await expect(page.locator('footer a[href$="#galerie"]')).toHaveCount(avecMur ? 1 : 0);
    attentesH2.push(titres.jonathan, titres.faq);
    await expect(h2).toHaveText(attentesH2);
    const tuiles = page.locator('section[aria-labelledby="accueil-categories"]');
    await expect(tuiles.locator(`a[href="/${langue}/cosplays"]`)).toBeVisible();
    await expect(tuiles.locator(`a[href="/${langue}/${langue === "fr" ? "accessoires" : "accessories"}"]`)).toBeVisible();
    await expect(tuiles.locator(`a[href="/${langue}/kits"]`)).toBeVisible();
    await expect(page.locator("main details")).toHaveCount(3);
  });

  test(`/${langue}/ : tuiles sur une colonne à 320 px, sans défilement horizontal`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/${langue}`);
    const tuiles = page.locator('section[aria-labelledby="accueil-categories"] ul a');
    await expect(tuiles).toHaveCount(3);
    const boites = await Promise.all([tuiles.nth(0).boundingBox(), tuiles.nth(1).boundingBox(), tuiles.nth(2).boundingBox()]);
    for (const boite of boites) expect(boite).not.toBeNull();
    const xs = boites.map((b) => b?.x ?? Number.NaN);
    expect(new Set(xs).size).toBe(1);
    const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(deborde).toBe(false);
  });

  test(`/${langue}/ : JSON-LD Organization présent, aucun marqueur dans les JSON-LD`, async ({ page }) => {
    await page.goto(`/${langue}`);
    const blocs = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(blocs.length).toBeGreaterThan(0);
    for (const b of blocs) expect(b).not.toContain("[Texte à fournir]");
    expect(blocs.some((b) => JSON.parse(b)["@type"] === "Organization")).toBe(true);
  });

  test(`/${langue}/zzz : 404 traduite avec lien vers l'accueil`, async ({ page }) => {
    const reponse = await page.goto(`/${langue}/zzz`);
    expect(reponse?.status()).toBe(404);
    await expect(page.locator("html")).toHaveAttribute("lang", langue);
    await expect(page.locator("h1")).toHaveText(langue === "fr" ? "Page introuvable" : "Page not found");
    await expect(page.locator(`main a[href="/${langue}"]`)).toBeVisible();
  });
}

// Héros (story 2.6). Les réglages du héros vivent en base : les tests tiennent quelle que soit la configuration de Jonathan.
const ACCROCHES = { fr: "Deviens ton personnage.", en: "Become your character." } as const;

for (const langue of ["fr", "en"] as const) {
  test(`/${langue} : l'accroche du héros est le H1, en texte réel`, async ({ page }) => {
    await page.goto(`/${langue}`);
    await expect(page.locator("h1")).toHaveText(ACCROCHES[langue], { ignoreCase: true });
  });
}

test("héros : sans vidéo, pas de bouton Pause ; avec vidéo, elle est muette, en boucle et masquée aux lecteurs d'écran", async ({ page }) => {
  await page.goto("/fr");
  const video = page.locator("video");
  await page.waitForLoadState("networkidle");
  if ((await video.count()) === 0) {
    await expect(page.getByRole("button", { name: /vidéo/i })).toHaveCount(0);
    return;
  }
  await expect(video).toHaveJSProperty("muted", true);
  await expect(video).toHaveJSProperty("loop", true);
  await expect(video).toHaveAttribute("aria-hidden", "true");
});

test("héros : sous mouvement réduit, la vidéo n'est pas chargée et le bouton Pause est absent", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/fr");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /vidéo/i })).toHaveCount(0);
});
