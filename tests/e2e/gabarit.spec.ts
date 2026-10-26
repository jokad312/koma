import { expect, test, type Page } from "@playwright/test";

async function ouvrirMenu(page: Page) {
  const bouton = page.getByRole("button", { name: "Menu", exact: true });
  const dialogue = page.getByRole("dialog", { name: "Menu" });
  // Réessaie tant que la page n'est pas hydratée.
  await expect(async () => {
    await bouton.click();
    await expect(dialogue).toBeVisible({ timeout: 1000 });
  }).toPass();
  return dialogue;
}

test("Tab atteint « Aller au contenu » en premier, Entrée met le focus sur <main>", async ({ page }) => {
  await page.goto("/fr");
  await page.keyboard.press("Tab");
  const lien = page.getByRole("link", { name: "Aller au contenu" });
  await expect(lien).toBeFocused();
  await expect(lien).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#contenu")).toBeFocused();
});

test("en anglais, le lien d'évitement et les repères sont traduits", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeAttached();
  await expect(page.locator("header")).toHaveCount(1);
  await expect(page.locator("footer")).toHaveCount(1);
  await expect(page.locator("footer")).toContainText("Handmade in Goma, DRC. NATHANGROUP SARL.");
});

for (const langue of ["fr", "en"]) {
  test(`/${langue} à 375 px : pas de défilement horizontal, logo avec texte alternatif, pied de page`, async ({ page }) => {
    await page.goto(`/${langue}`);
    const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(deborde).toBe(false);
    const logo = page.locator('header img[src$="/logo/logo-principal.svg"]');
    await expect(logo).toBeVisible();
    expect((await logo.getAttribute("alt"))?.trim().length).toBeGreaterThan(0);
    await expect(page.locator(`header a[href="/${langue}"]`)).toBeVisible();
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`logo en thème ${theme} : bon fichier visible, un seul exposé aux technologies d'assistance, alt = nom du site, lien vers l'accueil`, async ({ page }) => {
    await page.addInitScript((t) => {
      if (t === "dark") window.localStorage.setItem("ks-theme", "dark");
    }, theme);
    await page.goto("/en", { waitUntil: "networkidle" });
    const visible = page.locator(theme === "dark" ? 'header img[src$="/logo/logo-principal-inverse.svg"]' : 'header img[src$="/logo/logo-principal.svg"]');
    const cache = page.locator(theme === "dark" ? 'header img[src$="/logo/logo-principal.svg"]' : 'header img[src$="/logo/logo-principal-inverse.svg"]');
    await expect(visible).toBeVisible();
    await expect(cache).toBeHidden();
    // display: none retire l'image de l'arbre d'accessibilité : un seul logo est exposé.
    await expect(page.locator("header").getByRole("img")).toHaveCount(1);
    const nomSite = (await page.locator("#pied-identite").innerText()).trim();
    expect(await visible.getAttribute("alt")).toBe(nomSite);
    await expect(page.locator("header").getByRole("link", { name: nomSite })).toHaveAttribute("href", "/en");
  });
}

for (const langue of ["fr", "en"] as const) {
  test(`/${langue} : le script de thème est dans le HTML du serveur (donc exécuté avant le premier rendu)`, async ({ request }) => {
    const reponse = await request.get(`/${langue}`);
    expect(reponse.status()).toBe(200);
    const html = await reponse.text();
    const head = html.slice(0, html.indexOf("</head>"));
    expect(head).toContain('getItem("ks-theme")');
    expect(head).toContain('setAttribute("data-theme","dark")');
  });

  test(`/${langue} sans JavaScript de l'application : ks-theme=dark donne déjà data-theme="dark" (script inline seul)`, async ({ page }) => {
    // Les scripts de Next sont bloqués : seul le script inline du HTML peut poser l'attribut.
    await page.route("**/_next/static/**", (route) => route.abort());
    await page.addInitScript(() => window.localStorage.setItem("ks-theme", "dark"));
    await page.goto(`/${langue}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
}

for (const langue of ["fr", "en"] as const) {
  test(`/${langue}/zzz en thème sombre : thème posé avant la première peinture, aucun avertissement « script tag »`, async ({ page }) => {
    const messages: string[] = [];
    page.on("console", (m) => messages.push(m.text()));
    await page.addInitScript(() => {
      window.localStorage.setItem("ks-theme", "dark");
      const w = window as unknown as { __themes: Record<string, string | null> };
      w.__themes = {};
      const theme = () => document.documentElement.getAttribute("data-theme");
      // Au moment où le contenu (main) entre dans le DOM, puis à la première image affichée.
      new MutationObserver((_, obs) => {
        if (document.querySelector("main")) {
          w.__themes.contenu = theme();
          obs.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
      // Première image affichée avec du contenu (sur la 404 de développement, les premières images sont une coquille vide).
      const surImage = () => {
        if (document.querySelector("main")) w.__themes.premiereImage = theme();
        else requestAnimationFrame(surImage);
      };
      requestAnimationFrame(surImage);
    });
    await page.goto(`/${langue}/zzz`, { waitUntil: "networkidle" });
    // On est bien sur la 404 traduite, et les mesures ont été prises.
    await expect(page.locator("h1")).toHaveText(langue === "fr" ? "Page introuvable" : "Page not found");
    await page.waitForFunction(() => {
      const t = (window as unknown as { __themes?: Record<string, string | null> }).__themes;
      return t !== undefined && t.contenu !== undefined && t.premiereImage !== undefined;
    });
    const themes = await page.evaluate(() => (window as unknown as { __themes: Record<string, string | null> }).__themes);
    expect(themes.contenu).toBe("dark");
    expect(themes.premiereImage).toBe("dark");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(22, 19, 15)");
    expect(messages.filter((m) => /script tag/i.test(m))).toEqual([]);
  });
}

test("menu ☰ : dialogue ouvert au clavier, page inert, Échap ferme et rend le focus au bouton", async ({ page }) => {
  await page.goto("/fr");
  const bouton = page.getByRole("button", { name: "Menu", exact: true });
  const dialogue = page.getByRole("dialog", { name: "Menu" });
  // Réessaie tant que la page n'est pas hydratée (le clavier n'a d'effet qu'ensuite).
  await expect(async () => {
    await bouton.focus();
    await page.keyboard.press("Enter");
    await expect(dialogue).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(bouton).toHaveAttribute("aria-expanded", "true");
  await expect(dialogue.getByRole("button", { name: "Fermer le menu" })).toBeFocused();
  await expect(page.locator("#racine-page")).toHaveAttribute("inert", "");
  await page.keyboard.press("Escape");
  await expect(dialogue).toBeHidden();
  await expect(page.locator("#racine-page")).not.toHaveAttribute("inert", "");
  await expect(bouton).toBeFocused();
});

test("le thème sombre est mémorisé et posé dès le premier rendu", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
  const dialogue = await ouvrirMenu(page);
  const bascule = dialogue.getByRole("button", { name: "Thème sombre" });
  await expect(bascule).toHaveAttribute("aria-pressed", "false");
  await bascule.click();
  await expect(bascule).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  // Rechargement : l'attribut est posé par le script de <head> avant que React ne soit chargé.
  await page.reload({ waitUntil: "commit" });
  await page.waitForFunction(() => document.documentElement?.getAttribute("data-theme") === "dark", undefined, { polling: "raf" });
  const fond = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(fond).toBe("rgb(22, 19, 15)");
});

test("sans JavaScript : contenu visible et thème crème", async ({ browser, baseURL }) => {
  const contexte = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 375, height: 812 } });
  const page = await contexte.newPage();
  await page.goto("/fr");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
  const fond = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(fond).toBe("rgb(243, 238, 228)");
  await contexte.close();
});

test("le sélecteur de langue garde la page et écrit le cookie NEXT_LOCALE", async ({ page, context }) => {
  await page.goto("/fr/zzz");
  const dialogue = await ouvrirMenu(page);
  await dialogue.getByRole("link", { name: "English" }).click();
  await page.waitForURL("**/en/zzz");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "NEXT_LOCALE")?.value).toBe("en");
});

test("contraste forcé : le verre de l'en-tête devient Canvas, sans flou", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/fr");
  const entete = await page.locator("header").evaluate((el) => {
    const s = getComputedStyle(el);
    return { fond: s.backgroundColor, flou: s.backdropFilter };
  });
  const canvas = await page.evaluate(() => {
    const e = document.createElement("div");
    e.style.backgroundColor = "Canvas";
    document.body.appendChild(e);
    const c = getComputedStyle(e).backgroundColor;
    e.remove();
    return c;
  });
  expect(entete.fond).toBe(canvas);
  expect(entete.flou).toBe("none");
});

test("contraste forcé : la sélection et le contour de focus utilisent Highlight", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/fr");
  const couleurs = await page.evaluate(() => {
    const resoudre = (v: string, prop: "color" | "outlineColor") => {
      const e = document.createElement("div");
      e.style[prop] = v;
      document.body.appendChild(e);
      const c = getComputedStyle(e)[prop];
      e.remove();
      return c;
    };
    return {
      selection: getComputedStyle(document.querySelector("h1")!, "::selection").backgroundColor,
      highlight: resoudre("Highlight", "color"),
    };
  });
  expect(couleurs.selection).toBe(couleurs.highlight);
  await page.keyboard.press("Tab");
  const contour = await page.evaluate(() => {
    const e = document.createElement("div");
    e.style.color = "Highlight";
    document.body.appendChild(e);
    const highlight = getComputedStyle(e).color;
    e.remove();
    return { outline: getComputedStyle(document.activeElement!).outlineColor, highlight };
  });
  expect(contour.outline).toBe(contour.highlight);
});

test("hauteur de fenêtre < 500 px : l'en-tête n'est plus collant", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 480 });
  await page.goto("/fr");
  const position = await page.locator("header").evaluate((el) => getComputedStyle(el).position);
  expect(position).toBe("static");
});

test("Tab vers un élément sous le pli : l'en-tête ne le recouvre pas", async ({ page }) => {
  await page.goto("/fr", { waitUntil: "networkidle" });
  // Attend l'hydratation : sinon React remplacerait les éléments ajoutés.
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const main = document.querySelector("main")!;
    const vide = document.createElement("div");
    vide.style.height = "2000px";
    const lien = document.createElement("a");
    lien.id = "bas-de-page";
    lien.href = "#bas-de-page";
    lien.textContent = "bas";
    main.append(vide, lien);
  });
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => document.activeElement?.id === "bas-de-page")) break;
  }
  const r = await page.evaluate(() => ({
    lien: document.getElementById("bas-de-page")!.getBoundingClientRect().top,
    entete: document.querySelector("header")!.getBoundingClientRect().bottom,
    actif: document.activeElement?.id,
  }));
  expect(r.actif).toBe("bas-de-page");
  expect(r.lien).toBeGreaterThanOrEqual(r.entete);
});

test("l'en-tête est collant et le focus n'est jamais masqué (scroll-padding-top)", async ({ page }) => {
  await page.goto("/fr");
  const info = await page.evaluate(() => ({
    position: getComputedStyle(document.querySelector("header")!).position,
    hauteur: document.querySelector("header")!.getBoundingClientRect().height,
    padding: parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop),
  }));
  expect(info.position).toBe("sticky");
  expect(info.hauteur).toBe(64);
  expect(info.padding).toBeGreaterThan(info.hauteur);
});

test("mouvement réduit : les animations sont coupées", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/fr");
  const duree = await page.evaluate(() => parseFloat(getComputedStyle(document.body).transitionDuration));
  expect(duree).toBeLessThan(0.001);
});

test.describe("ordinateur 1280 px", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("bascule de thème et langue dans l'en-tête, pas de bouton ☰, pas de débordement", async ({ page }) => {
    await page.goto("/fr");
    await expect(page.locator("header").getByRole("button", { name: "Thème sombre" })).toBeVisible();
    await expect(page.locator("header").getByRole("link", { name: "English" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeHidden();
    const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(deborde).toBe(false);
  });
});
