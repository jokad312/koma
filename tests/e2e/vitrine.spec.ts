import AxeBuilder from "@axe-core/playwright";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

// Story 1.8 : pages À propos, FAQ et Contact. Aucun envoi simulé : l'envoi réel ne se teste que si la boîte de test locale
// (MAILPIT_URL, base Supabase locale avec les migrations) est joignable, comme les tests de connexion.
const BOITE = process.env.MAILPIT_URL?.replace(/\/+$/, "");

const PAGES = [
  { chemin: "a-propos", h1: { fr: "Jonathan et son atelier", en: "Jonathan and his workshop" } },
  { chemin: "faq", h1: { fr: "FAQ", en: "FAQ" } },
  { chemin: "contact", h1: { fr: "Contact", en: "Contact" } },
] as const;
const LANGUES = ["fr", "en"] as const;

async function violationsGraves(page: Page) {
  const resultat = await new AxeBuilder({ page }).analyze();
  return resultat.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
}

async function ouvrir(page: Page, url: string, theme: "light" | "dark" = "light") {
  await page.addInitScript((t) => {
    if (t === "dark") window.localStorage.setItem("ks-theme", "dark");
  }, theme);
  await page.goto(url, { waitUntil: "networkidle" });
}

for (const langue of LANGUES) {
  for (const { chemin, h1 } of PAGES) {
    const url = `/${langue}/${chemin}`;
    test.describe(url, () => {
      test("un seul H1, métadonnées, canonique, hreflang et JSON-LD", async ({ page }) => {
        await ouvrir(page, url);
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator("h1")).toHaveText(h1[langue]);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`/${langue}/${chemin}$`));
        for (const hreflang of ["fr", "en", "x-default"]) await expect(page.locator(`link[rel="alternate"][hreflang="${hreflang}"]`)).toHaveCount(1);
        await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
        const jsonld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
        expect(jsonld).toContain(chemin === "contact" ? '"ContactPage"' : '"WebPage"');
        // Le marqueur « [Texte à fournir] » n'entre jamais dans les données structurées.
        expect(jsonld).not.toContain("[Texte à fournir]");
        expect(jsonld).not.toMatch(/rating|review|aggregate/i);
      });

      for (const theme of ["light", "dark"] as const) {
        test(`axe sans violation grave, thème ${theme}`, async ({ page }) => {
          await ouvrir(page, url, theme);
          expect(await violationsGraves(page)).toEqual([]);
        });
      }

      test("375 px : aucun défilement horizontal", async ({ page }) => {
        await ouvrir(page, url);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      });
    });
  }
}

test("la FAQ sans paire réelle ne publie pas de FAQPage", async ({ page }) => {
  await ouvrir(page, "/fr/faq");
  const jsonld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join("\n");
  const aDesMarqueurs = (await page.locator("main").innerText()).includes("[Texte à fournir]");
  if (aDesMarqueurs) expect(jsonld).not.toContain("FAQPage");
});

test("FAQ : accordéons au clavier, plusieurs ouverts à la fois", async ({ page }) => {
  await ouvrir(page, "/fr/faq");
  const resumes = page.locator("main summary");
  await expect(resumes).toHaveCount(3);
  await resumes.nth(0).focus();
  await page.keyboard.press("Enter");
  await resumes.nth(1).focus();
  await page.keyboard.press("Space");
  await expect(page.locator("main details[open]")).toHaveCount(2);
  await resumes.nth(0).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("main details[open]")).toHaveCount(1);
});

test("en-tête : rubrique À propos ; pied : carte Aide (FAQ, Contact)", async ({ page }) => {
  await ouvrir(page, "/fr");
  // À 375 px la rubrique est dans le panneau ☰.
  const bouton = page.getByRole("button", { name: "Menu", exact: true });
  await expect(async () => {
    await bouton.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(page.getByRole("dialog").getByRole("link", { name: "À propos" })).toHaveAttribute("href", "/fr/a-propos");
  await page.keyboard.press("Escape");

  const aide = page.locator("footer").getByRole("region", { name: "Aide" });
  await expect(aide.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/fr/faq");
  await expect(aide.getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/fr/contact");
});

test("bouton WhatsApp : seulement avec un numéro, nouvel onglet et rel sécurisé", async ({ page }) => {
  await ouvrir(page, "/fr/contact");
  const liens = page.locator('main a[href^="https://wa.me/"]');
  if ((await liens.count()) === 0) {
    // Aucun numéro réglé : aucun bouton ni lien WhatsApp nulle part.
    await expect(page.locator('a[href*="wa.me"]')).toHaveCount(0);
    return;
  }
  await expect(liens.first()).toHaveAttribute("target", "_blank");
  await expect(liens.first()).toHaveAttribute("rel", "noopener noreferrer");
  expect(await liens.first().getAttribute("href")).not.toContain("text=");
});

test("contact : champs invalides, erreurs sous les champs liées par aria-describedby, rien d'envoyé", async ({ page }) => {
  await ouvrir(page, "/fr/contact");
  const nom = page.getByLabel("Nom");
  const email = page.getByLabel("Adresse email");
  const message = page.getByLabel(/^Message/);
  await expect(async () => {
    await nom.fill("TEST_Awa");
    await email.fill("pas-un-email");
    await message.fill("court");
    await page.getByRole("button", { name: "Envoyer le message" }).click();
    await expect(page.getByRole("alert").first()).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 20_000 });

  await expect(page.getByText("Saisis une adresse email valide.")).toBeVisible();
  await expect(page.getByText("Ton message doit avoir de 10 à 2000 caractères.")).toBeVisible();
  const decrit = await email.getAttribute("aria-describedby");
  await expect(page.locator(`[id="${decrit}"]`)).toHaveText("Saisis une adresse email valide.");
  // La saisie reste, aucun succès n'est affiché.
  await expect(nom).toHaveValue("TEST_Awa");
  await expect(email).toHaveValue("pas-un-email");
  await expect(message).toHaveValue("court");
  await expect(page.getByText(/Message envoyé/)).toHaveCount(0);
  expect(await violationsGraves(page)).toEqual([]);
});

test("contact : le clavier suffit pour parcourir le formulaire", async ({ page }) => {
  await ouvrir(page, "/fr/contact");
  await page.getByLabel("Nom").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Adresse email")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel(/^Message/)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Envoyer le message" })).toBeFocused();
});

async function boiteJoignable(request: APIRequestContext) {
  if (!BOITE) return false;
  try {
    return (await request.get(`${BOITE}/api/v1/info`)).ok();
  } catch {
    return false;
  }
}

test("contact : un envoi valide est enregistré, « Message envoyé » après la réponse, champs vidés", async ({ page, request }) => {
  test.setTimeout(60_000);
  const joignable = await boiteJoignable(request);
  if (process.env.CI) expect(joignable, "MAILPIT_URL absente ou base locale injoignable en CI").toBe(true);
  else test.skip(!joignable, "Base Supabase locale (MAILPIT_URL) absente : un vrai envoi ne se fait que sur une base jetable avec les migrations de la 1.8.");

  await ouvrir(page, "/fr/contact");
  await expect(async () => {
    await page.getByLabel("Nom").fill("TEST_Awa");
    await page.getByLabel("Adresse email").fill("test-contact@example.com");
    await page.getByLabel(/^Message/).fill("Bonjour, ceci est un message de test automatique.");
    await page.getByRole("button", { name: "Envoyer le message" }).click();
    await expect(page.getByText(/Message envoyé/)).toBeVisible({ timeout: 4_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByLabel("Nom")).toHaveValue("");
});
