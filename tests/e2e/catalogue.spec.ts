import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Story 2.4 : catalogues Cosplays et Accessoires. Aucun produit n'est simulé ni créé : la base lue est celle de .env.local.
// Selon son contenu, la page montre soit la phrase « aucun produit », soit une grille ; chaque test vaut pour les deux cas.

const CATALOGUES = [
  { fr: "/fr/cosplays", en: "/en/cosplays", titre: { fr: "Cosplays", en: "Cosplays" } },
  { fr: "/fr/accessoires", en: "/en/accessories", titre: { fr: "Accessoires", en: "Accessories" } },
] as const;

async function violationsGraves(page: Page) {
  const resultat = await new AxeBuilder({ page }).analyze();
  return resultat.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

async function ouvrirMenu(page: Page) {
  const bouton = page.getByRole("button", { name: "Menu", exact: true });
  const dialogue = page.getByRole("dialog", { name: "Menu" });
  await expect(async () => {
    await bouton.click();
    await expect(dialogue).toBeVisible({ timeout: 1000 });
  }).toPass();
  return dialogue;
}

for (const c of CATALOGUES) {
  for (const langue of ["fr", "en"] as const) {
    const url = c[langue];
    test.describe(url, () => {
      test("un seul H1, canonique propre à la langue, hreflang des deux langues, BreadcrumbList, aucune erreur serveur", async ({ page }) => {
        const reponse = await page.goto(url, { waitUntil: "networkidle" });
        expect(reponse?.status()).toBe(200);
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator("h1")).toHaveText(c.titre[langue]);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${url}$`));
        await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveAttribute("href", new RegExp(`${c.fr}$`));
        await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", new RegExp(`${c.en}$`));
        await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveCount(1);
        await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
        await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
        const jsonld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
        expect(jsonld).toContain('"BreadcrumbList"');
        expect(jsonld).not.toMatch(/rating|review|aggregate/i);
        await expect(page.getByRole("navigation", { name: langue === "fr" ? "Fil d'Ariane" : "Breadcrumb" })).toBeVisible();
      });

      test("375 px : pas de défilement horizontal, contenu soit vide soit grille de 2 colonnes, filtres repliés", async ({ page }) => {
        await page.goto(url, { waitUntil: "networkidle" });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        const grille = page.locator('main ul[aria-labelledby="catalogue-liste"]').first();
        if ((await grille.count()) > 0) {
          const colonnes = await grille.evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
          expect(colonnes).toBe(2);
          await expect(page.locator("main details")).not.toHaveAttribute("open", "");
          await expect(page.locator("main [role=status]").first()).toContainText(/\d/);
        } else {
          // Aucun produit publié : une phrase courte et aucun filtre.
          await expect(page.locator("main details")).toHaveCount(0);
        }
      });

      test("axe : aucune violation grave, en thème crème", async ({ page }) => {
        await page.goto(url, { waitUntil: "networkidle" });
        expect(await violationsGraves(page)).toEqual([]);
      });

      test("axe : aucune violation grave, en thème sombre", async ({ page }) => {
        await page.addInitScript(() => window.localStorage.setItem("ks-theme", "dark"));
        await page.goto(url, { waitUntil: "networkidle" });
        expect(await violationsGraves(page)).toEqual([]);
      });

      test("clavier : Tab atteint la rubrique de navigation et un lien de la page, le focus reste visible", async ({ page }) => {
        await page.goto(url, { waitUntil: "networkidle" });
        const vus = new Set<string>();
        for (let i = 0; i < 12; i++) {
          await page.keyboard.press("Tab");
          const infos = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            if (!el || el === document.body) return null;
            const r = el.getBoundingClientRect();
            return { nom: el.tagName + ":" + (el.getAttribute("href") ?? el.textContent?.trim().slice(0, 20) ?? ""), visible: r.width > 0 && r.height > 0 };
          });
          // Le bouton des outils de développement de Next.js (serveur de test en mode dev) n'est pas la page.
          if (infos && !infos.nom.startsWith("NEXTJS-PORTAL")) {
            expect(infos.visible, infos.nom).toBe(true);
            vus.add(infos.nom);
          }
        }
        expect(vus.size).toBeGreaterThan(3);
      });
    });
  }
}

test("la rubrique Cosplays et la rubrique Accessoires pointent vers l'adresse de chaque langue", async ({ page }) => {
  await page.goto("/fr", { waitUntil: "networkidle" });
  let menu = await ouvrirMenu(page);
  await expect(menu.getByRole("link", { name: "Cosplays" })).toHaveAttribute("href", "/fr/cosplays");
  await expect(menu.getByRole("link", { name: "Accessoires" })).toHaveAttribute("href", "/fr/accessoires");
  await page.keyboard.press("Escape");

  await page.goto("/en", { waitUntil: "networkidle" });
  menu = await ouvrirMenu(page);
  await expect(menu.getByRole("link", { name: "Cosplays" })).toHaveAttribute("href", "/en/cosplays");
  await expect(menu.getByRole("link", { name: "Accessories" })).toHaveAttribute("href", "/en/accessories");
});

test("l'adresse de l'autre langue redirige en 308 vers la bonne, requête comprise", async ({ request }) => {
  const en = await request.get("/en/accessoires?tri=prix_asc", { maxRedirects: 0 });
  expect(en.status()).toBe(308);
  expect(new URL(en.headers()["location"], "http://localhost:3100").pathname + new URL(en.headers()["location"], "http://localhost:3100").search).toBe(
    "/en/accessories?tri=prix_asc",
  );
  const fr = await request.get("/fr/accessories", { maxRedirects: 0 });
  expect(fr.status()).toBe(308);
  expect(new URL(fr.headers()["location"], "http://localhost:3100").pathname).toBe("/fr/accessoires");
});

test("le sélecteur de langue garde la requête et mène à l'adresse propre de l'autre langue", async ({ page }) => {
  await page.goto("/fr/accessoires?tri=prix_asc&dispo=en_stock", { waitUntil: "networkidle" });
  const menu = await ouvrirMenu(page);
  await menu.getByRole("link", { name: "English" }).click();
  await page.waitForURL("**/en/accessories?tri=prix_asc&dispo=en_stock");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Accessories");
});

test("paramètres inconnus ou mal formés et curseur invalide : jamais d'erreur, première page", async ({ page }) => {
  test.setTimeout(120_000);
  for (const requete of ["?foo=bar", "?tri=hasard&dispo=zzz&prix=abc&univers=x", "?curseur=n-importe-quoi", "?prix=3000-1500", "?curseur=" + "a".repeat(500)]) {
    const reponse = await page.goto(`/fr/cosplays${requete}`, { waitUntil: "networkidle" });
    expect(reponse?.status(), requete).toBe(200);
    await expect(page.locator("h1")).toHaveText("Cosplays");
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  }
});

test("page triée : noindex, follow et canonique vers la page de base", async ({ page }) => {
  await page.goto("/fr/accessoires?tri=prix_desc", { waitUntil: "networkidle" });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /follow/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/fr\/accessoires$/);
});

test("une page de catalogue filtrée affiche « Effacer les filtres » qui ramène à la page de base", async ({ page }) => {
  await page.goto("/fr/cosplays?dispo=en_stock", { waitUntil: "networkidle" });
  const effacer = page.getByRole("link", { name: "Effacer les filtres" });
  if ((await effacer.count()) === 0) {
    // Aucun produit publié dans la base lue : la page n'affiche pas de filtre.
    await expect(page.locator("main details")).toHaveCount(0);
    return;
  }
  await expect(effacer.first()).toHaveAttribute("href", "/fr/cosplays");
  // Sur mobile, les filtres sont repliés sous « Filtrer (n) » : on les déplie avant de lire le choix actif.
  const replie = page.locator("main details:not([open]) > summary");
  if ((await replie.count()) > 0) await replie.first().click();
  await expect(page.getByRole("link", { name: "En stock" }).first()).toHaveAttribute("aria-current", "true");
});

test("plan du site : les deux catalogues dans les deux langues avec leur adresse propre", async ({ request }) => {
  const corps = await (await request.get("/sitemap.xml")).text();
  for (const adresse of ["/fr/cosplays", "/en/cosplays", "/fr/accessoires", "/en/accessories"]) expect(corps).toContain(`${adresse}</loc>`);
  expect(corps).not.toContain("/en/accessoires<");
  expect(corps).not.toContain("/fr/accessories<");
});
