import { expect, test } from "@playwright/test";
import { connecterCompteTest, lireEnv } from "./police-outils";

// Site en français uniquement (décision de Jonathan du 2026-11-22, spec « B ») : l'anglais est désactivé mais conservé.
// Toute adresse /en… redirige de façon permanente (308) vers la page française équivalente ; « / » mène toujours à /fr ;
// aucun sélecteur de langue sur le site, la connexion ou l'admin. L'admin est ouvert par un Compte TEST_ réel (rôle admin), supprimé à la fin.

const env = lireEnv();

test.describe("redirections /en vers /fr", () => {
  for (const [de, vers] of [
    ["/en", "/fr"],
    ["/en/accessories/x", "/fr/accessoires/x"],
    ["/en/clothing/x", "/fr/vetements/x"],
    ["/en/other-items", "/fr/autres-articles"],
    ["/en/cart", "/fr/panier"],
    ["/en/cosplays", "/fr/cosplays"],
    ["/en/blog/y", "/fr/blog/y"],
    ["/en/admin", "/fr/admin"],
    ["/en/connexion?retour=/en/kits", "/fr/connexion?retour=/en/kits"],
    ["/en/accessories?tri=prix_asc", "/fr/accessoires?tri=prix_asc"],
  ] as const) {
    test(`${de} : 308 vers ${vers}`, async ({ request }) => {
      const reponse = await request.get(de, { maxRedirects: 0 });
      expect(reponse.status()).toBe(308);
      const cible = new URL(reponse.headers()["location"], "http://base.test");
      expect(`${cible.pathname}${decodeURIComponent(cible.search)}`).toBe(vers);
    });
  }
});

test("« / » avec un navigateur anglais et le cookie NEXT_LOCALE=en : /fr", async ({ playwright, baseURL }) => {
  const requete = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9", Cookie: "NEXT_LOCALE=en" } });
  const reponse = await requete.get("/", { maxRedirects: 0 });
  expect(new URL(reponse.headers()["location"], "http://base.test").pathname).toBe("/fr");
  await requete.dispose();
});

test.describe("aucun sélecteur de langue", () => {
  for (const chemin of ["/fr", "/fr/accessoires", "/fr/connexion"]) {
    test(`${chemin} : aucun lien vers l'anglais, aucun hreflang`, async ({ page }) => {
      await page.goto(chemin, { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      await expect(page.getByRole("link", { name: /English|Changer de langue/ })).toHaveCount(0);
      await expect(page.locator('a[hreflang="en"], a[href^="/en"]')).toHaveCount(0);
      await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(0);
      await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveCount(0);
    });
  }

  test("admin (Compte TEST_ admin) : aucun sélecteur de langue ni champ anglais dans le formulaire produit", async ({ page }) => {
    test.skip(!env, "variables Supabase absentes");
    const supprimer = await connecterCompteTest(page, env!, "test-e2e-b-francais-", "admin");
    try {
      await page.goto("/fr/admin/produits/nouveau", { waitUntil: "networkidle" });
      await expect(page.getByRole("link", { name: /English|Changer de langue/ })).toHaveCount(0);
      await expect(page.getByLabel("Titre", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Titre en anglais")).toHaveCount(0);
      await expect(page.getByLabel("Description en anglais")).toHaveCount(0);
    } finally {
      await supprimer();
    }
  });
});
